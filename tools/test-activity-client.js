'use strict';

// Dependency-free: node --test tools/test-activity-client.js
// No network, SDK imports, storage, generated bundle writes, or real timers.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const ROOT = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const plain = (value) => JSON.parse(JSON.stringify(value));
const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function load(file, mocks, names, transform = (source) => source) {
  const source = transform(read(file))
    .replace(/^import\s+[\s\S]*?\s+from\s+['"][^'"\r\n]+['"];[ \t]*\r?\n/gm, '')
    .replace(/^export\s*\{[^}]*\};[ \t]*$/gm, '')
    .replace(/^export\s+(?=(?:async\s+)?function\b|const\b|let\b|class\b)/gm, '');
  const context = vm.createContext({ console, ...mocks });
  new vm.Script(`${source}\n;globalThis.exposed = { ${names} };`, { filename: file })
    .runInContext(context, { timeout: 2000 });
  return context.exposed;
}
function fakeClock() {
  let now = 1000000, id = 0;
  const timers = new Map();
  return {
    Date: class extends Date { static now() { return now; } },
    setTimeout(fn, delay) { const key = ++id; timers.set(key, { at: now + delay, fn }); return key; },
    clearTimeout(key) { timers.delete(key); },
    now: () => now,
    pending: () => timers.size,
    async tick(ms) {
      const end = now + ms;
      for (let steps = 0; ; steps++) {
        assert.ok(steps < 2000, 'bounded timer execution');
        await flush();
        const next = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
        if (!next || next[1].at > end) break;
        now = next[1].at;
        timers.delete(next[0]);
        next[1].fn();
      }
      now = end;
      await flush();
    }
  };
}
function harness({ protocol = 'https:', hostname = 'example.test', fetcher, token } = {}) {
  const clock = fakeClock();
  const requests = [], tokenCalls = [], listeners = new Map();
  const auth = { currentUser: null };
  const navigator = { onLine: true };
  const location = { protocol, hostname, href: `${protocol}//${hostname}/private?email=secret#room=SECRET` };
  const user = (uid) => ({ uid, email: 'private@example.test', getIdToken() {
    tokenCalls.push(uid);
    return token ? token(uid) : Promise.resolve(`token-${uid}`);
  } });
  auth.currentUser = user('alice');
  const forbiddenStorage = new Proxy({}, { get() { throw new Error('Telemetry must not use storage'); } });
  const ok = () => ({ ok: true, json: async () => ({ recorded: true }) });
  const api = load('js/activity.js', {
    auth, navigator, location, AbortController,
    Date: clock.Date, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout,
    localStorage: forbiddenStorage, sessionStorage: forbiddenStorage,
    window: { addEventListener(name, fn) { listeners.set(name, fn); } },
    console: { error() { assert.fail('No app errors'); }, warn() { assert.fail('No app warnings'); } },
    fetch(url, options) {
      requests.push({ url, options, at: clock.now() });
      return fetcher ? fetcher(url, options) : Promise.resolve(ok());
    }
  }, 'recordActivity, setActivityConsent, getActivityStatus');
  return { ...api, clock, requests, tokenCalls, auth, navigator, location, user, listeners, ok,
    bodies: () => requests.map((r) => JSON.parse(r.options.body)),
    enable() { api.setActivityConsent(auth.currentUser.uid, true); }
  };
}

test('off by default; only strict true for the authenticated UID enables reporting', async () => {
  const h = harness();
  h.recordActivity('create', 'notes');
  for (const value of [false, undefined, null, 1, 'true', {}, []]) h.setActivityConsent('alice', value);
  h.setActivityConsent('bob', true);
  await h.clock.tick(60000);
  assert.equal(h.requests.length, 0);
  assert.equal(h.tokenCalls.length, 0);
  assert.equal(h.getActivityStatus().enabled, false);
  assert.equal(h.clock.pending(), 0);
  assert.equal(h.listeners.has('beforeunload'), false);
});

