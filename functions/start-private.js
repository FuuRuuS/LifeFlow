'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { readServerConfig, createPrivateServer } = require('./private-server');
const { createAdminService } = require('./admin-service');
const { createActivityService, BATCH_SIZE } = require('./activity-service');

class StartupError extends Error {}

function validateStartup(env = process.env, nodeVersion = process.versions.node) {
  if (Number(nodeVersion.split('.')[0]) < 22) throw new StartupError('Node.js 22 or newer is required. Select Node 22+ before launching.');
  const code = env.PRIVATE_ADMIN_CODE;
  if (typeof code !== 'string' || code.trim().length < 8 || code.length > 256) {
    throw new StartupError('Set PRIVATE_ADMIN_CODE to a strong secret of 8–256 characters before launching.');
  }
  const projectId = env.GOOGLE_CLOUD_PROJECT || env.GCLOUD_PROJECT;
  if (typeof projectId !== 'string' || !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId)) {
    throw new StartupError('Set GOOGLE_CLOUD_PROJECT (or GCLOUD_PROJECT) to an explicit Firebase project ID.');
  }
  let config;
  try { config = readServerConfig(env); } catch (error) { throw new StartupError(error.message); }
  if ((env.FIREBASE_AUTH_EMULATOR_HOST !== undefined || env.FIRESTORE_EMULATOR_HOST !== undefined) &&
      !(env.PRIVATE_ALLOW_FIREBASE_EMULATORS === 'true' && config.mode === 'local')) {
    throw new StartupError('Firebase emulator variables require local mode and deliberate PRIVATE_ALLOW_FIREBASE_EMULATORS=true.');
  }
  if (env.GOOGLE_APPLICATION_CREDENTIALS !== undefined) {
    try {
      const repo = fs.realpathSync(path.resolve(__dirname, '..'));
      const file = fs.realpathSync(env.GOOGLE_APPLICATION_CREDENTIALS);
      const relative = path.relative(repo, file);
      if (!fs.statSync(file).isFile() || relative === '' || (!relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))) throw new Error();
      fs.accessSync(file, fs.constants.R_OK);
    } catch { throw new StartupError('GOOGLE_APPLICATION_CREDENTIALS must be a readable external file outside this repository. Otherwise use authorized ADC.'); }
  }
  return { config, projectId };
}

async function loadAdmin(projectId) {
  // No Functions runtime, dotenv, implicit demo project, or browser credentials.
  const { initializeApp, applicationDefault, deleteApp } = require('firebase-admin/app');
  const { getAuth } = require('firebase-admin/auth');
  const { getFirestore } = require('firebase-admin/firestore');
  const app = initializeApp({ credential: applicationDefault(), projectId });
  return { auth: getAuth(app), db: getFirestore(app), dispose: () => deleteApp(app) };
}

/** Injectable adapters permit offline verification. Defaults use authorized Admin ADC.
 * Reverse proxies must preserve the public Host and overwrite XFF with ONE IP and
 * X-Forwarded-Proto with https. Firewall the bind port to the configured proxy peers.
 * Cleanup off: configure Firestore TTL on expireAt; summary IP scrubbing additionally
 * needs recurring purgeExpired(). Closing does not delete users or persisted sessions;
 * sessions remain subject to their existing 30-minute expiry and secret fingerprint.
 */
async function start(options = {}) {
  const env = options.env ?? process.env;
  const { config, projectId } = validateStartup(env, options.nodeVersion ?? process.versions.node);
  const logger = options.logger ?? console;
  let backend, server, timer, closing = false, cleanupRunning = false, closePromise;
  const removeSignals = () => { process.removeListener('SIGINT', onSignal); process.removeListener('SIGTERM', onSignal); };
  const close = () => {
    if (closePromise) return closePromise;
    closing = true;
    clearInterval(timer);
    removeSignals();
    closePromise = (async () => {
      if (server?.listening) {
        await new Promise((resolve) => {
          const force = setTimeout(() => server.closeAllConnections(), 5000);
          force.unref();
          server.close(() => { clearTimeout(force); resolve(); });
          server.closeIdleConnections();
        });
      }
      // Wait for the bounded cleanup run before releasing the SDK.
      if (cleanupRunning) await cleanupRunning;
      try { await backend?.dispose?.(); } catch { logger.error('Private server SDK shutdown failed.'); }
    })();
    return closePromise;
  };
  const onSignal = () => { void close(); };
  try {
    try { backend = await (options.loadAdmin ?? loadAdmin)(projectId); }
    catch { throw new StartupError('Admin SDK initialization failed. Install dependencies and configure authorized Firebase ADC.'); }
    try { await backend.auth.listUsers(1); }
    catch { throw new StartupError('Firebase Auth preflight failed. Check ADC, project ID, and permission to list users.'); }
    try { await backend.db.collection('_privateAdminSessions').limit(1).get(); }
    catch { throw new StartupError('Firestore preflight failed. Check ADC, project ID, database availability and Admin collection access.'); }
    const adminService = createAdminService(backend);
    const activityService = createActivityService(backend);
    try {
      server = (options.createServer ?? createPrivateServer)({ config, adminService, activityService,
        auth: backend.auth, getCode: () => env.PRIVATE_ADMIN_CODE });
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(config.port, config.host, () => { server.removeListener('error', reject); resolve(); });
      });
    } catch { throw new StartupError('Private server could not listen. Check bind address, port, and TLS key/certificate files.'); }
    server.on('error', () => { logger.error('Private server transport failed.'); void close(); });
    server.once('close', () => { clearInterval(timer); removeSignals(); });
    process.once('SIGINT', onSignal);
    process.once('SIGTERM', onSignal);
    const cleanup = () => {
      if (closing || cleanupRunning) return cleanupRunning || Promise.resolve();
      cleanupRunning = (async () => {
        try {
          for (let page = 0; page < 10 && !closing; page++) {
            const result = await activityService.purgeExpired();
            if (result.deletedEvents < BATCH_SIZE && result.scrubbedSummaries < BATCH_SIZE) break;
          }
        } catch { logger.error('Activity cleanup failed. Check Firestore permissions and indexes; no records were logged.'); }
      })().finally(() => { cleanupRunning = false; });
      return cleanupRunning;
    };
    if (config.activityCleanupEnabled) {
      timer = setInterval(cleanup, 60 * 60 * 1000);
      timer.unref();
      void cleanup();
    } else {
      logger.log('Activity cleanup OFF: configure expireAt TTL and recurring summary IP cleanup before retaining activity.');
    }
    const address = server.address();
    logger.log(`Private server: ${config.origin}/statadmnaccprvt.html (project ${projectId}; listening port ${address.port}).`);
    if (config.mode === 'proxy') logger.log('Proxy mode: preserve public Host; overwrite X-Forwarded-For with one client IP and X-Forwarded-Proto=https.');
    if (env.FIREBASE_AUTH_EMULATOR_HOST !== undefined || env.FIRESTORE_EMULATOR_HOST !== undefined) logger.log('Explicit local Firebase emulator access enabled; this is not live production data.');
    return { server, close };
  } catch (error) {
    await close();
    throw error instanceof StartupError ? error : new StartupError('Private server startup failed. Check configuration and authorized ADC.');
  }
}

if (require.main === module) {
  start().catch((error) => {
    console.error(error instanceof StartupError ? error.message : 'Private server startup failed.');
    process.exitCode = 1;
  });
}

module.exports = { start, validateStartup };