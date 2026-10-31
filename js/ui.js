/**
 * LifeFlow — UI kit: theme, toasts, modals, confirm dialogs, ripples,
 * confetti, progress rings, swipe gestures and drag-sorting.
 */
import { $, el, esc, haptic } from './utils.js';
import { icon } from './icons.js';
import { ACCENTS } from './config.js';
import { setFx } from './fx.js';

/* =========================================================
   Theme
   ========================================================= */
const THEME_KEY = 'lf:theme';
const THEMES = ['light', 'dark', 'auto'];
const darkMedia = window.matchMedia('(prefers-color-scheme: dark)');

const systemTheme = () => (darkMedia.matches ? 'dark' : 'light');

const accentOf = (id) => ACCENTS.find((a) => a.id === id) || ACCENTS[0];

/** "Dark luxe" and "Hacker" skins paint on their own dark canvas, whatever the preference. */
const skinForcesDark = () => Boolean(accentOf(document.documentElement.getAttribute('data-accent')).dark);

/** 'auto' resolves against the operating system; anything else is literal. */
const resolveTheme = (pref) =>
  skinForcesDark() ? 'dark' : pref === 'auto' ? systemTheme() : pref === 'dark' ? 'dark' : 'light';

/** The palette's own background colour, so browser chrome always matches. */
function bgOf(resolved) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(`--bg-${resolved}`).trim();
  return v || (resolved === 'dark' ? '#0e161b' : '#f4f7f8');
}

export const theme = {
  /** The theme actually on screen — always 'light' or 'dark'. */
  get() { return document.documentElement.getAttribute('data-theme') || 'light'; },

  /** What the user chose — may be 'auto'. */
  getPreference() {
    try {
      const stored = localStorage.getItem(THEME_KEY);
      return THEMES.includes(stored) ? stored : 'light';
    } catch {
      return 'light';
    }
  },

  isAuto() { return this.getPreference() === 'auto'; },

  /**
   * @param {'light'|'dark'|'auto'} next
   * @param {{x:number,y:number}} [origin] centre of the reveal animation
   * @returns {string} the stored preference
   */
  set(next, origin) {
    const pref = THEMES.includes(next) ? next : 'light';
    const resolved = resolveTheme(pref);
    const root = document.documentElement;

    if (origin && resolved !== this.get() && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const r = Math.hypot(innerWidth, innerHeight) * 1.2;
      const ripple = el('span', { class: 'theme-ripple' });
      ripple.style.cssText += `left:${origin.x}px;top:${origin.y}px;width:${r * 2}px;height:${r * 2}px;background:${bgOf(resolved)};`;
      document.body.appendChild(ripple);
      setTimeout(() => ripple.remove(), 640);
    }

    root.classList.add('theme-anim');
    root.setAttribute('data-theme', resolved);
    try { localStorage.setItem(THEME_KEY, pref); } catch { /* ignore */ }
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bgOf(resolved));
    setTimeout(() => root.classList.remove('theme-anim'), 500);
    return pref;
  },

  /** Flips between light and dark, stepping out of 'auto' if it was on. */
  toggle(origin) {
    return this.set(this.get() === 'dark' ? 'light' : 'dark', origin);
  },

  /**
   * Keeps an 'auto' preference in step with the OS. Safe to call more than once.
   */
  watchSystem() {
    const onChange = () => {
      if (!theme.isAuto()) return;
      const resolved = resolveTheme('auto');
      if (resolved === theme.get()) return;
      document.documentElement.setAttribute('data-theme', resolved);
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bgOf(resolved));
    };
    darkMedia.addEventListener?.('change', onChange);
    onChange();
  },

  /** True while the chosen theme ignores the light/dark preference. */
  isForcedDark() { return skinForcesDark(); },

  /** Re-applies the stored preference and syncs the browser chrome colour. */
  sync() {
    const pref = this.getPreference();
    const resolved = resolveTheme(pref);
    document.documentElement.setAttribute('data-theme', resolved);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bgOf(resolved));
    setFx(accentOf(this.getAccent()).fx);
    return pref;
  },

  setAccent(id) {
    const a = accentOf(id);
    const root = document.documentElement;
    root.classList.add('theme-anim');
    root.setAttribute('data-accent', a.id);
    root.setAttribute('data-skin', a.group || 'classic');
    try {
      localStorage.setItem('lf:accent', a.id);
      localStorage.setItem('lf:skin', a.group || 'classic');
    } catch { /* ignore */ }
    // Entering or leaving an always-dark skin may flip the canvas.
    const resolved = resolveTheme(this.getPreference());
    root.setAttribute('data-theme', resolved);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bgOf(resolved));
    setFx(a.fx);
    setTimeout(() => root.classList.remove('theme-anim'), 500);
  },

  getAccent() { return document.documentElement.getAttribute('data-accent') || 'violet'; },

  /** Calm mode: softer light, slower motion, kinder colours. */
  setCalm(on) {
    const root = document.documentElement;
    root.classList.add('theme-anim');
    root.setAttribute('data-calm', on ? 'on' : 'off');
    try { localStorage.setItem('lf:calm', on ? 'on' : 'off'); } catch { /* ignore */ }
    setFx(accentOf(this.getAccent()).fx);
    setTimeout(() => root.classList.remove('theme-anim'), 600);
    return on;
  },

  getCalm() { return document.documentElement.getAttribute('data-calm') === 'on'; },

  /** Comfort text size: 'md' | 'lg' | 'xl'. */
  setScale(size) {
    const next = ['md', 'lg', 'xl'].includes(size) ? size : 'md';
    document.documentElement.setAttribute('data-scale', next);
    try { localStorage.setItem('lf:scale', next); } catch { /* ignore */ }
    return next;
  },

  getScale() { return document.documentElement.getAttribute('data-scale') || 'md'; }
};

