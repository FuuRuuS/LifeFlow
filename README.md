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


This project is a lightweight e-commerce and order management system built mainly with HTML, JavaScript, jQuery, Bootstrap, and Firebase Firestore/Storage. It combines a storefront flow for customers and an admin dashboard for managing products, categories, orders, deliveries, returns, and monthly reports.

## 1. Main e-commerce features

### Customer-side landing and order flow

- Landing page: the app starts with a welcome menu where users can either:
  - place an order,
  - follow their order status.
- Order form: the customer can enter:
  - full name,
  - phone number,
  - address,
  - color choice for the product support,
  - confirmation of the order.
- Product ordering is connected to a Firebase database, where each order is stored as a document.
- The system supports product color variants and stores the selected color with the order.

### Product and category management

- Categories can be created with:
  - name,
  - image,
  - category type,
  - optional subcategory configuration.
- Products can be created with:
  - name,
  - image,
  - description,
  - category,
  - subcategory if applicable.
- Product and category lists are shown in tables with image previews.
- CRUD operations are implemented for categories and products:
  - add,
  - edit,
  - delete,
  - display.
- Firebase Storage is used to upload product and category images.

### Order progression workflow

The app implements a real operational order lifecycle:

1. Orders
   - New customer orders are inserted into the Orders collection.
   - Orders can be edited or deleted from the admin panel.
   - Each order includes customer info, product info, status, price, and date.

2. Preparation
   - When an order is confirmed, it is moved from Orders to Preparation.
   - This is the processing step before shipping.

3. Delivery
   - After preparation, the order is transferred to Delivery.
   - Delivery records are displayed in a dedicated table.
   - The admin can edit, delete, or return a delivery.

4. Delivered
   - Delivered orders are tracked separately.
   - The app keeps a separate collection for completed deliveries.

5. Return management
   - Orders from delivery can be marked as returned.
   - Returned orders are stored in a dedicated Return_Delivery collection.
   - Returned items are displayed in a dedicated return list.

### Monthly archive and statistics

- The system creates a monthly archive under a Firestore document named by month and year.
- It stores data such as:
  - monthly revenue,
  - costs,
  - salary,
  - net revenue,
  - delivered order count,
  - returned order count.
- Archive screens allow viewing:
  - delivered orders,
  - returned orders,
  - purchases,
  - monthly totals.
- The archive can be deleted when necessary.

### Administration dashboard

The admin page acts as the control center and offers access to:

- Orders
- Preparation
- Delivery
- Archive
- Categories
- Products
- Delivered
- Return_Delivery

This gives the administrator a complete overview of the operational workflow.

---

## 2. Main pages in the project

### index.html
- Landing page.
- Gives customers the choice to order or track their order.

### Form.html
- Customer form for order creation.
- Collects personal and order information.
- Stores data in Firebase.

### suivie.html
- Order tracking screen.
- Used to check the status of a customer order.

### admin.html
- Administrative dashboard.
- Central access for business operations.

### Categories.html
- Category list and management UI.
- Add, edit, and delete categories.

### Add_Categories.html
- Dedicated page to add a new category.
- Uploads image to Firebase Storage and writes to Firestore.

### Products.html
- Product list/dashboard.
- Displays all products with image, name, category, and subcategory.

### Add_Products.html
- Dedicated page for adding products.
- Handles product image upload, category selection, and subcategory logic.

### Orders.html
- Admin order management interface.
- Allows editing, deleting, and confirming orders.

### Preparation.html
- Displays orders in the preparation stage.
- Manages move from order to delivery.

### Delivery.html
- Active deliveries interface.
- Supports return and confirmation actions.

### Delivered.html
- Completed deliveries overview.

### Return_Delivery.html
- Returned delivery records list.

### Archive.html
- History and monthly business analytics.
- Displays revenue and order data summaries.

### Hamdoullah.html
- Business summary or dashboard page that shows delivered and returned totals.

---

## 3. Technical architecture

### Front end
- HTML + CSS templates
- Bootstrap-based design
- jQuery event handling
- Modal windows for edit/delete flows

### Backend / database
- Firebase Firestore is the main database.
- Firebase Storage is used for uploading and serving images.
- The app uses real-time listeners with onSnapshot to update dashboards when records change.

### Data model pattern
The app uses collections such as:

- Products
- Categories
- Orders
- Preparation
- Delivery
- Delivered
- Return_Delivery
- Archive

Each collection stores document objects with relevant properties, such as:

- FullName
- Number
- Address
- ProductName
- Color
- Price
- TotalPrice
- ProductPicture
- Status
- Date
- Comment

---

## 4. Notable business logic implemented

### Category type logic
- Categories can be configured as:
  - Without_Sub_Category
  - Enter_your_Sub_Category
- In the product form, the selected category decides whether a subcategory dropdown is shown or hidden.

