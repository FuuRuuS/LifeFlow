'use strict';

// Run: node --test tools/test-arcade.js
// Dependency-free source-level regression tests. No production files are rewritten.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const clone = (value) => JSON.parse(JSON.stringify(value));
const flush = () => new Promise((resolve) => setImmediate(resolve));
const unexpected = (name) => () => { throw new Error(`Unexpected mock call: ${name}`); };

function loadSource(relative, mocks, expose) {
  // Only remove static imports and declaration exports used by these modules.
  // A syntax change outside this narrow contract should fail, not silently rewrite logic.
  const source = fs.readFileSync(path.join(ROOT, relative), 'utf8')
    .replace(/^import\s+[\s\S]*?\s+from\s+['"][^'"\r\n]+['"];[ \t]*\r?\n/gm, '')
    .replace(/^export\s+(?=(?:async\s+)?function\b|const\b|let\b|class\b)/gm, '');
  const context = vm.createContext({ console, URLSearchParams, setTimeout, clearTimeout, ...mocks });
  new vm.Script(`${source}\n;globalThis.__test = { ${expose} };`, {
    filename: path.join(ROOT, relative)
  }).runInContext(context, { timeout: 2000 });
  return context.__test;
}

function eventTarget() {
  const listeners = new Map();
  const attached = [];
  return {
    attached,
    addEventListener(type, fn) {
      attached.push(type);
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
    },
    removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
    dispatchEvent(event) {
      for (const fn of listeners.get(event.type) || []) fn(event);
      this[`on${event.type}`]?.(event);
      return true;
    }
  };
}

function browser(hash = '#/games') {
  const window = eventTarget();
  const document = { ...eventTarget(), title: '' };
  const location = { hash, href: `https://example.test/${hash}`, protocol: 'https:' };
  const replacements = [];
  const history = {
    replaceState(_state, _title, target) {
      replacements.push(target);
      location.hash = target;
      // Deliberately no hashchange: browsers do not emit one for replaceState.
    }
  };
  return {
    window, document, location, history, replacements,
    addEventListener: window.addEventListener.bind(window),
    removeEventListener: window.removeEventListener.bind(window),
    CustomEvent: class { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } }
  };
}

function roomData(overrides = {}) {
  return {
    code: 'TESTROOM', gameId: 'stub', hostUid: 'host', hostTab: 'host-tab',
    guestUid: null, guestTab: null, guestJoin: null,
    host: { name: 'Host' }, guest: null, level: 'even',
    state: { turn: 0, moves: [] }, seq: 0, round: 0, outcome: null,
    media: { a: { cam: true, mic: true }, b: { cam: false, mic: false } },
    rematch: { a: false, b: false }, chat: [], offer: null, answer: null,
    ...overrides
  };
}

function seatedRoom(overrides = {}) {
  return roomData({ guestUid: 'guest', guestTab: 'guest-tab', guestJoin: 'old-token',
    guest: { name: 'Guest' }, ...overrides });
}

function database(initial) {
  let value = clone(initial);
  let tail = Promise.resolve();
  const stats = { transactions: 0, writes: 0 };
  const ref = 'rooms/TESTROOM';
  function patch(target, updates) {
    for (const [key, entry] of Object.entries(updates)) {
      const parts = key.split('.');
      const leaf = parts.pop();
      let parent = target;
      for (const part of parts) parent = parent[part] ||= {};
      parent[leaf] = clone(entry);
    }
  }
  return {
    read: () => clone(value), stats,
    mocks: {
      db: {}, doc: (_db, collection, code) => `${collection}/${code}`,
      collection: unexpected('collection'), setDoc: unexpected('setDoc'),
      updateDoc: unexpected('nontransactional updateDoc'), deleteDoc: unexpected('deleteDoc'),
      onSnapshot: unexpected('onSnapshot'), getDocs: unexpected('getDocs'),
      serverTimestamp: () => 'SERVER_TIMESTAMP',
      runTransaction(_db, callback) {
        stats.transactions++;
        // Serial execution models valid Firestore transaction ordering. Reads are
        // isolated clones; writes are staged and published only if the callback succeeds.
        const result = tail.then(async () => {
          const pending = [];
          const answer = await callback({
            async get(requested) {
              assert.equal(requested, ref);
              const snapshot = clone(value);
              return { exists: () => snapshot !== null, data: () => clone(snapshot) };
            },
            update(requested, updates) {
              assert.equal(requested, ref);
              pending.push(clone(updates));
            }
          });
          for (const updates of pending) { patch(value, updates); stats.writes++; }
          return answer;
        });
        tail = result.catch(() => {});
        return result;
      }
    }
  };
}

