'use strict';

const { createHash, createHmac, randomBytes, timingSafeEqual } = require('node:crypto');
const { AdminError, validUid, validDocumentId, normalizeIp, hash, SESSION_MS } = require('./admin-service');

const DEFAULT_ORIGINS = Object.freeze([
  'https://planner-project-7ab9e.web.app',
  'https://planner-project-7ab9e.firebaseapp.com'
]);
const ERRORS = Object.freeze({
  'invalid-request': [400, 'Invalid JSON action or parameters.'],
  unauthorized: [401, 'A valid private admin session or access code is required.'],
  'csrf-required': [403, 'A valid admin CSRF token is required.'],
  'origin-not-allowed': [403, 'This origin is not allowed.'],
  'https-required': [403, 'HTTPS is required.'],
  'not-found': [404, 'The requested resource was not found.'],
  'method-not-allowed': [405, 'Use POST with JSON.'],
  'rate-limited': [429, 'Too many login attempts. Try again later.'],
  'service-unavailable': [503, 'The private admin service is unavailable.']
});
const ACTIONS = new Set(['login', 'session', 'logout', 'accounts', 'account', 'activity', 'revealIp']);

/**
 * SECURITY: req.ip MUST be supplied by the correctly configured Express/Firebase
 * runtime. Do not configure trust proxy=true indiscriminately or pass client JSON
 * into req.ip. The parent must verify the deployed GCP proxy chain (including the
 * GCP-appended client address) and prevent bypass of that chain. This helper never
 * parses X-Forwarded-For, especially not its attacker-controlled leftmost entry.
 * An untrusted proxy configuration cannot be repaired by application header parsing.
 */
function clientIp(req) { return normalizeIp(req.ip); }
function originAllowed(origin, origins, emulator) {
  if (typeof origin !== 'string' || origin === 'null') return false;
  try {
    const url = new URL(origin);
    if (url.origin !== origin || url.username || url.password) return false;
    const local = url.hostname === 'localhost' || url.hostname.endsWith('.localhost') ||
      /^127\./.test(url.hostname) || url.hostname === '[::1]';
    // Local origins must also be explicitly listed, and are never enabled in production.
    return origins.has(origin) && (local ? emulator && ['http:', 'https:'].includes(url.protocol) : url.protocol === 'https:');
  } catch { return false; }
}
function equalSecret(a, b) {
  // Fixed-size hashes keep comparisons constant-length even on different input lengths.
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const digest = (value) => createHash('sha256').update(value, 'utf8').digest();
  return timingSafeEqual(digest(a), digest(b));
}
function codeFingerprint(code) {
  return createHmac('sha256', code).update('planner/private-admin/session/v1').digest('hex');
}
function sessionToken(req) {
  const cookie = req.headers?.cookie;
  if (typeof cookie !== 'string' || cookie.length > 16384) return null;
  const values = cookie.split(';').map((part) => part.trim()).filter((part) => part.startsWith('__session='));
  if (values.length !== 1) return null; // Reject ambiguous duplicate cookies.
  const value = values[0].slice('__session='.length);
  return /^[A-Za-z0-9_-]{43}$/.test(value) && Buffer.from(value, 'base64url').toString('base64url') === value ? value : null;
}

/**
 * Express-compatible POST /api/private-admin (OPTIONS supports exact-origin CORS).
 * createAdminHandler({ service: createAdminService({db, auth}),
 *   getCode: () => firebaseSecret.value(), allowedOrigins: [], emulator: false,
 *   now: Date.now })
 *
 * Parent must bind a Firebase Secret to the function. Never hardcode the code,
 * put it in frontend/config, or log bodies/headers/provider exceptions. No Firebase
 * user credentials are accepted. Strong random secret recommended (>=8, <=256).
 * HTTPS is determined by trusted Express req.secure, never parsed headers here.
 * Hosting forwards only __session; this HttpOnly cookie is the sole session token.
 */
