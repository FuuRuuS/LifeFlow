'use strict';

// Offline only. Native loopback HTTP/HTTPS; no Admin SDK initialization, installs,
// network Firebase calls, credential files, temp files, or persistent fixtures.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const https = require('node:https');
const net = require('node:net');
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes, generateKeyPairSync, sign, X509Certificate } = require('node:crypto');
const { createPrivateServer, readServerConfig } = require('../functions/private-server');
const { start, validateStartup } = require('../functions/start-private');
const ROOT = path.resolve(__dirname, '..');
const freshCode = () => randomBytes(32).toString('base64url');
const ORIGIN = 'http://127.0.0.1:8787';
const PROD = 'https://private.example.test';

function memoryService() {
  const sessions = new Map(), ips = [];
  return {
    sessions, ips,
    async consumeLoginAttempt(ip) { ips.push(ip); return { allowed: true }; },
    async createSession(session) { sessions.set(session.id, { ...session }); },
    async getSession(id) { return sessions.get(id); },
    async deleteSession(id) { sessions.delete(id); },
    async listAccounts() { return { accounts: [{ uid: 'test-user', email: 'test@example.invalid' }], nextPageToken: null }; }
  };
}

async function setup(t, env = {}, extra = {}) {
  const config = readServerConfig(env), service = memoryService();
  let code = freshCode();
  const server = createPrivateServer({ config, adminService: service, getCode: () => code, ...extra });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, config.host, resolve); });
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }));
  const request = (body, options = {}) => new Promise((resolve, reject) => {
    const bytes = options.rawBody !== undefined ? options.rawBody : body === undefined ? undefined : JSON.stringify(body);
    const headers = { Host: config.originHost, Origin: config.origin, ...(bytes === undefined ? {} : { 'Content-Type': 'application/json' }), ...options.headers };
    for (const key of Object.keys(headers)) if (headers[key] === undefined) delete headers[key];
    const transport = config.mode === 'tls' ? https : http;
    const req = transport.request({ hostname: config.host, port: server.address().port,
      path: options.path ?? '/api/private-admin', method: options.method ?? 'POST', headers,
      agent: false, ...(options.tls ?? {}) }, (res) => {
      const chunks = [];
      res.on('data', (data) => chunks.push(data));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let json; try { json = JSON.parse(text); } catch { /* Static body. */ }
        resolve({ status: res.statusCode, headers: res.headers, text, json });
      });
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(3000, () => req.destroy(new Error('Offline request timed out.')));
    req.end(bytes);
  });
  return { config, service, server, request, code: () => code, rotate: () => { code = freshCode(); } };
}

function sessionHeaders(response) {
  return { Cookie: response.headers['set-cookie'][0].split(';')[0], 'X-Admin-CSRF': response.json.csrfToken };
}

test('local config defaults, explicit matching origins and mapped ports', () => {
  assert.equal(readServerConfig({}).origin, ORIGIN);
  assert.equal(readServerConfig({}).port, 8787);
  assert.equal(readServerConfig({ PRIVATE_HOST: '::1', PRIVATE_ORIGIN: 'http://[::1]:8787' }).host, '::1');
  assert.equal(readServerConfig({ PRIVATE_ORIGIN: 'http://localhost:8787' }).originHost, 'localhost:8787');
  assert.equal(readServerConfig({ PRIVATE_SERVER_MODE: 'proxy', PRIVATE_ORIGIN: 'https://private.example.test:9443',
    PRIVATE_PORT: '8787', PRIVATE_TRUSTED_PROXIES: '127.0.0.1, ::1' }).port, 8787);
});

