/**
 * LifeFlow — shared create/edit forms rendered inside modals.
 * Every form works for both "new" and "edit" by passing an existing record.
 */
import { esc, today, uid } from '../utils.js';
import { icon } from '../icons.js';
import { modal, toast, confirmDialog, confetti } from '../ui.js';
import * as store from '../store.js';
import { TASK_CATEGORIES, PRIORITIES, EVENT_TYPES, GOAL_AREAS } from '../config.js';

/* ------------------------------ helpers ------------------------------ */
const field = (label, input, hint = '') => `
  <div class="field">
    <label>${esc(label)}</label>
    ${input}
    ${hint ? `<span class="field__hint">${esc(hint)}</span>` : ''}
  </div>`;

const options = (list, selected, valueKey = 'id', labelKey = 'label') =>
  list
    .map(
      (o) =>
        `<option value="${esc(o[valueKey])}" ${o[valueKey] === selected ? 'selected' : ''}>${
          o.emoji ? `${o.emoji} ` : ''
        }${esc(o[labelKey])}</option>`
    )
    .join('');

const footer = (saveLabel = 'Save', showDelete = false) => `
  ${showDelete ? `<button class="btn btn--danger btn--icon" data-delete type="button" aria-label="Delete">${icon('trash')}</button>` : ''}
  <button class="btn btn--ghost" data-modal-close type="button">Cancel</button>
  <button class="btn btn--primary" data-save type="button">${esc(saveLabel)}</button>`;

/** Wires the save / delete buttons of a modal form. */
function wire(box, close, { collection, id, read, validate, onSaved, deleteLabel = 'this item' }) {
  const save = box.querySelector('[data-save]');
  const del = box.querySelector('[data-delete]');
  const form = box.querySelector('form');

  const submit = async () => {
    const data = read();
    const error = validate?.(data);
    if (error) { toast(error, 'error'); return; }
    save.classList.add('is-loading');
    try {
      if (id) await store.update(collection, id, data);
      else await store.create(collection, data);
      close();
      onSaved?.(data, !id);
    } catch (err) {
      console.error(err);
      toast(err.message || 'Could not save. Please try again.', 'error');
    } finally {
      save.classList.remove('is-loading');
    }
  };

  save.addEventListener('click', submit);
  form?.addEventListener('submit', (e) => { e.preventDefault(); submit(); });
  form?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && !e.shiftKey) { e.preventDefault(); submit(); }
  });

  del?.addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: 'Delete?',
      message: `This will permanently remove ${deleteLabel}.`,
      confirmText: 'Delete',
      danger: true
    });
    if (!ok) return;
    await store.remove(collection, id);
    close();
    toast('Deleted', 'info');
  });
}

/* =========================================================
   Task
   ========================================================= */
export function openTaskForm(task = null, defaults = {}) {
  const t = task || {};
  modal({
    title: task ? 'Edit task' : 'New task',
    body: `
      <form class="grid" style="gap:var(--s-4)">
        ${field('What needs doing?', `<input class="input" name="title" value="${esc(t.title || '')}" placeholder="e.g. Prepare quarterly review" maxlength="140" required />`)}
        ${field('Notes', `<textarea class="textarea" name="note" style="min-height:84px" placeholder="Optional details…" maxlength="800">${esc(t.note || '')}</textarea>`)}
        <div class="g-2">
          ${field('Category', `<select class="select" name="category">${options(TASK_CATEGORIES, t.category || defaults.category || 'personal')}</select>`)}
          ${field('Priority', `<select class="select" name="priority">${options(PRIORITIES, t.priority || 'med')}</select>`)}
        </div>
        <div class="g-2">
          ${field('Due date', `<input class="input" type="date" name="due" value="${esc(t.due || defaults.due || '')}" />`)}
          ${field('Time', `<input class="input" type="time" name="time" value="${esc(t.time || '')}" />`)}
        </div>
      </form>`,
    footer: footer(task ? 'Save changes' : 'Add task', Boolean(task)),
    onMount(box, close) {
      const f = box.querySelector('form');
      wire(box, close, {
        collection: 'tasks',
        id: task?.id,
        deleteLabel: 'this task',
        read: () => ({
          title: f.title.value.trim(),
          note: f.note.value.trim(),
          category: f.category.value,
          priority: f.priority.value,
          due: f.due.value || null,
          time: f.time.value || null,
          done: t.done || false,
          order: t.order ?? Date.now() % 100000
        }),
        validate: (d) => (!d.title ? 'Please give your task a name.' : null),
        onSaved: (_, isNew) => toast(isNew ? 'Task added ✅' : 'Task updated')
      });
    }
  });
}

