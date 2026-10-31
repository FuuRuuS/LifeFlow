'use strict';

// Offline and dependency-free: node --test tools/test-activity-server.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createActivityService, ActivityError, ACTIONS, MODULES, normalizeIp, hash,
  RETENTION_MS, WINDOW_MS, MAX_EVENTS, BATCH_SIZE } = require('../functions/activity-service');
const { createActivityHandler, deviceFromUserAgent, DEFAULT_ORIGINS } = require('../functions/activity-handler');

const TIME = 1800000000000;
const UID = 'verified-user';
const PROFILE = `users/${UID}`;
const SUMMARY = `accountAudit/${UID}`;
const RATE = `_activityRateLimits/${hash(UID)}`;
const EDGE_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0';
const INPUT = Object.freeze({ uid: UID, action: 'page_view', module: 'dashboard',
  ip: '203.0.113.8', device: 'Edge · Windows' });
const clone = (value) => value === undefined ? undefined : structuredClone(value);

/** Admin-shaped fake: atomic serialized transactions, retry/abort injection,
 * create collision detection, top-level mergeFields, and Timestamp-type queries.
 * This is not a replacement for deployed Firestore/rules/proxy integration tests.
 */
function fakeDb() {
  const records = new Map(), reads = [], writes = [], queries = [], batchSizes = [];
  let queue = Promise.resolve(), sequence = 0;
  const snapshot = (ref) => {
    const data = clone(records.get(ref.path));
    return { ref, id: ref.id, exists: records.has(ref.path), data: () => clone(data) };
  };
  const document = (path) => ({ path, id: path.split('/').pop(),
    collection: (name) => collection(`${path}/${name}`) });
  function collection(path, group = false, filters = [], maximum) {
    return {
      doc(id = `auto-${++sequence}`) { return document(`${path}/${id}`); },
      where(field, operator, value) { return collection(path, group, [...filters, [field, operator, value]], maximum); },
      limit(value) { return collection(path, group, filters, value); },
      async get() {
        assert.ok(maximum > 0 && maximum <= 500, 'All retention queries must be bounded');
        queries.push({ path, group, filters, maximum });
        let docs = [...records.keys()].filter((key) => {
          const parts = key.split('/');
          return group ? parts[parts.length - 2] === path
            : key.startsWith(path + '/') && parts.length === path.split('/').length + 1;
        }).map((key) => snapshot(document(key)));
        for (const [field, operator, value] of filters) {
          assert.equal(operator, '<=');
          assert.ok(value instanceof Date, 'Expiry query must use a Timestamp-compatible Date');
          // Firestore inequalities use type matching; null is NOT an expired Timestamp.
          docs = docs.filter((doc) => doc.data()[field] instanceof Date && doc.data()[field] <= value);
        }
        return { docs: docs.slice(0, maximum) };
      }
    };
  }
  function commit(staged) {
    const next = new Map(records);
    for (const { kind, ref, value, options } of staged) {
      if (kind === 'delete') next.delete(ref.path);
      else {
        if (kind === 'create') assert.equal(next.has(ref.path), false, 'Append must not overwrite an event');
        if (options?.mergeFields) {
          const data = clone(next.get(ref.path) || {});
          for (const key of options.mergeFields) {
            assert.ok(!key.includes('.'), 'No user-supplied field paths');
            data[key] = clone(value[key]);
          }
          next.set(ref.path, data);
        } else next.set(ref.path, clone(value));
      }
    }
    records.clear();
    for (const [path, data] of next) records.set(path, data);
    writes.push(...staged.map(({ kind, ref }) => [kind, ref.path]));
  }
  const db = {
    records, reads, writes, queries, batchSizes, collection,
    collectionGroup: (name) => collection(name, true),
    beforeTransaction: null, retryOnce: null, abortOnce: false,
    batch() {
      const staged = [];
      return {
        delete(ref) { staged.push({ kind: 'delete', ref }); },
        async commit() {
          assert.ok(staged.length <= 500);
          batchSizes.push(staged.length);
          commit(staged);
        }
      };
    },
    runTransaction(callback) {
      const result = queue.then(async () => {
        if (db.beforeTransaction) {
          const hook = db.beforeTransaction;
          db.beforeTransaction = null;
          await hook();
        }
        for (;;) {
          const staged = [];
          const result = await callback({
            async get(ref) {
              assert.equal(staged.length, 0, 'Firestore reads must precede writes');
              reads.push(ref.path);
              return snapshot(ref);
            },
            create(ref, value) { staged.push({ kind: 'create', ref, value: clone(value) }); },
            set(ref, value, options) { staged.push({ kind: 'set', ref, value: clone(value), options }); }
          });
          if (db.retryOnce) {
            const hook = db.retryOnce;
            db.retryOnce = null;
            await hook();
            continue; // Discard the first attempt, like a Firestore contention retry.
          }
          if (db.abortOnce) {
            db.abortOnce = false;
            throw new Error('PRIVATE_SDK_TRANSACTION_DETAILS');
          }
          assert.ok(staged.length <= 500);
          commit(staged);
          return result;
        }
      });
      queue = result.catch(() => {});
      return result;
    }
  };
  return db;
}

