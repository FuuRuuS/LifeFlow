/**
 * LifeFlow — two-way Google Calendar sync.
 *
 * Runs entirely in the browser using Google Identity Services for the OAuth
 * token and the Calendar REST API v3 for the data — no backend, no secrets.
 *
 * Sync model
 * ----------
 *   pull  Incremental via `syncToken` (falls back to a time window on the first
 *         run or when Google expires the token with HTTP 410).
 *   push  Any local event whose content signature differs from the one stored
 *         at the last sync is created or patched remotely.
 *
 * The content signature (`gcalHash`) is what stops the classic sync ping-pong:
 * an event written by the pull step already carries the matching signature, so
 * the push step correctly sees it as unchanged.
 *
 * Conflicts are resolved as "remote wins", because pull runs before push.
 */
import { GOOGLE } from './config.js';
import * as store from './store.js';
import { ymd, fromYmd, addDays } from './utils.js';

const GIS_SRC = 'https://accounts.google.com/gsi/client';
const API = 'https://www.googleapis.com/calendar/v3';
const TOKEN_KEY = 'lf:gcal:token';
const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
const DEFAULT_DURATION = 60;

export const DEFAULT_GCAL_PREFS = {
  connected: false,
  calendarId: GOOGLE.calendarId,
  calendarName: '',
  syncToken: null,
  lastSync: 0,
  autoSync: true
};

let gisPromise = null;
let tokenClient = null;
let syncing = false;

/* =========================================================
   Preferences
   ========================================================= */
export function isConfigured() {
  return Boolean(GOOGLE.clientId);
}

export function gcalPrefs() {
  return { ...DEFAULT_GCAL_PREFS, ...(store.prefs().gcal || {}) };
}

async function saveGcalPrefs(patch) {
  await store.savePrefs({ gcal: { ...gcalPrefs(), ...patch } });
}

export function isConnected() {
  return isConfigured() && gcalPrefs().connected;
}

/* =========================================================
   OAuth
   ========================================================= */
function loadGis() {
  if (gisPromise) return gisPromise;
  gisPromise = new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve();
    const s = document.createElement('script');
    s.src = GIS_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not load Google Identity Services.'));
    document.head.appendChild(s);
  });
  return gisPromise;
}

/**
 * Access tokens live in sessionStorage, never localStorage: they expire in an
 * hour and should not outlive the browser session. Re-authorisation afterwards
 * is silent because consent has already been granted.
 */
function readToken() {
  try {
    const t = JSON.parse(sessionStorage.getItem(TOKEN_KEY) || 'null');
    return t && t.expiresAt > Date.now() ? t : null;
  } catch {
    return null;
  }
}

function writeToken(t) {
  try {
    if (t) sessionStorage.setItem(TOKEN_KEY, JSON.stringify(t));
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* private mode — the token simply stays in memory for this page */
  }
}

async function ensureClient() {
  if (!isConfigured()) throw new Error('Google Calendar is not configured yet.');
  await loadGis();
  if (!tokenClient) {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE.clientId,
      scope: GOOGLE.scope,
      callback: () => {}
    });
  }
  return tokenClient;
}

function requestToken(prompt) {
  return new Promise((resolve, reject) => {
    tokenClient.callback = (res) => {
      if (res.error) return reject(new Error(res.error_description || res.error));
      const t = { accessToken: res.access_token, expiresAt: Date.now() + (Number(res.expires_in || 3600) - 60) * 1000 };
      writeToken(t);
      resolve(t);
    };
    tokenClient.error_callback = (err) =>
      reject(new Error(err?.type === 'popup_closed' ? 'Sign-in was cancelled.' : 'Google sign-in failed.'));
    tokenClient.requestAccessToken({ prompt });
  });
}

/** `interactive` allows Google to show the account chooser / consent screen. */
async function getToken({ interactive = false, force = false } = {}) {
  if (!force) {
    const cached = readToken();
    if (cached) return cached;
  }
  await ensureClient();
  // An empty prompt reuses the existing grant without any UI.
  return requestToken(interactive ? 'consent' : '');
}

/* =========================================================
   REST helper
   ========================================================= */
