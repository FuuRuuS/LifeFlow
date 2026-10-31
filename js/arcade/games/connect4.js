/**
 * LifeFlow Arcade — Connect Four.
 * 7 × 6 board stored flat (row-major, row 0 at the top) so it stays
 * Firestore-friendly. The computer is a negamax search with alpha-beta.
 */

const COLS = 7;
const ROWS = 6;
const CELLS = COLS * ROWS;

/** Every possible run of four, precomputed once. */
const LINES = (() => {
  const out = [];
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      for (const [dr, dc] of dirs) {
        const er = r + dr * 3;
        const ec = c + dc * 3;
        if (er < 0 || er >= ROWS || ec < 0 || ec >= COLS) continue;
        out.push([0, 1, 2, 3].map((k) => (r + dr * k) * COLS + (c + dc * k)));
      }
    }
  }
  return out;
})();

const ORDER = [3, 2, 4, 1, 5, 0, 6];

export const meta = {
  id: 'connect4',
  group: ['board', 'friends'],
  title: 'Connect Four',
  emoji: '🔴',
  tagline: 'Drop, block, line up four.',
  blurb: 'Gravity does half the work. Think one disc ahead and you will win often — two ahead and you will win a lot.',
  minutes: '5 min',
  tags: ['Classic', 'Tactics'],
  alternate: true,
  levels: [
    { id: 'gentle', label: 'Gentle', hint: 'Looks a move ahead, sometimes wanders.' },
    { id: 'even', label: 'Even', hint: 'Blocks your threats and builds its own.' },
    { id: 'sharp', label: 'Sharp', hint: 'Reads deep. Control the centre.' }
  ],
  rules: [
    'Take turns dropping a disc into any column that is not full.',
    'Discs fall to the lowest free space.',
    'Four of your discs in a row — across, down or diagonally — wins.',
    'A full board with no four is a draw.'
  ]
};

export function create() {
  return { board: Array(CELLS).fill(0), turn: 0, last: -1, moves: 0 };
}

export function turn(state) {
  return state.turn;
}

function dropRow(board, c) {
  for (let r = ROWS - 1; r >= 0; r--) if (board[r * COLS + c] === 0) return r;
  return -1;
}

export function apply(state, move) {
  const c = Number(move?.c);
  if (!Number.isInteger(c) || c < 0 || c >= COLS) return null;
  if (outcome(state).over) return null;
  const r = dropRow(state.board, c);
  if (r < 0) return null;
  const board = state.board.slice();
  const i = r * COLS + c;
  board[i] = state.turn + 1;
  return { board, turn: 1 - state.turn, last: i, moves: state.moves + 1 };
}

function winnerOf(board) {
  for (const line of LINES) {
    const v = board[line[0]];
    if (v && v === board[line[1]] && v === board[line[2]] && v === board[line[3]]) return { v, line };
  }
  return null;
}

export function outcome(state) {
  const w = winnerOf(state.board);
  if (w) return { over: true, winner: w.v - 1, draw: false, line: w.line };
  if (state.moves >= CELLS || state.board.every((v) => v !== 0)) return { over: true, winner: null, draw: true, line: null };
  return { over: false, winner: null, draw: false, line: null };
}

export function auto() {
  return null;
}

/* ------------------------------ opponent ------------------------------ */
const DEPTH = { gentle: 2, even: 4, sharp: 7 };
const WANDER = { gentle: 0.3, even: 0.06, sharp: 0 };

function evaluate(board, me) {
  const you = me === 1 ? 2 : 1;
  let score = 0;
  for (let r = 0; r < ROWS; r++) {
    const v = board[r * COLS + 3];
    if (v === me) score += 3;
    else if (v === you) score -= 3;
  }
  for (const line of LINES) {
    let m = 0;
    let y = 0;
    for (const i of line) {
      const v = board[i];
      if (v === me) m++;
      else if (v === you) y++;
    }
    if (m && y) continue;
    if (m === 3) score += 6;
    else if (m === 2) score += 2;
    else if (y === 3) score -= 7;
    else if (y === 2) score -= 2;
  }
  return score;
}

