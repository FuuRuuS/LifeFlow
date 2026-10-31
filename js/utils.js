/**
 * LifeFlow — shared helpers: DOM, dates, formatting, misc.
 */

/* ------------------------------ DOM ------------------------------ */
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function el(tag, attrs = {}, html = '') {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v == null) continue;
    if (k === 'class') node.className = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  if (html) node.innerHTML = html;
  return node;
}

/** Escape user content before injecting into innerHTML (XSS guard). */
export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Delegated event binding. */
export function on(root, event, selector, handler) {
  root.addEventListener(event, (e) => {
    const target = e.target.closest(selector);
    if (target && root.contains(target)) handler(e, target);
  });
}

export function debounce(fn, wait = 250) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

export function haptic(ms = 12) {
  try { navigator.vibrate?.(ms); } catch { /* ignore */ }
}

/* ------------------------------ IDs ------------------------------ */
export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/* ------------------------------ Dates ------------------------------ */
export const DAY_MS = 86400000;

/** YYYY-MM-DD in local time. */
export function ymd(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function fromYmd(s) {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function today() { return ymd(); }

export function addDays(date, n) {
  const d = date instanceof Date ? new Date(date) : fromYmd(date) || new Date();
  d.setDate(d.getDate() + n);
  return d;
}

export function startOfWeek(date = new Date(), startsMonday = true) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = startsMonday ? (day === 0 ? -6 : 1 - day) : -day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function isSameDay(a, b) { return ymd(a) === ymd(b); }

export function relativeDay(dateStr) {
  if (!dateStr) return '';
  const t = today();
  if (dateStr === t) return 'Today';
  if (dateStr === ymd(addDays(new Date(), 1))) return 'Tomorrow';
  if (dateStr === ymd(addDays(new Date(), -1))) return 'Yesterday';
  const d = fromYmd(dateStr);
  if (!d) return '';
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
}

export function isOverdue(dateStr) {
  return Boolean(dateStr) && dateStr < today();
}

export function fmtTime(hhmm) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h || 0, m || 0, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function monthLabel(date) {
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export function timeAgo(ms) {
  if (!ms) return '';
  const diff = Date.now() - ms;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Converts a Firestore Timestamp | number | Date into epoch millis. */
export function toMillis(v) {
  if (!v) return 0;
  if (typeof v === 'number') return v;
  if (v instanceof Date) return v.getTime();
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v.seconds === 'number') return v.seconds * 1000;
  return 0;
}

/* ------------------------------ Numbers ------------------------------ */
export function fmtMoney(amount, currency = 'USD', compact = false) {
  const n = Number(amount) || 0;
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: compact || Math.abs(n) >= 1000 ? 0 : 2,
      notation: compact && Math.abs(n) >= 10000 ? 'compact' : 'standard'
    }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}

export function fmtNum(n) {
  return new Intl.NumberFormat().format(Math.round(Number(n) || 0));
}

export const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
export const pct = (a, b) => (b > 0 ? clamp(Math.round((a / b) * 100), 0, 100) : 0);

/** Animate a number in a DOM element from 0 to target. */
export function countUp(node, target, { duration = 900, format = fmtNum } = {}) {
  if (!node) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    node.textContent = format(target);
    return;
  }
  const start = performance.now();
  const from = 0;
  const step = (now) => {
    const p = clamp((now - start) / duration, 0, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    node.textContent = format(from + (target - from) * eased);
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ------------------------------ Text ------------------------------ */
export function initials(name = '', email = '') {
  const src = (name || email || 'U').trim();
  const parts = src.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || 'U';
}

export function firstName(name = '', email = '') {
  if (name) return name.trim().split(/\s+/)[0];
  return (email.split('@')[0] || 'friend').replace(/[._-]+/g, ' ').split(' ')[0];
}

export function greeting(d = new Date()) {
  const h = d.getHours();
  if (h < 5) return 'Still up';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 22) return 'Good evening';
  return 'Good night';
}

export function pluralize(n, one, many) {
  return `${n} ${n === 1 ? one : many || `${one}s`}`;
}

/** Deterministic pick from an array based on a seed string/number. */
export function seededPick(arr, seed) {
  const s = String(seed);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return arr[h % arr.length];
}

/* ------------------------------ Misc ------------------------------ */
export function sortBy(arr, key, dir = 'asc') {
  const mul = dir === 'desc' ? -1 : 1;
  return [...arr].sort((a, b) => {
    const av = typeof key === 'function' ? key(a) : a[key];
    const bv = typeof key === 'function' ? key(b) : b[key];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    return av > bv ? mul : av < bv ? -mul : 0;
  });
}

export function groupBy(arr, keyFn) {
  return arr.reduce((acc, item) => {
    const k = keyFn(item);
    (acc[k] ||= []).push(item);
    return acc;
  }, {});
}

export function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export function downloadJSON(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