function setup(options = {}) {
  const db = fakeDb();
  let time = TIME;
  const now = () => time;
  const authCalls = [];
  const auth = { async verifyIdToken(token, checkRevoked) {
    authCalls.push([token, checkRevoked]);
    return { uid: UID, email: 'PRIVATE_EMAIL', customClaims: 'PRIVATE_CLAIMS' };
  } };
  const service = createActivityService({ db, now });
  const handler = createActivityHandler({ auth, service, ...options });
  async function request(body = { action: 'page_view', module: 'dashboard' }, overrides = {}) {
    const req = { method: 'POST', path: '/api/activity', secure: true, ip: INPUT.ip, body,
      ...overrides,
      headers: { origin: DEFAULT_ORIGINS[0], 'content-type': 'application/json',
        authorization: 'Bearer signed.id.token', 'user-agent': EDGE_UA, ...overrides.headers } };
    const res = { statusCode: 200, headers: {}, body: undefined,
      setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
      status(code) { this.statusCode = code; return this; },
      json(value) { this.body = JSON.parse(JSON.stringify(value)); return this; },
      end() { return this; }
    };
    await handler(req, res);
    assert.equal(res.headers['cache-control'], 'no-store');
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
    assert.equal(res.headers['vary'], 'Origin');
    assert.equal(res.headers['access-control-allow-credentials'], undefined);
    if (res.statusCode >= 400) {
      assert.deepEqual(Object.keys(res.body), ['error']);
      assert.deepEqual(Object.keys(res.body.error).sort(), ['code', 'message']);
      assert.ok(!JSON.stringify(res.body).includes('PRIVATE_'));
    }
    return res;
  }
  return { db, service, auth, authCalls, request,
    consent: (value = true) => db.records.set(PROFILE, { prefs: { activitySharing: value } }),
    advance: (ms) => { time += ms; } };
}
const events = (db) => [...db.records].filter(([path]) => path.startsWith(`${SUMMARY}/activityEvents/`));

test('missing profile/prefs, false and truthy non-booleans are opt-out with absolutely no writes', async () => {
  for (const profile of [undefined, {}, { prefs: {} }, { prefs: null },
    ...[false, 'true', 1, {}, [], null].map((activitySharing) => ({ prefs: { activitySharing } }))]) {
    const f = setup();
    if (profile !== undefined) f.db.records.set(PROFILE, profile);
    assert.deepEqual(await f.service.record(INPUT), { recorded: false, reason: 'consent-required' });
    assert.deepEqual(f.db.writes, []);
    assert.deepEqual(f.db.reads.sort(), [PROFILE, SUMMARY, RATE].sort());
    assert.equal(f.db.records.has(SUMMARY), false);
    assert.equal(f.db.records.has(RATE), false);
  }
});

