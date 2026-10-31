'use strict';

// Offline: node --test tools/test-admin-server.js (built-ins only, no credentials).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { createAdminHandler, clientIp, DEFAULT_ORIGINS } = require('../functions/admin-handler');
const { createAdminService, AdminError, maskIp, hash, SESSION_MS, WINDOW_MS,
  RETENTION_MS, COLLECTIONS } = require('../functions/admin-service');

const TIME = 1800000000000;
const UID = 'firebase-user';
const clone = (value) => value === undefined ? undefined : structuredClone(value);

/** Minimal Admin-shaped Firestore fake, with serialized, atomic transactions,
 * snapshot cursors, range queries and count-only aggregation. No SDK/network.
 */
function fakeDb() {
  const records = new Map(), calls = [];
  let queue = Promise.resolve(), sequence = 0;
  const snapshot = (ref) => ({ id: ref.id, ref, exists: records.has(ref.path), data: () => clone(records.get(ref.path)) });
  const document = (path) => ({
    path, id: path.split('/').pop(), collection: (name) => collection(`${path}/${name}`),
    async get() { calls.push(['get', path]); return snapshot(this); },
    async create(value) {
      calls.push(['create', path]);
      assert.equal(records.has(path), false, 'Session ID collision');
      records.set(path, clone(value));
    },
    async delete() { calls.push(['delete', path]); records.delete(path); }
  });
  function collection(path, filters = [], ordering, after, maximum) {
    return {
      path, doc: (id) => document(`${path}/${id}`),
      where(field, operator, value) { return collection(path, [...filters, [field, operator, value]], ordering, after, maximum); },
      orderBy(field, direction) { return collection(path, filters, [field, direction], after, maximum); },
      startAfter(snap) {
        assert.equal(snap.ref.path, `${path}/${snap.id}`);
        calls.push(['startAfter', snap.ref.path]);
        return collection(path, filters, ordering, snap, maximum);
      },
      limit(value) { return collection(path, filters, ordering, after, value); },
      async add(value) {
        calls.push(['add', path]);
        const ref = document(`${path}/auto-${++sequence}`);
        records.set(ref.path, clone(value));
        return ref;
      },
      count() {
        return { async get() {
          calls.push(['count', path]);
          return { data: () => ({ count: [...records.keys()].filter((key) =>
            key.startsWith(`${path}/`) && key.split('/').length === path.split('/').length + 1).length }) };
        } };
      },
      async get() {
        calls.push(['query', path, filters, ordering, maximum]);
        let docs = [...records.keys()].filter((key) => key.startsWith(`${path}/`) &&
          key.split('/').length === path.split('/').length + 1).map((key) => snapshot(document(key)));
        for (const [field, operator, value] of filters) {
          docs = docs.filter((doc) => typeof doc.data()[field] === typeof value &&
            (operator === '>=' ? doc.data()[field] >= value : doc.data()[field] <= value));
        }
        if (ordering) docs.sort((a, b) => (b.data()[ordering[0]] - a.data()[ordering[0]]) || b.id.localeCompare(a.id));
        if (after) docs = docs.slice(docs.findIndex((doc) => doc.id === after.id) + 1);
        return { docs: maximum === undefined ? docs : docs.slice(0, maximum) };
      }
    };
  }
  return {
    records, calls, collection,
    runTransaction(callback) {
      const result = queue.then(async () => {
        const writes = [];
        let wrote = false;
        const value = await callback({
          async get(ref) { assert.equal(wrote, false, 'Firestore requires reads before writes'); return snapshot(ref); },
          set(ref, data) { wrote = true; writes.push([ref.path, clone(data)]); }
        });
        writes.forEach(([path, data]) => records.set(path, data));
        return value;
      });
      queue = result.catch(() => {});
      return result;
    }
  };
}

