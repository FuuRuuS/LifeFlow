/**
 * LifeFlow — Tasks: categories, priorities, search, drag-to-reorder, swipe actions.
 */
import { esc, today, relativeDay, fmtTime, pct, debounce } from '../utils.js';
import { icon } from '../icons.js';
import { animateProgress, initSortable, initSwipe, toast, confetti, confirmDialog } from '../ui.js';
import * as store from '../store.js';
import { TASK_CATEGORIES, PRIORITIES } from '../config.js';
import { openTaskForm } from './forms.js';
import { currentQuery } from '../router.js';

export const meta = { title: 'Tasks', icon: 'tasks', label: 'Tasks' };

const ui = { filter: 'today', category: 'all', search: '', sort: 'manual' };

const FILTERS = [
  { id: 'today', label: 'Today' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'all', label: 'All' },
  { id: 'done', label: 'Completed' }
];

export function render(root) {
  const q = currentQuery();
  if (q.filter && FILTERS.some((f) => f.id === q.filter)) ui.filter = q.filter;

  const all = store.select.tasksSorted();
  const list = applyFilters(all);
  const openCount = store.select.openTasks().length;
  const doneToday = all.filter((t) => t.done && t.doneAt && new Date(t.doneAt).toDateString() === new Date().toDateString()).length;
  const dayTasks = all.filter((t) => t.due === today());
  const dayProgress = dayTasks.length ? pct(dayTasks.filter((t) => t.done).length, dayTasks.length) : 0;

  root.innerHTML = `
    <div class="page">
      <section class="card card--accent">
        <div class="flex-between">
          <div>
            <span class="eyebrow">Task flow</span>
            <h2>${openCount ? `${openCount} open task${openCount > 1 ? 's' : ''}` : 'Inbox zero 🎉'}</h2>
            <p class="fs-sm t-dim">${doneToday} completed today${dayTasks.length ? ` · ${dayProgress}% of today’s plan` : ''}</p>
          </div>
          <button class="btn btn--primary btn--sm" data-new type="button">${icon('plus')} New</button>
        </div>
        ${dayTasks.length ? `<div class="bar mt-4"><div class="bar__fill" data-val="${dayProgress}"></div></div>` : ''}
      </section>

      <section class="grid" style="gap:var(--s-3)">
        <div class="field field--icon">
          ${icon('search', 'field__icon')}
          <input class="input" type="search" placeholder="Search tasks…" value="${esc(ui.search)}" data-search aria-label="Search tasks" />
        </div>
        <div class="chips-row" data-filters>
          ${FILTERS.map(
            (f) => `<button type="button" data-filter="${f.id}" aria-pressed="${ui.filter === f.id}">${esc(f.label)}${
              f.id === 'overdue' && store.select.overdueTasks().length ? ` · ${store.select.overdueTasks().length}` : ''
            }</button>`
          ).join('')}
        </div>
        <div class="chips-row" data-cats>
          <button type="button" data-cat="all" aria-pressed="${ui.category === 'all'}">All</button>
          ${TASK_CATEGORIES.map(
            (c) => `<button type="button" data-cat="${c.id}" aria-pressed="${ui.category === c.id}">${c.emoji} ${esc(c.label)}</button>`
          ).join('')}
        </div>
      </section>

      <section data-list>
        ${list.length ? groupedList(list) : emptyState()}
      </section>
    </div>`;

  bind(root);
  animateProgress(root);
}

/* ------------------------------ filtering ------------------------------ */
/** Ticked off earlier today — still worth seeing, and easy to undo. */
function doneToday(task) {
  return Boolean(task.done && task.doneAt && new Date(task.doneAt).toDateString() === new Date().toDateString());
}

function applyFilters(all) {
  const t = today();
  let list = all;

  // Completed tasks stay on screen (struck through) so a mistaken tick can be undone.
  switch (ui.filter) {
    case 'today':
      list = list.filter((x) => (x.done ? doneToday(x) || x.due === t : !x.due || x.due <= t));
      break;
    case 'upcoming':
      list = list.filter((x) => x.due && x.due > t && (!x.done || doneToday(x)));
      break;
    case 'overdue':
      list = list.filter((x) => !x.done && x.due && x.due < t);
      break;
    case 'done':
      list = list.filter((x) => x.done);
      break;
    default:
      list = list.slice();
  }

  if (ui.category !== 'all') list = list.filter((x) => x.category === ui.category);

  if (ui.search.trim()) {
    const s = ui.search.trim().toLowerCase();
    list = list.filter((x) => `${x.title} ${x.note || ''}`.toLowerCase().includes(s));
  }
  return list;
}

/* ------------------------------ markup ------------------------------ */
function groupedList(list) {
  if (ui.filter === 'done') {
    return `<div class="task-list">${list.map(taskCard).join('')}</div>`;
  }

  const t = today();
  const groups = [
    { label: 'Overdue', items: list.filter((x) => !x.done && x.due && x.due < t) },
    { label: 'Today', items: list.filter((x) => !x.done && x.due === t) },
    { label: 'Upcoming', items: list.filter((x) => !x.done && x.due && x.due > t) },
    { label: 'Someday', items: list.filter((x) => !x.done && !x.due) },
    { label: 'Completed', items: list.filter((x) => x.done) }
  ].filter((g) => g.items.length);

  return groups
    .map(
      (g) => `
      <div class="task-group mb-4">
        <div class="task-group__label">${esc(g.label)}<span class="task-group__count">${g.items.length}</span></div>
        <div class="task-list" data-sortable>${g.items.map(taskCard).join('')}</div>
      </div>`
    )
    .join('');
}

