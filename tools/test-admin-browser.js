/* Real private-admin browser regression: node tools/test-admin-browser.js
 * Requires Edge (or ADMIN_BROWSER pointing to a Chromium executable), no packages.
 * The unchanged production page, CSS, JS, CSP and createAdminHandler are exercised
 * over loopback HTTP. Only the backing service is in memory; no Firebase SDK,
 * real access code, user data, external requests, or fake authentication responses.
 * All browser-generated files use a disposable workspace-local profile.
 */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const { EventEmitter } = require('node:events');
const { StringDecoder } = require('node:string_decoder');
const { createAdminHandler } = require('../functions/admin-handler');
const { AdminError, hash, WINDOW_MS } = require('../functions/admin-service');

const root = path.resolve(__dirname, '..');
const pagePath = '/statadmnaccprvt.html';
const apiPath = '/api/private-admin';
const clone = (value) => JSON.parse(JSON.stringify(value));
const timestamp = Date.now() - 60000;
// Reserved .example addresses and TEST-NET IPs; payloads must remain plain text.
const maliciousName = '<img src=x onerror="window.__adminXss=1">';
const maliciousEmail = '<svg onload="window.__adminXss=2">@reserved.example';
const maliciousAction = '<svg onload="window.__adminXss=3">';
const maliciousDevice = '<img src=x onerror="window.__adminXss=4">';
const maskedIp = '192.0.2.*';
const disclosedIp = '192.0.2.42';
const fixtures = [
  { uid: 'browser-fixture-one', displayName: maliciousName, email: maliciousEmail,
    disabled: false, emailVerified: true, createdAt: timestamp - 86400000,
    lastSignInAt: timestamp, providers: ['password'] },
  { uid: 'browser-fixture-two', displayName: 'Reserved fixture', email: 'second@reserved.example',
    disabled: true, emailVerified: false, createdAt: timestamp - 40 * 86400000,
    lastSignInAt: timestamp - 35 * 86400000, providers: ['google.com'] }
];
const summary = {
  consent: true, firstObservedAt: timestamp - 86400000, lastObservedAt: timestamp,
  totalEvents: 9, byModule: { tasks: 6, notes: 3 }, byAction: { create: 5, update: 4 },
  lastIpMasked: maskedIp, counts: { tasks: 3, events: 2, goals: 1, habits: 4, notes: 5, purchases: 0 }
};
const activity = [
  { id: 'fixture-event-one', at: timestamp, action: maliciousAction, module: 'tasks',
    device: maliciousDevice, ipMasked: maskedIp },
  { id: 'fixture-event-two', at: timestamp - 1000, action: 'update', module: 'notes',
    device: 'Synthetic browser fixture', ipMasked: maskedIp }
];

function memoryService() {
  const sessions = new Map();
  const attempts = new Map();
  const audit = [];
  const deleted = [];
  const calls = [];
  function account(uid) {
    const found = fixtures.find((item) => item.uid === uid);
    if (!found) throw new AdminError('not-found');
    return found;
  }
  const service = {
    async consumeLoginAttempt(ip) {
      assert.equal(ip, '127.0.0.1', 'Adapter must supply the trusted loopback IP');
      const now = Date.now();
      const buckets = [[`ip:${ip}`, 5], ['global', 50]].map(([key, maximum]) => ({
        key, maximum, times: (attempts.get(key) || []).filter((at) => at > now - WINDOW_MS)
      }));
      const blocked = buckets.filter((bucket) => bucket.times.length >= bucket.maximum);
      if (blocked.length) return { allowed: false, retryAfterSeconds: Math.max(1,
        Math.ceil(Math.max(...blocked.map((bucket) => bucket.times[0] + WINDOW_MS - now)) / 1000)) };
      for (const bucket of buckets) attempts.set(bucket.key, [...bucket.times, now]);
      return { allowed: true }; // Both successful and unsuccessful admitted logins count.
    },
    async createSession(value) {
      assert.match(value.id, /^[a-f0-9]{64}$/);
      assert.ok(!sessions.has(value.id), 'Session must be new');
      sessions.set(value.id, clone(value));
    },
    async getSession(id) { return sessions.has(id) ? clone(sessions.get(id)) : null; },
    async deleteSession(id) { deleted.push(id); sessions.delete(id); },
    async listAccounts({ pageSize, pageToken }) {
      calls.push('accounts');
      assert.equal(pageSize, 50);
      assert.equal(pageToken, undefined);
      return { accounts: clone(fixtures), nextPageToken: null };
    },
    async getAccount(uid) {
      calls.push('account');
      return { account: clone(account(uid)), summary: clone(summary) };
    },
    async getActivity({ uid, cursor }) {
      account(uid);
      calls.push('activity');
      assert.equal(cursor, undefined);
      return { events: clone(activity), nextCursor: null };
    },
    async revealIp({ uid, eventId, sessionId }) {
      account(uid);
      assert.equal(eventId, undefined);
      assert.ok(sessions.has(sessionId), 'Disclosure needs a real handler-created session');
      // Audit first, no raw IP, cookie, CSRF or access code in the audit record.
      audit.push({ action: 'revealIp', uid, eventId: null, sessionId,
        at: Date.now(), observedAt: timestamp });
      calls.push('revealIp');
      return { ip: disclosedIp, at: timestamp };
    }
  };
  return { service, sessions, attempts, audit, deleted, calls };
}

