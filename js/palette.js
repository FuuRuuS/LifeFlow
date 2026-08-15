/**
 * LifeFlow — command palette (⌘K / Ctrl+K, or "/").
 *
 * One box to reach everything: jump to a page, run a quick action, or search
 * across tasks, calendar entries, journal notes, goals and habits at once.
 *
 * Matching is deliberately simple and predictable rather than fuzzy — a plain
 * substring test, scored so that title matches beat body matches and earlier
 * matches beat later ones. With a few hundred records that is instant, and it
 * never surprises the user with a "clever" result they did not ask for.
 */
import { esc, debounce } from './utils.js';
import { icon } from './icons.js';
import * as store from './store.js';
import { navigate } from './router.js';
import { openBreathe } from './views/breathe.js';
import {
  openTaskForm,
  openEventForm,
  openNoteForm,
  openTxnForm,
  openHabitForm,
  openGoalForm,
  openPurchaseForm
} from './views/forms.js';

const MAX_PER_GROUP = 4;

const PAGES = [
  { path: '/dashboard', label: 'Dashboard', icon: 'home', keywords: 'home overview today' },
  { path: '/tasks', label: 'Tasks', icon: 'tasks', keywords: 'todo to-do checklist' },
  { path: '/calendar', label: 'Calendar', icon: 'calendar', keywords: 'events schedule agenda' },
  { path: '/finance', label: 'Money', icon: 'wallet', keywords: 'finance budget savings spending' },
  { path: '/purchases', label: 'Purchases', icon: 'cart', keywords: 'shopping wish list buy items' },
  { path: '/goals', label: 'Goals', icon: 'target', keywords: 'ambitions milestones' },
  { path: '/habits', label: 'Habits', icon: 'flame', keywords: 'streak routine daily' },
  { path: '/games', label: 'Games', icon: 'gamepad', keywords: 'play arcade tic-tac-toe memory dame checkers break fun' },
  { path: '/prayer', label: 'Salat', icon: 'mosque', keywords: 'prayer salah namaz adhan', requires: 'prayer' },
  { path: '/notes', label: 'Journal', icon: 'note', keywords: 'notes diary gratitude' },
  { path: '/archive', label: 'Archive', icon: 'archive', keywords: 'history past months' },
  { path: '/profile', label: 'Profile & settings', icon: 'user', keywords: 'account theme colour reminders' }
];

const ACTIONS = [
  { label: 'New task', icon: 'tasks', keywords: 'add create todo', run: () => openTaskForm() },
  { label: 'New calendar entry', icon: 'calendar', keywords: 'add create event appointment', run: () => openEventForm() },
  { label: 'Log an expense', icon: 'wallet', keywords: 'add money spend transaction', run: () => openTxnForm(null, { type: 'expense' }) },
  { label: 'Log income', icon: 'wallet', keywords: 'add money earn transaction', run: () => openTxnForm(null, { type: 'income' }) },
  { label: 'Plan a purchase', icon: 'cart', keywords: 'add buy shopping wish list item', run: () => openPurchaseForm() },
  { label: 'New journal entry', icon: 'note', keywords: 'add write diary', run: () => openNoteForm(null, { type: 'journal' }) },
  { label: 'New habit', icon: 'flame', keywords: 'add create routine', run: () => openHabitForm() },
  { label: 'New goal', icon: 'target', keywords: 'add create ambition', run: () => openGoalForm() },
  { label: 'Take a breathing break', icon: 'leaf', keywords: 'calm relax breathe pause', run: () => openBreathe('478') },
  { label: 'Play Tic-Tac-Toe', icon: 'gamepad', keywords: 'game play noughts crosses break', run: () => navigate('/games?play=tictactoe') },
  { label: 'Play Memory', icon: 'gamepad', keywords: 'game play pairs cards break', run: () => navigate('/games?play=memory') },
  { label: 'Play Dame', icon: 'gamepad', keywords: 'game play draughts checkers break', run: () => navigate('/games?play=dame') }
];

let overlay = null;
let items = [];
let cursor = 0;

/* =========================================================
   Matching
   ========================================================= */
/** Higher is better; 0 means "no match". */
function score(query, ...fields) {
  let best = 0;
  for (let i = 0; i < fields.length; i++) {
    const text = String(fields[i] || '').toLowerCase();
    if (!text) continue;
    const idx = text.indexOf(query);
    if (idx === -1) continue;
    // Field order acts as a weight: the first field is the most important one.
    const fieldWeight = 100 - i * 20;
    const positionBonus = idx === 0 ? 30 : text[idx - 1] === ' ' ? 18 : 0;
    best = Math.max(best, fieldWeight + positionBonus - Math.min(idx, 15));
  }
  return best;
}

