/**
 * LifeFlow — Games.
 * A small arcade: play the computer, or send someone a link and play them
 * face to face, with the camera and microphone under your thumb.
 */
import { esc, haptic, initials } from '../utils.js';
import { icon } from '../icons.js';
import { toast, modal, confetti } from '../ui.js';
import * as store from '../store.js';
import { navigate, currentQuery } from '../router.js';
import { GAMES, gameById } from '../arcade/index.js';
import * as rooms from '../arcade/rooms.js';
import { createCall, canCall } from '../arcade/rtc.js';

export const meta = { title: 'Games', icon: 'gamepad', label: 'Games' };

/* =========================================================
   Session
   ========================================================= */
let session = null;
let rootEl = null;
let lastQuery = '';
const levels = {}; // remembered difficulty per game

/* Per-game settings, remembered on this device. */
const SETTINGS_KEY = 'lf:game-settings';
let chosen = loadSettings();

function loadSettings() {
  try {
    const v = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

/** The saved choices for a game, each checked against the options it offers. */
function settingsFor(game) {
  const saved = chosen[game.meta.id];
  const out = {};
  for (const opt of game.meta.settings || []) {
    const v = saved && typeof saved === 'object' ? saved[opt.id] : undefined;
    out[opt.id] = opt.options.some((o) => o.v === v) ? v : opt.def;
  }
  return out;
}

function saveSettings(gameId, values) {
  chosen = { ...chosen, [gameId]: values };
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(chosen)); } catch { /* private mode */ }
}

const q = (sel) => rootEl?.querySelector(sel);
const myName = () =>
  store.state.profile?.name || store.state.user?.displayName || (store.state.user?.email || 'You').split('@')[0];

function clearTimers() {
  session?.timers?.forEach((t) => clearTimeout(t));
  if (session) session.timers = [];
}

function teardown({ leaveTable = true } = {}) {
  const s = session;
  session = null;
  if (!s) return;
  s.timers?.forEach((t) => clearTimeout(t));
  try { s.unsub?.(); } catch { /* already off */ }
  try { s.call?.close(); } catch { /* already closed */ }
  if (leaveTable && s.mode === 'remote' && s.code) rooms.leaveRoom(s.code, s.seat);
}

/** Called by the shell when the player navigates away. */
export function unmount() {
  teardown();
  lastQuery = '';
  if (rootEl) delete rootEl.dataset.arcade;
}

/* =========================================================
   Render
   ========================================================= */
export function render(root) {
  rootEl = root;
  readQuery();

  const key = session ? session.key : 'lobby';
  // The shell repaints on every data change; a live table must survive that.
  if (root.dataset.arcade === key && root.querySelector('[data-arcade-root]')) return;

  root.dataset.arcade = key;
  root.innerHTML = session ? tableHtml() : lobbyHtml();
  if (session) wireTable();
  else wireLobby();
}

function repaint() {
  if (!rootEl) return;
  delete rootEl.dataset.arcade;
  render(rootEl);
}

/** `#/games?room=CODE` joins a friend, `#/games?play=id` opens a game. */
function readQuery() {
  const params = currentQuery();
  const stamp = `${params.room || ''}|${params.play || ''}`;
  if (!stamp || stamp === '|' || stamp === lastQuery) return;
  // Signed-in state may still be arriving — try again on the next paint.
  if (params.room && !store.state.uid) return;
  lastQuery = stamp;
  if (params.room) joinByCode(params.room);
  else if (params.play && gameById(params.play)) startSolo(params.play);
}

/* =========================================================
   Lobby
   ========================================================= */
const SHELVES = [
  { id: 'all', label: 'All', emoji: '✨' },
  { id: 'couple', label: 'Couples', emoji: '💞' },
  { id: 'friends', label: 'Friends & party', emoji: '🎉' },
  { id: 'board', label: 'Board', emoji: '🎲' },
  { id: 'cards', label: 'Cards', emoji: '🃏' },
  { id: 'brain', label: 'Quiz & brain', emoji: '🧠' }
];
let shelf = 'all';

const onShelf = (g) => shelf === 'all' || (g.meta.group || []).includes(shelf);

function lobbyHtml() {
  return `
    <div class="page arcade-lobby" data-arcade-root>
      <section class="card arcade-hero">
        <div class="grow">
          <span class="eyebrow">Play together</span>
          <h2>Games</h2>
          <p class="fs-sm t-dim">Couples, friends, cards, board games and quizzes. Play the house, pass the phone around, or invite someone online — with chat, voice and video.</p>
        </div>
        <span class="arcade-hero__art" aria-hidden="true">
          <i>🎭</i><i>💞</i><i>🧠</i><i>🪿</i><i>♠️</i>
        </span>
      </section>

      <nav class="arcade-shelves" role="tablist" aria-label="Game types">
        ${SHELVES.map(
          (sh) => `<button class="arcade-shelf" role="tab" type="button" data-shelf="${sh.id}" aria-selected="${sh.id === shelf}">
                     <span aria-hidden="true">${sh.emoji}</span> ${esc(sh.label)}
                     <b>${sh.id === 'all' ? GAMES.length : GAMES.filter((g) => (g.meta.group || []).includes(sh.id)).length}</b>
                   </button>`
        ).join('')}
      </nav>

      <div class="arcade-grid" data-grid>
        ${GAMES.map((g, i) => gameCard(g, i)).join('')}
      </div>

      <section class="card arcade-join">
        <div class="grow">
          <h3 class="card__title">${icon('link')} Got a code?</h3>
          <p class="fs-sm t-dim">Paste the code a friend sent you and you will be dropped straight into their game.</p>
        </div>
        <form class="arcade-join__form" data-join-form>
          <input class="input" name="code" placeholder="e.g. K7NQ4RTM" autocomplete="off"
                 spellcheck="false" maxlength="12" aria-label="Game code" />
          <button class="btn btn--primary" type="submit">Join</button>
        </form>
      </section>
    </div>`;
}

