// Standalone, same-origin admin client. No Firebase SDK, storage, or client secrets.
const $ = (id) => document.getElementById(id);
const endpoint = '/api/private-admin';
const requests = new Set();
const numberFormat = new Intl.NumberFormat();
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const dayFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
const tabs = ['overview', 'activity', 'security'];
let generation = 0;
let detailGeneration = 0;
let csrfToken = null;
let expiresAt = 0;
let expiryTimer;
let ipTimer;
let authenticated = false;
let authBusy = false;
let accounts = [];
let accountsLoaded = false;
let accountsBusy = false;
let nextPageToken = null;
let accountsFailed = false;
let selectedUid = null;
let selectedSummary = null;
let activityEvents = [];
let activityLoaded = false;
let activityBusy = false;
let activityFailed = false;
let nextCursor = null;
let ipRevealed = false;
let ipBusy = false;
let ipGeneration = 0;
let selectionTrigger = null;

class AdminError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
const staleError = () => new AdminError('stale', 'This request is no longer current.');
const isStale = (error) => error?.code === 'stale';
const text = (value, fallback = 'Not available') => typeof value === 'string' && value.length ? value : fallback;
const count = (value) => Number.isSafeInteger(value) && value >= 0 ? numberFormat.format(value) : '—';
const date = (value, short = false) => typeof value === 'number' && Number.isFinite(value) && !Number.isNaN(new Date(value).getTime())
  ? (short ? dayFormat : dateFormat).format(value) : 'Not available';
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const entries = (value) => isRecord(value) ? Object.entries(value).filter(([, n]) => Number.isSafeInteger(n) && n >= 0).sort((a, b) => b[1] - a[1]) : [];
function node(tag, className, content) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (content !== undefined) element.textContent = String(content);
  return element;
}
function message(id, content = '', kind = '') {
  const element = $(id);
  element.textContent = content;
  element.classList.toggle('error', kind === 'error');
  element.classList.toggle('loading', kind === 'loading');
}
function readableError(error) {
  switch (error?.code) {
    case 'unauthorized': return 'Access wasn’t authorised. Enter the private admin code, not an account password.';
    case 'not-deployed': return 'The private admin endpoint is not available. Start the private Node server and open its page address, or deploy /api/private-admin behind your HTTPS site.';
    case 'offline': return 'You’re offline. Reconnect and try again. No local or demo data is substituted.';
    case 'network': return 'The server could not be reached. Check your connection and try again.';
    case 'timeout': return 'The server took too long to respond. Please try again.';
    case 'rate-limited': return 'Too many attempts. Wait a little before trying again.';
    case 'service-unavailable': return 'The private admin backend is unavailable. Check its deployment and server configuration, then retry.';
    case 'https-required': return 'Open the private server’s HTTPS address, or its loopback address when running locally on this PC.';
    case 'origin-not-allowed': return 'This address is not authorised by the private server. Use the exact configured dashboard address.';
    case 'host-not-allowed': return 'Open the exact dashboard address printed by the private server.';
    case 'not-found': return 'This account or record is no longer available. Close this panel and choose another account.';
    case 'invalid-response': return 'The backend returned an unexpected response. Check the private admin deployment and try again.';
    default: return error instanceof AdminError ? error.message : 'Something went wrong. Please try again.';
  }
}

