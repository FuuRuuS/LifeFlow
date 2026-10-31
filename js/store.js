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
import {
  db,
  auth,
  doc,
  collection,
  addDoc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  writeBatch
} from './firebase.js';
import { ymd, today, addDays, toMillis, pct, clamp } from './utils.js';
import { BADGES } from './config.js';
import { PRAYERS, DEFAULT_PRAYER_PREFS } from './prayer.js';
import { recordActivity, setActivityConsent } from './activity.js';

const COLLECTIONS = ['tasks', 'events', 'goals', 'savings', 'txns', 'purchases', 'habits', 'notes', 'moods', 'prayers'];

/** Collections keyed by date string rather than an auto id. */
const DATE_KEYED = ['moods', 'prayers'];

const DEFAULT_PREFS = {
  activitySharing: false,
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
export const state = {
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
let connectionGeneration = 0;
let confirmedActivitySharing = false;
let activityLocallyDisabled = false;
let activityPreferenceGeneration = 0;

export function subscribe(fn) {
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
export async function connect(user) {
  disconnect();
  const connection = connectionGeneration;
  state.uid = user.uid;
  state.user = user;
  state.loading = true;
  emit();

  await ensureProfile(user);
  if (connection !== connectionGeneration || state.uid !== user.uid) return;

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
      { includeMetadataChanges: true },
      (snap) => {
        if (connection !== connectionGeneration || state.uid !== user.uid) return;
        state.profile = { id: snap.id, ...(snap.data() || {}) };
        state.profile.prefs = { ...DEFAULT_PREFS, ...(state.profile.prefs || {}) };
        state.profile.prefs.widgets = { ...DEFAULT_PREFS.widgets, ...(state.profile.prefs.widgets || {}) };
        state.profile.prefs.prayer = { ...DEFAULT_PRAYER_PREFS, ...(state.profile.prefs.prayer || {}) };
        // Cached/optimistic true is not consent confirmation from the server.
        const shared = state.profile.prefs.activitySharing === true;
        if (!snap.metadata?.hasPendingWrites && !snap.metadata?.fromCache) {
          confirmedActivitySharing = shared;
          setActivityConsent(user.uid, shared && !activityLocallyDisabled);
        } else if (!shared) {
          setActivityConsent(user.uid, false);
        }
        emit();
      },
      (err) => {
        if (connection !== connectionGeneration) return;
        confirmedActivitySharing = false;
        setActivityConsent(user.uid, false);
        console.warn('[store] profile snapshot', err);
      }
    )
  );

  for (const name of COLLECTIONS) {
    const ref = collection(db, 'users', user.uid, name);
    const q = DATE_KEYED.includes(name) ? ref : query(ref, orderBy('createdAt', 'desc'));
    unsubs.push(
      onSnapshot(
        q,
        (snap) => {
          if (connection !== connectionGeneration) return;
          state[name] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          settle(name);
        },
        (err) => {
          if (connection !== connectionGeneration) return;
          console.warn(`[store] ${name} snapshot`, err);
          settle(name);
        }
      )
    );
  }
}

export function disconnect() {
  setActivityConsent(null, false);
  connectionGeneration++;
  confirmedActivitySharing = false;
  activityLocallyDisabled = false;
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

export async function create(name, data) {
  const uid = state.uid;
  const connection = connectionGeneration;
  const ref = await addDoc(colRef(name), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  if (uid === state.uid && uid === auth.currentUser?.uid && connection === connectionGeneration) recordActivity('create', name);
  return ref.id;
}

export async function update(name, id, patch) {
  const uid = state.uid;
  const connection = connectionGeneration;
  await updateDoc(docRef(name, id), { ...patch, updatedAt: serverTimestamp() });
  if (uid === state.uid && uid === auth.currentUser?.uid && connection === connectionGeneration) recordActivity('update', name);
}

/**
 * Called just before a synced calendar entry is deleted, so an integration can
 * mirror the deletion (see gcal.js). Registered lazily to keep the data layer
 * free of any dependency on the integration.
 */
let eventDeleteHook = null;
export function setEventDeleteHook(fn) {
  eventDeleteHook = fn;
}

export async function remove(name, id, { skipRemote = false } = {}) {
  const uid = state.uid;
  const connection = connectionGeneration;
  const ref = docRef(name, id);
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
  await deleteDoc(ref);
  if (uid === state.uid && uid === auth.currentUser?.uid && connection === connectionGeneration) recordActivity('delete', name);
}

export async function updateProfileDoc(patch) {
  const uid = state.uid;
  const connection = connectionGeneration;
  await setDoc(doc(db, 'users', state.uid), { ...patch, updatedAt: serverTimestamp() }, { merge: true });
  if (uid === state.uid && uid === auth.currentUser?.uid && connection === connectionGeneration) recordActivity('update', 'profile');
}

export async function savePrefs(patch) {
  const uid = state.uid;
  const connection = connectionGeneration;
  const changesConsent = Object.prototype.hasOwnProperty.call(patch, 'activitySharing');
  const preference = changesConsent ? ++activityPreferenceGeneration : activityPreferenceGeneration;
  if (changesConsent) {
    // Latch off through pending writes, rollback snapshots, and failed revocations.
    activityLocallyDisabled = true;
    setActivityConsent(uid, false);
  }
  const prefs = { ...(state.profile?.prefs || DEFAULT_PREFS), ...patch };
  state.profile = { ...(state.profile || {}), prefs };
  emit();
  try {
    await updateProfileDoc({ prefs });
    if (changesConsent && preference === activityPreferenceGeneration && uid === state.uid && uid === auth.currentUser?.uid && connection === connectionGeneration) {
      activityLocallyDisabled = patch.activitySharing !== true;
      setActivityConsent(uid, confirmedActivitySharing && !activityLocallyDisabled);
    }
  } catch (err) {
    if (changesConsent && preference === activityPreferenceGeneration && uid === state.uid && connection === connectionGeneration) {
      state.profile.prefs.activitySharing = confirmedActivitySharing;
      emit();
    }
    throw err;
  }
}

export function prefs() {
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

export function currency() {
  return prefs().currency || 'USD';
}

/* =========================================================
   Tasks
   ========================================================= */
export async function toggleTask(task) {
  const done = !task.done;
  await update('tasks', task.id, { done, doneAt: done ? Date.now() : null });
  if (done) await bumpStat('tasksDone', 1);
  return done;
}

export async function reorderTasks(orderedIds) {
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
export async function togglePurchase(item) {
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
export async function syncPurchaseTxn(item) {
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
export async function toggleHabitDay(habit, dateStr = today()) {
  const log = Array.isArray(habit.log) ? [...habit.log] : [];
  const idx = log.indexOf(dateStr);
  if (idx >= 0) log.splice(idx, 1);
  else log.push(dateStr);
  log.sort();
  await update('habits', habit.id, { log, streak: streakOf(log) });
  return idx < 0;
}

export function streakOf(log = []) {
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

export function habitDoneToday(habit) {
  return Array.isArray(habit.log) && habit.log.includes(today());
}

/* =========================================================
   Mood
   ========================================================= */
export async function setMood(moodId, dateStr = today()) {
  await setDoc(
    doc(db, 'users', state.uid, 'moods', dateStr),
    { mood: moodId, date: dateStr, createdAt: serverTimestamp() },
    { merge: true }
  );
}

export function moodFor(dateStr = today()) {
  return state.moods.find((m) => m.id === dateStr)?.mood || null;
}

/* =========================================================
   Salat — the five daily prayers
   ========================================================= */
const PRAYER_IDS = PRAYERS.map((p) => p.id);

/** The prayer ids ticked off on a given day. */
export function prayersOn(dateStr = today()) {
  const doc = state.prayers.find((p) => p.id === dateStr);
  const done = Array.isArray(doc?.done) ? doc.done : [];
  return done.filter((id) => PRAYER_IDS.includes(id));
}

export function prayerDone(id, dateStr = today()) {
  return prayersOn(dateStr).includes(id);
}

/** Check / uncheck one prayer. Returns the new state (true = prayed). */
export async function togglePrayer(id, dateStr = today()) {
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
export function prayerStreak() {
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

export async function savePrayerPrefs(patch) {
  const current = prefs().prayer;
  await savePrefs({ prayer: { ...current, ...patch } });
}

/**
 * Removes the prayer tracker. `wipe` also deletes every saved day, so the
 * feature leaves nothing behind.
 */
export async function removePrayerTracker({ wipe = true } = {}) {
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
export async function clearPrayerDay(dateStr = today()) {
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

export async function recordFocusSession() {
  await bumpStat('focusSessions', 1);
  await evaluateBadges();
}

/** Selectors ------------------------------------------------ */
export const select = {
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
export async function evaluateBadges() {
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
export function exportData() {
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

export { DEFAULT_PREFS };