test('one session event per page/UID consent activation, not each snapshot or operation', async () => {
  const h = harness();
  h.enable(); h.enable(); h.enable();
  await h.clock.tick(5000);
  assert.deepEqual(h.bodies(), [{ action: 'session_started', module: 'app' }]);
  h.setActivityConsent('alice', false);
  h.enable();
  await h.clock.tick(5000);
  h.auth.currentUser = h.user('bob'); h.enable();
  await h.clock.tick(5000);
  assert.equal(h.requests.length, 3);
  assert.equal(h.requests[2].options.headers.Authorization, 'Bearer token-bob');
});

test('exact metadata payload and safe fetch options; extra private arguments never escape', async () => {
  const h = harness(); h.enable();
  const privateData = { id: 'secret-id', email: 'secret-email', password: 'secret-password',
    title: 'secret-title', contents: 'secret-contents', room: 'secret-room', url: h.location.href };
  assert.equal(h.recordActivity('create', 'notes', privateData), undefined);
  await h.clock.tick(6000);
  assert.deepEqual(h.bodies(), [{ action: 'session_started', module: 'app' }, { action: 'create', module: 'notes' }]);
  for (const { url, options } of h.requests) {
    assert.equal(url, '/api/activity');
    assert.equal(options.method, 'POST');
    assert.equal(options.credentials, 'omit');
    assert.equal(options.cache, 'no-store');
    assert.equal(options.redirect, 'error');
    assert.equal(options.mode, 'same-origin');
    assert.equal(options.referrerPolicy, 'no-referrer');
    assert.deepEqual(Object.keys(options.headers).sort(), ['Authorization', 'Content-Type']);
    assert.equal(options.headers['Content-Type'], 'application/json');
    assert.deepEqual(Object.keys(JSON.parse(options.body)).sort(), ['action', 'module']);
    assert.doesNotMatch(JSON.stringify({ url, options }), /secret-|SECRET|private@example/);
    assert.doesNotMatch(options.body, /alice|token-/);
  }
});

test('invalid actions, IDs, routes, query strings and coercible objects are rejected', async () => {
  const h = harness(); h.enable();
  await h.clock.tick(3000);
  const coercible = { toString() { throw new Error('Do not coerce private objects'); } };
  for (const value of ['login', 'notes/secret-id', '/notes', 'games?room=SECRET', 'NOTES', '', null, 42, coercible]) {
    h.recordActivity('create', value);
    h.recordActivity(value, 'notes');
  }
  await h.clock.tick(60000);
  assert.equal(h.requests.length, 1);
});

test('client whitelist matches the backend contract', () => {
  const h = harness(); h.enable();
  const { ACTIONS, MODULES } = require('../functions/activity-service');
  assert.ok(ACTIONS && MODULES);
  for (const action of ACTIONS) h.recordActivity(action, 'app');
  assert.equal(h.getActivityStatus().queued, 1 + ACTIONS.length);
  h.setActivityConsent(null, false); h.enable();
  for (const module of MODULES) h.recordActivity('page_view', module);
  assert.equal(h.getActivityStatus().queued, 1 + MODULES.length);
});

for (const [protocol, hostname, allowed] of [
  ['file:', '', false], ['http:', 'example.test', false], ['ftp:', 'localhost', false],
  ['http:', 'localhost.evil.test', false], ['http:', 'localhost', true],
  ['http:', 'dev.localhost', true], ['http:', '127.0.0.1', true], ['http:', '[::1]', true],
  ['https:', 'example.test', true]
]) {
  test(`origin gate: ${protocol}//${hostname}`, async () => {
    const h = harness({ protocol, hostname }); h.enable();
    await h.clock.tick(1000);
    assert.equal(h.requests.length, allowed ? 1 : 0);
    assert.equal(h.tokenCalls.length, allowed ? 1 : 0);
  });
}