/* =========================================================
   Event / appointment
   ========================================================= */
export function openEventForm(event = null, defaults = {}) {
  const e = event || {};
  modal({
    title: event ? 'Edit entry' : 'New event',
    body: `
      <form class="grid" style="gap:var(--s-4)">
        ${field('Title', `<input class="input" name="title" value="${esc(e.title || '')}" placeholder="e.g. Dentist appointment" maxlength="120" required />`)}
        ${field('Type', `<select class="select" name="type">${options(EVENT_TYPES, e.type || defaults.type || 'event')}</select>`)}
        <div class="g-2">
          ${field('Date', `<input class="input" type="date" name="date" value="${esc(e.date || defaults.date || today())}" required />`)}
          ${field('Time', `<input class="input" type="time" name="time" value="${esc(e.time || '')}" />`)}
        </div>
        ${field('Location', `<input class="input" name="location" value="${esc(e.location || '')}" placeholder="Optional" maxlength="120" />`)}
        ${field('Notes', `<textarea class="textarea" name="note" style="min-height:78px" maxlength="600" placeholder="Anything to remember…">${esc(e.note || '')}</textarea>`)}
      </form>`,
    footer: footer(event ? 'Save changes' : 'Add to calendar', Boolean(event)),
    onMount(box, close) {
      const f = box.querySelector('form');
      wire(box, close, {
        collection: 'events',
        id: event?.id,
        deleteLabel: 'this calendar entry',
        read: () => ({
          title: f.title.value.trim(),
          type: f.type.value,
          date: f.date.value,
          time: f.time.value || null,
          location: f.location.value.trim(),
          note: f.note.value.trim()
        }),
        validate: (d) => (!d.title ? 'Please add a title.' : !d.date ? 'Please choose a date.' : null),
        onSaved: (_, isNew) => toast(isNew ? 'Added to your calendar 📅' : 'Entry updated')
      });
    }
  });
}

/* =========================================================
   Goal (personal / professional)
   ========================================================= */
export function openGoalForm(goal = null, defaults = {}) {
  const g = goal || {};
  const milestones = Array.isArray(g.milestones) ? g.milestones : [];

  modal({
    title: goal ? 'Edit goal' : 'New goal',
    body: `
      <form class="grid" style="gap:var(--s-4)">
        ${field('Goal', `<input class="input" name="title" value="${esc(g.title || '')}" placeholder="e.g. Get promoted to senior" maxlength="120" required />`)}
        ${field('Why it matters', `<textarea class="textarea" name="why" style="min-height:76px" maxlength="400" placeholder="Your motivation…">${esc(g.why || '')}</textarea>`)}
        <div class="g-2">
          ${field('Area', `<select class="select" name="area">${options(GOAL_AREAS, g.area || defaults.area || 'personal')}</select>`)}
          ${field('Target date', `<input class="input" type="date" name="target" value="${esc(g.target || '')}" />`)}
        </div>
        <div class="field">
          <label>Milestones</label>
          <div class="milestones" data-milestones>
            ${milestones.map((m) => milestoneRow(m)).join('')}
          </div>
          <button class="btn btn--sm btn--ghost mt-2" type="button" data-add-milestone>${icon('plus')} Add milestone</button>
          <span class="field__hint">Progress is calculated automatically from your milestones.</span>
        </div>
      </form>`,
    footer: footer(goal ? 'Save changes' : 'Create goal', Boolean(goal)),
    onMount(box, close) {
      const f = box.querySelector('form');
      const list = box.querySelector('[data-milestones]');

      box.querySelector('[data-add-milestone]').addEventListener('click', () => {
        list.insertAdjacentHTML('beforeend', milestoneRow({ id: uid('ms'), text: '', done: false }));
        list.lastElementChild.querySelector('input[type="text"]').focus();
      });
      list.addEventListener('click', (ev) => {
        const rm = ev.target.closest('[data-rm]');
        if (rm) rm.closest('.milestone').remove();
      });

      wire(box, close, {
        collection: 'goals',
        id: goal?.id,
        deleteLabel: 'this goal',
        read: () => ({
          title: f.title.value.trim(),
          why: f.why.value.trim(),
          area: f.area.value,
          target: f.target.value || null,
          milestones: Array.from(list.querySelectorAll('.milestone'))
            .map((row) => ({
              id: row.dataset.id,
              text: row.querySelector('input[type="text"]').value.trim(),
              done: row.querySelector('input[type="checkbox"]').checked
            }))
            .filter((m) => m.text)
        }),
        validate: (d) => (!d.title ? 'Please name your goal.' : null),
        onSaved: (_, isNew) => toast(isNew ? 'Goal created 🎯' : 'Goal updated')
      });
    }
  });
}

