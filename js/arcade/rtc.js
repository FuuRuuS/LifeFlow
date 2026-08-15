/**
 * LifeFlow Arcade — the video call.
 *
 * A small WebRTC helper that uses the room document as its signalling channel.
 * The connection is opened as soon as both players are seated, with the audio
 * and video lanes reserved but empty; turning the camera or microphone on later
 * simply drops a track into the lane it already has, so there is no
 * renegotiation and no pause in the game.
 */
import { updateDoc, onSnapshot, addDoc } from '../firebase.js';
import { roomRef, iceRef } from './rooms.js';

const ICE_CONFIG = {
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }
  ],
  iceCandidatePoolSize: 4
};

export const canCall = () =>
  typeof RTCPeerConnection !== 'undefined' &&
  Boolean(navigator.mediaDevices?.getUserMedia) &&
  (location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname));

export function createCall({ code, seat, onRemote, onLocal, onStatus, onError }) {
  const host = seat === 0;
  const remote = new MediaStream();
  const tx = { audio: null, video: null };
  const unsubs = [];

  let pc = null;
  let local = null;
  let started = false;
  let closed = false;
  let lastOffer = '';
  let cam = false;
  let mic = false;

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

    pc = new RTCPeerConnection(ICE_CONFIG);

    pc.addEventListener('track', (ev) => {
      if (ev.streams?.[0]) ev.streams[0].getTracks().forEach(attachRemote);
      else if (ev.track) attachRemote(ev.track);
    });

    pc.addEventListener('icecandidate', (ev) => {
      if (!ev.candidate || closed) return;
      addDoc(iceRef(code, seat), ev.candidate.toJSON()).catch(() => {});
    });

    pc.addEventListener('connectionstatechange', () => {
      if (!pc) return;
      status(pc.connectionState);
      if (pc.connectionState === 'failed') restartIce();
    });

    // The other side's candidates.
    unsubs.push(
      onSnapshot(iceRef(code, host ? 1 : 0), (snap) => {
        snap.docChanges().forEach((change) => {
          if (change.type !== 'added' || !pc) return;
          pc.addIceCandidate(new RTCIceCandidate(change.doc.data())).catch(() => {});
        });
      })
    );

    try {
      if (host) await offer();
      else await listenForOffer();
    } catch (err) {
      console.warn('[arcade] call', err);
      onError?.(err);
      status('failed');
    }
  }

  async function offer() {
    // Reserve both lanes up front so tracks can be swapped in later.
    tx.audio = pc.addTransceiver('audio', { direction: 'sendrecv' });
    tx.video = pc.addTransceiver('video', { direction: 'sendrecv' });
    await flushSenders();

    const desc = await pc.createOffer();
    await pc.setLocalDescription(desc);
    await updateDoc(roomRef(code), { offer: { type: desc.type, sdp: desc.sdp }, answer: null });

    unsubs.push(
      onSnapshot(roomRef(code), async (snap) => {
        const answer = snap.data()?.answer;
        if (!answer || !pc || pc.currentRemoteDescription || pc.signalingState === 'stable') return;
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (err) {
          console.warn('[arcade] answer', err);
        }
      })
    );
  }

  async function listenForOffer() {
    unsubs.push(
      onSnapshot(roomRef(code), async (snap) => {
        const data = snap.data();
        if (!data?.offer || !pc || data.offer.sdp === lastOffer) return;
        lastOffer = data.offer.sdp;
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
          pc.getTransceivers().forEach((t) => { t.direction = 'sendrecv'; });
          tx.audio = pc.getTransceivers().find((t) => t.receiver?.track?.kind === 'audio') || tx.audio;
          tx.video = pc.getTransceivers().find((t) => t.receiver?.track?.kind === 'video') || tx.video;
          await flushSenders();

          const desc = await pc.createAnswer();
          await pc.setLocalDescription(desc);
          await updateDoc(roomRef(code), { answer: { type: desc.type, sdp: desc.sdp } });
        } catch (err) {
          console.warn('[arcade] offer', err);
        }
      })
    );
  }

  async function restartIce() {
    if (!host || !pc || closed) return;
    try {
      const desc = await pc.createOffer({ iceRestart: true });
      await pc.setLocalDescription(desc);
      await updateDoc(roomRef(code), { offer: { type: desc.type, sdp: desc.sdp }, answer: null });
    } catch { /* leave it to the reconnect button */ }
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
    unsubs.forEach((u) => { try { u(); } catch { /* already off */ } });
    unsubs.length = 0;
    local?.getTracks().forEach((t) => t.stop());
    remote.getTracks().forEach((t) => { try { remote.removeTrack(t); } catch { /* noop */ } });
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
    restartIce,
    get cam() { return cam; },
    get mic() { return mic; },
    get localStream() { return local; },
    get remoteStream() { return remote; }
  };
}
