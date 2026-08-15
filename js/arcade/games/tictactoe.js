/**
 * LifeFlow Arcade — Tic-Tac-Toe.
 * Pure, JSON-safe state so the very same object can travel through Firestore
 * to the other player without any translation.
 */

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6]
];

export const meta = {
  id: 'tictactoe',
  title: 'Tic-Tac-Toe',
  emoji: '✳️',
  tagline: 'Three in a row, in three breaths.',
  blurb: 'The classic pocket duel. Simple to start, quietly deep once your rival stops missing.',
  minutes: '2 min',
  tags: ['Classic', 'Quick'],
  marks: ['✕', '◯'],
  alternate: true,
  levels: [
    { id: 'gentle', label: 'Gentle', hint: 'Plays kindly, misses a little.' },
    { id: 'even', label: 'Even', hint: 'A fair, thoughtful rival.' },
    { id: 'sharp', label: 'Sharp', hint: 'Never loses. Aim for the draw.' }
  ],
  rules: [
    'Take turns claiming a square.',
    'First to line up three — across, down or diagonally — wins.',
    'A full board with no line is a peaceful draw.'
  ]
};

export function create() {
  return { board: Array(9).fill(0), turn: 0, last: -1, moves: 0 };
}

export function turn(state) {
  return state.turn;
}

export function apply(state, move) {
  const i = Number(move?.i);
  if (!Number.isInteger(i) || i < 0 || i > 8) return null;
  if (state.board[i] !== 0 || outcome(state).over) return null;

  const board = state.board.slice();
  board[i] = state.turn + 1;
  return { board, turn: 1 - state.turn, last: i, moves: state.moves + 1 };
}

export function outcome(state) {
  for (const line of LINES) {
    const [a, b, c] = line;
    const v = state.board[a];
    if (v !== 0 && v === state.board[b] && v === state.board[c]) {
      return { over: true, winner: v - 1, draw: false, line };
    }
  }
  if (state.board.every((v) => v !== 0)) return { over: true, winner: null, draw: true, line: null };
  return { over: false, winner: null, draw: false, line: null };
}

/** Nothing here happens on its own. */
export function auto() {
  return null;
}

/* ------------------------------ opponent ------------------------------ */
const SLOPPY = { gentle: 0.6, even: 0.22, sharp: 0 };

export function ai(state, seat, level = 'even') {
  const open = state.board.map((v, i) => (v === 0 ? i : -1)).filter((i) => i >= 0);
  if (!open.length || outcome(state).over) return null;

  if (Math.random() < (SLOPPY[level] ?? 0.2)) {
    return { i: open[Math.floor(Math.random() * open.length)] };
  }

  let best = open[0];
  let bestScore = -Infinity;
  for (const i of open) {
    const board = state.board.slice();
    board[i] = seat + 1;
    const score = minimax({ board, turn: 1 - seat, moves: state.moves + 1 }, seat, 0, -Infinity, Infinity);
    if (score > bestScore) { bestScore = score; best = i; }
  }
  return { i: best };
}

function minimax(state, me, depth, alpha, beta) {
  const out = outcome(state);
  if (out.over) {
    if (out.draw) return 0;
    return out.winner === me ? 10 - depth : depth - 10;
  }

  const open = state.board.map((v, i) => (v === 0 ? i : -1)).filter((i) => i >= 0);
  const maximizing = state.turn === me;
  let best = maximizing ? -Infinity : Infinity;

  for (const i of open) {
    const board = state.board.slice();
    board[i] = state.turn + 1;
    const score = minimax({ board, turn: 1 - state.turn, moves: state.moves + 1 }, me, depth + 1, alpha, beta);
    if (maximizing) {
      best = Math.max(best, score);
      alpha = Math.max(alpha, score);
    } else {
      best = Math.min(best, score);
      beta = Math.min(beta, score);
    }
    if (beta <= alpha) break;
  }
  return best;
}

/* ------------------------------ view ------------------------------ */
const MARK_X = '<svg class="ttt__glyph" viewBox="0 0 100 100"><line class="d1" x1="26" y1="26" x2="74" y2="74"/><line class="d2" x1="74" y1="26" x2="26" y2="74"/></svg>';
const MARK_O = '<svg class="ttt__glyph" viewBox="0 0 100 100"><circle cx="50" cy="50" r="26"/></svg>';

const glyph = (v) => (v === 1 ? MARK_X : MARK_O);

export function view(state, ctx) {
  const out = outcome(state);
  const winners = out.line || [];
  const playable = !out.over && ctx.myTurn;

  return `
    <div class="ttt${out.over ? ' is-over' : ''}">
      <div class="ttt__grid" role="grid" aria-label="Tic-Tac-Toe board">
        ${state.board
          .map((v, i) => {
            const fresh = i === state.last;
            const won = winners.includes(i);
            return `
            <button class="ttt__cell${v ? ' is-filled' : ''}${won ? ' is-win' : ''}" type="button"
                    data-cell="${i}" style="--d:${Math.floor(i / 3) * 60 + (i % 3) * 40}ms"
                    ${v || !playable ? 'disabled' : ''}
                    aria-label="Square ${i + 1}${v ? `, ${v === 1 ? 'cross' : 'circle'}` : ', empty'}">
              ${v ? `<span class="ttt__mark ttt__mark--${v === 1 ? 'x' : 'o'}${fresh ? ' is-fresh' : ''}">${glyph(v)}</span>` : ''}
              ${!v && playable ? `<span class="ttt__ghost ttt__mark--${ctx.seat === 0 ? 'x' : 'o'}">${glyph(ctx.seat + 1)}</span>` : ''}
            </button>`;
          })
          .join('')}
        ${out.line ? strike(out.line) : ''}
      </div>
    </div>`;
}

function strike(line) {
  const at = (i) => [(i % 3) * 33.333 + 16.667, Math.floor(i / 3) * 33.333 + 16.667];
  const [x1, y1] = at(line[0]);
  const [x2, y2] = at(line[2]);
  const pad = 0.16;
  return `
    <svg class="ttt__strike" viewBox="0 0 100 100" aria-hidden="true">
      <line x1="${x1 + (x2 - x1) * -pad}" y1="${y1 + (y2 - y1) * -pad}"
            x2="${x2 + (x2 - x1) * pad}" y2="${y2 + (y2 - y1) * pad}" />
    </svg>`;
}

export function bind(root, state, ctx, play) {
  root.querySelectorAll('[data-cell]').forEach((b) =>
    b.addEventListener('click', () => play({ i: Number(b.dataset.cell) }))
  );
}

/** One-line nudge shown under the board. */
export function coach(state, ctx) {
  if (state.moves === 0) return ctx.myTurn ? 'Corners age well. So do middles.' : 'Watch where they open.';
  return '';
}