function gameCard(game, i) {
  const m = game.meta;
  const level = levels[m.id] || 'even';
  return `
    <article class="gcard${m.local ? ' gcard--social' : ''}" style="--i:${i}" data-game="${m.id}"${onShelf(game) ? '' : ' hidden'}>
      <div class="gcard__art gcard__art--${m.id}">
        <span class="gcard__glow"></span>
        <span class="gcard__emoji">${m.emoji}</span>
      </div>
      <div class="gcard__body">
        <h2 class="gcard__title">${esc(m.title)}</h2>
        <p class="gcard__tag">${esc(m.tagline)}</p>
        <p class="gcard__blurb">${esc(m.blurb)}</p>
        <div class="gcard__chips">
          <span class="chip">${icon('clock')} ${esc(m.minutes)}</span>
          ${m.tags.map((t) => `<span class="chip">${esc(t)}</span>`).join('')}
        </div>
        ${m.levels.length ? `
        <div class="segmented segmented--tiny" role="tablist" aria-label="Difficulty">
          ${m.levels
            .map(
              (l) =>
                `<button role="tab" type="button" aria-selected="${l.id === level}"
                         data-level="${l.id}" data-for="${m.id}" title="${esc(l.hint)}">${esc(l.label)}</button>`
            )
            .join('')}
        </div>` : ''}
        <div class="gcard__actions">
          ${m.local
            ? `<button class="btn btn--primary" type="button" data-solo="${m.id}">${icon('users')} Play here together</button>`
            : `<button class="btn btn--primary" type="button" data-solo="${m.id}">${icon('bot')} Play the computer</button>`}
          <button class="btn btn--ghost" type="button" data-invite="${m.id}">${icon('link')} Play online</button>
          ${m.settings?.length ? `<button class="iconbtn gcard__cog" type="button" data-settings="${m.id}" aria-label="${esc(m.title)} settings" title="Settings">${icon('settings')}</button>` : ''}
        </div>
      </div>
    </article>`;
}

function wireLobby() {
  rootEl.querySelectorAll('[data-shelf]').forEach((b) =>
    b.addEventListener('click', () => {
      shelf = b.dataset.shelf;
      rootEl.querySelectorAll('[data-shelf]').forEach((s) => s.setAttribute('aria-selected', String(s === b)));
      let n = 0;
      rootEl.querySelectorAll('.gcard').forEach((card) => {
        const show = onShelf(gameById(card.dataset.game));
        card.hidden = !show;
        if (show) {
          card.style.setProperty('--i', String(n++));
          card.classList.remove('is-shuffled');
          void card.offsetWidth;
          card.classList.add('is-shuffled');
        }
      });
      haptic();
    })
  );

  rootEl.querySelectorAll('[data-level]').forEach((b) =>
    b.addEventListener('click', () => {
      levels[b.dataset.for] = b.dataset.level;
      b.parentElement.querySelectorAll('button').forEach((s) => s.setAttribute('aria-selected', String(s === b)));
      haptic();
    })
  );

  rootEl.querySelectorAll('[data-solo]').forEach((b) =>
    b.addEventListener('click', () => startSolo(b.dataset.solo))
  );

  rootEl.querySelectorAll('[data-invite]').forEach((b) =>
    b.addEventListener('click', () => host(b.dataset.invite, b))
  );

  rootEl.querySelectorAll('[data-settings]').forEach((b) =>
    b.addEventListener('click', () => {
      const game = gameById(b.dataset.settings);
      if (game) showSettings(game, false);
    })
  );

  const form = q('[data-join-form]');
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const code = form.code.value.trim().toUpperCase();
    if (code) joinByCode(code);
  });
}

/* =========================================================
   Starting a game
   ========================================================= */
function startSolo(gameId) {
  const game = gameById(gameId);
  if (!game) return;
  teardown();

  session = {
    key: `solo:${gameId}:${Date.now()}`,
    game,
    mode: 'solo',
    level: levels[gameId] || 'even',
    seat: 0,
    round: 0,
    names: [myName(), game.meta.local ? partnerName : computerName(game, levels[gameId] || 'even')],
    state: game.create(settingsFor(game)),
    timers: []
  };
  repaint();
  tick();
}

let partnerName = 'Player 2';

function computerName(game, level) {
  const l = game.meta.levels.find((x) => x.id === level);
  return l ? `${l.label} bot` : 'The computer';
}

async function host(gameId, button) {
  const game = gameById(gameId);
  if (!game) return;
  if (!store.state.uid) { toast('Sign in first so your friend can find you.', 'error'); return; }

  button?.classList.add('is-loading');
  try {
    const level = levels[gameId] || 'even';
    const state = game.create(settingsFor(game));
    const code = await rooms.createRoom({ gameId, level, state });
    openRoom({ code, game, seat: 0, state, level });
    showInvite(code, true);
  } catch (err) {
    console.warn('[arcade] host', err);
    toast(roomError(err, 'Could not open the room.'), 'error', 6000);
  } finally {
    button?.classList.remove('is-loading');
  }
}

async function joinByCode(rawCode) {
  const code = String(rawCode).trim().toUpperCase();
  if (session?.code === code) return;
  if (!store.state.uid) { toast('Sign in to join the game.', 'error'); return; }

  try {
    const { seat, data } = await rooms.joinRoom(code);
    const game = gameById(data.gameId);
    if (!game) throw new Error('That game is not available in this version.');
    openRoom({ code, game, seat, state: data.state, level: data.level, room: data });
    toast(seat === 1 ? 'You are in — good luck.' : 'Back at your table.', 'success');
  } catch (err) {
    console.warn('[arcade] join', err);
    toast(roomError(err, 'Could not join that game.'), 'error', 6000);
    navigate('/games', { replace: true });
  }
}

