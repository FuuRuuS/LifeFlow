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
export const METHODS = [
  { id: 'mwl', label: 'Muslim World League', fajr: 18, isha: 17 },
  { id: 'isna', label: 'North America (ISNA)', fajr: 15, isha: 15 },
  { id: 'egypt', label: 'Egyptian General Authority', fajr: 19.5, isha: 17.5 },
  { id: 'makkah', label: 'Umm al-Qura, Makkah', fajr: 18.5, ishaMinutes: 90 },
  { id: 'karachi', label: 'Univ. of Islamic Sciences, Karachi', fajr: 18, isha: 18 },
  { id: 'turkey', label: 'Diyanet, Türkiye', fajr: 18, isha: 17 },
  { id: 'tehran', label: 'Univ. of Tehran', fajr: 17.7, isha: 14 },
  { id: 'france', label: 'France (UOIF)', fajr: 12, isha: 12 }
];

export const MADHABS = [
  { id: 'standard', label: 'Standard', hint: 'Shāfiʿī · Mālikī · Ḥanbalī', factor: 1 },
  { id: 'hanafi', label: 'Ḥanafī', hint: 'Later Asr', factor: 2 }
];

/** The five obligatory prayers, in order. */
export const PRAYERS = [
  { id: 'fajr', label: 'Fajr', ar: 'الفجر', emoji: '🌄', note: 'Before sunrise' },
  { id: 'dhuhr', label: 'Dhuhr', ar: 'الظهر', emoji: '☀️', note: 'After midday' },
  { id: 'asr', label: 'Asr', ar: 'العصر', emoji: '🌇', note: 'Afternoon' },
  { id: 'maghrib', label: 'Maghrib', ar: 'المغرب', emoji: '🌆', note: 'At sunset' },
  { id: 'isha', label: 'Isha', ar: 'العشاء', emoji: '🌙', note: 'Night' }
];

/** Handy presets so the tracker works even without location permission. */
export const CITIES = [
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

export const DEFAULT_PRAYER_PREFS = {
  enabled: false,
  method: 'mwl',
  madhab: 'standard',
  lat: 21.4225,
  lng: 39.8262,
  city: 'Makkah',
  reminders: false
};

export function methodOf(id) {
  return METHODS.find((m) => m.id === id) || METHODS[0];
}
export function madhabOf(id) {
  return MADHABS.find((m) => m.id === id) || MADHABS[0];
}
export function prayerOf(id) {
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
export function prayerTimes(date = new Date(), opts = {}) {
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
export function toHHMM(hours) {
  if (hours == null || !Number.isFinite(hours)) return null;
  const total = Math.round(fixHour(hours) * 60);
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** The five prayers as display rows: { id, label, ar, emoji, hhmm, at:Date }. */
export function prayerSchedule(date = new Date(), opts = {}) {
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
export function sunriseAt(date = new Date(), opts = {}) {
  const t = prayerTimes(date, opts);
  return Number.isFinite(t.sunrise) ? hoursToDate(date, t.sunrise) : null;
}

/**
 * Which prayer is current and which is next, right now.
 * Rolls over to tomorrow's Fajr after Isha.
 */
export function nextPrayer(now = new Date(), opts = {}) {
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
export function countdownLabel(ms) {
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
export function locate({ timeout = 8000 } = {}) {
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
export function nearestCity(lat, lng) {
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
export function hijriLabel(date = new Date()) {
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
