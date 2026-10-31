'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../js/arcade/ice.js'), 'utf8')
  .replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '');
const relay = { urls: ['turn:relay.example:3478?transport=udp', 'turns:relay.example:443?transport=tcp'], username: 'short-lived-user', credential: 'test-credential' };
function client({ config = {}, responses = [], user, protocol = 'https:' } = {}) {
  const requests = [];
  const tokens = [];
  const auth = { currentUser: user === null ? null : user || { uid: 'user', getIdToken: async (force) => { tokens.push(force); return 'test-id-token'; } } };
  const context = vm.createContext({
    auth, RTC: { credentialsUrl: '/api/rtc-ice', iceServers: [], ...config }, firebaseConfig: { projectId: 'test-project' },
    location: { protocol, href: protocol === 'file:' ? 'file:///app/index.html' : 'https://app.example/index.html' },
    URL, Date, AbortController, setTimeout, clearTimeout,
    fetch: async (url, options) => {
      requests.push({ url, options });
      const response = responses.shift();
      if (response instanceof Error) throw response;
      assert.ok(response, 'Unexpected relay request');
      return { status: response.status || 200, ok: !response.status || response.status < 400,
        headers: { get: () => response.type || 'application/json' }, json: async () => response.body };
    }
  });
  vm.runInContext(source + '\nglobalThis.load = loadIceConfig;', context);
  return { load: context.load, requests, tokens, auth };
}
const success = () => ({ body: { iceServers: [relay], expiresAt: Date.now() + 3600000 } });

test('authenticated TURN credentials are cached by room and manually refreshable', async () => {
  const c = client({ responses: [success(), success(), success()] });
  const first = await c.load('ROOMCODE');
  assert.equal(first.relayAvailable, true);
  assert.equal(first.warning, null);
  assert.equal(first.config.iceCandidatePoolSize, 0);
  assert.equal(c.requests[0].options.headers.Authorization, 'Bearer test-id-token');
  assert.equal(c.requests[0].options.credentials, 'omit');
  assert.equal(c.requests[0].options.redirect, 'error');
  assert.deepEqual(JSON.parse(c.requests[0].options.body), { roomCode: 'ROOMCODE' });
  await c.load('ROOMCODE'); assert.equal(c.requests.length, 1);
  await c.load('ROOMCODE', { force: true }); assert.equal(c.requests.length, 2);
  await c.load('OTHERROOM'); assert.equal(c.requests.length, 3);
});
test('expired token refreshes once; force-relay mode is propagated', async () => {
  const c = client({ config: { forceRelay: true }, responses: [{ status: 401 }, success()] });
  const result = await c.load('ROOMCODE');
  assert.deepEqual(c.tokens, [false, true]);
  assert.equal(result.config.iceTransportPolicy, 'relay');
});
test('undeployed HTML endpoint and provider failures produce specific warnings, not false relay success', async () => {
  for (const [response, code] of [
    [{ type: 'text/html' }, 'relay-not-deployed'],
    [{ status: 503, body: { error: { code: 'relay-not-configured' } } }, 'relay-not-configured'],
    [{ status: 403, body: { error: { code: 'origin-not-allowed' } } }, 'origin-not-allowed'],
    [new Error('private network exception'), 'relay-unavailable'],
    [{ body: { iceServers: [relay], expiresAt: Date.now() - 1 } }, 'relay-provider-failed']
  ]) {
    const result = await client({ responses: [response] }).load('ROOMCODE');
    assert.equal(result.relayAvailable, false);
    assert.equal(result.warning.code, code);
    assert.ok(!JSON.stringify(result).includes('private network exception'));
  }
});
test('unsafe credential endpoints never receive a Firebase token', async () => {
  const c = client({ config: { credentialsUrl: 'http://not-local.example/relay' } });
  const result = await c.load('ROOMCODE');
  assert.equal(result.relayAvailable, false);
  assert.equal(c.requests.length, 0);
  assert.equal(c.tokens.length, 0);
});
test('no auth does not fetch; static TURN works without backend and missing credentials are rejected', async () => {
  const missing = client({ user: null });
  assert.equal((await missing.load('ROOMCODE')).warning.code, 'unauthorized');
  assert.equal(missing.requests.length, 0);
  const configured = client({ config: { credentialsUrl: '', iceServers: [relay] } });
  assert.equal((await configured.load('ROOMCODE')).relayAvailable, true);
  const invalid = client({ config: { credentialsUrl: '', iceServers: [{ urls: relay.urls }, { ...relay, urls: ['turn:relay.example:53'] }] } });
  assert.equal((await invalid.load('ROOMCODE')).relayAvailable, false);
});
test('switching accounts cannot reuse cached relay credentials', async () => {
  const c = client({ responses: [success(), success()] });
  await c.load('ROOMCODE');
  c.auth.currentUser = { uid: 'other', getIdToken: async () => 'other-token' };
  await c.load('ROOMCODE');
  assert.equal(c.requests.length, 2);
  assert.equal(c.requests[1].options.headers.Authorization, 'Bearer other-token');
});