test('invalid modes, origins, host bindings, ports, proxies and TLS paths fail closed', () => {
  const invalid = [
    { PRIVATE_SERVER_MODE: 'other' }, { PRIVATE_HOST: '0.0.0.0' }, { PRIVATE_HOST: 'localhost' },
    { PRIVATE_PORT: '8788' }, { PRIVATE_ORIGIN: 'http://127.0.0.1:8788' },
    { PRIVATE_HOST: '::1' }, { PRIVATE_ORIGIN: 'http://[::1]:8787' },
    ...['0', '65536', '-1', '8787x', '1.1', ' 8787'].map((PRIVATE_PORT) => ({ PRIVATE_PORT })),
    ...['http://remote.example.test', 'http://127.1:8787', 'http://127.0.0.2:8787', 'http://app.localhost:8787',
      `${ORIGIN}/`, `${ORIGIN}/admin`, `${ORIGIN}?x=1`, `${ORIGIN}#x`, 'http://user@127.0.0.1:8787',
      'HTTP://127.0.0.1:8787', 'null', 'https://127.0.0.1:8787'].map((PRIVATE_ORIGIN) => ({ PRIVATE_ORIGIN })),
    { PRIVATE_SERVER_MODE: 'tls', PRIVATE_ORIGIN: PROD },
    { PRIVATE_SERVER_MODE: 'tls', PRIVATE_ORIGIN: PROD, PRIVATE_TLS_KEY_FILE: 'missing' },
    { PRIVATE_ENABLE_ACTIVITY: 'yes' }, { PRIVATE_ENABLE_ACTIVITY_CLEANUP: '1' }
  ];
  for (const PRIVATE_SERVER_MODE of ['proxy', 'tls']) {
    for (const PRIVATE_ORIGIN of [ORIGIN, 'http://private.example.test', 'https://localhost', 'https://x.localhost', 'https://127.0.0.2', 'https://[::1]']) {
      invalid.push({ PRIVATE_SERVER_MODE, PRIVATE_ORIGIN, PRIVATE_TLS_KEY_FILE: 'test', PRIVATE_TLS_CERT_FILE: 'test', PRIVATE_TRUSTED_PROXIES: '127.0.0.1' });
    }
  }
  for (const PRIVATE_TRUSTED_PROXIES of [undefined, '', '*', '127.0.0.0/8', 'localhost', '127.0.0.1,', 'fe80::1%lo', '127.0.0.1:80']) {
    invalid.push({ PRIVATE_SERVER_MODE: 'proxy', PRIVATE_ORIGIN: PROD, PRIVATE_TRUSTED_PROXIES });
  }
  for (const env of invalid) assert.throws(() => readServerConfig(env));
  assert.throws(() => createPrivateServer({ config: readServerConfig({ PRIVATE_SERVER_MODE: 'tls', PRIVATE_ORIGIN: PROD,
    PRIVATE_TLS_KEY_FILE: path.join(ROOT, 'nonexistent-test-key'), PRIVATE_TLS_CERT_FILE: path.join(ROOT, 'nonexistent-test-cert') }),
    adminService: memoryService(), getCode: freshCode }), /check TLS/);
});

test('real handler: exact code, HttpOnly cookie, CSRF, authenticated accounts and logout revocation', async (t) => {
  const f = await setup(t);
  assert.equal((await f.request({ action: 'login', code: freshCode() })).status, 401);
  assert.equal((await f.request({ action: 'login', code: ` ${f.code()}` })).status, 401);
  assert.equal((await f.request({ action: 'accounts' })).status, 401);
  const login = await f.request({ action: 'login', code: f.code() });
  assert.equal(login.status, 200);
  const cookie = login.headers['set-cookie'][0];
  assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Strict/); assert.match(cookie, /Max-Age=1800/);
  assert.doesNotMatch(cookie, /; Secure/);
  assert.equal(login.json.authenticated, true);
  assert.equal(login.text.includes(f.code()), false);
  assert.equal(login.text.includes(cookie.split(';')[0].slice('__session='.length)), false);
  const headers = sessionHeaders(login);
  assert.equal((await f.request({ action: 'accounts' }, { headers: { Cookie: headers.Cookie } })).status, 403);
  assert.equal((await f.request({ action: 'accounts' }, { headers: { ...headers, 'X-Admin-CSRF': 'x'.repeat(32) } })).status, 403);
  assert.equal((await f.request({ action: 'session' }, { headers: { Cookie: headers.Cookie } })).status, 200);
  assert.equal((await f.request({ action: 'accounts' }, { headers })).json.accounts[0].uid, 'test-user');
  assert.equal((await f.request({ action: 'unknown' }, { headers })).status, 400);
  const logout = await f.request({ action: 'logout' }, { headers });
  assert.equal(logout.status, 200); assert.match(logout.headers['set-cookie'][0], /Max-Age=0/);
  assert.equal(f.service.sessions.size, 0);
  assert.equal((await f.request({ action: 'accounts' }, { headers })).status, 401);
});

