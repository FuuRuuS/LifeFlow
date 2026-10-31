'use strict';

// Native adapter only: importing this module never initializes Firebase.
const http = require('node:http');
const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');
const { normalizeIp } = require('./admin-service');
const { createAdminHandler } = require('./admin-handler');
const { createActivityHandler } = require('./activity-handler');

const ROOT = path.resolve(__dirname, '..');
const MAX_BODY = 16 * 1024;
const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; font-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";

function readServerConfig(env = process.env) {
  const mode = env.PRIVATE_SERVER_MODE ?? 'local';
  const host = env.PRIVATE_HOST ?? '127.0.0.1';
  const portText = String(env.PRIVATE_PORT ?? '8787');
  const origin = env.PRIVATE_ORIGIN ?? 'http://127.0.0.1:8787';
  if (!['local', 'tls', 'proxy'].includes(mode)) throw new Error('PRIVATE_SERVER_MODE must be local, tls or proxy.');
  if (!normalizeIp(host)) throw new Error('PRIVATE_HOST must be an exact IP bind address.');
  if (!/^[1-9][0-9]{0,4}$/.test(portText) || Number(portText) > 65535) throw new Error('PRIVATE_PORT must be 1 through 65535.');
  let url;
  try { url = new URL(origin); } catch { throw new Error('PRIVATE_ORIGIN must be a canonical origin.'); }
  if (url.origin !== origin || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('PRIVATE_ORIGIN must be an exact canonical origin without credentials, path, query or fragment.');
  }
  const localName = url.hostname === 'localhost' || url.hostname.endsWith('.localhost') ||
    /^127\./.test(url.hostname) || url.hostname === '[::1]';
  if (mode === 'local') {
    if (!['127.0.0.1', '::1'].includes(host) || url.protocol !== 'http:' ||
        !['localhost', host === '::1' ? '[::1]' : '127.0.0.1'].includes(url.hostname) ||
        Number(url.port || 80) !== Number(portText)) {
      throw new Error('Local mode requires a loopback bind and matching localhost/loopback HTTP origin and port.');
    }
  } else if (url.protocol !== 'https:' || localName) {
    throw new Error('Production modes require a non-localhost HTTPS PRIVATE_ORIGIN.');
  }
  const tlsKeyFile = env.PRIVATE_TLS_KEY_FILE;
  const tlsCertFile = env.PRIVATE_TLS_CERT_FILE;
  if (mode === 'tls' && (!tlsKeyFile || !tlsCertFile)) {
    throw new Error('TLS mode requires PRIVATE_TLS_KEY_FILE and PRIVATE_TLS_CERT_FILE.');
  }
  let trustedProxies = [];
  if (mode === 'proxy') {
    const entries = typeof env.PRIVATE_TRUSTED_PROXIES === 'string' ? env.PRIVATE_TRUSTED_PROXIES.split(',') : [];
    if (!entries.length || entries.some((ip) => !normalizeIp(ip.trim()))) {
      throw new Error('Proxy mode requires PRIVATE_TRUSTED_PROXIES: comma-separated exact IPs, never CIDRs or names.');
    }
    trustedProxies = [...new Set(entries.map((ip) => normalizeIp(ip.trim())))];
  }
  for (const name of ['PRIVATE_ENABLE_ACTIVITY', 'PRIVATE_ENABLE_ACTIVITY_CLEANUP']) {
    if (env[name] !== undefined && !['true', 'false'].includes(env[name])) throw new Error(`${name} must be true or false.`);
  }
  return Object.freeze({ mode, host, port: Number(portText), origin, originHost: url.host,
    tlsKeyFile, tlsCertFile, trustedProxies: Object.freeze(trustedProxies),
    activityEnabled: env.PRIVATE_ENABLE_ACTIVITY === 'true',
    activityCleanupEnabled: env.PRIVATE_ENABLE_ACTIVITY_CLEANUP === 'true' });
}

function singleHeader(req, name) {
  let count = 0;
  for (let i = 0; i < req.rawHeaders.length; i += 2) if (req.rawHeaders[i].toLowerCase() === name) count++;
  return count === 1 && typeof req.headers[name] === 'string' ? req.headers[name] : undefined;
}

