/**
 * LifeFlow Arcade — Game of the Goose (Jeu de l'oie).
 * Two dice, 63 squares, and a board full of geese, bridges, inns and wells.
 * Land exactly on 63 to win. Pure luck — perfect for a laugh together.
 */
import { esc, rand } from './kit.js';

const END = 63;
const GEESE = [5, 9, 14, 18, 23, 27, 32, 36, 41, 45, 50, 54, 59];
const SPECIAL = {
  0: { ico: '🏠', name: 'Start' },
  6: { ico: '🌉', name: 'Bridge — jump to 12' },
  19: { ico: '🏨', name: 'Inn — rest one turn' },
  26: { ico: '🎲', name: 'Lucky dice' },
  31: { ico: '🕳️', name: 'Well — stuck two turns' },
  42: { ico: '🌀', name: 'Maze — back to 30' },
  52: { ico: '⛓️', name: 'Prison — stuck three turns' },
  53: { ico: '🎲', name: 'Lucky dice' },
  58: { ico: '💀', name: 'Skull — back to the start' },
  63: { ico: '🏆', name: 'The garden — finish' }
};
const STEP = 170;
/** Squares switched off in the gentle variant. */
const HARSH = [31, 52, 58];
const active = (s, n) => !(s.hazards === 'gentle' && HARSH.includes(n));

export const meta = {
  id: 'goose',
  group: ['board', 'friends'],
  title: 'Game of the Goose',
  emoji: '🪿',
  tagline: 'Jeu de l\u2019oie — roll, fly, and mind the well.',
  blurb: 'The centuries-old family race. Geese fly you forward, bridges and mazes move you around, and the skull sends you home. First to land exactly on 63 wins.',
  minutes: '8 min',
  tags: ['Dice', 'Family classic'],
  alternate: true,
  levels: [],
  settings: [
    {
      id: 'hazards', label: 'Board', def: 'classic',
      options: [{ v: 'classic', label: 'Classic' }, { v: 'gentle', label: 'Gentle — no well, prison or skull' }]
    },
    {
      id: 'finish', label: 'Finish', def: 'exact',
      options: [{ v: 'exact', label: 'Exact roll (bounce back)' }, { v: 'relaxed', label: 'Any roll reaching 63' }]
    },
    {
      id: 'bump', label: 'Bumping', def: 1,
      options: [{ v: 1, label: 'On' }, { v: 0, label: 'Off' }]
    }
  ],
  rules: [
    'Roll two dice and move your pawn that many squares.',
    'Land on a goose 🪿 and you fly forward again by the same roll.',
    'Bridge 🌉 jumps to 12 · Inn 🏨 rests 1 turn · Well 🕳️ 2 turns · Prison ⛓️ 3 turns.',
    'Maze 🌀 sends you back to 30, the skull 💀 back to the start.',
    'A first throw of 6+3 flies to 26, 5+4 to 53.',
    'Land on your rival and they are bumped back to where you came from.',
    'You must hit 63 exactly — any extra steps bounce you back.',
    'Settings: a gentle board without the harsh squares, a relaxed finish, and bumping on or off.'
  ]
};

export function create(opts = {}) {
  return {
    gid: Math.random().toString(36).slice(2, 9), pos: [0, 0], skip: [0, 0], turn: 0, dice: [0, 0], last: null, log: [], moves: 0,
    hazards: opts.hazards === 'gentle' ? 'gentle' : 'classic',
    finish: opts.finish === 'relaxed' ? 'relaxed' : 'exact',
    bump: opts.bump === 0 ? 0 : 1
  };
}

export function turn(state) {
  return state.turn;
}

