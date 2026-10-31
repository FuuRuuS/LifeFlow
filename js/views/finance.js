/**
 * LifeFlow — Finance: savings goals, cashflow and expense tracking.
 */
import { esc, fmtMoney, pct, ymd, relativeDay, countUp } from '../utils.js';
import { icon } from '../icons.js';
import { animateProgress, ring, sparkline, toast, confirmDialog, initSwipe } from '../ui.js';
import * as store from '../store.js';
import { openSavingsForm, openTxnForm, openContribute, txnCategory } from './forms.js';

export const meta = { title: 'Finance', icon: 'wallet', label: 'Money' };

const ui = { tab: 'overview', month: ymd().slice(0, 7) };

export function render(root) {
  const cur = store.currency();
  const fin = store.select.savingsTotals();
  const cash = store.select.cashflow(ui.month);
  const planned = store.select.plannedPurchases();
  const plannedSpend = store.select.plannedSpend();
  const txns = store.select
    .monthTxns(ui.month)
    .slice()
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  root.innerHTML = `
    <div class="page">
      <section class="money-hero">
        <span class="eyebrow">Net this month</span>
        <div class="money-hero__val ${cash.net >= 0 ? 'pos' : 'neg'}" data-money="${cash.net}">${esc(fmtMoney(cash.net, cur))}</div>
        <div class="money-hero__split">
          <div>
            <div class="fs-xs t-mute fw-7">INCOME</div>
            <div class="fw-8 pos">${esc(fmtMoney(cash.income, cur))}</div>
          </div>
          <div>
            <div class="fs-xs t-mute fw-7">EXPENSES</div>
            <div class="fw-8 neg">${esc(fmtMoney(cash.expense, cur))}</div>
          </div>
          <div>
            <div class="fs-xs t-mute fw-7">SAVED TOTAL</div>
            <div class="fw-8">${esc(fmtMoney(fin.saved, cur))}</div>
          </div>
          ${
            planned.length
              ? `<a href="#/purchases" style="color:inherit;text-decoration:none">
                  <div class="fs-xs t-mute fw-7">PLANNED BUYS</div>
                  <div class="fw-8">${esc(fmtMoney(plannedSpend, cur))} · ${planned.length}</div>
                </a>`
              : ''
          }
        </div>
      </section>

      <div class="flex-between">
        <div class="segmented" role="tablist">
          <button role="tab" data-tab="overview" aria-selected="${ui.tab === 'overview'}">Overview</button>
          <button role="tab" data-tab="goals" aria-selected="${ui.tab === 'goals'}">Savings</button>
          <button role="tab" data-tab="activity" aria-selected="${ui.tab === 'activity'}">Activity</button>
        </div>
        <button class="btn btn--primary btn--sm" data-new-txn type="button">${icon('plus')} Entry</button>
      </div>

      <div data-panel>${ui.tab === 'overview' ? overview(cash, fin, txns, cur) : ui.tab === 'goals' ? goalsPanel(cur) : activityPanel(txns, cur)}</div>
    </div>`;

  bind(root);
  animateProgress(root);
  const money = root.querySelector('[data-money]');
  if (money) countUp(money, Number(money.dataset.money), { format: (v) => fmtMoney(v, cur) });
}

