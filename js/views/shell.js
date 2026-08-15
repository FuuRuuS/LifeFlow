/**
 * LifeFlow — application shell: sidebar, top bar, bottom navigation,
 * floating quick-action button and page mounting.
 */
import { $, esc, initials, firstName, today } from '../utils.js';
import { icon } from '../icons.js';
import { theme, modal, toast, svgDefs, confirmDialog } from '../ui.js';
import * as store from '../store.js';
import { navigate, getCurrent } from '../router.js';
import { openTaskForm, openEventForm, openNoteForm, openTxnForm, openHabitForm, openGoalForm, openPurchaseForm } from './forms.js';
import { openBreathe } from './breathe.js';
import { open as openPalette } from '../palette.js';
import { nextPrayer, countdownLabel } from '../prayer.js';
import { upcomingAlarms, notifyPrefs, permission as notifyPermission } from '../notify.js';
import { auth, signOut } from '../firebase.js';

const NAV = [
  { path: '/dashboard', label: 'Home', icon: 'home' },
  { path: '/tasks', label: 'Tasks', icon: 'tasks' },
  { path: '/calendar', label: 'Calendar', icon: 'calendar' },
  { path: '/finance', label: 'Money', icon: 'wallet' },
  { path: '/purchases', label: 'Purchases', icon: 'cart' },
  { path: '/goals', label: 'Goals', icon: 'target' },
  { path: '/habits', label: 'Habits', icon: 'flame' },
  { path: '/games', label: 'Games', icon: 'gamepad' },
  { path: '/prayer', label: 'Salat', icon: 'mosque', requires: 'prayer' },
  { path: '/notes', label: 'Journal', icon: 'note' },
  { path: '/archive', label: 'Archive', icon: 'archive' },
  { path: '/profile', label: 'Profile', icon: 'user' }
];

/** Optional pages disappear from the menus when their feature is switched off. */
function navAvailable(item) {
  if (item.requires === 'prayer') return store.prefs().prayer.enabled;
  return true;
}
function navItems() {
  return NAV.filter(navAvailable);
}

const BOTTOM = ['/dashboard', '/tasks', '/calendar'];

const QUICK = [
  { label: 'Breathe', icon: 'leaf', run: () => openBreathe('478') },
  { label: 'New task', icon: 'tasks', run: () => openTaskForm(null, { due: today() }) },
  { label: 'New event', icon: 'calendar', run: () => openEventForm(null, { date: today() }) },
  { label: 'Log expense', icon: 'wallet', run: () => openTxnForm(null, { type: 'expense' }) },
  { label: 'Plan a purchase', icon: 'cart', run: () => openPurchaseForm() },
  { label: 'Journal entry', icon: 'note', run: () => openNoteForm(null, { type: 'journal' }) },
  { label: 'New habit', icon: 'flame', run: () => openHabitForm() },
  { label: 'New goal', icon: 'target', run: () => openGoalForm() }
];

let unsubscribeStore = null;
let activePage = null;
let quickOpen = false;

/* =========================================================
   Boot
   ========================================================= */
export function initShell() {
  if (!document.getElementById('lf-defs')) {
    const holder = document.createElement('div');
    holder.id = 'lf-defs';
    holder.innerHTML = svgDefs();
    document.body.appendChild(holder);
  }
  renderSidebar();
  bindFab();
  bindScroll();
}

export function showApp() {
  $('#public').hidden = true;
  $('#app').hidden = false;
}

/* =========================================================
   Sidebar (desktop)
   ========================================================= */
function renderSidebar() {
  const sidebar = $('#sidebar');
  sidebar.innerHTML = `
    <a class="brand" href="#/dashboard">
      <svg class="brand__mark" viewBox="0 0 64 64" aria-hidden="true">
        <defs>
          <linearGradient id="sbg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="var(--accent)"/><stop offset="1" stop-color="var(--accent-2)"/>
          </linearGradient>
        </defs>
        <path d="M12 40c6-14 14-14 20 0s14 14 20 0" fill="none" stroke="url(#sbg)" stroke-width="6" stroke-linecap="round"/>
        <path d="M12 24c6-14 14-14 20 0s14 14 20 0" fill="none" stroke="url(#sbg)" stroke-width="6" stroke-linecap="round" opacity=".45"/>
      </svg>
      <span class="brand__name">LifeFlow</span>
    </a>
    <nav class="sidenav" data-sidenav>
      ${NAV.map(
        (n) => `<a class="sidenav__item" href="#${n.path}" data-nav="${n.path}">${icon(n.icon)}<span>${esc(n.label)}</span><span class="sidenav__badge" data-badge="${n.path}" hidden></span></a>`
      ).join('')}
    </nav>
    <div class="sidebar__foot">
      <button class="btn btn--primary btn--block" data-quick-add type="button">${icon('plus')} Quick add</button>
      <button class="sideprofile" data-go-profile type="button">
        <span class="avatar avatar--sm" data-avatar>U</span>
        <span class="grow" style="min-width:0">
          <span class="truncate fw-7 fs-sm" data-username style="display:block">You</span>
          <span class="fs-xs t-mute truncate" style="display:block">View profile</span>
        </span>
        ${icon('chevronRight')}
      </button>
      <button class="btn btn--ghost btn--sm btn--block" data-logout type="button">${icon('logout')} Log out</button>
    </div>`;

  sidebar.querySelector('[data-quick-add]').addEventListener('click', () => openQuickMenu(true));
  sidebar.querySelector('[data-go-profile]').addEventListener('click', () => navigate('/profile'));
  sidebar.querySelector('[data-logout]').addEventListener('click', logout);
}