test('rotation invalidates existing sessions and old codes; provider read on each request', async (t) => {
  const f = await setup(t);
  const oldCode = f.code();
  const login = await f.request({ action: 'login', code: oldCode });
  f.rotate();
  assert.equal((await f.request({ action: 'accounts' }, { headers: sessionHeaders(login) })).status, 401);
  assert.equal(f.service.sessions.size, 0);
  assert.equal((await f.request({ action: 'login', code: oldCode })).status, 401);
  assert.equal((await f.request({ action: 'login', code: f.code() })).status, 200);
});

test('missing/invalid/throwing secret providers and service exceptions produce fixed safe errors', async (t) => {
  for (const getCode of [() => undefined, () => 'short', () => ' '.repeat(10), () => 'a'.repeat(257), () => { throw new Error(freshCode()); }]) {
    const f = await setup(t, {}, { getCode });
    const response = await f.request({ action: 'login', code: freshCode() });
    assert.equal(response.status, 503);
    assert.deepEqual(response.json, { error: { code: 'service-unavailable', message: 'The private admin service is unavailable.' } });
  }
  const f = await setup(t);
  const sensitive = freshCode();
  f.service.consumeLoginAttempt = async () => { throw new Error(sensitive); };
  const response = await f.request({ action: 'login', code: f.code() });
  assert.equal(response.status, 503); assert.equal(response.text.includes(sensitive), false);
});

test('outer Origin gate excludes Firebase defaults, absent/null and forged origins', async (t) => {
  const f = await setup(t);
  for (const Origin of [undefined, 'null', 'https://planner-project-7ab9e.web.app', 'https://planner-project-7ab9e.firebaseapp.com',
    'http://localhost:8787', 'https://evil.example', `${ORIGIN}/`, `${ORIGIN}.evil.example`]) {
    for (const method of ['POST', 'OPTIONS']) {
      const response = await f.request({ action: 'login', code: f.code() }, { method, headers: { Origin } });
      assert.equal(response.status, 403); assert.equal(response.headers['access-control-allow-origin'], undefined);
    }
  }
  const response = await f.request(undefined, { method: 'OPTIONS' });
  assert.equal(response.status, 204); assert.equal(response.text, '');
  assert.equal(response.headers['access-control-allow-origin'], ORIGIN);
  assert.equal(f.service.ips.length, 0);
});

test('strict Host covers health, static, redirects, APIs and unknown routes', async (t) => {
  const f = await setup(t);
  for (const Host of ['evil.example', '127.0.0.1', 'localhost:8787', '127.0.0.1:8787.evil.example', '127.0.0.1:8788']) {
    for (const route of ['/', '/healthz', '/statadmnaccprvt.html', '/css/admin.css', '/js/admin.js', '/api/private-admin', '/unknown']) {
      assert.equal((await f.request(undefined, { method: 'GET', path: route, headers: { Host } })).status, 403);
    }
  }
});

