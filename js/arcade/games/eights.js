/**
 * LifeFlow Arcade — Crazy Eights (Huit américain).
 * Match the suit or rank of the top card. Eights are wild, twos make your rival draw,
 * jacks skip their turn. First to empty their hand wins.
 * Cards are numbers 0–51: rank = n % 13 (0 = A … 7 = 8 … 10 = J), suit = floor(n / 13).
 */
import { esc, rand, shuffle } from './kit.js';

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS = ['♠', '♥', '♦', '♣'];
const SUIT_NAMES = ['Spades', 'Hearts', 'Diamonds', 'Clubs'];
const R8 = 7;
const R2 = 1;
const RJ = 10;

const rank = (c) => c % 13;
const suitOf = (c) => Math.floor(c / 13);
const red = (s) => s === 1 || s === 2;
const top = (s) => s.pile[s.pile.length - 1];
const hand = (s, seat) => s[`h${seat}`];

export const meta = {
  id: 'eights',
  group: ['cards', 'friends'],
  title: 'Crazy Eights',
  emoji: '♠️',
  tagline: 'Huit américain — match, trick, and empty your hand.',
  blurb: 'The café card classic. Follow suit or rank, play an 8 to change the suit, a 2 to make your rival draw, a jack to go again. Quick, cheeky and very replayable.',
  minutes: '6 min',
  tags: ['Cards', 'Classic'],
  alternate: true,
  levels: [
    { id: 'gentle', label: 'Gentle', hint: 'Plays whatever fits.' },
    { id: 'even', label: 'Even', hint: 'Keeps its eights for later.' },
    { id: 'sharp', label: 'Sharp', hint: 'Times twos and jacks to hurt.' }
  ],
  settings: [
    {
      id: 'hand', label: 'Starting hand', def: 7,
      options: [{ v: 5, label: '5 cards' }, { v: 7, label: '7 cards' }, { v: 9, label: '9 cards' }]
    },
    {
      id: 'powers', label: 'Power cards', def: 'full',
      options: [{ v: 'full', label: '8s, 2s & jacks' }, { v: 'plain', label: 'Only 8s are special' }]
    }
  ],
  rules: [
    'Each player starts with 7 cards (configurable). Play one card matching the suit or the rank of the top card.',
    'Eights are wild — play one any time and pick the next suit.',
    'A 2 makes your rival draw two, unless they answer with a 2 of their own (the penalty stacks).',
    'A jack skips your rival — you play again.',
    'Nothing to play? Draw one. If it fits you may play it, otherwise your turn ends.',
    'First to empty their hand wins.',
    'Settings: start with 5, 7 or 9 cards; switch off 2s and jacks for a calmer game.'
  ]
};

export function create(opts = {}) {
  const size = [5, 7, 9].includes(opts.hand) ? opts.hand : 7;
  const powers = opts.powers === 'plain' ? 'plain' : 'full';
  const deck = shuffle(Array.from({ length: 52 }, (_, i) => i));
  const h0 = deck.splice(0, size);
  const h1 = deck.splice(0, size);
  const k = deck.findIndex((c) => ![R8, R2, RJ].includes(rank(c)));
  const start = deck.splice(k, 1)[0];
  return { gid: Math.random().toString(36).slice(2, 9), h0, h1, deck, pile: [start], suit: suitOf(start), pending: 0, drew: false, turn: 0, last: null, moves: 0, powers };
}

export function turn(state) {
  return state.turn;
}

export function playable(state, c) {
  const r = rank(c);
  if (state.pending > 0) return r === R2;
  if (r === R8) return true;
  return suitOf(c) === state.suit || r === rank(top(state));
}

function take(state, n) {
  let deck = state.deck.slice();
  let pile = state.pile.slice();
  const got = [];
  for (let i = 0; i < n; i++) {
    if (!deck.length) {
      if (pile.length <= 1) break;
      deck = shuffle(pile.slice(0, -1));
      pile = pile.slice(-1);
    }
    got.push(deck.pop());
  }
  return { deck, pile, got };
}

export function apply(state, move) {
  if (!move || outcome(state).over) return null;
  const p = state.turn;
  const key = `h${p}`;
  const mine = hand(state, p);

  if (move.play !== undefined) {
    const c = move.play;
    if (!Number.isInteger(c) || !mine.includes(c) || !playable(state, c)) return null;
    const r = rank(c);
    let suit = suitOf(c);
    if (r === R8) {
      if (![0, 1, 2, 3].includes(move.suit)) return null;
      suit = move.suit;
    }
    const power = state.powers !== 'plain';
    return {
      ...state,
      [key]: mine.filter((x) => x !== c),
      pile: [...state.pile, c],
      suit,
      pending: power && r === R2 ? state.pending + 2 : 0,
      drew: false,
      turn: power && r === RJ ? p : 1 - p,
      last: { seat: p, kind: 'play', card: c, suit },
      moves: state.moves + 1
    };
  }

  if (move.draw) {
    if (state.drew) return null;
    const n = state.pending > 0 ? state.pending : 1;
    const { deck, pile, got } = take(state, n);
    const nextHand = [...mine, ...got];
    const fits = state.pending === 0 && got.length === 1 && playable({ ...state, pending: 0 }, got[0]);
    return {
      ...state,
      [key]: nextHand,
      deck,
      pile,
      pending: 0,
      drew: fits,
      turn: fits ? p : 1 - p,
      last: { seat: p, kind: 'draw', got, penalty: state.pending },
      moves: state.moves + 1
    };
  }

  if (move.pass) {
    if (!state.drew) return null;
    return { ...state, drew: false, turn: 1 - p, last: { seat: p, kind: 'pass' }, moves: state.moves + 1 };
  }

  return null;
}