/* =========================================================
   Top bar
   ========================================================= */
function renderTopbar(page) {
  const topbar = $('#topbar');
  const s = store.state;
  const name = firstName(s.profile?.name || s.user?.displayName || '', s.user?.email || '');
  const overdue = store.select.overdueTasks().length;
  const photo = s.profile?.photoURL || s.user?.photoURL || '';

  topbar.innerHTML = `
    <div class="grow" style="min-width:0">
      <div class="topbar__title truncate">${esc(page?.meta?.title || 'LifeFlow')}</div>
      <div class="topbar__sub truncate">${esc(subtitleFor(page, name))}</div>
    </div>
    <div class="topbar__actions">
      <button class="iconbtn" data-search type="button" aria-label="Search — press Ctrl or Command plus K" title="Search (⌘K)">
        ${icon('search')}
      </button>
      <button class="iconbtn" data-alerts type="button" aria-label="Notifications" style="position:relative">
        ${icon('bell')}
        ${overdue ? `<span class="dot" style="position:absolute;top:8px;right:8px;background:var(--danger)"></span>` : ''}
      </button>
      <button class="iconbtn themetoggle" data-theme-toggle type="button" aria-label="Toggle theme">
        ${icon('sun', 'ico-sun')}${icon('moon', 'ico-moon')}
      </button>
      <button class="avatar avatar--sm" data-go-profile type="button" aria-label="Profile">
        ${photo ? `<img src="${esc(photo)}" alt="" />` : esc(initials(s.profile?.name || '', s.user?.email || ''))}
      </button>
    </div>`;

  topbar.querySelector('[data-theme-toggle]').addEventListener('click', (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const next = theme.toggle({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
    store.savePrefs({ theme: next }).catch(() => {});
  });
  topbar.querySelector('[data-go-profile]').addEventListener('click', () => navigate('/profile'));
  topbar.querySelector('[data-alerts]').addEventListener('click', openAlerts);
  topbar.querySelector('[data-search]').addEventListener('click', openPalette);
}

function subtitleFor(page, name) {
  const path = getCurrent();
  const map = {
    '/dashboard': `Welcome back, ${name}`,
    '/tasks': `${store.select.openTasks().length} open · ${store.select.overdueTasks().length} overdue`,
    '/calendar': `${store.select.upcomingEvents(7).length} entries in the next 7 days`,
    '/finance': 'Savings goals & cashflow',
    '/purchases': `${store.select.plannedPurchases().length} still to buy`,
    '/goals': 'Personal & professional growth',
    '/habits': `${store.select.habitsDoneToday()}/${store.state.habits.length} done today`,
    '/games': 'Play solo, or invite a friend',
    '/notes': `${store.state.notes.length} entries`,
    '/profile': 'Make LifeFlow yours'
  };
  return map[path] || '';
}

/* =========================================================
   Bottom navigation
   ========================================================= */
function renderBottomNav() {
  const nav = $('#bottomnav');
  const path = getCurrent();
  const items = NAV.filter((n) => BOTTOM.includes(n.path));

  const tab = (n) =>
    `<button class="navbtn${path === n.path ? ' is-active' : ''}" data-nav="${n.path}" type="button" aria-current="${
      path === n.path ? 'page' : 'false'
    }">${icon(n.icon)}<span>${esc(n.label)}</span></button>`;

  nav.innerHTML = `
    ${tab(items[0])}
    ${tab(items[1])}
    <button class="navbtn navbtn--add" data-add type="button" aria-label="Quick add" aria-haspopup="menu">${icon('plus')}<span>Add</span></button>
    ${tab(items[2])}
    <button class="navbtn${!BOTTOM.includes(path) ? ' is-active' : ''}" data-more type="button">${icon('more')}<span>More</span></button>`;

  nav.querySelectorAll('[data-nav]').forEach((b) => b.addEventListener('click', () => navigate(b.dataset.nav)));
  nav.querySelector('[data-add]').addEventListener('click', () => openQuickMenu(!quickOpen));
  nav.querySelector('[data-more]').addEventListener('click', openMoreSheet);
}

function openMoreSheet() {
  const extras = navItems().filter((n) => !BOTTOM.includes(n.path));
  const current = getCurrent();
  modal({
    title: 'More',
    body: `
      <div class="moregrid">
        ${extras
          .map(
            (n) => `<button class="moretile${current === n.path ? ' is-active' : ''}" data-goto="${n.path}" type="button">
              <span class="moretile__icon">${icon(n.icon)}</span>
              <span class="moretile__label">${esc(n.label)}</span>
            </button>`
          )
          .join('')}
      </div>
      <div class="moreactions">
        <button class="btn btn--sm btn--ghost grow" data-theme-toggle type="button">
          ${icon(theme.get() === 'dark' ? 'sun' : 'moon')} ${theme.get() === 'dark' ? 'Light' : 'Dark'} mode
        </button>
        <button class="btn btn--sm btn--ghost" data-logout type="button" style="color:var(--danger)">
          ${icon('logout')} Log out
        </button>
      </div>`,
    onMount(box, close) {
      box.querySelectorAll('[data-goto]').forEach((b) =>
        b.addEventListener('click', () => { close(); navigate(b.dataset.goto); })
      );
      box.querySelector('[data-theme-toggle]').addEventListener('click', (e) => {
        const r = e.currentTarget.getBoundingClientRect();
        const next = theme.toggle({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
        store.savePrefs({ theme: next }).catch(() => {});
        close();
      });
      box.querySelector('[data-logout]').addEventListener('click', async () => { close(); await logout(); });
    }
  });
}

/* =========================================================
   Alerts sheet
   ========================================================= */
function openAlerts() {
  const prefs = store.prefs();
  const overdue = store.select.overdueTasks();
  const todayEvents = store.select.eventsOn(today());
  const dueToday = store.state.tasks.filter((t) => !t.done && t.due === today());

  const section = (title, items, render) =>
    items.length
      ? `<div class="mb-4"><div class="task-group__label mb-2">${title}</div>${items.map(render).join('')}</div>`
      : '';

  const row = (ic, title, sub, tint = '') =>
    `<div class="row"><span class="row__icon"${tint ? ` style="color:${tint}"` : ''}>${icon(ic)}</span>
      <div class="row__main"><div class="row__title">${esc(title)}</div>${sub ? `<div class="row__sub">${esc(sub)}</div>` : ''}</div></div>`;

  // Next prayer — only when the tracker is switched on.
  let prayerBlock = '';
  if (prefs.prayer?.enabled) {
    try {
      const up = nextPrayer(new Date(), prefs.prayer);
      prayerBlock = section('Next prayer', [up], (u) =>
        row('mosque', `${u.next.label} · ${u.next.time}`, `In ${countdownLabel(u.in)}${u.tomorrow ? ' (tomorrow)' : ''}`, 'var(--accent)')
      );
    } catch {
      /* Times need a location; the Salat page explains how to set one. */
    }
  }

  // Scheduled phone reminders, straight from the notification engine.
  const remindersOn = notifyPrefs().enabled && notifyPermission() === 'granted';
  const reminders = remindersOn ? upcomingAlarms(4) : [];
  const remindersBlock = remindersOn
    ? section('Reminders queued', reminders, (a) =>
        row('bell', a.title, new Date(a.at).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' }))
      )
    : `<div class="mb-4"><div class="task-group__label mb-2">Reminders</div>
         ${row('bell', 'Phone reminders are off', 'Turn them on in Profile → Reminders')}</div>`;

  const hasSomething = overdue.length || todayEvents.length || dueToday.length || prayerBlock || reminders.length;

  const body = hasSomething
    ? `
      ${section('Overdue', overdue, (t) => row('alert', t.title, `Was due ${t.due}`, 'var(--danger)'))}
      ${section('Due today', dueToday, (t) => row('tasks', t.title, t.time || ''))}
      ${section('Today’s schedule', todayEvents, (e) => row('calendar', e.title, e.time || 'All day'))}
      ${prayerBlock}
      ${remindersBlock}`
    : `<div class="empty"><div class="empty__icon">${icon('checkCircle')}</div><h3>All caught up</h3><p>No overdue items and nothing urgent today.</p></div>
       ${remindersBlock}`;

  modal({ title: 'Today at a glance', body });
}

/* =========================================================
   FAB + quick menu
   ========================================================= */
function bindFab() {
  const fab = $('#fab');
  fab.addEventListener('click', () => openQuickMenu(!quickOpen));
}

function openQuickMenu(open) {
  const existing = document.querySelector('.quickmenu');
  existing?.remove();
  quickOpen = open;
  $('#fab').classList.toggle('is-open', open);
  document.querySelector('[data-add]')?.classList.toggle('is-open', open);
  if (!open) return;

  const menu = document.createElement('div');
  menu.className = 'quickmenu';
  menu.innerHTML = QUICK.map(
    (q, i) => `<button class="quickmenu__item" data-q="${i}" type="button">${icon(q.icon)}<span>${esc(q.label)}</span></button>`
  ).join('');
  document.body.appendChild(menu);

  menu.querySelectorAll('[data-q]').forEach((b) =>
    b.addEventListener('click', () => {
      const item = QUICK[Number(b.dataset.q)];
      openQuickMenu(false);
      item.run();
    })
  );

  const away = (e) => {
    if (!e.target.closest('.quickmenu') && !e.target.closest('#fab') && !e.target.closest('[data-add]')) {
      openQuickMenu(false);
      document.removeEventListener('click', away);
    }
  };
  setTimeout(() => document.addEventListener('click', away), 10);
}

/* =========================================================
   Scroll behaviour: sticky topbar shadow + hide nav on scroll down
   ========================================================= */
function bindScroll() {
  let last = 0;
  window.addEventListener(
    'scroll',
    () => {
      const y = window.scrollY;
      $('#topbar')?.classList.toggle('is-stuck', y > 6);
      const nav = $('#bottomnav');
      const fab = $('#fab');
      if (nav && innerWidth < 900) {
        const down = y > last && y > 140;
        nav.classList.toggle('is-hidden', down);
        fab?.classList.toggle('is-hidden', down);
        if (down) openQuickMenu(false);
      }
      last = y;
    },
    { passive: true }
  );
}

/* =========================================================
   Page mounting
   ========================================================= */
export function mountPage(pageModule) {
  const view = $('#view');
  // Give the outgoing page a chance to tidy up (listeners, live calls, timers).
  if (activePage && activePage !== pageModule) activePage.unmount?.();
  activePage = pageModule;
  unsubscribeStore?.();

  const paint = () => {
    if (activePage !== pageModule) return;
    if (store.state.loading) {
      view.innerHTML = skeleton();
      renderTopbar(pageModule);
      renderBottomNav();
      return;
    }
    pageModule.render(view);
    renderTopbar(pageModule);
    renderBottomNav();
    syncSidebar();
  };

  paint();
  unsubscribeStore = store.subscribe(paint);
  window.scrollTo({ top: 0 });
  view.focus?.({ preventScroll: true });
}

export function unmountPage() {
  unsubscribeStore?.();
  unsubscribeStore = null;
  activePage?.unmount?.();
  activePage = null;
}

function syncSidebar() {
  const path = getCurrent();
  const s = store.state;
  document.querySelectorAll('[data-nav]').forEach((a) => {
    if (a.classList.contains('sidenav__item')) a.classList.toggle('is-active', a.dataset.nav === path);
    const item = NAV.find((n) => n.path === a.dataset.nav);
    if (item?.requires) a.hidden = !navAvailable(item) && path !== item.path;
  });
  const counts = {
    '/tasks': store.select.openTasks().length,
    '/calendar': store.select.eventsOn(today()).length,
    '/purchases': store.select.plannedPurchases().length,
    '/habits': s.habits.length - store.select.habitsDoneToday()
  };
  document.querySelectorAll('[data-badge]').forEach((b) => {
    const n = counts[b.dataset.badge] || 0;
    b.hidden = n <= 0;
    b.textContent = String(n);
  });
  const avatar = document.querySelector('[data-avatar]');
  if (avatar) {
    const photo = s.profile?.photoURL || s.user?.photoURL || '';
    avatar.innerHTML = photo ? `<img src="${esc(photo)}" alt="" />` : esc(initials(s.profile?.name || '', s.user?.email || ''));
  }
  const uname = document.querySelector('[data-username]');
  if (uname) uname.textContent = s.profile?.name || s.user?.displayName || s.user?.email || 'You';
}

function skeleton() {
  return `
    <div class="page">
      <div class="skel" style="height:170px;border-radius:32px"></div>
      <div class="g-4">
        ${'<div class="skel" style="height:98px"></div>'.repeat(4)}
      </div>
      <div class="skel" style="height:230px"></div>
      <div class="skel" style="height:180px"></div>
    </div>`;
}

async function logout() {
  const ok = await confirmDialog({ title: 'Log out?', message: 'You can always come back to your flow.', confirmText: 'Log out' });
  if (!ok) return;
  try {
    await signOut(auth);
    toast('Logged out — see you soon 👋', 'info');
  } catch {
    toast('Could not log out. Please retry.', 'error');
  }
}
