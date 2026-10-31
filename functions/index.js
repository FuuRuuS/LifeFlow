'use strict';

const { onRequest } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { defineSecret } = require('firebase-functions/params');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');
const { createTurnHandler } = require('./turn-handler');
const { createFirestoreRateLimiter } = require('./rate-limit');
const { createAdminHandler } = require('./admin-handler');
const { createAdminService } = require('./admin-service');
const { createActivityHandler } = require('./activity-handler');
const { createActivityService } = require('./activity-service');

initializeApp();
const db = getFirestore();
const TURN_KEY_ID = defineSecret('TURN_KEY_ID');
const TURN_API_TOKEN = defineSecret('TURN_API_TOKEN');
const PRIVATE_ADMIN_CODE = defineSecret('PRIVATE_ADMIN_CODE');
const allowedOrigins = (process.env.APP_ALLOWED_ORIGINS || '').split(',').map((value) => value.trim()).filter(Boolean);
const emulator = process.env.FUNCTIONS_EMULATOR === 'true';
const activityService = createActivityService({ db });

exports.privateAdmin = onRequest({
  region: 'us-central1', maxInstances: 3, memory: '256MiB', timeoutSeconds: 30,
  secrets: [PRIVATE_ADMIN_CODE], cors: false, invoker: 'public'
}, createAdminHandler({
  service: createAdminService({ db, auth: getAuth() }),
  getCode: () => PRIVATE_ADMIN_CODE.value(), allowedOrigins, emulator
}));

exports.recordActivity = onRequest({
  region: 'us-central1', maxInstances: 3, memory: '256MiB', timeoutSeconds: 30,
  cors: false, invoker: 'public'
}, createActivityHandler({ auth: getAuth(), service: activityService, allowedOrigins, emulator }));

// Bounded cleanup complements Firestore TTL. Reads enforce retention immediately.
exports.purgeActivity = onSchedule({
  schedule: 'every 60 minutes', region: 'us-central1', memory: '256MiB', timeoutSeconds: 120, maxInstances: 1
}, async () => {
  for (let page = 0; page < 10; page++) {
    const result = await activityService.purgeExpired();
    if (result.deletedEvents < 500 && result.scrubbedSummaries < 500) break;
  }
});

// Optional non-secret environment configuration:
// TURN_ALLOWED_ORIGINS: comma-separated, exact HTTPS origins (no paths/wildcards).
// TURN_ALLOW_NULL_ORIGIN=true: explicitly permit file:// / opaque origins.
// Local HTTP origins are accepted only when FUNCTIONS_EMULATOR=true.
const handler = createTurnHandler({
  verifyIdToken: (token) => getAuth().verifyIdToken(token, true),
  getRoom: async (code) => {
    const snapshot = await db.collection('rooms').doc(code).get();
    return snapshot.exists ? snapshot.data() : null;
  },
  consumeRateLimit: createFirestoreRateLimiter({ db }),
  getSecrets: () => ({ keyId: TURN_KEY_ID.value(), apiToken: TURN_API_TOKEN.value() }),
  fetch: (...args) => globalThis.fetch(...args),
  allowedOrigins: (process.env.TURN_ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),
  allowNullOrigin: process.env.TURN_ALLOW_NULL_ORIGIN === 'true',
  emulator: process.env.FUNCTIONS_EMULATOR === 'true'
});

exports.rtcIceServers = onRequest({
  region: 'us-central1',
  maxInstances: 3,
  memory: '256MiB',
  timeoutSeconds: 30,
  secrets: [TURN_KEY_ID, TURN_API_TOKEN],
  // Manual exact-origin CORS in the handler; CORS is never authentication.
  cors: false,
  invoker: 'public'
}, handler);