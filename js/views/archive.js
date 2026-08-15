/**
 * LifeFlow — Archive: every month you have lived, kept as a small report.
 *
 * Nothing new is stored; the archive is derived from what you already logged,
 * so past months stay accurate even as the app grows.
 */
import { esc, fmtMoney, today, pct } from '../utils.js';
import { icon } from '../icons.js';
import { ring, animateProgress } from '../ui.js';
import * as store from '../store.js';
import { MOODS } from '../config.js';
import { navigate } from '../router.js';

export const meta = { title: 'Archive', icon: 'archive', label: 'Archive' };

const ui = { month: null };

export function render(root) {
  const months = store.select.monthsWithData();
  const current = today().slice(0, 7);
  if (!ui.month || !months.includes(ui.month)) ui.month = months[0] || current;

  const m = store.select.monthSummary(ui.month);
  const prev = months[months.indexOf(ui.month) + 1] || null;
  const next = months[months.indexOf(ui.month) - 1] || null;
  const currency = store.currency();
  const prayerEnabled = store.prefs().prayer.enabled || m.prayers.tracked > 0;

  root.innerHTML = `
    <div class="page">
      <section class="hero-card anim-in">
        <div class="hero-card__grid">
          <div class="grow">
            <span class="eyebrow">${esc(m.isCurrent ? 'This month, so far' : 'Archived month')}</span>
            <h1>${esc(m.label)}</h1>
            <p class="mt-2">${esc(story(m, currency))}</p>
          </div>
          <div class="hero-card__ring">
            ${ring(m.score, { size: 112, stroke: 11, label: `${m.score}%`, caption: 'Month' })}
          </div>
        </div>
      </section>

      <section class="arch-nav">
        <button class="iconbtn" data-go-month="${esc(prev || '')}" ${prev ? '' : 'disabled'}
                type="button" aria-label="Previous month">${icon('chevronLeft')}</button>
        <div class="arch-rail" data-rail>
          ${months.map(monthPill).join('')}
        </div>
        <button class="iconbtn" data-go-month="${esc(next || '')}" ${next ? '' : 'disabled'}
                type="button" aria-label="Next month">${icon('chevronRight')}</button>
      </section>

      ${
        m.empty
          ? `<div class="empty">
              <div class="empty__icon">${icon('archive')}</div>
              <h3>Nothing recorded in ${esc(m.label)}</h3>
              <p>Months fill themselves as you use LifeFlow — tasks, habits, money, moods and prayers all land here.</p>
              <button class="btn btn--primary btn--sm" data-go="/dashboard" type="button">Back to today ${icon('arrowRight')}</button>
            </div>`
          : report(m, currency, prayerEnabled)
      }
    </div>`;

  bind(root);
  animateProgress(root);
  root.querySelector('.arch-pill.is-active')?.scrollIntoView({ block: 'nearest', inline: 'center' });
}

function monthPill(key) {
  const [y, mo] = key.split('-').map(Number);
  const d = new Date(y, mo - 1, 1);
  const isCurrent = key === today().slice(0, 7);
  return `
    <button class="arch-pill${key === ui.month ? ' is-active' : ''}" data-month="${esc(key)}" type="button">
      <b>${esc(d.toLocaleDateString(undefined, { month: 'short' }))}</b>
      <span>${isCurrent ? 'now' : y}</span>
    </button>`;
}