/* ------------------------------ panels ------------------------------ */
function overview(cash, fin, txns, cur) {
  const byCat = {};
  txns.filter((t) => t.type === 'expense').forEach((t) => {
    byCat[t.category] = (byCat[t.category] || 0) + (Number(t.amount) || 0);
  });
  const top = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxCat = top[0]?.[1] || 1;
  const daily = dailySeries(txns);

  return `
    <div class="g-main">
      <div class="grid" style="gap:var(--s-5)">
        <section class="card">
          <div class="card__head">
            <h3 class="card__title">${icon('trending')} Spending trend</h3>
            <span class="chip">${esc(new Date(`${ui.month}-01`).toLocaleDateString(undefined, { month: 'long' }))}</span>
          </div>
          ${sparkline(daily, { height: 100 })}
          <p class="fs-xs t-mute mt-2">Daily expenses across the month.</p>
        </section>

        <section class="card">
          <div class="card__head"><h3 class="card__title">${icon('chart')} Where it goes</h3></div>
          ${
            top.length
              ? `<div class="balance">
                  ${top
                    .map(([id, amount]) => {
                      const c = txnCategory(id);
                      return `
                      <div class="balance__row">
                        <div class="balance__top"><span>${c.emoji} ${esc(c.label)}</span><span>${esc(fmtMoney(amount, cur))}</span></div>
                        <div class="bar"><div class="bar__fill" data-val="${pct(amount, maxCat)}"></div></div>
                      </div>`;
                    })
                    .join('')}
                 </div>`
              : `<p class="fs-sm t-mute">No expenses logged this month yet.</p>`
          }
        </section>
      </div>

      <div class="grid" style="gap:var(--s-5)">
        <section class="card center">
          <div class="card__head"><h3 class="card__title">${icon('target')} Savings progress</h3></div>
          <div style="display:grid;justify-items:center;gap:var(--s-3)">
            ${ring(fin.percent, { size: 150, stroke: 13, label: `${fin.percent}%`, caption: 'of goals' })}
            <p class="fs-sm t-dim">${esc(fmtMoney(fin.saved, cur))} of ${esc(fmtMoney(fin.target, cur))}</p>
            <button class="btn btn--soft btn--sm" data-tab-go="goals" type="button">Manage goals ${icon('arrowRight')}</button>
          </div>
        </section>

        <section class="card">
          <div class="card__head">
            <h3 class="card__title">${icon('clock')} Recent activity</h3>
            <button class="btn btn--xs btn--ghost" data-tab-go="activity" type="button">All</button>
          </div>
          ${txns.length ? txns.slice(0, 5).map((t) => txnRow(t, cur)).join('') : `<p class="fs-sm t-mute">Nothing logged yet.</p>`}
        </section>
      </div>
    </div>`;
}

function goalsPanel(cur) {
  const goals = store.state.savings;
  if (!goals.length) {
    return `
      <div class="empty">
        <div class="empty__icon">${icon('wallet')}</div>
        <h3>No savings goals yet</h3>
        <p>Name what you're saving for — a trip, a buffer, a dream — and watch it grow.</p>
        <button class="btn btn--primary btn--sm" data-new-goal type="button">${icon('plus')} Create goal</button>
      </div>`;
  }
  return `
    <div class="grid" style="gap:var(--s-4)">
      <button class="btn btn--soft btn--block" data-new-goal type="button">${icon('plus')} New savings goal</button>
      <div class="g-2">
        ${goals
          .map((g) => {
            const p = pct(Number(g.saved) || 0, Number(g.target) || 0);
            return `
            <article class="card goal-card" data-id="${esc(g.id)}">
              <div class="goal-card__top">
                <span class="goal-card__emoji">${esc(g.emoji || '🎯')}</span>
                <div class="grow">
                  <div class="fw-7">${esc(g.title)}</div>
                  <div class="fs-xs t-mute">${g.deadline ? `by ${esc(relativeDay(g.deadline))}` : 'No deadline'}</div>
                </div>
                <button class="iconbtn iconbtn--sm iconbtn--bare" data-edit-goal="${esc(g.id)}" type="button" aria-label="Edit">${icon('edit')}</button>
              </div>
              <div class="bar"><div class="bar__fill" data-val="${p}"></div></div>
              <div class="goal-card__amt"><b>${esc(fmtMoney(g.saved || 0, cur))}</b><span class="t-mute">${esc(fmtMoney(g.target || 0, cur))}</span></div>
              <div class="flex gap-2">
                <button class="btn btn--xs btn--soft grow" data-add-money="${esc(g.id)}" type="button">${icon('plus')} Add money</button>
                <span class="chip ${p >= 100 ? 'chip--success' : 'chip--accent'}">${p}%</span>
              </div>
            </article>`;
          })
          .join('')}
      </div>
    </div>`;
}