function collect(raw) {
  const query = raw.trim().toLowerCase();
  const s = store.state;
  const groups = [];

  const add = (label, list) => {
    if (list.length) groups.push({ label, items: list.slice(0, MAX_PER_GROUP) });
  };

  const rank = (list, toEntry, ...fieldsOf) =>
    list
      .map((record) => ({ record, s: score(query, ...fieldsOf.map((f) => f(record))) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .map((x) => toEntry(x.record));

  const pages = PAGES.filter((p) => !p.requires || store.prefs()[p.requires]?.enabled);

  // Nothing typed yet — offer the most useful starting points.
  if (!query) {
    add('Quick actions', ACTIONS.map(actionEntry));
    add('Go to', pages.slice(0, MAX_PER_GROUP).map(pageEntry));
    return groups;
  }

  add(
    'Go to',
    rank(pages, pageEntry, (p) => p.label, (p) => p.keywords)
  );
  add(
    'Actions',
    rank(ACTIONS, actionEntry, (a) => a.label, (a) => a.keywords)
  );
  add(
    'Tasks',
    rank(
      s.tasks,
      (t) => ({
        label: t.title,
        hint: t.done ? 'Completed' : t.due ? `Due ${t.due}` : 'Task',
        icon: 'tasks',
        run: () => openTaskForm(t)
      }),
      (t) => t.title,
      (t) => t.note
    )
  );
  add(
    'Calendar',
    rank(
      s.events,
      (e) => ({
        label: e.title,
        hint: [e.date, e.time, e.location].filter(Boolean).join(' · '),
        icon: 'calendar',
        run: () => openEventForm(e)
      }),
      (e) => e.title,
      (e) => e.location,
      (e) => e.note
    )
  );
  add(
    'Journal',
    rank(
      s.notes,
      (n) => ({
        label: n.title || 'Untitled entry',
        hint: n.type === 'journal' ? 'Journal' : 'Note',
        icon: 'note',
        run: () => openNoteForm(n)
      }),
      (n) => n.title,
      (n) => n.body
    )
  );
  add(
    'Goals',
    rank(
      s.goals,
      (g) => ({
        label: g.title,
        hint: `${store.select.goalProgress(g)}% complete`,
        icon: 'target',
        run: () => openGoalForm(g)
      }),
      (g) => g.title,
      (g) => g.why
    )
  );
  add(
    'Habits',
    rank(
      s.habits,
      (h) => ({
        label: h.title,
        hint: `${store.streakOf(h.log || [])} day streak`,
        icon: 'flame',
        run: () => openHabitForm(h)
      }),
      (h) => h.title
    )
  );

  return groups;
}

const pageEntry = (p) => ({ label: p.label, hint: 'Page', icon: p.icon, run: () => navigate(p.path) });
const actionEntry = (a) => ({ label: a.label, hint: 'Action', icon: a.icon, run: a.run });

/* =========================================================
   Rendering
   ========================================================= */
function draw(query) {
  const list = overlay.querySelector('[data-palette-list]');
  const groups = collect(query);
  items = groups.flatMap((g) => g.items);
  cursor = 0;

  if (!items.length) {
    list.innerHTML = `<p class="palette__empty">Nothing matches “${esc(query)}”.</p>`;
    return;
  }

  let index = 0;
  list.innerHTML = groups
    .map(
      (g) => `
      <div class="palette__group">
        <div class="palette__grouplabel">${esc(g.label)}</div>
        ${g.items
          .map((it) => {
            const i = index++;
            return `
            <button class="palette__item${i === 0 ? ' is-active' : ''}" data-i="${i}" type="button" role="option" aria-selected="${i === 0}">
              <span class="palette__icon">${icon(it.icon)}</span>
              <span class="palette__label">${esc(it.label || 'Untitled')}</span>
              <span class="palette__hint">${esc(it.hint || '')}</span>
            </button>`;
          })
          .join('')}
      </div>`
    )
    .join('');
}

function move(delta) {
  if (!items.length) return;
  cursor = (cursor + delta + items.length) % items.length;
  const nodes = overlay.querySelectorAll('.palette__item');
  nodes.forEach((n, i) => {
    const active = i === cursor;
    n.classList.toggle('is-active', active);
    n.setAttribute('aria-selected', String(active));
    if (active) n.scrollIntoView({ block: 'nearest' });
  });
}

function choose(i = cursor) {
  const entry = items[i];
  if (!entry) return;
  close();
  // Let the overlay finish unwinding before a form modal takes over.
  setTimeout(() => entry.run(), 60);
}

/* =========================================================
   Open / close
   ========================================================= */
export function isOpen() {
  return Boolean(overlay);
}

export function close() {
  if (!overlay) return;
  const node = overlay;
  overlay = null;
  node.classList.add('is-out');
  setTimeout(() => node.remove(), 180);
  document.body.style.overflow = '';
}

export function open() {
  if (overlay || !store.state.ready) return;

  overlay = document.createElement('div');
  overlay.className = 'palette';
  overlay.innerHTML = `
    <div class="palette__scrim" data-palette-close></div>
    <div class="palette__box" role="dialog" aria-modal="true" aria-label="Search LifeFlow">
      <div class="palette__search">
        <span class="palette__searchicon">${icon('search')}</span>
        <input class="palette__input" type="text" role="combobox" aria-expanded="true" aria-controls="palette-list"
               aria-autocomplete="list" placeholder="Search or jump to…" autocomplete="off" spellcheck="false" />
        <kbd class="palette__kbd">esc</kbd>
      </div>
      <div class="palette__list" id="palette-list" data-palette-list role="listbox" aria-label="Results"></div>
      <div class="palette__foot">
        <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
        <span><kbd>↵</kbd> open</span>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  const input = overlay.querySelector('.palette__input');
  draw('');
  requestAnimationFrame(() => input.focus());

  input.addEventListener('input', debounce((e) => draw(e.target.value), 90));

  overlay.querySelector('[data-palette-close]').addEventListener('click', close);

  overlay.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-i]');
    if (btn) choose(Number(btn.dataset.i));
  });

  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') return close();
    if (e.key === 'ArrowDown') { e.preventDefault(); return move(1); }
    if (e.key === 'ArrowUp') { e.preventDefault(); return move(-1); }
    if (e.key === 'Enter') { e.preventDefault(); return choose(); }
  });
}

export function toggle() {
  return overlay ? close() : open();
}

/** Registers the global shortcuts. Call once at boot. */
export function initPalette() {
  document.addEventListener('keydown', (e) => {
    const typing = e.target.matches?.('input, textarea, select, [contenteditable]');

    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      return toggle();
    }
    if (e.key === '/' && !typing && !overlay && !document.querySelector('.modal')) {
      e.preventDefault();
      open();
    }
  });
}
