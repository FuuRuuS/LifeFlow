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
| **Games** | Party & couple games — **Truth or Dare** (7 decks: ice-breakers, friends, party, couple, flirty, deep, family), **In Sync** (this-or-that matching), **Know Me?** (guess your partner's answers) — plus **Quiz Duel** (10 trivia categories, speed + streak scoring), **Crazy Eights** (cards), **Game of the Goose** (dice race), Tic-Tac-Toe, Connect Four, Reversi, Dots & Boxes, Memory and Dame. Lobby shelves for couples, friends, board, cards and brain games. Play the computer, pass one phone around, or invite someone online with **text chat, quick reactions, voice (mic only) and video** |
| **Qur’an** | All 114 surahs in Uthmani script, 16 reciters, verse-by-verse audio with the **current verse highlighted and followed**, Arabic tafsir (Al-Muyassar, Al-Jalalayn, Al-Waseet, Al-Baghawi, Al-Qurtubi, Tanwir al-Miqbas) per verse, repeat/speed, bookmarks, search, mini player that keeps playing across pages. Each surah is cached after its first load |
| **Notes & Journal** | Colour-coded notes, daily journal prompt, mood-linked entries, full-text search |
| **Profile** | Avatar upload, **28 themes in 5 families** (Classic, Girly, Elegant & classy, Dark luxe, Hacker — with ambient effects), dark/light morph toggle, widget customisation, currency & Pomodoro settings, JSON export |

Extras: glassmorphism + aurora background, animated theme ripple, confetti celebrations, haptic feedback, floating quick-action button, bottom navigation, offline/online toasts, keyboard shortcuts, PWA manifest, reduced-motion support.

---

## 🚀 Run it locally

**No server needed:** double-click `index.html` (or open it with `file:///…/index.html`). An internet connection is still required for Firebase.

Browsers refuse to load ES modules from `file://`, so in that case `index.html` loads `js/app.bundle.js` — a single classic script generated from the sources. **After editing anything under `js/`, rebuild it** (plain Node, no dependencies):

```powershell
node tools/build-standalone.js
```

From `file://` everything works except:

- **Google Calendar sync** — Google sign-in only accepts http(s) origins.
- **Reminders** fire only while the tab is open (no service worker on `file://`).
- **Game invites** share a code instead of a link (a `file://` link only works on your computer).

Served over http(s), `index.html` loads the ES module sources directly (no rebuild needed):

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
by the two players after an atomic guest-seat claim. The host deletes it when
explicitly leaving the table or navigating to another page in the app. Reloading
or closing a tab no longer deletes the room; a reload returns to the same seat.
There is no automatic expiry/abandoned-room cleanup yet.

Rules ([firestore.rules](firestore.rules), [storage.rules](storage.rules)): only `request.auth.uid == uid` may read or write anything under `users/`; game rooms are limited to their two players; everything else is denied.

> Remote games need the `rooms` rules published. If invites fail with a
> permission error, run `firebase deploy --only firestore:rules`.

### Online games and voice/video troubleshooting

- Both players must sign in and open the same hosted app, then share the invite
  link or enter the room code. Hosting should use **HTTPS**. Plain HTTP on a LAN
  IP address does not permit camera/microphone access; localhost is an exception.
- Publish both the updated app and [firestore.rules](firestore.rules) to the
  Firebase project configured in [js/config.js](js/config.js). A local rules edit
  does not change the deployed database. Hard-refresh both clients after updating.
- Mic and camera start **off** for privacy. Each person turns on the devices they
  want to share and accepts their browser's permission prompt. If audio autoplay
  is blocked, use **Tap to hear your friend**. Voice works without a camera.
- **TURN is required for reliable calls across different networks.** The current
  `RTC.iceServers` setting in [js/config.js](js/config.js) is empty, so the app has
  STUN but no relay. Supply a working TURN service, ideally with UDP and TLS/TCP
  on port 443. Use provider-issued short-lived client credentials; never embed a
  provider API secret in this public frontend. Production credential renewal
  requires a trusted backend. A TURN service is not included in this repository.
- **Reconnect** opens a new signaling session without changing the game. Game
  moves and chat use Firestore independently of the voice/video connection.
- Room claims and moves now use transactions. Offline or conflicting writes
  leave the last shared board intact and show an error instead of advancing only
  one player's board.

Regression checks: `node --test tools/test-arcade.js` runs dependency-free room,
game-loop and navigation checks. `node tools/test-arcade-browser.js` runs two real
WebRTC peers in headless Edge/Chromium with **synthetic** camera/microphone input
and in-memory signaling. Set `ARCADE_BROWSER` if the browser is installed outside
the usual Windows locations. These checks do not contact Firebase or verify its
deployed rules, physical devices, or connectivity across separate networks.

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
  games.css                Arcade lobby, boards, video dock, chat, game animations
  quran.css                Qur’an reader, verse highlight, tafsir, sticky & mini player
  themes.css               Theme families (girly, elegant, dark luxe, hacker) — loaded last

js/
  config.js                Firebase config + app constants (categories, badges, quotes)
  firebase.js              SDK init + friendly auth error messages
  store.js                 Reactive Firestore store, CRUD, selectors, badge engine
  router.js                Tiny hash router with auth guard
  ui.js                    Theme, toasts, modals, rings, sparklines, swipe, sortable
  utils.js                 DOM, date, number and text helpers
  icons.js                 Inline SVG icon set
  fx.js                    Ambient theme effects (e.g. hacker rain)
  quran.js                 Qur’an data (alquran.cloud + IndexedDB cache) and the audio player
  app.js                   Bootstrap: routes, auth watcher, shortcuts
  app.bundle.js            GENERATED single-file build used from file:// (do not edit)
  views/
    public.js              Landing, login, signup, forgot password
    shell.js               Sidebar, topbar, bottom nav, FAB, page mounting
    dashboard.js  tasks.js  calendar.js  finance.js
    goals.js      habits.js  notes.js     profile.js
    purchases.js           Wishlist that feeds the ledger
    games.js               Arcade lobby, table, invites, chat, voice & video dock
    quran.js               Qur’an reader: surah index, verse follow, tafsir, settings
    forms.js               Modal forms for every entity
    focus.js               Shared Pomodoro timer
  arcade/
    index.js               Game registry + the rules every game implements
    rooms.js               Firestore transport for a shared table (+ capped chat)
    rtc.js                 WebRTC camera/mic call, signalled through the room
    games/                 tictactoe.js, connect4.js, reversi.js, dots.js, memory.js, dame.js,
                           truthdare.js, insync.js, knowme.js, quiz.js, eights.js, goose.js
                           (kit.js + pairs.js are shared helpers, not games)
```

Each game is a self-contained module: pure state in, pure state out, plus a
`view()` that returns HTML. Nothing in `games/` knows whether its opponent is a
person or the computer, which is why every game works in both modes for free.

---

## ⌨️ Keyboard shortcuts

`d` dashboard · `t` tasks · `c` calendar · `m` money · `b` purchases · `g` goals · `h` habits · `y` games · `q` Qur’an · `j` journal · `p` profile

---

## 🎨 Customising

- **Accents** — edit `ACCENTS` in [js/config.js](js/config.js) and the matching `[data-accent='…']` blocks in [css/base.css](css/base.css).
- **Badges** — add rules to `evaluateBadges()` in [js/store.js](js/store.js) and entries in `BADGES`.
- **Quotes** — extend the `QUOTES` array in [js/config.js](js/config.js).
- **Widgets** — dashboard widgets are toggled from Profile → Dashboard widgets and stored in `prefs.widgets`.
# 20perecnt