function roomClient(db, uid, tab) {
  const storage = new Map([['lf:tab', tab]]);
  return loadSource('js/arcade/rooms.js', {
    ...db.mocks, crypto: webcrypto, recordActivity: () => {},
    store: { state: { uid, profile: { name: uid } } },
    sessionStorage: { getItem: (key) => storage.get(key), setItem: (key, val) => storage.set(key, val) }
  }, 'joinRoom, pushState, restart');
}

function oneWinner(results, message) {
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  const failures = results.filter((r) => r.status === 'rejected');
  assert.equal(failures.length, 1);
  assert.match(failures[0].reason.message, message);
}

test('joinRoom atomically admits exactly one of two racing guests', async () => {
  const db = database(roomData());
  const clients = ['guest-1', 'guest-2'].map((uid) => roomClient(db, uid, `${uid}-tab`));
  const results = await Promise.allSettled(clients.map((client) => client.joinRoom('TESTROOM')));
  oneWinner(results, /already has two players/);
  const winner = results.findIndex((r) => r.status === 'fulfilled');
  assert.equal(results[winner].value.seat, 1);
  assert.equal(db.read().guestUid, `guest-${winner + 1}`);
  assert.equal(db.read().guestTab, `guest-${winner + 1}-tab`);
  assert.equal(db.stats.transactions, 2);
  assert.equal(db.stats.writes, 1);
});

test('same-tab host rejoin keeps seat zero and does not change the room', async () => {
  const initial = seatedRoom();
  const db = database(initial);
  const result = await roomClient(db, 'host', 'host-tab').joinRoom('TESTROOM');
  assert.equal(result.seat, 0);
  assert.deepEqual(clone(result.data), initial);
  assert.deepEqual(db.read(), initial);
  assert.equal(db.stats.writes, 0);
});

test('guest rejoin refreshes the arrival token and resets only guest media/rematch and signaling', async () => {
  const db = database(seatedRoom({
    media: { a: { cam: true, mic: true }, b: { cam: true, mic: true } },
    rematch: { a: true, b: true }, offer: { sdp: 'old-offer' }, answer: { sdp: 'old-answer' }
  }));
  const before = db.read();
  const result = await roomClient(db, 'guest', 'guest-tab').joinRoom('TESTROOM');
  const after = db.read();
  assert.equal(result.seat, 1);
  assert.ok(after.guestJoin);
  assert.notEqual(after.guestJoin, before.guestJoin);
  assert.deepEqual(after.media, { a: before.media.a, b: { cam: false, mic: false } });
  assert.deepEqual(after.rematch, { a: true, b: false });
  assert.equal(after.offer, null);
  assert.equal(after.answer, null);
  assert.deepEqual(after.state, before.state);
  assert.equal(after.seq, before.seq);
  for (const key of ['guestUid', 'guestTab', 'guestJoin', 'media', 'rematch', 'offer', 'answer']) {
    assert.deepEqual(clone(result.data[key]), after[key], `returned ${key} matches stored room`);
  }
});

test('one account can occupy two tabs, but a third same-account tab is refused', async () => {
  const db = database(roomData({ hostUid: 'shared-account' }));
  const guest = await roomClient(db, 'shared-account', 'second-tab').joinRoom('TESTROOM');
  assert.equal(guest.seat, 1);
  const before = db.read();
  await assert.rejects(roomClient(db, 'shared-account', 'third-tab').joinRoom('TESTROOM'), /already has two players/);
  assert.deepEqual(db.read(), before);
  assert.equal(db.stats.writes, 1);
});

