'use strict';

const { createHash } = require('node:crypto');
const { isIP } = require('node:net');

const SESSION_MS = 30 * 60 * 1000;
const WINDOW_MS = 15 * 60 * 1000;
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const COLLECTIONS = Object.freeze({
  sessions: '_privateAdminSessions', limits: '_privateAdminRateLimits', audit: '_privateAdminAudit'
});
const COUNT_COLLECTIONS = ['tasks', 'events', 'goals', 'habits', 'notes', 'purchases'];

// Only these local, fixed error codes may cross the HTTP boundary. Never forward
// Firebase exceptions, UserRecord.toJSON(), provider responses, or record bodies.
class AdminError extends Error {
  constructor(code) { super(code); this.code = code; }
}
function validUid(uid) {
  return typeof uid === 'string' && uid.length > 0 && uid.length <= 128 && !uid.includes('/');
}
function requireUid(uid) { if (!validUid(uid)) throw new AdminError('invalid-request'); }
function validDocumentId(id) {
  return typeof id === 'string' && id.length > 0 && Buffer.byteLength(id) <= 1500 &&
    !id.includes('/') && id !== '.' && id !== '..';
}
function hash(value) { return createHash('sha256').update(value).digest('hex'); }
function text(value, max = 120) {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, max) : null;
}
function millis(value) {
  if (value instanceof Date) value = value.getTime();
  else if (value && typeof value.toMillis === 'function') value = value.toMillis();
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}
function authTime(value) {
  return typeof value === 'string' ? millis(Date.parse(value)) : null;
}
function counter(value) { return Number.isSafeInteger(value) && value >= 0 ? value : 0; }
function counters(value) {
  const result = Object.create(null);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return result;
  for (const key of Object.keys(value).slice(0, 100)) {
    if (/^[a-zA-Z][a-zA-Z0-9_.:-]{0,63}$/.test(key) &&
        !['__proto__', 'constructor', 'prototype'].includes(key) &&
        Number.isSafeInteger(value[key]) && value[key] >= 0) result[key] = value[key];
  }
  return result;
}

function normalizeIp(value) {
  if (typeof value !== 'string' || value.includes('%') || !isIP(value)) return null;
  if (isIP(value) === 4) return value;
  // WHATWG canonicalization makes equivalent IPv6 addresses share a rate bucket.
  return new URL(`http://[${value}]/`).hostname.slice(1, -1);
}
function maskIp(value) {
  const ip = normalizeIp(value);
  if (!ip) return null;
  if (isIP(ip) === 4) return ip.split('.').slice(0, 3).join('.') + '.*';
  const halves = ip.split('::');
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves[1] ? halves[1].split(':') : [];
  const groups = halves.length === 2
    ? [...left, ...Array(8 - left.length - right.length).fill('0'), ...right] : left;
  // Mask ALL groups beyond the first three, including embedded IPv4 groups.
  return groups.slice(0, 3).join(':') + ':*:*:*:*:*';
}
function safeAccount(user) {
  return {
    uid: validUid(user.uid) ? user.uid : null, email: text(user.email, 320), displayName: text(user.displayName),
    emailVerified: user.emailVerified === true, disabled: user.disabled === true,
    createdAt: authTime(user.metadata?.creationTime), lastSignInAt: authTime(user.metadata?.lastSignInTime),
    providers: [...new Set((Array.isArray(user.providerData) ? user.providerData : [])
      .map((provider) => text(provider?.providerId)).filter(Boolean))].slice(0, 50)
  };
}

/**
 * Firebase Admin adapter; no SDK import/initialization or network work at construction.
 * createAdminService({ db: getFirestore(), auth: getAuth(), now: Date.now })
 *
 * Keep all _privateAdmin* collections Admin-only (no client read/write grants).
 * Optional Firestore TTL field: expireAt (Date -> Timestamp) on sessions/limits.
 * Expiry is ALWAYS checked in code; TTL deletion is not an authorization boundary.
 * Parent tracking owns event deletion/TTL; queries here exclude events older than
 * 30 days. Activity is client-reported, NOT proof of actions or identity/location.
 */