async function api(action, parameters = {}, options = {}) {
  const requestGeneration = generation;
  const protectedAction = !['login', 'session'].includes(action);
  if (protectedAction && !options.logoutToken && (!authenticated || Date.now() >= expiresAt)) {
    resetToLock('Your session has expired. Unlock again to continue.');
    throw staleError();
  }
  if (!navigator.onLine) throw new AdminError('offline');
  const controller = new AbortController();
  requests.add(controller);
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 25000);
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (protectedAction) headers['X-Admin-CSRF'] = options.logoutToken || csrfToken;
    const response = await fetch(endpoint, {
      method: 'POST', headers, credentials: 'same-origin', cache: 'no-store',
      redirect: 'error', signal: controller.signal, body: JSON.stringify({ action, ...parameters })
    });
    if (requestGeneration !== generation) throw staleError();
    // Invalidate before parsing: an expired session may have a non-JSON error page.
    if (!options.logoutToken && protectedAction && response.status === 401) {
      resetToLock('Your session has expired. Unlock again to continue.');
      throw staleError();
    }
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new AdminError([404, 405].includes(response.status) || contentType.includes('text/html') ? 'not-deployed' : 'invalid-response');
    }
    let data;
    try { data = await response.json(); } catch { throw new AdminError('invalid-response'); }
    if (requestGeneration !== generation) throw staleError();
    if (protectedAction && !options.logoutToken && Date.now() >= expiresAt) {
      resetToLock('Your session has expired. Unlock again to continue.');
      throw staleError();
    }
    if (!isRecord(data)) throw new AdminError('invalid-response');
    if (!response.ok || data.error) {
      const code = text(data.error?.code, response.status === 401 ? 'unauthorized' : 'server-error');
      if (response.status === 404 && ['login', 'session', 'accounts', 'logout'].includes(action)) throw new AdminError('not-deployed');
      if (protectedAction && !options.logoutToken && ['unauthorized', 'csrf-required'].includes(code)) {
        resetToLock('Your session is no longer valid. Unlock again to continue.');
        throw staleError();
      }
      throw new AdminError(code, text(data.error?.message, 'The request failed. Please try again.'));
    }
    return data;
  } catch (error) {
    if (requestGeneration !== generation || isStale(error)) throw staleError();
    if (timedOut) throw new AdminError('timeout');
    if (error instanceof AdminError) throw error;
    throw new AdminError(navigator.onLine ? 'network' : 'offline');
  } finally {
    clearTimeout(timer);
    requests.delete(controller);
  }
}