function milestoneRow(m) {
  return `
    <div class="milestone" data-id="${esc(m.id || uid('ms'))}">
      <label class="check">
        <input type="checkbox" ${m.done ? 'checked' : ''} />
        <span class="check__box">${icon('check')}</span>
      </label>
      <input type="text" class="input" style="min-height:38px;padding:7px 11px;font-size:.84rem" value="${esc(m.text || '')}" placeholder="Milestone…" maxlength="90" />
      <button type="button" class="iconbtn iconbtn--sm iconbtn--bare" data-rm aria-label="Remove">${icon('close')}</button>
    </div>`;
}

/* =========================================================
   Savings goal
   ========================================================= */
export function openSavingsForm(goal = null) {
  const g = goal || {};
  modal({
    title: goal ? 'Edit savings goal' : 'New savings goal',
    body: `
      <form class="grid" style="gap:var(--s-4)">
        <div class="flex gap-3">
          <div class="field" style="width:88px">
            <label>Icon</label>
            <input class="input center" name="emoji" value="${esc(g.emoji || '🎯')}" maxlength="4" style="font-size:1.3rem" />
          </div>
          <div class="field grow">
            <label>Goal name</label>
            <input class="input" name="title" value="${esc(g.title || '')}" placeholder="e.g. Emergency fund" maxlength="80" required />
          </div>
        </div>
        <div class="g-2">
          ${field('Target amount', `<input class="input" type="number" name="target" min="0" step="0.01" value="${esc(g.target ?? '')}" placeholder="5000" required />`)}
          ${field('Saved so far', `<input class="input" type="number" name="saved" min="0" step="0.01" value="${esc(g.saved ?? 0)}" />`)}
        </div>
        ${field('Target date', `<input class="input" type="date" name="deadline" value="${esc(g.deadline || '')}" />`)}
      </form>`,
    footer: footer(goal ? 'Save changes' : 'Create goal', Boolean(goal)),
    onMount(box, close) {
      const f = box.querySelector('form');
      wire(box, close, {
        collection: 'savings',
        id: goal?.id,
        deleteLabel: 'this savings goal',
        read: () => ({
          emoji: f.emoji.value.trim() || '🎯',
          title: f.title.value.trim(),
          target: Number(f.target.value) || 0,
          saved: Number(f.saved.value) || 0,
          deadline: f.deadline.value || null
        }),
        validate: (d) => (!d.title ? 'Please name your goal.' : d.target <= 0 ? 'Set a target amount above zero.' : null),
        onSaved: (d, isNew) => {
          toast(isNew ? 'Savings goal created 💰' : 'Goal updated');
          if (d.saved >= d.target) confetti();
        }
      });
    }
  });
}