test('consent is rechecked after a transaction retry, discarding all staged metadata and rates', async () => {
  const f = setup();
  f.consent();
  f.db.retryOnce = () => f.consent(false);
  assert.deepEqual(await f.service.record(INPUT), { recorded: false, reason: 'consent-required' });
  assert.deepEqual(f.db.writes, []);
  assert.equal(f.db.reads.filter((path) => path === PROFILE).length, 2);
  assert.equal(f.db.records.size, 1);
});

test('authorized opt-in POST verifies revocation and records only fixed metadata and runtime IP', async () => {
  const f = setup();
  f.consent();
  const response = await f.request(undefined, { headers: {
    'x-forwarded-for': '192.0.2.99, PRIVATE_FORGED_IP', 'x-real-ip': '192.0.2.99'
  } });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { recorded: true });
  assert.deepEqual(f.authCalls, [['signed.id.token', true]]);
  const [[path, event]] = events(f.db);
  assert.match(path, /^accountAudit\/verified-user\/activityEvents\/auto-/);
  assert.deepEqual(event, { at: TIME, action: 'page_view', module: 'dashboard',
    ip: INPUT.ip, device: 'Edge · Windows', expireAt: new Date(TIME + RETENTION_MS) });
  assert.deepEqual(f.db.records.get(SUMMARY), {
    firstObservedAt: TIME, lastObservedAt: TIME, totalEvents: 1,
    byAction: { page_view: 1 }, byModule: { dashboard: 1 },
    lastIp: INPUT.ip, lastDevice: 'Edge · Windows', privateUntil: new Date(TIME + RETENTION_MS)
  });
  assert.deepEqual(f.db.records.get(RATE), { requests: [TIME], count: 1,
    windowStartedAt: new Date(TIME), expireAt: new Date(TIME + WINDOW_MS) });
  const persisted = JSON.stringify([...f.db.records]);
  for (const sensitive of ['PRIVATE_', EDGE_UA, 'signed.id.token', '192.0.2.99']) assert.ok(!persisted.includes(sensitive));
});

test('authenticated opt-out returns recorded:false and stores neither IP nor metadata', async () => {
  const f = setup();
  const response = await f.request();
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { recorded: false, reason: 'consent-required' });
  assert.deepEqual(f.authCalls, [['signed.id.token', true]]);
  assert.equal(f.db.records.size, 0);
});

test('all extra body keys including UID/IP/time spoofing are rejected before auth or storage', async () => {
  const f = setup();
  f.consent();
  for (const key of ['uid', 'ip', 'at', 'time', 'timestamp', 'device', 'userAgent', 'url', 'documentId',
    'content', 'email', 'credentials', 'token', 'prefs', 'constructor', '__proto__']) {
    const response = await f.request({ action: 'create', module: 'tasks', [key]: 'PRIVATE_VALUE' });
    assert.equal(response.statusCode, 400, key);
  }
  assert.deepEqual(f.authCalls, []);
  assert.deepEqual(f.db.writes, []);
});

test('payload must be an exact JSON object with whitelisted action/module strings', async () => {
  const f = setup();
  for (const body of [null, [], 'text', 123, {}, { action: 'create' }, { module: 'tasks' },
    { action: 'CREATE', module: 'tasks' }, { action: 'create', module: 'https://private.invalid' },
    { action: 'create', module: 'tasks/id' }, { action: 'create', module: '__proto__' },
    { action: 'constructor', module: 'tasks' }, { action: ['create'], module: 'tasks' },
    { action: 'create', module: { name: 'tasks' } }, Object.create({ action: 'create', module: 'tasks' })]) {
    assert.equal((await f.request(body)).statusCode, 400);
  }
  for (const type of [undefined, 'text/plain', 'application/jsonp', ['application/json']]) {
    assert.equal((await f.request(undefined, { headers: { 'content-type': type } })).statusCode, 400);
  }
  assert.deepEqual(f.authCalls, []);
  assert.deepEqual(f.db.writes, []);
});

