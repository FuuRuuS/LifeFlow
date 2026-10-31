/**
 * LifeFlow Arcade — the video call.
 *
 * A small WebRTC helper that uses the room document as its signalling channel.
 * The connection is opened as soon as both players are seated, with the audio
 * and video lanes reserved but empty; turning the camera or microphone on later
 * simply drops a track into the lane it already has, so there is no
 * renegotiation and no pause in the game.
 *
 * Every negotiation is a numbered "session" (`sid`). Offers, answers and ICE
 * candidates carry it, so a reload, a rejoin or a reconnect never mixes up
 * signals from an older connection. Candidates that arrive before the
 * description they belong to are queued instead of dropped.
 */
import { updateDoc, onSnapshot, addDoc, getDocs, deleteDoc } from '../firebase.js';
import { roomRef, iceRef, newCode } from './rooms.js';
import { RTC } from '../config.js';

const STUN = { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] };

function iceConfig() {
  const extra = Array.isArray(RTC?.iceServers) ? RTC.iceServers.filter((s) => s && s.urls) : [];
  return { iceServers: [STUN, ...extra], iceCandidatePoolSize: 2 };
}

/** Plain, Firestore-safe copy of a candidate. */
function packCandidate(c, sid) {
  return {
    candidate: c.candidate || '',
    sdpMid: c.sdpMid ?? null,
    sdpMLineIndex: c.sdpMLineIndex ?? null,
    usernameFragment: c.usernameFragment ?? null,
    sid
  };
}

function unpackCandidate(d) {
  const init = { candidate: d.candidate || '' };
  if (d.sdpMid != null) init.sdpMid = d.sdpMid;
  if (d.sdpMLineIndex != null) init.sdpMLineIndex = d.sdpMLineIndex;
  if (d.usernameFragment) init.usernameFragment = d.usernameFragment;
  return init;
}

const AUTO_RETRIES = 3;

export const canCall = () =>
  typeof RTCPeerConnection !== 'undefined' &&
  Boolean(navigator.mediaDevices?.getUserMedia) &&
  (location.protocol === 'https:' || location.protocol === 'file:' || ['localhost', '127.0.0.1'].includes(location.hostname));