/** Turn Firestore failures into something a player can act on. */
function roomError(err, fallback) {
  if (err?.code === 'permission-denied') {
    return 'Online play is blocked by the database rules. Publish firestore.rules (firebase deploy --only firestore:rules).';
  }
  if (err?.code === 'unavailable') return 'You seem to be offline. Check the connection and try again.';
  return err?.message || fallback;
}

function openRoom({ code, game, seat, state, level, room }) {
  teardown();

  session = {
    key: `room:${code}:${seat}`,
    game,
    mode: 'remote',
    level: level || 'even',
    seat,
    code,
    round: 0,
    seq: room?.seq || 0,
    names: [room?.host?.name || myName(), room?.guest?.name || ''],
    state,
    room: room || null,
    media: { cam: false, mic: false },
    peerMedia: { cam: false, mic: false },
    status: 'waiting',
    timers: []
  };

  // A reload must not delete the host's room or evict the returning guest.
  // Only an explicit leave/navigation releases the seat.
  history.replaceState(null, '', `#/games?room=${encodeURIComponent(code)}`);
  lastQuery = `${code}|`;
  session.unsub = rooms.watchRoom(code, onRoomChange, onRoomGone);
  repaint();
  tick(); // Resume forced moves/rematch UI when rejoining an unchanged board.
}

/* =========================================================
   Remote sync
   ========================================================= */
function onRoomChange(data) {
  const s = session;
  if (!s || s.mode !== 'remote') return;

  const wasSeated = Boolean(s.room?.guestUid);
  s.room = data;
  s.names = [data.host?.name || 'Host', data.guest?.name || ''];
  s.peerMedia = data.media?.[rooms.SEAT_KEYS[1 - s.seat]] || { cam: false, mic: false };

  const seatingChanged = wasSeated !== Boolean(data.guestUid);
  if ((data.seq || 0) !== s.seq || seatingChanged) {
    s.seq = data.seq || 0;
    s.round = data.round || 0;
    s.state = data.state;
    clearTimers();
    paintBoard();
    tick();
  }

  paintRail();
  paintStatus();
  syncDock();
  paintChat(data.chat || []);

  // Both seated: open the line. A new arrival (or a rejoin after a reload)
  // gets a brand-new connection from the host.
  const join = data.guestUid ? data.guestJoin || data.guestUid : '';
  if (join) {
    if (!s.call) startCall();
    else if (s.seat === 0 && join !== s.joinSeen) s.call.reconnect();
    s.joinSeen = join;
  } else if (s.call) {
    s.call.close();
    s.call = null;
    s.media = { cam: false, mic: false };
    s.peerMedia = { cam: false, mic: false };
    s.joinSeen = '';
    s.status = 'waiting';
    rooms.pushMedia(s.code, s.seat, s.media).catch(() => {});
    syncDock();
  }

  if (data.guestUid && !wasSeated && s.seat === 0) toast(`${data.guest?.name || 'Your friend'} joined.`, 'success');
  if (!data.guestUid && wasSeated && s.seat === 0) toast('Your friend stepped away.', 'info');

  // Rematch handshake — the host deals the new game.
  const rm = data.rematch || {};
  if (rm.a && rm.b && s.seat === 0 && !s.dealing) {
    const round = (data.round || 0) + 1;
    s.dealing = true;
    rooms
      .restart(s.code, freshState(s.game, round, s.state), (data.seq || 0) + 1, round)
      .catch(() => {})
      .finally(() => { if (session === s) s.dealing = false; });
  }
}

function onRoomGone(err) {
  if (!session || session.mode !== 'remote') return;
  toast(err ? roomError(err, 'Lost the connection to the game.') : 'The game was closed.', err ? 'error' : 'info', err ? 6000 : 3000);
  teardown({ leaveTable: false });
  lastQuery = '';
  navigate('/games', { replace: true });
  repaint();
}

/* =========================================================
   Game loop
   ========================================================= */
function bothSeated() {
  return session.mode === 'solo' || Boolean(session.room?.guestUid);
}

/** Social games played by passing one device around — whoever's turn it is holds it. */
function isLocal() {
  return session?.mode === 'solo' && Boolean(session.game.meta.local);
}

function context() {
  const s = session;
  const out = s.game.outcome(s.state);
  const local = isLocal();
  return {
    seat: local ? s.game.turn(s.state) : s.seat,
    myTurn: !s.saving && !out.over && bothSeated() && (local || s.game.turn(s.state) === s.seat),
    local,
    over: out.over,
    names: s.names,
    mode: s.mode,
    level: s.level,
    sessionKey: s.key,
    refresh: paintBoard
  };
}

function play(move) {
  const s = session;
  if (!s || s.game.outcome(s.state).over) return;
  if (!bothSeated() || (!isLocal() && s.game.turn(s.state) !== s.seat)) return;
  haptic();
  commit(move);
}

async function commit(move) {
  const s = session;
  if (!s || s.saving) return;
  const next = s.game.apply(s.state, move);
  if (!next) return;

  const out = s.game.outcome(next);
  if (s.mode === 'remote') {
    s.saving = true;
    clearTimers();
    paintBoard();
    try {
      // Let the room snapshot publish the authoritative state. A rejected
      // write must never leave an optimistic board stranded on one device.
      await rooms.pushState(s.code, { state: next, outcome: out.over ? out : null, seq: s.seq + 1 });
    } catch (err) {
      if (session === s) toast(roomError(err, 'That move did not reach your friend.'), 'error');
    } finally {
      s.saving = false;
      if (session === s) { paintBoard(); paintStatus(); tick(); }
    }
    return;
  }

  s.state = next;
  s.seq = (s.seq || 0) + 1;

  paintBoard();
  paintRail();
  paintStatus();

  tick();
}