function activityPanel(txns, cur) {
  if (!txns.length) {
    return `
      <div class="empty">
        <div class="empty__icon">${icon('wallet')}</div>
        <h3>No entries this month</h3>
        <p>Log income and expenses to see your real picture.</p>
        <button class="btn btn--primary btn--sm" data-new-txn type="button">${icon('plus')} Add entry</button>
      </div>`;
  }
  const groups = txns.reduce((acc, t) => {
    (acc[t.date] ||= []).push(t);
    return acc;
  }, {});
  return `
    <div class="grid" style="gap:var(--s-4)">
      ${Object.entries(groups)
        .map(
          ([date, items]) => `
        <section class="card card--pad-sm">
          <div class="task-group__label mb-2">${esc(relativeDay(date))}</div>
          ${items.map((t) => txnRow(t, cur)).join('')}
        </section>`
        )
        .join('')}
    </div>`;
}

function txnRow(t, cur) {
  const c = txnCategory(t.category);
  const income = t.type === 'income';
  return `
    <div class="swipe" data-id="${esc(t.id)}">
      <div class="swipe__actions" aria-hidden="true">
        <div class="swipe__action swipe__action--done">${icon('edit')}</div>
        <div class="swipe__action swipe__action--del">${icon('trash')}</div>
      </div>
      <div class="swipe__content">
        <div class="txn" data-edit-txn="${esc(t.id)}" role="button" tabindex="0">
          <span class="txn__icon">${c.emoji}</span>
          <div class="grow">
            <div class="row__title">${esc(t.title)}</div>
            <div class="row__sub">${esc(c.label)} · ${esc(relativeDay(t.date))}</div>
          </div>
          <span class="txn__amt ${income ? 'pos' : 'neg'}">${income ? '+' : '−'}${esc(fmtMoney(Math.abs(Number(t.amount) || 0), cur))}</span>
        </div>
      </div>
    </div>`;
}

function dailySeries(txns) {
  const [y, m] = ui.month.split('-').map(Number);
  const days = new Date(y, m, 0).getDate();
  const series = Array(days).fill(0);
  txns
    .filter((t) => t.type === 'expense')
    .forEach((t) => {
      const d = Number((t.date || '').slice(8, 10));
      if (d >= 1 && d <= days) series[d - 1] += Number(t.amount) || 0;
    });
  return series;
}

/* ------------------------------ behaviour ------------------------------ */
function bind(root) {
  root.querySelectorAll('[data-tab]').forEach((b) =>
    b.addEventListener('click', () => { ui.tab = b.dataset.tab; render(root); })
  );
  root.querySelectorAll('[data-tab-go]').forEach((b) =>
    b.addEventListener('click', () => { ui.tab = b.dataset.tabGo; render(root); })
  );
  root.querySelectorAll('[data-new-txn]').forEach((b) => b.addEventListener('click', () => openTxnForm()));
  root.querySelectorAll('[data-new-goal]').forEach((b) => b.addEventListener('click', () => openSavingsForm()));

  root.querySelectorAll('[data-edit-goal]').forEach((b) =>
    b.addEventListener('click', () => {
      const g = store.state.savings.find((x) => x.id === b.dataset.editGoal);
      if (g) openSavingsForm(g);
    })
  );
  root.querySelectorAll('[data-add-money]').forEach((b) =>
    b.addEventListener('click', () => {
      const g = store.state.savings.find((x) => x.id === b.dataset.addMoney);
      if (g) openContribute(g);
    })
  );
  root.querySelectorAll('[data-edit-txn]').forEach((node) => {
    const open = () => {
      const t = store.state.txns.find((x) => x.id === node.dataset.editTxn);
      if (t) openTxnForm(t);
    };
    node.addEventListener('click', open);
    node.addEventListener('keydown', (e) => { if (e.key === 'Enter') open(); });
  });

  initSwipe(root, {
    onRight: (id) => {
      const t = store.state.txns.find((x) => x.id === id);
      if (t) openTxnForm(t);
    },
    onLeft: async (id) => {
      const t = store.state.txns.find((x) => x.id === id);
      if (!t) return;
      const ok = await confirmDialog({ title: 'Delete entry?', message: `“${t.title}” will be removed.`, confirmText: 'Delete', danger: true });
      if (ok) { await store.remove('txns', id); toast('Entry deleted', 'info'); }
    }
  });
}