function setAuthBusy(busy) {
  authBusy = busy;
  $('login-button').disabled = busy;
  $('private-code').disabled = busy;
  $('session-retry').disabled = busy;
  $('login-form').setAttribute('aria-busy', String(busy));
}
function resetDetail() {
  detailGeneration++;
  clearTimeout(ipTimer);
  selectedUid = null;
  selectedSummary = null;
  activityEvents = [];
  activityLoaded = false;
  activityBusy = false;
  activityFailed = false;
  nextCursor = null;
  ipRevealed = false;
  ipBusy = false;
  $('detail-content').hidden = true;
  $('retry-detail').hidden = true;
  $('detail-title').textContent = 'Account details';
  for (const id of ['detail-avatar', 'detail-email', 'detail-uid', 'detail-badges', 'account-metadata', 'event-summary', 'observation-metadata', 'module-chart', 'action-counters', 'item-counts', 'security-metadata', 'activity-list', 'ip-time']) $(id).replaceChildren();
  $('latest-ip').textContent = 'Not recorded';
  $('copy-uid').textContent = 'Copy UID';
  $('load-activity').hidden = true;
  $('reveal-ip').textContent = 'Reveal latest IP';
  $('reveal-ip').disabled = false;
  for (const id of ['detail-message', 'activity-message', 'ip-message']) message(id);
  setTab('overview');
}
function resetToLock(notice = '', focus = true) {
  generation++;
  for (const request of requests) request.abort();
  requests.clear();
  clearTimeout(expiryTimer);
  authenticated = false;
  csrfToken = null;
  expiresAt = 0;
  accounts = [];
  accountsLoaded = false;
  accountsBusy = false;
  accountsFailed = false;
  nextPageToken = null;
  selectionTrigger = null;
  if ($('account-dialog').open) $('account-dialog').close();
  resetDetail();
  $('console').hidden = true;
  $('lock-screen').hidden = false;
  $('private-code').value = '';
  $('account-search').value = '';
  $('account-filter').value = 'all';
  $('accounts-body').replaceChildren();
  $('account-table-wrap').hidden = true;
  $('accounts-empty').hidden = true;
  $('load-accounts').hidden = true;
  $('accounts-scope').textContent = 'No accounts loaded yet.';
  $('directory-count').textContent = '—';
  $('session-until').textContent = '';
  $('session-retry').hidden = true;
  $('accounts-section').setAttribute('aria-busy', 'false');
  for (const id of ['metric-loaded', 'metric-enabled', 'metric-verified', 'metric-recent']) $(id).textContent = '—';
  message('accounts-message');
  message('login-message', notice);
  setAuthBusy(false);
  if (focus) $('private-code').focus();
}
function scheduleExpiry() {
  clearTimeout(expiryTimer);
  const remaining = expiresAt - Date.now();
  if (remaining <= 0) { resetToLock('Your session has expired. Unlock again to continue.'); return; }
  expiryTimer = setTimeout(scheduleExpiry, Math.min(remaining, 2147483647));
}
function acceptSession(data) {
  if (data.authenticated !== true || typeof data.csrfToken !== 'string' || !data.csrfToken ||
      !Number.isSafeInteger(data.expiresAt) || data.expiresAt <= Date.now()) throw new AdminError('invalid-response');
  csrfToken = data.csrfToken;
  expiresAt = data.expiresAt;
  authenticated = true;
  $('private-code').value = '';
  $('lock-screen').hidden = true;
  $('console').hidden = false;
  $('today').textContent = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date());
  $('timezone').textContent = `Times in ${Intl.DateTimeFormat().resolvedOptions().timeZone}`;
  $('session-until').textContent = `Session ends ${date(expiresAt)}`;
  $('console-title').focus();
  scheduleExpiry();
  void loadAccounts();
}
async function restoreSession() {
  if (authBusy || authenticated) return;
  const current = generation;
  setAuthBusy(true);
  $('session-retry').hidden = true;
  message('login-message', 'Checking for a secure server session…', 'loading');
  try { acceptSession(await api('session')); }
  catch (error) {
    if (isStale(error) || current !== generation) return;
    if (error.code === 'unauthorized') message('login-message', 'Ready when you are. Enter your private admin access code.');
    else { message('login-message', readableError(error), 'error'); $('session-retry').hidden = false; }
  } finally { if (current === generation) setAuthBusy(false); }
}
$('login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (authBusy) return;
  const current = generation;
  // Send the code unchanged. There is deliberately no client-side secret comparison.
  let code = $('private-code').value;
  $('private-code').value = '';
  setAuthBusy(true);
  $('session-retry').hidden = true;
  message('login-message', 'Verifying access with the server…', 'loading');
  try {
    const pending = api('login', { code });
    code = '';
    acceptSession(await pending);
  } catch (error) {
    if (!isStale(error) && current === generation) message('login-message', readableError(error), 'error');
  } finally {
    code = '';
    if (current === generation) { setAuthBusy(false); if (!authenticated) $('private-code').focus(); }
  }
});
$('session-retry').addEventListener('click', restoreSession);
$('lock-button').addEventListener('click', async () => {
  const logoutToken = csrfToken;
  // Erase and invalidate BEFORE waiting for logout, including any account/reveal requests.
  resetToLock('Locking the server session…');
  const current = generation;
  setAuthBusy(true);
  try {
    const result = await api('logout', {}, { logoutToken });
    if (result.authenticated !== false) throw new AdminError('invalid-response');
    if (current === generation) message('login-message', 'Workspace locked. The server session has been cleared.');
  } catch (error) {
    if (!isStale(error) && current === generation) {
      message('login-message', error.code === 'unauthorized'
        ? 'Workspace locked. The server session is already inactive.'
        : `Local data cleared, but server logout could not be confirmed. The cookie may remain valid until expiry. ${readableError(error)}`, error.code === 'unauthorized' ? '' : 'error');
    }
  } finally { if (current === generation) { setAuthBusy(false); $('private-code').focus(); } }
});

