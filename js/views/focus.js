/**
 * LifeFlow — Pomodoro / focus timer.
 * A single shared timer instance so it keeps running while you browse pages.
 */
import { el, esc } from '../utils.js';
import { icon } from '../icons.js';
import { ring, animateProgress, toast, confetti } from '../ui.js';
import * as store from '../store.js';

const timer = {
  mode: 'focus', // 'focus' | 'break'
  total: 25 * 60,
  left: 25 * 60,
  running: false,
  handle: null,
  completed: 0
};

const views = new Set();

function tick() {
  if (!timer.running) return;
  timer.left = Math.max(0, timer.left - 1);
  if (timer.left === 0) finish();
  paint();
}

function finish() {
  stop();
  if (timer.mode === 'focus') {
    timer.completed++;
    store.recordFocusSession().catch(() => {});
    confetti(22);
    toast('Focus session complete — take a breather ☕');
    setMode('break');
  } else {
    toast('Break over. Ready for another round? 🚀', 'info');
    setMode('focus');
  }
}

function start() {
  if (timer.running) return;
  timer.running = true;
  timer.handle = setInterval(tick, 1000);
  paint();
}

function stop() {
  timer.running = false;
  clearInterval(timer.handle);
  timer.handle = null;
  paint();
}

function reset() {
  stop();
  timer.left = timer.total;
  paint();
}

function setMode(mode) {
  const p = store.prefs();
  timer.mode = mode;
  timer.total = (mode === 'focus' ? p.focusMinutes || 25 : p.breakMinutes || 5) * 60;
  timer.left = timer.total;
  paint();
}

function mmss(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function paint() {
  views.forEach((node) => {
    if (!node.isConnected) { views.delete(node); return; }
    const progress = timer.total ? Math.round(((timer.total - timer.left) / timer.total) * 100) : 0;
    node.querySelector('[data-time]').firstChild.textContent = mmss(timer.left);
    node.querySelector('[data-mode]').textContent = timer.mode === 'focus' ? 'Focus' : 'Break';
    const r = node.querySelector('.ring');
    if (r) { r.dataset.ring = String(progress); animateProgress(node); }
    const play = node.querySelector('[data-play]');
    if (play) play.innerHTML = `${icon(timer.running ? 'pause' : 'play')}<span>${timer.running ? 'Pause' : 'Start'}</span>`;
    node.classList.toggle('is-running', timer.running);
    node.querySelector('[data-sessions]').textContent = String(timer.completed);
  });
}

/** Renders the focus widget into a container element. */
export function mountFocus(container) {
  if (!timer.handle && !timer.running && timer.left === timer.total) {
    const p = store.prefs();
    timer.total = (p.focusMinutes || 25) * 60;
    timer.left = timer.total;
  }

  const node = el('div', { class: `focus${timer.running ? ' is-running' : ''}` });
  node.innerHTML = `
    <div class="focus__ring">
      ${ring(0, { size: 168, stroke: 12, label: '' })}
      <div class="focus__time" data-time>${mmss(timer.left)}<small data-mode>${timer.mode === 'focus' ? 'Focus' : 'Break'}</small></div>
    </div>
    <div class="focus__controls">
      <button class="btn btn--primary" data-play type="button">${icon(timer.running ? 'pause' : 'play')}<span>${timer.running ? 'Pause' : 'Start'}</span></button>
      <button class="btn btn--ghost btn--icon" data-reset type="button" aria-label="Reset">${icon('reset')}</button>
      <button class="btn btn--ghost btn--icon" data-skip type="button" aria-label="Switch mode">${icon('refresh')}</button>
    </div>
    <p class="fs-xs t-mute center">Sessions today: <b data-sessions>${timer.completed}</b> · ${esc(
      `${Math.round(timer.total / 60)} min ${timer.mode}`
    )}</p>`;

  node.querySelector('[data-play]').addEventListener('click', () => (timer.running ? stop() : start()));
  node.querySelector('[data-reset]').addEventListener('click', reset);
  node.querySelector('[data-skip]').addEventListener('click', () => setMode(timer.mode === 'focus' ? 'break' : 'focus'));

  container.innerHTML = '';
  container.appendChild(node);
  views.add(node);
  paint();
  return node;
}

export const focusTimer = {
  isRunning: () => timer.running,
  start,
  stop,
  reset,
  setMode
};
