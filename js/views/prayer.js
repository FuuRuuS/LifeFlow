/**
 * LifeFlow — Salat: the five daily prayers, with live local prayer times.
 *
 * Times are computed on device (see js/prayer.js) so the page keeps working
 * offline, and the whole tracker can be removed again in one tap.
 */
import { esc, ymd, today, addDays, pct, haptic } from '../utils.js';
import { icon } from '../icons.js';
import { ring, animateProgress, toast, confetti, confirmDialog } from '../ui.js';
import * as store from '../store.js';
import {
  METHODS,
  MADHABS,
  CITIES,
  prayerSchedule,
  nextPrayer,
  countdownLabel,
  hijriLabel,
  locate,
  nearestCity,
  methodOf
} from '../prayer.js';

export const meta = { title: 'Salat', icon: 'mosque', label: 'Salat' };

let ticker = null;
let locating = false;

export function render(root) {
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