test('bounded queue, sequential sends and minimum spacing even under bursts', async () => {
  const pending = deferred();
  const h = harness({ fetcher: () => pending.promise }); h.enable();
  for (let i = 0; i < 500; i++) h.recordActivity('game_move', 'games');
  assert.equal(h.getActivityStatus().queued, 30);
  await h.clock.tick(250);
  for (let i = 0; i < 500; i++) h.recordActivity('game_move', 'games');
  await h.clock.tick(2000);
  assert.equal(h.getActivityStatus().queued, 30);
  assert.equal(h.requests.length, 1);
  pending.resolve(h.ok());
  await h.clock.tick(90000);
  assert.equal(h.requests.length, 30);
  for (let i = 1; i < h.requests.length; i++) assert.ok(h.requests[i].at - h.requests[i - 1].at >= 3000);
  assert.equal(h.getActivityStatus().queued, 0);
  assert.equal(h.clock.pending(), 0);
});

test('revocation immediately aborts fetch, clears backlog and leaves no timers', async () => {
  const h = harness({ fetcher: () => new Promise(() => {}) }); h.enable();
  h.recordActivity('create', 'notes');
  await h.clock.tick(250);
  h.setActivityConsent('alice', false);
  assert.equal(h.requests[0].options.signal.aborted, true);
  assert.equal(h.getActivityStatus().queued, 0);
  await h.clock.tick(60000);
  assert.equal(h.requests.length, 1);
  assert.equal(h.clock.pending(), 0);
});

test('UID changed before token lookup: no token and no request', async () => {
  const h = harness(); h.enable();
  h.auth.currentUser = h.user('bob');
  await h.clock.tick(10000);
  assert.equal(h.tokenCalls.length, 0);
  assert.equal(h.requests.length, 0);
});

test('UID changed during pending token: no request or stale queued events', async () => {
  const pending = deferred();
  const h = harness({ token: () => pending.promise }); h.enable();
  h.recordActivity('update', 'notes');
  await h.clock.tick(250);
  h.auth.currentUser = h.user('bob');
  pending.resolve('alice-token');
  await h.clock.tick(10000);
  assert.equal(h.requests.length, 0);
  assert.equal(h.getActivityStatus().queued, 0);
  assert.equal(h.getActivityStatus().enabled, false);
});

test('consent generation blocks old tokens after revoke/re-enable of the same UID', async () => {
  const pending = deferred(); let lookups = 0;
  const h = harness({ token: () => ++lookups === 1 ? pending.promise : Promise.resolve('fresh-token') });
  h.enable(); await h.clock.tick(250);
  h.setActivityConsent(null, false); h.enable();
  pending.resolve('stale-token');
  await h.clock.tick(10000);
  assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0].options.headers.Authorization, 'Bearer fresh-token');
});

test('stale fetch completion never drains a newly authenticated account queue', async () => {
  const first = deferred(); let count = 0;
  const h = harness({ fetcher: () => ++count === 1 ? first.promise : Promise.resolve(h.ok()) });
  h.enable(); h.recordActivity('create', 'notes'); await h.clock.tick(250);
  h.auth.currentUser = h.user('bob'); h.enable(); h.recordActivity('create', 'tasks');
  first.resolve(h.ok()); await h.clock.tick(10000);
  assert.deepEqual(h.bodies(), [
    { action: 'session_started', module: 'app' },
    { action: 'session_started', module: 'app' }, { action: 'create', module: 'tasks' }
  ]);
  assert.ok(h.requests.slice(1).every((r) => r.options.headers.Authorization === 'Bearer token-bob'));
});

