'use strict';

const { createHash } = require('node:crypto');
const { isIP } = require('node:net');

const ACTIONS = Object.freeze(['session_started', 'page_view', 'create', 'update', 'delete',
  'game_join', 'game_create', 'game_move', 'game_leave', 'device_toggle']);
const MODULES = Object.freeze(['app', 'dashboard', 'tasks', 'calendar', 'events', 'goals',
  'habits', 'notes', 'purchases', 'games', 'profile', 'finance', 'txns', 'savings', 'moods',
  'prayers', 'prayer', 'quran', 'archive']);
const BROWSERS = Object.freeze(['Edge', 'Chrome', 'Firefox', 'Safari', 'Opera', 'Samsung Internet', 'Other']);
const SYSTEMS = Object.freeze(['Windows', 'macOS', 'iOS', 'Android', 'Linux', 'Chrome OS', 'Other']);
const DEVICES = new Set(BROWSERS.flatMap((browser) => SYSTEMS.map((os) => `${browser} · ${os}`)));
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const WINDOW_MS = 5 * 60 * 1000;
const MAX_EVENTS = 120;
const BATCH_SIZE = 500;
const ERROR_CODES = new Set(['invalid-request', 'rate-limited', 'service-unavailable']);

class ActivityError extends Error {
  constructor(code, retryAfterSeconds) {
    const safeCode = ERROR_CODES.has(code) ? code : 'service-unavailable';
    super(safeCode);
    this.name = 'ActivityError';
    this.code = safeCode;
    if (safeCode === 'rate-limited') {
      this.retryAfterSeconds = Number.isFinite(retryAfterSeconds)
        ? Math.min(WINDOW_MS / 1000, Math.max(1, Math.ceil(retryAfterSeconds))) : WINDOW_MS / 1000;
    }
  }
}
function validUid(uid) {
  return typeof uid === 'string' && uid.length > 0 && uid.length <= 128 &&
    !/[\/\u0000-\u001f\u007f]/.test(uid) && uid !== '.' && uid !== '..' && !/^__.*__$/.test(uid);
}
function validMetadata(action, module) { return ACTIONS.includes(action) && MODULES.includes(module); }
function hash(uid) { return createHash('sha256').update(uid, 'utf8').digest('hex'); }
function normalizeIp(value) {
  if (typeof value !== 'string' || value.includes('%') || !isIP(value)) return null;
  return isIP(value) === 4 ? value : new URL(`http://[${value}]/`).hostname.slice(1, -1);
}
function millis(value) {
  if (value instanceof Date) value = value.getTime();
  else if (value && typeof value.toMillis === 'function') value = value.toMillis();
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}
function count(value) {
  return Number.isFinite(value) && value >= 0 ? Math.min(Number.MAX_SAFE_INTEGER, Math.floor(value)) : 0;
}
function increment(value) { return Math.min(Number.MAX_SAFE_INTEGER, count(value) + 1); }
function counters(value, whitelist, key) {
  const result = {};
  for (const name of whitelist) {
    if (value && Object.hasOwn(value, name)) result[name] = count(value[name]);
  }
  result[key] = increment(result[key]);
  return result;
}
function eventPath(path) {
  if (typeof path !== 'string') return false;
  const parts = path.split('/');
  return parts.length === 4 && parts[0] === 'accountAudit' && validUid(parts[1]) &&
    parts[2] === 'activityEvents' && parts[3].length > 0;
}
function summaryPath(path) {
  if (typeof path !== 'string') return false;
  const parts = path.split('/');
  return parts.length === 2 && parts[0] === 'accountAudit' && validUid(parts[1]);
}

/**
 * createActivityService({ db: getFirestore(), now: Date.now }) -- no SDK imports.
 * record({uid, action, module, ip, device}) -> {recorded:true} or
 *   {recorded:false, reason:'consent-required'}; ActivityError('rate-limited') on denial.
 * uid MUST come from a verified, non-revoked ID token. ip is trusted-runtime req.ip.
 * Action/module and coarse UA labels are client-reported metadata, NOT evidence.
 *
 * Parent: keep accountAudit/** and _activityRateLimits/** Admin-only. Optional TTL
 * on expireAt; schedule purgeExpired() repeatedly (one bounded page per invocation).
 * Admin reads MUST independently enforce 30-day retention, including lastIp/device;
 * delayed TTL/scheduler execution is not a privacy boundary. Read activityEvents,
 * never users/{uid}/events (personal calendar data). No secret provider is needed.
 */