async function api(path, { method = 'GET', params, body, interactive = false, retry = true } = {}) {
  const token = await getToken({ interactive });
  const url = new URL(API + path);
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  });

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token.accessToken}`,
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (res.status === 401 && retry) {
    writeToken(null);
    return api(path, { method, params, body, interactive, retry: false });
  }
  // 410 = the stored syncToken is too old; the caller restarts a full sync.
  if (res.status === 410) throw Object.assign(new Error('sync-token-expired'), { code: 410 });
  if (res.status === 404) throw Object.assign(new Error('not-found'), { code: 404 });

  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.error?.message || `Google Calendar error ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

/* =========================================================
   Mapping
   ========================================================= */
function dateAt(dateStr, hhmm) {
  const d = fromYmd(dateStr);
  if (!d) return null;
  const [h, m] = String(hhmm || '00:00').split(':').map(Number);
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}

function hhmmOf(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** The fields a user can actually edit — used to detect real changes. */
export function signature(ev) {
  return JSON.stringify([
    ev.title || '',
    ev.type || 'event',
    ev.date || '',
    ev.time || '',
    ev.location || '',
    ev.note || '',
    ev.durationMin || null
  ]);
}

function toGoogle(ev) {
  const body = {
    summary: ev.title || 'Untitled',
    location: ev.location || '',
    description: ev.note || '',
    extendedProperties: { private: { lifeflowType: ev.type || 'event', lifeflowId: ev.id || '' } }
  };

  if (ev.time) {
    const start = dateAt(ev.date, ev.time);
    const end = new Date(start.getTime() + (Number(ev.durationMin) || DEFAULT_DURATION) * 60000);
    body.start = { dateTime: start.toISOString(), timeZone: TZ };
    body.end = { dateTime: end.toISOString(), timeZone: TZ };
  } else {
    body.start = { date: ev.date };
    body.end = { date: ymd(addDays(fromYmd(ev.date), 1)) };
  }
  return body;
}

function fromGoogle(item) {
  const allDay = Boolean(item.start?.date);
  const start = allDay ? fromYmd(item.start.date) : new Date(item.start.dateTime);
  const endRaw = item.end?.date ? fromYmd(item.end.date) : item.end?.dateTime ? new Date(item.end.dateTime) : null;

  const data = {
    title: item.summary || '(no title)',
    type: item.extendedProperties?.private?.lifeflowType || 'event',
    date: ymd(start),
    time: allDay ? null : hhmmOf(start),
    location: item.location || '',
    note: item.description || '',
    durationMin: !allDay && endRaw ? Math.max(5, Math.round((endRaw - start) / 60000)) : null
  };

  return {
    ...data,
    gcalId: item.id,
    gcalUpdated: item.updated ? Date.parse(item.updated) : Date.now(),
    gcalHash: signature(data)
  };
}

/* =========================================================
   Public actions
   ========================================================= */
export async function listCalendars() {
  const res = await api('/users/me/calendarList', { params: { minAccessRole: 'writer', maxResults: 50 } });
  return (res.items || []).map((c) => ({ id: c.id, name: c.summary, primary: !!c.primary }));
}

export async function connect() {
  await ensureClient();
  await getToken({ interactive: true, force: true });

  let calendarName = '';
  try {
    const cals = await listCalendars();
    calendarName = cals.find((c) => c.id === gcalPrefs().calendarId)?.name || '';
  } catch {
    /* naming the calendar is cosmetic */
  }

  await saveGcalPrefs({ connected: true, calendarName, syncToken: null });
  return syncNow();
}

export async function disconnect({ revoke = true } = {}) {
  const token = readToken();
  if (revoke && token && window.google?.accounts?.oauth2) {
    try {
      window.google.accounts.oauth2.revoke(token.accessToken, () => {});
    } catch {
      /* revocation is best-effort */
    }
  }
  writeToken(null);
  await saveGcalPrefs({ connected: false, syncToken: null, lastSync: 0 });
}

/** Called by the store when a synced event is deleted locally. */
export async function deleteRemote(ev) {
  if (!isConnected() || !ev?.gcalId) return;
  try {
    await api(`/calendars/${encodeURIComponent(gcalPrefs().calendarId)}/events/${encodeURIComponent(ev.gcalId)}`, {
      method: 'DELETE'
    });
  } catch (err) {
    if (err.code !== 404 && err.code !== 410) throw err; // already gone is fine
  }
}

/* =========================================================
   Sync
   ========================================================= */
async function pull(calendarId, syncToken) {
  const base = { calendarId: encodeURIComponent(calendarId) };
  const items = [];
  let pageToken = null;
  let nextSyncToken = null;

  const params = syncToken
    ? { syncToken, showDeleted: true }
    : {
        timeMin: addDays(new Date(), -GOOGLE.initialWindowDays).toISOString(),
        singleEvents: true,
        showDeleted: false,
        maxResults: 250
      };

  do {
    const res = await api(`/calendars/${base.calendarId}/events`, {
      params: { ...params, ...(pageToken ? { pageToken } : {}) }
    });
    items.push(...(res.items || []));
    pageToken = res.nextPageToken || null;
    nextSyncToken = res.nextSyncToken || nextSyncToken;
  } while (pageToken);

  return { items, nextSyncToken };
}

async function applyRemote(items) {
  let created = 0;
  let updated = 0;
  let deleted = 0;

  for (const item of items) {
    const local = store.state.events.find((e) => e.gcalId === item.id);

    if (item.status === 'cancelled') {
      if (local) {
        await store.remove('events', local.id, { skipRemote: true });
        deleted++;
      }
      continue;
    }
    if (!item.start) continue; // events without a start cannot be shown

    const mapped = fromGoogle(item);

    if (!local) {
      await store.create('events', mapped);
      created++;
    } else if ((local.gcalUpdated || 0) < mapped.gcalUpdated && local.gcalHash !== mapped.gcalHash) {
      await store.update('events', local.id, mapped);
      updated++;
    }
  }
  return { created, updated, deleted };
}

async function push(calendarId) {
  const cal = encodeURIComponent(calendarId);
  let inserted = 0;
  let patched = 0;

  for (const ev of [...store.state.events]) {
    if (!ev.date) continue;
    const sig = signature(ev);
    if (ev.gcalId && ev.gcalHash === sig) continue;

    try {
      if (!ev.gcalId) {
        const res = await api(`/calendars/${cal}/events`, { method: 'POST', body: toGoogle(ev) });
        await store.update('events', ev.id, {
          gcalId: res.id,
          gcalUpdated: res.updated ? Date.parse(res.updated) : Date.now(),
          gcalHash: sig
        });
        inserted++;
      } else {
        const res = await api(`/calendars/${cal}/events/${encodeURIComponent(ev.gcalId)}`, {
          method: 'PATCH',
          body: toGoogle(ev)
        });
        await store.update('events', ev.id, {
          gcalUpdated: res.updated ? Date.parse(res.updated) : Date.now(),
          gcalHash: sig
        });
        patched++;
      }
    } catch (err) {
      // A remotely deleted event should not block the rest of the sync.
      if (err.code === 404) await store.update('events', ev.id, { gcalId: null, gcalHash: null });
      else console.warn('[gcal] push failed for', ev.id, err);
    }
  }
  return { inserted, patched };
}

/**
 * Runs a full pull-then-push cycle.
 * @returns {Promise<{created:number,updated:number,deleted:number,inserted:number,patched:number}>}
 */
export async function syncNow() {
  if (!isConnected()) throw new Error('Google Calendar is not connected.');
  if (syncing) return null;
  syncing = true;

  try {
    const p = gcalPrefs();
    let result;
    try {
      result = await pull(p.calendarId, p.syncToken);
    } catch (err) {
      if (err.code !== 410) throw err;
      result = await pull(p.calendarId, null); // token expired → full resync
    }

    const remote = await applyRemote(result.items);
    const local = await push(p.calendarId);

    await saveGcalPrefs({ syncToken: result.nextSyncToken || null, lastSync: Date.now() });
    return { ...remote, ...local };
  } finally {
    syncing = false;
  }
}

/* =========================================================
   Lifecycle
   ========================================================= */
export function initGoogleCalendar() {
  if (!isConfigured()) return;

  store.setEventDeleteHook(deleteRemote);

  let armed = false;
  store.subscribe(async (s) => {
    if (armed || !s.ready || !isConnected() || !gcalPrefs().autoSync) return;
    armed = true;
    try {
      await syncNow();
    } catch (err) {
      console.warn('[gcal] initial sync failed', err.message);
    }
  });

  // A light catch-up whenever the user returns to the app.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (!isConnected() || !gcalPrefs().autoSync) return;
    if (Date.now() - (gcalPrefs().lastSync || 0) < 5 * 60 * 1000) return;
    syncNow().catch((err) => console.warn('[gcal] sync failed', err.message));
  });
}