for (const failure of ['network', 'token', 'http', 'rate-limit', 'json', 'consent-required', 'html']) {
  test(`quiet ${failure} failure: drop backlog, back off, never automatically retry`, async () => {
    let failing = true;
    const h = harness({
      token: () => failure === 'token' && failing ? Promise.reject(new Error('secret auth failure')) : Promise.resolve('token'),
      fetcher: () => {
        if (!failing) return Promise.resolve(h.ok());
        if (failure === 'network') throw new Error('secret network failure');
        return Promise.resolve({ ok: !['http', 'rate-limit'].includes(failure),
          status: failure === 'rate-limit' ? 429 : 503,
          json: async () => {
            if (failure === 'json' || failure === 'html') throw new Error('invalid body');
            return { recorded: false, reason: 'consent-required' };
          } });
      }
    });
    h.enable(); h.recordActivity('create', 'notes'); await h.clock.tick(250);
    assert.equal(h.getActivityStatus().delivery, 'unavailable');
    assert.equal(h.getActivityStatus().queued, 0);
    assert.equal(h.clock.pending(), 0);
    const attempts = h.tokenCalls.length;
    h.recordActivity('delete', 'notes'); await h.clock.tick(29000);
    assert.equal(h.getActivityStatus().queued, 0);
    assert.equal(h.tokenCalls.length, attempts);
    failing = false; await h.clock.tick(300000);
    assert.equal(h.tokenCalls.length, attempts, 'no automatic retry after cooldown');
    h.recordActivity('page_view', 'dashboard'); await h.clock.tick(1000);
    assert.equal(h.getActivityStatus().delivery, 'recorded');
    assert.deepEqual(h.bodies().at(-1), { action: 'page_view', module: 'dashboard' });
  });
}

test('8 second bound includes token lookup; late tokens cannot fetch', async () => {
  const pending = deferred();
  const h = harness({ token: () => pending.promise }); h.enable();
  await h.clock.tick(250); await h.clock.tick(7999);
  assert.equal(h.getActivityStatus().delivery, 'pending');
  await h.clock.tick(1);
  assert.equal(h.getActivityStatus().delivery, 'unavailable');
  pending.resolve('late-token'); await h.clock.tick(100000);
  assert.equal(h.requests.length, 0);
  assert.equal(h.clock.pending(), 0);
});

test('8 second bound includes fetch response body; timeout aborts and drops everything', async () => {
  const h = harness({ fetcher: async () => ({ ok: true, json: () => new Promise(() => {}) }) }); h.enable();
  h.recordActivity('create', 'notes'); await h.clock.tick(8250);
  assert.equal(h.requests[0].options.signal.aborted, true);
  assert.equal(h.getActivityStatus().delivery, 'unavailable');
  assert.equal(h.getActivityStatus().queued, 0);
  assert.equal(h.clock.pending(), 0);
});

test('offline clears/aborts immediately; no offline retention or online replay', async () => {
  const h = harness({ fetcher: () => new Promise(() => {}) }); h.enable();
  h.recordActivity('create', 'notes'); await h.clock.tick(250);
  h.navigator.onLine = false; h.listeners.get('offline')();
  assert.equal(h.requests[0].options.signal.aborted, true);
  h.recordActivity('delete', 'notes');
  assert.equal(h.getActivityStatus().queued, 0);
  h.navigator.onLine = true; await h.clock.tick(1000000);
  assert.equal(h.requests.length, 1);
  assert.equal(h.clock.pending(), 0);
});

function storeHarness(h) {
  let writer = async () => ({ id: 'private-id' });
  const snapshots = [], writes = [], events = [];
  const store = load('js/store.js', {
    auth: h.auth, db: {}, PRAYERS: [], DEFAULT_PRAYER_PREFS: {}, BADGES: [],
    doc: (_db, ...parts) => parts, collection: (_db, ...parts) => parts,
    getDoc: async () => ({ exists: () => true }),
    query: (ref) => ref, orderBy: () => null, serverTimestamp: () => 123,
    onSnapshot(ref, ...args) {
      if (ref.length === 2) {
        assert.equal(args[0].includeMetadataChanges, true);
        snapshots.push({ uid: ref[1], success: args[1], error: args[2] });
      }
      return () => {};
    },
    ...Object.fromEntries(['addDoc', 'setDoc', 'updateDoc', 'deleteDoc'].map((method) => [method,
      (...args) => { writes.push({ method, args }); return writer(method, args); }])),
    recordActivity(...args) { events.push(args); h.recordActivity(...args); },
    setActivityConsent: h.setActivityConsent,
    console: { warn() {}, error() {} }
  }, 'state, connect, disconnect, create, update, remove, savePrefs, prefs, updateProfileDoc, setEventDeleteHook');
  return { store, snapshots, writes, events, setWriter(fn) { writer = fn; },
    snapshot(on, metadata = {}, snapshot = snapshots.at(-1)) {
      snapshot.success({ id: snapshot.uid, data: () => ({ prefs: { activitySharing: on } }),
        metadata: { fromCache: false, hasPendingWrites: false, ...metadata } });
    }
  };
}

