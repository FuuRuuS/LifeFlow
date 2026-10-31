'use strict';

const { isIP } = require('node:net');

const TTL_SECONDS = 86400;
const DEFAULT_ORIGINS = [
  'https://planner-project-7ab9e.web.app',
  'https://planner-project-7ab9e.firebaseapp.com'
];
const MESSAGES = {
  'origin-not-allowed': 'This origin is not allowed.',
  'method-not-allowed': 'Use POST.',
  unauthorized: 'A valid Firebase ID token is required.',
  'invalid-request': 'Send JSON with an uppercase alphanumeric roomCode of 8–12 characters.',
  'room-not-found': 'The room does not exist.',
  forbidden: 'Only room participants can request relay credentials.',
  'rate-limited': 'Too many relay requests. Try again later.',
  'relay-not-configured': 'The relay service is not configured.',
  'relay-provider-failed': 'The relay provider could not issue usable credentials.',
  'service-unavailable': 'The relay service is temporarily unavailable.'
};

function originAllowed(origin, options) {
  if (origin === undefined) return true; // Native clients still require verified auth.
  if (origin === 'null') return options.allowNullOrigin === true;
  if (typeof origin !== 'string') return false;
  try {
    const url = new URL(origin);
    if (url.origin !== origin || url.username || url.password) return false;
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.hostname.endsWith('.localhost');
    if (local) return options.emulator === true && ['http:', 'https:'].includes(url.protocol);
    return url.protocol === 'https:' && options.origins.has(origin);
  } catch {
    return false;
  }
}

function parseIceUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) return null;
  const match = /^(stun|stuns|turn|turns):(?:\[([0-9a-fA-F:]+)\]|([a-zA-Z0-9.-]+))(?::([0-9]{1,5}))?(?:\?transport=(udp|tcp))?$/.exec(value);
  if (!match) return null;
  const [, scheme, ipv6, hostname, port, transport] = match;
  if (ipv6 ? isIP(ipv6) !== 6 : hostname.length > 253 || !hostname.split('.').every((label) =>
    /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/.test(label))) return null;
  if (port && (+port < 1 || +port > 65535 || +port === 53)) return null;
  if (transport && (scheme.startsWith('stun') || (scheme === 'turns' && transport !== 'tcp'))) return null;
  return { relay: scheme === 'turn' || scheme === 'turns' };
}

function sanitizeIceServers(payload) {
  if (!payload || !Array.isArray(payload.iceServers) || payload.iceServers.length > 32) return null;
  const result = [];
  let hasRelay = false;
  for (const server of payload.iceServers) {
    if (!server || typeof server !== 'object') continue;
    const urls = typeof server.urls === 'string' ? [server.urls] : server.urls;
    if (!Array.isArray(urls) || urls.length > 16) continue;
    const valid = urls.map((url) => ({ url, parsed: parseIceUrl(url) })).filter((v) => v.parsed);
    const stun = valid.filter((v) => !v.parsed.relay).map((v) => v.url);
    const turn = valid.filter((v) => v.parsed.relay).map((v) => v.url);
    if (stun.length) result.push({ urls: stun });
    if (turn.length && typeof server.username === 'string' && server.username.trim() &&
        server.username.length <= 4096 && typeof server.credential === 'string' &&
        server.credential.trim() && server.credential.length <= 4096 &&
        (server.credentialType === undefined || server.credentialType === 'password')) {
      result.push({ urls: turn, username: server.username, credential: server.credential });
      hasRelay = true;
    }
  }
  return hasRelay ? result : null;
}

/** Express-compatible handler; all external effects are injected for node:test. */
function createTurnHandler({ verifyIdToken, getRoom, consumeRateLimit, getSecrets, fetch,
  now = Date.now, allowedOrigins = [], allowNullOrigin = false, emulator = false }) {
  const origins = new Set([...DEFAULT_ORIGINS, ...allowedOrigins]);
  return async function rtcIceServers(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Vary', 'Origin');
    const fail = (status, code) => res.status(status).json({ error: { code, message: MESSAGES[code] } });
    const origin = req.headers.origin;
    if (!originAllowed(origin, { origins, allowNullOrigin, emulator })) return fail(403, 'origin-not-allowed');
    if (origin !== undefined) res.setHeader('Access-Control-Allow-Origin', origin);
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'POST');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      return res.status(204).end(); // Preflight never performs auth/DB/provider work.
    }
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST, OPTIONS');
      return fail(405, 'method-not-allowed');
    }
    const authorization = req.headers.authorization;
    const match = typeof authorization === 'string' && /^Bearer ([^\s]+)$/i.exec(authorization);
    if (!match) return fail(401, 'unauthorized');
    let uid;
    try {
      const decoded = await verifyIdToken(match[1]);
      uid = decoded && decoded.uid;
      if (typeof uid !== 'string' || !uid.length || uid.length > 128) return fail(401, 'unauthorized');
    } catch {
      return fail(401, 'unauthorized');
    }
    try {
      // Count every authenticated POST, including malformed/nonmember requests.
      const limit = await consumeRateLimit(uid);
      if (!limit || typeof limit.allowed !== 'boolean') return fail(503, 'service-unavailable');
      if (!limit.allowed) {
        const seconds = Number.isFinite(limit.retryAfterSeconds) ? Math.ceil(limit.retryAfterSeconds) : 600;
        res.setHeader('Retry-After', String(Math.max(1, seconds)));
        return fail(429, 'rate-limited');
      }
      const contentType = req.headers['content-type'];
      if (typeof contentType !== 'string' || !/^application\/json(?:\s*;|$)/i.test(contentType) ||
          !req.body || typeof req.body !== 'object' || Array.isArray(req.body) ||
          typeof req.body.roomCode !== 'string' || !/^[A-Z0-9]{8,12}$/.test(req.body.roomCode)) {
        return fail(400, 'invalid-request');
      }
      const room = await getRoom(req.body.roomCode);
      if (!room) return fail(404, 'room-not-found');
      if (room.hostUid !== uid && room.guestUid !== uid) return fail(403, 'forbidden');
    } catch {
      return fail(503, 'service-unavailable');
    }
    let secrets;
    try {
      secrets = getSecrets();
      if (!secrets || typeof secrets.keyId !== 'string' || !secrets.keyId.trim() ||
          typeof secrets.apiToken !== 'string' || !secrets.apiToken.trim()) return fail(503, 'relay-not-configured');
    } catch {
      return fail(503, 'relay-not-configured');
    }
    try {
      const response = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(secrets.keyId)}/credentials/generate-ice-servers`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${secrets.apiToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ttl: TTL_SECONDS }),
        signal: AbortSignal.timeout(10000),
        redirect: 'error'
      });
      if (!response.ok) return fail(502, 'relay-provider-failed');
      const iceServers = sanitizeIceServers(await response.json());
      if (!iceServers) return fail(502, 'relay-provider-failed');
      return res.status(200).json({ iceServers, expiresAt: now() + TTL_SECONDS * 1000 });
    } catch {
      // Never log/return exceptions or raw provider bodies: they can contain secrets.
      return fail(502, 'relay-provider-failed');
    }
  };
}

module.exports = { createTurnHandler, sanitizeIceServers, TTL_SECONDS };