export function apply(state, move) {
  if (!move || !move.roll || outcome(state).over) return null;

  const p = state.turn;
  const d = [1 + rand(6), 1 + rand(6)];
  const sum = d[0] + d[1];
  const pos = state.pos.slice();
  const skip = state.skip.slice();
  const from = pos[p];
  const path = [];
  const events = [];
  let x = from;
  let bounced = false;

  const walk = (n) => {
    let dir = 1;
    for (let k = 0; k < n; k++) {
      if (x === END) {
        if (state.finish === 'relaxed') return;
        dir = -1; bounced = true;
      }
      x += dir;
      path.push(x);
    }
  };

  const hi = Math.max(d[0], d[1]);
  const lo = Math.min(d[0], d[1]);
  if (from === 0 && hi === 6 && lo === 3) {
    x = 26; path.push(26); events.push('🎲 6 + 3 on the first throw — fly to 26');
  } else if (from === 0 && hi === 5 && lo === 4) {
    x = 53; path.push(53); events.push('🎲 5 + 4 on the first throw — fly to 53');
  } else {
    walk(sum);
  }

  for (let guard = 0; guard < 12; guard++) {
    if (GEESE.includes(x)) {
      events.push(`🪿 Goose on ${x} — fly ${sum} more`);
      walk(sum);
      continue;
    }
    if (x === 6) { events.push('🌉 Bridge — over to 12'); x = 12; path.push(12); }
    else if (x === 42) { events.push('🌀 Lost in the maze — back to 30'); x = 30; path.push(30); }
    else if (x === 58 && active(state, 58)) { events.push('💀 The skull — back to the start'); x = 0; path.push(0); }
    else if (x === 19) { skip[p] = 1; events.push('🏨 The inn — rest one turn'); }
    else if (x === 31 && active(state, 31)) { skip[p] = 2; events.push('🕳️ Down the well — two turns'); }
    else if (x === 52 && active(state, 52)) { skip[p] = 3; events.push('⛓️ Prison — three turns'); }
    break;
  }
  if (bounced && x !== END) events.unshift('↩️ Overshot 63 — bounced back');

  let bump = -1;
  if (state.bump !== 0 && x !== 0 && x !== END && pos[1 - p] === x) {
    pos[1 - p] = from;
    bump = from;
    events.push(`💥 Bump! The other pawn goes back to ${from}`);
  }
  pos[p] = x;
  if (x === END) events.push('🏆 Into the garden!');

  let next = 1 - p;
  const skipped = [];
  if (x !== END) {
    for (let guard = 0; guard < 6 && skip[next] > 0; guard++) {
      skip[next] -= 1;
      skipped.push(next);
      next = 1 - next;
    }
  }

  const log = [{ seat: p, sum, ev: events.join(' · ') }, ...state.log].slice(0, 5);
  return {
    ...state,
    pos,
    skip,
    turn: next,
    dice: d,
    last: { seat: p, from, path, bump, skipped },
    log,
    moves: state.moves + 1
  };
}

export function outcome(state) {
  if (state.pos[0] === END) return { over: true, winner: 0, draw: false };
  if (state.pos[1] === END) return { over: true, winner: 1, draw: false };
  return { over: false };
}

export function auto() {
  return null;
}

/** Let the last pawn finish hopping before the computer rolls. */
export function pace(state) {
  return state.last ? state.last.path.length * STEP + 700 : 0;
}

export function ai() {
  return { roll: true };
}

export function note(state, seat) {
  const s = state.skip[seat];
  return `Square ${state.pos[seat]}${s ? ` · ⏳ ${s}` : ''}`;
}

/* ------------------------------ view ------------------------------ */
function cell(n) {
  const r = Math.floor(n / 8);
  const c = r % 2 === 0 ? n % 8 : 7 - (n % 8);
  return { c, r: 7 - r };
}

const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

function die(v, k) {
  const on = PIPS[v] || [];
  return `<span class="die" style="--k:${k}" aria-label="${v || '–'}">${Array.from({ length: 9 }, (_, i) => `<i class="${on.includes(i) ? 'is-on' : ''}"></i>`).join('')}</span>`;
}

function pawnStyle(n) {
  const { c, r } = cell(n);
  return `--c:${c};--r:${r}`;
}

