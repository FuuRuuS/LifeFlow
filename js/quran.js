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
import { esc } from './utils.js';
import { icon } from './icons.js';
import { navigate, currentPath } from './router.js';

const API = 'https://api.alquran.cloud/v1';

export const RECITERS = [
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

export const TAFSIRS = [
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

export function qprefs() {
  if (!prefCache.value) {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(PKEY) || '{}') || {}; } catch { /* corrupted / private mode */ }
    prefCache.value = { ...DEFAULTS, ...saved };
    if (!RECITERS.some((r) => r.id === prefCache.value.reciter)) prefCache.value.reciter = DEFAULTS.reciter;
    if (!TAFSIRS.some((t) => t.id === prefCache.value.tafsir)) prefCache.value.tafsir = DEFAULTS.tafsir;
  }
  return prefCache.value;
}

export function saveQprefs(patch) {
  prefCache.value = { ...qprefs(), ...patch };
  try { localStorage.setItem(PKEY, JSON.stringify(prefCache.value)); } catch { /* quota / private mode */ }
  return prefCache.value;
}

export function isMarked(s, a) { return qprefs().marks.includes(`${s}:${a}`); }
export function toggleMark(s, a) {
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
export function plainArabic(s = '') {
  return s.replace(MARKS, '').replace(/[\u0671\u0622\u0623\u0625]/g, '\u0627').replace(/\u0640/g, '');
}
export const arNum = (n) => Number(n).toLocaleString('ar-EG', { useGrouping: false });

export const BASMALA = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ';
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
export function surahList() {
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

export function surahText(n) {
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

export function surahTafsir(n, edition) {
  return cached(`tafsir:${n}:${edition}`, async () => (await api(`/surah/${n}/${edition}`)).ayahs.map((a) => a.text || ''));
}

export function surahAudio(n, reciter) {
  return cached(`audio:${n}:${reciter}`, async () =>
    (await api(`/surah/${n}/${reciter}`)).ayahs.map((a) => [a.audio, ...(a.audioSecondary || [])].filter(Boolean))
  );
}

export const reciterOf = (id) => RECITERS.find((r) => r.id === id) || RECITERS[0];
export const tafsirOf = (id) => TAFSIRS.find((t) => t.id === id) || TAFSIRS[0];

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

export const player = {
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