// Evaluated through CDP, not an inline page script or a replacement app module.
// Event-driven DOM waits also cover the real 30-second IP-remasking timer.
function waitForDom(predicateSource, label, timeout) {
  const predicate = new Function(`return (${predicateSource})()`);
  return new Promise((resolve, reject) => {
    let observer;
    const timer = setTimeout(() => {
      observer.disconnect();
      reject(new Error(`DOM timeout: ${label}`));
    }, timeout);
    const check = () => {
      try {
        if (!predicate()) return;
        clearTimeout(timer);
        observer.disconnect();
        resolve(true);
      } catch (error) { clearTimeout(timer); observer.disconnect(); reject(error); }
    };
    observer = new MutationObserver(check);
    observer.observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
    check();
  });
}

async function main() {
  const browser = process.env.ADMIN_BROWSER || [
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe'
  ].find((file) => fs.existsSync(file));
  assert.ok(browser && fs.existsSync(browser), 'Set ADMIN_BROWSER to an installed Edge/Chromium executable.');
  const hosting = JSON.parse(fs.readFileSync(path.join(root, 'firebase.json'), 'utf8')).hosting;
  const headers = hosting.headers.find((entry) => entry.source === pagePath)?.headers;
  const csp = headers?.find((header) => header.key.toLowerCase() === 'content-security-policy')?.value;
  assert.ok(csp, 'Production admin CSP must exist');
  const assets = new Map([
    [pagePath, { type: 'text/html; charset=utf-8', bytes: fs.readFileSync(path.join(root, pagePath.slice(1))) }],
    ['/css/admin.css', { type: 'text/css; charset=utf-8', bytes: fs.readFileSync(path.join(root, 'css/admin.css')) }],
    ['/js/admin.js', { type: 'text/javascript; charset=utf-8', bytes: fs.readFileSync(path.join(root, 'js/admin.js')) }]
  ]);
  const state = memoryService();
  // Random, process-local TEST-ONLY code. Never read secrets, env files or Firebase config.
  const testCode = `TEST-ONLY-${randomBytes(24).toString('hex')}`;
  const wrongCode = `WRONG-TEST-ONLY-${randomBytes(16).toString('hex')}`;
  const records = [];
  const serverErrors = [];
  const served = new Set();
  let handler;
  let origin;
  const server = http.createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url, origin).pathname;
      if (pathname === apiPath) {
        // The handler includes production defaults; this test transport admits
        // ONLY its exact dynamic loopback origin, never those deployed origins.
        if (req.headers.origin !== origin) { res.writeHead(403); res.end(); return; }
        const chunks = [];
        let size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 16384) { res.writeHead(413); res.end(); return; }
          chunks.push(chunk);
        }
        try { req.body = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
        catch { req.body = null; }
        req.path = pathname;
        req.ip = '127.0.0.1';
        req.secure = false;
        // Record only booleans/statuses, not credential-bearing bodies/headers.
        const incomingToken = /(?:^|;\s*)__session=([^;]+)/.exec(req.headers.cookie || '')?.[1];
        const session = incomingToken ? state.sessions.get(hash(incomingToken)) : null;
        const record = { action: req.body?.action, origin: req.headers.origin,
          sessionValid: !!session, csrfValid: !!session && req.headers['x-admin-csrf'] === session.csrfToken };
        res.status = (status) => { res.statusCode = status; return res; };
        res.json = (data) => {
          record.status = res.statusCode;
          record.error = data.error?.code;
          records.push(record);
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify(data));
          return res;
        };
        await handler(req, res);
        return;
      }
      const asset = assets.get(pathname);
      if (req.method !== 'GET' || !asset) { res.writeHead(404); res.end(); return; }
      served.add(pathname);
      if (pathname === pagePath) for (const header of headers) res.setHeader(header.key, header.value);
      else res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Content-Type', asset.type);
      res.end(asset.bytes);
    } catch (error) {
      serverErrors.push(error.message);
      if (!res.headersSent) res.writeHead(500);
      res.end();
    }
  });
  let child;
  let profile;
  let send;
  const pending = new Map();
  const checks = [];
  const pass = (label) => { checks.push(label); console.log(`PASS ${label}`); };
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    origin = `http://127.0.0.1:${server.address().port}`;
    handler = createAdminHandler({ service: state.service, getCode: () => testCode,
      emulator: true, allowedOrigins: [origin] });
    profile = fs.mkdtempSync(path.join(root, '.admin-browser-test-'));
    child = spawn(browser, [
      '--headless=new', '--no-first-run', '--no-default-browser-check',
      '--disable-background-networking', '--disable-component-update', '--disable-sync',
      '--disable-extensions', '--remote-debugging-pipe', `--user-data-dir=${profile}`, 'about:blank'
    ], { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] });
    const exited = new Promise((resolve) => child.once('exit', resolve));
    let stderr = '';
    let sequence = 0;
    let buffer = '';
    const decoder = new StringDecoder('utf8');
    const events = new EventEmitter();
    function rejectPending(error) {
      for (const item of pending.values()) { clearTimeout(item.timer); item.reject(error); }
      pending.clear();
    }
    child.on('error', rejectPending);
    child.on('exit', () => rejectPending(new Error('Browser exited before CDP response')));
    child.stderr.on('data', (chunk) => { stderr = (stderr + chunk).slice(-3000); });
    child.stdio[3].on('error', rejectPending);
    child.stdio[4].on('data', (chunk) => {
      buffer += decoder.write(chunk);
      let end;
      while ((end = buffer.indexOf('\0')) !== -1) {
        const text = buffer.slice(0, end);
        buffer = buffer.slice(end + 1);
        if (!text) continue;
        const message = JSON.parse(text);
        const item = pending.get(message.id);
        if (item) {
          pending.delete(message.id);
          clearTimeout(item.timer);
          if (message.error) item.reject(new Error(JSON.stringify(message.error)));
          else item.resolve(message.result);
        } else if (message.method) events.emit(message.method, message.params, message.sessionId);
      }
    });
    send = (method, params = {}, sessionId, timeout = 45000) => new Promise((resolve, reject) => {
      const id = ++sequence;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`CDP timeout: ${method}\n${stderr}`));
      }, timeout);
      pending.set(id, { resolve, reject, timer });
      child.stdio[3].write(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }) + '\0');
    });
    const target = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send('Target.attachToTarget', { targetId: target.targetId, flatten: true });
    const cdp = (method, params) => send(method, params, sessionId);
    const runtimeErrors = [];
    const cspErrors = [];
    const logs = [];
    const blocked = [];
    const responses = [];
    const requestUrls = new Map();
    const failedRequests = [];
    events.on('Runtime.exceptionThrown', (params) => runtimeErrors.push(params.exceptionDetails.text));
    events.on('Runtime.consoleAPICalled', (params) => {
      if (params.type === 'error' || params.type === 'assert') runtimeErrors.push(`console.${params.type}`);
    });
    events.on('Runtime.bindingCalled', (params) => {
      if (params.name === '__adminTestCsp') cspErrors.push(params.payload);
    });
    events.on('Audits.issueAdded', ({ issue }) => {
      if (issue.code === 'ContentSecurityPolicyIssue') cspErrors.push(JSON.stringify(issue.details));
    });
    events.on('Log.entryAdded', ({ entry }) => { if (entry.level === 'error') logs.push(entry); });
    events.on('Network.requestWillBeSent', ({ requestId, request }) => requestUrls.set(requestId, request.url));
    events.on('Network.loadingFailed', (event) => failedRequests.push({ url: requestUrls.get(event.requestId), reason: event.errorText }));
    events.on('Network.responseReceived', ({ response }) => responses.push({ url: response.url, status: response.status, headers: response.headers }));
    // Interception only blocks unintended traffic. Allowed requests continue to
    // the real server; never fulfill, mock fetch, inject cookies or bypass CSP.
    events.on('Fetch.requestPaused', (event) => {
      const url = new URL(event.request.url);
      const allowed = url.origin === origin && (assets.has(url.pathname) || url.pathname === apiPath || url.pathname === '/favicon.ico');
      if (!allowed) blocked.push(url.origin + url.pathname);
      void cdp(allowed ? 'Fetch.continueRequest' : 'Fetch.failRequest', {
        requestId: event.requestId, ...(!allowed ? { errorReason: 'BlockedByClient' } : {})
      }).catch((error) => runtimeErrors.push(error.message));
    });
    for (const domain of ['Page', 'Runtime', 'Network', 'Log', 'Audits']) await cdp(`${domain}.enable`);
    await cdp('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
    await cdp('Runtime.addBinding', { name: '__adminTestCsp' });
    await cdp('Page.addScriptToEvaluateOnNewDocument', { source: `
      document.addEventListener('securitypolicyviolation', event => {
        window.__adminTestCsp(JSON.stringify({ directive: event.effectiveDirective,
          blocked: event.blockedURI, disposition: event.disposition }));
      });
    ` });
    await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await cdp('Emulation.setFocusEmulationEnabled', { enabled: true });
    const evaluate = async (expression) => {
      const result = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
      return result.result.value;
    };
    const run = (fn, ...args) => evaluate(`(${fn.toString()})(${args.map((arg) => JSON.stringify(arg)).join(',')})`);
    const wait = (predicate, label, timeout = 15000) => run(waitForDom, predicate.toString(), label, timeout);
    const click = (selector) => run((selector) => {
      const element = document.querySelector(selector);
      if (!element || element.disabled || !element.getClientRects().length) throw new Error(`Not actionable: ${selector}`);
      element.click();
    }, selector);
    const navigate = async (reload = false) => {
      const loaded = new Promise((resolve, reject) => {
        const onLoad = (_, id) => { if (id === sessionId) { clearTimeout(timer); events.off('Page.loadEventFired', onLoad); resolve(); } };
        const timer = setTimeout(() => { events.off('Page.loadEventFired', onLoad); reject(new Error('Page load timeout')); }, 20000);
        events.on('Page.loadEventFired', onLoad);
      });
      await Promise.all([loaded, cdp(reload ? 'Page.reload' : 'Page.navigate', reload ? { ignoreCache: true } : { url: origin + pagePath })]);
    };
    const cookies = async () => (await cdp('Network.getCookies', { urls: [origin + apiPath] })).cookies;
    const noOverflow = async (label, table = false) => {
      const geometry = await run((table) => {
        const viewport = document.documentElement.clientWidth;
        const result = { viewport, inner: innerWidth, scroll: document.documentElement.scrollWidth,
          body: document.body.scrollWidth };
        if (table) {
          const wrapper = document.getElementById('account-table-wrap');
          const rect = wrapper.getBoundingClientRect();
          wrapper.scrollLeft = wrapper.scrollWidth;
          Object.assign(result, { left: rect.left, right: rect.right, width: wrapper.clientWidth,
            tableScroll: wrapper.scrollWidth, moved: wrapper.scrollLeft, overflow: getComputedStyle(wrapper).overflowX });
          wrapper.scrollLeft = 0;
        }
        return result;
      }, table);
      assert.equal(geometry.inner, 390, `${label}: layout viewport must be 390px`);
      assert.ok(geometry.scroll <= geometry.viewport && geometry.body <= geometry.viewport, `${label}: overflow ${JSON.stringify(geometry)}`);
      if (table) assert.ok(geometry.left >= 0 && geometry.right <= geometry.viewport + 1 &&
        geometry.tableScroll > geometry.width && geometry.moved > 0 && ['auto', 'scroll'].includes(geometry.overflow),
      `${label}: table must scroll inside its wrapper ${JSON.stringify(geometry)}`);
      pass(label);
    };
    const noSecretsInPage = async (cookie) => {
      assert.equal(await run((secrets) => {
        const storage = JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } });
        const visibleToScript = document.cookie + document.documentElement.outerHTML + storage;
        return document.cookie.includes('__session') || secrets.some((secret) => visibleToScript.includes(secret)) ||
          document.getElementById('private-code').value !== '';
      }, [testCode, wrongCode, cookie]), false, 'No code or HttpOnly token may be exposed to page DOM/cookies/storage');
    };

    await navigate();
    await wait(() => !document.getElementById('login-button').disabled, 'anonymous session check');
    assert.ok(records.some((record) => record.action === 'session' && record.status === 401 && !record.sessionValid));
    assert.equal(await run(() => !document.getElementById('lock-screen').hidden && document.getElementById('console').hidden), true);
    assert.equal(state.sessions.size, 0);
    pass('anonymous real-handler session is denied and displays login');
    await noOverflow('390px login has no viewport overflow');

    await run((code) => { document.getElementById('private-code').value = code; document.getElementById('login-form').requestSubmit(); }, wrongCode);
    await wait(() => !document.getElementById('login-button').disabled && document.getElementById('login-message').classList.contains('error'), 'wrong code refusal');
    assert.ok(records.some((record) => record.action === 'login' && record.status === 401));
    assert.equal(state.sessions.size, 0);
    assert.equal((await cookies()).some((cookie) => cookie.name === '__session'), false);
    assert.equal(await run(() => document.getElementById('console').hidden), true);
    pass('wrong TEST-only code is refused without creating a session');

    await run((code) => { document.getElementById('private-code').value = code; document.getElementById('login-form').requestSubmit(); }, testCode);
    await wait(() => !document.getElementById('console').hidden && document.getElementById('metric-loaded').textContent === '2', 'authenticated accounts');
    const cookie = (await cookies()).find((item) => item.name === '__session');
    assert.ok(cookie?.httpOnly && cookie.sameSite === 'Strict' && cookie.path === '/' && cookie.secure === false,
      'Real handler must set HttpOnly SameSite=Strict cookie (HTTP emulator only)');
    assert.ok(cookie.expires * 1000 > Date.now());
    const sessionIdHash = hash(cookie.value);
    assert.equal(state.sessions.size, 1);
    assert.ok(state.sessions.has(sessionIdHash), 'Browser cookie must correspond to the stored hashed session');
    assert.equal(state.attempts.get('ip:127.0.0.1').length, 2);
    assert.equal(state.attempts.get('global').length, 2);
    pass('random valid TEST-only code creates a real HttpOnly session; both login attempts counted');
    await noSecretsInPage(cookie.value);
    pass('access codes and session cookie are absent from document.cookie, DOM and Web Storage');
    assert.deepEqual(await run(() => ['loaded', 'enabled', 'verified', 'recent'].map((key) => document.getElementById(`metric-${key}`).textContent)), ['2', '1', '1', '1']);
    assert.ok(records.some((record) => record.action === 'accounts' && record.status === 200 && record.sessionValid && record.csrfValid));
    pass('real accounts request sends browser cookie and handler-issued CSRF; metrics match fixtures');
    await noOverflow('390px console has no viewport overflow; account table scrolls within its wrapper', true);
    assert.deepEqual(await run(() => ({ name: document.querySelector('.account-name').textContent,
      email: document.querySelector('.account-email').textContent,
      injected: !!document.querySelector('#accounts-body img, #accounts-body svg'), xss: !!window.__adminXss })),
    { name: maliciousName, email: maliciousEmail, injected: false, xss: false });
    pass('malicious fixture name and reserved email render only as text');

    // This deliberately unauthorized request uses the browser cookie store but
    // no CSRF; it does not call or replace the production client api function.
    const callsBefore = state.calls.length;
    assert.deepEqual(await run(async () => {
      const response = await fetch('/api/private-admin', { method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'accounts' }) });
      return { status: response.status, error: (await response.json()).error.code };
    }), { status: 403, error: 'csrf-required' });
    assert.equal(state.calls.length, callsBefore);
    pass('actual handler rejects browser-cookie request without CSRF before service access');

    await click('.account-name');
    await wait(() => document.getElementById('account-dialog').open && !document.getElementById('detail-content').hidden, 'account overview');
    const detail = await run(() => ({
      title: document.getElementById('detail-title').textContent, uid: document.getElementById('detail-uid').textContent,
      email: document.getElementById('detail-email').textContent,
      total: document.querySelector('#event-summary strong').textContent,
      items: [...document.querySelectorAll('#item-counts strong')].map((node) => node.textContent),
      modules: [...document.querySelectorAll('#module-chart .chart-label')].map((node) => node.textContent),
      widths: [...document.querySelectorAll('#module-chart .chart-fill')].map((node) => Number(node.getAttribute('width'))),
      overview: !document.getElementById('panel-overview').hidden,
      metadata: document.getElementById('account-metadata').textContent,
      actions: document.getElementById('action-counters').textContent
    }));
    assert.equal(detail.title, maliciousName);
    assert.equal(detail.email, maliciousEmail);
    assert.equal(detail.uid, fixtures[0].uid);
    assert.ok(detail.overview && detail.metadata.includes('password') && detail.metadata.includes('Email verified'));
    assert.equal(detail.total, '9');
    assert.deepEqual(detail.items, ['3', '2', '1', '4', '5', '0']);
    assert.deepEqual(detail.modules, ['tasks6 events', 'notes3 events']);
    assert.deepEqual(detail.widths, [100, 50]);
    assert.ok(detail.actions.includes('create5') && detail.actions.includes('update4'));
    pass('account dialog displays server metadata, count-only summary and correctly scaled overview SVG chart');
    await click('#tab-activity');
    await wait(() => document.querySelectorAll('#activity-list li').length === 2 && document.getElementById('activity-message').textContent.includes('End of available'), 'activity rendering');
    assert.deepEqual(await run(() => ({ action: document.querySelector('#activity-list h4').textContent,
      device: document.querySelector('#activity-list .event-device').textContent,
      injected: !!document.querySelector('#activity-list img, #activity-list svg, #activity-list script'), xss: !!window.__adminXss })),
    { action: maliciousAction, device: `Client-reported device: ${maliciousDevice}`, injected: false, xss: false });
    pass('activity injection payloads remain inert text with no injected elements');

    await click('#tab-security');
    assert.equal(await run(() => document.getElementById('latest-ip').textContent), maskedIp);
    assert.equal(await run((ip) => document.body.textContent.includes(ip), disclosedIp), false);
    assert.equal(state.audit.length, 0);
    pass('IP is masked by default with no automatic disclosure or audit');
    const reveal = async () => {
      const before = state.audit.length;
      await click('#reveal-ip');
      await wait(() => document.getElementById('reveal-ip').textContent === 'Hide IP address', 'audited reveal');
      assert.equal(await run(() => document.getElementById('latest-ip').textContent), disclosedIp);
      assert.equal(state.audit.length, before + 1);
      assert.equal(state.audit.at(-1).sessionId, sessionIdHash);
      assert.equal(state.audit.at(-1).uid, fixtures[0].uid);
      assert.equal(JSON.stringify(state.audit).includes(disclosedIp), false);
    };
    await reveal();
    pass('explicit IP reveal creates one session-attributed audit before disclosure');
    await click('#reveal-ip');
    assert.equal(await run(() => document.getElementById('latest-ip').textContent), maskedIp);
    assert.equal(state.audit.length, 1);
    pass('Hide IP remasks immediately without another disclosure');
    await reveal();
    await click('#tab-overview');
    assert.equal(await run(() => document.getElementById('latest-ip').textContent), maskedIp);
    pass('leaving Security remasks the disclosed IP');
    await click('#tab-security');
    await reveal();
    await wait(() => document.getElementById('reveal-ip').textContent === 'Reveal latest IP' &&
      document.getElementById('ip-time').textContent === '', 'real 30-second auto-remask', 35000);
    assert.equal(await run(() => document.getElementById('latest-ip').textContent), maskedIp);
    assert.equal(state.audit.length, 3);
    pass('real production 30-second timer remasks IP without mocked clocks');

    const loginCount = records.filter((record) => record.action === 'login').length;
    const recordCount = records.length;
    await navigate(true);
    await wait(() => !document.getElementById('console').hidden && document.getElementById('metric-loaded').textContent === '2', 'session restore after reload');
    assert.ok(records.slice(recordCount).some((record) => record.action === 'session' && record.status === 200 && record.sessionValid));
    assert.equal(records.filter((record) => record.action === 'login').length, loginCount);
    assert.ok((await cookies()).some((item) => item.name === '__session' && item.value === cookie.value && item.httpOnly));
    assert.equal(state.sessions.size, 1);
    await noSecretsInPage(cookie.value);
    pass('page reload restores the same real HttpOnly session without re-login or exposed secrets');
    await click('.account-name');
    await wait(() => !document.getElementById('detail-content').hidden, 'restored account details');
    await click('#tab-activity');
    await wait(() => document.querySelectorAll('#activity-list li').length === 2, 'restored activity');
    await click('#tab-security');
    await reveal();
    await click('#close-detail');
    // Close the modal first so the real lock control is not in an inert subtree.
    assert.equal(await run(() => {
      document.getElementById('lock-button').click();
      return document.getElementById('console').hidden && !document.getElementById('lock-screen').hidden &&
        document.getElementById('accounts-body').children.length === 0 &&
        document.getElementById('metric-loaded').textContent === '—';
    }), true, 'Client must erase directory synchronously, before awaiting logout');
    await wait(() => !document.getElementById('login-button').disabled && document.getElementById('login-message').textContent.includes('server session has been cleared'), 'server logout');
    assert.equal(state.sessions.size, 0);
    assert.ok(state.deleted.includes(sessionIdHash));
    assert.ok(records.some((record) => record.action === 'logout' && record.status === 200 && record.sessionValid && record.csrfValid));
    assert.equal((await cookies()).some((item) => item.name === '__session'), false);
    pass('logout immediately locks the UI, deletes the server session and clears the browser cookie');
    assert.equal(await run((sensitive) => {
      const ids = ['accounts-body', 'detail-email', 'detail-uid', 'detail-avatar', 'detail-badges',
        'account-metadata', 'event-summary', 'observation-metadata', 'module-chart', 'action-counters',
        'item-counts', 'security-metadata', 'activity-list', 'ip-time'];
      return ids.every((id) => document.getElementById(id).childNodes.length === 0) &&
        !document.getElementById('account-dialog').open && document.getElementById('detail-content').hidden &&
        document.getElementById('latest-ip').textContent === 'Not recorded' &&
        ['loaded', 'enabled', 'verified', 'recent'].every((key) => document.getElementById(`metric-${key}`).textContent === '—') &&
        sensitive.every((value) => !document.documentElement.outerHTML.includes(value)) &&
        localStorage.length === 0 && sessionStorage.length === 0;
    }, [fixtures[0].uid, maliciousName, maliciousEmail, maliciousDevice, disclosedIp]), true);
    await noSecretsInPage(cookie.value);
    pass('logout leaves no account, chart, activity, IP, metrics or session data in DOM/storage');

    // Replay only the discarded TEST cookie over Node HTTP, not by installing a
    // cookie in the browser. The actual handler must consult the deleted map entry.
    const replay = await new Promise((resolve, reject) => {
      const request = http.request(origin + apiPath, { method: 'POST', headers: {
        Origin: origin, 'Content-Type': 'application/json', Cookie: `__session=${cookie.value}`
      } }, (response) => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => { body += chunk; });
        response.on('end', () => { try { resolve({ status: response.statusCode, data: JSON.parse(body) }); } catch (error) { reject(error); } });
      });
      request.on('error', reject);
      request.setTimeout(10000, () => request.destroy(new Error('Replay request timeout')));
      request.end(JSON.stringify({ action: 'session' }));
    });
    assert.equal(replay.status, 401);
    assert.equal(replay.data.error.code, 'unauthorized');
    pass('replaying the old cookie after logout is denied by the actual server handler');
    await navigate(true);
    await wait(() => !document.getElementById('login-button').disabled, 'logged-out reload');
    assert.equal(await run(() => document.getElementById('console').hidden && !document.getElementById('lock-screen').hidden), true);
    pass('reload after logout stays locked');

    const documents = responses.filter((response) => response.url === origin + pagePath);
    assert.equal(documents.length, 3);
    for (const response of documents) {
      const actual = Object.fromEntries(Object.entries(response.headers).map(([key, value]) => [key.toLowerCase(), value]));
      for (const header of headers) assert.equal(actual[header.key.toLowerCase()], header.value, `Production header ${header.key} must be unchanged`);
      assert.equal(actual['content-security-policy'], csp);
    }
    pass('all page loads receive exact production admin CSP and security headers from firebase.json');
    assert.deepEqual([...served].sort(), [...assets.keys()].sort());
    assert.deepEqual(blocked, [], 'No external or unapproved page requests may occur');
    assert.deepEqual(serverErrors, []);
    assert.ok(records.every((record) => record.origin === origin));
    assert.ok(records.filter((record) => record.status === 200 && !['login', 'session'].includes(record.action))
      .every((record) => record.sessionValid && record.csrfValid));
    pass('only the three production assets and loopback real-handler API are used; no Firebase access');
    // Chromium reports expected 401/403 HTTP responses as network-level console
    // entries, not JS errors. An optional automatic favicon request gets a 404;
    // it is not served as a fourth asset. No other errors are exempted.
    const unexpectedLogs = logs.filter((entry) => !(entry.source === 'network' &&
      ((entry.url === origin + apiPath && /\b(401|403)\b/.test(entry.text)) ||
       (entry.url === origin + '/favicon.ico' && /\b404\b/.test(entry.text)))));
    assert.deepEqual(unexpectedLogs.map((entry) => ({ source: entry.source, text: entry.text, url: entry.url })), []);
    assert.deepEqual(failedRequests, []);
    assert.deepEqual(runtimeErrors, []);
    assert.deepEqual(cspErrors, []);
    assert.equal(await run(() => !!window.__adminXss), false);
    pass('zero runtime errors, CSP violations or unexpected network failures across login, use and reloads');
    // Save the exit promise for cleanup without a race with Browser.close.
    child.testExit = exited;
  } finally {
    if (child) {
      const exited = child.testExit || (child.exitCode !== null || child.signalCode !== null
        ? Promise.resolve() : new Promise((resolve) => child.once('exit', resolve)));
      try { if (child.exitCode === null && child.signalCode === null && send) await send('Browser.close', {}, undefined, 5000); }
      catch { child.kill(); }
      let timer;
      try {
        await Promise.race([exited, new Promise((_, reject) => {
          timer = setTimeout(() => { child.kill(); reject(new Error('Browser shutdown timeout')); }, 10000);
        })]);
      } finally { clearTimeout(timer); }
    }
    for (const item of pending.values()) clearTimeout(item.timer);
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
    if (profile) fs.rmSync(profile, { recursive: true, force: true, maxRetries: 12, retryDelay: 250 });
  }
  assert.ok(!profile || !fs.existsSync(profile), 'Disposable workspace profile must be removed');
  pass('workspace-local browser profile is cleaned up');
  console.log(`PASS ${checks.length} private-admin real-browser regression checks.`);
}

main().catch((error) => { console.error(`FAIL ${error.stack || error.message}`); process.exitCode = 1; });