function createActivityService({ db, now = Date.now }) {
  const clock = () => {
    const time = now();
    if (millis(time) === null || !Number.isFinite(new Date(time + RETENTION_MS).getTime())) {
      throw new ActivityError('service-unavailable');
    }
    return time;
  };
  async function guarded(work) {
    try { return await work(); }
    catch (error) { throw error instanceof ActivityError ? error : new ActivityError('service-unavailable'); }
  }
  return {
    async record({ uid, action, module, ip, device } = {}) {
      if (!validUid(uid) || !validMetadata(action, module) || !DEVICES.has(device)) {
        throw new ActivityError('invalid-request');
      }
      return guarded(async () => {
        const profileRef = db.collection('users').doc(uid);
        const summaryRef = db.collection('accountAudit').doc(uid);
        const rateRef = db.collection('_activityRateLimits').doc(hash(uid));
        const eventRef = summaryRef.collection('activityEvents').doc();
        return db.runTransaction(async (tx) => {
          // Re-read consent on EVERY transaction retry; no preflight consent cache.
          // Read all three documents before any writes (Firestore requirement).
          const [profile, summary, rate] = await Promise.all([
            tx.get(profileRef), tx.get(summaryRef), tx.get(rateRef)
          ]);
          if (!profile.exists || profile.data()?.prefs?.activitySharing !== true) {
            return { recorded: false, reason: 'consent-required' };
          }
          const at = clock(); // Server receive/processing time, never client time.
          const stored = rate.exists ? rate.data()?.requests : [];
          if (!Array.isArray(stored) || stored.length > MAX_EVENTS ||
              stored.some((time) => !Number.isSafeInteger(time) || time < 0 || time > at)) {
            throw new ActivityError('service-unavailable'); // Corrupt/future limits fail closed.
          }
          const requests = stored.filter((time) => time > at - WINDOW_MS).sort((a, b) => a - b);
          if (requests.length >= MAX_EVENTS) {
            throw new ActivityError('rate-limited', (requests[0] + WINDOW_MS - at) / 1000);
          }
          const prior = summary.exists ? summary.data() || {} : {};
          const first = millis(prior.firstObservedAt);
          const expireAt = new Date(at + RETENTION_MS);
          const observedIp = normalizeIp(ip);
          const next = {
            firstObservedAt: first !== null && first <= at ? first : at,
            lastObservedAt: at,
            totalEvents: increment(prior.totalEvents),
            byAction: counters(prior.byAction, ACTIONS, action),
            byModule: counters(prior.byModule, MODULES, module),
            lastIp: observedIp, lastDevice: device, privateUntil: expireAt
          };
          tx.create(eventRef, { at, action, module, ip: observedIp, device, expireAt });
          // Top-level mergeFields REPLACES the maps, removing non-whitelisted keys;
          // merge:true would incorrectly preserve old arbitrary nested keys.
          tx.set(summaryRef, next, { mergeFields: Object.keys(next) });
          tx.set(rateRef, { requests: [...requests, at], count: requests.length + 1,
            windowStartedAt: new Date(requests[0] ?? at), expireAt: new Date(at + WINDOW_MS) });
          return { recorded: true };
        });
      });
    },

    async purgeExpired() {
      return guarded(async () => {
        const time = clock();
        const expired = await db.collectionGroup('activityEvents')
          .where('expireAt', '<=', new Date(time)).limit(BATCH_SIZE).get();
        const batch = db.batch();
        let deletedEvents = 0;
        for (const doc of expired.docs) {
          // Collection groups can include unrelated documents: exact scope is mandatory.
          const expiry = millis(doc.data()?.expireAt);
          if (!eventPath(doc.ref.path) || expiry === null || expiry > time) continue;
          batch.delete(doc.ref);
          deletedEvents++;
        }
        if (deletedEvents) await batch.commit();

        // Timestamp range excludes null: a scrubbed summary is not selected again.
        const stale = await db.collection('accountAudit')
          .where('privateUntil', '<=', new Date(time)).limit(BATCH_SIZE).get();
        const refs = stale.docs.filter((doc) => summaryPath(doc.ref.path)).map((doc) => doc.ref);
        const scrubbedSummaries = refs.length ? await db.runTransaction(async (tx) => {
          const snapshots = await Promise.all(refs.map((ref) => tx.get(ref)));
          let scrubbed = 0;
          for (const doc of snapshots) {
            if (!doc.exists) continue;
            const data = doc.data();
            const expiry = millis(data.privateUntil), last = millis(data.lastObservedAt);
            // Recheck inside a transaction: never erase a concurrently refreshed IP.
            if (expiry === null || expiry > time || (last !== null && last > time - RETENTION_MS)) continue;
            tx.set(doc.ref, { lastIp: null, lastDevice: null, privateUntil: null },
              { mergeFields: ['lastIp', 'lastDevice', 'privateUntil'] });
            scrubbed++;
          }
          return scrubbed;
        }) : 0;
        return { deletedEvents, scrubbedSummaries };
      });
    }
  };
}

module.exports = { createActivityService, ActivityError, ACTIONS, MODULES, BROWSERS, SYSTEMS,
  validUid, validMetadata, normalizeIp, hash, RETENTION_MS, WINDOW_MS, MAX_EVENTS, BATCH_SIZE };