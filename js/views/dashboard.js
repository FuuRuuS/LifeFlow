/**
 * LifeFlow — Dashboard: the personal life cockpit.
 */
import { esc, greeting, firstName, fmtMoney, today, relativeDay, fmtTime, seededPick, countUp, ymd, haptic } from '../utils.js';
import { icon } from '../icons.js';
import { ring, animateProgress, toast, confetti, sparkline } from '../ui.js';
import * as store from '../store.js';
import { MOODS, QUOTES, PRIORITIES } from '../config.js';
import { navigate } from '../router.js';
import { openTaskForm, openPurchaseForm } from './forms.js';
import { mountFocus } from './focus.js';
import { mountBreathe, openBreathe } from './breathe.js';
import { prayerSchedule, nextPrayer, countdownLabel } from '../prayer.js';
import { GAMES } from '../arcade/index.js';

export const meta = { title: 'Dashboard', icon: 'home', label: 'Home' };

export function render(root) {
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
      <p class="fs-sm t-dim games-card__sub">Ten quiet minutes. Play the computer, or send a friend a link.</p>
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
