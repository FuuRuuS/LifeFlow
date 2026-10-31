/**
 * LifeFlow Arcade — Reversi (Othello).
 * 8 × 8 board stored flat. Seat 0 plays the dark discs and moves first.
 * A player with no legal move passes automatically.
 */

const N = 8;
const DIRS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];

/** Classic positional weights: corners gold, squares next to them poison. */
const WEIGHTS = [
  120, -20, 20, 5, 5, 20, -20, 120,
  -20, -40, -5, -5, -5, -5, -40, -20,
  20, -5, 15, 3, 3, 15, -5, 20,
  5, -5, 3, 3, 3, 3, -5, 5,
  5, -5, 3, 3, 3, 3, -5, 5,
  20, -5, 15, 3, 3, 15, -5, 20,
  -20, -40, -5, -5, -5, -5, -40, -20,
  120, -20, 20, 5, 5, 20, -20, 120
];

export const meta = {
  id: 'reversi',
  group: ['board', 'brain'],
  title: 'Reversi',
  emoji: '⚫',
  tagline: 'Outflank, flip, take the corners.',
  blurb: 'A minute to learn, a lifetime to master. The board can turn on a single move — corners never do.',
  minutes: '8 min',
  tags: ['Strategy', 'Classic'],
  alternate: true,
  levels: [
    { id: 'gentle', label: 'Gentle', hint: 'Loves flipping lots of discs.' },
    { id: 'even', label: 'Even', hint: 'Knows corners matter.' },
    { id: 'sharp', label: 'Sharp', hint: 'Plays for mobility and edges.' }
  ],
  rules: [
    'Place a disc so it traps a straight line of your rival’s discs between it and one of yours.',
    'Every trapped disc flips to your colour — in all directions at once.',
    'No legal move? Your turn passes automatically.',
    'When neither player can move, the most discs wins.'
  ]
};

export function create() {
  const board = Array(N * N).fill(0);
  board[27] = 2; board[36] = 2;
  board[28] = 1; board[35] = 1;
  return { board, turn: 0, last: -1, flipped: [], moves: 0, passed: false };
}

export function turn(state) {
  return state.turn;
}

function flipsFor(board, i, piece) {
  if (board[i] !== 0) return [];
  const other = piece === 1 ? 2 : 1;
  const r0 = Math.floor(i / N);
  const c0 = i % N;
  const all = [];
  for (const [dr, dc] of DIRS) {
    const run = [];
    let r = r0 + dr;
    let c = c0 + dc;
    while (r >= 0 && r < N && c >= 0 && c < N && board[r * N + c] === other) {
      run.push(r * N + c);
      r += dr;
      c += dc;
    }
    if (run.length && r >= 0 && r < N && c >= 0 && c < N && board[r * N + c] === piece) all.push(...run);
  }
  return all;
}

function legalMoves(board, piece) {
  const out = [];
  for (let i = 0; i < N * N; i++) {
    if (board[i] !== 0) continue;
    const f = flipsFor(board, i, piece);
    if (f.length) out.push({ i, flips: f });
  }
  return out;
}

const count = (board, v) => board.reduce((n, x) => n + (x === v ? 1 : 0), 0);

export function apply(state, move) {
  if (outcome(state).over) return null;
  const piece = state.turn + 1;
  if (move?.pass) {
    if (legalMoves(state.board, piece).length) return null;
    return { board: state.board.slice(), turn: 1 - state.turn, last: -1, flipped: [], moves: state.moves, passed: true };
  }
  const i = Number(move?.i);
  if (!Number.isInteger(i) || i < 0 || i >= N * N) return null;
  const flips = flipsFor(state.board, i, piece);
  if (!flips.length) return null;
  const board = state.board.slice();
  board[i] = piece;
  for (const f of flips) board[f] = piece;
  return { board, turn: 1 - state.turn, last: i, flipped: flips, moves: state.moves + 1, passed: false };
}

export function outcome(state) {
  const b = state.board;
  const done = !legalMoves(b, 1).length && !legalMoves(b, 2).length;
  if (!done) return { over: false, winner: null, draw: false };
  const d = count(b, 1);
  const l = count(b, 2);
  if (d === l) return { over: true, winner: null, draw: true };
  return { over: true, winner: d > l ? 0 : 1, draw: false };
}

/** Nobody chooses to pass — it happens when you have no move. */
export function auto(state) {
  if (outcome(state).over) return null;
  if (legalMoves(state.board, state.turn + 1).length) return null;
  return { move: { pass: true }, delay: 1300 };
}

export function note(state, seat) {
  return `${count(state.board, seat + 1)} discs`;
}

/* ------------------------------ opponent ------------------------------ */
const DEPTH = { gentle: 1, even: 3, sharp: 4 };