/** Decide what happens next: a forced follow-up, the computer, or nothing. */
function tick() {
  const s = session;
  if (!s) return;
  clearTimers();

  const out = s.game.outcome(s.state);
  if (out.over) { finish(out); return; }
  if (!bothSeated() || s.saving) return;

  const seat = s.game.turn(s.state);

  // Moves the game makes on its own — e.g. turning unmatched cards back over.
  const forced = s.game.auto?.(s.state);
  if (forced) {
    const mine = s.mode === 'solo' || seat === s.seat;
    if (mine) s.timers.push(setTimeout(() => { if (session === s) commit(forced.move); }, forced.delay || 900));
    return;
  }

  if (s.mode === 'solo' && !isLocal() && seat !== s.seat) {
    s.timers.push(
      setTimeout(() => {
        if (!session || session !== s) return;
        const move = s.game.ai(s.state, seat, s.level);
        if (move) commit(move);
      }, 420 + Math.random() * 520 + (s.game.pace?.(s.state) || 0))
    );
  }
}

function finish(out) {
  const s = session;
  if (!s || s.finishedAt === s.seq) return;
  s.finishedAt = s.seq;

  paintBoard();
  paintStatus();
  paintRail();

  if (out.celebrate || (out.winner === s.seat && !isLocal()) || (isLocal() && out.winner != null)) {
    confetti(30);
    haptic();
  }
}

/** A new game with the saved settings, keeping the decks the players picked last time. */
function freshState(game, round, prev) {
  const opts = settingsFor(game);
  if (Array.isArray(prev?.cats)) opts.cats = prev.cats;
  const st = game.create(opts);
  if (game.meta.alternate !== false) st.turn = round % 2;
  return st;
}

function newRound() {
  const s = session;
  if (!s) return;
  if (s.mode === 'remote') {
    rooms.pushRematch(s.code, s.seat, true).catch(() => {});
    toast('Rematch offered.', 'info');
    return;
  }
  s.round += 1;
  s.state = freshState(s.game, s.round, s.state);
  s.seq = (s.seq || 0) + 1;
  s.finishedAt = null;
  paintBoard();
  paintRail();
  paintStatus();
  tick();
}

/* =========================================================
   Table
   ========================================================= */
function tableHtml() {
  const s = session;
  const m = s.game.meta;
  const remote = s.mode === 'remote';

  return `
    <div class="page arcade" data-arcade-root>
      <header class="arcade__head">
        <button class="iconbtn" type="button" data-exit aria-label="Leave the table">${icon('chevronLeft')}</button>
        <div class="arcade__ident">
          <span class="arcade__emoji">${m.emoji}</span>
          <div class="grow">
            <h1 class="arcade__title">${esc(m.title)}</h1>
            <p class="arcade__mode">${
              remote
                ? `${icon('users')} Playing online`
                : isLocal()
                ? `${icon('users')} On this device — pass it around`
                : `${icon('bot')} ${esc(s.names[1])}`
            }</p>
          </div>
        </div>
        <div class="arcade__tools">
          ${remote ? `<button class="btn btn--ghost btn--sm" type="button" data-share>${icon('link')} Invite</button>` : ''}
          ${m.settings?.length && (!remote || s.seat === 0) ? `<button class="iconbtn" type="button" data-table-settings aria-label="Game settings" title="Settings">${icon('settings')}</button>` : ''}
          <button class="iconbtn" type="button" data-rules aria-label="How to play">${icon('info')}</button>
        </div>
      </header>

      <div class="arcade__layout">
        <section class="arcade__stage">
          <div class="arcade-rail" data-rail>${railHtml()}</div>
          <div class="arcade-board arcade-board--${m.id}" data-board></div>
          <div class="arcade-status" data-status>${statusHtml()}</div>
        </section>

        <aside class="arcade__side">
          ${remote ? dockHtml() + chatHtml() : soloPanelHtml()}
          <section class="card arcade-rules">
            <h3 class="card__title">${icon('sparkles')} How it goes</h3>
            <ul class="arcade-rules__list">
              ${m.rules.map((r) => `<li>${esc(r)}</li>`).join('')}
            </ul>
          </section>
        </aside>
      </div>
    </div>`;
}

function railHtml() {
  const s = session;
  const out = s.game.outcome(s.state);
  const active = out.over ? -1 : s.game.turn(s.state);

  const seatCard = (seat) => {
    const name = isLocal()
      ? s.names[seat] || `Player ${seat + 1}`
      : seat === s.seat
      ? `${s.names[seat] || myName()} (you)`
      : s.names[seat] || 'Waiting…';
    const empty = s.mode === 'remote' && seat === 1 && !s.room?.guestUid;
    const won = out.over && out.winner === seat;
    return `
      <div class="pseat pseat--${seat}${active === seat ? ' is-turn' : ''}${empty ? ' is-empty' : ''}${won ? ' is-won' : ''}">
        <span class="pseat__ring"></span>
        <span class="pseat__badge">${empty ? '…' : esc(initials(name))}</span>
        <div class="pseat__meta">
          <span class="pseat__name truncate">${esc(name)}</span>
          <span class="pseat__note">${seatNote(seat, empty, active)}</span>
        </div>
      </div>`;
  };

  return `${seatCard(0)}<span class="pseat__vs">vs</span>${seatCard(1)}`;
}

function seatNote(seat, empty, active) {
  const s = session;
  if (empty) return 'Empty seat';
  const extra = s.game.note?.(s.state, seat);
  if (extra) return esc(extra);
  if (isLocal()) return active === seat ? 'Your turn' : 'Waiting';
  if (s.mode === 'solo' && seat === 1) return 'Computer';
  if (active === seat) return seat === s.seat ? 'Your move' : 'Thinking…';
  return 'Waiting';
}