function rawUser(uid = UID) {
  return {
    uid, email: 'test@example.invalid', displayName: 'Test account', emailVerified: true, disabled: false,
    metadata: { creationTime: new Date(TIME - 10000).toUTCString(), lastSignInTime: new Date(TIME - 1000).toUTCString(), other: 'PRIVATE_METADATA' },
    providerData: [{ providerId: 'password', uid: 'PRIVATE_PROVIDER_UID', passwordHash: 'PRIVATE_PROVIDER_HASH' }, { providerId: 'google.com' }],
    passwordHash: 'PRIVATE_HASH', passwordSalt: 'PRIVATE_SALT', customClaims: { private: 'PRIVATE_CLAIM' },
    tokens: 'PRIVATE_TOKEN', refreshToken: 'PRIVATE_REFRESH', extra: 'PRIVATE_BODY'
  };
}
function setup(options = {}) {
  const db = fakeDb();
  let time = TIME, secret = randomBytes(32).toString('base64url');
  const user = rawUser();
  const authCalls = [];
  const auth = {
    async listUsers(size, token) { authCalls.push(['list', size, token]); return { users: [user], pageToken: 'next-page' }; },
    async getUser(uid) { authCalls.push(['get', uid]); return { ...user, uid }; }
  };
  const now = () => time;
  const service = createAdminService({ db, auth, now });
  const handler = createAdminHandler({ service, getCode: () => secret, now, ...options });
  async function request(body = { action: 'session' }, overrides = {}) {
    const req = { method: 'POST', path: '/api/private-admin', secure: true, ip: '203.0.113.8',
      headers: { origin: DEFAULT_ORIGINS[0], 'content-type': 'application/json', ...overrides.headers }, body,
      ...Object.fromEntries(Object.entries(overrides).filter(([key]) => key !== 'headers')) };
    const res = { statusCode: 200, headers: {}, body: undefined,
      setHeader(key, value) { this.headers[key.toLowerCase()] = value; },
      status(status) { this.statusCode = status; return this; },
      json(value) { this.body = JSON.parse(JSON.stringify(value)); return this; },
      end() { return this; }
    };
    await handler(req, res);
    assert.equal(res.headers['cache-control'], 'no-store');
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
    if (res.statusCode >= 400) {
      assert.deepEqual(Object.keys(res.body), ['error']);
      assert.deepEqual(Object.keys(res.body.error).sort(), ['code', 'message']);
      assert.equal(typeof res.body.error.message, 'string');
    }
    return res;
  }
  async function login(overrides) {
    const response = await request({ action: 'login', code: secret }, overrides);
    assert.equal(response.statusCode, 200);
    return { response, cookie: response.headers['set-cookie'].split(';')[0],
      csrf: response.body.csrfToken,
      headers: { cookie: response.headers['set-cookie'].split(';')[0], 'x-admin-csrf': response.body.csrfToken } };
  }
  return { db, auth, authCalls, service, request, login, now,
    advance: (ms) => { time += ms; }, get secret() { return secret; }, set secret(value) { secret = value; } };
}

test('login uses a secure Hosting cookie; only token hash, fingerprint and bounded session state persist', async () => {
  const f = setup();
  const { response, cookie, headers } = await f.login();
  assert.match(response.headers['set-cookie'], /^__session=[A-Za-z0-9_-]{43}; Path=\/; HttpOnly; SameSite=Strict; Max-Age=1800; Secure$/);
  assert.deepEqual(Object.keys(response.body).sort(), ['authenticated', 'csrfToken', 'expiresAt']);
  assert.equal(response.body.authenticated, true);
  assert.equal(Buffer.from(response.body.csrfToken, 'base64url').length, 24);
  assert.equal(response.body.expiresAt, TIME + SESSION_MS);
  const token = cookie.slice('__session='.length);
  assert.equal(Buffer.from(token, 'base64url').length, 32);
  const saved = f.db.records.get(`${COLLECTIONS.sessions}/${hash(token)}`);
  assert.equal(saved.expiresAt, TIME + SESSION_MS);
  assert.equal(saved.expireAt.getTime(), saved.expiresAt);
  assert.match(saved.codeFingerprint, /^[a-f0-9]{64}$/);
  const serialized = JSON.stringify([...f.db.records]);
  assert.ok(!serialized.includes(token));
  assert.ok(!serialized.includes(f.secret));
  assert.ok(!serialized.includes('203.0.113.8'));
  const session = await f.request({ action: 'session' }, { headers: { cookie: headers.cookie } });
  assert.deepEqual(session.body, response.body);
});

test('every non-login action, including unknown actions, requires an active cookie', async () => {
  const f = setup();
  for (const action of ['session', 'accounts', 'account', 'activity', 'revealIp', 'logout', 'deleteAccount', undefined]) {
    const response = await f.request({ action, uid: UID });
    assert.equal(response.statusCode, 401);
    assert.match(response.headers['set-cookie'], /Max-Age=0/);
  }
  assert.equal(f.db.calls.length, 0);
  assert.equal(f.authCalls.length, 0);
});

