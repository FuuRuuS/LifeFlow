/* eslint-env serviceworker */
/**
 * LifeFlow — service worker.
 *
 * Responsibilities
 * ----------------
 * 1. Show notifications on behalf of the page (works while the tab is hidden).
 * 2. Keep a snapshot of upcoming alarms so that `periodicsync` can still fire
 *    reminders when the app is fully closed (Chrome/Android, installed PWA).
 * 3. Handle `push` payloads — used later when a server (FCM) is added.
 * 4. Focus / open the right page when a notification is tapped.
 *
 * There is deliberately **no** offline asset caching here: the app is already
 * network-light and cache invalidation would only add risk.
 */

const ALARM_CACHE = 'lifeflow-alarms-v1';
const ALARM_KEY = '/__lifeflow_alarms__';
const PERIODIC_TAG = 'lifeflow-alarms';

/** How late an alarm may fire before we consider it stale and skip it. */
const GRACE_MS = 15 * 60 * 1000;

const ICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'%3E%3Crect width='512' height='512' rx='112' fill='%2308080f'/%3E%3Cpath d='M96 320c48-112 112-112 160 0s112 112 160 0' fill='none' stroke='%237c6cff' stroke-width='48' stroke-linecap='round'/%3E%3Cpath d='M96 192c48-112 112-112 160 0s112 112 160 0' fill='none' stroke='%2335d6ff' stroke-width='48' stroke-linecap='round' opacity='.5'/%3E%3C/svg%3E";

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

/* =========================================================
   Alarm snapshot storage (Cache API — no extra dependency)
   ========================================================= */
async function readStore() {
  try {
    const cache = await caches.open(ALARM_CACHE);
    const res = await cache.match(ALARM_KEY);
    if (!res) return { alarms: [], fired: {} };
    const data = await res.json();
    return { alarms: data.alarms || [], fired: data.fired || {} };
  } catch {
    return { alarms: [], fired: {} };
  }
}

async function writeStore(data) {
  try {
    const cache = await caches.open(ALARM_CACHE);
    await cache.put(ALARM_KEY, new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } }));
  } catch {
    /* storage is best-effort */
  }
}

/** Drop fired-markers older than two days so the record cannot grow forever. */
function pruneFired(fired) {
  const cutoff = Date.now() - 2 * 86400000;
  const out = {};
  for (const [key, at] of Object.entries(fired)) if (at > cutoff) out[key] = at;
  return out;
}

/* =========================================================
   Messages from the page
   ========================================================= */
self.addEventListener('message', (event) => {
  const msg = event.data || {};

  if (msg.type === 'SKIP_WAITING') return self.skipWaiting();

  if (msg.type === 'SET_ALARMS') {
    event.waitUntil(
      (async () => {
        const store = await readStore();
        await writeStore({
          alarms: Array.isArray(msg.alarms) ? msg.alarms : [],
          fired: pruneFired({ ...store.fired, ...(msg.fired || {}) })
        });
      })()
    );
  }

  if (msg.type === 'MARK_FIRED' && msg.key) {
    event.waitUntil(
      (async () => {
        const store = await readStore();
        store.fired[msg.key] = Date.now();
        await writeStore({ alarms: store.alarms, fired: pruneFired(store.fired) });
      })()
    );
  }

  if (msg.type === 'SHOW') {
    event.waitUntil(show(msg.notification || {}));
  }
});

/* =========================================================
   Firing
   ========================================================= */
function show(a) {
  return self.registration.showNotification(a.title || 'LifeFlow', {
    body: a.body || '',
    tag: a.tag || a.key || 'lifeflow',
    icon: a.icon || ICON,
    badge: a.badge || ICON,
    renotify: true,
    requireInteraction: !!a.requireInteraction,
    silent: !!a.silent,
    vibrate: a.silent ? undefined : [180, 90, 180],
    timestamp: a.at || Date.now(),
    data: { url: a.url || '/#/dashboard', key: a.key || null }
  });
}

/** Fire every alarm that is due — but only when no window is already open. */
async function runDueAlarms() {
  const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  if (clientList.length) return; // the page handles its own scheduling

  const store = await readStore();
  const now = Date.now();
  let changed = false;

  for (const a of store.alarms) {
    if (!a || typeof a.at !== 'number') continue;
    if (a.at > now || a.at < now - GRACE_MS) continue;
    if (store.fired[a.key]) continue;
    await show(a);
    store.fired[a.key] = now;
    changed = true;
  }

  if (changed) await writeStore({ alarms: store.alarms, fired: pruneFired(store.fired) });
}

self.addEventListener('periodicsync', (event) => {
  if (event.tag === PERIODIC_TAG) event.waitUntil(runDueAlarms());
});

self.addEventListener('sync', (event) => {
  if (event.tag === PERIODIC_TAG) event.waitUntil(runDueAlarms());
});

/* =========================================================
   Push (reserved for a future FCM / Web Push server)
   ========================================================= */
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: 'LifeFlow', body: event.data ? event.data.text() : '' };
  }
  const n = payload.notification || payload;
  event.waitUntil(show({ ...n, url: n.url || payload.data?.url }));
});

/* =========================================================
   Interaction
   ========================================================= */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/#/dashboard', self.registration.scope).href;

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clientList) {
        if (client.url.split('#')[0] === target.split('#')[0]) {
          await client.focus();
          if ('navigate' in client) await client.navigate(target).catch(() => {});
          return;
        }
      }
      await self.clients.openWindow(target);
    })()
  );
});