function statusHtml() {
  const s = session;
  const out = s.game.outcome(s.state);
  const coach = s.game.coach?.(s.state, context()) || '';

  let line;
  let tone = '';
  if (s.mode === 'remote' && !bothSeated()) {
    line = 'Waiting for your friend to arrive…';
    tone = ' is-waiting';
  } else if (out.over) {
    tone = ' is-over';
    const custom = s.game.summary?.(s.state, context());
    line = custom
      ? esc(custom)
      : out.draw
      ? 'A draw — evenly matched.'
      : isLocal()
      ? `${esc(s.names[out.winner] || 'Someone')} wins. Nicely done.`
      : out.winner === s.seat
      ? 'You win. Nicely done.'
      : `${esc(s.names[out.winner] || 'Your rival')} takes it.`;
  } else if (isLocal()) {
    line = `${esc(s.names[s.game.turn(s.state)] || 'Next player')}, your turn.`;
  } else if (s.game.turn(s.state) === s.seat) {
    line = 'Your move.';
  } else {
    line = s.mode === 'solo' ? 'Thinking…' : `${esc(s.names[1 - s.seat] || 'Your friend')} is thinking…`;
  }

  return `
    <p class="arcade-status__line${tone}">${line}</p>
    ${coach ? `<p class="arcade-status__coach">${esc(coach)}</p>` : ''}
    <div class="arcade-status__actions">
      ${
        out.over
          ? `<button class="btn btn--primary" type="button" data-again>${icon('refresh')} ${
              s.mode === 'remote' ? 'Offer a rematch' : 'Play again'
            }</button>`
          : ''
      }
      <button class="btn btn--ghost btn--sm" type="button" data-exit>Leave the table</button>
    </div>`;
}

function soloPanelHtml() {
  const s = session;
  if (isLocal()) {
    return `
    <section class="card arcade-solo">
      <h3 class="card__title">${icon('users')} Who's with you?</h3>
      <label class="arcade-solo__name">
        <span class="fs-xs t-mute">Player 2</span>
        <input class="input" data-p2name maxlength="24" value="${esc(s.names[1])}" placeholder="Their name" autocomplete="off" />
      </label>
      <p class="fs-sm t-dim">One phone, two players — hand it over when the screen says so.</p>
      <button class="btn btn--soft btn--block" type="button" data-invite-here>${icon('link')} Play online instead</button>
    </section>`;
  }
  if (!s.game.meta.levels.length) {
    return `
    <section class="card arcade-solo">
      <h3 class="card__title">${icon('bot')} Your opponent</h3>
      <p class="fs-sm t-dim">The house plays fair — the dice decide the rest.</p>
      <button class="btn btn--soft btn--block" type="button" data-invite-here>${icon('users')} Play a friend instead</button>
    </section>`;
  }
  return `
    <section class="card arcade-solo">
      <h3 class="card__title">${icon('bot')} Your opponent</h3>
      <div class="segmented segmented--tiny" role="tablist" aria-label="Difficulty">
        ${s.game.meta.levels
          .map(
            (l) =>
              `<button role="tab" type="button" aria-selected="${l.id === s.level}"
                       data-setlevel="${l.id}">${esc(l.label)}</button>`
          )
          .join('')}
      </div>
      <p class="fs-sm t-dim" data-levelhint>${esc(s.game.meta.levels.find((l) => l.id === s.level)?.hint || '')}</p>
      <button class="btn btn--soft btn--block" type="button" data-invite-here>${icon('users')} Play a friend instead</button>
    </section>`;
}

function dockHtml() {
  const s = session;
  const supported = canCall();
  return `
    <section class="card vdock" data-dock>
      <header class="vdock__head">
        <h3 class="card__title">${icon('camera')} Voice &amp; video</h3>
        <span class="vdock__state" data-callstate>${supported ? 'Connecting…' : 'Not available here'}</span>
      </header>

      <div class="vdock__tiles">
        <div class="vdock__tile vdock__tile--remote" data-tile-remote>
          <video data-vid-remote autoplay playsinline muted></video>
          <audio data-audio-remote autoplay></audio>
          <div class="vdock__off">
            <span class="vdock__avatar">${esc(initials(s.names[1 - s.seat] || 'Friend'))}</span>
            <span class="vdock__hint">Camera off</span>
          </div>
          <span class="vdock__name">${esc(s.names[1 - s.seat] || 'Your friend')}<span class="vdock__muted" data-peer-muted>${icon('micOff')}</span></span>
        </div>
        <div class="vdock__tile vdock__tile--local" data-tile-local>
          <video data-vid-local autoplay playsinline muted></video>
          <div class="vdock__off">
            <span class="vdock__avatar">${esc(initials(myName()))}</span>
            <span class="vdock__hint">Camera off</span>
          </div>
          <span class="vdock__name">You</span>
        </div>
      </div>

      <div class="vdock__bar">
        <button class="vbtn" type="button" data-cam ${supported ? '' : 'disabled'} aria-pressed="false">
          <span class="vbtn__on">${icon('camera')}</span><span class="vbtn__off">${icon('cameraOff')}</span>
          <span class="vbtn__label">Camera</span>
        </button>
        <button class="vbtn" type="button" data-mic ${supported ? '' : 'disabled'} aria-pressed="false">
          <span class="vbtn__on">${icon('mic')}</span><span class="vbtn__off">${icon('micOff')}</span>
          <span class="vbtn__label">Mic</span>
        </button>
        <button class="vbtn" type="button" data-recall ${supported ? '' : 'disabled'} title="Reconnect voice &amp; video">
          <span class="vbtn__on">${icon('refresh')}</span><span class="vbtn__off">${icon('refresh')}</span>
          <span class="vbtn__label">Reconnect</span>
        </button>
      </div>
      <button class="btn btn--primary btn--block vdock__sound" type="button" data-sound hidden>${icon('mic')} Tap to hear your friend</button>
      <p class="vdock__note fs-xs t-mute" data-callnote>Mic alone is a voice call; add the camera for video. Switch either whenever you like — the game keeps running.</p>
    </section>`;
}

/* =========================================================
   Table talk — text chat and quick reactions
   ========================================================= */
const REACTS = ['👏', '😂', '😮', '🔥', '❤️', '🤝'];
const PHRASES = ['Good luck!', 'Nice move 👌', 'Hmm… 🤔', 'Good game!', 'Rematch?'];