test('static fixed allowlist, traversal rejection, security headers, correct HEAD and health minimalism', async (t) => {
  const f = await setup(t);
  const hosting = JSON.parse(fs.readFileSync(path.join(ROOT, 'firebase.json'), 'utf8')).hosting;
  const expectedHeaders = hosting.headers.find((entry) => entry.source === '/statadmnaccprvt.html').headers;
  for (const route of ['/statadmnaccprvt.html', '/css/admin.css', '/js/admin.js']) {
    const get = await f.request(undefined, { method: 'GET', path: route, headers: { Origin: 'https://unrelated.example' } });
    const head = await f.request(undefined, { method: 'HEAD', path: route });
    assert.equal(get.status, 200); assert.equal(head.status, 200); assert.equal(head.text, '');
    assert.equal(Number(get.headers['content-length']), Buffer.byteLength(get.text));
    assert.equal(head.headers['content-length'], get.headers['content-length']);
    assert.equal(get.headers['cache-control'], route.endsWith('.html') ? 'no-store' : 'no-cache');
    for (const { key, value } of expectedHeaders.filter((entry) => entry.key !== 'Cache-Control')) assert.equal(get.headers[key.toLowerCase()], value);
    assert.equal(get.text.includes(f.code()), false);
    assert.equal(get.headers['set-cookie'], undefined);
  }
  for (const route of ['/functions/private-server.js', '/functions/start-private.js', '/functions/admin-service.js', '/firebase.json',
    '/.env', '/.git/config', '/service-account.json', '/js/config.js', '/js/app.bundle.js', '/index.html', '/sw.js',
    '/css/', '/unknown', '/../statadmnaccprvt.html', '/css/../statadmnaccprvt.html', '/%2e%2e/statadmnaccprvt.html',
    '/%73tatadmnaccprvt.html', '/css/%2e%2e/functions/private-server.js', '//statadmnaccprvt.html', '/statadmnaccprvt.html/extra',
    '/api/private-admin/', '/api/%70rivate-admin', '/api/activity']) {
    const response = await f.request(undefined, { method: 'GET', path: route });
    assert.equal(response.status, 404, route); assert.equal(response.text.includes(f.code()), false);
  }
  const redirect = await f.request(undefined, { method: 'GET', path: '/' });
  assert.equal(redirect.status, 303); assert.equal(redirect.headers.location, '/statadmnaccprvt.html');
  const health = await f.request(undefined, { method: 'GET', path: '/healthz' });
  assert.deepEqual(health.json, { ok: true }); assert.equal(health.headers['cache-control'], 'no-store');
  assert.equal((await f.request(undefined, { method: 'HEAD', path: '/healthz' })).status, 404);
});

test('JSON parser rejects malformed, non-object, wrong type/encoding, invalid UTF-8 and oversized bodies', async (t) => {
  const f = await setup(t);
  for (const rawBody of ['', '{', 'null', '[]', '"text"', Buffer.from([0xff])]) {
    assert.equal((await f.request(undefined, { rawBody })).status, 400);
  }
  for (const type of [undefined, 'text/plain', 'application/jsonp', 'application/json;evil=true', 'application/json; charset=latin1']) {
    assert.equal((await f.request({ action: 'login', code: f.code() }, { headers: { 'Content-Type': type } })).status, 400);
  }
  assert.equal((await f.request({}, { headers: { 'Content-Encoding': 'gzip' } })).status, 400);
  for (const headers of [{}, { 'Transfer-Encoding': 'chunked' }]) {
    assert.equal((await f.request(undefined, { rawBody: ' '.repeat(16385), headers })).status, 413);
  }
  const prefix = JSON.stringify({ action: 'login', code: f.code() });
  assert.equal((await f.request(undefined, { rawBody: prefix + ' '.repeat(16384 - Buffer.byteLength(prefix)) })).status, 200);
  assert.equal((await f.request({ action: 'login', code: f.code() }, { headers: { 'Content-Type': 'application/json; charset=utf-8' } })).status, 200);
  assert.equal((await f.request(undefined, { method: 'GET' })).status, 405);
  assert.equal((await f.request({}, { path: '/statadmnaccprvt.html' })).status, 405);
});

