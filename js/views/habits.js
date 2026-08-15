/**
 * LifeFlow — Habits: daily check-ins, streaks and a 12-week heatmap.
 */
import { esc, ymd, today, addDays, startOfWeek, pct, haptic } from '../utils.js';
import { icon } from '../icons.js';
import { animateProgress, ring, toast, confetti } from '../ui.js';
import * as store from '../store.js';
import { openHabitForm } from './forms.js';

export const meta = { title: 'Habits', icon: 'flame', label: 'Habits' };

export function render(root) {
  const habits = store.state.habits;
  const doneToday = store.select.habitsDoneToday();
  const completion = habits.length ? pct(doneToday, habits.length) : 0;
  const best = store.select.bestStreak();

  root.innerHTML = `
    <div class="page">
      <section class="card card--accent">
        <div class="flex-between">
          <div class="grow">
            <span class="eyebrow">Daily rituals</span>
            <h2>${habits.length ? `${doneToday} of ${habits.length} done today` : 'Build your first habit'}</h2>
            <p class="fs-sm t-dim">${best ? `Longest active streak: ${best} day${best > 1 ? 's' : ''} 🔥` : 'Consistency beats intensity.'}</p>
          </div>
          ${habits.length ? ring(completion, { size: 92, stroke: 9, label: `${completion}%` }) : ''}
        </div>
      </section>

      <button class="btn btn--soft btn--block" data-new type="button">${icon('plus')} New habit</button>

      ${
        habits.length
          ? `<div class="grid" style="gap:var(--s-4)">${habits.map(habitCard).join('')}</div>
             ${heatmapCard(habits)}`
          : `<div class="empty">
              <div class="empty__icon">${icon('flame')}</div>
              <h3>No habits yet</h3>
              <p>Pick one small thing you can do most days. Streaks make it stick.</p>
              <button class="btn btn--primary btn--sm" data-new type="button">${icon('plus')} Create habit</button>
            </div>`
      }
    </div>`;

  bind(root);
  animateProgress(root);
}

function habitCard(h) {
  const log = Array.isArray(h.log) ? h.log : [];
  const streak = store.streakOf(log);
  const done = log.includes(today());
  const weekStart = startOfWeek(new Date());
  const week = [...Array(7)].map((_, i) => {
    const d = addDays(weekStart, i);
    const key = ymd(d);
    return { key, on: log.includes(key), isToday: key === today(), label: d.toLocaleDateString(undefined, { weekday: 'narrow' }) };
  });
  const weekCount = week.filter((d) => d.on).length;
  const target = Math.min(7, Number(h.weeklyTarget) || 7);

  return `
    <article class="card habit${done ? ' is-done-today' : ''}" data-id="${esc(h.id)}">
      <div class="habit__top">
        <span class="habit__emoji">${esc(h.emoji || '🔥')}</span>
        <div class="grow">
          <div class="fw-7">${esc(h.title)}</div>
          <div class="row__sub">
            ${streak ? `<span class="habit__streak">${icon('flame')} ${streak} day${streak > 1 ? 's' : ''}</span>` : '<span>Start today</span>'}
            <span>· ${weekCount}/${target} this week</span>
          </div>
        </div>
        <button class="iconbtn iconbtn--sm iconbtn--bare" data-edit="${esc(h.id)}" type="button" aria-label="Edit habit">${icon('edit')}</button>
        <button class="habit__check" data-check="${esc(h.id)}" type="button" aria-pressed="${done}"
                aria-label="${done ? 'Undo' : 'Complete'} ${esc(h.title)} for today">${icon('check')}</button>
      </div>

      ${h.why ? `<p class="fs-xs t-mute">${esc(h.why)}</p>` : ''}

      <div class="habit__week">
        ${week
          .map(
            (d) => `
          <div class="habit__day">
            <span>${esc(d.label)}</span>
            <i data-on="${d.on ? 1 : 0}" data-today="${d.isToday ? 1 : 0}" data-day="${esc(h.id)}|${d.key}" role="button" tabindex="0"
               aria-label="${esc(d.key)}"></i>
          </div>`
          )
          .join('')}
      </div>
      <div class="bar bar--thin"><div class="bar__fill" data-val="${pct(weekCount, target)}"></div></div>
    </article>`;
}

function heatmapCard(habits) {
  const days = 84; // 12 weeks
  const start = addDays(new Date(), -(days - 1));
  const all = new Set();
  habits.forEach((h) => (h.log || []).forEach((d) => all.add(d)));

  const cells = [...Array(days)].map((_, i) => {
    const key = ymd(addDays(start, i));
    return `<i data-on="${all.has(key) ? 1 : 0}" title="${key}"></i>`;
  });

  return `
    <section class="card">
      <div class="card__head">
        <h3 class="card__title">${icon('grid')} Last 12 weeks</h3>
        <span class="chip chip--accent">${all.size} active days</span>
      </div>
      <div style="overflow-x:auto"><div class="heat">${cells.join('')}</div></div>
    </section>`;
}

function bind(root) {
  root.querySelectorAll('[data-new]').forEach((b) => b.addEventListener('click', () => openHabitForm()));
  root.querySelectorAll('[data-edit]').forEach((b) =>
    b.addEventListener('click', () => {
      const h = store.state.habits.find((x) => x.id === b.dataset.edit);
      if (h) openHabitForm(h);
    })
  );

  root.querySelectorAll('[data-check]').forEach((b) =>
    b.addEventListener('click', async () => {
      const h = store.state.habits.find((x) => x.id === b.dataset.check);
      if (!h) return;
      const on = await store.toggleHabitDay(h);
      haptic(14);
      if (on) {
        const streak = store.streakOf([...(h.log || []), today()]);
        if (streak > 1 && streak % 7 === 0) { confetti(); toast(`${streak}-day streak on ${h.title}! 🔥`); }
        store.evaluateBadges();
      }
    })
  );

  root.querySelectorAll('[data-day]').forEach((cell) => {
    const toggle = async () => {
      const [id, date] = cell.dataset.day.split('|');
      if (date > today()) return toast('That day hasn’t happened yet 🙂', 'info');
      const h = store.state.habits.find((x) => x.id === id);
      if (h) { await store.toggleHabitDay(h, date); haptic(10); }
    };
    cell.addEventListener('click', toggle);
    cell.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
  });
}
