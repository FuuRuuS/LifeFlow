/**
 * LifeFlow — public (logged-out) views: landing, login, signup, forgot password.
 */
import { $, el, esc } from '../utils.js';
import { icon } from '../icons.js';
import { theme, toast, withLoading } from '../ui.js';
import { navigate } from '../router.js';
import {
  auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  authErrorMessage
} from '../firebase.js';

const root = () => $('#public');

/* =========================================================
   Shared chrome
   ========================================================= */
function brand() {
  return `
    <a class="brand" href="#/" aria-label="LifeFlow home">
      <svg class="brand__mark" viewBox="0 0 64 64" aria-hidden="true">
        <defs>
          <linearGradient id="bg1" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="var(--accent)"/>
            <stop offset="1" stop-color="var(--accent-2)"/>
          </linearGradient>
        </defs>
        <path d="M12 40c6-14 14-14 20 0s14 14 20 0" fill="none" stroke="url(#bg1)" stroke-width="6" stroke-linecap="round"/>
        <path d="M12 24c6-14 14-14 20 0s14 14 20 0" fill="none" stroke="url(#bg1)" stroke-width="6" stroke-linecap="round" opacity=".45"/>
      </svg>
      <span class="brand__name">LifeFlow</span>
    </a>`;
}

function nav(showAuthLinks = true) {
  return `
    <header class="pub-nav">
      ${brand()}
      <div class="pub-nav__actions">
        <button class="iconbtn themetoggle" type="button" data-theme-toggle aria-label="Toggle theme">
          ${icon('sun', 'ico-sun')}${icon('moon', 'ico-moon')}
        </button>
        ${showAuthLinks ? `<a class="btn btn--sm btn--ghost" href="#/login">Log in</a>
        <a class="btn btn--sm btn--primary" href="#/signup">Get started</a>` : ''}
      </div>
    </header>`;
}