test('non-session actions require the correct CSRF header and cannot use a body token', async () => {
  const f = setup();
  const session = await f.login();
  for (const action of ['accounts', 'account', 'activity', 'revealIp', 'logout']) {
    for (const csrf of [undefined, 'x'.repeat(32), session.csrf + 'x']) {
      const response = await f.request({ action, uid: UID, csrfToken: session.csrf },
        { headers: { cookie: session.cookie, 'x-admin-csrf': csrf } });
      assert.equal(response.statusCode, 403);
      assert.equal(response.body.error.code, 'csrf-required');
    }
  }
  assert.equal(f.authCalls.length, 0);
  assert.equal([...f.db.records.keys()].filter((key) => key.startsWith(COLLECTIONS.audit)).length, 0);
});

test('wrong, short, missing, non-string and oversized codes never issue a session', async () => {
  for (const value of ['bad-code', '', undefined, {}, 'x'.repeat(257)]) {
    const f = setup();
    const response = await f.request({ action: 'login', code: value });
    assert.equal(response.statusCode, typeof value === 'string' && value.length <= 256 ? 401 : 400);
    assert.equal(response.headers['set-cookie'], undefined);
    assert.equal(f.db.records.get(`${COLLECTIONS.limits}/global`).requests.length, 1);
    assert.equal([...f.db.records.keys()].some((key) => key.startsWith(COLLECTIONS.sessions)), false);
  }
});

test('missing, short, blank, oversized or unavailable secret fails closed for login and session', async () => {
  for (const secret of [undefined, null, '', 'short', ' '.repeat(12), 'x'.repeat(257)]) {
    const f = setup();
    const session = await f.login();
    f.secret = secret;
    assert.equal((await f.request({ action: 'login', code: 'unused-test-value' })).statusCode, 503);
    assert.equal((await f.request({ action: 'session' }, { headers: session.headers })).statusCode, 503);
  }
  const f = setup({ getCode: () => { throw new Error('PRIVATE_SECRET_PROVIDER_ERROR'); } });
  const response = await f.request({ action: 'login', code: 'unused-test-value' });
  assert.equal(response.statusCode, 503);
  assert.ok(!JSON.stringify(response.body).includes('PRIVATE_'));
});

test('secret rotation revokes all protected actions including session introspection', async () => {
  for (const action of ['session', 'accounts', 'account', 'activity', 'revealIp', 'logout']) {
    const f = setup();
    const session = await f.login();
    f.secret = randomBytes(32).toString('base64url');
    const response = await f.request({ action, uid: UID }, { headers: session.headers });
    assert.equal(response.statusCode, 401);
    assert.match(response.headers['set-cookie'], /Max-Age=0/);
    assert.equal([...f.db.records.keys()].some((key) => key.startsWith(COLLECTIONS.sessions)), false);
    assert.equal(f.authCalls.length, 0);
  }
});

test('expired sessions fail without TTL deletion; cookies cannot be forged or duplicated', async () => {
  const f = setup();
  const session = await f.login();
  for (const cookie of ['session=not-hosting-cookie', '__session=bad',
    `__session=${randomBytes(32).toString('base64url')}`, `${session.cookie}; ${session.cookie}`]) {
    assert.equal((await f.request({ action: 'session' }, { headers: { cookie } })).statusCode, 401);
  }
  f.advance(SESSION_MS);
  assert.equal((await f.request({ action: 'session' }, { headers: session.headers })).statusCode, 401);
  assert.ok([...f.db.records.keys()].some((key) => key.startsWith(COLLECTIONS.sessions)), 'TTL has not deleted the doc');
});

test('logout deletes server state, clears the cookie and returns no tokens; re-login invalidates old cookie', async () => {
  const f = setup();
  const first = await f.login();
  const second = await f.login({ headers: first.headers });
  assert.notEqual(first.cookie, second.cookie);
  assert.equal((await f.request({ action: 'session' }, { headers: first.headers })).statusCode, 401);
  const response = await f.request({ action: 'logout' }, { headers: second.headers });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { authenticated: false });
  assert.match(response.headers['set-cookie'], /^__session=;.*Max-Age=0; Secure; Expires=/);
  assert.equal((await f.request({ action: 'accounts' }, { headers: second.headers })).statusCode, 401);
  assert.equal([...f.db.records.keys()].some((key) => key.startsWith(COLLECTIONS.sessions)), false);
});

