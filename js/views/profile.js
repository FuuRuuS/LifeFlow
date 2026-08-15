/**
 * LifeFlow — Profile & settings.
 */
import { esc, initials, downloadJSON, toMillis, timeAgo } from '../utils.js';
import { icon } from '../icons.js';
import { theme, modal, toast, confirmDialog, withLoading, animateProgress } from '../ui.js';
import * as store from '../store.js';
import { ACCENTS, CURRENCIES, APP } from '../config.js';
import { navigate } from '../router.js';
import { openBreathe } from './breathe.js';
import * as notify from '../notify.js';
import * as gcal from '../gcal.js';
import {
  auth,
  storage,
  storageRef,
  uploadBytes,
  getDownloadURL,
  updateProfile,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  sendPasswordResetEmail,
  signOut,
  authErrorMessage
} from '../firebase.js';

export const meta = { title: 'Profile', icon: 'user', label: 'Profile' };

/** Kept so the notification / sync panels can redraw themselves after a change. */
let mountRoot = null;

export function render(root) {
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
          <div class="setting__text"><b>Accent colour</b><span>Personalise your gradient</span></div>
        </div>
        <div class="swatches" data-accents>
          ${ACCENTS.map(
            (a) => `<button class="swatch" data-accent="${a.id}" aria-pressed="${theme.getAccent() === a.id}" title="${esc(a.label)}"
              style="background:linear-gradient(135deg,${a.colors[0]},${a.colors[1]})" aria-label="${esc(a.label)} accent"></button>`
          ).join('')}
        </div>
        <p class="fs-xs t-mute center mt-2">${esc(ACCENTS.find((a) => a.id === theme.getAccent())?.label || '')}</p>
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