test('every specified action/module is accepted, including events without calendar writes', async () => {
  const f = setup();
  f.consent();
  assert.equal(ACTIONS.length, 10);
  assert.equal(MODULES.length, 19);
  for (const action of ACTIONS) assert.equal((await f.request({ action, module: 'app' })).statusCode, 200);
  for (const module of MODULES) assert.equal((await f.request({ action: 'page_view', module })).statusCode, 200);
  assert.equal(events(f.db).length, ACTIONS.length + MODULES.length);
  assert.ok(f.db.writes.every(([, path]) => !path.startsWith('users/')));
});

test('missing/malformed bearer, revoked tokens, disabled users, invalid claims all fail closed', async () => {
  const f = setup();
  for (const authorization of [undefined, '', 'Basic abc', 'Bearer ', 'Bearer a b',
    'Bearer token\n', 'Bearer ' + 'a'.repeat(8192), ['Bearer token']]) {
    assert.equal((await f.request(undefined, { headers: { authorization } })).statusCode, 401);
  }
  assert.deepEqual(f.authCalls, []);
  for (const code of ['auth/id-token-revoked', 'auth/user-disabled', 'auth/id-token-expired', 'auth/internal-error']) {
    f.auth.verifyIdToken = async (_, revoked) => {
      assert.equal(revoked, true);
      throw Object.assign(new Error('PRIVATE_SDK_MESSAGE'), { code });
    };
    assert.equal((await f.request()).statusCode, 401);
  }
  for (const uid of [undefined, '', '.', '..', '__bad__', 'x/y', 'x\n', 'x'.repeat(129)]) {
    f.auth.verifyIdToken = async () => ({ uid });
    assert.equal((await f.request()).statusCode, 401);
  }
  assert.deepEqual(f.db.reads, []);
  assert.deepEqual(f.db.writes, []);
});

test('exact HTTPS origins only; null and local origins need distinct explicit opt-ins', async () => {
  const extras = ['https://extra.example.invalid', 'http://remote.example.invalid',
    'http://localhost:5000', 'https://dev.localhost', 'https://127.0.0.2', 'http://[::1]:5000', 'null'];
  const f = setup({ allowedOrigins: extras });
  for (const origin of [undefined, '', 'null', DEFAULT_ORIGINS[0] + '/', DEFAULT_ORIGINS[0] + '.evil.invalid',
    'https://user:pass@planner-project-7ab9e.web.app', 'https://PLANNER-PROJECT-7AB9E.web.app',
    'https://evil.invalid', ...extras.slice(1)]) {
    const response = await f.request(undefined, { headers: { origin } });
    assert.equal(response.statusCode, 403, String(origin));
    assert.equal(response.headers['access-control-allow-origin'], undefined);
  }
  for (const origin of [...DEFAULT_ORIGINS, extras[0]]) {
    const response = await f.request(undefined, { headers: { origin } });
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers['access-control-allow-origin'], origin);
  }
  const desktop = setup({ allowNullOrigin: true });
  assert.equal((await desktop.request(undefined, { headers: { origin: 'null' } })).statusCode, 200);
  assert.equal((await desktop.request(undefined, { headers: { origin: undefined } })).statusCode, 403);
  assert.equal((await desktop.request(undefined, { secure: false, headers: { origin: 'null' } })).statusCode, 403);
  const local = setup({ emulator: true, allowedOrigins: extras });
  for (const origin of extras.slice(2, -1)) {
    assert.equal((await local.request(undefined, { secure: false, headers: { origin } })).statusCode, 200);
  }
  assert.equal((await local.request(undefined, { headers: { origin: 'http://localhost:9999' } })).statusCode, 403);
  assert.equal((await local.request(undefined, { headers: { origin: 'null' } })).statusCode, 403);
});

test('trusted req.secure is mandatory in production; forwarded protocol is never trusted', async () => {
  for (const secure of [false, undefined, 'true', 1]) {
    const f = setup();
    assert.equal((await f.request(undefined, { secure, headers: { 'x-forwarded-proto': 'https' } })).statusCode, 403);
    assert.deepEqual(f.authCalls, []);
  }
});