test('exact origin allowlist rejects missing/null, noncanonical, hostile and non-HTTPS origins', async () => {
  const f = setup({ allowedOrigins: ['https://admin.example.invalid', 'http://remote.example.invalid',
    'http://localhost:5000', 'https://admin.localhost', 'https://127.0.0.2'] });
  for (const origin of [undefined, 'null', '', 'https://evil.example.invalid',
    DEFAULT_ORIGINS[0] + '.evil.invalid', DEFAULT_ORIGINS[0] + '/', 'https://user:pass@planner-project-7ab9e.web.app',
    'https://PLANNER-PROJECT-7AB9E.web.app', 'http://remote.example.invalid', 'http://localhost:5000',
    'https://admin.localhost', 'https://127.0.0.2']) {
    const response = await f.request({ action: 'login', code: f.secret }, { headers: { origin } });
    assert.equal(response.statusCode, 403);
    assert.equal(response.headers['access-control-allow-origin'], undefined);
  }
  for (const origin of [...DEFAULT_ORIGINS, 'https://admin.example.invalid']) {
    const response = await f.request({ action: 'session' }, { headers: { origin } });
    assert.equal(response.statusCode, 401);
    assert.equal(response.headers['access-control-allow-origin'], origin);
    assert.equal(response.headers['access-control-allow-credentials'], 'true');
  }
});

test('localhost needs explicit emulator allowlisting; null origin remains forbidden', async () => {
  const origin = 'http://localhost:5000';
  const f = setup({ emulator: true, allowedOrigins: [origin] });
  const session = await f.login({ secure: false, headers: { origin } });
  assert.ok(!session.response.headers['set-cookie'].includes('Secure'));
  for (const rejected of ['null', 'http://localhost:5001', 'http://127.0.0.1:5000']) {
    assert.equal((await f.request({ action: 'session' }, { headers: { origin: rejected } })).statusCode, 403);
  }
});

test('HTTPS, method, path, JSON and preflight guards do not perform admin work', async () => {
  const f = setup();
  assert.equal((await f.request({}, { secure: false, headers: { 'x-forwarded-proto': 'https' } })).statusCode, 403);
  assert.equal((await f.request({}, { method: 'GET' })).statusCode, 405);
  assert.equal((await f.request({}, { path: '/api/other' })).statusCode, 404);
  for (const body of [null, [], '{malformed', undefined]) {
    assert.equal((await f.request({}, { body })).statusCode, 400);
  }
  assert.equal((await f.request({}, { headers: { 'content-type': 'text/plain' } })).statusCode, 400);
  const preflight = await f.request({}, { method: 'OPTIONS' });
  assert.equal(preflight.statusCode, 204);
  assert.equal(preflight.headers['access-control-allow-headers'], 'Content-Type, X-Admin-CSRF');
  assert.equal(f.db.calls.length, 0);
});

test('trusted clientIp never uses XFF, body IP, socket fallback, or arbitrary forwarded headers', async () => {
  assert.equal(clientIp({ ip: '203.0.113.7', headers: { 'x-forwarded-for': '1.2.3.4' } }), '203.0.113.7');
  assert.equal(clientIp({ headers: { 'x-forwarded-for': '1.2.3.4' }, body: { ip: '1.2.3.4' } }), null);
  assert.equal(clientIp({ ip: 'invalid' }), null);
  assert.equal(clientIp({ ip: '2001:0DB8:0000:0000:0000:0000:0000:0001' }), '2001:db8::1');
  const f = setup();
  assert.equal((await f.request({ action: 'login', code: f.secret },
    { ip: undefined, headers: { 'x-forwarded-for': '1.2.3.4' } })).statusCode, 503);
});

test('persistent per-IP limit is 5 admitted attempts per sliding 15 minutes, including successes', async () => {
  const f = setup();
  await f.login();
  for (let i = 0; i < 4; i++) {
    assert.equal((await f.request({ action: 'login', code: 'deliberately-incorrect' },
      { headers: { 'x-forwarded-for': `198.51.100.${i}` } })).statusCode, 401);
  }
  const blocked = await f.request({ action: 'login', code: f.secret });
  assert.equal(blocked.statusCode, 429);
  assert.equal(blocked.headers['retry-after'], '900');
  const secondService = createAdminService({ db: f.db, auth: f.auth, now: f.now });
  assert.equal((await secondService.consumeLoginAttempt('203.0.113.8')).allowed, false);
  f.advance(WINDOW_MS - 1);
  assert.equal((await f.request({ action: 'login', code: f.secret })).statusCode, 429);
  f.advance(1);
  await f.login();
  const limit = f.db.records.get(`${COLLECTIONS.limits}/global`);
  assert.equal(limit.requests.length, 1);
  assert.equal(limit.expireAt.getTime(), f.now() + WINDOW_MS);
});