export function view(state, ctx) {
  const cells = [];
  for (let n = 0; n <= END; n++) {
    const { c, r } = cell(n);
    const goose = GEESE.includes(n);
    const sp = active(state, n) ? SPECIAL[n] : null;
    const kind = goose ? 'is-goose' : sp ? `sp sp-${n}` : '';
    cells.push(`
      <div class="goose__cell ${kind}" style="grid-column:${c + 1};grid-row:${r + 1};--h:${Math.round((n / END) * 300)}" title="${esc(goose ? `${n} · Goose — fly again` : sp ? `${n} · ${sp.name}` : String(n))}">
        <span class="goose__n">${n || ''}</span>
        ${goose ? '<span class="goose__ico">🪿</span>' : sp ? `<span class="goose__ico">${sp.ico}</span>` : ''}
      </div>`);
  }

  const over = outcome(state).over;
  const canRoll = ctx.myTurn && !over;
  const n = (s) => ctx.names[s] || `Player ${s + 1}`;

  return `
    <div class="goose">
      <div class="goose__board">
        ${cells.join('')}
        ${[0, 1].map((s) => `<span class="goose__pawn goose__pawn--${s}" style="${pawnStyle(state.pos[s])}" aria-label="${esc(n(s))} on ${state.pos[s]}"><i></i></span>`).join('')}
      </div>

      <div class="goose__panel">
        <button class="goose__dice" type="button" data-roll ${canRoll ? '' : 'disabled'} aria-label="Roll the dice">
          ${die(state.dice[0], 0)}${die(state.dice[1], 1)}
          <span class="goose__roll">${over ? 'Finished' : canRoll ? (ctx.local ? `${esc(n(ctx.seat))}, roll!` : 'Roll the dice') : `${esc(n(state.turn))} to roll…`}</span>
        </button>
        <ol class="goose__log">
          ${state.log
            .map((l, i) => `<li class="goose__ev goose__ev--${l.seat}${i === 0 ? ' is-new' : ''}"><b>${esc(n(l.seat))}</b> rolled ${l.sum}${l.ev ? ` — ${esc(l.ev)}` : ''}</li>`)
            .join('') || '<li class="goose__ev t-mute">Roll to set off from home 🏠</li>'}
        </ol>
      </div>
    </div>`;
}

let animated = '';
let timers = [];

export function bind(root, state, ctx, play) {
  timers.forEach(clearTimeout);
  timers = [];

  const btn = root.querySelector('[data-roll]');
  btn?.addEventListener('click', () => {
    btn.classList.add('is-rolling');
    play({ roll: true });
  });

  const last = state.last;
  const key = `${state.gid}:${state.moves}`;
  if (!last || animated === key) return;
  animated = key;

  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

  root.querySelector('.goose__dice')?.classList.add('is-tumbling');
  const pawn = root.querySelector(`.goose__pawn--${last.seat}`);
  const rival = root.querySelector(`.goose__pawn--${1 - last.seat}`);
  if (!pawn) return;

  const finalMine = pawn.getAttribute('style');
  pawn.setAttribute('style', pawnStyle(last.from));
  pawn.classList.add('is-moving');
  let rivalFinal = null;
  if (last.bump >= 0 && rival) {
    rivalFinal = rival.getAttribute('style');
    rival.setAttribute('style', pawnStyle(last.path[last.path.length - 1]));
  }

  const lead = 520;
  last.path.forEach((sq, i) => {
    timers.push(
      setTimeout(() => {
        if (!pawn.isConnected) return;
        pawn.setAttribute('style', pawnStyle(sq));
        pawn.classList.remove('is-hop');
        void pawn.offsetWidth;
        pawn.classList.add('is-hop');
      }, lead + i * STEP)
    );
  });

  timers.push(
    setTimeout(() => {
      if (!pawn.isConnected) return;
      pawn.setAttribute('style', finalMine);
      pawn.classList.remove('is-moving');
      if (rival && rivalFinal) {
        rival.setAttribute('style', rivalFinal);
        rival.classList.add('is-bumped');
      }
    }, lead + last.path.length * STEP + 60)
  );
}

export function coach(state, ctx) {
  if (outcome(state).over) return 'What a race. Again?';
  const me = ctx.seat;
  if (ctx.myTurn) {
    const left = END - state.pos[me];
    if (left <= 12 && left > 0) return state.finish === 'relaxed' ? `${left} to go — any roll that reaches 63 wins.` : `You need exactly ${left} to reach the garden.`;
    return 'Tap the dice to roll.';
  }
  return state.skip[me] ? `You are resting for ${state.skip[me]} more turn${state.skip[me] > 1 ? 's' : ''}.` : 'Watch the other pawn go…';
}