function chatHtml() {
  return `
    <section class="card achat" data-chat>
      <header class="achat__head">
        <h3 class="card__title">${icon('chat')} Table talk</h3>
        <span class="achat__count fs-xs t-mute" data-chat-count></span>
      </header>
      <ol class="achat__list" data-chat-list aria-live="polite" aria-label="Messages">
        <li class="achat__empty">Say hello — messages stay at this table.</li>
      </ol>
      <div class="achat__quick" role="group" aria-label="Quick reactions">
        ${REACTS.map((e) => `<button class="achat__react" type="button" data-react="${e}" aria-label="Send ${e}">${e}</button>`).join('')}
      </div>
      <div class="achat__phrases">
        ${PHRASES.map((p) => `<button class="chip achat__phrase" type="button" data-phrase="${esc(p)}">${esc(p)}</button>`).join('')}
      </div>
      <form class="achat__form" data-chat-form autocomplete="off">
        <input class="input" name="msg" maxlength="${rooms.CHAT_MAX}" placeholder="Write a message…" aria-label="Message" />
        <button class="btn btn--primary btn--icon" type="submit" aria-label="Send">${icon('send')}</button>
      </form>
    </section>`;
}

function clock(ms) {
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Repaint the conversation and celebrate anything new from the other side. */
function paintChat(chat) {
  const s = session;
  const list = q('[data-chat-list]');
  if (!s || !list || !Array.isArray(chat)) return;

  const lastId = chat.length ? chat[chat.length - 1].id : '';
  if (lastId === s.chatLast) return;

  const firstPaint = s.chatLast === undefined;
  const seenAt = chat.findIndex((m) => m.id === s.chatLast);
  const fresh = firstPaint ? [] : chat.slice(seenAt + 1);
  s.chatLast = lastId;

  const msgs = chat.filter((m) => m.kind !== 'react');
  list.innerHTML = msgs.length
    ? msgs
        .map((m) => {
          const mine = m.seat === s.seat;
          return `
            <li class="achat__msg${mine ? ' is-mine' : ''} achat__msg--${m.seat === 1 ? 1 : 0}">
              ${mine ? '' : `<span class="achat__who">${esc(m.name || 'Friend')}</span>`}
              <p class="achat__text">${esc(m.text)}</p>
              <time class="achat__time">${clock(m.at)}</time>
            </li>`;
        })
        .join('')
    : '<li class="achat__empty">Say hello — messages stay at this table.</li>';
  list.scrollTop = list.scrollHeight;

  const count = q('[data-chat-count]');
  if (count) count.textContent = msgs.length ? `${msgs.length}` : '';

  for (const m of fresh) {
    if (m.seat === s.seat) continue;
    if (m.kind === 'react') floatReact(m.text);
    else bubble(m.name, m.text);
  }
}

function floatReact(emoji) {
  const stage = q('.arcade__stage');
  if (!stage) return;
  const el = document.createElement('span');
  el.className = 'areact';
  el.textContent = String(emoji).slice(0, 4);
  el.style.setProperty('--x', `${18 + Math.random() * 64}%`);
  el.style.setProperty('--tilt', `${Math.round(Math.random() * 40 - 20)}deg`);
  stage.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

function bubble(name, text) {
  const stage = q('.arcade__stage');
  if (!stage) return;
  stage.querySelector('.abubble')?.remove();
  const el = document.createElement('div');
  el.className = 'abubble';
  el.setAttribute('role', 'status');
  el.innerHTML = `<b>${esc(name || 'Friend')}</b><span>${esc(text)}</span>`;
  stage.appendChild(el);
  setTimeout(() => el.classList.add('is-leaving'), 4200);
  setTimeout(() => el.remove(), 4700);
}

function say(text, kind = 'msg') {
  const s = session;
  if (!s || s.mode !== 'remote') return false;
  const now = Date.now();
  if (now - (s.lastSaid || 0) < 450) return false; // gentle flood guard
  s.lastSaid = now;
  if (kind === 'react') floatReact(text);
  haptic();
  rooms.sendChat(s.code, s.seat, text, kind).catch((err) => {
    console.warn('[arcade] chat', err);
    toast('Message not sent.', 'error');
  });
  return true;
}

/* =========================================================
   Table wiring
   ========================================================= */
function wireTable() {
  paintBoard();

  // Bound to the table itself — #view outlives every render, this element does not.
  const table = q('[data-arcade-root]');
  table?.addEventListener('click', (e) => {
    const t = e.target;
    // Any tap counts as permission to play the friend's audio, if the browser held it back.
    if (session?.mode === 'remote' && session.soundBlocked) playRemote();
    if (t.closest('[data-exit]')) { leave(); return; }
    if (t.closest('[data-again]')) { newRound(); return; }
    if (t.closest('[data-rules]')) { showRules(); return; }
    if (t.closest('[data-table-settings]')) { showSettings(session.game, true); return; }
    if (t.closest('[data-share]')) { showInvite(session.code, false); return; }
    if (t.closest('[data-invite-here]')) { host(session.game.meta.id); return; }

    const lvl = t.closest('[data-setlevel]');
    if (lvl && session) {
      session.level = lvl.dataset.setlevel;
      levels[session.game.meta.id] = session.level;
      session.names[1] = computerName(session.game, session.level);
      rootEl.querySelectorAll('[data-setlevel]').forEach((b) => b.setAttribute('aria-selected', String(b === lvl)));
      const hint = q('[data-levelhint]');
      if (hint) hint.textContent = session.game.meta.levels.find((l) => l.id === session.level)?.hint || '';
      paintRail();
      return;
    }

    if (t.closest('[data-cam]')) { toggleDevice('cam'); return; }
    if (t.closest('[data-mic]')) { toggleDevice('mic'); return; }
    if (t.closest('[data-recall]')) { recall(); return; }
    if (t.closest('[data-sound]')) { playRemote(); return; }

    const react = t.closest('[data-react]');
    if (react) { say(react.dataset.react, 'react'); return; }
    const phrase = t.closest('[data-phrase]');
    if (phrase) say(phrase.dataset.phrase);
  });

  const chatForm = q('[data-chat-form]');
  table?.addEventListener('input', (e) => {
    if (!e.target.matches('[data-p2name]') || !session) return;
    partnerName = e.target.value.trim().slice(0, 24) || 'Player 2';
    session.names[1] = partnerName;
    paintRail();
    paintStatus();
    paintBoard();
  });
  chatForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = chatForm.msg.value.trim();
    if (!text) return;
    if (say(text)) chatForm.msg.value = '';
  });

  if (session.mode === 'remote') {
    syncDock();
    session.chatLast = undefined;
    paintChat(session.room?.chat || []);
    if (session.room?.guestUid) startCall();
  }
}

