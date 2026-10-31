/* Real WebRTC regression checks with synthetic devices and in-memory signaling.
 * Run: node tools/test-arcade-browser.js
 * No Firebase access, real camera/microphone capture, or external dependencies.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const assert = require('assert/strict');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/arcade/rtc.js'), 'utf8')
  .replace(/^import\s+[\s\S]*?\s+from\s+['"][^'"]+['"];\s*$/gm, '')
  .replace(/^export\s+/gm, '');

async function browserTests() {
  const checks = [];
  const errors = [];
  const calls = [];
  const connections = [];
  const NativePC = window.RTCPeerConnection;
  window.RTCPeerConnection = class extends NativePC {
    constructor(config) {
      // Local host candidates are sufficient: keep the test off public STUN.
      super({ ...config, iceServers: [] });
      connections.push(this);
    }
  };
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const records = new Map([['room', { offer: null, answer: null }]]);
  const watchers = new Map();
  const snapshot = (key) => key === 'room'
    ? { data: () => clone(records.get(key)) }
    : { docChanges: () => [...records].filter(([k]) => k.startsWith(`${key}/`)).map(([k, v]) => ({
      type: 'added', doc: { data: () => clone(v), ref: k }
    })) };
  const emit = (key) => {
    const snap = snapshot(key);
    for (const fn of watchers.get(key) || []) queueMicrotask(() => fn(snap));
  };
  const deps = {
    loadIceConfig: async () => ({ config: { iceServers: [], iceTransportPolicy: 'all', iceCandidatePoolSize: 0 }, relayAvailable: false, warning: null }),
    roomRef: () => 'room', iceRef: (_, seat) => `ice${seat}`,
    newCode: () => crypto.randomUUID(),
    updateDoc: async (key, values) => { records.set(key, { ...records.get(key), ...clone(values) }); emit(key); },
    onSnapshot: (key, fn) => {
      if (!watchers.has(key)) watchers.set(key, new Set());
      watchers.get(key).add(fn);
      const snap = snapshot(key);
      queueMicrotask(() => fn(snap));
      return () => watchers.get(key).delete(fn);
    },
    addDoc: async (key, value) => {
      const id = `${key}/${crypto.randomUUID()}`;
      records.set(id, clone(value));
      const snap = { docChanges: () => [{ type: 'added', doc: { data: () => clone(value), ref: id } }] };
      for (const fn of watchers.get(key) || []) queueMicrotask(() => fn(snap));
    },
    getDocs: async (key) => ({ docs: [...records].filter(([k]) => k.startsWith(`${key}/`))
      .map(([k, v]) => ({ ref: k, data: () => clone(v) })) }),
    deleteDoc: async (key) => records.delete(key)
  };
  const { createCall } = new Function(...Object.keys(deps), window.rtcSource + '\nreturn { createCall };')(...Object.values(deps));
  const wait = (predicate, label, timeout = 15000) => new Promise((resolve, reject) => {
    const deadline = Date.now() + timeout;
    const timer = setInterval(async () => {
      try {
        if (await predicate()) { clearInterval(timer); resolve(); }
        else if (Date.now() > deadline) { clearInterval(timer); reject(new Error(`Timed out: ${label}`)); }
      } catch (err) { clearInterval(timer); reject(err); }
    }, 50);
  });
  const received = async (kind, floor = 0) => {
    const live = connections.filter((pc) => pc.connectionState === 'connected');
    if (live.length !== 2) return false;
    const stats = await Promise.all(live.map((pc) => pc.getStats()));
    return stats.every((report) => [...report.values()].some((s) =>
      s.type === 'inbound-rtp' && s.kind === kind && s.bytesReceived > floor));
  };
  const make = (seat) => {
    const info = { status: '', remote: null };
    const call = createCall({
      code: 'test', seat,
      onStatus: (s) => { info.status = s; },
      onRemote: (s) => { info.remote = s; },
      onError: (err) => errors.push(err.message)
    });
    calls.push(call);
    return { call, info };
  };
  try {
    const host = make(0);
    let guest = make(1);
    await Promise.all([host.call.start(), guest.call.start()]);
    await wait(() => host.info.status === 'connected' && guest.info.status === 'connected', 'initial connection');
    checks.push('two peers connect with empty reserved media lanes');

    await Promise.all([host.call.setMic(true), guest.call.setMic(true)]);
    await wait(() => received('audio', 1000), 'bidirectional voice-only RTP');
    const audio = document.createElement('audio');
    audio.srcObject = new MediaStream(guest.info.remote.getAudioTracks());
    document.body.appendChild(audio);
    await audio.play();
    await wait(() => audio.currentTime > 0.1, 'voice-only audio playback');
    checks.push('bidirectional voice and audio playback with both cameras off');

    await Promise.all([host.call.setCam(true), guest.call.setCam(true)]);
    await wait(() => received('video', 1000), 'bidirectional video RTP');
    checks.push('cameras enabled after connection send video both ways');

    const oldTrack = host.call.localStream.getVideoTracks()[0];
    await host.call.setCam(false);
    if (oldTrack.readyState !== 'ended') throw new Error('Camera off did not release device');
    await host.call.setCam(true);
    if (host.call.localStream.getVideoTracks()[0] === oldTrack) throw new Error('Camera restart reused ended track');
    await host.call.setMic(false);
    if (host.call.localStream.getAudioTracks()[0].enabled) throw new Error('Mute did not disable microphone');
    await host.call.setMic(true);
    checks.push('camera off releases device; camera restart and mic mute/unmute work');

    const previousOffer = records.get('room').offer.sid;
    guest.call.close();
    guest = make(1);
    await guest.call.start();
    await wait(() => records.get('room').offer.sid !== previousOffer && host.info.status === 'connected' && guest.info.status === 'connected', 'guest reload reconnect', 20000);
    await Promise.all([guest.call.setMic(true), guest.call.setCam(true)]);
    await wait(() => received('audio', 1000), 'audio after reload');
    await wait(() => received('video', 1000), 'video after reload');
    checks.push('guest reload requests new session and restores audio/video');

    const beforeRecall = records.get('room').offer.sid;
    host.call.reconnect();
    await wait(() => records.get('room').offer.sid !== beforeRecall && host.info.status === 'connected' && guest.info.status === 'connected', 'manual reconnect');
    await wait(() => received('audio', 1000), 'reconnected audio');
    await wait(() => received('video', 1000), 'reconnected video');
    checks.push('manual reconnect preserves active camera and microphone');

    const late = make(0);
    const nativeGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    const lateStream = await nativeGetUserMedia({ video: true });
    let grant;
    navigator.mediaDevices.getUserMedia = () => new Promise((resolve) => { grant = resolve; });
    const enabling = late.call.setCam(true);
    late.call.close();
    grant(lateStream);
    await enabling;
    navigator.mediaDevices.getUserMedia = nativeGetUserMedia;
    if (lateStream.getTracks().some((t) => t.readyState !== 'ended')) throw new Error('Late permission leaked camera');
    checks.push('permission resolving after close releases every acquired track');
    if (errors.length) throw new Error(errors.join('; '));
    return { checks };
  } finally {
    for (const call of calls) call.close();
    window.RTCPeerConnection = NativePC;
  }
}

async function main() {
  const browser = process.env.ARCADE_BROWSER || [
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe'
  ].find((file) => fs.existsSync(file));
  assert.ok(browser, 'Set ARCADE_BROWSER to a Chromium/Edge executable.');
  const page = `<!doctype html><html><body><script>window.rtcSource=${JSON.stringify(source).replace(/</g, '\\u003c')};window.testResult=(${browserTests.toString()})();</script></body></html>`;
  const server = http.createServer((req, res) => { res.setHeader('Content-Type', 'text/html'); res.end(page); });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  // All browser-generated data stays inside this workspace, never in AppData.
  const profile = fs.mkdtempSync(path.join(root, '.arcade-browser-test-'));
  const child = spawn(browser, [
    '--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
    '--remote-debugging-pipe', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream',
    '--autoplay-policy=no-user-gesture-required', `--user-data-dir=${profile}`, 'about:blank'
  ], { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', (d) => { stderr = (stderr + d).slice(-3000); });
  let id = 0;
  let buffer = '';
  const pending = new Map();
  child.stdio[4].on('data', (chunk) => {
    buffer += chunk.toString();
    let index;
    while ((index = buffer.indexOf('\0')) >= 0) {
      const text = buffer.slice(0, index);
      buffer = buffer.slice(index + 1);
      if (!text) continue;
      const msg = JSON.parse(text);
      if (pending.has(msg.id)) {
        const { resolve, reject, timer } = pending.get(msg.id);
        pending.delete(msg.id); clearTimeout(timer);
        if (msg.error) reject(new Error(JSON.stringify(msg.error))); else resolve(msg.result);
      }
    }
  });
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const number = ++id;
    const timer = setTimeout(() => { pending.delete(number); reject(new Error(`CDP timeout: ${method}\n${stderr}`)); }, 90000);
    pending.set(number, { resolve, reject, timer });
    child.stdio[3].write(JSON.stringify({ id: number, method, params, ...(sessionId ? { sessionId } : {}) }) + '\0');
  });
  try {
    const target = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send('Target.attachToTarget', { targetId: target.targetId, flatten: true });
    await send('Page.enable', {}, sessionId);
    await send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/` }, sessionId);
    const result = await send('Runtime.evaluate', {
      expression: 'document.readyState === "complete" ? window.testResult : new Promise(resolve => window.addEventListener("load", () => resolve(window.testResult), {once:true}))',
      awaitPromise: true, returnByValue: true
    }, sessionId);
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || JSON.stringify(result.exceptionDetails));
    assert.ok(result.result.value?.checks?.length, 'Browser returned no test results');
    for (const check of result.result.value.checks) console.log(`PASS ${check}`);
    console.log(`${result.result.value.checks.length} real-browser WebRTC checks passed.`);
  } finally {
    // Graceful shutdown lets Chromium terminate profile-owning subprocesses.
    try { await send('Browser.close'); } catch { child.kill(); }
    if (child.exitCode === null) await new Promise((resolve) => child.once('exit', resolve));
    for (const item of pending.values()) clearTimeout(item.timer);
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(profile, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 });
  }
}

main().catch((err) => { console.error(err); process.exitCode = 1; });