test('global 50-attempt limit is shared by distinct IPs and service instances', async () => {
  const f = setup();
  const other = createAdminService({ db: f.db, auth: f.auth, now: f.now });
  for (let i = 0; i < 50; i++) {
    assert.equal((await (i % 2 ? other : f.service).consumeLoginAttempt(`198.51.100.${i}`)).allowed, true);
  }
  assert.equal((await other.consumeLoginAttempt('192.0.2.1')).allowed, false);
  const response = await f.request({ action: 'login', code: f.secret });
  assert.equal(response.statusCode, 429);
  assert.equal(f.db.records.get(`${COLLECTIONS.limits}/global`).requests.length, 50);
  f.advance(WINDOW_MS);
  assert.equal((await other.consumeLoginAttempt('192.0.2.1')).allowed, true);
});

test('concurrent admission cannot overrun either bucket; blocked attempts write neither bucket', async () => {
  const f = setup();
  const same = await Promise.all(Array.from({ length: 25 }, () => f.service.consumeLoginAttempt('192.0.2.1')));
  assert.equal(same.filter((result) => result.allowed).length, 5);
  const diverse = await Promise.all(Array.from({ length: 100 }, (_, i) => f.service.consumeLoginAttempt(`198.51.100.${i}`)));
  assert.equal(diverse.filter((result) => result.allowed).length, 45);
  assert.equal(f.db.records.get(`${COLLECTIONS.limits}/global`).requests.length, 50);
  assert.equal([...f.db.records.keys()].filter((key) => key.startsWith(`${COLLECTIONS.limits}/ip-`)).length, 46);
});

test('malformed rate state or storage failure fails closed, without leaking error details', async () => {
  for (const requests of [null, [NaN], [-1], [TIME + 1], Array(51).fill(TIME)]) {
    const f = setup();
    f.db.records.set(`${COLLECTIONS.limits}/global`, { requests });
    assert.equal((await f.request({ action: 'login', code: f.secret })).statusCode, 503);
  }
  const f = setup();
  f.db.runTransaction = async () => { throw new Error('PRIVATE_FIREBASE_PROVIDER_RESPONSE'); };
  const response = await f.request({ action: 'login', code: f.secret });
  assert.equal(response.statusCode, 503);
  assert.ok(!JSON.stringify(response.body).includes('PRIVATE_'));
});

test('accounts serialize only the explicit Firebase metadata allowlist, never UserRecord private fields', async () => {
  const f = setup();
  const session = await f.login();
  const response = await f.request({ action: 'accounts', pageSize: 12, pageToken: 'test-page' }, { headers: session.headers });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(f.authCalls, [['list', 12, 'test-page']]);
  assert.deepEqual(response.body, { accounts: [{ uid: UID, email: 'test@example.invalid', displayName: 'Test account',
    emailVerified: true, disabled: false, createdAt: TIME - 10000, lastSignInAt: TIME - 1000,
    providers: ['password', 'google.com'] }], nextPageToken: 'next-page' });
  assert.ok(!JSON.stringify(response.body).includes('PRIVATE_'));
  f.auth.listUsers = async () => ({ users: [{ uid: UID, disabled: true, metadata: {} }] });
  const sparse = await f.request({ action: 'accounts' }, { headers: session.headers });
  assert.equal(sparse.body.nextPageToken, null);
  assert.equal(sparse.body.accounts[0].disabled, true);
  assert.equal(sparse.body.accounts[0].lastSignInAt, null);
});

