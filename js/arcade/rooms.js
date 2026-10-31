/**
 * LifeFlow Arcade — remote play over Firestore.
 *
 * A room is a single document under `rooms/{code}` holding the shared game
 * state. Both players watch it; only the player whose turn it is writes to it.
 * The same document doubles as the signalling channel for the video call.
 */
import {
  db, doc, collection, setDoc, getDoc, updateDoc, deleteDoc, onSnapshot, getDocs, serverTimestamp, runTransaction
} from '../firebase.js';
import * as store from '../store.js';

/** Unambiguous alphabet — no O/0 or I/1 to misread down the phone. */
const ALPHABET = 'ACDEFGHJKLMNPQRSTUVWXYZ23456789';
export const SEAT_KEYS = ['a', 'b'];

export function newCode(len = 8) {
  const bytes = new Uint32Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

export function roomRef(code) {
  return doc(db, 'rooms', code);
}

export function iceRef(code, seat) {
  return collection(db, 'rooms', code, seat === 0 ? 'iceHost' : 'iceGuest');
}

export function inviteLink(code) {
  // location.origin is "null" on file://, so build from the full URL instead.
  const base = location.href.split('#')[0];
  return `${base}#/games?room=${encodeURIComponent(code)}`;
}

function me() {
  const s = store.state;
  return {
    uid: s.uid,
    name: s.profile?.name || s.user?.displayName || (s.user?.email || 'Player').split('@')[0]
  };
}

/* ------------------------------ lifecycle ------------------------------ */
export async function createRoom({ gameId, level, state }) {
  const who = me();
  if (!who.uid) throw new Error('Sign in to play with a friend.');
  const code = newCode();

  await setDoc(roomRef(code), {
    code,
    gameId,
    level: level || 'even',
    hostUid: who.uid,
    guestUid: null,
    host: { name: who.name },
    guest: null,
    state,
    seq: 0,
    round: 0,
    outcome: null,
    media: { a: { cam: false, mic: false }, b: { cam: false, mic: false } },
    rematch: { a: false, b: false },
    chat: [],
    offer: null,
    answer: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  return code;
}

export async function joinRoom(code) {
  const who = me();
  if (!who.uid) throw new Error('Sign in to join the game.');

  const snap = await getDoc(roomRef(code));
  if (!snap.exists()) throw new Error('That game could not be found — the link may have expired.');

  const data = snap.data();
  if (data.hostUid === who.uid) return { seat: 0, data };
  if (data.guestUid && data.guestUid !== who.uid) throw new Error('This game already has two players.');

  if (data.guestUid !== who.uid) {
    await updateDoc(roomRef(code), {
      guestUid: who.uid,
      guest: { name: who.name },
      updatedAt: serverTimestamp()
    });
  }
  return { seat: 1, data };
}

export function watchRoom(code, onChange, onGone) {
  return onSnapshot(
    roomRef(code),
    (snap) => {
      if (!snap.exists()) { onGone?.(); return; }
      onChange(snap.data());
    },
    (err) => {
      console.warn('[arcade] room snapshot', err);
      onGone?.(err);
    }
  );
}

/* ------------------------------ play ------------------------------ */
export async function pushState(code, { state, outcome, seq }) {
  await updateDoc(roomRef(code), {
    state,
    outcome: outcome || null,
    seq,
    rematch: { a: false, b: false },
    updatedAt: serverTimestamp()
  });
}

export async function pushRematch(code, seat, on) {
  await updateDoc(roomRef(code), {
    [`rematch.${SEAT_KEYS[seat]}`]: Boolean(on),
    updatedAt: serverTimestamp()
  });
}

export async function restart(code, state, seq, round) {
  await updateDoc(roomRef(code), {
    state,
    outcome: null,
    seq,
    round,
    rematch: { a: false, b: false },
    updatedAt: serverTimestamp()
  });
}

export async function pushMedia(code, seat, media) {
  await updateDoc(roomRef(code), {
    [`media.${SEAT_KEYS[seat]}`]: media,
    updatedAt: serverTimestamp()
  });
}

/* ------------------------------ chat ------------------------------ */
export const CHAT_MAX = 400;
const CHAT_KEEP = 50;

/**
 * Append a message (or a floating reaction) to the room's chat.
 * Kept inside the room document so it needs no extra rules, and capped so
 * the document never grows without bound.
 */
export async function sendChat(code, seat, text, kind = 'msg') {
  const body = String(text || '').replace(/\s+/g, ' ').trim().slice(0, CHAT_MAX);
  if (!body) return;
  const entry = {
    id: newCode(10),
    seat,
    name: me().name.slice(0, 40),
    text: body,
    kind: kind === 'react' ? 'react' : 'msg',
    at: Date.now()
  };
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(roomRef(code));
    if (!snap.exists()) throw new Error('The game was closed.');
    const chat = Array.isArray(snap.data().chat) ? snap.data().chat : [];
    tx.update(roomRef(code), { chat: [...chat, entry].slice(-CHAT_KEEP), updatedAt: serverTimestamp() });
  });
}

/* ------------------------------ leaving ------------------------------ */
async function wipeSignals(code) {
  for (const seat of [0, 1]) {
    try {
      const snap = await getDocs(iceRef(code, seat));
      await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
    } catch {
      /* best effort — the room is going away anyway */
    }
  }
}

export async function leaveRoom(code, seat) {
  if (!code) return;
  try {
    if (seat === 0) {
      await wipeSignals(code);
      await deleteDoc(roomRef(code));
    } else {
      await updateDoc(roomRef(code), {
        guestUid: null,
        guest: null,
        offer: null,
        answer: null,
        updatedAt: serverTimestamp()
      });
    }
  } catch (err) {
    console.warn('[arcade] leave', err);
  }
}