test('OPTIONS exposes only fixed POST Authorization/Content-Type without auth, storage, or header reflection', async () => {
  const f = setup();
  const response = await f.request(undefined, { method: 'OPTIONS', headers: {
    authorization: undefined, 'access-control-request-method': 'POST',
    'access-control-request-headers': 'content-type, authorization'
  } });
  assert.equal(response.statusCode, 204);
  assert.equal(response.headers['access-control-allow-methods'], 'POST');
  assert.equal(response.headers['access-control-allow-headers'], 'Authorization, Content-Type');
  for (const headers of [{ 'access-control-request-method': 'DELETE' },
    { 'access-control-request-headers': 'Authorization, X-PRIVATE-HEADER' }]) {
    assert.equal((await f.request(undefined, { method: 'OPTIONS', headers })).statusCode, 400);
  }
  assert.equal((await f.request(undefined, { method: 'OPTIONS', secure: false })).statusCode, 403);
  assert.equal((await f.request(undefined, { method: 'GET' })).statusCode, 405);
  assert.equal((await f.request(undefined, { path: '/api/activity/other' })).statusCode, 404);
  assert.deepEqual(f.authCalls, []);
  assert.deepEqual(f.db.reads, []);
});

test('UA parser emits only coarse labels with no raw UA, versions, models or fingerprinting', () => {
  const pairs = [
    [EDGE_UA, 'Edge · Windows'],
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18.0 Mobile/15 Safari/604.1', 'Safari · iOS'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) Version/17.0 Safari/605.1', 'Safari · macOS'],
    ['Mozilla/5.0 (Linux; Android 14; PRIVATE_MODEL) Chrome/130.0 Safari/537.36', 'Chrome · Android'],
    ['Mozilla/5.0 (X11; Linux x86_64) Firefox/130.0', 'Firefox · Linux'],
    ['Mozilla/5.0 (X11; CrOS x86_64) Chrome/130.0', 'Chrome · Chrome OS'],
    ['iPad Mac OS X CriOS/100.0 Safari/605.1', 'Chrome · iOS'],
    ['iPhone FxiOS/100.0 Safari/605.1', 'Firefox · iOS'],
    ['Android Chrome/100.0 EdgA/100.0', 'Edge · Android'],
    ['iPhone EdgiOS/100.0 Safari/605.1', 'Edge · iOS'],
    ['Android Chrome/100.0 SamsungBrowser/25.0', 'Samsung Internet · Android'],
    ['Windows NT Chrome/100.0 OPR/100.0', 'Opera · Windows']
  ];
  for (const [ua, label] of pairs) assert.equal(deviceFromUserAgent(ua), label);
  for (const ua of [null, undefined, {}, 'PRIVATE_UNKNOWN', 'x'.repeat(2049)]) {
    assert.equal(deviceFromUserAgent(ua), 'Other · Other');
  }
});

test('IP uses node:net validation/canonicalization only; invalid runtime IP never falls back to XFF', async () => {
  assert.equal(normalizeIp('2001:0db8:0000:0000:0000:0000:0000:0001'), '2001:db8::1');
  assert.equal(normalizeIp('::ffff:192.0.2.1'), '::ffff:c000:201');
  assert.equal(normalizeIp('192.0.2.1'), '192.0.2.1');
  for (const ip of [undefined, '', '1.2.3.4:80', '1.2.3.4, 5.6.7.8', 'fe80::1%eth0',
    'https://private.invalid', '999.1.1.1', {}, 'PRIVATE_CONTENT']) {
    assert.equal(normalizeIp(ip), null);
  }
  const f = setup();
  f.consent();
  await f.request(undefined, { ip: undefined, headers: { 'x-forwarded-for': '192.0.2.99' } });
  assert.equal(events(f.db)[0][1].ip, null);
  assert.equal(f.db.records.get(SUMMARY).lastIp, null);
});