test('pushState rejects a stale sequence without changing stored state', async () => {
  const db = database(seatedRoom({ seq: 4 }));
  const before = db.read();
  await assert.rejects(roomClient(db, 'host', 'host-tab').pushState('TESTROOM', {
    state: { turn: 1, moves: ['stale'] }, seq: 4, outcome: null
  }), /board changed/i);
  assert.deepEqual(db.read(), before);
  assert.equal(db.stats.writes, 0);
});

test('concurrent pushState moves at the same sequence have exactly one winner', async () => {
  const db = database(seatedRoom({ rematch: { a: true, b: true } }));
  const clients = [roomClient(db, 'host', 'host-tab'), roomClient(db, 'guest', 'guest-tab')];
  const moves = ['first', 'second'].map((move) => ({ state: { turn: 1, moves: [move] }, seq: 1 }));
  const results = await Promise.allSettled(clients.map((client, i) => client.pushState('TESTROOM', moves[i])));
  oneWinner(results, /board changed/i);
  const winner = results.findIndex((r) => r.status === 'fulfilled');
  assert.deepEqual(db.read().state, moves[winner].state);
  assert.equal(db.read().seq, 1);
  assert.deepEqual(db.read().rematch, { a: false, b: false });
  assert.equal(db.stats.writes, 1);
});

test('restart conflicts with another restart or move instead of overwriting it', async (t) => {
  for (const order of [['restart', 'restart'], ['restart', 'move'], ['move', 'restart']]) {
    await t.test(order.join(' then '), async () => {
      const db = database(seatedRoom({ seq: 7, round: 2 }));
      const client = roomClient(db, 'host', 'host-tab');
      const states = order.map((kind, i) => ({ turn: i, moves: [`${kind}-${i}`] }));
      const results = await Promise.allSettled(order.map((kind, i) => kind === 'restart'
        ? client.restart('TESTROOM', states[i], 8, 3)
        : client.pushState('TESTROOM', { state: states[i], seq: 8 })));
      oneWinner(results, /board changed/i);
      const winner = results.findIndex((r) => r.status === 'fulfilled');
      assert.deepEqual(db.read().state, states[winner]);
      assert.equal(db.read().seq, 8);
      assert.equal(db.read().round, order[winner] === 'restart' ? 3 : 2);
      assert.equal(db.stats.writes, 1);
      const before = db.read();
      await assert.rejects(client.restart('TESTROOM', { turn: 0, moves: [] }, 8, 4), /board changed/i);
      assert.deepEqual(db.read(), before);
    });
  }
});

function gamesHarness(room = seatedRoom(), roomOverrides = {}) {
  const env = browser();
  const bindings = [];
  const toasts = [];
  const leaves = [];
  let applies = 0;
  const board = { innerHTML: '' };
  const table = eventTarget();
  const root = {
    dataset: {}, innerHTML: '',
    querySelector: (selector) => ({ '[data-board]': board, '[data-arcade-root]': table })[selector] || null,
    querySelectorAll: () => []
  };
  const game = {
    meta: { id: 'stub', title: 'Stub', rules: [], levels: [] },
    outcome: () => ({ over: false }), turn: (state) => state.turn,
    apply(state, move) { applies++; return { ...state, turn: 1 - state.turn, moves: [...state.moves, move] }; },
    view: (_state, ctx) => ctx.myTurn ? 'enabled' : 'disabled',
    bind: (slot, state, ctx, play) => bindings.push({ slot, state, ctx, play })
  };
  const rooms = {
    SEAT_KEYS: ['a', 'b'], CHAT_MAX: 400,
    watchRoom: () => () => {},
    leaveRoom: (...args) => { leaves.push(args); return Promise.resolve(); },
    pushState: unexpected('pushState'), pushMedia: async () => {},
    ...roomOverrides
  };
  const api = loadSource('js/views/games.js', {
    ...env, rooms, store: { state: { uid: 'host', profile: { name: 'Host' } } },
    localStorage: { getItem: () => null },
    esc: (value) => String(value ?? ''), initials: () => 'H', icon: () => '',
    haptic: () => {}, toast: (...args) => toasts.push(args), confetti: unexpected('confetti'),
    modal: unexpected('modal'), navigate: unexpected('navigate'), currentQuery: () => ({}),
    GAMES: [game], gameById: () => game, canCall: () => false, createCall: unexpected('createCall')
  }, `onRoomChange, commit, paintBoard, openRoom, unmount,
      setSession(value) { session = value; }, setRoot(value) { rootEl = value; },
      getSession() { return session; }`);
  const session = {
    key: 'room:TESTROOM:0', mode: 'remote', game, room, state: room.state,
    seq: room.seq, round: room.round, seat: 0, code: 'TESTROOM', names: ['Host', 'Guest'],
    timers: [], media: { cam: false, mic: false }, peerMedia: { cam: false, mic: false }
  };
  api.setRoot(root);
  api.setSession(session);
  return { api, env, session, game, root, board, bindings, toasts, leaves, applies: () => applies };
}