function rawRequest(server, request) {
  return new Promise((resolve, reject) => {
    const socket = net.connect(server.address().port, '127.0.0.1');
    const chunks = [];
    socket.setTimeout(3000, () => socket.destroy(new Error('Raw request timed out.')));
    socket.on('connect', () => socket.write(request));
    socket.on('data', (chunk) => chunks.push(chunk));
    socket.on('end', () => resolve(Buffer.concat(chunks).toString()));
    socket.on('error', reject);
  });
}

test('duplicate security headers fail closed; rejected methods do not wait for a body', async (t) => {
  const f = await setup(t);
  const base = 'GET /healthz HTTP/1.1\r\nHost: 127.0.0.1:8787\r\nConnection: close\r\n';
  assert.match(await rawRequest(f.server, base + 'Host: evil.example\r\n\r\n'), /^HTTP\/1\.1 403/);
  const api = 'POST /api/private-admin HTTP/1.1\r\nHost: 127.0.0.1:8787\r\nConnection: close\r\n';
  assert.match(await rawRequest(f.server, api + `Origin: ${ORIGIN}\r\nOrigin: ${ORIGIN}\r\nContent-Length: 0\r\n\r\n`), /^HTTP\/1\.1 403/);
  assert.match(await rawRequest(f.server, `GET /api/private-admin HTTP/1.1\r\nHost: 127.0.0.1:8787\r\nOrigin: ${ORIGIN}\r\nContent-Length: 999999\r\n\r\n`), /^HTTP\/1\.1 405/);
  assert.equal(f.server.requestTimeout, 20000); assert.equal(f.server.headersTimeout, 10000);
  assert.equal(f.server.timeout, 20000);
});

test('native parser failures are fixed JSON and inactivity destroys sockets', async (t) => {
  const f = await setup(t);
  const raw = await rawRequest(f.server, 'GET / HTTP/1.1\r\nHost: 127.0.0.1:8787\r\nInvalid\u0000Header: x\r\nConnection: close\r\n\r\n');
  assert.match(raw, /^HTTP\/1\.1 400/);
  assert.deepEqual(JSON.parse(raw.split('\r\n\r\n')[1]), { error: { code: 'invalid-request', message: 'Invalid HTTP request.' } });
  // Speed up the configured socket deadline only; exercise the real teardown callback.
  f.server.setTimeout(25);
  assert.equal(await rawRequest(f.server, ''), '');
});

test('local mode ignores spoofed forwarding for rate-limit context', async (t) => {
  const f = await setup(t);
  const response = await f.request({ action: 'login', code: f.code() }, { headers: {
    'X-Forwarded-For': '203.0.113.99, 198.51.100.1', 'X-Forwarded-Proto': 'https', Forwarded: 'for=203.0.113.99;proto=https'
  } });
  assert.equal(response.status, 200); assert.deepEqual(f.service.ips, ['127.0.0.1']);
});

test('proxy accepts exactly one allowlisted hop and passes trusted IP/HTTPS to real handler', async (t) => {
  const f = await setup(t, { PRIVATE_SERVER_MODE: 'proxy', PRIVATE_ORIGIN: PROD, PRIVATE_TRUSTED_PROXIES: '127.0.0.1' });
  const headers = { 'X-Forwarded-For': '203.0.113.9', 'X-Forwarded-Proto': 'https' };
  const login = await f.request({ action: 'login', code: f.code() }, { headers });
  assert.equal(login.status, 200); assert.match(login.headers['set-cookie'][0], /; Secure/);
  assert.deepEqual(f.service.ips, ['203.0.113.9']);
  const accounts = await f.request({ action: 'accounts' }, { headers: { ...headers, ...sessionHeaders(login) } });
  assert.equal(accounts.status, 200);
  for (const ip of [undefined, '', '203.0.113.9, 127.0.0.1', 'unknown', '203.0.113.9:80', '[::1]', 'fe80::1%eth0']) {
    assert.equal((await f.request({}, { headers: { ...headers, 'X-Forwarded-For': ip } })).status, 403);
  }
  for (const proto of [undefined, '', 'http', 'https,http', 'HTTPS']) {
    assert.equal((await f.request({}, { headers: { ...headers, 'X-Forwarded-Proto': proto } })).status, 403);
  }
  assert.equal((await f.request(undefined, { path: '/healthz', method: 'GET' })).status, 403);
  const raw = `GET /healthz HTTP/1.1\r\nHost: private.example.test\r\nX-Forwarded-For: 203.0.113.9\r\nX-Forwarded-For: 203.0.113.9\r\nX-Forwarded-Proto: https\r\nConnection: close\r\n\r\n`;
  assert.match(await rawRequest(f.server, raw), /^HTTP\/1\.1 403/);
  const untrusted = await setup(t, { PRIVATE_SERVER_MODE: 'proxy', PRIVATE_ORIGIN: PROD, PRIVATE_TRUSTED_PROXIES: '192.0.2.1' });
  assert.equal((await untrusted.request({ action: 'login', code: untrusted.code() }, { headers })).status, 403);
  assert.equal(untrusted.service.ips.length, 0);
});