test('account summary uses consent from prefs only, allowlisted counters and server count aggregations', async () => {
  const f = setup();
  f.db.records.set(`accountAudit/${UID}`, { consent: true, firstObservedAt: TIME - 400, lastObservedAt: TIME,
    totalEvents: 8, byAction: { open: 8, bad: 'PRIVATE_COUNTER', negative: -1 }, byModule: { tasks: 8 },
    lastIp: '203.0.113.19', lastDevice: 'PRIVATE_RAW_DEVICE', body: 'PRIVATE_AUDIT_BODY' });
  f.db.records.set(`users/${UID}`, { prefs: { activitySharing: true }, notes: 'PRIVATE_PROFILE_BODY' });
  for (const name of ['tasks', 'events', 'goals', 'habits', 'notes', 'purchases']) {
    f.db.records.set(`users/${UID}/${name}/one`, { body: 'PRIVATE_RECORD', amount: 123456 });
  }
  const session = await f.login();
  const response = await f.request({ action: 'account', uid: UID }, { headers: session.headers });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body.summary, { consent: true, firstObservedAt: TIME - 400, lastObservedAt: TIME,
    totalEvents: 8, byAction: { open: 8 }, byModule: { tasks: 8 }, lastIpMasked: '203.0.113.*',
    counts: { tasks: 1, events: 1, goals: 1, habits: 1, notes: 1, purchases: 1 } });
  assert.ok(!JSON.stringify(response.body).includes('PRIVATE_'));
  assert.equal(f.db.calls.filter(([op]) => op === 'count').length, 6);
  assert.equal(f.db.calls.some(([op, path]) => op === 'get' && path.startsWith(`users/${UID}/`)), false);
  for (const activitySharing of [undefined, false, 'true', 1]) {
    f.db.records.set(`users/${UID}`, { prefs: { activitySharing } });
    assert.equal((await f.service.getAccount(UID)).summary.consent, false);
  }
  f.db.records.delete(`users/${UID}`);
  assert.equal((await f.service.getAccount(UID)).summary.consent, false);
  f.db.records.delete(`accountAudit/${UID}`);
  const empty = (await f.service.getAccount(UID)).summary;
  assert.equal(empty.firstObservedAt, null);
  assert.equal(empty.lastIpMasked, null);
  assert.equal(empty.totalEvents, 0);
});

test('activity uses descending snapshot pagination, 50 limit, 30-day retention and explicit event fields', async () => {
  const f = setup();
  for (let i = 0; i < 53; i++) f.db.records.set(`accountAudit/${UID}/activityEvents/e${String(i).padStart(3, '0')}`,
    { at: TIME - i, action: 'open', module: 'tasks', ip: '2001:db8:abcd:1234::1',
      device: 'd'.repeat(400), notes: 'PRIVATE_NOTE', amount: 987654, passwordHash: 'PRIVATE_HASH' });
  f.db.records.set(`accountAudit/${UID}/activityEvents/expired`, { at: TIME - RETENTION_MS - 1 });
  f.db.records.set(`accountAudit/${UID}/activityEvents/future`, { at: TIME + 1 });
  f.db.records.set(`accountAudit/${UID}/activityEvents/bad`, { at: 'not-a-number' });
  const session = await f.login();
  const first = await f.request({ action: 'activity', uid: UID }, { headers: session.headers });
  assert.equal(first.statusCode, 200);
  assert.equal(first.body.events.length, 50);
  assert.equal(first.body.nextCursor, 'e049');
  assert.deepEqual(Object.keys(first.body.events[0]).sort(), ['action', 'at', 'device', 'id', 'ipMasked', 'module']);
  assert.equal(first.body.events[0].device.length, 120);
  assert.equal(first.body.events[0].ipMasked, '2001:db8:abcd:*:*:*:*:*');
  assert.ok(!JSON.stringify(first.body).includes('PRIVATE_'));
  const second = await f.request({ action: 'activity', uid: UID, cursor: first.body.nextCursor }, { headers: session.headers });
  assert.deepEqual(second.body.events.map((event) => event.id), ['e050', 'e051', 'e052']);
  assert.equal(second.body.nextCursor, null);
  assert.ok(f.db.calls.some(([op, path]) => op === 'startAfter' && path === `accountAudit/${UID}/activityEvents/e049`));
  const query = f.db.calls.find(([op]) => op === 'query');
  assert.deepEqual(query.slice(2), [[['at', '>=', TIME - RETENTION_MS], ['at', '<=', TIME]], ['at', 'desc'], 50]);
});