test('onRoomChange rebinds the waiting host board enabled when a guest arrives at the same seq', () => {
  const h = gamesHarness(roomData());
  h.api.paintBoard();
  assert.equal(h.bindings.length, 1);
  assert.equal(h.bindings[0].ctx.myTurn, false);
  assert.equal(h.board.innerHTML, 'disabled');
  const arrival = seatedRoom();
  h.api.onRoomChange(arrival);
  assert.equal(h.bindings.length, 2, 'seating change must rebind even without a new sequence');
  assert.equal(h.bindings[1].ctx.myTurn, true);
  assert.equal(h.board.innerHTML, 'enabled');
  assert.strictEqual(h.bindings[1].state, arrival.state);
  assert.equal(typeof h.bindings[1].play, 'function');
  h.api.onRoomChange({ ...arrival, chat: [] });
  assert.equal(h.bindings.length, 2, 'unchanged seating/seq does not rebind');
  h.api.onRoomChange(roomData());
  assert.equal(h.bindings.length, 3);
  assert.equal(h.bindings[2].ctx.myTurn, false);
});

test('failed commit keeps state/seq, blocks double submit, and unlocks a retry until authoritative snapshot', async () => {
  let rejectSave;
  const calls = [];
  const pending = new Promise((_resolve, reject) => { rejectSave = reject; });
  const h = gamesHarness(seatedRoom({ seq: 5 }), {
    pushState: (...args) => { calls.push(args); return calls.length === 1 ? pending : Promise.resolve(); }
  });
  const original = h.session.state;
  const originalValue = clone(original);
  const saving = h.api.commit('first');
  assert.equal(h.session.saving, true);
  assert.equal(h.bindings.at(-1).ctx.myTurn, false);
  assert.strictEqual(h.session.state, original);
  assert.equal(h.session.seq, 5);
  await h.api.commit('double-submit');
  assert.equal(calls.length, 1);
  assert.equal(h.applies(), 1, 'double submit must not even apply a second move');
  rejectSave(new Error('simulated offline save'));
  await saving;
  assert.strictEqual(h.session.state, original);
  assert.deepEqual(original, originalValue);
  assert.equal(h.session.seq, 5);
  assert.equal(h.session.saving, false);
  assert.equal(h.bindings.at(-1).ctx.myTurn, true);
  assert.ok(h.toasts.some(([message, kind]) => /simulated offline save/.test(message) && kind === 'error'));

  await h.api.commit('retry');
  assert.equal(calls.length, 2);
  assert.equal(calls[0][1].seq, 6);
  assert.equal(calls[1][1].seq, 6, 'retry must reuse the uncommitted sequence');
  assert.deepEqual(clone(calls[1][1].state.moves), ['retry']);
  assert.strictEqual(h.session.state, original, 'write acknowledgment alone is not authoritative state');
  assert.equal(h.session.seq, 5);
  assert.equal(h.session.saving, false);
  h.api.onRoomChange(seatedRoom({ seq: 6, state: calls[1][1].state }));
  assert.equal(h.session.seq, 6);
  assert.deepEqual(clone(h.session.state.moves), ['retry']);
  assert.equal(h.bindings.at(-1).ctx.myTurn, false, 'snapshot advances the turn');
});