// Generate an ephemeral self-signed certificate entirely in memory using DER.
// Only the two explicit TLS read paths are injected; the server and TLS handshake
// remain native. Trust this certificate explicitly, never disable verification.
function certificateFixture() {
  const der = (tag, ...parts) => {
    const body = Buffer.concat(parts.map((part) => Buffer.isBuffer(part) ? part : Buffer.from(part)));
    let length = Buffer.from([body.length]);
    if (body.length >= 128) {
      let hex = body.length.toString(16); if (hex.length % 2) hex = '0' + hex;
      const bytes = Buffer.from(hex, 'hex'); length = Buffer.concat([Buffer.from([0x80 | bytes.length]), bytes]);
    }
    return Buffer.concat([Buffer.from([tag]), length, body]);
  };
  const seq = (...values) => der(0x30, ...values);
  const algorithm = seq(Buffer.from('06092a864886f70d01010b0500', 'hex'));
  const name = seq(der(0x31, seq(Buffer.from('0603550403', 'hex'), der(0x0c, 'private.example.test'))));
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const tbs = seq(der(2, [1]), algorithm, name,
    seq(der(0x17, '200101000000Z'), der(0x17, '400101000000Z')), name,
    publicKey.export({ type: 'spki', format: 'der' }));
  const certDer = seq(tbs, algorithm, der(3, [0], sign('sha256', tbs, privateKey)));
  const cert = new X509Certificate(certDer).toString();
  return { key: privateKey.export({ type: 'pkcs8', format: 'pem' }), cert };
}

test('native TLS reads key/certificate, ignores spoofed forwarding and sets Secure cookie', async (t) => {
  const fixture = certificateFixture();
  const original = fs.readFileSync;
  const keyPath = path.join(ROOT, 'test-only-injected-key');
  const certPath = path.join(ROOT, 'test-only-injected-cert');
  fs.readFileSync = function (file, ...args) {
    if (file === keyPath) return fixture.key;
    if (file === certPath) return fixture.cert;
    return original.call(this, file, ...args);
  };
  let f;
  try {
    f = await setup(t, { PRIVATE_SERVER_MODE: 'tls', PRIVATE_ORIGIN: PROD, PRIVATE_TLS_KEY_FILE: keyPath, PRIVATE_TLS_CERT_FILE: certPath });
  } finally { fs.readFileSync = original; }
  assert.ok(f.server instanceof https.Server);
  const response = await f.request({ action: 'login', code: f.code() }, {
    tls: { ca: fixture.cert, servername: 'private.example.test' },
    headers: { 'X-Forwarded-For': '203.0.113.99', 'X-Forwarded-Proto': 'http' }
  });
  assert.equal(response.status, 200); assert.match(response.headers['set-cookie'][0], /; Secure/);
  assert.deepEqual(f.service.ips, ['127.0.0.1']);
});

