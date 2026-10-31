/**
 * LifeFlow — Calendar: month grid with events, appointments and reminders.
 */
import { esc, ymd, today, fromYmd, monthLabel, fmtTime, relativeDay } from '../utils.js';
import { icon } from '../icons.js';
import { toast, confirmDialog, initSwipe } from '../ui.js';
import * as store from '../store.js';
import { EVENT_TYPES } from '../config.js';
import { openEventForm } from './forms.js';

export const meta = { title: 'Calendar', icon: 'calendar', label: 'Calendar' };

const ui = { cursor: new Date(), selected: today(), view: 'month' };

export function render(root) {
  const first = new Date(ui.cursor.getFullYear(), ui.cursor.getMonth(), 1);
  const days = buildMonth(first);
  const selectedEvents = store.select.eventsOn(ui.selected);
  const monthEvents = store.state.events.filter((e) =>
    (e.date || '').startsWith(`${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, '0')}`)
  );

  root.innerHTML = `
    <div class="page">
      <section class="card card--accent">
        <div class="flex-between">
          <div>
            <span class="eyebrow">Your schedule</span>
            <h2>${esc(monthLabel(first))}</h2>
            <p class="fs-sm t-dim">${monthEvents.length} entr${monthEvents.length === 1 ? 'y' : 'ies'} this month</p>
          </div>
          <button class="btn btn--primary btn--sm" data-new type="button">${icon('plus')} New</button>
        </div>
      </section>

      <section class="card">
        <div class="cal">
          <div class="cal__head">
            <button class="iconbtn" data-prev type="button" aria-label="Previous month">${icon('chevronLeft')}</button>
            <span class="cal__month">${esc(monthLabel(first))}</span>
            <div class="flex gap-2">
              <button class="btn btn--xs btn--ghost" data-today type="button">Today</button>
              <button class="iconbtn" data-next type="button" aria-label="Next month">${icon('chevronRight')}</button>
            </div>
          </div>
          <div class="cal__dows">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => `<span>${d}</span>`).join('')}</div>
          <div class="cal__grid">
            ${days
              .map((d) => {
                const key = ymd(d.date);
                const count = store.select.eventsOn(key).length;
                const tasks = store.state.tasks.filter((t) => t.due === key && !t.done).length;
                const pips = Math.min(3, count + (tasks ? 1 : 0));
                return `
                <button class="cal__day${d.out ? ' is-out' : ''}${key === today() ? ' is-today' : ''}${
                  key === ui.selected ? ' is-sel' : ''
                }" data-day="${key}" type="button" aria-label="${esc(d.date.toDateString())}${count ? `, ${count} events` : ''}">
                  ${d.date.getDate()}
                  ${pips ? `<span class="pips">${'<i></i>'.repeat(pips)}</span>` : ''}
                </button>`;
              })
              .join('')}
          </div>
        </div>
      </section>

      <section class="card">
        <div class="card__head">
          <h3 class="card__title">${icon('clock')} ${esc(relativeDay(ui.selected))}</h3>
          <button class="btn btn--xs btn--soft" data-new-on type="button">${icon('plus')} Add</button>
        </div>
        ${
          selectedEvents.length
            ? `<div class="timeline">${selectedEvents.map(eventCard).join('')}</div>`
            : `<div class="empty">
                 <div class="empty__icon">${icon('calendar')}</div>
                 <h3>Nothing scheduled</h3>
                 <p>This day is wide open. Add an event, appointment or reminder.</p>
                 <button class="btn btn--sm btn--soft" data-new-on type="button">${icon('plus')} Add entry</button>
               </div>`
        }
        ${dayTasksBlock(ui.selected)}
      </section>

      <section class="card">
        <div class="card__head"><h3 class="card__title">${icon('layers')} Next 7 days</h3></div>
        ${
          store.select.upcomingEvents(7).length
            ? `<div class="timeline">${store.select.upcomingEvents(7).map(upcomingRow).join('')}</div>`
            : `<p class="fs-sm t-mute">Nothing coming up. Enjoy the space 🌤️</p>`
        }
      </section>
    </div>`;

  bind(root);
}

function buildMonth(first) {
  const start = new Date(first);
  const weekday = (start.getDay() + 6) % 7; // Monday-first
  start.setDate(start.getDate() - weekday);
  return [...Array(42)].map((_, i) => {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    return { date, out: date.getMonth() !== first.getMonth() };
  });
}