### Product image upload
- Product and category images are uploaded to Firebase Storage.
- Download URLs are saved into Firestore documents.

### Order lifecycle movement
- Orders are moved through collections by actions like:
  - confirm order,
  - start preparation,
  - deliver,
  - archive,
  - return.

### Monthly archive
- The app computes archive data using a monthly document name derived from the current month and year.
- It stores separate nested collections for:
  - Purchases
  - Order_Delivered
  - Order_Returned

---

## 5. Strong points of the project

- Clear business workflow for an order management system.
- Good use of Firebase for rapid development.
- Real-time update behavior through Firestore listeners.
- Admin dashboard is practical and easy to navigate.
- Role separation between customer-facing pages and admin pages is clear.
- Product/category management is functional and visual.

---

## 6. Issues and weaknesses found in the code

The application works as a prototype, but there are several important issues that should be fixed before production use.

### 6.1 Repeated Firebase configuration
- The same Firebase config is duplicated across many files.
- This is error-prone and difficult to maintain.
- Best practice: create one shared config file or a single initialization script.

### 6.2 Inconsistent coding style and naming
- File names and variable names are inconsistent.
- Some variables are in English, some in French, some mixed.
- Example: "Hamdoullah", "suivie", "Preparation", "Return_Delivery", etc.
- This creates confusion and makes maintenance harder.

### 6.3 Potential logic bugs in product/category editing
- Some edit flows are fragile and may overwrite or delete records incorrectly.
- In several places, data is deleted before recreating new documents.
- This may cause lost information or duplicate states if not carefully managed.

### 6.4 Missing validation and error handling
- Essential checks such as empty form validation, file validation, and Firebase failure handling are limited.
- The app should validate:
  - required fields,
  - valid phone number,
  - image type and size,
  - Firestore write errors,
  - network issues.

### 6.5 Security concerns
- No Firebase Authentication is used in the admin area.
- Anyone with the page URL could access the admin pages.
- For real production, authentication and role-based authorization are mandatory.

### 6.6 Data integrity risks
- Some operations use doc IDs as names (for example, product name or category name as document ID).
- This can cause collisions when names are duplicated.
- Better to use generated IDs or unique stable IDs.

### 6.7 Duplicate collections and inconsistent naming
- Some collection names differ by casing or naming pattern.
- Example: "Order_Delivered" vs "Order_Delivered" and multiple archive paths.
- Standardized naming reduces bugs.

### 6.8 UI/UX improvements needed
- No global loading or success/error notifications system.
- There is no responsive optimization for mobile-heavy flows.
- The app still feels like a dashboard prototype rather than a polished e-commerce platform.

---

## 7. Suggested enhancements to improve the project

### High priority improvements

1. Add Firebase Authentication
   - Protect admin pages.
   - Use a login system for administrators.
   - Add role-based permissions.

2. Centralize Firebase config
   - Create one config file and import it everywhere.
   - Avoid repeating the same code in each HTML page.

3. Improve data model design
   - Use UUIDs for document IDs.
   - Normalize naming across collections.
   - Store all timestamps in a consistent format.

4. Add form validation
   - Validate customer phone numbers.
   - Validate required product/category fields.
   - Check file authenticity before upload.

5. Add better error and success notifications
   - Use toast messages or notification banners.
   - Show success after product/category/order updates.

6. Clean up the order transition logic
   - Create a single shared helper function to move orders between collections.
   - Avoid duplicate transfer logic in multiple files.

### Medium priority improvements

7. Add search and filtering
   - Search products by name or category.
   - Filter orders by status, date, or customer.

8. Add inventory management
   - Track stock quantity.
   - Block orders when stock is unavailable.

9. Add dashboard analytics
   - Charts for revenue, returns, successful deliveries, and sales trends.

10. Add customer order tracking page with real query support
   - Allow users to check order status by phone number or order ID.

11. Add image compression before upload
   - Reduce storage usage and increase loading speed.

### Nice-to-have improvements

12. Add dark mode and a modern storefront design.
13. Add multilingual support.
14. Add export features: CSV/PDF invoice export.
15. Add automatic archive generation per month.
16. Add soft deletion or audit logs for admin actions.

### Important note
- This is a web configuration for Firebase.
- For production, it is strongly recommended to:
  - secure Firestore rules,
  - enable Firebase Authentication,
  - restrict Storage access,
  - use environment variables instead of hardcoded values.

---

## 9. Final conclusion

This project is a functional e-commerce and order management prototype built around Firebase. It covers the core flow of product management, category management, customer orders, shipping workflow, return handling, and monthly archive tracking. The concept is solid and practical, but it needs stronger security, code consistency, validation, and architecture improvements before being considered production-ready.

Thanks for reading this summary. If you want, the next step can be to convert this app into a cleaner production version with a real Firebase project structure, admin authentication, and a modern storefront UI.

Thank you.

