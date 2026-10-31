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
import { updateDoc, onSnapshot } from '../firebase.js';
import { roomRef, newCode } from './rooms.js';
import { loadIceConfig } from './ice.js';

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
const MAX_CANDIDATES = 80;
const ICE_BATCH_MS = 100;

export const canCall = () =>
  typeof RTCPeerConnection !== 'undefined' &&
  Boolean(navigator.mediaDevices?.getUserMedia) &&
  (location.protocol === 'https:' || location.protocol === 'file:' || ['localhost', '127.0.0.1'].includes(location.hostname));

export function createCall({ code, seat, onRemote, onLocal, onStatus, onError, onDiagnostic }) {
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
  let recoveryWork = null;
  let controlVersion = 0;
  let loadedConfig = null;
  let waitingOffer = false;
  let terminalFailed = false;
  let configIssue = null;
  let attemptIssue = null;
  let remoteSid = '';
  const remoteSeen = new Set();
  const packets = new WeakMap();
  const ownIceField = host ? 'rtcIceHost' : 'rtcIceGuest';
  const otherIceField = host ? 'rtcIceGuest' : 'rtcIceHost';
  // One write lane across ALL sessions. A previously in-flight packet must
  // finish before a new offer/answer can publish its replacement packet.
  let roomWork = Promise.resolve();
  const diagnostic = {
    phase: 'exchange', relayAvailable: false, relayCandidate: false,
    remoteCandidates: 0, issue: null, selectedPath: null
  };
  let lastDiagnostic = '';
  const acquiring = { audio: null, video: null };
  const wanted = { audio: false, video: false };
  const deviceVersion = { audio: 0, video: 0 };
  const senderWork = new WeakMap();

  function report() {
    if (closed) return;
    diagnostic.issue = attemptIssue || configIssue;
    const key = JSON.stringify(diagnostic);
    if (key === lastDiagnostic) return;
    lastDiagnostic = key;
    onDiagnostic?.({ ...diagnostic });
  }
  const status = (s) => {
    if (closed && s !== 'closed') return;
    diagnostic.phase = s;
    onStatus?.(s);
    report();
  };
  const current = (conn, mySid) => !closed && conn && pc === conn && sid === mySid &&
    conn.signalingState !== 'closed' && conn.connectionState !== 'closed';

  function fail(context, err) {
    console.warn('[arcade]', context, err);
    if (closed) return;
    clearWatchdog();
    clearRecovery();
    terminalFailed = true;
    attemptIssue = 'Call setup failed. Reconnect to try again.';
    status('failed');
    onError?.(err);
  }

  function attachRemote(track) {
    if (closed || remote.getTracks().includes(track)) return;
    remote.addTrack(track);
    track.addEventListener('unmute', () => {
      if (!closed && remote.getTracks().includes(track)) onRemote?.(remote);
    });
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

  function queueRoomWrite(guard, work) {
    const next = roomWork.catch(() => {}).then(() => {
      if (!closed && guard()) return work();
    });
    roomWork = next;
    return next;
  }

  async function refreshConfig(force, version) {
    const result = await loadIceConfig(code, { force });
    if (closed || version !== controlVersion) return false;
    loadedConfig = result.config;
    diagnostic.relayAvailable = Boolean(result.relayAvailable);
    configIssue = result.warning?.message || (!result.relayAvailable
      ? 'No TURN relay is available. Direct connections may fail on restricted networks.' : null);
    report(); // Persistent diagnostic, never an onError/toast for a helper warning.
    return true;
  }

  function connected(conn) {
    return conn && !['failed', 'disconnected', 'closed'].includes(conn.iceConnectionState) &&
      (conn.connectionState === 'connected' ||
      ((!conn.connectionState || conn.connectionState === 'new' || conn.connectionState === 'connecting') &&
        ['connected', 'completed'].includes(conn.iceConnectionState)));
  }

  function exhausted() {
    clearWatchdog();
    clearRecovery();
    terminalFailed = true;
    attemptIssue = (host && !pc?.remoteDescription) || (!host && (waitingOffer || !pc))
      ? 'Signaling received no answer or fresh offer. Both players should refresh, then reconnect.'
      : !diagnostic.relayAvailable
        ? 'Connection failed after retries: no TURN relay is available.'
        : !diagnostic.relayCandidate
          ? 'Connection failed after retries: no TURN relay candidate was obtained.'
          : 'Connection failed after retries. Check the network and reconnect manually.';
    status('failed');
  }

  /** Automatic kicks share a finite budget; only an explicit manual retry resets it. */
  function recover(reason, force = false) {
    if (closed) return;
    if (!force && recoveryWork) return recoveryWork;
    // Do not let another automatic kick replace a queued manual refresh.
    if (!force && recoveryTimer) return;
    clearWatchdog();
    clearRecovery();
    const version = ++controlVersion;
    if (reason !== 'manual' && reason !== 'guest start' && retries >= AUTO_RETRIES) {
      exhausted();
      return;
    }
    if (host) {
      const delay = 3000 - (Date.now() - lastNegotiation);
      if (delay > 0) {
        recoveryTimer = setTimeout(() => {
          recoveryTimer = null;
          if (!closed && version === controlVersion) recover(reason, force);
        }, delay);
        return;
      }
    }
    if (reason !== 'manual' && reason !== 'guest start') retries += 1;
    terminalFailed = false;
    attemptIssue = null;
    status('exchange');
    scheduleRecovery(pc, 25000, 'timeout');
    const work = (async () => {
      try {
        if (!await refreshConfig(force, version)) return;
        if (host) await negotiate();
        else {
          waitingOffer = true;
          // Prefix distinguishes user intent from automatic kicks: random
          // automatic IDs alone must never reset the host's retry budget.
          await queueRoomWrite(() => version === controlVersion, () =>
            updateDoc(roomRef(code), { rtcKick: `${force ? 'manual:' : ''}${newCode(8)}` }));
          if (closed || version !== controlVersion) return;
          scheduleRecovery(pc, 25000, 'timeout');
        }
      } catch {
        if (!closed && version === controlVersion) {
          fail('call recovery', new Error('Unable to prepare the call. Reconnect to retry.'));
        }
      }
    })();
    recoveryWork = work;
    work.finally(() => { if (recoveryWork === work) recoveryWork = null; });
    return work;
  }

  function scheduleRecovery(conn, delay, reason) {
    const mySid = sid;
    const active = () => conn ? current(conn, mySid) : !closed && !pc && sid === mySid;
    if (!active() || terminalFailed) return;
    // Repeated ICE/connection events must not postpone the original deadline.
    if (watchdog) return;
    watchdog = setTimeout(() => {
      watchdog = null;
      if (!active() || connected(conn) && !waitingOffer && !recoveryWork) return;
      if (recoveryWork) {
        // Offline Firestore writes may remain pending indefinitely. Do not
        // silently consume the only watchdog while a recovery is still busy.
        controlVersion += 1;
        fail('call timeout', new Error('Call signaling timed out. Reconnect to retry.'));
      } else if (retries >= AUTO_RETRIES) exhausted();
      else recover(reason);
    }, delay);
  }

  function packetValue(state, mySid) {
    return { sid: mySid, candidates: state.candidates.slice(0, MAX_CANDIDATES) };
  }

  function scheduleIce(conn, mySid) {
    const state = packets.get(conn);
    if (!current(conn, mySid) || !state?.published || state.timer || state.inFlight ||
        state.sent >= state.candidates.length) return;
    state.timer = setTimeout(() => {
      state.timer = null;
      flushIce(conn, mySid);
    }, ICE_BATCH_MS);
  }

  async function flushIce(conn, mySid) {
    const state = packets.get(conn);
    if (!current(conn, mySid) || !state?.published || state.inFlight ||
        state.sent >= state.candidates.length) return;
    state.inFlight = true;
    try {
      await queueRoomWrite(() => current(conn, mySid), async () => {
        const packet = packetValue(state, mySid);
        await updateDoc(roomRef(code), { [ownIceField]: packet });
        if (current(conn, mySid)) state.sent = packet.candidates.length;
      });
    } catch {
      if (current(conn, mySid)) {
        state.published = false; // Stop a failing write loop; manual recovery can retry.
        fail('ICE signaling', new Error('Unable to exchange call candidates. Reconnect to retry.'));
      }
    } finally {
      state.inFlight = false;
      scheduleIce(conn, mySid);
    }
  }

  async function publishDescription(conn, mySid, fields) {
    const state = packets.get(conn);
    await queueRoomWrite(() => current(conn, mySid), async () => {
      const packet = packetValue(state, mySid);
      await updateDoc(roomRef(code), { ...fields, [ownIceField]: packet });
      if (!current(conn, mySid)) return;
      state.sent = packet.candidates.length;
      state.published = true;
    });
    // Candidates gathered while setLocalDescription/updateDoc was pending
    // remain cumulative and are flushed only AFTER the description is written.
    scheduleIce(conn, mySid);
  }

  function receivePacket(packet, expectedSid) {
    if (!expectedSid || packet?.sid !== expectedSid || !Array.isArray(packet.candidates)) return;
    if (remoteSid !== expectedSid) {
      remoteSid = expectedSid;
      remoteSeen.clear();
      pending = pending.filter((p) => p.sid === expectedSid);
    }
    for (const d of packet.candidates.slice(0, MAX_CANDIDATES)) {
      if (!d || typeof d.candidate !== 'string' || !d.candidate || (d.sid && d.sid !== expectedSid)) continue;
      const init = unpackCandidate(d);
      const key = JSON.stringify(init);
      if (remoteSeen.has(key) || remoteSeen.size >= MAX_CANDIDATES) continue;
      remoteSeen.add(key);
      if (pc && sid === expectedSid && pc.remoteDescription) addRemoteCandidate(init);
      else pending.push({ sid: expectedSid, init });
    }
    diagnostic.remoteCandidates = remoteSeen.size;
    report();
  }

  async function selectedPath(conn, mySid) {
    try {
      const stats = await conn.getStats();
      if (!current(conn, mySid) || !connected(conn)) return;
      let pair;
      stats.forEach((s) => {
        if (s.type === 'transport' && s.selectedCandidatePairId) pair = stats.get(s.selectedCandidatePairId) || pair;
      });
      if (!pair) stats.forEach((s) => {
        if (s.type === 'candidate-pair' && (s.selected || s.nominated && s.state === 'succeeded')) pair = s;
      });
      if (!pair) return;
      const localCandidate = stats.get(pair.localCandidateId);
      const remoteCandidate = stats.get(pair.remoteCandidateId);
      if (!localCandidate?.candidateType || !remoteCandidate?.candidateType) return;
      diagnostic.selectedPath = [localCandidate, remoteCandidate].some((s) => s.candidateType === 'relay') ? 'relay' : 'direct';
      report();
    } catch { /* Some Safari versions do not expose selected-pair stats. */ }
  }

  function buildPc() {
    if (closed) return null;
    clearWatchdog();
    if (pc) {
      clearTimeout(packets.get(pc)?.timer);
      try { pc.close(); } catch { /* noop */ }
    }
    clearRemote();
    tx.audio = null;
    tx.video = null;

    const conn = new RTCPeerConnection(loadedConfig);
    const mySid = sid;
    pc = conn;
    packets.set(conn, { candidates: [], keys: new Set(), published: false, sent: 0, timer: null, inFlight: false });
    terminalFailed = false;
    attemptIssue = null;
    diagnostic.relayCandidate = false;
    diagnostic.remoteCandidates = remoteSid === mySid ? remoteSeen.size : 0;
    diagnostic.selectedPath = null;

    conn.addEventListener('track', (ev) => {
      if (!current(conn, mySid)) return;
      if (ev.track) attachRemote(ev.track);
    });

    conn.addEventListener('icecandidate', (ev) => {
      if (!ev.candidate || !current(conn, mySid)) return;
      if (ev.candidate.type === 'relay' || /\btyp relay\b/.test(ev.candidate.candidate || '')) {
        diagnostic.relayCandidate = true;
        report();
      }
      const state = packets.get(conn);
      const candidate = packCandidate(ev.candidate, mySid);
      const key = JSON.stringify(candidate);
      if (!candidate.candidate || state.keys.has(key) || state.candidates.length >= MAX_CANDIDATES) return;
      state.keys.add(key);
      state.candidates.push(candidate);
      scheduleIce(conn, mySid);
    });

    conn.addEventListener('icecandidateerror', (ev) => {
      if (!current(conn, mySid) || terminalFailed || !/^turns?:/i.test(ev.url || '')) return;
      // STUN errors (including per-interface 701s) are not proof of TURN failure.
      // Never surface the event URL, address, errorText, or credentials.
      attemptIssue = 'A TURN relay request failed. Direct connection is still being attempted.';
      report();
    });

    const stateChanged = () => {
      if (!current(conn, mySid)) return;
      const st = conn.connectionState;
      const ice = conn.iceConnectionState;
      if (connected(conn) && !waitingOffer) {
        terminalFailed = false;
        if (!recoveryWork) clearWatchdog();
        // A queued kick/manual retry still needs a NEW session, even if the
        // old peer briefly connects during the host's cooldown.
        status('connected');
        selectedPath(conn, mySid);
      } else if (!terminalFailed) {
        status(conn.remoteDescription ? 'connecting' : 'exchange');
        if (st === 'failed' || ice === 'failed') scheduleRecovery(conn, host ? 600 : 2500, 'failed');
        else if (st === 'disconnected' || ice === 'disconnected') scheduleRecovery(conn, 7000, 'disconnected');
      }
    };
    conn.addEventListener('connectionstatechange', stateChanged);
    conn.addEventListener('iceconnectionstatechange', stateChanged);

    // Never connected at all — try a fresh negotiation once in a while.
    scheduleRecovery(conn, 25000, 'timeout');
    onRemote?.(remote);
    status('exchange');
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

  async function start(force = false) {
    if (started || closed || !canCall()) return;
    started = true;
    terminalFailed = false;
    attemptIssue = null;
    status('exchange');
    const version = ++controlVersion;
    try {
      // Auth/cache/credential refresh belongs exclusively to the ICE helper.
      if (!await refreshConfig(force, version)) return;
      unsubs.push(onSnapshot(roomRef(code), (snap) => onRoom(snap.data()), (err) => fail('signal subscription', err)));
      if (host) await negotiate();
      else await recover('guest start', force); // A reload needs a fresh offer.
    } catch {
      if (!closed && version === controlVersion) {
        started = false;
        unsubs.splice(0).forEach((u) => u());
        fail('call configuration', new Error('Unable to load call configuration. Reconnect to retry.'));
      }
    }
  }

  function onRoom(data) {
    if (!data || closed) return;

    if (host) {
      receivePacket(data[otherIceField], sid);
      const a = data.answer;
      if (a?.sdp && a.sid === sid && a.sdp !== seenAnswer && pc?.signalingState === 'have-local-offer') {
        seenAnswer = a.sdp;
        const conn = pc;
        const mySid = sid;
        conn.setRemoteDescription({ type: 'answer', sdp: a.sdp })
          .then(() => {
            if (!current(conn, mySid)) return;
            if (!terminalFailed) status(connected(conn) ? 'connected' : 'connecting');
            return drain(conn, mySid);
          })
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
        if (typeof kick === 'string' && kick.startsWith('manual:')) {
          retries = 0;
          recover('manual', true);
        } else recover('kick');
      }
      return;
    }

    const o = data.offer;
    // Read the packet BEFORE adopting the offer: early candidates survive the
    // asynchronous setRemoteDescription, including packets in the offer write.
    receivePacket(data[otherIceField], o?.sid);
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
    remoteSid = mySid;
    remoteSeen.clear();

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
      await publishDescription(conn, mySid, { offer: { type: desc.type, sdp: desc.sdp, sid: mySid }, answer: null });
      if (!current(conn, mySid)) return;
    } catch (err) {
      if (current(conn, mySid) || (!conn && !closed && sid === mySid)) fail('offer negotiation', err);
      else console.warn('[arcade] stale offer negotiation', err);
    }
  }

  /** Guest: answer the host's latest offer on a fresh connection. */
  async function answerOffer(o) {
    if (closed) return;
    waitingOffer = false;
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
      await publishDescription(conn, mySid, { answer: { type: desc.type, sdp: desc.sdp, sid: mySid } });
      if (!current(conn, mySid)) return;
      if (!terminalFailed) status(connected(conn) && !waitingOffer ? 'connected' : 'connecting');
    } catch (err) {
      if (current(conn, mySid) || (!conn && !closed && sid === mySid)) fail('answer negotiation', err);
      else console.warn('[arcade] stale answer negotiation', err);
    }
  }

  /** Manual "Reconnect" — resets the retry budget too. */
  function reconnect() {
    if (closed) return;
    retries = 0;
    if (!started || !unsubs.length) {
      // Manual retry can supersede an unresolved initial helper request too.
      started = false;
      return start(true);
    }
    return recover('manual', true);
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
    controlVersion += 1;
    clearWatchdog();
    clearRecovery();
    if (pc) clearTimeout(packets.get(pc)?.timer);
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
    remoteSeen.clear();
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
    get remoteStream() { return remote; },
    get diagnostics() { return { ...diagnostic }; }
  };
}
