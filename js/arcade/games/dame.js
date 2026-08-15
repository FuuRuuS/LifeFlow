/**
 * LifeFlow Arcade — Dame (draughts / checkers, 8×8).
 *
 * Board encoding, flat so it survives a trip through Firestore:
 *   0 empty · 1 light man · 2 light king · 3 dark man · 4 dark king
 * Seat 0 plays the light pieces from the bottom, seat 1 the dark from the top.
 */

const DIRS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

const rc = (i) => [i >> 3, i & 7];
const idx = (r, c) => r * 8 + c;
const inside = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
const dark = (r, c) => (r + c) % 2 === 1;
const seatOf = (v) => (v === 0 ? -1 : v <= 2 ? 0 : 1);
const isKing = (v) => v === 2 || v === 4;
const forward = (seat) => (seat === 0 ? -1 : 1);

export const meta = {
  id: 'dame',
  title: 'Dame',
  emoji: '⚪',
  tagline: 'Draughts, with room to think.',
  blurb: 'Diagonal steps, forced captures and long jump chains. Reach the far side and your piece is crowned.',
  minutes: '10 min',
  tags: ['Strategy', 'Deep'],
  alternate: false,
  levels: [
    { id: 'gentle', label: 'Gentle', hint: 'Looks one move ahead.' },
    { id: 'even', label: 'Even', hint: 'Thinks a few moves ahead.' },
    { id: 'sharp', label: 'Sharp', hint: 'Plans, and punishes.' }
  ],
  rules: [
    'Men step forward diagonally onto dark squares.',
    'Captures are compulsory — and chain while jumps remain.',
    'Reach the far row to be crowned; kings move both ways.',
    'No pieces or no moves left means the game is lost.'
  ]
};

export function create() {
  const board = Array(64).fill(0);
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (!dark(r, c)) continue;
      if (r < 3) board[idx(r, c)] = 3;
      else if (r > 4) board[idx(r, c)] = 1;
    }
  }
  return { board, turn: 0, chain: null, last: null, moves: 0, still: 0 };
}

export function turn(state) {
  return state.turn;
}

/** Every legal move for the side to play — captures only, when one exists. */
export function moves(state) {
  const { board, turn: seat } = state;
  const chain = state.chain ?? null;
  const caps = [];
  const quiet = [];

  const from = [];
  if (chain !== null) from.push(chain);
  else for (let i = 0; i < 64; i++) if (seatOf(board[i]) === seat) from.push(i);

  for (const f of from) {
    const v = board[f];
    if (seatOf(v) !== seat) continue;
    const [r, c] = rc(f);
    const dirs = isKing(v) ? DIRS : DIRS.filter((d) => d[0] === forward(seat));

    for (const [dr, dc] of dirs) {
      const mr = r + dr;
      const mc = c + dc;
      if (!inside(mr, mc)) continue;
      const mid = board[idx(mr, mc)];
      const tr = r + dr * 2;
      const tc = c + dc * 2;

      if (mid !== 0 && seatOf(mid) !== seat && inside(tr, tc) && board[idx(tr, tc)] === 0) {
        caps.push({ from: f, to: idx(tr, tc), cap: idx(mr, mc) });
      } else if (mid === 0 && chain === null) {
        quiet.push({ from: f, to: idx(mr, mc), cap: -1 });
      }
    }
  }

  if (caps.length) return caps;
  return chain !== null ? [] : quiet;
}

export function apply(state, move) {
  const m = moves(state).find((x) => x.from === move?.from && x.to === move?.to);
  if (!m) return null;

  const board = state.board.slice();
  const piece = board[m.from];
  board[m.from] = 0;
  board[m.to] = piece;
  if (m.cap >= 0) board[m.cap] = 0;

  let crowned = false;
  const [tr] = rc(m.to);
  if (piece === 1 && tr === 0) { board[m.to] = 2; crowned = true; }
  if (piece === 3 && tr === 7) { board[m.to] = 4; crowned = true; }

  const settled = {
    ...state,
    board,
    last: { from: m.from, to: m.to, cap: m.cap, crowned },
    moves: state.moves + 1,
    still: m.cap >= 0 || crowned ? 0 : (state.still || 0) + 1
  };

  const chains =
    m.cap >= 0 && !crowned && moves({ ...settled, chain: m.to, turn: state.turn }).some((x) => x.cap >= 0);

  settled.chain = chains ? m.to : null;
  settled.turn = chains ? state.turn : 1 - state.turn;
  return settled;
}

export function outcome(state) {
  let light = 0;
  let darkCount = 0;
  for (const v of state.board) {
    if (seatOf(v) === 0) light++;
    else if (seatOf(v) === 1) darkCount++;
  }
  if (!light) return { over: true, winner: 1, draw: false };
  if (!darkCount) return { over: true, winner: 0, draw: false };
  if ((state.still || 0) >= 60) return { over: true, winner: null, draw: true };
  if (!moves(state).length) return { over: true, winner: 1 - state.turn, draw: false };
  return { over: false, winner: null, draw: false };
}

export function auto() {
  return null;
}

/* ------------------------------ opponent ------------------------------ */
const DEPTH = { gentle: 1, even: 4, sharp: 6 };
const BUDGET = 90000;
let visited = 0;