function paintBoard() {
  const slot = q('[data-board]');
  if (!slot || !session) return;
  const ctx = context();
  slot.innerHTML = session.game.view(session.state, ctx);
  session.game.bind(slot, session.state, ctx, play);
}

function paintRail() {
  const rail = q('[data-rail]');
  if (rail && session) rail.innerHTML = railHtml();
}

function paintStatus() {
  const status = q('[data-status]');
  if (status && session) status.innerHTML = statusHtml();
}

function leave() {
  teardown();
  lastQuery = '';
  navigate('/games', { replace: true });
  repaint();
}

/* =========================================================
   Invite
   ========================================================= */
function showInvite(code, fresh) {
  // Opened from disk, a link only works on this computer — share the code instead.
  const local = location.protocol === 'file:';
  const link = local ? code : rooms.inviteLink(code);
  modal({
    title: fresh ? 'Your table is ready' : 'Invite a friend',
    body: `
      <p class="fs-sm t-dim">${
        local
          ? 'Send this code. Your friend enters it under <b>Games → Got a code?</b> and sits opposite you.'
          : 'Send this link. Whoever opens it first sits opposite you.'
      }</p>
      <div class="invite">
        <code class="invite__code">${esc(code)}</code>
        ${local ? '' : `<input class="input invite__link" value="${esc(link)}" readonly aria-label="Invite link" />`}
        <div class="invite__actions">
          <button class="btn btn--primary" type="button" data-copy>${icon('link')} Copy ${local ? 'code' : 'link'}</button>
          ${navigator.share ? `<button class="btn btn--ghost" type="button" data-send>Share…</button>` : ''}
        </div>
      </div>`,
    onMount(box, close) {
      box.querySelector('[data-copy]')?.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(link);
          toast(local ? 'Code copied.' : 'Link copied.', 'success');
        } catch {
          box.querySelector('.invite__link')?.select();
          toast(local ? 'Copy the code shown above.' : 'Press copy on the selected link.', 'info');
        }
      });
      box.querySelector('[data-send]')?.addEventListener('click', () => {
        const msg = local ? { title: 'A game on LifeFlow', text: `Fancy a game? Join with code ${code}` } : { title: 'A game on LifeFlow', text: 'Fancy a game?', url: link };
        navigator.share(msg).catch(() => {});
        close();
      });
    }
  });
}

function showRules() {
  const m = session.game.meta;
  modal({
    title: `${m.emoji} ${m.title}`,
    body: `
      <p class="fs-sm t-dim">${esc(m.blurb)}</p>
      <ul class="arcade-rules__list">${m.rules.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>`
  });
}