function eventCard(e) {
  const type = EVENT_TYPES.find((t) => t.id === e.type) || EVENT_TYPES[0];
  return `
    <div class="swipe" data-id="${esc(e.id)}">
      <div class="swipe__actions" aria-hidden="true">
        <div class="swipe__action swipe__action--done">${icon('edit')}</div>
        <div class="swipe__action swipe__action--del">${icon('trash')}</div>
      </div>
      <div class="swipe__content">
        <div class="event event--${esc(e.type || 'event')}" data-edit="${esc(e.id)}" role="button" tabindex="0">
          <span class="event__time">${e.time ? esc(fmtTime(e.time)) : 'All day'}</span>
          <div class="grow">
            <div class="row__title">${type.emoji} ${esc(e.title)}</div>
            <div class="row__sub">
              ${e.location ? `<span>${icon('compass')} ${esc(e.location)}</span>` : ''}
              ${e.note ? `<span>${esc(e.note)}</span>` : ''}
            </div>
          </div>
        </div>
      </div>
    </div>`;
}

function upcomingRow(e) {
  return `
    <div class="row" data-edit="${esc(e.id)}" role="button" tabindex="0">
      <span class="row__icon">${icon(e.type === 'appointment' ? 'clock' : e.type === 'reminder' ? 'bell' : 'calendar')}</span>
      <div class="row__main">
        <div class="row__title">${esc(e.title)}</div>
        <div class="row__sub">${esc(relativeDay(e.date))}${e.time ? ` · ${esc(fmtTime(e.time))}` : ''}</div>
      </div>
      ${icon('chevronRight', 'grow-0')}
    </div>`;
}

function dayTasksBlock(dateStr) {
  const tasks = store.state.tasks.filter((t) => t.due === dateStr);
  if (!tasks.length) return '';
  return `
    <div class="mt-4">
      <div class="task-group__label mb-2">${icon('tasks')} Tasks due</div>
      <div class="grid" style="gap:6px">
        ${tasks
          .map(
            (t) => `<div class="row" style="padding:8px"><span class="dot" style="background:var(--${
              t.done ? 'success' : 'accent'
            })"></span><div class="row__main"><div class="row__title${t.done ? ' t-mute' : ''}">${esc(t.title)}</div></div></div>`
          )
          .join('')}
      </div>
    </div>`;
}

function bind(root) {
  root.querySelector('[data-prev]')?.addEventListener('click', () => {
    ui.cursor = new Date(ui.cursor.getFullYear(), ui.cursor.getMonth() - 1, 1);
    render(root);
  });
  root.querySelector('[data-next]')?.addEventListener('click', () => {
    ui.cursor = new Date(ui.cursor.getFullYear(), ui.cursor.getMonth() + 1, 1);
    render(root);
  });
  root.querySelector('[data-today]')?.addEventListener('click', () => {
    ui.cursor = new Date();
    ui.selected = today();
    render(root);
  });

  root.querySelectorAll('[data-day]').forEach((b) =>
    b.addEventListener('click', () => {
      ui.selected = b.dataset.day;
      const d = fromYmd(b.dataset.day);
      if (d && d.getMonth() !== ui.cursor.getMonth()) ui.cursor = d;
      render(root);
    })
  );

  root.querySelectorAll('[data-new]').forEach((b) => b.addEventListener('click', () => openEventForm(null, { date: ui.selected })));
  root.querySelectorAll('[data-new-on]').forEach((b) => b.addEventListener('click', () => openEventForm(null, { date: ui.selected })));

  root.querySelectorAll('[data-edit]').forEach((node) => {
    const open = () => {
      const ev = store.state.events.find((e) => e.id === node.dataset.edit);
      if (ev) openEventForm(ev);
    };
    node.addEventListener('click', open);
    node.addEventListener('keydown', (e) => { if (e.key === 'Enter') open(); });
  });

  initSwipe(root, {
    onRight: (id) => {
      const ev = store.state.events.find((e) => e.id === id);
      if (ev) openEventForm(ev);
    },
    onLeft: async (id) => {
      const ev = store.state.events.find((e) => e.id === id);
      if (!ev) return;
      const ok = await confirmDialog({
        title: 'Delete entry?',
        message: `“${ev.title}” will be removed from your calendar.`,
        confirmText: 'Delete',
        danger: true
      });
      if (ok) { await store.remove('events', id); toast('Entry deleted', 'info'); }
    }
  });

  // Horizontal swipe between months on touch devices
  const grid = root.querySelector('.cal__grid');
  if (grid) {
    let x0 = null;
    grid.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') x0 = e.clientX; });
    grid.addEventListener('pointerup', (e) => {
      if (x0 == null) return;
      const dx = e.clientX - x0;
      x0 = null;
      if (Math.abs(dx) < 70) return;
      ui.cursor = new Date(ui.cursor.getFullYear(), ui.cursor.getMonth() + (dx < 0 ? 1 : -1), 1);
      render(root);
    });
  }
}