/** Quick "add money" sheet for a savings goal. */
export function openContribute(goal) {
  modal({
    title: `Add to ${goal.title}`,
    body: `
      <form class="grid" style="gap:var(--s-4)">
        ${field('Amount', `<input class="input" type="number" name="amount" min="0" step="0.01" placeholder="100" autofocus />`)}
        <div class="chips-row" data-quick>
          ${[10, 25, 50, 100, 250].map((v) => `<button type="button" data-v="${v}">+${v}</button>`).join('')}
        </div>
      </form>`,
    footer: `<button class="btn btn--ghost" data-modal-close type="button">Cancel</button>
             <button class="btn btn--primary" data-save type="button">Add</button>`,
    onMount(box, close) {
      const f = box.querySelector('form');
      box.querySelectorAll('[data-quick] button').forEach((b) =>
        b.addEventListener('click', () => {
          f.amount.value = String((Number(f.amount.value) || 0) + Number(b.dataset.v));
        })
      );
      box.querySelector('[data-save]').addEventListener('click', async () => {
        const amount = Number(f.amount.value) || 0;
        if (amount <= 0) return toast('Enter an amount above zero.', 'error');
        const saved = (Number(goal.saved) || 0) + amount;
        await store.update('savings', goal.id, { saved });
        close();
        toast(`Added to ${goal.title} 🎉`);
        if (saved >= Number(goal.target)) { confetti(); store.evaluateBadges(); }
      });
    }
  });
}

/* =========================================================
   Transaction
   ========================================================= */
const TXN_CATEGORIES = [
  { id: 'salary', label: 'Salary', emoji: '💼' },
  { id: 'freelance', label: 'Freelance', emoji: '🧑‍💻' },
  { id: 'food', label: 'Food', emoji: '🍽️' },
  { id: 'transport', label: 'Transport', emoji: '🚌' },
  { id: 'home', label: 'Home', emoji: '🏠' },
  { id: 'shopping', label: 'Shopping', emoji: '🛍️' },
  { id: 'health', label: 'Health', emoji: '🩺' },
  { id: 'fun', label: 'Fun', emoji: '🎬' },
  { id: 'bills', label: 'Bills', emoji: '🧾' },
  { id: 'other', label: 'Other', emoji: '✨' }
];

export function txnCategory(id) {
  return TXN_CATEGORIES.find((c) => c.id === id) || TXN_CATEGORIES.at(-1);
}

export function openTxnForm(txn = null, defaults = {}) {
  const t = txn || {};
  modal({
    title: txn ? 'Edit entry' : 'New entry',
    body: `
      <form class="grid" style="gap:var(--s-4)">
        <div class="segmented" role="tablist" data-type style="width:100%">
          <button type="button" role="tab" data-v="expense" aria-selected="${(t.type || defaults.type || 'expense') === 'expense'}" style="flex:1">Expense</button>
          <button type="button" role="tab" data-v="income" aria-selected="${(t.type || defaults.type) === 'income'}" style="flex:1">Income</button>
        </div>
        ${field('Amount', `<input class="input" type="number" name="amount" min="0" step="0.01" value="${esc(t.amount ?? '')}" placeholder="0.00" required />`)}
        ${field('Description', `<input class="input" name="title" value="${esc(t.title || '')}" placeholder="e.g. Groceries" maxlength="90" />`)}
        <div class="g-2">
          ${field('Category', `<select class="select" name="category">${options(TXN_CATEGORIES, t.category || 'other')}</select>`)}
          ${field('Date', `<input class="input" type="date" name="date" value="${esc(t.date || today())}" />`)}
        </div>
      </form>`,
    footer: footer(txn ? 'Save changes' : 'Add entry', Boolean(txn)),
    onMount(box, close) {
      const f = box.querySelector('form');
      let type = t.type || defaults.type || 'expense';
      box.querySelectorAll('[data-type] button').forEach((b) =>
        b.addEventListener('click', () => {
          type = b.dataset.v;
          box.querySelectorAll('[data-type] button').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
        })
      );
      wire(box, close, {
        collection: 'txns',
        id: txn?.id,
        deleteLabel: 'this entry',
        read: () => ({
          type,
          amount: Number(f.amount.value) || 0,
          title: f.title.value.trim() || txnCategory(f.category.value).label,
          category: f.category.value,
          date: f.date.value || today()
        }),
        validate: (d) => (d.amount <= 0 ? 'Enter an amount above zero.' : null),
        onSaved: (_, isNew) => toast(isNew ? 'Entry saved 💸' : 'Entry updated')
      });
    }
  });
}

