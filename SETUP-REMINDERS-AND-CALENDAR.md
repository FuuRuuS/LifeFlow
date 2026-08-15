# Reminders & Google Calendar — setup

Two features were added:

1. **Phone notifications** — prayer times, calendar entries, task due times and an optional morning summary.
2. **Two-way Google Calendar sync** — entries flow in both directions.

Notifications work immediately. Google Calendar needs one OAuth client id (steps below).

---

## 1. Notifications

Nothing to configure. Deploy, open the app, go to **Profile → Reminders** and turn on *Phone notifications*.

### Install the app first — this matters

| Platform | What is required |
| --- | --- |
| **Android / Chrome** | Works in a normal tab, but install the app (⋮ → *Install app*) for reliable delivery. |
| **iPhone / iPad** | **Mandatory:** iOS 16.4+ **and** Share → *Add to Home Screen*. Safari tabs can never show notifications. |
| **Desktop** | Works in a tab. |

Both require **HTTPS** (`localhost` also counts).

### How reliable is it?

| App state | Behaviour |
| --- | --- |
| Open or backgrounded | Reliable — checked every 30 seconds. |
| Installed PWA, closed | Best-effort. The service worker re-checks on Chrome's `periodicsync`, typically every 15–60 minutes. |
| iOS, closed | Not delivered until the app is opened. |

For guaranteed delivery with the app closed, a server has to push. See *Next step* at the bottom.

### Testing locally

```powershell
cd c:\git\20\Planner
python -m http.server 5173
```

Then open `http://localhost:5173`. Service workers and notifications are both allowed on `localhost`.

### Deploy

```powershell
firebase deploy --only hosting
```

After deploying a change to `sw.js`, fully close and reopen the app once so the new worker takes over.

---

## 2. Google Calendar — click-by-click

### Step 1 — Create/choose a Google Cloud project

1. Open <https://console.cloud.google.com/>.
2. Project picker (top bar) → **New project** → name it `LifeFlow` → **Create**.
   *You may reuse the existing `planner-project-7ab9e` Firebase project — it is already a Google Cloud project.*

### Step 2 — Enable the Calendar API

1. Go to **APIs & Services → Library**.
2. Search `Google Calendar API` → open it → **Enable**.

### Step 3 — Configure the consent screen

1. **APIs & Services → OAuth consent screen**.
2. User type: **External** → **Create**.
3. App name `LifeFlow`, user support email = your email, developer contact = your email → **Save and continue**.
4. **Scopes** → **Add or remove scopes** → paste `https://www.googleapis.com/auth/calendar` → **Update** → **Save and continue**.
5. **Test users** → **Add users** → add your own Gmail address → **Save and continue**.

> While the app is in *Testing*, only the test users you list can connect, and consent expires after 7 days. For personal use that is fine — just re-connect when asked. To remove the limit, click **Publish app** (Google only requires verification if you distribute it to others).

### Step 4 — Create the OAuth client id

1. **APIs & Services → Credentials → Create credentials → OAuth client ID**.
2. Application type: **Web application**. Name: `LifeFlow Web`.
3. Under **Authorized JavaScript origins**, click *Add URI* for each:
   - `https://planner-project-7ab9e.web.app`
   - `https://planner-project-7ab9e.firebaseapp.com`
   - `http://localhost:5173` (whatever port you use locally)
4. Leave **Authorized redirect URIs** empty — this app uses the token flow, not redirects.
5. **Create**, then copy the **Client ID** (looks like `1234567890-abcdef.apps.googleusercontent.com`).

### Step 5 — Paste it into the app

Open [js/config.js](js/config.js) and fill in `clientId`:

```js
export const GOOGLE = {
  clientId: '1234567890-abcdef.apps.googleusercontent.com',
  ...
};
```

Redeploy, then **Profile → Google Calendar → Connect Google Calendar**.

> The client id is a public identifier, exactly like the Firebase `apiKey` above it. The *Authorized JavaScript origins* list is what protects it. Never put a client **secret** in this file.

### How the sync behaves

- **Pull** runs first, using an incremental `syncToken`, so only changes are fetched.
- **Push** then sends any local entry whose content changed since the last sync.
- On conflict, **Google wins** (pull runs before push).
- Deleting an entry in LifeFlow deletes it in Google, and vice versa.
- Entries without a time become all-day events; timed entries default to 60 minutes, and the real duration is preserved once it comes back from Google.
- Syncs automatically on open (max once per 5 minutes) and via the **Sync now** button.

---

## Next step — notifications with the app fully closed

Add a server push. The service worker already contains the `push` handler, so the remaining work is:

1. Upgrade the Firebase project to the **Blaze** plan (Cloud Functions require billing; usage at this scale stays inside the free tier).
2. Generate a **Web Push certificate** (VAPID key pair) in Firebase Console → Project settings → Cloud Messaging.
3. Store each device's FCM token under `users/{uid}/devices/{token}`.
4. Add a scheduled Cloud Function (every 5 minutes) that recomputes the next prayer/event/task per user and calls the FCM send API.

Ask when you want this and it can be built on top of what is already here.

---

## Files added or changed

| File | Purpose |
| --- | --- |
| [sw.js](sw.js) | Service worker: shows notifications, background alarm re-check, push handler, tap-to-open. |
| [js/notify.js](js/notify.js) | Builds and fires the reminder schedule. |
| [js/gcal.js](js/gcal.js) | Google Calendar OAuth + two-way sync. |
| [js/config.js](js/config.js) | New `GOOGLE` block. |
| [js/store.js](js/store.js) | `notify`/`gcal` preference slots, delete hook for synced events. |
| [js/views/profile.js](js/views/profile.js) | *Reminders* and *Google Calendar* settings cards. |
| [js/app.js](js/app.js) | Boots both features. |
| [index.html](index.html) | iOS home-screen metas. |
| [firebase.json](firebase.json) | `sw.js` is never cached. |