function evaluate(board, me) {
  const you = me === 1 ? 2 : 1;
  let pos = 0;
  let mine = 0;
  let theirs = 0;
  for (let i = 0; i < 64; i++) {
    if (board[i] === me) { pos += WEIGHTS[i]; mine++; }
    else if (board[i] === you) { pos -= WEIGHTS[i]; theirs++; }
  }
  const myMob = legalMoves(board, me).length;
  const yourMob = legalMoves(board, you).length;
  if (!myMob && !yourMob) return mine > theirs ? 10000 + mine : mine < theirs ? -10000 - theirs : 0;
  const mob = myMob + yourMob ? (100 * (myMob - yourMob)) / (myMob + yourMob) : 0;
  return pos + mob * 0.8;
}

function search(board, piece, me, depth, alpha, beta) {
  const moves = legalMoves(board, piece);
  const other = piece === 1 ? 2 : 1;
  if (depth === 0) return evaluate(board, me);
  if (!moves.length) {
    if (!legalMoves(board, other).length) return evaluate(board, me);
    return search(board, other, me, depth - 1, alpha, beta);
  }
  moves.sort((a, b) => WEIGHTS[b.i] - WEIGHTS[a.i]);
  const maximizing = piece === me;
  let best = maximizing ? -Infinity : Infinity;
  for (const m of moves) {
    const next = board.slice();
    next[m.i] = piece;
    for (const f of m.flips) next[f] = piece;
    const score = search(next, other, me, depth - 1, alpha, beta);
    if (maximizing) { if (score > best) best = score; if (score > alpha) alpha = score; }
    else { if (score < best) best = score; if (score < beta) beta = score; }
    if (beta <= alpha) break;
  }
  return best;
}

export function ai(state, seat, level = 'even') {
  const piece = seat + 1;
  const moves = legalMoves(state.board, piece);
  if (!moves.length) return null;

  if (level === 'gentle') {
    // Greedy and a bit random — fun to beat.
    moves.sort((a, b) => b.flips.length - a.flips.length + (Math.random() - 0.5) * 3);
    return { i: moves[0].i };
  }

  const depth = DEPTH[level] || 3;
  const other = piece === 1 ? 2 : 1;
  let best = moves[0].i;
  let bestScore = -Infinity;
  moves.sort((a, b) => WEIGHTS[b.i] - WEIGHTS[a.i]);
  for (const m of moves) {
    const next = state.board.slice();
    next[m.i] = piece;
    for (const f of m.flips) next[f] = piece;
    const score = search(next, other, piece, depth - 1, bestScore, Infinity) + Math.random() * 0.5;
    if (score > bestScore) { bestScore = score; best = m.i; }
  }
  return { i: best };
}

/* ------------------------------ view ------------------------------ */
export function view(state, ctx) {
  const out = outcome(state);
  const playable = !out.over && ctx.myTurn;
  const hints = playable ? new Set(legalMoves(state.board, ctx.seat + 1).map((m) => m.i)) : new Set();
  const flipped = new Set(state.flipped || []);

  let cells = '';
  for (let i = 0; i < 64; i++) {
    const v = state.board[i];
    const hint = hints.has(i);
    cells += `
      <button class="rv__sq${hint ? ' is-hint' : ''}${i === state.last ? ' is-last' : ''}" type="button" data-sq="${i}"
              ${hint ? '' : 'disabled'} aria-label="${'abcdefgh'[i % 8]}${8 - Math.floor(i / 8)}${v ? `, ${v === 1 ? 'dark' : 'light'}` : hint ? ', playable' : ''}">
        ${v ? `<i class="rv__disc rv__disc--${v - 1}${flipped.has(i) ? ' is-flip' : ''}${i === state.last ? ' is-fresh' : ''}" style="--d:${flipped.has(i) ? Math.abs((i % 8) - (state.last % 8)) + Math.abs(Math.floor(i / 8) - Math.floor(state.last / 8)) : 0}"></i>` : ''}
      </button>`;
  }

  return `
    <div class="rv${out.over ? ' is-over' : ''}">
      <div class="rv__score">
        <span class="rv__pill rv__pill--0"><i class="rv__disc rv__disc--0"></i> ${count(state.board, 1)}</span>
        ${state.passed ? '<span class="rv__pass">Pass ↺</span>' : ''}
        <span class="rv__pill rv__pill--1"><i class="rv__disc rv__disc--1"></i> ${count(state.board, 2)}</span>
      </div>
      <div class="rv__board" role="grid" aria-label="Reversi board">${cells}</div>
    </div>`;
}

export function bind(root, state, ctx, play) {
  root.querySelectorAll('[data-sq]:not(:disabled)').forEach((b) =>
    b.addEventListener('click', () => play({ i: Number(b.dataset.sq) }))
  );
}

export function coach(state, ctx) {
  if (state.moves < 2 && ctx.myTurn) return 'Fewer flips early keeps your options open.';
  if (ctx.myTurn && [0, 7, 56, 63].some((i) => flipsFor(state.board, i, ctx.seat + 1).length)) return 'A corner is open. Corners can never be flipped.';
  if (state.passed && ctx.myTurn) return 'They had no move — your turn again.';
  return '';
}