function routerHarness(hash) {
  const env = browser(hash);
  const api = loadSource('js/router.js', env,
    'route, setGuard, navigate, resolve, startRouter, getCurrent, currentQuery');
  return { api, env };
}

test('router replace navigation resolves and renders query without a hashchange', async () => {
  const { api, env } = routerHarness('#/login');
  const renders = [];
  const navigated = [];
  env.window.addEventListener('lf:navigated', (event) => navigated.push(event.detail.path));
  api.route('/games', { title: 'Games', render: (query) => renders.push(clone(query)) });
  api.navigate('/games?room=TESTROOM', { replace: true });
  await flush();
  assert.equal(api.getCurrent(), '/games');
  assert.deepEqual(renders, [{ room: 'TESTROOM' }]);
  assert.deepEqual(navigated, ['/games']);
  assert.equal(env.document.title, 'Games · LifeFlow');
  assert.deepEqual(env.replacements, ['#/games?room=TESTROOM']);
  api.navigate('#/games?room=TESTROOM', { replace: true });
  await flush();
  assert.equal(renders.length, 2, 'same-hash navigation also resolves');
  assert.equal(env.replacements.length, 1);
});

test('auth guard redirects private invite to login and signed-in login back to the invite', async () => {
  const { api, env } = routerHarness('#/games?room=TESTROOM');
  let signedIn = false;
  const renders = [];
  api.route('/login', { title: 'Login', public: true, render: () => renders.push('login') });
  api.route('/games', { title: 'Games', render: (query) => renders.push(`games:${query.room}`) });
  api.setGuard((route, config) => {
    if (!signedIn && !config?.public) return '/login';
    if (signedIn && route === '/login') return '/games?room=TESTROOM';
    return null;
  });
  api.startRouter();
  await flush();
  assert.equal(api.getCurrent(), '/login');
  assert.deepEqual(renders, ['login'], 'guarded view must not render before authentication');
  assert.equal(env.location.hash, '#/login');
  signedIn = true;
  api.navigate('/login', { replace: true });
  await flush();
  assert.equal(api.getCurrent(), '/games');
  assert.deepEqual(renders, ['login', 'games:TESTROOM']);
  assert.deepEqual(env.replacements, ['#/login', '#/games?room=TESTROOM']);
});

test('refresh does not attach a beforeunload deletion handler; explicit unmount still leaves', async (t) => {
  for (const seat of [0, 1]) {
    await t.test(seat === 0 ? 'host refresh' : 'guest refresh', () => {
      const h = gamesHarness();
      h.api.setSession(null);
      const room = seatedRoom();
      h.api.openRoom({ code: 'TESTROOM', game: h.game, seat, state: room.state, room });
      assert.equal(h.api.getSession().seat, seat);
      assert.deepEqual(h.leaves, []);
      assert.equal(h.env.location.hash, '#/games?room=TESTROOM');
      assert.equal(h.env.window.attached.includes('beforeunload'), false);
      assert.equal(h.env.document.attached.includes('beforeunload'), false);
      assert.equal(h.env.window.onbeforeunload == null, true);
      for (const type of ['beforeunload', 'pagehide', 'unload']) {
        h.env.window.dispatchEvent({ type });
      }
      assert.deepEqual(h.leaves, [], 'refresh lifecycle must not evict either seat');
      assert.ok(h.api.getSession());
      h.api.unmount();
      assert.deepEqual(h.leaves, [['TESTROOM', seat]], 'explicit navigation still releases the seat');
      assert.equal(h.api.getSession(), null);
    });
  }
});