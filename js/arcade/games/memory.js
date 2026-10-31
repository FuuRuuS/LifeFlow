/**
 * LifeFlow Arcade — Memory.
 * Eight quiet pairs. Turn two cards; keep them if they match, and keep the turn.
 *
 * A missed pair stays face-up until the player who flipped it sends a `settle`
 * move — that way both screens see the mistake for exactly as long as each
 * other before the cards turn back over.
 */

const FACES = ['🌙', '🌿', '🐚', '🍯', '🕊️', '🌸', '🫧', '🪵'];
const PAIRS = FACES.length;
const COUNT = PAIRS * 2;

export const meta = {
  id: 'memory',
  group: ['cards', 'brain', 'couple'],
  title: 'Memory',
  emoji: '🃏',
  tagline: 'Sixteen cards, eight quiet pairs.',
  blurb: 'Slow attention beats fast clicking. Find a pair and the turn stays yours.',
  minutes: '4 min',
  tags: ['Calm', 'Focus'],
  alternate: true,
  levels: [
    { id: 'gentle', label: 'Forgetful', hint: 'Remembers about a third of it.' },
    { id: 'even', label: 'Attentive', hint: 'Remembers most of what it sees.' },
    { id: 'sharp', label: 'Elephant', hint: 'Forgets nothing. Ever.' }
  ],
  rules: [
    'Turn over two cards on your go.',
    'A matching pair is yours — and you go again.',
    'Most pairs when the table is empty wins.'
  ]
};

export function create() {
  const cards = [];
  for (let i = 0; i < PAIRS; i++) cards.push(i, i);
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return {
    cards,
    face: Array(COUNT).fill(0),
    owner: Array(COUNT).fill(-1),
    open: [],
    seen: [],
    scores: [0, 0],
    turn: 0,
    moves: 0
  };
}

export function turn(state) {
  return state.turn;
}

export function apply(state, move) {
  if (move?.settle) {
    if (state.open.length !== 2) return null;
    return { ...state, open: [], turn: 1 - state.turn, moves: state.moves + 1 };
  }

  const i = Number(move?.card);
  if (!Number.isInteger(i) || i < 0 || i >= COUNT) return null;
  if (state.open.length >= 2 || state.face[i] || state.open.includes(i)) return null;

  const open = [...state.open, i];
  const seen = state.seen.includes(i) ? state.seen : [...state.seen, i];
  const next = { ...state, open, seen, moves: state.moves + 1 };

  if (open.length === 2) {
    const [a, b] = open;
    if (state.cards[a] === state.cards[b]) {
      const face = state.face.slice();
      const owner = state.owner.slice();
      const scores = state.scores.slice();
      face[a] = 1;
      face[b] = 1;
      owner[a] = state.turn;
      owner[b] = state.turn;
      scores[state.turn] += 1;
      // A match keeps the turn — a small, generous rule.
      return { ...next, face, owner, scores, open: [], lastPair: [a, b] };
    }
  }
  return { ...next, lastPair: null };
}

export function outcome(state) {
  if (!state.face.every((f) => f === 1)) return { over: false, winner: null, draw: false };
  const [a, b] = state.scores;
  return { over: true, winner: a === b ? null : a > b ? 0 : 1, draw: a === b };
}

export function note(state, seat) {
  return `${state.scores[seat]} pairs`;
}

/** After a miss the cards flip back on their own, once everyone has seen them. */
export function auto(state) {
  if (state.open.length === 2) return { move: { settle: true }, delay: 1150 };
  return null;
}

/* ------------------------------ opponent ------------------------------ */
const RECALL = { gentle: 0.34, even: 0.72, sharp: 1 };

export function ai(state, seat, level = 'even') {
  if (outcome(state).over || state.open.length >= 2) return null;
  const recall = RECALL[level] ?? 0.7;
  const hidden = [];
  for (let i = 0; i < COUNT; i++) if (!state.face[i] && !state.open.includes(i)) hidden.push(i);
  if (!hidden.length) return null;

  const known = hidden.filter((i) => state.seen.includes(i));
  const fresh = hidden.filter((i) => !state.seen.includes(i));

  // Second card: complete the pair if it remembers where the twin is.
  if (state.open.length === 1 && Math.random() < recall) {
    const want = state.cards[state.open[0]];
    const twin = known.find((i) => state.cards[i] === want);
    if (twin !== undefined) return { card: twin };
  }

  // First card: open one half of a pair it has already seen.
  if (state.open.length === 0 && Math.random() < recall) {
    const pair = known.find((i) => known.some((j) => j !== i && state.cards[j] === state.cards[i]));
    if (pair !== undefined) return { card: pair };
  }

  const pool = fresh.length ? fresh : hidden;
  return { card: pool[Math.floor(Math.random() * pool.length)] };
}

/* ------------------------------ view ------------------------------ */
/**
 * Cards are painted in the state the player last *saw*, then flipped to the new
 * state on the next frame — that is what makes the turn animate instead of
 * simply appearing.
 */
let painted = new Map();
let paintedKey = '';

export function view(state, ctx) {
  const key = `${ctx.sessionKey || ''}`;
  if (key !== paintedKey) { painted = new Map(); paintedKey = key; }

  const out = outcome(state);
  const locked = state.open.length === 2 || out.over || !ctx.myTurn;

  const cards = state.cards
    .map((faceIdx, i) => {
      const isUp = Boolean(state.face[i] || state.open.includes(i));
      const was = painted.get(i) === true;
      const matched = state.face[i] === 1;
      const owner = state.owner[i];
      return `
      <button class="mem__card${was ? ' is-up' : ''}${matched ? ' is-matched' : ''}${owner === 0 ? ' is-mine' : owner === 1 ? ' is-theirs' : ''}"
              type="button" data-card="${i}" data-up="${isUp ? 1 : 0}" style="--d:${i * 24}ms"
              ${isUp || locked ? 'disabled' : ''}
              aria-label="${isUp ? `Card showing ${FACES[faceIdx]}` : 'Face-down card'}">
        <span class="mem__side mem__side--back"><span class="mem__weave"></span></span>
        <span class="mem__side mem__side--front">${FACES[faceIdx]}</span>
      </button>`;
    })
    .join('');

  return `
    <div class="mem${locked ? ' is-locked' : ''}">
      <div class="mem__grid">${cards}</div>
      <div class="mem__tally">
        <span class="mem__pip mem__pip--0${state.turn === 0 ? ' is-turn' : ''}">${state.scores[0]}</span>
        <span class="mem__tallylabel">pairs</span>
        <span class="mem__pip mem__pip--1${state.turn === 1 ? ' is-turn' : ''}">${state.scores[1]}</span>
      </div>
    </div>`;
}

export function bind(root, state, ctx, play) {
  // Flip on the next frame so the CSS transition has something to animate.
  requestAnimationFrame(() => {
    root.querySelectorAll('[data-card]').forEach((card) => {
      const i = Number(card.dataset.card);
      const up = card.dataset.up === '1';
      card.classList.toggle('is-up', up);
      painted.set(i, up);
    });
  });

  root.querySelectorAll('[data-card]').forEach((card) =>
    card.addEventListener('click', () => play({ card: Number(card.dataset.card) }))
  );
}

export function coach(state, ctx) {
  if (state.open.length === 2) return 'Hold the picture in mind…';
  if (state.moves === 0) return ctx.myTurn ? 'Start anywhere. Notice, don’t rush.' : '';
  return '';
}