test('optional activity delegates Firebase ID verification and preserves consent result', async (t) => {
  const calls = [];
  let consent = false;
  const f = await setup(t, { PRIVATE_ENABLE_ACTIVITY: 'true' }, {
    auth: { async verifyIdToken(token, revoked) {
      calls.push({ token, revoked });
      if (token !== 'test-token') throw new Error('Private provider detail');
      return { uid: 'test-user' };
    } },
    activityService: { async record(event) {
      calls.push(event);
      return consent ? { recorded: true } : { recorded: false, reason: 'consent-required' };
    } }
  });
  const body = { action: 'page_view', module: 'dashboard' }, options = { path: '/api/activity', headers: { Authorization: 'Bearer test-token' } };
  assert.equal((await f.request(body, { path: '/api/activity' })).status, 401);
  const denied = await f.request(body, options);
  assert.deepEqual(denied.json, { recorded: false, reason: 'consent-required' });
  assert.deepEqual(calls[0], { token: 'test-token', revoked: true });
  assert.equal(calls[1].ip, '127.0.0.1'); assert.equal(calls[1].uid, 'test-user');
  consent = true;
  assert.deepEqual((await f.request(body, options)).json, { recorded: true });
  assert.equal((await f.request(body, { ...options, headers: { ...options.headers, Origin: 'null' } })).status, 403);
  assert.throws(() => createPrivateServer({ config: readServerConfig({ PRIVATE_ENABLE_ACTIVITY: 'true' }), adminService: memoryService(), getCode: freshCode }), /activity requires/);
});

const launcherEnv = () => ({ PRIVATE_ADMIN_CODE: freshCode(), GOOGLE_CLOUD_PROJECT: 'private-test-project' });

test('launcher import is inert; Node22, code, explicit project, credential paths and deliberate emulators required', () => {
  const env = launcherEnv();
  assert.throws(() => validateStartup(env, '18.18.1'), /Node.js 22/);
  for (const PRIVATE_ADMIN_CODE of [undefined, '', 'short', ' '.repeat(8), 'x'.repeat(257)]) {
    assert.throws(() => validateStartup({ ...env, PRIVATE_ADMIN_CODE }, '22.0.0'), /PRIVATE_ADMIN_CODE/);
  }
  assert.throws(() => validateStartup({ PRIVATE_ADMIN_CODE: freshCode() }, '22.0.0'), /explicit Firebase project/);
  assert.equal(validateStartup({ PRIVATE_ADMIN_CODE: freshCode(), GCLOUD_PROJECT: 'private-test-project' }, '22.0.0').projectId, 'private-test-project');
  assert.throws(() => validateStartup({ ...env, GOOGLE_APPLICATION_CREDENTIALS: __filename }, '22.0.0'), /external file/);
  assert.throws(() => validateStartup({ ...env, GOOGLE_APPLICATION_CREDENTIALS: path.join(ROOT, '..', 'nonexistent-test-adc') }, '22.0.0'), /external file/);
  for (const name of ['FIREBASE_AUTH_EMULATOR_HOST', 'FIRESTORE_EMULATOR_HOST']) {
    assert.throws(() => validateStartup({ ...env, [name]: '127.0.0.1:9099' }, '22.0.0'), /emulator variables/);
    assert.equal(validateStartup({ ...env, [name]: '127.0.0.1:9099', PRIVATE_ALLOW_FIREBASE_EMULATORS: 'true' }, '22.0.0').config.mode, 'local');
    assert.throws(() => validateStartup({ ...env, [name]: '127.0.0.1:9099', PRIVATE_ALLOW_FIREBASE_EMULATORS: 'true',
      PRIVATE_SERVER_MODE: 'proxy', PRIVATE_ORIGIN: PROD, PRIVATE_TRUSTED_PROXIES: '127.0.0.1' }, '22.0.0'), /emulator variables/);
  }
  assert.equal(Object.keys(require.cache).some((file) => /node_modules[\\/]firebase-(?:admin|functions)/.test(file)), false);
});

