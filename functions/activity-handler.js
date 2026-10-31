'use strict';

const { ActivityError, validUid, validMetadata, normalizeIp } = require('./activity-service');

const DEFAULT_ORIGINS = Object.freeze([
  'https://planner-project-7ab9e.web.app',
  'https://planner-project-7ab9e.firebaseapp.com'
]);
const ERRORS = Object.freeze({
  'invalid-request': [400, 'Invalid activity request.'],
  unauthorized: [401, 'A valid ID token is required.'],
  'origin-not-allowed': [403, 'This origin is not allowed.'],
  'https-required': [403, 'HTTPS is required.'],
  'not-found': [404, 'The requested resource was not found.'],
  'method-not-allowed': [405, 'Use POST with JSON.'],
  'rate-limited': [429, 'Too many activity requests. Try again later.'],
  'service-unavailable': [503, 'The activity service is unavailable.']
});
function originAllowed(origin, origins, emulator, allowNullOrigin) {
  if (origin === 'null') return allowNullOrigin === true;
  if (typeof origin !== 'string') return false;
  try {
    const url = new URL(origin);
    if (url.origin !== origin || url.username || url.password || !origins.has(origin)) return false;
    const local = url.hostname === 'localhost' || url.hostname.endsWith('.localhost') ||
      /^127\./.test(url.hostname) || url.hostname === '[::1]';
    return local ? emulator === true && ['http:', 'https:'].includes(url.protocol) : url.protocol === 'https:';
  } catch { return false; }
}

/** Coarse allowlisted labels only; no UA versions, models, raw strings or fingerprint. */
function deviceFromUserAgent(value) {
  const ua = typeof value === 'string' && value.length <= 2048 ? value : '';
  const os = /iPhone|iPad|iPod/i.test(ua) ? 'iOS'
    : /Android/i.test(ua) ? 'Android'
      : /Windows NT/i.test(ua) ? 'Windows'
        : /CrOS/i.test(ua) ? 'Chrome OS'
          : /Macintosh|Mac OS X/i.test(ua) ? 'macOS'
            : /Linux/i.test(ua) ? 'Linux' : 'Other';
  const browser = /Edg(?:e|A|iOS)?\//i.test(ua) ? 'Edge'
    : /OPR\/|Opera\//i.test(ua) ? 'Opera'
      : /SamsungBrowser\//i.test(ua) ? 'Samsung Internet'
        : /Firefox\/|FxiOS\//i.test(ua) ? 'Firefox'
          : /Chrome\/|CriOS\//i.test(ua) ? 'Chrome'
            : /Safari\//i.test(ua) && /Version\//i.test(ua) ? 'Safari' : 'Other';
  return `${browser} · ${os}`;
}

/**
 * createActivityHandler({ auth: getAuth(), service: createActivityService({db}),
 *   allowedOrigins: [], emulator: false, allowNullOrigin: false })
 * Express-compatible POST /api/activity, JSON {action,module}, Bearer Firebase ID token.
 * No cookies or secret provider. Parent supplies the route/Hosting rewrite and config.
 *
 * SECURITY: req.ip and req.secure must be supplied by a correctly configured trusted
 * Firebase/Express runtime. Parent must verify proxy-chain handling and prevent proxy
 * bypass. Never set trust proxy=true indiscriminately. This code NEVER reads XFF or
 * X-Forwarded-Proto and cannot repair an unsafe runtime proxy configuration.
 * allowNullOrigin explicitly permits ALL opaque origins (not only desktop files);
 * use only if that tradeoff is accepted. It never disables HTTPS or authentication.
 * Localhost origins require BOTH explicit allowedOrigins and emulator:true.
 */
function createActivityHandler({ auth, service, allowedOrigins = [], emulator = false, allowNullOrigin = false }) {
  const origins = new Set([...DEFAULT_ORIGINS, ...allowedOrigins]);
  return async function activity(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Vary', 'Origin');
    const fail = (code) => {
      const safeCode = Object.hasOwn(ERRORS, code) ? code : 'service-unavailable';
      const [status, message] = ERRORS[safeCode];
      return res.status(status).json({ error: { code: safeCode, message } });
    };
    const origin = req.headers?.origin;
    if (!originAllowed(origin, origins, emulator, allowNullOrigin)) return fail('origin-not-allowed');
    res.setHeader('Access-Control-Allow-Origin', origin);
    if (emulator !== true && req.secure !== true) return fail('https-required');
    if (req.path !== '/api/activity') return fail('not-found');
    if (req.method === 'OPTIONS') {
      const method = req.headers?.['access-control-request-method'];
      const headers = req.headers?.['access-control-request-headers'];
      if ((method !== undefined && method !== 'POST') || (headers !== undefined &&
          (typeof headers !== 'string' || headers.split(',').some((header) =>
            !['authorization', 'content-type'].includes(header.trim().toLowerCase()))))) return fail('invalid-request');
      res.setHeader('Access-Control-Allow-Methods', 'POST');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      return res.status(204).end();
    }
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST, OPTIONS');
      return fail('method-not-allowed');
    }
    const body = req.body;
    if (typeof req.headers?.['content-type'] !== 'string' ||
        !/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']) ||
        !body || typeof body !== 'object' || Array.isArray(body) ||
        ![Object.prototype, null].includes(Object.getPrototypeOf(body)) ||
        Object.keys(body).length !== 2 || !Object.hasOwn(body, 'action') || !Object.hasOwn(body, 'module') ||
        !validMetadata(body.action, body.module)) return fail('invalid-request');
    const authorization = req.headers?.authorization;
    if (typeof authorization !== 'string' || authorization.length > 8192 ||
        !/^Bearer [A-Za-z0-9._~-]+$/i.test(authorization)) return fail('unauthorized');
    let decoded;
    try {
      // Mandatory true checks disabled users and token revocation, not just signature.
      decoded = await auth.verifyIdToken(authorization.slice(7), true);
    } catch { return fail('unauthorized'); }
    if (!validUid(decoded?.uid)) return fail('unauthorized');
    try {
      const result = await service.record({ uid: decoded.uid, action: body.action, module: body.module,
        ip: normalizeIp(req.ip), device: deviceFromUserAgent(req.headers?.['user-agent']) });
      // Never serialize an arbitrary adapter result or any SDK error/claims.
      if (result?.recorded === true) return res.status(200).json({ recorded: true });
      if (result?.recorded === false && result.reason === 'consent-required') {
        return res.status(200).json({ recorded: false, reason: 'consent-required' });
      }
      return fail('service-unavailable');
    } catch (error) {
      if (error instanceof ActivityError && error.code === 'rate-limited') {
        res.setHeader('Retry-After', String(Number.isFinite(error.retryAfterSeconds)
          ? Math.min(300, Math.max(1, Math.ceil(error.retryAfterSeconds))) : 300));
      }
      return fail(error instanceof ActivityError ? error.code : 'service-unavailable');
    }
  };
}

module.exports = { createActivityHandler, deviceFromUserAgent, DEFAULT_ORIGINS };