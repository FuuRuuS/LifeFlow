/**
 * LifeFlow — Qur'an: read and listen at the same time.
 *
 * The verse being recited lights up in its own colour, the page follows the
 * reciter (unless you are scrolling yourself) and the verse's Arabic tafsir
 * unfolds right under it. Audio keeps playing on other pages (mini player).
 */
import { esc, debounce } from '../utils.js';
import { icon } from '../icons.js';
import { toast } from '../ui.js';
import { currentQuery, navigate } from '../router.js';
import { isOpen as isPaletteOpen } from '../palette.js';
import {
  RECITERS,
  TAFSIRS,
  BASMALA,
  qprefs,
  saveQprefs,
  surahList,
  surahText,
  surahTafsir,
  player,
  arNum,
  plainArabic,
  isMarked,
  toggleMark,
  tafsirOf,
  reciterOf
} from '../quran.js';

export const meta = { title: 'Qur’an', icon: 'quran', label: 'Qur’an' };

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
export function render(root) {
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

export function unmount() {
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
