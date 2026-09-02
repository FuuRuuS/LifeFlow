# LifeFlow

A mobile-first, all-in-one life management web app — tasks, calendar, finances, goals, habits, journal and a smart dashboard — built with **vanilla HTML / CSS / JavaScript (ES modules)** and **Firebase**. No build step, no bundler, no framework.

---

## ✨ Features

| Area | What you get |
| --- | --- |
| **Dashboard** | Personalised greeting, life-balance ring, today's priorities, weekly momentum chart, mood tracker, focus timer, finance & habit widgets, achievement badges |
| **Tasks** | Smart filters (Today / Upcoming / Overdue / All / Done), categories, priorities, subtask-free simplicity, **drag-and-drop reorder**, **swipe to complete or delete** |
| **Calendar** | Month grid with event pips, day timeline, appointments & reminders, next-7-days list, swipe between months |
| **Finance** | Income/expense tracking, monthly cash-flow, spending trend sparkline, category breakdown, savings goals with contributions |
| **Purchases** | A wishlist with prices — tick one off and the spend lands in your ledger and comes straight out of your available money |
| **Goals** | Professional & personal goals with milestones and animated progress |
| **Habits** | Daily check-ins, streaks, weekly targets, 12-week heatmap |
| **Games** | Tic-Tac-Toe, Memory and Dame (draughts). Play the computer at three strengths, or share a link and play a friend with live camera and mic |
| **Notes & Journal** | Colour-coded notes, daily journal prompt, mood-linked entries, full-text search |
| **Profile** | Avatar upload, 5 accent themes, dark/light morph toggle, widget customisation, currency & Pomodoro settings, JSON export |

Extras: glassmorphism + aurora background, animated theme ripple, confetti celebrations, haptic feedback, floating quick-action button, bottom navigation, offline/online toasts, keyboard shortcuts, PWA manifest, reduced-motion support.

---

## 🚀 Run it locally

ES modules require **http://**, not `file://`. Use any static server from the project root:

```powershell
# Python
python -m http.server 5599

# or Node
npx serve .
```

Then open <http://localhost:5599/index.html>.

VS Code's **Live Server** extension works too.

> Add `localhost` under **Firebase Console → Authentication → Settings → Authorized domains** if it is not already there.

---

## 🔥 Firebase setup

The project is already wired to the `planner-project-7ab9e` project in [js/config.js](js/config.js). To point it at your own project, replace `firebaseConfig` there.

