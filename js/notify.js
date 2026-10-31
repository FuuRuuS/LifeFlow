/**
 * LifeFlow — reminders & phone notifications.
 *
 * How it works
 * ------------
 * The app builds a rolling list of "alarms" (prayer times, calendar entries,
 * task due times, the morning digest) for the next ~36 hours and fires them
 * through the service worker, so they arrive as real system notifications even
 * when the tab is in the background.
 *
 * The same list is handed to the service worker, which re-checks it on
 * `periodicsync`. That is what lets a reminder still arrive when the app has
 * been closed — on Android/Chrome with the PWA installed.
 *
 * Known platform limits (please read before filing a bug):
 *   • iOS/iPadOS   — needs 16.4+ AND the app added to the Home Screen. Safari
 *                    tabs can never show notifications.
 *   • Any browser  — with the app fully closed, delivery is best-effort. For
 *                    guaranteed delivery a server push (FCM) is required; the
 *                    service worker already has the `push` handler for it.
 */
import * as store from './store.js';
import { prayerSchedule } from './prayer.js';
import { ymd, addDays, fromYmd, today } from './utils.js';

export const DEFAULT_NOTIFY_PREFS = {
  enabled: false,
  prayers: true,
  /** Minutes before the adhan for the "get ready" nudge (0 = off). */
  prayerLead: 10,
  events: true,
  eventLead: 30,
  tasks: true,
  taskLead: 0,
  digest: false,
  digestTime: '08:00'
};

/** How far ahead alarms are pre-computed. */
const HORIZON_MS = 36 * 3600 * 1000;
/** An alarm older than this is stale — the device was probably asleep. */
const GRACE_MS = 15 * 60 * 1000;
const TICK_MS = 30 * 1000;
const FIRED_KEY = 'lf:notify:fired';
const PERIODIC_TAG = 'lifeflow-alarms';
/** Undated events and tasks are announced at this hour, local time. */
const ALLDAY_HOUR = 9;

let registration = null;
let ticker = null;
let started = false;

/* =========================================================
   Capability checks
   ========================================================= */
/** Service workers cannot be registered from file:// (index.html opened from disk). */
function swUsable() {
  return 'serviceWorker' in navigator && location.protocol !== 'file:';
}

export function isSupported() {
  // From file:// reminders fall back to in-page notifications while the tab is open.
  return typeof Notification !== 'undefined' && (swUsable() || location.protocol === 'file:');
}

export function permission() {
  return isSupported() ? Notification.permission : 'unsupported';
}

export function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

export function isIOS() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

/** iOS only exposes the Notification API to home-screen apps. */
export function needsHomeScreenInstall() {
  return isIOS() && !isStandalone();
}

/* =========================================================
   Preferences
   ========================================================= */
export function notifyPrefs() {
  return { ...DEFAULT_NOTIFY_PREFS, ...(store.prefs().notify || {}) };
}

export async function saveNotifyPrefs(patch) {
  const wasEnabled = notifyPrefs().enabled;
  await store.savePrefs({ notify: { ...notifyPrefs(), ...patch } });
  // Switching reminders on should not replay everything from the last quarter
  // of an hour — mark whatever is already due as handled.
  if (patch.enabled === true && !wasEnabled) markPastAsFired();
  refresh();
}

/** Silences alarms that are already due so they cannot fire retroactively. */
function markPastAsFired() {
  const now = Date.now();
  const fired = loadFired();
  for (const a of buildAlarms(now)) if (a.at <= now) fired[a.key] = now;
  saveFired(fired);
}

/* =========================================================
   Service worker
   ========================================================= */
export async function registerServiceWorker() {
  if (!swUsable()) return null;
  try {
    registration = await navigator.serviceWorker.register('./sw.js', { scope: './' });
    await navigator.serviceWorker.ready;
    return registration;
  } catch (err) {
    console.warn('[notify] service worker registration failed', err);
    return null;
  }
}

async function reg() {
  if (registration) return registration;
  if (!swUsable()) return null;
  registration = (await navigator.serviceWorker.getRegistration()) || null;
  return registration;
}

/** Best-effort background wake-ups (Chrome/Android, installed PWA only). */
async function registerPeriodicSync() {
  const r = await reg();
  if (!r || !('periodicSync' in r)) return false;
  try {
    const status = await navigator.permissions.query({ name: 'periodic-background-sync' });
    if (status.state !== 'granted') return false;
    await r.periodicSync.register(PERIODIC_TAG, { minInterval: 15 * 60 * 1000 });
    return true;
  } catch {
    return false;
  }
}

/* =========================================================
   Permission
   ========================================================= */