function validAccount(account) { return isRecord(account) && typeof account.uid === 'string' && account.uid.length > 0; }
function renderMetrics() {
  const since = Date.now() - 30 * 86400000;
  const now = Date.now();
  const values = [accounts.length, accounts.filter((a) => a.disabled === false).length,
    accounts.filter((a) => a.emailVerified === true).length,
    accounts.filter((a) => typeof a.lastSignInAt === 'number' && a.lastSignInAt >= since && a.lastSignInAt <= now).length];
  ['loaded', 'enabled', 'verified', 'recent'].forEach((key, i) => { $(`metric-${key}`).textContent = accountsLoaded ? count(values[i]) : '—'; });
  $('directory-count').textContent = accountsLoaded ? count(accounts.length) : '—';
}
function initials(account) {
  const label = text(account.displayName, text(account.email, '?')).trim();
  return Array.from(label).slice(0, 2).join('').toLocaleUpperCase();
}
function statusLabel(account) { return account.disabled === true ? 'Disabled' : account.disabled === false ? 'Enabled' : 'Status unavailable'; }
function verificationLabel(account) { return account.emailVerified === true ? 'Email verified' : account.emailVerified === false ? 'Email unverified' : 'Verification unavailable'; }
function renderAccounts() {
  renderMetrics();
  const query = $('account-search').value.trim().toLocaleLowerCase();
  const filter = $('account-filter').value;
  const filtered = accounts.filter((account) => {
    const match = [account.email, account.displayName, account.uid].some((value) => typeof value === 'string' && value.toLocaleLowerCase().includes(query));
    const status = filter === 'all' || (filter === 'enabled' && account.disabled === false) ||
      (filter === 'disabled' && account.disabled === true) || (filter === 'verified' && account.emailVerified === true) || (filter === 'unverified' && account.emailVerified === false);
    return match && status;
  });
  const fragment = document.createDocumentFragment();
  for (const account of filtered) {
    const row = node('tr');
    const identityCell = node('td');
    const identity = node('div', 'account-identity');
    const avatar = node('span', 'avatar', initials(account));
    avatar.setAttribute('aria-hidden', 'true');
    const identityText = node('div', 'identity-text');
    const name = node('button', 'account-name', text(account.displayName, text(account.email, 'Unnamed account')));
    name.type = 'button';
    name.setAttribute('aria-haspopup', 'dialog');
    name.setAttribute('aria-label', `View account ${text(account.displayName, text(account.email, account.uid))}`);
    name.addEventListener('click', () => openAccount(account, name));
    identityText.append(name, node('span', 'account-email', text(account.email, `UID: ${account.uid}`)));
    identity.append(avatar, identityText);
    identityCell.append(identity);
    const status = node('td');
    status.append(node('span', `badge ${account.disabled === false ? 'good' : 'warning'}`, statusLabel(account)), node('span', 'verification', verificationLabel(account)));
    const arrow = node('td', 'row-arrow', '↗');
    arrow.setAttribute('aria-hidden', 'true');
    row.append(identityCell, status, node('td', '', date(account.lastSignInAt)), node('td', '', date(account.createdAt, true)), arrow);
    fragment.append(row);
  }
  $('accounts-body').replaceChildren(fragment);
  $('account-table-wrap').hidden = !filtered.length;
  $('accounts-empty').hidden = !accountsLoaded || filtered.length > 0;
  $('accounts-empty-title').textContent = accounts.length ? 'No matches in this view.' : 'A quiet space, for now.';
  $('accounts-empty-text').textContent = accounts.length
    ? 'Try another name, email or UID, change the status filter, or load more accounts.'
    : nextPageToken ? 'No accounts in this batch. Load the next batch to continue.' : 'The server returned no accounts. New accounts will appear when they are available from Firebase Authentication.';
  $('accounts-scope').textContent = accountsLoaded
    ? `${count(filtered.length)} shown · ${count(accounts.length)} loaded${nextPageToken ? ' · More available' : ' · End of directory reached'}`
    : 'No accounts loaded yet.';
  $('load-accounts').hidden = !nextPageToken && !accountsFailed && !accountsBusy;
  $('load-accounts').disabled = accountsBusy;
  $('load-accounts').textContent = accountsBusy ? 'Loading accounts…' : accountsFailed ? 'Retry loading accounts' : 'Load more accounts ↓';
}
async function loadAccounts() {
  if (accountsBusy || !authenticated) return;
  const current = generation;
  accountsBusy = true;
  accountsFailed = false;
  $('accounts-section').setAttribute('aria-busy', 'true');
  message('accounts-message', accountsLoaded ? 'Loading the next account batch…' : 'Loading accounts securely from the server…', 'loading');
  renderAccounts();
  try {
    const data = await api('accounts', { pageSize: 50, ...(nextPageToken ? { pageToken: nextPageToken } : {}) });
    if (current !== generation) return;
    if (!Array.isArray(data.accounts) || !data.accounts.every(validAccount) || (data.nextPageToken != null && typeof data.nextPageToken !== 'string')) throw new AdminError('invalid-response');
    const merged = new Map(accounts.map((account) => [account.uid, account]));
    data.accounts.forEach((account) => merged.set(account.uid, account));
    accounts = Array.from(merged.values());
    accountsLoaded = true;
    nextPageToken = data.nextPageToken || null;
    message('accounts-message');
  } catch (error) {
    if (current !== generation || isStale(error)) return;
    accountsFailed = true;
    message('accounts-message', readableError(error), 'error');
  } finally {
    if (current === generation) { accountsBusy = false; $('accounts-section').setAttribute('aria-busy', 'false'); renderAccounts(); }
  }
}
$('load-accounts').addEventListener('click', loadAccounts);
$('account-search').addEventListener('input', renderAccounts);
$('account-filter').addEventListener('change', renderAccounts);

