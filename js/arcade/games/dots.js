/**
 * LifeFlow Arcade — Dots & Boxes.
 * Draw one line per turn. Close a box and it is yours — and you go again.
 * State is flat arrays of lines and boxes so it syncs cleanly.
 */

const R = 5; // rows of boxes
const C = 5; // columns of boxes
const H = (R + 1) * C; // horizontal lines
const V = R * (C + 1); // vertical lines

export const meta = {
  id: 'dots',
  group: ['board', 'brain'],
  title: 'Dots & Boxes',
  emoji: '🟦',
  tagline: 'One line at a time. Close it, claim it.',
  blurb: 'The pen-and-paper classic. Easy to start, and full of sneaky sacrifices once both players see the long chains coming.',
  minutes: '6 min',
  tags: ['Pen & paper', 'Tactics'],
  alternate: true,
  levels: [
    { id: 'gentle', label: 'Gentle', hint: 'Sometimes misses a box.' },
    { id: 'even', label: 'Even', hint: 'Takes boxes, avoids most traps.' },
    { id: 'sharp', label: 'Sharp', hint: 'Never hands you a box it can avoid.' }
  ],
  rules: [
    'Take turns drawing one line between two neighbouring dots.',
    'Close the fourth side of a box and it is yours — then you draw again.',
    'Careful: drawing the third side of a box hands it to your rival.',
    'When every box is claimed, the most boxes wins.'
  ]
};

export function create() {
  return { h: Array(H).fill(0), v: Array(V).fill(0), boxes: Array(R * C).fill(0), scores: [0, 0], turn: 0, last: null, moves: 0 };
}

export function turn(state) {
  return state.turn;
}

/* ------------------------------ geometry ------------------------------ */
function edgesOf(b) {
  const r = Math.floor(b / C);
  const c = b % C;
  return [['h', r * C + c], ['h', (r + 1) * C + c], ['v', r * (C + 1) + c], ['v', r * (C + 1) + c + 1]];
}

function boxesOf(k, i) {
  const out = [];
  if (k === 'h') {
    const r = Math.floor(i / C);
    const c = i % C;
    if (r > 0) out.push((r - 1) * C + c);
    if (r < R) out.push(r * C + c);
  } else {
    const r = Math.floor(i / (C + 1));
    const c = i % (C + 1);
    if (c > 0) out.push(r * C + c - 1);
    if (c < C) out.push(r * C + c);
  }
  return out;
}

const sides = (st, b) => edgesOf(b).reduce((n, [k, i]) => n + (st[k][i] ? 1 : 0), 0);

function openLines(st) {
  const out = [];
  st.h.forEach((x, i) => { if (!x) out.push({ k: 'h', i }); });
  st.v.forEach((x, i) => { if (!x) out.push({ k: 'v', i }); });
  return out;
}

/* ------------------------------ rules ------------------------------ */
export function apply(state, move) {
  const k = move?.k;
  const i = Number(move?.i);
  if (k !== 'h' && k !== 'v') return null;
  const max = k === 'h' ? H : V;
  if (!Number.isInteger(i) || i < 0 || i >= max) return null;
  if (state[k][i] || outcome(state).over) return null;

  const next = {
    h: state.h.slice(),
    v: state.v.slice(),
    boxes: state.boxes.slice(),
    scores: state.scores.slice(),
    turn: state.turn,
    last: { k, i },
    moves: state.moves + 1
  };
  next[k][i] = state.turn + 1;

  let closed = 0;
  for (const b of boxesOf(k, i)) {
    if (!next.boxes[b] && sides(next, b) === 4) {
      next.boxes[b] = state.turn + 1;
      closed++;
    }
  }
  if (closed) next.scores[state.turn] += closed;
  else next.turn = 1 - state.turn;
  return next;
}

export function outcome(state) {
  if (state.boxes.some((b) => !b)) return { over: false, winner: null, draw: false };
  const [a, b] = state.scores;
  if (a === b) return { over: true, winner: null, draw: true };
  return { over: true, winner: a > b ? 0 : 1, draw: false };
}

export function auto() {
  return null;
}

export function note(state, seat) {
  const n = state.scores[seat];
  return `${n} box${n === 1 ? '' : 'es'}`;
}

/* ------------------------------ opponent ------------------------------ */
const completes = (st, m) => boxesOf(m.k, m.i).some((b) => !st.boxes[b] && sides(st, b) === 3);
const isSafe = (st, m) => boxesOf(m.k, m.i).every((b) => sides(st, b) < 2);

/** How many boxes the rival collects if we play `m` and they grab greedily. */
function giveaway(st, m) {
  const sim = { h: st.h.slice(), v: st.v.slice(), boxes: st.boxes.slice() };
  sim[m.k][m.i] = 1;
  let taken = 0;
  for (let guard = 0; guard < 80; guard++) {
    let found = false;
    for (let b = 0; b < R * C && !found; b++) {
      if (sim.boxes[b] || sides(sim, b) !== 3) continue;
      const [k, i] = edgesOf(b).find(([kk, ii]) => !sim[kk][ii]);
      sim[k][i] = 1;
      for (const bb of boxesOf(k, i)) if (!sim.boxes[bb] && sides(sim, bb) === 4) { sim.boxes[bb] = 1; taken++; }
      found = true;
    }
    if (!found) break;
  }
  return taken;
}