In the [Firebase Console](https://console.firebase.google.com):

1. **Authentication → Sign-in method** → enable **Email/Password**.
2. **Firestore Database** → create a database (production mode).
3. **Storage** → get started (only needed for profile photos).
4. Deploy the security rules included here:

```powershell
npm install -g firebase-tools
firebase login
firebase use planner-project-7ab9e
firebase deploy --only firestore:rules,storage:rules
```

### Deploy the app (optional)

```powershell
firebase deploy --only hosting
```

`firebase.json` serves the project root as a single-page app.

---

## 🗄️ Data model

Everything is namespaced per user, so the security rules stay trivial and airtight.

```
users/{uid}                     profile, prefs, badges, stats
users/{uid}/tasks/{id}          title, notes, category, priority, due, done, order
users/{uid}/events/{id}         title, type, date, time, duration, location
users/{uid}/goals/{id}          title, area, target, milestones[]
users/{uid}/savings/{id}        title, target, saved, deadline
users/{uid}/txns/{id}           type, amount, category, date, note
users/{uid}/habits/{id}         name, emoji, target, log{YYYY-MM-DD: true}
users/{uid}/notes/{id}          title, body, kind (note|journal), color, mood
users/{uid}/moods/{YYYY-MM-DD}  mood, score
users/{uid}/purchases/{id}      title, price, category, note, bought, boughtAt, txnId

rooms/{code}                    a games table: gameId, level, host/guest, state,
                                seq, media flags and the WebRTC offer/answer
rooms/{code}/iceHost|iceGuest   ICE candidates, one lane per seat
```

Game rooms are the only documents that live outside `users/{uid}`, because two
people have to read and write the same board. A room is readable only by a
signed-in user who already knows its code (it is never listable), writable only
by the two players, and the host's browser deletes it on the way out.

Rules ([firestore.rules](firestore.rules), [storage.rules](storage.rules)): only `request.auth.uid == uid` may read or write anything under `users/`; game rooms are limited to their two players; everything else is denied.

> Remote games need the `rooms` rules published. If invites fail with a
> permission error, run `firebase deploy --only firestore:rules`.

---

## 📁 Project structure

```
index.html                 App shell, splash, ambient background
manifest.webmanifest       PWA manifest
firebase.json              Hosting + rules config
firestore.rules            Per-user Firestore isolation
storage.rules              Per-user Storage isolation

css/
  base.css                 Design tokens, themes, typography, animations
  components.css           Buttons, cards, fields, rings, charts, modals, toasts
  layout.css               App shell, topbar, sidebar, bottom nav, grids
  pages.css                Page-specific styling
  games.css                Arcade lobby, boards, video dock, game animations

js/
  config.js                Firebase config + app constants (categories, badges, quotes)
  firebase.js              SDK init + friendly auth error messages
  store.js                 Reactive Firestore store, CRUD, selectors, badge engine
  router.js                Tiny hash router with auth guard
  ui.js                    Theme, toasts, modals, rings, sparklines, swipe, sortable
  utils.js                 DOM, date, number and text helpers
  icons.js                 Inline SVG icon set
  app.js                   Bootstrap: routes, auth watcher, shortcuts
  views/
    public.js              Landing, login, signup, forgot password
    shell.js               Sidebar, topbar, bottom nav, FAB, page mounting
    dashboard.js  tasks.js  calendar.js  finance.js
    goals.js      habits.js  notes.js     profile.js
    purchases.js           Wishlist that feeds the ledger
    games.js               Arcade lobby, table, invites, video dock
    forms.js               Modal forms for every entity
    focus.js               Shared Pomodoro timer
  arcade/
    index.js               Game registry + the rules every game implements
    rooms.js               Firestore transport for a shared table
    rtc.js                 WebRTC camera/mic call, signalled through the room
    games/                 tictactoe.js, memory.js, dame.js
```

Each game is a self-contained module: pure state in, pure state out, plus a
`view()` that returns HTML. Nothing in `games/` knows whether its opponent is a
person or the computer, which is why every game works in both modes for free.

---

## ⌨️ Keyboard shortcuts

`d` dashboard · `t` tasks · `c` calendar · `m` money · `b` purchases · `g` goals · `h` habits · `y` games · `j` journal · `p` profile

---

## 🎨 Customising

- **Accents** — edit `ACCENTS` in [js/config.js](js/config.js) and the matching `[data-accent='…']` blocks in [css/base.css](css/base.css).
- **Badges** — add rules to `evaluateBadges()` in [js/store.js](js/store.js) and entries in `BADGES`.
- **Quotes** — extend the `QUOTES` array in [js/config.js](js/config.js).
- **Widgets** — dashboard widgets are toggled from Profile → Dashboard widgets and stored in `prefs.widgets`.
# 20perecnt




Features (concise)

- Authentication: Email sign-up, sign-in, password reset, email verification, and persistent sessions.

- Profile & Preferences: Per-user profile with display name, photo, bio, and preferences (theme, accent, text scale, week start, focus/break lengths, widgets).

- Tasks: Create, update, reorder, complete/undo tasks, with timestamps and ordering; today/overdue filters and batch reordering.

- Events / Calendar: Create events, appointments, reminders with time/location/notes/duration; list by date and upcoming events.

- Google Calendar Sync: Two-way sync (pull then push), conflict resolution via content signature, and remote-create/patch/delete mirroring.

- Goals: Goals with milestones and progress tracking; computed progress and goal lists by area.

- Savings & Transactions: Savings goals, income/expense transactions, monthly cashflow, and category summaries.


- Purchases (Wish-list): Wish-list items that can be marked bought; buying creates linked transactions; edits keep linked txn in sync.

- Prayer Tracker: Daily prayer check-ins (per-day arrays), streaks, remove/clear utilities, and batch deletion of tracker data.

- Badges & Stats: Achievement rules (task counts, streaks, focus sessions, savings milestones) and automatic badge evaluation.

- Archive & Reporting: Monthly summaries (tasks, money, habits, moods, prayers, notes, events, goals) and per-day activity snapshots.