function createPrivateServer({ config, adminService, getCode, activityService, auth, staticRoot = ROOT }) {
  // Revalidate the public factory input, including callers that spread/modify config.
  config = readServerConfig({ PRIVATE_SERVER_MODE: config.mode, PRIVATE_HOST: config.host,
    PRIVATE_PORT: config.port, PRIVATE_ORIGIN: config.origin,
    PRIVATE_TLS_KEY_FILE: config.tlsKeyFile, PRIVATE_TLS_CERT_FILE: config.tlsCertFile,
    PRIVATE_TRUSTED_PROXIES: config.trustedProxies?.join(','),
    PRIVATE_ENABLE_ACTIVITY: String(config.activityEnabled ?? false),
    PRIVATE_ENABLE_ACTIVITY_CLEANUP: String(config.activityCleanupEnabled ?? false) });
  if (!adminService || typeof getCode !== 'function') throw new Error('Admin service and code provider are required.');
  if (config.activityEnabled && (!activityService || !auth)) throw new Error('Enabled activity requires its service and Firebase auth adapter.');
  const handlerOptions = { allowedOrigins: [config.origin], emulator: config.mode === 'local' };
  const admin = createAdminHandler({ ...handlerOptions, service: adminService, getCode });
  const activity = config.activityEnabled
    ? createActivityHandler({ ...handlerOptions, service: activityService, auth }) : null;
  // Never resolve a URL into a filesystem path, and never serve a directory or SPA fallback.
  const files = new Map([
    ['/statadmnaccprvt.html', ['statadmnaccprvt.html', 'text/html; charset=utf-8']],
    ['/css/admin.css', ['css/admin.css', 'text/css; charset=utf-8']],
    ['/js/admin.js', ['js/admin.js', 'text/javascript; charset=utf-8']]
  ].map(([url, [file, type]]) => [url, { file: path.resolve(staticRoot, file), type }]));
  const trusted = new Set(config.trustedProxies);

  async function dispatch(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Security-Policy', CSP);
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
    res.status = (status) => { res.statusCode = status; return res; };
    res.json = (value) => {
      const body = Buffer.from(JSON.stringify(value));
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Length', body.length);
      res.end(req.method === 'HEAD' ? undefined : body);
      return res;
    };
    const fail = (status, code, message) => {
      // Do not drain/buffer bodies on rejected methods, origins or oversized requests.
      res.setHeader('Connection', 'close');
      return res.status(status).json({ error: { code, message } });
    };
    try {
      if (singleHeader(req, 'host') !== config.originHost) return fail(403, 'host-not-allowed', 'This host is not allowed.');
      req.ip = normalizeIp(req.socket.remoteAddress);
      req.secure = config.mode === 'tls' && req.socket.encrypted === true;
      if (config.mode === 'local' && !['127.0.0.1', '::1'].includes(req.ip)) {
        return fail(403, 'local-only', 'A loopback connection is required.');
      }
      if (config.mode === 'proxy') {
        // The allowlisted proxy MUST preserve Host and OVERWRITE both headers.
        // Exactly one hop only; neither leftmost XFF nor Forwarded is trusted.
        const ip = singleHeader(req, 'x-forwarded-for');
        if (!trusted.has(req.ip) || !normalizeIp(ip) || singleHeader(req, 'x-forwarded-proto') !== 'https') {
          return fail(403, 'proxy-not-allowed', 'A trusted HTTPS proxy is required.');
        }
        req.ip = normalizeIp(ip);
        req.secure = true;
      }
      const raw = req.url;
      if (!raw.startsWith('/') || raw.startsWith('//') || /[\\#\s]/.test(raw)) return fail(404, 'not-found', 'Not found.');
      const url = new URL(raw, config.origin);
      // Reject URL normalization aliases (dot segments, escaped segments, etc.).
      if (url.pathname !== raw.split('?')[0] || url.pathname.includes('%')) return fail(404, 'not-found', 'Not found.');
      req.path = url.pathname;
      const handler = req.path === '/api/private-admin' ? admin : req.path === '/api/activity' ? activity : null;
      if (handler) {
        // Shared handlers include Firebase Hosting defaults; this outer gate intentionally does not.
        if (singleHeader(req, 'origin') !== config.origin) return fail(403, 'origin-not-allowed', 'This origin is not allowed.');
        if (!['POST', 'OPTIONS'].includes(req.method)) {
          res.setHeader('Allow', 'POST, OPTIONS');
          return fail(405, 'method-not-allowed', 'Use POST with JSON.');
        }
        if (req.method === 'POST') {
          const type = singleHeader(req, 'content-type');
          if (!type || !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(type) || req.headers['content-encoding']) {
            return fail(400, 'invalid-request', 'Use UTF-8 application/json.');
          }
          if (Number(req.headers['content-length']) > MAX_BODY) return fail(413, 'body-too-large', 'JSON body exceeds 16 KiB.');
          let size = 0;
          const chunks = [];
          // Event listeners, rather than async iteration, avoid destroying the socket before a 413 can be sent.
          const body = await new Promise((resolve, reject) => {
            const finish = (error, result) => {
              req.removeListener('data', data); req.removeListener('end', end);
              req.removeListener('error', errorEvent); req.removeListener('aborted', aborted);
              if (error) reject(error); else resolve(result);
            };
            const data = (chunk) => {
              size += chunk.length;
              if (size > MAX_BODY) { req.pause(); finish(new Error('too-large')); }
              else chunks.push(chunk);
            };
            const end = () => finish(null, Buffer.concat(chunks));
            const errorEvent = () => finish(new Error('invalid-body'));
            const aborted = errorEvent;
            req.on('data', data); req.once('end', end); req.once('error', errorEvent); req.once('aborted', aborted);
          }).catch((error) => {
            fail(error.message === 'too-large' ? 413 : 400, 'invalid-request', 'Invalid JSON body.');
            return null;
          });
          if (body === null) return;
          try {
            req.body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body));
            if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) throw new Error();
          } catch { return fail(400, 'invalid-request', 'Invalid JSON body.'); }
        }
        return await handler(req, res);
      }
      if (req.path === '/healthz' && req.method === 'GET') return res.json({ ok: true });
      if (req.path === '/' || files.has(req.path)) {
        if (!['GET', 'HEAD'].includes(req.method)) {
          res.setHeader('Allow', 'GET, HEAD');
          return fail(405, 'method-not-allowed', 'Use GET or HEAD.');
        }
        if (req.path === '/') {
          res.setHeader('Location', '/statadmnaccprvt.html');
          res.setHeader('Content-Length', '0');
          return res.status(303).end();
        }
        const entry = files.get(req.path);
        const body = await fs.promises.readFile(entry.file);
        res.setHeader('Content-Type', entry.type);
        res.setHeader('Content-Length', body.length);
        res.setHeader('Cache-Control', req.path.endsWith('.html') ? 'no-store' : 'no-cache');
        return res.end(req.method === 'HEAD' ? undefined : body);
      }
      return fail(404, 'not-found', 'Not found.');
    } catch {
      if (res.headersSent || res.destroyed) { res.destroy(); return; }
      return fail(503, 'service-unavailable', 'The private service is unavailable.');
    }
  }
  const options = { requestTimeout: 20000, headersTimeout: 10000, connectionsCheckingInterval: 1000, maxHeaderSize: 16384 };
  let server;
  try {
    server = config.mode === 'tls'
      ? https.createServer({ ...options, minVersion: 'TLSv1.2', key: fs.readFileSync(config.tlsKeyFile), cert: fs.readFileSync(config.tlsCertFile) }, dispatch)
      : http.createServer(options, dispatch);
  } catch { throw new Error('Unable to create server: check TLS key/certificate files and permissions.'); }
  server.on('clientError', (error, socket) => {
    // Native parser/time-limit errors bypass dispatch. Never expose rawPacket or
    // parser exceptions, and always close the offending connection.
    const timeout = error.code === 'ERR_HTTP_REQUEST_TIMEOUT';
    const body = JSON.stringify({ error: { code: timeout ? 'request-timeout' : 'invalid-request',
      message: timeout ? 'Request timed out.' : 'Invalid HTTP request.' } });
    if (!socket.writable || socket.destroyed || socket.writableEnded) { socket.destroy(); return; }
    socket.end(`HTTP/1.1 ${timeout ? '408 Request Timeout' : '400 Bad Request'}\r\n` +
      'Connection: close\r\nContent-Type: application/json; charset=utf-8\r\nCache-Control: no-store\r\n' +
      `X-Content-Type-Options: nosniff\r\nContent-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
  });
  server.setTimeout(20000, (socket) => socket.destroy());
  server.keepAliveTimeout = 5000;
  return server;
}

module.exports = { readServerConfig, createPrivateServer };