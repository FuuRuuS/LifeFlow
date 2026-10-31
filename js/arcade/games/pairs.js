/**
 * LifeFlow Arcade — the shared engine behind the two-pick social games.
 * Each round one question, two hidden answers, then a reveal.
 *   mode 'match' — both answer for themselves; every match counts for the pair.
 *   mode 'guess' — one answers about themselves, the other guesses it.
 * state.turn is the player who answers first this round.
 */
import { esc, draw, catChips, bindCats, validCats, beads, burst } from './kit.js';

export function makePairGame(cfg) {
  const { bank, mode } = cfg;
  const ready = new Set();
  const cheered = new Set();
  const roundsOf = (state) => state.rounds || cfg.rounds;

  const item = (state) => bank[state.q.c].items[state.q.i];
  const options = (state) => cfg.options(item(state));

  function nextQ(state, cats) {
    const d = draw(bank, cats, state.used);
    return { q: { c: d.c, i: d.i }, used: d.used };
  }

  function create(opts = {}) {
    const cats = validCats(bank, opts.cats) ? opts.cats.slice() : cfg.cats.slice();
    const rounds = Number.isInteger(opts.rounds) && opts.rounds >= 3 && opts.rounds <= 50 ? opts.rounds : cfg.rounds;
    const base = { gid: Math.random().toString(36).slice(2, 9), round: 0, rounds, turn: 0, picks: [-1, -1], phase: 'pick', used: [], scores: [0, 0], hits: 0, cats, log: [], moves: 0 };
    return { ...base, ...nextQ(base, base.cats) };
  }

  function turn(state) {
    if (state.phase === 'reveal') return 1 - state.turn;
    return state.picks[state.turn] < 0 ? state.turn : 1 - state.turn;
  }

  const untouched = (state) => state.phase === 'pick' && state.picks[0] < 0 && state.picks[1] < 0;

  function apply(state, move) {
    if (!move || outcome(state).over) return null;

    if (move.cats !== undefined) {
      if (!untouched(state) || !validCats(bank, move.cats)) return null;
      return { ...state, cats: move.cats.slice(), ...nextQ(state, move.cats), moves: state.moves + 1 };
    }

    if (move.skipq) {
      if (!untouched(state)) return null;
      return { ...state, ...nextQ(state, state.cats), moves: state.moves + 1 };
    }

    if (move.pick !== undefined) {
      const k = move.pick;
      if (state.phase !== 'pick' || !Number.isInteger(k) || k < 0 || k >= options(state).length) return null;
      const seat = turn(state);
      const picks = state.picks.slice();
      picks[seat] = k;
      const next = { ...state, picks, moves: state.moves + 1 };
      if (picks[0] < 0 || picks[1] < 0) return next;

      const hit = picks[0] === picks[1];
      next.phase = 'reveal';
      if (mode === 'match') next.hits = state.hits + (hit ? 1 : 0);
      else if (hit) {
        next.scores = state.scores.slice();
        next.scores[1 - state.turn] += 1;
      }
      next.log = [{ q: state.q.c + ':' + state.q.i, first: state.turn, a: picks[state.turn], b: picks[1 - state.turn], hit }, ...state.log].slice(0, 5);
      return next;
    }

    if (move.next) {
      if (state.phase !== 'reveal') return null;
      const round = state.round + 1;
      const base = { ...state, round, turn: 1 - state.turn, picks: [-1, -1], phase: 'pick', moves: state.moves + 1 };
      return round < roundsOf(state) ? { ...base, ...nextQ(state, state.cats) } : base;
    }

    return null;
  }

  function outcome(state) {
    const rounds = roundsOf(state);
    if (state.round < rounds) return { over: false };
    if (mode === 'match') {
      return { over: true, winner: null, draw: true, coop: true, celebrate: state.hits >= Math.ceil(rounds * 0.6) };
    }
    const [a, b] = state.scores;
    if (a === b) return { over: true, winner: null, draw: true };
    return { over: true, winner: a > b ? 0 : 1, draw: false };
  }

  function note(state, seat) {
    if (mode === 'match') return `💞 ${state.hits} in sync`;
    return `${state.scores[seat]} guessed right`;
  }

  function summary(state) {
    const o = outcome(state);
    if (!o.over) return null;
    if (mode === 'match') return `${state.hits} of ${roundsOf(state)} in sync — ${cfg.verdict(state.hits, roundsOf(state))}`;
    return o.draw ? `${state.scores[0]} each — you know each other equally well.` : null;
  }

  /* ---------------------------- view ---------------------------- */
  function roles(state, ctx) {
    const first = state.turn;
    const n = (s) => ctx.names[s] || `Player ${s + 1}`;
    return { first, second: 1 - first, nFirst: n(first), nSecond: n(1 - first), n };
  }

  function view(state, ctx) {
    const over = outcome(state).over;
    const rounds = roundsOf(state);
    const r = roles(state, ctx);
    const key = `${state.gid}:${state.round}`;
    let stage;

    if (over) {
      stage = `
        <div class="pair__final">
          <span class="pair__final-ico" aria-hidden="true">${mode === 'match' ? '💞' : '🏆'}</span>
          <p class="pair__final-big">${mode === 'match' ? `${state.hits}<small>/${rounds}</small>` : `${state.scores[0]} · ${state.scores[1]}`}</p>
          <p class="t-dim">${esc(summary(state) || '')}</p>
        </div>`;
    } else if (state.phase === 'pick' && ctx.local && state.picks[r.first] >= 0 && !ready.has(key)) {
      stage = `
        <div class="pair__handoff">
          <span class="pair__lock" aria-hidden="true">🔒</span>
          <p><b>${esc(r.nFirst)}</b> has answered.</p>
          <p class="t-dim">Pass the phone to <b>${esc(r.nSecond)}</b> — no peeking!</p>
          <button class="btn btn--primary" type="button" data-ready>I'm ${esc(r.nSecond)} — show me</button>
        </div>`;
    } else {
      const picker = turn(state);
      const viewer = ctx.seat;
      const role = state.phase === 'reveal' ? 'reveal' : mode === 'guess' && picker !== r.first ? 'guesser' : 'self';
      const ask = cfg.ask(item(state), { role, subject: r.nFirst, mode });
      const opts = options(state);
      const mine = state.picks[viewer];
      const canPick = state.phase === 'pick' && ctx.myTurn && state.picks[ctx.local ? picker : viewer] < 0;

      let body;
      if (state.phase === 'reveal') {
        const hit = state.picks[0] === state.picks[1];
        const a = state.picks[r.first];
        const b = state.picks[r.second];
        const lab = mode === 'guess' ? ['answered', 'guessed'] : ['picked', 'picked'];
        body = `
          <div class="pair__reveal ${hit ? 'is-hit' : 'is-miss'}">
            <div class="pair__ans pair__ans--a"><span class="pair__who">${esc(r.nFirst)} ${lab[0]}</span><b>${esc(opts[a])}</b></div>
            <span class="pair__badge" aria-hidden="true">${hit ? (mode === 'match' ? '💞' : '🎯') : (mode === 'match' ? '✨' : '🙈')}</span>
            <div class="pair__ans pair__ans--b"><span class="pair__who">${esc(r.nSecond)} ${lab[1]}</span><b>${esc(opts[b])}</b></div>
          </div>
          <p class="pair__verdict">${hit ? cfg.hitLine(r) : cfg.missLine(r)}</p>
          ${
            ctx.myTurn
              ? `<button class="btn btn--primary pair__next" type="button" data-next>${state.round + 1 >= rounds ? 'See the result' : 'Next question'} →</button>`
              : `<p class="t-dim fs-sm">${esc(r.nSecond)} moves you on…</p>`
          }`;
      } else {
        body = `
          <div class="pair__opts pair__opts--n${opts.length}">
            ${opts
              .map(
                (o, k) => `${k === 1 && opts.length === 2 ? '<span class="pair__or" aria-hidden="true">or</span>' : ''}
                  <button class="pair__opt${mine === k && !ctx.local ? ' is-mine' : ''}" type="button" data-opt="${k}" style="--k:${k}" ${canPick ? '' : 'disabled'}>
                    <span class="pair__opt-k" aria-hidden="true">${'ABCD'[k]}</span><span>${esc(o)}</span>
                  </button>`
              )
              .join('')}
          </div>
          <p class="pair__who-picks">${
            canPick
              ? ctx.local
                ? `<b>${esc(r.n(picker))}</b>, ${role === 'guesser' ? `guess what ${esc(r.nFirst)} said` : 'your answer'}`
                : role === 'guesser' ? `Guess what ${esc(r.nFirst)} said` : 'Your answer'
              : !ctx.local && mine >= 0
              ? `🔒 Locked in. Waiting for ${esc(r.n(1 - viewer))}…`
              : `${esc(r.n(picker))} is choosing…`
          }</p>
          ${untouched(state) && ctx.myTurn ? `<button class="btn btn--ghost btn--sm" type="button" data-skipq>↻ Another question</button>` : ''}`;
      }

      stage = `
        <div class="pair__q" data-q="${state.q.c}:${state.q.i}">
          <span class="pair__eyebrow">${bank[state.q.c].emoji} ${esc(ask.eyebrow)}</span>
          ${ask.text ? `<h3 class="pair__text">${esc(ask.text)}</h3>` : ''}
        </div>
        ${body}`;
    }

    return `
      <div class="pair pair--${mode} pair--${state.phase}">
        ${catChips(bank, state.cats, !over && untouched(state) && ctx.myTurn)}
        ${beads(state.round, rounds, over ? -1 : state.round)}
        <div class="pair__stage">${stage}</div>
      </div>`;
  }

  function bind(root, state, ctx, play) {
    bindCats(root, state.cats, play);
    root.querySelectorAll('[data-opt]').forEach((b) => b.addEventListener('click', () => play({ pick: Number(b.dataset.opt) })));
    root.querySelector('[data-skipq]')?.addEventListener('click', () => play({ skipq: true }));
    root.querySelector('[data-next]')?.addEventListener('click', () => play({ next: true }));
    root.querySelector('[data-ready]')?.addEventListener('click', () => {
      ready.add(`${state.gid}:${state.round}`);
      ctx.refresh();
    });

    if (state.phase === 'reveal' && state.picks[0] === state.picks[1]) {
      const key = `${state.gid}:${state.round}`;
      if (!cheered.has(key)) {
        cheered.add(key);
        setTimeout(() => burst(root.querySelector('.pair__reveal'), mode === 'match' ? ['💞', '💗', '✨'] : ['🎯', '⭐', '✨']), 380);
      }
    }
  }

  function coach(state, ctx) {
    if (outcome(state).over) return mode === 'match' ? 'Play again — new questions every time.' : 'Swap roles and see who really pays attention.';
    const r = roles(state, ctx);
    if (state.phase === 'reveal') return state.picks[0] === state.picks[1] ? 'Same wavelength.' : 'Talk about it — that is half the fun.';
    if (mode === 'guess') return turn(state) === r.first ? `${r.nFirst} answers about themselves first.` : `Think like ${r.nFirst}.`;
    return 'Answer honestly. The other choice stays hidden until both are in.';
  }

  return { create, turn, apply, outcome, note, summary, view, bind, coach };
}