test('service also validates UID, metadata and coarse device allowlist', async () => {
  const f = setup();
  f.consent();
  for (const input of [{ ...INPUT, uid: '../victim' }, { ...INPUT, action: '__proto__' },
    { ...INPUT, module: 'tasks/private-id' }, { ...INPUT, device: EDGE_UA },
    { ...INPUT, device: 'PRIVATE_DEVICE' }, {}]) {
    await assert.rejects(f.service.record(input), { code: 'invalid-request' });
  }
  assert.deepEqual(f.db.reads, []);
  assert.deepEqual(f.db.writes, []);
});

test('safe error boundary never leaks SDK messages, forged error codes, or arbitrary adapter output', async () => {
  for (const error of [new Error('PRIVATE_SDK_ERROR'), { code: 'rate-limited', message: 'PRIVATE_ERROR' },
    new ActivityError('PRIVATE_UNKNOWN_CODE')]) {
    const f = setup({ service: { record: async () => { throw error; } } });
    const response = await f.request();
    assert.equal(response.statusCode, 503);
    assert.equal(response.body.error.code, 'service-unavailable');
  }
  const success = setup({ service: { record: async () => ({ recorded: true, ip: 'PRIVATE_IP', token: 'PRIVATE_TOKEN' }) } });
  assert.deepEqual((await success.request()).body, { recorded: true });
  const malformed = setup({ service: { record: async () => ({ arbitrary: 'PRIVATE_VALUE' }) } });
  assert.equal((await malformed.request()).statusCode, 503);
});

test('120 events per UID in a rolling five-minute window; 121st produces typed 429 without writes', async () => {
  const f = setup();
  f.consent();
  for (let i = 0; i < MAX_EVENTS; i++) await f.service.record(INPUT);
  const before = f.db.writes.length;
  const response = await f.request();
  assert.equal(response.statusCode, 429);
  assert.equal(response.body.error.code, 'rate-limited');
  assert.equal(response.headers['retry-after'], '300');
  assert.equal(f.db.writes.length, before);
  f.advance(WINDOW_MS - 1);
  await assert.rejects(f.service.record(INPUT), (error) =>
    error instanceof ActivityError && error.code === 'rate-limited' && error.retryAfterSeconds === 1);
  f.advance(1);
  assert.deepEqual(await f.service.record(INPUT), { recorded: true });
  assert.equal(f.db.records.get(RATE).count, 1);
  assert.equal(events(f.db).length, 121);
});

test('rate limit cannot reset at a fixed-window boundary and consent denial does not consume quota', async () => {
  const f = setup();
  f.consent();
  for (let i = 0; i < 60; i++) await f.service.record(INPUT);
  f.advance(WINDOW_MS - 1000);
  for (let i = 0; i < 60; i++) await f.service.record(INPUT);
  f.advance(1000);
  for (let i = 0; i < 60; i++) await f.service.record(INPUT);
  await assert.rejects(f.service.record(INPUT), { code: 'rate-limited' });
  const rate = clone(f.db.records.get(RATE));
  f.consent(false);
  assert.deepEqual(await f.service.record(INPUT), { recorded: false, reason: 'consent-required' });
  assert.deepEqual(f.db.records.get(RATE), rate);
  f.db.records.set('users/second-user', { prefs: { activitySharing: true } });
  assert.deepEqual(await f.service.record({ ...INPUT, uid: 'second-user' }), { recorded: true });
});

test('concurrent requests have atomic counters and cannot overshoot the limit', async () => {
  const f = setup();
  f.consent();
  const results = await Promise.allSettled(Array.from({ length: 140 }, (_, i) =>
    f.service.record({ ...INPUT, action: i % 2 ? 'create' : 'update', module: i % 2 ? 'tasks' : 'notes' })));
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 120);
  assert.ok(results.filter((r) => r.status === 'rejected').every((r) => r.reason.code === 'rate-limited'));
  const summary = f.db.records.get(SUMMARY);
  assert.equal(summary.totalEvents, 120);
  assert.deepEqual(summary.byAction, { update: 60, create: 60 });
  assert.deepEqual(summary.byModule, { notes: 60, tasks: 60 });
  assert.equal(f.db.records.get(RATE).count, 120);
  assert.equal(events(f.db).length, 120);
});

