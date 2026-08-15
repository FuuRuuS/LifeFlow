/**
 * LifeFlow — application bootstrap.
 */
import { $ } from './utils.js';
import { initRipples, theme, toast } from './ui.js';
import { route, setGuard, setNotFound, startRouter, resolve, navigate } from './router.js';
import { auth, onAuthStateChanged } from './firebase.js';
import * as store from './store.js';
import { initNotifications } from './notify.js';
import { initGoogleCalendar } from './gcal.js';
import { initPalette, isOpen as isPaletteOpen } from './palette.js';

import { renderLanding, renderLogin, renderSignup, renderForgot, hidePublic } from './views/public.js';
import { initShell, showApp, mountPage, unmountPage } from './views/shell.js';

import * as dashboard from './views/dashboard.js';
import * as tasks from './views/tasks.js';
import * as calendarPage from './views/calendar.js';
import * as finance from './views/finance.js';
import * as purchases from './views/purchases.js';
import * as goals from './views/goals.js';
import * as habits from './views/habits.js';
import * as games from './views/games.js';
import * as prayer from './views/prayer.js';
import * as notes from './views/notes.js';
import * as archive from './views/archive.js';
import * as profile from './views/profile.js';

const PRIVATE_PAGES = [
  ['/dashboard', dashboard],
  ['/tasks', tasks],
  ['/calendar', calendarPage],
  ['/finance', finance],
  ['/purchases', purchases],
  ['/goals', goals],
  ['/habits', habits],
  ['/games', games],
  ['/prayer', prayer],
  ['/notes', notes],
  ['/archive', archive],
  ['/profile', profile]
];

let session = { user: null, ready: false };

/** Where an unauthenticated visit was actually trying to go. */
const AFTER_LOGIN = 'lf:after-login';

function intendedDestination() {
  let saved = null;
  try {
    saved = sessionStorage.getItem(AFTER_LOGIN);
    sessionStorage.removeItem(AFTER_LOGIN);
  } catch { /* private mode */ }
  const path = (saved || '').replace('#', '');
  return path && !['/login', '/signup', '/forgot', '/'].includes(path.split('?')[0]) ? path : '/dashboard';
}

/* =========================================================
   Routes
   ========================================================= */
function registerRoutes() {
  const publicRoute = (path, title, render) =>
    route(path, {
      title,
      public: true,
      render: () => { unmountPage(); render(); }
    });

  publicRoute('/', 'Welcome', renderLanding);
  publicRoute('/login', 'Log in', renderLogin);
  publicRoute('/signup', 'Create account', renderSignup);
  publicRoute('/forgot', 'Reset password', renderForgot);

  PRIVATE_PAGES.forEach(([path, mod]) =>
    route(path, {
      title: mod.meta.title,
      render: () => { hidePublic(); showApp(); mountPage(mod); }
    })
  );

  setGuard((path, config) => {
    if (!session.ready) return null;
    const isPublic = !config || config.public;
    if (!session.user && !isPublic) {
      // Hold on to the destination — shared game links land here before login.
      try { sessionStorage.setItem(AFTER_LOGIN, location.hash); } catch { /* private mode */ }
      return '/login';
    }
    if (session.user && isPublic) return '/dashboard';
    return null;
  });

  setNotFound(() => navigate(session.user ? '/dashboard' : '/', { replace: true }));
}

/* =========================================================
   Auth lifecycle
   ========================================================= */
function watchAuth() {
  onAuthStateChanged(
    auth,
    async (user) => {
      const first = !session.ready;
      const changed = session.user?.uid !== user?.uid;
      session = { user, ready: true };

      if (user) {
        if (changed) {
          try {
            await store.connect(user);
          } catch (err) {
            console.error('[LifeFlow] Firestore connection failed', err);
            toast('Could not reach your data. Check your Firestore rules.', 'error', 6000);
          }
        }
        if (first || changed) {
          const here = (location.hash.replace('#', '') || '/').split('?')[0];
          if (['/login', '/signup', '/forgot', '/'].includes(here)) {
            navigate(intendedDestination(), { replace: true });
          }
        }
      } else {
        store.disconnect();
        unmountPage();
        $('#app').hidden = true;
      }

      if (first) startRouter();
      else resolve();

      hideSplash();
    },
    (err) => {
      console.error('[LifeFlow] auth error', err);
      session = { user: null, ready: true };
      startRouter();
      hideSplash();
    }
  );
}

/** Apply the user's saved theme/accent once the profile arrives. */
function watchPreferences() {
  let applied = false;
  store.subscribe((s) => {
    if (applied || !s.profile?.prefs) return;
    applied = true;
    const p = s.profile.prefs;
    if (p.accent) theme.setAccent(p.accent);
    if (p.theme && p.theme !== theme.getPreference()) theme.set(p.theme);
    theme.setCalm(!!p.calm);
    theme.setScale(p.textScale || 'md');
  });
}

function hideSplash() {
  const splash = $('#splash');
  if (!splash || splash.classList.contains('is-hidden')) return;
  setTimeout(() => {
    splash.classList.add('is-hidden');
    setTimeout(() => splash.remove(), 600);
  }, 380);
}

/* =========================================================
   Global niceties
   ========================================================= */
function bindGlobals() {
  // Keyboard shortcuts (desktop)
  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea, select, [contenteditable]')) return;
    if (!session.user) return;
    // Don't hijack single keys while a dialog or the palette is on screen.
    if (isPaletteOpen() || document.querySelector('.modal, .sheet')) return;
    const map = { d: '/dashboard', t: '/tasks', c: '/calendar', m: '/finance', b: '/purchases', g: '/goals', h: '/habits', y: '/games', j: '/notes', p: '/profile' };
    if (map[e.key.toLowerCase()] && !e.metaKey && !e.ctrlKey && !e.altKey) navigate(map[e.key.toLowerCase()]);
  });

  window.addEventListener('online', () => toast('Back online — syncing ✨', 'info', 2000));
  window.addEventListener('offline', () => toast('You’re offline. Changes will sync later.', 'info', 3200));

  window.addEventListener('error', (e) => console.error('[LifeFlow]', e.error || e.message));
}

/* =========================================================
   Go
   ========================================================= */
initRipples();
theme.sync();
theme.watchSystem();
initShell();
registerRoutes();
watchPreferences();
bindGlobals();
initPalette();
initNotifications();
initGoogleCalendar();
watchAuth();

// Safety net: never leave the splash up forever.
setTimeout(hideSplash, 6000);
