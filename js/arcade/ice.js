/** Short-lived TURN credentials. Provider secrets never belong in the browser. */
import { auth } from '../firebase.js';
import { RTC, firebaseConfig } from '../config.js';

const STUN = { urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] };
const cache = new Map();
const messages = {
  'relay-not-configured': 'The TURN relay has not been activated on the server.',
  'relay-not-deployed': 'The TURN credentials endpoint is not deployed. Direct calls may fail across networks.',
  'relay-provider-failed': 'The TURN provider could not issue credentials. Check the server configuration.',
  'origin-not-allowed': 'The TURN service does not allow this app address.',
  'rate-limited': 'Too many relay requests. Wait a few minutes before reconnecting.',
  unauthorized: 'Sign in again to obtain call relay credentials.',
  forbidden: 'The call relay could not verify your room membership.',
  'relay-unavailable': 'The TURN service could not be reached. Direct calls may fail across networks.'
};

function safeServers(servers) {
  if (!Array.isArray(servers)) return [];
  return servers.slice(0, 32).flatMap((server) => {
    const urls = (Array.isArray(server?.urls) ? server.urls : [server?.urls])
      .filter((url) => typeof url === 'string' && /^(stun|stuns|turn|turns):[^\s/@]+$/i.test(url) && !/:53(?:\?|$)/.test(url));
    const stun = urls.filter((url) => /^stuns?:/i.test(url));
    const turn = urls.filter((url) => /^turns?:/i.test(url));
    const result = stun.length ? [{ urls: stun }] : [];
    if (turn.length && typeof server.username === 'string' && server.username && typeof server.credential === 'string' && server.credential) {
      result.push({ urls: turn, username: server.username, credential: server.credential });
    }
    return result;
  });
}

function hasRelay(servers) {
  return servers.some((server) => server.urls.some((url) => /^turns?:/i.test(url)));
}

export async function loadIceConfig(code, { force = false } = {}) {
  const user = auth.currentUser;
  const key = `${user?.uid || ''}:${code}`;
  const saved = cache.get(key);
  if (!force && saved && saved.until > Date.now()) return saved.value;
  const staticServers = safeServers(RTC.iceServers);
  let servers = [STUN, ...staticServers];
  let warning = null;
  let until = Date.now() + 30000;
  try {
    if (!RTC.credentialsUrl) {
      if (!hasRelay(servers)) throw Object.assign(new Error(), { code: 'relay-not-configured' });
    } else {
      if (!user) throw Object.assign(new Error(), { code: 'unauthorized' });
      // file:// must use the hosted endpoint, never send a token to a local file.
      const base = location.protocol === 'file:' ? `https://${firebaseConfig.projectId}.web.app/` : location.href;
      const endpoint = new URL(RTC.credentialsUrl, base);
      if (endpoint.protocol !== 'https:' && !(endpoint.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(endpoint.hostname))) {
        throw new Error('Unsafe relay endpoint');
      }
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12000);
      try {
        const request = async (refresh) => fetch(endpoint.href, {
          method: 'POST', cache: 'no-store', credentials: 'omit', redirect: 'error', signal: controller.signal,
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await user.getIdToken(refresh)}` },
          body: JSON.stringify({ roomCode: code })
        });
        let response = await request(false);
        if (response.status === 401) response = await request(true);
        if (!(response.headers.get('content-type') || '').includes('application/json')) {
          throw Object.assign(new Error(), { code: 'relay-not-deployed' });
        }
        const data = await response.json();
        if (!response.ok) throw Object.assign(new Error(), { code: data?.error?.code });
        const fresh = safeServers(data.iceServers);
        if (!hasRelay(fresh) || !Number.isFinite(data.expiresAt) || data.expiresAt < Date.now() + 60000) {
          throw Object.assign(new Error(), { code: 'relay-provider-failed' });
        }
        servers = [STUN, ...staticServers, ...fresh];
        until = Math.min(data.expiresAt - 60000, Date.now() + 3600000);
      } finally { clearTimeout(timer); }
    }
  } catch (err) {
    const code = messages[err.code] ? err.code : 'relay-unavailable';
    warning = { code, message: messages[code] };
  }
  const relayAvailable = hasRelay(servers);
  const value = {
    config: { iceServers: servers, iceCandidatePoolSize: 0, iceTransportPolicy: RTC.forceRelay ? 'relay' : 'all' },
    relayAvailable, warning
  };
  // Do not retain another account's short-lived credentials after auth changes.
  if (auth.currentUser?.uid === user?.uid) {
    for (const other of cache.keys()) if (other !== key) cache.delete(other);
    cache.set(key, { until, value });
  }
  return value;
}