/* =========================================================
   Purchase — something you plan to buy
   ========================================================= */
export const PURCHASE_PRIORITIES = [
  { id: 'need', label: 'Need', emoji: '❗' },
  { id: 'want', label: 'Want', emoji: '💭' }
];

export function purchasePriority(id) {
  return PURCHASE_PRIORITIES.find((p) => p.id === id) || PURCHASE_PRIORITIES[1];
}

export function openPurchaseForm(item = null, defaults = {}) {
  const p = item || {};
  modal({
    title: item ? 'Edit item' : 'New purchase',
    body: `
      <form class="grid" style="gap:var(--s-4)">
        ${field('What would you like to buy?', `<input class="input" name="title" value="${esc(p.title || '')}" placeholder="e.g. Running shoes" maxlength="90" required />`)}
        <div class="g-2">
          ${field(`Price (${esc(store.currency())})`, `<input class="input" type="number" name="price" min="0" step="0.01" value="${esc(p.price ?? '')}" placeholder="0.00" />`, 'Logged as an expense the moment you tick it off.')}
          ${field('Category', `<select class="select" name="category">${options(TXN_CATEGORIES, p.category || defaults.category || 'shopping')}</select>`)}
        </div>
        <div class="g-2">
          ${field('Priority', `<select class="select" name="priority">${options(PURCHASE_PRIORITIES, p.priority || defaults.priority || 'want')}</select>`)}
          ${field('Where', `<input class="input" name="shop" value="${esc(p.shop || '')}" placeholder="Optional shop or link" maxlength="160" />`)}
        </div>
        ${field('Notes', `<textarea class="textarea" name="note" style="min-height:70px" maxlength="400" placeholder="Size, colour, why you want it…">${esc(p.note || '')}</textarea>`)}
      </form>`,
    footer: footer(item ? 'Save changes' : 'Add to list', Boolean(item)),
    onMount(box, close) {
      const f = box.querySelector('form');
      wire(box, close, {
        collection: 'purchases',
        id: item?.id,
        deleteLabel: 'this item',
        read: () => ({
          title: f.title.value.trim(),
          price: Number(f.price.value) || 0,
          category: f.category.value,
          priority: f.priority.value,
          shop: f.shop.value.trim(),
          note: f.note.value.trim(),
          bought: p.bought || false,
          boughtAt: p.boughtAt ?? null,
          txnId: p.txnId ?? null
        }),
        validate: (d) =>
          !d.title ? 'What are you planning to buy?' : d.price < 0 ? 'A price cannot be negative.' : null,
        onSaved: (data, isNew) => {
          if (!isNew) store.syncPurchaseTxn({ ...p, ...data, id: item.id });
          toast(isNew ? 'Added to your list 🛒' : 'Item updated');
        }
      });
    }
  });
}

/* =========================================================
   Habit
   ========================================================= */
export function openHabitForm(habit = null) {
  const h = habit || {};
  modal({
    title: habit ? 'Edit habit' : 'New habit',
    body: `
      <form class="grid" style="gap:var(--s-4)">
        <div class="flex gap-3">
          <div class="field" style="width:88px">
            <label>Icon</label>
            <input class="input center" name="emoji" value="${esc(h.emoji || '🔥')}" maxlength="4" style="font-size:1.3rem" />
          </div>
          <div class="field grow">
            <label>Habit</label>
            <input class="input" name="title" value="${esc(h.title || '')}" placeholder="e.g. Read 20 minutes" maxlength="70" required />
          </div>
        </div>
        <div class="g-2">
          ${field('Time of day', `<select class="select" name="slot">${options(
            [
              { id: 'anytime', label: 'Anytime' },
              { id: 'morning', label: 'Morning' },
              { id: 'afternoon', label: 'Afternoon' },
              { id: 'evening', label: 'Evening' }
            ],
            h.slot || 'anytime'
          )}</select>`)}
          ${field('Weekly target', `<input class="input" type="number" name="weeklyTarget" min="1" max="7" value="${esc(h.weeklyTarget || 7)}" />`)}
        </div>
        ${field('Why', `<input class="input" name="why" value="${esc(h.why || '')}" placeholder="Optional motivation" maxlength="120" />`)}
      </form>`,
    footer: footer(habit ? 'Save changes' : 'Create habit', Boolean(habit)),
    onMount(box, close) {
      const f = box.querySelector('form');
      wire(box, close, {
        collection: 'habits',
        id: habit?.id,
        deleteLabel: 'this habit and its history',
        read: () => ({
          emoji: f.emoji.value.trim() || '🔥',
          title: f.title.value.trim(),
          slot: f.slot.value,
          weeklyTarget: Math.min(7, Math.max(1, Number(f.weeklyTarget.value) || 7)),
          why: f.why.value.trim(),
          log: h.log || [],
          streak: h.streak || 0
        }),
        validate: (d) => (!d.title ? 'Please name your habit.' : null),
        onSaved: (_, isNew) => toast(isNew ? 'Habit created 🔥' : 'Habit updated')
      });
    }
  });
}

