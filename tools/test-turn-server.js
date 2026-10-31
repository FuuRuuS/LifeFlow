'use strict';

// Dependency-free: node --test tools/test-turn-server.js (no Firebase/network access).
const test = require('node:test');
const assert = require('node:assert/strict');
const { createTurnHandler, TTL_SECONDS } = require('../functions/turn-handler');
const { createFirestoreRateLimiter, RATE_LIMIT_COLLECTION, WINDOW_MS } = require('../functions/rate-limit');

const TIME = 1800000000000;
const ORIGIN = 'https://planner-project-7ab9e.web.app';
const ROOM = 'ABCD2345';
// Deliberately fake sentinels: never load environment secrets in tests.
const KEY = 'fake-key-sentinel';
const TOKEN = 'fake-api-token-sentinel';
const ICE = {
  iceServers: [
    { urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.cloudflare.com:53'] },
    { urls: ['turn:turn.cloudflare.com:3478?transport=udp', 'turn:turn.cloudflare.com:53',
      'turns:turn.cloudflare.com:5349?transport=tcp'], username: 'temporary-user', credential: 'temporary-password',
    providerOnly: TOKEN }
  ],
  debug: KEY
};

function fixture(overrides = {}, options = {}) {
  const calls = { auth: [], rooms: [], limits: [], secrets: 0, provider: [] };
  const handler = createTurnHandler({
    now: () => TIME,
    verifyIdToken: async (token) => { calls.auth.push(token); return { uid: 'host' }; },
    getRoom: async (code) => { calls.rooms.push(code); return { hostUid: 'host', guestUid: 'guest' }; },
    consumeRateLimit: async (uid) => { calls.limits.push(uid); return { allowed: true }; },
    getSecrets: () => { calls.secrets++; return { keyId: KEY, apiToken: TOKEN }; },
    fetch: async (...args) => { calls.provider.push(args); return { ok: true, json: async () => ICE }; },
    ...overrides,
    ...options
  });
  async function request(changes = {}) {
    const req = { method: 'POST', body: { roomCode: ROOM }, ...changes,
      headers: { origin: ORIGIN, authorization: 'Bearer fake-id-token', 'content-type': 'application/json', ...changes.headers } };
    const res = {
      statusCode: 200, headers: {}, body: undefined,
      setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; },
      end() { return this; }
    };
    await handler(req, res);
    assert.equal(res.headers['cache-control'], 'no-store');
    assert.equal(res.headers.vary, 'Origin');
    assert.ok(!JSON.stringify(res).includes(KEY));
    assert.ok(!JSON.stringify(res).includes(TOKEN));
    return res;
  }
  return { request, calls };
}

function error(res, status, code) {
  assert.equal(res.statusCode, status);
  assert.equal(res.body.error.code, code);
  assert.equal(typeof res.body.error.message, 'string');
  assert.deepEqual(Object.keys(res.body), ['error']);
}