function taskCard(t) {
  const pri = PRIORITIES.find((p) => p.id === t.priority) || PRIORITIES[1];
  const cat = TASK_CATEGORIES.find((c) => c.id === t.category);
  const overdue = !t.done && t.due && t.due < today();
  return `
    <div class="swipe" data-id="${esc(t.id)}">
      <div class="swipe__actions" aria-hidden="true">
        <div class="swipe__action swipe__action--done">${icon('check')}</div>
        <div class="swipe__action swipe__action--del">${icon('trash')}</div>
      </div>
      <div class="swipe__content">
        <article class="task${t.done ? ' is-done' : ''}">
          <span class="task__pri ${pri.cls}"></span>
          <button class="check__box" data-toggle="${esc(t.id)}" type="button" aria-pressed="${Boolean(t.done)}"
                  aria-label="${t.done ? 'Mark incomplete' : 'Mark complete'}" style="margin-top:2px">${icon('check')}</button>
          <div class="task__body" data-edit="${esc(t.id)}" role="button" tabindex="0">
            <span class="task__title">${esc(t.title)}</span>
            ${t.note ? `<span class="task__note">${esc(t.note)}</span>` : ''}
            <span class="task__meta">
              ${cat ? `<span class="chip">${cat.emoji} ${esc(cat.label)}</span>` : ''}
              ${t.due ? `<span class="chip${overdue ? ' chip--danger' : ''}">${icon('clock')}${esc(relativeDay(t.due))}</span>` : ''}
              ${t.time ? `<span class="chip">${esc(fmtTime(t.time))}</span>` : ''}
              <span class="chip ${pri.chip}">${esc(pri.label)}</span>
            </span>
          </div>
          <button class="task__handle" data-handle type="button" aria-label="Reorder">${icon('drag')}</button>
        </article>
      </div>
    </div>`;
}

function emptyState() {
  const msg = {
    today: ['checkCircle', 'Nothing due today', 'Enjoy the calm — or add something meaningful.'],
    upcoming: ['calendar', 'No upcoming tasks', 'Plan ahead so future-you can relax.'],
    overdue: ['sparkles', 'Nothing overdue', 'You are beautifully on top of things.'],
    all: ['tasks', 'No tasks yet', 'Your list is clear. Add the next thing.'],
    done: ['star', 'Nothing completed yet', 'Tick your first task to see it here.']
  }[ui.filter] || ['tasks', 'No tasks', ''];

  return `
    <div class="empty">
      <div class="empty__icon">${icon(msg[0])}</div>
      <h3>${esc(msg[1])}</h3>
      <p>${esc(msg[2])}</p>
      <button class="btn btn--sm btn--primary" data-new type="button">${icon('plus')} Add a task</button>
    </div>`;
}

/* ------------------------------ behaviour ------------------------------ */
function bind(root) {
  root.querySelectorAll('[data-new]').forEach((b) =>
    b.addEventListener('click', () => openTaskForm(null, { due: ui.filter === 'today' ? today() : '' }))
  );

  root.querySelectorAll('[data-filter]').forEach((b) =>
    b.addEventListener('click', () => { ui.filter = b.dataset.filter; render(root); })
  );
  root.querySelectorAll('[data-cat]').forEach((b) =>
    b.addEventListener('click', () => { ui.category = b.dataset.cat; render(root); })
  );

  const search = root.querySelector('[data-search]');
  search?.addEventListener(
    'input',
    debounce((e) => {
      ui.search = e.target.value;
      const listNode = root.querySelector('[data-list]');
      const list = applyFilters(store.select.tasksSorted());
      listNode.innerHTML = list.length ? groupedList(list) : emptyState();
      bindList(listNode);
      listNode.querySelectorAll('[data-new]').forEach((b) =>
        b.addEventListener('click', () => openTaskForm(null, { due: ui.filter === 'today' ? today() : '' }))
      );
    }, 220)
  );

  bindList(root);
}

function bindList(root) {
  root.querySelectorAll('[data-toggle]').forEach((b) =>
    b.addEventListener('click', async (e) => {
      e.stopPropagation();
      await complete(b.dataset.toggle);
    })
  );

  root.querySelectorAll('[data-edit]').forEach((b) => {
    const open = () => {
      const task = store.state.tasks.find((t) => t.id === b.dataset.edit);
      if (task) openTaskForm(task);
    };
    b.addEventListener('click', open);
    b.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
  });

  root.querySelectorAll('[data-sortable]').forEach((list) =>
    initSortable(list, async (ids) => {
      try { await store.reorderTasks(ids); } catch { toast('Could not save the new order.', 'error'); }
    })
  );

  initSwipe(root, {
    onRight: (id) => complete(id),
    onLeft: async (id) => {
      const task = store.state.tasks.find((t) => t.id === id);
      if (!task) return;
      const ok = await confirmDialog({
        title: 'Delete task?',
        message: `“${task.title}” will be removed permanently.`,
        confirmText: 'Delete',
        danger: true
      });
      if (ok) { await store.remove('tasks', id); toast('Task deleted', 'info'); }
    }
  });
}

async function complete(id) {
  const task = store.state.tasks.find((t) => t.id === id);
  if (!task) return;
  const done = await store.toggleTask(task);
  if (done) {
    const unlocked = await store.evaluateBadges();
    if (unlocked.length) { confetti(); toast('New achievement unlocked 🏅'); }
    else toast('Nice one ✅');
  } else {
    toast('Back on your list', 'info');
  }
}
