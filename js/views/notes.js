/**
 * LifeFlow — Notes & Journal.
 */
import { esc, toMillis, timeAgo, debounce, ymd } from '../utils.js';
import { icon } from '../icons.js';
import { modal, toast, confirmDialog } from '../ui.js';
import * as store from '../store.js';
import { MOODS } from '../config.js';
import { openNoteForm } from './forms.js';

export const meta = { title: 'Journal', icon: 'note', label: 'Notes' };

const ui = { tab: 'all', search: '' };

export function render(root) {
  const notes = filtered();
  const journalCount = store.select.journalEntries().length;
  const noteCount = store.state.notes.length - journalCount;

  root.innerHTML = `
    <div class="page">
      <section class="card card--accent">
        <div class="flex-between">
          <div>
            <span class="eyebrow">Think it, keep it</span>
            <h2>${store.state.notes.length ? `${store.state.notes.length} entries` : 'Your quiet space'}</h2>
            <p class="fs-sm t-dim">${noteCount} note${noteCount === 1 ? '' : 's'} · ${journalCount} journal entr${journalCount === 1 ? 'y' : 'ies'}</p>
          </div>
          <button class="btn btn--primary btn--sm" data-new type="button">${icon('plus')} Write</button>
        </div>
      </section>

      <section class="grid" style="gap:var(--s-3)">
        <div class="field field--icon">
          ${icon('search', 'field__icon')}
          <input class="input" type="search" placeholder="Search your notes…" value="${esc(ui.search)}" data-search aria-label="Search notes" />
        </div>
        <div class="segmented" role="tablist">
          <button role="tab" data-tab="all" aria-selected="${ui.tab === 'all'}">All</button>
          <button role="tab" data-tab="note" aria-selected="${ui.tab === 'note'}">Notes</button>
          <button role="tab" data-tab="journal" aria-selected="${ui.tab === 'journal'}">Journal</button>
        </div>
      </section>

      ${todayPrompt()}

      <section data-list>${notes.length ? grid(notes) : empty()}</section>
    </div>`;

  bind(root);
}

function filtered() {
  let list = [...store.state.notes].sort((a, b) => toMillis(b.updatedAt || b.createdAt) - toMillis(a.updatedAt || a.createdAt));
  if (ui.tab !== 'all') list = list.filter((n) => (n.type || 'note') === ui.tab);
  const s = ui.search.trim().toLowerCase();
  if (s) list = list.filter((n) => `${n.title} ${n.body} ${(n.tags || []).join(' ')}`.toLowerCase().includes(s));
  return list;
}

function grid(notes) {
  return `<div class="notes-grid stagger">${notes.map(card).join('')}</div>`;
}

function card(n) {
  return `
    <article class="note" data-open="${esc(n.id)}" style="--note-color:${esc(n.color || 'var(--accent)')}" role="button" tabindex="0">
      <div class="flex-between">
        <span class="note__title">${esc(n.title || 'Untitled')}</span>
        ${n.type === 'journal' ? `<span class="chip chip--accent">${icon('book')}</span>` : ''}
      </div>
      <p class="note__body">${esc(n.body || '')}</p>
      <div class="note__foot">
        <span class="meta">${icon('clock')} ${esc(timeAgo(toMillis(n.updatedAt || n.createdAt)))}</span>
        ${(n.tags || []).slice(0, 2).map((t) => `<span class="chip">#${esc(t)}</span>`).join('')}
      </div>
    </article>`;
}

function todayPrompt() {
  const has = store.select
    .journalEntries()
    .some((n) => ymd(new Date(toMillis(n.createdAt))) === ymd());
  if (has) return '';
  const mood = store.moodFor();
  const m = MOODS.find((x) => x.id === mood);
  return `
    <section class="card" style="border-style:dashed">
      <div class="flex gap-3">
        <span style="font-size:1.6rem">${m ? m.emoji : '✍️'}</span>
        <div class="grow">
          <div class="fw-7 fs-sm">How was your day?</div>
          <div class="fs-xs t-mute">Take 60 seconds to reflect — future-you will love reading this.</div>
        </div>
        <button class="btn btn--xs btn--soft" data-journal type="button">Write</button>
      </div>
    </section>`;
}

function empty() {
  return `
    <div class="empty">
      <div class="empty__icon">${icon('note')}</div>
      <h3>${ui.search ? 'Nothing found' : 'A blank page awaits'}</h3>
      <p>${ui.search ? 'Try a different search term.' : 'Capture ideas, reflections, gratitude or plans.'}</p>
      ${ui.search ? '' : `<button class="btn btn--primary btn--sm" data-new type="button">${icon('plus')} Write something</button>`}
    </div>`;
}

function bind(root) {
  root.querySelectorAll('[data-tab]').forEach((b) =>
    b.addEventListener('click', () => { ui.tab = b.dataset.tab; render(root); })
  );
  root.querySelectorAll('[data-new]').forEach((b) =>
    b.addEventListener('click', () => openNoteForm(null, { type: ui.tab === 'journal' ? 'journal' : 'note' }))
  );
  root.querySelector('[data-journal]')?.addEventListener('click', () => openNoteForm(null, { type: 'journal' }));

  root.querySelector('[data-search]')?.addEventListener(
    'input',
    debounce((e) => {
      ui.search = e.target.value;
      const node = root.querySelector('[data-list]');
      const list = filtered();
      node.innerHTML = list.length ? grid(list) : empty();
      bindCards(node);
      node.querySelectorAll('[data-new]').forEach((b) => b.addEventListener('click', () => openNoteForm()));
    }, 200)
  );

  bindCards(root);
}

function bindCards(scope) {
  scope.querySelectorAll('[data-open]').forEach((node) => {
    const open = () => {
      const n = store.state.notes.find((x) => x.id === node.dataset.open);
      if (n) openViewer(n);
    };
    node.addEventListener('click', open);
    node.addEventListener('keydown', (e) => { if (e.key === 'Enter') open(); });
  });
}

function openViewer(n) {
  modal({
    title: n.title || 'Untitled',
    body: `
      <div class="grid" style="gap:var(--s-3)">
        <div class="flex gap-2 flex-wrap">
          <span class="chip">${n.type === 'journal' ? '📓 Journal' : '📝 Note'}</span>
          <span class="chip">${esc(timeAgo(toMillis(n.updatedAt || n.createdAt)))}</span>
          ${(n.tags || []).map((t) => `<span class="chip chip--accent">#${esc(t)}</span>`).join('')}
        </div>
        <p style="white-space:pre-wrap;line-height:1.7;font-size:.92rem">${esc(n.body || '')}</p>
      </div>`,
    footer: `
      <button class="btn btn--danger btn--icon" data-del type="button" aria-label="Delete">${icon('trash')}</button>
      <button class="btn btn--ghost" data-modal-close type="button">Close</button>
      <button class="btn btn--primary" data-edit type="button">Edit</button>`,
    onMount(box, close) {
      box.querySelector('[data-edit]').addEventListener('click', () => { close(); openNoteForm(n); });
      box.querySelector('[data-del]').addEventListener('click', async () => {
        const ok = await confirmDialog({
          title: 'Delete entry?',
          message: 'This cannot be undone.',
          confirmText: 'Delete',
          danger: true
        });
        if (!ok) return;
        await store.remove('notes', n.id);
        close();
        toast('Entry deleted', 'info');
      });
    }
  });
}
