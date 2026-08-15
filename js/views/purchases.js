/**
 * LifeFlow — Purchases: the wish list that keeps your money honest.
 * Ticking an item off writes a matching expense into Finance; un-ticking it
 * takes that expense back out again.
 */
import { esc, fmtMoney, relativeDay, ymd, countUp, haptic } from '../utils.js';
import { icon } from '../icons.js';
import { toast, confetti, confirmDialog, initSwipe } from '../ui.js';
import * as store from '../store.js';
import { openPurchaseForm, purchasePriority, txnCategory } from './forms.js';
import { navigate } from '../router.js';

export const meta = { title: 'Purchases', icon: 'cart', label: 'Purchases' };

const ui = { filter: 'planned' };

const FILTERS = [
  { id: 'planned', label: 'To buy' },
  { id: 'bought', label: 'Bought' },
  { id: 'all', label: 'All' }
];

export function render(root) {
  const cur = store.currency();
  const all = store.select.purchasesSorted();
  const planned = store.select.plannedPurchases();
  const plannedSpend = store.select.plannedSpend();
  const cash = store.select.cashflow();
  const spentThisMonth = boughtIn(ymd().slice(0, 7)).reduce((s, p) => s + (Number(p.price) || 0), 0);
  const list = applyFilter(all);

  root.innerHTML = `
    <div class="page">
      <section class="money-hero">
        <span class="eyebrow">Left this month after planned buys</span>
        <div class="money-hero__val ${cash.net - plannedSpend >= 0 ? 'pos' : 'neg'}" data-money="${cash.net - plannedSpend}">${esc(
          fmtMoney(cash.net - plannedSpend, cur)
        )}</div>
        <div class="money-hero__split">
          <div>
            <div class="fs-xs t-mute fw-7">AVAILABLE NOW</div>
            <div class="fw-8 ${cash.net >= 0 ? 'pos' : 'neg'}">${esc(fmtMoney(cash.net, cur))}</div>
          </div>
          <div>
            <div class="fs-xs t-mute fw-7">STILL TO BUY</div>
            <div class="fw-8">${esc(fmtMoney(plannedSpend, cur))} · ${planned.length}</div>
          </div>
          <div>
            <div class="fs-xs t-mute fw-7">BOUGHT THIS MONTH</div>
            <div class="fw-8 neg">${esc(fmtMoney(spentThisMonth, cur))}</div>
          </div>
        </div>
      </section>

      <div class="flex-between">
        <div class="chips-row" data-filters>
          ${FILTERS.map(
            (f) =>
              `<button type="button" data-filter="${f.id}" aria-pressed="${ui.filter === f.id}">${esc(f.label)}${
                f.id === 'planned' && planned.length ? ` · ${planned.length}` : ''
              }</button>`
          ).join('')}
        </div>
        <button class="btn btn--primary btn--sm" data-new type="button">${icon('plus')} Item</button>
      </div>

      <section data-list>
        ${list.length ? `<div class="task-list">${list.map((p) => purchaseCard(p, cur)).join('')}</div>` : emptyState()}
      </section>

      <button class="btn btn--soft btn--block" data-go="/finance">${icon('wallet')} See these in your money records ${icon(
        'arrowRight'
      )}</button>
    </div>`;

  bind(root);
  const money = root.querySelector('[data-money]');
  if (money) countUp(money, Number(money.dataset.money), { format: (v) => fmtMoney(v, cur) });
}

/* ------------------------------ helpers ------------------------------ */
function boughtIn(monthKey) {
  return store.select.boughtPurchases().filter((p) => p.boughtAt && ymd(new Date(p.boughtAt)).startsWith(monthKey));
}

function applyFilter(all) {
  if (ui.filter === 'planned') return all.filter((p) => !p.bought);
  if (ui.filter === 'bought') return all.filter((p) => p.bought);
  return all;
}

