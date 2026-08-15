/**
 * LifeFlow — Breathing coach.
 *
 * A guided breath-pacer that can be mounted as a dashboard widget or opened
 * full-screen from the quick menu. Long exhales activate the parasympathetic
 * ("rest and digest") system, which is why every pattern here exhales longer
 * than it inhales.
 */
import { esc, haptic } from '../utils.js';
import { icon } from '../icons.js';
import { toast } from '../ui.js';

export const PATTERNS = [
  {
    id: '478',
    label: 'Unwind',
    ratio: '4-7-8',
    steps: [['in', 4], ['hold', 7], ['out', 8]],
    hint: 'A long, slow exhale quiets a racing mind. Beautiful before sleep.'
  },
  {
    id: 'box',
    label: 'Steady',
    ratio: '4-4-4-4',
    steps: [['in', 4], ['hold', 4], ['out', 4], ['hold', 4]],
    hint: 'Box breathing — what people use to steady their nerves under pressure.'
  },
  {
    id: 'reset',
    label: 'Reset',
    ratio: '4-6',
    steps: [['in', 4], ['out', 6]],
    hint: 'A quick reset between tasks. Just a few rounds is enough.'
  }
];

const PHASE_TEXT = { in: 'Breathe in', hold: 'Hold', out: 'Breathe out' };
const REST_TEXT = 'Sit comfortably. Follow the circle — nothing else to do.';

/**
 * Render a breathing coach into any container.
 * @returns {{stop: () => void, destroy: () => void}}
 */
export function mountBreathe(container, options = {}) {
  const { full = false, patternId = 'reset' } = options;
  let pattern = PATTERNS.find((p) => p.id === patternId) || PATTERNS[2];
  let stepIndex = 0;
  let rounds = 0;
  let running = false;
  let stepTimer = null;
  let tickTimer = null;

  container.innerHTML = `
    <div class="breathe is-idle" data-breathe>
      <div class="breathe__stage">
        <span class="breathe__orb"></span>
        <span class="breathe__inner">
          <span class="breathe__phase" data-phase>Ready</span>
          <span class="breathe__count" data-count>${pattern.steps[0][1]}</span>
        </span>
      </div>

      <p class="breathe__hint" data-hint>${esc(REST_TEXT)}</p>

      <div class="breathe__meta" data-patterns>
        ${PATTERNS.map(
          (p) => `<button class="chip${p.id === pattern.id ? ' chip--accent' : ''}" data-pattern="${p.id}"
                    type="button" aria-pressed="${p.id === pattern.id}">${esc(p.label)} · ${esc(p.ratio)}</button>`
        ).join('')}
      </div>

      <div class="breathe__actions">
        <button class="btn btn--primary" data-toggle type="button">${icon('play')} Start</button>
        ${full ? '' : `<button class="btn btn--soft btn--icon" data-expand type="button" aria-label="Full screen">${icon('maximize')}</button>`}
      </div>

      <span class="chip" data-rounds hidden>0 rounds</span>
    </div>`;

  const root = container.querySelector('[data-breathe]');
  const phaseEl = root.querySelector('[data-phase]');
  const countEl = root.querySelector('[data-count]');
  const hintEl = root.querySelector('[data-hint]');
  const toggleBtn = root.querySelector('[data-toggle]');
  const roundsEl = root.querySelector('[data-rounds]');

  function setPhase(kind, seconds) {
    root.className = `breathe is-${kind}`;
    root.style.setProperty('--phase', `${seconds * 1000}ms`);
    phaseEl.textContent = PHASE_TEXT[kind];
    countEl.textContent = seconds;
    haptic(kind === 'out' ? 14 : 8);
  }

  function runStep(index) {
    if (!root.isConnected) return stop(true);
    stepIndex = index;
    const [kind, seconds] = pattern.steps[index];
    setPhase(kind, seconds);

    let left = seconds;
    tickTimer = setInterval(() => {
      left -= 1;
      countEl.textContent = Math.max(left, 0);
    }, 1000);

    stepTimer = setTimeout(() => {
      clearInterval(tickTimer);
      const next = (index + 1) % pattern.steps.length;
      if (next === 0) {
        rounds += 1;
        roundsEl.hidden = false;
        roundsEl.textContent = `${rounds} round${rounds > 1 ? 's' : ''} · well done`;
      }
      runStep(next);
    }, seconds * 1000);
  }

  function start() {
    if (running) return;
    running = true;
    rounds = 0;
    roundsEl.hidden = true;
    toggleBtn.innerHTML = `${icon('pause')} Finish`;
    hintEl.textContent = pattern.hint;
    runStep(0);
  }

  function stop(silent = false) {
    clearTimeout(stepTimer);
    clearInterval(tickTimer);
    stepTimer = tickTimer = null;
    if (!running) return;
    running = false;
    root.className = 'breathe is-idle';
    phaseEl.textContent = 'Ready';
    countEl.textContent = pattern.steps[0][1];
    hintEl.textContent = REST_TEXT;
    toggleBtn.innerHTML = `${icon('play')} Start`;
    if (!silent && rounds) toast(`${rounds} calm round${rounds > 1 ? 's' : ''} — your body noticed 🌿`, 'success');
  }

  toggleBtn.addEventListener('click', () => (running ? stop() : start()));

  root.querySelectorAll('[data-pattern]').forEach((b) =>
    b.addEventListener('click', () => {
      pattern = PATTERNS.find((p) => p.id === b.dataset.pattern) || pattern;
      root.querySelectorAll('[data-pattern]').forEach((x) => {
        const on = x === b;
        x.classList.toggle('chip--accent', on);
        x.setAttribute('aria-pressed', String(on));
      });
      hintEl.textContent = running ? pattern.hint : REST_TEXT;
      if (running) {
        clearTimeout(stepTimer);
        clearInterval(tickTimer);
        runStep(0);
      } else {
        countEl.textContent = pattern.steps[0][1];
      }
    })
  );

  root.querySelector('[data-expand]')?.addEventListener('click', () => {
    stop(true);
    openBreathe(pattern.id);
  });

  return {
    stop: () => stop(true),
    destroy() {
      stop(true);
      container.innerHTML = '';
    }
  };
}

/** Full-screen breathing session — everything else fades away. */
export function openBreathe(patternId = '478') {
  document.querySelector('.breathe-full')?.remove();

  const overlay = document.createElement('div');
  overlay.className = 'breathe-full';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', 'Breathing exercise');
  overlay.innerHTML = `
    <button class="iconbtn breathe-full__close" data-close type="button" aria-label="Close">${icon('close')}</button>
    <div class="center">
      <span class="eyebrow">A moment for you</span>
      <h2 class="t-grad" style="font-family:var(--font-display)">Breathe</h2>
    </div>
    <div data-mount style="width:100%;display:grid;justify-items:center"></div>`;

  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  const session = mountBreathe(overlay.querySelector('[data-mount]'), { full: true, patternId });

  const close = () => {
    session.destroy();
    overlay.remove();
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };

  overlay.querySelector('[data-close]').addEventListener('click', close);
  document.addEventListener('keydown', onKey);
  return { close };
}