function createAdminHandler({ service, getCode, allowedOrigins = [], emulator = false, now = Date.now }) {
  const origins = new Set([...DEFAULT_ORIGINS, ...allowedOrigins]);
  return async function privateAdmin(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Vary', 'Origin');
    const fail = (code) => {
      const [status, message] = ERRORS[code] || ERRORS['service-unavailable'];
      return res.status(status).json({ error: { code: ERRORS[code] ? code : 'service-unavailable', message } });
    };
    const cookie = (token, clear = false) => res.setHeader('Set-Cookie',
      `__session=${clear ? '' : token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${clear ? 0 : 1800}` +
      (emulator ? '' : '; Secure') + (clear ? '; Expires=Thu, 01 Jan 1970 00:00:00 GMT' : ''));
    const origin = req.headers?.origin;
    if (!originAllowed(origin, origins, emulator)) return fail('origin-not-allowed');
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    if (!emulator && req.secure !== true) return fail('https-required');
    if (req.path !== '/api/private-admin') return fail('not-found');
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'POST');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-CSRF');
      return res.status(204).end();
    }
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST, OPTIONS');
      return fail('method-not-allowed');
    }
    const body = req.body;
    if (typeof req.headers?.['content-type'] !== 'string' ||
        !/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']) ||
        !body || typeof body !== 'object' || Array.isArray(body)) return fail('invalid-request');
    try {
      const code = await getCode();
      if (typeof code !== 'string' || code.trim().length < 8 || code.length > 256) {
        return fail('service-unavailable');
      }
      const fingerprint = codeFingerprint(code);
      if (body.action === 'login') {
        const ip = clientIp(req);
        if (!ip) return fail('service-unavailable');
        const limit = await service.consumeLoginAttempt(ip);
        if (!limit || typeof limit.allowed !== 'boolean') return fail('service-unavailable');
        if (!limit.allowed) {
          res.setHeader('Retry-After', String(Number.isFinite(limit.retryAfterSeconds)
            ? Math.max(1, Math.ceil(limit.retryAfterSeconds)) : 900));
          return fail('rate-limited');
        }
        if (typeof body.code !== 'string' || body.code.length > 256) return fail('invalid-request');
        if (!equalSecret(body.code, code)) return fail('unauthorized');
        const token = randomBytes(32).toString('base64url');
        const csrfToken = randomBytes(24).toString('base64url');
        const expiresAt = now() + SESSION_MS;
        await service.createSession({ id: hash(token), csrfToken, codeFingerprint: fingerprint, expiresAt });
        // Re-login replaces the browser's prior session instead of leaving it usable.
        const previous = sessionToken(req);
        if (previous) await service.deleteSession(hash(previous));
        cookie(token);
        return res.status(200).json({ authenticated: true, csrfToken, expiresAt });
      }
      const token = sessionToken(req);
      if (!token) { cookie('', true); return fail('unauthorized'); }
      const id = hash(token);
      const session = await service.getSession(id);
      if (!session || !Number.isSafeInteger(session.expiresAt) || session.expiresAt <= now() ||
          typeof session.csrfToken !== 'string' || !/^[A-Za-z0-9_-]{32}$/.test(session.csrfToken) ||
          !equalSecret(session.codeFingerprint, fingerprint)) {
        if (session) await service.deleteSession(id);
        cookie('', true);
        return fail('unauthorized');
      }
      if (body.action === 'session') {
        return res.status(200).json({ authenticated: true, csrfToken: session.csrfToken, expiresAt: session.expiresAt });
      }
      const csrf = req.headers?.['x-admin-csrf'];
      if (typeof csrf !== 'string' || csrf.length !== 32 || !equalSecret(csrf, session.csrfToken)) {
        return fail('csrf-required');
      }
      if (!ACTIONS.has(body.action)) return fail('invalid-request');
      if (body.action === 'logout') {
        await service.deleteSession(id);
        cookie('', true);
        return res.status(200).json({ authenticated: false });
      }
      if (body.action === 'accounts') {
        const pageSize = body.pageSize === undefined ? 50 : body.pageSize;
        if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 50 ||
            (body.pageToken !== undefined && (typeof body.pageToken !== 'string' || !body.pageToken.length || body.pageToken.length > 2048))) {
          return fail('invalid-request');
        }
        return res.status(200).json(await service.listAccounts({ pageSize, pageToken: body.pageToken }));
      }
      if (!validUid(body.uid) || (body.cursor !== undefined && !validDocumentId(body.cursor)) ||
          (body.eventId !== undefined && !validDocumentId(body.eventId))) return fail('invalid-request');
      if (body.action === 'account') return res.status(200).json(await service.getAccount(body.uid));
      if (body.action === 'activity') return res.status(200).json(await service.getActivity({ uid: body.uid, cursor: body.cursor }));
      return res.status(200).json(await service.revealIp({ uid: body.uid, eventId: body.eventId, sessionId: id }));
    } catch (err) {
      // No logging/serialization of exceptions: SDK messages may contain secrets.
      return fail(err instanceof AdminError ? err.code : 'service-unavailable');
    }
  };
}

module.exports = { createAdminHandler, clientIp, DEFAULT_ORIGINS };