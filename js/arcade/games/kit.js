/**
 * LifeFlow Arcade — small shared helpers for the social and card games.
 * Pure functions only; nothing here touches the DOM outside the root it is given.
 */

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
}

export function rand(n) {
  return Math.floor(Math.random() * n);
}

export function shuffle(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Fill {me} / {you} / {name} in a prompt — the names are escaped, the prompt is trusted content. */
export function fill(text, map) {
  return esc(text).replace(/\{(\w+)\}/g, (m, k) => (k in map ? `<b>${esc(map[k])}</b>` : m));
}

/**
 * Draw an unused item from a bank of categories.
 * bank: { catId: { items: [...] } } — returns { c, i, used } with the pick remembered.
 */
export function draw(bank, cats, used, list = 'items', cap = 160) {
  const pool = [];
  const seen = new Set(used);
  const live = cats.filter((c) => bank[c]);
  const ids = live.length ? live : Object.keys(bank);
  for (const c of ids) {
    const items = bank[c][list] || [];
    items.forEach((_, i) => { if (!seen.has(`${c}:${list}:${i}`)) pool.push([c, i]); });
  }
  if (!pool.length) {
    // Everything has been seen — start the deck over.
    for (const c of ids) (bank[c][list] || []).forEach((_, i) => pool.push([c, i]));
    used = used.filter((k) => !k.includes(`:${list}:`));
  }
  const [c, i] = pool[rand(pool.length)];
  return { c, i, used: [...used, `${c}:${list}:${i}`].slice(-cap) };
}

/** Category chips — toggles when `live`, otherwise a quiet read-out. */
export function catChips(bank, cats, live) {
  return `
    <div class="xcats${live ? '' : ' is-locked'}" role="group" aria-label="Categories">
      ${Object.entries(bank)
        .map(
          ([id, c]) => `<button type="button" class="xcat" data-cat="${id}" aria-pressed="${cats.includes(id)}" ${live ? '' : 'disabled'}>
                          <span aria-hidden="true">${c.emoji}</span>${esc(c.label)}
                        </button>`
        )
        .join('')}
    </div>`;
}

export function bindCats(root, cats, play) {
  root.querySelectorAll('[data-cat]').forEach((b) =>
    b.addEventListener('click', () => {
      const id = b.dataset.cat;
      const next = cats.includes(id) ? cats.filter((c) => c !== id) : [...cats, id];
      if (next.length) play({ cats: next });
    })
  );
}

export function validCats(bank, cats) {
  return Array.isArray(cats) && cats.length > 0 && cats.length <= 20 && cats.every((c) => typeof c === 'string' && bank[c]);
}

/** Round progress — a row of beads, filled as the game moves along. */
export function beads(done, total, current = -1) {
  return `<div class="xbeads" aria-label="Round ${Math.min(done + 1, total)} of ${total}">${Array.from({ length: total }, (_, i) =>
    `<i class="${i < done ? 'is-done' : ''}${i === current ? ' is-now' : ''}"></i>`
  ).join('')}</div>`;
}

/** A short burst of floating emoji inside `host` — purely decorative. */
export function burst(host, glyphs, n = 14) {
  if (!host || !host.isConnected) return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const layer = document.createElement('div');
  layer.className = 'xburst';
  layer.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < n; i++) {
    const s = document.createElement('span');
    s.textContent = glyphs[i % glyphs.length];
    s.style.setProperty('--x', `${Math.round((Math.random() - 0.5) * 260)}px`);
    s.style.setProperty('--y', `${Math.round(-80 - Math.random() * 160)}px`);
    s.style.setProperty('--r', `${Math.round((Math.random() - 0.5) * 120)}deg`);
    s.style.setProperty('--d', `${Math.round(Math.random() * 240)}ms`);
    layer.appendChild(s);
  }
  host.appendChild(layer);
  setTimeout(() => layer.remove(), 1700);
}