test('profile snapshot integration: strict server-confirmed opt-in only; disconnect aborts', async () => {
  const h = harness({ fetcher: () => new Promise(() => {}) }); const s = storeHarness(h);
  await s.store.connect(h.auth.currentUser);
  assert.equal(s.store.prefs().activitySharing, false);
  s.snapshot('true'); s.snapshot(true, { fromCache: true }); s.snapshot(true, { hasPendingWrites: true });
  await h.clock.tick(1000); assert.equal(h.requests.length, 0);
  s.snapshot(true); s.snapshot(true); await h.clock.tick(250);
  assert.equal(h.requests.length, 1);
  s.store.disconnect();
  assert.equal(h.requests[0].options.signal.aborted, true);
  assert.equal(h.getActivityStatus().enabled, false);
  s.snapshot(true); // Late callback from the disconnected account must be ignored.
  await h.clock.tick(10000); assert.equal(h.requests.length, 1);
});

test('enabling preference does not report until successful save AND confirmed snapshot', async () => {
  const h = harness(); const s = storeHarness(h); await s.store.connect(h.auth.currentUser); s.snapshot(false);
  const pending = deferred(); s.setWriter(() => pending.promise);
  const saving = s.store.savePrefs({ activitySharing: true });
  s.snapshot(true, { hasPendingWrites: true }); await h.clock.tick(5000);
  assert.equal(h.requests.length, 0);
  pending.resolve(); await saving; await h.clock.tick(5000);
  assert.equal(h.requests.length, 0);
  s.snapshot(true); await h.clock.tick(1000);
  assert.deepEqual(h.bodies(), [{ action: 'session_started', module: 'app' }]);
});

test('failed opt-out stays locally off even after rollback/confirmed true snapshots', async () => {
  const h = harness(); const s = storeHarness(h); await s.store.connect(h.auth.currentUser); s.snapshot(true);
  await h.clock.tick(1000);
  const pending = deferred(); s.setWriter(() => pending.promise);
  const saving = s.store.savePrefs({ activitySharing: false });
  assert.equal(h.getActivityStatus().enabled, false);
  s.snapshot(true); assert.equal(h.getActivityStatus().enabled, false);
  pending.reject(new Error('save denied'));
  await assert.rejects(saving, /save denied/);
  s.snapshot(true); s.store.prefs(); h.recordActivity('create', 'notes'); await h.clock.tick(60000);
  assert.equal(h.getActivityStatus().enabled, false);
  assert.equal(h.requests.length, 1);
  assert.equal(s.store.prefs().activitySharing, true, 'UI reflects server preference, not a false success');
});

test('older enable completion cannot override a later revoke', async () => {
  const h = harness(); const s = storeHarness(h); await s.store.connect(h.auth.currentUser); s.snapshot(false);
  const on = deferred(), off = deferred(); let n = 0;
  s.setWriter(() => ++n === 1 ? on.promise : off.promise);
  const savingOn = s.store.savePrefs({ activitySharing: true });
  const savingOff = s.store.savePrefs({ activitySharing: false });
  s.snapshot(true); on.resolve(); await savingOn;
  assert.equal(h.getActivityStatus().enabled, false);
  s.snapshot(false); off.resolve(); await savingOff;
  assert.equal(h.getActivityStatus().enabled, false);
});