function detailCurrent(version, uid) { return authenticated && version === detailGeneration && selectedUid === uid && $('account-dialog').open; }
function showAccountIdentity(account) {
  $('detail-title').textContent = text(account.displayName, text(account.email, 'Unnamed account'));
  $('detail-email').textContent = text(account.email, 'No email address on this account');
  $('detail-avatar').textContent = initials(account);
  $('detail-uid').textContent = account.uid;
}
function openAccount(account, trigger) {
  if (!authenticated) return;
  if (Date.now() >= expiresAt) { resetToLock('Your session has expired. Unlock again to continue.'); return; }
  resetDetail();
  selectionTrigger = trigger;
  selectedUid = account.uid;
  showAccountIdentity(account);
  $('account-dialog').showModal();
  $('close-detail').focus();
  void loadDetail();
}
function closeDetail() {
  $('account-dialog').close();
  resetDetail();
  const trigger = selectionTrigger;
  selectionTrigger = null;
  if (authenticated) (trigger?.isConnected ? trigger : $('account-search')).focus();
}
$('close-detail').addEventListener('click', closeDetail);
$('account-dialog').addEventListener('cancel', (event) => { event.preventDefault(); closeDetail(); });
$('retry-detail').addEventListener('click', loadDetail);

function metadata(target, pairs) {
  const rows = pairs.map(([label, value]) => {
    const row = node('div');
    row.append(node('dt', '', label), node('dd', '', value));
    return row;
  });
  $(target).replaceChildren(...rows);
}
function providers(account) {
  return Array.isArray(account.providers) && account.providers.length
    ? account.providers.filter((provider) => typeof provider === 'string').join(', ') || 'Not available' : 'No linked providers reported';
}
function renderDetail(account, summary) {
  showAccountIdentity(account);
  $('detail-badges').replaceChildren(
    node('span', `badge ${account.disabled === false ? 'good' : 'warning'}`, statusLabel(account)),
    node('span', `badge ${summary.consent === true ? 'good' : ''}`, summary.consent === true ? 'Activity sharing on' : summary.consent === false ? 'Activity sharing off' : 'Activity sharing unknown')
  );
  const authMetadata = [
    ['Email verification', verificationLabel(account)], ['Providers', providers(account)],
    ['Created · Auth', date(account.createdAt)], ['Last sign-in · Auth', date(account.lastSignInAt)]
  ];
  metadata('account-metadata', [['Email', text(account.email, 'No email address')], ...authMetadata]);
  metadata('security-metadata', [['Account status', statusLabel(account)], ...authMetadata]);
  metadata('observation-metadata', [['First received event', date(summary.firstObservedAt)], ['Last received event', date(summary.lastObservedAt)]]);
  $('event-summary').replaceChildren(node('strong', '', count(summary.totalEvents)), node('span', '', 'recorded events · shared activity'));
  renderChart(summary.byModule);
  const actions = entries(summary.byAction);
  $('action-counters').replaceChildren(...(actions.length ? actions.map(([action, value]) => {
    const chip = node('div', 'action-counter');
    chip.append(node('span', '', action), node('strong', '', count(value)));
    return chip;
  }) : [node('p', 'chart-empty', 'No recorded actions available.')]));
  $('item-counts').replaceChildren(...['tasks', 'events', 'goals', 'habits', 'notes', 'purchases'].map((key) => {
    const item = node('div', 'item-count');
    item.append(node('strong', '', count(summary.counts?.[key])), node('span', '', key[0].toUpperCase() + key.slice(1)));
    return item;
  }));
  maskIp();
}
function renderChart(byModule) {
  const values = entries(byModule);
  if (!values.length || !values.some(([, value]) => value > 0)) {
    $('module-chart').replaceChildren(node('p', 'chart-empty', 'No module activity recorded. A chart will appear only when real shared events are available.'));
    return;
  }
  const maximum = Math.max(...values.map(([, value]) => value));
  const svgNamespace = 'http://www.w3.org/2000/svg';
  $('module-chart').replaceChildren(...values.map(([module, value]) => {
    const row = node('div', 'chart-row');
    const label = node('div', 'chart-label');
    label.append(node('span', '', module), node('strong', '', `${count(value)} events`));
    const svg = document.createElementNS(svgNamespace, 'svg');
    svg.setAttribute('viewBox', '0 0 100 7');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('class', 'chart-bar');
    // The visible text above supplies an accessible equivalent for the decorative bar.
    svg.setAttribute('aria-hidden', 'true');
    for (const [className, width] of [['chart-track', 100], ['chart-fill', value / maximum * 100]]) {
      const rect = document.createElementNS(svgNamespace, 'rect');
      rect.setAttribute('class', className);
      rect.setAttribute('width', String(width));
      rect.setAttribute('height', '7');
      svg.append(rect);
    }
    row.append(label, svg);
    return row;
  }));
}
async function loadDetail() {
  const uid = selectedUid;
  if (!uid || !authenticated) return;
  const version = ++detailGeneration;
  $('detail-content').hidden = true;
  $('retry-detail').hidden = true;
  message('detail-message', 'Loading account metadata and shared activity summary…', 'loading');
  try {
    const data = await api('account', { uid });
    if (!detailCurrent(version, uid)) return;
    if (!validAccount(data.account) || data.account.uid !== uid || !isRecord(data.summary)) throw new AdminError('invalid-response');
    selectedSummary = data.summary;
    renderDetail(data.account, data.summary);
    $('detail-content').hidden = false;
    message('detail-message');
  } catch (error) {
    if (!detailCurrent(version, uid) || isStale(error)) return;
    message('detail-message', readableError(error), 'error');
    $('retry-detail').hidden = false;
  }
}
function setTab(tab) {
  for (const name of tabs) {
    const active = name === tab;
    $(`tab-${name}`).setAttribute('aria-selected', String(active));
    $(`tab-${name}`).tabIndex = active ? 0 : -1;
    $(`panel-${name}`).hidden = !active;
  }
  if (tab !== 'security') maskIp();
  if (tab === 'activity' && selectedUid && !activityLoaded && !activityBusy) void loadActivity();
}
tabs.forEach((tab, index) => {
  $(`tab-${tab}`).addEventListener('click', () => setTab(tab));
  $(`tab-${tab}`).addEventListener('keydown', (event) => {
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = tabs.length - 1;
    if (next !== undefined) { event.preventDefault(); setTab(tabs[next]); $(`tab-${tabs[next]}`).focus(); }
  });
});
function renderActivity() {
  $('activity-list').replaceChildren(...activityEvents.map((event) => {
    const item = node('li');
    const time = node('time', '', `${date(event.at)} · server received`);
    if (typeof event.at === 'number' && Number.isFinite(event.at) && !Number.isNaN(new Date(event.at).getTime())) time.dateTime = new Date(event.at).toISOString();
    item.append(node('h4', '', text(event.action, 'Unspecified action')), time,
      node('p', 'event-context', `Module: ${text(event.module, 'Not reported')} · IP: ${text(event.ipMasked, 'Not recorded')}`),
      node('p', 'event-device', `Client-reported device: ${text(event.device, 'Not reported')}`));
    return item;
  }));
  $('load-activity').hidden = !nextCursor && !activityFailed && !activityBusy;
  $('load-activity').disabled = activityBusy;
  $('load-activity').textContent = activityBusy ? 'Loading activity…' : activityFailed ? 'Retry loading activity' : 'Load more activity';
}
async function loadActivity() {
  if (activityBusy || !selectedUid || !authenticated) return;
  const uid = selectedUid;
  const version = detailGeneration;
  activityBusy = true;
  activityFailed = false;
  message('activity-message', 'Loading shared activity…', 'loading');
  renderActivity();
  try {
    const data = await api('activity', { uid, ...(nextCursor ? { cursor: nextCursor } : {}) });
    if (!detailCurrent(version, uid)) return;
    if (!Array.isArray(data.events) || !data.events.every((event) => isRecord(event) && typeof event.id === 'string') || (data.nextCursor != null && typeof data.nextCursor !== 'string')) throw new AdminError('invalid-response');
    const merged = new Map(activityEvents.map((event) => [event.id, event]));
    data.events.forEach((event) => merged.set(event.id, event));
    activityEvents = Array.from(merged.values());
    nextCursor = data.nextCursor || null;
    activityLoaded = true;
    message('activity-message', activityEvents.length ? `${count(activityEvents.length)} events loaded${nextCursor ? ' · More available' : ' · End of available activity'}.`
      : `No shared activity is available.${selectedSummary?.consent === false ? ' Activity sharing is off.' : ''} No historical tracking or backfill is performed.`);
  } catch (error) {
    if (!detailCurrent(version, uid) || isStale(error)) return;
    activityFailed = true;
    message('activity-message', readableError(error), 'error');
  } finally {
    if (detailCurrent(version, uid)) { activityBusy = false; renderActivity(); }
  }
}
$('load-activity').addEventListener('click', loadActivity);
$('copy-uid').addEventListener('click', async () => {
  const uid = selectedUid;
  const version = detailGeneration;
  if (!uid || !authenticated) return;
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText(uid);
    if (detailCurrent(version, uid)) { $('copy-uid').textContent = 'Copied'; message('detail-message', 'Account UID copied to the clipboard.'); }
  } catch {
    if (detailCurrent(version, uid)) message('detail-message', 'Clipboard access is unavailable. Select and copy the UID above manually.', 'error');
  }
});