/* =========================================================
   Toasts
   ========================================================= */
const TOAST_ICONS = { success: 'checkCircle', error: 'alert', info: 'info' };

export function toast(message, type = 'success', ms = 3200) {
  const root = $('#toast-root');
  if (!root) return;
  const node = el(
    'div',
    { class: `toast toast--${type}` },
    `<span class="toast__icon">${icon(TOAST_ICONS[type] || 'info')}</span><span class="grow">${esc(message)}</span>`
  );
  root.appendChild(node);
  const close = () => {
    node.classList.add('is-out');
    setTimeout(() => node.remove(), 220);
  };
  const timer = setTimeout(close, ms);
  node.addEventListener('click', () => { clearTimeout(timer); close(); });
  if (root.children.length > 3) root.firstElementChild?.remove();
}

/* =========================================================
   Modal
   ========================================================= */
let openModals = 0;

/**
 * Opens a modal / bottom-sheet.
 * @returns {{close: Function, root: HTMLElement}}
 */
export function modal({ title = '', body = '', footer = '', size = '', onMount, dismissible = true } = {}) {
  const root = $('#modal-root');
  const scrim = el('div', { class: 'scrim' });
  const box = el('div', {
    class: `modal ${size}`,
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': title || 'Dialog'
  });

  box.innerHTML = `
    <div class="modal__head">
      <h2 class="modal__title">${esc(title)}</h2>
      <button class="iconbtn iconbtn--bare" data-close type="button" aria-label="Close">${icon('close')}</button>
    </div>
    <div class="modal__body"></div>
    ${footer ? `<div class="modal__foot">${footer}</div>` : ''}
  `;
  const bodyNode = box.querySelector('.modal__body');
  if (body instanceof Node) bodyNode.appendChild(body);
  else bodyNode.innerHTML = body;

  root.append(scrim, box);
  openModals++;
  document.body.style.overflow = 'hidden';

  const prevFocus = document.activeElement;
  let closed = false;

  const close = () => {
    if (closed) return;
    closed = true;
    box.classList.add('is-out');
    scrim.classList.add('is-out');
    setTimeout(() => {
      box.remove();
      scrim.remove();
      if (--openModals <= 0) { openModals = 0; document.body.style.overflow = ''; }
    }, 220);
    document.removeEventListener('keydown', onKey);
    prevFocus?.focus?.();
  };

  function onKey(e) {
    if (e.key === 'Escape' && dismissible) close();
    if (e.key === 'Tab') trapFocus(e, box);
  }

  box.querySelector('[data-close]')?.addEventListener('click', close);
  if (dismissible) scrim.addEventListener('click', close);
  document.addEventListener('keydown', onKey);
  box.querySelectorAll('[data-modal-close]').forEach((b) => b.addEventListener('click', close));

  setTimeout(() => {
    const focusable = box.querySelector('input,textarea,select,button:not([data-close])');
    focusable?.focus?.();
  }, 60);

  onMount?.(box, close);
  return { close, root: box };
}