test('successful CRUD/profile hooks contain metadata only; failed writes do not log', async () => {
  const h = harness(); const s = storeHarness(h); await s.store.connect(h.auth.currentUser); s.snapshot(true);
  await s.store.create('notes', { title: 'private title', content: 'private body' });
  await s.store.update('tasks', 'private-id', { title: 'private title' });
  await s.store.remove('events', 'private-id');
  await s.store.updateProfileDoc({ name: 'private name', email: 'private email' });
  assert.deepEqual(s.events, [['create', 'notes'], ['update', 'tasks'], ['delete', 'events'], ['update', 'profile']]);
  s.setWriter(async () => { throw new Error('write denied'); });
  await assert.rejects(s.store.create('notes', {}));
  await assert.rejects(s.store.update('notes', 'secret', {}));
  await assert.rejects(s.store.remove('notes', 'secret'));
  await assert.rejects(s.store.updateProfileDoc({ bio: 'secret' }));
  assert.equal(s.events.length, 4);
  await h.clock.tick(20000);
  assert.equal(h.requests.length, 5);
  assert.doesNotMatch(JSON.stringify(h.bodies()), /private|secret/);
});

test('CRUD completion after account switch never attributes the old write to the new user', async () => {
  for (const operation of [
    (s) => s.create('notes', {}), (s) => s.update('notes', 'secret', {}),
    (s) => s.remove('notes', 'secret'), (s) => s.updateProfileDoc({ bio: 'secret' })
  ]) {
    const h = harness(); const s = storeHarness(h); await s.store.connect(h.auth.currentUser); s.snapshot(true);
    const pending = deferred(); s.setWriter(() => pending.promise);
    const result = operation(s.store);
    h.auth.currentUser = h.user('bob'); await s.store.connect(h.auth.currentUser); s.snapshot(true);
    pending.resolve({ id: 'secret' }); await result;
    assert.equal(s.events.length, 0);
    await h.clock.tick(1000);
    assert.deepEqual(h.bodies(), [{ action: 'session_started', module: 'app' }]);
    assert.equal(h.requests[0].options.headers.Authorization, 'Bearer token-bob');
  }
});

test('calendar delete keeps its original document reference across remote-hook await', async () => {
  const h = harness(); const s = storeHarness(h); await s.store.connect(h.auth.currentUser);
  s.store.state.events = [{ id: 'private-id', gcalId: 'private-remote' }];
  const pending = deferred(); s.store.setEventDeleteHook(() => pending.promise);
  const result = s.store.remove('events', 'private-id');
  h.auth.currentUser = h.user('bob'); await s.store.connect(h.auth.currentUser);
  pending.resolve(); await result;
  assert.deepEqual(plain(s.writes.at(-1).args[0]), ['users', 'alice', 'events', 'private-id']);
  assert.equal(s.events.length, 0);
});

test('navigation listener is registered once and strips/whitelists paths, excluding public pages', () => {
  const listeners = new Map(), events = [];
  const page = {};
  const mocks = {
    ...Object.fromEntries(['dashboard', 'tasks', 'calendarPage', 'finance', 'purchases', 'goals',
      'habits', 'games', 'prayer', 'quran', 'notes', 'archive', 'profile'].map((key) => [key, page])),
    auth: { currentUser: { uid: 'alice' } },
    window: { addEventListener(name, fn) { assert.ok(!listeners.has(name)); listeners.set(name, fn); } },
    document: { addEventListener() {} }, recordActivity: (...args) => events.push(args)
  };
  const app = load('js/app.js', mocks, 'bindGlobals, session', (source) => source.slice(0, source.indexOf('\ninitRipples();')));
  app.session.user = { uid: 'alice' };
  app.bindGlobals(); app.bindGlobals();
  for (const path of ['/games?room=SECRET', '/notes#secret', '/login', '/signup?email=secret', '/forgot', '/',
    '/notes/private-id', 'https://example.test/notes', '/app', undefined, {}]) {
    listeners.get('lf:navigated')({ detail: { path } });
  }
  assert.deepEqual(events, [['page_view', 'games'], ['page_view', 'notes']]);
  app.session.user = null;
  listeners.get('lf:navigated')({ detail: { path: '/notes' } });
  assert.equal(events.length, 2);
});