function mount(html) {
  const node = root();
  node.innerHTML = html;
  node.hidden = false;
  $('#app').hidden = true;
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  node.querySelector('[data-theme-toggle]')?.addEventListener('click', (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    theme.toggle({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
  });
}

/* =========================================================
   Landing
   ========================================================= */
const FEATURES = [
  { icon: 'leaf', title: 'A gentle check-in', text: 'Log how you feel, breathe for a minute, and get a kind word back — every day.' },
  { icon: 'tasks', title: 'One thing at a time', text: 'Your list picks the single next step for you, so a long day never feels heavy.' },
  { icon: 'calendar', title: 'A calm calendar', text: 'Events, appointments and reminders in one soft month view. No clutter.' },
  { icon: 'flame', title: 'Habits, not pressure', text: 'Streaks that celebrate you and never scold you for missing a day.' },
  { icon: 'wallet', title: 'Money without stress', text: 'Savings goals and simple cashflow, shown in plain, friendly language.' },
  { icon: 'note', title: 'Room to reflect', text: 'A journal, three good things a day, and a mood history you actually enjoy reading.' }
];

export function renderLanding() {
  mount(`
    ${nav()}
    <main class="lp">

      <section class="lp-hero">
        <div class="lp-hero__copy">
          <span class="lp-badge">${icon('leaf')} A softer way to hold your life</span>
          <h1>Your whole life, <em>gently</em> in one place.</h1>
          <p class="lp-hero__sub">
            LifeFlow keeps your days, goals, money and feelings together —
            calmly, so you can breathe out and just be present.
          </p>
          <div class="lp-cta">
            <a class="btn btn--primary" href="#/signup">Start free ${icon('arrowRight')}</a>
            <a class="btn btn--ghost" href="#/login">I already have an account</a>
          </div>
          <p class="lp-note">Free forever · No ads · Your data stays yours</p>
        </div>
        ${softPhone()}
      </section>

      <section class="lp-section">
        <div class="lp-section__head">
          <span class="eyebrow">What’s inside</span>
          <h2>Made to feel good, not busy</h2>
          <p>Every screen is built around one question: does this make the day lighter?</p>
        </div>
        <div class="lp-feats stagger">
          ${FEATURES.map(
            (f) => `
            <article class="lp-feat">
              <span class="lp-feat__icon">${icon(f.icon)}</span>
              <div>
                <h3>${f.title}</h3>
                <p>${f.text}</p>
              </div>
            </article>`
          ).join('')}
        </div>
      </section>

      <section class="lp-quote">
        ${icon('quote')}
        <p>You don’t have to do it all today. You just have to do the next kind thing.</p>
        <span>— the whole idea behind LifeFlow</span>
      </section>

      <section class="lp-final">
        <span class="eyebrow">Whenever you’re ready</span>
        <h2>Let’s make today lighter</h2>
        <p>Takes a minute to set up, and it’s yours on every device — phone first, always.</p>
        <a class="btn btn--primary" href="#/signup">Create my space ${icon('arrowRight')}</a>
      </section>

    </main>
    <footer class="pub-foot">© ${new Date().getFullYear()} LifeFlow · Take it slow.</footer>
  `);
}

function softPhone() {
  return `
    <div class="lp-art" aria-hidden="true">
      <div class="lp-phone">
        <div class="lp-phone__grip"></div>
        <div class="lp-phone__hi">Good morning, Sam<small>Nothing urgent. Start soft.</small></div>
        <div class="lp-orb">Breathe</div>
        <div class="lp-line lp-line--moods">
          <span>😔</span><span>😕</span><span>🙂</span><span>😄</span><span>🤩</span>
        </div>
        <div class="lp-line"><i>${icon('checkCircle')}</i><div>Write one page<small>If only one thing today</small></div></div>
        <div class="lp-line"><i>${icon('flame')}</i><div>Morning walk<small>12 gentle days 🌿</small></div></div>
      </div>
    </div>`;
}

/* =========================================================
   Auth shells
   ========================================================= */
function authShell({ title, subtitle, emoji, form, alt }) {
  return `
    ${nav(false)}
    <main class="auth">
      <div class="auth__card">
        <div class="auth__head">
          <div class="avatar avatar--lg" aria-hidden="true">${emoji}</div>
          <h1>${esc(title)}</h1>
          <p>${esc(subtitle)}</p>
        </div>
        ${form}
        <p class="auth__alt">${alt}</p>
      </div>
    </main>`;
}

function passwordField(id, label, autocomplete = 'current-password', hint = '') {
  return `
    <div class="field field--icon" data-field="${id}">
      <label for="${id}">${label}</label>
      ${icon('lock', 'field__icon')}
      <input class="input" id="${id}" name="${id}" type="password" required autocomplete="${autocomplete}" placeholder="••••••••" minlength="6" />
      <button type="button" class="field__action" data-toggle-pw aria-label="Show password">${icon('eye')}</button>
      ${hint ? `<span class="field__hint">${hint}</span>` : ''}
    </div>`;
}

function emailField(id = 'email') {
  return `
    <div class="field field--icon" data-field="${id}">
      <label for="${id}">Email</label>
      ${icon('mail', 'field__icon')}
      <input class="input" id="${id}" name="${id}" type="email" required autocomplete="email" inputmode="email" placeholder="you@example.com" />
    </div>`;
}

function bindPasswordToggles(scope) {
  scope.querySelectorAll('[data-toggle-pw]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = btn.parentElement.querySelector('input');
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.innerHTML = icon(show ? 'eyeOff' : 'eye');
      btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      input.focus();
    });
  });
}

function showFormError(form, message) {
  let box = form.querySelector('.form-error');
  if (!box) {
    box = el('div', { class: 'form-error', role: 'alert' });
    form.prepend(box);
  }
  box.innerHTML = `${icon('alert')}<span>${esc(message)}</span>`;
  box.style.animation = 'none';
  void box.offsetWidth;
  box.style.animation = '';
}

/* =========================================================
   Login
   ========================================================= */
export function renderLogin() {
  mount(
    authShell({
      title: 'Welcome back',
      subtitle: 'Log in to pick up right where you left off.',
      emoji: '👋',
      form: `
        <form class="auth__form" novalidate>
          ${emailField()}
          ${passwordField('password', 'Password')}
          <div class="auth__meta">
            <label class="check"><input type="checkbox" name="remember" checked /><span class="check__box">${icon('check')}</span><span>Stay signed in</span></label>
            <a href="#/forgot">Forgot password?</a>
          </div>
          <button class="btn btn--primary btn--block" type="submit">Log in ${icon('arrowRight')}</button>
        </form>`,
      alt: 'New to LifeFlow? <a href="#/signup">Create an account</a>'
    })
  );

  const form = root().querySelector('form');
  bindPasswordToggles(form);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('[type="submit"]');
    const email = form.email.value.trim();
    const password = form.password.value;
    if (!email || !password) return showFormError(form, 'Please fill in your email and password.');

    try {
      await withLoading(btn, signInWithEmailAndPassword(auth, email, password));
      toast('Welcome back! 👋');
    } catch (err) {
      showFormError(form, authErrorMessage(err));
    }
  });
}