test('cursor/event IDs cannot escape the UID path, and old events are not revealable', async () => {
  const f = setup();
  f.db.records.set('accountAudit/other/activityEvents/foreign', { at: TIME, ip: '203.0.113.1' });
  f.db.records.set(`accountAudit/${UID}/activityEvents/old`, { at: TIME - RETENTION_MS - 1, ip: '203.0.113.2' });
  const session = await f.login();
  for (const cursor of ['../other/events/foreign', 'accountAudit/other/events/foreign', '.', '..', '', null]) {
    assert.equal((await f.request({ action: 'activity', uid: UID, cursor }, { headers: session.headers })).statusCode, 400);
    assert.equal((await f.request({ action: 'revealIp', uid: UID, eventId: cursor }, { headers: session.headers })).statusCode, 400);
  }
  assert.equal((await f.request({ action: 'activity', uid: UID, cursor: 'foreign' }, { headers: session.headers })).statusCode, 404);
  assert.equal((await f.request({ action: 'activity', uid: UID, cursor: 'old' }, { headers: session.headers })).statusCode, 400);
  assert.equal((await f.request({ action: 'revealIp', uid: UID, eventId: 'old' }, { headers: session.headers })).statusCode, 404);
  assert.equal(f.db.calls.some(([op, path]) => op === 'get' && path.startsWith('accountAudit/other')), false);
});

test('IP reveal returns scoped observed data only, with a durable private audit and no raw IP in audit', async () => {
  const f = setup();
  f.db.records.set(`accountAudit/${UID}`, { lastObservedAt: TIME - 10, lastIp: '203.0.113.9' });
  f.db.records.set(`accountAudit/${UID}/activityEvents/one`, { at: TIME - 20, ip: '203.0.113.8', extra: 'PRIVATE_BODY' });
  const session = await f.login();
  for (const [eventId, expected] of [[undefined, { ip: '203.0.113.9', at: TIME - 10 }], ['one', { ip: '203.0.113.8', at: TIME - 20 }]]) {
    const response = await f.request({ action: 'revealIp', uid: UID, eventId }, { headers: session.headers });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body, expected);
  }
  const audits = [...f.db.records.entries()].filter(([path]) => path.startsWith(`${COLLECTIONS.audit}/`)).map(([, value]) => value);
  assert.equal(audits.length, 2);
  for (const audit of audits) {
    assert.deepEqual(Object.keys(audit).sort(), ['action', 'at', 'eventId', 'observedAt', 'sessionId', 'uid']);
    assert.equal(audit.action, 'revealIp');
    assert.equal(audit.uid, UID);
    assert.equal(audit.at, TIME);
    assert.equal(audit.sessionId, hash(session.cookie.slice('__session='.length)));
    assert.ok(!JSON.stringify(audit).includes('203.0.113.'));
  }
  const unavailable = await f.request({ action: 'revealIp', uid: 'no-observations' }, { headers: session.headers });
  assert.deepEqual(unavailable.body, { ip: null, at: null });
  const originalCollection = f.db.collection;
  f.db.collection = (name) => name === COLLECTIONS.audit ? { add: async () => { throw Error('PRIVATE_AUDIT_FAILURE'); } } : originalCollection(name);
  const failed = await f.request({ action: 'revealIp', uid: UID }, { headers: session.headers });
  assert.equal(failed.statusCode, 503);
  assert.ok(!JSON.stringify(failed.body).includes('203.0.113.9'));
  assert.ok(!JSON.stringify(failed.body).includes('PRIVATE_'));
});

test('IPv4/IPv6 masking and unavailable addresses never fabricate location or missing data', () => {
  for (const value of [null, undefined, '', 'not-an-ip', '203.0.113.999', '1.2.3.4, 5.6.7.8', 'fe80::1%eth0']) {
    assert.equal(maskIp(value), null);
  }
  assert.equal(maskIp('203.0.113.99'), '203.0.113.*');
  assert.equal(maskIp('2001:db8:1234:5678:abcd:ef01:2345:6789'), '2001:db8:1234:*:*:*:*:*');
  assert.equal(maskIp('2001:db8::1'), '2001:db8:0:*:*:*:*:*');
  assert.equal(maskIp('::1'), '0:0:0:*:*:*:*:*');
  assert.equal(maskIp('::ffff:192.0.2.99'), '0:0:0:*:*:*:*:*');
});