test('host success: verified auth, membership, exact provider contract and safe response', async () => {
  const f = fixture();
  const res = await f.request();
  assert.equal(res.statusCode, 200);
  assert.deepEqual(f.calls.auth, ['fake-id-token']);
  assert.deepEqual(f.calls.rooms, [ROOM]);
  assert.deepEqual(f.calls.limits, ['host']);
  assert.equal(f.calls.secrets, 1);
  assert.equal(res.headers['access-control-allow-origin'], ORIGIN);
  assert.deepEqual(res.body, {
    iceServers: [
      { urls: ['stun:stun.cloudflare.com:3478'] },
      { urls: ['turn:turn.cloudflare.com:3478?transport=udp', 'turns:turn.cloudflare.com:5349?transport=tcp'],
        username: 'temporary-user', credential: 'temporary-password' }
    ],
    expiresAt: TIME + TTL_SECONDS * 1000
  });
  const [url, init] = f.calls.provider[0];
  assert.equal(url, `https://rtc.live.cloudflare.com/v1/turn/keys/${KEY}/credentials/generate-ice-servers`);
  assert.equal(init.method, 'POST');
  assert.deepEqual(init.headers, { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' });
  assert.deepEqual(JSON.parse(init.body), { ttl: 86400 });
  assert.ok(init.signal instanceof AbortSignal);
  assert.equal(init.redirect, 'error');
});

test('guest and 12-character uppercase alphanumeric room codes are accepted', async () => {
  const f = fixture({ verifyIdToken: async () => ({ uid: 'guest' }) });
  assert.equal((await f.request({ body: { roomCode: 'ABCD12345678' } })).statusCode, 200);
});

test('missing/malformed/rejected bearer and unusable decoded IDs never reach DB or provider', async () => {
  for (const authorization of [undefined, '', 'Basic abc', 'Bearer', 'Bearer x y']) {
    const f = fixture();
    error(await f.request({ headers: { authorization } }), 401, 'unauthorized');
    assert.deepEqual(f.calls.auth, []);
    assert.deepEqual(f.calls.limits, []);
    assert.deepEqual(f.calls.rooms, []);
    assert.equal(f.calls.provider.length, 0);
  }
  for (const verifyIdToken of [async () => { throw new Error(TOKEN); }, async () => ({}), async () => null]) {
    const f = fixture({ verifyIdToken });
    error(await f.request(), 401, 'unauthorized');
    assert.equal(f.calls.limits.length, 0);
    assert.equal(f.calls.provider.length, 0);
  }
});

test('nonmember and absent rooms never read secrets or mint credentials', async () => {
  for (const [room, status, code] of [
    [{ hostUid: 'someone-else', guestUid: null }, 403, 'forbidden'],
    [null, 404, 'room-not-found']
  ]) {
    const f = fixture({ getRoom: async () => room });
    error(await f.request(), status, code);
    assert.equal(f.calls.secrets, 0);
    assert.equal(f.calls.provider.length, 0);
  }
});

test('bad room codes and non-JSON bodies are rejected without room lookups', async () => {
  for (const body of [null, [], {}, 'ABCD2345', { roomCode: 12345678 },
    ...['abcd2345', 'ABC1234', 'ABCDEFGHIJKLM', 'ABCD/234', 'ABCD2345\n', ' ABCD2345', 'ＡBCD2345']
      .map((roomCode) => ({ roomCode }))]) {
    const f = fixture();
    error(await f.request({ body }), 400, 'invalid-request');
    assert.equal(f.calls.rooms.length, 0);
    assert.equal(f.calls.provider.length, 0);
  }
  error(await fixture().request({ headers: { 'content-type': 'text/plain' } }), 400, 'invalid-request');
});

test('rate limited requests return Retry-After without room/provider work', async () => {
  const f = fixture({ consumeRateLimit: async () => ({ allowed: false, retryAfterSeconds: 47 }) });
  const res = await f.request();
  error(res, 429, 'rate-limited');
  assert.equal(res.headers['retry-after'], '47');
  assert.equal(f.calls.rooms.length, 0);
  assert.equal(f.calls.provider.length, 0);
});

test('database/rate-limit failures fail closed without exposing exception text', async () => {
  for (const overrides of [
    { getRoom: async () => { throw new Error(TOKEN); } },
    { consumeRateLimit: async () => { throw new Error(KEY); } },
    { consumeRateLimit: async () => undefined }
  ]) {
    const f = fixture(overrides);
    error(await f.request(), 503, 'service-unavailable');
    assert.equal(f.calls.provider.length, 0);
  }
});

test('missing/unavailable secrets produce relay-not-configured', async () => {
  for (const getSecrets of [() => ({}), () => ({ keyId: KEY }), () => ({ apiToken: TOKEN }),
    () => ({ keyId: ' ', apiToken: TOKEN }), () => { throw new Error(TOKEN); }]) {
    const f = fixture({ getSecrets });
    error(await f.request(), 503, 'relay-not-configured');
    assert.equal(f.calls.provider.length, 0);
  }
});

test('provider HTTP, network, timeout and JSON failures are sanitized and never logged', async (t) => {
  const logs = [];
  for (const method of ['log', 'warn', 'error', 'info', 'debug']) {
    t.mock.method(console, method, (...args) => logs.push(args));
  }
  for (const fetch of [
    async () => ({ ok: false, json: async () => { throw new Error('Must not read error body'); } }),
    async () => { throw new Error(TOKEN); },
    async () => { const e = new Error(KEY); e.name = 'TimeoutError'; throw e; },
    async () => ({ ok: true, json: async () => { throw new Error(TOKEN); } })
  ]) error(await fixture({ fetch }).request(), 502, 'relay-provider-failed');
  assert.deepEqual(logs, []);
});

test('malformed ICE, STUN-only and missing/invalid relay credentials are rejected', async () => {
  const malformed = [null, {}, { iceServers: [] }, { iceServers: 'invalid' },
    { iceServers: [{ urls: 'stun:stun.example.com:3478' }] }];
  for (const urls of ['https://example.com', 'turn:bad host:3478', 'turn:host:0', 'turn:host:65536',
    'turn:host:53', 'turn:host:00053', 'turn:host:3478?transport=invalid', 'turn:user@host:3478',
    'turn:[::::]:3478', 'turns:host:5349?transport=udp']) {
    malformed.push({ iceServers: [{ urls, username: 'u', credential: 'p' }] });
  }
  for (const credentials of [{}, { username: 'u' }, { username: 'u', credential: '' },
    { username: ' ', credential: 'p' }, { username: 'u', credential: {} },
    { username: 'u', credential: 'p', credentialType: 'oauth' }]) {
    malformed.push({ iceServers: [{ urls: 'turn:host:3478', ...credentials }] });
  }
  for (const payload of malformed) {
    error(await fixture({ fetch: async () => ({ ok: true, json: async () => payload }) }).request(), 502, 'relay-provider-failed');
  }
});

test('valid IPv6 relay, string URLs and default ports survive sanitization', async () => {
  const payload = { iceServers: [{ urls: 'turn:[2001:db8::1]:3478?transport=tcp', username: 'u', credential: 'p' },
    { urls: 'turns:relay.example.com', username: 'u', credential: 'p' }] };
  const res = await fixture({ fetch: async () => ({ ok: true, json: async () => payload }) }).request();
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.iceServers.length, 2);
});

test('CORS exact default/custom allowlist; no wildcard, lookalikes, local or null by default', async () => {
  for (const origin of [ORIGIN, 'https://planner-project-7ab9e.firebaseapp.com', 'https://custom.example']) {
    const res = await fixture({}, { allowedOrigins: ['https://custom.example'] }).request({ headers: { origin } });
    assert.equal(res.statusCode, 200);
    assert.equal(res.headers['access-control-allow-origin'], origin);
  }
  for (const origin of ['null', '*', 'https://evil.example', `${ORIGIN}.evil.example`, `${ORIGIN}/`,
    'http://planner-project-7ab9e.web.app', 'http://localhost:5000', 'https://localhost:5000',
    'http://127.0.0.1:5000', 'http://[::1]:5000']) {
    const f = fixture({}, { allowedOrigins: ['http://localhost:5000', 'https://localhost:5000'] });
    const res = await f.request({ headers: { origin } });
    error(res, 403, 'origin-not-allowed');
    assert.equal(res.headers['access-control-allow-origin'], undefined);
    assert.equal(f.calls.auth.length, 0);
  }
});

test('emulator-local and explicit null opt-in remain authenticated; no-origin clients also require auth', async () => {
  for (const [origin, options] of [
    ['http://localhost:5000', { emulator: true }], ['http://127.0.0.1:5000', { emulator: true }],
    ['http://[::1]:5000', { emulator: true }], ['null', { allowNullOrigin: true }], [undefined, {}]
  ]) {
    const f = fixture({}, options);
    assert.equal((await f.request({ headers: { origin } })).statusCode, 200);
    error(await f.request({ headers: { origin, authorization: undefined } }), 401, 'unauthorized');
  }
  error(await fixture({}, { emulator: true }).request({ headers: { origin: 'http://localhost.evil.example:5000' } }), 403, 'origin-not-allowed');
});

test('preflight is credential-free and methods other than POST are rejected', async () => {
  const f = fixture();
  const res = await f.request({ method: 'OPTIONS', headers: { authorization: undefined } });
  assert.equal(res.statusCode, 204);
  assert.equal(res.headers['access-control-allow-methods'], 'POST');
  assert.equal(res.headers['access-control-allow-headers'], 'Authorization, Content-Type');
  assert.equal(f.calls.auth.length, 0);
  assert.equal(f.calls.provider.length, 0);
  error(await f.request({ method: 'GET' }), 405, 'method-not-allowed');
  error(await f.request({ method: 'OPTIONS', headers: { origin: 'https://evil.example' } }), 403, 'origin-not-allowed');
});

function mockFirestore() {
  const documents = new Map();
  let queue = Promise.resolve();
  let transactions = 0;
  const db = {
    collection(name) { return { doc(id) { return `${name}/${id}`; } }; },
    runTransaction(callback) {
      transactions++;
      // Serialize like committed Firestore transactions; separate limiter instances share state.
      const work = queue.then(() => callback({
        async get(ref) { return { exists: documents.has(ref), data: () => documents.get(ref) }; },
        set(ref, data) { documents.set(ref, structuredClone(data)); }
      }));
      queue = work.catch(() => {});
      return work;
    }
  };
  return { db, documents, transactions: () => transactions };
}

test('persistent transactional sliding window: 20/10min per UID across handler instances', async () => {
  const mock = mockFirestore();
  let time = TIME;
  const a = createFirestoreRateLimiter({ db: mock.db, now: () => time });
  const b = createFirestoreRateLimiter({ db: mock.db, now: () => time });
  const results = await Promise.all(Array.from({ length: 25 }, (_, i) => (i % 2 ? a : b)('uid/with/slash')));
  assert.equal(results.filter((r) => r.allowed).length, 20);
  assert.equal(results[24].retryAfterSeconds, 600);
  assert.equal((await a('different-user')).allowed, true);
  assert.equal(mock.transactions(), 26);
  assert.equal(mock.documents.size, 2);
  for (const [path, data] of mock.documents) {
    assert.match(path, new RegExp(`^${RATE_LIMIT_COLLECTION}/[a-f0-9]{64}$`));
    assert.deepEqual(Object.keys(data), ['requests']);
    assert.ok(data.requests.every((stamp) => stamp === TIME));
  }
  time += WINDOW_MS - 1;
  assert.deepEqual(await b('uid/with/slash'), { allowed: false, retryAfterSeconds: 1 });
  time++;
  assert.equal((await b('uid/with/slash')).allowed, true);
  assert.equal([...mock.documents.values()][0].requests.length, 1);
});

test('persistent limiter fails closed on malformed stored state', async () => {
  const mock = mockFirestore();
  const limit = createFirestoreRateLimiter({ db: mock.db, now: () => TIME });
  await limit('host');
  const path = [...mock.documents.keys()][0];
  mock.documents.set(path, { requests: ['invalid'] });
  await assert.rejects(limit('host'), /Invalid rate limit state/);
});

test('Firebase adapter binds secrets lazily, verifies revocation, and configures Node 22/v2 safely', async () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const vm = require('node:vm');
  let options;
  let dependencies;
  const secrets = [];
  const verified = [];
  let reads = 0;
  const db = {
    collection(name) {
      assert.equal(name, 'rooms');
      return { doc(code) {
        assert.equal(code, ROOM);
        return { get: async () => ({ exists: true, data: () => ({ hostUid: 'host' }) }) };
      } };
    }
  };
  const modules = {
    'firebase-functions/v2/https': { onRequest(config, handler) { options = config; return handler; } },
    'firebase-functions/params': { defineSecret(name) {
      const secret = { name, value() { reads++; return name === 'TURN_KEY_ID' ? KEY : TOKEN; } };
      secrets.push(secret);
      return secret;
    } },
    'firebase-admin/app': { initializeApp() {} },
    'firebase-admin/auth': { getAuth: () => ({ verifyIdToken: async (...args) => { verified.push(args); return { uid: 'host' }; } }) },
    'firebase-admin/firestore': { getFirestore: () => db },
    'firebase-functions/v2/scheduler': { onSchedule: (_options, handler) => handler },
    './admin-handler': { createAdminHandler: () => () => {} },
    './admin-service': { createAdminService: () => ({}) },
    './activity-handler': { createActivityHandler: () => () => {} },
    './activity-service': { createActivityService: () => ({}) },
    './turn-handler': { createTurnHandler(injected) { dependencies = injected; return () => {}; } },
    './rate-limit': { createFirestoreRateLimiter({ db: actual }) { assert.equal(actual, db); return async () => ({ allowed: true }); } }
  };
  const context = {
    exports: {},
    require(name) { assert.ok(Object.hasOwn(modules, name)); return modules[name]; },
    process: { env: { TURN_ALLOWED_ORIGINS: 'https://custom.example, https://other.example', TURN_ALLOW_NULL_ORIGIN: 'true', FUNCTIONS_EMULATOR: 'true' } }
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../functions/index.js'), 'utf8'), context);
  assert.equal(typeof context.exports.rtcIceServers, 'function');
  assert.equal(reads, 0, 'Secret values must not be read at deployment discovery time');
  assert.deepEqual(secrets.map((s) => s.name), ['TURN_KEY_ID', 'TURN_API_TOKEN', 'PRIVATE_ADMIN_CODE']);
  assert.equal(options.secrets[0], secrets[0]);
  assert.equal(options.secrets[1], secrets[1]);
  assert.equal(options.region, 'us-central1');
  assert.equal(options.maxInstances, 3);
  assert.equal(options.memory, '256MiB');
  assert.equal(options.timeoutSeconds, 30);
  assert.equal(options.cors, false);
  assert.equal(options.invoker, 'public');
  await dependencies.verifyIdToken('fake-id-token');
  assert.deepEqual(verified, [['fake-id-token', true]]);
  assert.equal((await dependencies.getRoom(ROOM)).hostUid, 'host');
  assert.equal(dependencies.getSecrets().keyId, KEY);
  assert.equal(reads, 2);
  assert.deepEqual(Array.from(dependencies.allowedOrigins), ['https://custom.example', 'https://other.example']);
  assert.equal(dependencies.allowNullOrigin, true);
  assert.equal(dependencies.emulator, true);
  const pkg = require('../functions/package.json');
  assert.equal(pkg.engines.node, '22');
  assert.match(pkg.dependencies['firebase-functions'], /^\^6\./);
  assert.match(pkg.dependencies['firebase-admin'], /^\^13\./);
});