export function createCall({ code, seat, onRemote, onLocal, onStatus, onError }) {
  const host = seat === 0;
  const remote = new MediaStream();
  const tx = { audio: null, video: null };
  const unsubs = [];

  let pc = null;
  let sid = '';
  let local = null;
  let started = false;
  let closed = false;
  let cam = false;
  let mic = false;
  let pending = []; // remote candidates waiting for their description: { sid, init }
  let seenAnswer = '';
  let lastKick; // undefined until the first room snapshot
  let lastNegotiation = 0;
  let retries = 0;
  let watchdog = null;

  const status = (s) => onStatus?.(s);

  function attachRemote(track) {
    if (remote.getTracks().includes(track)) return;
    remote.addTrack(track);
    track.addEventListener('ended', () => {
      try { remote.removeTrack(track); } catch { /* already gone */ }
      onRemote?.(remote);
    });
    onRemote?.(remote);
  }

  function clearRemote() {
    remote.getTracks().forEach((t) => { try { remote.removeTrack(t); } catch { /* noop */ } });
  }

  function clearWatchdog() {
    if (watchdog) clearTimeout(watchdog);
    watchdog = null;
  }

  /** Ask for a fresh connection: the host renegotiates, the guest nudges the host. */
  function recover(reason) {
    if (closed) return;
    if (host) {
      if (Date.now() - lastNegotiation < 3000) return;
      negotiate().catch((err) => console.warn('[arcade] renegotiate', reason, err));
    } else {
      updateDoc(roomRef(code), { rtcKick: newCode(8) }).catch(() => {});
    }
  }

  function scheduleRecovery(conn, delay, reason) {
    clearWatchdog();
    if (retries >= AUTO_RETRIES) return;
    watchdog = setTimeout(() => {
      watchdog = null;
      if (closed || pc !== conn || conn.connectionState === 'connected') return;
      retries += 1;
      recover(reason);
    }, delay);
  }

  function buildPc() {
    clearWatchdog();
    if (pc) { try { pc.close(); } catch { /* noop */ } }
    clearRemote();
    onRemote?.(remote);
    tx.audio = null;
    tx.video = null;

    const conn = new RTCPeerConnection(iceConfig());
    const mySid = sid;
    pc = conn;

    conn.addEventListener('track', (ev) => {
      if (pc !== conn) return;
      if (ev.track) attachRemote(ev.track);
    });

    conn.addEventListener('icecandidate', (ev) => {
      if (!ev.candidate || closed || pc !== conn) return;
      addDoc(iceRef(code, seat), packCandidate(ev.candidate, mySid)).catch(() => {});
    });

    conn.addEventListener('connectionstatechange', () => {
      if (pc !== conn) return;
      const st = conn.connectionState;
      status(st === 'new' ? 'connecting' : st);
      if (st === 'connected') { retries = 0; clearWatchdog(); }
      else if (st === 'failed') scheduleRecovery(conn, host ? 600 : 2500, 'failed');
      else if (st === 'disconnected') scheduleRecovery(conn, 7000, 'disconnected');
    });

    // Never connected at all — try a fresh negotiation once in a while.
    scheduleRecovery(conn, 25000, 'timeout');
    status('connecting');
    return conn;
  }

  async function addRemoteCandidate(init) {
    try { await pc.addIceCandidate(new RTCIceCandidate(init)); } catch { /* stale or malformed */ }
  }

  /** Feed any queued candidates that belong to the current session. */
  async function drain() {
    if (!pc?.remoteDescription) return;
    const mine = pending.filter((p) => p.sid === sid);
    pending = pending.filter((p) => p.sid !== sid);
    for (const p of mine) await addRemoteCandidate(p.init);
  }

  /** Push any tracks we already hold into the freshly negotiated senders. */
  async function flushSenders() {
    if (!local) return;
    for (const track of local.getTracks()) {
      const sender = tx[track.kind]?.sender;
      if (sender && sender.track !== track) {
        try { await sender.replaceTrack(track); } catch { /* lane not ready */ }
      }
    }
  }

  async function start() {
    if (started || closed || !canCall()) return;
    started = true;
    status('connecting');

    // The other side's candidates — queued until their description is in place.
    unsubs.push(
      onSnapshot(
        iceRef(code, host ? 1 : 0),
        (snap) => {
          snap.docChanges().forEach((change) => {
            if (change.type !== 'added') return;
            const d = change.doc.data();
            if (!d?.sid || !d.candidate) return; // stale signals from an older version
            const init = unpackCandidate(d);
            if (pc && d.sid === sid && pc.remoteDescription) addRemoteCandidate(init);
            else if (!host || d.sid === sid) pending.push({ sid: d.sid, init });
          });
          if (pending.length > 300) pending = pending.slice(-300);
        },
        (err) => console.warn('[arcade] ice', err)
      )
    );

    // Offers, answers and reconnect requests travel on the room document.
    unsubs.push(onSnapshot(roomRef(code), (snap) => onRoom(snap.data()), (err) => console.warn('[arcade] signal', err)));

    if (host) {
      try { await negotiate(); }
      catch (err) {
        console.warn('[arcade] call', err);
        onError?.(err);
        status('failed');
      }
    }
  }

  function onRoom(data) {
    if (!data || closed) return;

    if (host) {
      const a = data.answer;
      if (a?.sdp && a.sid === sid && a.sdp !== seenAnswer && pc?.signalingState === 'have-local-offer') {
        seenAnswer = a.sdp;
        const mySid = sid;
        pc.setRemoteDescription({ type: 'answer', sdp: a.sdp })
          .then(() => { if (sid === mySid) return drain(); })
          .catch((err) => console.warn('[arcade] answer', err));
      }
      // The guest pressed "Reconnect" (or its side gave up).
      const kick = data.rtcKick || '';
      if (lastKick === undefined) lastKick = kick;
      else if (kick !== lastKick) {
        lastKick = kick;
        recover('kick');
      }
      return;
    }

    const o = data.offer;
    if (o?.sdp && o.sid && o.sid !== sid) answerOffer(o);
  }

  /** Host: a brand-new connection, reusing whatever camera/mic is already on. */
  async function negotiate() {
    if (!host || closed) return;
    lastNegotiation = Date.now();
    sid = newCode(10);
    const mySid = sid;
    seenAnswer = '';
    pending = [];

    const conn = buildPc();
    // Reserve both lanes up front so tracks can be swapped in later.
    tx.audio = conn.addTransceiver('audio', { direction: 'sendrecv' });
    tx.video = conn.addTransceiver('video', { direction: 'sendrecv' });
    await flushSenders();

    const desc = await conn.createOffer();
    if (sid !== mySid || closed) return;
    await conn.setLocalDescription(desc);
    await updateDoc(roomRef(code), { offer: { type: desc.type, sdp: desc.sdp, sid: mySid }, answer: null });
    sweep(mySid);
  }

  /** Guest: answer the host's latest offer on a fresh connection. */
  async function answerOffer(o) {
    sid = o.sid;
    const mySid = sid;
    pending = pending.filter((p) => p.sid === mySid);

    const conn = buildPc();
    try {
      await conn.setRemoteDescription({ type: 'offer', sdp: o.sdp });
      if (sid !== mySid || closed) return;
      conn.getTransceivers().forEach((t) => { t.direction = 'sendrecv'; });
      tx.audio = conn.getTransceivers().find((t) => t.receiver?.track?.kind === 'audio') || null;
      tx.video = conn.getTransceivers().find((t) => t.receiver?.track?.kind === 'video') || null;
      await flushSenders();
      await drain();

      const desc = await conn.createAnswer();
      if (sid !== mySid || closed) return;
      await conn.setLocalDescription(desc);
      await updateDoc(roomRef(code), { answer: { type: desc.type, sdp: desc.sdp, sid: mySid } });
    } catch (err) {
      console.warn('[arcade] offer', err);
      if (sid === mySid) status('failed');
    }
  }

  /** Best effort: clear candidates left over from older sessions. */
  async function sweep(keepSid) {
    for (const lane of [0, 1]) {
      try {
        const snap = await getDocs(iceRef(code, lane));
        await Promise.all(snap.docs.filter((d) => d.data()?.sid !== keepSid).map((d) => deleteDoc(d.ref)));
      } catch { /* not important */ }
    }
  }

  /** Manual "Reconnect" — resets the retry budget too. */
  function reconnect() {
    retries = 0;
    lastNegotiation = 0;
    recover('manual');
  }

  /* ------------------------------ devices ------------------------------ */
  async function acquire(kind) {
    const existing = local?.getTracks().find((t) => t.kind === kind && t.readyState === 'live');
    if (existing) return existing;

    const constraints =
      kind === 'video'
        ? { video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' } }
        : { audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    const track = stream.getTracks()[0];
    if (!local) local = new MediaStream();
    local.addTrack(track);

    const sender = tx[kind]?.sender;
    if (sender) await sender.replaceTrack(track);
    onLocal?.(local);
    return track;
  }

  function drop(kind) {
    const track = local?.getTracks().find((t) => t.kind === kind);
    if (track) {
      track.stop();
      local.removeTrack(track);
    }
    tx[kind]?.sender?.replaceTrack(null).catch(() => {});
    onLocal?.(local);
  }

  /** Camera off releases the device outright, so the little light goes out too. */
  async function setCam(on) {
    if (on) { await acquire('video'); cam = true; }
    else { drop('video'); cam = false; }
    return cam;
  }

  /** Mute is instant — the track stays open so unmuting never stutters. */
  async function setMic(on) {
    if (on) {
      const track = await acquire('audio');
      track.enabled = true;
      mic = true;
    } else {
      const track = local?.getTracks().find((t) => t.kind === 'audio');
      if (track) track.enabled = false;
      mic = false;
    }
    return mic;
  }

  function close() {
    closed = true;
    clearWatchdog();
    unsubs.forEach((u) => { try { u(); } catch { /* already off */ } });
    unsubs.length = 0;
    local?.getTracks().forEach((t) => t.stop());
    clearRemote();
    local = null;
    try { pc?.close(); } catch { /* noop */ }
    pc = null;
    status('closed');
  }

  return {
    start,
    close,
    setCam,
    setMic,
    reconnect,
    get cam() { return cam; },
    get mic() { return mic; },
    get localStream() { return local; },
    get remoteStream() { return remote; }
  };
}
