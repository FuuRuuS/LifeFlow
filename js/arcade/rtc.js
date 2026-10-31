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
  let recoveryTimer = null;
  const acquiring = { audio: null, video: null };
  const wanted = { audio: false, video: false };
  const deviceVersion = { audio: 0, video: 0 };
  const senderWork = new WeakMap();

  const status = (s) => { if (!closed || s === 'closed') onStatus?.(s); };
  const current = (conn, mySid) => !closed && conn && pc === conn && sid === mySid &&
    conn.signalingState !== 'closed' && conn.connectionState !== 'closed';

  function fail(context, err) {
    console.warn('[arcade]', context, err);
    if (closed) return;
    status('failed');
    onError?.(err);
  }

  function attachRemote(track) {
    if (closed || remote.getTracks().includes(track)) return;
    remote.addTrack(track);
    track.addEventListener('ended', () => {
      if (closed || !remote.getTracks().includes(track)) return;
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

  function clearRecovery() {
    if (recoveryTimer) clearTimeout(recoveryTimer);
    recoveryTimer = null;
  }

  /** Ask for a fresh connection: the host renegotiates, the guest nudges the host. */
  function recover(reason) {
    if (closed) return;
    if (host) {
      const delay = 3000 - (Date.now() - lastNegotiation);
      if (delay > 0) {
        if (!recoveryTimer) recoveryTimer = setTimeout(() => {
          recoveryTimer = null;
          recover(reason);
        }, delay);
        return;
      }
      return negotiate();
    } else {
      return updateDoc(roomRef(code), { rtcKick: newCode(8) })
        .catch((err) => fail('reconnect request', err));
    }
  }

  function scheduleRecovery(conn, delay, reason) {
    const mySid = sid;
    if (!current(conn, mySid)) return;
    clearWatchdog();
    if (retries >= AUTO_RETRIES) return;
    watchdog = setTimeout(() => {
      watchdog = null;
      if (!current(conn, mySid) || conn.connectionState === 'connected') return;
      retries += 1;
      recover(reason);
    }, delay);
  }

  function buildPc() {
    if (closed) return null;
    clearWatchdog();
    if (pc) { try { pc.close(); } catch { /* noop */ } }
    clearRemote();
    tx.audio = null;
    tx.video = null;

    const conn = new RTCPeerConnection(iceConfig());
    const mySid = sid;
    pc = conn;

    conn.addEventListener('track', (ev) => {
      if (!current(conn, mySid)) return;
      if (ev.track) attachRemote(ev.track);
    });

    conn.addEventListener('icecandidate', (ev) => {
      if (!ev.candidate || !current(conn, mySid)) return;
      addDoc(iceRef(code, seat), packCandidate(ev.candidate, mySid))
        .catch((err) => console.warn('[arcade] publish candidate', err));
    });

    conn.addEventListener('connectionstatechange', () => {
      if (!current(conn, mySid)) return;
      const st = conn.connectionState;
      status(st === 'new' ? 'connecting' : st);
      if (st === 'connected') { retries = 0; clearWatchdog(); }
      else if (st === 'failed') scheduleRecovery(conn, host ? 600 : 2500, 'failed');
      else if (st === 'disconnected') scheduleRecovery(conn, 7000, 'disconnected');
    });

    // Never connected at all — try a fresh negotiation once in a while.
    scheduleRecovery(conn, 25000, 'timeout');
    onRemote?.(remote);
    status('connecting');
    return conn;
  }

  async function addRemoteCandidate(init, conn = pc, mySid = sid) {
    if (!current(conn, mySid)) return;
    try {
      await conn.addIceCandidate(new RTCIceCandidate(init));
      if (!current(conn, mySid)) return;
    } catch (err) { console.warn('[arcade] remote candidate', err); }
  }

  /** Feed any queued candidates that belong to the current session. */
  async function drain(conn = pc, mySid = sid) {
    if (!current(conn, mySid) || !conn.remoteDescription) return;
    const mine = pending.filter((p) => p.sid === mySid);
    pending = pending.filter((p) => p.sid !== mySid);
    for (const p of mine) {
      if (!current(conn, mySid)) return;
      await addRemoteCandidate(p.init, conn, mySid);
      if (!current(conn, mySid)) return;
    }
  }

  /** Order replacements on each reserved lane, including concurrent device toggles. */
  async function replaceSender(conn, mySid, sender, kind, track) {
    const previous = senderWork.get(sender);
    const work = (async () => {
      // A previous caller reports its own error; it must not block later replacements.
      if (previous) await previous.catch(() => {});
      if (!current(conn, mySid)) return;
      if (track && (track.readyState !== 'live' || !local?.getTracks().includes(track))) return;
      if (!track && local?.getTracks().some((t) => t.kind === kind && t.readyState === 'live')) return;
      if (sender.track !== track) {
        await sender.replaceTrack(track);
        if (!current(conn, mySid)) return;
      }
    })();
    senderWork.set(sender, work);
    try { await work; }
    finally { if (senderWork.get(sender) === work) senderWork.delete(sender); }
  }

  /** Push any tracks we already hold into the freshly negotiated senders. */
  async function flushSenders(conn = pc, mySid = sid) {
    if (!current(conn, mySid) || !local) return;
    const senders = { audio: tx.audio?.sender, video: tx.video?.sender };
    for (const track of local.getTracks()) {
      if (!current(conn, mySid)) return;
      const sender = senders[track.kind];
      if (sender) {
        await replaceSender(conn, mySid, sender, track.kind, track);
        if (!current(conn, mySid)) return;
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
          if (closed) return;
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
        (err) => fail('ice subscription', err)
      )
    );

    // Offers, answers and reconnect requests travel on the room document.
    unsubs.push(onSnapshot(roomRef(code), (snap) => onRoom(snap.data()), (err) => fail('signal subscription', err)));

    if (host) await negotiate();
    else await recover('guest start'); // A reload cannot reuse the host's already-answered offer.
  }

  function onRoom(data) {
    if (!data || closed) return;

    if (host) {
      const a = data.answer;
      if (a?.sdp && a.sid === sid && a.sdp !== seenAnswer && pc?.signalingState === 'have-local-offer') {
        seenAnswer = a.sdp;
        const conn = pc;
        const mySid = sid;
        conn.setRemoteDescription({ type: 'answer', sdp: a.sdp })
          .then(() => { if (current(conn, mySid)) return drain(conn, mySid); })
          .catch((err) => {
            if (!current(conn, mySid)) return;
            seenAnswer = '';
            fail('answer', err);
          });
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
    clearRecovery();
    lastNegotiation = Date.now();
    sid = newCode(10);
    const mySid = sid;
    seenAnswer = '';
    pending = [];

    let conn;
    try {
      conn = buildPc();
      if (!current(conn, mySid)) return;
      // Reserve both lanes up front so tracks can be swapped in later.
      tx.audio = conn.addTransceiver('audio', { direction: 'sendrecv' });
      tx.video = conn.addTransceiver('video', { direction: 'sendrecv' });
      await flushSenders(conn, mySid);
      if (!current(conn, mySid)) return;

      const desc = await conn.createOffer();
      if (!current(conn, mySid)) return;
      await conn.setLocalDescription(desc);
      if (!current(conn, mySid)) return;
      await updateDoc(roomRef(code), { offer: { type: desc.type, sdp: desc.sdp, sid: mySid }, answer: null });
      if (!current(conn, mySid)) return;
      sweep(conn, mySid);
    } catch (err) {
      if (current(conn, mySid) || (!conn && !closed && sid === mySid)) fail('offer negotiation', err);
      else console.warn('[arcade] stale offer negotiation', err);
    }
  }

  /** Guest: answer the host's latest offer on a fresh connection. */
  async function answerOffer(o) {
    if (closed) return;
    sid = o.sid;
    const mySid = sid;
    pending = pending.filter((p) => p.sid === mySid);

    let conn;
    try {
      conn = buildPc();
      if (!current(conn, mySid)) return;
      await conn.setRemoteDescription({ type: 'offer', sdp: o.sdp });
      if (!current(conn, mySid)) return;
      conn.getTransceivers().forEach((t) => { t.direction = 'sendrecv'; });
      tx.audio = conn.getTransceivers().find((t) => t.receiver?.track?.kind === 'audio') || null;
      tx.video = conn.getTransceivers().find((t) => t.receiver?.track?.kind === 'video') || null;
      await flushSenders(conn, mySid);
      if (!current(conn, mySid)) return;
      await drain(conn, mySid);
      if (!current(conn, mySid)) return;

      const desc = await conn.createAnswer();
      if (!current(conn, mySid)) return;
      await conn.setLocalDescription(desc);
      if (!current(conn, mySid)) return;
      await updateDoc(roomRef(code), { answer: { type: desc.type, sdp: desc.sdp, sid: mySid } });
      if (!current(conn, mySid)) return;
    } catch (err) {
      if (current(conn, mySid) || (!conn && !closed && sid === mySid)) fail('answer negotiation', err);
      else console.warn('[arcade] stale answer negotiation', err);
    }
  }

  /** Best effort: clear candidates left over from older sessions. */
  async function sweep(conn, keepSid) {
    for (const lane of [0, 1]) {
      if (!current(conn, keepSid)) return;
      try {
        const snap = await getDocs(iceRef(code, lane));
        if (!current(conn, keepSid)) return;
        await Promise.all(snap.docs.filter((d) => d.data()?.sid !== keepSid).map((d) => deleteDoc(d.ref)));
        if (!current(conn, keepSid)) return;
      } catch (err) { console.warn('[arcade] candidate cleanup', err); }
    }
  }

  /** Manual "Reconnect" — resets the retry budget too. */
  function reconnect() {
    retries = 0;
    lastNegotiation = 0;
    recover('manual');
  }

  /* ------------------------------ devices ------------------------------ */
  function acquire(kind) {
    if (closed || !wanted[kind]) return Promise.resolve(null);
    if (acquiring[kind]) return acquiring[kind];
    const existing = local?.getTracks().find((t) => t.kind === kind && t.readyState === 'live');
    if (existing) return Promise.resolve(existing);

    const constraints =
      kind === 'video'
        ? { video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' } }
        : { audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } };

    const work = (async () => {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      // Permission prompts may resolve after an off toggle or after the call is gone.
      if (closed || !wanted[kind]) {
        stream.getTracks().forEach((t) => t.stop());
        return null;
      }
      const track = stream.getTracks().find((t) => t.kind === kind && t.readyState === 'live');
      stream.getTracks().forEach((t) => { if (t !== track) t.stop(); });
      if (!track) throw new Error(`No live ${kind} track was provided.`);
      if (!local) local = new MediaStream();
      local.getTracks().filter((t) => t.kind === kind).forEach((t) => {
        t.stop();
        local.removeTrack(t);
      });
      local.addTrack(track);

      const conn = pc;
      const mySid = sid;
      const sender = tx[kind]?.sender;
      try {
        if (sender) await replaceSender(conn, mySid, sender, kind, track);
      } catch (err) {
        if (current(conn, mySid)) {
          track.stop();
          local?.removeTrack(track);
          onLocal?.(local);
          throw err;
        }
        console.warn('[arcade] stale device sender', err);
      }
      if (closed || !local?.getTracks().includes(track) || track.readyState !== 'live') return null;
      onLocal?.(local);
      return track;
    })();
    acquiring[kind] = work.catch((err) => {
      if (closed || !wanted[kind]) return null;
      throw err;
    }).finally(() => { acquiring[kind] = null; });
    return acquiring[kind];
  }

  function drop(kind) {
    local?.getTracks().filter((t) => t.kind === kind).forEach((track) => {
      track.stop();
      local.removeTrack(track);
    });
    const conn = pc;
    const mySid = sid;
    const sender = tx[kind]?.sender;
    if (sender) replaceSender(conn, mySid, sender, kind, null).catch((err) => {
      if (current(conn, mySid)) fail('detach device', err);
    });
    if (!closed) onLocal?.(local);
  }

  /** Camera off releases the device outright, so the little light goes out too. */
  async function setCam(on) {
    if (closed) return false;
    wanted.video = Boolean(on);
    const version = ++deviceVersion.video;
    if (on) {
      let track = await acquire('video');
      if (closed || version !== deviceVersion.video) return cam;
      // An off/on pair may have shared an acquisition whose track was already dropped.
      if (!track) {
        track = await acquire('video');
        if (closed || version !== deviceVersion.video) return cam;
      }
      cam = Boolean(track && track.readyState === 'live');
    } else {
      cam = false;
      drop('video');
    }
    return cam;
  }

  /** Mute is instant — the track stays open so unmuting never stutters. */
  async function setMic(on) {
    if (closed) return false;
    wanted.audio = Boolean(on);
    const version = ++deviceVersion.audio;
    if (on) {
      let track = await acquire('audio');
      if (closed || version !== deviceVersion.audio) return mic;
      if (!track) {
        track = await acquire('audio');
        if (closed || version !== deviceVersion.audio) return mic;
      }
      if (!track || track.readyState !== 'live') return mic;
      track.enabled = true;
      mic = true;
    } else {
      local?.getAudioTracks().forEach((track) => { track.enabled = false; });
      mic = false;
    }
    return mic;
  }

  function close() {
    if (closed) return;
    closed = true;
    clearWatchdog();
    clearRecovery();
    wanted.audio = wanted.video = false;
    deviceVersion.audio += 1;
    deviceVersion.video += 1;
    cam = mic = false;
    unsubs.forEach((u) => { try { u(); } catch { /* already off */ } });
    unsubs.length = 0;
    local?.getTracks().forEach((t) => t.stop());
    clearRemote();
    local = null;
    try { pc?.close(); } catch { /* noop */ }
    pc = null;
    tx.audio = tx.video = null;
    pending = [];
    onLocal?.(null);
    onRemote?.(remote);
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