/** Asks the OS for permission. Must be called from a user gesture. */
export async function requestPermission() {
  if (!isSupported()) {
    return { ok: false, reason: needsHomeScreenInstall() ? 'ios-install' : 'unsupported' };
  }
  if (Notification.permission === 'denied') return { ok: false, reason: 'denied' };

  const result = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  if (result !== 'granted') return { ok: false, reason: result };

  await registerServiceWorker();
  await registerPeriodicSync();
  return { ok: true };
}

/* =========================================================
   Fired-alarm bookkeeping
   ========================================================= */
function loadFired() {
  try {
    const raw = JSON.parse(localStorage.getItem(FIRED_KEY) || '{}');
    const cutoff = Date.now() - 2 * 86400000;
    const out = {};
    for (const [k, v] of Object.entries(raw)) if (v > cutoff) out[k] = v;
    return out;
  } catch {
    return {};
  }
}

function saveFired(fired) {
  try {
    localStorage.setItem(FIRED_KEY, JSON.stringify(fired));
  } catch {
    /* quota — harmless */
  }
}

/* =========================================================
   Alarm construction
   ========================================================= */
function at(dateStr, hhmm) {
  const d = fromYmd(dateStr);
  if (!d) return null;
  const [h, m] = String(hhmm || '00:00').split(':').map(Number);
  d.setHours(h || 0, m || 0, 0, 0);
  return d.getTime();
}