export function outcome(state) {
  if (!state.h0.length) return { over: true, winner: 0, draw: false };
  if (!state.h1.length) return { over: true, winner: 1, draw: false };
  if (state.moves > 600) {
    const a = state.h0.length;
    const b = state.h1.length;
    return a === b ? { over: true, winner: null, draw: true } : { over: true, winner: a < b ? 0 : 1, draw: false };
  }
  return { over: false };
}

export function auto() {
  return null;
}

export function pace() {
  return 250;
}

function bestSuit(cards) {
  const count = [0, 0, 0, 0];
  cards.forEach((c) => { if (rank(c) !== R8) count[suitOf(c)] += 1; });
  let best = 0;
  for (let s = 1; s < 4; s++) if (count[s] > count[best]) best = s;
  return count[best] ? best : rand(4);
}

export function ai(state, seat, level = 'even') {
  const mine = hand(state, seat);
  const plays = mine.filter((c) => playable(state, c));
  if (!plays.length) return state.drew ? { pass: true } : { draw: true };

  let pick;
  if (level === 'gentle') {
    pick = plays[rand(plays.length)];
  } else {
    const rivalLeft = hand(state, 1 - seat).length;
    const suitCount = [0, 0, 0, 0];
    mine.forEach((c) => (suitCount[suitOf(c)] += 1));
    const score = (c) => {
      const r = rank(c);
      let v = suitCount[suitOf(c)];
      if (r === R8) v -= plays.length > 1 ? 12 : 0;
      if (r === RJ) v += 3;
      if (r === R2) v += level === 'sharp' && rivalLeft <= 3 ? 8 : 1;
      if (level === 'sharp' && rivalLeft <= 2 && r === R8) v += 4;
      return v + Math.random() * 0.5;
    };
    pick = plays.slice().sort((a, b) => score(b) - score(a))[0];
  }
  const move = { play: pick };
  if (rank(pick) === R8) move.suit = bestSuit(mine.filter((c) => c !== pick));
  return move;
}

export function note(state, seat) {
  const n = hand(state, seat).length;
  return n === 1 ? 'Last card!' : `${n} cards`;
}

/* ------------------------------ view ------------------------------ */
function face(c) {
  const r = RANKS[rank(c)];
  const s = SUITS[suitOf(c)];
  const court = rank(c) >= RJ;
  return `
    <span class="pc__corner pc__corner--tl">${r}<i>${s}</i></span>
    <span class="pc__mid${court ? ' pc__mid--court' : ''}${rank(c) === R8 ? ' pc__mid--wild' : ''}">${court ? `<b>${r}</b>` : ''}${s}</span>
    <span class="pc__corner pc__corner--br">${r}<i>${s}</i></span>`;
}

function label(c) {
  return `${RANKS[rank(c)]} of ${SUIT_NAMES[suitOf(c)]}`;
}

const tilt = (c, i) => (((c * 37 + i * 11) % 19) - 9);