function maskIp() {
  // Also invalidate a disclosure still in flight when its tab loses visibility.
  ipGeneration++;
  clearTimeout(ipTimer);
  ipRevealed = false;
  $('latest-ip').textContent = text(selectedSummary?.lastIpMasked, 'Not recorded');
  $('ip-time').textContent = '';
  $('reveal-ip').textContent = ipBusy ? 'Requesting sensitive data…' : 'Reveal latest IP';
  $('reveal-ip').disabled = ipBusy;
  message('ip-message');
}
$('reveal-ip').addEventListener('click', async () => {
  if (ipRevealed) { maskIp(); return; }
  if (!selectedUid || ipBusy || !authenticated) return;
  const uid = selectedUid;
  const version = detailGeneration;
  const revealVersion = ipGeneration;
  ipBusy = true;
  $('reveal-ip').disabled = true;
  $('reveal-ip').textContent = 'Requesting sensitive data…';
  message('ip-message', 'Requesting an audited IP disclosure…', 'loading');
  try {
    const data = await api('revealIp', { uid });
    if (!detailCurrent(version, uid) || revealVersion !== ipGeneration || $('panel-security').hidden || document.hidden) return;
    if (data.ip !== null && typeof data.ip !== 'string') throw new AdminError('invalid-response');
    if (data.ip) {
      $('latest-ip').textContent = data.ip;
      $('ip-time').textContent = `Server received: ${date(data.at)}`;
      ipRevealed = true;
      message('ip-message', 'Sensitive address revealed temporarily. This does not establish identity or location.');
      ipTimer = setTimeout(maskIp, 30000);
    } else message('ip-message', 'No IP address is available for this account.');
  } catch (error) {
    if (detailCurrent(version, uid) && !isStale(error)) message('ip-message', readableError(error), 'error');
  } finally {
    if (detailCurrent(version, uid)) {
      ipBusy = false;
      $('reveal-ip').disabled = false;
      $('reveal-ip').textContent = ipRevealed ? 'Hide IP address' : 'Reveal latest IP';
    }
  }
});

function networkState() { $('network-notice').hidden = navigator.onLine; }
window.addEventListener('online', networkState);
window.addEventListener('offline', networkState);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) maskIp();
  if (authenticated && Date.now() >= expiresAt) resetToLock('Your session has expired. Unlock again to continue.');
});
// Avoid persisting sensitive DOM in a back/forward-cache snapshot.
window.addEventListener('pagehide', () => resetToLock('', false));
window.addEventListener('pageshow', (event) => { if (event.persisted && location.protocol !== 'file:') void restoreSession(); });
networkState();
if (location.protocol === 'file:') {
  setAuthBusy(true);
  message('login-message', 'Start the private Node server and open the address it prints. Opening this file directly cannot use a server session.', 'error');
} else if (!['https:', 'http:'].includes(location.protocol)) {
  setAuthBusy(true);
  message('login-message', 'Open this page through your private server’s HTTPS address or its local loopback address.', 'error');
} else {
  void restoreSession();
}