function minus(ms, minutes) {
  return ms - (Number(minutes) || 0) * 60000;
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function prayerAlarms(p, now, horizon) {
  const pray = store.prefs().prayer;
  if (!p.prayers || !pray?.enabled) return [];

  const out = [];
  for (let offset = 0; offset <= 2; offset++) {
    const date = addDays(new Date(now), offset);
    const dateStr = ymd(date);

    for (const item of prayerSchedule(date, pray)) {
      if (!item.at) continue;
      const time = item.at.getTime();
      if (time > horizon) continue;

      const base = {
        url: '#/prayer',
        icon: null,
        tag: `prayer-${item.id}-${dateStr}`
      };

      if (p.prayerLead > 0) {
        out.push({
          ...base,
          key: `prayer:${dateStr}:${item.id}:lead`,
          at: minus(time, p.prayerLead),
          title: `${item.emoji} ${item.label} in ${p.prayerLead} min`,
          body: `${item.ar} · ${item.hhmm} — time to get ready.`
        });
      }

      out.push({
        ...base,
        key: `prayer:${dateStr}:${item.id}:now`,
        at: time,
        title: `${item.emoji} ${item.label} — ${item.ar}`,
        body: `It is ${item.hhmm}. Time for ${item.label}.`,
        requireInteraction: true
      });
    }
  }
  return out;
}

function eventAlarms(p, horizon) {
  if (!p.events) return [];
  const from = today();

  return store.state.events
    .filter((e) => e.date && e.date >= from)
    .flatMap((e) => {
      const start = e.time ? at(e.date, e.time) : at(e.date, `${String(ALLDAY_HOUR).padStart(2, '0')}:00`);
      if (start == null) return [];
      const when = e.time ? minus(start, p.eventLead) : start;
      if (when > horizon) return [];

      const lead = e.time && p.eventLead > 0 ? ` in ${p.eventLead} min` : '';
      const detail = [e.time || 'All day', e.location].filter(Boolean).join(' · ');

      return [
        {
          key: `event:${e.id}:${e.date}:${e.time || 'allday'}:${p.eventLead}`,
          at: when,
          title: `📅 ${e.title || 'Event'}${lead}`,
          body: detail || 'On your calendar today.',
          tag: `event-${e.id}`,
          url: '#/calendar'
        }
      ];
    });
}

function taskAlarms(p, horizon) {
  if (!p.tasks) return [];
  const from = today();

  return store.state.tasks
    .filter((t) => !t.done && t.due && t.due >= from)
    .flatMap((t) => {
      const due = t.time ? at(t.due, t.time) : at(t.due, `${String(ALLDAY_HOUR).padStart(2, '0')}:00`);
      if (due == null) return [];
      const when = t.time ? minus(due, p.taskLead) : due;
      if (when > horizon) return [];

      return [
        {
          key: `task:${t.id}:${t.due}:${t.time || 'allday'}:${p.taskLead}`,
          at: when,
          title: `✅ ${t.title || 'Task'}`,
          body: t.time ? `Due at ${t.time}.` : 'Due today.',
          tag: `task-${t.id}`,
          url: '#/tasks'
        }
      ];
    });
}

function digestAlarms(p, now, horizon) {
  if (!p.digest) return [];

  const out = [];
  for (let offset = 0; offset <= 1; offset++) {
    const dateStr = ymd(addDays(new Date(now), offset));
    const when = at(dateStr, p.digestTime);
    if (when == null || when > horizon) continue;

    const tasks = store.state.tasks.filter((t) => !t.done && (!t.due || t.due <= dateStr)).length;
    const events = store.state.events.filter((e) => e.date === dateStr).length;
    const parts = [];
    if (tasks) parts.push(plural(tasks, 'task', 'tasks'));
    if (events) parts.push(plural(events, 'event', 'events'));

    out.push({
      key: `digest:${dateStr}`,
      at: when,
      title: '🌅 Your day at a glance',
      body: parts.length ? `${parts.join(' · ')} ahead. Have a good one.` : 'Nothing scheduled — a clear day ahead.',
      tag: 'digest',
      url: '#/dashboard'
    });
  }
  return out;
}

/** Every alarm inside the horizon, soonest first. */
export function buildAlarms(now = Date.now()) {
  const p = notifyPrefs();
  if (!p.enabled || !store.state.ready) return [];

  const horizon = now + HORIZON_MS;
  return [
    ...prayerAlarms(p, now, horizon),
    ...eventAlarms(p, horizon),
    ...taskAlarms(p, horizon),
    ...digestAlarms(p, now, horizon)
  ]
    .filter((a) => a.at != null && a.at > now - GRACE_MS && a.at <= horizon)
    .sort((a, b) => a.at - b.at);
}

/** The next few reminders — used to preview the schedule in settings. */
export function upcomingAlarms(limit = 5) {
  const now = Date.now();
  return buildAlarms(now).filter((a) => a.at > now).slice(0, limit);
}

/* =========================================================
   Delivery
   ========================================================= */
async function fire(alarm) {
  const r = await reg();
  if (r) {
    await r.showNotification(alarm.title, {
      body: alarm.body,
      tag: alarm.tag || alarm.key,
      renotify: true,
      requireInteraction: !!alarm.requireInteraction,
      vibrate: [180, 90, 180],
      timestamp: alarm.at,
      data: { url: alarm.url || '#/dashboard', key: alarm.key }
    });
    r.active?.postMessage({ type: 'MARK_FIRED', key: alarm.key });
    return;
  }
  // Last resort — only works while the page is in the foreground.
  new Notification(alarm.title, { body: alarm.body, tag: alarm.tag || alarm.key });
}

/** Fires anything that has come due, then hands the rest to the worker. */
export async function refresh() {
  if (!isSupported()) return;

  const p = notifyPrefs();
  const r = await reg();

  // Turned off (or permission was revoked) — make sure the worker stops too.
  if (!p.enabled || permission() !== 'granted') {
    r?.active?.postMessage({ type: 'SET_ALARMS', alarms: [] });
    return;
  }

  const now = Date.now();
  const alarms = buildAlarms(now);
  const fired = loadFired();
  let dirty = false;

  for (const a of alarms) {
    if (a.at > now || fired[a.key]) continue;
    try {
      await fire(a);
      fired[a.key] = now;
      dirty = true;
    } catch (err) {
      console.warn('[notify] could not show', a.key, err);
    }
  }
  if (dirty) saveFired(fired);

  r?.active?.postMessage({
    type: 'SET_ALARMS',
    alarms: alarms.filter((a) => a.at > now),
    fired
  });
}

/** A one-off notification so the user can check it actually works. */
export async function testNotification() {
  const res = await requestPermission();
  if (!res.ok) return res;
  await fire({
    key: `test:${Date.now()}`,
    at: Date.now(),
    title: '🔔 LifeFlow reminders are on',
    body: 'This is exactly how your prayer and calendar reminders will look.',
    tag: 'lifeflow-test',
    url: '#/profile'
  });
  return { ok: true };
}

/* =========================================================
   Lifecycle
   ========================================================= */
export function initNotifications() {
  if (started) return;
  started = true;

  // Register regardless of notification support: an iOS Safari tab cannot show
  // notifications, but the worker must already be in place for when the user
  // adds the app to their Home Screen.
  registerServiceWorker().then(() => {
    if (!isSupported()) return;
    registerPeriodicSync();
    refresh();
  });

  if (!isSupported()) return;

  // Rebuild whenever the data or preferences change.
  let last = '';
  store.subscribe(() => {
    // Only the fields that can move an alarm are part of the signature.
    const sig = JSON.stringify([
      notifyPrefs(),
      store.prefs().prayer,
      store.state.events.map((e) => [e.id, e.date, e.time, e.title]),
      store.state.tasks.map((t) => [t.id, t.due, t.time, t.title, !!t.done])
    ]);
    if (sig === last) return;
    last = sig;
    refresh();
  });

  clearInterval(ticker);
  ticker = setInterval(refresh, TICK_MS);

  // Background tabs get throttled hard — catch up the moment we are visible.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refresh();
  });
  window.addEventListener('focus', refresh);
}
