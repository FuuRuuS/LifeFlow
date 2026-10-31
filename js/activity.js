/** Optional, memory-only activity metadata. Never import store/router here. */
import { auth } from './firebase.js';

const ACTIONS = new Set(['session_started', 'page_view', 'create', 'update', 'delete',
  'game_join', 'game_create', 'game_move', 'game_leave', 'device_toggle']);
const MODULES = new Set(['app', 'dashboard', 'tasks', 'calendar', 'events', 'goals',
  'habits', 'notes', 'purchases', 'games', 'profile', 'finance', 'txns', 'savings',
  'moods', 'prayers', 'prayer', 'quran', 'archive']);
const MAX_QUEUE = 30;
const INTERVAL_MS = 3000;
const TIMEOUT_MS = 8000;
let consentUid = null;
let generation = 0;
let queue = [];
let timer = null;
let active = null;
let nextSendAt = 0;
let failures = 0;
let delivery = 'off';

function supportedOrigin() {
  if (typeof location === 'undefined') return false;
  if (location.protocol === 'https:') return true;
  const host = location.hostname || '';
  return location.protocol === 'http:' && (host === 'localhost' || host.endsWith('.localhost') ||
    /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host) || host === '[::1]');
}

function online() {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

function clearWork() {
  generation++;
  queue = [];
  if (timer !== null) clearTimeout(timer);
  timer = null;
  const previous = active;
  active = null;
  previous?.controller.abort();
}

/** Only strict true for the current authenticated UID activates consent. */
export function setActivityConsent(uid, on) {
  const next = on === true && typeof uid === 'string' && uid && auth.currentUser?.uid === uid ? uid : null;
  if (next === consentUid) {
    if (!next) clearWork();
    return;
  }
  clearWork();
  consentUid = next;
  failures = 0;
  nextSendAt = 0;
  delivery = next ? (supportedOrigin() ? 'idle' : 'unsupported') : 'off';
  // A consent activation in this page, NOT a login or authoritative lastSignIn.
  if (next) recordActivity('session_started', 'app');
}

function current(uid, version) {
  return consentUid === uid && generation === version && auth.currentUser?.uid === uid;
}

function backoff() {
  clearWork();
  failures = Math.min(failures + 1, 5);
  nextSendAt = Date.now() + Math.min(300000, 30000 * 2 ** (failures - 1));
  delivery = 'unavailable';
  // No retry timer: failed events and the entire backlog are discarded.
}

function schedule() {
  if (timer !== null || active || !queue.length) return;
  timer = setTimeout(() => {
    timer = null;
    void sendNext();
  }, Math.max(250, nextSendAt - Date.now()));
}

/** Fire-and-forget. Only these two whitelisted strings ever enter the queue. */
export function recordActivity(action, module) {
  if (!ACTIONS.has(action) || !MODULES.has(module) || !consentUid) return;
  if (auth.currentUser?.uid !== consentUid) { setActivityConsent(null, false); return; }
  if (!supportedOrigin()) return;
  if (!online()) { backoff(); return; }
  if (delivery === 'unavailable' && Date.now() < nextSendAt) return;
  if (queue.length + (active ? 1 : 0) >= MAX_QUEUE) return;
  queue.push({ action, module });
  schedule();
}

async function sendNext() {
  const uid = consentUid;
  const version = generation;
  const user = auth.currentUser;
  if (!uid || !current(uid, version)) { setActivityConsent(null, false); return; }
  if (!supportedOrigin() || !online()) { backoff(); return; }
  const event = queue.shift();
  if (!event) return;
  const job = { controller: new AbortController() };
  active = job;
  nextSendAt = Date.now() + INTERVAL_MS;
  delivery = 'pending';
  const signal = job.controller.signal;
  let timeout;
  let onAbort;
  try {
    const cancelled = new Promise((_, reject) => {
      onAbort = () => reject(new Error('cancelled'));
      signal.addEventListener('abort', onAbort, { once: true });
      timeout = setTimeout(() => job.controller.abort(), TIMEOUT_MS);
    });
    const result = await Promise.race([cancelled, (async () => {
      // Capture identity/generation BEFORE token lookup and recheck BEFORE fetch.
      if (!current(uid, version) || signal.aborted) return null;
      const token = await user.getIdToken();
      if (!current(uid, version) || user.uid !== uid || signal.aborted) return null;
      if (!online() || !supportedOrigin() || typeof token !== 'string' || !token) throw new Error('unavailable');
      const response = await fetch('/api/activity', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
        credentials: 'omit', cache: 'no-store', redirect: 'error',
        mode: 'same-origin', referrerPolicy: 'no-referrer', signal
      });
      if (!current(uid, version) || signal.aborted) return null;
      if (!response.ok) throw new Error('unavailable');
      return response.json();
    })()]);
    if (!current(uid, version) || signal.aborted) return;
    if (result?.recorded !== true) throw new Error('unavailable');
    failures = 0;
    delivery = 'recorded';
  } catch {
    if (current(uid, version)) backoff();
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener('abort', onAbort);
    if (active === job) active = null;
    // A stale worker must never clear or drain another account's queue.
    if (generation === version) {
      if (!current(uid, version)) setActivityConsent(null, false);
      else schedule();
    }
  }
}

/** Local state only; saving consent does not prove the backend recorded anything. */
export function getActivityStatus() {
  if (consentUid && auth.currentUser?.uid !== consentUid) setActivityConsent(null, false);
  return { enabled: Boolean(consentUid), delivery, queued: queue.length + (active ? 1 : 0) };
}

if (typeof window !== 'undefined') {
  window.addEventListener('offline', () => { if (consentUid) backoff(); });
}