export function ai(state, seat, level = 'even') {
  const list = moves(state);
  if (!list.length) return null;
  if (list.length === 1) return list[0];

  if (level === 'gentle' && Math.random() < 0.35) {
    return list[Math.floor(Math.random() * list.length)];
  }

  visited = 0;
  let best = list[0];
  let bestScore = -Infinity;
  const depth = DEPTH[level] ?? 4;

  for (const m of list) {
    const next = apply(state, m);
    if (!next) continue;
    const score = search(next, depth - 1, -Infinity, Infinity, seat) + Math.random() * 0.8;
    if (score > bestScore) { bestScore = score; best = m; }
  }
  return best;
}

function search(state, depth, alpha, beta, me) {
  const out = outcome(state);
  if (out.over) {
    if (out.draw) return 0;
    return out.winner === me ? 100000 + depth : -100000 - depth;
  }
  if (depth <= 0 || ++visited > BUDGET) return evaluate(state, me);

  const list = moves(state);
  const maximizing = state.turn === me;
  let best = maximizing ? -Infinity : Infinity;

  for (const m of list) {
    const next = apply(state, m);
    if (!next) continue;
    const score = search(next, depth - 1, alpha, beta, me);
    if (maximizing) {
      if (score > best) best = score;
      if (best > alpha) alpha = best;
    } else {
      if (score < best) best = score;
      if (best < beta) beta = best;
    }
    if (beta <= alpha) break;
  }
  return best;
}

function evaluate(state, me) {
  let score = 0;
  for (let i = 0; i < 64; i++) {
    const v = state.board[i];
    if (!v) continue;
    const seat = seatOf(v);
    const [r, c] = rc(i);
    let val = isKing(v) ? 190 : 100;
    if (!isKing(v)) val += (seat === 0 ? 7 - r : r) * 7;
    val += (3.5 - Math.abs(3.5 - c)) * 2;
    if (c === 0 || c === 7) val += 5;
    score += seat === me ? val : -val;
  }
  return score;
}

/* ------------------------------ view ------------------------------ */
let sel = null;
let selKey = '';

function syncSelection(state, ctx) {
  const key = `${ctx.sessionKey || ''}:${state.moves}`;
  if (key === selKey) return;
  selKey = key;
  // A jump chain locks onto one piece — pre-select it so the eye follows along.
  sel = state.chain !== null && state.chain !== undefined && ctx.myTurn ? state.chain : null;
}

export function view(state, ctx) {
  syncSelection(state, ctx);

  const out = outcome(state);
  const list = !out.over && ctx.myTurn ? moves(state) : [];
  const movable = new Set(list.map((m) => m.from));
  const targets = new Map(list.filter((m) => m.from === sel).map((m) => [m.to, m]));
  const flip = ctx.seat === 1;

  const order = [...Array(64).keys()];
  if (flip) order.reverse();

  const squares = order
    .map((i) => {
      const [r, c] = rc(i);
      const v = state.board[i];
      const seat = seatOf(v);
      const isDark = dark(r, c);
      const isTarget = targets.has(i);
      const moved = state.last && state.last.to === i;
      const captured = state.last && state.last.cap === i;

      let slide = '';
      if (moved && state.last.from !== undefined) {
        const [fr, fc] = rc(state.last.from);
        const dx = (fc - c) * (flip ? -1 : 1);
        const dy = (fr - r) * (flip ? -1 : 1);
        slide = `--dx:${dx};--dy:${dy};`;
      }

      return `
      <div class="dame__sq${isDark ? ' is-dark' : ''}${sel === i ? ' is-sel' : ''}${isTarget ? ' is-target' : ''}"
           data-sq="${i}" style="--d:${(r + c) * 18}ms">
        ${
          v
            ? `<span class="dame__piece dame__piece--${seat}${isKing(v) ? ' is-king' : ''}${moved ? ' is-moved' : ''}${
                movable.has(i) && !sel ? ' is-ready' : ''
              }" style="${slide}">
                 <span class="dame__gloss"></span>
                 ${isKing(v) ? '<span class="dame__crown">✦</span>' : ''}
               </span>`
            : ''
        }
        ${isTarget ? '<span class="dame__dot"></span>' : ''}
        ${captured ? '<span class="dame__poof"></span>' : ''}
      </div>`;
    })
    .join('');

  return `
    <div class="dame${out.over ? ' is-over' : ''}">
      <div class="dame__board" role="grid" aria-label="Dame board">${squares}</div>
    </div>`;
}

export function bind(root, state, ctx, play) {
  const list = !outcome(state).over && ctx.myTurn ? moves(state) : [];

  root.querySelectorAll('[data-sq]').forEach((sq) =>
    sq.addEventListener('click', () => {
      const i = Number(sq.dataset.sq);

      if (sel !== null) {
        const move = list.find((m) => m.from === sel && m.to === i);
        if (move) { sel = null; play({ from: move.from, to: move.to }); return; }
      }

      const mine = list.some((m) => m.from === i);
      sel = mine && sel !== i ? i : null;
      ctx.refresh?.();
    })
  );
}

export function coach(state, ctx) {
  if (!ctx.myTurn) return '';
  if (state.chain !== null && state.chain !== undefined) return 'The jump continues — keep going.';
  const list = moves(state);
  if (list.length && list[0].cap >= 0) return 'A capture is on the board, so a capture it is.';
  if (state.moves === 0) return 'Open towards the middle. Keep your back row a while.';
  return '';
}