const pick = (list) => list[Math.floor(Math.random() * list.length)];

export function ai(state, seat, level = 'even') {
  if (outcome(state).over) return null;
  const open = openLines(state);
  if (!open.length) return null;

  const grab = open.filter((m) => completes(state, m));
  const careless = level === 'gentle' ? 0.35 : level === 'even' ? 0.04 : 0;
  if (grab.length && Math.random() >= careless) return pick(grab);

  const safe = open.filter((m) => !completes(state, m) && isSafe(state, m));
  if (safe.length && (level !== 'gentle' || Math.random() < 0.7)) return pick(safe);
  if (level === 'gentle') return pick(open);

  // Every move gives something away — give away as little as possible.
  let best = [];
  let least = Infinity;
  for (const m of open) {
    const cost = giveaway(state, m);
    if (cost < least) { least = cost; best = [m]; }
    else if (cost === least) best.push(m);
  }
  return pick(best);
}

/* ------------------------------ view ------------------------------ */
const S = 60;
const PAD = 16;

export function view(state, ctx) {
  const out = outcome(state);
  const playable = !out.over && ctx.myTurn;
  const W = C * S + PAD * 2;
  const Ht = R * S + PAD * 2;
  const x = (c) => PAD + c * S;
  const y = (r) => PAD + r * S;
  const isLast = (k, i) => state.last && state.last.k === k && state.last.i === i;
  const initial = (seat) => (ctx.names?.[seat] || (seat ? 'B' : 'A')).trim().charAt(0).toUpperCase() || '•';

  const freshBoxes = state.last ? boxesOf(state.last.k, state.last.i) : [];

  let boxes = '';
  state.boxes.forEach((owner, b) => {
    if (!owner) return;
    const r = Math.floor(b / C);
    const c = b % C;
    boxes += `
      <g class="dab__box dab__box--${owner - 1}${freshBoxes.includes(b) ? ' is-fresh' : ''}">
        <rect x="${x(c) + 5}" y="${y(r) + 5}" width="${S - 10}" height="${S - 10}" rx="9" />
        <text x="${x(c) + S / 2}" y="${y(r) + S / 2 + 7}" text-anchor="middle">${initial(owner - 1)}</text>
      </g>`;
  });

  const line = (k, i, x1, y1, x2, y2) => {
    const who = state[k][i];
    const label = `${k === 'h' ? 'Horizontal' : 'Vertical'} line ${i + 1}`;
    return `
      <g class="dab__line${who ? ` is-on dab__line--${who - 1}` : ''}${isLast(k, i) ? ' is-last' : ''}"
         ${!who && playable ? `data-line="${k}${i}" role="button" tabindex="0" aria-label="${label}"` : ''}>
        <line class="dab__hit" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" />
        <line class="dab__stroke" x1="${x1 + 7}" y1="${y1 + (y1 === y2 ? 0 : 7)}" x2="${x2 - (y1 === y2 ? 7 : 0)}" y2="${y2 - (y1 === y2 ? 0 : 7)}" />
      </g>`;
  };

  let lines = '';
  for (let r = 0; r <= R; r++) for (let c = 0; c < C; c++) lines += line('h', r * C + c, x(c), y(r), x(c + 1), y(r));
  for (let r = 0; r < R; r++) for (let c = 0; c <= C; c++) lines += line('v', r * (C + 1) + c, x(c), y(r), x(c), y(r + 1));

  let dots = '';
  for (let r = 0; r <= R; r++) for (let c = 0; c <= C; c++) dots += `<circle cx="${x(c)}" cy="${y(r)}" r="5" />`;

  return `
    <div class="dab${out.over ? ' is-over' : ''}${playable ? ' is-playable' : ''} dab--turn-${state.turn}">
      <svg class="dab__svg" viewBox="0 0 ${W} ${Ht}" role="group" aria-label="Dots and boxes board">
        <g class="dab__boxes">${boxes}</g>
        <g class="dab__lines">${lines}</g>
        <g class="dab__dots">${dots}</g>
      </svg>
    </div>`;
}

export function bind(root, state, ctx, play) {
  const go = (el) => {
    const raw = el.dataset.line;
    play({ k: raw[0], i: Number(raw.slice(1)) });
  };
  root.querySelectorAll('[data-line]').forEach((el) => {
    el.addEventListener('click', () => go(el));
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(el); }
    });
  });
}

export function coach(state, ctx) {
  if (state.moves === 0 && ctx.myTurn) return 'Early on, any line is safe. Avoid third sides.';
  if (ctx.myTurn && openLines(state).some((m) => completes(state, m))) return 'There is a box waiting for you.';
  return '';
}