/* ------------------------------ markup ------------------------------ */
function purchaseCard(p, cur) {
  const cat = txnCategory(p.category);
  const pri = purchasePriority(p.priority);
  const price = Number(p.price) || 0;
  return `
    <div class="swipe" data-id="${esc(p.id)}">
      <div class="swipe__actions" aria-hidden="true">
        <div class="swipe__action swipe__action--done">${icon('check')}</div>
        <div class="swipe__action swipe__action--del">${icon('trash')}</div>
      </div>
      <div class="swipe__content">
        <article class="task purchase${p.bought ? ' is-done' : ''}">
          <button class="check__box" data-toggle="${esc(p.id)}" type="button" aria-pressed="${Boolean(p.bought)}"
                  aria-label="${p.bought ? 'Mark as not bought yet' : 'Mark as bought'}" style="margin-top:2px">${icon('check')}</button>
          <div class="task__body" data-edit="${esc(p.id)}" role="button" tabindex="0">
            <span class="task__title">${esc(p.title)}</span>
            ${p.note ? `<span class="task__note">${esc(p.note)}</span>` : ''}
            <span class="task__meta">
              <span class="chip">${cat.emoji} ${esc(cat.label)}</span>
              <span class="chip${p.priority === 'need' ? ' chip--warning' : ''}">${pri.emoji} ${esc(pri.label)}</span>
              ${p.shop ? `<span class="chip">${esc(p.shop)}</span>` : ''}
              ${p.bought && p.boughtAt ? `<span class="chip chip--success">${icon('check')}${esc(relativeDay(ymd(new Date(p.boughtAt))))}</span>` : ''}
            </span>
          </div>
          <span class="purchase__price${p.bought ? ' neg' : ''}">${esc(fmtMoney(price, cur))}</span>
        </article>
      </div>
    </div>`;
}

function emptyState() {
  const msg = {
    planned: ['cart', 'Nothing on the list', 'Add what you would like to buy and see what it costs you.'],
    bought: ['checkCircle', 'Nothing bought yet', 'Tick an item off and it lands in your expenses.'],
    all: ['cart', 'Your list is empty', 'Plan a purchase and keep your spending intentional.']
  }[ui.filter];

  return `
    <div class="empty">
      <div class="empty__icon">${icon(msg[0])}</div>
      <h3>${esc(msg[1])}</h3>
      <p>${esc(msg[2])}</p>
      <button class="btn btn--sm btn--primary" data-new type="button">${icon('plus')} Add an item</button>
    </div>`;
}

/* ------------------------------ behaviour ------------------------------ */
function bind(root) {
  root.querySelectorAll('[data-new]').forEach((b) => b.addEventListener('click', () => openPurchaseForm()));
  root.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => navigate(b.dataset.go)));

  root.querySelectorAll('[data-filter]').forEach((b) =>
    b.addEventListener('click', () => { ui.filter = b.dataset.filter; render(root); })
  );

  root.querySelectorAll('[data-toggle]').forEach((b) =>
    b.addEventListener('click', async (e) => {
      e.stopPropagation();
      await toggle(b.dataset.toggle);
    })
  );

  root.querySelectorAll('[data-edit]').forEach((node) => {
    const open = () => {
      const item = store.state.purchases.find((p) => p.id === node.dataset.edit);
      if (item) openPurchaseForm(item);
    };
    node.addEventListener('click', open);
    node.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
    });
  });

  initSwipe(root, {
    onRight: (id) => toggle(id),
    onLeft: async (id) => {
      const item = store.state.purchases.find((p) => p.id === id);
      if (!item) return;
      const ok = await confirmDialog({
        title: 'Remove from list?',
        message: item.bought
          ? `“${item.title}” disappears from the list, but the expense stays in your records.`
          : `“${item.title}” will be removed from your list.`,
        confirmText: 'Remove',
        danger: true
      });
      if (ok) { await store.remove('purchases', id); toast('Removed from your list', 'info'); }
    }
  });
}

async function toggle(id) {
  const item = store.state.purchases.find((p) => p.id === id);
  if (!item) return;
  const cur = store.currency();
  try {
    const bought = await store.togglePurchase(item);
    haptic(12);
    if (bought) {
      confetti(14);
      const price = Number(item.price) || 0;
      toast(price > 0 ? `Bought — ${fmtMoney(price, cur)} logged as an expense 🛍️` : 'Bought 🛍️');
    } else {
      toast('Back on the list — expense removed', 'info');
    }
  } catch (err) {
    console.error(err);
    toast('Could not update that item.', 'error');
  }
}