test('transaction failure rolls back events/summary/rate; retry commits each event exactly once', async () => {
  const f = setup();
  f.consent();
  f.db.abortOnce = true;
  await assert.rejects(f.service.record(INPUT), { code: 'service-unavailable', message: 'service-unavailable' });
  assert.deepEqual(f.db.writes, []);
  f.db.retryOnce = () => {};
  await f.service.record(INPUT);
  assert.equal(events(f.db).length, 1);
  assert.equal(f.db.records.get(SUMMARY).totalEvents, 1);
  assert.equal(f.db.records.get(RATE).count, 1);
});

test('summary counters saturate safely and replace arbitrary nested keys rather than merging them', async () => {
  const f = setup();
  f.consent();
  f.db.records.set(SUMMARY, {
    firstObservedAt: TIME - 100, totalEvents: Number.MAX_SAFE_INTEGER,
    byAction: JSON.parse('{"__proto__":900,"constructor":100,"page_view":-1,"create":1.9,"update":1e100}'),
    byModule: { 'tasks/private-id': 20, dashboard: Infinity, notes: NaN }, unrelated: 'preserved'
  });
  await f.service.record(INPUT);
  const summary = f.db.records.get(SUMMARY);
  assert.equal(summary.firstObservedAt, TIME - 100);
  assert.equal(summary.totalEvents, Number.MAX_SAFE_INTEGER);
  assert.deepEqual(summary.byAction, { page_view: 1, create: 1, update: Number.MAX_SAFE_INTEGER });
  assert.deepEqual(summary.byModule, { dashboard: 1, notes: 0 });
  assert.equal(summary.unrelated, 'preserved');
  f.advance(100);
  await f.service.record(INPUT);
  assert.equal(f.db.records.get(SUMMARY).firstObservedAt, TIME - 100);
  assert.equal(f.db.records.get(SUMMARY).lastObservedAt, TIME + 100);
  assert.equal(f.db.records.get(SUMMARY).privateUntil.getTime(), TIME + 100 + RETENTION_MS);
});

test('corrupt/future rate state fails closed without activity writes', async () => {
  for (const requests of [undefined, null, {}, [TIME + 1], [-1], ['PRIVATE_TIME'], Array(121).fill(TIME)]) {
    const f = setup();
    f.consent();
    f.db.records.set(RATE, { requests });
    await assert.rejects(f.service.record(INPUT), { code: 'service-unavailable' });
    assert.deepEqual(f.db.writes, []);
  }
});

test('retention deletes only exact accountAudit/{uid}/activityEvents/{id} paths', async () => {
  const f = setup();
  const expired = { expireAt: new Date(TIME), at: TIME - RETENTION_MS };
  const protectedPaths = [
    `users/${UID}/events/calendar-event`, `users/${UID}/activityEvents/unrelated`,
    `accountAudit/${UID}/events/legacy`, `other/${UID}/activityEvents/unrelated`,
    `accountAudit/${UID}/nested/x/activityEvents/deep`,
    `accountAudit/${UID}/activityEvents/event/children/x`,
    `accountAudit/../activityEvents/bad-uid`,
    `${SUMMARY}/activityEvents/fresh`, `${SUMMARY}/activityEvents/missing-expiry`
  ];
  for (const path of protectedPaths) f.db.records.set(path, expired);
  f.db.records.set(`${SUMMARY}/activityEvents/fresh`, { expireAt: new Date(TIME + 1) });
  f.db.records.set(`${SUMMARY}/activityEvents/missing-expiry`, { at: 0 });
  f.db.records.set(`${SUMMARY}/activityEvents/expired`, expired);
  f.db.records.set('accountAudit/second-user/activityEvents/expired', expired);
  assert.deepEqual(await f.service.purgeExpired(), { deletedEvents: 2, scrubbedSummaries: 0 });
  for (const path of protectedPaths) assert.ok(f.db.records.has(path), path);
  assert.deepEqual(f.db.batchSizes, [2]);
  assert.ok(f.db.queries.every((q) => q.maximum === 500));
  assert.equal(f.db.queries[0].path, 'activityEvents');
  assert.equal(f.db.queries[0].group, true);
});