function trapFocus(e, container) {
  const items = container.querySelectorAll(
    'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])'
  );
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

/** Promise-based confirm dialog. */
export function confirmDialog({ title = 'Are you sure?', message = '', confirmText = 'Confirm', danger = false } = {}) {
  return new Promise((resolve) => {
    let done = false;
    const m = modal({
      title,
      body: `<p class="t-dim fs-sm">${esc(message)}</p>`,
      footer: `
        <button class="btn btn--ghost" data-no type="button">Cancel</button>
        <button class="btn ${danger ? 'btn--danger' : 'btn--primary'}" data-yes type="button">${esc(confirmText)}</button>`,
      onMount(box, close) {
        box.querySelector('[data-no]').addEventListener('click', () => { done = true; close(); resolve(false); });
        box.querySelector('[data-yes]').addEventListener('click', () => { done = true; close(); resolve(true); });
      }
    });
    const obs = new MutationObserver(() => {
      if (!document.body.contains(m.root) && !done) { done = true; obs.disconnect(); resolve(false); }
    });
    obs.observe($('#modal-root'), { childList: true });
  });
}

/* =========================================================
   Ripple effect on buttons
   ========================================================= */
export function initRipples() {
  document.addEventListener('pointerdown', (e) => {
    const btn = e.target.closest('.btn, .navbtn, .quickmenu__item, .mood, .habit__check');
    if (!btn || btn.classList.contains('is-loading')) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const r = el('span', { class: 'ripple' });
    r.style.cssText += `width:${size}px;height:${size}px;left:${e.clientX - rect.left - size / 2}px;top:${
      e.clientY - rect.top - size / 2
    }px;`;
    if (getComputedStyle(btn).position === 'static') btn.style.position = 'relative';
    btn.appendChild(r);
    setTimeout(() => r.remove(), 620);
  });
}

/* =========================================================
   Confetti
   ========================================================= */
export function confetti(count = 34) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const wrap = el('div', { class: 'confetti' });
  const colors = ['#7c6cff', '#35d6ff', '#ff7ac6', '#2fd39b', '#ffb547'];
  for (let i = 0; i < count; i++) {
    const p = el('i');
    p.style.cssText += `left:${Math.random() * 100}vw;background:${colors[i % colors.length]};--dx:${
      (Math.random() - 0.5) * 240
    }px;--dur:${1.8 + Math.random() * 1.6}s;animation-delay:${Math.random() * 0.35}s;`;
    wrap.appendChild(p);
  }
  document.body.appendChild(wrap);
  setTimeout(() => wrap.remove(), 4200);
  haptic(30);
}

/* =========================================================
   SVG helpers
   ========================================================= */
/** Shared gradient defs used by rings/areas — injected once. */
export function svgDefs() {
  return `
    <svg width="0" height="0" style="position:absolute" aria-hidden="true">
      <defs>
        <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="var(--accent)"/>
          <stop offset="60%" stop-color="var(--accent-2)"/>
          <stop offset="100%" stop-color="var(--accent-3)"/>
        </linearGradient>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--accent)" stop-opacity=".45"/>
          <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
        </linearGradient>
      </defs>
    </svg>`;
}

/**
 * Progress ring markup. Animate by calling animateRings(container).
 */
export function ring(value, { size = 108, stroke = 10, label = '', caption = '' } = {}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return `
    <div class="ring" data-ring="${value}" data-circ="${c.toFixed(2)}">
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <circle class="ring__track" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}" fill="none"/>
        <circle class="ring__value" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}" fill="none"
                stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${c.toFixed(2)}"/>
      </svg>
      <div class="ring__label">
        <span class="ring__num">${label !== '' ? esc(label) : `${value}%`}</span>
        ${caption ? `<span class="ring__cap">${esc(caption)}</span>` : ''}
      </div>
    </div>`;
}

/** Kick off ring + bar animations inside a container. */
export function animateProgress(root = document) {
  requestAnimationFrame(() => {
    root.querySelectorAll('.ring[data-ring]').forEach((node) => {
      const circle = node.querySelector('.ring__value');
      const circ = Number(node.dataset.circ);
      const val = Math.max(0, Math.min(100, Number(node.dataset.ring)));
      if (circle) circle.style.strokeDashoffset = String(circ - (circ * val) / 100);
    });
    root.querySelectorAll('.bar__fill[data-val]').forEach((node) => {
      node.style.width = `${Math.max(0, Math.min(100, Number(node.dataset.val)))}%`;
    });
    root.querySelectorAll('.chart-bars i[data-h]').forEach((node) => {
      node.style.height = `${Math.max(3, Math.min(100, Number(node.dataset.h)))}%`;
    });
  });
}

