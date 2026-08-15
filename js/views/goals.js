/**
 * LifeFlow — Goals: personal & professional ambitions with milestones.
 */
import { esc, relativeDay } from '../utils.js';
import { icon } from '../icons.js';
import { animateProgress, ring, toast, confetti } from '../ui.js';
import * as store from '../store.js';
import { GOAL_AREAS } from '../config.js';
import { openGoalForm } from './forms.js';

export const meta = { title: 'Goals', icon: 'target', label: 'Goals' };

const ui = { area: 'all' };

export function render(root) {
  const all = store.state.goals;
  const list = ui.area === 'all' ? all : all.filter((g) => g.area === ui.area);
  const avg = all.length ? Math.round(all.reduce((s, g) => s + store.select.goalProgress(g), 0) / all.length) : 0;
  const completed = all.filter((g) => store.select.goalProgress(g) >= 100).length;

  root.innerHTML = `
    <div class="page">
      <section class="card card--accent">
        <div class="flex-between">
          <div class="grow">
            <span class="eyebrow">Where you're heading</span>
            <h2>${all.length ? `${all.length} active goal${all.length > 1 ? 's' : ''}` : 'Set your first goal'}</h2>
            <p class="fs-sm t-dim">${completed} completed · ${avg}% average progress</p>
          </div>
          ${all.length ? ring(avg, { size: 92, stroke: 9, label: `${avg}%` }) : ''}
        </div>
      </section>

      <div class="flex-between">
        <div class="segmented" role="tablist">
          <button role="tab" data-area="all" aria-selected="${ui.area === 'all'}">All</button>
          ${GOAL_AREAS.map(
            (a) => `<button role="tab" data-area="${a.id}" aria-selected="${ui.area === a.id}">${a.emoji} ${esc(a.label)}</button>`
          ).join('')}
        </div>
        <button class="btn btn--primary btn--sm" data-new type="button">${icon('plus')} New</button>
      </div>

      ${
        list.length
          ? `<div class="g-2">${list.map(goalCard).join('')}</div>`
          : `<div class="empty">
              <div class="empty__icon">${icon('target')}</div>
              <h3>No goals here yet</h3>
              <p>Big or small — write down what you're working toward and break it into milestones.</p>
              <button class="btn btn--primary btn--sm" data-new type="button">${icon('plus')} Create a goal</button>
            </div>`
      }
    </div>`;

  bind(root);
  animateProgress(root);
}

function goalCard(g) {
  const p = store.select.goalProgress(g);
  const area = GOAL_AREAS.find((a) => a.id === g.area) || GOAL_AREAS[0];
  const milestones = Array.isArray(g.milestones) ? g.milestones : [];
  return `
    <article class="card goal" data-id="${esc(g.id)}">
      <div class="goal__head">
        <span class="goal-card__emoji">${area.emoji}</span>
        <div class="grow">
          <div class="goal__title">${esc(g.title)}</div>
          <div class="fs-xs t-mute">${esc(area.label)}${g.target ? ` · target ${esc(relativeDay(g.target))}` : ''}</div>
        </div>
        <button class="iconbtn iconbtn--sm iconbtn--bare" data-edit="${esc(g.id)}" type="button" aria-label="Edit goal">${icon('edit')}</button>
      </div>

      ${g.why ? `<p class="fs-sm t-dim">${esc(g.why)}</p>` : ''}

      <div>
        <div class="balance__top mb-2"><span class="fs-xs fw-7 t-mute">PROGRESS</span><span class="fs-xs fw-7">${p}%</span></div>
        <div class="bar"><div class="bar__fill" data-val="${p}"></div></div>
      </div>

      ${
        milestones.length
          ? `<div class="milestones">
              ${milestones
                .map(
                  (m) => `
                <label class="milestone${m.done ? ' is-done' : ''}">
                  <span class="check" style="pointer-events:none">
                    <input type="checkbox" ${m.done ? 'checked' : ''} data-ms="${esc(g.id)}|${esc(m.id)}" style="pointer-events:auto" />
                    <span class="check__box">${icon('check')}</span>
                  </span>
                  <span class="grow">${esc(m.text)}</span>
                </label>`
                )
                .join('')}
             </div>`
          : `<p class="fs-xs t-mute">No milestones yet — edit the goal to add steps.</p>`
      }

      ${p >= 100 ? `<span class="chip chip--success">${icon('star')} Completed</span>` : ''}
    </article>`;
}

function bind(root) {
  root.querySelectorAll('[data-area]').forEach((b) =>
    b.addEventListener('click', () => { ui.area = b.dataset.area; render(root); })
  );
  root.querySelectorAll('[data-new]').forEach((b) =>
    b.addEventListener('click', () => openGoalForm(null, { area: ui.area === 'all' ? 'personal' : ui.area }))
  );
  root.querySelectorAll('[data-edit]').forEach((b) =>
    b.addEventListener('click', () => {
      const g = store.state.goals.find((x) => x.id === b.dataset.edit);
      if (g) openGoalForm(g);
    })
  );

  root.querySelectorAll('[data-ms]').forEach((input) =>
    input.addEventListener('change', async () => {
      const [goalId, msId] = input.dataset.ms.split('|');
      const goal = store.state.goals.find((g) => g.id === goalId);
      if (!goal) return;
      const milestones = (goal.milestones || []).map((m) => (m.id === msId ? { ...m, done: input.checked } : m));
      await store.update('goals', goalId, { milestones });
      const done = milestones.filter((m) => m.done).length;
      if (done === milestones.length && milestones.length) {
        confetti();
        toast(`Goal complete: ${goal.title} 🎉`);
        store.evaluateBadges();
      }
    })
  );
}