test('retention scrubs IP/device/marker only, preserves counters, and never repeatedly returns scrubbed summaries', async () => {
  const f = setup();
  const summary = { firstObservedAt: TIME - RETENTION_MS - 100, lastObservedAt: TIME - RETENTION_MS,
    totalEvents: 25, byAction: { page_view: 25 }, byModule: { app: 25 },
    lastIp: INPUT.ip, lastDevice: INPUT.device, privateUntil: new Date(TIME) };
  f.db.records.set(SUMMARY, summary);
  assert.deepEqual(await f.service.purgeExpired(), { deletedEvents: 0, scrubbedSummaries: 1 });
  assert.deepEqual(f.db.records.get(SUMMARY), { ...summary, lastIp: null, lastDevice: null, privateUntil: null });
  const writes = f.db.writes.length;
  assert.deepEqual(await f.service.purgeExpired(), { deletedEvents: 0, scrubbedSummaries: 0 });
  assert.equal(f.db.writes.length, writes);
});

test('retention rechecks summary expiration atomically and does not scrub a concurrently refreshed IP', async () => {
  const f = setup();
  f.db.records.set(SUMMARY, { lastObservedAt: TIME - RETENTION_MS, privateUntil: new Date(TIME), lastIp: '192.0.2.1' });
  f.db.beforeTransaction = () => f.db.records.set(SUMMARY, {
    lastObservedAt: TIME, privateUntil: new Date(TIME + RETENTION_MS), lastIp: INPUT.ip, totalEvents: 2
  });
  assert.deepEqual(await f.service.purgeExpired(), { deletedEvents: 0, scrubbedSummaries: 0 });
  assert.equal(f.db.records.get(SUMMARY).lastIp, INPUT.ip);
  assert.deepEqual(f.db.writes, []);
});

test('retention requires lastObservedAt to be stale as well as privateUntil', async () => {
  const f = setup();
  f.db.records.set(SUMMARY, { lastObservedAt: TIME, privateUntil: new Date(TIME), lastIp: INPUT.ip });
  assert.deepEqual(await f.service.purgeExpired(), { deletedEvents: 0, scrubbedSummaries: 0 });
  assert.equal(f.db.records.get(SUMMARY).lastIp, INPUT.ip);
});

test('retention is bounded to 500 events and 500 summaries per call, then makes forward progress', async () => {
  const f = setup();
  for (let i = 0; i <= BATCH_SIZE; i++) {
    f.db.records.set(`accountAudit/user-${i}/activityEvents/expired`, { expireAt: new Date(TIME) });
    f.db.records.set(`accountAudit/user-${i}`, { lastObservedAt: TIME - RETENTION_MS,
      privateUntil: new Date(TIME), lastIp: INPUT.ip, lastDevice: INPUT.device, totalEvents: 7 });
  }
  assert.deepEqual(await f.service.purgeExpired(), { deletedEvents: 500, scrubbedSummaries: 500 });
  assert.deepEqual(await f.service.purgeExpired(), { deletedEvents: 1, scrubbedSummaries: 1 });
  assert.deepEqual(await f.service.purgeExpired(), { deletedEvents: 0, scrubbedSummaries: 0 });
  assert.deepEqual(f.db.batchSizes, [500, 1]);
  assert.ok([...f.db.records.values()].every((doc) => doc.totalEvents === 7 && doc.privateUntil === null));
});

test('server clock controls retention, and invalid clock/SDK cleanup failures produce fixed typed errors', async () => {
  for (const now of [() => NaN, () => -1, () => Number.MAX_SAFE_INTEGER]) {
    const service = createActivityService({ db: fakeDb(), now });
    await assert.rejects(service.purgeExpired(), { code: 'service-unavailable' });
  }
  const service = createActivityService({ db: { collectionGroup() { throw new Error('PRIVATE_SDK_QUERY'); } }, now: () => TIME });
  await assert.rejects(service.purgeExpired(), { message: 'service-unavailable', code: 'service-unavailable' });
});