function roomHarness() {
  const events = [], writes = [];
  const store = { state: { uid: 'alice', profile: { name: 'private-name' } } };
  let fail = false, pause = null;
  const write = async (...args) => {
    if (pause) await pause.promise;
    if (fail) throw new Error('write failed');
    writes.push(args);
  };
  const api = load('js/arcade/rooms.js', {
    store, crypto: webcrypto, db: {}, doc: (_db, ...parts) => parts,
    collection: (_db, ...parts) => parts, serverTimestamp: () => 123,
    sessionStorage: { getItem: () => 'private-tab' },
    setDoc: write, updateDoc: write, deleteDoc: write, getDocs: async () => ({ docs: [] }),
    runTransaction: async (_db, fn) => {
      const result = await fn({ get: async () => ({ exists: () => true,
        data: () => ({ hostUid: 'host', guestUid: 'alice', seq: 0 }) }), update() {} });
      await write(); return result;
    },
    recordActivity: (...args) => events.push(args), console: { warn() {} }
  }, 'createRoom, joinRoom, pushState, leaveRoom');
  return { api, events, writes, store, fail() { fail = true; }, pause(value) { pause = value; } };
}

test('room hooks log once after successful operations and never include room/game state', async () => {
  const h = roomHarness();
  await h.api.createRoom({ gameId: 'private-game', state: { secret: true } });
  const joined = await h.api.joinRoom('SECRET'); assert.equal(joined.seat, 1);
  await h.api.pushState('SECRET', { state: { secret: true }, seq: 1 });
  await h.api.leaveRoom('SECRET', 1);
  assert.deepEqual(h.events, [['game_create', 'games'], ['game_join', 'games'], ['game_move', 'games'], ['game_leave', 'games']]);
});

test('failed or cross-account room writes do not log success', async () => {
  for (const operation of [
    (api) => api.createRoom({ gameId: 'secret', state: {} }), (api) => api.joinRoom('SECRET'),
    (api) => api.pushState('SECRET', { state: {}, seq: 1 }), (api) => api.leaveRoom('SECRET', 0)
  ]) {
    const failed = roomHarness(); failed.fail();
    await operation(failed.api).catch(() => {});
    assert.equal(failed.events.length, 0);
    const changed = roomHarness(); const pending = deferred(); changed.pause(pending);
    const result = operation(changed.api);
    changed.store.state.uid = 'bob'; pending.resolve(); await result;
    assert.equal(changed.events.length, 0);
  }
});

test('profile notice describes opt-in, metadata, retention, revocation and delivery limits', () => {
  const source = read('js/views/profile.js');
  for (const text of ['data-activity-sharing', 'off by default', 'action type and feature', 'server-receive time',
    'coarse browser/device', 'observed IP', 'passwords, notes, messages, file contents', '30 days',
    'while it exists', 'revoke consent anytime', 'Current saved-item counts and account metadata',
    'does not confirm delivery', 'server preference could not be disabled']) assert.ok(source.includes(text), text);
  assert.match(source, /p\.activitySharing === true/);
  assert.ok(source.indexOf('if (!on) setActivityConsent(uid, false)') < source.indexOf('await store.savePrefs({ activitySharing: on })'));
});

test('standalone build stays acyclic and parses without writing the bundle', () => {
  let builds = 0;
  const realFs = require('node:fs');
  const mockedFs = { ...realFs, writeFileSync(file, code) {
    assert.equal(path.resolve(file), path.join(ROOT, 'js/app.bundle.js'));
    assert.ok(code.includes('Optional, memory-only activity metadata'));
    new vm.Script(code);
    builds++;
  } };
  const context = vm.createContext({ __dirname: path.join(ROOT, 'tools'),
    require(name) { return name === 'fs' ? mockedFs : require(name); },
    console: { log() {}, error(message) { assert.fail(message); } },
    process: { exit(code) { assert.fail(`Build failed: ${code}`); } }
  });
  new vm.Script(read('tools/build-standalone.js')).runInContext(context, { timeout: 5000 });
  assert.equal(builds, 1);
});