function negamax(board, piece, depth, alpha, beta, moves) {
  const w = winnerOf(board);
  if (w) return w.v === piece ? 100000 + depth : -100000 - depth;
  if (moves >= CELLS) return 0;
  if (depth === 0) return evaluate(board, piece);

  let best = -Infinity;
  const other = piece === 1 ? 2 : 1;
  for (const c of ORDER) {
    const r = dropRow(board, c);
    if (r < 0) continue;
    const i = r * COLS + c;
    board[i] = piece;
    const score = -negamax(board, other, depth - 1, -beta, -alpha, moves + 1);
    board[i] = 0;
    if (score > best) best = score;
    if (score > alpha) alpha = score;
    if (alpha >= beta) break;
  }
  return best;
}

export function ai(state, seat, level = 'even') {
  if (outcome(state).over) return null;
  const open = ORDER.filter((c) => dropRow(state.board, c) >= 0);
  if (!open.length) return null;
  const piece = seat + 1;
  const board = state.board.slice();

  // Always take a win and always stop an immediate loss — even the gentle bot.
  for (const p of [piece, piece === 1 ? 2 : 1]) {
    for (const c of open) {
      const i = dropRow(board, c) * COLS + c;
      board[i] = p;
      const won = winnerOf(board);
      board[i] = 0;
      if (won) return { c };
    }
  }

  if (Math.random() < (WANDER[level] ?? 0.1)) return { c: open[Math.floor(Math.random() * open.length)] };

  const depth = DEPTH[level] || 4;
  let bestC = open[0];
  let best = -Infinity;
  for (const c of open) {
    const i = dropRow(board, c) * COLS + c;
    board[i] = piece;
    const score = -negamax(board, piece === 1 ? 2 : 1, depth - 1, -Infinity, -best, state.moves + 1);
    board[i] = 0;
    if (score > best) { best = score; bestC = c; }
  }
  return { c: bestC };
}

/* ------------------------------ view ------------------------------ */
export function view(state, ctx) {
  const out = outcome(state);
  const win = new Set(out.line || []);
  const playable = !out.over && ctx.myTurn;
  const lastCol = state.last >= 0 ? state.last % COLS : -1;

  let cols = '';
  for (let c = 0; c < COLS; c++) {
    const full = dropRow(state.board, c) < 0;
    let cells = '';
    for (let r = 0; r < ROWS; r++) {
      const i = r * COLS + c;
      const v = state.board[i];
      cells += `<span class="c4__cell">${
        v
          ? `<i class="c4__disc c4__disc--${v - 1}${i === state.last ? ' is-fresh' : ''}${win.has(i) ? ' is-win' : ''}" style="--r:${r + 1}"></i>`
          : ''
      }</span>`;
    }
    cols += `
      <button class="c4__col${c === lastCol ? ' is-last' : ''}" type="button" data-col="${c}"
              ${!playable || full ? 'disabled' : ''} aria-label="Column ${c + 1}${full ? ', full' : ''}">
        ${playable && !full ? `<i class="c4__ghost c4__disc--${ctx.seat}"></i>` : ''}
        ${cells}
      </button>`;
  }

  return `
    <div class="c4${out.over ? ' is-over' : ''}">
      <div class="c4__board" role="grid" aria-label="Connect Four board">${cols}</div>
    </div>`;
}

export function bind(root, state, ctx, play) {
  root.querySelectorAll('[data-col]').forEach((b) =>
    b.addEventListener('click', () => play({ c: Number(b.dataset.col) }))
  );
}

export function coach(state, ctx) {
  if (state.moves === 0) return ctx.myTurn ? 'The middle column touches the most fours.' : 'See where they open.';
  if (state.moves < 4 && ctx.myTurn) return 'Keep your discs connected and low.';
  return '';
}