/** Pick the game's options. At the table the host (or a solo player) can restart with them. */
function showSettings(game, atTable) {
  const m = game.meta;
  const draft = settingsFor(game);
  const s = session;
  const canRestart = atTable && s && s.game === game && (s.mode === 'solo' || s.seat === 0);

  modal({
    title: `${m.emoji} ${m.title} — settings`,
    body: `
      <div class="gset">
        ${m.settings
          .map(
            (opt) => `
          <fieldset class="gset__group">
            <legend class="gset__label">${esc(opt.label)}</legend>
            <div class="gset__opts" role="radiogroup" aria-label="${esc(opt.label)}">
              ${opt.options
                .map(
                  (o, k) =>
                    `<button class="gset__opt" type="button" role="radio" data-set="${esc(opt.id)}" data-k="${k}" aria-checked="${o.v === draft[opt.id]}">${esc(o.label)}</button>`
                )
                .join('')}
            </div>
          </fieldset>`
          )
          .join('')}
      </div>
      <p class="fs-sm t-dim">${
        atTable
          ? canRestart
            ? (s.mode === 'remote' ? 'Both players share these rules. Restart to use them now, or save them for the next game.' : 'Restart to use them now, or save them for the next game.')
            : 'They apply from the next game.'
          : 'Saved on this device and used every time you start this game.'
      }</p>`,
    footer: `
      <button class="btn btn--ghost" type="button" data-save>Save</button>
      ${canRestart ? `<button class="btn btn--primary" type="button" data-restart>${icon('refresh')} Apply & restart</button>` : ''}`,
    onMount(box, close) {
      box.querySelectorAll('[data-set]').forEach((b) =>
        b.addEventListener('click', () => {
          const opt = m.settings.find((x) => x.id === b.dataset.set);
          const o = opt?.options[Number(b.dataset.k)];
          if (!o) return;
          draft[opt.id] = o.v;
          b.parentElement.querySelectorAll('[data-set]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
          haptic();
        })
      );
      box.querySelector('[data-save]')?.addEventListener('click', () => {
        saveSettings(m.id, { ...draft });
        close();
        toast(atTable ? 'Saved — used from the next game.' : 'Settings saved.', 'success');
      });
      box.querySelector('[data-restart]')?.addEventListener('click', () => {
        saveSettings(m.id, { ...draft });
        close();
        restartWithSettings();
      });
    }
  });
}

function restartWithSettings() {
  const s = session;
  if (!s) return;
  if (s.mode === 'remote') {
    if (s.seat !== 0) return;
    const round = s.room?.round || 0;
    rooms
      .restart(s.code, freshState(s.game, round, s.state), (s.seq || 0) + 1, round)
      .then(() => toast('New game with the new rules.', 'success'))
      .catch((err) => toast(roomError(err, 'Could not restart the game.'), 'error', 6000));
    return;
  }
  clearTimers();
  s.state = freshState(s.game, s.round, s.state);
  s.seq = (s.seq || 0) + 1;
  s.finishedAt = null;
  paintBoard();
  paintRail();
  paintStatus();
  tick();
  toast('New game with the new rules.', 'success');
}

/* =========================================================
   Camera & microphone
   ========================================================= */
function startCall() {
  const s = session;
  if (!s || s.call || s.mode !== 'remote' || !canCall()) return;
  s.joinSeen = s.room?.guestJoin || s.room?.guestUid || '';

  s.call = createCall({
    code: s.code,
    seat: s.seat,
    onRemote: (stream) => {
      if (session !== s) return;
      const v = q('[data-vid-remote]');
      if (!v) return;
      // Re-attach when the set of tracks changes, so Safari picks up new lanes too.
      const sig = stream.getTracks().map((t) => t.id).join(',');
      if (v.dataset.sig !== sig) {
        v.dataset.sig = sig;
        v.srcObject = null;
        v.srcObject = new MediaStream(stream.getVideoTracks());
        v.muted = true;
        v.play?.().catch(() => {});
        const audio = q('[data-audio-remote]');
        if (audio) audio.srcObject = new MediaStream(stream.getAudioTracks());
      }
      if (sig) playRemote();
      syncDock();
    },
    onLocal: (stream) => {
      if (session !== s) return;
      const v = q('[data-vid-local]');
      if (v) {
        v.srcObject = stream;
        v.play?.().catch(() => {});
      }
      syncDock();
    },
    onStatus: (state) => {
      if (session !== s) return;
      s.status = state;
      syncDock();
    },
    onError: (err) => { if (session === s) toast(roomError(err, 'The video link could not be opened.'), 'error'); }
  });

  s.call.start();
}

/** Start the friend's audio/video; browsers may insist on a tap first. */
function playRemote() {
  const s = session;
  const v = q('[data-audio-remote]');
  if (!s || !v?.srcObject) return;
  v.muted = false;
  const p = v.play?.();
  if (!p?.then) return;
  p.then(() => {
    if (session !== s) return;
    s.soundBlocked = false;
    const btn = q('[data-sound]');
    if (btn) btn.hidden = true;
  }).catch((err) => {
    if (session !== s || err?.name !== 'NotAllowedError') return;
    s.soundBlocked = true;
    const btn = q('[data-sound]');
    if (btn) btn.hidden = false;
  });
}

function recall() {
  const s = session;
  if (!s?.call) { toast('Waiting for your friend to arrive.', 'info'); return; }
  s.call.reconnect();
  s.status = 'connecting';
  syncDock();
  toast('Reconnecting voice & video…', 'info');
}

async function toggleDevice(kind) {
  const s = session;
  if (!s?.call) { toast('Waiting for your friend to arrive.', 'info'); return; }

  s.deviceBusy ||= {};
  if (s.deviceBusy[kind]) return;
  s.deviceBusy[kind] = true;
  const on = !s.media[kind];
  try {
    if (kind === 'cam') await s.call.setCam(on);
    else await s.call.setMic(on);
  } catch (err) {
    console.warn('[arcade] device', err);
    toast(
      err?.name === 'NotAllowedError'
        ? 'Permission was declined by your browser.'
        : `Your ${kind === 'cam' ? 'camera' : 'microphone'} is not available.`,
      'error'
    );
    return;
  } finally {
    s.deviceBusy[kind] = false;
  }

  if (session !== s || !s.call) return;
  s.media[kind] = on;
  haptic();
  syncDock();
  rooms.pushMedia(s.code, s.seat, s.media).catch((err) => {
    if (session === s) toast(roomError(err, 'Could not share your device status.'), 'error');
  });
}

const STATE_LABEL = {
  connecting: 'Connecting…',
  connected: 'Connected',
  disconnected: 'Reconnecting…',
  failed: 'Connection lost',
  closed: 'Call ended'
};

function syncDock() {
  const s = session;
  const dock = q('[data-dock]');
  if (!s || !dock) return;

  const label = dock.querySelector('[data-callstate]');
  const note = dock.querySelector('[data-callnote]');
  if (note) note.textContent = !canCall()
    ? 'Open the app over HTTPS (or localhost) and allow camera/microphone access in your browser.'
    : s.status === 'failed'
    ? 'Call connection failed. Try Reconnect. Mobile and restricted networks may require a configured TURN relay; the game and chat still work.'
    : 'Mic alone is a voice call; add the camera for video. Allow device access when your browser asks.';
  if (label) {
    label.textContent = !canCall()
      ? 'Not available here'
      : !s.room?.guestUid
      ? 'Waiting for your friend'
      : STATE_LABEL[s.status] || 'Connecting…';
  }

  const localTile = dock.querySelector('[data-tile-local]');
  const remoteTile = dock.querySelector('[data-tile-remote]');
  localTile?.classList.toggle('is-live', Boolean(s.media.cam));
  remoteTile?.classList.toggle('is-live', Boolean(s.peerMedia?.cam));

  const peerName = remoteTile?.querySelector('.vdock__name');
  if (peerName) {
    peerName.childNodes[0].nodeValue = s.names[1 - s.seat] || 'Your friend';
  }
  remoteTile?.querySelector('[data-peer-muted]')?.classList.toggle('is-on', !s.peerMedia?.mic);

  const cam = dock.querySelector('[data-cam]');
  const mic = dock.querySelector('[data-mic]');
  cam?.classList.toggle('is-on', Boolean(s.media.cam));
  cam?.setAttribute('aria-pressed', String(Boolean(s.media.cam)));
  mic?.classList.toggle('is-on', Boolean(s.media.mic));
  mic?.setAttribute('aria-pressed', String(Boolean(s.media.mic)));
}