function createAdminService({ db, auth, now = Date.now }) {
  const sessionRef = (id) => {
    if (typeof id !== 'string' || !/^[a-f0-9]{64}$/.test(id)) throw new AdminError('invalid-request');
    return db.collection(COLLECTIONS.sessions).doc(id);
  };
  const auditRef = (uid) => db.collection('accountAudit').doc(uid);
  const userRef = (uid) => db.collection('users').doc(uid);
  async function scopedEvent(uid, id) {
    if (!validDocumentId(id)) throw new AdminError('invalid-request');
    const events = auditRef(uid).collection('activityEvents');
    const snapshot = await events.doc(id).get();
    if (!snapshot.exists) throw new AdminError('not-found');
    if (snapshot.ref.path !== `${events.path}/${id}`) throw new AdminError('invalid-request');
    return snapshot;
  }
  function recent(at, time) {
    return Number.isSafeInteger(at) && at >= time - RETENTION_MS && at <= time;
  }
  return {
    /** Sliding windows; both buckets are checked/updated in ONE transaction.
     * Every admitted login attempt counts, including successes and bad codes.
     * IPs come exclusively from the trusted runtime, never the request body/XFF.
     */
    async consumeLoginAttempt(ip) {
      ip = normalizeIp(ip);
      if (!ip) throw new AdminError('service-unavailable');
      const refs = [db.collection(COLLECTIONS.limits).doc(`ip-${hash(ip)}`),
        db.collection(COLLECTIONS.limits).doc('global')];
      return db.runTransaction(async (tx) => {
        const snapshots = await Promise.all(refs.map((ref) => tx.get(ref)));
        const time = now();
        const maxima = [5, 50];
        const windows = snapshots.map((snap, index) => {
          const stored = snap.exists ? snap.data().requests : [];
          if (!Array.isArray(stored) || stored.length > maxima[index] ||
              stored.some((at) => !Number.isSafeInteger(at) || at < 0 || at > time)) {
            throw new AdminError('service-unavailable');
          }
          return stored.filter((at) => at > time - WINDOW_MS).sort((a, b) => a - b);
        });
        const blocked = windows.map((requests, i) => requests.length >= maxima[i]
          ? requests[0] + WINDOW_MS - time : 0);
        if (blocked.some(Boolean)) {
          return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(Math.max(...blocked) / 1000)) };
        }
        refs.forEach((ref, i) => tx.set(ref, {
          requests: [...windows[i], time], expiresAt: time + WINDOW_MS, expireAt: new Date(time + WINDOW_MS)
        }));
        return { allowed: true };
      });
    },
    async createSession({ id, csrfToken, codeFingerprint, expiresAt }) {
      const time = now();
      if (typeof csrfToken !== 'string' || !/^[a-zA-Z0-9_-]{32}$/.test(csrfToken) ||
          typeof codeFingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(codeFingerprint) ||
          !Number.isSafeInteger(expiresAt) || expiresAt <= time || expiresAt > time + SESSION_MS) {
        throw new AdminError('invalid-request');
      }
      await sessionRef(id).create({ csrfToken, codeFingerprint, createdAt: time,
        expiresAt, expireAt: new Date(expiresAt) });
    },
    async getSession(id) {
      const snap = await sessionRef(id).get();
      if (!snap.exists) return null;
      const data = snap.data();
        if (!Number.isSafeInteger(data.expiresAt) || data.expiresAt <= now() ||
          typeof data.csrfToken !== 'string' || !/^[A-Za-z0-9_-]{32}$/.test(data.csrfToken) ||
          typeof data.codeFingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(data.codeFingerprint)) return null;
      return { csrfToken: data.csrfToken, codeFingerprint: data.codeFingerprint, expiresAt: data.expiresAt };
    },
    async deleteSession(id) { await sessionRef(id).delete(); },
    async listAccounts({ pageSize = 50, pageToken } = {}) {
      if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 50 ||
          (pageToken !== undefined && (typeof pageToken !== 'string' || !pageToken.length || pageToken.length > 2048))) {
        throw new AdminError('invalid-request');
      }
      let page;
      try { page = await auth.listUsers(pageSize, pageToken); }
      catch (err) {
        if (err?.code === 'auth/invalid-page-token') throw new AdminError('invalid-request');
        throw new AdminError('service-unavailable');
      }
      return { accounts: page.users.map(safeAccount),
        nextPageToken: typeof page.pageToken === 'string' && page.pageToken.length <= 2048 ? page.pageToken || null : null };
    },
    async getAccount(uid) {
      requireUid(uid);
      let user;
      try { user = await auth.getUser(uid); }
      catch (err) {
        if (err?.code === 'auth/user-not-found') throw new AdminError('not-found');
        throw new AdminError('service-unavailable');
      }
      const [audit, profile, aggregates] = await Promise.all([
        auditRef(uid).get(), userRef(uid).get(),
        Promise.all(COUNT_COLLECTIONS.map((name) => userRef(uid).collection(name).count().get()))
      ]);
      const data = audit.exists ? audit.data() : {};
      const counts = Object.fromEntries(COUNT_COLLECTIONS.map((name, i) => [name, counter(aggregates[i].data().count)]));
      return { account: safeAccount(user), summary: {
        consent: profile.exists && profile.data()?.prefs?.activitySharing === true,
        firstObservedAt: millis(data.firstObservedAt), lastObservedAt: millis(data.lastObservedAt),
        totalEvents: counter(data.totalEvents), byAction: counters(data.byAction), byModule: counters(data.byModule),
        lastIpMasked: recent(data.lastObservedAt, now()) ? maskIp(data.lastIp) : null, counts
      } };
    },
    async getActivity({ uid, cursor }) {
      requireUid(uid);
      const time = now();
      let query = auditRef(uid).collection('activityEvents').where('at', '>=', time - RETENTION_MS)
        .where('at', '<=', time).orderBy('at', 'desc');
      if (cursor !== undefined) {
        const snap = await scopedEvent(uid, cursor);
        if (!recent(snap.data().at, time)) throw new AdminError('invalid-request');
        query = query.startAfter(snap); // DocumentSnapshot, never an untrusted path/value cursor.
      }
      const page = await query.limit(50).get();
      const events = page.docs.filter((doc) => recent(doc.data().at, time)).map((doc) => {
        const data = doc.data();
        return { id: doc.id, at: data.at, action: text(data.action, 64), module: text(data.module, 64),
          ipMasked: maskIp(data.ip), device: text(data.device) };
      });
      return { events, nextCursor: page.docs.length === 50 ? page.docs[page.docs.length - 1].id : null };
    },
    async revealIp({ uid, eventId, sessionId }) {
      requireUid(uid);
      sessionRef(sessionId); // Validate the pseudonymous admin audit actor (hashed session ID).
      const time = now();
      let ip = null, at = null;
      if (eventId !== undefined) {
        const snap = await scopedEvent(uid, eventId);
        const data = snap.data();
        if (!recent(data.at, time)) throw new AdminError('not-found');
        ip = normalizeIp(data.ip); at = millis(data.at);
      } else {
        const snap = await auditRef(uid).get();
        if (snap.exists) {
          const data = snap.data();
          if (recent(data.lastObservedAt, time)) {
            ip = normalizeIp(data.lastIp); at = millis(data.lastObservedAt);
          }
        }
      }
      // Await the durable audit BEFORE disclosing anything; no raw IP/token/code.
      await db.collection(COLLECTIONS.audit).add({ action: 'revealIp', uid,
        eventId: eventId ?? null, sessionId, at: time, observedAt: at });
      return { ip, at };
    }
  };
}

module.exports = { createAdminService, AdminError, validUid, validDocumentId, normalizeIp, maskIp,
  safeAccount, hash, SESSION_MS, WINDOW_MS, RETENTION_MS, COLLECTIONS };