test('input bounds and Firebase UID compatibility; no account-write actions exist', async () => {
  const f = setup();
  const session = await f.login();
  for (const uid of ['', null, 123, 'x'.repeat(129), 'user/child']) {
    for (const action of ['account', 'activity', 'revealIp']) {
      assert.equal((await f.request({ action, uid }, { headers: session.headers })).statusCode, 400);
    }
  }
  for (const uid of ['x'.repeat(128), 'user:with spaces@domain', '\u7528\u6237', 'unusual\tuid']) {
    const response = await f.request({ action: 'account', uid }, { headers: session.headers });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.account.uid, uid);
  }
  for (const pageSize of [0, -1, 51, 1.5, '50', null]) {
    assert.equal((await f.request({ action: 'accounts', pageSize }, { headers: session.headers })).statusCode, 400);
  }
  for (const pageToken of ['', 1, null, 'x'.repeat(2049)]) {
    assert.equal((await f.request({ action: 'accounts', pageToken }, { headers: session.headers })).statusCode, 400);
  }
  for (const action of ['resetPassword', 'deleteAccount', 'disableAccount', 'setClaims', 'unknown']) {
    assert.equal((await f.request({ action, uid: UID }, { headers: session.headers })).statusCode, 400);
  }
  assert.ok(!f.db.calls.some(([op, path]) => ['create', 'delete', 'add'].includes(op) &&
    (path.startsWith('users/') || path.startsWith('accountAudit/'))));
});

test('Firebase errors map to fixed safe HTTP errors, never SDK response bodies', async () => {
  const f = setup();
  const session = await f.login();
  f.auth.getUser = async () => { throw Object.assign(new Error('PRIVATE_ACCOUNT_DETAILS'), { code: 'auth/user-not-found' }); };
  assert.equal((await f.request({ action: 'account', uid: UID }, { headers: session.headers })).statusCode, 404);
  f.auth.listUsers = async () => { throw Object.assign(new Error('PRIVATE_PAGE_DETAILS'), { code: 'auth/invalid-page-token' }); };
  assert.equal((await f.request({ action: 'accounts', pageToken: 'bad' }, { headers: session.headers })).statusCode, 400);
  f.auth.listUsers = async () => { throw new Error('PRIVATE_SDK_PASSWORD_HASH'); };
  const response = await f.request({ action: 'accounts' }, { headers: session.headers });
  assert.equal(response.statusCode, 503);
  assert.ok(!JSON.stringify(response.body).includes('PRIVATE_'));
});

test('service session IDs and arguments are validated independently of the handler', async () => {
  const f = setup();
  await assert.rejects(f.service.getSession('raw-token'), AdminError);
  await assert.rejects(f.service.createSession({ id: 'a'.repeat(64), csrfToken: ['x'.repeat(32)],
    codeFingerprint: 'b'.repeat(64), expiresAt: TIME + SESSION_MS }), AdminError);
  await assert.rejects(f.service.createSession({ id: 'a'.repeat(64), csrfToken: 'x'.repeat(32),
    codeFingerprint: 'b'.repeat(64), expiresAt: TIME + SESSION_MS + 1 }), AdminError);
  await assert.rejects(f.service.consumeLoginAttempt('bad-ip'), AdminError);
  await assert.rejects(f.service.listAccounts({ pageSize: 51 }), AdminError);
  await assert.rejects(f.service.getAccount('a/b'), AdminError);
});

test('corrupted session CSRF, expiry and fingerprint fields fail closed', async () => {
  for (const bad of [{ csrfToken: ['x'.repeat(32)] }, { csrfToken: null },
    { codeFingerprint: null }, { expiresAt: String(TIME + SESSION_MS) }]) {
    const f = setup();
    const session = await f.login();
    const path = `${COLLECTIONS.sessions}/${hash(session.cookie.slice('__session='.length))}`;
    f.db.records.set(path, { ...f.db.records.get(path), ...bad });
    assert.equal((await f.request({ action: 'session' }, { headers: session.headers })).statusCode, 401);
  }
});

test('expired summary IP stays private even before background cleanup', async () => {
  const f = setup();
  f.db.records.set(`accountAudit/${UID}`, { lastObservedAt: TIME - RETENTION_MS - 1, lastIp: '203.0.113.99', totalEvents: 3 });
  const session = await f.login();
  const account = await f.request({ action: 'account', uid: UID }, { headers: session.headers });
  assert.equal(account.body.summary.lastIpMasked, null);
  assert.equal(account.body.summary.totalEvents, 3);
  const reveal = await f.request({ action: 'revealIp', uid: UID }, { headers: session.headers });
  assert.deepEqual(reveal.body, { ip: null, at: null });
});