function report(m, currency, prayerEnabled) {
  return `
    <section class="stat-rail stagger">
      ${tile('checkCircle', m.tasks.done, 'Tasks done')}
      ${tile('flame', `${m.habits.rate}%`, 'Habit rhythm')}
      ${prayerEnabled ? tile('mosque', `${m.prayers.rate}%`, 'Salat kept') : tile('note', m.notes.journal, 'Journal entries')}
      ${tile('wallet', fmtMoney(m.money.net, currency, true), 'Net this month')}
    </section>

    <div class="g-main">
      <div class="grid" style="gap:var(--s-4)">

        <section class="card">
          <div class="card__head">
            <h3 class="card__title">${icon('grid')} Day by day</h3>
            <span class="chip">${esc(m.elapsed)} of ${esc(m.days)} days</span>
          </div>
          <div class="arch-cal">
            ${m.daily.map(dayCell).join('')}
          </div>
          ${
            m.busiest && m.busiest.tasks + m.busiest.habits > 0
              ? `<p class="fs-xs t-mute mt-3">Busiest day: <b>${esc(m.busiest.day)} ${esc(m.short)}</b> — ${m.busiest.tasks} task${m.busiest.tasks === 1 ? '' : 's'}, ${m.busiest.habits} habit${m.busiest.habits === 1 ? '' : 's'}.</p>`
              : ''
          }
        </section>

        <section class="card">
          <div class="card__head">
            <h3 class="card__title">${icon('wallet')} Money</h3>
            <span class="chip ${m.money.net >= 0 ? 'chip--accent' : 'chip--danger'}">${esc(fmtMoney(m.money.net, currency))}</span>
          </div>
          ${
            m.money.count
              ? `<div class="arch-money">
                  ${moneyBar('In', m.money.income, Math.max(m.money.income, m.money.expense), currency, 'success')}
                  ${moneyBar('Out', m.money.expense, Math.max(m.money.income, m.money.expense), currency, 'danger')}
                </div>
                <p class="fs-xs t-mute mt-3">${m.money.count} entr${m.money.count === 1 ? 'y' : 'ies'}${
                  m.money.topCategory ? ` · most spent on <b>${esc(m.money.topCategory[0])}</b> (${esc(fmtMoney(m.money.topCategory[1], currency))})` : ''
                }</p>`
              : `<p class="fs-sm t-mute">No money logged this month.</p>`
          }
        </section>

        <section class="card">
          <div class="card__head">
            <h3 class="card__title">${icon('smile')} How it felt</h3>
            <span class="chip">${m.moods.count} check-in${m.moods.count === 1 ? '' : 's'}</span>
          </div>
          ${
            m.moods.count
              ? `<div class="arch-moods">
                  ${MOODS.map((mood) => {
                    const n = m.moods.counts[mood.id] || 0;
                    return `<div class="arch-mood${m.moods.top === mood.id ? ' is-top' : ''}">
                      <span>${esc(mood.emoji)}</span>
                      <i style="--v:${pct(n, m.moods.count)}%"></i>
                      <b>${n}</b>
                    </div>`;
                  }).join('')}
                </div>
                <p class="fs-xs t-mute mt-3">Average mood ${m.moods.avg}% · mostly ${esc(MOODS.find((x) => x.id === m.moods.top)?.label || '—')}.</p>`
              : `<p class="fs-sm t-mute">No mood check-ins this month.</p>`
          }
        </section>
      </div>

      <div class="grid" style="gap:var(--s-4)">
        <section class="card">
          <div class="card__head">
            <h3 class="card__title">${icon('flame')} Habits</h3>
            <span class="chip chip--accent">${m.habits.hits} check-in${m.habits.hits === 1 ? '' : 's'}</span>
          </div>
          ${
            m.habits.rows.length
              ? `<div class="arch-list">
                  ${m.habits.rows.slice(0, 8).map(
                    (h) => `
                    <div class="arch-row">
                      <span class="arch-row__emoji">${esc(h.emoji)}</span>
                      <span class="grow truncate">${esc(h.title)}</span>
                      <span class="arch-row__val">${h.hits}d</span>
                      <div class="bar bar--thin" style="width:64px"><div class="bar__fill" data-val="${h.rate}"></div></div>
                    </div>`
                  ).join('')}
                </div>`
              : `<p class="fs-sm t-mute">No habits tracked this month.</p>`
          }
        </section>

        ${
          prayerEnabled
            ? `<section class="card">
                <div class="card__head">
                  <h3 class="card__title">${icon('mosque')} Salat</h3>
                  <span class="chip chip--accent">${m.prayers.fullDays} complete day${m.prayers.fullDays === 1 ? '' : 's'}</span>
                </div>
                <div class="flex-between mb-3">
                  <span class="fs-sm t-dim">${m.prayers.hits} prayers marked</span>
                  <b>${m.prayers.rate}%</b>
                </div>
                <div class="bar"><div class="bar__fill" data-val="${m.prayers.rate}"></div></div>
                <p class="fs-xs t-mute mt-3">Out of ${5 * (m.elapsed || m.days)} prayers in ${esc(m.label)}.</p>
              </section>`
            : ''
        }

        <section class="card">
          <div class="card__head">
            <h3 class="card__title">${icon('layers')} Everything else</h3>
          </div>
          <div class="arch-list">
            ${miniRow('tasks', 'Tasks created', m.tasks.created)}
            ${miniRow('calendar', 'Events & appointments', m.events.count)}
            ${miniRow('note', 'Notes written', m.notes.count)}
            ${miniRow('book', 'Journal entries', m.notes.journal)}
            ${miniRow('target', 'Goals started', m.goals.created)}
            ${miniRow('star', 'Goals completed', m.goals.completed)}
          </div>
        </section>

        ${
          m.tasks.list.length
            ? `<section class="card">
                <div class="card__head">
                  <h3 class="card__title">${icon('checkCircle')} What you finished</h3>
                  <span class="chip">${m.tasks.done}</span>
                </div>
                <div class="arch-list">
                  ${m.tasks.list.slice(0, 10).map(
                    (t) => `<div class="arch-row"><span class="arch-row__dot"></span><span class="grow truncate">${esc(t.title)}</span>
                      <span class="arch-row__val">${new Date(t.doneAt).getDate()} ${esc(m.short)}</span></div>`
                  ).join('')}
                </div>
                ${m.tasks.done > 10 ? `<p class="fs-xs t-mute mt-3">+ ${m.tasks.done - 10} more.</p>` : ''}
              </section>`
            : ''
        }
      </div>
    </div>`;
}