export function view(state, ctx) {
  const me = ctx.seat;
  const opp = 1 - me;
  const over = outcome(state).over;
  const mine = hand(state, me)
    .slice()
    .sort((a, b) => suitOf(a) - suitOf(b) || rank(a) - rank(b));
  const theirs = hand(state, opp).length;
  const t = top(state);
  const last = state.last;
  const fresh = last && last.kind === 'draw' && last.seat === me ? last.got : [];
  const myTurn = ctx.myTurn && !over;
  const overlap = mine.length <= 6 ? -16 : Math.max(-46, -16 - (mine.length - 6) * 4);
  const oppOverlap = theirs <= 6 ? -30 : Math.max(-44, -30 - (theirs - 6) * 2);

  const under = state.pile.slice(-4, -1);
  const enter = last && last.kind === 'play' ? (last.seat === me ? ' from-me' : ' from-opp') : '';

  return `
    <div class="c8${myTurn ? ' is-my-turn' : ''}">
      <div class="c8__opp" aria-label="${esc(ctx.names[opp] || 'Rival')} has ${theirs} cards">
        <div class="c8__fan" style="--n:${theirs};--ov:${oppOverlap}px">
          ${Array.from({ length: theirs }, (_, i) => `<span class="pc pc--back" style="--i:${i}"></span>`).join('')}
        </div>
        ${last && last.seat === opp && last.kind === 'draw' ? `<span class="c8__said">drew ${last.got.length}</span>` : ''}
        ${last && last.seat === opp && last.kind === 'pass' ? '<span class="c8__said">passed</span>' : ''}
      </div>

      <div class="c8__table">
        <button class="c8__deck" type="button" data-draw ${myTurn && !state.drew ? '' : 'disabled'} aria-label="Draw from the deck">
          <span class="pc pc--back c8__deck-card"></span>
          <span class="pc pc--back c8__deck-card"></span>
          <span class="pc pc--back c8__deck-card"></span>
          <span class="c8__deck-label">${state.pending ? `Draw ${state.pending}` : 'Draw'}<small>${state.deck.length} left</small></span>
        </button>

        <div class="c8__pile">
          ${under.map((c, i) => `<span class="pc pc--${red(suitOf(c)) ? 'red' : 'black'} pc--under" style="--rot:${tilt(c, i)}deg">${face(c)}</span>`).join('')}
          <span class="pc pc--${red(suitOf(t)) ? 'red' : 'black'} pc--top${enter}" style="--rot:${tilt(t, 9)}deg" aria-label="Top card: ${label(t)}" data-top="${state.moves}">${face(t)}</span>
        </div>

        <div class="c8__suit c8__suit--${red(state.suit) ? 'red' : 'black'}${rank(t) === R8 ? ' is-wild' : ''}" title="Suit to follow: ${SUIT_NAMES[state.suit]}">
          <span>${SUITS[state.suit]}</span><small>${rank(t) === R8 ? 'called' : 'follow'}</small>
        </div>
      </div>

      ${state.pending ? `<p class="c8__alert">+${state.pending} waiting — ${myTurn ? 'answer with a 2 or draw' : 'your rival must answer'}</p>` : ''}

      <div class="c8__hand" style="--n:${mine.length};--ov:${overlap}px">
        ${mine
          .map((c, i) => {
            const ok = myTurn && playable(state, c);
            return `<button class="pc pc--${red(suitOf(c)) ? 'red' : 'black'}${ok ? ' is-ok' : ''}${fresh.includes(c) ? ' is-new' : ''}${rank(c) === R8 ? ' is-wild' : ''}"
                            type="button" data-card="${c}" style="--i:${i}" ${ok ? '' : 'disabled'} aria-label="${label(c)}">${face(c)}</button>`;
          })
          .join('')}
      </div>

      ${myTurn && state.drew ? '<div class="c8__actions"><button class="btn btn--ghost btn--sm" type="button" data-pass>Keep it and pass</button></div>' : ''}

      <div class="c8__chooser" data-chooser hidden>
        <div class="c8__chooser-card">
          <p>Call the next suit</p>
          <div class="c8__suits">
            ${SUITS.map((s, k) => `<button type="button" class="c8__pick c8__pick--${red(k) ? 'red' : 'black'}" data-suit="${k}" style="--k:${k}" aria-label="${SUIT_NAMES[k]}">${s}</button>`).join('')}
          </div>
          <button class="btn btn--ghost btn--sm" type="button" data-unchoose>Cancel</button>
        </div>
      </div>
    </div>`;
}

export function bind(root, state, ctx, play) {
  const chooser = root.querySelector('[data-chooser]');
  let pending = null;

  root.querySelectorAll('[data-card]').forEach((b) =>
    b.addEventListener('click', () => {
      const c = Number(b.dataset.card);
      if (rank(c) === R8) {
        pending = c;
        chooser.hidden = false;
        chooser.querySelector('[data-suit]')?.focus();
        return;
      }
      b.classList.add('is-leaving');
      play({ play: c });
    })
  );
  root.querySelectorAll('[data-suit]').forEach((b) =>
    b.addEventListener('click', () => {
      if (pending == null) return;
      chooser.hidden = true;
      play({ play: pending, suit: Number(b.dataset.suit) });
    })
  );
  root.querySelector('[data-unchoose]')?.addEventListener('click', () => {
    pending = null;
    chooser.hidden = true;
  });
  root.querySelector('[data-draw]')?.addEventListener('click', () => play({ draw: true }));
  root.querySelector('[data-pass]')?.addEventListener('click', () => play({ pass: true }));
}

export function coach(state, ctx) {
  if (outcome(state).over) return 'Shuffle up and deal again?';
  if (!ctx.myTurn) return 'Your rival is choosing a card…';
  if (state.pending) return hand(state, ctx.seat).some((c) => rank(c) === R2) ? 'Stack a 2 to pass the penalty back — or take the cards.' : `No 2 in hand — draw ${state.pending}.`;
  if (state.drew) return 'Your new card fits — play it, or keep it and pass.';
  const any = hand(state, ctx.seat).some((c) => playable(state, c));
  return any ? `Follow ${SUIT_NAMES[state.suit].toLowerCase()} or match the ${RANKS[rank(top(state))]}. Eights are wild.` : 'Nothing fits — draw from the deck.';
}