/* =========================================================
   Note / journal
   ========================================================= */
const NOTE_COLORS = ['#7c6cff', '#35d6ff', '#ff7ac6', '#2fd39b', '#ffb547', '#ff5f6d'];

export function openNoteForm(note = null, defaults = {}) {
  const n = note || {};
  const type = n.type || defaults.type || 'note';
  modal({
    title: note ? 'Edit entry' : type === 'journal' ? 'New journal entry' : 'New note',
    body: `
      <form class="grid" style="gap:var(--s-4)">
        <div class="segmented" data-kind style="width:100%">
          <button type="button" data-v="note" aria-selected="${type === 'note'}" style="flex:1">Note</button>
          <button type="button" data-v="journal" aria-selected="${type === 'journal'}" style="flex:1">Journal</button>
        </div>
        ${field('Title', `<input class="input" name="title" value="${esc(n.title || '')}" placeholder="Give it a title…" maxlength="90" />`)}
        ${field('Content', `<textarea class="textarea" name="body" style="min-height:180px" placeholder="Write freely…" maxlength="8000">${esc(n.body || '')}</textarea>`)}
        <div class="field">
          <label>Colour</label>
          <div class="swatches" data-colors>
            ${NOTE_COLORS.map(
              (c) =>
                `<button type="button" class="swatch" data-c="${c}" style="background:${c}" aria-pressed="${
                  (n.color || NOTE_COLORS[0]) === c
                }" aria-label="Colour ${c}"></button>`
            ).join('')}
          </div>
        </div>
        ${field('Tags', `<input class="input" name="tags" value="${esc((n.tags || []).join(', '))}" placeholder="ideas, work, gratitude" maxlength="120" />`)}
      </form>`,
    footer: footer(note ? 'Save changes' : 'Save', Boolean(note)),
    onMount(box, close) {
      const f = box.querySelector('form');
      let color = n.color || NOTE_COLORS[0];
      let kind = type;

      box.querySelectorAll('[data-colors] .swatch').forEach((s) =>
        s.addEventListener('click', () => {
          color = s.dataset.c;
          box.querySelectorAll('[data-colors] .swatch').forEach((x) => x.setAttribute('aria-pressed', String(x === s)));
        })
      );
      box.querySelectorAll('[data-kind] button').forEach((b) =>
        b.addEventListener('click', () => {
          kind = b.dataset.v;
          box.querySelectorAll('[data-kind] button').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
        })
      );

      wire(box, close, {
        collection: 'notes',
        id: note?.id,
        deleteLabel: 'this entry',
        read: () => ({
          type: kind,
          title: f.title.value.trim() || (kind === 'journal' ? new Date().toLocaleDateString() : 'Untitled'),
          body: f.body.value,
          color,
          tags: f.tags.value
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
            .slice(0, 8)
        }),
        validate: (d) => (!d.body.trim() ? 'Write something first ✍️' : null),
        onSaved: (_, isNew) => { toast(isNew ? 'Saved 📝' : 'Updated'); store.evaluateBadges(); }
      });
    }
  });
}