/* ------------------------------ small pieces ------------------------------ */
function tile(ic, value, label) {
  return `<div class="stat"><span class="stat__icon">${icon(ic)}</span><span class="stat__val">${esc(value)}</span><span class="stat__lbl">${esc(label)}</span></div>`;
}

function miniRow(ic, label, value) {
  return `<div class="arch-row"><span class="arch-row__icon">${icon(ic)}</span><span class="grow truncate">${esc(label)}</span><b>${esc(value)}</b></div>`;
}

function moneyBar(label, value, max, currency, tone) {
  return `
    <div class="arch-money__row">
      <span>${esc(label)}</span>
      <div class="arch-money__track"><i style="--v:${pct(value, max)}%;--tone:var(--${tone})"></i></div>
      <b>${esc(fmtMoney(value, currency, true))}</b>
    </div>`;
}

function dayCell(d) {
  const level = Math.min(4, d.tasks + d.habits);
  const mood = MOODS.find((x) => x.id === d.mood);
  return `<i data-n="${level}" data-prayers="${d.prayers}" title="${esc(d.key)} — ${d.tasks} tasks, ${d.habits} habits${
    d.prayers ? `, ${d.prayers}/5 prayers` : ''
  }${mood ? `, ${mood.label}` : ''}"><span>${d.day}</span></i>`;
}

function story(m, currency) {
  if (m.empty) return 'A quiet month — nothing was recorded.';
  const bits = [];
  if (m.tasks.done) bits.push(`${m.tasks.done} task${m.tasks.done === 1 ? '' : 's'} finished`);
  if (m.habits.hits) bits.push(`${m.habits.hits} habit check-in${m.habits.hits === 1 ? '' : 's'}`);
  if (m.prayers.hits) bits.push(`${m.prayers.hits} prayers kept`);
  if (m.money.count) bits.push(`${fmtMoney(m.money.net, currency, true)} net`);
  if (m.moods.count) bits.push(`${m.moods.count} mood check-in${m.moods.count === 1 ? '' : 's'}`);
  return bits.length ? `${bits.slice(0, 3).join(' · ')}.` : 'Your month, kept safely.';
}

/* ------------------------------ events ------------------------------ */
function bind(root) {
  root.querySelectorAll('[data-month]').forEach((b) =>
    b.addEventListener('click', () => {
      ui.month = b.dataset.month;
      render(root);
    })
  );

  root.querySelectorAll('[data-go-month]').forEach((b) =>
    b.addEventListener('click', () => {
      if (!b.dataset.goMonth) return;
      ui.month = b.dataset.goMonth;
      render(root);
    })
  );

  root.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => navigate(b.dataset.go)));
}