/** Builds an SVG area+line sparkline from an array of numbers. */
export function sparkline(values, { height = 90 } = {}) {
  const pts = values.length ? values : [0];
  const w = 300;
  const max = Math.max(...pts, 1);
  const min = Math.min(...pts, 0);
  const span = max - min || 1;
  const step = pts.length > 1 ? w / (pts.length - 1) : w;
  const coords = pts.map((v, i) => [i * step, height - ((v - min) / span) * (height - 12) - 6]);
  const line = coords.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${w},${height} L0,${height} Z`;
  return `
    <svg class="spark" viewBox="0 0 ${w} ${height}" preserveAspectRatio="none">
      <path class="area" d="${area}"/>
      <path class="line" d="${line}" vector-effect="non-scaling-stroke"/>
    </svg>`;
}

/* =========================================================
   Swipe-to-action (mobile cards)
   ========================================================= */
/**
 * Makes `.swipe` elements draggable horizontally with left/right actions.
 * @param {HTMLElement} root container
 * @param {{onLeft:Function,onRight:Function}} handlers  (right = swipe right)
 */
export function initSwipe(root, { onRight, onLeft } = {}) {
  root.querySelectorAll('.swipe').forEach((card) => {
    if (card.dataset.swipeBound) return;
    card.dataset.swipeBound = '1';
    const content = card.querySelector('.swipe__content');
    if (!content) return;

    let startX = 0;
    let startY = 0;
    let dx = 0;
    let active = false;
    let decided = false;

    const reset = () => {
      card.classList.remove('is-dragging');
      content.style.transform = '';
      dx = 0;
      active = false;
      decided = false;
    };

    content.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return; // touch/pen only
      startX = e.clientX;
      startY = e.clientY;
      active = true;
      decided = false;
    });

    content.addEventListener('pointermove', (e) => {
      if (!active) return;
      const mx = e.clientX - startX;
      const my = e.clientY - startY;
      if (!decided) {
        if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
        if (Math.abs(my) > Math.abs(mx)) { active = false; return; }
        decided = true;
        card.classList.add('is-dragging');
        content.setPointerCapture?.(e.pointerId);
      }
      dx = Math.max(-160, Math.min(160, mx));
      content.style.transform = `translateX(${dx}px)`;
    });

    const finish = () => {
      if (!active) return reset();
      const threshold = 88;
      if (dx > threshold && onRight) { haptic(18); onRight(card.dataset.id, card); }
      else if (dx < -threshold && onLeft) { haptic(18); onLeft(card.dataset.id, card); }
      reset();
    };

    content.addEventListener('pointerup', finish);
    content.addEventListener('pointercancel', reset);
    content.addEventListener('pointerleave', () => { if (active && !decided) reset(); });
  });
}

/* =========================================================
   Drag & drop sorting (pointer based: works on touch + mouse)
   ========================================================= */
/**
 * @param {HTMLElement} list container whose direct children are sortable
 * @param {(orderedIds:string[])=>void} onSort
 * @param {string} handleSel selector for the drag handle
 */
export function initSortable(list, onSort, handleSel = '[data-handle]') {
  if (!list || list.dataset.sortableBound) return;
  list.dataset.sortableBound = '1';

  let dragging = null;
  let placeholder = null;
  let offsetY = 0;
  let startRect = null;

  const items = () => Array.from(list.children).filter((c) => c !== placeholder && c !== dragging);

  list.addEventListener('pointerdown', (e) => {
    const handle = e.target.closest(handleSel);
    if (!handle || !list.contains(handle)) return;
    const item = handle.closest('[data-id]');
    if (!item || item.parentElement !== list) return;

    e.preventDefault();
    dragging = item;
    startRect = item.getBoundingClientRect();
    offsetY = e.clientY - startRect.top;

    placeholder = el('div');
    placeholder.style.cssText = `height:${startRect.height}px;border-radius:18px;border:2px dashed var(--stroke-strong);margin:0;`;
    item.after(placeholder);

    item.classList.add('is-ghost');
    item.style.cssText += `position:fixed;z-index:999;width:${startRect.width}px;left:${startRect.left}px;top:${
      startRect.top
    }px;pointer-events:none;`;
    handle.setPointerCapture?.(e.pointerId);
    haptic(10);

    const move = (ev) => {
      if (!dragging) return;
      dragging.style.top = `${ev.clientY - offsetY}px`;
      const midY = ev.clientY;
      const after = items().find((c) => {
        const r = c.getBoundingClientRect();
        return midY < r.top + r.height / 2;
      });
      if (after) list.insertBefore(placeholder, after);
      else list.appendChild(placeholder);
    };

    const up = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      if (!dragging) return;
      dragging.classList.remove('is-ghost');
      dragging.style.cssText = '';
      placeholder.replaceWith(dragging);
      placeholder = null;
      dragging = null;
      const ids = Array.from(list.children).map((c) => c.dataset.id).filter(Boolean);
      onSort?.(ids);
    };

    document.addEventListener('pointermove', move, { passive: true });
    document.addEventListener('pointerup', up);
  });
}

/* =========================================================
   Rail dots (swipeable sections)
   ========================================================= */
export function initRailDots(rail, dots) {
  if (!rail || !dots) return;
  const update = () => {
    const idx = Math.round(rail.scrollLeft / (rail.scrollWidth / rail.children.length));
    Array.from(dots.children).forEach((d, i) => d.classList.toggle('is-on', i === idx));
  };
  rail.addEventListener('scroll', update, { passive: true });
  update();
}

/* =========================================================
   Button loading helper
   ========================================================= */
export function withLoading(btn, promise) {
  btn.classList.add('is-loading');
  return Promise.resolve(promise).finally(() => btn.classList.remove('is-loading'));
}
