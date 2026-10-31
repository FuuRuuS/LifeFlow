/*
 * LifeFlow — GENERATED FILE, DO NOT EDIT.
 * Built by tools/build-standalone.js from js/app.js so the app runs from file://.
 * Edit the sources under js/ and re-run: node tools/build-standalone.js
 */
(async function () {
  'use strict';
  const __ext = await Promise.all([
    "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js",
    "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js",
    "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js",
    "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js"
  ].map((url) => import(url)));

  /* ===== js/utils.js ===== */
  const __m1 = (function () {

/**
 * LifeFlow — shared helpers: DOM, dates, formatting, misc.
 */

/* ------------------------------ DOM ------------------------------ */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function el(tag, attrs = {}, html = '') {
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
function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Delegated event binding. */
function on(root, event, selector, handler) {
  root.addEventListener(event, (e) => {
    const target = e.target.closest(selector);
    if (target && root.contains(target)) handler(e, target);
  });
}

function debounce(fn, wait = 250) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

function haptic(ms = 12) {
  try { navigator.vibrate?.(ms); } catch { /* ignore */ }
}

/* ------------------------------ IDs ------------------------------ */
function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/* ------------------------------ Dates ------------------------------ */
const DAY_MS = 86400000;

/** YYYY-MM-DD in local time. */
function ymd(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function fromYmd(s) {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function today() { return ymd(); }

function addDays(date, n) {
  const d = date instanceof Date ? new Date(date) : fromYmd(date) || new Date();
  d.setDate(d.getDate() + n);
  return d;
}

function startOfWeek(date = new Date(), startsMonday = true) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = startsMonday ? (day === 0 ? -6 : 1 - day) : -day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isSameDay(a, b) { return ymd(a) === ymd(b); }

function relativeDay(dateStr) {
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

function isOverdue(dateStr) {
  return Boolean(dateStr) && dateStr < today();
}

function fmtTime(hhmm) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h || 0, m || 0, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function monthLabel(date) {
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function timeAgo(ms) {
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
function toMillis(v) {
  if (!v) return 0;
  if (typeof v === 'number') return v;
  if (v instanceof Date) return v.getTime();
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v.seconds === 'number') return v.seconds * 1000;
  return 0;
}

/* ------------------------------ Numbers ------------------------------ */
function fmtMoney(amount, currency = 'USD', compact = false) {
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

function fmtNum(n) {
  return new Intl.NumberFormat().format(Math.round(Number(n) || 0));
}

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const pct = (a, b) => (b > 0 ? clamp(Math.round((a / b) * 100), 0, 100) : 0);

/** Animate a number in a DOM element from 0 to target. */
function countUp(node, target, { duration = 900, format = fmtNum } = {}) {
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
function initials(name = '', email = '') {
  const src = (name || email || 'U').trim();
  const parts = src.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || 'U';
}

function firstName(name = '', email = '') {
  if (name) return name.trim().split(/\s+/)[0];
  return (email.split('@')[0] || 'friend').replace(/[._-]+/g, ' ').split(' ')[0];
}

function greeting(d = new Date()) {
  const h = d.getHours();
  if (h < 5) return 'Still up';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 22) return 'Good evening';
  return 'Good night';
}

function pluralize(n, one, many) {
  return `${n} ${n === 1 ? one : many || `${one}s`}`;
}

/** Deterministic pick from an array based on a seed string/number. */
function seededPick(arr, seed) {
  const s = String(seed);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return arr[h % arr.length];
}

/* ------------------------------ Misc ------------------------------ */
function sortBy(arr, key, dir = 'asc') {
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

function groupBy(arr, keyFn) {
  return arr.reduce((acc, item) => {
    const k = keyFn(item);
    (acc[k] ||= []).push(item);
    return acc;
  }, {});
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function downloadJSON(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
return Object.freeze({ $, $$, el, esc, on, debounce, haptic, uid, DAY_MS, ymd, fromYmd, today, addDays, startOfWeek, isSameDay, relativeDay, isOverdue, fmtTime, monthLabel, timeAgo, toMillis, fmtMoney, fmtNum, clamp, pct, countUp, initials, firstName, greeting, pluralize, seededPick, sortBy, groupBy, readFileAsDataURL, downloadJSON });
  })();

  /* ===== js/icons.js ===== */
  const __m3 = (function () {

/**
 * LifeFlow — inline SVG icon set (24x24, stroke based).
 * Usage: icon('check', 'some-class')
 */

const P = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.8V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.8"/>',
  check: '<path d="m4.5 12.5 5 5 10-11"/>',
  checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8.5 12.2 2.4 2.4 4.6-5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  chevronLeft: '<path d="m15 5-7 7 7 7"/>',
  chevronRight: '<path d="m9 5 7 7-7 7"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  arrowRight: '<path d="M4 12h15M13 6l6 6-6 6"/>',
  arrowUp: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  arrowDown: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  tasks: '<rect x="3" y="4" width="18" height="17" rx="3"/><path d="m8 11 2.2 2.2L16 8M8 17h6"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  wallet: '<path d="M3 8a3 3 0 0 1 3-3h11a2 2 0 0 1 2 2v2"/><rect x="3" y="7" width="18" height="13" rx="3"/><circle cx="16.5" cy="13.5" r="1.4"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.6"/><circle cx="12" cy="12" r="1.2"/>',
  note: '<path d="M5 4.8A2 2 0 0 1 7 3h7l5 5v11.2a2 2 0 0 1-2 1.8H7a2 2 0 0 1-2-1.8Z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
  flame: '<path d="M12 3c.6 3.2 2.4 4 3.8 5.7A6.8 6.8 0 0 1 17.5 13a5.5 5.5 0 0 1-11 0c0-1.5.6-2.9 1.6-4 .3 1 .9 1.7 1.7 2 .2-3 1-5.6 2.2-8Z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 14.5a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.9 2.9l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.2a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.9.4l-.1.1a2 2 0 1 1-2.9-2.9l.1-.1a1.7 1.7 0 0 0-1.2-2.9h-.2a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.6-1.1 1.7 1.7 0 0 0-.4-1.9l-.1-.1a2 2 0 1 1 2.9-2.9l.1.1a1.7 1.7 0 0 0 1.9.3h.1A1.7 1.7 0 0 0 10 3.5v-.2a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.4l.1-.1a2 2 0 1 1 2.9 2.9l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.6 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
  sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>',
  moon: '<path d="M20 14.2A8.2 8.2 0 0 1 9.8 4 8.4 8.4 0 1 0 20 14.2Z"/>',
  bell: '<path d="M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6"/><path d="M13.7 20a2 2 0 0 1-3.4 0"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/>',
  filter: '<path d="M4 5h16l-6.4 7.6V19l-3.2 2v-8.4Z"/>',
  trash: '<path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M10 11v6M14 11v6"/>',
  edit: '<path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z"/><path d="m14.5 6.5 3 3"/>',
  logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 8 6 12l4 4M6 12h10"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7.5 7.1 5a1.6 1.6 0 0 0 1.8 0l7.1-5"/>',
  lock: '<rect x="4.5" y="10" width="15" height="11" rx="3"/><path d="M8 10V7.5a4 4 0 0 1 8 0V10"/><circle cx="12" cy="15.5" r="1.3"/>',
  eye: '<path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M10.6 6.1A9.6 9.6 0 0 1 12 6c6 0 9.5 6 9.5 6a17 17 0 0 1-3.2 3.9M6.5 7.9A16.4 16.4 0 0 0 2.5 12s3.5 6 9.5 6a9.3 9.3 0 0 0 3.7-.75"/><path d="m3 3 18 18M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  sparkles: '<path d="M12 3.5 13.6 8 18 9.6 13.6 11.2 12 15.7 10.4 11.2 6 9.6 10.4 8Z"/><path d="M18.5 15.5l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7ZM5 14l.6 1.5L7 16.2l-1.4.6L5 18.3l-.6-1.5-1.4-.6 1.4-.6Z"/>',
  clock: '<circle cx="12" cy="12" r="8.6"/><path d="M12 7.4V12l3 1.8"/>',
  play: '<path d="M8 5.5 18.5 12 8 18.5Z"/>',
  pause: '<path d="M9 5v14M15 5v14"/>',
  reset: '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4 4v4h4"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  trending: '<path d="m3 16 5.5-5.5 3.5 3.5L21 5"/><path d="M15 5h6v6"/>',
  grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>',
  drag: '<circle cx="9" cy="6" r="1.4"/><circle cx="15" cy="6" r="1.4"/><circle cx="9" cy="12" r="1.4"/><circle cx="15" cy="12" r="1.4"/><circle cx="9" cy="18" r="1.4"/><circle cx="15" cy="18" r="1.4"/>',
  more: '<circle cx="6" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="18" cy="12" r="1.5"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="3"/><path d="M9 7V5.5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5.5V7M3 12.5h18"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-9.4A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 3c0 4.8-7.5 9.4-7.5 9.4Z"/>',
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5Z"/><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H19v3H6.5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.8v.4"/>',
  alert: '<path d="M12 4.5 21 19.5H3Z"/><path d="M12 10v4M12 16.8v.3"/>',
  quote: '<path d="M9.5 6C6.5 7.4 5 9.9 5 13.5V18h5.5v-5.5H8c0-2 .6-3.4 2.4-4.4Zm9 0C15.5 7.4 14 9.9 14 13.5V18h5.5v-5.5H17c0-2 .6-3.4 2.4-4.4Z"/>',
  camera: '<path d="M4 8.5h3l1.5-2.2h7L17 8.5h3a1 1 0 0 1 1 1V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9.5a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13.5" r="3.4"/>',
  shield: '<path d="M12 3 20 6v6c0 4.6-3.3 7.6-8 9-4.7-1.4-8-4.4-8-9V6Z"/><path d="m9 12 2 2 4-4"/>',
  download: '<path d="M12 4v10M8 11l4 4 4-4"/><path d="M5 19h14"/>',
  layers: '<path d="m12 3 9 4.7-9 4.7-9-4.7Z"/><path d="m3.6 12.3 8.4 4.4 8.4-4.4M3.6 16.6 12 21l8.4-4.4"/>',
  water: '<path d="M12 3.5c3.5 4.2 6 7 6 10a6 6 0 0 1-12 0c0-3 2.5-5.8 6-10Z"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.2 8.8-1.6 4.6-4.6 1.6 1.6-4.6Z"/>',
  star: '<path d="m12 4 2.5 5.2 5.5.8-4 3.9 1 5.6-5-2.7-5 2.7 1-5.6-4-3.9 5.5-.8Z"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14-4.5L4 9"/><path d="M4 5v4h4"/><path d="M4 13a8 8 0 0 0 14 4.5L20 15"/><path d="M20 19v-4h-4"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  maximize: '<path d="M9 3.5H5.5A2 2 0 0 0 3.5 5.5V9M15 3.5h3.5a2 2 0 0 1 2 2V9M9 20.5H5.5a2 2 0 0 1-2-2V15M15 20.5h3.5a2 2 0 0 0 2-2V15"/>',
  leaf: '<path d="M20 4c0 9-5.2 13.5-11 13.5A5 5 0 0 1 4 12.5C4 6.8 9.6 4 20 4Z"/><path d="M4 20c2.4-4.6 6-7.6 11-9.5"/>',
  smile: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.2a4.4 4.4 0 0 0 7 0M9 9.5v.4M15 9.5v.4"/>',
  mosque: '<path d="M12 2.6c2.3 1.9 3.5 3.4 3.5 4.9 0 1.1-.7 2-1.9 2.5h-3.2C9.2 9.5 8.5 8.6 8.5 7.5c0-1.5 1.2-3 3.5-4.9Z"/><path d="M5 21v-8.2a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2V21"/><path d="M2.5 21h19M10 21v-2.6a2 2 0 0 1 4 0V21M4 10.8V7.6M20 10.8V7.6"/>',
  archive: '<rect x="3" y="3.8" width="18" height="4.6" rx="1.7"/><path d="M5 8.4V19a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.4"/><path d="M9.8 12h4.4"/>',
  cart: '<path d="M2.8 3.5h2.1a1 1 0 0 1 1 .8L6.4 7m0 0 1.5 7.3a2 2 0 0 0 2 1.6h7.3a2 2 0 0 0 2-1.6L20.6 7Z"/><circle cx="10" cy="20" r="1.4"/><circle cx="17.5" cy="20" r="1.4"/>',
  gamepad: '<path d="M8.5 7.5h7a5.5 5.5 0 0 1 5.4 4.5l.7 4a3 3 0 0 1-5.4 2.3l-1.3-1.8H9.1l-1.3 1.8A3 3 0 0 1 2.4 16l.7-4a5.5 5.5 0 0 1 5.4-4.5Z"/><path d="M7 11.2v2.6M5.7 12.5h2.6"/><circle cx="15.8" cy="11.8" r="1"/><circle cx="17.8" cy="14" r="1"/>',
  cameraOff: '<path d="M3 3l18 18"/><path d="M9.6 6.3 10.5 5h3l1.5 2.2h3a1 1 0 0 1 1 1V16m-1.6 3.6H5a2 2 0 0 1-2-2V9.2a1 1 0 0 1 1-1h1.6"/><path d="M14.3 14.6a3.4 3.4 0 0 1-4.7-4.7"/>',
  mic: '<rect x="9" y="2.8" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3.2M8.8 21.2h6.4"/>',
  micOff: '<path d="M3 3l18 18"/><path d="M15 5.8a3 3 0 0 0-6 0v5m1.2 3.1A3 3 0 0 0 15 11.9v-1"/><path d="M5.5 11.5a6.5 6.5 0 0 0 9.9 5.6M18.5 11.5v.4M12 18v3.2M8.8 21.2h6.4"/>',
  link: '<path d="M10.2 13.8a4 4 0 0 0 5.7 0l3-3a4 4 0 1 0-5.7-5.7l-1.3 1.3"/><path d="M13.8 10.2a4 4 0 0 0-5.7 0l-3 3a4 4 0 1 0 5.7 5.7l1.3-1.3"/>',
  users: '<circle cx="9" cy="8" r="3.6"/><path d="M2.8 20.2a6.2 6.2 0 0 1 12.4 0"/><path d="M16.2 4.8a3.6 3.6 0 0 1 0 6.9M17.4 14.6a6.2 6.2 0 0 1 3.8 5.6"/>',
  bot: '<rect x="3.5" y="7.5" width="17" height="12" rx="3.5"/><path d="M12 3.2v4.3M1.8 12.5v3M22.2 12.5v3"/><circle cx="8.8" cy="12.8" r="1.2"/><circle cx="15.2" cy="12.8" r="1.2"/><path d="M9.6 16.4h4.8"/>',
  quran: '<path d="M12 6.5C10 5 7.2 4.5 3.5 4.8v12.4c3.7-.3 6.5.2 8.5 1.7 2-1.5 4.8-2 8.5-1.7V4.8C16.8 4.5 14 5 12 6.5Z"/><path d="M12 6.5v12.4M5 21h14M8 18.2 5 21M16 18.2l3 2.8"/>',
  skipBack: '<path d="M18 6 9.5 12 18 18Z"/><path d="M6 5.5v13"/>',
  skipForward: '<path d="m6 6 8.5 6L6 18Z"/><path d="M18 5.5v13"/>',
  repeat: '<path d="M17 3.5 20 6.5l-3 3"/><path d="M4 11.5v-1a4 4 0 0 1 4-4h12M7 20.5l-3-3 3-3"/><path d="M20 12.5v1a4 4 0 0 1-4 4H4"/>',
  bookmark: '<path d="M6.5 3.5h11a1 1 0 0 1 1 1V21l-6.5-4.2L5.5 21V4.5a1 1 0 0 1 1-1Z"/>',
  copy: '<rect x="8.5" y="8.5" width="12" height="12" rx="2.5"/><path d="M15.5 8.5V6a2.5 2.5 0 0 0-2.5-2.5H6A2.5 2.5 0 0 0 3.5 6v7A2.5 2.5 0 0 0 6 15.5h2.5"/>',
  send: '<path d="M21 3 10.2 13.8M21 3l-6.8 18-4-7.2L3 9.8Z"/>',
  chat: '<path d="M20.5 12a8 8 0 0 1-11.6 7.1L3.5 20.5l1.4-4.9A8 8 0 1 1 20.5 12Z"/><path d="M8.5 11h7M8.5 14.5h4.5"/>',
  volume: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4Z"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18.2 6.5a8 8 0 0 1 0 11"/>'
};

function icon(name, cls = '') {
  const body = P[name] || P.info;
  return `<svg viewBox="0 0 24 24" class="${cls}" aria-hidden="true">${body}</svg>`;
}

const ICON_NAMES = Object.keys(P);
return Object.freeze({ icon, ICON_NAMES });
  })();

  /* ===== js/config.js ===== */
  const __m4 = (function () {

/**
 * LifeFlow — Firebase configuration & app constants.
 *
 * NOTE: Firebase web API keys are public identifiers, not secrets. Real security
 * comes from Firestore/Storage security rules (see firestore.rules / storage.rules)
 * and from enabling only the auth providers you need in the Firebase console.
 */

const firebaseConfig = {
  apiKey: 'AIzaSyA4T0B3yrWMBtJ8t5W1UKiJ1m2oH4A0DA4',
  authDomain: 'planner-project-7ab9e.firebaseapp.com',
  projectId: 'planner-project-7ab9e',
  storageBucket: 'planner-project-7ab9e.firebasestorage.app',
  messagingSenderId: '888269215926',
  appId: '1:888269215926:web:61cee048986cffe7622e17',
  measurementId: 'G-YSXGXFHD3N'
};

/** Enable Firebase Analytics (only works on http/https origins). */
const ENABLE_ANALYTICS = true;

/**
 * Google Calendar sync.
 *
 * `clientId` comes from Google Cloud Console → APIs & Services → Credentials →
 * "OAuth 2.0 Client ID" of type **Web application**, with your app origin listed
 * under "Authorized JavaScript origins". The Google Calendar API must be enabled
 * for the same project. Leave it empty to hide the feature entirely.
 *
 * Like the Firebase key above, an OAuth *client id* is a public identifier — the
 * origin allow-list is what actually protects it. Never put a client *secret*
 * in front-end code.
 */
const GOOGLE = {
  clientId: '',
  scope: 'https://www.googleapis.com/auth/calendar',
  /** Which Google calendar to sync with. 'primary' is the user's main one. */
  calendarId: 'primary',
  /** How far back the first sync reaches, in days. */
  initialWindowDays: 60
};

/** App-wide constants. */
const APP = {
  name: 'LifeFlow',
  tagline: 'Your life, in flow.',
  version: '1.0.0'
};

/**
 * Voice & video in Games.
 *
 * Google's public STUN servers are always used and connect most home Wi-Fi.
 * Phones on 4G/5G and strict office/school networks usually also need a TURN
 * relay. Add one here, using the credentials from your TURN provider
 * (for example a free Metered.ca or Cloudflare Calls account, or your own coturn):
 *
 *   iceServers: [
 *     { urls: ['turn:YOUR-TURN-HOST:80', 'turn:YOUR-TURN-HOST:443?transport=tcp'],
 *       username: 'YOUR-USERNAME', credential: 'YOUR-CREDENTIAL' }
 *   ]
 */
const RTC = {
  iceServers: []
};

const CURRENCIES = [
  { code: 'USD', symbol: '$' },
  { code: 'TND', symbol: 'dt' },
  { code: 'EUR', symbol: '€' },
  { code: 'GBP', symbol: '£' },
  { code: 'MAD', symbol: 'DH' },
  { code: 'CAD', symbol: 'C$' },
  { code: 'AUD', symbol: 'A$' },
  { code: 'CHF', symbol: 'CHF' },
  { code: 'JPY', symbol: '¥' },
  { code: 'INR', symbol: '₹' },
  { code: 'AED', symbol: 'AED' },
  { code: 'NGN', symbol: '₦' },
  { code: 'BRL', symbol: 'R$' }
];

const TASK_CATEGORIES = [
  { id: 'work', label: 'Work', emoji: '💼' },
  { id: 'personal', label: 'Personal', emoji: '🌿' },
  { id: 'health', label: 'Health', emoji: '💪' },
  { id: 'finance', label: 'Finance', emoji: '💰' },
  { id: 'learning', label: 'Learning', emoji: '📚' },
  { id: 'home', label: 'Home', emoji: '🏡' },
  { id: 'social', label: 'Social', emoji: '🫂' }
];

const PRIORITIES = [
  { id: 'high', label: 'High', cls: 'pri-high', chip: 'chip--danger' },
  { id: 'med', label: 'Medium', cls: 'pri-med', chip: 'chip--warning' },
  { id: 'low', label: 'Low', cls: 'pri-low', chip: 'chip--info' }
];

const EVENT_TYPES = [
  { id: 'event', label: 'Event', emoji: '🎉' },
  { id: 'appointment', label: 'Appointment', emoji: '📅' },
  { id: 'reminder', label: 'Reminder', emoji: '🔔' }
];

const GOAL_AREAS = [
  { id: 'professional', label: 'Professional', emoji: '🚀' },
  { id: 'personal', label: 'Personal', emoji: '🌱' }
];

const MOODS = [
  { id: 'rough', emoji: '😔', label: 'Rough', score: 1 },
  { id: 'meh', emoji: '😕', label: 'Meh', score: 2 },
  { id: 'okay', emoji: '🙂', label: 'Okay', score: 3 },
  { id: 'good', emoji: '😄', label: 'Good', score: 4 },
  { id: 'great', emoji: '🤩', label: 'Great', score: 5 }
];

/**
 * Themes. `group` sorts them in the picker; `dark: true` themes are full skins
 * that always render on their own dark canvas; `fx` adds an ambient animation
 * (see js/fx.js); `bg` is only used to preview the skin in the picker.
 * Every id needs matching CSS in css/soft.css (classic) or css/themes.css.
 */
const THEME_GROUPS = [
  { id: 'classic', label: 'Classic', hint: 'Soft and calm, in light or dark' },
  { id: 'girly', label: 'Girly', hint: 'Pinks, lilacs and blush tones' },
  { id: 'elegant', label: 'Elegant & classy', hint: 'Gold, jewel tones and serif type' },
  { id: 'dark', label: 'Dark luxe', hint: 'Deep, rich, always dark' },
  { id: 'hacker', label: 'Hacker', hint: 'Terminal type, neon and scanlines' }
];

const ACCENTS = [
  { id: 'violet', group: 'classic', label: 'Periwinkle', colors: ['#7b83f5', '#45c9c2'] },
  { id: 'sunset', group: 'classic', label: 'Sunset', colors: ['#ff8a71', '#ffc46b'] },
  { id: 'forest', group: 'classic', label: 'Sage', colors: ['#46b795', '#8fd39b'] },
  { id: 'ocean', group: 'classic', label: 'Ocean', colors: ['#3fa9e2', '#5fd3dd'] },
  { id: 'mono', group: 'classic', label: 'Slate', colors: ['#7c8b93', '#9aa8b0'] },

  { id: 'blossom', group: 'girly', label: 'Blossom', colors: ['#d95f8f', '#ffb0c8'] },
  { id: 'candy', group: 'girly', label: 'Candy', colors: ['#e0348c', '#9a5cf0'] },
  { id: 'rose', group: 'girly', label: 'Rosé gold', colors: ['#c9707f', '#e8b49a'] },
  { id: 'lavender', group: 'girly', label: 'Lavender dream', colors: ['#9479d6', '#f0a8d2'] },
  { id: 'peach', group: 'girly', label: 'Peach bellini', colors: ['#ee8466', '#f7a8c2'] },
  { id: 'dollhouse', group: 'girly', label: 'Dollhouse', colors: ['#ff3ea5', '#ffc1e3'], fx: 'sparkle' },
  { id: 'sakura', group: 'girly', label: 'Sakura', colors: ['#e889a8', '#8fcfbf'], fx: 'petals' },

  { id: 'champagne', group: 'elegant', label: 'Champagne', colors: ['#b8955a', '#e6d3a8'] },
  { id: 'emerald', group: 'elegant', label: 'Emerald royale', colors: ['#1f7a5c', '#c9a45c'] },
  { id: 'bordeaux', group: 'elegant', label: 'Bordeaux', colors: ['#8c2f45', '#d4a373'] },
  { id: 'sapphire', group: 'elegant', label: 'Sapphire & gold', colors: ['#2c4a8c', '#c9a45c'] },
  { id: 'marble', group: 'elegant', label: 'Marble', colors: ['#4a4a4a', '#b9a47a'] },

  { id: 'obsidian', group: 'dark', label: 'Obsidian gold', colors: ['#d4af37', '#f1d98a'], bg: '#0b0a09', dark: true, fx: 'dust' },
  { id: 'midnight', group: 'dark', label: 'Midnight velvet', colors: ['#8b5cf6', '#f472b6'], bg: '#0c0a1f', dark: true, fx: 'stars' },
  { id: 'noir', group: 'dark', label: 'Noir', colors: ['#f2f2f2', '#e5484d'], bg: '#000000', dark: true },
  { id: 'dracula', group: 'dark', label: 'Dracula', colors: ['#bd93f9', '#ff79c6'], bg: '#1e1f29', dark: true },
  { id: 'nord', group: 'dark', label: 'Nord', colors: ['#88c0d0', '#b48ead'], bg: '#242933', dark: true },

  { id: 'matrix', group: 'hacker', label: 'Matrix', colors: ['#00ff6a', '#b9ffd0'], bg: '#010a03', dark: true, fx: 'rain' },
  { id: 'cyberpunk', group: 'hacker', label: 'Cyberpunk', colors: ['#fcee0a', '#ff2a6d'], bg: '#0b0b12', dark: true },
  { id: 'amber', group: 'hacker', label: 'Amber CRT', colors: ['#ffb000', '#ffd27a'], bg: '#0d0800', dark: true },
  { id: 'grid', group: 'hacker', label: 'Grid', colors: ['#00d9ff', '#0077ff'], bg: '#00060d', dark: true },
  { id: 'synthwave', group: 'hacker', label: 'Synthwave', colors: ['#ff2fd6', '#00e5ff'], bg: '#14002e', dark: true },
  { id: 'redteam', group: 'hacker', label: 'Red team', colors: ['#ff1744', '#b388ff'], bg: '#0a0004', dark: true, fx: 'rain' }
];

const QUOTES = [
  { t: 'Small steps every day build the life you imagine.', a: 'LifeFlow' },
  { t: 'You do not rise to the level of your goals, you fall to the level of your systems.', a: 'James Clear' },
  { t: 'The secret of getting ahead is getting started.', a: 'Mark Twain' },
  { t: 'Discipline is choosing between what you want now and what you want most.', a: 'Abraham Lincoln' },
  { t: 'Well done is better than well said.', a: 'Benjamin Franklin' },
  { t: 'A year from now you may wish you had started today.', a: 'Karen Lamb' },
  { t: 'Progress, not perfection.', a: 'Unknown' },
  { t: 'Your future is created by what you do today.', a: 'Robert Kiyosaki' },
  { t: 'Energy flows where attention goes.', a: 'Tony Robbins' },
  { t: 'Do something today that your future self will thank you for.', a: 'Sean Patrick Flanery' },
  { t: 'Balance is not something you find, it is something you create.', a: 'Jana Kingsford' },
  { t: 'Simplicity is the ultimate sophistication.', a: 'Leonardo da Vinci' }
];

const BADGES = [
  { id: 'first-step', emoji: '👣', label: 'First Step', hint: 'Complete your first task' },
  { id: 'task-10', emoji: '⚡', label: 'Momentum', hint: 'Complete 10 tasks' },
  { id: 'task-50', emoji: '🔥', label: 'Unstoppable', hint: 'Complete 50 tasks' },
  { id: 'streak-7', emoji: '🗓️', label: 'Week Warrior', hint: '7-day habit streak' },
  { id: 'streak-30', emoji: '🏆', label: 'Habit Master', hint: '30-day habit streak' },
  { id: 'saver', emoji: '🐷', label: 'Saver', hint: 'Reach 50% of a savings goal' },
  { id: 'goal-crusher', emoji: '🎯', label: 'Goal Crusher', hint: 'Complete a goal' },
  { id: 'journalist', emoji: '📓', label: 'Journalist', hint: 'Write 10 journal entries' },
  { id: 'focused', emoji: '🧘', label: 'Deep Focus', hint: 'Finish 5 focus sessions' },
  { id: 'balanced', emoji: '⚖️', label: 'Balanced', hint: 'Reach 80% life balance' }
];
return Object.freeze({ firebaseConfig, ENABLE_ANALYTICS, GOOGLE, APP, RTC, CURRENCIES, TASK_CATEGORIES, PRIORITIES, EVENT_TYPES, GOAL_AREAS, MOODS, THEME_GROUPS, ACCENTS, QUOTES, BADGES });
  })();

  /* ===== js/fx.js ===== */
  const __m5 = (function () {

/**
 * LifeFlow — ambient theme effects.
 * One canvas behind the app, drawing a theme's signature motion: digital rain,
 * falling sakura petals, sparkles, a starry sky or drifting gold dust.
 * Never runs in calm mode or with reduced motion, and pauses while hidden.
 */
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
const GLYPHS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワン0123456789ABCDEF<>/{}$#';
const FRAME = { rain: 55, petals: 33, sparkle: 40, stars: 40, dust: 33 };
const OPACITY = { rain: 0.32, petals: 0.85, sparkle: 0.8, stars: 0.9, dust: 0.75 };

const fx = { mode: null, canvas: null, ctx: null, raf: 0, last: 0, w: 0, h: 0, dpr: 1, parts: [], colors: [] };

const rand = (a, b) => a + Math.random() * (b - a);

function readColors() {
  const cs = getComputedStyle(document.documentElement);
  fx.colors = ['--accent', '--accent-2', '--accent-3', '--text'].map((v) => cs.getPropertyValue(v).trim() || '#fff');
}

/** Turn an effect on, swap it, or pass null to stop. Safe to call often. */
function setFx(next) {
  const calm = document.documentElement.getAttribute('data-calm') === 'on';
  const want = next && FRAME[next] && !reduced.matches && !calm ? next : null;
  if (want && want === fx.mode) { requestAnimationFrame(readColors); return; }
  stop();
  fx.mode = want;
  if (want) start();
}

function start() {
  const host = document.querySelector('.aurora');
  if (!host) return;
  fx.canvas = document.createElement('canvas');
  fx.canvas.className = 'fx-layer';
  fx.canvas.setAttribute('aria-hidden', 'true');
  fx.canvas.style.opacity = String(OPACITY[fx.mode]);
  host.appendChild(fx.canvas);
  fx.ctx = fx.canvas.getContext('2d');
  // Colours come from CSS — wait one frame so a just-switched theme has applied.
  requestAnimationFrame(() => { readColors(); resize(); loop(0); });
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', onVisibility);
}

function stop() {
  cancelAnimationFrame(fx.raf);
  fx.raf = 0;
  fx.canvas?.remove();
  fx.canvas = null;
  fx.ctx = null;
  fx.parts = [];
  window.removeEventListener('resize', resize);
  document.removeEventListener('visibilitychange', onVisibility);
}

function onVisibility() {
  if (!fx.canvas) return;
  cancelAnimationFrame(fx.raf);
  if (!document.hidden) fx.raf = requestAnimationFrame(loop);
}

function resize() {
  if (!fx.canvas) return;
  fx.dpr = Math.min(window.devicePixelRatio || 1, 2);
  fx.w = fx.canvas.width = Math.floor(innerWidth * fx.dpr);
  fx.h = fx.canvas.height = Math.floor(innerHeight * fx.dpr);
  seed();
}

function seed() {
  const { w, h, dpr } = fx;
  const area = (w * h) / (dpr * dpr);
  if (fx.mode === 'rain') {
    const size = 16 * dpr;
    fx.parts = Array.from({ length: Math.ceil(w / size) }, () => ({ y: rand(-h, 0), speed: rand(0.6, 1.3) }));
  } else if (fx.mode === 'petals') {
    fx.parts = Array.from({ length: Math.round(Math.min(34, area / 40000)) }, () => petal(true));
  } else if (fx.mode === 'sparkle') {
    fx.parts = Array.from({ length: Math.round(Math.min(46, area / 30000)) }, () => ({
      x: rand(0, w), y: rand(0, h), r: rand(3, 8) * dpr, phase: rand(0, Math.PI * 2), speed: rand(0.02, 0.05), c: Math.floor(rand(0, 3))
    }));
  } else if (fx.mode === 'stars') {
    fx.parts = Array.from({ length: Math.round(Math.min(160, area / 9000)) }, () => ({
      x: rand(0, w), y: rand(0, h), r: rand(0.4, 1.5) * dpr, phase: rand(0, Math.PI * 2), speed: rand(0.01, 0.04)
    }));
    fx.shoot = null;
  } else if (fx.mode === 'dust') {
    fx.parts = Array.from({ length: Math.round(Math.min(70, area / 20000)) }, () => mote(true));
  }
}

const petal = (anywhere) => ({
  x: rand(0, fx.w), y: anywhere ? rand(0, fx.h) : rand(-60, -10) * fx.dpr,
  r: rand(5, 10) * fx.dpr, vy: rand(0.5, 1.2) * fx.dpr, vx: rand(-0.3, 0.6) * fx.dpr,
  rot: rand(0, Math.PI * 2), vr: rand(-0.03, 0.03), sway: rand(0, Math.PI * 2), c: Math.random() < 0.7 ? 1 : 0
});

const mote = (anywhere) => ({
  x: rand(0, fx.w), y: anywhere ? rand(0, fx.h) : fx.h + 10,
  r: rand(0.6, 2.2) * fx.dpr, vy: rand(0.15, 0.5) * fx.dpr, phase: rand(0, Math.PI * 2)
});

function loop(t) {
  fx.raf = requestAnimationFrame(loop);
  if (t - fx.last < FRAME[fx.mode]) return;
  fx.last = t;
  const { ctx, w, h, dpr } = fx;
  if (!ctx) return;
  const [c1, c2, c3, text] = fx.colors;

  if (fx.mode === 'rain') {
    // Fade the previous frame towards transparent so the trails glow out.
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0,0,0,.12)';
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
    const size = 16 * dpr;
    ctx.font = `${size}px 'JetBrains Mono', Consolas, monospace`;
    fx.parts.forEach((d, i) => {
      const ch = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      ctx.fillStyle = Math.random() < 0.08 ? text : c1;
      ctx.fillText(ch, i * size, d.y);
      d.y += size * d.speed;
      if (d.y > h && Math.random() > 0.975) d.y = rand(-h * 0.3, 0);
    });
    return;
  }

  ctx.clearRect(0, 0, w, h);

  if (fx.mode === 'petals') {
    fx.parts.forEach((p, i) => {
      p.sway += 0.02;
      p.x += p.vx + Math.sin(p.sway) * 0.6 * dpr;
      p.y += p.vy;
      p.rot += p.vr;
      if (p.y > h + 20 || p.x > w + 30) fx.parts[i] = petal(false);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.scale(1, 0.62 + Math.sin(p.sway * 2) * 0.18);
      ctx.fillStyle = p.c ? c2 : c1;
      ctx.globalAlpha = 0.75;
      ctx.beginPath();
      ctx.moveTo(0, -p.r);
      ctx.quadraticCurveTo(p.r, -p.r * 0.2, 0, p.r);
      ctx.quadraticCurveTo(-p.r, -p.r * 0.2, 0, -p.r);
      ctx.fill();
      ctx.restore();
    });
  } else if (fx.mode === 'sparkle') {
    const pal = [c1, c2, c3];
    fx.parts.forEach((s) => {
      s.phase += s.speed;
      const a = Math.max(0, Math.sin(s.phase));
      if (a <= 0.01 && Math.random() < 0.02) { s.x = rand(0, w); s.y = rand(0, h); }
      const r = s.r * (0.5 + a * 0.5);
      ctx.globalAlpha = a;
      ctx.fillStyle = pal[s.c];
      ctx.beginPath();
      ctx.moveTo(s.x, s.y - r);
      ctx.quadraticCurveTo(s.x, s.y, s.x + r, s.y);
      ctx.quadraticCurveTo(s.x, s.y, s.x, s.y + r);
      ctx.quadraticCurveTo(s.x, s.y, s.x - r, s.y);
      ctx.quadraticCurveTo(s.x, s.y, s.x, s.y - r);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  } else if (fx.mode === 'stars') {
    ctx.fillStyle = text;
    fx.parts.forEach((s) => {
      s.phase += s.speed;
      ctx.globalAlpha = 0.25 + Math.abs(Math.sin(s.phase)) * 0.75;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    });
    if (!fx.shoot && Math.random() < 0.006) {
      fx.shoot = { x: rand(w * 0.2, w), y: rand(0, h * 0.4), life: 1 };
    }
    if (fx.shoot) {
      const s = fx.shoot;
      const len = 120 * dpr;
      const g = ctx.createLinearGradient(s.x, s.y, s.x + len, s.y - len * 0.4);
      g.addColorStop(0, c1);
      g.addColorStop(1, 'transparent');
      ctx.globalAlpha = s.life;
      ctx.strokeStyle = g;
      ctx.lineWidth = 1.6 * dpr;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x + len, s.y - len * 0.4);
      ctx.stroke();
      s.x -= 14 * dpr;
      s.y += 5.6 * dpr;
      s.life -= 0.04;
      if (s.life <= 0) fx.shoot = null;
    }
    ctx.globalAlpha = 1;
  } else if (fx.mode === 'dust') {
    fx.parts.forEach((m, i) => {
      m.phase += 0.03;
      m.y -= m.vy;
      m.x += Math.sin(m.phase) * 0.3 * dpr;
      if (m.y < -10) fx.parts[i] = mote(false);
      ctx.globalAlpha = 0.3 + Math.abs(Math.sin(m.phase)) * 0.7;
      ctx.fillStyle = i % 3 ? c1 : c2;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }
}
return Object.freeze({ setFx });
  })();

  /* ===== js/ui.js ===== */
  const __m2 = (function () {
const { $, el, esc, haptic } = __m1;
const { icon } = __m3;
const { ACCENTS } = __m4;
const { setFx } = __m5;
/**
 * LifeFlow — UI kit: theme, toasts, modals, confirm dialogs, ripples,
 * confetti, progress rings, swipe gestures and drag-sorting.
 */





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

const theme = {
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

function toast(message, type = 'success', ms = 3200) {
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
function modal({ title = '', body = '', footer = '', size = '', onMount, dismissible = true } = {}) {
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
function confirmDialog({ title = 'Are you sure?', message = '', confirmText = 'Confirm', danger = false } = {}) {
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
function initRipples() {
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
function confetti(count = 34) {
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
function svgDefs() {
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
function ring(value, { size = 108, stroke = 10, label = '', caption = '' } = {}) {
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
function animateProgress(root = document) {
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
function sparkline(values, { height = 90 } = {}) {
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
function initSwipe(root, { onRight, onLeft } = {}) {
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
function initSortable(list, onSort, handleSel = '[data-handle]') {
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
function initRailDots(rail, dots) {
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
function withLoading(btn, promise) {
  btn.classList.add('is-loading');
  return Promise.resolve(promise).finally(() => btn.classList.remove('is-loading'));
}
return Object.freeze({ theme, toast, modal, confirmDialog, initRipples, confetti, svgDefs, ring, animateProgress, sparkline, initSwipe, initSortable, initRailDots, withLoading });
  })();

  /* ===== js/router.js ===== */
  const __m6 = (function () {

/**
 * LifeFlow — tiny hash router with auth guards and view transitions.
 */

const routes = new Map();
let notFound = null;
let guard = null;
let current = null;

function route(path, config) {
  routes.set(path, config);
}

function setGuard(fn) { guard = fn; }
function setNotFound(fn) { notFound = fn; }

function currentPath() {
  const raw = location.hash.replace(/^#/, '') || '/';
  return raw.split('?')[0];
}

function currentQuery() {
  const raw = location.hash.replace(/^#/, '');
  const qs = raw.split('?')[1] || '';
  return Object.fromEntries(new URLSearchParams(qs));
}

function navigate(path, { replace = false } = {}) {
  const target = path.startsWith('#') ? path : `#${path}`;
  if (location.hash === target) { resolve(); return; }
  if (replace) {
    history.replaceState(null, '', target);
    resolve(); // replaceState does not dispatch hashchange (auth/invite redirects).
  }
  else location.hash = target;
}

function getCurrent() { return current; }

async function resolve() {
  const path = currentPath();
  const config = routes.get(path);

  if (guard) {
    const redirect = guard(path, config);
    if (redirect && redirect !== path) { navigate(redirect, { replace: true }); return; }
  }

  if (!config) {
    if (notFound) notFound(path);
    else navigate('/', { replace: true });
    return;
  }

  current = path;
  document.title = config.title ? `${config.title} · LifeFlow` : 'LifeFlow';
  await config.render(currentQuery());
  window.dispatchEvent(new CustomEvent('lf:navigated', { detail: { path } }));
}

function startRouter() {
  window.addEventListener('hashchange', resolve);
  if (!location.hash) history.replaceState(null, '', '#/');
  resolve();
}
return Object.freeze({ route, setGuard, setNotFound, currentPath, currentQuery, navigate, getCurrent, resolve, startRouter });
  })();

  /* ===== js/firebase.js ===== */
  const __m7 = (function () {
const { initializeApp } = __ext[0];
const { getAuth, setPersistence, browserLocalPersistence, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail, sendEmailVerification, updateProfile, updatePassword, reauthenticateWithCredential, EmailAuthProvider, deleteUser } = __ext[1];
const { getFirestore, doc, collection, addDoc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, onSnapshot, query, where, orderBy, limit, serverTimestamp, writeBatch, increment, arrayUnion, arrayRemove, runTransaction, Timestamp } = __ext[2];
const { getStorage, ref: storageRef, uploadBytes, getDownloadURL, deleteObject } = __ext[3];
const { firebaseConfig, ENABLE_ANALYTICS } = __m4;
/**
 * LifeFlow — Firebase bootstrap.
 * Initialises the app once and re-exports the SDK pieces the rest of the
 * codebase needs, so no other module talks to the CDN directly.
 */







const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Keep the session alive between visits (best-effort — private mode can block it).
setPersistence(auth, browserLocalPersistence).catch(() => {});

// Analytics is optional and only works on http(s) origins.
if (ENABLE_ANALYTICS && location.protocol.startsWith('http')) {
  import('https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js')
    .then(({ getAnalytics, isSupported }) =>
      isSupported().then((ok) => { if (ok) getAnalytics(app); })
    )
    .catch(() => {});
}



/** Human-friendly messages for Firebase auth error codes. */
function authErrorMessage(err) {
  const code = (err && err.code) || '';
  const map = {
    'auth/invalid-email': 'That email address doesn’t look right.',
    'auth/user-disabled': 'This account has been disabled.',
    'auth/user-not-found': 'No account found with that email.',
    'auth/wrong-password': 'Incorrect email or password.',
    'auth/invalid-credential': 'Incorrect email or password.',
    'auth/invalid-login-credentials': 'Incorrect email or password.',
    'auth/email-already-in-use': 'That email is already registered. Try logging in.',
    'auth/weak-password': 'Please choose a password with at least 6 characters.',
    'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
    'auth/network-request-failed': 'Network problem — check your connection.',
    'auth/requires-recent-login': 'Please log in again to complete this action.',
    'auth/missing-password': 'Please enter your password.',
    'auth/operation-not-allowed': 'Email sign-in is not enabled in Firebase yet.',
    'permission-denied': 'You don’t have permission for that. Check your Firestore rules.',
    unavailable: 'Can’t reach the server right now. Please retry.'
  };
  return map[code] || (err && err.message) || 'Something went wrong. Please try again.';
}
return Object.freeze({ createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail, sendEmailVerification, updateProfile, updatePassword, reauthenticateWithCredential, EmailAuthProvider, deleteUser, doc, collection, addDoc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, onSnapshot, query, where, orderBy, limit, serverTimestamp, writeBatch, increment, arrayUnion, arrayRemove, runTransaction, Timestamp, storageRef, uploadBytes, getDownloadURL, deleteObject, app, auth, db, storage, authErrorMessage });
  })();

  /* ===== js/prayer.js ===== */
  const __m9 = (function () {

/**
 * LifeFlow — Islamic prayer times (Salat / الصلاة).
 *
 * A self-contained astronomical calculator: no network call, no API key, works
 * offline and updates in real time. The algorithm is the classic one used by
 * most timetables — solar declination + equation of time, then the hour angle
 * for each twilight depression angle.
 *
 *   Fajr      sun at −{fajrAngle}° before sunrise
 *   Sunrise   sun disc at −0.833° (refraction + radius)
 *   Dhuhr     solar noon at the observer's meridian
 *   Asr       shadow length = object + {1|2}× its noon shadow
 *   Maghrib   sunset (−0.833°)
 *   Isha      sun at −{ishaAngle}° after sunset (or a fixed offset)
 */

/* ------------------------------ trig in degrees ------------------------------ */
const RAD = Math.PI / 180;
const sin = (d) => Math.sin(d * RAD);
const cos = (d) => Math.cos(d * RAD);
const tan = (d) => Math.tan(d * RAD);
const asin = (x) => Math.asin(x) / RAD;
const acos = (x) => Math.acos(x) / RAD;
const atan2 = (y, x) => Math.atan2(y, x) / RAD;
const acot = (x) => Math.atan(1 / x) / RAD;

const wrap = (a, b) => {
  const v = a - b * Math.floor(a / b);
  return v < 0 ? v + b : v;
};
const fixAngle = (a) => wrap(a, 360);
const fixHour = (a) => wrap(a, 24);

/* ------------------------------ calculation methods ------------------------------ */
const METHODS = [
  { id: 'mwl', label: 'Muslim World League', fajr: 18, isha: 17 },
  { id: 'isna', label: 'North America (ISNA)', fajr: 15, isha: 15 },
  { id: 'egypt', label: 'Egyptian General Authority', fajr: 19.5, isha: 17.5 },
  { id: 'makkah', label: 'Umm al-Qura, Makkah', fajr: 18.5, ishaMinutes: 90 },
  { id: 'karachi', label: 'Univ. of Islamic Sciences, Karachi', fajr: 18, isha: 18 },
  { id: 'turkey', label: 'Diyanet, Türkiye', fajr: 18, isha: 17 },
  { id: 'tehran', label: 'Univ. of Tehran', fajr: 17.7, isha: 14 },
  { id: 'france', label: 'France (UOIF)', fajr: 12, isha: 12 }
];

const MADHABS = [
  { id: 'standard', label: 'Standard', hint: 'Shāfiʿī · Mālikī · Ḥanbalī', factor: 1 },
  { id: 'hanafi', label: 'Ḥanafī', hint: 'Later Asr', factor: 2 }
];

/** The five obligatory prayers, in order. */
const PRAYERS = [
  { id: 'fajr', label: 'Fajr', ar: 'الفجر', emoji: '🌄', note: 'Before sunrise' },
  { id: 'dhuhr', label: 'Dhuhr', ar: 'الظهر', emoji: '☀️', note: 'After midday' },
  { id: 'asr', label: 'Asr', ar: 'العصر', emoji: '🌇', note: 'Afternoon' },
  { id: 'maghrib', label: 'Maghrib', ar: 'المغرب', emoji: '🌆', note: 'At sunset' },
  { id: 'isha', label: 'Isha', ar: 'العشاء', emoji: '🌙', note: 'Night' }
];

/** Handy presets so the tracker works even without location permission. */
const CITIES = [
  { label: 'Makkah', lat: 21.4225, lng: 39.8262 },
  { label: 'Madinah', lat: 24.4686, lng: 39.6142 },
  { label: 'Tunis', lat: 36.8065, lng: 10.1815 },
  { label: 'Sfax', lat: 34.7406, lng: 10.7603 },
  { label: 'Sousse', lat: 35.8256, lng: 10.6084 },
  { label: 'Algiers', lat: 36.7538, lng: 3.0588 },
  { label: 'Casablanca', lat: 33.5731, lng: -7.5898 },
  { label: 'Rabat', lat: 34.0209, lng: -6.8416 },
  { label: 'Marrakesh', lat: 31.6295, lng: -7.9811 },
  { label: 'Cairo', lat: 30.0444, lng: 31.2357 },
  { label: 'Istanbul', lat: 41.0082, lng: 28.9784 },
  { label: 'Dubai', lat: 25.2048, lng: 55.2708 },
  { label: 'Riyadh', lat: 24.7136, lng: 46.6753 },
  { label: 'Doha', lat: 25.2854, lng: 51.531 },
  { label: 'Amman', lat: 31.9454, lng: 35.9284 },
  { label: 'Paris', lat: 48.8566, lng: 2.3522 },
  { label: 'Marseille', lat: 43.2965, lng: 5.3698 },
  { label: 'London', lat: 51.5072, lng: -0.1276 },
  { label: 'Berlin', lat: 52.52, lng: 13.405 },
  { label: 'New York', lat: 40.7128, lng: -74.006 },
  { label: 'Toronto', lat: 43.6532, lng: -79.3832 },
  { label: 'Lagos', lat: 6.5244, lng: 3.3792 },
  { label: 'Karachi', lat: 24.8607, lng: 67.0011 },
  { label: 'Kuala Lumpur', lat: 3.139, lng: 101.6869 },
  { label: 'Jakarta', lat: -6.2088, lng: 106.8456 }
];

const DEFAULT_PRAYER_PREFS = {
  enabled: false,
  method: 'mwl',
  madhab: 'standard',
  lat: 21.4225,
  lng: 39.8262,
  city: 'Makkah',
  reminders: false
};

function methodOf(id) {
  return METHODS.find((m) => m.id === id) || METHODS[0];
}
function madhabOf(id) {
  return MADHABS.find((m) => m.id === id) || MADHABS[0];
}
function prayerOf(id) {
  return PRAYERS.find((p) => p.id === id) || PRAYERS[0];
}

/* ------------------------------ astronomy ------------------------------ */
function julianDay(year, month, day) {
  let y = year;
  let m = month;
  if (m <= 2) { y -= 1; m += 12; }
  const a = Math.floor(y / 100);
  const b = 2 - a + Math.floor(a / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + b - 1524.5;
}

/** Solar declination and equation of time for a Julian day. */
function sunPosition(jd) {
  const d = jd - 2451545.0;
  const g = fixAngle(357.529 + 0.98560028 * d);
  const q = fixAngle(280.459 + 0.98564736 * d);
  const l = fixAngle(q + 1.915 * sin(g) + 0.02 * sin(2 * g));
  const e = 23.439 - 0.00000036 * d;
  const ra = fixHour(atan2(cos(e) * sin(l), cos(l)) / 15);
  return { decl: asin(sin(e) * sin(l)), eqt: q / 15 - ra };
}

/**
 * Prayer times for one calendar day.
 *
 * @param {Date}   date
 * @param {object} opts { lat, lng, method, madhab }
 * @returns {{fajr:number|null, sunrise:number|null, dhuhr:number|null, asr:number|null,
 *            maghrib:number|null, isha:number|null}} hours after local midnight
 */
function prayerTimes(date = new Date(), opts = {}) {
  const lat = Number(opts.lat ?? DEFAULT_PRAYER_PREFS.lat);
  const lng = Number(opts.lng ?? DEFAULT_PRAYER_PREFS.lng);
  const method = methodOf(opts.method);
  const factor = madhabOf(opts.madhab).factor;

  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  // Local UTC offset in hours *for that date* — keeps DST correct.
  const tz = -new Date(y, m - 1, d, 12).getTimezoneOffset() / 60;
  const jDate = julianDay(y, m, d) - lng / (15 * 24);

  const midDay = (portion) => fixHour(12 - sunPosition(jDate + portion).eqt);

  const sunAngleTime = (angle, portion, ccw) => {
    const { decl } = sunPosition(jDate + portion);
    const ratio = (-sin(angle) - sin(decl) * sin(lat)) / (cos(decl) * cos(lat));
    if (ratio > 1 || ratio < -1) return NaN; // sun never reaches this angle (polar)
    const t = acos(ratio) / 15;
    return midDay(portion) + (ccw ? -t : t);
  };

  const asrTime = (portion) => {
    const { decl } = sunPosition(jDate + portion);
    return sunAngleTime(-acot(factor + tan(Math.abs(lat - decl))), portion, false);
  };

  // Seed with rough guesses, then refine — two passes is plenty (<1s error).
  let t = { fajr: 5, sunrise: 6, dhuhr: 12, asr: 13, maghrib: 18, isha: 18 };
  for (let i = 0; i < 3; i++) {
    const p = (k) => t[k] / 24;
    t = {
      fajr: sunAngleTime(method.fajr, p('fajr'), true),
      sunrise: sunAngleTime(0.833, p('sunrise'), true),
      dhuhr: midDay(p('dhuhr')),
      asr: asrTime(p('asr')),
      maghrib: sunAngleTime(0.833, p('maghrib'), false),
      isha: method.ishaMinutes ? t.isha : sunAngleTime(method.isha, p('isha'), false)
    };
    if (method.ishaMinutes) t.isha = t.maghrib + method.ishaMinutes / 60;
  }

  const shift = tz - lng / 15;
  const out = {};
  for (const key of Object.keys(t)) {
    const v = t[key] + shift;
    out[key] = Number.isFinite(v) ? v : null;
  }
  return out;
}

/* ------------------------------ formatting & helpers ------------------------------ */

/** 15.75 → "15:45" (24h, zero padded). */
function toHHMM(hours) {
  if (hours == null || !Number.isFinite(hours)) return null;
  const total = Math.round(fixHour(hours) * 60);
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** The five prayers as display rows: { id, label, ar, emoji, hhmm, at:Date }. */
function prayerSchedule(date = new Date(), opts = {}) {
  const times = prayerTimes(date, opts);
  return PRAYERS.map((p) => {
    const hours = times[p.id];
    const at = Number.isFinite(hours) ? hoursToDate(date, hours) : null;
    return { ...p, hours, hhmm: toHHMM(hours), at };
  });
}

function hoursToDate(date, hours) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setMinutes(Math.round(fixHour(hours) * 60));
  return d;
}

/** Sunrise for the day — useful as the end of the Fajr window. */
function sunriseAt(date = new Date(), opts = {}) {
  const t = prayerTimes(date, opts);
  return Number.isFinite(t.sunrise) ? hoursToDate(date, t.sunrise) : null;
}

/**
 * Which prayer is current and which is next, right now.
 * Rolls over to tomorrow's Fajr after Isha.
 */
function nextPrayer(now = new Date(), opts = {}) {
  const todaySchedule = prayerSchedule(now, opts);
  for (const p of todaySchedule) {
    if (p.at && p.at > now) {
      const idx = todaySchedule.indexOf(p);
      const current = idx > 0 ? todaySchedule[idx - 1] : null;
      return { next: p, current, in: p.at - now, tomorrow: false };
    }
  }
  const tmr = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const fajr = prayerSchedule(tmr, opts)[0];
  return {
    next: fajr,
    current: todaySchedule[todaySchedule.length - 1],
    in: fajr.at ? fajr.at - now : 0,
    tomorrow: true
  };
}

/** 5400000 → "1h 30m" (or "12m 04s" when it is close). */
function countdownLabel(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}

/** Ask the browser where we are. Resolves to null instead of throwing. */
function locate({ timeout = 8000 } = {}) {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { timeout, maximumAge: 10 * 60 * 1000, enableHighAccuracy: false }
    );
  });
}

/** Nearest known city label for a coordinate (great-circle, small list). */
function nearestCity(lat, lng) {
  let best = null;
  let bestD = Infinity;
  for (const c of CITIES) {
    const dLat = (c.lat - lat) * 111;
    const dLng = (c.lng - lng) * 111 * cos(lat);
    const d = Math.hypot(dLat, dLng);
    if (d < bestD) { bestD = d; best = c; }
  }
  return bestD <= 120 ? best.label : null;
}

/** Hijri date for a Gregorian one (tabular/Umm al-Qura approximation). */
function hijriLabel(date = new Date()) {
  try {
    return new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(date);
  } catch {
    return '';
  }
}
return Object.freeze({ METHODS, MADHABS, PRAYERS, CITIES, DEFAULT_PRAYER_PREFS, methodOf, madhabOf, prayerOf, prayerTimes, toHHMM, prayerSchedule, sunriseAt, nextPrayer, countdownLabel, locate, nearestCity, hijriLabel });
  })();

  /* ===== js/store.js ===== */
  const __m8 = (function () {
const { db, auth, doc, collection, addDoc, setDoc, getDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, serverTimestamp, writeBatch } = __m7;
const { ymd, today, addDays, toMillis, pct, clamp } = __m1;
const { BADGES } = __m4;
const { PRAYERS, DEFAULT_PRAYER_PREFS } = __m9;
/**
 * LifeFlow — data layer.
 *
 * Owns the Firestore connection for the signed-in user, keeps an in-memory
 * mirror of every collection, and notifies subscribers on change.
 *
 * Firestore model
 * ---------------
 * users/{uid}                     → profile + preferences
 * users/{uid}/tasks/{id}
 * users/{uid}/events/{id}         → events, appointments, reminders
 * users/{uid}/goals/{id}          → personal & professional goals
 * users/{uid}/savings/{id}        → financial / savings goals
 * users/{uid}/txns/{id}           → income & expense entries
 * users/{uid}/habits/{id}          → habit + completion log
 * users/{uid}/notes/{id}           → notes & journal entries
 * users/{uid}/moods/{YYYY-MM-DD}   → daily mood check-in
 * users/{uid}/prayers/{YYYY-MM-DD} → daily salat check-in
 */





const COLLECTIONS = ['tasks', 'events', 'goals', 'savings', 'txns', 'purchases', 'habits', 'notes', 'moods', 'prayers'];

/** Collections keyed by date string rather than an auto id. */
const DATE_KEYED = ['moods', 'prayers'];

const DEFAULT_PREFS = {
  currency: 'USD',
  theme: 'light',
  accent: 'violet',
  weekStartsMonday: true,
  focusMinutes: 25,
  breakMinutes: 5,
  calm: false,
  textScale: 'md',
  prayer: { ...DEFAULT_PRAYER_PREFS },
  // Defaults for these two live in notify.js / gcal.js — keeping only the empty
  // slot here avoids a circular import back into the data layer.
  notify: {},
  gcal: {},
  widgets: {
    focus: true,
    mood: true,
    breathe: true,
    gratitude: true,
    balance: true,
    finance: true,
    purchases: true,
    habits: true,
    games: true,
    badges: true,
    quote: true,
    prayer: true
  }
};

/** Reactive application state. */
const state = {
  uid: null,
  user: null,
  profile: null,
  ready: false,
  loading: true,
  tasks: [],
  events: [],
  goals: [],
  savings: [],
  txns: [],
  purchases: [],
  habits: [],
  notes: [],
  moods: [],
  prayers: [],
  focusSessions: 0
};

const listeners = new Set();
let unsubs = [];

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  listeners.forEach((fn) => {
    try { fn(state); } catch (err) { console.error('[store] listener failed', err); }
  });
}

/* =========================================================
   Lifecycle
   ========================================================= */
async function connect(user) {
  disconnect();
  state.uid = user.uid;
  state.user = user;
  state.loading = true;
  emit();

  await ensureProfile(user);

  const pending = new Set(COLLECTIONS);
  const settle = (name) => {
    pending.delete(name);
    if (!pending.size && state.loading) {
      state.loading = false;
      state.ready = true;
    }
    emit();
  };

  // Profile document (live)
  unsubs.push(
    onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        state.profile = { id: snap.id, ...(snap.data() || {}) };
        state.profile.prefs = { ...DEFAULT_PREFS, ...(state.profile.prefs || {}) };
        state.profile.prefs.widgets = { ...DEFAULT_PREFS.widgets, ...(state.profile.prefs.widgets || {}) };
        state.profile.prefs.prayer = { ...DEFAULT_PRAYER_PREFS, ...(state.profile.prefs.prayer || {}) };
        emit();
      },
      (err) => console.warn('[store] profile snapshot', err)
    )
  );

  for (const name of COLLECTIONS) {
    const ref = collection(db, 'users', user.uid, name);
    const q = DATE_KEYED.includes(name) ? ref : query(ref, orderBy('createdAt', 'desc'));
    unsubs.push(
      onSnapshot(
        q,
        (snap) => {
          state[name] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          settle(name);
        },
        (err) => {
          console.warn(`[store] ${name} snapshot`, err);
          settle(name);
        }
      )
    );
  }
}

function disconnect() {
  unsubs.forEach((u) => { try { u(); } catch { /* ignore */ } });
  unsubs = [];
  state.uid = null;
  state.user = null;
  state.profile = null;
  state.ready = false;
  state.loading = true;
  COLLECTIONS.forEach((c) => { state[c] = []; });
  emit();
}

async function ensureProfile(user) {
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return;
  await setDoc(ref, {
    name: user.displayName || '',
    email: user.email || '',
    photoURL: user.photoURL || '',
    bio: '',
    focusArea: '',
    prefs: DEFAULT_PREFS,
    badges: [],
    stats: { tasksDone: 0, focusSessions: 0 },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

/* =========================================================
   Generic CRUD
   ========================================================= */
function colRef(name) {
  if (!state.uid) throw new Error('Not signed in');
  return collection(db, 'users', state.uid, name);
}
function docRef(name, id) {
  if (!state.uid) throw new Error('Not signed in');
  return doc(db, 'users', state.uid, name, id);
}

async function create(name, data) {
  const ref = await addDoc(colRef(name), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return ref.id;
}

async function update(name, id, patch) {
  await updateDoc(docRef(name, id), { ...patch, updatedAt: serverTimestamp() });
}

/**
 * Called just before a synced calendar entry is deleted, so an integration can
 * mirror the deletion (see gcal.js). Registered lazily to keep the data layer
 * free of any dependency on the integration.
 */
let eventDeleteHook = null;
function setEventDeleteHook(fn) {
  eventDeleteHook = fn;
}

async function remove(name, id, { skipRemote = false } = {}) {
  if (name === 'events' && eventDeleteHook && !skipRemote) {
    const ev = state.events.find((e) => e.id === id);
    if (ev?.gcalId) {
      try {
        await eventDeleteHook(ev);
      } catch (err) {
        console.warn('[store] remote delete failed', err);
      }
    }
  }
  await deleteDoc(docRef(name, id));
}

async function updateProfileDoc(patch) {
  await setDoc(doc(db, 'users', state.uid), { ...patch, updatedAt: serverTimestamp() }, { merge: true });
}

async function savePrefs(patch) {
  const prefs = { ...(state.profile?.prefs || DEFAULT_PREFS), ...patch };
  state.profile = { ...(state.profile || {}), prefs };
  emit();
  await updateProfileDoc({ prefs });
}

function prefs() {
  const stored = state.profile?.prefs || {};
  return {
    ...DEFAULT_PREFS,
    ...stored,
    widgets: { ...DEFAULT_PREFS.widgets, ...(stored.widgets || {}) },
    prayer: { ...DEFAULT_PRAYER_PREFS, ...(stored.prayer || {}) },
    notify: { ...(stored.notify || {}) },
    gcal: { ...(stored.gcal || {}) }
  };
}

function currency() {
  return prefs().currency || 'USD';
}

/* =========================================================
   Tasks
   ========================================================= */
async function toggleTask(task) {
  const done = !task.done;
  await update('tasks', task.id, { done, doneAt: done ? Date.now() : null });
  if (done) await bumpStat('tasksDone', 1);
  return done;
}

async function reorderTasks(orderedIds) {
  const batch = writeBatch(db);
  orderedIds.forEach((id, i) => batch.update(docRef('tasks', id), { order: i }));
  await batch.commit();
}

/* =========================================================
   Purchases — the wish list that talks to your money
   ========================================================= */

/**
 * Ticks an item off the shopping list. Buying it writes a matching expense into
 * the money records; un-ticking removes that expense again, so the balance
 * always mirrors the checkboxes.
 */
async function togglePurchase(item) {
  const bought = !item.bought;

  if (bought) {
    const price = Number(item.price) || 0;
    const txnId = price > 0
      ? await create('txns', {
          type: 'expense',
          amount: price,
          title: item.title,
          category: item.category || 'shopping',
          date: today(),
          purchaseId: item.id
        })
      : null;
    await update('purchases', item.id, { bought: true, boughtAt: Date.now(), txnId });
  } else {
    await dropPurchaseTxn(item);
    await update('purchases', item.id, { bought: false, boughtAt: null, txnId: null });
  }
  return bought;
}

async function dropPurchaseTxn(item) {
  if (!item?.txnId) return;
  try {
    await remove('txns', item.txnId);
  } catch (err) {
    console.warn('[store] linked expense already gone', err);
  }
}

/** Keeps an already-bought item's expense in step with edits to it. */
async function syncPurchaseTxn(item) {
  if (!item?.bought || !item.txnId) return;
  const price = Number(item.price) || 0;
  if (price <= 0) {
    await dropPurchaseTxn(item);
    await update('purchases', item.id, { txnId: null });
    return;
  }
  try {
    await update('txns', item.txnId, {
      amount: price,
      title: item.title,
      category: item.category || 'shopping'
    });
  } catch (err) {
    console.warn('[store] could not sync linked expense', err);
  }
}

/* =========================================================
   Habits
   ========================================================= */
async function toggleHabitDay(habit, dateStr = today()) {
  const log = Array.isArray(habit.log) ? [...habit.log] : [];
  const idx = log.indexOf(dateStr);
  if (idx >= 0) log.splice(idx, 1);
  else log.push(dateStr);
  log.sort();
  await update('habits', habit.id, { log, streak: streakOf(log) });
  return idx < 0;
}

function streakOf(log = []) {
  const set = new Set(log);
  let streak = 0;
  let cursor = new Date();
  if (!set.has(ymd(cursor))) cursor = addDays(cursor, -1); // today not logged yet is fine
  while (set.has(ymd(cursor))) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

function habitDoneToday(habit) {
  return Array.isArray(habit.log) && habit.log.includes(today());
}

/* =========================================================
   Mood
   ========================================================= */
async function setMood(moodId, dateStr = today()) {
  await setDoc(
    doc(db, 'users', state.uid, 'moods', dateStr),
    { mood: moodId, date: dateStr, createdAt: serverTimestamp() },
    { merge: true }
  );
}

function moodFor(dateStr = today()) {
  return state.moods.find((m) => m.id === dateStr)?.mood || null;
}

/* =========================================================
   Salat — the five daily prayers
   ========================================================= */
const PRAYER_IDS = PRAYERS.map((p) => p.id);

/** The prayer ids ticked off on a given day. */
function prayersOn(dateStr = today()) {
  const doc = state.prayers.find((p) => p.id === dateStr);
  const done = Array.isArray(doc?.done) ? doc.done : [];
  return done.filter((id) => PRAYER_IDS.includes(id));
}

function prayerDone(id, dateStr = today()) {
  return prayersOn(dateStr).includes(id);
}

/** Check / uncheck one prayer. Returns the new state (true = prayed). */
async function togglePrayer(id, dateStr = today()) {
  if (!PRAYER_IDS.includes(id)) return false;
  const current = prayersOn(dateStr);
  const on = !current.includes(id);
  const done = on ? [...current, id] : current.filter((x) => x !== id);
  done.sort((a, b) => PRAYER_IDS.indexOf(a) - PRAYER_IDS.indexOf(b));

  await setDoc(
    doc(db, 'users', state.uid, 'prayers', dateStr),
    { date: dateStr, done, count: done.length, updatedAt: serverTimestamp(), createdAt: serverTimestamp() },
    { merge: true }
  );
  return on;
}

/** Consecutive days (ending today or yesterday) where all five were prayed. */
function prayerStreak() {
  const MAX_DAYS = 3650; // Ten years is plenty, and keeps the loop finite.
  let streak = 0;
  let cursor = new Date();
  if (prayersOn(ymd(cursor)).length < 5) cursor = addDays(cursor, -1);
  while (streak < MAX_DAYS && prayersOn(ymd(cursor)).length === 5) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

async function savePrayerPrefs(patch) {
  const current = prefs().prayer;
  await savePrefs({ prayer: { ...current, ...patch } });
}

/**
 * Removes the prayer tracker. `wipe` also deletes every saved day, so the
 * feature leaves nothing behind.
 */
async function removePrayerTracker({ wipe = true } = {}) {
  await savePrayerPrefs({ enabled: false });
  if (!wipe) return 0;
  const ids = state.prayers.map((p) => p.id);
  for (let i = 0; i < ids.length; i += 400) {
    const batch = writeBatch(db);
    ids.slice(i, i + 400).forEach((id) => batch.delete(docRef('prayers', id)));
    await batch.commit();
  }
  return ids.length;
}

/** Deletes a single day's check-in. */
async function clearPrayerDay(dateStr = today()) {
  if (state.prayers.some((p) => p.id === dateStr)) await remove('prayers', dateStr);
}

/* =========================================================
   Stats & badges
   ========================================================= */
async function bumpStat(key, by = 1) {
  const stats = { ...(state.profile?.stats || {}) };
  stats[key] = (stats[key] || 0) + by;
  await updateProfileDoc({ stats });
}

async function recordFocusSession() {
  await bumpStat('focusSessions', 1);
  await evaluateBadges();
}

/** Selectors ------------------------------------------------ */
const select = {
  tasksSorted() {
    return [...state.tasks].sort((a, b) => {
      if (!!a.done !== !!b.done) return a.done ? 1 : -1;
      const ao = a.order ?? 9999;
      const bo = b.order ?? 9999;
      if (ao !== bo) return ao - bo;
      return toMillis(b.createdAt) - toMillis(a.createdAt);
    });
  },

  todayTasks() {
    const t = today();
    return select.tasksSorted().filter((x) => !x.done && (!x.due || x.due <= t));
  },

  openTasks() { return state.tasks.filter((t) => !t.done); },
  doneTasks() { return state.tasks.filter((t) => t.done); },

  overdueTasks() {
    const t = today();
    return state.tasks.filter((x) => !x.done && x.due && x.due < t);
  },

  eventsOn(dateStr) {
    return state.events
      .filter((e) => e.date === dateStr)
      .sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  },

  upcomingEvents(days = 7) {
    const from = today();
    const to = ymd(addDays(new Date(), days));
    return state.events
      .filter((e) => e.date >= from && e.date <= to)
      .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
  },

  goalsBy(area) {
    return state.goals.filter((g) => g.area === area);
  },

  goalProgress(goal) {
    if (Array.isArray(goal.milestones) && goal.milestones.length) {
      const done = goal.milestones.filter((m) => m.done).length;
      return pct(done, goal.milestones.length);
    }
    return clamp(Number(goal.progress) || 0, 0, 100);
  },

  savingsTotals() {
    const saved = state.savings.reduce((s, g) => s + (Number(g.saved) || 0), 0);
    const target = state.savings.reduce((s, g) => s + (Number(g.target) || 0), 0);
    return { saved, target, percent: pct(saved, target) };
  },

  monthTxns(monthKey = ymd().slice(0, 7)) {
    return state.txns.filter((t) => (t.date || '').startsWith(monthKey));
  },

  cashflow(monthKey = ymd().slice(0, 7)) {
    const list = select.monthTxns(monthKey);
    const income = list.filter((t) => t.type === 'income').reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const expense = list.filter((t) => t.type === 'expense').reduce((s, t) => s + (Number(t.amount) || 0), 0);
    return { income, expense, net: income - expense };
  },

  /** Wish-list items, unbought first, needs before wants. */
  purchasesSorted() {
    const rank = { need: 0, want: 1 };
    return [...state.purchases].sort((a, b) => {
      if (!!a.bought !== !!b.bought) return a.bought ? 1 : -1;
      if (a.bought && b.bought) return (b.boughtAt || 0) - (a.boughtAt || 0);
      const ar = rank[a.priority] ?? 1;
      const br = rank[b.priority] ?? 1;
      if (ar !== br) return ar - br;
      return toMillis(b.createdAt) - toMillis(a.createdAt);
    });
  },

  plannedPurchases() { return state.purchases.filter((p) => !p.bought); },
  boughtPurchases() { return state.purchases.filter((p) => p.bought); },

  /** What the wish list would cost if everything on it were bought. */
  plannedSpend() {
    return select.plannedPurchases().reduce((s, p) => s + (Number(p.price) || 0), 0);
  },

  /** Net for the month once every planned purchase is paid for. */
  projectedNet(monthKey = ymd().slice(0, 7)) {
    return select.cashflow(monthKey).net - select.plannedSpend();
  },

  habitsDoneToday() {
    return state.habits.filter(habitDoneToday).length;
  },

  bestStreak() {
    return state.habits.reduce((m, h) => Math.max(m, streakOf(h.log || [])), 0);
  },

  journalEntries() {
    return state.notes.filter((n) => n.type === 'journal');
  },

  /** Weighted 0-100 "life balance" across the six pillars. */
  balance() {
    const t = today();
    const dayTasks = state.tasks.filter((x) => x.due === t);
    const tasksScore = dayTasks.length
      ? pct(dayTasks.filter((x) => x.done).length, dayTasks.length)
      : select.openTasks().length === 0 && state.tasks.length
        ? 100
        : clamp(100 - select.openTasks().length * 8, 20, 100);

    const habitsScore = state.habits.length ? pct(select.habitsDoneToday(), state.habits.length) : 0;

    const goalsScore = state.goals.length
      ? Math.round(state.goals.reduce((s, g) => s + select.goalProgress(g), 0) / state.goals.length)
      : 0;

    const fin = select.savingsTotals();
    const financeScore = fin.target ? fin.percent : select.cashflow().net > 0 ? 70 : 0;

    const moodScore = (() => {
      const recent = [...Array(7)].map((_, i) => moodFor(ymd(addDays(new Date(), -i)))).filter(Boolean);
      if (!recent.length) return 0;
      const scores = { rough: 20, meh: 40, okay: 60, good: 80, great: 100 };
      return Math.round(recent.reduce((s, m) => s + (scores[m] || 60), 0) / recent.length);
    })();

    const mindScore = (() => {
      const last7 = select.journalEntries().filter((n) => toMillis(n.createdAt) > Date.now() - 7 * 86400000);
      return clamp(last7.length * 20, 0, 100);
    })();

    const pillars = [
      { id: 'productivity', label: 'Productivity', value: tasksScore },
      { id: 'habits', label: 'Habits', value: habitsScore },
      { id: 'growth', label: 'Growth', value: goalsScore },
      { id: 'finance', label: 'Finance', value: financeScore },
      { id: 'wellbeing', label: 'Well-being', value: moodScore },
      { id: 'mind', label: 'Reflection', value: mindScore }
    ];
    const overall = Math.round(pillars.reduce((s, p) => s + p.value, 0) / pillars.length);
    return { pillars, overall };
  },

  /** Tasks completed per day for the last 7 days. */
  weeklyActivity() {
    return [...Array(7)]
      .map((_, i) => {
        const d = addDays(new Date(), -(6 - i));
        const key = ymd(d);
        const count = state.tasks.filter((t) => t.done && t.doneAt && ymd(new Date(t.doneAt)) === key).length;
        return { key, label: d.toLocaleDateString(undefined, { weekday: 'narrow' }), count };
      });
  },

  earnedBadges() {
    const earned = new Set(state.profile?.badges || []);
    return BADGES.map((b) => ({ ...b, earned: earned.has(b.id) }));
  },

  /* ---------------- Monthly archive ---------------- */

  /** Every month (`YYYY-MM`) that holds data, newest first. */
  monthsWithData() {
    const set = new Set([today().slice(0, 7)]);
    const add = (v) => { if (typeof v === 'string' && v.length >= 7) set.add(v.slice(0, 7)); };
    const addMs = (ms) => { if (ms) add(ymd(new Date(ms))); };

    state.tasks.forEach((t) => { addMs(toMillis(t.createdAt)); addMs(t.doneAt); add(t.due); });
    state.events.forEach((e) => add(e.date));
    state.txns.forEach((t) => add(t.date));
    state.notes.forEach((n) => addMs(toMillis(n.createdAt)));
    state.goals.forEach((g) => addMs(toMillis(g.createdAt)));
    state.savings.forEach((g) => addMs(toMillis(g.createdAt)));
    state.moods.forEach((m) => add(m.id));
    state.prayers.forEach((p) => add(p.id));
    state.habits.forEach((h) => (h.log || []).forEach(add));

    return [...set].sort().reverse();
  },

  /** A full snapshot of one month — the heart of the archive. */
  monthSummary(monthKey = today().slice(0, 7)) {
    const [y, m] = monthKey.split('-').map(Number);
    const start = new Date(y, m - 1, 1);
    const days = new Date(y, m, 0).getDate();
    const now = new Date();
    const isCurrent = monthKey === today().slice(0, 7);
    const isFuture = monthKey > today().slice(0, 7);
    const elapsed = isFuture ? 0 : isCurrent ? now.getDate() : days;
    const inMonth = (v) => typeof v === 'string' && v.startsWith(monthKey);
    const msInMonth = (ms) => Boolean(ms) && ymd(new Date(ms)).startsWith(monthKey);

    /* Tasks */
    const tasksDone = state.tasks.filter((t) => t.done && msInMonth(t.doneAt));
    const tasksCreated = state.tasks.filter((t) => msInMonth(toMillis(t.createdAt)));

    /* Money */
    const txns = state.txns.filter((t) => inMonth(t.date));
    const income = txns.filter((t) => t.type === 'income').reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const expense = txns.filter((t) => t.type === 'expense').reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const byCategory = {};
    txns.filter((t) => t.type === 'expense').forEach((t) => {
      const k = t.category || 'other';
      byCategory[k] = (byCategory[k] || 0) + (Number(t.amount) || 0);
    });
    const topCategory = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0] || null;

    /* Habits */
    const habitRows = state.habits.map((h) => {
      const hits = (h.log || []).filter((d) => inMonth(d)).length;
      return { id: h.id, title: h.title, emoji: h.emoji || '🔥', hits, rate: pct(hits, elapsed || days) };
    });
    const habitHits = habitRows.reduce((s, h) => s + h.hits, 0);
    const habitRate = pct(habitHits, (state.habits.length || 0) * (elapsed || days));

    /* Moods */
    const moodScores = { rough: 20, meh: 40, okay: 60, good: 80, great: 100 };
    const moods = state.moods.filter((x) => inMonth(x.id));
    const moodCounts = {};
    moods.forEach((x) => { moodCounts[x.mood] = (moodCounts[x.mood] || 0) + 1; });
    const moodAvg = moods.length
      ? Math.round(moods.reduce((s, x) => s + (moodScores[x.mood] || 60), 0) / moods.length)
      : 0;
    const topMood = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    /* Salat */
    const prayerDays = state.prayers.filter((p) => inMonth(p.id));
    const prayerHits = prayerDays.reduce((s, p) => s + (Array.isArray(p.done) ? p.done.length : 0), 0);
    const fullPrayerDays = prayerDays.filter((p) => (p.done || []).length === 5).length;
    const prayerRate = pct(prayerHits, 5 * (elapsed || days));

    /* Reflection & the rest */
    const notes = state.notes.filter((n) => msInMonth(toMillis(n.createdAt)));
    const events = state.events.filter((e) => inMonth(e.date));
    const goals = state.goals.filter((g) => msInMonth(toMillis(g.createdAt)));

    /* Per-day activity, used for the little month heat strip */
    const daily = [...Array(days)].map((_, i) => {
      const key = ymd(new Date(y, m - 1, i + 1));
      return {
        key,
        day: i + 1,
        tasks: state.tasks.filter((t) => t.done && t.doneAt && ymd(new Date(t.doneAt)) === key).length,
        habits: state.habits.filter((h) => (h.log || []).includes(key)).length,
        prayers: (state.prayers.find((p) => p.id === key)?.done || []).length,
        mood: state.moods.find((x) => x.id === key)?.mood || null
      };
    });
    const busiest = [...daily].sort((a, b) => b.tasks + b.habits - (a.tasks + a.habits))[0] || null;

    const score = Math.round(
      (pct(tasksDone.length, Math.max(tasksCreated.length, tasksDone.length, 1)) +
        habitRate +
        (moodAvg || 0) +
        (income - expense > 0 ? 100 : income ? 55 : 0)) / 4
    );

    return {
      key: monthKey,
      label: start.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
      short: start.toLocaleDateString(undefined, { month: 'short' }),
      year: y,
      days,
      elapsed,
      isCurrent,
      isFuture,
      empty:
        !tasksDone.length && !txns.length && !moods.length && !notes.length &&
        !events.length && !habitHits && !prayerHits,
      tasks: { done: tasksDone.length, created: tasksCreated.length, list: tasksDone },
      money: { income, expense, net: income - expense, count: txns.length, topCategory },
      habits: { hits: habitHits, rate: habitRate, rows: habitRows.sort((a, b) => b.hits - a.hits) },
      moods: { count: moods.length, avg: moodAvg, top: topMood, counts: moodCounts },
      prayers: { hits: prayerHits, rate: prayerRate, fullDays: fullPrayerDays, tracked: prayerDays.length },
      notes: { count: notes.length, journal: notes.filter((n) => n.type === 'journal').length },
      events: { count: events.length },
      goals: { created: goals.length, completed: goals.filter((g) => select.goalProgress(g) >= 100).length },
      daily,
      busiest,
      score
    };
  }
};

/** Recomputes achievement badges and persists any newly unlocked ones. */
async function evaluateBadges() {
  if (!state.uid || !state.profile) return [];
  const have = new Set(state.profile.badges || []);
  const doneCount = state.profile.stats?.tasksDone ?? select.doneTasks().length;
  const best = select.bestStreak();
  const fin = select.savingsTotals();
  const rules = {
    'first-step': doneCount >= 1,
    'task-10': doneCount >= 10,
    'task-50': doneCount >= 50,
    'streak-7': best >= 7,
    'streak-30': best >= 30,
    saver: state.savings.some((g) => pct(Number(g.saved) || 0, Number(g.target) || 0) >= 50),
    'goal-crusher': state.goals.some((g) => select.goalProgress(g) >= 100),
    journalist: select.journalEntries().length >= 10,
    focused: (state.profile.stats?.focusSessions || 0) >= 5,
    balanced: select.balance().overall >= 80
  };
  const unlocked = Object.entries(rules)
    .filter(([id, ok]) => ok && !have.has(id))
    .map(([id]) => id);
  if (unlocked.length) {
    await updateProfileDoc({ badges: [...have, ...unlocked] });
  }
  return unlocked;
}

/** Full data export for the user (Settings → Export). */
function exportData() {
  return {
    exportedAt: new Date().toISOString(),
    profile: { ...state.profile, id: undefined },
    tasks: state.tasks,
    events: state.events,
    goals: state.goals,
    savings: state.savings,
    txns: state.txns,
    habits: state.habits,
    notes: state.notes,
    moods: state.moods,
    prayers: state.prayers,
    archive: select.monthsWithData().map((m) => select.monthSummary(m))
  };
}
return Object.freeze({ DEFAULT_PREFS, state, subscribe, connect, disconnect, create, update, setEventDeleteHook, remove, updateProfileDoc, savePrefs, prefs, currency, toggleTask, reorderTasks, togglePurchase, syncPurchaseTxn, toggleHabitDay, streakOf, habitDoneToday, setMood, moodFor, prayersOn, prayerDone, togglePrayer, prayerStreak, savePrayerPrefs, removePrayerTracker, clearPrayerDay, recordFocusSession, select, evaluateBadges, exportData });
  })();

  /* ===== js/notify.js ===== */
  const __m10 = (function () {
const store = __m8;
const { prayerSchedule } = __m9;
const { ymd, addDays, fromYmd, today } = __m1;
/**
 * LifeFlow — reminders & phone notifications.
 *
 * How it works
 * ------------
 * The app builds a rolling list of "alarms" (prayer times, calendar entries,
 * task due times, the morning digest) for the next ~36 hours and fires them
 * through the service worker, so they arrive as real system notifications even
 * when the tab is in the background.
 *
 * The same list is handed to the service worker, which re-checks it on
 * `periodicsync`. That is what lets a reminder still arrive when the app has
 * been closed — on Android/Chrome with the PWA installed.
 *
 * Known platform limits (please read before filing a bug):
 *   • iOS/iPadOS   — needs 16.4+ AND the app added to the Home Screen. Safari
 *                    tabs can never show notifications.
 *   • Any browser  — with the app fully closed, delivery is best-effort. For
 *                    guaranteed delivery a server push (FCM) is required; the
 *                    service worker already has the `push` handler for it.
 */




const DEFAULT_NOTIFY_PREFS = {
  enabled: false,
  prayers: true,
  /** Minutes before the adhan for the "get ready" nudge (0 = off). */
  prayerLead: 10,
  events: true,
  eventLead: 30,
  tasks: true,
  taskLead: 0,
  digest: false,
  digestTime: '08:00'
};

/** How far ahead alarms are pre-computed. */
const HORIZON_MS = 36 * 3600 * 1000;
/** An alarm older than this is stale — the device was probably asleep. */
const GRACE_MS = 15 * 60 * 1000;
const TICK_MS = 30 * 1000;
const FIRED_KEY = 'lf:notify:fired';
const PERIODIC_TAG = 'lifeflow-alarms';
/** Undated events and tasks are announced at this hour, local time. */
const ALLDAY_HOUR = 9;

let registration = null;
let ticker = null;
let started = false;

/* =========================================================
   Capability checks
   ========================================================= */
/** Service workers cannot be registered from file:// (index.html opened from disk). */
function swUsable() {
  return 'serviceWorker' in navigator && location.protocol !== 'file:';
}

function isSupported() {
  // From file:// reminders fall back to in-page notifications while the tab is open.
  return typeof Notification !== 'undefined' && (swUsable() || location.protocol === 'file:');
}

function permission() {
  return isSupported() ? Notification.permission : 'unsupported';
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

function isIOS() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

/** iOS only exposes the Notification API to home-screen apps. */
function needsHomeScreenInstall() {
  return isIOS() && !isStandalone();
}

/* =========================================================
   Preferences
   ========================================================= */
function notifyPrefs() {
  return { ...DEFAULT_NOTIFY_PREFS, ...(store.prefs().notify || {}) };
}

async function saveNotifyPrefs(patch) {
  const wasEnabled = notifyPrefs().enabled;
  await store.savePrefs({ notify: { ...notifyPrefs(), ...patch } });
  // Switching reminders on should not replay everything from the last quarter
  // of an hour — mark whatever is already due as handled.
  if (patch.enabled === true && !wasEnabled) markPastAsFired();
  refresh();
}

/** Silences alarms that are already due so they cannot fire retroactively. */
function markPastAsFired() {
  const now = Date.now();
  const fired = loadFired();
  for (const a of buildAlarms(now)) if (a.at <= now) fired[a.key] = now;
  saveFired(fired);
}

/* =========================================================
   Service worker
   ========================================================= */
async function registerServiceWorker() {
  if (!swUsable()) return null;
  try {
    registration = await navigator.serviceWorker.register('./sw.js', { scope: './' });
    await navigator.serviceWorker.ready;
    return registration;
  } catch (err) {
    console.warn('[notify] service worker registration failed', err);
    return null;
  }
}

async function reg() {
  if (registration) return registration;
  if (!swUsable()) return null;
  registration = (await navigator.serviceWorker.getRegistration()) || null;
  return registration;
}

/** Best-effort background wake-ups (Chrome/Android, installed PWA only). */
async function registerPeriodicSync() {
  const r = await reg();
  if (!r || !('periodicSync' in r)) return false;
  try {
    const status = await navigator.permissions.query({ name: 'periodic-background-sync' });
    if (status.state !== 'granted') return false;
    await r.periodicSync.register(PERIODIC_TAG, { minInterval: 15 * 60 * 1000 });
    return true;
  } catch {
    return false;
  }
}

/* =========================================================
   Permission
   ========================================================= */
/** Asks the OS for permission. Must be called from a user gesture. */
async function requestPermission() {
  if (!isSupported()) {
    return { ok: false, reason: needsHomeScreenInstall() ? 'ios-install' : 'unsupported' };
  }
  if (Notification.permission === 'denied') return { ok: false, reason: 'denied' };

  const result = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  if (result !== 'granted') return { ok: false, reason: result };

  await registerServiceWorker();
  await registerPeriodicSync();
  return { ok: true };
}

/* =========================================================
   Fired-alarm bookkeeping
   ========================================================= */
function loadFired() {
  try {
    const raw = JSON.parse(localStorage.getItem(FIRED_KEY) || '{}');
    const cutoff = Date.now() - 2 * 86400000;
    const out = {};
    for (const [k, v] of Object.entries(raw)) if (v > cutoff) out[k] = v;
    return out;
  } catch {
    return {};
  }
}

function saveFired(fired) {
  try {
    localStorage.setItem(FIRED_KEY, JSON.stringify(fired));
  } catch {
    /* quota — harmless */
  }
}

/* =========================================================
   Alarm construction
   ========================================================= */
function at(dateStr, hhmm) {
  const d = fromYmd(dateStr);
  if (!d) return null;
  const [h, m] = String(hhmm || '00:00').split(':').map(Number);
  d.setHours(h || 0, m || 0, 0, 0);
  return d.getTime();
}

function minus(ms, minutes) {
  return ms - (Number(minutes) || 0) * 60000;
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function prayerAlarms(p, now, horizon) {
  const pray = store.prefs().prayer;
  if (!p.prayers || !pray?.enabled) return [];

  const out = [];
  for (let offset = 0; offset <= 2; offset++) {
    const date = addDays(new Date(now), offset);
    const dateStr = ymd(date);

    for (const item of prayerSchedule(date, pray)) {
      if (!item.at) continue;
      const time = item.at.getTime();
      if (time > horizon) continue;

      const base = {
        url: '#/prayer',
        icon: null,
        tag: `prayer-${item.id}-${dateStr}`
      };

      if (p.prayerLead > 0) {
        out.push({
          ...base,
          key: `prayer:${dateStr}:${item.id}:lead`,
          at: minus(time, p.prayerLead),
          title: `${item.emoji} ${item.label} in ${p.prayerLead} min`,
          body: `${item.ar} · ${item.hhmm} — time to get ready.`
        });
      }

      out.push({
        ...base,
        key: `prayer:${dateStr}:${item.id}:now`,
        at: time,
        title: `${item.emoji} ${item.label} — ${item.ar}`,
        body: `It is ${item.hhmm}. Time for ${item.label}.`,
        requireInteraction: true
      });
    }
  }
  return out;
}

function eventAlarms(p, horizon) {
  if (!p.events) return [];
  const from = today();

  return store.state.events
    .filter((e) => e.date && e.date >= from)
    .flatMap((e) => {
      const start = e.time ? at(e.date, e.time) : at(e.date, `${String(ALLDAY_HOUR).padStart(2, '0')}:00`);
      if (start == null) return [];
      const when = e.time ? minus(start, p.eventLead) : start;
      if (when > horizon) return [];

      const lead = e.time && p.eventLead > 0 ? ` in ${p.eventLead} min` : '';
      const detail = [e.time || 'All day', e.location].filter(Boolean).join(' · ');

      return [
        {
          key: `event:${e.id}:${e.date}:${e.time || 'allday'}:${p.eventLead}`,
          at: when,
          title: `📅 ${e.title || 'Event'}${lead}`,
          body: detail || 'On your calendar today.',
          tag: `event-${e.id}`,
          url: '#/calendar'
        }
      ];
    });
}

function taskAlarms(p, horizon) {
  if (!p.tasks) return [];
  const from = today();

  return store.state.tasks
    .filter((t) => !t.done && t.due && t.due >= from)
    .flatMap((t) => {
      const due = t.time ? at(t.due, t.time) : at(t.due, `${String(ALLDAY_HOUR).padStart(2, '0')}:00`);
      if (due == null) return [];
      const when = t.time ? minus(due, p.taskLead) : due;
      if (when > horizon) return [];

      return [
        {
          key: `task:${t.id}:${t.due}:${t.time || 'allday'}:${p.taskLead}`,
          at: when,
          title: `✅ ${t.title || 'Task'}`,
          body: t.time ? `Due at ${t.time}.` : 'Due today.',
          tag: `task-${t.id}`,
          url: '#/tasks'
        }
      ];
    });
}

function digestAlarms(p, now, horizon) {
  if (!p.digest) return [];

  const out = [];
  for (let offset = 0; offset <= 1; offset++) {
    const dateStr = ymd(addDays(new Date(now), offset));
    const when = at(dateStr, p.digestTime);
    if (when == null || when > horizon) continue;

    const tasks = store.state.tasks.filter((t) => !t.done && (!t.due || t.due <= dateStr)).length;
    const events = store.state.events.filter((e) => e.date === dateStr).length;
    const parts = [];
    if (tasks) parts.push(plural(tasks, 'task', 'tasks'));
    if (events) parts.push(plural(events, 'event', 'events'));

    out.push({
      key: `digest:${dateStr}`,
      at: when,
      title: '🌅 Your day at a glance',
      body: parts.length ? `${parts.join(' · ')} ahead. Have a good one.` : 'Nothing scheduled — a clear day ahead.',
      tag: 'digest',
      url: '#/dashboard'
    });
  }
  return out;
}

/** Every alarm inside the horizon, soonest first. */
function buildAlarms(now = Date.now()) {
  const p = notifyPrefs();
  if (!p.enabled || !store.state.ready) return [];

  const horizon = now + HORIZON_MS;
  return [
    ...prayerAlarms(p, now, horizon),
    ...eventAlarms(p, horizon),
    ...taskAlarms(p, horizon),
    ...digestAlarms(p, now, horizon)
  ]
    .filter((a) => a.at != null && a.at > now - GRACE_MS && a.at <= horizon)
    .sort((a, b) => a.at - b.at);
}

/** The next few reminders — used to preview the schedule in settings. */
function upcomingAlarms(limit = 5) {
  const now = Date.now();
  return buildAlarms(now).filter((a) => a.at > now).slice(0, limit);
}

/* =========================================================
   Delivery
   ========================================================= */
async function fire(alarm) {
  const r = await reg();
  if (r) {
    await r.showNotification(alarm.title, {
      body: alarm.body,
      tag: alarm.tag || alarm.key,
      renotify: true,
      requireInteraction: !!alarm.requireInteraction,
      vibrate: [180, 90, 180],
      timestamp: alarm.at,
      data: { url: alarm.url || '#/dashboard', key: alarm.key }
    });
    r.active?.postMessage({ type: 'MARK_FIRED', key: alarm.key });
    return;
  }
  // Last resort — only works while the page is in the foreground.
  new Notification(alarm.title, { body: alarm.body, tag: alarm.tag || alarm.key });
}

/** Fires anything that has come due, then hands the rest to the worker. */
async function refresh() {
  if (!isSupported()) return;

  const p = notifyPrefs();
  const r = await reg();

  // Turned off (or permission was revoked) — make sure the worker stops too.
  if (!p.enabled || permission() !== 'granted') {
    r?.active?.postMessage({ type: 'SET_ALARMS', alarms: [] });
    return;
  }

  const now = Date.now();
  const alarms = buildAlarms(now);
  const fired = loadFired();
  let dirty = false;

  for (const a of alarms) {
    if (a.at > now || fired[a.key]) continue;
    try {
      await fire(a);
      fired[a.key] = now;
      dirty = true;
    } catch (err) {
      console.warn('[notify] could not show', a.key, err);
    }
  }
  if (dirty) saveFired(fired);

  r?.active?.postMessage({
    type: 'SET_ALARMS',
    alarms: alarms.filter((a) => a.at > now),
    fired
  });
}

/** A one-off notification so the user can check it actually works. */
async function testNotification() {
  const res = await requestPermission();
  if (!res.ok) return res;
  await fire({
    key: `test:${Date.now()}`,
    at: Date.now(),
    title: '🔔 LifeFlow reminders are on',
    body: 'This is exactly how your prayer and calendar reminders will look.',
    tag: 'lifeflow-test',
    url: '#/profile'
  });
  return { ok: true };
}

/* =========================================================
   Lifecycle
   ========================================================= */
function initNotifications() {
  if (started) return;
  started = true;

  // Register regardless of notification support: an iOS Safari tab cannot show
  // notifications, but the worker must already be in place for when the user
  // adds the app to their Home Screen.
  registerServiceWorker().then(() => {
    if (!isSupported()) return;
    registerPeriodicSync();
    refresh();
  });

  if (!isSupported()) return;

  // Rebuild whenever the data or preferences change.
  let last = '';
  store.subscribe(() => {
    // Only the fields that can move an alarm are part of the signature.
    const sig = JSON.stringify([
      notifyPrefs(),
      store.prefs().prayer,
      store.state.events.map((e) => [e.id, e.date, e.time, e.title]),
      store.state.tasks.map((t) => [t.id, t.due, t.time, t.title, !!t.done])
    ]);
    if (sig === last) return;
    last = sig;
    refresh();
  });

  clearInterval(ticker);
  ticker = setInterval(refresh, TICK_MS);

  // Background tabs get throttled hard — catch up the moment we are visible.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refresh();
  });
  window.addEventListener('focus', refresh);
}
return Object.freeze({ DEFAULT_NOTIFY_PREFS, isSupported, permission, isStandalone, isIOS, needsHomeScreenInstall, notifyPrefs, saveNotifyPrefs, registerServiceWorker, requestPermission, buildAlarms, upcomingAlarms, refresh, testNotification, initNotifications });
  })();

  /* ===== js/gcal.js ===== */
  const __m11 = (function () {
const { GOOGLE } = __m4;
const store = __m8;
const { ymd, fromYmd, addDays } = __m1;
/**
 * LifeFlow — two-way Google Calendar sync.
 *
 * Runs entirely in the browser using Google Identity Services for the OAuth
 * token and the Calendar REST API v3 for the data — no backend, no secrets.
 *
 * Sync model
 * ----------
 *   pull  Incremental via `syncToken` (falls back to a time window on the first
 *         run or when Google expires the token with HTTP 410).
 *   push  Any local event whose content signature differs from the one stored
 *         at the last sync is created or patched remotely.
 *
 * The content signature (`gcalHash`) is what stops the classic sync ping-pong:
 * an event written by the pull step already carries the matching signature, so
 * the push step correctly sees it as unchanged.
 *
 * Conflicts are resolved as "remote wins", because pull runs before push.
 */




const GIS_SRC = 'https://accounts.google.com/gsi/client';
const API = 'https://www.googleapis.com/calendar/v3';
const TOKEN_KEY = 'lf:gcal:token';
const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
const DEFAULT_DURATION = 60;

const DEFAULT_GCAL_PREFS = {
  connected: false,
  calendarId: GOOGLE.calendarId,
  calendarName: '',
  syncToken: null,
  lastSync: 0,
  autoSync: true
};

let gisPromise = null;
let tokenClient = null;
let syncing = false;

/* =========================================================
   Preferences
   ========================================================= */
/** Google sign-in only accepts http(s) origins, never file://. */
function isAvailable() {
  return location.protocol !== 'file:';
}

function isConfigured() {
  return Boolean(GOOGLE.clientId) && isAvailable();
}

function gcalPrefs() {
  return { ...DEFAULT_GCAL_PREFS, ...(store.prefs().gcal || {}) };
}

async function saveGcalPrefs(patch) {
  await store.savePrefs({ gcal: { ...gcalPrefs(), ...patch } });
}

function isConnected() {
  return isConfigured() && gcalPrefs().connected;
}

/* =========================================================
   OAuth
   ========================================================= */
function loadGis() {
  if (gisPromise) return gisPromise;
  gisPromise = new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve();
    const s = document.createElement('script');
    s.src = GIS_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not load Google Identity Services.'));
    document.head.appendChild(s);
  });
  return gisPromise;
}

/**
 * Access tokens live in sessionStorage, never localStorage: they expire in an
 * hour and should not outlive the browser session. Re-authorisation afterwards
 * is silent because consent has already been granted.
 */
function readToken() {
  try {
    const t = JSON.parse(sessionStorage.getItem(TOKEN_KEY) || 'null');
    return t && t.expiresAt > Date.now() ? t : null;
  } catch {
    return null;
  }
}

function writeToken(t) {
  try {
    if (t) sessionStorage.setItem(TOKEN_KEY, JSON.stringify(t));
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* private mode — the token simply stays in memory for this page */
  }
}

async function ensureClient() {
  if (!isConfigured()) throw new Error('Google Calendar is not configured yet.');
  await loadGis();
  if (!tokenClient) {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE.clientId,
      scope: GOOGLE.scope,
      callback: () => {}
    });
  }
  return tokenClient;
}

function requestToken(prompt) {
  return new Promise((resolve, reject) => {
    tokenClient.callback = (res) => {
      if (res.error) return reject(new Error(res.error_description || res.error));
      const t = { accessToken: res.access_token, expiresAt: Date.now() + (Number(res.expires_in || 3600) - 60) * 1000 };
      writeToken(t);
      resolve(t);
    };
    tokenClient.error_callback = (err) =>
      reject(new Error(err?.type === 'popup_closed' ? 'Sign-in was cancelled.' : 'Google sign-in failed.'));
    tokenClient.requestAccessToken({ prompt });
  });
}

/** `interactive` allows Google to show the account chooser / consent screen. */
async function getToken({ interactive = false, force = false } = {}) {
  if (!force) {
    const cached = readToken();
    if (cached) return cached;
  }
  await ensureClient();
  // An empty prompt reuses the existing grant without any UI.
  return requestToken(interactive ? 'consent' : '');
}

/* =========================================================
   REST helper
   ========================================================= */
async function api(path, { method = 'GET', params, body, interactive = false, retry = true } = {}) {
  const token = await getToken({ interactive });
  const url = new URL(API + path);
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  });

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token.accessToken}`,
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (res.status === 401 && retry) {
    writeToken(null);
    return api(path, { method, params, body, interactive, retry: false });
  }
  // 410 = the stored syncToken is too old; the caller restarts a full sync.
  if (res.status === 410) throw Object.assign(new Error('sync-token-expired'), { code: 410 });
  if (res.status === 404) throw Object.assign(new Error('not-found'), { code: 404 });

  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.error?.message || `Google Calendar error ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

/* =========================================================
   Mapping
   ========================================================= */
function dateAt(dateStr, hhmm) {
  const d = fromYmd(dateStr);
  if (!d) return null;
  const [h, m] = String(hhmm || '00:00').split(':').map(Number);
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}

function hhmmOf(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** The fields a user can actually edit — used to detect real changes. */
function signature(ev) {
  return JSON.stringify([
    ev.title || '',
    ev.type || 'event',
    ev.date || '',
    ev.time || '',
    ev.location || '',
    ev.note || '',
    ev.durationMin || null
  ]);
}

function toGoogle(ev) {
  const body = {
    summary: ev.title || 'Untitled',
    location: ev.location || '',
    description: ev.note || '',
    extendedProperties: { private: { lifeflowType: ev.type || 'event', lifeflowId: ev.id || '' } }
  };

  if (ev.time) {
    const start = dateAt(ev.date, ev.time);
    const end = new Date(start.getTime() + (Number(ev.durationMin) || DEFAULT_DURATION) * 60000);
    body.start = { dateTime: start.toISOString(), timeZone: TZ };
    body.end = { dateTime: end.toISOString(), timeZone: TZ };
  } else {
    body.start = { date: ev.date };
    body.end = { date: ymd(addDays(fromYmd(ev.date), 1)) };
  }
  return body;
}

function fromGoogle(item) {
  const allDay = Boolean(item.start?.date);
  const start = allDay ? fromYmd(item.start.date) : new Date(item.start.dateTime);
  const endRaw = item.end?.date ? fromYmd(item.end.date) : item.end?.dateTime ? new Date(item.end.dateTime) : null;

  const data = {
    title: item.summary || '(no title)',
    type: item.extendedProperties?.private?.lifeflowType || 'event',
    date: ymd(start),
    time: allDay ? null : hhmmOf(start),
    location: item.location || '',
    note: item.description || '',
    durationMin: !allDay && endRaw ? Math.max(5, Math.round((endRaw - start) / 60000)) : null
  };

  return {
    ...data,
    gcalId: item.id,
    gcalUpdated: item.updated ? Date.parse(item.updated) : Date.now(),
    gcalHash: signature(data)
  };
}

/* =========================================================
   Public actions
   ========================================================= */
async function listCalendars() {
  const res = await api('/users/me/calendarList', { params: { minAccessRole: 'writer', maxResults: 50 } });
  return (res.items || []).map((c) => ({ id: c.id, name: c.summary, primary: !!c.primary }));
}

async function connect() {
  await ensureClient();
  await getToken({ interactive: true, force: true });

  let calendarName = '';
  try {
    const cals = await listCalendars();
    calendarName = cals.find((c) => c.id === gcalPrefs().calendarId)?.name || '';
  } catch {
    /* naming the calendar is cosmetic */
  }

  await saveGcalPrefs({ connected: true, calendarName, syncToken: null });
  return syncNow();
}

async function disconnect({ revoke = true } = {}) {
  const token = readToken();
  if (revoke && token && window.google?.accounts?.oauth2) {
    try {
      window.google.accounts.oauth2.revoke(token.accessToken, () => {});
    } catch {
      /* revocation is best-effort */
    }
  }
  writeToken(null);
  await saveGcalPrefs({ connected: false, syncToken: null, lastSync: 0 });
}

/** Called by the store when a synced event is deleted locally. */
async function deleteRemote(ev) {
  if (!isConnected() || !ev?.gcalId) return;
  try {
    await api(`/calendars/${encodeURIComponent(gcalPrefs().calendarId)}/events/${encodeURIComponent(ev.gcalId)}`, {
      method: 'DELETE'
    });
  } catch (err) {
    if (err.code !== 404 && err.code !== 410) throw err; // already gone is fine
  }
}

/* =========================================================
   Sync
   ========================================================= */
async function pull(calendarId, syncToken) {
  const base = { calendarId: encodeURIComponent(calendarId) };
  const items = [];
  let pageToken = null;
  let nextSyncToken = null;

  const params = syncToken
    ? { syncToken, showDeleted: true }
    : {
        timeMin: addDays(new Date(), -GOOGLE.initialWindowDays).toISOString(),
        singleEvents: true,
        showDeleted: false,
        maxResults: 250
      };

  do {
    const res = await api(`/calendars/${base.calendarId}/events`, {
      params: { ...params, ...(pageToken ? { pageToken } : {}) }
    });
    items.push(...(res.items || []));
    pageToken = res.nextPageToken || null;
    nextSyncToken = res.nextSyncToken || nextSyncToken;
  } while (pageToken);

  return { items, nextSyncToken };
}

async function applyRemote(items) {
  let created = 0;
  let updated = 0;
  let deleted = 0;

  for (const item of items) {
    const local = store.state.events.find((e) => e.gcalId === item.id);

    if (item.status === 'cancelled') {
      if (local) {
        await store.remove('events', local.id, { skipRemote: true });
        deleted++;
      }
      continue;
    }
    if (!item.start) continue; // events without a start cannot be shown

    const mapped = fromGoogle(item);

    if (!local) {
      await store.create('events', mapped);
      created++;
    } else if ((local.gcalUpdated || 0) < mapped.gcalUpdated && local.gcalHash !== mapped.gcalHash) {
      await store.update('events', local.id, mapped);
      updated++;
    }
  }
  return { created, updated, deleted };
}

async function push(calendarId) {
  const cal = encodeURIComponent(calendarId);
  let inserted = 0;
  let patched = 0;

  for (const ev of [...store.state.events]) {
    if (!ev.date) continue;
    const sig = signature(ev);
    if (ev.gcalId && ev.gcalHash === sig) continue;

    try {
      if (!ev.gcalId) {
        const res = await api(`/calendars/${cal}/events`, { method: 'POST', body: toGoogle(ev) });
        await store.update('events', ev.id, {
          gcalId: res.id,
          gcalUpdated: res.updated ? Date.parse(res.updated) : Date.now(),
          gcalHash: sig
        });
        inserted++;
      } else {
        const res = await api(`/calendars/${cal}/events/${encodeURIComponent(ev.gcalId)}`, {
          method: 'PATCH',
          body: toGoogle(ev)
        });
        await store.update('events', ev.id, {
          gcalUpdated: res.updated ? Date.parse(res.updated) : Date.now(),
          gcalHash: sig
        });
        patched++;
      }
    } catch (err) {
      // A remotely deleted event should not block the rest of the sync.
      if (err.code === 404) await store.update('events', ev.id, { gcalId: null, gcalHash: null });
      else console.warn('[gcal] push failed for', ev.id, err);
    }
  }
  return { inserted, patched };
}

/**
 * Runs a full pull-then-push cycle.
 * @returns {Promise<{created:number,updated:number,deleted:number,inserted:number,patched:number}>}
 */
async function syncNow() {
  if (!isConnected()) throw new Error('Google Calendar is not connected.');
  if (syncing) return null;
  syncing = true;

  try {
    const p = gcalPrefs();
    let result;
    try {
      result = await pull(p.calendarId, p.syncToken);
    } catch (err) {
      if (err.code !== 410) throw err;
      result = await pull(p.calendarId, null); // token expired → full resync
    }

    const remote = await applyRemote(result.items);
    const local = await push(p.calendarId);

    await saveGcalPrefs({ syncToken: result.nextSyncToken || null, lastSync: Date.now() });
    return { ...remote, ...local };
  } finally {
    syncing = false;
  }
}

/* =========================================================
   Lifecycle
   ========================================================= */
function initGoogleCalendar() {
  if (!isConfigured()) return;

  store.setEventDeleteHook(deleteRemote);

  let armed = false;
  store.subscribe(async (s) => {
    if (armed || !s.ready || !isConnected() || !gcalPrefs().autoSync) return;
    armed = true;
    try {
      await syncNow();
    } catch (err) {
      console.warn('[gcal] initial sync failed', err.message);
    }
  });

  // A light catch-up whenever the user returns to the app.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (!isConnected() || !gcalPrefs().autoSync) return;
    if (Date.now() - (gcalPrefs().lastSync || 0) < 5 * 60 * 1000) return;
    syncNow().catch((err) => console.warn('[gcal] sync failed', err.message));
  });
}
return Object.freeze({ DEFAULT_GCAL_PREFS, isAvailable, isConfigured, gcalPrefs, isConnected, signature, listCalendars, connect, disconnect, deleteRemote, syncNow, initGoogleCalendar });
  })();

  /* ===== js/views/breathe.js ===== */
  const __m13 = (function () {
const { esc, haptic } = __m1;
const { icon } = __m3;
const { toast } = __m2;
/**
 * LifeFlow — Breathing coach.
 *
 * A guided breath-pacer that can be mounted as a dashboard widget or opened
 * full-screen from the quick menu. Long exhales activate the parasympathetic
 * ("rest and digest") system, which is why every pattern here exhales longer
 * than it inhales.
 */




const PATTERNS = [
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
function mountBreathe(container, options = {}) {
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
function openBreathe(patternId = '478') {
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
return Object.freeze({ PATTERNS, mountBreathe, openBreathe });
  })();

  /* ===== js/views/forms.js ===== */
  const __m14 = (function () {
const { esc, today, uid } = __m1;
const { icon } = __m3;
const { modal, toast, confirmDialog, confetti } = __m2;
const store = __m8;
const { TASK_CATEGORIES, PRIORITIES, EVENT_TYPES, GOAL_AREAS } = __m4;
/**
 * LifeFlow — shared create/edit forms rendered inside modals.
 * Every form works for both "new" and "edit" by passing an existing record.
 */






/* ------------------------------ helpers ------------------------------ */
const field = (label, input, hint = '') => `
  <div class="field">
    <label>${esc(label)}</label>
    ${input}
    ${hint ? `<span class="field__hint">${esc(hint)}</span>` : ''}
  </div>`;

const options = (list, selected, valueKey = 'id', labelKey = 'label') =>
  list
    .map(
      (o) =>
        `<option value="${esc(o[valueKey])}" ${o[valueKey] === selected ? 'selected' : ''}>${
          o.emoji ? `${o.emoji} ` : ''
        }${esc(o[labelKey])}</option>`
    )
    .join('');

const footer = (saveLabel = 'Save', showDelete = false) => `
  ${showDelete ? `<button class="btn btn--danger btn--icon" data-delete type="button" aria-label="Delete">${icon('trash')}</button>` : ''}
  <button class="btn btn--ghost" data-modal-close type="button">Cancel</button>
  <button class="btn btn--primary" data-save type="button">${esc(saveLabel)}</button>`;

/** Wires the save / delete buttons of a modal form. */
function wire(box, close, { collection, id, read, validate, onSaved, deleteLabel = 'this item' }) {
  const save = box.querySelector('[data-save]');
  const del = box.querySelector('[data-delete]');
  const form = box.querySelector('form');

  const submit = async () => {
    const data = read();
    const error = validate?.(data);
    if (error) { toast(error, 'error'); return; }
    save.classList.add('is-loading');
    try {
      if (id) await store.update(collection, id, data);
      else await store.create(collection, data);
      close();
      onSaved?.(data, !id);
    } catch (err) {
      console.error(err);
      toast(err.message || 'Could not save. Please try again.', 'error');
    } finally {
      save.classList.remove('is-loading');
    }
  };

  save.addEventListener('click', submit);
  form?.addEventListener('submit', (e) => { e.preventDefault(); submit(); });
  form?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && !e.shiftKey) { e.preventDefault(); submit(); }
  });

  del?.addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: 'Delete?',
      message: `This will permanently remove ${deleteLabel}.`,
      confirmText: 'Delete',
      danger: true
    });
    if (!ok) return;
    await store.remove(collection, id);
    close();
    toast('Deleted', 'info');
  });
}

/* =========================================================
   Task
   ========================================================= */
function openTaskForm(task = null, defaults = {}) {
  const t = task || {};
  modal({
    title: task ? 'Edit task' : 'New task',
    body: `
      <form class="grid" style="gap:var(--s-4)">
        ${field('What needs doing?', `<input class="input" name="title" value="${esc(t.title || '')}" placeholder="e.g. Prepare quarterly review" maxlength="140" required />`)}
        ${field('Notes', `<textarea class="textarea" name="note" style="min-height:84px" placeholder="Optional details…" maxlength="800">${esc(t.note || '')}</textarea>`)}
        <div class="g-2">
          ${field('Category', `<select class="select" name="category">${options(TASK_CATEGORIES, t.category || defaults.category || 'personal')}</select>`)}
          ${field('Priority', `<select class="select" name="priority">${options(PRIORITIES, t.priority || 'med')}</select>`)}
        </div>
        <div class="g-2">
          ${field('Due date', `<input class="input" type="date" name="due" value="${esc(t.due || defaults.due || '')}" />`)}
          ${field('Time', `<input class="input" type="time" name="time" value="${esc(t.time || '')}" />`)}
        </div>
      </form>`,
    footer: footer(task ? 'Save changes' : 'Add task', Boolean(task)),
    onMount(box, close) {
      const f = box.querySelector('form');
      wire(box, close, {
        collection: 'tasks',
        id: task?.id,
        deleteLabel: 'this task',
        read: () => ({
          title: f.title.value.trim(),
          note: f.note.value.trim(),
          category: f.category.value,
          priority: f.priority.value,
          due: f.due.value || null,
          time: f.time.value || null,
          done: t.done || false,
          order: t.order ?? Date.now() % 100000
        }),
        validate: (d) => (!d.title ? 'Please give your task a name.' : null),
        onSaved: (_, isNew) => toast(isNew ? 'Task added ✅' : 'Task updated')
      });
    }
  });
}

/* =========================================================
   Event / appointment
   ========================================================= */
function openEventForm(event = null, defaults = {}) {
  const e = event || {};
  modal({
    title: event ? 'Edit entry' : 'New event',
    body: `
      <form class="grid" style="gap:var(--s-4)">
        ${field('Title', `<input class="input" name="title" value="${esc(e.title || '')}" placeholder="e.g. Dentist appointment" maxlength="120" required />`)}
        ${field('Type', `<select class="select" name="type">${options(EVENT_TYPES, e.type || defaults.type || 'event')}</select>`)}
        <div class="g-2">
          ${field('Date', `<input class="input" type="date" name="date" value="${esc(e.date || defaults.date || today())}" required />`)}
          ${field('Time', `<input class="input" type="time" name="time" value="${esc(e.time || '')}" />`)}
        </div>
        ${field('Location', `<input class="input" name="location" value="${esc(e.location || '')}" placeholder="Optional" maxlength="120" />`)}
        ${field('Notes', `<textarea class="textarea" name="note" style="min-height:78px" maxlength="600" placeholder="Anything to remember…">${esc(e.note || '')}</textarea>`)}
      </form>`,
    footer: footer(event ? 'Save changes' : 'Add to calendar', Boolean(event)),
    onMount(box, close) {
      const f = box.querySelector('form');
      wire(box, close, {
        collection: 'events',
        id: event?.id,
        deleteLabel: 'this calendar entry',
        read: () => ({
          title: f.title.value.trim(),
          type: f.type.value,
          date: f.date.value,
          time: f.time.value || null,
          location: f.location.value.trim(),
          note: f.note.value.trim()
        }),
        validate: (d) => (!d.title ? 'Please add a title.' : !d.date ? 'Please choose a date.' : null),
        onSaved: (_, isNew) => toast(isNew ? 'Added to your calendar 📅' : 'Entry updated')
      });
    }
  });
}

/* =========================================================
   Goal (personal / professional)
   ========================================================= */
function openGoalForm(goal = null, defaults = {}) {
  const g = goal || {};
  const milestones = Array.isArray(g.milestones) ? g.milestones : [];

  modal({
    title: goal ? 'Edit goal' : 'New goal',
    body: `
      <form class="grid" style="gap:var(--s-4)">
        ${field('Goal', `<input class="input" name="title" value="${esc(g.title || '')}" placeholder="e.g. Get promoted to senior" maxlength="120" required />`)}
        ${field('Why it matters', `<textarea class="textarea" name="why" style="min-height:76px" maxlength="400" placeholder="Your motivation…">${esc(g.why || '')}</textarea>`)}
        <div class="g-2">
          ${field('Area', `<select class="select" name="area">${options(GOAL_AREAS, g.area || defaults.area || 'personal')}</select>`)}
          ${field('Target date', `<input class="input" type="date" name="target" value="${esc(g.target || '')}" />`)}
        </div>
        <div class="field">
          <label>Milestones</label>
          <div class="milestones" data-milestones>
            ${milestones.map((m) => milestoneRow(m)).join('')}
          </div>
          <button class="btn btn--sm btn--ghost mt-2" type="button" data-add-milestone>${icon('plus')} Add milestone</button>
          <span class="field__hint">Progress is calculated automatically from your milestones.</span>
        </div>
      </form>`,
    footer: footer(goal ? 'Save changes' : 'Create goal', Boolean(goal)),
    onMount(box, close) {
      const f = box.querySelector('form');
      const list = box.querySelector('[data-milestones]');

      box.querySelector('[data-add-milestone]').addEventListener('click', () => {
        list.insertAdjacentHTML('beforeend', milestoneRow({ id: uid('ms'), text: '', done: false }));
        list.lastElementChild.querySelector('input[type="text"]').focus();
      });
      list.addEventListener('click', (ev) => {
        const rm = ev.target.closest('[data-rm]');
        if (rm) rm.closest('.milestone').remove();
      });

      wire(box, close, {
        collection: 'goals',
        id: goal?.id,
        deleteLabel: 'this goal',
        read: () => ({
          title: f.title.value.trim(),
          why: f.why.value.trim(),
          area: f.area.value,
          target: f.target.value || null,
          milestones: Array.from(list.querySelectorAll('.milestone'))
            .map((row) => ({
              id: row.dataset.id,
              text: row.querySelector('input[type="text"]').value.trim(),
              done: row.querySelector('input[type="checkbox"]').checked
            }))
            .filter((m) => m.text)
        }),
        validate: (d) => (!d.title ? 'Please name your goal.' : null),
        onSaved: (_, isNew) => toast(isNew ? 'Goal created 🎯' : 'Goal updated')
      });
    }
  });
}

function milestoneRow(m) {
  return `
    <div class="milestone" data-id="${esc(m.id || uid('ms'))}">
      <label class="check">
        <input type="checkbox" ${m.done ? 'checked' : ''} />
        <span class="check__box">${icon('check')}</span>
      </label>
      <input type="text" class="input" style="min-height:38px;padding:7px 11px;font-size:.84rem" value="${esc(m.text || '')}" placeholder="Milestone…" maxlength="90" />
      <button type="button" class="iconbtn iconbtn--sm iconbtn--bare" data-rm aria-label="Remove">${icon('close')}</button>
    </div>`;
}

/* =========================================================
   Savings goal
   ========================================================= */
function openSavingsForm(goal = null) {
  const g = goal || {};
  modal({
    title: goal ? 'Edit savings goal' : 'New savings goal',
    body: `
      <form class="grid" style="gap:var(--s-4)">
        <div class="flex gap-3">
          <div class="field" style="width:88px">
            <label>Icon</label>
            <input class="input center" name="emoji" value="${esc(g.emoji || '🎯')}" maxlength="4" style="font-size:1.3rem" />
          </div>
          <div class="field grow">
            <label>Goal name</label>
            <input class="input" name="title" value="${esc(g.title || '')}" placeholder="e.g. Emergency fund" maxlength="80" required />
          </div>
        </div>
        <div class="g-2">
          ${field('Target amount', `<input class="input" type="number" name="target" min="0" step="0.01" value="${esc(g.target ?? '')}" placeholder="5000" required />`)}
          ${field('Saved so far', `<input class="input" type="number" name="saved" min="0" step="0.01" value="${esc(g.saved ?? 0)}" />`)}
        </div>
        ${field('Target date', `<input class="input" type="date" name="deadline" value="${esc(g.deadline || '')}" />`)}
      </form>`,
    footer: footer(goal ? 'Save changes' : 'Create goal', Boolean(goal)),
    onMount(box, close) {
      const f = box.querySelector('form');
      wire(box, close, {
        collection: 'savings',
        id: goal?.id,
        deleteLabel: 'this savings goal',
        read: () => ({
          emoji: f.emoji.value.trim() || '🎯',
          title: f.title.value.trim(),
          target: Number(f.target.value) || 0,
          saved: Number(f.saved.value) || 0,
          deadline: f.deadline.value || null
        }),
        validate: (d) => (!d.title ? 'Please name your goal.' : d.target <= 0 ? 'Set a target amount above zero.' : null),
        onSaved: (d, isNew) => {
          toast(isNew ? 'Savings goal created 💰' : 'Goal updated');
          if (d.saved >= d.target) confetti();
        }
      });
    }
  });
}

/** Quick "add money" sheet for a savings goal. */
function openContribute(goal) {
  modal({
    title: `Add to ${goal.title}`,
    body: `
      <form class="grid" style="gap:var(--s-4)">
        ${field('Amount', `<input class="input" type="number" name="amount" min="0" step="0.01" placeholder="100" autofocus />`)}
        <div class="chips-row" data-quick>
          ${[10, 25, 50, 100, 250].map((v) => `<button type="button" data-v="${v}">+${v}</button>`).join('')}
        </div>
      </form>`,
    footer: `<button class="btn btn--ghost" data-modal-close type="button">Cancel</button>
             <button class="btn btn--primary" data-save type="button">Add</button>`,
    onMount(box, close) {
      const f = box.querySelector('form');
      box.querySelectorAll('[data-quick] button').forEach((b) =>
        b.addEventListener('click', () => {
          f.amount.value = String((Number(f.amount.value) || 0) + Number(b.dataset.v));
        })
      );
      box.querySelector('[data-save]').addEventListener('click', async () => {
        const amount = Number(f.amount.value) || 0;
        if (amount <= 0) return toast('Enter an amount above zero.', 'error');
        const saved = (Number(goal.saved) || 0) + amount;
        await store.update('savings', goal.id, { saved });
        close();
        toast(`Added to ${goal.title} 🎉`);
        if (saved >= Number(goal.target)) { confetti(); store.evaluateBadges(); }
      });
    }
  });
}

/* =========================================================
   Transaction
   ========================================================= */
const TXN_CATEGORIES = [
  { id: 'salary', label: 'Salary', emoji: '💼' },
  { id: 'freelance', label: 'Freelance', emoji: '🧑‍💻' },
  { id: 'food', label: 'Food', emoji: '🍽️' },
  { id: 'transport', label: 'Transport', emoji: '🚌' },
  { id: 'home', label: 'Home', emoji: '🏠' },
  { id: 'shopping', label: 'Shopping', emoji: '🛍️' },
  { id: 'health', label: 'Health', emoji: '🩺' },
  { id: 'fun', label: 'Fun', emoji: '🎬' },
  { id: 'bills', label: 'Bills', emoji: '🧾' },
  { id: 'other', label: 'Other', emoji: '✨' }
];

function txnCategory(id) {
  return TXN_CATEGORIES.find((c) => c.id === id) || TXN_CATEGORIES.at(-1);
}

function openTxnForm(txn = null, defaults = {}) {
  const t = txn || {};
  modal({
    title: txn ? 'Edit entry' : 'New entry',
    body: `
      <form class="grid" style="gap:var(--s-4)">
        <div class="segmented" role="tablist" data-type style="width:100%">
          <button type="button" role="tab" data-v="expense" aria-selected="${(t.type || defaults.type || 'expense') === 'expense'}" style="flex:1">Expense</button>
          <button type="button" role="tab" data-v="income" aria-selected="${(t.type || defaults.type) === 'income'}" style="flex:1">Income</button>
        </div>
        ${field('Amount', `<input class="input" type="number" name="amount" min="0" step="0.01" value="${esc(t.amount ?? '')}" placeholder="0.00" required />`)}
        ${field('Description', `<input class="input" name="title" value="${esc(t.title || '')}" placeholder="e.g. Groceries" maxlength="90" />`)}
        <div class="g-2">
          ${field('Category', `<select class="select" name="category">${options(TXN_CATEGORIES, t.category || 'other')}</select>`)}
          ${field('Date', `<input class="input" type="date" name="date" value="${esc(t.date || today())}" />`)}
        </div>
      </form>`,
    footer: footer(txn ? 'Save changes' : 'Add entry', Boolean(txn)),
    onMount(box, close) {
      const f = box.querySelector('form');
      let type = t.type || defaults.type || 'expense';
      box.querySelectorAll('[data-type] button').forEach((b) =>
        b.addEventListener('click', () => {
          type = b.dataset.v;
          box.querySelectorAll('[data-type] button').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
        })
      );
      wire(box, close, {
        collection: 'txns',
        id: txn?.id,
        deleteLabel: 'this entry',
        read: () => ({
          type,
          amount: Number(f.amount.value) || 0,
          title: f.title.value.trim() || txnCategory(f.category.value).label,
          category: f.category.value,
          date: f.date.value || today()
        }),
        validate: (d) => (d.amount <= 0 ? 'Enter an amount above zero.' : null),
        onSaved: (_, isNew) => toast(isNew ? 'Entry saved 💸' : 'Entry updated')
      });
    }
  });
}

/* =========================================================
   Purchase — something you plan to buy
   ========================================================= */
const PURCHASE_PRIORITIES = [
  { id: 'need', label: 'Need', emoji: '❗' },
  { id: 'want', label: 'Want', emoji: '💭' }
];

function purchasePriority(id) {
  return PURCHASE_PRIORITIES.find((p) => p.id === id) || PURCHASE_PRIORITIES[1];
}

function openPurchaseForm(item = null, defaults = {}) {
  const p = item || {};
  modal({
    title: item ? 'Edit item' : 'New purchase',
    body: `
      <form class="grid" style="gap:var(--s-4)">
        ${field('What would you like to buy?', `<input class="input" name="title" value="${esc(p.title || '')}" placeholder="e.g. Running shoes" maxlength="90" required />`)}
        <div class="g-2">
          ${field(`Price (${esc(store.currency())})`, `<input class="input" type="number" name="price" min="0" step="0.01" value="${esc(p.price ?? '')}" placeholder="0.00" />`, 'Logged as an expense the moment you tick it off.')}
          ${field('Category', `<select class="select" name="category">${options(TXN_CATEGORIES, p.category || defaults.category || 'shopping')}</select>`)}
        </div>
        <div class="g-2">
          ${field('Priority', `<select class="select" name="priority">${options(PURCHASE_PRIORITIES, p.priority || defaults.priority || 'want')}</select>`)}
          ${field('Where', `<input class="input" name="shop" value="${esc(p.shop || '')}" placeholder="Optional shop or link" maxlength="160" />`)}
        </div>
        ${field('Notes', `<textarea class="textarea" name="note" style="min-height:70px" maxlength="400" placeholder="Size, colour, why you want it…">${esc(p.note || '')}</textarea>`)}
      </form>`,
    footer: footer(item ? 'Save changes' : 'Add to list', Boolean(item)),
    onMount(box, close) {
      const f = box.querySelector('form');
      wire(box, close, {
        collection: 'purchases',
        id: item?.id,
        deleteLabel: 'this item',
        read: () => ({
          title: f.title.value.trim(),
          price: Number(f.price.value) || 0,
          category: f.category.value,
          priority: f.priority.value,
          shop: f.shop.value.trim(),
          note: f.note.value.trim(),
          bought: p.bought || false,
          boughtAt: p.boughtAt ?? null,
          txnId: p.txnId ?? null
        }),
        validate: (d) =>
          !d.title ? 'What are you planning to buy?' : d.price < 0 ? 'A price cannot be negative.' : null,
        onSaved: (data, isNew) => {
          if (!isNew) store.syncPurchaseTxn({ ...p, ...data, id: item.id });
          toast(isNew ? 'Added to your list 🛒' : 'Item updated');
        }
      });
    }
  });
}

/* =========================================================
   Habit
   ========================================================= */
function openHabitForm(habit = null) {
  const h = habit || {};
  modal({
    title: habit ? 'Edit habit' : 'New habit',
    body: `
      <form class="grid" style="gap:var(--s-4)">
        <div class="flex gap-3">
          <div class="field" style="width:88px">
            <label>Icon</label>
            <input class="input center" name="emoji" value="${esc(h.emoji || '🔥')}" maxlength="4" style="font-size:1.3rem" />
          </div>
          <div class="field grow">
            <label>Habit</label>
            <input class="input" name="title" value="${esc(h.title || '')}" placeholder="e.g. Read 20 minutes" maxlength="70" required />
          </div>
        </div>
        <div class="g-2">
          ${field('Time of day', `<select class="select" name="slot">${options(
            [
              { id: 'anytime', label: 'Anytime' },
              { id: 'morning', label: 'Morning' },
              { id: 'afternoon', label: 'Afternoon' },
              { id: 'evening', label: 'Evening' }
            ],
            h.slot || 'anytime'
          )}</select>`)}
          ${field('Weekly target', `<input class="input" type="number" name="weeklyTarget" min="1" max="7" value="${esc(h.weeklyTarget || 7)}" />`)}
        </div>
        ${field('Why', `<input class="input" name="why" value="${esc(h.why || '')}" placeholder="Optional motivation" maxlength="120" />`)}
      </form>`,
    footer: footer(habit ? 'Save changes' : 'Create habit', Boolean(habit)),
    onMount(box, close) {
      const f = box.querySelector('form');
      wire(box, close, {
        collection: 'habits',
        id: habit?.id,
        deleteLabel: 'this habit and its history',
        read: () => ({
          emoji: f.emoji.value.trim() || '🔥',
          title: f.title.value.trim(),
          slot: f.slot.value,
          weeklyTarget: Math.min(7, Math.max(1, Number(f.weeklyTarget.value) || 7)),
          why: f.why.value.trim(),
          log: h.log || [],
          streak: h.streak || 0
        }),
        validate: (d) => (!d.title ? 'Please name your habit.' : null),
        onSaved: (_, isNew) => toast(isNew ? 'Habit created 🔥' : 'Habit updated')
      });
    }
  });
}

/* =========================================================
   Note / journal
   ========================================================= */
const NOTE_COLORS = ['#7c6cff', '#35d6ff', '#ff7ac6', '#2fd39b', '#ffb547', '#ff5f6d'];

function openNoteForm(note = null, defaults = {}) {
  const n = note || {};
  const type = n.type || defaults.type || 'note';
  modal({
    title: note ? 'Edit entry' : type === 'journal' ? 'New journal entry' : 'New note',
    body: `
      <form class="grid" style="gap:var(--s-4)">
        <div class="segmented" data-kind style="width:100%">
          <button type="button" data-v="note" aria-selected="${type === 'note'}" style="flex:1">Note</button>
          <button type="button" data-v="journal" aria-selected="${type === 'journal'}" style="flex:1">Journal</button>
        </div>
        ${field('Title', `<input class="input" name="title" value="${esc(n.title || '')}" placeholder="Give it a title…" maxlength="90" />`)}
        ${field('Content', `<textarea class="textarea" name="body" style="min-height:180px" placeholder="Write freely…" maxlength="8000">${esc(n.body || '')}</textarea>`)}
        <div class="field">
          <label>Colour</label>
          <div class="swatches" data-colors>
            ${NOTE_COLORS.map(
              (c) =>
                `<button type="button" class="swatch" data-c="${c}" style="background:${c}" aria-pressed="${
                  (n.color || NOTE_COLORS[0]) === c
                }" aria-label="Colour ${c}"></button>`
            ).join('')}
          </div>
        </div>
        ${field('Tags', `<input class="input" name="tags" value="${esc((n.tags || []).join(', '))}" placeholder="ideas, work, gratitude" maxlength="120" />`)}
      </form>`,
    footer: footer(note ? 'Save changes' : 'Save', Boolean(note)),
    onMount(box, close) {
      const f = box.querySelector('form');
      let color = n.color || NOTE_COLORS[0];
      let kind = type;

      box.querySelectorAll('[data-colors] .swatch').forEach((s) =>
        s.addEventListener('click', () => {
          color = s.dataset.c;
          box.querySelectorAll('[data-colors] .swatch').forEach((x) => x.setAttribute('aria-pressed', String(x === s)));
        })
      );
      box.querySelectorAll('[data-kind] button').forEach((b) =>
        b.addEventListener('click', () => {
          kind = b.dataset.v;
          box.querySelectorAll('[data-kind] button').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
        })
      );

      wire(box, close, {
        collection: 'notes',
        id: note?.id,
        deleteLabel: 'this entry',
        read: () => ({
          type: kind,
          title: f.title.value.trim() || (kind === 'journal' ? new Date().toLocaleDateString() : 'Untitled'),
          body: f.body.value,
          color,
          tags: f.tags.value
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
            .slice(0, 8)
        }),
        validate: (d) => (!d.body.trim() ? 'Write something first ✍️' : null),
        onSaved: (_, isNew) => { toast(isNew ? 'Saved 📝' : 'Updated'); store.evaluateBadges(); }
      });
    }
  });
}
return Object.freeze({ openTaskForm, openEventForm, openGoalForm, openSavingsForm, openContribute, txnCategory, openTxnForm, PURCHASE_PRIORITIES, purchasePriority, openPurchaseForm, openHabitForm, openNoteForm });
  })();

  /* ===== js/palette.js ===== */
  const __m12 = (function () {
const { esc, debounce } = __m1;
const { icon } = __m3;
const store = __m8;
const { navigate } = __m6;
const { openBreathe } = __m13;
const { openTaskForm, openEventForm, openNoteForm, openTxnForm, openHabitForm, openGoalForm, openPurchaseForm } = __m14;
/**
 * LifeFlow — command palette (⌘K / Ctrl+K, or "/").
 *
 * One box to reach everything: jump to a page, run a quick action, or search
 * across tasks, calendar entries, journal notes, goals and habits at once.
 *
 * Matching is deliberately simple and predictable rather than fuzzy — a plain
 * substring test, scored so that title matches beat body matches and earlier
 * matches beat later ones. With a few hundred records that is instant, and it
 * never surprises the user with a "clever" result they did not ask for.
 */







const MAX_PER_GROUP = 4;

const PAGES = [
  { path: '/dashboard', label: 'Dashboard', icon: 'home', keywords: 'home overview today' },
  { path: '/tasks', label: 'Tasks', icon: 'tasks', keywords: 'todo to-do checklist' },
  { path: '/calendar', label: 'Calendar', icon: 'calendar', keywords: 'events schedule agenda' },
  { path: '/finance', label: 'Money', icon: 'wallet', keywords: 'finance budget savings spending' },
  { path: '/purchases', label: 'Purchases', icon: 'cart', keywords: 'shopping wish list buy items' },
  { path: '/goals', label: 'Goals', icon: 'target', keywords: 'ambitions milestones' },
  { path: '/habits', label: 'Habits', icon: 'flame', keywords: 'streak routine daily' },
  { path: '/games', label: 'Games', icon: 'gamepad', keywords: 'play arcade tic-tac-toe memory dame checkers truth dare quiz cards couple friends goose break fun' },
  { path: '/prayer', label: 'Salat', icon: 'mosque', keywords: 'prayer salah namaz adhan', requires: 'prayer' },
  { path: '/quran', label: 'Qur’an', icon: 'quran', keywords: 'quran koran mushaf surah ayah recitation tafsir قرآن تفسير' },
  { path: '/notes', label: 'Journal', icon: 'note', keywords: 'notes diary gratitude' },
  { path: '/archive', label: 'Archive', icon: 'archive', keywords: 'history past months' },
  { path: '/profile', label: 'Profile & settings', icon: 'user', keywords: 'account theme colour reminders' }
];

const ACTIONS = [
  { label: 'New task', icon: 'tasks', keywords: 'add create todo', run: () => openTaskForm() },
  { label: 'New calendar entry', icon: 'calendar', keywords: 'add create event appointment', run: () => openEventForm() },
  { label: 'Log an expense', icon: 'wallet', keywords: 'add money spend transaction', run: () => openTxnForm(null, { type: 'expense' }) },
  { label: 'Log income', icon: 'wallet', keywords: 'add money earn transaction', run: () => openTxnForm(null, { type: 'income' }) },
  { label: 'Plan a purchase', icon: 'cart', keywords: 'add buy shopping wish list item', run: () => openPurchaseForm() },
  { label: 'New journal entry', icon: 'note', keywords: 'add write diary', run: () => openNoteForm(null, { type: 'journal' }) },
  { label: 'New habit', icon: 'flame', keywords: 'add create routine', run: () => openHabitForm() },
  { label: 'New goal', icon: 'target', keywords: 'add create ambition', run: () => openGoalForm() },
  { label: 'Take a breathing break', icon: 'leaf', keywords: 'calm relax breathe pause', run: () => openBreathe('478') },
  { label: 'Play Tic-Tac-Toe', icon: 'gamepad', keywords: 'game play noughts crosses break', run: () => navigate('/games?play=tictactoe') },
  { label: 'Play Memory', icon: 'gamepad', keywords: 'game play pairs cards break', run: () => navigate('/games?play=memory') },
  { label: 'Play Dame', icon: 'gamepad', keywords: 'game play draughts checkers break', run: () => navigate('/games?play=dame') },
  { label: 'Play Connect Four', icon: 'gamepad', keywords: 'game play four in a row puissance 4 break', run: () => navigate('/games?play=connect4') },
  { label: 'Play Reversi', icon: 'gamepad', keywords: 'game play othello discs break', run: () => navigate('/games?play=reversi') },
  { label: 'Play Dots & Boxes', icon: 'gamepad', keywords: 'game play lines squares pen paper break', run: () => navigate('/games?play=dots') },
  { label: 'Play Truth or Dare', icon: 'gamepad', keywords: 'game play party couple friends action verite questions', run: () => navigate('/games?play=truthdare') },
  { label: 'Play In Sync', icon: 'gamepad', keywords: 'game play couple friends this or that same answers match', run: () => navigate('/games?play=insync') },
  { label: 'Play Know Me?', icon: 'gamepad', keywords: 'game play couple friends guess how well do you know me', run: () => navigate('/games?play=knowme') },
  { label: 'Play Quiz Duel', icon: 'gamepad', keywords: 'game play trivia quiz questions answers culture', run: () => navigate('/games?play=quiz') },
  { label: 'Play Crazy Eights', icon: 'gamepad', keywords: 'game play cards huit americain uno deck', run: () => navigate('/games?play=eights') },
  { label: 'Play Game of the Goose', icon: 'gamepad', keywords: 'game play jeu de l oie dice board race', run: () => navigate('/games?play=goose') },
  { label: 'Listen to the Qur’an', icon: 'quran', keywords: 'quran recitation reciter continue listen surah', run: () => navigate('/quran') },
  { label: 'Read Surat Al-Kahf', icon: 'quran', keywords: 'quran kahf friday surah 18', run: () => navigate('/quran?s=18') },
  { label: 'Ayat al-Kursi', icon: 'quran', keywords: 'quran kursi throne verse 2:255', run: () => navigate('/quran?s=2&a=255') }
];

let overlay = null;
let items = [];
let cursor = 0;

/* =========================================================
   Matching
   ========================================================= */
/** Higher is better; 0 means "no match". */
function score(query, ...fields) {
  let best = 0;
  for (let i = 0; i < fields.length; i++) {
    const text = String(fields[i] || '').toLowerCase();
    if (!text) continue;
    const idx = text.indexOf(query);
    if (idx === -1) continue;
    // Field order acts as a weight: the first field is the most important one.
    const fieldWeight = 100 - i * 20;
    const positionBonus = idx === 0 ? 30 : text[idx - 1] === ' ' ? 18 : 0;
    best = Math.max(best, fieldWeight + positionBonus - Math.min(idx, 15));
  }
  return best;
}

function collect(raw) {
  const query = raw.trim().toLowerCase();
  const s = store.state;
  const groups = [];

  const add = (label, list) => {
    if (list.length) groups.push({ label, items: list.slice(0, MAX_PER_GROUP) });
  };

  const rank = (list, toEntry, ...fieldsOf) =>
    list
      .map((record) => ({ record, s: score(query, ...fieldsOf.map((f) => f(record))) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .map((x) => toEntry(x.record));

  const pages = PAGES.filter((p) => !p.requires || store.prefs()[p.requires]?.enabled);

  // Nothing typed yet — offer the most useful starting points.
  if (!query) {
    add('Quick actions', ACTIONS.map(actionEntry));
    add('Go to', pages.slice(0, MAX_PER_GROUP).map(pageEntry));
    return groups;
  }

  add(
    'Go to',
    rank(pages, pageEntry, (p) => p.label, (p) => p.keywords)
  );
  add(
    'Actions',
    rank(ACTIONS, actionEntry, (a) => a.label, (a) => a.keywords)
  );
  add(
    'Tasks',
    rank(
      s.tasks,
      (t) => ({
        label: t.title,
        hint: t.done ? 'Completed' : t.due ? `Due ${t.due}` : 'Task',
        icon: 'tasks',
        run: () => openTaskForm(t)
      }),
      (t) => t.title,
      (t) => t.note
    )
  );
  add(
    'Calendar',
    rank(
      s.events,
      (e) => ({
        label: e.title,
        hint: [e.date, e.time, e.location].filter(Boolean).join(' · '),
        icon: 'calendar',
        run: () => openEventForm(e)
      }),
      (e) => e.title,
      (e) => e.location,
      (e) => e.note
    )
  );
  add(
    'Journal',
    rank(
      s.notes,
      (n) => ({
        label: n.title || 'Untitled entry',
        hint: n.type === 'journal' ? 'Journal' : 'Note',
        icon: 'note',
        run: () => openNoteForm(n)
      }),
      (n) => n.title,
      (n) => n.body
    )
  );
  add(
    'Goals',
    rank(
      s.goals,
      (g) => ({
        label: g.title,
        hint: `${store.select.goalProgress(g)}% complete`,
        icon: 'target',
        run: () => openGoalForm(g)
      }),
      (g) => g.title,
      (g) => g.why
    )
  );
  add(
    'Habits',
    rank(
      s.habits,
      (h) => ({
        label: h.title,
        hint: `${store.streakOf(h.log || [])} day streak`,
        icon: 'flame',
        run: () => openHabitForm(h)
      }),
      (h) => h.title
    )
  );

  return groups;
}

const pageEntry = (p) => ({ label: p.label, hint: 'Page', icon: p.icon, run: () => navigate(p.path) });
const actionEntry = (a) => ({ label: a.label, hint: 'Action', icon: a.icon, run: a.run });

/* =========================================================
   Rendering
   ========================================================= */
function draw(query) {
  const list = overlay.querySelector('[data-palette-list]');
  const groups = collect(query);
  items = groups.flatMap((g) => g.items);
  cursor = 0;

  if (!items.length) {
    list.innerHTML = `<p class="palette__empty">Nothing matches “${esc(query)}”.</p>`;
    return;
  }

  let index = 0;
  list.innerHTML = groups
    .map(
      (g) => `
      <div class="palette__group">
        <div class="palette__grouplabel">${esc(g.label)}</div>
        ${g.items
          .map((it) => {
            const i = index++;
            return `
            <button class="palette__item${i === 0 ? ' is-active' : ''}" data-i="${i}" type="button" role="option" aria-selected="${i === 0}">
              <span class="palette__icon">${icon(it.icon)}</span>
              <span class="palette__label">${esc(it.label || 'Untitled')}</span>
              <span class="palette__hint">${esc(it.hint || '')}</span>
            </button>`;
          })
          .join('')}
      </div>`
    )
    .join('');
}

function move(delta) {
  if (!items.length) return;
  cursor = (cursor + delta + items.length) % items.length;
  const nodes = overlay.querySelectorAll('.palette__item');
  nodes.forEach((n, i) => {
    const active = i === cursor;
    n.classList.toggle('is-active', active);
    n.setAttribute('aria-selected', String(active));
    if (active) n.scrollIntoView({ block: 'nearest' });
  });
}

function choose(i = cursor) {
  const entry = items[i];
  if (!entry) return;
  close();
  // Let the overlay finish unwinding before a form modal takes over.
  setTimeout(() => entry.run(), 60);
}

/* =========================================================
   Open / close
   ========================================================= */
function isOpen() {
  return Boolean(overlay);
}

function close() {
  if (!overlay) return;
  const node = overlay;
  overlay = null;
  node.classList.add('is-out');
  setTimeout(() => node.remove(), 180);
  document.body.style.overflow = '';
}

function open() {
  if (overlay || !store.state.ready) return;

  overlay = document.createElement('div');
  overlay.className = 'palette';
  overlay.innerHTML = `
    <div class="palette__scrim" data-palette-close></div>
    <div class="palette__box" role="dialog" aria-modal="true" aria-label="Search LifeFlow">
      <div class="palette__search">
        <span class="palette__searchicon">${icon('search')}</span>
        <input class="palette__input" type="text" role="combobox" aria-expanded="true" aria-controls="palette-list"
               aria-autocomplete="list" placeholder="Search or jump to…" autocomplete="off" spellcheck="false" />
        <kbd class="palette__kbd">esc</kbd>
      </div>
      <div class="palette__list" id="palette-list" data-palette-list role="listbox" aria-label="Results"></div>
      <div class="palette__foot">
        <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
        <span><kbd>↵</kbd> open</span>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  const input = overlay.querySelector('.palette__input');
  draw('');
  requestAnimationFrame(() => input.focus());

  input.addEventListener('input', debounce((e) => draw(e.target.value), 90));

  overlay.querySelector('[data-palette-close]').addEventListener('click', close);

  overlay.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-i]');
    if (btn) choose(Number(btn.dataset.i));
  });

  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') return close();
    if (e.key === 'ArrowDown') { e.preventDefault(); return move(1); }
    if (e.key === 'ArrowUp') { e.preventDefault(); return move(-1); }
    if (e.key === 'Enter') { e.preventDefault(); return choose(); }
  });
}

function toggle() {
  return overlay ? close() : open();
}

/** Registers the global shortcuts. Call once at boot. */
function initPalette() {
  document.addEventListener('keydown', (e) => {
    const typing = e.target.matches?.('input, textarea, select, [contenteditable]');

    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      return toggle();
    }
    if (e.key === '/' && !typing && !overlay && !document.querySelector('.modal')) {
      e.preventDefault();
      open();
    }
  });
}
return Object.freeze({ isOpen, close, open, toggle, initPalette });
  })();

  /* ===== js/views/public.js ===== */
  const __m15 = (function () {
const { $, el, esc } = __m1;
const { icon } = __m3;
const { theme, toast, withLoading } = __m2;
const { navigate } = __m6;
const { auth, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, updateProfile, authErrorMessage } = __m7;
/**
 * LifeFlow — public (logged-out) views: landing, login, signup, forgot password.
 */






const root = () => $('#public');

/* =========================================================
   Shared chrome
   ========================================================= */
function brand() {
  return `
    <a class="brand" href="#/" aria-label="LifeFlow home">
      <svg class="brand__mark" viewBox="0 0 64 64" aria-hidden="true">
        <defs>
          <linearGradient id="bg1" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="var(--accent)"/>
            <stop offset="1" stop-color="var(--accent-2)"/>
          </linearGradient>
        </defs>
        <path d="M12 40c6-14 14-14 20 0s14 14 20 0" fill="none" stroke="url(#bg1)" stroke-width="6" stroke-linecap="round"/>
        <path d="M12 24c6-14 14-14 20 0s14 14 20 0" fill="none" stroke="url(#bg1)" stroke-width="6" stroke-linecap="round" opacity=".45"/>
      </svg>
      <span class="brand__name">LifeFlow</span>
    </a>`;
}

function nav(showAuthLinks = true) {
  return `
    <header class="pub-nav">
      ${brand()}
      <div class="pub-nav__actions">
        <button class="iconbtn themetoggle" type="button" data-theme-toggle aria-label="Toggle theme">
          ${icon('sun', 'ico-sun')}${icon('moon', 'ico-moon')}
        </button>
        ${showAuthLinks ? `<a class="btn btn--sm btn--ghost" href="#/login">Log in</a>
        <a class="btn btn--sm btn--primary" href="#/signup">Get started</a>` : ''}
      </div>
    </header>`;
}

function mount(html) {
  const node = root();
  node.innerHTML = html;
  node.hidden = false;
  $('#app').hidden = true;
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  node.querySelector('[data-theme-toggle]')?.addEventListener('click', (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    theme.toggle({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
  });
}

/* =========================================================
   Landing
   ========================================================= */
const FEATURES = [
  { icon: 'leaf', title: 'A gentle check-in', text: 'Log how you feel, breathe for a minute, and get a kind word back — every day.' },
  { icon: 'tasks', title: 'One thing at a time', text: 'Your list picks the single next step for you, so a long day never feels heavy.' },
  { icon: 'calendar', title: 'A calm calendar', text: 'Events, appointments and reminders in one soft month view. No clutter.' },
  { icon: 'flame', title: 'Habits, not pressure', text: 'Streaks that celebrate you and never scold you for missing a day.' },
  { icon: 'wallet', title: 'Money without stress', text: 'Savings goals and simple cashflow, shown in plain, friendly language.' },
  { icon: 'note', title: 'Room to reflect', text: 'A journal, three good things a day, and a mood history you actually enjoy reading.' }
];

function renderLanding() {
  mount(`
    ${nav()}
    <main class="lp">

      <section class="lp-hero">
        <div class="lp-hero__copy">
          <span class="lp-badge">${icon('leaf')} A softer way to hold your life</span>
          <h1>Your whole life, <em>gently</em> in one place.</h1>
          <p class="lp-hero__sub">
            LifeFlow keeps your days, goals, money and feelings together —
            calmly, so you can breathe out and just be present.
          </p>
          <div class="lp-cta">
            <a class="btn btn--primary" href="#/signup">Start free ${icon('arrowRight')}</a>
            <a class="btn btn--ghost" href="#/login">I already have an account</a>
          </div>
          <p class="lp-note">Free forever · No ads · Your data stays yours</p>
        </div>
        ${softPhone()}
      </section>

      <section class="lp-section">
        <div class="lp-section__head">
          <span class="eyebrow">What’s inside</span>
          <h2>Made to feel good, not busy</h2>
          <p>Every screen is built around one question: does this make the day lighter?</p>
        </div>
        <div class="lp-feats stagger">
          ${FEATURES.map(
            (f) => `
            <article class="lp-feat">
              <span class="lp-feat__icon">${icon(f.icon)}</span>
              <div>
                <h3>${f.title}</h3>
                <p>${f.text}</p>
              </div>
            </article>`
          ).join('')}
        </div>
      </section>

      <section class="lp-quote">
        ${icon('quote')}
        <p>You don’t have to do it all today. You just have to do the next kind thing.</p>
        <span>— the whole idea behind LifeFlow</span>
      </section>

      <section class="lp-final">
        <span class="eyebrow">Whenever you’re ready</span>
        <h2>Let’s make today lighter</h2>
        <p>Takes a minute to set up, and it’s yours on every device — phone first, always.</p>
        <a class="btn btn--primary" href="#/signup">Create my space ${icon('arrowRight')}</a>
      </section>

    </main>
    <footer class="pub-foot">© ${new Date().getFullYear()} LifeFlow · Take it slow.</footer>
  `);
}

function softPhone() {
  return `
    <div class="lp-art" aria-hidden="true">
      <div class="lp-phone">
        <div class="lp-phone__grip"></div>
        <div class="lp-phone__hi">Good morning, Sam<small>Nothing urgent. Start soft.</small></div>
        <div class="lp-orb">Breathe</div>
        <div class="lp-line lp-line--moods">
          <span>😔</span><span>😕</span><span>🙂</span><span>😄</span><span>🤩</span>
        </div>
        <div class="lp-line"><i>${icon('checkCircle')}</i><div>Write one page<small>If only one thing today</small></div></div>
        <div class="lp-line"><i>${icon('flame')}</i><div>Morning walk<small>12 gentle days 🌿</small></div></div>
      </div>
    </div>`;
}

/* =========================================================
   Auth shells
   ========================================================= */
function authShell({ title, subtitle, emoji, form, alt }) {
  return `
    ${nav(false)}
    <main class="auth">
      <div class="auth__card">
        <div class="auth__head">
          <div class="avatar avatar--lg" aria-hidden="true">${emoji}</div>
          <h1>${esc(title)}</h1>
          <p>${esc(subtitle)}</p>
        </div>
        ${form}
        <p class="auth__alt">${alt}</p>
      </div>
    </main>`;
}

function passwordField(id, label, autocomplete = 'current-password', hint = '') {
  return `
    <div class="field field--icon" data-field="${id}">
      <label for="${id}">${label}</label>
      ${icon('lock', 'field__icon')}
      <input class="input" id="${id}" name="${id}" type="password" required autocomplete="${autocomplete}" placeholder="••••••••" minlength="6" />
      <button type="button" class="field__action" data-toggle-pw aria-label="Show password">${icon('eye')}</button>
      ${hint ? `<span class="field__hint">${hint}</span>` : ''}
    </div>`;
}

function emailField(id = 'email') {
  return `
    <div class="field field--icon" data-field="${id}">
      <label for="${id}">Email</label>
      ${icon('mail', 'field__icon')}
      <input class="input" id="${id}" name="${id}" type="email" required autocomplete="email" inputmode="email" placeholder="you@example.com" />
    </div>`;
}

function bindPasswordToggles(scope) {
  scope.querySelectorAll('[data-toggle-pw]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = btn.parentElement.querySelector('input');
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.innerHTML = icon(show ? 'eyeOff' : 'eye');
      btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      input.focus();
    });
  });
}

function showFormError(form, message) {
  let box = form.querySelector('.form-error');
  if (!box) {
    box = el('div', { class: 'form-error', role: 'alert' });
    form.prepend(box);
  }
  box.innerHTML = `${icon('alert')}<span>${esc(message)}</span>`;
  box.style.animation = 'none';
  void box.offsetWidth;
  box.style.animation = '';
}

/* =========================================================
   Login
   ========================================================= */
function renderLogin() {
  mount(
    authShell({
      title: 'Welcome back',
      subtitle: 'Log in to pick up right where you left off.',
      emoji: '👋',
      form: `
        <form class="auth__form" novalidate>
          ${emailField()}
          ${passwordField('password', 'Password')}
          <div class="auth__meta">
            <label class="check"><input type="checkbox" name="remember" checked /><span class="check__box">${icon('check')}</span><span>Stay signed in</span></label>
            <a href="#/forgot">Forgot password?</a>
          </div>
          <button class="btn btn--primary btn--block" type="submit">Log in ${icon('arrowRight')}</button>
        </form>`,
      alt: 'New to LifeFlow? <a href="#/signup">Create an account</a>'
    })
  );

  const form = root().querySelector('form');
  bindPasswordToggles(form);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('[type="submit"]');
    const email = form.email.value.trim();
    const password = form.password.value;
    if (!email || !password) return showFormError(form, 'Please fill in your email and password.');

    try {
      await withLoading(btn, signInWithEmailAndPassword(auth, email, password));
      toast('Welcome back! 👋');
    } catch (err) {
      showFormError(form, authErrorMessage(err));
    }
  });
}

/* =========================================================
   Sign up
   ========================================================= */
function renderSignup() {
  mount(
    authShell({
      title: 'Create your flow',
      subtitle: 'One account for tasks, goals, money and habits.',
      emoji: '✨',
      form: `
        <form class="auth__form" novalidate>
          <div class="field field--icon" data-field="name">
            <label for="name">Your name</label>
            ${icon('user', 'field__icon')}
            <input class="input" id="name" name="name" type="text" required autocomplete="name" placeholder="Alex Rivera" maxlength="60" />
          </div>
          ${emailField()}
          ${passwordField('password', 'Password', 'new-password')}
          <div class="strength" aria-hidden="true">
            <div class="strength__bars"><i></i><i></i><i></i><i></i></div>
            <span class="strength__text">Use 6+ characters with a mix of letters and numbers.</span>
          </div>
          <label class="check"><input type="checkbox" name="terms" required /><span class="check__box">${icon('check')}</span>
            <span class="fs-sm t-dim">I agree to keep my data safe and use LifeFlow kindly.</span></label>
          <button class="btn btn--primary btn--block" type="submit">Create account ${icon('sparkles')}</button>
        </form>`,
      alt: 'Already have an account? <a href="#/login">Log in</a>'
    })
  );

  const form = root().querySelector('form');
  bindPasswordToggles(form);

  const bars = form.querySelectorAll('.strength__bars i');
  const label = form.querySelector('.strength__text');
  form.password.addEventListener('input', () => {
    const v = form.password.value;
    let score = 0;
    if (v.length >= 6) score++;
    if (v.length >= 10) score++;
    if (/[A-Z]/.test(v) && /[a-z]/.test(v)) score++;
    if (/\d/.test(v) || /[^\w]/.test(v)) score++;
    const words = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'];
    bars.forEach((b, i) => {
      b.className = '';
      if (i < score) b.classList.add(`on-${score}`);
    });
    label.textContent = v ? words[score] : 'Use 6+ characters with a mix of letters and numbers.';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('[type="submit"]');
    const name = form.name.value.trim();
    const email = form.email.value.trim();
    const password = form.password.value;

    if (!name) return showFormError(form, 'Please tell us your name.');
    if (password.length < 6) return showFormError(form, 'Password must be at least 6 characters.');
    if (!form.terms.checked) return showFormError(form, 'Please accept the terms to continue.');

    try {
      await withLoading(
        btn,
        (async () => {
          const cred = await createUserWithEmailAndPassword(auth, email, password);
          await updateProfile(cred.user, { displayName: name });
        })()
      );
      toast(`Welcome to LifeFlow, ${name.split(' ')[0]}! 🎉`);
    } catch (err) {
      showFormError(form, authErrorMessage(err));
    }
  });
}

/* =========================================================
   Forgot password
   ========================================================= */
function renderForgot() {
  mount(
    authShell({
      title: 'Reset your password',
      subtitle: 'We’ll email you a secure link to choose a new one.',
      emoji: '🔑',
      form: `
        <form class="auth__form" novalidate>
          ${emailField()}
          <button class="btn btn--primary btn--block" type="submit">Send reset link ${icon('mail')}</button>
          <a class="btn btn--ghost btn--block" href="#/login">${icon('chevronLeft')} Back to login</a>
        </form>`,
      alt: 'Remembered it? <a href="#/login">Log in instead</a>'
    })
  );

  const form = root().querySelector('form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('[type="submit"]');
    const email = form.email.value.trim();
    if (!email) return showFormError(form, 'Please enter your email address.');
    try {
      await withLoading(btn, sendPasswordResetEmail(auth, email));
      form.innerHTML = `
        <div class="empty">
          <div class="empty__icon">${icon('mail')}</div>
          <h3>Check your inbox</h3>
          <p>If an account exists for <b>${esc(email)}</b>, a reset link is on its way.</p>
          <a class="btn btn--primary" href="#/login">Back to login</a>
        </div>`;
      toast('Reset link sent 📬', 'success');
    } catch (err) {
      showFormError(form, authErrorMessage(err));
    }
  });
}

function hidePublic() {
  const node = root();
  node.hidden = true;
  node.innerHTML = '';
}
return Object.freeze({ navigate, renderLanding, renderLogin, renderSignup, renderForgot, hidePublic });
  })();

  /* ===== js/views/shell.js ===== */
  const __m16 = (function () {
const { $, esc, initials, firstName, today } = __m1;
const { icon } = __m3;
const { theme, modal, toast, svgDefs, confirmDialog } = __m2;
const store = __m8;
const { navigate, getCurrent } = __m6;
const { openTaskForm, openEventForm, openNoteForm, openTxnForm, openHabitForm, openGoalForm, openPurchaseForm } = __m14;
const { openBreathe } = __m13;
const { open: openPalette } = __m12;
const { nextPrayer, countdownLabel } = __m9;
const { upcomingAlarms, notifyPrefs, permission: notifyPermission } = __m10;
const { auth, signOut } = __m7;
/**
 * LifeFlow — application shell: sidebar, top bar, bottom navigation,
 * floating quick-action button and page mounting.
 */












const NAV = [
  { path: '/dashboard', label: 'Home', icon: 'home' },
  { path: '/tasks', label: 'Tasks', icon: 'tasks' },
  { path: '/calendar', label: 'Calendar', icon: 'calendar' },
  { path: '/finance', label: 'Money', icon: 'wallet' },
  { path: '/purchases', label: 'Purchases', icon: 'cart' },
  { path: '/goals', label: 'Goals', icon: 'target' },
  { path: '/habits', label: 'Habits', icon: 'flame' },
  { path: '/games', label: 'Games', icon: 'gamepad' },
  { path: '/prayer', label: 'Salat', icon: 'mosque', requires: 'prayer' },
  { path: '/quran', label: 'Qur’an', icon: 'quran' },
  { path: '/notes', label: 'Journal', icon: 'note' },
  { path: '/archive', label: 'Archive', icon: 'archive' },
  { path: '/profile', label: 'Profile', icon: 'user' }
];

/** Optional pages disappear from the menus when their feature is switched off. */
function navAvailable(item) {
  if (item.requires === 'prayer') return store.prefs().prayer.enabled;
  return true;
}
function navItems() {
  return NAV.filter(navAvailable);
}

const BOTTOM = ['/dashboard', '/tasks', '/calendar'];

const QUICK = [
  { label: 'Breathe', icon: 'leaf', run: () => openBreathe('478') },
  { label: 'New task', icon: 'tasks', run: () => openTaskForm(null, { due: today() }) },
  { label: 'New event', icon: 'calendar', run: () => openEventForm(null, { date: today() }) },
  { label: 'Log expense', icon: 'wallet', run: () => openTxnForm(null, { type: 'expense' }) },
  { label: 'Plan a purchase', icon: 'cart', run: () => openPurchaseForm() },
  { label: 'Journal entry', icon: 'note', run: () => openNoteForm(null, { type: 'journal' }) },
  { label: 'New habit', icon: 'flame', run: () => openHabitForm() },
  { label: 'New goal', icon: 'target', run: () => openGoalForm() }
];

let unsubscribeStore = null;
let activePage = null;
let quickOpen = false;

/* =========================================================
   Boot
   ========================================================= */
function initShell() {
  if (!document.getElementById('lf-defs')) {
    const holder = document.createElement('div');
    holder.id = 'lf-defs';
    holder.innerHTML = svgDefs();
    document.body.appendChild(holder);
  }
  renderSidebar();
  bindFab();
  bindScroll();
}

function showApp() {
  $('#public').hidden = true;
  $('#app').hidden = false;
}

/* =========================================================
   Sidebar (desktop)
   ========================================================= */
function renderSidebar() {
  const sidebar = $('#sidebar');
  sidebar.innerHTML = `
    <a class="brand" href="#/dashboard">
      <svg class="brand__mark" viewBox="0 0 64 64" aria-hidden="true">
        <defs>
          <linearGradient id="sbg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="var(--accent)"/><stop offset="1" stop-color="var(--accent-2)"/>
          </linearGradient>
        </defs>
        <path d="M12 40c6-14 14-14 20 0s14 14 20 0" fill="none" stroke="url(#sbg)" stroke-width="6" stroke-linecap="round"/>
        <path d="M12 24c6-14 14-14 20 0s14 14 20 0" fill="none" stroke="url(#sbg)" stroke-width="6" stroke-linecap="round" opacity=".45"/>
      </svg>
      <span class="brand__name">LifeFlow</span>
    </a>
    <nav class="sidenav" data-sidenav>
      ${NAV.map(
        (n) => `<a class="sidenav__item" href="#${n.path}" data-nav="${n.path}">${icon(n.icon)}<span>${esc(n.label)}</span><span class="sidenav__badge" data-badge="${n.path}" hidden></span></a>`
      ).join('')}
    </nav>
    <div class="sidebar__foot">
      <button class="btn btn--primary btn--block" data-quick-add type="button">${icon('plus')} Quick add</button>
      <button class="sideprofile" data-go-profile type="button">
        <span class="avatar avatar--sm" data-avatar>U</span>
        <span class="grow" style="min-width:0">
          <span class="truncate fw-7 fs-sm" data-username style="display:block">You</span>
          <span class="fs-xs t-mute truncate" style="display:block">View profile</span>
        </span>
        ${icon('chevronRight')}
      </button>
      <button class="btn btn--ghost btn--sm btn--block" data-logout type="button">${icon('logout')} Log out</button>
    </div>`;

  sidebar.querySelector('[data-quick-add]').addEventListener('click', () => openQuickMenu(true));
  sidebar.querySelector('[data-go-profile]').addEventListener('click', () => navigate('/profile'));
  sidebar.querySelector('[data-logout]').addEventListener('click', logout);
}

/* =========================================================
   Top bar
   ========================================================= */
function renderTopbar(page) {
  const topbar = $('#topbar');
  const s = store.state;
  const name = firstName(s.profile?.name || s.user?.displayName || '', s.user?.email || '');
  const overdue = store.select.overdueTasks().length;
  const photo = s.profile?.photoURL || s.user?.photoURL || '';

  topbar.innerHTML = `
    <div class="grow" style="min-width:0">
      <div class="topbar__title truncate">${esc(page?.meta?.title || 'LifeFlow')}</div>
      <div class="topbar__sub truncate">${esc(subtitleFor(page, name))}</div>
    </div>
    <div class="topbar__actions">
      <button class="iconbtn" data-search type="button" aria-label="Search — press Ctrl or Command plus K" title="Search (⌘K)">
        ${icon('search')}
      </button>
      <button class="iconbtn" data-alerts type="button" aria-label="Notifications" style="position:relative">
        ${icon('bell')}
        ${overdue ? `<span class="dot" style="position:absolute;top:8px;right:8px;background:var(--danger)"></span>` : ''}
      </button>
      <button class="iconbtn themetoggle" data-theme-toggle type="button" aria-label="Toggle theme">
        ${icon('sun', 'ico-sun')}${icon('moon', 'ico-moon')}
      </button>
      <button class="avatar avatar--sm" data-go-profile type="button" aria-label="Profile">
        ${photo ? `<img src="${esc(photo)}" alt="" />` : esc(initials(s.profile?.name || '', s.user?.email || ''))}
      </button>
    </div>`;

  topbar.querySelector('[data-theme-toggle]').addEventListener('click', (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const next = theme.toggle({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
    store.savePrefs({ theme: next }).catch(() => {});
  });
  topbar.querySelector('[data-go-profile]').addEventListener('click', () => navigate('/profile'));
  topbar.querySelector('[data-alerts]').addEventListener('click', openAlerts);
  topbar.querySelector('[data-search]').addEventListener('click', openPalette);
}

function subtitleFor(page, name) {
  const path = getCurrent();
  const map = {
    '/dashboard': `Welcome back, ${name}`,
    '/tasks': `${store.select.openTasks().length} open · ${store.select.overdueTasks().length} overdue`,
    '/calendar': `${store.select.upcomingEvents(7).length} entries in the next 7 days`,
    '/finance': 'Savings goals & cashflow',
    '/purchases': `${store.select.plannedPurchases().length} still to buy`,
    '/goals': 'Personal & professional growth',
    '/habits': `${store.select.habitsDoneToday()}/${store.state.habits.length} done today`,
    '/games': 'Play solo, or invite a friend',
    '/quran': 'Read along while you listen',
    '/notes': `${store.state.notes.length} entries`,
    '/profile': 'Make LifeFlow yours'
  };
  return map[path] || '';
}

/* =========================================================
   Bottom navigation
   ========================================================= */
function renderBottomNav() {
  const nav = $('#bottomnav');
  const path = getCurrent();
  const items = NAV.filter((n) => BOTTOM.includes(n.path));

  const tab = (n) =>
    `<button class="navbtn${path === n.path ? ' is-active' : ''}" data-nav="${n.path}" type="button" aria-current="${
      path === n.path ? 'page' : 'false'
    }">${icon(n.icon)}<span>${esc(n.label)}</span></button>`;

  nav.innerHTML = `
    ${tab(items[0])}
    ${tab(items[1])}
    <button class="navbtn navbtn--add" data-add type="button" aria-label="Quick add" aria-haspopup="menu">${icon('plus')}<span>Add</span></button>
    ${tab(items[2])}
    <button class="navbtn${!BOTTOM.includes(path) ? ' is-active' : ''}" data-more type="button">${icon('more')}<span>More</span></button>`;

  nav.querySelectorAll('[data-nav]').forEach((b) => b.addEventListener('click', () => navigate(b.dataset.nav)));
  nav.querySelector('[data-add]').addEventListener('click', () => openQuickMenu(!quickOpen));
  nav.querySelector('[data-more]').addEventListener('click', openMoreSheet);
}

function openMoreSheet() {
  const extras = navItems().filter((n) => !BOTTOM.includes(n.path));
  const current = getCurrent();
  modal({
    title: 'More',
    body: `
      <div class="moregrid">
        ${extras
          .map(
            (n) => `<button class="moretile${current === n.path ? ' is-active' : ''}" data-goto="${n.path}" type="button">
              <span class="moretile__icon">${icon(n.icon)}</span>
              <span class="moretile__label">${esc(n.label)}</span>
            </button>`
          )
          .join('')}
      </div>
      <div class="moreactions">
        <button class="btn btn--sm btn--ghost grow" data-theme-toggle type="button">
          ${icon(theme.get() === 'dark' ? 'sun' : 'moon')} ${theme.get() === 'dark' ? 'Light' : 'Dark'} mode
        </button>
        <button class="btn btn--sm btn--ghost" data-logout type="button" style="color:var(--danger)">
          ${icon('logout')} Log out
        </button>
      </div>`,
    onMount(box, close) {
      box.querySelectorAll('[data-goto]').forEach((b) =>
        b.addEventListener('click', () => { close(); navigate(b.dataset.goto); })
      );
      box.querySelector('[data-theme-toggle]').addEventListener('click', (e) => {
        const r = e.currentTarget.getBoundingClientRect();
        const next = theme.toggle({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
        store.savePrefs({ theme: next }).catch(() => {});
        close();
      });
      box.querySelector('[data-logout]').addEventListener('click', async () => { close(); await logout(); });
    }
  });
}

/* =========================================================
   Alerts sheet
   ========================================================= */
function openAlerts() {
  const prefs = store.prefs();
  const overdue = store.select.overdueTasks();
  const todayEvents = store.select.eventsOn(today());
  const dueToday = store.state.tasks.filter((t) => !t.done && t.due === today());

  const section = (title, items, render) =>
    items.length
      ? `<div class="mb-4"><div class="task-group__label mb-2">${title}</div>${items.map(render).join('')}</div>`
      : '';

  const row = (ic, title, sub, tint = '') =>
    `<div class="row"><span class="row__icon"${tint ? ` style="color:${tint}"` : ''}>${icon(ic)}</span>
      <div class="row__main"><div class="row__title">${esc(title)}</div>${sub ? `<div class="row__sub">${esc(sub)}</div>` : ''}</div></div>`;

  // Next prayer — only when the tracker is switched on.
  let prayerBlock = '';
  if (prefs.prayer?.enabled) {
    try {
      const up = nextPrayer(new Date(), prefs.prayer);
      prayerBlock = section('Next prayer', [up], (u) =>
        row('mosque', `${u.next.label} · ${u.next.time}`, `In ${countdownLabel(u.in)}${u.tomorrow ? ' (tomorrow)' : ''}`, 'var(--accent)')
      );
    } catch {
      /* Times need a location; the Salat page explains how to set one. */
    }
  }

  // Scheduled phone reminders, straight from the notification engine.
  const remindersOn = notifyPrefs().enabled && notifyPermission() === 'granted';
  const reminders = remindersOn ? upcomingAlarms(4) : [];
  const remindersBlock = remindersOn
    ? section('Reminders queued', reminders, (a) =>
        row('bell', a.title, new Date(a.at).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' }))
      )
    : `<div class="mb-4"><div class="task-group__label mb-2">Reminders</div>
         ${row('bell', 'Phone reminders are off', 'Turn them on in Profile → Reminders')}</div>`;

  const hasSomething = overdue.length || todayEvents.length || dueToday.length || prayerBlock || reminders.length;

  const body = hasSomething
    ? `
      ${section('Overdue', overdue, (t) => row('alert', t.title, `Was due ${t.due}`, 'var(--danger)'))}
      ${section('Due today', dueToday, (t) => row('tasks', t.title, t.time || ''))}
      ${section('Today’s schedule', todayEvents, (e) => row('calendar', e.title, e.time || 'All day'))}
      ${prayerBlock}
      ${remindersBlock}`
    : `<div class="empty"><div class="empty__icon">${icon('checkCircle')}</div><h3>All caught up</h3><p>No overdue items and nothing urgent today.</p></div>
       ${remindersBlock}`;

  modal({ title: 'Today at a glance', body });
}

/* =========================================================
   FAB + quick menu
   ========================================================= */
function bindFab() {
  const fab = $('#fab');
  fab.addEventListener('click', () => openQuickMenu(!quickOpen));
}

function openQuickMenu(open) {
  const existing = document.querySelector('.quickmenu');
  existing?.remove();
  quickOpen = open;
  $('#fab').classList.toggle('is-open', open);
  document.querySelector('[data-add]')?.classList.toggle('is-open', open);
  if (!open) return;

  const menu = document.createElement('div');
  menu.className = 'quickmenu';
  menu.innerHTML = QUICK.map(
    (q, i) => `<button class="quickmenu__item" data-q="${i}" type="button">${icon(q.icon)}<span>${esc(q.label)}</span></button>`
  ).join('');
  document.body.appendChild(menu);

  menu.querySelectorAll('[data-q]').forEach((b) =>
    b.addEventListener('click', () => {
      const item = QUICK[Number(b.dataset.q)];
      openQuickMenu(false);
      item.run();
    })
  );

  const away = (e) => {
    if (!e.target.closest('.quickmenu') && !e.target.closest('#fab') && !e.target.closest('[data-add]')) {
      openQuickMenu(false);
      document.removeEventListener('click', away);
    }
  };
  setTimeout(() => document.addEventListener('click', away), 10);
}

/* =========================================================
   Scroll behaviour: sticky topbar shadow + hide nav on scroll down
   ========================================================= */
function bindScroll() {
  let last = 0;
  window.addEventListener(
    'scroll',
    () => {
      const y = window.scrollY;
      $('#topbar')?.classList.toggle('is-stuck', y > 6);
      const nav = $('#bottomnav');
      const fab = $('#fab');
      if (nav && innerWidth < 900) {
        const down = y > last && y > 140;
        nav.classList.toggle('is-hidden', down);
        fab?.classList.toggle('is-hidden', down);
        if (down) openQuickMenu(false);
      }
      last = y;
    },
    { passive: true }
  );
}

/* =========================================================
   Page mounting
   ========================================================= */
function mountPage(pageModule) {
  const view = $('#view');
  // Give the outgoing page a chance to tidy up (listeners, live calls, timers).
  if (activePage && activePage !== pageModule) activePage.unmount?.();
  activePage = pageModule;
  unsubscribeStore?.();

  const paint = () => {
    if (activePage !== pageModule) return;
    if (store.state.loading) {
      view.innerHTML = skeleton();
      renderTopbar(pageModule);
      renderBottomNav();
      return;
    }
    pageModule.render(view);
    renderTopbar(pageModule);
    renderBottomNav();
    syncSidebar();
  };

  paint();
  unsubscribeStore = store.subscribe(paint);
  window.scrollTo({ top: 0 });
  view.focus?.({ preventScroll: true });
}

function unmountPage() {
  unsubscribeStore?.();
  unsubscribeStore = null;
  activePage?.unmount?.();
  activePage = null;
}

function syncSidebar() {
  const path = getCurrent();
  const s = store.state;
  document.querySelectorAll('[data-nav]').forEach((a) => {
    if (a.classList.contains('sidenav__item')) a.classList.toggle('is-active', a.dataset.nav === path);
    const item = NAV.find((n) => n.path === a.dataset.nav);
    if (item?.requires) a.hidden = !navAvailable(item) && path !== item.path;
  });
  const counts = {
    '/tasks': store.select.openTasks().length,
    '/calendar': store.select.eventsOn(today()).length,
    '/purchases': store.select.plannedPurchases().length,
    '/habits': s.habits.length - store.select.habitsDoneToday()
  };
  document.querySelectorAll('[data-badge]').forEach((b) => {
    const n = counts[b.dataset.badge] || 0;
    b.hidden = n <= 0;
    b.textContent = String(n);
  });
  const avatar = document.querySelector('[data-avatar]');
  if (avatar) {
    const photo = s.profile?.photoURL || s.user?.photoURL || '';
    avatar.innerHTML = photo ? `<img src="${esc(photo)}" alt="" />` : esc(initials(s.profile?.name || '', s.user?.email || ''));
  }
  const uname = document.querySelector('[data-username]');
  if (uname) uname.textContent = s.profile?.name || s.user?.displayName || s.user?.email || 'You';
}

function skeleton() {
  return `
    <div class="page">
      <div class="skel" style="height:170px;border-radius:32px"></div>
      <div class="g-4">
        ${'<div class="skel" style="height:98px"></div>'.repeat(4)}
      </div>
      <div class="skel" style="height:230px"></div>
      <div class="skel" style="height:180px"></div>
    </div>`;
}

async function logout() {
  const ok = await confirmDialog({ title: 'Log out?', message: 'You can always come back to your flow.', confirmText: 'Log out' });
  if (!ok) return;
  try {
    await signOut(auth);
    toast('Logged out — see you soon 👋', 'info');
  } catch {
    toast('Could not log out. Please retry.', 'error');
  }
}
return Object.freeze({ initShell, showApp, mountPage, unmountPage });
  })();

  /* ===== js/views/focus.js ===== */
  const __m18 = (function () {
const { el, esc } = __m1;
const { icon } = __m3;
const { ring, animateProgress, toast, confetti } = __m2;
const store = __m8;
/**
 * LifeFlow — Pomodoro / focus timer.
 * A single shared timer instance so it keeps running while you browse pages.
 */





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
function mountFocus(container) {
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

const focusTimer = {
  isRunning: () => timer.running,
  start,
  stop,
  reset,
  setMode
};
return Object.freeze({ mountFocus, focusTimer });
  })();

  /* ===== js/arcade/games/tictactoe.js ===== */
  const __m20 = (function () {

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

const meta = {
  id: 'tictactoe',
  group: ['board', 'friends'],
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

function create() {
  return { board: Array(9).fill(0), turn: 0, last: -1, moves: 0 };
}

function turn(state) {
  return state.turn;
}

function apply(state, move) {
  const i = Number(move?.i);
  if (!Number.isInteger(i) || i < 0 || i > 8) return null;
  if (state.board[i] !== 0 || outcome(state).over) return null;

  const board = state.board.slice();
  board[i] = state.turn + 1;
  return { board, turn: 1 - state.turn, last: i, moves: state.moves + 1 };
}

function outcome(state) {
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
function auto() {
  return null;
}

/* ------------------------------ opponent ------------------------------ */
const SLOPPY = { gentle: 0.6, even: 0.22, sharp: 0 };

function ai(state, seat, level = 'even') {
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

function view(state, ctx) {
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

function bind(root, state, ctx, play) {
  root.querySelectorAll('[data-cell]').forEach((b) =>
    b.addEventListener('click', () => play({ i: Number(b.dataset.cell) }))
  );
}

/** One-line nudge shown under the board. */
function coach(state, ctx) {
  if (state.moves === 0) return ctx.myTurn ? 'Corners age well. So do middles.' : 'Watch where they open.';
  return '';
}
return Object.freeze({ meta, create, turn, apply, outcome, auto, ai, view, bind, coach });
  })();

  /* ===== js/arcade/games/memory.js ===== */
  const __m21 = (function () {

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

const meta = {
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

function create() {
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

function turn(state) {
  return state.turn;
}

function apply(state, move) {
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

function outcome(state) {
  if (!state.face.every((f) => f === 1)) return { over: false, winner: null, draw: false };
  const [a, b] = state.scores;
  return { over: true, winner: a === b ? null : a > b ? 0 : 1, draw: a === b };
}

function note(state, seat) {
  return `${state.scores[seat]} pairs`;
}

/** After a miss the cards flip back on their own, once everyone has seen them. */
function auto(state) {
  if (state.open.length === 2) return { move: { settle: true }, delay: 1150 };
  return null;
}

/* ------------------------------ opponent ------------------------------ */
const RECALL = { gentle: 0.34, even: 0.72, sharp: 1 };

function ai(state, seat, level = 'even') {
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

function view(state, ctx) {
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

function bind(root, state, ctx, play) {
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

function coach(state, ctx) {
  if (state.open.length === 2) return 'Hold the picture in mind…';
  if (state.moves === 0) return ctx.myTurn ? 'Start anywhere. Notice, don’t rush.' : '';
  return '';
}
return Object.freeze({ meta, create, turn, apply, outcome, note, auto, ai, view, bind, coach });
  })();

  /* ===== js/arcade/games/dame.js ===== */
  const __m22 = (function () {

/**
 * LifeFlow Arcade — Dame (draughts / checkers, 8×8).
 *
 * Board encoding, flat so it survives a trip through Firestore:
 *   0 empty · 1 light man · 2 light king · 3 dark man · 4 dark king
 * Seat 0 plays the light pieces from the bottom, seat 1 the dark from the top.
 */

const DIRS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

const rc = (i) => [i >> 3, i & 7];
const idx = (r, c) => r * 8 + c;
const inside = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
const dark = (r, c) => (r + c) % 2 === 1;
const seatOf = (v) => (v === 0 ? -1 : v <= 2 ? 0 : 1);
const isKing = (v) => v === 2 || v === 4;
const forward = (seat) => (seat === 0 ? -1 : 1);

const meta = {
  id: 'dame',
  group: ['board', 'brain'],
  title: 'Dame',
  emoji: '⚪',
  tagline: 'Draughts, with room to think.',
  blurb: 'Diagonal steps, forced captures and long jump chains. Reach the far side and your piece is crowned.',
  minutes: '10 min',
  tags: ['Strategy', 'Deep'],
  alternate: false,
  levels: [
    { id: 'gentle', label: 'Gentle', hint: 'Looks one move ahead.' },
    { id: 'even', label: 'Even', hint: 'Thinks a few moves ahead.' },
    { id: 'sharp', label: 'Sharp', hint: 'Plans, and punishes.' }
  ],
  rules: [
    'Men step forward diagonally onto dark squares.',
    'Captures are compulsory — and chain while jumps remain.',
    'Reach the far row to be crowned; kings move both ways.',
    'No pieces or no moves left means the game is lost.'
  ]
};

function create() {
  const board = Array(64).fill(0);
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (!dark(r, c)) continue;
      if (r < 3) board[idx(r, c)] = 3;
      else if (r > 4) board[idx(r, c)] = 1;
    }
  }
  return { board, turn: 0, chain: null, last: null, moves: 0, still: 0 };
}

function turn(state) {
  return state.turn;
}

/** Every legal move for the side to play — captures only, when one exists. */
function moves(state) {
  const { board, turn: seat } = state;
  const chain = state.chain ?? null;
  const caps = [];
  const quiet = [];

  const from = [];
  if (chain !== null) from.push(chain);
  else for (let i = 0; i < 64; i++) if (seatOf(board[i]) === seat) from.push(i);

  for (const f of from) {
    const v = board[f];
    if (seatOf(v) !== seat) continue;
    const [r, c] = rc(f);
    const dirs = isKing(v) ? DIRS : DIRS.filter((d) => d[0] === forward(seat));

    for (const [dr, dc] of dirs) {
      const mr = r + dr;
      const mc = c + dc;
      if (!inside(mr, mc)) continue;
      const mid = board[idx(mr, mc)];
      const tr = r + dr * 2;
      const tc = c + dc * 2;

      if (mid !== 0 && seatOf(mid) !== seat && inside(tr, tc) && board[idx(tr, tc)] === 0) {
        caps.push({ from: f, to: idx(tr, tc), cap: idx(mr, mc) });
      } else if (mid === 0 && chain === null) {
        quiet.push({ from: f, to: idx(mr, mc), cap: -1 });
      }
    }
  }

  if (caps.length) return caps;
  return chain !== null ? [] : quiet;
}

function apply(state, move) {
  const m = moves(state).find((x) => x.from === move?.from && x.to === move?.to);
  if (!m) return null;

  const board = state.board.slice();
  const piece = board[m.from];
  board[m.from] = 0;
  board[m.to] = piece;
  if (m.cap >= 0) board[m.cap] = 0;

  let crowned = false;
  const [tr] = rc(m.to);
  if (piece === 1 && tr === 0) { board[m.to] = 2; crowned = true; }
  if (piece === 3 && tr === 7) { board[m.to] = 4; crowned = true; }

  const settled = {
    ...state,
    board,
    last: { from: m.from, to: m.to, cap: m.cap, crowned },
    moves: state.moves + 1,
    still: m.cap >= 0 || crowned ? 0 : (state.still || 0) + 1
  };

  const chains =
    m.cap >= 0 && !crowned && moves({ ...settled, chain: m.to, turn: state.turn }).some((x) => x.cap >= 0);

  settled.chain = chains ? m.to : null;
  settled.turn = chains ? state.turn : 1 - state.turn;
  return settled;
}

function outcome(state) {
  let light = 0;
  let darkCount = 0;
  for (const v of state.board) {
    if (seatOf(v) === 0) light++;
    else if (seatOf(v) === 1) darkCount++;
  }
  if (!light) return { over: true, winner: 1, draw: false };
  if (!darkCount) return { over: true, winner: 0, draw: false };
  if ((state.still || 0) >= 60) return { over: true, winner: null, draw: true };
  if (!moves(state).length) return { over: true, winner: 1 - state.turn, draw: false };
  return { over: false, winner: null, draw: false };
}

function auto() {
  return null;
}

/* ------------------------------ opponent ------------------------------ */
const DEPTH = { gentle: 1, even: 4, sharp: 6 };
const BUDGET = 90000;
let visited = 0;

function ai(state, seat, level = 'even') {
  const list = moves(state);
  if (!list.length) return null;
  if (list.length === 1) return list[0];

  if (level === 'gentle' && Math.random() < 0.35) {
    return list[Math.floor(Math.random() * list.length)];
  }

  visited = 0;
  let best = list[0];
  let bestScore = -Infinity;
  const depth = DEPTH[level] ?? 4;

  for (const m of list) {
    const next = apply(state, m);
    if (!next) continue;
    const score = search(next, depth - 1, -Infinity, Infinity, seat) + Math.random() * 0.8;
    if (score > bestScore) { bestScore = score; best = m; }
  }
  return best;
}

function search(state, depth, alpha, beta, me) {
  const out = outcome(state);
  if (out.over) {
    if (out.draw) return 0;
    return out.winner === me ? 100000 + depth : -100000 - depth;
  }
  if (depth <= 0 || ++visited > BUDGET) return evaluate(state, me);

  const list = moves(state);
  const maximizing = state.turn === me;
  let best = maximizing ? -Infinity : Infinity;

  for (const m of list) {
    const next = apply(state, m);
    if (!next) continue;
    const score = search(next, depth - 1, alpha, beta, me);
    if (maximizing) {
      if (score > best) best = score;
      if (best > alpha) alpha = best;
    } else {
      if (score < best) best = score;
      if (best < beta) beta = best;
    }
    if (beta <= alpha) break;
  }
  return best;
}

function evaluate(state, me) {
  let score = 0;
  for (let i = 0; i < 64; i++) {
    const v = state.board[i];
    if (!v) continue;
    const seat = seatOf(v);
    const [r, c] = rc(i);
    let val = isKing(v) ? 190 : 100;
    if (!isKing(v)) val += (seat === 0 ? 7 - r : r) * 7;
    val += (3.5 - Math.abs(3.5 - c)) * 2;
    if (c === 0 || c === 7) val += 5;
    score += seat === me ? val : -val;
  }
  return score;
}

/* ------------------------------ view ------------------------------ */
let sel = null;
let selKey = '';

function syncSelection(state, ctx) {
  const key = `${ctx.sessionKey || ''}:${state.moves}`;
  if (key === selKey) return;
  selKey = key;
  // A jump chain locks onto one piece — pre-select it so the eye follows along.
  sel = state.chain !== null && state.chain !== undefined && ctx.myTurn ? state.chain : null;
}

function view(state, ctx) {
  syncSelection(state, ctx);

  const out = outcome(state);
  const list = !out.over && ctx.myTurn ? moves(state) : [];
  const movable = new Set(list.map((m) => m.from));
  const targets = new Map(list.filter((m) => m.from === sel).map((m) => [m.to, m]));
  const flip = ctx.seat === 1;

  const order = [...Array(64).keys()];
  if (flip) order.reverse();

  const squares = order
    .map((i) => {
      const [r, c] = rc(i);
      const v = state.board[i];
      const seat = seatOf(v);
      const isDark = dark(r, c);
      const isTarget = targets.has(i);
      const moved = state.last && state.last.to === i;
      const captured = state.last && state.last.cap === i;

      let slide = '';
      if (moved && state.last.from !== undefined) {
        const [fr, fc] = rc(state.last.from);
        const dx = (fc - c) * (flip ? -1 : 1);
        const dy = (fr - r) * (flip ? -1 : 1);
        slide = `--dx:${dx};--dy:${dy};`;
      }

      return `
      <div class="dame__sq${isDark ? ' is-dark' : ''}${sel === i ? ' is-sel' : ''}${isTarget ? ' is-target' : ''}"
           data-sq="${i}" style="--d:${(r + c) * 18}ms">
        ${
          v
            ? `<span class="dame__piece dame__piece--${seat}${isKing(v) ? ' is-king' : ''}${moved ? ' is-moved' : ''}${
                movable.has(i) && !sel ? ' is-ready' : ''
              }" style="${slide}">
                 <span class="dame__gloss"></span>
                 ${isKing(v) ? '<span class="dame__crown">✦</span>' : ''}
               </span>`
            : ''
        }
        ${isTarget ? '<span class="dame__dot"></span>' : ''}
        ${captured ? '<span class="dame__poof"></span>' : ''}
      </div>`;
    })
    .join('');

  return `
    <div class="dame${out.over ? ' is-over' : ''}">
      <div class="dame__board" role="grid" aria-label="Dame board">${squares}</div>
    </div>`;
}

function bind(root, state, ctx, play) {
  const list = !outcome(state).over && ctx.myTurn ? moves(state) : [];

  root.querySelectorAll('[data-sq]').forEach((sq) =>
    sq.addEventListener('click', () => {
      const i = Number(sq.dataset.sq);

      if (sel !== null) {
        const move = list.find((m) => m.from === sel && m.to === i);
        if (move) { sel = null; play({ from: move.from, to: move.to }); return; }
      }

      const mine = list.some((m) => m.from === i);
      sel = mine && sel !== i ? i : null;
      ctx.refresh?.();
    })
  );
}

function coach(state, ctx) {
  if (!ctx.myTurn) return '';
  if (state.chain !== null && state.chain !== undefined) return 'The jump continues — keep going.';
  const list = moves(state);
  if (list.length && list[0].cap >= 0) return 'A capture is on the board, so a capture it is.';
  if (state.moves === 0) return 'Open towards the middle. Keep your back row a while.';
  return '';
}
return Object.freeze({ meta, create, turn, moves, apply, outcome, auto, ai, view, bind, coach });
  })();

  /* ===== js/arcade/games/connect4.js ===== */
  const __m23 = (function () {

/**
 * LifeFlow Arcade — Connect Four.
 * 7 × 6 board stored flat (row-major, row 0 at the top) so it stays
 * Firestore-friendly. The computer is a negamax search with alpha-beta.
 */

const COLS = 7;
const ROWS = 6;
const CELLS = COLS * ROWS;

/** Every possible run of four, precomputed once. */
const LINES = (() => {
  const out = [];
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      for (const [dr, dc] of dirs) {
        const er = r + dr * 3;
        const ec = c + dc * 3;
        if (er < 0 || er >= ROWS || ec < 0 || ec >= COLS) continue;
        out.push([0, 1, 2, 3].map((k) => (r + dr * k) * COLS + (c + dc * k)));
      }
    }
  }
  return out;
})();

const ORDER = [3, 2, 4, 1, 5, 0, 6];

const meta = {
  id: 'connect4',
  group: ['board', 'friends'],
  title: 'Connect Four',
  emoji: '🔴',
  tagline: 'Drop, block, line up four.',
  blurb: 'Gravity does half the work. Think one disc ahead and you will win often — two ahead and you will win a lot.',
  minutes: '5 min',
  tags: ['Classic', 'Tactics'],
  alternate: true,
  levels: [
    { id: 'gentle', label: 'Gentle', hint: 'Looks a move ahead, sometimes wanders.' },
    { id: 'even', label: 'Even', hint: 'Blocks your threats and builds its own.' },
    { id: 'sharp', label: 'Sharp', hint: 'Reads deep. Control the centre.' }
  ],
  rules: [
    'Take turns dropping a disc into any column that is not full.',
    'Discs fall to the lowest free space.',
    'Four of your discs in a row — across, down or diagonally — wins.',
    'A full board with no four is a draw.'
  ]
};

function create() {
  return { board: Array(CELLS).fill(0), turn: 0, last: -1, moves: 0 };
}

function turn(state) {
  return state.turn;
}

function dropRow(board, c) {
  for (let r = ROWS - 1; r >= 0; r--) if (board[r * COLS + c] === 0) return r;
  return -1;
}

function apply(state, move) {
  const c = Number(move?.c);
  if (!Number.isInteger(c) || c < 0 || c >= COLS) return null;
  if (outcome(state).over) return null;
  const r = dropRow(state.board, c);
  if (r < 0) return null;
  const board = state.board.slice();
  const i = r * COLS + c;
  board[i] = state.turn + 1;
  return { board, turn: 1 - state.turn, last: i, moves: state.moves + 1 };
}

function winnerOf(board) {
  for (const line of LINES) {
    const v = board[line[0]];
    if (v && v === board[line[1]] && v === board[line[2]] && v === board[line[3]]) return { v, line };
  }
  return null;
}

function outcome(state) {
  const w = winnerOf(state.board);
  if (w) return { over: true, winner: w.v - 1, draw: false, line: w.line };
  if (state.moves >= CELLS || state.board.every((v) => v !== 0)) return { over: true, winner: null, draw: true, line: null };
  return { over: false, winner: null, draw: false, line: null };
}

function auto() {
  return null;
}

/* ------------------------------ opponent ------------------------------ */
const DEPTH = { gentle: 2, even: 4, sharp: 7 };
const WANDER = { gentle: 0.3, even: 0.06, sharp: 0 };

function evaluate(board, me) {
  const you = me === 1 ? 2 : 1;
  let score = 0;
  for (let r = 0; r < ROWS; r++) {
    const v = board[r * COLS + 3];
    if (v === me) score += 3;
    else if (v === you) score -= 3;
  }
  for (const line of LINES) {
    let m = 0;
    let y = 0;
    for (const i of line) {
      const v = board[i];
      if (v === me) m++;
      else if (v === you) y++;
    }
    if (m && y) continue;
    if (m === 3) score += 6;
    else if (m === 2) score += 2;
    else if (y === 3) score -= 7;
    else if (y === 2) score -= 2;
  }
  return score;
}

function negamax(board, piece, depth, alpha, beta, moves) {
  const w = winnerOf(board);
  if (w) return w.v === piece ? 100000 + depth : -100000 - depth;
  if (moves >= CELLS) return 0;
  if (depth === 0) return evaluate(board, piece);

  let best = -Infinity;
  const other = piece === 1 ? 2 : 1;
  for (const c of ORDER) {
    const r = dropRow(board, c);
    if (r < 0) continue;
    const i = r * COLS + c;
    board[i] = piece;
    const score = -negamax(board, other, depth - 1, -beta, -alpha, moves + 1);
    board[i] = 0;
    if (score > best) best = score;
    if (score > alpha) alpha = score;
    if (alpha >= beta) break;
  }
  return best;
}

function ai(state, seat, level = 'even') {
  if (outcome(state).over) return null;
  const open = ORDER.filter((c) => dropRow(state.board, c) >= 0);
  if (!open.length) return null;
  const piece = seat + 1;
  const board = state.board.slice();

  // Always take a win and always stop an immediate loss — even the gentle bot.
  for (const p of [piece, piece === 1 ? 2 : 1]) {
    for (const c of open) {
      const i = dropRow(board, c) * COLS + c;
      board[i] = p;
      const won = winnerOf(board);
      board[i] = 0;
      if (won) return { c };
    }
  }

  if (Math.random() < (WANDER[level] ?? 0.1)) return { c: open[Math.floor(Math.random() * open.length)] };

  const depth = DEPTH[level] || 4;
  let bestC = open[0];
  let best = -Infinity;
  for (const c of open) {
    const i = dropRow(board, c) * COLS + c;
    board[i] = piece;
    const score = -negamax(board, piece === 1 ? 2 : 1, depth - 1, -Infinity, -best, state.moves + 1);
    board[i] = 0;
    if (score > best) { best = score; bestC = c; }
  }
  return { c: bestC };
}

/* ------------------------------ view ------------------------------ */
function view(state, ctx) {
  const out = outcome(state);
  const win = new Set(out.line || []);
  const playable = !out.over && ctx.myTurn;
  const lastCol = state.last >= 0 ? state.last % COLS : -1;

  let cols = '';
  for (let c = 0; c < COLS; c++) {
    const full = dropRow(state.board, c) < 0;
    let cells = '';
    for (let r = 0; r < ROWS; r++) {
      const i = r * COLS + c;
      const v = state.board[i];
      cells += `<span class="c4__cell">${
        v
          ? `<i class="c4__disc c4__disc--${v - 1}${i === state.last ? ' is-fresh' : ''}${win.has(i) ? ' is-win' : ''}" style="--r:${r + 1}"></i>`
          : ''
      }</span>`;
    }
    cols += `
      <button class="c4__col${c === lastCol ? ' is-last' : ''}" type="button" data-col="${c}"
              ${!playable || full ? 'disabled' : ''} aria-label="Column ${c + 1}${full ? ', full' : ''}">
        ${playable && !full ? `<i class="c4__ghost c4__disc--${ctx.seat}"></i>` : ''}
        ${cells}
      </button>`;
  }

  return `
    <div class="c4${out.over ? ' is-over' : ''}">
      <div class="c4__board" role="grid" aria-label="Connect Four board">${cols}</div>
    </div>`;
}

function bind(root, state, ctx, play) {
  root.querySelectorAll('[data-col]').forEach((b) =>
    b.addEventListener('click', () => play({ c: Number(b.dataset.col) }))
  );
}

function coach(state, ctx) {
  if (state.moves === 0) return ctx.myTurn ? 'The middle column touches the most fours.' : 'See where they open.';
  if (state.moves < 4 && ctx.myTurn) return 'Keep your discs connected and low.';
  return '';
}
return Object.freeze({ meta, create, turn, apply, outcome, auto, ai, view, bind, coach });
  })();

  /* ===== js/arcade/games/reversi.js ===== */
  const __m24 = (function () {

/**
 * LifeFlow Arcade — Reversi (Othello).
 * 8 × 8 board stored flat. Seat 0 plays the dark discs and moves first.
 * A player with no legal move passes automatically.
 */

const N = 8;
const DIRS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];

/** Classic positional weights: corners gold, squares next to them poison. */
const WEIGHTS = [
  120, -20, 20, 5, 5, 20, -20, 120,
  -20, -40, -5, -5, -5, -5, -40, -20,
  20, -5, 15, 3, 3, 15, -5, 20,
  5, -5, 3, 3, 3, 3, -5, 5,
  5, -5, 3, 3, 3, 3, -5, 5,
  20, -5, 15, 3, 3, 15, -5, 20,
  -20, -40, -5, -5, -5, -5, -40, -20,
  120, -20, 20, 5, 5, 20, -20, 120
];

const meta = {
  id: 'reversi',
  group: ['board', 'brain'],
  title: 'Reversi',
  emoji: '⚫',
  tagline: 'Outflank, flip, take the corners.',
  blurb: 'A minute to learn, a lifetime to master. The board can turn on a single move — corners never do.',
  minutes: '8 min',
  tags: ['Strategy', 'Classic'],
  alternate: true,
  levels: [
    { id: 'gentle', label: 'Gentle', hint: 'Loves flipping lots of discs.' },
    { id: 'even', label: 'Even', hint: 'Knows corners matter.' },
    { id: 'sharp', label: 'Sharp', hint: 'Plays for mobility and edges.' }
  ],
  rules: [
    'Place a disc so it traps a straight line of your rival’s discs between it and one of yours.',
    'Every trapped disc flips to your colour — in all directions at once.',
    'No legal move? Your turn passes automatically.',
    'When neither player can move, the most discs wins.'
  ]
};

function create() {
  const board = Array(N * N).fill(0);
  board[27] = 2; board[36] = 2;
  board[28] = 1; board[35] = 1;
  return { board, turn: 0, last: -1, flipped: [], moves: 0, passed: false };
}

function turn(state) {
  return state.turn;
}

function flipsFor(board, i, piece) {
  if (board[i] !== 0) return [];
  const other = piece === 1 ? 2 : 1;
  const r0 = Math.floor(i / N);
  const c0 = i % N;
  const all = [];
  for (const [dr, dc] of DIRS) {
    const run = [];
    let r = r0 + dr;
    let c = c0 + dc;
    while (r >= 0 && r < N && c >= 0 && c < N && board[r * N + c] === other) {
      run.push(r * N + c);
      r += dr;
      c += dc;
    }
    if (run.length && r >= 0 && r < N && c >= 0 && c < N && board[r * N + c] === piece) all.push(...run);
  }
  return all;
}

function legalMoves(board, piece) {
  const out = [];
  for (let i = 0; i < N * N; i++) {
    if (board[i] !== 0) continue;
    const f = flipsFor(board, i, piece);
    if (f.length) out.push({ i, flips: f });
  }
  return out;
}

const count = (board, v) => board.reduce((n, x) => n + (x === v ? 1 : 0), 0);

function apply(state, move) {
  if (outcome(state).over) return null;
  const piece = state.turn + 1;
  if (move?.pass) {
    if (legalMoves(state.board, piece).length) return null;
    return { board: state.board.slice(), turn: 1 - state.turn, last: -1, flipped: [], moves: state.moves, passed: true };
  }
  const i = Number(move?.i);
  if (!Number.isInteger(i) || i < 0 || i >= N * N) return null;
  const flips = flipsFor(state.board, i, piece);
  if (!flips.length) return null;
  const board = state.board.slice();
  board[i] = piece;
  for (const f of flips) board[f] = piece;
  return { board, turn: 1 - state.turn, last: i, flipped: flips, moves: state.moves + 1, passed: false };
}

function outcome(state) {
  const b = state.board;
  const done = !legalMoves(b, 1).length && !legalMoves(b, 2).length;
  if (!done) return { over: false, winner: null, draw: false };
  const d = count(b, 1);
  const l = count(b, 2);
  if (d === l) return { over: true, winner: null, draw: true };
  return { over: true, winner: d > l ? 0 : 1, draw: false };
}

/** Nobody chooses to pass — it happens when you have no move. */
function auto(state) {
  if (outcome(state).over) return null;
  if (legalMoves(state.board, state.turn + 1).length) return null;
  return { move: { pass: true }, delay: 1300 };
}

function note(state, seat) {
  return `${count(state.board, seat + 1)} discs`;
}

/* ------------------------------ opponent ------------------------------ */
const DEPTH = { gentle: 1, even: 3, sharp: 4 };

function evaluate(board, me) {
  const you = me === 1 ? 2 : 1;
  let pos = 0;
  let mine = 0;
  let theirs = 0;
  for (let i = 0; i < 64; i++) {
    if (board[i] === me) { pos += WEIGHTS[i]; mine++; }
    else if (board[i] === you) { pos -= WEIGHTS[i]; theirs++; }
  }
  const myMob = legalMoves(board, me).length;
  const yourMob = legalMoves(board, you).length;
  if (!myMob && !yourMob) return mine > theirs ? 10000 + mine : mine < theirs ? -10000 - theirs : 0;
  const mob = myMob + yourMob ? (100 * (myMob - yourMob)) / (myMob + yourMob) : 0;
  return pos + mob * 0.8;
}

function search(board, piece, me, depth, alpha, beta) {
  const moves = legalMoves(board, piece);
  const other = piece === 1 ? 2 : 1;
  if (depth === 0) return evaluate(board, me);
  if (!moves.length) {
    if (!legalMoves(board, other).length) return evaluate(board, me);
    return search(board, other, me, depth - 1, alpha, beta);
  }
  moves.sort((a, b) => WEIGHTS[b.i] - WEIGHTS[a.i]);
  const maximizing = piece === me;
  let best = maximizing ? -Infinity : Infinity;
  for (const m of moves) {
    const next = board.slice();
    next[m.i] = piece;
    for (const f of m.flips) next[f] = piece;
    const score = search(next, other, me, depth - 1, alpha, beta);
    if (maximizing) { if (score > best) best = score; if (score > alpha) alpha = score; }
    else { if (score < best) best = score; if (score < beta) beta = score; }
    if (beta <= alpha) break;
  }
  return best;
}

function ai(state, seat, level = 'even') {
  const piece = seat + 1;
  const moves = legalMoves(state.board, piece);
  if (!moves.length) return null;

  if (level === 'gentle') {
    // Greedy and a bit random — fun to beat.
    moves.sort((a, b) => b.flips.length - a.flips.length + (Math.random() - 0.5) * 3);
    return { i: moves[0].i };
  }

  const depth = DEPTH[level] || 3;
  const other = piece === 1 ? 2 : 1;
  let best = moves[0].i;
  let bestScore = -Infinity;
  moves.sort((a, b) => WEIGHTS[b.i] - WEIGHTS[a.i]);
  for (const m of moves) {
    const next = state.board.slice();
    next[m.i] = piece;
    for (const f of m.flips) next[f] = piece;
    const score = search(next, other, piece, depth - 1, bestScore, Infinity) + Math.random() * 0.5;
    if (score > bestScore) { bestScore = score; best = m.i; }
  }
  return { i: best };
}

/* ------------------------------ view ------------------------------ */
function view(state, ctx) {
  const out = outcome(state);
  const playable = !out.over && ctx.myTurn;
  const hints = playable ? new Set(legalMoves(state.board, ctx.seat + 1).map((m) => m.i)) : new Set();
  const flipped = new Set(state.flipped || []);

  let cells = '';
  for (let i = 0; i < 64; i++) {
    const v = state.board[i];
    const hint = hints.has(i);
    cells += `
      <button class="rv__sq${hint ? ' is-hint' : ''}${i === state.last ? ' is-last' : ''}" type="button" data-sq="${i}"
              ${hint ? '' : 'disabled'} aria-label="${'abcdefgh'[i % 8]}${8 - Math.floor(i / 8)}${v ? `, ${v === 1 ? 'dark' : 'light'}` : hint ? ', playable' : ''}">
        ${v ? `<i class="rv__disc rv__disc--${v - 1}${flipped.has(i) ? ' is-flip' : ''}${i === state.last ? ' is-fresh' : ''}" style="--d:${flipped.has(i) ? Math.abs((i % 8) - (state.last % 8)) + Math.abs(Math.floor(i / 8) - Math.floor(state.last / 8)) : 0}"></i>` : ''}
      </button>`;
  }

  return `
    <div class="rv${out.over ? ' is-over' : ''}">
      <div class="rv__score">
        <span class="rv__pill rv__pill--0"><i class="rv__disc rv__disc--0"></i> ${count(state.board, 1)}</span>
        ${state.passed ? '<span class="rv__pass">Pass ↺</span>' : ''}
        <span class="rv__pill rv__pill--1"><i class="rv__disc rv__disc--1"></i> ${count(state.board, 2)}</span>
      </div>
      <div class="rv__board" role="grid" aria-label="Reversi board">${cells}</div>
    </div>`;
}

function bind(root, state, ctx, play) {
  root.querySelectorAll('[data-sq]:not(:disabled)').forEach((b) =>
    b.addEventListener('click', () => play({ i: Number(b.dataset.sq) }))
  );
}

function coach(state, ctx) {
  if (state.moves < 2 && ctx.myTurn) return 'Fewer flips early keeps your options open.';
  if (ctx.myTurn && [0, 7, 56, 63].some((i) => flipsFor(state.board, i, ctx.seat + 1).length)) return 'A corner is open. Corners can never be flipped.';
  if (state.passed && ctx.myTurn) return 'They had no move — your turn again.';
  return '';
}
return Object.freeze({ meta, create, turn, apply, outcome, auto, note, ai, view, bind, coach });
  })();

  /* ===== js/arcade/games/dots.js ===== */
  const __m25 = (function () {

/**
 * LifeFlow Arcade — Dots & Boxes.
 * Draw one line per turn. Close a box and it is yours — and you go again.
 * State is flat arrays of lines and boxes so it syncs cleanly.
 */

const R = 5; // rows of boxes
const C = 5; // columns of boxes
const H = (R + 1) * C; // horizontal lines
const V = R * (C + 1); // vertical lines

const meta = {
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

function create() {
  return { h: Array(H).fill(0), v: Array(V).fill(0), boxes: Array(R * C).fill(0), scores: [0, 0], turn: 0, last: null, moves: 0 };
}

function turn(state) {
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
function apply(state, move) {
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

function outcome(state) {
  if (state.boxes.some((b) => !b)) return { over: false, winner: null, draw: false };
  const [a, b] = state.scores;
  if (a === b) return { over: true, winner: null, draw: true };
  return { over: true, winner: a > b ? 0 : 1, draw: false };
}

function auto() {
  return null;
}

function note(state, seat) {
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

function ai(state, seat, level = 'even') {
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

function view(state, ctx) {
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

function bind(root, state, ctx, play) {
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

function coach(state, ctx) {
  if (state.moves === 0 && ctx.myTurn) return 'Early on, any line is safe. Avoid third sides.';
  if (ctx.myTurn && openLines(state).some((m) => completes(state, m))) return 'There is a box waiting for you.';
  return '';
}
return Object.freeze({ meta, create, turn, apply, outcome, auto, note, ai, view, bind, coach });
  })();

  /* ===== js/arcade/games/kit.js ===== */
  const __m27 = (function () {

/**
 * LifeFlow Arcade — small shared helpers for the social and card games.
 * Pure functions only; nothing here touches the DOM outside the root it is given.
 */

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
}

function rand(n) {
  return Math.floor(Math.random() * n);
}

function shuffle(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Fill {me} / {you} / {name} in a prompt — the names are escaped, the prompt is trusted content. */
function fill(text, map) {
  return esc(text).replace(/\{(\w+)\}/g, (m, k) => (k in map ? `<b>${esc(map[k])}</b>` : m));
}

/**
 * Draw an unused item from a bank of categories.
 * bank: { catId: { items: [...] } } — returns { c, i, used } with the pick remembered.
 */
function draw(bank, cats, used, list = 'items', cap = 160) {
  const pool = [];
  const seen = new Set(used);
  const live = cats.filter((c) => bank[c]);
  const ids = live.length ? live : Object.keys(bank);
  for (const c of ids) {
    const items = bank[c][list] || [];
    items.forEach((_, i) => { if (!seen.has(`${c}:${list}:${i}`)) pool.push([c, i]); });
  }
  if (!pool.length) {
    // Everything has been seen — start the deck over.
    for (const c of ids) (bank[c][list] || []).forEach((_, i) => pool.push([c, i]));
    used = used.filter((k) => !k.includes(`:${list}:`));
  }
  const [c, i] = pool[rand(pool.length)];
  return { c, i, used: [...used, `${c}:${list}:${i}`].slice(-cap) };
}

/** Category chips — toggles when `live`, otherwise a quiet read-out. */
function catChips(bank, cats, live) {
  return `
    <div class="xcats${live ? '' : ' is-locked'}" role="group" aria-label="Categories">
      ${Object.entries(bank)
        .map(
          ([id, c]) => `<button type="button" class="xcat" data-cat="${id}" aria-pressed="${cats.includes(id)}" ${live ? '' : 'disabled'}>
                          <span aria-hidden="true">${c.emoji}</span>${esc(c.label)}
                        </button>`
        )
        .join('')}
    </div>`;
}

function bindCats(root, cats, play) {
  root.querySelectorAll('[data-cat]').forEach((b) =>
    b.addEventListener('click', () => {
      const id = b.dataset.cat;
      const next = cats.includes(id) ? cats.filter((c) => c !== id) : [...cats, id];
      if (next.length) play({ cats: next });
    })
  );
}

function validCats(bank, cats) {
  return Array.isArray(cats) && cats.length > 0 && cats.length <= 20 && cats.every((c) => typeof c === 'string' && bank[c]);
}

/** Round progress — a row of beads, filled as the game moves along. */
function beads(done, total, current = -1) {
  return `<div class="xbeads" aria-label="Round ${Math.min(done + 1, total)} of ${total}">${Array.from({ length: total }, (_, i) =>
    `<i class="${i < done ? 'is-done' : ''}${i === current ? ' is-now' : ''}"></i>`
  ).join('')}</div>`;
}

/** A short burst of floating emoji inside `host` — purely decorative. */
function burst(host, glyphs, n = 14) {
  if (!host || !host.isConnected) return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const layer = document.createElement('div');
  layer.className = 'xburst';
  layer.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < n; i++) {
    const s = document.createElement('span');
    s.textContent = glyphs[i % glyphs.length];
    s.style.setProperty('--x', `${Math.round((Math.random() - 0.5) * 260)}px`);
    s.style.setProperty('--y', `${Math.round(-80 - Math.random() * 160)}px`);
    s.style.setProperty('--r', `${Math.round((Math.random() - 0.5) * 120)}deg`);
    s.style.setProperty('--d', `${Math.round(Math.random() * 240)}ms`);
    layer.appendChild(s);
  }
  host.appendChild(layer);
  setTimeout(() => layer.remove(), 1700);
}
return Object.freeze({ esc, rand, shuffle, fill, draw, catChips, bindCats, validCats, beads, burst });
  })();

  /* ===== js/arcade/games/truthdare.js ===== */
  const __m26 = (function () {
const { esc, fill, draw, catChips, bindCats, validCats, beads, burst } = __m27;
/**
 * LifeFlow Arcade — Truth or Dare.
 * A social card game: the performer picks Truth or Dare, the other player judges.
 * Nine decks, from icebreakers to after dark. Truths score 1, dares score 2 (configurable).
 */


const ROUNDS = 12;
const POINTS = { truth: 1, dare: 2 };

/** Per-game rules that travel inside the state, so both players share them. */
const roundsOf = (s) => s.rounds || ROUNDS;
const pointsOf = (s, kind) => (kind === 'dare' ? s.darePts || POINTS.dare : POINTS.truth);

const DECKS = {
  ice: {
    label: 'Icebreakers', emoji: '❄️',
    truths: [
      'What is the best thing that happened to you this month?',
      'Morning person or night owl — and why?',
      'What hobby would you love to try one day?',
      'What was your very first job (or chore you got paid for)?',
      'What is the most interesting place you have ever visited?',
      'Which book, film or series do you recommend to everyone?',
      'What is your go-to comfort food?',
      'With no limits at all, what would your dream job be?',
      'What is a skill you are surprisingly good at?',
      'Which three words would your friends use to describe you?',
      'What is the best advice you have ever received?',
      'What always makes your day a little better?',
      'What is the most spontaneous thing you have ever done?',
      'Which famous person would you love to have dinner with?',
      'What is a small thing that instantly annoys you?',
      'What did you want to be when you were ten?',
      'What is the last thing that made you laugh out loud?',
      'What would your perfect Sunday look like?',
      'Which song would play when you walk into a room?',
      'Cats, dogs, or neither — defend your answer.',
      'What is something you believed as a child that turned out to be false?',
      'What is the best compliment a stranger ever gave you?',
      'If you could master one skill overnight, what would it be?',
      'What is the most adventurous food you have tried?',
      'What is your most-used phrase?'
    ],
    dares: [
      'Tell {you} two truths and a lie — {you} has to spot the lie.',
      'Share your best fun fact, with full documentary voice.',
      'Introduce yourself as if you were a famous athlete at a press conference.',
      'Describe your day using only emojis — say them out loud.',
      'Teach {you} a word in another language and make them repeat it.',
      'Tell the story behind your name in 30 seconds.',
      'Make three guesses about {you}. They tell you how many you got right.',
      'Pitch your favourite food like a TV salesperson.',
      'Draw your dream house in 30 seconds and present it.',
      'Find something blue nearby and present it like a museum masterpiece.',
      'Do your best impression of a famous person — {you} has three guesses.',
      'Show {you} your favourite app and sell it to them in 20 seconds.',
      'Say a tongue twister three times fast.',
      'Give {you} a nickname and use it until the end of the game.',
      'Do your best catwalk to the kitchen and back.',
      'Describe your job (or studies) like a nature documentary.',
      'Speak in rhymes until your next turn.',
      'Show {you} the oldest photo on your phone.',
      'Invent a new handshake and teach it to {you}.',
      'Talk for 30 seconds about a random object {you} points at.',
      'Do your best robot dance for 15 seconds.',
      'Let {you} ask you three rapid-fire questions — no thinking allowed.',
      'Sing “happy birthday” in the style of an opera singer.',
      'Balance a book on your head until your next turn starts.'
    ]
  },
  friends: {
    label: 'Friends', emoji: '🤝',
    truths: [
      'What is the most embarrassing thing you have done in front of {you}?',
      'What is a hidden talent nobody here knows about?',
      'What is the worst gift you ever got — did you pretend to love it?',
      'What is the pettiest reason you ever stopped talking to someone?',
      'If you swapped lives with {you} for a day, what would you do first?',
      'What is the last little lie you told?',
      'What is your most irrational fear?',
      'Who was your first celebrity crush?',
      'What is the silliest thing you have ever cried over?',
      'Which habit of {you} secretly makes you laugh?',
      'What is the most useless thing you know by heart?',
      'What is the weirdest food combo you actually enjoy?',
      'What is the funniest misunderstanding you have been part of?',
      'What is the meanest thing you have ever thought about {you}?',
      'Who here would you never trust with a secret — and why?',
      'What is something you pretend to like but secretly hate?',
      'What is the most embarrassing thing in your search history?',
      'Have you ever stalked an ex online? How deep did you go?',
      'What is the worst thing you have ever said behind someone’s back?',
      'What is the most childish thing you did this year?',
      'Which friend would you drop first in a survival show?',
      'What is the biggest lie you told your parents?',
      'Have you ever read someone else’s messages without permission?',
      'What is something about {you} that you would change if you could?',
      'What is the most awkward date you have been on?',
      'What is the worst text you sent to the wrong person?'
    ],
    dares: [
      'Do your best impression of {you} until they guess who it is.',
      'Show the last photo in your camera roll — or describe it honestly.',
      'Talk like a pirate until your next turn.',
      'Sing the chorus of the last song you listened to.',
      'Let {you} choose your phone wallpaper for the next 24 hours.',
      'Do 15 jumping jacks while reciting the alphabet.',
      'Speak only in questions until your next turn.',
      'Give {you} a dramatic movie-trailer introduction.',
      'Try to touch your nose with your tongue for 10 seconds.',
      'Tell a joke. If {you} does not laugh, try another one.',
      'Act out your most-used emoji until {you} guesses it.',
      'Do a 20-second runway walk across the room.',
      'Read your last sent message in a dramatic theatre voice.',
      'Roast {you} for 30 seconds — no mercy, but keep it funny.',
      'Let {you} post a story on your social media (they choose, you approve).',
      'Show {you} your screen time for this week.',
      'Let {you} read the last five things you searched for.',
      'Call a friend and sing them a song for 15 seconds.',
      'Send a “I miss you” text to the third person in your contacts.',
      'Let {you} draw a tiny moustache on your face (or hand).',
      'Eat a spoonful of something {you} picks from the kitchen.',
      'Do your most embarrassing dance move — full commitment.',
      'Let {you} change your profile picture for one hour.',
      'Imitate {you} ordering food at a restaurant.',
      'Give {you} your phone, unlocked, for 60 seconds.',
      'Wear your clothes inside out until the end of the game.'
    ]
  },
  party: {
    label: 'Party', emoji: '🎉',
    truths: [
      'What is the most awkward thing that happened to you at a party?',
      'Have you ever sung the wrong lyrics with total confidence?',
      'Which app eats most of your time — be honest about the hours.',
      'Who in your life would survive longest in a zombie apocalypse?',
      'What is the most childish thing you still do?',
      'What was your most questionable fashion phase?',
      'Have you ever blamed someone else for something you did?',
      'What is the strangest thing you have ever searched online?',
      'If you were a pop star, what would your stage name be?',
      'Which song do you secretly love but would never admit?',
      'What is the silliest thing you have spent money on?',
      'What is the longest you have stayed awake, and why?',
      'What is the most trouble you have ever been in?',
      'What is the craziest thing you have done on a dare?',
      'Have you ever been kicked out of somewhere? Where?',
      'What is the worst thing you have done at a wedding or a party?',
      'Who was the last person you ghosted — and why?',
      'What is your most embarrassing moment on social media?',
      'What is the most money you have wasted in one night?',
      'Have you ever pretended to be sick to skip something? What?',
      'What rumour about you was actually true?',
      'What is your worst habit that nobody knows about?',
      'Have you ever fallen asleep somewhere totally inappropriate?',
      'What is the wildest thing on your bucket list?'
    ],
    dares: [
      'Dance with no music for 20 seconds.',
      'Announce {you} like a boxing champion entering the ring.',
      'Make a funny face and hold it while {you} counts to 10.',
      'Moonwalk — or at least try — across the room.',
      'Report on this game like a breaking-news anchor.',
      'Do your best evil-villain laugh.',
      'Hold a plank for 30 seconds while {you} cheers you on.',
      'Sing everything you say until your next turn.',
      'Perform your last text message as an opera.',
      'Walk like a penguin to the door and back.',
      'Act out an animal of {you}\u2019s choosing for 20 seconds.',
      'Do a slow-motion replay of your last goal… in any sport.',
      'Do your best twerk — or your best attempt — for 10 seconds.',
      'Let {you} give you a new hairstyle with whatever is around.',
      'Talk in an accent {you} chooses until your next turn.',
      'Do a dramatic soap-opera breakup scene with {you}.',
      'Attempt a cartwheel, a split or a handstand — your choice.',
      'Let {you} tickle you for 10 seconds without laughing.',
      'Drink a glass of water without using your hands.',
      'Rap about {you} for 20 seconds.',
      'Do your best impression of your mother or father on the phone.',
      'Let {you} send one emoji to anyone in your contacts.',
      'Pretend to be a famous influencer filming a product review.',
      'Freeze in a funny pose until your next turn — or until you laugh.',
      'Lick your elbow. (Good luck.)'
    ]
  },
  couple: {
    label: 'Couple', emoji: '💞',
    truths: [
      'What was your very first impression of {you}?',
      'When did you realise you really liked {you}?',
      'What is your favourite memory of the two of you?',
      'What small thing does {you} do that makes your day?',
      'What have you always wanted to tell {you} but never did?',
      'Which song reminds you of {you}?',
      'Where is your dream trip together?',
      'Which habit of {you} do you secretly find adorable?',
      'What were you thinking about on your first date?',
      'What is one thing you would love to do together more often?',
      'Where do you see the two of you in five years?',
      'What is the best gift {you} has ever given you?',
      'What made you smile about {you} this week?',
      'What is something {you} does that you secretly love watching?',
      'What was the moment you knew {you} was special?',
      'What is the most jealous you have ever been in our relationship?',
      'What is one habit of {you} that drives you a little crazy?',
      'What is your favourite photo of us, and why?',
      'What do you still want to discover about {you}?',
      'What is something you have never told {you} about your past?',
      'What is the sweetest thing {you} has ever said to you?',
      'If you could relive one day with {you}, which one?',
      'What scares you most about our future?',
      'What is your secret nickname for {you} in your head?',
      'What is the best kiss we have ever had? Describe it.'
    ],
    dares: [
      'Give {you} a 30-second shoulder massage.',
      'Look {you} in the eyes and name three things you love about them.',
      'Take a silly selfie together right now.',
      'Slow dance with {you} through one chorus — music optional.',
      'Write a two-line love poem for {you} and read it aloud.',
      'Hold hands and look into each other\u2019s eyes for 30 seconds without laughing.',
      'Do your best impression of {you} waking up in the morning.',
      'Plan your next date out loud in 60 seconds.',
      'Give {you} a sincere compliment in a terrible accent.',
      'Serenade {you} with any song for 15 seconds.',
      'Draw a portrait of {you} in 60 seconds and gift it to them.',
      'Make {you} a drink or a snack of their choice.',
      'Give {you} a forehead kiss and say why you are grateful for them.',
      'Recreate your first photo together.',
      'Feed {you} a bite of something — slowly.',
      'Give {you} a foot massage for 60 seconds.',
      'Tell {you} the story of how you met, as a fairy tale.',
      'Let {you} choose your outfit for tomorrow.',
      'Write “I love you” somewhere on {you} with your finger. They guess the words.',
      'Kiss {you} like it is the end of a romantic film.',
      'Whisper your favourite memory of {you} in their ear.',
      'Plan a surprise for {you} this week and tell them only one clue.',
      'Compliment {you} non-stop for 30 seconds.',
      'Carry {you} (or try to) for five steps.'
    ]
  },
  flirty: {
    label: 'Flirty', emoji: '🌶️',
    truths: [
      'What was the exact moment you first thought “I want to kiss {you}”?',
      'If you had to seduce {you} with one sentence, what would it be? Say it — looking at them.',
      'What is the flirtiest thought you have had about {you} today?',
      'When did you last check {you} out without them noticing? What were you looking at?',
      'Eyes, smile, voice, hands or confidence — which one is your weakness, and why?',
      'What does {you} do without realising that you find completely irresistible?',
      'Which part of {you} would you write a poem about? Give us the first line.',
      'What is the most daring message you have typed — and then deleted?',
      'What compliment from {you} would make you melt on the spot?',
      'What is your secret move when you want to seduce someone — and has it worked on {you}?',
      'Which outfit do you wear when you want to be noticed? Has {you} noticed?',
      'Rate your last kiss with {you} out of 10 — and say exactly what would make it an 11.',
      'If {you} were a dessert, which one would they be — and how would you eat it?',
      'What is the most tempting moment between you and {you} that nobody else noticed?',
      'What do you secretly want {you} to whisper to you?',
      'A look, a touch or a word — what gives you butterflies fastest?',
      'Where would you take {you} if you wanted the night to end with a kiss you will never forget?',
      'Which song makes you think of {you} in a way you would not explain to your parents?',
      'What is the best kiss of your life — where, when, and what made it perfect?',
      'What is one thing you would love {you} to wear on your next date — or not wear?',
      'On a scale of 1 to 10, how much do you want to kiss {you} right now? Justify the number.',
      'What is your favourite way to be woken up?',
      'What would you do if {you} whispered “follow me” right now?',
      'Have you ever had a dream about {you} you would blush to describe? Give us a hint.',
      'What is the cheekiest thing you have ever done to get someone’s attention?',
      'Describe the perfect slow dance with {you} in three details.',
      'Which of your senses does {you} affect the most — and how?',
      'What is the most romantic-but-risky thing you would try with {you}?',
      'What is one thing you want {you} to do more often in the evenings?',
      'What is the most attractive thing a person can do with their hands?'
    ],
    dares: [
      'Look {you} in the eyes and slowly finish this sentence: “If we were alone right now, the first thing I would do is…”',
      'Pay {you} a compliment so specific it makes them blush. You get three tries.',
      'Whisper {you}’s name in their ear as if it were a secret.',
      'Kiss {you} on the cheek — then just next to their lips. Stop there.',
      'Hold {you}’s hand and trace slow circles on their palm for 30 seconds.',
      'Seduce {you} using only food words. 30 seconds, no laughing.',
      'Give {you} your best “come here” look — no words allowed.',
      'Write a two-line poem about {you}’s lips and read it aloud.',
      'Slow dance with {you} for 30 seconds — no music, you hum it.',
      'Fix {you}’s collar or hair as slowly and tenderly as you can.',
      'Tell {you} three things you find attractive about them — from the most innocent to the least.',
      'Send {you} a voice note whispering what you want on your next date.',
      'Kiss {you}’s hand like a gentleman — then like the villain in a romance film.',
      'Stand behind {you} and whisper a different compliment in each ear.',
      'Rest your forehead against {you}’s for 20 seconds. First to laugh loses.',
      'Feed {you} something sweet — slowly, with eye contact.',
      'Say “I want you” to {you} three ways: shy, bold and dangerous.',
      'Kiss {you} on the forehead, the nose and the chin — in that order, slowly.',
      'Give {you} a 30-second neck and shoulder massage.',
      'Sit as close to {you} as possible until your next turn.',
      'Recreate the moment you first flirted with {you} — with a much better line.',
      'Tell {you} something you noticed about them tonight that they think you missed.',
      'Hug {you} slowly and do not be the first to let go.',
      'Undo one button or remove one accessory — {you} decides which.',
      'Do your most seductive walk across the room and back, then sit next to {you}.',
      'Bite your lip and say {you}’s name as sexily as you can.',
      'Kiss {you} without using your hands.',
      'Trace a heart on {you}’s back with one finger — slowly.',
      'Give {you} a playful 15-second lap dance.',
      'Kiss {you} on the neck — once, slowly.'
    ]
  },
  spicy: {
    label: 'Spicy 18+', emoji: '🔥', adult: true,
    truths: [
      'What is a fantasy you have never told anyone? Describe only the setting — {you} imagines the rest.',
      'Where on your body does a kiss make you completely lose focus?',
      'What have you always wanted to try with {you} but never dared to ask?',
      'What is the most seductive thing {you} has ever done — maybe without even knowing it?',
      'Describe your perfect night with {you} in exactly five words.',
      'In control, or letting {you} take the lead — which is sexier to you, and why?',
      'What is the most daring place you have ever kissed someone?',
      'What is your favourite thing {you} wears to bed?',
      'When were you most tempted by {you} in public — and what stopped you?',
      'What is your biggest turn-on that has nothing to do with looks?',
      'What could {you} whisper that would make you leave this game immediately?',
      'Which of your outfits do you think drives {you} crazy? {you} says if you are right.',
      'Slow and tender, or bold and spontaneous — what is your mood tonight?',
      'What seductive message would you send {you} if you knew they would read it at work?',
      'Which part of your body do you love — and want {you} to notice more?',
      'Rate {you}’s kissing out of 10 and explain exactly how they can earn the missing points.',
      'Have you ever planned a seduction? Walk us through it, step by step.',
      'What is the most attractive sound {you} makes?',
      'What is the riskiest place you would be tempted to kiss {you}?',
      'Sight or hearing — which would you take away from {you} to make tonight more interesting?',
      'What guilty pleasure would you confess only to {you}?',
      'What is one rule you would love to break with {you} tonight?',
      'What were you really thinking during your most intense eye contact with {you}?',
      'When did {you} last make your heart race — and do they know?',
      'If tonight had a film title, what would it be — and which scene would be rated 18+?',
      'If {you} blindfolded you for five minutes, what would you hope they did? Keep it teasing.',
      'Slow, deep, playful or stolen — what is your favourite kind of kiss?',
      'Which piece of {you}’s clothing would you most like to steal — and why that one?',
      'Have you ever sent a spicy photo? Would you send one to {you} tonight?',
      'Neck, ears, back or hands — where are you most sensitive?',
      'What would you do with {you} on a weekend with no phones and no plans?',
      'Describe the most seductive kiss you can imagine — without using the word “kiss”.',
      'What is the boldest thing you have ever whispered to someone?',
      'What compliment about your body do you secretly want to hear from {you}?',
      'What is the most seductive scent in the world to you?',
      'What is the sexiest thing you have ever done that nobody knows about?',
      'Which part of {you} is your favourite — and how would you kiss it right now?',
      'What do you find seductive that most people would find strange?',
      'What is the hottest thing {you} has ever said to you?',
      'What would you do if {you} walked in wearing only a towel?',
      'Have you ever been caught kissing? Where?',
      'Build-up, first touch, or the moment you stop pretending — what is your favourite part of a seduction?',
      'If you could relive one intimate moment with {you}, which would it be? Describe only the setting.',
      'What do you want {you} to take the lead on tonight?',
      'What is the most seductive thing you have ever worn — and who was it for?'
    ],
    dares: [
      'Kiss {you} slowly for 10 seconds. They decide if it counts.',
      'Whisper in {you}’s ear exactly what you are thinking right now — no editing.',
      'Kiss {you} somewhere that is not their lips. They say warmer or colder until you find their favourite spot.',
      'Let {you} blindfold you, then guess where they kiss you. Three guesses.',
      'Give {you} a slow, sensual neck and shoulder massage for 60 seconds.',
      'Remove one item of clothing — {you} chooses which (socks and jewellery count).',
      'Dance slowly and closely with {you} for one full song.',
      'Hold eye contact with {you} for 30 seconds while slowly moving closer. Whoever looks away first owes a kiss.',
      'Tell {you} what you plan to do to them later — whispered, in exactly three words.',
      'Kiss {you}’s neck for five slow seconds.',
      'Trace a word on {you}’s back with an ice cube. If they guess it, they win a kiss.',
      'Run your fingers through {you}’s hair and down the back of their neck for 30 seconds.',
      'Sit facing {you}, as close as possible, without touching, for 30 seconds. First to give in loses.',
      'Role-play: you are strangers at a hotel bar. Seduce {you} in under a minute.',
      'Give {you} three kisses: one sweet, one teasing, and one that makes them forget the game.',
      '{you} picks one thing you must do for them before the night ends. Consent and fun only.',
      'Record a 10-second seductive voice note for {you} to play tomorrow morning.',
      'Trace {you}’s lips with your fingertip, then kiss them slowly.',
      'Do a slow strip-tease of one item — a jacket, a scarf or an over-shirt.',
      'Describe your plans for {you} later using only emojis. {you} interprets them out loud.',
      'Kiss {you} along their jaw, from ear to chin.',
      'Put your hands behind your back and kiss {you}. No hands for the next minute.',
      'Whisper the most seductive sentence you can invent. {you} rates it out of 10.',
      'Kiss {you}’s wrist, then the inside of their elbow, then their shoulder.',
      'Let {you} pick a song and give them a 30-second playful lap dance.',
      'Lead {you} into a slow dance — then dip them and kiss them.',
      'Text {you} describing what they are wearing as if it were the sexiest thing you have ever seen.',
      'Blindfold {you} and touch their arm three ways — lips, fingertips or breath. They guess which.',
      'Whisper three things you love about {you}’s body — one in each ear, the last against their neck.',
      'Bite your lip, look at {you}, and say their name like a promise.',
      'For 60 seconds, talk to {you} only with kisses — hand, cheek or neck.',
      'Hug {you} slowly from behind and whisper your plan for later.',
      'Swap one item of clothing with {you} for the rest of the game.',
      'Whisper a new compliment to {you} every 10 seconds for one minute.',
      'Kiss {you} like the final scene of a romance film. They say “cut”.',
      'Kiss {you} for 15 seconds as if nobody in the world were watching.',
      'Remove two accessories or one item of clothing — your choice.',
      'Give {you} a slow 30-second foot or calf massage.',
      'Let {you} draw a heart with lipstick or a pen on your arm or shoulder.',
      'Whisper to {you} something you would never say in front of other people.',
      'Sit on {you}’s lap and tell them about your day in your most seductive voice.',
      'Slowly take off {you}’s shoes and socks, then kiss their ankle.',
      'Kiss the back of {you}’s neck for five slow seconds.',
      'Freeze: kiss {you} until they say “freeze” — they can wait as long as they like.',
      'Give {you} a 20-second sensual dance using only your hips.'
    ]
  },
  afterdark: {
    label: 'After dark 18+', emoji: '🖤', adult: true,
    truths: [
      'Finish honestly: “The moment I knew I wanted {you} was…”',
      'Say the most seductive thing you can to {you} in exactly five words.',
      'Rate three of your fantasies mild, medium and too hot to share. Tell us the mild one.',
      'If {you} could read your mind for 30 seconds tonight, what would surprise them most?',
      'What is the sexiest thing about the way {you} thinks?',
      'Write the opening of a seduction scene like a film script: setting, music, first line.',
      'Words, looks or touch — what do you want more of tonight?',
      'Which of your secrets would make {you} look at you differently — in a good way?',
      'What is your most irresistible feature? Be honest, not humble.',
      'Is there something you have pretended not to want? Confess it, gently.',
      'What is the most romantic thing you have done that also felt a little dangerous?',
      'You are leaving {you} a note to read at midnight. What is the first line?',
      'What would you never do… unless {you} asked very nicely?',
      'Which words, whispered at the right moment, would melt you completely?',
      'Which room in the house has the most potential for a romantic surprise — and what would it be?',
      'What is the boldest thing you would do tonight if you knew {you} would say yes?',
      'Seduced slowly, or caught by surprise — which do you prefer?',
      'Where do you love to kiss {you} most — and why there?',
      'If your desire for {you} were the weather, what is tonight’s forecast?',
      'What is the most tempting thing {you} could say to you right now? Let them try it.',
      'What is the most seductive thing {you} could do to you in under ten seconds?',
      'Describe the outfit you would want {you} to open the door in tonight.',
      'What is a secret desire you have only ever thought about at 2 a.m.?',
      'Which of {you}’s looks tells you “tonight is the night”? Show us your version.',
      'What is the boldest thing you have ever done in the dark?',
      'If you could give {you} one order tonight that they had to obey, what would it be?',
      'If {you} gave you one order tonight, what would you hope it is?',
      'Where is the most unexpected place you have suddenly wanted to kiss {you}?',
      'Teasing or taking — which are you better at? Prove it with an example.',
      'Which piece of clothing is the most seductive to take off someone slowly?',
      'What is the most daring thing you would do with {you} on a holiday where nobody knows you?',
      'What is the hottest dream you have had about {you}? Describe only how it ended.',
      'What does {you} do that makes you want to skip dinner and go straight to dessert?',
      'Candles, music or total darkness — set the scene for tonight.',
      'What would you whisper to {you} if you knew they could not resist it?',
      'Rate your self-control around {you} right now, from 1 to 10.',
      'What “yes” are you dying to hear from {you}?',
      'Touch, taste, smell, sight or sound — which sense does {you} set on fire?',
      'What is the longest you have ever kissed someone without stopping?',
      'What is the most seductive message you have ever received? Paraphrase it.',
      'Morning, shower, sofa or midnight — when is {you} most irresistible?',
      'What is one thing you would love {you} to do slower?',
      'What is one thing you would love {you} to do bolder?',
      'If tonight had a dress code, what would it be?',
      'What is the cheekiest place you have ever been caught kissing?',
      'Which part of {you} do you think about when they are not around?',
      'What is the most irresistible thing {you} has ever whispered to you?',
      'Have you ever dressed up just to tempt {you}? Did it work?',
      'Plan your perfect “do not disturb” evening with {you}, hour by hour.',
      'What is the most forbidden-feeling thing you have ever wanted to do with {you}? Hint only.'
    ],
    dares: [
      'Forbidden word: choose a word {you} may not say for 3 turns. Every slip costs them a kiss.',
      'Whisper a compliment, a confession and a promise into {you}’s ear.',
      'Tension test: hold your lips one centimetre from {you}’s neck for 10 seconds — no touching.',
      'Lead {you} by the hand to the spot in the room you would choose for a first kiss — and kiss them there.',
      'Write a time on a piece of paper, hand it to {you} and say “keep this appointment”.',
      'Close your eyes. {you} kisses you once, anywhere above the shoulders. Describe it in three words.',
      'Seduce {you} for 30 seconds in a foreign accent of your choice.',
      'Give {you} a 60-second massage. They choose where: hands, back, neck or feet.',
      'Ask {you}’s permission with only a look, then slowly remove one of their accessories.',
      'Dim the lights, pick a song and give {you} one minute of your best moves.',
      'Hold {you}’s gaze and describe your dream holiday together — make it hot, keep it classy.',
      '{you} sets a one-minute timer. Keep your fingertips moving slowly on their hand or arm until it ends.',
      '{you} names a number from 1 to 15. Kiss them for that many seconds.',
      'Pretend you are seeing {you} for the first time across a crowded room. Walk over and win their number.',
      'Hide a small object on yourself — pocket, sleeve or collar. {you} has 30 seconds to find it.',
      'Whisper the plot of a romance novel starring you and {you} — stop just before the best part.',
      'Give {you} one kiss for each letter of their name, each in a different place (hands, cheeks, neck).',
      'Let {you} whisper a dare for you to do. You may refuse it once — then the next one is final.',
      'Slowly trace the outline of {you}’s lips, jaw and neck with one fingertip.',
      'Make {you} an offer for later tonight that they cannot refuse — and seal it with a kiss.',
      'Undress {you} with your eyes for 10 seconds while they watch you do it.',
      'Remove one item of clothing — you choose which, {you} chooses the music.',
      'Start a kiss on {you}’s hand and end it on their lips — take 20 seconds to get there.',
      'Whisper in {you}’s ear what you want them to wear — or not wear — next time.',
      'Lie back. {you} has 30 seconds to make you blush using only kisses on your face and neck.',
      'Place {you}’s hand wherever you like on your arm, shoulder or neck — it stays there until your next turn.',
      'Kiss {you} in slow motion, as if the film had slowed down.',
      'Blindfold {you}. Kiss them in three different places — they must guess the order.',
      'Give {you} a 60-second back massage — over or under the top, {you} decides.',
      'Sit on {you}’s lap facing them for 30 seconds. No kissing allowed — first to break loses.',
      'Run an ice cube slowly along {you}’s neck and collarbone.',
      'Kiss {you} for 20 seconds without hands — then 20 seconds with.',
      'Gently hold {you}’s hands above their head and whisper your plans for later — then let go.',
      'Let {you} take off one item of your clothing, using only one hand.',
      'Strip-tease of two items — music, eye contact, full commitment.',
      'Kiss {you}’s collarbone, then their shoulder, then their neck — slower each time.',
      'Breathe softly along {you}’s neck for 10 seconds without touching.',
      'Seduce {you} for 60 seconds without touching them at all. They decide if you succeeded.',
      'Point to where you want to be kissed (clothes stay on). {you} kisses it for 10 seconds.',
      'For one minute {you} is in charge — you do what they say, within your limits.',
      'Whisper three things you will do to {you} when the game ends. Keep every promise.',
      'Give {you} a lap dance to a song of their choice — the whole song.',
      'Kiss {you} as if you had not seen each other for a year.',
      'Undo one button of {you}’s shirt or remove one accessory — eyes on theirs the whole time.',
      'Lean in until your lips are one centimetre from {you}’s and stop. Wait for them to close the gap.',
      'Melt a piece of chocolate on your lips and kiss {you}.',
      'Three kisses, three compliments: each kiss somewhere new, each with a whispered compliment.',
      'Act out the first 30 seconds of your fantasy evening with {you} — stop before it gets too hot.',
      'Give {you} a slow, full-body hug and hold it for 30 seconds.',
      'Your choice: remove an item of clothing, or let {you} kiss your neck and shoulders for 20 seconds.'
    ]
  },
  deep: {
    label: 'Deep talk', emoji: '🌙',
    truths: [
      'What are you proud of that you rarely talk about?',
      'What fear are you quietly working on?',
      'What would you tell your younger self?',
      'Which moment changed you the most?',
      'What does a perfect ordinary day look like for you?',
      'What do you need more of right now?',
      'Who has shaped you the most, and how?',
      'What do you hope people say about you when you are not there?',
      'Is there a dream you set aside? Would you pick it back up?',
      'When did you last feel truly at peace?',
      'What are you most grateful for today?',
      'What do you value most in a friendship?',
      'What is something you have forgiven but not forgotten?',
      'When did you last cry, and why?',
      'What is a belief you changed your mind about?',
      'What part of yourself do you hide from most people?',
      'What is the hardest goodbye you have ever said?',
      'What would you do if you knew you could not fail?',
      'What is something you wish people asked you about?',
      'What does home mean to you?',
      'What is the kindest thing a stranger has done for you?',
      'What would you like to be remembered for?',
      'What are you still learning to accept about yourself?',
      'What is one thing you would change about how you were raised?'
    ],
    dares: [
      'Tell {you} one thing you admire about them — in detail.',
      'Share a photo that means a lot to you and tell its story.',
      'Say one goal out loud, and the first step you will take this week.',
      'Close your eyes and describe your happiest place for 30 seconds.',
      'Send a thank-you message to someone you have not thanked enough.',
      'Give {you} one piece of honest, kind advice.',
      'Name three things you genuinely like about yourself.',
      'Sit in silence with {you} for 30 seconds, then share one thought.',
      'Tell {you} about a time they helped you without knowing it.',
      'Describe yourself five years from now in five sentences.',
      'Hum a song that once rescued a bad day, and tell why.',
      'Write a short note to your future self and read it aloud.',
      'Tell {you} something you have never said out loud before.',
      'Share your biggest regret and what it taught you.',
      'Describe {you} as if you were introducing them to your hero.',
      'Tell {you} one thing you would like them to understand about you.',
      'Name one fear and one way you could face it this month.',
      'Look {you} in the eyes and tell them what they mean to you.',
      'Share the best decision you ever made, and how it felt.',
      'Tell {you} about a moment you felt completely alone.',
      'Ask {you} one question you have always wanted to ask.',
      'List five small things that made you happy this week.',
      'Apologise for something — big or small — you never apologised for.'
    ]
  },
  family: {
    label: 'Family', emoji: '🏡',
    truths: [
      'What is your favourite family tradition?',
      'What is the funniest thing that ever happened at a family meal?',
      'Which dish would you ask for on your birthday?',
      'Which chore do you dislike the most?',
      'If you could have any pet in the world, what would it be?',
      'What is the best holiday you remember?',
      'Who is the best cook in the family?',
      'What is your favourite cartoon of all time?',
      'What would you do with a whole free day?',
      'Which superpower would you choose?',
      'What makes you laugh every single time?',
      'Who is the messiest person at home? (Be brave.)',
      'What is the naughtiest thing you did as a kid?',
      'What is your favourite thing about {you}?',
      'Which family member are you most like?',
      'What is the best present you ever got?',
      'If you were the parent for a day, what rule would you make?',
      'What is your favourite family photo?',
      'Which food do you secretly hide from everyone else?',
      'What is the funniest thing a grandparent ever said?',
      'What is your favourite game to play together?',
      'What would you name a new family pet?',
      'What is the best day out we ever had?',
      'Who tells the worst jokes in the family?'
    ],
    dares: [
      'Hop on one foot for 15 seconds.',
      'Make an animal sound — {you} has to guess the animal.',
      'Talk like a robot until your next turn.',
      'Make the funniest face you possibly can.',
      'Tell any joke you know.',
      'Do 10 squats while counting in another language.',
      'Pretend to be a waiter and take {you}\u2019s order.',
      'Draw a cat with your eyes closed.',
      'Say the alphabet backwards as far as you can.',
      'Invent a secret handshake with {you} right now.',
      'Walk like a crab across the room.',
      'Hum a song and let {you} guess it.',
      'Spin around five times, then walk in a straight line.',
      'Do your best grandma or grandpa impression.',
      'Pretend to be a news reporter announcing dinner.',
      'Make {you} laugh without saying a word.',
      'Balance a spoon on your nose for 5 seconds.',
      'Do the chicken dance.',
      'Talk like a baby until your next turn.',
      'Give {you} a piggyback ride (or a very good attempt).',
      'Say five nice things about the person on your left.',
      'Build a tower from whatever is on the table.',
      'Act like a statue in a museum until someone laughs.',
      'Sing your favourite cartoon theme song.'
    ]
  }
};

const meta = {
  id: 'truthdare',
  group: ['couple', 'friends'],
  title: 'Truth or Dare',
  emoji: '🎭',
  tagline: 'Nine decks. One brave question at a time.',
  blurb: 'Icebreakers, friends, party, couple, flirty, spicy 18+, after dark 18+, deep talk and family decks — over 550 cards. Pick truth or dare; the other player judges.',
  minutes: '15 min',
  tags: ['Party', '9 decks', '18+ option'],
  local: true,
  alternate: true,
  levels: [],
  settings: [
    {
      id: 'rounds', label: 'Cards per game', def: 12,
      options: [{ v: 6, label: '6' }, { v: 12, label: '12' }, { v: 20, label: '20' }, { v: 30, label: '30' }, { v: 50, label: '50' }]
    },
    {
      id: 'only', label: 'Cards in play', def: '',
      options: [{ v: '', label: 'Truth & dare' }, { v: 'truth', label: 'Truths only' }, { v: 'dare', label: 'Dares only' }]
    },
    {
      id: 'darePts', label: 'A dare is worth', def: 2,
      options: [{ v: 2, label: '2 points' }, { v: 3, label: '3 points' }]
    },
    {
      id: 'penalty', label: 'Chickening out', def: 0,
      options: [{ v: 0, label: 'No penalty' }, { v: 1, label: '−1 point' }, { v: 2, label: '−2 points' }]
    },
    {
      id: 'swaps', label: '“Another card”', def: 1,
      options: [{ v: 1, label: 'Allowed' }, { v: 0, label: 'Not allowed' }]
    }
  ],
  rules: [
    'Choose your decks — mix as many as you like. Spicy and After dark (18+) are for consenting adult couples — anyone can say no to a card, no questions asked.',
    'On your turn pick Truth, Dare or let fate decide.',
    'The other player judges: done, chickened out, or draw another card.',
    'Turns alternate. Most points wins — but everybody laughs.',
    'Settings: number of cards, truths or dares only, dare points, chicken penalty.'
  ]
};

const pick = (v, allowed, def) => (allowed.includes(v) ? v : def);

function create(opts = {}) {
  const cats = validCats(DECKS, opts.cats) ? opts.cats.slice() : ['ice', 'friends', 'party'];
  return {
    phase: 'choose', turn: 0, cats, card: null, used: [], scores: [0, 0], brave: [0, 0], round: 0, log: [], moves: 0,
    rounds: pick(opts.rounds, [6, 12, 20, 30, 50], ROUNDS),
    only: pick(opts.only, ['', 'truth', 'dare'], ''),
    darePts: pick(opts.darePts, [2, 3], 2),
    penalty: pick(opts.penalty, [0, 1, 2], 0),
    swaps: pick(opts.swaps, [0, 1], 1)
  };
}

function turn(state) {
  return state.phase === 'card' ? 1 - state.turn : state.turn;
}

function deal(state, kind) {
  const d = draw(DECKS, state.cats, state.used, kind === 'truth' ? 'truths' : 'dares');
  return { card: { kind, c: d.c, i: d.i, id: state.moves + 1 }, used: d.used };
}

function apply(state, move) {
  if (!move || outcome(state).over) return null;

  if (move.cats !== undefined) {
    if (state.phase !== 'choose' || !validCats(DECKS, move.cats)) return null;
    return { ...state, cats: move.cats.slice(), moves: state.moves + 1 };
  }

  if (move.pick) {
    if (state.phase !== 'choose') return null;
    const kind = state.only || (move.pick === 'random' ? (Math.random() < 0.5 ? 'truth' : 'dare') : move.pick);
    if (kind !== 'truth' && kind !== 'dare') return null;
    if (state.only && move.pick !== 'random' && move.pick !== state.only) return null;
    const { card, used } = deal(state, kind);
    card.random = move.pick === 'random' && !state.only;
    return { ...state, phase: 'card', card, used, moves: state.moves + 1 };
  }

  if (move.another) {
    if (state.phase !== 'card' || state.swaps === 0) return null;
    const { card, used } = deal(state, state.card.kind);
    return { ...state, card, used, moves: state.moves + 1 };
  }

  if (move.verdict === 'done' || move.verdict === 'skip') {
    if (state.phase !== 'card') return null;
    const p = state.turn;
    const ok = move.verdict === 'done';
    const scores = state.scores.slice();
    const brave = state.brave.slice();
    if (ok) {
      scores[p] += pointsOf(state, state.card.kind);
      if (state.card.kind === 'dare') brave[p] += 1;
    } else {
      scores[p] -= state.penalty || 0;
    }
    const log = [{ seat: p, kind: state.card.kind, ok }, ...state.log].slice(0, 6);
    return { ...state, phase: 'choose', turn: 1 - p, card: null, scores, brave, log, round: state.round + 1, moves: state.moves + 1 };
  }

  return null;
}

function outcome(state) {
  if (state.round < roundsOf(state)) return { over: false };
  const [a, b] = state.scores;
  if (a === b) return { over: true, draw: true, winner: null };
  return { over: true, winner: a > b ? 0 : 1, draw: false };
}

function auto() {
  return null;
}

function ai() {
  return null;
}

function note(state, seat) {
  const pts = state.scores[seat];
  return `${pts} pt${pts === 1 ? '' : 's'} · ${state.brave[seat]} dare${state.brave[seat] === 1 ? '' : 's'}`;
}

function summary(state, ctx) {
  const o = outcome(state);
  if (!o.over || !o.draw) return null;
  return `All square at ${state.scores[0]} points each — equally brave.`;
}

/* ------------------------------ view ------------------------------ */
function names(state, ctx) {
  const me = ctx.names[state.turn] || `Player ${state.turn + 1}`;
  const you = ctx.names[1 - state.turn] || `Player ${2 - state.turn}`;
  return { me, you };
}

function view(state, ctx) {
  const { me, you } = names(state, ctx);
  const over = outcome(state).over;
  const chooser = state.phase === 'choose' && ctx.myTurn;

  let stage;
  if (over) {
    stage = `
      <div class="tod__final">
        <span class="tod__trophy" aria-hidden="true">🏆</span>
        <p>${esc(ctx.names[0])} <b>${state.scores[0]}</b> · <b>${state.scores[1]}</b> ${esc(ctx.names[1])}</p>
      </div>`;
  } else if (state.phase === 'choose') {
    const can = (k) => chooser && (!state.only || state.only === k);
    stage = `
      <div class="tod__deck" aria-hidden="true"><i></i><i></i><i></i><span>🎭</span></div>
      <p class="tod__ask"><b>${esc(me)}</b>, ${state.only === 'truth' ? 'ready for a truth?' : state.only === 'dare' ? 'ready for a dare?' : 'truth or dare?'}</p>
      <div class="tod__picks">
        <button class="tod__btn tod__btn--truth" type="button" data-pick="truth" ${can('truth') ? '' : 'disabled'}>
          <span class="tod__btn-ico" aria-hidden="true">💬</span><b>Truth</b><small>+${pointsOf(state, 'truth')} point</small>
        </button>
        <button class="tod__btn tod__btn--spin" type="button" data-pick="random" ${chooser ? '' : 'disabled'} aria-label="Let fate decide">
          <span aria-hidden="true">🎲</span><small>Fate</small>
        </button>
        <button class="tod__btn tod__btn--dare" type="button" data-pick="dare" ${can('dare') ? '' : 'disabled'}>
          <span class="tod__btn-ico" aria-hidden="true">🔥</span><b>Dare</b><small>+${pointsOf(state, 'dare')} points</small>
        </button>
      </div>`;
  } else {
    const c = state.card;
    const deck = DECKS[c.c];
    const text = deck[c.kind === 'truth' ? 'truths' : 'dares'][c.i] || '';
    const judge = ctx.myTurn;
    stage = `
      <div class="tod__card tod__card--${c.kind}" data-card="${c.id}">
        <div class="tod__inner">
          <div class="tod__face tod__face--back"><span>${c.kind === 'truth' ? '💬' : '🔥'}</span></div>
          <div class="tod__face tod__face--front">
            <span class="tod__kind">${c.kind === 'truth' ? 'Truth' : 'Dare'}${c.random ? ' · by fate' : ''}</span>
            <p class="tod__text">${fill(text, { me, you })}</p>
            <span class="tod__deckname">${deck.emoji} ${esc(deck.label)} · for ${esc(me)}</span>
          </div>
        </div>
      </div>
      ${
        judge
          ? `<p class="tod__ask">${ctx.local ? `<b>${esc(you)}</b>, you judge.` : 'You judge.'} Did ${esc(me)} do it?</p>
             <div class="tod__verdict">
               <button class="btn btn--primary" type="button" data-verdict="done">✓ Done · +${pointsOf(state, c.kind)}</button>
               <button class="btn btn--ghost" type="button" data-verdict="skip">🐔 Chickened out${state.penalty ? ` · −${state.penalty}` : ''}</button>
               ${state.swaps === 0 ? '' : '<button class="btn btn--ghost btn--sm" type="button" data-another>↻ Another card</button>'}
             </div>`
          : `<p class="tod__ask">Your turn to shine — <b>${esc(you)}</b> is the judge.</p>`
      }`;
  }

  return `
    <div class="tod tod--${state.phase}">
      ${catChips(DECKS, state.cats, chooser)}
      ${beads(state.round, roundsOf(state), over ? -1 : state.round)}
      <div class="tod__stage">${stage}</div>
      ${
        state.log.length
          ? `<ol class="tod__log">${state.log
              .map((l) => `<li class="${l.ok ? 'is-ok' : 'is-skip'}"><b>${esc(ctx.names[l.seat] || '')}</b> ${l.ok ? (l.kind === 'dare' ? 'nailed a dare 🔥' : 'told the truth 💬') : `skipped a ${l.kind} 🐔`}</li>`)
              .join('')}</ol>`
          : ''
      }
    </div>`;
}

let lastCelebrated = '';

function bind(root, state, ctx, play) {
  bindCats(root, state.cats, play);
  root.querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('click', () => play({ pick: b.dataset.pick })));
  root.querySelectorAll('[data-verdict]').forEach((b) =>
    b.addEventListener('click', () => {
      if (b.dataset.verdict === 'done') {
        const key = `${ctx.sessionKey}:${state.moves}`;
        if (key !== lastCelebrated) {
          lastCelebrated = key;
          burst(root.querySelector('.tod__stage'), state.card.kind === 'dare' ? ['🔥', '⭐', '✨'] : ['💬', '💜', '✨']);
        }
        setTimeout(() => { if (root.isConnected) play({ verdict: 'done' }); }, 380);
      } else {
        play({ verdict: 'skip' });
      }
    })
  );
  root.querySelector('[data-another]')?.addEventListener('click', () => play({ another: true }));
}

function coach(state, ctx) {
  if (outcome(state).over) return 'Shuffle the decks and go again — or switch to a new mix.';
  const { me, you } = names(state, ctx);
  if (state.phase === 'choose') {
    return ctx.myTurn ? 'Truth is safe, dare pays more. Tap the chips above to mix decks.' : `${me} is choosing…`;
  }
  return ctx.myTurn ? 'Be fair — and be generous with the brave ones.' : `${you} is judging.`;
}
return Object.freeze({ DECKS, meta, create, turn, apply, outcome, auto, ai, note, summary, view, bind, coach });
  })();

  /* ===== js/arcade/games/pairs.js ===== */
  const __m29 = (function () {
const { esc, draw, catChips, bindCats, validCats, beads, burst } = __m27;
/**
 * LifeFlow Arcade — the shared engine behind the two-pick social games.
 * Each round one question, two hidden answers, then a reveal.
 *   mode 'match' — both answer for themselves; every match counts for the pair.
 *   mode 'guess' — one answers about themselves, the other guesses it.
 * state.turn is the player who answers first this round.
 */


function makePairGame(cfg) {
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
return Object.freeze({ makePairGame });
  })();

  /* ===== js/arcade/games/insync.js ===== */
  const __m28 = (function () {
const { makePairGame } = __m29;
/**
 * LifeFlow Arcade — In Sync.
 * "Would you rather…" for two. Both answer in secret, then reveal — how often do you match?
 * Co-operative: you play together against the questions.
 */


const BANK = {
  couple: {
    label: 'Us two', emoji: '💞',
    items: [
      ['A cosy night in', 'A night out in town'],
      ['Breakfast in bed', 'Dinner under the stars'],
      ['A beach holiday', 'A mountain cabin'],
      ['Handwritten love notes', 'Surprise gifts'],
      ['Dance in the kitchen', 'Sing together in the car'],
      ['Plan every detail of a trip', 'Book a flight and improvise'],
      ['A film marathon', 'A board-game night'],
      ['Cook together', 'Order our favourite takeaway'],
      ['Matching pyjamas', 'Matching mugs'],
      ['Hear "I love you" every day', 'Feel it without words'],
      ['A sunrise walk', 'A sunset picnic'],
      ['A cosy flat in the city', 'A big house in the countryside'],
      ['Relive our first date', 'Fast-forward to our dream trip'],
      ['Cuddle on the sofa', 'Cuddle under the stars'],
      ['Matching tattoos', 'Matching rings'],
      ['Long voice notes', 'Long phone calls'],
      ['A surprise party', 'A surprise trip'],
      ['Say sorry first', 'Get the first hug'],
      ['Read each other\u2019s minds', 'Read each other\u2019s messages'],
      ['Our song on repeat', 'A new song every week'],
      ['Pyjamas all Sunday', 'Brunch out every Sunday'],
      ['A small wedding', 'A huge party'],
      ['Grow old in our hometown', 'Grow old somewhere new'],
      ['A love letter every year', 'A photo album every year'],
      ['Share one dessert', 'Each get our own'],
      ['Be the big spoon', 'Be the little spoon'],
      ['Plan date night', 'Be surprised by date night']
    ]
  },
  romance: {
    label: 'Romance', emoji: '🌹',
    items: [
      ['Candlelit dinner at home', 'Rooftop dinner in town'],
      ['A slow dance', 'Stargazing on a blanket'],
      ['Love notes in a pocket', 'Love notes on the mirror'],
      ['A kiss in the rain', 'A kiss at sunset'],
      ['Hold hands everywhere', 'Steal glances across the room'],
      ['Remember every date', 'Recreate every date'],
      ['A weekend away, phones off', 'A week at home, just us'],
      ['Write our love story', 'Film our love story'],
      ['Morning cuddles', 'Late-night talks'],
      ['Flowers for no reason', 'Breakfast in bed for no reason'],
      ['A forehead kiss', 'A long hug from behind'],
      ['Fall in love again every year', 'Stay in love exactly like now'],
      ['A serenade', 'A love poem'],
      ['A picnic by the sea', 'A cabin by the fire']
    ]
  },
  spicy: {
    label: 'Spicy 18+', emoji: '🔥',
    items: [
      ['Kiss slowly', 'Kiss like it is the last time'],
      ['Lights on', 'Candles only'],
      ['Make the first move', 'Be seduced'],
      ['A steamy slow dance', 'A pillow fight that gets out of hand'],
      ['Whisper something naughty', 'Text something naughty'],
      ['A surprise outfit', 'A surprise massage'],
      ['Lingering eye contact across a room', 'A secret touch under the table'],
      ['Kisses on the neck', 'Kisses everywhere but the lips'],
      ['Be teased all evening', 'Do all the teasing'],
      ['A hotel night for no reason', 'Turn the bedroom into a hotel suite'],
      ['Flirt shamelessly in public', 'Save it all for later'],
      ['A long massage with warm oil', 'A long bath together'],
      ['A blindfolded kiss', 'Be the one holding the blindfold'],
      ['Morning romance', 'Midnight romance'],
      ['Dress up for each other', 'Dress down for each other'],
      ['A naughty dare game', 'A slow, sultry evening'],
      ['Be in charge tonight', 'Let them be in charge tonight'],
      ['A spicy photo just for them', 'A spicy voice note just for them'],
      ['Wake them up with kisses', 'Keep them up with kisses'],
      ['Role-play strangers at a bar', 'Role-play a first date all over again']
    ]
  },
  life: {
    label: 'Life together', emoji: '🏡',
    items: [
      ['Wake up early together', 'Sleep in together'],
      ['One shared account', 'Separate accounts'],
      ['A dog', 'A cat'],
      ['Cook every night', 'Meal-prep on Sundays'],
      ['Big family gatherings', 'Quiet holidays for two'],
      ['Save for a house', 'Save for travel'],
      ['Tidy as you go', 'A big clean once a week'],
      ['City life', 'Village life'],
      ['Plan the budget', 'Plan the fun'],
      ['Minimal decor', 'Cosy, full-of-things decor'],
      ['Celebrate every small win', 'Save it for the big moments'],
      ['A series in bed', 'Talks in bed'],
      ['Same side of the bed forever', 'Swap sides whenever'],
      ['Kids early', 'Kids later (or never)']
    ]
  },
  friends: {
    label: 'Friends', emoji: '🤝',
    items: [
      ['A road trip', 'A weekend in a big city'],
      ['Karaoke night', 'An escape room'],
      ['A group chat that never sleeps', 'Calls only when it matters'],
      ['Host the party', 'Be the guest'],
      ['Camping under the stars', 'A five-star hotel'],
      ['Pizza night', 'A barbecue'],
      ['Plan the trip', 'Just show up'],
      ['Always 10 minutes early', 'Always 10 minutes late'],
      ['Be the funny friend', 'Be the wise friend'],
      ['A big birthday party', 'A tiny dinner with close friends'],
      ['Win a quiz night', 'Win a dance-off'],
      ['A spontaneous trip tonight', 'A perfectly planned trip next month'],
      ['Always pick the restaurant', 'Never have to pick'],
      ['Lose your phone for a week', 'Lose your voice for a week'],
      ['A brutally honest friend', 'An always-supportive friend'],
      ['Game night', 'Movie night'],
      ['Live with your best friend', 'Live next door to them'],
      ['Be the DJ', 'Be the photographer'],
      ['Laugh until you cry', 'Talk until sunrise'],
      ['A theme park', 'A water park'],
      ['Share every secret', 'Keep a little mystery']
    ]
  },
  fun: {
    label: 'Silly', emoji: '😂',
    items: [
      ['Fly', 'Be invisible'],
      ['Talk to animals', 'Speak every human language'],
      ['Give up social media', 'Give up films and series'],
      ['Have a rewind button', 'Have a pause button'],
      ['Sing instead of speaking', 'Dance whenever you walk'],
      ['Be a famous singer', 'Be a famous chef'],
      ['Fight one horse-sized duck', 'Fight a hundred duck-sized horses'],
      ['Live in a treehouse', 'Live on a houseboat'],
      ['Teleport anywhere', 'Read minds'],
      ['Unlimited pizza for life', 'Unlimited ice cream for life'],
      ['Always have to whisper', 'Always have to shout'],
      ['Have a pet dragon', 'Have a pet unicorn'],
      ['Only eat with chopsticks', 'Only eat with a spoon'],
      ['Be a famous YouTuber', 'Be a secret millionaire'],
      ['Have a personal chef', 'Have a personal driver'],
      ['Be stuck in a lift with your boss', 'Be stuck in a lift with your ex'],
      ['Live without music', 'Live without films'],
      ['Subtitles for people\u2019s thoughts', 'A rewind button for conversations'],
      ['Be the funniest in the room', 'Be the smartest in the room'],
      ['Snore like a tractor', 'Talk in your sleep'],
      ['Wear pyjamas everywhere', 'Wear a suit everywhere'],
      ['Sneeze glitter', 'Hiccup bubbles'],
      ['Live in the past', 'Live in the future']
    ]
  },
  deep: {
    label: 'Deep', emoji: '🌙',
    items: [
      ['Know every big change before it happens', 'Be surprised by all of them'],
      ['Relive your best day', 'Erase your worst day'],
      ['Be liked by many', 'Be deeply loved by a few'],
      ['Have more time', 'Have more money'],
      ['Follow your heart', 'Follow your head'],
      ['Know a painful truth', 'Keep a kind illusion'],
      ['A quiet, peaceful life', 'An exciting, unpredictable life'],
      ['Change one thing in the past', 'See one thing in the future'],
      ['Be remembered for ever', 'Be happy and forgotten'],
      ['Live by the sea', 'Live in the mountains'],
      ['Always say what you think', 'Never say anything you regret'],
      ['Be brave', 'Be wise'],
      ['Forgive easily', 'Never forget'],
      ['A big love that ends', 'A calm love that lasts'],
      ['Know all the answers', 'Ask all the right questions'],
      ['Be fearless', 'Be at peace'],
      ['A life of comfort', 'A life of meaning'],
      ['Start over somewhere new', 'Grow where you are planted'],
      ['Be understood', 'Be admired'],
      ['Give advice', 'Receive advice']
    ]
  },
  travel: {
    label: 'Travel', emoji: '✈️',
    items: [
      ['Tokyo', 'New York'],
      ['A safari in Africa', 'Northern lights in Norway'],
      ['Backpacking', 'A luxury resort'],
      ['A train across Europe', 'A road trip across America'],
      ['A night in the desert', 'A tropical island'],
      ['Window seat', 'Aisle seat'],
      ['Museums and history', 'Street food and markets'],
      ['Travel solo', 'Travel with a group'],
      ['The riads of Marrakech', 'The bazaars of Istanbul'],
      ['A ski holiday', 'A beach holiday'],
      ['A cruise', 'A road trip'],
      ['Paris', 'Rome'],
      ['Bali', 'Santorini'],
      ['A hidden village', 'A famous landmark'],
      ['A treehouse hotel', 'An ice hotel'],
      ['A hot-air balloon ride', 'Diving with turtles'],
      ['Pack light', 'Pack for every possibility'],
      ['The blue streets of Chefchaouen', 'The rose city of Petra'],
      ['Andalusia', 'Cappadocia'],
      ['A long weekend every month', 'One huge trip a year']
    ]
  },
  food: {
    label: 'Food', emoji: '🍕',
    items: [
      ['Sweet', 'Salty'],
      ['Pizza', 'Burger'],
      ['Tea', 'Coffee'],
      ['Couscous Friday', 'Pasta night'],
      ['Chocolate', 'Fresh fruit'],
      ['Spicy', 'Mild'],
      ['A big breakfast', 'A big dinner'],
      ['Home cooking', 'A restaurant'],
      ['Pancakes', 'Waffles'],
      ['Sushi', 'Tajine'],
      ['Ice cream', 'Cake'],
      ['Cook it', 'Just eat it'],
      ['Crêpes', 'Msemen'],
      ['Street food', 'Fine dining'],
      ['Breakfast for dinner', 'Dinner for breakfast'],
      ['Chocolate cake', 'Cheesecake'],
      ['Crispy fries', 'Creamy mash'],
      ['Cook for a crowd', 'Cook for two'],
      ['Harissa on everything', 'No sauce at all'],
      ['Feed each other', 'Fight over the last bite']
    ]
  }
};

const VERDICTS = [
  [9, 'practically one mind 💞'],
  [7, 'beautifully in tune'],
  [5, 'pretty close'],
  [3, 'opposites attract'],
  [0, 'full of surprises']
];

const G = makePairGame({
  bank: BANK,
  mode: 'match',
  rounds: 10,
  cats: ['couple', 'fun', 'food'],
  options: (it) => it,
  ask: () => ({ eyebrow: 'Would you rather…', text: '' }),
  hitLine: () => 'In sync! 💞',
  missLine: () => 'Different picks — tell each other why.',
  verdict: (hits, total) => (VERDICTS.find(([n]) => hits >= Math.round((n * total) / 10)) || VERDICTS[VERDICTS.length - 1])[1]
});

const meta = {
  id: 'insync',
  group: ['couple', 'friends'],
  title: 'In Sync',
  emoji: '💞',
  tagline: 'Would you rather… and do you match?',
  blurb: 'Two answers, chosen in secret, revealed together. Nine decks from cosy to silly to spicy — find out how in tune you really are.',
  minutes: '8 min',
  tags: ['Couples', 'Co-op', '9 decks'],
  local: true,
  alternate: true,
  levels: [],
  settings: [
    {
      id: 'rounds', label: 'Questions per game', def: 10,
      options: [{ v: 5, label: '5' }, { v: 10, label: '10' }, { v: 15, label: '15' }, { v: 20, label: '20' }, { v: 30, label: '30' }]
    }
  ],
  rules: [
    'Each round brings a "would you rather" with two choices.',
    'You both answer in secret — on one phone, hand it over when asked.',
    'Then the reveal: every match is a point for the two of you.',
    'Mix the decks with the chips at the top. Spicy 18+ is for grown-up couples.',
    'Change the number of questions in Settings.'
  ]
};

function create(opts) { return G.create(opts); }
function turn(state) { return G.turn(state); }
function apply(state, move) { return G.apply(state, move); }
function outcome(state) { return G.outcome(state); }
function auto() { return null; }
function ai() { return null; }
function note(state, seat) { return G.note(state, seat); }
function summary(state) { return G.summary(state); }
function view(state, ctx) { return G.view(state, ctx); }
function bind(root, state, ctx, play) { return G.bind(root, state, ctx, play); }
function coach(state, ctx) { return G.coach(state, ctx); }
return Object.freeze({ meta, create, turn, apply, outcome, auto, ai, note, summary, view, bind, coach });
  })();

  /* ===== js/arcade/games/knowme.js ===== */
  const __m30 = (function () {
const { makePairGame } = __m29;
/**
 * LifeFlow Arcade — Know Me?
 * One answers a question about themselves in secret; the other guesses it.
 * Roles swap every round. Whoever reads the other best wins.
 */


const BANK = {
  me: {
    label: 'Everyday me', emoji: '🙂',
    items: [
      ['Perfect weekend?', ['Lazy at home', 'Out in nature', 'With friends', 'Exploring a city']],
      ['Favourite season?', ['Spring', 'Summer', 'Autumn', 'Winter']],
      ['Morning or night?', ['Early bird', 'Night owl', 'Depends on the day', 'Always tired']],
      ['Biggest pet peeve?', ['Lateness', 'Loud chewing', 'Messy spaces', 'Slow walkers']],
      ['Dream pet?', ['A dog', 'A cat', 'A bird', 'No pets, thanks']],
      ['Superpower of choice?', ['Flying', 'Invisibility', 'Teleportation', 'Reading minds']],
      ['When stressed, I…', ['Sleep it off', 'Eat something nice', 'Talk it out', 'Go for a walk']],
      ['Best way to relax?', ['Music', 'A film or series', 'A long bath', 'Sport']],
      ['Phone battery usually at…', ['Above 80%', 'Around half', 'Living on 5%', 'Always charging']],
      ['Messy or tidy?', ['Spotless', 'Organised chaos', 'Tidy on the outside', 'Do not open that drawer']],
      ['First thing I do in the morning?', ['Check my phone', 'Coffee or tea', 'Snooze again', 'Shower']],
      ['How I spend a rainy day?', ['Under a blanket', 'Cleaning the house', 'Out anyway', 'Cooking something big']],
      ['My shopping style?', ['Plan and list', 'Impulse buys', 'Online only', 'Avoid it']],
      ['What drains my energy fastest?', ['Crowds', 'Boredom', 'Arguments', 'Bad sleep']],
      ['Favourite time of day?', ['Sunrise', 'Lunchtime', 'Golden hour', 'Midnight']],
      ['In a group I am usually…', ['The organiser', 'The joker', 'The listener', 'The one on the phone']],
      ['My guilty pleasure?', ['Reality TV', 'Junk food', 'Online shopping', 'Napping']],
      ['How I handle a bad day?', ['Music loud', 'Talk to someone', 'Stay quiet', 'Treat myself']]
    ]
  },
  food: {
    label: 'Food & taste', emoji: '🍜',
    items: [
      ['Comfort food?', ['Pizza', 'Couscous', 'Chocolate', 'Pasta']],
      ['Go-to drink?', ['Coffee', 'Mint tea', 'Juice', 'Water']],
      ['Snack mood?', ['Sweet', 'Salty', 'Both at once', 'Fruit, honestly']],
      ['Favourite cuisine?', ['Moroccan', 'Italian', 'Asian', 'Mexican']],
      ['Eggs, how?', ['Scrambled', 'Fried', 'Omelette', 'Boiled']],
      ['Dessert of choice?', ['Ice cream', 'Cake', 'Fruit salad', 'Pastries']],
      ['At a restaurant, what matters most?', ['The food', 'The view', 'The company', 'The price']],
      ['Spice level?', ['None, please', 'A little kick', 'Hot', 'Set my mouth on fire']],
      ['Breakfast of choice?', ['Msemen and honey', 'Eggs', 'Cereal', 'Just coffee']],
      ['Pizza topping?', ['Margherita', 'Tuna', 'Pepperoni', 'Everything']],
      ['Food I could eat every day?', ['Bread', 'Rice', 'Pasta', 'Chicken']],
      ['In the kitchen I am…', ['The chef', 'The helper', 'The taster', 'Banned']],
      ['Late-night craving?', ['Chocolate', 'Chips', 'Leftovers', 'Ice cream']],
      ['Fast-food order?', ['Burger', 'Tacos', 'Fried chicken', 'Never']]
    ]
  },
  love: {
    label: 'Love & us', emoji: '💞',
    items: [
      ['Love language?', ['Kind words', 'Quality time', 'Gifts', 'Acts of service']],
      ['Ideal date?', ['A fancy dinner', 'A picnic', 'The cinema', 'A long walk']],
      ['Most romantic gesture?', ['A handwritten letter', 'A surprise trip', 'Flowers', 'Cooking dinner']],
      ['How I show I care?', ['Little gifts', 'Helping out', 'Sweet words', 'Making time']],
      ['Perfect evening together?', ['Cooking together', 'Film night', 'Going out', 'Talking for hours']],
      ['After an argument I…', ['Need some space', 'Want to talk it out now', 'Make a joke', 'Apologise first']],
      ['Favourite kind of photo of us?', ['Silly selfies', 'Travel shots', 'Candid moments', 'We never take any']],
      ['Anniversary plan?', ['A trip away', 'A special dinner', 'A cosy day at home', 'A surprise']],
      ['What made me fall for you?', ['Your smile', 'Your humour', 'Your kindness', 'Your eyes']],
      ['Best compliment you can give me?', ['You look amazing', 'You are so smart', 'I am proud of you', 'You make me laugh']],
      ['When I miss you I…', ['Text you', 'Look at our photos', 'Call you', 'Pretend I am fine']],
      ['Our song is more…', ['A love ballad', 'A party song', 'A cheesy classic', 'We do not have one (yet)']],
      ['Jealous type?', ['Not at all', 'A tiny bit', 'Secretly yes', 'Very']],
      ['My favourite part of our routine?', ['Morning coffee', 'Dinner together', 'Bedtime talks', 'Weekend plans']],
      ['Biggest turn-off?', ['Rudeness', 'Being late', 'Bad hygiene', 'Phone at dinner']],
      ['How I want to be cheered up?', ['A hug', 'Food', 'Jokes', 'Space']]
    ]
  },
  spicy: {
    label: 'Spicy 18+', emoji: '🔥',
    items: [
      ['Where do I love being kissed most?', ['The lips', 'The neck', 'The forehead', 'Behind the ear']],
      ['My idea of a sexy evening?', ['Candles and music', 'A fancy night out', 'A hotel room', 'A surprise at home']],
      ['What gets me in the mood fastest?', ['Compliments', 'A massage', 'Teasing', 'A slow dance']],
      ['My most attractive feature, in my opinion?', ['My eyes', 'My smile', 'My body', 'My confidence']],
      ['What I notice first about you?', ['Your eyes', 'Your lips', 'Your scent', 'Your voice']],
      ['Flirting style?', ['Bold and direct', 'Shy and sweet', 'Teasing', 'All through texts']],
      ['Favourite kind of kiss?', ['Slow and soft', 'Passionate', 'Playful', 'Surprise kisses']],
      ['The outfit of yours I like best?', ['Dressed up', 'Comfy at home', 'Sporty', 'Just a shirt']],
      ['Who makes the first move more often?', ['Me', 'You', 'Fifty-fifty', 'Nobody — it just happens']],
      ['The most romantic place to be alone with you?', ['A beach at night', 'A cabin', 'A hotel suite', 'Our own bedroom']],
      ['A sweet secret fantasy?', ['A weekend away', 'A candlelit bath', 'Dancing in the dark', 'A surprise date']],
      ['Spicy texts are…', ['My thing', 'Fun sometimes', 'Too awkward', 'Better in person']],
      ['Morning or night for romance?', ['Morning', 'Afternoon', 'Late night', 'Any time']],
      ['What makes me blush the most?', ['Compliments', 'Your stare', 'Whispers', 'Teasing in public']]
    ]
  },
  past: {
    label: 'Memories', emoji: '📸',
    items: [
      ['As a kid I wanted to be…', ['An astronaut', 'A doctor', 'A footballer or athlete', 'A singer or actor']],
      ['At school I was…', ['The good student', 'The class clown', 'The quiet one', 'Always in trouble']],
      ['My first phone?', ['A Nokia', 'A flip phone', 'A smartphone', 'Do not remember']],
      ['Favourite childhood cartoon?', ['Tom & Jerry', 'Dragon Ball', 'Pokémon', 'The Simpsons']],
      ['Best school subject?', ['Maths', 'Languages', 'Sport', 'Art']],
      ['Childhood fear?', ['The dark', 'Dogs', 'Doctors', 'Being alone']],
      ['Best family holiday?', ['The beach', 'The countryside', 'Abroad', 'Staying at grandma’s']],
      ['First crush was on…', ['A classmate', 'A celebrity', 'A neighbour', 'A cartoon character']]
    ]
  },
  would: {
    label: 'What would I do?', emoji: '🤔',
    items: [
      ['I find a wallet full of cash. I…', ['Return it all', 'Hand it to the police', 'Keep a reward', 'Panic']],
      ['A spider in the room. I…', ['Kill it', 'Save it outside', 'Call for help', 'Move house']],
      ['Free afternoon, no plans. I…', ['Nap', 'Go out', 'Call someone', 'Binge a series']],
      ['The waiter brings the wrong dish. I…', ['Eat it anyway', 'Politely ask again', 'Complain loudly', 'Make you ask']],
      ['I get lost in a new city. I…', ['Use the map', 'Ask a local', 'Wander happily', 'Call you']],
      ['Someone cuts the queue. I…', ['Say something', 'Glare silently', 'Let it go', 'Tell you later']],
      ['A friend forgets my birthday. I…', ['Say nothing', 'Remind them', 'Get sulky', 'Laugh it off']],
      ['I win €1,000 tomorrow. First buy?', ['Clothes', 'Tech', 'A trip', 'Nothing — save it']]
    ]
  },
  dreams: {
    label: 'Dreams', emoji: '✨',
    items: [
      ['Dream destination?', ['Japan', 'The Maldives', 'Iceland', 'Peru']],
      ['Win the lottery — first move?', ['Buy a house', 'Travel the world', 'Spoil the family', 'Save every cent']],
      ['Dream job?', ['Artist', 'Entrepreneur', 'Doctor', 'Explorer']],
      ['Where would I live?', ['A big city', 'By the sea', 'In the countryside', 'Abroad']],
      ['Skill I would love to master?', ['An instrument', 'A new language', 'Cooking', 'Drawing']],
      ['Dream car?', ['Something classic', 'Electric', 'A big 4x4', 'I do not care about cars']],
      ['Life in ten years?', ['Calm family life', 'A big career', 'Travelling', 'Running my own thing']],
      ['A day with no rules — I would…', ['Sleep in', 'Go on an adventure', 'Gather everyone I love', 'Learn something new']],
      ['Biggest goal this year?', ['Health', 'Money', 'Love', 'Career']],
      ['Dream wedding?', ['Big and loud', 'Small and intimate', 'Abroad', 'Courthouse and a party']],
      ['If I wrote a book it would be…', ['A love story', 'A thriller', 'A cookbook', 'My life story']],
      ['Retirement plan?', ['A house by the sea', 'Travel non-stop', 'Near the grandkids', 'Never retire']]
    ]
  },
  fun: {
    label: 'Just for fun', emoji: '😄',
    items: [
      ['Which animal am I most like?', ['A cat', 'A dog', 'An owl', 'A dolphin']],
      ['Karaoke genre?', ['Pop', 'Rap', 'Golden oldies', 'I refuse to sing']],
      ['Role in a zombie apocalypse?', ['The leader', 'The medic', 'The cook', 'First to go']],
      ['Hidden talent?', ['Cooking', 'Impressions', 'Dancing', 'Fixing things']],
      ['Grab one thing in a hurry?', ['My phone', 'Photos', 'My pet', 'My passport']],
      ['Scariest for me?', ['Spiders', 'Heights', 'Public speaking', 'Deep water']],
      ['Favourite film genre?', ['Comedy', 'Action', 'Romance', 'Horror']],
      ['My texting style?', ['Long paragraphs', 'One word', 'Only emojis', 'Voice notes']],
      ['My most-used emoji?', ['😂', '❤️', '😭', '👍']],
      ['Which celebrity would play me in a film?', ['A comedy star', 'An action hero', 'A drama queen or king', 'A cartoon voice']],
      ['If I were a dessert?', ['Chocolate cake', 'Ice cream', 'Baklava', 'Something spicy']],
      ['Game I always win?', ['Cards', 'Quizzes', 'Video games', 'Arguments']]
    ]
  }
};

const G = makePairGame({
  bank: BANK,
  mode: 'guess',
  rounds: 10,
  cats: ['me', 'food', 'fun', 'dreams'],
  options: (it) => it[1],
  ask: (it, { role, subject }) => ({
    eyebrow: role === 'self' ? 'About you' : `About ${subject}`,
    text: it[0]
  }),
  hitLine: (r) => `${r.nSecond} knows ${r.nFirst} well. +1`,
  missLine: (r) => `Not quite — ${r.nFirst}, tell the story.`
});

const meta = {
  id: 'knowme',
  group: ['couple', 'friends'],
  title: 'Know Me?',
  emoji: '🔮',
  tagline: 'How well do you really know each other?',
  blurb: 'One answers about themselves in secret, the other guesses. Roles swap every round — the sharpest guesser wins. Eight decks, spicy one included.',
  minutes: '8 min',
  tags: ['Couples', 'Friends', '8 decks'],
  local: true,
  alternate: true,
  levels: [],
  settings: [
    {
      id: 'rounds', label: 'Questions per game', def: 10,
      options: [{ v: 6, label: '6' }, { v: 10, label: '10' }, { v: 16, label: '16' }, { v: 20, label: '20' }, { v: 30, label: '30' }]
    }
  ],
  rules: [
    'Each round one of you is the subject and answers about themselves — in secret.',
    'The other guesses what the subject chose.',
    'A correct guess scores 1 point. Roles swap every round.',
    'Most correct guesses wins. Pick the decks with the chips; set the length in Settings.'
  ]
};

function create(opts) { return G.create(opts); }
function turn(state) { return G.turn(state); }
function apply(state, move) { return G.apply(state, move); }
function outcome(state) { return G.outcome(state); }
function auto() { return null; }
function ai() { return null; }
function note(state, seat) { return G.note(state, seat); }
function summary(state) { return G.summary(state); }
function view(state, ctx) { return G.view(state, ctx); }
function bind(root, state, ctx, play) { return G.bind(root, state, ctx, play); }
function coach(state, ctx) { return G.coach(state, ctx); }
return Object.freeze({ meta, create, turn, apply, outcome, auto, ai, note, summary, view, bind, coach });
  })();

  /* ===== js/arcade/games/quiz.js ===== */
  const __m31 = (function () {
const { esc, rand, shuffle, draw, catChips, bindCats, validCats, beads, burst } = __m27;
/**
 * LifeFlow Arcade — Quiz Duel.
 * Ten questions, ten categories. Both players answer the same question in turn —
 * the second never sees it until it is theirs. Right answers score 10, plus up to 10 for speed.
 */


const TOTAL = 10;
const LIMIT = 20000;

/** Settings travel inside the state so both players share them. */
const totalOf = (s) => s.total || TOTAL;
const limitOf = (s) => (s.limit === 0 ? 0 : s.limit || LIMIT);
const clockOf = (s) => limitOf(s) || 60000;

/** Each item: [question, [correct, wrong, wrong, wrong]]. */
const BANK = {
  geo: {
    label: 'Geography', emoji: '🌍',
    items: [
      ['What is the capital of Australia?', ['Canberra', 'Sydney', 'Melbourne', 'Perth']],
      ['Which is the longest river in Africa?', ['The Nile', 'The Congo', 'The Niger', 'The Zambezi']],
      ['What is the largest ocean on Earth?', ['Pacific', 'Atlantic', 'Indian', 'Arctic']],
      ['What is the largest hot desert in the world?', ['Sahara', 'Gobi', 'Kalahari', 'Atacama']],
      ['What is the capital of Canada?', ['Ottawa', 'Toronto', 'Vancouver', 'Montreal']],
      ['What is the capital of Morocco?', ['Rabat', 'Casablanca', 'Marrakech', 'Fes']],
      ['Which country is shaped like a boot?', ['Italy', 'Greece', 'Portugal', 'Chile']],
      ['Which strait separates Spain from Morocco?', ['Gibraltar', 'Bosphorus', 'Hormuz', 'Magellan']],
      ['What is the smallest country in the world?', ['Vatican City', 'Monaco', 'San Marino', 'Malta']],
      ['Mount Everest lies on the border of Nepal and…', ['China', 'India', 'Bhutan', 'Pakistan']],
      ['Which mountain range runs through Morocco?', ['The Atlas', 'The Andes', 'The Alps', 'The Urals']]
    ]
  },
  science: {
    label: 'Science', emoji: '🔬',
    items: [
      ['Which gas do plants absorb from the air?', ['Carbon dioxide', 'Oxygen', 'Nitrogen', 'Helium']],
      ['Which planet is known as the Red Planet?', ['Mars', 'Venus', 'Jupiter', 'Mercury']],
      ['How many bones are in the adult human body?', ['206', '201', '212', '186']],
      ['What is the hardest natural substance?', ['Diamond', 'Gold', 'Iron', 'Quartz']],
      ['What is the closest star to Earth?', ['The Sun', 'Proxima Centauri', 'Sirius', 'Polaris']],
      ['Light travels at roughly…', ['300,000 km/s', '30,000 km/s', '3,000 km/s', '3 million km/s']],
      ['What is the chemical symbol for gold?', ['Au', 'Ag', 'Gd', 'Go']],
      ['Which organ pumps blood around the body?', ['The heart', 'The liver', 'The lungs', 'The kidneys']],
      ['What is the largest planet in our solar system?', ['Jupiter', 'Saturn', 'Neptune', 'Earth']],
      ['At sea level, water boils at…', ['100 °C', '90 °C', '110 °C', '120 °C']],
      ['What do we call H₂O?', ['Water', 'Salt', 'Hydrogen peroxide', 'Ammonia']]
    ]
  },
  history: {
    label: 'History', emoji: '🏛️',
    items: [
      ['In which year did humans first land on the Moon?', ['1969', '1965', '1972', '1959']],
      ['Who was the first person in space?', ['Yuri Gagarin', 'Neil Armstrong', 'Alan Shepard', 'John Glenn']],
      ['Which ancient wonder still stands today?', ['The Great Pyramid of Giza', 'The Colossus of Rhodes', 'The Hanging Gardens of Babylon', 'The Lighthouse of Alexandria']],
      ['In which year did the Berlin Wall fall?', ['1989', '1991', '1979', '1985']],
      ['Which civilisation built Machu Picchu?', ['The Inca', 'The Aztecs', 'The Maya', 'The Olmecs']],
      ['In which year did the Titanic sink?', ['1912', '1905', '1920', '1898']],
      ['Who was the first emperor of Rome?', ['Augustus', 'Julius Caesar', 'Nero', 'Constantine']],
      ['In which year did World War II end?', ['1945', '1944', '1946', '1939']],
      ['In which city did Fatima al-Fihri found al-Qarawiyyin?', ['Fes', 'Cairo', 'Baghdad', 'Córdoba']],
      ['Who was the first person to walk on the Moon?', ['Neil Armstrong', 'Buzz Aldrin', 'Yuri Gagarin', 'Michael Collins']]
    ]
  },
  arts: {
    label: 'Arts & books', emoji: '🎨',
    items: [
      ['Who painted the Mona Lisa?', ['Leonardo da Vinci', 'Michelangelo', 'Raphael', 'Picasso']],
      ['Who wrote "Romeo and Juliet"?', ['William Shakespeare', 'Charles Dickens', 'Victor Hugo', 'Molière']],
      ['Who wrote "Les Misérables"?', ['Victor Hugo', 'Alexandre Dumas', 'Émile Zola', 'Gustave Flaubert']],
      ['Who painted "The Starry Night"?', ['Vincent van Gogh', 'Edvard Munch', 'Henri Matisse', 'Rembrandt']],
      ['How many keys does a standard piano have?', ['88', '76', '92', '64']],
      ['In which city is the Louvre museum?', ['Paris', 'Rome', 'London', 'Madrid']],
      ['Who sculpted the famous "David" in Florence?', ['Michelangelo', 'Donatello', 'Bernini', 'Rodin']],
      ['Who wrote "The Little Prince"?', ['Antoine de Saint-Exupéry', 'Jules Verne', 'Albert Camus', 'Victor Hugo']],
      ['Which language has the most native speakers?', ['Mandarin Chinese', 'English', 'Spanish', 'Hindi']],
      ['How many strings does a classical guitar usually have?', ['6', '4', '5', '8']]
    ]
  },
  sport: {
    label: 'Sport', emoji: '⚽',
    items: [
      ['How many players does a football team have on the pitch?', ['11', '10', '9', '12']],
      ['How often are the Summer Olympics held?', ['Every 4 years', 'Every 2 years', 'Every 3 years', 'Every 5 years']],
      ['Which country won the first FIFA World Cup in 1930?', ['Uruguay', 'Brazil', 'Argentina', 'Italy']],
      ['In tennis, what is a score of zero called?', ['Love', 'Nil', 'Zero', 'Duck']],
      ['How long is a marathon?', ['42.195 km', '40 km', '45 km', '38.5 km']],
      ['Which sport uses a shuttlecock?', ['Badminton', 'Squash', 'Tennis', 'Table tennis']],
      ['How many rings are on the Olympic flag?', ['5', '4', '6', '7']],
      ['In which sport would you perform a slam dunk?', ['Basketball', 'Volleyball', 'Handball', 'Rugby']],
      ['Which country hosted the 2022 FIFA World Cup?', ['Qatar', 'Russia', 'Brazil', 'Morocco']],
      ['How far did Morocco go at the 2022 World Cup?', ['Semi-finals', 'Quarter-finals', 'The final', 'Round of 16']]
    ]
  },
  screen: {
    label: 'Film & music', emoji: '🎬',
    items: [
      ['Which film features the line "I\u2019ll be back"?', ['The Terminator', 'Rocky', 'Die Hard', 'Predator']],
      ['Who is the young lion hero of "The Lion King"?', ['Simba', 'Mufasa', 'Nala', 'Scar']],
      ['Which band recorded "Bohemian Rhapsody"?', ['Queen', 'The Beatles', 'ABBA', 'The Rolling Stones']],
      ['"Thriller" is a famous album by…', ['Michael Jackson', 'Prince', 'Madonna', 'Stevie Wonder']],
      ['Which school does Harry Potter attend?', ['Hogwarts', 'Durmstrang', 'Beauxbatons', 'Ilvermorny']],
      ['Which film won the first Oscar for Best Animated Feature?', ['Shrek', 'Toy Story', 'Finding Nemo', 'Monsters, Inc.']],
      ['Beethoven kept composing despite losing his…', ['Hearing', 'Sight', 'Sense of smell', 'Voice']],
      ['What is the snowman called in "Frozen"?', ['Olaf', 'Sven', 'Kristoff', 'Hans']],
      ['Who directed "Jurassic Park"?', ['Steven Spielberg', 'James Cameron', 'George Lucas', 'Ridley Scott']],
      ['How many strings does a violin have?', ['4', '5', '6', '3']],
      ['Who sang "Rolling in the Deep"?', ['Adele', 'Beyoncé', 'Rihanna', 'Shakira']]
    ]
  },
  nature: {
    label: 'Animals & nature', emoji: '🐾',
    items: [
      ['What is the fastest land animal?', ['Cheetah', 'Lion', 'Pronghorn', 'Horse']],
      ['What is the largest animal that has ever lived?', ['Blue whale', 'African elephant', 'Giraffe', 'Sperm whale']],
      ['How many legs does a spider have?', ['8', '6', '10', '12']],
      ['Which animal is called the "ship of the desert"?', ['The camel', 'The horse', 'The donkey', 'The elephant']],
      ['How many hearts does an octopus have?', ['3', '1', '2', '4']],
      ['What is a baby kangaroo called?', ['A joey', 'A kit', 'A cub', 'A calf']],
      ['Which tree grows acorns?', ['Oak', 'Pine', 'Maple', 'Olive']],
      ['What is the tallest animal?', ['Giraffe', 'Elephant', 'Camel', 'Ostrich']],
      ['What do bees make from nectar?', ['Honey', 'Silk', 'Pollen', 'Resin']],
      ['What does a caterpillar become?', ['A butterfly or moth', 'A beetle', 'A bee', 'A dragonfly']]
    ]
  },
  food: {
    label: 'Food', emoji: '🍜',
    items: [
      ['Which country does sushi come from?', ['Japan', 'China', 'Korea', 'Thailand']],
      ['The tajine is named after…', ['The clay pot it cooks in', 'A spice', 'A city', 'A famous chef']],
      ['Guacamole is mainly made from…', ['Avocado', 'Peas', 'Cucumber', 'Lime']],
      ['Which spice is the most expensive by weight?', ['Saffron', 'Turmeric', 'Cumin', 'Paprika']],
      ['Hummus is made mainly from…', ['Chickpeas', 'Lentils', 'White beans', 'Peas']],
      ['Raisins are dried…', ['Grapes', 'Plums', 'Figs', 'Dates']],
      ['Pizza Margherita is linked to which Italian city?', ['Naples', 'Rome', 'Milan', 'Venice']],
      ['Marzipan is made from which nut?', ['Almond', 'Walnut', 'Peanut', 'Hazelnut']],
      ['Pad thai comes from…', ['Thailand', 'Vietnam', 'Japan', 'India']],
      ['Tofu is made from…', ['Soybeans', 'Rice', 'Wheat', 'Chickpeas']]
    ]
  },
  tech: {
    label: 'Tech', emoji: '💻',
    items: [
      ['What does "www" stand for?', ['World Wide Web', 'World Web Wide', 'Wide World Web', 'Web World Wide']],
      ['Who co-founded Microsoft with Paul Allen?', ['Bill Gates', 'Steve Jobs', 'Larry Page', 'Mark Zuckerberg']],
      ['What does "CPU" stand for?', ['Central Processing Unit', 'Computer Personal Unit', 'Central Program Utility', 'Core Power Unit']],
      ['Which company makes the iPhone?', ['Apple', 'Samsung', 'Google', 'Nokia']],
      ['How many bits are in a byte?', ['8', '4', '16', '10']],
      ['What does "AI" stand for?', ['Artificial intelligence', 'Automated internet', 'Advanced interface', 'Analog input']],
      ['Which language styles web pages?', ['CSS', 'SQL', 'Python', 'C']],
      ['What does "USB" stand for?', ['Universal Serial Bus', 'United System Board', 'Universal Signal Box', 'User Service Bridge']],
      ['How is the number 2 written in binary?', ['10', '2', '11', '01']],
      ['Which symbol starts a hashtag?', ['#', '@', '&', '*']]
    ]
  },
  islam: {
    label: 'Islamic culture', emoji: '🕌',
    items: [
      ['How many surahs are in the Qur\u2019an?', ['114', '110', '120', '99']],
      ['What was the first word revealed to the Prophet ﷺ?', ['Iqra (Read)', 'Bismillah', 'Alhamdulillah', 'Qul (Say)']],
      ['Which is the longest surah of the Qur\u2019an?', ['Al-Baqarah', 'Al-Imran', 'An-Nisa', 'Al-Kahf']],
      ['In which month do Muslims fast?', ['Ramadan', 'Shawwal', 'Muharram', 'Rajab']],
      ['How many pillars of Islam are there?', ['5', '4', '6', '7']],
      ['In which city is the Kaaba?', ['Mecca', 'Medina', 'Jerusalem', 'Taif']],
      ['What is the opening surah of the Qur\u2019an?', ['Al-Fatiha', 'Al-Baqarah', 'Al-Ikhlas', 'An-Nas']],
      ['The Hijra was the migration from Mecca to…', ['Medina', 'Taif', 'Jerusalem', 'Abyssinia']],
      ['How many daily prayers are prescribed?', ['5', '3', '4', '6']],
      ['Which night is "better than a thousand months"?', ['Laylat al-Qadr', 'Laylat al-Isra', 'The night of Eid', 'The first night of Muharram']],
      ['Which is the shortest surah of the Qur\u2019an?', ['Al-Kawthar', 'Al-Ikhlas', 'An-Nas', 'Al-Asr']]
    ]
  }
};

const ACCURACY = { gentle: 0.45, even: 0.65, sharp: 0.85 };

const meta = {
  id: 'quiz',
  group: ['brain', 'friends'],
  title: 'Quiz Duel',
  emoji: '🧠',
  tagline: 'Same question, two minds, one clock.',
  blurb: 'Ten categories from geography to film to Islamic culture. Answer right for 10 points and fast for up to 10 more — the other player never sees the question early.',
  minutes: '6 min',
  tags: ['Trivia', '10 categories'],
  alternate: true,
  levels: [
    { id: 'gentle', label: 'Gentle', hint: 'Knows a bit, takes its time.' },
    { id: 'even', label: 'Even', hint: 'A solid pub-quiz regular.' },
    { id: 'sharp', label: 'Sharp', hint: 'Knows nearly everything — and fast.' }
  ],
  settings: [
    {
      id: 'total', label: 'Questions', def: 10,
      options: [{ v: 5, label: '5' }, { v: 10, label: '10' }, { v: 15, label: '15' }, { v: 20, label: '20' }, { v: 30, label: '30' }]
    },
    {
      id: 'limit', label: 'Time per question', def: 20000,
      options: [{ v: 10000, label: '10 s' }, { v: 20000, label: '20 s' }, { v: 30000, label: '30 s' }, { v: 0, label: 'Relaxed' }]
    },
    {
      id: 'speed', label: 'Speed bonus', def: 1,
      options: [{ v: 1, label: 'On' }, { v: 0, label: 'Off' }]
    }
  ],
  rules: [
    'Both players answer every question, taking turns to go first.',
    'The second player only sees the question when it is their turn.',
    'A right answer scores 10, plus up to 10 for speed.',
    'Three right in a row earns a 5-point streak bonus.',
    'Settings: number of questions, time per question (or relaxed), speed bonus.'
  ]
};

const pick = (v, allowed, def) => (allowed.includes(v) ? v : def);

function deal(state, cats) {
  const d = draw(BANK, cats, state.used);
  return { q: { c: d.c, i: d.i, o: shuffle([0, 1, 2, 3]) }, used: d.used };
}

function create(opts = {}) {
  const cats = validCats(BANK, opts.cats) ? opts.cats.slice() : ['geo', 'science', 'screen', 'nature', 'food'];
  const base = {
    gid: Math.random().toString(36).slice(2, 9), phase: 'answer', round: 0, turn: 0, ans: [-2, -2], ms: [0, 0], gain: [0, 0], scores: [0, 0], streak: [0, 0], used: [], cats, moves: 0,
    total: pick(opts.total, [5, 10, 15, 20, 30], TOTAL),
    limit: pick(opts.limit, [10000, 20000, 30000, 0], LIMIT),
    speed: pick(opts.speed, [0, 1], 1)
  };
  return { ...base, ...deal(base, base.cats) };
}

function turn(state) {
  if (state.phase === 'reveal') return 1 - state.turn;
  return state.ans[state.turn] === -2 ? state.turn : 1 - state.turn;
}

const untouched = (s) => s.phase === 'answer' && s.ans[0] === -2 && s.ans[1] === -2;
const item = (s) => BANK[s.q.c].items[s.q.i];

function apply(state, move) {
  if (!move || outcome(state).over) return null;

  if (move.cats !== undefined) {
    if (!untouched(state) || !validCats(BANK, move.cats)) return null;
    return { ...state, cats: move.cats.slice(), ...deal(state, move.cats), moves: state.moves + 1 };
  }

  if (move.a !== undefined) {
    const a = move.a;
    if (state.phase !== 'answer' || !Number.isInteger(a) || a < -1 || a > 3) return null;
    const seat = turn(state);
    const ms = Math.max(0, Math.min(clockOf(state), Number(move.ms) || 0));
    const right = a >= 0 && state.q.o[a] === 0;
    const ans = state.ans.slice();
    const times = state.ms.slice();
    const gain = state.gain.slice();
    const scores = state.scores.slice();
    const streak = state.streak.slice();
    ans[seat] = a;
    times[seat] = ms;
    streak[seat] = right ? streak[seat] + 1 : 0;
    const fast = state.speed === 0 ? 0 : Math.round(10 * (1 - ms / clockOf(state)));
    gain[seat] = right ? 10 + fast + (streak[seat] >= 3 ? 5 : 0) : 0;
    scores[seat] += gain[seat];
    const both = ans[0] !== -2 && ans[1] !== -2;
    return { ...state, ans, ms: times, gain, scores, streak, phase: both ? 'reveal' : 'answer', moves: state.moves + 1 };
  }

  if (move.next) {
    if (state.phase !== 'reveal') return null;
    const round = state.round + 1;
    const base = { ...state, round, turn: 1 - state.turn, phase: 'answer', ans: [-2, -2], ms: [0, 0], gain: [0, 0], moves: state.moves + 1 };
    return round < totalOf(state) ? { ...base, ...deal(state, state.cats) } : base;
  }

  return null;
}

function outcome(state) {
  if (state.round < totalOf(state)) return { over: false };
  const [a, b] = state.scores;
  if (a === b) return { over: true, winner: null, draw: true };
  return { over: true, winner: a > b ? 0 : 1, draw: false };
}

function auto(state) {
  if (state.phase === 'reveal' && state.round < totalOf(state)) return { move: { next: true }, delay: 3600 };
  return null;
}

/** The computer "reads" for a moment before answering. */
function pace(state) {
  return state.phase === 'answer' ? 1200 + Math.random() * 2400 : 0;
}

function ai(state, seat, level = 'even') {
  if (state.phase !== 'answer') return null;
  const right = state.q.o.indexOf(0);
  const p = ACCURACY[level] ?? 0.65;
  const wrong = [0, 1, 2, 3].filter((k) => k !== right);
  const a = Math.random() < p ? right : wrong[rand(3)];
  const ms = (level === 'sharp' ? 2500 : 4000) + Math.random() * (level === 'gentle' ? 9000 : 6000);
  return { a, ms: Math.round(ms) };
}

function note(state, seat) {
  const s = state.streak[seat];
  return `${state.scores[seat]} pts${s >= 2 ? ` · 🔥${s}` : ''}`;
}

/* ------------------------------ view ------------------------------ */
function view(state, ctx) {
  const over = outcome(state).over;
  const n = (s) => ctx.names[s] || `Player ${s + 1}`;

  if (over) {
    const w = outcome(state).winner;
    return `
      <div class="quiz quiz--over">
        <div class="quiz__final">
          <span class="quiz__final-ico" aria-hidden="true">${w == null ? '🤝' : '🏆'}</span>
          <div class="quiz__podium">
            ${[0, 1].map((s) => `<div class="quiz__pod quiz__pod--${s}${w === s ? ' is-win' : ''}" style="--h:${Math.max(18, Math.round((state.scores[s] / Math.max(1, ...state.scores)) * 100))}%"><b>${state.scores[s]}</b><span>${esc(n(s))}</span></div>`).join('')}
          </div>
        </div>
      </div>`;
  }

  const [question, opts] = item(state);
  const viewer = ctx.seat;
  const reveal = state.phase === 'reveal';
  const answered = state.ans[viewer] !== -2;
  const showQ = reveal || ctx.myTurn || answered;
  const right = state.q.o.indexOf(0);
  const cat = BANK[state.q.c];

  const optHtml = state.q.o
    .map((src, k) => {
      const cls = [];
      if (reveal && k === right) cls.push('is-right');
      if (reveal && k !== right && (state.ans[0] === k || state.ans[1] === k)) cls.push('is-wrong');
      if (!reveal && answered && state.ans[viewer] === k) cls.push('is-mine');
      const tags = reveal ? [0, 1].filter((s) => state.ans[s] === k).map((s) => `<span class="quiz__tag quiz__tag--${s}" title="${esc(n(s))}">${esc(n(s).slice(0, 1).toUpperCase())}</span>`).join('') : '';
      return `<button class="quiz__opt ${cls.join(' ')}" type="button" data-a="${k}" style="--k:${k}" ${ctx.myTurn && !reveal ? '' : 'disabled'}>
                <span class="quiz__key" aria-hidden="true">${'ABCD'[k]}</span><span class="quiz__label">${esc(opts[src])}</span>${tags}
              </button>`;
    })
    .join('');

  const gains = reveal
    ? `<div class="quiz__gains">${[0, 1]
        .map((s) => `<span class="quiz__gain quiz__gain--${s}${state.gain[s] ? '' : ' is-zero'}"><b>${state.gain[s] ? `+${state.gain[s]}` : state.ans[s] === -1 ? '⏱ 0' : '0'}</b> ${esc(n(s))}${state.gain[s] && state.streak[s] >= 3 ? ' 🔥' : ''}</span>`)
        .join('')}</div>`
    : '';

  let footer = '';
  if (reveal) footer = ctx.myTurn ? `<button class="btn btn--primary btn--sm" type="button" data-next>${state.round + 1 >= totalOf(state) ? 'Final score' : 'Next'} →</button>` : '';
  else if (!ctx.myTurn) footer = `<p class="quiz__wait">${answered ? `🔒 Locked in. ${esc(n(1 - viewer))} is answering…` : `🤫 ${esc(n(turn(state)))} is answering — your question is hidden.`}</p>`;

  return `
    <div class="quiz quiz--${state.phase}">
      ${catChips(BANK, state.cats, untouched(state) && ctx.myTurn)}
      ${beads(state.round, totalOf(state), state.round)}
      <div class="quiz__card" data-qkey="${state.gid}:${state.round}">
        <div class="quiz__meta"><span>${cat.emoji} ${esc(cat.label)}</span><span>Question ${state.round + 1} / ${totalOf(state)}</span></div>
        <h3 class="quiz__q${showQ ? '' : ' is-hidden'}">${showQ ? esc(question) : 'Hidden until it is your turn'}</h3>
        ${!reveal && ctx.myTurn && limitOf(state) ? `<div class="quiz__timer"><i data-timer></i><span data-secs>${limitOf(state) / 1000}</span></div>` : ''}
        <div class="quiz__opts${showQ ? '' : ' is-hidden'}">${optHtml}</div>
        ${gains}
      </div>
      ${footer}
    </div>`;
}

let ticker = null;
const starts = new Map();
const cheered = new Set();

function bind(root, state, ctx, play) {
  clearInterval(ticker);
  ticker = null;
  bindCats(root, state.cats, play);
  root.querySelector('[data-next]')?.addEventListener('click', () => play({ next: true }));

  if (state.phase === 'reveal') {
    const key = `${state.gid}:${state.round}`;
    if (!cheered.has(key) && state.gain[ctx.seat] > 0) {
      cheered.add(key);
      burst(root.querySelector('.quiz__card'), ['✨', '⭐', '🧠'], 10);
    }
  }

  if (state.phase !== 'answer' || !ctx.myTurn) return;

  const key = `${state.gid}:${state.round}:${ctx.seat}`;
  if (!starts.has(key)) starts.set(key, Date.now());
  const t0 = starts.get(key);
  const bar = root.querySelector('[data-timer]');
  const secs = root.querySelector('[data-secs]');
  let sent = false;

  const send = (a) => {
    if (sent) return;
    sent = true;
    clearInterval(ticker);
    ticker = null;
    play({ a, ms: Math.min(clockOf(state), Date.now() - t0) });
  };

  root.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', () => send(Number(b.dataset.a))));

  const limit = limitOf(state);
  if (!limit) return;
  const step = () => {
    if (!root.isConnected) { clearInterval(ticker); ticker = null; return; }
    const left = Math.max(0, limit - (Date.now() - t0));
    if (bar) bar.style.transform = `scaleX(${left / limit})`;
    if (secs) secs.textContent = String(Math.ceil(left / 1000));
    root.querySelector('.quiz__timer')?.classList.toggle('is-low', left < 5000);
    if (left <= 0) send(-1);
  };
  step();
  ticker = setInterval(step, 100);
}

function coach(state, ctx) {
  if (outcome(state).over) return 'Rematch with new categories — the deck never repeats until it runs out.';
  if (state.phase === 'reveal') return 'Next question in a moment…';
  return ctx.myTurn ? (state.speed === 0 ? 'Right answers score 10 — take your time.' : 'Right answers score 10, plus up to 10 for speed.') : 'Hold tight — no peeking.';
}
return Object.freeze({ meta, create, turn, apply, outcome, auto, pace, ai, note, view, bind, coach });
  })();

  /* ===== js/arcade/games/goose.js ===== */
  const __m32 = (function () {
const { esc, rand } = __m27;
/**
 * LifeFlow Arcade — Game of the Goose (Jeu de l'oie).
 * Two dice, 63 squares, and a board full of geese, bridges, inns and wells.
 * Land exactly on 63 to win. Pure luck — perfect for a laugh together.
 */


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

const meta = {
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

function create(opts = {}) {
  return {
    gid: Math.random().toString(36).slice(2, 9), pos: [0, 0], skip: [0, 0], turn: 0, dice: [0, 0], last: null, log: [], moves: 0,
    hazards: opts.hazards === 'gentle' ? 'gentle' : 'classic',
    finish: opts.finish === 'relaxed' ? 'relaxed' : 'exact',
    bump: opts.bump === 0 ? 0 : 1
  };
}

function turn(state) {
  return state.turn;
}

function apply(state, move) {
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

function outcome(state) {
  if (state.pos[0] === END) return { over: true, winner: 0, draw: false };
  if (state.pos[1] === END) return { over: true, winner: 1, draw: false };
  return { over: false };
}

function auto() {
  return null;
}

/** Let the last pawn finish hopping before the computer rolls. */
function pace(state) {
  return state.last ? state.last.path.length * STEP + 700 : 0;
}

function ai() {
  return { roll: true };
}

function note(state, seat) {
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

function view(state, ctx) {
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

function bind(root, state, ctx, play) {
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

function coach(state, ctx) {
  if (outcome(state).over) return 'What a race. Again?';
  const me = ctx.seat;
  if (ctx.myTurn) {
    const left = END - state.pos[me];
    if (left <= 12 && left > 0) return state.finish === 'relaxed' ? `${left} to go — any roll that reaches 63 wins.` : `You need exactly ${left} to reach the garden.`;
    return 'Tap the dice to roll.';
  }
  return state.skip[me] ? `You are resting for ${state.skip[me]} more turn${state.skip[me] > 1 ? 's' : ''}.` : 'Watch the other pawn go…';
}
return Object.freeze({ meta, create, turn, apply, outcome, auto, pace, ai, note, view, bind, coach });
  })();

  /* ===== js/arcade/games/eights.js ===== */
  const __m33 = (function () {
const { esc, rand, shuffle } = __m27;
/**
 * LifeFlow Arcade — Crazy Eights (Huit américain).
 * Match the suit or rank of the top card. Eights are wild, twos make your rival draw,
 * jacks skip their turn. First to empty their hand wins.
 * Cards are numbers 0–51: rank = n % 13 (0 = A … 7 = 8 … 10 = J), suit = floor(n / 13).
 */


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

const meta = {
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

function create(opts = {}) {
  const size = [5, 7, 9].includes(opts.hand) ? opts.hand : 7;
  const powers = opts.powers === 'plain' ? 'plain' : 'full';
  const deck = shuffle(Array.from({ length: 52 }, (_, i) => i));
  const h0 = deck.splice(0, size);
  const h1 = deck.splice(0, size);
  const k = deck.findIndex((c) => ![R8, R2, RJ].includes(rank(c)));
  const start = deck.splice(k, 1)[0];
  return { gid: Math.random().toString(36).slice(2, 9), h0, h1, deck, pile: [start], suit: suitOf(start), pending: 0, drew: false, turn: 0, last: null, moves: 0, powers };
}

function turn(state) {
  return state.turn;
}

function playable(state, c) {
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

function apply(state, move) {
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

function outcome(state) {
  if (!state.h0.length) return { over: true, winner: 0, draw: false };
  if (!state.h1.length) return { over: true, winner: 1, draw: false };
  if (state.moves > 600) {
    const a = state.h0.length;
    const b = state.h1.length;
    return a === b ? { over: true, winner: null, draw: true } : { over: true, winner: a < b ? 0 : 1, draw: false };
  }
  return { over: false };
}

function auto() {
  return null;
}

function pace() {
  return 250;
}

function bestSuit(cards) {
  const count = [0, 0, 0, 0];
  cards.forEach((c) => { if (rank(c) !== R8) count[suitOf(c)] += 1; });
  let best = 0;
  for (let s = 1; s < 4; s++) if (count[s] > count[best]) best = s;
  return count[best] ? best : rand(4);
}

function ai(state, seat, level = 'even') {
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

function note(state, seat) {
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

function view(state, ctx) {
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

function bind(root, state, ctx, play) {
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

function coach(state, ctx) {
  if (outcome(state).over) return 'Shuffle up and deal again?';
  if (!ctx.myTurn) return 'Your rival is choosing a card…';
  if (state.pending) return hand(state, ctx.seat).some((c) => rank(c) === R2) ? 'Stack a 2 to pass the penalty back — or take the cards.' : `No 2 in hand — draw ${state.pending}.`;
  if (state.drew) return 'Your new card fits — play it, or keep it and pass.';
  const any = hand(state, ctx.seat).some((c) => playable(state, c));
  return any ? `Follow ${SUIT_NAMES[state.suit].toLowerCase()} or match the ${RANKS[rank(top(state))]}. Eights are wild.` : 'Nothing fits — draw from the deck.';
}
return Object.freeze({ meta, create, turn, playable, apply, outcome, auto, pace, ai, note, view, bind, coach });
  })();

  /* ===== js/arcade/index.js ===== */
  const __m19 = (function () {
const tictactoe = __m20;
const memory = __m21;
const dame = __m22;
const connect4 = __m23;
const reversi = __m24;
const dots = __m25;
const truthdare = __m26;
const insync = __m28;
const knowme = __m30;
const quiz = __m31;
const goose = __m32;
const eights = __m33;
/**
 * LifeFlow Arcade — the game registry.
 *
 * Every game speaks the same small language:
 *   create()                → a JSON-safe state
 *   turn(state)             → whose seat it is (0 | 1)
 *   apply(state, move)      → the next state, or null when the move is illegal
 *   outcome(state)          → { over, winner, draw }
 *   auto(state)             → a move the game makes for you, e.g. flipping cards back
 *   ai(state, seat, level)  → the computer's move
 *   view(state, ctx)        → HTML for the board
 *   bind(root, state, ctx, play)
 *
 * Optional: note(state, seat), coach(state, ctx), summary(state, ctx) for a custom
 * end line, pace(state) for extra computer thinking time. meta.local marks social
 * games played by passing one device around (no computer), meta.group sorts the lobby.
 */













const GAMES = [truthdare, insync, knowme, quiz, eights, goose, tictactoe, connect4, reversi, dots, memory, dame];

function gameById(id) {
  return GAMES.find((g) => g.meta.id === id) || null;
}

const GAME_IDS = GAMES.map((g) => g.meta.id);
return Object.freeze({ GAMES, gameById, GAME_IDS });
  })();

  /* ===== js/views/dashboard.js ===== */
  const __m17 = (function () {
const { esc, greeting, firstName, fmtMoney, today, relativeDay, fmtTime, seededPick, countUp, ymd, haptic } = __m1;
const { icon } = __m3;
const { ring, animateProgress, toast, confetti, sparkline } = __m2;
const store = __m8;
const { MOODS, QUOTES, PRIORITIES } = __m4;
const { navigate } = __m6;
const { openTaskForm, openPurchaseForm } = __m14;
const { mountFocus } = __m18;
const { mountBreathe, openBreathe } = __m13;
const { prayerSchedule, nextPrayer, countdownLabel } = __m9;
const { GAMES } = __m19;
/**
 * LifeFlow — Dashboard: the personal life cockpit.
 */












const meta = { title: 'Dashboard', icon: 'home', label: 'Home' };

function render(root) {
  const s = store.state;
  const p = store.prefs();
  const w = p.widgets || {};
  const name = firstName(s.profile?.name || s.user?.displayName || '', s.user?.email || '');
  const balance = store.select.balance();
  const todayTasks = store.select.todayTasks();
  const overdue = store.select.overdueTasks();
  const fin = store.select.savingsTotals();
  const cash = store.select.cashflow();
  const upcoming = store.select.upcomingEvents(7);
  const quote = seededPick(QUOTES, today());
  const habitsDone = store.select.habitsDoneToday();
  const streak = store.select.bestStreak();
  const activity = store.select.weeklyActivity();
  const currency = store.currency();

  root.innerHTML = `
    <div class="page">

      <!-- Greeting hero -->
      <section class="hero-card anim-in">
        <div class="hero-card__grid">
          <div class="grow">
            <span class="eyebrow">${esc(new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }))}</span>
            <h1>${esc(greeting())},<br /><span class="t-grad">${esc(name)}</span> 👋</h1>
            <p class="mt-2">${esc(summaryLine(todayTasks.length, overdue.length, upcoming.length))}</p>
          </div>
          <div class="hero-card__ring">
            ${ring(balance.overall, { size: 112, stroke: 11, label: `${balance.overall}%`, caption: 'Balance' })}
          </div>
        </div>
        ${w.quote !== false ? `
        <div class="hero-card__quote">
          ${icon('quote')}
          <span>“${esc(quote.t)}” <b class="t-dim">— ${esc(quote.a)}</b></span>
        </div>` : ''}
      </section>

      <!-- Check in first, plan second -->
      ${w.mood !== false ? moodCard() : ''}

      <!-- Stats -->
      <section class="stat-rail stagger">
        ${statTile('tasks', todayTasks.length, 'Due today', 'tasks')}
        ${statTile('flame', streak, 'Best streak', 'habits')}
        ${statTile('checkCircle', `${habitsDone}/${s.habits.length}`, 'Habits today', 'habits', true)}
        ${statTile('wallet', fmtMoney(fin.saved, currency, true), 'Saved', 'finance', true)}
      </section>

      <div class="g-main">
        <div class="grid" style="gap:var(--s-4)">

          ${p.prayer?.enabled && w.prayer !== false ? salatCard(p.prayer) : ''}

          <!-- Today's priorities -->
          <section class="card">
            <div class="card__head">
              <h3 class="card__title">${icon('sparkles')} Today, gently
              </h3>
              <button class="btn btn--xs btn--soft" data-add-task type="button">${icon('plus')} Add</button>
            </div>
            ${
              todayTasks.length
                ? `${oneThing(todayTasks)}
                   <div class="task-list" data-today-list>
                    ${todayTasks.slice(0, 5).map(priorityRow).join('')}
                   </div>
                   ${todayTasks.length > 5 ? `<button class="btn btn--sm btn--ghost btn--block mt-4" data-go="/tasks">See the rest (${todayTasks.length}) ${icon('arrowRight')}</button>` : ''}`
                : emptyBlock('checkCircle', 'You’re all clear', 'Nothing is due today. Rest counts as progress too.', 'Add a task', 'add-task')
            }
            ${overdue.length ? `<button class="btn btn--sm btn--gentle btn--block mt-4" data-go="/tasks?filter=overdue">${icon('clock')} ${overdue.length} item${overdue.length > 1 ? 's' : ''} waiting from before</button>` : ''}
          </section>

          <!-- Breathe -->
          ${w.breathe !== false ? `
          <section class="card">
            <div class="card__head">
              <h3 class="card__title">${icon('leaf')} Take a breath</h3>
              <span class="chip">60 seconds</span>
            </div>
            <div data-breathe-mount></div>
          </section>` : ''}

          <!-- Upcoming -->
          <section class="card">
            <div class="card__head">
              <h3 class="card__title">${icon('calendar')} Coming up</h3>
              <button class="btn btn--xs btn--ghost" data-go="/calendar">Calendar ${icon('arrowRight')}</button>
            </div>
            ${
              upcoming.length
                ? `<div class="timeline">${upcoming.slice(0, 4).map(eventRow).join('')}</div>`
                : emptyBlock('calendar', 'Clear skies ahead', 'Nothing scheduled this week. Enjoy the space.', 'Plan something', 'go-calendar')
            }
          </section>

          <!-- Weekly momentum -->
          <section class="card">
            <div class="card__head">
              <h3 class="card__title">${icon('chart')} This week’s rhythm</h3>
              <button class="btn btn--xs btn--ghost" data-go="/archive">${icon('archive')} Archive</button>
            </div>
            <div class="chart-bars">
              ${activity
                .map((d) => {
                  const max = Math.max(...activity.map((x) => x.count), 1);
                  const h = Math.round((d.count / max) * 100);
                  const isToday = d.key === today();
                  return `<div><i data-h="${h}" class="${d.count ? '' : 'is-muted'}" title="${d.count} tasks"></i><span${
                    isToday ? ' style="color:var(--accent)"' : ''
                  }>${esc(d.label)}</span></div>`;
                })
                .join('')}
            </div>
          </section>
        </div>

        <div class="grid" style="gap:var(--s-4)">
          ${w.gratitude !== false ? gratitudeCard() : ''}

          ${w.focus !== false ? `
          <section class="card">
            <div class="card__head">
              <h3 class="card__title">${icon('clock')} Focus session</h3>
              <span class="chip">Pomodoro</span>
            </div>
            <div data-focus-mount></div>
          </section>` : ''}

          ${w.balance !== false ? balanceCard(balance) : ''}
          ${w.finance !== false ? financeCard(fin, cash, currency) : ''}
          ${w.purchases !== false ? purchasesCard(currency) : ''}
          ${w.habits !== false ? habitsCard(s.habits) : ''}
          ${w.games !== false ? gamesCard() : ''}
          ${w.badges !== false ? badgesCard() : ''}
        </div>
      </div>
    </div>`;

  /* ---------------- interactions ---------------- */
  root.querySelectorAll('[data-go]').forEach((b) =>
    b.addEventListener('click', () => navigate(b.dataset.go))
  );
  root.querySelectorAll('[data-add-task], [data-empty-action="add-task"]').forEach((b) =>
    b.addEventListener('click', () => openTaskForm(null, { due: today() }))
  );
  root.querySelector('[data-empty-action="go-calendar"]')?.addEventListener('click', () => navigate('/calendar'));
  root.querySelector('[data-empty-action="go-habits"]')?.addEventListener('click', () => navigate('/habits'));

  root.querySelectorAll('[data-toggle-task]').forEach((b) =>
    b.addEventListener('click', async () => {
      const task = store.state.tasks.find((t) => t.id === b.dataset.toggleTask);
      if (!task) return;
      const done = await store.toggleTask(task);
      if (done) {
        b.closest('.task')?.classList.add('is-done');
        const unlocked = await store.evaluateBadges();
        if (unlocked.length) { confetti(); toast(`Badge unlocked: ${unlocked.length} new 🏅`); }
      }
    })
  );

  root.querySelectorAll('[data-add-purchase], [data-empty-action="add-purchase"]').forEach((b) =>
    b.addEventListener('click', () => openPurchaseForm())
  );

  root.querySelectorAll('[data-buy]').forEach((b) =>
    b.addEventListener('click', async () => {
      const item = store.state.purchases.find((p) => p.id === b.dataset.buy);
      if (!item) return;
      try {
        const bought = await store.togglePurchase(item);
        if (bought) {
          haptic(12);
          confetti(14);
          toast(`Bought — ${fmtMoney(Number(item.price) || 0, store.currency())} logged as an expense 🛍️`);
        }
      } catch (err) {
        console.error(err);
        toast('Could not update that item.', 'error');
      }
    })
  );

  root.querySelectorAll('[data-mood]').forEach((b) =>
    b.addEventListener('click', async () => {
      await store.setMood(b.dataset.mood);
      toast('Checked in. However today feels, it’s allowed 💜', 'success');
    })
  );

  const gratitudeInput = root.querySelector('[data-gratitude-input]');
  const saveGratitude = async () => {
    const value = gratitudeInput?.value.trim();
    if (!value) return;
    gratitudeInput.value = '';
    await store.create('notes', {
      title: 'Grateful for…',
      body: value,
      kind: 'journal',
      tag: 'gratitude',
      date: today(),
      color: 'mint'
    });
    toast('Saved. Noticing the good rewires the day ✨');
  };
  root.querySelector('[data-gratitude-save]')?.addEventListener('click', saveGratitude);
  gratitudeInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); saveGratitude(); }
  });

  root.querySelectorAll('[data-habit-check]').forEach((b) =>
    b.addEventListener('click', async () => {
      const habit = store.state.habits.find((h) => h.id === b.dataset.habitCheck);
      if (!habit) return;
      const on = await store.toggleHabitDay(habit);
      if (on) { confetti(16); store.evaluateBadges(); }
    })
  );

  root.querySelectorAll('[data-dash-pray]').forEach((b) =>
    b.addEventListener('click', async () => {
      const on = await store.togglePrayer(b.dataset.dashPray);
      haptic(14);
      if (on && store.prayersOn(today()).length === 5) { confetti(22); toast('All five today — تقبل الله 🤍'); }
    })
  );
  startSalatTicker(root);

  const focusMount = root.querySelector('[data-focus-mount]');
  if (focusMount) mountFocus(focusMount);

  const breatheMount = root.querySelector('[data-breathe-mount]');
  if (breatheMount) mountBreathe(breatheMount, { patternId: 'reset' });

  root.querySelector('[data-open-breathe]')?.addEventListener('click', () => openBreathe('478'));

  root.querySelectorAll('[data-count]').forEach((n) => {
    const v = Number(n.dataset.count);
    if (!Number.isNaN(v)) countUp(n, v);
  });

  animateProgress(root);
}

/* ------------------------------ partials ------------------------------ */

/** The five prayers, with the next one counting down live. */
function salatCard(prefs) {
  const schedule = prayerSchedule(new Date(), prefs);
  const done = store.prayersOn(today());
  const up = nextPrayer(new Date(), prefs);

  return `
    <section class="card salat-card">
      <div class="card__head">
        <h3 class="card__title">${icon('mosque')} Salat</h3>
        <button class="btn btn--xs btn--ghost" data-go="/prayer">${esc(done.length)}/5 ${icon('arrowRight')}</button>
      </div>

      <div class="salat-next">
        <span class="salat-next__emoji">${esc(up.next.emoji)}</span>
        <div class="grow" style="min-width:0">
          <div class="salat-next__label">${esc(up.tomorrow ? 'Tomorrow' : 'Next')} · ${esc(up.next.label)}</div>
          <div class="salat-next__time">${esc(up.next.hhmm || '—')}</div>
        </div>
        <span class="salat-next__count" data-dash-countdown>${esc(countdownLabel(up.in))}</span>
      </div>

      <div class="salat-pills">
        ${schedule
          .map(
            (s) => `
          <button class="salat-pill${done.includes(s.id) ? ' is-done' : ''}${s.id === up.next.id && !up.tomorrow ? ' is-next' : ''}"
                  data-dash-pray="${esc(s.id)}" type="button" aria-pressed="${done.includes(s.id)}"
                  aria-label="${done.includes(s.id) ? 'Undo' : 'Mark'} ${esc(s.label)}">
            <b>${esc(s.label)}</b>
            <span>${esc(s.hhmm || '—')}</span>
          </button>`
          )
          .join('')}
      </div>
    </section>`;
}

let salatTicker = null;
function startSalatTicker(root) {
  clearInterval(salatTicker);
  const host = root.querySelector('[data-dash-countdown]');
  if (!host) return;
  const painted = nextPrayer(new Date(), store.prefs().prayer).next.id;
  salatTicker = setInterval(() => {
    if (!host.isConnected) { clearInterval(salatTicker); salatTicker = null; return; }
    const up = nextPrayer(new Date(), store.prefs().prayer);
    if (up.next.id !== painted) { clearInterval(salatTicker); salatTicker = null; render(root); return; }
    host.textContent = countdownLabel(up.in);
  }, 1000);
}
function summaryLine(due, overdue, events) {
  if (due > 6) return `${due} things are on today’s list — pick one to start, the rest can wait.`;
  if (due) return `Just ${due} priorit${due > 1 ? 'ies' : 'y'} today${events ? `, plus ${events} thing${events > 1 ? 's' : ''} coming up` : ''}. You’ve got this.`;
  if (overdue) return `A few things are still waiting — no rush, pick one when you’re ready.`;
  if (events) return `Nothing due today — ${events} event${events > 1 ? 's' : ''} on the horizon. Enjoy the space.`;
  return 'A quiet, open day. What would make it feel good?';
}

/** The single next action — removes the paralysis of a long list. */
function oneThing(tasks) {
  const order = { high: 0, med: 1, low: 2 };
  const pick = [...tasks].sort((a, b) => (order[a.priority] ?? 1) - (order[b.priority] ?? 1))[0];
  if (!pick) return '';
  return `
    <div class="one-thing">
      <span class="one-thing__label">If only one thing</span>
      <span class="one-thing__task grow truncate">${esc(pick.title)}</span>
    </div>`;
}

function statTile(ic, value, label, go, raw = false) {
  return `
    <button class="stat" data-go="/${go}" type="button" style="text-align:left">
      <span class="stat__icon">${icon(ic)}</span>
      <span class="stat__val"${raw ? '' : ` data-count="${esc(value)}"`}>${esc(value)}</span>
      <span class="stat__lbl">${esc(label)}</span>
    </button>`;
}

function priorityRow(t) {
  const pri = PRIORITIES.find((p) => p.id === t.priority) || PRIORITIES[1];
  return `
    <div class="task${t.done ? ' is-done' : ''}" data-id="${esc(t.id)}">
      <span class="task__pri ${pri.cls}"></span>
      <button class="check__box" data-toggle-task="${esc(t.id)}" type="button" aria-label="Complete ${esc(t.title)}" style="margin-top:2px">${icon('check')}</button>
      <div class="task__body">
        <span class="task__title">${esc(t.title)}</span>
        <span class="task__meta">
          ${t.due ? `<span class="chip${t.due < today() ? ' chip--danger' : ''}">${icon('clock')}${esc(relativeDay(t.due))}</span>` : ''}
          ${t.time ? `<span class="chip">${esc(fmtTime(t.time))}</span>` : ''}
          <span class="chip ${pri.chip}">${esc(pri.label)}</span>
        </span>
      </div>
    </div>`;
}

function eventRow(e) {
  return `
    <div class="event event--${esc(e.type || 'event')}">
      <span class="event__time">${e.time ? esc(fmtTime(e.time)) : 'All day'}</span>
      <div class="grow">
        <div class="row__title">${esc(e.title)}</div>
        <div class="row__sub">${esc(relativeDay(e.date))}${e.location ? ` · ${esc(e.location)}` : ''}</div>
      </div>
    </div>`;
}

/** A nudge towards a short break — the arcade lives on its own page. */
function gamesCard() {
  return `
    <section class="card games-card">
      <div class="card__head">
        <h3 class="card__title">${icon('gamepad')} Take a break</h3>
        <button class="btn btn--xs btn--ghost" data-go="/games">Open ${icon('arrowRight')}</button>
      </div>
      <p class="fs-sm t-dim games-card__sub">Party games, quizzes, cards and boards — alone, side by side, or online.</p>
      <div class="games-card__tiles">
        ${GAMES.map(
          (g, i) => `
          <button class="gtile" type="button" data-go="/games?play=${esc(g.meta.id)}" style="--i:${i}">
            <span class="gtile__emoji">${g.meta.emoji}</span>
            <span class="gtile__name">${esc(g.meta.title)}</span>
            <span class="gtile__time">${esc(g.meta.minutes)}</span>
          </button>`
        ).join('')}
      </div>
    </section>`;
}

/** The wish list, with a one-tap "bought" that logs the expense for you. */
function purchasesCard(currency) {
  const planned = store.select.plannedPurchases();
  const plannedSpend = store.select.plannedSpend();
  const left = store.select.projectedNet();

  return `
    <section class="card">
      <div class="card__head">
        <h3 class="card__title">${icon('cart')} Purchases</h3>
        <button class="btn btn--xs btn--ghost" data-go="/purchases">Open ${icon('arrowRight')}</button>
      </div>
      ${
        planned.length
          ? `<div class="task-list">
              ${planned
                .slice(0, 4)
                .map(
                  (p) => `
                <div class="task purchase">
                  <button class="check__box" data-buy="${esc(p.id)}" type="button" aria-label="Mark ${esc(p.title)} as bought">${icon('check')}</button>
                  <div class="task__body"><span class="task__title">${esc(p.title)}</span></div>
                  <span class="purchase__price">${esc(fmtMoney(Number(p.price) || 0, currency))}</span>
                </div>`
                )
                .join('')}
             </div>
             ${planned.length > 4 ? `<button class="btn btn--sm btn--ghost btn--block mt-4" data-go="/purchases">See the rest (${planned.length}) ${icon('arrowRight')}</button>` : ''}
             <div class="purchase__summary mt-4">
               <span>${planned.length} item${planned.length > 1 ? 's' : ''} · ${esc(fmtMoney(plannedSpend, currency))}</span>
               <span class="${left >= 0 ? 'pos' : 'neg'}">${esc(fmtMoney(left, currency))} left after</span>
             </div>`
          : emptyBlock('cart', 'Nothing on the list', 'Plan a purchase and watch what it does to your month.', 'Add an item', 'add-purchase')
      }
    </section>`;
}

function balanceCard(balance) {  return `
    <section class="card">
      <div class="card__head">
        <h3 class="card__title">${icon('compass')} Life balance</h3>
        <span class="chip chip--accent">${balance.overall}%</span>
      </div>
      <div class="balance">
        ${balance.pillars
          .map(
            (p) => `
          <div class="balance__row">
            <div class="balance__top"><span>${esc(p.label)}</span><span>${p.value}%</span></div>
            <div class="bar"><div class="bar__fill" data-val="${p.value}"></div></div>
          </div>`
          )
          .join('')}
      </div>
    </section>`;
}

/** A short, kind response to whatever the user just felt. */
const MOOD_REPLIES = {
  rough: {
    emoji: '🫂',
    text: 'Rough days are part of a full life — not a failure.',
    tip: 'Try one slow round of breathing, then call today enough.',
    action: 'breathe'
  },
  meh: {
    emoji: '🌥️',
    text: 'Flat days happen. You don’t have to force brightness.',
    tip: 'One tiny task or a short walk usually shifts it.',
    action: 'breathe'
  },
  okay: {
    emoji: '🌿',
    text: 'Okay is a perfectly good place to be.',
    tip: 'Protect it — pick one thing and let the rest wait.',
    action: null
  },
  good: {
    emoji: '☀️',
    text: 'Lovely. Good days are worth noticing out loud.',
    tip: 'Write down one thing behind it so you can repeat it.',
    action: 'gratitude'
  },
  great: {
    emoji: '✨',
    text: 'What a day. Let yourself feel it fully.',
    tip: 'Capture what made it great — future you will want this.',
    action: 'gratitude'
  }
};

function moodCard() {
  const current = store.moodFor();
  const reply = current ? MOOD_REPLIES[current] : null;
  const recent = [...Array(7)]
    .map((_, i) => store.moodFor(ymd(new Date(Date.now() - (6 - i) * 86400000))))
    .map((m) => MOODS.find((x) => x.id === m)?.score || 0);
  return `
    <section class="card">
      <div class="card__head">
        <h3 class="card__title">${icon('heart')} How are you, really?</h3>
        ${current ? `<span class="chip chip--accent">Checked in</span>` : ''}
      </div>
      <div class="moods">
        ${MOODS.map(
          (m) => `
          <button class="mood${current === m.id ? ' is-on' : ''}" data-mood="${m.id}" type="button" aria-pressed="${current === m.id}">
            <span>${m.emoji}</span><span>${esc(m.label)}</span>
          </button>`
        ).join('')}
      </div>
      ${
        reply
          ? `<div class="mood-reply">
              <span class="mood-reply__emoji">${reply.emoji}</span>
              <div class="grow">
                <p>${esc(reply.text)}</p>
                <small>${esc(reply.tip)}</small>
                ${reply.action === 'breathe' ? `<button class="btn btn--xs btn--soft mt-3" data-open-breathe type="button">${icon('leaf')} Breathe with me</button>` : ''}
              </div>
             </div>`
          : `<p class="fs-sm t-mute mt-3 center">No wrong answer — this is just for you.</p>`
      }
      ${recent.some(Boolean) ? `<div class="mt-4">${sparkline(recent, { height: 56 })}</div>` : ''}
    </section>`;
}

/** Three good things — the most evidence-backed wellbeing habit there is. */
function gratitudeCard() {
  const list = store.state.notes
    .filter((n) => n.tag === 'gratitude' && n.date === today())
    .slice(0, 3);
  return `
    <section class="card">
      <div class="card__head">
        <h3 class="card__title">${icon('smile')} Three good things</h3>
        <span class="chip${list.length >= 3 ? ' chip--accent' : ''}">${list.length}/3</span>
      </div>
      <p class="fs-sm t-mute mb-3">Small counts. The coffee, the message, the thing you finished.</p>
      <div class="gratitude__field">
        <input class="input grow" data-gratitude-input maxlength="140"
               placeholder="${list.length ? 'And one more…' : 'Today I’m grateful for…'}" aria-label="Something you're grateful for" />
        <button class="btn btn--soft btn--icon" data-gratitude-save type="button" aria-label="Save">${icon('plus')}</button>
      </div>
      ${
        list.length
          ? `<div class="gratitude__list">
              ${list.map((n) => `<div class="gratitude__item"><span>🌸</span><span class="grow">${esc(n.body)}</span></div>`).join('')}
             </div>`
          : ''
      }
    </section>`;
}

function financeCard(fin, cash, currency) {
  return `
    <section class="card">
      <div class="card__head">
        <h3 class="card__title">${icon('wallet')} Money snapshot</h3>
        <button class="btn btn--xs btn--ghost" data-go="/finance">Open ${icon('arrowRight')}</button>
      </div>
      <div class="flex-between money-strip mb-4">
        <div>
          <div class="fs-xs t-mute fw-7">THIS MONTH</div>
          <div class="num ${cash.net >= 0 ? 'pos' : 'neg'}" style="font-size:1.4rem">${esc(fmtMoney(cash.net, currency, true))}</div>
        </div>
        <div class="center">
          <div class="fs-xs t-mute fw-7">IN</div>
          <div class="fw-8 pos">${esc(fmtMoney(cash.income, currency, true))}</div>
        </div>
        <div class="center">
          <div class="fs-xs t-mute fw-7">OUT</div>
          <div class="fw-8 neg">${esc(fmtMoney(cash.expense, currency, true))}</div>
        </div>
      </div>
      ${
        fin.target
          ? `<div class="balance__row">
              <div class="balance__top"><span>Savings goals</span><span>${esc(fmtMoney(fin.saved, currency, true))} / ${esc(fmtMoney(fin.target, currency, true))}</span></div>
              <div class="bar"><div class="bar__fill" data-val="${fin.percent}"></div></div>
             </div>`
          : `<p class="fs-sm t-mute">Set a savings goal to see your progress here.</p>`
      }
    </section>`;
}

function habitsCard(habits) {
  if (!habits.length) {
    return `
      <section class="card">
        <div class="card__head"><h3 class="card__title">${icon('flame')} Habits</h3></div>
        ${emptyBlock('flame', 'Start a streak', 'Small daily wins compound fast.', 'Create habit', 'go-habits')}
      </section>`;
  }
  return `
    <section class="card">
      <div class="card__head">
        <h3 class="card__title">${icon('flame')} Today’s habits</h3>
        <button class="btn btn--xs btn--ghost" data-go="/habits">All ${icon('arrowRight')}</button>
      </div>
      <div class="grid" style="gap:var(--s-2)">
        ${habits
          .slice(0, 4)
          .map((h) => {
            const done = store.habitDoneToday(h);
            const st = store.streakOf(h.log || []);
            return `
            <div class="row" style="padding:8px">
              <span class="habit__emoji" style="width:38px;height:38px;font-size:1.05rem">${esc(h.emoji || '🔥')}</span>
              <div class="row__main">
                <div class="row__title">${esc(h.title)}</div>
                <div class="row__sub">${st ? `<span class="habit__streak">${icon('flame')} ${st} day${st > 1 ? 's' : ''}</span>` : 'Start today'}</div>
              </div>
              <button class="habit__check" style="width:36px;height:36px" data-habit-check="${esc(h.id)}" type="button"
                      aria-pressed="${done}" aria-label="Mark ${esc(h.title)} done">${icon('check')}</button>
            </div>`;
          })
          .join('')}
      </div>
    </section>`;
}

function badgesCard() {
  const badges = store.select.earnedBadges();
  const earned = badges.filter((b) => b.earned);
  const show = earned.length ? [...earned, ...badges.filter((b) => !b.earned)].slice(0, 8) : badges.slice(0, 8);
  return `
    <section class="card">
      <div class="card__head">
        <h3 class="card__title">${icon('star')} Achievements</h3>
        <span class="chip chip--accent">${earned.length}/${badges.length}</span>
      </div>
      <div class="badges">
        ${show
          .map(
            (b) => `
          <div class="badge-item${b.earned ? '' : ' is-locked'}" title="${esc(b.hint)}">
            <span>${b.emoji}</span><span>${esc(b.label)}</span>
          </div>`
          )
          .join('')}
      </div>
    </section>`;
}

function emptyBlock(ic, title, text, actionLabel, actionKey) {
  return `
    <div class="empty">
      <div class="empty__icon">${icon(ic)}</div>
      <h3>${esc(title)}</h3>
      <p>${esc(text)}</p>
      ${actionLabel ? `<button class="btn btn--sm btn--soft" data-empty-action="${esc(actionKey)}" type="button">${icon('plus')} ${esc(actionLabel)}</button>` : ''}
    </div>`;
}
return Object.freeze({ meta, render });
  })();

  /* ===== js/views/tasks.js ===== */
  const __m34 = (function () {
const { esc, today, relativeDay, fmtTime, pct, debounce } = __m1;
const { icon } = __m3;
const { animateProgress, initSortable, initSwipe, toast, confetti, confirmDialog } = __m2;
const store = __m8;
const { TASK_CATEGORIES, PRIORITIES } = __m4;
const { openTaskForm } = __m14;
const { currentQuery } = __m6;
/**
 * LifeFlow — Tasks: categories, priorities, search, drag-to-reorder, swipe actions.
 */








const meta = { title: 'Tasks', icon: 'tasks', label: 'Tasks' };

const ui = { filter: 'today', category: 'all', search: '', sort: 'manual' };

const FILTERS = [
  { id: 'today', label: 'Today' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'all', label: 'All' },
  { id: 'done', label: 'Completed' }
];

function render(root) {
  const q = currentQuery();
  if (q.filter && FILTERS.some((f) => f.id === q.filter)) ui.filter = q.filter;

  const all = store.select.tasksSorted();
  const list = applyFilters(all);
  const openCount = store.select.openTasks().length;
  const doneToday = all.filter((t) => t.done && t.doneAt && new Date(t.doneAt).toDateString() === new Date().toDateString()).length;
  const dayTasks = all.filter((t) => t.due === today());
  const dayProgress = dayTasks.length ? pct(dayTasks.filter((t) => t.done).length, dayTasks.length) : 0;

  root.innerHTML = `
    <div class="page">
      <section class="card card--accent">
        <div class="flex-between">
          <div>
            <span class="eyebrow">Task flow</span>
            <h2>${openCount ? `${openCount} open task${openCount > 1 ? 's' : ''}` : 'Inbox zero 🎉'}</h2>
            <p class="fs-sm t-dim">${doneToday} completed today${dayTasks.length ? ` · ${dayProgress}% of today’s plan` : ''}</p>
          </div>
          <button class="btn btn--primary btn--sm" data-new type="button">${icon('plus')} New</button>
        </div>
        ${dayTasks.length ? `<div class="bar mt-4"><div class="bar__fill" data-val="${dayProgress}"></div></div>` : ''}
      </section>

      <section class="grid" style="gap:var(--s-3)">
        <div class="field field--icon">
          ${icon('search', 'field__icon')}
          <input class="input" type="search" placeholder="Search tasks…" value="${esc(ui.search)}" data-search aria-label="Search tasks" />
        </div>
        <div class="chips-row" data-filters>
          ${FILTERS.map(
            (f) => `<button type="button" data-filter="${f.id}" aria-pressed="${ui.filter === f.id}">${esc(f.label)}${
              f.id === 'overdue' && store.select.overdueTasks().length ? ` · ${store.select.overdueTasks().length}` : ''
            }</button>`
          ).join('')}
        </div>
        <div class="chips-row" data-cats>
          <button type="button" data-cat="all" aria-pressed="${ui.category === 'all'}">All</button>
          ${TASK_CATEGORIES.map(
            (c) => `<button type="button" data-cat="${c.id}" aria-pressed="${ui.category === c.id}">${c.emoji} ${esc(c.label)}</button>`
          ).join('')}
        </div>
      </section>

      <section data-list>
        ${list.length ? groupedList(list) : emptyState()}
      </section>
    </div>`;

  bind(root);
  animateProgress(root);
}

/* ------------------------------ filtering ------------------------------ */
/** Ticked off earlier today — still worth seeing, and easy to undo. */
function doneToday(task) {
  return Boolean(task.done && task.doneAt && new Date(task.doneAt).toDateString() === new Date().toDateString());
}

function applyFilters(all) {
  const t = today();
  let list = all;

  // Completed tasks stay on screen (struck through) so a mistaken tick can be undone.
  switch (ui.filter) {
    case 'today':
      list = list.filter((x) => (x.done ? doneToday(x) || x.due === t : !x.due || x.due <= t));
      break;
    case 'upcoming':
      list = list.filter((x) => x.due && x.due > t && (!x.done || doneToday(x)));
      break;
    case 'overdue':
      list = list.filter((x) => !x.done && x.due && x.due < t);
      break;
    case 'done':
      list = list.filter((x) => x.done);
      break;
    default:
      list = list.slice();
  }

  if (ui.category !== 'all') list = list.filter((x) => x.category === ui.category);

  if (ui.search.trim()) {
    const s = ui.search.trim().toLowerCase();
    list = list.filter((x) => `${x.title} ${x.note || ''}`.toLowerCase().includes(s));
  }
  return list;
}

/* ------------------------------ markup ------------------------------ */
function groupedList(list) {
  if (ui.filter === 'done') {
    return `<div class="task-list">${list.map(taskCard).join('')}</div>`;
  }

  const t = today();
  const groups = [
    { label: 'Overdue', items: list.filter((x) => !x.done && x.due && x.due < t) },
    { label: 'Today', items: list.filter((x) => !x.done && x.due === t) },
    { label: 'Upcoming', items: list.filter((x) => !x.done && x.due && x.due > t) },
    { label: 'Someday', items: list.filter((x) => !x.done && !x.due) },
    { label: 'Completed', items: list.filter((x) => x.done) }
  ].filter((g) => g.items.length);

  return groups
    .map(
      (g) => `
      <div class="task-group mb-4">
        <div class="task-group__label">${esc(g.label)}<span class="task-group__count">${g.items.length}</span></div>
        <div class="task-list" data-sortable>${g.items.map(taskCard).join('')}</div>
      </div>`
    )
    .join('');
}

function taskCard(t) {
  const pri = PRIORITIES.find((p) => p.id === t.priority) || PRIORITIES[1];
  const cat = TASK_CATEGORIES.find((c) => c.id === t.category);
  const overdue = !t.done && t.due && t.due < today();
  return `
    <div class="swipe" data-id="${esc(t.id)}">
      <div class="swipe__actions" aria-hidden="true">
        <div class="swipe__action swipe__action--done">${icon('check')}</div>
        <div class="swipe__action swipe__action--del">${icon('trash')}</div>
      </div>
      <div class="swipe__content">
        <article class="task${t.done ? ' is-done' : ''}">
          <span class="task__pri ${pri.cls}"></span>
          <button class="check__box" data-toggle="${esc(t.id)}" type="button" aria-pressed="${Boolean(t.done)}"
                  aria-label="${t.done ? 'Mark incomplete' : 'Mark complete'}" style="margin-top:2px">${icon('check')}</button>
          <div class="task__body" data-edit="${esc(t.id)}" role="button" tabindex="0">
            <span class="task__title">${esc(t.title)}</span>
            ${t.note ? `<span class="task__note">${esc(t.note)}</span>` : ''}
            <span class="task__meta">
              ${cat ? `<span class="chip">${cat.emoji} ${esc(cat.label)}</span>` : ''}
              ${t.due ? `<span class="chip${overdue ? ' chip--danger' : ''}">${icon('clock')}${esc(relativeDay(t.due))}</span>` : ''}
              ${t.time ? `<span class="chip">${esc(fmtTime(t.time))}</span>` : ''}
              <span class="chip ${pri.chip}">${esc(pri.label)}</span>
            </span>
          </div>
          <button class="task__handle" data-handle type="button" aria-label="Reorder">${icon('drag')}</button>
        </article>
      </div>
    </div>`;
}

function emptyState() {
  const msg = {
    today: ['checkCircle', 'Nothing due today', 'Enjoy the calm — or add something meaningful.'],
    upcoming: ['calendar', 'No upcoming tasks', 'Plan ahead so future-you can relax.'],
    overdue: ['sparkles', 'Nothing overdue', 'You are beautifully on top of things.'],
    all: ['tasks', 'No tasks yet', 'Your list is clear. Add the next thing.'],
    done: ['star', 'Nothing completed yet', 'Tick your first task to see it here.']
  }[ui.filter] || ['tasks', 'No tasks', ''];

  return `
    <div class="empty">
      <div class="empty__icon">${icon(msg[0])}</div>
      <h3>${esc(msg[1])}</h3>
      <p>${esc(msg[2])}</p>
      <button class="btn btn--sm btn--primary" data-new type="button">${icon('plus')} Add a task</button>
    </div>`;
}

/* ------------------------------ behaviour ------------------------------ */
function bind(root) {
  root.querySelectorAll('[data-new]').forEach((b) =>
    b.addEventListener('click', () => openTaskForm(null, { due: ui.filter === 'today' ? today() : '' }))
  );

  root.querySelectorAll('[data-filter]').forEach((b) =>
    b.addEventListener('click', () => { ui.filter = b.dataset.filter; render(root); })
  );
  root.querySelectorAll('[data-cat]').forEach((b) =>
    b.addEventListener('click', () => { ui.category = b.dataset.cat; render(root); })
  );

  const search = root.querySelector('[data-search]');
  search?.addEventListener(
    'input',
    debounce((e) => {
      ui.search = e.target.value;
      const listNode = root.querySelector('[data-list]');
      const list = applyFilters(store.select.tasksSorted());
      listNode.innerHTML = list.length ? groupedList(list) : emptyState();
      bindList(listNode);
      listNode.querySelectorAll('[data-new]').forEach((b) =>
        b.addEventListener('click', () => openTaskForm(null, { due: ui.filter === 'today' ? today() : '' }))
      );
    }, 220)
  );

  bindList(root);
}

function bindList(root) {
  root.querySelectorAll('[data-toggle]').forEach((b) =>
    b.addEventListener('click', async (e) => {
      e.stopPropagation();
      await complete(b.dataset.toggle);
    })
  );

  root.querySelectorAll('[data-edit]').forEach((b) => {
    const open = () => {
      const task = store.state.tasks.find((t) => t.id === b.dataset.edit);
      if (task) openTaskForm(task);
    };
    b.addEventListener('click', open);
    b.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
  });

  root.querySelectorAll('[data-sortable]').forEach((list) =>
    initSortable(list, async (ids) => {
      try { await store.reorderTasks(ids); } catch { toast('Could not save the new order.', 'error'); }
    })
  );

  initSwipe(root, {
    onRight: (id) => complete(id),
    onLeft: async (id) => {
      const task = store.state.tasks.find((t) => t.id === id);
      if (!task) return;
      const ok = await confirmDialog({
        title: 'Delete task?',
        message: `“${task.title}” will be removed permanently.`,
        confirmText: 'Delete',
        danger: true
      });
      if (ok) { await store.remove('tasks', id); toast('Task deleted', 'info'); }
    }
  });
}

async function complete(id) {
  const task = store.state.tasks.find((t) => t.id === id);
  if (!task) return;
  const done = await store.toggleTask(task);
  if (done) {
    const unlocked = await store.evaluateBadges();
    if (unlocked.length) { confetti(); toast('New achievement unlocked 🏅'); }
    else toast('Nice one ✅');
  } else {
    toast('Back on your list', 'info');
  }
}
return Object.freeze({ meta, render });
  })();

  /* ===== js/views/calendar.js ===== */
  const __m35 = (function () {
const { esc, ymd, today, fromYmd, monthLabel, fmtTime, relativeDay } = __m1;
const { icon } = __m3;
const { toast, confirmDialog, initSwipe } = __m2;
const store = __m8;
const { EVENT_TYPES } = __m4;
const { openEventForm } = __m14;
/**
 * LifeFlow — Calendar: month grid with events, appointments and reminders.
 */







const meta = { title: 'Calendar', icon: 'calendar', label: 'Calendar' };

const ui = { cursor: new Date(), selected: today(), view: 'month' };

function render(root) {
  const first = new Date(ui.cursor.getFullYear(), ui.cursor.getMonth(), 1);
  const days = buildMonth(first);
  const selectedEvents = store.select.eventsOn(ui.selected);
  const monthEvents = store.state.events.filter((e) =>
    (e.date || '').startsWith(`${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, '0')}`)
  );

  root.innerHTML = `
    <div class="page">
      <section class="card card--accent">
        <div class="flex-between">
          <div>
            <span class="eyebrow">Your schedule</span>
            <h2>${esc(monthLabel(first))}</h2>
            <p class="fs-sm t-dim">${monthEvents.length} entr${monthEvents.length === 1 ? 'y' : 'ies'} this month</p>
          </div>
          <button class="btn btn--primary btn--sm" data-new type="button">${icon('plus')} New</button>
        </div>
      </section>

      <section class="card">
        <div class="cal">
          <div class="cal__head">
            <button class="iconbtn" data-prev type="button" aria-label="Previous month">${icon('chevronLeft')}</button>
            <span class="cal__month">${esc(monthLabel(first))}</span>
            <div class="flex gap-2">
              <button class="btn btn--xs btn--ghost" data-today type="button">Today</button>
              <button class="iconbtn" data-next type="button" aria-label="Next month">${icon('chevronRight')}</button>
            </div>
          </div>
          <div class="cal__dows">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => `<span>${d}</span>`).join('')}</div>
          <div class="cal__grid">
            ${days
              .map((d) => {
                const key = ymd(d.date);
                const count = store.select.eventsOn(key).length;
                const tasks = store.state.tasks.filter((t) => t.due === key && !t.done).length;
                const pips = Math.min(3, count + (tasks ? 1 : 0));
                return `
                <button class="cal__day${d.out ? ' is-out' : ''}${key === today() ? ' is-today' : ''}${
                  key === ui.selected ? ' is-sel' : ''
                }" data-day="${key}" type="button" aria-label="${esc(d.date.toDateString())}${count ? `, ${count} events` : ''}">
                  ${d.date.getDate()}
                  ${pips ? `<span class="pips">${'<i></i>'.repeat(pips)}</span>` : ''}
                </button>`;
              })
              .join('')}
          </div>
        </div>
      </section>

      <section class="card">
        <div class="card__head">
          <h3 class="card__title">${icon('clock')} ${esc(relativeDay(ui.selected))}</h3>
          <button class="btn btn--xs btn--soft" data-new-on type="button">${icon('plus')} Add</button>
        </div>
        ${
          selectedEvents.length
            ? `<div class="timeline">${selectedEvents.map(eventCard).join('')}</div>`
            : `<div class="empty">
                 <div class="empty__icon">${icon('calendar')}</div>
                 <h3>Nothing scheduled</h3>
                 <p>This day is wide open. Add an event, appointment or reminder.</p>
                 <button class="btn btn--sm btn--soft" data-new-on type="button">${icon('plus')} Add entry</button>
               </div>`
        }
        ${dayTasksBlock(ui.selected)}
      </section>

      <section class="card">
        <div class="card__head"><h3 class="card__title">${icon('layers')} Next 7 days</h3></div>
        ${
          store.select.upcomingEvents(7).length
            ? `<div class="timeline">${store.select.upcomingEvents(7).map(upcomingRow).join('')}</div>`
            : `<p class="fs-sm t-mute">Nothing coming up. Enjoy the space 🌤️</p>`
        }
      </section>
    </div>`;

  bind(root);
}

function buildMonth(first) {
  const start = new Date(first);
  const weekday = (start.getDay() + 6) % 7; // Monday-first
  start.setDate(start.getDate() - weekday);
  return [...Array(42)].map((_, i) => {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    return { date, out: date.getMonth() !== first.getMonth() };
  });
}

function eventCard(e) {
  const type = EVENT_TYPES.find((t) => t.id === e.type) || EVENT_TYPES[0];
  return `
    <div class="swipe" data-id="${esc(e.id)}">
      <div class="swipe__actions" aria-hidden="true">
        <div class="swipe__action swipe__action--done">${icon('edit')}</div>
        <div class="swipe__action swipe__action--del">${icon('trash')}</div>
      </div>
      <div class="swipe__content">
        <div class="event event--${esc(e.type || 'event')}" data-edit="${esc(e.id)}" role="button" tabindex="0">
          <span class="event__time">${e.time ? esc(fmtTime(e.time)) : 'All day'}</span>
          <div class="grow">
            <div class="row__title">${type.emoji} ${esc(e.title)}</div>
            <div class="row__sub">
              ${e.location ? `<span>${icon('compass')} ${esc(e.location)}</span>` : ''}
              ${e.note ? `<span>${esc(e.note)}</span>` : ''}
            </div>
          </div>
        </div>
      </div>
    </div>`;
}

function upcomingRow(e) {
  return `
    <div class="row" data-edit="${esc(e.id)}" role="button" tabindex="0">
      <span class="row__icon">${icon(e.type === 'appointment' ? 'clock' : e.type === 'reminder' ? 'bell' : 'calendar')}</span>
      <div class="row__main">
        <div class="row__title">${esc(e.title)}</div>
        <div class="row__sub">${esc(relativeDay(e.date))}${e.time ? ` · ${esc(fmtTime(e.time))}` : ''}</div>
      </div>
      ${icon('chevronRight', 'grow-0')}
    </div>`;
}

function dayTasksBlock(dateStr) {
  const tasks = store.state.tasks.filter((t) => t.due === dateStr);
  if (!tasks.length) return '';
  return `
    <div class="mt-4">
      <div class="task-group__label mb-2">${icon('tasks')} Tasks due</div>
      <div class="grid" style="gap:6px">
        ${tasks
          .map(
            (t) => `<div class="row" style="padding:8px"><span class="dot" style="background:var(--${
              t.done ? 'success' : 'accent'
            })"></span><div class="row__main"><div class="row__title${t.done ? ' t-mute' : ''}">${esc(t.title)}</div></div></div>`
          )
          .join('')}
      </div>
    </div>`;
}

function bind(root) {
  root.querySelector('[data-prev]')?.addEventListener('click', () => {
    ui.cursor = new Date(ui.cursor.getFullYear(), ui.cursor.getMonth() - 1, 1);
    render(root);
  });
  root.querySelector('[data-next]')?.addEventListener('click', () => {
    ui.cursor = new Date(ui.cursor.getFullYear(), ui.cursor.getMonth() + 1, 1);
    render(root);
  });
  root.querySelector('[data-today]')?.addEventListener('click', () => {
    ui.cursor = new Date();
    ui.selected = today();
    render(root);
  });

  root.querySelectorAll('[data-day]').forEach((b) =>
    b.addEventListener('click', () => {
      ui.selected = b.dataset.day;
      const d = fromYmd(b.dataset.day);
      if (d && d.getMonth() !== ui.cursor.getMonth()) ui.cursor = d;
      render(root);
    })
  );

  root.querySelectorAll('[data-new]').forEach((b) => b.addEventListener('click', () => openEventForm(null, { date: ui.selected })));
  root.querySelectorAll('[data-new-on]').forEach((b) => b.addEventListener('click', () => openEventForm(null, { date: ui.selected })));

  root.querySelectorAll('[data-edit]').forEach((node) => {
    const open = () => {
      const ev = store.state.events.find((e) => e.id === node.dataset.edit);
      if (ev) openEventForm(ev);
    };
    node.addEventListener('click', open);
    node.addEventListener('keydown', (e) => { if (e.key === 'Enter') open(); });
  });

  initSwipe(root, {
    onRight: (id) => {
      const ev = store.state.events.find((e) => e.id === id);
      if (ev) openEventForm(ev);
    },
    onLeft: async (id) => {
      const ev = store.state.events.find((e) => e.id === id);
      if (!ev) return;
      const ok = await confirmDialog({
        title: 'Delete entry?',
        message: `“${ev.title}” will be removed from your calendar.`,
        confirmText: 'Delete',
        danger: true
      });
      if (ok) { await store.remove('events', id); toast('Entry deleted', 'info'); }
    }
  });

  // Horizontal swipe between months on touch devices
  const grid = root.querySelector('.cal__grid');
  if (grid) {
    let x0 = null;
    grid.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') x0 = e.clientX; });
    grid.addEventListener('pointerup', (e) => {
      if (x0 == null) return;
      const dx = e.clientX - x0;
      x0 = null;
      if (Math.abs(dx) < 70) return;
      ui.cursor = new Date(ui.cursor.getFullYear(), ui.cursor.getMonth() + (dx < 0 ? 1 : -1), 1);
      render(root);
    });
  }
}
return Object.freeze({ meta, render });
  })();

  /* ===== js/views/finance.js ===== */
  const __m36 = (function () {
const { esc, fmtMoney, pct, ymd, relativeDay, countUp } = __m1;
const { icon } = __m3;
const { animateProgress, ring, sparkline, toast, confirmDialog, initSwipe } = __m2;
const store = __m8;
const { openSavingsForm, openTxnForm, openContribute, txnCategory } = __m14;
/**
 * LifeFlow — Finance: savings goals, cashflow and expense tracking.
 */






const meta = { title: 'Finance', icon: 'wallet', label: 'Money' };

const ui = { tab: 'overview', month: ymd().slice(0, 7) };

function render(root) {
  const cur = store.currency();
  const fin = store.select.savingsTotals();
  const cash = store.select.cashflow(ui.month);
  const planned = store.select.plannedPurchases();
  const plannedSpend = store.select.plannedSpend();
  const txns = store.select
    .monthTxns(ui.month)
    .slice()
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  root.innerHTML = `
    <div class="page">
      <section class="money-hero">
        <span class="eyebrow">Net this month</span>
        <div class="money-hero__val ${cash.net >= 0 ? 'pos' : 'neg'}" data-money="${cash.net}">${esc(fmtMoney(cash.net, cur))}</div>
        <div class="money-hero__split">
          <div>
            <div class="fs-xs t-mute fw-7">INCOME</div>
            <div class="fw-8 pos">${esc(fmtMoney(cash.income, cur))}</div>
          </div>
          <div>
            <div class="fs-xs t-mute fw-7">EXPENSES</div>
            <div class="fw-8 neg">${esc(fmtMoney(cash.expense, cur))}</div>
          </div>
          <div>
            <div class="fs-xs t-mute fw-7">SAVED TOTAL</div>
            <div class="fw-8">${esc(fmtMoney(fin.saved, cur))}</div>
          </div>
          ${
            planned.length
              ? `<a href="#/purchases" style="color:inherit;text-decoration:none">
                  <div class="fs-xs t-mute fw-7">PLANNED BUYS</div>
                  <div class="fw-8">${esc(fmtMoney(plannedSpend, cur))} · ${planned.length}</div>
                </a>`
              : ''
          }
        </div>
      </section>

      <div class="flex-between">
        <div class="segmented" role="tablist">
          <button role="tab" data-tab="overview" aria-selected="${ui.tab === 'overview'}">Overview</button>
          <button role="tab" data-tab="goals" aria-selected="${ui.tab === 'goals'}">Savings</button>
          <button role="tab" data-tab="activity" aria-selected="${ui.tab === 'activity'}">Activity</button>
        </div>
        <button class="btn btn--primary btn--sm" data-new-txn type="button">${icon('plus')} Entry</button>
      </div>

      <div data-panel>${ui.tab === 'overview' ? overview(cash, fin, txns, cur) : ui.tab === 'goals' ? goalsPanel(cur) : activityPanel(txns, cur)}</div>
    </div>`;

  bind(root);
  animateProgress(root);
  const money = root.querySelector('[data-money]');
  if (money) countUp(money, Number(money.dataset.money), { format: (v) => fmtMoney(v, cur) });
}

/* ------------------------------ panels ------------------------------ */
function overview(cash, fin, txns, cur) {
  const byCat = {};
  txns.filter((t) => t.type === 'expense').forEach((t) => {
    byCat[t.category] = (byCat[t.category] || 0) + (Number(t.amount) || 0);
  });
  const top = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxCat = top[0]?.[1] || 1;
  const daily = dailySeries(txns);

  return `
    <div class="g-main">
      <div class="grid" style="gap:var(--s-5)">
        <section class="card">
          <div class="card__head">
            <h3 class="card__title">${icon('trending')} Spending trend</h3>
            <span class="chip">${esc(new Date(`${ui.month}-01`).toLocaleDateString(undefined, { month: 'long' }))}</span>
          </div>
          ${sparkline(daily, { height: 100 })}
          <p class="fs-xs t-mute mt-2">Daily expenses across the month.</p>
        </section>

        <section class="card">
          <div class="card__head"><h3 class="card__title">${icon('chart')} Where it goes</h3></div>
          ${
            top.length
              ? `<div class="balance">
                  ${top
                    .map(([id, amount]) => {
                      const c = txnCategory(id);
                      return `
                      <div class="balance__row">
                        <div class="balance__top"><span>${c.emoji} ${esc(c.label)}</span><span>${esc(fmtMoney(amount, cur))}</span></div>
                        <div class="bar"><div class="bar__fill" data-val="${pct(amount, maxCat)}"></div></div>
                      </div>`;
                    })
                    .join('')}
                 </div>`
              : `<p class="fs-sm t-mute">No expenses logged this month yet.</p>`
          }
        </section>
      </div>

      <div class="grid" style="gap:var(--s-5)">
        <section class="card center">
          <div class="card__head"><h3 class="card__title">${icon('target')} Savings progress</h3></div>
          <div style="display:grid;justify-items:center;gap:var(--s-3)">
            ${ring(fin.percent, { size: 150, stroke: 13, label: `${fin.percent}%`, caption: 'of goals' })}
            <p class="fs-sm t-dim">${esc(fmtMoney(fin.saved, cur))} of ${esc(fmtMoney(fin.target, cur))}</p>
            <button class="btn btn--soft btn--sm" data-tab-go="goals" type="button">Manage goals ${icon('arrowRight')}</button>
          </div>
        </section>

        <section class="card">
          <div class="card__head">
            <h3 class="card__title">${icon('clock')} Recent activity</h3>
            <button class="btn btn--xs btn--ghost" data-tab-go="activity" type="button">All</button>
          </div>
          ${txns.length ? txns.slice(0, 5).map((t) => txnRow(t, cur)).join('') : `<p class="fs-sm t-mute">Nothing logged yet.</p>`}
        </section>
      </div>
    </div>`;
}

function goalsPanel(cur) {
  const goals = store.state.savings;
  if (!goals.length) {
    return `
      <div class="empty">
        <div class="empty__icon">${icon('wallet')}</div>
        <h3>No savings goals yet</h3>
        <p>Name what you're saving for — a trip, a buffer, a dream — and watch it grow.</p>
        <button class="btn btn--primary btn--sm" data-new-goal type="button">${icon('plus')} Create goal</button>
      </div>`;
  }
  return `
    <div class="grid" style="gap:var(--s-4)">
      <button class="btn btn--soft btn--block" data-new-goal type="button">${icon('plus')} New savings goal</button>
      <div class="g-2">
        ${goals
          .map((g) => {
            const p = pct(Number(g.saved) || 0, Number(g.target) || 0);
            return `
            <article class="card goal-card" data-id="${esc(g.id)}">
              <div class="goal-card__top">
                <span class="goal-card__emoji">${esc(g.emoji || '🎯')}</span>
                <div class="grow">
                  <div class="fw-7">${esc(g.title)}</div>
                  <div class="fs-xs t-mute">${g.deadline ? `by ${esc(relativeDay(g.deadline))}` : 'No deadline'}</div>
                </div>
                <button class="iconbtn iconbtn--sm iconbtn--bare" data-edit-goal="${esc(g.id)}" type="button" aria-label="Edit">${icon('edit')}</button>
              </div>
              <div class="bar"><div class="bar__fill" data-val="${p}"></div></div>
              <div class="goal-card__amt"><b>${esc(fmtMoney(g.saved || 0, cur))}</b><span class="t-mute">${esc(fmtMoney(g.target || 0, cur))}</span></div>
              <div class="flex gap-2">
                <button class="btn btn--xs btn--soft grow" data-add-money="${esc(g.id)}" type="button">${icon('plus')} Add money</button>
                <span class="chip ${p >= 100 ? 'chip--success' : 'chip--accent'}">${p}%</span>
              </div>
            </article>`;
          })
          .join('')}
      </div>
    </div>`;
}

function activityPanel(txns, cur) {
  if (!txns.length) {
    return `
      <div class="empty">
        <div class="empty__icon">${icon('wallet')}</div>
        <h3>No entries this month</h3>
        <p>Log income and expenses to see your real picture.</p>
        <button class="btn btn--primary btn--sm" data-new-txn type="button">${icon('plus')} Add entry</button>
      </div>`;
  }
  const groups = txns.reduce((acc, t) => {
    (acc[t.date] ||= []).push(t);
    return acc;
  }, {});
  return `
    <div class="grid" style="gap:var(--s-4)">
      ${Object.entries(groups)
        .map(
          ([date, items]) => `
        <section class="card card--pad-sm">
          <div class="task-group__label mb-2">${esc(relativeDay(date))}</div>
          ${items.map((t) => txnRow(t, cur)).join('')}
        </section>`
        )
        .join('')}
    </div>`;
}

function txnRow(t, cur) {
  const c = txnCategory(t.category);
  const income = t.type === 'income';
  return `
    <div class="swipe" data-id="${esc(t.id)}">
      <div class="swipe__actions" aria-hidden="true">
        <div class="swipe__action swipe__action--done">${icon('edit')}</div>
        <div class="swipe__action swipe__action--del">${icon('trash')}</div>
      </div>
      <div class="swipe__content">
        <div class="txn" data-edit-txn="${esc(t.id)}" role="button" tabindex="0">
          <span class="txn__icon">${c.emoji}</span>
          <div class="grow">
            <div class="row__title">${esc(t.title)}</div>
            <div class="row__sub">${esc(c.label)} · ${esc(relativeDay(t.date))}</div>
          </div>
          <span class="txn__amt ${income ? 'pos' : 'neg'}">${income ? '+' : '−'}${esc(fmtMoney(Math.abs(Number(t.amount) || 0), cur))}</span>
        </div>
      </div>
    </div>`;
}

function dailySeries(txns) {
  const [y, m] = ui.month.split('-').map(Number);
  const days = new Date(y, m, 0).getDate();
  const series = Array(days).fill(0);
  txns
    .filter((t) => t.type === 'expense')
    .forEach((t) => {
      const d = Number((t.date || '').slice(8, 10));
      if (d >= 1 && d <= days) series[d - 1] += Number(t.amount) || 0;
    });
  return series;
}

/* ------------------------------ behaviour ------------------------------ */
function bind(root) {
  root.querySelectorAll('[data-tab]').forEach((b) =>
    b.addEventListener('click', () => { ui.tab = b.dataset.tab; render(root); })
  );
  root.querySelectorAll('[data-tab-go]').forEach((b) =>
    b.addEventListener('click', () => { ui.tab = b.dataset.tabGo; render(root); })
  );
  root.querySelectorAll('[data-new-txn]').forEach((b) => b.addEventListener('click', () => openTxnForm()));
  root.querySelectorAll('[data-new-goal]').forEach((b) => b.addEventListener('click', () => openSavingsForm()));

  root.querySelectorAll('[data-edit-goal]').forEach((b) =>
    b.addEventListener('click', () => {
      const g = store.state.savings.find((x) => x.id === b.dataset.editGoal);
      if (g) openSavingsForm(g);
    })
  );
  root.querySelectorAll('[data-add-money]').forEach((b) =>
    b.addEventListener('click', () => {
      const g = store.state.savings.find((x) => x.id === b.dataset.addMoney);
      if (g) openContribute(g);
    })
  );
  root.querySelectorAll('[data-edit-txn]').forEach((node) => {
    const open = () => {
      const t = store.state.txns.find((x) => x.id === node.dataset.editTxn);
      if (t) openTxnForm(t);
    };
    node.addEventListener('click', open);
    node.addEventListener('keydown', (e) => { if (e.key === 'Enter') open(); });
  });

  initSwipe(root, {
    onRight: (id) => {
      const t = store.state.txns.find((x) => x.id === id);
      if (t) openTxnForm(t);
    },
    onLeft: async (id) => {
      const t = store.state.txns.find((x) => x.id === id);
      if (!t) return;
      const ok = await confirmDialog({ title: 'Delete entry?', message: `“${t.title}” will be removed.`, confirmText: 'Delete', danger: true });
      if (ok) { await store.remove('txns', id); toast('Entry deleted', 'info'); }
    }
  });
}
return Object.freeze({ meta, render });
  })();

  /* ===== js/views/purchases.js ===== */
  const __m37 = (function () {
const { esc, fmtMoney, relativeDay, ymd, countUp, haptic } = __m1;
const { icon } = __m3;
const { toast, confetti, confirmDialog, initSwipe } = __m2;
const store = __m8;
const { openPurchaseForm, purchasePriority, txnCategory } = __m14;
const { navigate } = __m6;
/**
 * LifeFlow — Purchases: the wish list that keeps your money honest.
 * Ticking an item off writes a matching expense into Finance; un-ticking it
 * takes that expense back out again.
 */







const meta = { title: 'Purchases', icon: 'cart', label: 'Purchases' };

const ui = { filter: 'planned' };

const FILTERS = [
  { id: 'planned', label: 'To buy' },
  { id: 'bought', label: 'Bought' },
  { id: 'all', label: 'All' }
];

function render(root) {
  const cur = store.currency();
  const all = store.select.purchasesSorted();
  const planned = store.select.plannedPurchases();
  const plannedSpend = store.select.plannedSpend();
  const cash = store.select.cashflow();
  const spentThisMonth = boughtIn(ymd().slice(0, 7)).reduce((s, p) => s + (Number(p.price) || 0), 0);
  const list = applyFilter(all);

  root.innerHTML = `
    <div class="page">
      <section class="money-hero">
        <span class="eyebrow">Left this month after planned buys</span>
        <div class="money-hero__val ${cash.net - plannedSpend >= 0 ? 'pos' : 'neg'}" data-money="${cash.net - plannedSpend}">${esc(
          fmtMoney(cash.net - plannedSpend, cur)
        )}</div>
        <div class="money-hero__split">
          <div>
            <div class="fs-xs t-mute fw-7">AVAILABLE NOW</div>
            <div class="fw-8 ${cash.net >= 0 ? 'pos' : 'neg'}">${esc(fmtMoney(cash.net, cur))}</div>
          </div>
          <div>
            <div class="fs-xs t-mute fw-7">STILL TO BUY</div>
            <div class="fw-8">${esc(fmtMoney(plannedSpend, cur))} · ${planned.length}</div>
          </div>
          <div>
            <div class="fs-xs t-mute fw-7">BOUGHT THIS MONTH</div>
            <div class="fw-8 neg">${esc(fmtMoney(spentThisMonth, cur))}</div>
          </div>
        </div>
      </section>

      <div class="flex-between">
        <div class="chips-row" data-filters>
          ${FILTERS.map(
            (f) =>
              `<button type="button" data-filter="${f.id}" aria-pressed="${ui.filter === f.id}">${esc(f.label)}${
                f.id === 'planned' && planned.length ? ` · ${planned.length}` : ''
              }</button>`
          ).join('')}
        </div>
        <button class="btn btn--primary btn--sm" data-new type="button">${icon('plus')} Item</button>
      </div>

      <section data-list>
        ${list.length ? `<div class="task-list">${list.map((p) => purchaseCard(p, cur)).join('')}</div>` : emptyState()}
      </section>

      <button class="btn btn--soft btn--block" data-go="/finance">${icon('wallet')} See these in your money records ${icon(
        'arrowRight'
      )}</button>
    </div>`;

  bind(root);
  const money = root.querySelector('[data-money]');
  if (money) countUp(money, Number(money.dataset.money), { format: (v) => fmtMoney(v, cur) });
}

/* ------------------------------ helpers ------------------------------ */
function boughtIn(monthKey) {
  return store.select.boughtPurchases().filter((p) => p.boughtAt && ymd(new Date(p.boughtAt)).startsWith(monthKey));
}

function applyFilter(all) {
  if (ui.filter === 'planned') return all.filter((p) => !p.bought);
  if (ui.filter === 'bought') return all.filter((p) => p.bought);
  return all;
}

/* ------------------------------ markup ------------------------------ */
function purchaseCard(p, cur) {
  const cat = txnCategory(p.category);
  const pri = purchasePriority(p.priority);
  const price = Number(p.price) || 0;
  return `
    <div class="swipe" data-id="${esc(p.id)}">
      <div class="swipe__actions" aria-hidden="true">
        <div class="swipe__action swipe__action--done">${icon('check')}</div>
        <div class="swipe__action swipe__action--del">${icon('trash')}</div>
      </div>
      <div class="swipe__content">
        <article class="task purchase${p.bought ? ' is-done' : ''}">
          <button class="check__box" data-toggle="${esc(p.id)}" type="button" aria-pressed="${Boolean(p.bought)}"
                  aria-label="${p.bought ? 'Mark as not bought yet' : 'Mark as bought'}" style="margin-top:2px">${icon('check')}</button>
          <div class="task__body" data-edit="${esc(p.id)}" role="button" tabindex="0">
            <span class="task__title">${esc(p.title)}</span>
            ${p.note ? `<span class="task__note">${esc(p.note)}</span>` : ''}
            <span class="task__meta">
              <span class="chip">${cat.emoji} ${esc(cat.label)}</span>
              <span class="chip${p.priority === 'need' ? ' chip--warning' : ''}">${pri.emoji} ${esc(pri.label)}</span>
              ${p.shop ? `<span class="chip">${esc(p.shop)}</span>` : ''}
              ${p.bought && p.boughtAt ? `<span class="chip chip--success">${icon('check')}${esc(relativeDay(ymd(new Date(p.boughtAt))))}</span>` : ''}
            </span>
          </div>
          <span class="purchase__price${p.bought ? ' neg' : ''}">${esc(fmtMoney(price, cur))}</span>
        </article>
      </div>
    </div>`;
}

function emptyState() {
  const msg = {
    planned: ['cart', 'Nothing on the list', 'Add what you would like to buy and see what it costs you.'],
    bought: ['checkCircle', 'Nothing bought yet', 'Tick an item off and it lands in your expenses.'],
    all: ['cart', 'Your list is empty', 'Plan a purchase and keep your spending intentional.']
  }[ui.filter];

  return `
    <div class="empty">
      <div class="empty__icon">${icon(msg[0])}</div>
      <h3>${esc(msg[1])}</h3>
      <p>${esc(msg[2])}</p>
      <button class="btn btn--sm btn--primary" data-new type="button">${icon('plus')} Add an item</button>
    </div>`;
}

/* ------------------------------ behaviour ------------------------------ */
function bind(root) {
  root.querySelectorAll('[data-new]').forEach((b) => b.addEventListener('click', () => openPurchaseForm()));
  root.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => navigate(b.dataset.go)));

  root.querySelectorAll('[data-filter]').forEach((b) =>
    b.addEventListener('click', () => { ui.filter = b.dataset.filter; render(root); })
  );

  root.querySelectorAll('[data-toggle]').forEach((b) =>
    b.addEventListener('click', async (e) => {
      e.stopPropagation();
      await toggle(b.dataset.toggle);
    })
  );

  root.querySelectorAll('[data-edit]').forEach((node) => {
    const open = () => {
      const item = store.state.purchases.find((p) => p.id === node.dataset.edit);
      if (item) openPurchaseForm(item);
    };
    node.addEventListener('click', open);
    node.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
    });
  });

  initSwipe(root, {
    onRight: (id) => toggle(id),
    onLeft: async (id) => {
      const item = store.state.purchases.find((p) => p.id === id);
      if (!item) return;
      const ok = await confirmDialog({
        title: 'Remove from list?',
        message: item.bought
          ? `“${item.title}” disappears from the list, but the expense stays in your records.`
          : `“${item.title}” will be removed from your list.`,
        confirmText: 'Remove',
        danger: true
      });
      if (ok) { await store.remove('purchases', id); toast('Removed from your list', 'info'); }
    }
  });
}

async function toggle(id) {
  const item = store.state.purchases.find((p) => p.id === id);
  if (!item) return;
  const cur = store.currency();
  try {
    const bought = await store.togglePurchase(item);
    haptic(12);
    if (bought) {
      confetti(14);
      const price = Number(item.price) || 0;
      toast(price > 0 ? `Bought — ${fmtMoney(price, cur)} logged as an expense 🛍️` : 'Bought 🛍️');
    } else {
      toast('Back on the list — expense removed', 'info');
    }
  } catch (err) {
    console.error(err);
    toast('Could not update that item.', 'error');
  }
}
return Object.freeze({ meta, render });
  })();

  /* ===== js/views/goals.js ===== */
  const __m38 = (function () {
const { esc, relativeDay } = __m1;
const { icon } = __m3;
const { animateProgress, ring, toast, confetti } = __m2;
const store = __m8;
const { GOAL_AREAS } = __m4;
const { openGoalForm } = __m14;
/**
 * LifeFlow — Goals: personal & professional ambitions with milestones.
 */







const meta = { title: 'Goals', icon: 'target', label: 'Goals' };

const ui = { area: 'all' };

function render(root) {
  const all = store.state.goals;
  const list = ui.area === 'all' ? all : all.filter((g) => g.area === ui.area);
  const avg = all.length ? Math.round(all.reduce((s, g) => s + store.select.goalProgress(g), 0) / all.length) : 0;
  const completed = all.filter((g) => store.select.goalProgress(g) >= 100).length;

  root.innerHTML = `
    <div class="page">
      <section class="card card--accent">
        <div class="flex-between">
          <div class="grow">
            <span class="eyebrow">Where you're heading</span>
            <h2>${all.length ? `${all.length} active goal${all.length > 1 ? 's' : ''}` : 'Set your first goal'}</h2>
            <p class="fs-sm t-dim">${completed} completed · ${avg}% average progress</p>
          </div>
          ${all.length ? ring(avg, { size: 92, stroke: 9, label: `${avg}%` }) : ''}
        </div>
      </section>

      <div class="flex-between">
        <div class="segmented" role="tablist">
          <button role="tab" data-area="all" aria-selected="${ui.area === 'all'}">All</button>
          ${GOAL_AREAS.map(
            (a) => `<button role="tab" data-area="${a.id}" aria-selected="${ui.area === a.id}">${a.emoji} ${esc(a.label)}</button>`
          ).join('')}
        </div>
        <button class="btn btn--primary btn--sm" data-new type="button">${icon('plus')} New</button>
      </div>

      ${
        list.length
          ? `<div class="g-2">${list.map(goalCard).join('')}</div>`
          : `<div class="empty">
              <div class="empty__icon">${icon('target')}</div>
              <h3>No goals here yet</h3>
              <p>Big or small — write down what you're working toward and break it into milestones.</p>
              <button class="btn btn--primary btn--sm" data-new type="button">${icon('plus')} Create a goal</button>
            </div>`
      }
    </div>`;

  bind(root);
  animateProgress(root);
}

function goalCard(g) {
  const p = store.select.goalProgress(g);
  const area = GOAL_AREAS.find((a) => a.id === g.area) || GOAL_AREAS[0];
  const milestones = Array.isArray(g.milestones) ? g.milestones : [];
  return `
    <article class="card goal" data-id="${esc(g.id)}">
      <div class="goal__head">
        <span class="goal-card__emoji">${area.emoji}</span>
        <div class="grow">
          <div class="goal__title">${esc(g.title)}</div>
          <div class="fs-xs t-mute">${esc(area.label)}${g.target ? ` · target ${esc(relativeDay(g.target))}` : ''}</div>
        </div>
        <button class="iconbtn iconbtn--sm iconbtn--bare" data-edit="${esc(g.id)}" type="button" aria-label="Edit goal">${icon('edit')}</button>
      </div>

      ${g.why ? `<p class="fs-sm t-dim">${esc(g.why)}</p>` : ''}

      <div>
        <div class="balance__top mb-2"><span class="fs-xs fw-7 t-mute">PROGRESS</span><span class="fs-xs fw-7">${p}%</span></div>
        <div class="bar"><div class="bar__fill" data-val="${p}"></div></div>
      </div>

      ${
        milestones.length
          ? `<div class="milestones">
              ${milestones
                .map(
                  (m) => `
                <label class="milestone${m.done ? ' is-done' : ''}">
                  <span class="check" style="pointer-events:none">
                    <input type="checkbox" ${m.done ? 'checked' : ''} data-ms="${esc(g.id)}|${esc(m.id)}" style="pointer-events:auto" />
                    <span class="check__box">${icon('check')}</span>
                  </span>
                  <span class="grow">${esc(m.text)}</span>
                </label>`
                )
                .join('')}
             </div>`
          : `<p class="fs-xs t-mute">No milestones yet — edit the goal to add steps.</p>`
      }

      ${p >= 100 ? `<span class="chip chip--success">${icon('star')} Completed</span>` : ''}
    </article>`;
}

function bind(root) {
  root.querySelectorAll('[data-area]').forEach((b) =>
    b.addEventListener('click', () => { ui.area = b.dataset.area; render(root); })
  );
  root.querySelectorAll('[data-new]').forEach((b) =>
    b.addEventListener('click', () => openGoalForm(null, { area: ui.area === 'all' ? 'personal' : ui.area }))
  );
  root.querySelectorAll('[data-edit]').forEach((b) =>
    b.addEventListener('click', () => {
      const g = store.state.goals.find((x) => x.id === b.dataset.edit);
      if (g) openGoalForm(g);
    })
  );

  root.querySelectorAll('[data-ms]').forEach((input) =>
    input.addEventListener('change', async () => {
      const [goalId, msId] = input.dataset.ms.split('|');
      const goal = store.state.goals.find((g) => g.id === goalId);
      if (!goal) return;
      const milestones = (goal.milestones || []).map((m) => (m.id === msId ? { ...m, done: input.checked } : m));
      await store.update('goals', goalId, { milestones });
      const done = milestones.filter((m) => m.done).length;
      if (done === milestones.length && milestones.length) {
        confetti();
        toast(`Goal complete: ${goal.title} 🎉`);
        store.evaluateBadges();
      }
    })
  );
}
return Object.freeze({ meta, render });
  })();

  /* ===== js/views/habits.js ===== */
  const __m39 = (function () {
const { esc, ymd, today, addDays, startOfWeek, pct, haptic } = __m1;
const { icon } = __m3;
const { animateProgress, ring, toast, confetti } = __m2;
const store = __m8;
const { openHabitForm } = __m14;
/**
 * LifeFlow — Habits: daily check-ins, streaks and a 12-week heatmap.
 */






const meta = { title: 'Habits', icon: 'flame', label: 'Habits' };

function render(root) {
  const habits = store.state.habits;
  const doneToday = store.select.habitsDoneToday();
  const completion = habits.length ? pct(doneToday, habits.length) : 0;
  const best = store.select.bestStreak();

  root.innerHTML = `
    <div class="page">
      <section class="card card--accent">
        <div class="flex-between">
          <div class="grow">
            <span class="eyebrow">Daily rituals</span>
            <h2>${habits.length ? `${doneToday} of ${habits.length} done today` : 'Build your first habit'}</h2>
            <p class="fs-sm t-dim">${best ? `Longest active streak: ${best} day${best > 1 ? 's' : ''} 🔥` : 'Consistency beats intensity.'}</p>
          </div>
          ${habits.length ? ring(completion, { size: 92, stroke: 9, label: `${completion}%` }) : ''}
        </div>
      </section>

      <button class="btn btn--soft btn--block" data-new type="button">${icon('plus')} New habit</button>

      ${
        habits.length
          ? `<div class="grid" style="gap:var(--s-4)">${habits.map(habitCard).join('')}</div>
             ${heatmapCard(habits)}`
          : `<div class="empty">
              <div class="empty__icon">${icon('flame')}</div>
              <h3>No habits yet</h3>
              <p>Pick one small thing you can do most days. Streaks make it stick.</p>
              <button class="btn btn--primary btn--sm" data-new type="button">${icon('plus')} Create habit</button>
            </div>`
      }
    </div>`;

  bind(root);
  animateProgress(root);
}

function habitCard(h) {
  const log = Array.isArray(h.log) ? h.log : [];
  const streak = store.streakOf(log);
  const done = log.includes(today());
  const weekStart = startOfWeek(new Date());
  const week = [...Array(7)].map((_, i) => {
    const d = addDays(weekStart, i);
    const key = ymd(d);
    return { key, on: log.includes(key), isToday: key === today(), label: d.toLocaleDateString(undefined, { weekday: 'narrow' }) };
  });
  const weekCount = week.filter((d) => d.on).length;
  const target = Math.min(7, Number(h.weeklyTarget) || 7);

  return `
    <article class="card habit${done ? ' is-done-today' : ''}" data-id="${esc(h.id)}">
      <div class="habit__top">
        <span class="habit__emoji">${esc(h.emoji || '🔥')}</span>
        <div class="grow">
          <div class="fw-7">${esc(h.title)}</div>
          <div class="row__sub">
            ${streak ? `<span class="habit__streak">${icon('flame')} ${streak} day${streak > 1 ? 's' : ''}</span>` : '<span>Start today</span>'}
            <span>· ${weekCount}/${target} this week</span>
          </div>
        </div>
        <button class="iconbtn iconbtn--sm iconbtn--bare" data-edit="${esc(h.id)}" type="button" aria-label="Edit habit">${icon('edit')}</button>
        <button class="habit__check" data-check="${esc(h.id)}" type="button" aria-pressed="${done}"
                aria-label="${done ? 'Undo' : 'Complete'} ${esc(h.title)} for today">${icon('check')}</button>
      </div>

      ${h.why ? `<p class="fs-xs t-mute">${esc(h.why)}</p>` : ''}

      <div class="habit__week">
        ${week
          .map(
            (d) => `
          <div class="habit__day">
            <span>${esc(d.label)}</span>
            <i data-on="${d.on ? 1 : 0}" data-today="${d.isToday ? 1 : 0}" data-day="${esc(h.id)}|${d.key}" role="button" tabindex="0"
               aria-label="${esc(d.key)}"></i>
          </div>`
          )
          .join('')}
      </div>
      <div class="bar bar--thin"><div class="bar__fill" data-val="${pct(weekCount, target)}"></div></div>
    </article>`;
}

function heatmapCard(habits) {
  const days = 84; // 12 weeks
  const start = addDays(new Date(), -(days - 1));
  const all = new Set();
  habits.forEach((h) => (h.log || []).forEach((d) => all.add(d)));

  const cells = [...Array(days)].map((_, i) => {
    const key = ymd(addDays(start, i));
    return `<i data-on="${all.has(key) ? 1 : 0}" title="${key}"></i>`;
  });

  return `
    <section class="card">
      <div class="card__head">
        <h3 class="card__title">${icon('grid')} Last 12 weeks</h3>
        <span class="chip chip--accent">${all.size} active days</span>
      </div>
      <div style="overflow-x:auto"><div class="heat">${cells.join('')}</div></div>
    </section>`;
}

function bind(root) {
  root.querySelectorAll('[data-new]').forEach((b) => b.addEventListener('click', () => openHabitForm()));
  root.querySelectorAll('[data-edit]').forEach((b) =>
    b.addEventListener('click', () => {
      const h = store.state.habits.find((x) => x.id === b.dataset.edit);
      if (h) openHabitForm(h);
    })
  );

  root.querySelectorAll('[data-check]').forEach((b) =>
    b.addEventListener('click', async () => {
      const h = store.state.habits.find((x) => x.id === b.dataset.check);
      if (!h) return;
      const on = await store.toggleHabitDay(h);
      haptic(14);
      if (on) {
        const streak = store.streakOf([...(h.log || []), today()]);
        if (streak > 1 && streak % 7 === 0) { confetti(); toast(`${streak}-day streak on ${h.title}! 🔥`); }
        store.evaluateBadges();
      }
    })
  );

  root.querySelectorAll('[data-day]').forEach((cell) => {
    const toggle = async () => {
      const [id, date] = cell.dataset.day.split('|');
      if (date > today()) return toast('That day hasn’t happened yet 🙂', 'info');
      const h = store.state.habits.find((x) => x.id === id);
      if (h) { await store.toggleHabitDay(h, date); haptic(10); }
    };
    cell.addEventListener('click', toggle);
    cell.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
  });
}
return Object.freeze({ meta, render });
  })();

  /* ===== js/arcade/rooms.js ===== */
  const __m41 = (function () {
const { db, doc, collection, setDoc, updateDoc, deleteDoc, onSnapshot, getDocs, serverTimestamp, runTransaction } = __m7;
const store = __m8;
/**
 * LifeFlow Arcade — remote play over Firestore.
 *
 * A room is a single document under `rooms/{code}` holding the shared game
 * state. Both players watch it; only the player whose turn it is writes to it.
 * The same document doubles as the signalling channel for the video call.
 */



/** Unambiguous alphabet — no O/0 or I/1 to misread down the phone. */
const ALPHABET = 'ACDEFGHJKLMNPQRSTUVWXYZ23456789';
const SEAT_KEYS = ['a', 'b'];

function newCode(len = 8) {
  const bytes = new Uint32Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

function roomRef(code) {
  return doc(db, 'rooms', code);
}

function iceRef(code, seat) {
  return collection(db, 'rooms', code, seat === 0 ? 'iceHost' : 'iceGuest');
}

function inviteLink(code) {
  // location.origin is "null" on file://, so build from the full URL instead.
  const base = location.href.split('#')[0];
  return `${base}#/games?room=${encodeURIComponent(code)}`;
}

function me() {
  const s = store.state;
  return {
    uid: s.uid,
    name: s.profile?.name || s.user?.displayName || (s.user?.email || 'Player').split('@')[0]
  };
}

/**
 * Identifies this browser tab, so one account can sit on both sides of a table
 * (a phone and a laptop, say) without being mistaken for the host twice.
 */
const TAB = (() => {
  try {
    let id = sessionStorage.getItem('lf:tab');
    if (!id) { id = newCode(8); sessionStorage.setItem('lf:tab', id); }
    return id;
  } catch {
    return newCode(8);
  }
})();

/* ------------------------------ lifecycle ------------------------------ */
async function createRoom({ gameId, level, state }) {
  const who = me();
  if (!who.uid) throw new Error('Sign in to play with a friend.');
  const code = newCode();

  await setDoc(roomRef(code), {
    code,
    gameId,
    level: level || 'even',
    hostUid: who.uid,
    hostTab: TAB,
    guestUid: null,
    guestTab: null,
    guestJoin: null,
    host: { name: who.name },
    guest: null,
    state,
    seq: 0,
    round: 0,
    outcome: null,
    media: { a: { cam: false, mic: false }, b: { cam: false, mic: false } },
    rematch: { a: false, b: false },
    chat: [],
    offer: null,
    answer: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  return code;
}

async function joinRoom(code) {
  const who = me();
  if (!who.uid) throw new Error('Sign in to join the game.');

  return runTransaction(db, async (tx) => {
    const snap = await tx.get(roomRef(code));
    if (!snap.exists()) throw new Error('That game could not be found — the link may have expired.');

    const data = snap.data();
    // The host's own tab (or an older room without tab ids) goes back to seat one.
    if (data.hostUid === who.uid && (!data.hostTab || data.hostTab === TAB)) return { seat: 0, data };
    if (data.guestUid && (data.guestUid !== who.uid || (data.guestTab && data.guestTab !== TAB))) {
      throw new Error('This game already has two players. Leave the other table before joining here.');
    }

    // Every arrival gets a fresh token — the host reopens the call when it changes.
    const seated = {
      guestUid: who.uid,
      guestTab: TAB,
      guestJoin: newCode(8),
      guest: { name: who.name },
      offer: null,
      answer: null
    };
    const media = { ...data.media, b: { cam: false, mic: false } };
    const rematch = { ...data.rematch, b: false };
    tx.update(roomRef(code), {
      ...seated, 'media.b': media.b, 'rematch.b': false, updatedAt: serverTimestamp()
    });
    return { seat: 1, data: { ...data, ...seated, media, rematch } };
  });
}

function watchRoom(code, onChange, onGone) {
  return onSnapshot(
    roomRef(code),
    (snap) => {
      if (!snap.exists()) { onGone?.(); return; }
      onChange(snap.data());
    },
    (err) => {
      console.warn('[arcade] room snapshot', err);
      onGone?.(err);
    }
  );
}

/* ------------------------------ play ------------------------------ */
async function pushState(code, { state, outcome, seq }) {
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(roomRef(code));
    if (!snap.exists()) throw new Error('The game was closed.');
    const data = snap.data();
    if (!data.guestUid) throw new Error('Wait for your friend to rejoin.');
    if ((data.seq || 0) !== seq - 1) throw new Error('The board changed. Please try your move again.');
    tx.update(roomRef(code), {
      state,
      outcome: outcome || null,
      seq,
      rematch: { a: false, b: false },
      updatedAt: serverTimestamp()
    });
  });
}

async function pushRematch(code, seat, on) {
  await updateDoc(roomRef(code), {
    [`rematch.${SEAT_KEYS[seat]}`]: Boolean(on),
    updatedAt: serverTimestamp()
  });
}

async function restart(code, state, seq, round) {
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(roomRef(code));
    if (!snap.exists()) throw new Error('The game was closed.');
    if ((snap.data().seq || 0) !== seq - 1) throw new Error('The board changed. Please try restarting again.');
    tx.update(roomRef(code), {
      state,
      outcome: null,
      seq,
      round,
      rematch: { a: false, b: false },
      updatedAt: serverTimestamp()
    });
  });
}

async function pushMedia(code, seat, media) {
  await updateDoc(roomRef(code), {
    [`media.${SEAT_KEYS[seat]}`]: media,
    updatedAt: serverTimestamp()
  });
}

/* ------------------------------ chat ------------------------------ */
const CHAT_MAX = 400;
const CHAT_KEEP = 50;

/**
 * Append a message (or a floating reaction) to the room's chat.
 * Kept inside the room document so it needs no extra rules, and capped so
 * the document never grows without bound.
 */
async function sendChat(code, seat, text, kind = 'msg') {
  const body = String(text || '').replace(/\s+/g, ' ').trim().slice(0, CHAT_MAX);
  if (!body) return;
  const entry = {
    id: newCode(10),
    seat,
    name: me().name.slice(0, 40),
    text: body,
    kind: kind === 'react' ? 'react' : 'msg',
    at: Date.now()
  };
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(roomRef(code));
    if (!snap.exists()) throw new Error('The game was closed.');
    const chat = Array.isArray(snap.data().chat) ? snap.data().chat : [];
    tx.update(roomRef(code), { chat: [...chat, entry].slice(-CHAT_KEEP), updatedAt: serverTimestamp() });
  });
}

/* ------------------------------ leaving ------------------------------ */
async function wipeSignals(code) {
  for (const seat of [0, 1]) {
    try {
      const snap = await getDocs(iceRef(code, seat));
      await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
    } catch {
      /* best effort — the room is going away anyway */
    }
  }
}

async function leaveRoom(code, seat) {
  if (!code) return;
  try {
    if (seat === 0) {
      await wipeSignals(code);
      await deleteDoc(roomRef(code));
    } else {
      await updateDoc(roomRef(code), {
        guestUid: null,
        guestTab: null,
        guestJoin: null,
        guest: null,
        offer: null,
        answer: null,
        'media.b': { cam: false, mic: false },
        'rematch.b': false,
        updatedAt: serverTimestamp()
      });
    }
  } catch (err) {
    console.warn('[arcade] leave', err);
  }
}
return Object.freeze({ SEAT_KEYS, newCode, roomRef, iceRef, inviteLink, createRoom, joinRoom, watchRoom, pushState, pushRematch, restart, pushMedia, CHAT_MAX, sendChat, leaveRoom });
  })();

  /* ===== js/arcade/rtc.js ===== */
  const __m42 = (function () {
const { updateDoc, onSnapshot, addDoc, getDocs, deleteDoc } = __m7;
const { roomRef, iceRef, newCode } = __m41;
const { RTC } = __m4;
/**
 * LifeFlow Arcade — the video call.
 *
 * A small WebRTC helper that uses the room document as its signalling channel.
 * The connection is opened as soon as both players are seated, with the audio
 * and video lanes reserved but empty; turning the camera or microphone on later
 * simply drops a track into the lane it already has, so there is no
 * renegotiation and no pause in the game.
 *
 * Every negotiation is a numbered "session" (`sid`). Offers, answers and ICE
 * candidates carry it, so a reload, a rejoin or a reconnect never mixes up
 * signals from an older connection. Candidates that arrive before the
 * description they belong to are queued instead of dropped.
 */




const STUN = { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] };

function iceConfig() {
  const extra = Array.isArray(RTC?.iceServers) ? RTC.iceServers.filter((s) => s && s.urls) : [];
  return { iceServers: [STUN, ...extra], iceCandidatePoolSize: 2 };
}

/** Plain, Firestore-safe copy of a candidate. */
function packCandidate(c, sid) {
  return {
    candidate: c.candidate || '',
    sdpMid: c.sdpMid ?? null,
    sdpMLineIndex: c.sdpMLineIndex ?? null,
    usernameFragment: c.usernameFragment ?? null,
    sid
  };
}

function unpackCandidate(d) {
  const init = { candidate: d.candidate || '' };
  if (d.sdpMid != null) init.sdpMid = d.sdpMid;
  if (d.sdpMLineIndex != null) init.sdpMLineIndex = d.sdpMLineIndex;
  if (d.usernameFragment) init.usernameFragment = d.usernameFragment;
  return init;
}

const AUTO_RETRIES = 3;

const canCall = () =>
  typeof RTCPeerConnection !== 'undefined' &&
  Boolean(navigator.mediaDevices?.getUserMedia) &&
  (location.protocol === 'https:' || location.protocol === 'file:' || ['localhost', '127.0.0.1'].includes(location.hostname));

function createCall({ code, seat, onRemote, onLocal, onStatus, onError }) {
  const host = seat === 0;
  const remote = new MediaStream();
  const tx = { audio: null, video: null };
  const unsubs = [];

  let pc = null;
  let sid = '';
  let local = null;
  let started = false;
  let closed = false;
  let cam = false;
  let mic = false;
  let pending = []; // remote candidates waiting for their description: { sid, init }
  let seenAnswer = '';
  let lastKick; // undefined until the first room snapshot
  let lastNegotiation = 0;
  let retries = 0;
  let watchdog = null;
  let recoveryTimer = null;
  const acquiring = { audio: null, video: null };
  const wanted = { audio: false, video: false };
  const deviceVersion = { audio: 0, video: 0 };
  const senderWork = new WeakMap();

  const status = (s) => { if (!closed || s === 'closed') onStatus?.(s); };
  const current = (conn, mySid) => !closed && conn && pc === conn && sid === mySid &&
    conn.signalingState !== 'closed' && conn.connectionState !== 'closed';

  function fail(context, err) {
    console.warn('[arcade]', context, err);
    if (closed) return;
    status('failed');
    onError?.(err);
  }

  function attachRemote(track) {
    if (closed || remote.getTracks().includes(track)) return;
    remote.addTrack(track);
    track.addEventListener('ended', () => {
      if (closed || !remote.getTracks().includes(track)) return;
      try { remote.removeTrack(track); } catch { /* already gone */ }
      onRemote?.(remote);
    });
    onRemote?.(remote);
  }

  function clearRemote() {
    remote.getTracks().forEach((t) => { try { remote.removeTrack(t); } catch { /* noop */ } });
  }

  function clearWatchdog() {
    if (watchdog) clearTimeout(watchdog);
    watchdog = null;
  }

  function clearRecovery() {
    if (recoveryTimer) clearTimeout(recoveryTimer);
    recoveryTimer = null;
  }

  /** Ask for a fresh connection: the host renegotiates, the guest nudges the host. */
  function recover(reason) {
    if (closed) return;
    if (host) {
      const delay = 3000 - (Date.now() - lastNegotiation);
      if (delay > 0) {
        if (!recoveryTimer) recoveryTimer = setTimeout(() => {
          recoveryTimer = null;
          recover(reason);
        }, delay);
        return;
      }
      return negotiate();
    } else {
      return updateDoc(roomRef(code), { rtcKick: newCode(8) })
        .catch((err) => fail('reconnect request', err));
    }
  }

  function scheduleRecovery(conn, delay, reason) {
    const mySid = sid;
    if (!current(conn, mySid)) return;
    clearWatchdog();
    if (retries >= AUTO_RETRIES) return;
    watchdog = setTimeout(() => {
      watchdog = null;
      if (!current(conn, mySid) || conn.connectionState === 'connected') return;
      retries += 1;
      recover(reason);
    }, delay);
  }

  function buildPc() {
    if (closed) return null;
    clearWatchdog();
    if (pc) { try { pc.close(); } catch { /* noop */ } }
    clearRemote();
    tx.audio = null;
    tx.video = null;

    const conn = new RTCPeerConnection(iceConfig());
    const mySid = sid;
    pc = conn;

    conn.addEventListener('track', (ev) => {
      if (!current(conn, mySid)) return;
      if (ev.track) attachRemote(ev.track);
    });

    conn.addEventListener('icecandidate', (ev) => {
      if (!ev.candidate || !current(conn, mySid)) return;
      addDoc(iceRef(code, seat), packCandidate(ev.candidate, mySid))
        .catch((err) => console.warn('[arcade] publish candidate', err));
    });

    conn.addEventListener('connectionstatechange', () => {
      if (!current(conn, mySid)) return;
      const st = conn.connectionState;
      status(st === 'new' ? 'connecting' : st);
      if (st === 'connected') { retries = 0; clearWatchdog(); }
      else if (st === 'failed') scheduleRecovery(conn, host ? 600 : 2500, 'failed');
      else if (st === 'disconnected') scheduleRecovery(conn, 7000, 'disconnected');
    });

    // Never connected at all — try a fresh negotiation once in a while.
    scheduleRecovery(conn, 25000, 'timeout');
    onRemote?.(remote);
    status('connecting');
    return conn;
  }

  async function addRemoteCandidate(init, conn = pc, mySid = sid) {
    if (!current(conn, mySid)) return;
    try {
      await conn.addIceCandidate(new RTCIceCandidate(init));
      if (!current(conn, mySid)) return;
    } catch (err) { console.warn('[arcade] remote candidate', err); }
  }

  /** Feed any queued candidates that belong to the current session. */
  async function drain(conn = pc, mySid = sid) {
    if (!current(conn, mySid) || !conn.remoteDescription) return;
    const mine = pending.filter((p) => p.sid === mySid);
    pending = pending.filter((p) => p.sid !== mySid);
    for (const p of mine) {
      if (!current(conn, mySid)) return;
      await addRemoteCandidate(p.init, conn, mySid);
      if (!current(conn, mySid)) return;
    }
  }

  /** Order replacements on each reserved lane, including concurrent device toggles. */
  async function replaceSender(conn, mySid, sender, kind, track) {
    const previous = senderWork.get(sender);
    const work = (async () => {
      // A previous caller reports its own error; it must not block later replacements.
      if (previous) await previous.catch(() => {});
      if (!current(conn, mySid)) return;
      if (track && (track.readyState !== 'live' || !local?.getTracks().includes(track))) return;
      if (!track && local?.getTracks().some((t) => t.kind === kind && t.readyState === 'live')) return;
      if (sender.track !== track) {
        await sender.replaceTrack(track);
        if (!current(conn, mySid)) return;
      }
    })();
    senderWork.set(sender, work);
    try { await work; }
    finally { if (senderWork.get(sender) === work) senderWork.delete(sender); }
  }

  /** Push any tracks we already hold into the freshly negotiated senders. */
  async function flushSenders(conn = pc, mySid = sid) {
    if (!current(conn, mySid) || !local) return;
    const senders = { audio: tx.audio?.sender, video: tx.video?.sender };
    for (const track of local.getTracks()) {
      if (!current(conn, mySid)) return;
      const sender = senders[track.kind];
      if (sender) {
        await replaceSender(conn, mySid, sender, track.kind, track);
        if (!current(conn, mySid)) return;
      }
    }
  }

  async function start() {
    if (started || closed || !canCall()) return;
    started = true;
    status('connecting');

    // The other side's candidates — queued until their description is in place.
    unsubs.push(
      onSnapshot(
        iceRef(code, host ? 1 : 0),
        (snap) => {
          if (closed) return;
          snap.docChanges().forEach((change) => {
            if (change.type !== 'added') return;
            const d = change.doc.data();
            if (!d?.sid || !d.candidate) return; // stale signals from an older version
            const init = unpackCandidate(d);
            if (pc && d.sid === sid && pc.remoteDescription) addRemoteCandidate(init);
            else if (!host || d.sid === sid) pending.push({ sid: d.sid, init });
          });
          if (pending.length > 300) pending = pending.slice(-300);
        },
        (err) => fail('ice subscription', err)
      )
    );

    // Offers, answers and reconnect requests travel on the room document.
    unsubs.push(onSnapshot(roomRef(code), (snap) => onRoom(snap.data()), (err) => fail('signal subscription', err)));

    if (host) await negotiate();
    else await recover('guest start'); // A reload cannot reuse the host's already-answered offer.
  }

  function onRoom(data) {
    if (!data || closed) return;

    if (host) {
      const a = data.answer;
      if (a?.sdp && a.sid === sid && a.sdp !== seenAnswer && pc?.signalingState === 'have-local-offer') {
        seenAnswer = a.sdp;
        const conn = pc;
        const mySid = sid;
        conn.setRemoteDescription({ type: 'answer', sdp: a.sdp })
          .then(() => { if (current(conn, mySid)) return drain(conn, mySid); })
          .catch((err) => {
            if (!current(conn, mySid)) return;
            seenAnswer = '';
            fail('answer', err);
          });
      }
      // The guest pressed "Reconnect" (or its side gave up).
      const kick = data.rtcKick || '';
      if (lastKick === undefined) lastKick = kick;
      else if (kick !== lastKick) {
        lastKick = kick;
        recover('kick');
      }
      return;
    }

    const o = data.offer;
    if (o?.sdp && o.sid && o.sid !== sid) answerOffer(o);
  }

  /** Host: a brand-new connection, reusing whatever camera/mic is already on. */
  async function negotiate() {
    if (!host || closed) return;
    clearRecovery();
    lastNegotiation = Date.now();
    sid = newCode(10);
    const mySid = sid;
    seenAnswer = '';
    pending = [];

    let conn;
    try {
      conn = buildPc();
      if (!current(conn, mySid)) return;
      // Reserve both lanes up front so tracks can be swapped in later.
      tx.audio = conn.addTransceiver('audio', { direction: 'sendrecv' });
      tx.video = conn.addTransceiver('video', { direction: 'sendrecv' });
      await flushSenders(conn, mySid);
      if (!current(conn, mySid)) return;

      const desc = await conn.createOffer();
      if (!current(conn, mySid)) return;
      await conn.setLocalDescription(desc);
      if (!current(conn, mySid)) return;
      await updateDoc(roomRef(code), { offer: { type: desc.type, sdp: desc.sdp, sid: mySid }, answer: null });
      if (!current(conn, mySid)) return;
      sweep(conn, mySid);
    } catch (err) {
      if (current(conn, mySid) || (!conn && !closed && sid === mySid)) fail('offer negotiation', err);
      else console.warn('[arcade] stale offer negotiation', err);
    }
  }

  /** Guest: answer the host's latest offer on a fresh connection. */
  async function answerOffer(o) {
    if (closed) return;
    sid = o.sid;
    const mySid = sid;
    pending = pending.filter((p) => p.sid === mySid);

    let conn;
    try {
      conn = buildPc();
      if (!current(conn, mySid)) return;
      await conn.setRemoteDescription({ type: 'offer', sdp: o.sdp });
      if (!current(conn, mySid)) return;
      conn.getTransceivers().forEach((t) => { t.direction = 'sendrecv'; });
      tx.audio = conn.getTransceivers().find((t) => t.receiver?.track?.kind === 'audio') || null;
      tx.video = conn.getTransceivers().find((t) => t.receiver?.track?.kind === 'video') || null;
      await flushSenders(conn, mySid);
      if (!current(conn, mySid)) return;
      await drain(conn, mySid);
      if (!current(conn, mySid)) return;

      const desc = await conn.createAnswer();
      if (!current(conn, mySid)) return;
      await conn.setLocalDescription(desc);
      if (!current(conn, mySid)) return;
      await updateDoc(roomRef(code), { answer: { type: desc.type, sdp: desc.sdp, sid: mySid } });
      if (!current(conn, mySid)) return;
    } catch (err) {
      if (current(conn, mySid) || (!conn && !closed && sid === mySid)) fail('answer negotiation', err);
      else console.warn('[arcade] stale answer negotiation', err);
    }
  }

  /** Best effort: clear candidates left over from older sessions. */
  async function sweep(conn, keepSid) {
    for (const lane of [0, 1]) {
      if (!current(conn, keepSid)) return;
      try {
        const snap = await getDocs(iceRef(code, lane));
        if (!current(conn, keepSid)) return;
        await Promise.all(snap.docs.filter((d) => d.data()?.sid !== keepSid).map((d) => deleteDoc(d.ref)));
        if (!current(conn, keepSid)) return;
      } catch (err) { console.warn('[arcade] candidate cleanup', err); }
    }
  }

  /** Manual "Reconnect" — resets the retry budget too. */
  function reconnect() {
    retries = 0;
    lastNegotiation = 0;
    recover('manual');
  }

  /* ------------------------------ devices ------------------------------ */
  function acquire(kind) {
    if (closed || !wanted[kind]) return Promise.resolve(null);
    if (acquiring[kind]) return acquiring[kind];
    const existing = local?.getTracks().find((t) => t.kind === kind && t.readyState === 'live');
    if (existing) return Promise.resolve(existing);

    const constraints =
      kind === 'video'
        ? { video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' } }
        : { audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } };

    const work = (async () => {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      // Permission prompts may resolve after an off toggle or after the call is gone.
      if (closed || !wanted[kind]) {
        stream.getTracks().forEach((t) => t.stop());
        return null;
      }
      const track = stream.getTracks().find((t) => t.kind === kind && t.readyState === 'live');
      stream.getTracks().forEach((t) => { if (t !== track) t.stop(); });
      if (!track) throw new Error(`No live ${kind} track was provided.`);
      if (!local) local = new MediaStream();
      local.getTracks().filter((t) => t.kind === kind).forEach((t) => {
        t.stop();
        local.removeTrack(t);
      });
      local.addTrack(track);

      const conn = pc;
      const mySid = sid;
      const sender = tx[kind]?.sender;
      try {
        if (sender) await replaceSender(conn, mySid, sender, kind, track);
      } catch (err) {
        if (current(conn, mySid)) {
          track.stop();
          local?.removeTrack(track);
          onLocal?.(local);
          throw err;
        }
        console.warn('[arcade] stale device sender', err);
      }
      if (closed || !local?.getTracks().includes(track) || track.readyState !== 'live') return null;
      onLocal?.(local);
      return track;
    })();
    acquiring[kind] = work.catch((err) => {
      if (closed || !wanted[kind]) return null;
      throw err;
    }).finally(() => { acquiring[kind] = null; });
    return acquiring[kind];
  }

  function drop(kind) {
    local?.getTracks().filter((t) => t.kind === kind).forEach((track) => {
      track.stop();
      local.removeTrack(track);
    });
    const conn = pc;
    const mySid = sid;
    const sender = tx[kind]?.sender;
    if (sender) replaceSender(conn, mySid, sender, kind, null).catch((err) => {
      if (current(conn, mySid)) fail('detach device', err);
    });
    if (!closed) onLocal?.(local);
  }

  /** Camera off releases the device outright, so the little light goes out too. */
  async function setCam(on) {
    if (closed) return false;
    wanted.video = Boolean(on);
    const version = ++deviceVersion.video;
    if (on) {
      let track = await acquire('video');
      if (closed || version !== deviceVersion.video) return cam;
      // An off/on pair may have shared an acquisition whose track was already dropped.
      if (!track) {
        track = await acquire('video');
        if (closed || version !== deviceVersion.video) return cam;
      }
      cam = Boolean(track && track.readyState === 'live');
    } else {
      cam = false;
      drop('video');
    }
    return cam;
  }

  /** Mute is instant — the track stays open so unmuting never stutters. */
  async function setMic(on) {
    if (closed) return false;
    wanted.audio = Boolean(on);
    const version = ++deviceVersion.audio;
    if (on) {
      let track = await acquire('audio');
      if (closed || version !== deviceVersion.audio) return mic;
      if (!track) {
        track = await acquire('audio');
        if (closed || version !== deviceVersion.audio) return mic;
      }
      if (!track || track.readyState !== 'live') return mic;
      track.enabled = true;
      mic = true;
    } else {
      local?.getAudioTracks().forEach((track) => { track.enabled = false; });
      mic = false;
    }
    return mic;
  }

  function close() {
    if (closed) return;
    closed = true;
    clearWatchdog();
    clearRecovery();
    wanted.audio = wanted.video = false;
    deviceVersion.audio += 1;
    deviceVersion.video += 1;
    cam = mic = false;
    unsubs.forEach((u) => { try { u(); } catch { /* already off */ } });
    unsubs.length = 0;
    local?.getTracks().forEach((t) => t.stop());
    clearRemote();
    local = null;
    try { pc?.close(); } catch { /* noop */ }
    pc = null;
    tx.audio = tx.video = null;
    pending = [];
    onLocal?.(null);
    onRemote?.(remote);
    status('closed');
  }

  return {
    start,
    close,
    setCam,
    setMic,
    reconnect,
    get cam() { return cam; },
    get mic() { return mic; },
    get localStream() { return local; },
    get remoteStream() { return remote; }
  };
}
return Object.freeze({ canCall, createCall });
  })();

  /* ===== js/views/games.js ===== */
  const __m40 = (function () {
const { esc, haptic, initials } = __m1;
const { icon } = __m3;
const { toast, modal, confetti } = __m2;
const store = __m8;
const { navigate, currentQuery } = __m6;
const { GAMES, gameById } = __m19;
const rooms = __m41;
const { createCall, canCall } = __m42;
/**
 * LifeFlow — Games.
 * A small arcade: play the computer, or send someone a link and play them
 * face to face, with the camera and microphone under your thumb.
 */









const meta = { title: 'Games', icon: 'gamepad', label: 'Games' };

/* =========================================================
   Session
   ========================================================= */
let session = null;
let rootEl = null;
let lastQuery = '';
const levels = {}; // remembered difficulty per game

/* Per-game settings, remembered on this device. */
const SETTINGS_KEY = 'lf:game-settings';
let chosen = loadSettings();

function loadSettings() {
  try {
    const v = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

/** The saved choices for a game, each checked against the options it offers. */
function settingsFor(game) {
  const saved = chosen[game.meta.id];
  const out = {};
  for (const opt of game.meta.settings || []) {
    const v = saved && typeof saved === 'object' ? saved[opt.id] : undefined;
    out[opt.id] = opt.options.some((o) => o.v === v) ? v : opt.def;
  }
  return out;
}

function saveSettings(gameId, values) {
  chosen = { ...chosen, [gameId]: values };
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(chosen)); } catch { /* private mode */ }
}

const q = (sel) => rootEl?.querySelector(sel);
const myName = () =>
  store.state.profile?.name || store.state.user?.displayName || (store.state.user?.email || 'You').split('@')[0];

function clearTimers() {
  session?.timers?.forEach((t) => clearTimeout(t));
  if (session) session.timers = [];
}

function teardown({ leaveTable = true } = {}) {
  const s = session;
  session = null;
  if (!s) return;
  s.timers?.forEach((t) => clearTimeout(t));
  try { s.unsub?.(); } catch { /* already off */ }
  try { s.call?.close(); } catch { /* already closed */ }
  if (leaveTable && s.mode === 'remote' && s.code) rooms.leaveRoom(s.code, s.seat);
}

/** Called by the shell when the player navigates away. */
function unmount() {
  teardown();
  lastQuery = '';
  if (rootEl) delete rootEl.dataset.arcade;
}

/* =========================================================
   Render
   ========================================================= */
function render(root) {
  rootEl = root;
  readQuery();

  const key = session ? session.key : 'lobby';
  // The shell repaints on every data change; a live table must survive that.
  if (root.dataset.arcade === key && root.querySelector('[data-arcade-root]')) return;

  root.dataset.arcade = key;
  root.innerHTML = session ? tableHtml() : lobbyHtml();
  if (session) wireTable();
  else wireLobby();
}

function repaint() {
  if (!rootEl) return;
  delete rootEl.dataset.arcade;
  render(rootEl);
}

/** `#/games?room=CODE` joins a friend, `#/games?play=id` opens a game. */
function readQuery() {
  const params = currentQuery();
  const stamp = `${params.room || ''}|${params.play || ''}`;
  if (!stamp || stamp === '|' || stamp === lastQuery) return;
  // Signed-in state may still be arriving — try again on the next paint.
  if (params.room && !store.state.uid) return;
  lastQuery = stamp;
  if (params.room) joinByCode(params.room);
  else if (params.play && gameById(params.play)) startSolo(params.play);
}

/* =========================================================
   Lobby
   ========================================================= */
const SHELVES = [
  { id: 'all', label: 'All', emoji: '✨' },
  { id: 'couple', label: 'Couples', emoji: '💞' },
  { id: 'friends', label: 'Friends & party', emoji: '🎉' },
  { id: 'board', label: 'Board', emoji: '🎲' },
  { id: 'cards', label: 'Cards', emoji: '🃏' },
  { id: 'brain', label: 'Quiz & brain', emoji: '🧠' }
];
let shelf = 'all';

const onShelf = (g) => shelf === 'all' || (g.meta.group || []).includes(shelf);

function lobbyHtml() {
  return `
    <div class="page arcade-lobby" data-arcade-root>
      <section class="card arcade-hero">
        <div class="grow">
          <span class="eyebrow">Play together</span>
          <h2>Games</h2>
          <p class="fs-sm t-dim">Couples, friends, cards, board games and quizzes. Play the house, pass the phone around, or invite someone online — with chat, voice and video.</p>
        </div>
        <span class="arcade-hero__art" aria-hidden="true">
          <i>🎭</i><i>💞</i><i>🧠</i><i>🪿</i><i>♠️</i>
        </span>
      </section>

      <nav class="arcade-shelves" role="tablist" aria-label="Game types">
        ${SHELVES.map(
          (sh) => `<button class="arcade-shelf" role="tab" type="button" data-shelf="${sh.id}" aria-selected="${sh.id === shelf}">
                     <span aria-hidden="true">${sh.emoji}</span> ${esc(sh.label)}
                     <b>${sh.id === 'all' ? GAMES.length : GAMES.filter((g) => (g.meta.group || []).includes(sh.id)).length}</b>
                   </button>`
        ).join('')}
      </nav>

      <div class="arcade-grid" data-grid>
        ${GAMES.map((g, i) => gameCard(g, i)).join('')}
      </div>

      <section class="card arcade-join">
        <div class="grow">
          <h3 class="card__title">${icon('link')} Got a code?</h3>
          <p class="fs-sm t-dim">Paste the code a friend sent you and you will be dropped straight into their game.</p>
        </div>
        <form class="arcade-join__form" data-join-form>
          <input class="input" name="code" placeholder="e.g. K7NQ4RTM" autocomplete="off"
                 spellcheck="false" maxlength="12" aria-label="Game code" />
          <button class="btn btn--primary" type="submit">Join</button>
        </form>
      </section>
    </div>`;
}

function gameCard(game, i) {
  const m = game.meta;
  const level = levels[m.id] || 'even';
  return `
    <article class="gcard${m.local ? ' gcard--social' : ''}" style="--i:${i}" data-game="${m.id}"${onShelf(game) ? '' : ' hidden'}>
      <div class="gcard__art gcard__art--${m.id}">
        <span class="gcard__glow"></span>
        <span class="gcard__emoji">${m.emoji}</span>
      </div>
      <div class="gcard__body">
        <h2 class="gcard__title">${esc(m.title)}</h2>
        <p class="gcard__tag">${esc(m.tagline)}</p>
        <p class="gcard__blurb">${esc(m.blurb)}</p>
        <div class="gcard__chips">
          <span class="chip">${icon('clock')} ${esc(m.minutes)}</span>
          ${m.tags.map((t) => `<span class="chip">${esc(t)}</span>`).join('')}
        </div>
        ${m.levels.length ? `
        <div class="segmented segmented--tiny" role="tablist" aria-label="Difficulty">
          ${m.levels
            .map(
              (l) =>
                `<button role="tab" type="button" aria-selected="${l.id === level}"
                         data-level="${l.id}" data-for="${m.id}" title="${esc(l.hint)}">${esc(l.label)}</button>`
            )
            .join('')}
        </div>` : ''}
        <div class="gcard__actions">
          ${m.local
            ? `<button class="btn btn--primary" type="button" data-solo="${m.id}">${icon('users')} Play here together</button>`
            : `<button class="btn btn--primary" type="button" data-solo="${m.id}">${icon('bot')} Play the computer</button>`}
          <button class="btn btn--ghost" type="button" data-invite="${m.id}">${icon('link')} Play online</button>
          ${m.settings?.length ? `<button class="iconbtn gcard__cog" type="button" data-settings="${m.id}" aria-label="${esc(m.title)} settings" title="Settings">${icon('settings')}</button>` : ''}
        </div>
      </div>
    </article>`;
}

function wireLobby() {
  rootEl.querySelectorAll('[data-shelf]').forEach((b) =>
    b.addEventListener('click', () => {
      shelf = b.dataset.shelf;
      rootEl.querySelectorAll('[data-shelf]').forEach((s) => s.setAttribute('aria-selected', String(s === b)));
      let n = 0;
      rootEl.querySelectorAll('.gcard').forEach((card) => {
        const show = onShelf(gameById(card.dataset.game));
        card.hidden = !show;
        if (show) {
          card.style.setProperty('--i', String(n++));
          card.classList.remove('is-shuffled');
          void card.offsetWidth;
          card.classList.add('is-shuffled');
        }
      });
      haptic();
    })
  );

  rootEl.querySelectorAll('[data-level]').forEach((b) =>
    b.addEventListener('click', () => {
      levels[b.dataset.for] = b.dataset.level;
      b.parentElement.querySelectorAll('button').forEach((s) => s.setAttribute('aria-selected', String(s === b)));
      haptic();
    })
  );

  rootEl.querySelectorAll('[data-solo]').forEach((b) =>
    b.addEventListener('click', () => startSolo(b.dataset.solo))
  );

  rootEl.querySelectorAll('[data-invite]').forEach((b) =>
    b.addEventListener('click', () => host(b.dataset.invite, b))
  );

  rootEl.querySelectorAll('[data-settings]').forEach((b) =>
    b.addEventListener('click', () => {
      const game = gameById(b.dataset.settings);
      if (game) showSettings(game, false);
    })
  );

  const form = q('[data-join-form]');
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const code = form.code.value.trim().toUpperCase();
    if (code) joinByCode(code);
  });
}

/* =========================================================
   Starting a game
   ========================================================= */
function startSolo(gameId) {
  const game = gameById(gameId);
  if (!game) return;
  teardown();

  session = {
    key: `solo:${gameId}:${Date.now()}`,
    game,
    mode: 'solo',
    level: levels[gameId] || 'even',
    seat: 0,
    round: 0,
    names: [myName(), game.meta.local ? partnerName : computerName(game, levels[gameId] || 'even')],
    state: game.create(settingsFor(game)),
    timers: []
  };
  repaint();
  tick();
}

let partnerName = 'Player 2';

function computerName(game, level) {
  const l = game.meta.levels.find((x) => x.id === level);
  return l ? `${l.label} bot` : 'The computer';
}

async function host(gameId, button) {
  const game = gameById(gameId);
  if (!game) return;
  if (!store.state.uid) { toast('Sign in first so your friend can find you.', 'error'); return; }

  button?.classList.add('is-loading');
  try {
    const level = levels[gameId] || 'even';
    const state = game.create(settingsFor(game));
    const code = await rooms.createRoom({ gameId, level, state });
    openRoom({ code, game, seat: 0, state, level });
    showInvite(code, true);
  } catch (err) {
    console.warn('[arcade] host', err);
    toast(roomError(err, 'Could not open the room.'), 'error', 6000);
  } finally {
    button?.classList.remove('is-loading');
  }
}

async function joinByCode(rawCode) {
  const code = String(rawCode).trim().toUpperCase();
  if (session?.code === code) return;
  if (!store.state.uid) { toast('Sign in to join the game.', 'error'); return; }

  try {
    const { seat, data } = await rooms.joinRoom(code);
    const game = gameById(data.gameId);
    if (!game) throw new Error('That game is not available in this version.');
    openRoom({ code, game, seat, state: data.state, level: data.level, room: data });
    toast(seat === 1 ? 'You are in — good luck.' : 'Back at your table.', 'success');
  } catch (err) {
    console.warn('[arcade] join', err);
    toast(roomError(err, 'Could not join that game.'), 'error', 6000);
    navigate('/games', { replace: true });
  }
}

/** Turn Firestore failures into something a player can act on. */
function roomError(err, fallback) {
  if (err?.code === 'permission-denied') {
    return 'Online play is blocked by the database rules. Publish firestore.rules (firebase deploy --only firestore:rules).';
  }
  if (err?.code === 'unavailable') return 'You seem to be offline. Check the connection and try again.';
  return err?.message || fallback;
}

function openRoom({ code, game, seat, state, level, room }) {
  teardown();

  session = {
    key: `room:${code}:${seat}`,
    game,
    mode: 'remote',
    level: level || 'even',
    seat,
    code,
    round: 0,
    seq: room?.seq || 0,
    names: [room?.host?.name || myName(), room?.guest?.name || ''],
    state,
    room: room || null,
    media: { cam: false, mic: false },
    peerMedia: { cam: false, mic: false },
    status: 'waiting',
    timers: []
  };

  // A reload must not delete the host's room or evict the returning guest.
  // Only an explicit leave/navigation releases the seat.
  history.replaceState(null, '', `#/games?room=${encodeURIComponent(code)}`);
  lastQuery = `${code}|`;
  session.unsub = rooms.watchRoom(code, onRoomChange, onRoomGone);
  repaint();
}

/* =========================================================
   Remote sync
   ========================================================= */
function onRoomChange(data) {
  const s = session;
  if (!s || s.mode !== 'remote') return;

  const wasSeated = Boolean(s.room?.guestUid);
  s.room = data;
  s.names = [data.host?.name || 'Host', data.guest?.name || ''];
  s.peerMedia = data.media?.[rooms.SEAT_KEYS[1 - s.seat]] || { cam: false, mic: false };

  const seatingChanged = wasSeated !== Boolean(data.guestUid);
  if ((data.seq || 0) !== s.seq || seatingChanged) {
    s.seq = data.seq || 0;
    s.round = data.round || 0;
    s.state = data.state;
    clearTimers();
    paintBoard();
    tick();
  }

  paintRail();
  paintStatus();
  syncDock();
  paintChat(data.chat || []);

  // Both seated: open the line. A new arrival (or a rejoin after a reload)
  // gets a brand-new connection from the host.
  const join = data.guestUid ? data.guestJoin || data.guestUid : '';
  if (join) {
    if (!s.call) startCall();
    else if (s.seat === 0 && join !== s.joinSeen) s.call.reconnect();
    s.joinSeen = join;
  } else if (s.call) {
    s.call.close();
    s.call = null;
    s.media = { cam: false, mic: false };
    s.peerMedia = { cam: false, mic: false };
    s.joinSeen = '';
    s.status = 'waiting';
    rooms.pushMedia(s.code, s.seat, s.media).catch(() => {});
    syncDock();
  }

  if (data.guestUid && !wasSeated && s.seat === 0) toast(`${data.guest?.name || 'Your friend'} joined.`, 'success');
  if (!data.guestUid && wasSeated && s.seat === 0) toast('Your friend stepped away.', 'info');

  // Rematch handshake — the host deals the new game.
  const rm = data.rematch || {};
  if (rm.a && rm.b && s.seat === 0 && !s.dealing) {
    const round = (data.round || 0) + 1;
    s.dealing = true;
    rooms
      .restart(s.code, freshState(s.game, round, s.state), (data.seq || 0) + 1, round)
      .catch(() => {})
      .finally(() => { if (session === s) s.dealing = false; });
  }
}

function onRoomGone(err) {
  if (!session || session.mode !== 'remote') return;
  toast(err ? roomError(err, 'Lost the connection to the game.') : 'The game was closed.', err ? 'error' : 'info', err ? 6000 : 3000);
  teardown({ leaveTable: false });
  lastQuery = '';
  navigate('/games', { replace: true });
  repaint();
}

/* =========================================================
   Game loop
   ========================================================= */
function bothSeated() {
  return session.mode === 'solo' || Boolean(session.room?.guestUid);
}

/** Social games played by passing one device around — whoever's turn it is holds it. */
function isLocal() {
  return session?.mode === 'solo' && Boolean(session.game.meta.local);
}

function context() {
  const s = session;
  const out = s.game.outcome(s.state);
  const local = isLocal();
  return {
    seat: local ? s.game.turn(s.state) : s.seat,
    myTurn: !s.saving && !out.over && bothSeated() && (local || s.game.turn(s.state) === s.seat),
    local,
    over: out.over,
    names: s.names,
    mode: s.mode,
    level: s.level,
    sessionKey: s.key,
    refresh: paintBoard
  };
}

function play(move) {
  const s = session;
  if (!s || s.game.outcome(s.state).over) return;
  if (!bothSeated() || (!isLocal() && s.game.turn(s.state) !== s.seat)) return;
  haptic();
  commit(move);
}

async function commit(move) {
  const s = session;
  if (!s || s.saving) return;
  const next = s.game.apply(s.state, move);
  if (!next) return;

  const out = s.game.outcome(next);
  if (s.mode === 'remote') {
    s.saving = true;
    clearTimers();
    paintBoard();
    try {
      // Let the room snapshot publish the authoritative state. A rejected
      // write must never leave an optimistic board stranded on one device.
      await rooms.pushState(s.code, { state: next, outcome: out.over ? out : null, seq: s.seq + 1 });
    } catch (err) {
      if (session === s) toast(roomError(err, 'That move did not reach your friend.'), 'error');
    } finally {
      s.saving = false;
      if (session === s) { paintBoard(); paintStatus(); tick(); }
    }
    return;
  }

  s.state = next;
  s.seq = (s.seq || 0) + 1;

  paintBoard();
  paintRail();
  paintStatus();

  tick();
}

/** Decide what happens next: a forced follow-up, the computer, or nothing. */
function tick() {
  const s = session;
  if (!s) return;
  clearTimers();

  const out = s.game.outcome(s.state);
  if (out.over) { finish(out); return; }
  if (!bothSeated() || s.saving) return;

  const seat = s.game.turn(s.state);

  // Moves the game makes on its own — e.g. turning unmatched cards back over.
  const forced = s.game.auto?.(s.state);
  if (forced) {
    const mine = s.mode === 'solo' || seat === s.seat;
    if (mine) s.timers.push(setTimeout(() => { if (session === s) commit(forced.move); }, forced.delay || 900));
    return;
  }

  if (s.mode === 'solo' && !isLocal() && seat !== s.seat) {
    s.timers.push(
      setTimeout(() => {
        if (!session || session !== s) return;
        const move = s.game.ai(s.state, seat, s.level);
        if (move) commit(move);
      }, 420 + Math.random() * 520 + (s.game.pace?.(s.state) || 0))
    );
  }
}

function finish(out) {
  const s = session;
  if (!s || s.finishedAt === s.seq) return;
  s.finishedAt = s.seq;

  paintBoard();
  paintStatus();
  paintRail();

  if (out.celebrate || (out.winner === s.seat && !isLocal()) || (isLocal() && out.winner != null)) {
    confetti(30);
    haptic();
  }
}

/** A new game with the saved settings, keeping the decks the players picked last time. */
function freshState(game, round, prev) {
  const opts = settingsFor(game);
  if (Array.isArray(prev?.cats)) opts.cats = prev.cats;
  const st = game.create(opts);
  if (game.meta.alternate !== false) st.turn = round % 2;
  return st;
}

function newRound() {
  const s = session;
  if (!s) return;
  if (s.mode === 'remote') {
    rooms.pushRematch(s.code, s.seat, true).catch(() => {});
    toast('Rematch offered.', 'info');
    return;
  }
  s.round += 1;
  s.state = freshState(s.game, s.round, s.state);
  s.seq = (s.seq || 0) + 1;
  s.finishedAt = null;
  paintBoard();
  paintRail();
  paintStatus();
  tick();
}

/* =========================================================
   Table
   ========================================================= */
function tableHtml() {
  const s = session;
  const m = s.game.meta;
  const remote = s.mode === 'remote';

  return `
    <div class="page arcade" data-arcade-root>
      <header class="arcade__head">
        <button class="iconbtn" type="button" data-exit aria-label="Leave the table">${icon('chevronLeft')}</button>
        <div class="arcade__ident">
          <span class="arcade__emoji">${m.emoji}</span>
          <div class="grow">
            <h1 class="arcade__title">${esc(m.title)}</h1>
            <p class="arcade__mode">${
              remote
                ? `${icon('users')} Playing online`
                : isLocal()
                ? `${icon('users')} On this device — pass it around`
                : `${icon('bot')} ${esc(s.names[1])}`
            }</p>
          </div>
        </div>
        <div class="arcade__tools">
          ${remote ? `<button class="btn btn--ghost btn--sm" type="button" data-share>${icon('link')} Invite</button>` : ''}
          ${m.settings?.length && (!remote || s.seat === 0) ? `<button class="iconbtn" type="button" data-table-settings aria-label="Game settings" title="Settings">${icon('settings')}</button>` : ''}
          <button class="iconbtn" type="button" data-rules aria-label="How to play">${icon('info')}</button>
        </div>
      </header>

      <div class="arcade__layout">
        <section class="arcade__stage">
          <div class="arcade-rail" data-rail>${railHtml()}</div>
          <div class="arcade-board arcade-board--${m.id}" data-board></div>
          <div class="arcade-status" data-status>${statusHtml()}</div>
        </section>

        <aside class="arcade__side">
          ${remote ? dockHtml() + chatHtml() : soloPanelHtml()}
          <section class="card arcade-rules">
            <h3 class="card__title">${icon('sparkles')} How it goes</h3>
            <ul class="arcade-rules__list">
              ${m.rules.map((r) => `<li>${esc(r)}</li>`).join('')}
            </ul>
          </section>
        </aside>
      </div>
    </div>`;
}

function railHtml() {
  const s = session;
  const out = s.game.outcome(s.state);
  const active = out.over ? -1 : s.game.turn(s.state);

  const seatCard = (seat) => {
    const name = isLocal()
      ? s.names[seat] || `Player ${seat + 1}`
      : seat === s.seat
      ? `${s.names[seat] || myName()} (you)`
      : s.names[seat] || 'Waiting…';
    const empty = s.mode === 'remote' && seat === 1 && !s.room?.guestUid;
    const won = out.over && out.winner === seat;
    return `
      <div class="pseat pseat--${seat}${active === seat ? ' is-turn' : ''}${empty ? ' is-empty' : ''}${won ? ' is-won' : ''}">
        <span class="pseat__ring"></span>
        <span class="pseat__badge">${empty ? '…' : esc(initials(name))}</span>
        <div class="pseat__meta">
          <span class="pseat__name truncate">${esc(name)}</span>
          <span class="pseat__note">${seatNote(seat, empty, active)}</span>
        </div>
      </div>`;
  };

  return `${seatCard(0)}<span class="pseat__vs">vs</span>${seatCard(1)}`;
}

function seatNote(seat, empty, active) {
  const s = session;
  if (empty) return 'Empty seat';
  const extra = s.game.note?.(s.state, seat);
  if (extra) return esc(extra);
  if (isLocal()) return active === seat ? 'Your turn' : 'Waiting';
  if (s.mode === 'solo' && seat === 1) return 'Computer';
  if (active === seat) return seat === s.seat ? 'Your move' : 'Thinking…';
  return 'Waiting';
}

function statusHtml() {
  const s = session;
  const out = s.game.outcome(s.state);
  const coach = s.game.coach?.(s.state, context()) || '';

  let line;
  let tone = '';
  if (s.mode === 'remote' && !bothSeated()) {
    line = 'Waiting for your friend to arrive…';
    tone = ' is-waiting';
  } else if (out.over) {
    tone = ' is-over';
    const custom = s.game.summary?.(s.state, context());
    line = custom
      ? esc(custom)
      : out.draw
      ? 'A draw — evenly matched.'
      : isLocal()
      ? `${esc(s.names[out.winner] || 'Someone')} wins. Nicely done.`
      : out.winner === s.seat
      ? 'You win. Nicely done.'
      : `${esc(s.names[out.winner] || 'Your rival')} takes it.`;
  } else if (isLocal()) {
    line = `${esc(s.names[s.game.turn(s.state)] || 'Next player')}, your turn.`;
  } else if (s.game.turn(s.state) === s.seat) {
    line = 'Your move.';
  } else {
    line = s.mode === 'solo' ? 'Thinking…' : `${esc(s.names[1 - s.seat] || 'Your friend')} is thinking…`;
  }

  return `
    <p class="arcade-status__line${tone}">${line}</p>
    ${coach ? `<p class="arcade-status__coach">${esc(coach)}</p>` : ''}
    <div class="arcade-status__actions">
      ${
        out.over
          ? `<button class="btn btn--primary" type="button" data-again>${icon('refresh')} ${
              s.mode === 'remote' ? 'Offer a rematch' : 'Play again'
            }</button>`
          : ''
      }
      <button class="btn btn--ghost btn--sm" type="button" data-exit>Leave the table</button>
    </div>`;
}

function soloPanelHtml() {
  const s = session;
  if (isLocal()) {
    return `
    <section class="card arcade-solo">
      <h3 class="card__title">${icon('users')} Who's with you?</h3>
      <label class="arcade-solo__name">
        <span class="fs-xs t-mute">Player 2</span>
        <input class="input" data-p2name maxlength="24" value="${esc(s.names[1])}" placeholder="Their name" autocomplete="off" />
      </label>
      <p class="fs-sm t-dim">One phone, two players — hand it over when the screen says so.</p>
      <button class="btn btn--soft btn--block" type="button" data-invite-here>${icon('link')} Play online instead</button>
    </section>`;
  }
  if (!s.game.meta.levels.length) {
    return `
    <section class="card arcade-solo">
      <h3 class="card__title">${icon('bot')} Your opponent</h3>
      <p class="fs-sm t-dim">The house plays fair — the dice decide the rest.</p>
      <button class="btn btn--soft btn--block" type="button" data-invite-here>${icon('users')} Play a friend instead</button>
    </section>`;
  }
  return `
    <section class="card arcade-solo">
      <h3 class="card__title">${icon('bot')} Your opponent</h3>
      <div class="segmented segmented--tiny" role="tablist" aria-label="Difficulty">
        ${s.game.meta.levels
          .map(
            (l) =>
              `<button role="tab" type="button" aria-selected="${l.id === s.level}"
                       data-setlevel="${l.id}">${esc(l.label)}</button>`
          )
          .join('')}
      </div>
      <p class="fs-sm t-dim" data-levelhint>${esc(s.game.meta.levels.find((l) => l.id === s.level)?.hint || '')}</p>
      <button class="btn btn--soft btn--block" type="button" data-invite-here>${icon('users')} Play a friend instead</button>
    </section>`;
}

function dockHtml() {
  const s = session;
  const supported = canCall();
  return `
    <section class="card vdock" data-dock>
      <header class="vdock__head">
        <h3 class="card__title">${icon('camera')} Voice &amp; video</h3>
        <span class="vdock__state" data-callstate>${supported ? 'Connecting…' : 'Not available here'}</span>
      </header>

      <div class="vdock__tiles">
        <div class="vdock__tile vdock__tile--remote" data-tile-remote>
          <video data-vid-remote autoplay playsinline muted></video>
          <audio data-audio-remote autoplay></audio>
          <div class="vdock__off">
            <span class="vdock__avatar">${esc(initials(s.names[1 - s.seat] || 'Friend'))}</span>
            <span class="vdock__hint">Camera off</span>
          </div>
          <span class="vdock__name">${esc(s.names[1 - s.seat] || 'Your friend')}<span class="vdock__muted" data-peer-muted>${icon('micOff')}</span></span>
        </div>
        <div class="vdock__tile vdock__tile--local" data-tile-local>
          <video data-vid-local autoplay playsinline muted></video>
          <div class="vdock__off">
            <span class="vdock__avatar">${esc(initials(myName()))}</span>
            <span class="vdock__hint">Camera off</span>
          </div>
          <span class="vdock__name">You</span>
        </div>
      </div>

      <div class="vdock__bar">
        <button class="vbtn" type="button" data-cam ${supported ? '' : 'disabled'} aria-pressed="false">
          <span class="vbtn__on">${icon('camera')}</span><span class="vbtn__off">${icon('cameraOff')}</span>
          <span class="vbtn__label">Camera</span>
        </button>
        <button class="vbtn" type="button" data-mic ${supported ? '' : 'disabled'} aria-pressed="false">
          <span class="vbtn__on">${icon('mic')}</span><span class="vbtn__off">${icon('micOff')}</span>
          <span class="vbtn__label">Mic</span>
        </button>
        <button class="vbtn" type="button" data-recall ${supported ? '' : 'disabled'} title="Reconnect voice &amp; video">
          <span class="vbtn__on">${icon('refresh')}</span><span class="vbtn__off">${icon('refresh')}</span>
          <span class="vbtn__label">Reconnect</span>
        </button>
      </div>
      <button class="btn btn--primary btn--block vdock__sound" type="button" data-sound hidden>${icon('mic')} Tap to hear your friend</button>
      <p class="vdock__note fs-xs t-mute" data-callnote>Mic alone is a voice call; add the camera for video. Switch either whenever you like — the game keeps running.</p>
    </section>`;
}

/* =========================================================
   Table talk — text chat and quick reactions
   ========================================================= */
const REACTS = ['👏', '😂', '😮', '🔥', '❤️', '🤝'];
const PHRASES = ['Good luck!', 'Nice move 👌', 'Hmm… 🤔', 'Good game!', 'Rematch?'];

function chatHtml() {
  return `
    <section class="card achat" data-chat>
      <header class="achat__head">
        <h3 class="card__title">${icon('chat')} Table talk</h3>
        <span class="achat__count fs-xs t-mute" data-chat-count></span>
      </header>
      <ol class="achat__list" data-chat-list aria-live="polite" aria-label="Messages">
        <li class="achat__empty">Say hello — messages stay at this table.</li>
      </ol>
      <div class="achat__quick" role="group" aria-label="Quick reactions">
        ${REACTS.map((e) => `<button class="achat__react" type="button" data-react="${e}" aria-label="Send ${e}">${e}</button>`).join('')}
      </div>
      <div class="achat__phrases">
        ${PHRASES.map((p) => `<button class="chip achat__phrase" type="button" data-phrase="${esc(p)}">${esc(p)}</button>`).join('')}
      </div>
      <form class="achat__form" data-chat-form autocomplete="off">
        <input class="input" name="msg" maxlength="${rooms.CHAT_MAX}" placeholder="Write a message…" aria-label="Message" />
        <button class="btn btn--primary btn--icon" type="submit" aria-label="Send">${icon('send')}</button>
      </form>
    </section>`;
}

function clock(ms) {
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Repaint the conversation and celebrate anything new from the other side. */
function paintChat(chat) {
  const s = session;
  const list = q('[data-chat-list]');
  if (!s || !list || !Array.isArray(chat)) return;

  const lastId = chat.length ? chat[chat.length - 1].id : '';
  if (lastId === s.chatLast) return;

  const firstPaint = s.chatLast === undefined;
  const seenAt = chat.findIndex((m) => m.id === s.chatLast);
  const fresh = firstPaint ? [] : chat.slice(seenAt + 1);
  s.chatLast = lastId;

  const msgs = chat.filter((m) => m.kind !== 'react');
  list.innerHTML = msgs.length
    ? msgs
        .map((m) => {
          const mine = m.seat === s.seat;
          return `
            <li class="achat__msg${mine ? ' is-mine' : ''} achat__msg--${m.seat === 1 ? 1 : 0}">
              ${mine ? '' : `<span class="achat__who">${esc(m.name || 'Friend')}</span>`}
              <p class="achat__text">${esc(m.text)}</p>
              <time class="achat__time">${clock(m.at)}</time>
            </li>`;
        })
        .join('')
    : '<li class="achat__empty">Say hello — messages stay at this table.</li>';
  list.scrollTop = list.scrollHeight;

  const count = q('[data-chat-count]');
  if (count) count.textContent = msgs.length ? `${msgs.length}` : '';

  for (const m of fresh) {
    if (m.seat === s.seat) continue;
    if (m.kind === 'react') floatReact(m.text);
    else bubble(m.name, m.text);
  }
}

function floatReact(emoji) {
  const stage = q('.arcade__stage');
  if (!stage) return;
  const el = document.createElement('span');
  el.className = 'areact';
  el.textContent = String(emoji).slice(0, 4);
  el.style.setProperty('--x', `${18 + Math.random() * 64}%`);
  el.style.setProperty('--tilt', `${Math.round(Math.random() * 40 - 20)}deg`);
  stage.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

function bubble(name, text) {
  const stage = q('.arcade__stage');
  if (!stage) return;
  stage.querySelector('.abubble')?.remove();
  const el = document.createElement('div');
  el.className = 'abubble';
  el.setAttribute('role', 'status');
  el.innerHTML = `<b>${esc(name || 'Friend')}</b><span>${esc(text)}</span>`;
  stage.appendChild(el);
  setTimeout(() => el.classList.add('is-leaving'), 4200);
  setTimeout(() => el.remove(), 4700);
}

function say(text, kind = 'msg') {
  const s = session;
  if (!s || s.mode !== 'remote') return false;
  const now = Date.now();
  if (now - (s.lastSaid || 0) < 450) return false; // gentle flood guard
  s.lastSaid = now;
  if (kind === 'react') floatReact(text);
  haptic();
  rooms.sendChat(s.code, s.seat, text, kind).catch((err) => {
    console.warn('[arcade] chat', err);
    toast('Message not sent.', 'error');
  });
  return true;
}

/* =========================================================
   Table wiring
   ========================================================= */
function wireTable() {
  paintBoard();

  // Bound to the table itself — #view outlives every render, this element does not.
  const table = q('[data-arcade-root]');
  table?.addEventListener('click', (e) => {
    const t = e.target;
    // Any tap counts as permission to play the friend's audio, if the browser held it back.
    if (session?.mode === 'remote' && session.soundBlocked) playRemote();
    if (t.closest('[data-exit]')) { leave(); return; }
    if (t.closest('[data-again]')) { newRound(); return; }
    if (t.closest('[data-rules]')) { showRules(); return; }
    if (t.closest('[data-table-settings]')) { showSettings(session.game, true); return; }
    if (t.closest('[data-share]')) { showInvite(session.code, false); return; }
    if (t.closest('[data-invite-here]')) { host(session.game.meta.id); return; }

    const lvl = t.closest('[data-setlevel]');
    if (lvl && session) {
      session.level = lvl.dataset.setlevel;
      levels[session.game.meta.id] = session.level;
      session.names[1] = computerName(session.game, session.level);
      rootEl.querySelectorAll('[data-setlevel]').forEach((b) => b.setAttribute('aria-selected', String(b === lvl)));
      const hint = q('[data-levelhint]');
      if (hint) hint.textContent = session.game.meta.levels.find((l) => l.id === session.level)?.hint || '';
      paintRail();
      return;
    }

    if (t.closest('[data-cam]')) { toggleDevice('cam'); return; }
    if (t.closest('[data-mic]')) { toggleDevice('mic'); return; }
    if (t.closest('[data-recall]')) { recall(); return; }
    if (t.closest('[data-sound]')) { playRemote(); return; }

    const react = t.closest('[data-react]');
    if (react) { say(react.dataset.react, 'react'); return; }
    const phrase = t.closest('[data-phrase]');
    if (phrase) say(phrase.dataset.phrase);
  });

  const chatForm = q('[data-chat-form]');
  table?.addEventListener('input', (e) => {
    if (!e.target.matches('[data-p2name]') || !session) return;
    partnerName = e.target.value.trim().slice(0, 24) || 'Player 2';
    session.names[1] = partnerName;
    paintRail();
    paintStatus();
    paintBoard();
  });
  chatForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = chatForm.msg.value.trim();
    if (!text) return;
    if (say(text)) chatForm.msg.value = '';
  });

  if (session.mode === 'remote') {
    syncDock();
    session.chatLast = undefined;
    paintChat(session.room?.chat || []);
    if (session.room?.guestUid) startCall();
  }
}

function paintBoard() {
  const slot = q('[data-board]');
  if (!slot || !session) return;
  const ctx = context();
  slot.innerHTML = session.game.view(session.state, ctx);
  session.game.bind(slot, session.state, ctx, play);
}

function paintRail() {
  const rail = q('[data-rail]');
  if (rail && session) rail.innerHTML = railHtml();
}

function paintStatus() {
  const status = q('[data-status]');
  if (status && session) status.innerHTML = statusHtml();
}

function leave() {
  teardown();
  lastQuery = '';
  navigate('/games', { replace: true });
  repaint();
}

/* =========================================================
   Invite
   ========================================================= */
function showInvite(code, fresh) {
  // Opened from disk, a link only works on this computer — share the code instead.
  const local = location.protocol === 'file:';
  const link = local ? code : rooms.inviteLink(code);
  modal({
    title: fresh ? 'Your table is ready' : 'Invite a friend',
    body: `
      <p class="fs-sm t-dim">${
        local
          ? 'Send this code. Your friend enters it under <b>Games → Got a code?</b> and sits opposite you.'
          : 'Send this link. Whoever opens it first sits opposite you.'
      }</p>
      <div class="invite">
        <code class="invite__code">${esc(code)}</code>
        ${local ? '' : `<input class="input invite__link" value="${esc(link)}" readonly aria-label="Invite link" />`}
        <div class="invite__actions">
          <button class="btn btn--primary" type="button" data-copy>${icon('link')} Copy ${local ? 'code' : 'link'}</button>
          ${navigator.share ? `<button class="btn btn--ghost" type="button" data-send>Share…</button>` : ''}
        </div>
      </div>`,
    onMount(box, close) {
      box.querySelector('[data-copy]')?.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(link);
          toast(local ? 'Code copied.' : 'Link copied.', 'success');
        } catch {
          box.querySelector('.invite__link')?.select();
          toast(local ? 'Copy the code shown above.' : 'Press copy on the selected link.', 'info');
        }
      });
      box.querySelector('[data-send]')?.addEventListener('click', () => {
        const msg = local ? { title: 'A game on LifeFlow', text: `Fancy a game? Join with code ${code}` } : { title: 'A game on LifeFlow', text: 'Fancy a game?', url: link };
        navigator.share(msg).catch(() => {});
        close();
      });
    }
  });
}

function showRules() {
  const m = session.game.meta;
  modal({
    title: `${m.emoji} ${m.title}`,
    body: `
      <p class="fs-sm t-dim">${esc(m.blurb)}</p>
      <ul class="arcade-rules__list">${m.rules.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>`
  });
}

/** Pick the game's options. At the table the host (or a solo player) can restart with them. */
function showSettings(game, atTable) {
  const m = game.meta;
  const draft = settingsFor(game);
  const s = session;
  const canRestart = atTable && s && s.game === game && (s.mode === 'solo' || s.seat === 0);

  modal({
    title: `${m.emoji} ${m.title} — settings`,
    body: `
      <div class="gset">
        ${m.settings
          .map(
            (opt) => `
          <fieldset class="gset__group">
            <legend class="gset__label">${esc(opt.label)}</legend>
            <div class="gset__opts" role="radiogroup" aria-label="${esc(opt.label)}">
              ${opt.options
                .map(
                  (o, k) =>
                    `<button class="gset__opt" type="button" role="radio" data-set="${esc(opt.id)}" data-k="${k}" aria-checked="${o.v === draft[opt.id]}">${esc(o.label)}</button>`
                )
                .join('')}
            </div>
          </fieldset>`
          )
          .join('')}
      </div>
      <p class="fs-sm t-dim">${
        atTable
          ? canRestart
            ? (s.mode === 'remote' ? 'Both players share these rules. Restart to use them now, or save them for the next game.' : 'Restart to use them now, or save them for the next game.')
            : 'They apply from the next game.'
          : 'Saved on this device and used every time you start this game.'
      }</p>`,
    footer: `
      <button class="btn btn--ghost" type="button" data-save>Save</button>
      ${canRestart ? `<button class="btn btn--primary" type="button" data-restart>${icon('refresh')} Apply & restart</button>` : ''}`,
    onMount(box, close) {
      box.querySelectorAll('[data-set]').forEach((b) =>
        b.addEventListener('click', () => {
          const opt = m.settings.find((x) => x.id === b.dataset.set);
          const o = opt?.options[Number(b.dataset.k)];
          if (!o) return;
          draft[opt.id] = o.v;
          b.parentElement.querySelectorAll('[data-set]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
          haptic();
        })
      );
      box.querySelector('[data-save]')?.addEventListener('click', () => {
        saveSettings(m.id, { ...draft });
        close();
        toast(atTable ? 'Saved — used from the next game.' : 'Settings saved.', 'success');
      });
      box.querySelector('[data-restart]')?.addEventListener('click', () => {
        saveSettings(m.id, { ...draft });
        close();
        restartWithSettings();
      });
    }
  });
}

function restartWithSettings() {
  const s = session;
  if (!s) return;
  if (s.mode === 'remote') {
    if (s.seat !== 0) return;
    const round = s.room?.round || 0;
    rooms
      .restart(s.code, freshState(s.game, round, s.state), (s.seq || 0) + 1, round)
      .then(() => toast('New game with the new rules.', 'success'))
      .catch((err) => toast(roomError(err, 'Could not restart the game.'), 'error', 6000));
    return;
  }
  clearTimers();
  s.state = freshState(s.game, s.round, s.state);
  s.seq = (s.seq || 0) + 1;
  s.finishedAt = null;
  paintBoard();
  paintRail();
  paintStatus();
  tick();
  toast('New game with the new rules.', 'success');
}

/* =========================================================
   Camera & microphone
   ========================================================= */
function startCall() {
  const s = session;
  if (!s || s.call || s.mode !== 'remote' || !canCall()) return;
  s.joinSeen = s.room?.guestJoin || s.room?.guestUid || '';

  s.call = createCall({
    code: s.code,
    seat: s.seat,
    onRemote: (stream) => {
      if (session !== s) return;
      const v = q('[data-vid-remote]');
      if (!v) return;
      // Re-attach when the set of tracks changes, so Safari picks up new lanes too.
      const sig = stream.getTracks().map((t) => t.id).join(',');
      if (v.dataset.sig !== sig) {
        v.dataset.sig = sig;
        v.srcObject = null;
        v.srcObject = new MediaStream(stream.getVideoTracks());
        v.muted = true;
        v.play?.().catch(() => {});
        const audio = q('[data-audio-remote]');
        if (audio) audio.srcObject = new MediaStream(stream.getAudioTracks());
      }
      if (sig) playRemote();
      syncDock();
    },
    onLocal: (stream) => {
      if (session !== s) return;
      const v = q('[data-vid-local]');
      if (v) {
        v.srcObject = stream;
        v.play?.().catch(() => {});
      }
      syncDock();
    },
    onStatus: (state) => {
      if (session !== s) return;
      s.status = state;
      syncDock();
    },
    onError: (err) => { if (session === s) toast(roomError(err, 'The video link could not be opened.'), 'error'); }
  });

  s.call.start();
}

/** Start the friend's audio/video; browsers may insist on a tap first. */
function playRemote() {
  const s = session;
  const v = q('[data-audio-remote]');
  if (!s || !v?.srcObject) return;
  v.muted = false;
  const p = v.play?.();
  if (!p?.then) return;
  p.then(() => {
    if (session !== s) return;
    s.soundBlocked = false;
    const btn = q('[data-sound]');
    if (btn) btn.hidden = true;
  }).catch((err) => {
    if (session !== s || err?.name !== 'NotAllowedError') return;
    s.soundBlocked = true;
    const btn = q('[data-sound]');
    if (btn) btn.hidden = false;
  });
}

function recall() {
  const s = session;
  if (!s?.call) { toast('Waiting for your friend to arrive.', 'info'); return; }
  s.call.reconnect();
  s.status = 'connecting';
  syncDock();
  toast('Reconnecting voice & video…', 'info');
}

async function toggleDevice(kind) {
  const s = session;
  if (!s?.call) { toast('Waiting for your friend to arrive.', 'info'); return; }

  s.deviceBusy ||= {};
  if (s.deviceBusy[kind]) return;
  s.deviceBusy[kind] = true;
  const on = !s.media[kind];
  try {
    if (kind === 'cam') await s.call.setCam(on);
    else await s.call.setMic(on);
  } catch (err) {
    console.warn('[arcade] device', err);
    toast(
      err?.name === 'NotAllowedError'
        ? 'Permission was declined by your browser.'
        : `Your ${kind === 'cam' ? 'camera' : 'microphone'} is not available.`,
      'error'
    );
    return;
  } finally {
    s.deviceBusy[kind] = false;
  }

  if (session !== s || !s.call) return;
  s.media[kind] = on;
  haptic();
  syncDock();
  rooms.pushMedia(s.code, s.seat, s.media).catch((err) => {
    if (session === s) toast(roomError(err, 'Could not share your device status.'), 'error');
  });
}

const STATE_LABEL = {
  connecting: 'Connecting…',
  connected: 'Connected',
  disconnected: 'Reconnecting…',
  failed: 'Connection lost',
  closed: 'Call ended'
};

function syncDock() {
  const s = session;
  const dock = q('[data-dock]');
  if (!s || !dock) return;

  const label = dock.querySelector('[data-callstate]');
  const note = dock.querySelector('[data-callnote]');
  if (note) note.textContent = !canCall()
    ? 'Open the app over HTTPS (or localhost) and allow camera/microphone access in your browser.'
    : s.status === 'failed'
    ? 'Call connection failed. Try Reconnect. Mobile and restricted networks may require a configured TURN relay; the game and chat still work.'
    : 'Mic alone is a voice call; add the camera for video. Allow device access when your browser asks.';
  if (label) {
    label.textContent = !canCall()
      ? 'Not available here'
      : !s.room?.guestUid
      ? 'Waiting for your friend'
      : STATE_LABEL[s.status] || 'Connecting…';
  }

  const localTile = dock.querySelector('[data-tile-local]');
  const remoteTile = dock.querySelector('[data-tile-remote]');
  localTile?.classList.toggle('is-live', Boolean(s.media.cam));
  remoteTile?.classList.toggle('is-live', Boolean(s.peerMedia?.cam));

  const peerName = remoteTile?.querySelector('.vdock__name');
  if (peerName) {
    peerName.childNodes[0].nodeValue = s.names[1 - s.seat] || 'Your friend';
  }
  remoteTile?.querySelector('[data-peer-muted]')?.classList.toggle('is-on', !s.peerMedia?.mic);

  const cam = dock.querySelector('[data-cam]');
  const mic = dock.querySelector('[data-mic]');
  cam?.classList.toggle('is-on', Boolean(s.media.cam));
  cam?.setAttribute('aria-pressed', String(Boolean(s.media.cam)));
  mic?.classList.toggle('is-on', Boolean(s.media.mic));
  mic?.setAttribute('aria-pressed', String(Boolean(s.media.mic)));
}
return Object.freeze({ meta, unmount, render });
  })();

  /* ===== js/views/prayer.js ===== */
  const __m43 = (function () {
const { esc, ymd, today, addDays, pct, haptic } = __m1;
const { icon } = __m3;
const { ring, animateProgress, toast, confetti, confirmDialog } = __m2;
const store = __m8;
const { METHODS, MADHABS, CITIES, prayerSchedule, nextPrayer, countdownLabel, hijriLabel, locate, nearestCity, methodOf } = __m9;
/**
 * LifeFlow — Salat: the five daily prayers, with live local prayer times.
 *
 * Times are computed on device (see js/prayer.js) so the page keeps working
 * offline, and the whole tracker can be removed again in one tap.
 */






const meta = { title: 'Salat', icon: 'mosque', label: 'Salat' };

let ticker = null;
let locating = false;

function render(root) {
  const p = store.prefs().prayer;
  root.innerHTML = `<div class="page">${p.enabled ? enabledView(p) : onboarding(p)}</div>`;
  bind(root);
  animateProgress(root);
  if (p.enabled) startTicker(root);
}

/* =========================================================
   First run
   ========================================================= */
function onboarding(p) {
  return `
    <section class="hero-card anim-in">
      <div class="hero-card__grid">
        <div class="grow">
          <span class="eyebrow">${esc(hijriLabel() || 'Salat')}</span>
          <h1>Keep the five<br /><span class="t-grad">close to you</span> 🕌</h1>
          <p class="mt-2">Prayer times for wherever you are, and a gentle daily check for Fajr, Dhuhr, Asr, Maghrib and Isha.</p>
        </div>
        <div class="hero-card__ring"><div class="prayer-hero__emoji">🕌</div></div>
      </div>
    </section>

    <section class="card">
      <div class="card__head">
        <h3 class="card__title">${icon('compass')} Where are you praying?</h3>
      </div>
      ${locationBlock(p)}
      ${methodBlock(p)}
      <button class="btn btn--primary btn--block mt-4" data-enable type="button">${icon('check')} Add prayer tracker</button>
      <p class="fs-xs t-mute mt-2" style="text-align:center">You can remove it any time — nothing is kept.</p>
    </section>`;
}

/* =========================================================
   The tracker
   ========================================================= */
function enabledView(p) {
  const schedule = prayerSchedule(new Date(), p);
  const doneToday = store.prayersOn(today());
  const streak = store.prayerStreak();
  const progress = pct(doneToday.length, 5);
  const up = nextPrayer(new Date(), p);

  return `
    <section class="hero-card anim-in prayer-hero">
      <div class="hero-card__grid">
        <div class="grow">
          <span class="eyebrow">${esc(hijriLabel() || new Date().toLocaleDateString())}</span>
          <h1 class="prayer-hero__next">
            ${esc(up.next.emoji)} ${esc(up.next.label)}
            <span class="t-grad" data-prayer-time>${esc(up.next.hhmm || '—')}</span>
          </h1>
          <p class="mt-2">
            ${up.tomorrow ? 'Tomorrow' : 'In'}
            <b data-prayer-countdown>${esc(countdownLabel(up.in))}</b>
            ${up.tomorrow ? '' : '· take your time'}
          </p>
          <span class="chip chip--accent mt-3" data-loc-chip>${icon('compass')} ${esc(p.city || 'Your location')}</span>
        </div>
        <div class="hero-card__ring">
          ${ring(progress, { size: 112, stroke: 11, label: `${doneToday.length}/5`, caption: 'Today' })}
        </div>
      </div>
    </section>

    <section class="stat-rail stagger">
      <button class="stat" type="button" data-scroll="#salat-list" style="text-align:left">
        <span class="stat__icon">${icon('checkCircle')}</span>
        <span class="stat__val">${doneToday.length}/5</span><span class="stat__lbl">Prayed today</span>
      </button>
      <div class="stat">
        <span class="stat__icon">${icon('flame')}</span>
        <span class="stat__val">${streak}</span><span class="stat__lbl">Day streak</span>
      </div>
      <div class="stat">
        <span class="stat__icon">${icon('clock')}</span>
        <span class="stat__val" data-prayer-mini>${esc(countdownLabel(up.in))}</span><span class="stat__lbl">To ${esc(up.next.label)}</span>
      </div>
      <div class="stat">
        <span class="stat__icon">${icon('moon')}</span>
        <span class="stat__val">${monthRate()}%</span><span class="stat__lbl">This month</span>
      </div>
    </section>

    <div class="g-main">
      <div class="grid" style="gap:var(--s-4)">
        <section class="card" id="salat-list">
          <div class="card__head">
            <h3 class="card__title">${icon('mosque')} Today’s prayers</h3>
            <span class="chip">${esc(new Date().toLocaleDateString(undefined, { weekday: 'long' }))}</span>
          </div>
          <div class="salat">
            ${schedule.map((s) => prayerRow(s, doneToday.includes(s.id), up.next.id, up.tomorrow)).join('')}
          </div>
          ${
            doneToday.length === 5
              ? `<p class="salat__done mt-4">All five, complete. تقبل الله 🤍</p>`
              : `<p class="fs-xs t-mute mt-3" style="text-align:center">Tap a prayer once you’ve prayed it.</p>`
          }
        </section>

        <section class="card">
          <div class="card__head">
            <h3 class="card__title">${icon('grid')} Last 30 days</h3>
            <span class="chip chip--accent">${store.state.prayers.length} day${store.state.prayers.length === 1 ? '' : 's'} tracked</span>
          </div>
          <div class="salat-heat">${last30().map(heatCell).join('')}</div>
          <div class="salat-heat__legend">
            <span>0</span><i data-n="0"></i><i data-n="2"></i><i data-n="3"></i><i data-n="4"></i><i data-n="5"></i><span>5</span>
          </div>
        </section>
      </div>

      <div class="grid" style="gap:var(--s-4)">
        <section class="card">
          <div class="card__head">
            <h3 class="card__title">${icon('settings')} Times & location</h3>
          </div>
          ${locationBlock(p)}
          ${methodBlock(p)}
        </section>

        <section class="card">
          <div class="card__head">
            <h3 class="card__title">${icon('trash')} Remove tracker</h3>
          </div>
          <p class="fs-sm t-dim">Turning this off hides Salat everywhere and deletes every saved day.</p>
          <div class="flex gap-2 mt-3" style="flex-wrap:wrap">
            <button class="btn btn--soft btn--sm" data-clear-day type="button">${icon('reset')} Clear today</button>
            <button class="btn btn--danger btn--sm" data-remove type="button">${icon('trash')} Remove prayer tracker</button>
          </div>
        </section>
      </div>
    </div>`;
}

function prayerRow(s, done, nextId, tomorrow) {
  const now = new Date();
  const passed = s.at ? s.at <= now : false;
  const isNext = !tomorrow && s.id === nextId;
  const missed = passed && !done;
  return `
    <div class="salat__row${done ? ' is-done' : ''}${isNext ? ' is-next' : ''}" data-row="${esc(s.id)}">
      <span class="salat__emoji">${esc(s.emoji)}</span>
      <div class="grow" style="min-width:0">
        <div class="salat__name">${esc(s.label)} <span class="salat__ar">${esc(s.ar)}</span></div>
        <div class="salat__meta">${
          isNext ? 'Next · ' : missed ? 'Not marked · ' : done ? 'Prayed · ' : ''
        }${esc(s.note)}</div>
      </div>
      <span class="salat__time">${esc(s.hhmm || '—')}</span>
      <button class="salat__check" data-pray="${esc(s.id)}" type="button" aria-pressed="${done}"
              aria-label="${done ? 'Undo' : 'Mark'} ${esc(s.label)}">${icon('check')}</button>
    </div>`;
}

function heatCell(d) {
  return `<i data-n="${d.count}" title="${esc(d.key)} — ${d.count}/5"></i>`;
}

function last30() {
  return [...Array(30)].map((_, i) => {
    const key = ymd(addDays(new Date(), -(29 - i)));
    return { key, count: store.prayersOn(key).length };
  });
}

function monthRate() {
  return store.select.monthSummary(today().slice(0, 7)).prayers.rate;
}

/* =========================================================
   Settings blocks
   ========================================================= */
function locationBlock(p) {
  return `
    <div class="field">
      <label for="salat-city">City</label>
      <select class="input" id="salat-city" data-city>
        ${CITIES.map(
          (c) => `<option value="${esc(c.label)}" ${c.label === p.city ? 'selected' : ''}>${esc(c.label)}</option>`
        ).join('')}
        ${CITIES.some((c) => c.label === p.city) ? '' : `<option value="${esc(p.city)}" selected>${esc(p.city)}</option>`}
      </select>
    </div>
    <button class="btn btn--soft btn--sm btn--block mt-2" data-locate type="button">
      ${icon('compass')} ${locating ? 'Locating…' : 'Use my exact location'}
    </button>
    <p class="fs-xs t-mute mt-2">${esc(coordLabel(p))}</p>`;
}

function coordLabel(p) {
  const lat = Number(p.lat) || 0;
  const lng = Number(p.lng) || 0;
  return `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lng).toFixed(2)}°${lng >= 0 ? 'E' : 'W'} · ${methodOf(p.method).label}`;
}

function methodBlock(p) {
  return `
    <div class="field mt-3">
      <label for="salat-method">Calculation method</label>
      <select class="input" id="salat-method" data-method>
        ${METHODS.map(
          (m) => `<option value="${esc(m.id)}" ${m.id === p.method ? 'selected' : ''}>${esc(m.label)}</option>`
        ).join('')}
      </select>
    </div>
    <div class="field mt-3">
      <label>Asr calculation</label>
      <div class="segmented" role="tablist" data-madhab style="width:100%">
        ${MADHABS.map(
          (m) => `<button role="tab" type="button" data-madhab-id="${esc(m.id)}" aria-selected="${m.id === p.madhab}">${esc(m.label)}</button>`
        ).join('')}
      </div>
    </div>`;
}

/* =========================================================
   Live countdown
   ========================================================= */
function startTicker(root) {
  clearInterval(ticker);
  const painted = nextPrayer(new Date(), store.prefs().prayer).next.id;
  ticker = setInterval(() => {
    const host = root.querySelector('[data-prayer-countdown]');
    if (!host || !host.isConnected) { clearInterval(ticker); ticker = null; return; }
    const up = nextPrayer(new Date(), store.prefs().prayer);
    if (up.next.id !== painted) { clearInterval(ticker); ticker = null; render(root); return; }
    const label = countdownLabel(up.in);
    host.textContent = label;
    const mini = root.querySelector('[data-prayer-mini]');
    if (mini) mini.textContent = label;
  }, 1000);
}

/* =========================================================
   Events
   ========================================================= */
function bind(root) {
  root.querySelector('[data-enable]')?.addEventListener('click', async (e) => {
    e.currentTarget.disabled = true;
    await store.savePrayerPrefs({ enabled: true });
    toast('Prayer tracker added 🕌');
    haptic(16);
  });

  root.querySelector('[data-city]')?.addEventListener('change', async (e) => {
    const city = CITIES.find((c) => c.label === e.target.value);
    if (!city) return;
    await store.savePrayerPrefs({ city: city.label, lat: city.lat, lng: city.lng });
    toast(`Times set for ${city.label}`);
  });

  root.querySelector('[data-method]')?.addEventListener('change', async (e) => {
    await store.savePrayerPrefs({ method: e.target.value });
  });

  root.querySelectorAll('[data-madhab-id]').forEach((b) =>
    b.addEventListener('click', async () => {
      await store.savePrayerPrefs({ madhab: b.dataset.madhabId });
    })
  );

  root.querySelector('[data-locate]')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    if (locating) return;
    locating = true;
    btn.disabled = true;
    btn.innerHTML = `${icon('compass')} Locating…`;
    const pos = await locate();
    locating = false;
    if (!pos) {
      btn.disabled = false;
      btn.innerHTML = `${icon('compass')} Use my exact location`;
      toast('Location unavailable — pick your city instead.', 'error');
      return;
    }
    const city = nearestCity(pos.lat, pos.lng) || 'My location';
    await store.savePrayerPrefs({ lat: pos.lat, lng: pos.lng, city });
    toast(`Times set for ${city}`);
  });

  root.querySelectorAll('[data-pray]').forEach((b) =>
    b.addEventListener('click', async () => {
      const id = b.dataset.pray;
      const on = await store.togglePrayer(id);
      haptic(14);
      if (on && store.prayersOn(today()).length === 5) {
        confetti(26);
        toast('All five today — تقبل الله 🤍');
      }
    })
  );

  root.querySelector('[data-clear-day]')?.addEventListener('click', async () => {
    await store.clearPrayerDay(today());
    toast('Today’s check-ins cleared');
  });

  root.querySelector('[data-remove]')?.addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: 'Remove the prayer tracker?',
      message: 'Salat will disappear from the menu and the dashboard, and every saved day will be deleted. You can add it back whenever you like.',
      confirmText: 'Remove it',
      danger: true
    });
    if (!ok) return;
    clearInterval(ticker);
    ticker = null;
    const n = await store.removePrayerTracker({ wipe: true });
    toast(n ? `Prayer tracker removed (${n} day${n === 1 ? '' : 's'} deleted)` : 'Prayer tracker removed');
  });

  root.querySelector('[data-scroll]')?.addEventListener('click', (e) => {
    document.querySelector(e.currentTarget.dataset.scroll)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}
return Object.freeze({ meta, render });
  })();

  /* ===== js/quran.js ===== */
  const __m45 = (function () {
const { esc } = __m1;
const { icon } = __m3;
const { navigate, currentPath } = __m6;
/**
 * LifeFlow — Qur'an service.
 *
 * - Surah index, Uthmani text and Arabic tafsir from api.alquran.cloud
 *   (CORS-enabled, so it also works when index.html is opened from disk).
 * - Everything fetched is cached in IndexedDB, so a surah read once opens
 *   instantly next time (and offline).
 * - One app-wide verse-by-verse player: it keeps reciting while you browse
 *   other pages, shows a mini player there, preloads the next verse for
 *   gapless listening and talks to the OS media controls (Media Session).
 */




const API = 'https://api.alquran.cloud/v1';

const RECITERS = [
  { id: 'ar.alafasy', ar: 'مشاري راشد العفاسي', en: 'Mishary Alafasy' },
  { id: 'ar.abdulsamad', ar: 'عبد الباسط عبد الصمد', en: 'Abdul Basit Abdus-Samad' },
  { id: 'ar.husary', ar: 'محمود خليل الحصري', en: 'Mahmoud Khalil Al-Husary' },
  { id: 'ar.husarymujawwad', ar: 'الحصري — مجوّد', en: 'Al-Husary (Mujawwad)' },
  { id: 'ar.mahermuaiqly', ar: 'ماهر المعيقلي', en: 'Maher Al-Muaiqly' },
  { id: 'ar.abdurrahmaansudais', ar: 'عبد الرحمن السديس', en: 'Abdur-Rahman As-Sudais' },
  { id: 'ar.saoodshuraym', ar: 'سعود الشريم', en: 'Saud Ash-Shuraym' },
  { id: 'ar.shaatree', ar: 'أبو بكر الشاطري', en: 'Abu Bakr Ash-Shaatree' },
  { id: 'ar.ahmedajamy', ar: 'أحمد بن علي العجمي', en: 'Ahmed Al-Ajamy' },
  { id: 'ar.hudhaify', ar: 'علي الحذيفي', en: 'Ali Al-Hudhaify' },
  { id: 'ar.muhammadayyoub', ar: 'محمد أيوب', en: 'Muhammad Ayyoub' },
  { id: 'ar.muhammadjibreel', ar: 'محمد جبريل', en: 'Muhammad Jibreel' },
  { id: 'ar.hanirifai', ar: 'هاني الرفاعي', en: 'Hani Ar-Rifai' },
  { id: 'ar.abdullahbasfar', ar: 'عبد الله بصفر', en: 'Abdullah Basfar' },
  { id: 'ar.ibrahimakhbar', ar: 'إبراهيم الأخضر', en: 'Ibrahim Al-Akhdar' },
  { id: 'ar.aymanswoaid', ar: 'أيمن سويد', en: 'Ayman Swoaid' }
];

const TAFSIRS = [
  { id: 'ar.muyassar', ar: 'التفسير الميسر', en: 'Al-Muyassar — clear & short' },
  { id: 'ar.jalalayn', ar: 'تفسير الجلالين', en: 'Al-Jalalayn — concise classic' },
  { id: 'ar.waseet', ar: 'التفسير الوسيط', en: 'Al-Waseet — balanced' },
  { id: 'ar.baghawi', ar: 'تفسير البغوي', en: 'Al-Baghawi — narrations' },
  { id: 'ar.qurtubi', ar: 'تفسير القرطبي', en: 'Al-Qurtubi — in depth' },
  { id: 'ar.miqbas', ar: 'تنوير المقباس', en: 'Tanwir al-Miqbas' }
];

/* =========================================================
   Preferences (device-local: listening is a per-device habit)
   ========================================================= */
const PKEY = 'lf:quran';
const DEFAULTS = {
  reciter: 'ar.alafasy',
  tafsir: 'ar.muyassar',
  tafsirMode: 'active', // all | active | off
  surah: 1,
  ayah: 1,
  repeat: 'off', // off | ayah | surah
  rate: 1,
  size: 3,
  follow: true,
  cont: true,
  basmala: true,
  marks: []
};
const prefCache = { value: null };

function qprefs() {
  if (!prefCache.value) {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(PKEY) || '{}') || {}; } catch { /* corrupted / private mode */ }
    prefCache.value = { ...DEFAULTS, ...saved };
    if (!RECITERS.some((r) => r.id === prefCache.value.reciter)) prefCache.value.reciter = DEFAULTS.reciter;
    if (!TAFSIRS.some((t) => t.id === prefCache.value.tafsir)) prefCache.value.tafsir = DEFAULTS.tafsir;
  }
  return prefCache.value;
}

function saveQprefs(patch) {
  prefCache.value = { ...qprefs(), ...patch };
  try { localStorage.setItem(PKEY, JSON.stringify(prefCache.value)); } catch { /* quota / private mode */ }
  return prefCache.value;
}

function isMarked(s, a) { return qprefs().marks.includes(`${s}:${a}`); }
function toggleMark(s, a) {
  const key = `${s}:${a}`;
  const marks = qprefs().marks.filter((m) => m !== key);
  if (marks.length === qprefs().marks.length) marks.unshift(key);
  saveQprefs({ marks: marks.slice(0, 60) });
  return marks.includes(key);
}

/* =========================================================
   Arabic helpers
   ========================================================= */
const MARKS = /[\u064B-\u065F\u0670\u06D6-\u06ED\uFEFF]/g;
/** Strip harakat/Qur'anic marks so search and comparisons are forgiving. */
function plainArabic(s = '') {
  return s.replace(MARKS, '').replace(/[\u0671\u0622\u0623\u0625]/g, '\u0627').replace(/\u0640/g, '');
}
const arNum = (n) => Number(n).toLocaleString('ar-EG', { useGrouping: false });

const BASMALA = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ';
const BASMALA_PLAIN = 'بسم الله الرحمن الرحيم';

/** The API prefixes ayah 1 with the basmala; we show it as a header instead. */
function cleanAyah(surah, n, text) {
  const t = String(text || '').replace(/^\uFEFF/, '');
  if (n !== 1 || surah === 1 || surah === 9) return t;
  const words = t.split(/\s+/);
  if (words.length > 4 && plainArabic(words.slice(0, 4).join(' ')) === BASMALA_PLAIN) return words.slice(4).join(' ');
  return t;
}

/* =========================================================
   Cache: memory -> IndexedDB -> network
   ========================================================= */
const dbState = { p: null };
function db() {
  if (!dbState.p) {
    dbState.p = new Promise((resolve) => {
      try {
        const req = indexedDB.open('lifeflow-quran', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('kv');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
        req.onblocked = () => resolve(null);
      } catch { resolve(null); }
    });
  }
  return dbState.p;
}
async function idbGet(key) {
  const d = await db();
  if (!d) return undefined;
  return new Promise((resolve) => {
    try {
      const r = d.transaction('kv').objectStore('kv').get(key);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => resolve(undefined);
    } catch { resolve(undefined); }
  });
}
async function idbSet(key, value) {
  const d = await db();
  if (!d) return;
  try { d.transaction('kv', 'readwrite').objectStore('kv').put(value, key); } catch { /* quota */ }
}

const mem = new Map();
function cached(key, loader) {
  if (mem.has(key)) return mem.get(key);
  const p = (async () => {
    const hit = await idbGet(key);
    if (hit) return hit;
    const value = await loader();
    idbSet(key, value);
    return value;
  })();
  mem.set(key, p);
  p.catch(() => mem.delete(key));
  return p;
}

async function api(path) {
  let res;
  try { res = await fetch(API + path); } catch { throw new Error('You seem to be offline — the Qur’an needs a connection the first time a surah is opened.'); }
  if (!res.ok) throw new Error(`The Qur’an service answered ${res.status}. Please try again.`);
  const json = await res.json();
  if (json.code !== 200 || !json.data) throw new Error(json.status || 'Unexpected answer from the Qur’an service.');
  return json.data;
}

/* =========================================================
   Data
   ========================================================= */
function surahList() {
  return cached('surahs:v1', async () =>
    (await api('/surah')).map((s) => ({
      n: s.number,
      ar: s.name,
      en: s.englishName,
      meaning: s.englishNameTranslation,
      ayahs: s.numberOfAyahs,
      type: s.revelationType
    }))
  );
}

function surahText(n) {
  return cached(`text:${n}:v1`, async () =>
    (await api(`/surah/${n}/quran-uthmani`)).ayahs.map((a) => ({
      g: a.number,
      n: a.numberInSurah,
      text: cleanAyah(n, a.numberInSurah, a.text),
      juz: a.juz,
      page: a.page,
      sajda: !!a.sajda
    }))
  );
}

function surahTafsir(n, edition) {
  return cached(`tafsir:${n}:${edition}`, async () => (await api(`/surah/${n}/${edition}`)).ayahs.map((a) => a.text || ''));
}

function surahAudio(n, reciter) {
  return cached(`audio:${n}:${reciter}`, async () =>
    (await api(`/surah/${n}/${reciter}`)).ayahs.map((a) => [a.audio, ...(a.audioSecondary || [])].filter(Boolean))
  );
}

const reciterOf = (id) => RECITERS.find((r) => r.id === id) || RECITERS[0];
const tafsirOf = (id) => TAFSIRS.find((t) => t.id === id) || TAFSIRS[0];

/* =========================================================
   The player (one per app)
   ========================================================= */
const P = {
  active: false, // a listening session exists (playing or paused)
  playing: false,
  loading: false,
  surah: 0,
  index: -1, // 0-based ayah index
  count: 0,
  phase: 'idle', // basmala | ayah | idle
  time: 0,
  dur: 0,
  error: '',
  name: null // { ar, en } of the current surah
};
const R = { audio: null, next: null, nextKey: '', urls: [], token: 0, listeners: new Set(), mediaBound: false };

function emit(kind = 'state') {
  R.listeners.forEach((fn) => {
    try { fn(kind, P); } catch (err) { console.error('[LifeFlow] quran listener', err); }
  });
  if (kind === 'state') renderMini();
  else paintMiniProgress();
}

function makeAudio(list) {
  const a = new Audio();
  a.preload = 'auto';
  a.alt = list.slice(1);
  a.src = list[0];
  return a;
}

function detach(a) {
  if (!a) return;
  a.onplaying = a.onwaiting = a.ontimeupdate = a.onended = a.onerror = a.onpause = null;
  try { a.pause(); } catch { /* ignore */ }
}

function clipUrls(phase) {
  if (phase === 'basmala') return (R.urls[0] || []).map((u) => u.replace(/\/\d+\.mp3$/, '/1.mp3'));
  return R.urls[P.index] || [];
}
const keyOf = (phase, index) => `${qprefs().reciter}:${P.surah}:${phase === 'basmala' ? 'b' : index}`;

async function start(surah, index, { intro = true } = {}) {
  const my = ++R.token;
  detach(R.audio);
  R.audio = null;
  Object.assign(P, { active: true, playing: true, loading: true, surah, index, error: '', time: 0, dur: 0 });
  emit();
  try {
    const [urls, list] = await Promise.all([surahAudio(surah, qprefs().reciter), surahList().catch(() => [])]);
    if (my !== R.token) return;
    R.urls = urls;
    P.count = urls.length;
    P.index = Math.max(0, Math.min(index, urls.length - 1));
    const s = list.find((x) => x.n === surah);
    P.name = s ? { ar: s.ar, en: s.en } : { ar: '', en: `Surah ${surah}` };
    const basmala = intro && P.index === 0 && surah !== 1 && surah !== 9 && qprefs().basmala;
    playClip(basmala ? 'basmala' : 'ayah', my);
  } catch (err) {
    if (my !== R.token) return;
    Object.assign(P, { playing: false, loading: false, error: err.message || 'Could not load the recitation.' });
    emit();
  }
}

function playClip(phase, my) {
  P.phase = phase;
  P.time = 0;
  P.dur = 0;
  const key = keyOf(phase, P.index);
  let a;
  if (R.next && R.nextKey === key && !R.next.error) { a = R.next; R.next = null; R.nextKey = ''; }
  else a = makeAudio(clipUrls(phase));
  R.audio = a;
  a.playbackRate = qprefs().rate;
  a.onplaying = () => { if (my !== R.token) return; P.loading = false; P.playing = true; emit(); };
  a.onwaiting = () => { if (my !== R.token) return; P.loading = true; emit(); };
  a.ontimeupdate = () => { P.time = a.currentTime; P.dur = a.duration || 0; emit('progress'); };
  a.onended = () => { if (my === R.token) advance(my); };
  a.onerror = () => {
    if (my !== R.token) return;
    if (a.alt?.length) { a.src = a.alt.shift(); a.play().catch(() => {}); return; }
    if (phase === 'basmala') { playClip('ayah', my); return; }
    Object.assign(P, { playing: false, loading: false, error: 'This verse’s audio could not be loaded. Check your connection.' });
    emit();
  };
  a.play().catch((err) => {
    if (my !== R.token || err?.name === 'AbortError') return;
    // Autoplay blocked (no user gesture yet) — stay ready, one tap resumes.
    Object.assign(P, { playing: false, loading: false });
    emit();
  });
  if (phase === 'ayah') saveQprefs({ surah: P.surah, ayah: P.index + 1 });
  preloadNext();
  mediaSession();
  emit();
}

function advance(my) {
  const pr = qprefs();
  if (P.phase === 'basmala') return playClip('ayah', my);
  if (pr.repeat === 'ayah') return playClip('ayah', my);
  if (P.index + 1 < P.count) { P.index += 1; return playClip('ayah', my); }
  if (pr.repeat === 'surah') { P.index = 0; return playClip(P.surah !== 1 && P.surah !== 9 && pr.basmala ? 'basmala' : 'ayah', my); }
  if (pr.cont && P.surah < 114) { start(P.surah + 1, 0); return; }
  Object.assign(P, { playing: false, loading: false, phase: 'idle' });
  emit();
}

function preloadNext() {
  const pr = qprefs();
  const idx = P.phase === 'basmala' || pr.repeat === 'ayah' ? P.index : P.index + 1;
  if (idx >= P.count) { R.next = null; R.nextKey = ''; return; }
  const key = keyOf('ayah', idx);
  if (R.nextKey === key) return;
  const list = R.urls[idx];
  if (!list?.length) return;
  R.next = makeAudio(list);
  R.nextKey = key;
}

function mediaSession() {
  if (!('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: `${P.name?.en || `Surah ${P.surah}`} · ${P.phase === 'basmala' ? 'Basmala' : `Ayah ${P.index + 1}`}`,
      artist: reciterOf(qprefs().reciter).en,
      album: 'The Holy Qur’an'
    });
    if (!R.mediaBound) {
      R.mediaBound = true;
      navigator.mediaSession.setActionHandler('play', () => player.toggle(true));
      navigator.mediaSession.setActionHandler('pause', () => player.toggle(false));
      navigator.mediaSession.setActionHandler('previoustrack', () => player.prev());
      navigator.mediaSession.setActionHandler('nexttrack', () => player.next());
    }
  } catch { /* unsupported action */ }
}

const player = {
  get state() { return P; },
  subscribe(fn) { R.listeners.add(fn); return () => R.listeners.delete(fn); },
  /** Play from a verse (0-based index). */
  playAt(surah, index = 0, opts) { return start(surah, index, opts); },
  toggle(force) {
    const a = R.audio;
    if (!P.active || (!a && !P.loading)) {
      const pr = qprefs();
      return start(P.surah || pr.surah, P.surah ? Math.max(0, P.index) : pr.ayah - 1, { intro: false });
    }
    if (!a) return undefined;
    const wantPlay = force ?? a.paused;
    if (wantPlay) {
      // Ended at the end of the surah: start over rather than replay silence.
      if (P.phase === 'idle') return start(P.surah, 0);
      a.play().catch(() => {});
      P.playing = true;
    } else {
      a.pause();
      P.playing = false;
      P.loading = false;
    }
    emit();
    return undefined;
  },
  next() {
    if (!P.active) return;
    if (P.index + 1 < P.count) start(P.surah, P.index + 1, { intro: false });
    else if (P.surah < 114) start(P.surah + 1, 0);
  },
  prev() {
    if (!P.active) return;
    if (R.audio && R.audio.currentTime > 3) { R.audio.currentTime = 0; return; }
    if (P.index > 0) start(P.surah, P.index - 1, { intro: false });
    else if (P.surah > 1) {
      surahList().then((list) => start(P.surah - 1, (list.find((s) => s.n === P.surah - 1)?.ayahs || 1) - 1, { intro: false })).catch(() => {});
    }
  },
  stop() {
    R.token += 1;
    detach(R.audio);
    detach(R.next);
    R.audio = R.next = null;
    R.nextKey = '';
    Object.assign(P, { active: false, playing: false, loading: false, phase: 'idle', time: 0, dur: 0 });
    if ('mediaSession' in navigator) { try { navigator.mediaSession.metadata = null; } catch { /* ignore */ } }
    emit();
  },
  setRate(rate) {
    saveQprefs({ rate });
    if (R.audio) R.audio.playbackRate = rate;
    emit();
  },
  setRepeat(repeat) {
    saveQprefs({ repeat });
    R.next = null;
    R.nextKey = '';
    if (P.active) preloadNext();
    emit();
  },
  setReciter(id) {
    saveQprefs({ reciter: id });
    R.next = null;
    R.nextKey = '';
    if (P.active && P.playing) start(P.surah, Math.max(0, P.index), { intro: false });
    else if (P.active) { R.token += 1; detach(R.audio); R.audio = null; emit(); }
    else emit();
  }
};

/* =========================================================
   Mini player — shown on every other page while a session is alive
   ========================================================= */
const M = { el: null };

function renderMini() {
  const onQuran = currentPath() === '/quran';
  const app = document.getElementById('app');
  const show = P.active && !onQuran && app && !app.hidden;
  if (!show) { M.el?.remove(); M.el = null; return; }
  if (!M.el) {
    M.el = document.createElement('div');
    M.el.className = 'qmini';
    M.el.setAttribute('role', 'region');
    M.el.setAttribute('aria-label', 'Qur’an player');
    M.el.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-qm]');
      if (!btn) return;
      if (btn.dataset.qm === 'toggle') player.toggle();
      else if (btn.dataset.qm === 'close') player.stop();
      else if (btn.dataset.qm === 'open') navigate(`/quran?s=${P.surah}&a=${P.index + 1}`);
    });
    document.body.appendChild(M.el);
  }
  const verse = P.phase === 'basmala' ? 'Basmala' : `Ayah ${P.index + 1}/${P.count || '…'}`;
  M.el.classList.toggle('is-playing', P.playing && !P.loading);
  M.el.innerHTML = `
    <button class="qmini__open" data-qm="open" type="button" title="Open the reader">
      <span class="qmini__disc" aria-hidden="true">۞</span>
      <span class="qmini__txt">
        <b lang="ar" dir="rtl">${esc(P.name?.ar || '')}</b>
        <small>${esc(P.name?.en || '')} · ${esc(verse)}</small>
      </span>
    </button>
    <button class="qmini__btn" data-qm="toggle" type="button" aria-label="${P.playing ? 'Pause' : 'Play'}">${icon(P.playing ? 'pause' : 'play')}</button>
    <button class="qmini__btn" data-qm="close" type="button" aria-label="Stop">${icon('close')}</button>
    <span class="qmini__bar"><span></span></span>`;
  paintMiniProgress();
}

function paintMiniProgress() {
  if (!M.el) return;
  const bar = M.el.querySelector('.qmini__bar > span');
  if (bar) bar.style.width = `${P.dur ? Math.min(100, (P.time / P.dur) * 100) : 0}%`;
}

window.addEventListener('lf:navigated', renderMini);
window.addEventListener('hashchange', renderMini);
return Object.freeze({ RECITERS, TAFSIRS, qprefs, saveQprefs, isMarked, toggleMark, plainArabic, arNum, BASMALA, surahList, surahText, surahTafsir, surahAudio, reciterOf, tafsirOf, player });
  })();

  /* ===== js/views/quran.js ===== */
  const __m44 = (function () {
const { esc, debounce } = __m1;
const { icon } = __m3;
const { toast } = __m2;
const { currentQuery, navigate } = __m6;
const { isOpen: isPaletteOpen } = __m12;
const { RECITERS, TAFSIRS, BASMALA, qprefs, saveQprefs, surahList, surahText, surahTafsir, player, arNum, plainArabic, isMarked, toggleMark, tafsirOf, reciterOf } = __m45;
/**
 * LifeFlow — Qur'an: read and listen at the same time.
 *
 * The verse being recited lights up in its own colour, the page follows the
 * reciter (unless you are scrolling yourself) and the verse's Arabic tafsir
 * unfolds right under it. Audio keeps playing on other pages (mini player).
 */







const meta = { title: 'Qur’an', icon: 'quran', label: 'Qur’an' };

const RATES = [0.75, 1, 1.25, 1.5];
const REPEATS = ['off', 'ayah', 'surah'];
const REPEAT_LABEL = { off: 'No repeat', ayah: 'Repeat verse', surah: 'Repeat surah' };
const TMODES = [['active', 'With the verse'], ['all', 'Every verse'], ['off', 'On tap']];

const V = {
  root: null,
  list: [],
  surah: 0,
  ayahs: null,
  tafsir: null,
  req: 0,
  unsub: null,
  tab: 'surahs',
  filter: '',
  lastQuery: '',
  userScrollAt: 0,
  activeKey: '',
  playerSurah: 0
};

const clampS = (n) => Math.min(114, Math.max(1, Math.round(n) || 1));

/* =========================================================
   Mount / unmount
   ========================================================= */
function render(root) {
  const q = currentQuery();
  const qkey = `${q.s || ''}:${q.a || ''}`;

  // The shell re-renders on every store change; the reader keeps its own state.
  if (V.root === root && root.querySelector('.quran')) {
    if (qkey !== V.lastQuery) {
      V.lastQuery = qkey;
      if (q.s) openSurah(clampS(+q.s), +q.a || 0);
    }
    return;
  }

  V.root = root;
  V.lastQuery = qkey;
  V.surah = 0;
  V.ayahs = null;
  V.activeKey = '';
  document.body.classList.add('is-quran');

  const pr = qprefs();
  root.innerHTML = shell(pr);
  bind(root);

  V.unsub?.();
  V.unsub = player.subscribe(onPlayer);
  V.playerSurah = player.state.active ? player.state.surah : 0;
  paintPlayer();
  loadIndex();

  const P = player.state;
  const s = clampS(+q.s || (P.active ? P.surah : pr.surah));
  const a = q.s ? +q.a || 0 : P.active && P.surah === s ? P.index + 1 : pr.surah === s ? pr.ayah : 0;
  openSurah(s, a > 1 ? a : 0, { scroll: a > 1 });
}

function unmount() {
  V.unsub?.();
  V.unsub = null;
  V.root = null;
  document.body.classList.remove('is-quran');
  window.removeEventListener('keydown', onKey);
  window.removeEventListener('wheel', onUserScroll);
  window.removeEventListener('touchmove', onUserScroll);
}

/* =========================================================
   Markup
   ========================================================= */
function shell(pr) {
  return `
  <div class="page quran" data-size="${pr.size}" data-tafsir="${pr.tafsirMode}">
    <section class="qhero anim-in">
      <div class="qhero__art" aria-hidden="true"><span>۞</span></div>
      <div class="qhero__text">
        <span class="eyebrow">The Holy Qur’an · read &amp; listen</span>
        <h1 class="qhero__title" lang="ar" dir="rtl">القرآن الكريم</h1>
        <p class="qhero__sub">Each verse lights up as it is recited, the page follows the reciter, and its tafsīr opens in Arabic right beneath it.</p>
      </div>
    </section>

    <div class="quran__grid">
      <aside class="qindex card" data-q-index>
        <button class="qindex__toggle" type="button" data-q-toggle-index aria-expanded="false">
          <span class="qindex__now">${icon('book')} <b data-q-current>Choose a surah</b></span>${icon('chevronDown')}
        </button>
        <div class="qindex__body">
          <div class="qindex__tools">
            <input class="input" type="search" data-q-search placeholder="Search: name, meaning, number…" aria-label="Search surahs" autocomplete="off" />
            <div class="segmented qindex__tabs" role="tablist">
              <button type="button" role="tab" data-q-tab="surahs" aria-selected="true">All surahs</button>
              <button type="button" role="tab" data-q-tab="marks" aria-selected="false">Saved verses</button>
            </div>
          </div>
          <ol class="qindex__list" data-q-list><li class="qindex__empty">Loading the index…</li></ol>
        </div>
      </aside>

      <section class="qreader" data-q-reader>
        ${settingsHtml(pr)}
        <div class="qreader__body" data-q-body>${loadingHtml()}</div>
        ${playerHtml()}
      </section>
    </div>
  </div>`;
}

function settingsHtml(pr) {
  const sw = (key, label, on) => `
    <label class="switch">
      <input type="checkbox" data-q-switch="${key}" ${on ? 'checked' : ''} />
      <span class="switch__track"><span class="switch__thumb"></span></span>
      <span class="fs-sm">${label}</span>
    </label>`;
  return `
    <details class="qsettings card">
      <summary>
        ${icon('settings')}
        <span>Reading &amp; listening</span>
        <span class="qsettings__sum" data-q-sum>${esc(reciterOf(pr.reciter).en)} · <span lang="ar">${esc(tafsirOf(pr.tafsir).ar)}</span></span>
      </summary>
      <div class="qsettings__grid">
        <div class="field">
          <span class="label">Reciter</span>
          <select class="select" data-q-reciter aria-label="Reciter">
            ${RECITERS.map((r) => `<option value="${r.id}" ${r.id === pr.reciter ? 'selected' : ''}>${esc(r.en)} — ${esc(r.ar)}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <span class="label">Tafsir (Arabic)</span>
          <select class="select" data-q-tafsir aria-label="Tafsir">
            ${TAFSIRS.map((t) => `<option value="${t.id}" ${t.id === pr.tafsir ? 'selected' : ''}>${esc(t.ar)} — ${esc(t.en)}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <span class="label">Show the tafsir</span>
          <div class="segmented" role="tablist" data-q-tmodes>
            ${TMODES.map(([id, label]) => `<button type="button" role="tab" data-q-tmode="${id}" aria-selected="${id === pr.tafsirMode}">${label}</button>`).join('')}
          </div>
        </div>
        <div class="field">
          <span class="label">Arabic text size</span>
          <div class="qsize">
            <button class="btn btn--sm" type="button" data-q-size="-1" aria-label="Smaller">A−</button>
            <span class="qsize__val" lang="ar" data-q-size-val>${arNum(pr.size)}</span>
            <button class="btn btn--sm" type="button" data-q-size="1" aria-label="Bigger">A+</button>
          </div>
        </div>
        <div class="qsettings__switches">
          ${sw('follow', 'Follow the reciter on screen', pr.follow)}
          ${sw('cont', 'Continue into the next surah', pr.cont)}
          ${sw('basmala', 'Recite the basmala before each surah', pr.basmala)}
        </div>
      </div>
    </details>`;
}

function playerHtml() {
  return `
    <div class="qplayer" data-q-player>
      <span class="qplayer__bar" aria-hidden="true"><span data-qp-progress></span></span>
      <div class="qplayer__now">
        <span class="qplayer__disc" aria-hidden="true">۞</span>
        <div class="qplayer__txt">
          <b data-qp-title>Ready when you are</b>
          <small data-qp-sub></small>
        </div>
      </div>
      <div class="qplayer__ctrls">
        <button class="iconbtn" type="button" data-qp="prev" aria-label="Previous verse">${icon('skipBack')}</button>
        <button class="qplayer__play" type="button" data-qp="toggle" aria-label="Play">${icon('play')}</button>
        <button class="iconbtn" type="button" data-qp="next" aria-label="Next verse">${icon('skipForward')}</button>
      </div>
      <div class="qplayer__opts">
        <button class="qchip" type="button" data-qp="repeat" title="Repeat">${icon('repeat')}<span data-qp-repeat></span></button>
        <button class="qchip" type="button" data-qp="rate" title="Speed"><span data-qp-rate></span></button>
      </div>
    </div>`;
}

const loadingHtml = () => `
  <div class="qskeleton" aria-busy="true">
    <div class="skeleton" style="height:120px;border-radius:24px"></div>
    <div class="skeleton" style="height:64px"></div><div class="skeleton" style="height:64px"></div><div class="skeleton" style="height:64px"></div>
  </div>`;

function surahHtml(s, ayahs, tafsir) {
  const pr = qprefs();
  const meta = V.list.find((x) => x.n === s);
  const showBasmala = s !== 1 && s !== 9;
  const tName = tafsirOf(pr.tafsir).ar;
  return `
    <header class="qsurah anim-in">
      <button class="iconbtn" type="button" data-q-go="${s - 1}" ${s <= 1 ? 'disabled' : ''} aria-label="Previous surah">${icon('chevronLeft')}</button>
      <div class="qsurah__frame">
        <span class="qsurah__num">${s}</span>
        <h2 class="qsurah__name" lang="ar" dir="rtl">${esc(meta?.ar || '')}</h2>
        <p class="qsurah__meta">${esc(meta?.en || `Surah ${s}`)}${meta ? ` · ${esc(meta.meaning)} · ${meta.ayahs} verses · ${meta.type === 'Meccan' ? 'Makki' : 'Madani'}` : ''}</p>
        <button class="btn btn--primary btn--sm mt-2" type="button" data-q-play-surah>${icon('play')} Listen from the start</button>
      </div>
      <button class="iconbtn" type="button" data-q-go="${s + 1}" ${s >= 114 ? 'disabled' : ''} aria-label="Next surah">${icon('chevronRight')}</button>
    </header>
    ${showBasmala ? `<p class="qbasmala" lang="ar" dir="rtl">${BASMALA}</p>` : ''}
    <ol class="qayahs" lang="ar" dir="rtl">
      ${ayahs.map((a, i) => ayahHtml(s, a, i, tafsir?.[i] || '', tName)).join('')}
    </ol>
    <footer class="qreader__end">
      ${s < 114 ? `<button class="btn btn--soft" type="button" data-q-go="${s + 1}">Next surah ${icon('arrowRight')}</button>` : '<p class="t-mute">صدق الله العظيم</p>'}
    </footer>`;
}

function ayahHtml(s, a, i, tafsirText, tName) {
  const marked = isMarked(s, a.n);
  return `
    <li class="qayah" data-i="${i}" id="ayah-${a.n}">
      <p class="qayah__text" data-q-play-ayah="${i}">${esc(a.text)}<span class="qayah__no" aria-label="Verse ${a.n}">${arNum(a.n)}</span>${a.sajda ? '<span class="qayah__sajda" title="Sajda">۩</span>' : ''}</p>
      <div class="qayah__tools" dir="ltr">
        <span class="qayah__ref">${s}:${a.n} · Juz ${a.juz} · p.${a.page}</span>
        <button class="iconbtn iconbtn--sm iconbtn--bare" type="button" data-q-play-ayah="${i}" aria-label="Play verse ${a.n}">${icon('play')}</button>
        <button class="iconbtn iconbtn--sm iconbtn--bare" type="button" data-q-tafsir-toggle="${i}" aria-label="Tafsir of verse ${a.n}">${icon('book')}</button>
        <button class="iconbtn iconbtn--sm iconbtn--bare ${marked ? 'is-on' : ''}" type="button" data-q-mark="${a.n}" aria-label="Save verse ${a.n}" aria-pressed="${marked}">${icon('bookmark')}</button>
        <button class="iconbtn iconbtn--sm iconbtn--bare" type="button" data-q-copy="${i}" aria-label="Copy verse ${a.n}">${icon('copy')}</button>
      </div>
      <div class="qayah__tafsir"><div>
        <span class="qayah__tname">${esc(tName)}</span>
        <p data-q-tafsir-text>${esc(tafsirText) || '<span class="t-mute">…</span>'}</p>
      </div></div>
      <span class="qayah__bar" aria-hidden="true"></span>
    </li>`;
}

/* =========================================================
   Data loading
   ========================================================= */
async function loadIndex() {
  try {
    V.list = await surahList();
  } catch (err) {
    const list = V.root?.querySelector('[data-q-list]');
    if (list) list.innerHTML = `<li class="qindex__empty">${esc(err.message)}</li>`;
    return;
  }
  if (!V.root) return;
  paintIndex();
  paintCurrent();
  // The header may have been painted before the index arrived.
  const head = V.root.querySelector('.qsurah__name');
  const meta = V.list.find((x) => x.n === V.surah);
  if (head && meta && !head.textContent) {
    head.textContent = meta.ar;
    V.root.querySelector('.qsurah__meta').textContent = `${meta.en} · ${meta.meaning} · ${meta.ayahs} verses · ${meta.type === 'Meccan' ? 'Makki' : 'Madani'}`;
  }
}

async function openSurah(s, ayah = 0, { scroll = true } = {}) {
  const root = V.root;
  if (!root) return;
  const body = root.querySelector('[data-q-body]');
  const my = ++V.req;
  const pr = qprefs();

  if (V.surah !== s || !V.ayahs) {
    V.surah = s;
    V.ayahs = null;
    V.activeKey = '';
    body.innerHTML = loadingHtml();
    paintCurrent();
    collapseIndex();
    try {
      const [ayahs, tafsir] = await Promise.all([surahText(s), surahTafsir(s, pr.tafsir).catch(() => null)]);
      if (my !== V.req || V.root !== root) return;
      V.ayahs = ayahs;
      V.tafsir = tafsir;
      body.innerHTML = surahHtml(s, ayahs, tafsir);
      if (!tafsir) toast('The tafsir could not be loaded — the text is still here.', 'info');
    } catch (err) {
      if (my !== V.req || V.root !== root) return;
      body.innerHTML = `
        <div class="empty card">
          <div class="empty__icon">${icon('book')}</div>
          <h3>Couldn’t open this surah</h3>
          <p class="t-mute">${esc(err.message)}</p>
          <button class="btn btn--primary mt-3" type="button" data-q-retry>${icon('refresh')} Try again</button>
        </div>`;
      return;
    }
    paintIndex();
    syncActive(true);
  }

  if (ayah > 0) {
    const el = root.querySelector(`#ayah-${ayah}`);
    if (el && scroll) {
      el.classList.add('is-target');
      setTimeout(() => el.classList.remove('is-target'), 2200);
      requestAnimationFrame(() => el.scrollIntoView({ block: 'center', behavior: ayah > 1 ? 'smooth' : 'auto' }));
    }
  } else if (scroll) {
    root.querySelector('.quran__grid')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
}

async function reloadTafsir() {
  const root = V.root;
  if (!root || !V.ayahs) return;
  const s = V.surah;
  const pr = qprefs();
  root.querySelectorAll('[data-q-tafsir-text]').forEach((p) => { p.innerHTML = '<span class="t-mute">…</span>'; });
  try {
    const tafsir = await surahTafsir(s, pr.tafsir);
    if (V.root !== root || V.surah !== s) return;
    V.tafsir = tafsir;
    const name = tafsirOf(pr.tafsir).ar;
    root.querySelectorAll('.qayah').forEach((li) => {
      li.querySelector('[data-q-tafsir-text]').textContent = tafsir[+li.dataset.i] || '';
      li.querySelector('.qayah__tname').textContent = name;
    });
  } catch (err) {
    toast(err.message, 'error');
  }
}

/* =========================================================
   Index (surah list + saved verses)
   ========================================================= */
function paintIndex() {
  const ol = V.root?.querySelector('[data-q-list]');
  if (!ol || !V.list.length) return;
  if (V.tab === 'marks') {
    const marks = qprefs().marks;
    ol.innerHTML = marks.length
      ? marks
          .map((m) => {
            const [s, a] = m.split(':').map(Number);
            const meta = V.list.find((x) => x.n === s);
            return `<li><button class="qitem" type="button" data-q-open="${s}" data-q-ayah="${a}">
              <span class="qitem__num">${icon('bookmark')}</span>
              <span class="qitem__en"><b>${esc(meta?.en || `Surah ${s}`)}</b><small>Verse ${a}</small></span>
              <span class="qitem__ar" lang="ar">${arNum(s)}:${arNum(a)}</span></button></li>`;
          })
          .join('')
      : '<li class="qindex__empty">Tap the bookmark on any verse to keep it here.</li>';
    return;
  }
  const f = V.filter.trim().toLowerCase();
  const fa = plainArabic(V.filter.trim());
  const rows = V.list.filter((s) =>
    !f ||
    String(s.n) === f ||
    s.en.toLowerCase().includes(f) ||
    s.meaning.toLowerCase().includes(f) ||
    plainArabic(s.ar).includes(fa)
  );
  ol.innerHTML = rows.length
    ? rows
        .map(
          (s) => `<li><button class="qitem ${s.n === V.surah ? 'is-current' : ''} ${player.state.active && player.state.surah === s.n ? 'is-playing' : ''}" type="button" data-q-open="${s.n}">
            <span class="qitem__num">${s.n}</span>
            <span class="qitem__en"><b>${esc(s.en)}</b><small>${esc(s.meaning)} · ${s.ayahs}</small></span>
            <span class="qitem__ar" lang="ar" dir="rtl">${esc(s.ar.replace(/^سُورَةُ\s*/, ''))}</span>
          </button></li>`
        )
        .join('')
    : '<li class="qindex__empty">No surah matches that search.</li>';
  if (!f) ol.querySelector('.is-current')?.scrollIntoView({ block: 'nearest' });
}

function paintCurrent() {
  const b = V.root?.querySelector('[data-q-current]');
  if (!b) return;
  const meta = V.list.find((x) => x.n === V.surah);
  b.textContent = meta ? `${meta.n}. ${meta.en} — ${meta.ar.replace(/^سُورَةُ\s*/, '')}` : `Surah ${V.surah}`;
}

function collapseIndex() {
  const aside = V.root?.querySelector('[data-q-index]');
  if (!aside) return;
  aside.classList.remove('is-open');
  aside.querySelector('[data-q-toggle-index]')?.setAttribute('aria-expanded', 'false');
}

/* =========================================================
   Player ↔ reader
   ========================================================= */
function onPlayer(kind, P) {
  if (!V.root) return;
  if (kind === 'progress') { paintProgress(P); return; }

  // Continuous listening moved on to the next surah: bring the text along.
  if (P.active && P.surah && P.surah !== V.playerSurah) {
    const was = V.playerSurah;
    V.playerSurah = P.surah;
    if (was && was === V.surah && qprefs().follow) openSurah(P.surah, 0, { scroll: false });
    paintIndex();
  }
  if (P.error) { toast(P.error, 'error'); P.error = ''; }
  paintPlayer();
  syncActive(false);
}

function syncActive(initial) {
  const root = V.root;
  if (!root) return;
  const P = player.state;
  const here = P.active && P.surah === V.surah && P.phase !== 'idle';
  const key = here ? `${P.surah}:${P.phase === 'basmala' ? 'b' : P.index}` : '';
  root.querySelector('.quran')?.classList.toggle('is-listening', here && P.playing);
  root.querySelector('.qbasmala')?.classList.toggle('is-active', here && P.phase === 'basmala');
  if (key === V.activeKey && !initial) return;
  V.activeKey = key;

  root.querySelectorAll('.qayah.is-active').forEach((el) => el.classList.remove('is-active'));
  if (!here) return;
  const target = P.phase === 'basmala' ? root.querySelector('.qbasmala') : root.querySelector(`.qayah[data-i="${P.index}"]`);
  if (!target) return;
  if (P.phase === 'ayah') {
    target.classList.add('is-active');
    target.classList.add('is-heard');
  }
  if (qprefs().follow && Date.now() - V.userScrollAt > 3500) {
    target.scrollIntoView({ block: 'center', behavior: initial ? 'auto' : 'smooth' });
  }
}

function paintProgress(P) {
  const pct = P.dur ? Math.min(100, (P.time / P.dur) * 100) : 0;
  const root = V.root;
  if (!root) return;
  const bar = root.querySelector('[data-qp-progress]');
  if (bar) bar.style.width = `${pct}%`;
  const active = root.querySelector('.qayah.is-active .qayah__bar');
  if (active) active.style.setProperty('--p', (pct / 100).toFixed(3));
}

function paintPlayer() {
  const root = V.root;
  const el = root?.querySelector('[data-q-player]');
  if (!el) return;
  const P = player.state;
  const pr = qprefs();
  const title = el.querySelector('[data-qp-title]');
  const sub = el.querySelector('[data-qp-sub]');
  if (P.active) {
    title.textContent = `${P.name?.en || `Surah ${P.surah}`} · ${P.phase === 'basmala' ? 'Basmala' : `${P.index + 1} / ${P.count || '…'}`}`;
  } else {
    const meta = V.list.find((x) => x.n === pr.surah);
    title.textContent = pr.surah > 1 || pr.ayah > 1 ? `Continue · ${meta?.en || `Surah ${pr.surah}`} ${pr.ayah}` : 'Tap play or any verse';
  }
  sub.textContent = `${reciterOf(pr.reciter).en} · ${reciterOf(pr.reciter).ar}`;
  const play = el.querySelector('[data-qp="toggle"]');
  play.innerHTML = P.loading && P.playing ? '<span class="qspin" aria-hidden="true"></span>' : icon(P.playing ? 'pause' : 'play');
  play.setAttribute('aria-label', P.playing ? 'Pause' : 'Play');
  el.classList.toggle('is-playing', P.playing && !P.loading);
  el.querySelector('[data-qp-repeat]').textContent = REPEAT_LABEL[pr.repeat];
  el.querySelector('[data-qp="repeat"]').classList.toggle('is-on', pr.repeat !== 'off');
  el.querySelector('[data-qp-rate]').textContent = `${pr.rate}×`;
  paintProgress(P);
}

/* =========================================================
   Events
   ========================================================= */
function onUserScroll() { V.userScrollAt = Date.now(); }

function onKey(e) {
  if (!V.root || e.target.matches('input, textarea, select, button, a, summary, [contenteditable]')) return;
  if (isPaletteOpen() || document.querySelector('.modal, .sheet')) return;
  if (e.key === ' ' || e.code === 'Space') { e.preventDefault(); player.toggle(); }
  else if (e.key === 'ArrowRight' && e.altKey) player.next();
  else if (e.key === 'ArrowLeft' && e.altKey) player.prev();
}

function playVerse(i) {
  const P = player.state;
  if (P.active && P.surah === V.surah && P.index === i && P.phase === 'ayah') { player.toggle(); return; }
  V.userScrollAt = 0;
  player.playAt(V.surah, i, { intro: i === 0 });
}

function bind(root) {
  window.addEventListener('keydown', onKey);
  window.addEventListener('wheel', onUserScroll, { passive: true });
  window.addEventListener('touchmove', onUserScroll, { passive: true });

  const search = root.querySelector('[data-q-search]');
  search.addEventListener(
    'input',
    debounce(() => {
      V.filter = search.value;
      if (V.tab !== 'surahs') setTab('surahs');
      else paintIndex();
    }, 120)
  );
  search.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const first = root.querySelector('[data-q-list] [data-q-open]');
    if (first) first.click();
  });

  root.querySelector('[data-q-reciter]').addEventListener('change', (e) => {
    player.setReciter(e.target.value);
    paintSummary();
    paintPlayer();
  });
  root.querySelector('[data-q-tafsir]').addEventListener('change', (e) => {
    saveQprefs({ tafsir: e.target.value });
    paintSummary();
    reloadTafsir();
  });
  root.querySelectorAll('[data-q-switch]').forEach((input) =>
    input.addEventListener('change', () => saveQprefs({ [input.dataset.qSwitch]: input.checked }))
  );

  root.addEventListener('click', (e) => {
    const t = e.target.closest('button, [data-q-play-ayah]');
    if (!t || !root.contains(t)) return;
    const d = t.dataset;

    if (d.qOpen) {
      const s = +d.qOpen;
      V.lastQuery = `${s}:${d.qAyah || ''}`;
      navigate(`/quran?s=${s}${d.qAyah ? `&a=${d.qAyah}` : ''}`, { replace: true });
      openSurah(s, +d.qAyah || 0);
    } else if (d.qGo) {
      const s = clampS(+d.qGo);
      V.lastQuery = `${s}:`;
      navigate(`/quran?s=${s}`, { replace: true });
      openSurah(s, 0);
    } else if (d.qPlayAyah !== undefined) {
      // Selecting text to copy shouldn't start the recitation.
      if (t.tagName !== 'BUTTON' && String(window.getSelection?.() || '').trim()) return;
      playVerse(+d.qPlayAyah);
    } else if ('qPlaySurah' in d) {
      V.userScrollAt = 0;
      player.playAt(V.surah, 0);
    } else if (d.qTafsirToggle !== undefined) {
      t.closest('.qayah')?.classList.toggle('is-open');
    } else if (d.qMark) {
      const on = toggleMark(V.surah, +d.qMark);
      t.classList.toggle('is-on', on);
      t.setAttribute('aria-pressed', String(on));
      toast(on ? 'Verse saved 🔖' : 'Removed from saved verses', 'info', 1600);
      if (V.tab === 'marks') paintIndex();
    } else if (d.qCopy !== undefined) {
      copyVerse(+d.qCopy);
    } else if (d.qTab) {
      setTab(d.qTab);
    } else if ('qToggleIndex' in d) {
      const aside = t.closest('[data-q-index]');
      const open = aside.classList.toggle('is-open');
      t.setAttribute('aria-expanded', String(open));
      if (open) setTimeout(() => search.focus({ preventScroll: true }), 60);
    } else if (d.qTmode) {
      saveQprefs({ tafsirMode: d.qTmode });
      root.querySelector('.quran').dataset.tafsir = d.qTmode;
      root.querySelectorAll('[data-q-tmode]').forEach((b) => b.setAttribute('aria-selected', String(b === t)));
    } else if (d.qSize) {
      const size = Math.min(6, Math.max(1, qprefs().size + +d.qSize));
      saveQprefs({ size });
      root.querySelector('.quran').dataset.size = size;
      root.querySelector('[data-q-size-val]').textContent = arNum(size);
    } else if ('qRetry' in d) {
      const s = V.surah;
      V.surah = 0;
      openSurah(s, 0);
    } else if (d.qp === 'toggle') {
      const P = player.state;
      if (!P.active) {
        const pr = qprefs();
        // Resume where you left off when reading that surah, else start this one.
        player.playAt(V.surah, pr.surah === V.surah ? Math.max(0, pr.ayah - 1) : 0, { intro: !(pr.surah === V.surah && pr.ayah > 1) });
      } else player.toggle();
    } else if (d.qp === 'next') player.next();
    else if (d.qp === 'prev') player.prev();
    else if (d.qp === 'repeat') {
      const pr = qprefs();
      player.setRepeat(REPEATS[(REPEATS.indexOf(pr.repeat) + 1) % REPEATS.length]);
      paintPlayer();
    } else if (d.qp === 'rate') {
      const pr = qprefs();
      player.setRate(RATES[(RATES.indexOf(pr.rate) + 1) % RATES.length]);
      paintPlayer();
    }
  });
}

function setTab(tab) {
  V.tab = tab;
  V.root?.querySelectorAll('[data-q-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.qTab === tab)));
  paintIndex();
}

function paintSummary() {
  const pr = qprefs();
  const el = V.root?.querySelector('[data-q-sum]');
  if (el) el.innerHTML = `${esc(reciterOf(pr.reciter).en)} · <span lang="ar">${esc(tafsirOf(pr.tafsir).ar)}</span>`;
}

async function copyVerse(i) {
  const a = V.ayahs?.[i];
  if (!a) return;
  const meta = V.list.find((x) => x.n === V.surah);
  const text = `${a.text} ﴿${arNum(a.n)}﴾\n— ${meta?.en || 'Surah'} ${V.surah}:${a.n}`;
  try {
    await navigator.clipboard.writeText(text);
    toast('Verse copied', 'success', 1400);
  } catch {
    toast('Copy is not available here', 'error');
  }
}
return Object.freeze({ meta, render, unmount });
  })();

  /* ===== js/views/notes.js ===== */
  const __m46 = (function () {
const { esc, toMillis, timeAgo, debounce, ymd } = __m1;
const { icon } = __m3;
const { modal, toast, confirmDialog } = __m2;
const store = __m8;
const { MOODS } = __m4;
const { openNoteForm } = __m14;
/**
 * LifeFlow — Notes & Journal.
 */







const meta = { title: 'Journal', icon: 'note', label: 'Notes' };

const ui = { tab: 'all', search: '' };

function render(root) {
  const notes = filtered();
  const journalCount = store.select.journalEntries().length;
  const noteCount = store.state.notes.length - journalCount;

  root.innerHTML = `
    <div class="page">
      <section class="card card--accent">
        <div class="flex-between">
          <div>
            <span class="eyebrow">Think it, keep it</span>
            <h2>${store.state.notes.length ? `${store.state.notes.length} entries` : 'Your quiet space'}</h2>
            <p class="fs-sm t-dim">${noteCount} note${noteCount === 1 ? '' : 's'} · ${journalCount} journal entr${journalCount === 1 ? 'y' : 'ies'}</p>
          </div>
          <button class="btn btn--primary btn--sm" data-new type="button">${icon('plus')} Write</button>
        </div>
      </section>

      <section class="grid" style="gap:var(--s-3)">
        <div class="field field--icon">
          ${icon('search', 'field__icon')}
          <input class="input" type="search" placeholder="Search your notes…" value="${esc(ui.search)}" data-search aria-label="Search notes" />
        </div>
        <div class="segmented" role="tablist">
          <button role="tab" data-tab="all" aria-selected="${ui.tab === 'all'}">All</button>
          <button role="tab" data-tab="note" aria-selected="${ui.tab === 'note'}">Notes</button>
          <button role="tab" data-tab="journal" aria-selected="${ui.tab === 'journal'}">Journal</button>
        </div>
      </section>

      ${todayPrompt()}

      <section data-list>${notes.length ? grid(notes) : empty()}</section>
    </div>`;

  bind(root);
}

function filtered() {
  let list = [...store.state.notes].sort((a, b) => toMillis(b.updatedAt || b.createdAt) - toMillis(a.updatedAt || a.createdAt));
  if (ui.tab !== 'all') list = list.filter((n) => (n.type || 'note') === ui.tab);
  const s = ui.search.trim().toLowerCase();
  if (s) list = list.filter((n) => `${n.title} ${n.body} ${(n.tags || []).join(' ')}`.toLowerCase().includes(s));
  return list;
}

function grid(notes) {
  return `<div class="notes-grid stagger">${notes.map(card).join('')}</div>`;
}

function card(n) {
  return `
    <article class="note" data-open="${esc(n.id)}" style="--note-color:${esc(n.color || 'var(--accent)')}" role="button" tabindex="0">
      <div class="flex-between">
        <span class="note__title">${esc(n.title || 'Untitled')}</span>
        ${n.type === 'journal' ? `<span class="chip chip--accent">${icon('book')}</span>` : ''}
      </div>
      <p class="note__body">${esc(n.body || '')}</p>
      <div class="note__foot">
        <span class="meta">${icon('clock')} ${esc(timeAgo(toMillis(n.updatedAt || n.createdAt)))}</span>
        ${(n.tags || []).slice(0, 2).map((t) => `<span class="chip">#${esc(t)}</span>`).join('')}
      </div>
    </article>`;
}

function todayPrompt() {
  const has = store.select
    .journalEntries()
    .some((n) => ymd(new Date(toMillis(n.createdAt))) === ymd());
  if (has) return '';
  const mood = store.moodFor();
  const m = MOODS.find((x) => x.id === mood);
  return `
    <section class="card" style="border-style:dashed">
      <div class="flex gap-3">
        <span style="font-size:1.6rem">${m ? m.emoji : '✍️'}</span>
        <div class="grow">
          <div class="fw-7 fs-sm">How was your day?</div>
          <div class="fs-xs t-mute">Take 60 seconds to reflect — future-you will love reading this.</div>
        </div>
        <button class="btn btn--xs btn--soft" data-journal type="button">Write</button>
      </div>
    </section>`;
}

function empty() {
  return `
    <div class="empty">
      <div class="empty__icon">${icon('note')}</div>
      <h3>${ui.search ? 'Nothing found' : 'A blank page awaits'}</h3>
      <p>${ui.search ? 'Try a different search term.' : 'Capture ideas, reflections, gratitude or plans.'}</p>
      ${ui.search ? '' : `<button class="btn btn--primary btn--sm" data-new type="button">${icon('plus')} Write something</button>`}
    </div>`;
}

function bind(root) {
  root.querySelectorAll('[data-tab]').forEach((b) =>
    b.addEventListener('click', () => { ui.tab = b.dataset.tab; render(root); })
  );
  root.querySelectorAll('[data-new]').forEach((b) =>
    b.addEventListener('click', () => openNoteForm(null, { type: ui.tab === 'journal' ? 'journal' : 'note' }))
  );
  root.querySelector('[data-journal]')?.addEventListener('click', () => openNoteForm(null, { type: 'journal' }));

  root.querySelector('[data-search]')?.addEventListener(
    'input',
    debounce((e) => {
      ui.search = e.target.value;
      const node = root.querySelector('[data-list]');
      const list = filtered();
      node.innerHTML = list.length ? grid(list) : empty();
      bindCards(node);
      node.querySelectorAll('[data-new]').forEach((b) => b.addEventListener('click', () => openNoteForm()));
    }, 200)
  );

  bindCards(root);
}

function bindCards(scope) {
  scope.querySelectorAll('[data-open]').forEach((node) => {
    const open = () => {
      const n = store.state.notes.find((x) => x.id === node.dataset.open);
      if (n) openViewer(n);
    };
    node.addEventListener('click', open);
    node.addEventListener('keydown', (e) => { if (e.key === 'Enter') open(); });
  });
}

function openViewer(n) {
  modal({
    title: n.title || 'Untitled',
    body: `
      <div class="grid" style="gap:var(--s-3)">
        <div class="flex gap-2 flex-wrap">
          <span class="chip">${n.type === 'journal' ? '📓 Journal' : '📝 Note'}</span>
          <span class="chip">${esc(timeAgo(toMillis(n.updatedAt || n.createdAt)))}</span>
          ${(n.tags || []).map((t) => `<span class="chip chip--accent">#${esc(t)}</span>`).join('')}
        </div>
        <p style="white-space:pre-wrap;line-height:1.7;font-size:.92rem">${esc(n.body || '')}</p>
      </div>`,
    footer: `
      <button class="btn btn--danger btn--icon" data-del type="button" aria-label="Delete">${icon('trash')}</button>
      <button class="btn btn--ghost" data-modal-close type="button">Close</button>
      <button class="btn btn--primary" data-edit type="button">Edit</button>`,
    onMount(box, close) {
      box.querySelector('[data-edit]').addEventListener('click', () => { close(); openNoteForm(n); });
      box.querySelector('[data-del]').addEventListener('click', async () => {
        const ok = await confirmDialog({
          title: 'Delete entry?',
          message: 'This cannot be undone.',
          confirmText: 'Delete',
          danger: true
        });
        if (!ok) return;
        await store.remove('notes', n.id);
        close();
        toast('Entry deleted', 'info');
      });
    }
  });
}
return Object.freeze({ meta, render });
  })();

  /* ===== js/views/archive.js ===== */
  const __m47 = (function () {
const { esc, fmtMoney, today, pct } = __m1;
const { icon } = __m3;
const { ring, animateProgress } = __m2;
const store = __m8;
const { MOODS } = __m4;
const { navigate } = __m6;
/**
 * LifeFlow — Archive: every month you have lived, kept as a small report.
 *
 * Nothing new is stored; the archive is derived from what you already logged,
 * so past months stay accurate even as the app grows.
 */







const meta = { title: 'Archive', icon: 'archive', label: 'Archive' };

const ui = { month: null };

function render(root) {
  const months = store.select.monthsWithData();
  const current = today().slice(0, 7);
  if (!ui.month || !months.includes(ui.month)) ui.month = months[0] || current;

  const m = store.select.monthSummary(ui.month);
  const prev = months[months.indexOf(ui.month) + 1] || null;
  const next = months[months.indexOf(ui.month) - 1] || null;
  const currency = store.currency();
  const prayerEnabled = store.prefs().prayer.enabled || m.prayers.tracked > 0;

  root.innerHTML = `
    <div class="page">
      <section class="hero-card anim-in">
        <div class="hero-card__grid">
          <div class="grow">
            <span class="eyebrow">${esc(m.isCurrent ? 'This month, so far' : 'Archived month')}</span>
            <h1>${esc(m.label)}</h1>
            <p class="mt-2">${esc(story(m, currency))}</p>
          </div>
          <div class="hero-card__ring">
            ${ring(m.score, { size: 112, stroke: 11, label: `${m.score}%`, caption: 'Month' })}
          </div>
        </div>
      </section>

      <section class="arch-nav">
        <button class="iconbtn" data-go-month="${esc(prev || '')}" ${prev ? '' : 'disabled'}
                type="button" aria-label="Previous month">${icon('chevronLeft')}</button>
        <div class="arch-rail" data-rail>
          ${months.map(monthPill).join('')}
        </div>
        <button class="iconbtn" data-go-month="${esc(next || '')}" ${next ? '' : 'disabled'}
                type="button" aria-label="Next month">${icon('chevronRight')}</button>
      </section>

      ${
        m.empty
          ? `<div class="empty">
              <div class="empty__icon">${icon('archive')}</div>
              <h3>Nothing recorded in ${esc(m.label)}</h3>
              <p>Months fill themselves as you use LifeFlow — tasks, habits, money, moods and prayers all land here.</p>
              <button class="btn btn--primary btn--sm" data-go="/dashboard" type="button">Back to today ${icon('arrowRight')}</button>
            </div>`
          : report(m, currency, prayerEnabled)
      }
    </div>`;

  bind(root);
  animateProgress(root);
  root.querySelector('.arch-pill.is-active')?.scrollIntoView({ block: 'nearest', inline: 'center' });
}

function monthPill(key) {
  const [y, mo] = key.split('-').map(Number);
  const d = new Date(y, mo - 1, 1);
  const isCurrent = key === today().slice(0, 7);
  return `
    <button class="arch-pill${key === ui.month ? ' is-active' : ''}" data-month="${esc(key)}" type="button">
      <b>${esc(d.toLocaleDateString(undefined, { month: 'short' }))}</b>
      <span>${isCurrent ? 'now' : y}</span>
    </button>`;
}

function report(m, currency, prayerEnabled) {
  return `
    <section class="stat-rail stagger">
      ${tile('checkCircle', m.tasks.done, 'Tasks done')}
      ${tile('flame', `${m.habits.rate}%`, 'Habit rhythm')}
      ${prayerEnabled ? tile('mosque', `${m.prayers.rate}%`, 'Salat kept') : tile('note', m.notes.journal, 'Journal entries')}
      ${tile('wallet', fmtMoney(m.money.net, currency, true), 'Net this month')}
    </section>

    <div class="g-main">
      <div class="grid" style="gap:var(--s-4)">

        <section class="card">
          <div class="card__head">
            <h3 class="card__title">${icon('grid')} Day by day</h3>
            <span class="chip">${esc(m.elapsed)} of ${esc(m.days)} days</span>
          </div>
          <div class="arch-cal">
            ${m.daily.map(dayCell).join('')}
          </div>
          ${
            m.busiest && m.busiest.tasks + m.busiest.habits > 0
              ? `<p class="fs-xs t-mute mt-3">Busiest day: <b>${esc(m.busiest.day)} ${esc(m.short)}</b> — ${m.busiest.tasks} task${m.busiest.tasks === 1 ? '' : 's'}, ${m.busiest.habits} habit${m.busiest.habits === 1 ? '' : 's'}.</p>`
              : ''
          }
        </section>

        <section class="card">
          <div class="card__head">
            <h3 class="card__title">${icon('wallet')} Money</h3>
            <span class="chip ${m.money.net >= 0 ? 'chip--accent' : 'chip--danger'}">${esc(fmtMoney(m.money.net, currency))}</span>
          </div>
          ${
            m.money.count
              ? `<div class="arch-money">
                  ${moneyBar('In', m.money.income, Math.max(m.money.income, m.money.expense), currency, 'success')}
                  ${moneyBar('Out', m.money.expense, Math.max(m.money.income, m.money.expense), currency, 'danger')}
                </div>
                <p class="fs-xs t-mute mt-3">${m.money.count} entr${m.money.count === 1 ? 'y' : 'ies'}${
                  m.money.topCategory ? ` · most spent on <b>${esc(m.money.topCategory[0])}</b> (${esc(fmtMoney(m.money.topCategory[1], currency))})` : ''
                }</p>`
              : `<p class="fs-sm t-mute">No money logged this month.</p>`
          }
        </section>

        <section class="card">
          <div class="card__head">
            <h3 class="card__title">${icon('smile')} How it felt</h3>
            <span class="chip">${m.moods.count} check-in${m.moods.count === 1 ? '' : 's'}</span>
          </div>
          ${
            m.moods.count
              ? `<div class="arch-moods">
                  ${MOODS.map((mood) => {
                    const n = m.moods.counts[mood.id] || 0;
                    return `<div class="arch-mood${m.moods.top === mood.id ? ' is-top' : ''}">
                      <span>${esc(mood.emoji)}</span>
                      <i style="--v:${pct(n, m.moods.count)}%"></i>
                      <b>${n}</b>
                    </div>`;
                  }).join('')}
                </div>
                <p class="fs-xs t-mute mt-3">Average mood ${m.moods.avg}% · mostly ${esc(MOODS.find((x) => x.id === m.moods.top)?.label || '—')}.</p>`
              : `<p class="fs-sm t-mute">No mood check-ins this month.</p>`
          }
        </section>
      </div>

      <div class="grid" style="gap:var(--s-4)">
        <section class="card">
          <div class="card__head">
            <h3 class="card__title">${icon('flame')} Habits</h3>
            <span class="chip chip--accent">${m.habits.hits} check-in${m.habits.hits === 1 ? '' : 's'}</span>
          </div>
          ${
            m.habits.rows.length
              ? `<div class="arch-list">
                  ${m.habits.rows.slice(0, 8).map(
                    (h) => `
                    <div class="arch-row">
                      <span class="arch-row__emoji">${esc(h.emoji)}</span>
                      <span class="grow truncate">${esc(h.title)}</span>
                      <span class="arch-row__val">${h.hits}d</span>
                      <div class="bar bar--thin" style="width:64px"><div class="bar__fill" data-val="${h.rate}"></div></div>
                    </div>`
                  ).join('')}
                </div>`
              : `<p class="fs-sm t-mute">No habits tracked this month.</p>`
          }
        </section>

        ${
          prayerEnabled
            ? `<section class="card">
                <div class="card__head">
                  <h3 class="card__title">${icon('mosque')} Salat</h3>
                  <span class="chip chip--accent">${m.prayers.fullDays} complete day${m.prayers.fullDays === 1 ? '' : 's'}</span>
                </div>
                <div class="flex-between mb-3">
                  <span class="fs-sm t-dim">${m.prayers.hits} prayers marked</span>
                  <b>${m.prayers.rate}%</b>
                </div>
                <div class="bar"><div class="bar__fill" data-val="${m.prayers.rate}"></div></div>
                <p class="fs-xs t-mute mt-3">Out of ${5 * (m.elapsed || m.days)} prayers in ${esc(m.label)}.</p>
              </section>`
            : ''
        }

        <section class="card">
          <div class="card__head">
            <h3 class="card__title">${icon('layers')} Everything else</h3>
          </div>
          <div class="arch-list">
            ${miniRow('tasks', 'Tasks created', m.tasks.created)}
            ${miniRow('calendar', 'Events & appointments', m.events.count)}
            ${miniRow('note', 'Notes written', m.notes.count)}
            ${miniRow('book', 'Journal entries', m.notes.journal)}
            ${miniRow('target', 'Goals started', m.goals.created)}
            ${miniRow('star', 'Goals completed', m.goals.completed)}
          </div>
        </section>

        ${
          m.tasks.list.length
            ? `<section class="card">
                <div class="card__head">
                  <h3 class="card__title">${icon('checkCircle')} What you finished</h3>
                  <span class="chip">${m.tasks.done}</span>
                </div>
                <div class="arch-list">
                  ${m.tasks.list.slice(0, 10).map(
                    (t) => `<div class="arch-row"><span class="arch-row__dot"></span><span class="grow truncate">${esc(t.title)}</span>
                      <span class="arch-row__val">${new Date(t.doneAt).getDate()} ${esc(m.short)}</span></div>`
                  ).join('')}
                </div>
                ${m.tasks.done > 10 ? `<p class="fs-xs t-mute mt-3">+ ${m.tasks.done - 10} more.</p>` : ''}
              </section>`
            : ''
        }
      </div>
    </div>`;
}

/* ------------------------------ small pieces ------------------------------ */
function tile(ic, value, label) {
  return `<div class="stat"><span class="stat__icon">${icon(ic)}</span><span class="stat__val">${esc(value)}</span><span class="stat__lbl">${esc(label)}</span></div>`;
}

function miniRow(ic, label, value) {
  return `<div class="arch-row"><span class="arch-row__icon">${icon(ic)}</span><span class="grow truncate">${esc(label)}</span><b>${esc(value)}</b></div>`;
}

function moneyBar(label, value, max, currency, tone) {
  return `
    <div class="arch-money__row">
      <span>${esc(label)}</span>
      <div class="arch-money__track"><i style="--v:${pct(value, max)}%;--tone:var(--${tone})"></i></div>
      <b>${esc(fmtMoney(value, currency, true))}</b>
    </div>`;
}

function dayCell(d) {
  const level = Math.min(4, d.tasks + d.habits);
  const mood = MOODS.find((x) => x.id === d.mood);
  return `<i data-n="${level}" data-prayers="${d.prayers}" title="${esc(d.key)} — ${d.tasks} tasks, ${d.habits} habits${
    d.prayers ? `, ${d.prayers}/5 prayers` : ''
  }${mood ? `, ${mood.label}` : ''}"><span>${d.day}</span></i>`;
}

function story(m, currency) {
  if (m.empty) return 'A quiet month — nothing was recorded.';
  const bits = [];
  if (m.tasks.done) bits.push(`${m.tasks.done} task${m.tasks.done === 1 ? '' : 's'} finished`);
  if (m.habits.hits) bits.push(`${m.habits.hits} habit check-in${m.habits.hits === 1 ? '' : 's'}`);
  if (m.prayers.hits) bits.push(`${m.prayers.hits} prayers kept`);
  if (m.money.count) bits.push(`${fmtMoney(m.money.net, currency, true)} net`);
  if (m.moods.count) bits.push(`${m.moods.count} mood check-in${m.moods.count === 1 ? '' : 's'}`);
  return bits.length ? `${bits.slice(0, 3).join(' · ')}.` : 'Your month, kept safely.';
}

/* ------------------------------ events ------------------------------ */
function bind(root) {
  root.querySelectorAll('[data-month]').forEach((b) =>
    b.addEventListener('click', () => {
      ui.month = b.dataset.month;
      render(root);
    })
  );

  root.querySelectorAll('[data-go-month]').forEach((b) =>
    b.addEventListener('click', () => {
      if (!b.dataset.goMonth) return;
      ui.month = b.dataset.goMonth;
      render(root);
    })
  );

  root.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => navigate(b.dataset.go)));
}
return Object.freeze({ meta, render });
  })();

  /* ===== js/views/profile.js ===== */
  const __m48 = (function () {
const { esc, initials, downloadJSON, toMillis, timeAgo } = __m1;
const { icon } = __m3;
const { theme, modal, toast, confirmDialog, withLoading, animateProgress } = __m2;
const store = __m8;
const { ACCENTS, THEME_GROUPS, CURRENCIES, APP, GOOGLE } = __m4;
const { navigate } = __m6;
const { openBreathe } = __m13;
const notify = __m10;
const gcal = __m11;
const { auth, storage, storageRef, uploadBytes, getDownloadURL, updateProfile, updatePassword, reauthenticateWithCredential, EmailAuthProvider, sendPasswordResetEmail, signOut, authErrorMessage } = __m7;
/**
 * LifeFlow — Profile & settings.
 */











const meta = { title: 'Profile', icon: 'user', label: 'Profile' };

/** Kept so the notification / sync panels can redraw themselves after a change. */
let mountRoot = null;

function render(root) {
  mountRoot = root;
  const s = store.state;
  const p = store.prefs();
  const profile = s.profile || {};
  const name = profile.name || s.user?.displayName || '';
  const email = s.user?.email || profile.email || '';
  const photo = profile.photoURL || s.user?.photoURL || '';
  const badges = store.select.earnedBadges();
  const earned = badges.filter((b) => b.earned);
  const memberSince = toMillis(profile.createdAt);

  root.innerHTML = `
    <div class="page">
      <section class="profile-hero">
        <div class="profile-hero__avatar">
          <div class="avatar avatar--xl">${photo ? `<img src="${esc(photo)}" alt="" />` : esc(initials(name, email))}</div>
          <button class="profile-hero__edit" data-photo type="button" aria-label="Change photo">${icon('camera')}</button>
        </div>
        <div>
          <h2>${esc(name || 'Your name')}</h2>
          <p class="fs-sm t-dim">${esc(email)}</p>
        </div>
        <div class="flex gap-2 flex-wrap" style="justify-content:center">
          <span class="chip chip--accent">${icon('star')} ${earned.length} badges</span>
          <span class="chip">${icon('checkCircle')} ${profile.stats?.tasksDone || 0} tasks done</span>
          ${memberSince ? `<span class="chip">${icon('calendar')} since ${esc(new Date(memberSince).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }))}</span>` : ''}
        </div>
        <button class="btn btn--soft btn--sm" data-edit-profile type="button">${icon('edit')} Edit profile</button>
      </section>

      <!-- Achievements -->
      <section class="card">
        <div class="card__head">
          <h3 class="card__title">${icon('star')} Achievements</h3>
          <span class="chip chip--accent">${earned.length}/${badges.length}</span>
        </div>
        <div class="g-4" style="gap:var(--s-3)">
          ${badges
            .map(
              (b) => `
            <div class="badge-item${b.earned ? '' : ' is-locked'}" title="${esc(b.hint)}">
              <span>${b.emoji}</span><span>${esc(b.label)}</span>
            </div>`
            )
            .join('')}
        </div>
      </section>

      <!-- Appearance -->
      <section class="card">
        <div class="card__head"><h3 class="card__title">${icon('sparkles')} Appearance</h3></div>

        <div class="setting">
          <span class="setting__icon">${icon(theme.get() === 'dark' ? 'moon' : 'sun')}</span>
          <div class="setting__text"><b>Theme</b><span>${theme.isAuto() ? 'Following your device right now' : 'Light, dark, or match your device'}</span></div>
        </div>
        <div class="segmented" data-theme-group role="tablist" aria-label="Theme">
          ${[['light', 'Light'], ['dark', 'Dark'], ['auto', 'Auto']]
            .map(
              ([id, label]) =>
                `<button data-theme-pref="${id}" role="tab" type="button" aria-selected="${theme.getPreference() === id}">${esc(label)}</button>`
            )
            .join('')}
        </div>

        <div class="setting mt-4">
          <span class="setting__icon">${icon('layers')}</span>
          <div class="setting__text"><b>Theme gallery</b><span>${esc(ACCENTS.find((a) => a.id === theme.getAccent())?.label || '')}${theme.isForcedDark() ? ' · always dark' : ''}</span></div>
        </div>
        <div class="skins" data-accents>
          ${THEME_GROUPS.map(
            (g) => `
            <div class="skins__group">
              <div class="skins__head"><b>${esc(g.label)}</b><span>${esc(g.hint)}</span></div>
              <div class="skins__row">
                ${ACCENTS.filter((a) => a.group === g.id)
                  .map(
                    (a) => `<button class="skin skin--${g.id}" type="button" data-accent="${a.id}" aria-pressed="${theme.getAccent() === a.id}"
                      title="${esc(a.label)}" aria-label="${esc(a.label)} theme"
                      style="--sk-c1:${a.colors[0]};--sk-c2:${a.colors[1]};${a.bg ? `--sk-bg:${a.bg};--sk-fg:${a.colors[1]};` : ''}">
                      <span class="skin__bar"></span>
                      <span class="skin__name">${esc(a.label)}</span>
                    </button>`
                  )
                  .join('')}
              </div>
            </div>`
          ).join('')}
          <p class="skins__note">Dark luxe and Hacker themes always use their own dark canvas.</p>
        </div>
      </section>

      <!-- Comfort & calm -->
      <section class="card">
        <div class="card__head"><h3 class="card__title">${icon('leaf')} Comfort &amp; calm</h3></div>

        <div class="setting">
          <span class="setting__icon">${icon('leaf')}</span>
          <div class="setting__text"><b>Calm mode</b><span>Softer colours, slower motion, gentler alerts</span></div>
          <label class="switch">
            <input type="checkbox" data-calm-switch ${theme.getCalm() ? 'checked' : ''} />
            <span class="switch__track"><span class="switch__thumb"></span></span>
          </label>
        </div>

        <div class="setting">
          <span class="setting__icon">${icon('eye')}</span>
          <div class="setting__text"><b>Text size</b><span>Easier on the eyes, easier on the mind</span></div>
        </div>
        <div class="segmented" data-scale-group role="tablist" aria-label="Text size">
          ${[['md', 'Standard'], ['lg', 'Large'], ['xl', 'Largest']]
            .map(
              ([id, label]) =>
                `<button data-scale="${id}" role="tab" type="button" aria-selected="${theme.getScale() === id}">${esc(label)}</button>`
            )
            .join('')}
        </div>

        <button class="btn btn--soft btn--block mt-4" data-breathe-now type="button">${icon('heart')} Take a breathing break</button>
      </section>

      <!-- Dashboard widgets -->
      <section class="card">
        <div class="card__head"><h3 class="card__title">${icon('grid')} Dashboard widgets</h3></div>
        ${[
          ['quote', 'Daily motivation', 'A fresh quote every day'],
          ['mood', 'Mood tracker', 'Check in with how you feel'],
          ['breathe', 'Breathing coach', 'A minute of calm, any time'],
          ['gratitude', 'Three good things', 'Notice what went right today'],
          ['focus', 'Focus timer', 'Pomodoro sessions'],
          ['balance', 'Life balance', 'Your six pillars at a glance'],
          ['finance', 'Money snapshot', 'Cashflow and savings'],
          ['purchases', 'Purchases', 'Your wish list and what it costs'],
          ['habits', 'Today’s habits', 'Quick daily check-ins'],
          ['games', 'Games', 'A short break, solo or with a friend'],
          ['prayer', 'Salat', 'The five prayers, with live times'],
          ['badges', 'Achievements', 'Celebrate your wins']
        ]
          .map(
            ([id, title, sub]) => `
          <div class="setting">
            <span class="setting__icon">${icon('sparkles')}</span>
            <div class="setting__text"><b>${esc(title)}</b><span>${esc(sub)}</span></div>
            <label class="switch">
              <input type="checkbox" data-widget="${id}" ${p.widgets?.[id] !== false ? 'checked' : ''} />
              <span class="switch__track"><span class="switch__thumb"></span></span>
            </label>
          </div>`
          )
          .join('')}
      </section>

      <!-- Preferences -->
      <section class="card">
        <div class="card__head"><h3 class="card__title">${icon('settings')} Preferences</h3></div>

        <div class="setting">
          <span class="setting__icon">${icon('wallet')}</span>
          <div class="setting__text"><b>Currency</b><span>Used across your finances</span></div>
          <select class="select" data-currency style="width:130px;min-height:42px">
            ${CURRENCIES.map((c) => `<option value="${c.code}" ${p.currency === c.code ? 'selected' : ''}>${c.code}</option>`).join('')}
          </select>
        </div>

        <div class="setting">
          <span class="setting__icon">${icon('clock')}</span>
          <div class="setting__text"><b>Focus length</b><span>Pomodoro session minutes</span></div>
          <input class="input" type="number" min="5" max="90" value="${esc(p.focusMinutes || 25)}" data-focus-min style="width:90px;min-height:42px" />
        </div>

        <div class="setting">
          <span class="setting__icon">${icon('water')}</span>
          <div class="setting__text"><b>Break length</b><span>Minutes between sessions</span></div>
          <input class="input" type="number" min="1" max="30" value="${esc(p.breakMinutes || 5)}" data-break-min style="width:90px;min-height:42px" />
        </div>

        <button class="setting" data-go="/prayer" type="button" style="width:100%;text-align:left">
          <span class="setting__icon">${icon('mosque')}</span>
          <div class="setting__text"><b>Prayer tracker (Salat)</b><span>${p.prayer?.enabled ? 'On · times, check-ins and removal' : 'Off · add the five daily prayers'}</span></div>
          ${icon('chevronRight')}
        </button>

        <button class="setting" data-go="/archive" type="button" style="width:100%;text-align:left">
          <span class="setting__icon">${icon('archive')}</span>
          <div class="setting__text"><b>Monthly archive</b><span>Look back at every past month</span></div>
          ${icon('chevronRight')}
        </button>
      </section>

      ${notificationsCard()}
      ${googleCalendarCard()}

      <!-- Account -->
      <section class="card">
        <div class="card__head"><h3 class="card__title">${icon('shield')} Account & data</h3></div>

        <button class="setting" data-change-pw type="button" style="width:100%;text-align:left">
          <span class="setting__icon">${icon('lock')}</span>
          <div class="setting__text"><b>Change password</b><span>Update your credentials</span></div>
          ${icon('chevronRight')}
        </button>

        <button class="setting" data-export type="button" style="width:100%;text-align:left">
          <span class="setting__icon">${icon('download')}</span>
          <div class="setting__text"><b>Export my data</b><span>Download everything as JSON</span></div>
          ${icon('chevronRight')}
        </button>

        <button class="setting" data-logout type="button" style="width:100%;text-align:left">
          <span class="setting__icon">${icon('logout')}</span>
          <div class="setting__text"><b>Log out</b><span>See you soon</span></div>
          ${icon('chevronRight')}
        </button>
      </section>

      <p class="center fs-xs t-mute">${esc(APP.name)} v${esc(APP.version)} · ${esc(APP.tagline)}</p>
    </div>`;

  bind(root);
  animateProgress(root);
}

/* =========================================================
   Reminders & notifications
   ========================================================= */
const LEADS = [
  [0, 'At the time'],
  [5, '5 min before'],
  [10, '10 min before'],
  [15, '15 min before'],
  [30, '30 min before'],
  [60, '1 hour before']
];

const leadSelect = (attr, value) =>
  `<select class="select" data-${attr} style="width:150px;min-height:42px">
    ${LEADS.map(([v, label]) => `<option value="${v}" ${Number(value) === v ? 'selected' : ''}>${esc(label)}</option>`).join('')}
  </select>`;

function reminderRow(key, title, sub, checked, trailing = '') {
  return `
    <div class="setting">
      <span class="setting__icon">${icon('bell')}</span>
      <div class="setting__text"><b>${esc(title)}</b><span>${esc(sub)}</span></div>
      <label class="switch">
        <input type="checkbox" data-notify="${key}" ${checked ? 'checked' : ''} />
        <span class="switch__track"><span class="switch__thumb"></span></span>
      </label>
    </div>
    ${trailing}`;
}

function notificationsCard() {
  const n = notify.notifyPrefs();
  const perm = notify.permission();
  const on = n.enabled && perm === 'granted';

  let hint = '';
  if (notify.needsHomeScreenInstall()) {
    hint = `<p class="fs-xs t-dim">On iPhone, tap <b>Share → Add to Home Screen</b> and open LifeFlow from there. Safari tabs cannot show notifications.</p>`;
  } else if (perm === 'denied') {
    hint = `<p class="fs-xs t-dim">Notifications are blocked for this site. Re-enable them in your browser’s site settings, then come back.</p>`;
  } else if (perm === 'unsupported') {
    hint = `<p class="fs-xs t-dim">This browser cannot show notifications.</p>`;
  } else if (on) {
    const next = notify.upcomingAlarms(3);
    hint = next.length
      ? `<div class="fs-xs t-dim"><b>Coming up:</b><br/>${next
          .map((a) => `${esc(a.title)} — ${esc(new Date(a.at).toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' }))}`)
          .join('<br/>')}</div>`
      : `<p class="fs-xs t-dim">Nothing scheduled in the next 36 hours.</p>`;
  }

  return `
    <section class="card">
      <div class="card__head"><h3 class="card__title">${icon('bell')} Reminders</h3></div>

      <div class="setting">
        <span class="setting__icon">${icon('bell')}</span>
        <div class="setting__text"><b>Phone notifications</b><span>Get a nudge on your device when something is due</span></div>
        <label class="switch">
          <input type="checkbox" data-notify-master ${on ? 'checked' : ''} />
          <span class="switch__track"><span class="switch__thumb"></span></span>
        </label>
      </div>

      ${hint}

      ${
        on
          ? `
        ${reminderRow(
          'prayers',
          'Prayer times (Salat)',
          store.prefs().prayer?.enabled ? 'Adhan reminder for the five prayers' : 'Turn the prayer tracker on first',
          n.prayers,
          n.prayers
            ? `<div class="setting">
                 <span class="setting__icon">${icon('mosque')}</span>
                 <div class="setting__text"><b>Early nudge</b><span>A heads-up before the adhan</span></div>
                 <select class="select" data-prayer-lead style="width:150px;min-height:42px">
                   <option value="0" ${!n.prayerLead ? 'selected' : ''}>Off</option>
                   ${LEADS.filter(([v]) => v > 0)
                     .map(([v, label]) => `<option value="${v}" ${Number(n.prayerLead) === v ? 'selected' : ''}>${esc(label)}</option>`)
                     .join('')}
                 </select>
               </div>`
            : ''
        )}

        ${reminderRow(
          'events',
          'Calendar entries',
          'Events, appointments and reminders',
          n.events,
          n.events
            ? `<div class="setting">
                 <span class="setting__icon">${icon('calendar')}</span>
                 <div class="setting__text"><b>Remind me</b><span>How early to be warned</span></div>
                 ${leadSelect('event-lead', n.eventLead)}
               </div>`
            : ''
        )}

        ${reminderRow('tasks', 'Task due times', 'When a task with a due date comes up', n.tasks)}

        ${reminderRow(
          'digest',
          'Morning summary',
          'One message with everything on today',
          n.digest,
          n.digest
            ? `<div class="setting">
                 <span class="setting__icon">${icon('sun')}</span>
                 <div class="setting__text"><b>Summary time</b><span>When to send it</span></div>
                 <input class="input" type="time" data-digest-time value="${esc(n.digestTime || '08:00')}" style="width:130px;min-height:42px" />
               </div>`
            : ''
        )}

        <button class="btn btn--soft btn--block mt-4" data-notify-test type="button">${icon('bell')} Send a test notification</button>
        <p class="fs-xs t-mute mt-2">Reminders are most reliable when LifeFlow is installed to your home screen. With the app fully closed, delivery depends on your phone — install it for the best results.</p>`
          : ''
      }
    </section>`;
}

/* =========================================================
   Google Calendar
   ========================================================= */
function googleCalendarCard() {
  if (GOOGLE.clientId && !gcal.isAvailable()) {
    return `
      <section class="card">
        <div class="card__head"><h3 class="card__title">${icon('calendar')} Google Calendar</h3></div>
        <p class="fs-sm t-dim">Google only allows calendar sign-in from a web address, not from a file opened on this computer. Open LifeFlow from its hosted address to sync.</p>
      </section>`;
  }
  if (!gcal.isConfigured()) {
    return `
      <section class="card">
        <div class="card__head"><h3 class="card__title">${icon('calendar')} Google Calendar</h3></div>
        <p class="fs-sm t-dim">Two-way sync is ready but not configured yet. Add your Google OAuth client id to <b>js/config.js</b> to switch it on.</p>
      </section>`;
  }

  const g = gcal.gcalPrefs();
  const connected = gcal.isConnected();

  return `
    <section class="card">
      <div class="card__head">
        <h3 class="card__title">${icon('calendar')} Google Calendar</h3>
        ${connected ? '<span class="chip chip--accent">Connected</span>' : ''}
      </div>

      ${
        connected
          ? `
        <div class="setting">
          <span class="setting__icon">${icon('refresh')}</span>
          <div class="setting__text">
            <b>${esc(g.calendarName || g.calendarId || 'Primary calendar')}</b>
            <span>${g.lastSync ? `Last synced ${esc(timeAgo(g.lastSync))}` : 'Not synced yet'}</span>
          </div>
        </div>

        <div class="setting">
          <span class="setting__icon">${icon('sparkles')}</span>
          <div class="setting__text"><b>Sync automatically</b><span>Whenever you open the app</span></div>
          <label class="switch">
            <input type="checkbox" data-gcal-auto ${g.autoSync ? 'checked' : ''} />
            <span class="switch__track"><span class="switch__thumb"></span></span>
          </label>
        </div>

        <button class="btn btn--soft btn--block mt-4" data-gcal-sync type="button">${icon('refresh')} Sync now</button>
        <button class="btn btn--ghost btn--block mt-2" data-gcal-disconnect type="button">Disconnect</button>`
          : `
        <p class="fs-sm t-dim">Connect your Google account to keep this calendar and Google Calendar in step — changes made in either place show up in the other.</p>
        <button class="btn btn--primary btn--block mt-4" data-gcal-connect type="button">${icon('calendar')} Connect Google Calendar</button>`
      }
    </section>`;
}

/* ------------------------------ behaviour ------------------------------ */
function bind(root) {
  root.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => navigate(b.dataset.go)));

  root.querySelectorAll('[data-theme-pref]').forEach((b) =>
    b.addEventListener('click', (e) => {
      const r = e.currentTarget.getBoundingClientRect();
      const pref = theme.set(b.dataset.themePref, { x: r.left + r.width / 2, y: r.top + r.height / 2 });
      store.savePrefs({ theme: pref });
      redraw();
    })
  );

  root.querySelectorAll('[data-accent]').forEach((b) =>
    b.addEventListener('click', () => {
      theme.setAccent(b.dataset.accent);
      root.querySelectorAll('[data-accent]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      store.savePrefs({ accent: b.dataset.accent });
      redraw();
    })
  );

  root.querySelectorAll('[data-widget]').forEach((input) =>
    input.addEventListener('change', () => {
      const widgets = { ...(store.prefs().widgets || {}), [input.dataset.widget]: input.checked };
      store.savePrefs({ widgets });
      toast('Dashboard updated', 'info', 1600);
    })
  );

  root.querySelector('[data-calm-switch]')?.addEventListener('change', (e) => {
    const on = e.target.checked;
    theme.setCalm(on);
    store.savePrefs({ calm: on });
    toast(on ? 'Calm mode on — take your time 🌿' : 'Back to full colour');
  });

  root.querySelectorAll('[data-scale]').forEach((b) =>
    b.addEventListener('click', () => {
      const size = theme.setScale(b.dataset.scale);
      root.querySelectorAll('[data-scale]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
      store.savePrefs({ textScale: size });
    })
  );

  root.querySelector('[data-breathe-now]')?.addEventListener('click', () => openBreathe('478'));

  root.querySelector('[data-currency]')?.addEventListener('change', (e) => {
    store.savePrefs({ currency: e.target.value });
    toast('Currency updated');
  });
  root.querySelector('[data-focus-min]')?.addEventListener('change', (e) => {
    store.savePrefs({ focusMinutes: Math.min(90, Math.max(5, Number(e.target.value) || 25)) });
  });
  root.querySelector('[data-break-min]')?.addEventListener('change', (e) => {
    store.savePrefs({ breakMinutes: Math.min(30, Math.max(1, Number(e.target.value) || 5)) });
  });

  root.querySelector('[data-edit-profile]')?.addEventListener('click', openProfileEditor);
  root.querySelector('[data-photo]')?.addEventListener('click', pickPhoto);
  root.querySelector('[data-change-pw]')?.addEventListener('click', openPasswordDialog);

  bindNotifications(root);
  bindGoogleCalendar(root);

  root.querySelector('[data-export]')?.addEventListener('click', () => {
    downloadJSON(`lifeflow-export-${new Date().toISOString().slice(0, 10)}.json`, store.exportData());
    toast('Export downloaded 📦');
  });

  root.querySelector('[data-logout]')?.addEventListener('click', async () => {
    const ok = await confirmDialog({ title: 'Log out?', message: 'You can always come back.', confirmText: 'Log out' });
    if (ok) await signOut(auth);
  });
}

/** Redraws the page so the reminder / sync panels reflect the new state. */
function redraw() {
  if (mountRoot) render(mountRoot);
}

const PERMISSION_MESSAGES = {
  'ios-install': 'On iPhone, add LifeFlow to your Home Screen first, then turn reminders on from there.',
  denied: 'Notifications are blocked. Allow them for this site in your browser settings.',
  default: 'Permission was not granted.',
  unsupported: 'This browser cannot show notifications.'
};

function bindNotifications(root) {
  root.querySelector('[data-notify-master]')?.addEventListener('change', async (e) => {
    if (!e.target.checked) {
      await notify.saveNotifyPrefs({ enabled: false });
      toast('Reminders paused', 'info');
      return redraw();
    }

    e.target.checked = false; // only tick once permission is actually granted
    const res = await notify.requestPermission();
    if (!res.ok) {
      toast(PERMISSION_MESSAGES[res.reason] || PERMISSION_MESSAGES.default, 'error', 5000);
      return redraw();
    }
    await notify.saveNotifyPrefs({ enabled: true });
    toast('Reminders on — you’ll get a nudge on time 🔔');
    redraw();
  });

  root.querySelectorAll('[data-notify]').forEach((input) =>
    input.addEventListener('change', async () => {
      await notify.saveNotifyPrefs({ [input.dataset.notify]: input.checked });
      redraw();
    })
  );

  root.querySelector('[data-prayer-lead]')?.addEventListener('change', (e) =>
    notify.saveNotifyPrefs({ prayerLead: Number(e.target.value) || 0 })
  );
  root.querySelector('[data-event-lead]')?.addEventListener('change', (e) =>
    notify.saveNotifyPrefs({ eventLead: Number(e.target.value) || 0 })
  );
  root.querySelector('[data-digest-time]')?.addEventListener('change', (e) =>
    notify.saveNotifyPrefs({ digestTime: e.target.value || '08:00' })
  );

  root.querySelector('[data-notify-test]')?.addEventListener('click', async (e) => {
    const res = await withLoading(e.currentTarget, notify.testNotification());
    if (!res.ok) toast(PERMISSION_MESSAGES[res.reason] || PERMISSION_MESSAGES.default, 'error', 5000);
  });
}

function bindGoogleCalendar(root) {
  root.querySelector('[data-gcal-connect]')?.addEventListener('click', async (e) => {
    try {
      const result = await withLoading(e.currentTarget, gcal.connect());
      toast(`Google Calendar connected — ${(result?.created || 0) + (result?.inserted || 0)} entries synced 📅`);
    } catch (err) {
      toast(err.message || 'Could not connect to Google Calendar.', 'error', 5000);
    }
    redraw();
  });

  root.querySelector('[data-gcal-sync]')?.addEventListener('click', async (e) => {
    try {
      const r = await withLoading(e.currentTarget, gcal.syncNow());
      const changed = r ? r.created + r.updated + r.deleted + r.inserted + r.patched : 0;
      toast(changed ? `Synced — ${changed} change${changed === 1 ? '' : 's'} ✨` : 'Everything is already up to date');
    } catch (err) {
      toast(err.message || 'Sync failed.', 'error', 5000);
    }
    redraw();
  });

  root.querySelector('[data-gcal-auto]')?.addEventListener('change', (e) =>
    store.savePrefs({ gcal: { ...gcal.gcalPrefs(), autoSync: e.target.checked } })
  );

  root.querySelector('[data-gcal-disconnect]')?.addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: 'Disconnect Google Calendar?',
      message: 'Your entries stay in LifeFlow, they just stop syncing.',
      confirmText: 'Disconnect'
    });
    if (!ok) return;
    await gcal.disconnect();
    toast('Google Calendar disconnected', 'info');
    redraw();
  });
}

function openProfileEditor() {
  const p = store.state.profile || {};
  modal({
    title: 'Edit profile',
    body: `
      <form class="grid" style="gap:var(--s-4)">
        <div class="field"><label>Name</label><input class="input" name="name" value="${esc(p.name || store.state.user?.displayName || '')}" maxlength="60" /></div>
        <div class="field"><label>Focus area</label><input class="input" name="focusArea" value="${esc(p.focusArea || '')}" placeholder="e.g. Health & career growth" maxlength="80" /></div>
        <div class="field"><label>About you</label><textarea class="textarea" name="bio" maxlength="300" style="min-height:96px" placeholder="A line about your season of life…">${esc(p.bio || '')}</textarea></div>
      </form>`,
    footer: `<button class="btn btn--ghost" data-modal-close type="button">Cancel</button>
             <button class="btn btn--primary" data-save type="button">Save</button>`,
    onMount(box, close) {
      const f = box.querySelector('form');
      box.querySelector('[data-save]').addEventListener('click', async (e) => {
        const name = f.name.value.trim();
        if (!name) return toast('Please enter your name.', 'error');
        try {
          await withLoading(
            e.currentTarget,
            (async () => {
              await updateProfile(auth.currentUser, { displayName: name });
              await store.updateProfileDoc({ name, focusArea: f.focusArea.value.trim(), bio: f.bio.value.trim() });
            })()
          );
          close();
          toast('Profile updated ✨');
        } catch (err) {
          toast(authErrorMessage(err), 'error');
        }
      });
    }
  });
}

function pickPhoto() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/png,image/jpeg,image/webp';
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) return toast('Please choose an image under 3 MB.', 'error');
    toast('Uploading photo…', 'info');
    try {
      const ref = storageRef(storage, `users/${store.state.uid}/avatar-${Date.now()}`);
      await uploadBytes(ref, file, { contentType: file.type });
      const url = await getDownloadURL(ref);
      await updateProfile(auth.currentUser, { photoURL: url });
      await store.updateProfileDoc({ photoURL: url });
      toast('Photo updated 📸');
    } catch (err) {
      console.error(err);
      toast('Upload failed. Enable Firebase Storage and try again.', 'error');
    }
  });
  input.click();
}

function openPasswordDialog() {
  const email = store.state.user?.email || '';
  modal({
    title: 'Change password',
    body: `
      <form class="grid" style="gap:var(--s-4)">
        <div class="field"><label>Current password</label><input class="input" type="password" name="current" autocomplete="current-password" /></div>
        <div class="field"><label>New password</label><input class="input" type="password" name="next" minlength="6" autocomplete="new-password" /></div>
        <p class="fs-xs t-mute">Prefer an email link? <button type="button" class="fw-7" data-reset style="color:var(--accent)">Send reset email</button></p>
      </form>`,
    footer: `<button class="btn btn--ghost" data-modal-close type="button">Cancel</button>
             <button class="btn btn--primary" data-save type="button">Update</button>`,
    onMount(box, close) {
      const f = box.querySelector('form');
      box.querySelector('[data-reset]').addEventListener('click', async () => {
        try {
          await sendPasswordResetEmail(auth, email);
          close();
          toast('Reset email sent 📬');
        } catch (err) {
          toast(authErrorMessage(err), 'error');
        }
      });
      box.querySelector('[data-save]').addEventListener('click', async (e) => {
        const current = f.current.value;
        const next = f.next.value;
        if (next.length < 6) return toast('New password must be at least 6 characters.', 'error');
        try {
          await withLoading(
            e.currentTarget,
            (async () => {
              const cred = EmailAuthProvider.credential(email, current);
              await reauthenticateWithCredential(auth.currentUser, cred);
              await updatePassword(auth.currentUser, next);
            })()
          );
          close();
          toast('Password updated 🔐');
        } catch (err) {
          toast(authErrorMessage(err), 'error');
        }
      });
    }
  });
}
return Object.freeze({ meta, render });
  })();

  /* ===== js/app.js ===== */
  const __m0 = (function () {
const { $ } = __m1;
const { initRipples, theme, toast } = __m2;
const { route, setGuard, setNotFound, startRouter, resolve, navigate } = __m6;
const { auth, onAuthStateChanged } = __m7;
const store = __m8;
const { initNotifications } = __m10;
const { initGoogleCalendar } = __m11;
const { initPalette, isOpen: isPaletteOpen } = __m12;
const { renderLanding, renderLogin, renderSignup, renderForgot, hidePublic } = __m15;
const { initShell, showApp, mountPage, unmountPage } = __m16;
const dashboard = __m17;
const tasks = __m34;
const calendarPage = __m35;
const finance = __m36;
const purchases = __m37;
const goals = __m38;
const habits = __m39;
const games = __m40;
const prayer = __m43;
const quran = __m44;
const { player: quranPlayer } = __m45;
const notes = __m46;
const archive = __m47;
const profile = __m48;
/**
 * LifeFlow — application bootstrap.
 */



























const PRIVATE_PAGES = [
  ['/dashboard', dashboard],
  ['/tasks', tasks],
  ['/calendar', calendarPage],
  ['/finance', finance],
  ['/purchases', purchases],
  ['/goals', goals],
  ['/habits', habits],
  ['/games', games],
  ['/prayer', prayer],
  ['/quran', quran],
  ['/notes', notes],
  ['/archive', archive],
  ['/profile', profile]
];

let session = { user: null, ready: false };

/** Where an unauthenticated visit was actually trying to go. */
const AFTER_LOGIN = 'lf:after-login';

function intendedDestination() {
  let saved = null;
  try {
    saved = sessionStorage.getItem(AFTER_LOGIN);
    sessionStorage.removeItem(AFTER_LOGIN);
  } catch { /* private mode */ }
  const path = (saved || '').replace('#', '');
  return path && !['/login', '/signup', '/forgot', '/'].includes(path.split('?')[0]) ? path : '/dashboard';
}

/* =========================================================
   Routes
   ========================================================= */
function registerRoutes() {
  const publicRoute = (path, title, render) =>
    route(path, {
      title,
      public: true,
      render: () => { unmountPage(); render(); }
    });

  publicRoute('/', 'Welcome', renderLanding);
  publicRoute('/login', 'Log in', renderLogin);
  publicRoute('/signup', 'Create account', renderSignup);
  publicRoute('/forgot', 'Reset password', renderForgot);

  PRIVATE_PAGES.forEach(([path, mod]) =>
    route(path, {
      title: mod.meta.title,
      render: () => { hidePublic(); showApp(); mountPage(mod); }
    })
  );

  setGuard((path, config) => {
    if (!session.ready) return null;
    const isPublic = !config || config.public;
    if (!session.user && !isPublic) {
      // Hold on to the destination — shared game links land here before login.
      try { sessionStorage.setItem(AFTER_LOGIN, location.hash); } catch { /* private mode */ }
      return '/login';
    }
    if (session.user && isPublic) return '/dashboard';
    return null;
  });

  setNotFound(() => navigate(session.user ? '/dashboard' : '/', { replace: true }));
}

/* =========================================================
   Auth lifecycle
   ========================================================= */
function watchAuth() {
  onAuthStateChanged(
    auth,
    async (user) => {
      const first = !session.ready;
      const changed = session.user?.uid !== user?.uid;
      session = { user, ready: true };

      if (user) {
        if (changed) {
          try {
            await store.connect(user);
          } catch (err) {
            console.error('[LifeFlow] Firestore connection failed', err);
            toast('Could not reach your data. Check your Firestore rules.', 'error', 6000);
          }
        }
        if (first || changed) {
          const here = (location.hash.replace('#', '') || '/').split('?')[0];
          if (['/login', '/signup', '/forgot', '/'].includes(here)) {
            navigate(intendedDestination(), { replace: true });
          }
        }
      } else {
        store.disconnect();
        quranPlayer.stop();
        unmountPage();
        $('#app').hidden = true;
      }

      if (first) startRouter();
      else resolve();

      hideSplash();
    },
    (err) => {
      console.error('[LifeFlow] auth error', err);
      session = { user: null, ready: true };
      startRouter();
      hideSplash();
    }
  );
}

/** Apply the user's saved theme/accent once the profile arrives. */
function watchPreferences() {
  let applied = false;
  store.subscribe((s) => {
    if (applied || !s.profile?.prefs) return;
    applied = true;
    const p = s.profile.prefs;
    if (p.accent) theme.setAccent(p.accent);
    if (p.theme && p.theme !== theme.getPreference()) theme.set(p.theme);
    theme.setCalm(!!p.calm);
    theme.setScale(p.textScale || 'md');
  });
}

function hideSplash() {
  const splash = $('#splash');
  if (!splash || splash.classList.contains('is-hidden')) return;
  setTimeout(() => {
    splash.classList.add('is-hidden');
    setTimeout(() => splash.remove(), 600);
  }, 380);
}

/* =========================================================
   Global niceties
   ========================================================= */
function bindGlobals() {
  // Keyboard shortcuts (desktop)
  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea, select, [contenteditable]')) return;
    if (!session.user) return;
    // Don't hijack single keys while a dialog or the palette is on screen.
    if (isPaletteOpen() || document.querySelector('.modal, .sheet')) return;
    const map = { d: '/dashboard', t: '/tasks', c: '/calendar', m: '/finance', b: '/purchases', g: '/goals', h: '/habits', y: '/games', q: '/quran', j: '/notes', p: '/profile' };
    if (map[e.key.toLowerCase()] && !e.metaKey && !e.ctrlKey && !e.altKey) navigate(map[e.key.toLowerCase()]);
  });

  window.addEventListener('online', () => toast('Back online — syncing ✨', 'info', 2000));
  window.addEventListener('offline', () => toast('You’re offline. Changes will sync later.', 'info', 3200));

  window.addEventListener('error', (e) => console.error('[LifeFlow]', e.error || e.message));
}

/* =========================================================
   Go
   ========================================================= */
initRipples();
theme.sync();
theme.watchSystem();
initShell();
registerRoutes();
watchPreferences();
bindGlobals();
initPalette();
initNotifications();
initGoogleCalendar();
watchAuth();

// Safety net: never leave the splash up forever.
setTimeout(hideSplash, 6000);
return Object.freeze({  });
  })();
})().catch(function (err) {
  console.error('[LifeFlow] could not start', err);
  var word = document.querySelector('.splash__word');
  if (word) word.textContent = 'LifeFlow could not start — check your internet connection and reload.';
});
