/**
 * LifeFlow — tiny hash router with auth guards and view transitions.
 */

const routes = new Map();
let notFound = null;
let guard = null;
let current = null;

export function route(path, config) {
  routes.set(path, config);
}

export function setGuard(fn) { guard = fn; }
export function setNotFound(fn) { notFound = fn; }

export function currentPath() {
  const raw = location.hash.replace(/^#/, '') || '/';
  return raw.split('?')[0];
}

export function currentQuery() {
  const raw = location.hash.replace(/^#/, '');
  const qs = raw.split('?')[1] || '';
  return Object.fromEntries(new URLSearchParams(qs));
}

export function navigate(path, { replace = false } = {}) {
  const target = path.startsWith('#') ? path : `#${path}`;
  if (location.hash === target) { resolve(); return; }
  if (replace) {
    history.replaceState(null, '', target);
    resolve(); // replaceState does not dispatch hashchange (auth/invite redirects).
  }
  else location.hash = target;
}

export function getCurrent() { return current; }

export async function resolve() {
  const path = currentPath();
  const config = routes.get(path);

  if (guard) {
    const redirect = guard(path, config);
    if (redirect && redirect !== path) { navigate(redirect, { replace: true }); return; }
  }

  if (!config) {
    if (notFound) notFound(path);
    else navigate('/', { replace: true });
    return;
  }

  current = path;
  document.title = config.title ? `${config.title} · LifeFlow` : 'LifeFlow';
  await config.render(currentQuery());
  window.dispatchEvent(new CustomEvent('lf:navigated', { detail: { path } }));
}

export function startRouter() {
  window.addEventListener('hashchange', resolve);
  if (!location.hash) history.replaceState(null, '', '#/');
  resolve();
}