function launchFixture() {
  const calls = [], logs = [];
  const backend = {
    auth: { async listUsers(n) { calls.push(['users', n]); return { users: [] }; } },
    db: { collection(name) {
      return { where() { return this; }, limit(n) {
        return { async get() { calls.push(['read', name, n]); return { docs: [] }; } };
      } };
    } },
    async dispose() { calls.push(['dispose']); }
  };
  return { calls, logs, backend, options: {
    env: launcherEnv(), nodeVersion: '22.0.0', loadAdmin: async () => backend,
    logger: { log: (text) => logs.push(text), error: (text) => logs.push(text) },
    createServer(args) {
      calls.push(['server']);
      const server = createPrivateServer(args), listen = server.listen;
      server.listen = function (_port, host, callback) { return listen.call(this, 0, host, callback); };
      return server;
    }
  } };
}

test('launcher performs both bounded preflights before listening and closes cleanly without deleting sessions', async () => {
  const f = launchFixture();
  const before = process.listenerCount('SIGINT');
  const running = await start(f.options);
  try {
    assert.deepEqual(f.calls, [['users', 1], ['read', '_privateAdminSessions', 1], ['server']]);
    assert.equal(running.server.listening, true);
    assert.ok(f.logs.some((text) => text.includes('cleanup OFF') && text.includes('TTL')));
    assert.ok(f.logs.some((text) => text.includes('private-test-project')));
    assert.equal(f.logs.join('\n').includes(f.options.env.PRIVATE_ADMIN_CODE), false);
  } finally { await running.close(); await running.close(); }
  assert.equal(running.server.listening, false);
  assert.deepEqual(f.calls.at(-1), ['dispose']);
  assert.equal(process.listenerCount('SIGINT'), before);
});

test('launcher failures are early, actionable and sanitized; failed preflights never listen', async () => {
  for (const stage of ['config', 'sdk', 'auth', 'db', 'listen']) {
    const f = launchFixture(), sensitive = freshCode();
    if (stage === 'config') delete f.options.env.PRIVATE_ADMIN_CODE;
    if (stage === 'sdk') f.options.loadAdmin = async () => { throw new Error(sensitive); };
    if (stage === 'auth') f.backend.auth.listUsers = async () => { throw new Error(sensitive); };
    if (stage === 'db') f.backend.db.collection = () => { throw new Error(sensitive); };
    if (stage === 'listen') f.options.createServer = () => { throw new Error(sensitive); };
    await assert.rejects(start(f.options), (error) => {
      assert.equal(error.message.includes(sensitive), false);
      assert.equal(error.message.includes(f.options.env.PRIVATE_ADMIN_CODE ?? sensitive), false);
      return true;
    });
    assert.equal(f.calls.some(([name]) => name === 'server'), false);
    assert.equal(f.logs.join('\n').includes(sensitive), false);
  }
});

test('enabled startup cleanup is bounded to ten pages, nonoverlapping and shutdown waits safely', { timeout: 5000 }, async () => {
  const f = launchFixture();
  f.options.env.PRIVATE_ENABLE_ACTIVITY_CLEANUP = 'true';
  let pages = 0, active = 0, maximum = 0;
  const expired = Array.from({ length: 500 }, (_, i) => ({ ref: { path: `accountAudit/test-user/activityEvents/test-${i}` }, data: () => ({ expireAt: new Date(0) }) }));
  let completed;
  const completion = new Promise((resolve) => { completed = resolve; });
  f.backend.db.collectionGroup = (name) => {
    assert.equal(name, 'activityEvents');
    return { where() { return { limit(n) { assert.equal(n, 500); return { async get() {
      active++; maximum = Math.max(maximum, active); pages++;
      return { docs: expired };
    } }; } }; } };
  };
  f.backend.db.batch = () => ({ delete() {}, async commit() {
    active--; if (pages === 10) completed();
  } });
  const running = await start(f.options);
  try { await completion; } finally { await running.close(); }
  assert.equal(pages, 10); assert.equal(maximum, 1);
  assert.equal(running.server.listening, false);
  assert.deepEqual(f.calls.at(-1), ['dispose']);
});