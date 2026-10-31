'use strict';

const { createHash } = require('node:crypto');

// Top-level, Admin-only collection: intentionally outside all client rule grants.
// Only timestamps are persisted, never room data, tokens, or TURN credentials.
const RATE_LIMIT_COLLECTION = '_rtcTurnRateLimits';
const LIMIT = 20;
const WINDOW_MS = 10 * 60 * 1000;

function createFirestoreRateLimiter({ db, now = Date.now }) {
  return async function consumeRateLimit(uid) {
    // Firebase custom UIDs may contain slashes; hashing gives a safe document ID.
    const id = createHash('sha256').update(uid).digest('hex');
    const ref = db.collection(RATE_LIMIT_COLLECTION).doc(id);
    return db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      const time = now();
      const stored = snapshot.exists ? snapshot.data().requests : [];
      if (!Array.isArray(stored) || stored.length > LIMIT ||
          stored.some((t) => !Number.isSafeInteger(t) || t < 0)) {
        throw new Error('Invalid rate limit state');
      }
      const requests = stored.filter((t) => t > time - WINDOW_MS).sort((a, b) => a - b);
      if (requests.length >= LIMIT) {
        return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((requests[0] + WINDOW_MS - time) / 1000)) };
      }
      requests.push(time);
      transaction.set(ref, { requests });
      return { allowed: true };
    });
  };
}

module.exports = { createFirestoreRateLimiter, RATE_LIMIT_COLLECTION, LIMIT, WINDOW_MS };