/* =========================================================
   Sign up
   ========================================================= */
export function renderSignup() {
  mount(
    authShell({
      title: 'Create your flow',
      subtitle: 'One account for tasks, goals, money and habits.',
      emoji: '✨',
      form: `
        <form class="auth__form" novalidate>
          <div class="field field--icon" data-field="name">
            <label for="name">Your name</label>
            ${icon('user', 'field__icon')}
            <input class="input" id="name" name="name" type="text" required autocomplete="name" placeholder="Alex Rivera" maxlength="60" />
          </div>
          ${emailField()}
          ${passwordField('password', 'Password', 'new-password')}
          <div class="strength" aria-hidden="true">
            <div class="strength__bars"><i></i><i></i><i></i><i></i></div>
            <span class="strength__text">Use 6+ characters with a mix of letters and numbers.</span>
          </div>
          <label class="check"><input type="checkbox" name="terms" required /><span class="check__box">${icon('check')}</span>
            <span class="fs-sm t-dim">I agree to keep my data safe and use LifeFlow kindly.</span></label>
          <button class="btn btn--primary btn--block" type="submit">Create account ${icon('sparkles')}</button>
        </form>`,
      alt: 'Already have an account? <a href="#/login">Log in</a>'
    })
  );

  const form = root().querySelector('form');
  bindPasswordToggles(form);

  const bars = form.querySelectorAll('.strength__bars i');
  const label = form.querySelector('.strength__text');
  form.password.addEventListener('input', () => {
    const v = form.password.value;
    let score = 0;
    if (v.length >= 6) score++;
    if (v.length >= 10) score++;
    if (/[A-Z]/.test(v) && /[a-z]/.test(v)) score++;
    if (/\d/.test(v) || /[^\w]/.test(v)) score++;
    const words = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'];
    bars.forEach((b, i) => {
      b.className = '';
      if (i < score) b.classList.add(`on-${score}`);
    });
    label.textContent = v ? words[score] : 'Use 6+ characters with a mix of letters and numbers.';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('[type="submit"]');
    const name = form.name.value.trim();
    const email = form.email.value.trim();
    const password = form.password.value;

    if (!name) return showFormError(form, 'Please tell us your name.');
    if (password.length < 6) return showFormError(form, 'Password must be at least 6 characters.');
    if (!form.terms.checked) return showFormError(form, 'Please accept the terms to continue.');

    try {
      await withLoading(
        btn,
        (async () => {
          const cred = await createUserWithEmailAndPassword(auth, email, password);
          await updateProfile(cred.user, { displayName: name });
        })()
      );
      toast(`Welcome to LifeFlow, ${name.split(' ')[0]}! 🎉`);
    } catch (err) {
      showFormError(form, authErrorMessage(err));
    }
  });
}

/* =========================================================
   Forgot password
   ========================================================= */
export function renderForgot() {
  mount(
    authShell({
      title: 'Reset your password',
      subtitle: 'We’ll email you a secure link to choose a new one.',
      emoji: '🔑',
      form: `
        <form class="auth__form" novalidate>
          ${emailField()}
          <button class="btn btn--primary btn--block" type="submit">Send reset link ${icon('mail')}</button>
          <a class="btn btn--ghost btn--block" href="#/login">${icon('chevronLeft')} Back to login</a>
        </form>`,
      alt: 'Remembered it? <a href="#/login">Log in instead</a>'
    })
  );

  const form = root().querySelector('form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('[type="submit"]');
    const email = form.email.value.trim();
    if (!email) return showFormError(form, 'Please enter your email address.');
    try {
      await withLoading(btn, sendPasswordResetEmail(auth, email));
      form.innerHTML = `
        <div class="empty">
          <div class="empty__icon">${icon('mail')}</div>
          <h3>Check your inbox</h3>
          <p>If an account exists for <b>${esc(email)}</b>, a reset link is on its way.</p>
          <a class="btn btn--primary" href="#/login">Back to login</a>
        </div>`;
      toast('Reset link sent 📬', 'success');
    } catch (err) {
      showFormError(form, authErrorMessage(err));
    }
  });
}

export function hidePublic() {
  const node = root();
  node.hidden = true;
  node.innerHTML = '';
}

export { navigate };
