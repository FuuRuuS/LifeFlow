/**
 * LifeFlow — ambient theme effects.
 * One canvas behind the app, drawing a theme's signature motion: digital rain,
 * falling sakura petals, sparkles, a starry sky or drifting gold dust.
 * Never runs in calm mode or with reduced motion, and pauses while hidden.
 */
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
const GLYPHS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワン0123456789ABCDEF<>/{}$#';
const FRAME = { rain: 55, petals: 33, sparkle: 40, stars: 40, dust: 33 };
const OPACITY = { rain: 0.32, petals: 0.85, sparkle: 0.8, stars: 0.9, dust: 0.75 };

const fx = { mode: null, canvas: null, ctx: null, raf: 0, last: 0, w: 0, h: 0, dpr: 1, parts: [], colors: [] };

const rand = (a, b) => a + Math.random() * (b - a);

function readColors() {
  const cs = getComputedStyle(document.documentElement);
  fx.colors = ['--accent', '--accent-2', '--accent-3', '--text'].map((v) => cs.getPropertyValue(v).trim() || '#fff');
}

/** Turn an effect on, swap it, or pass null to stop. Safe to call often. */
export function setFx(next) {
  const calm = document.documentElement.getAttribute('data-calm') === 'on';
  const want = next && FRAME[next] && !reduced.matches && !calm ? next : null;
  if (want && want === fx.mode) { requestAnimationFrame(readColors); return; }
  stop();
  fx.mode = want;
  if (want) start();
}

function start() {
  const host = document.querySelector('.aurora');
  if (!host) return;
  fx.canvas = document.createElement('canvas');
  fx.canvas.className = 'fx-layer';
  fx.canvas.setAttribute('aria-hidden', 'true');
  fx.canvas.style.opacity = String(OPACITY[fx.mode]);
  host.appendChild(fx.canvas);
  fx.ctx = fx.canvas.getContext('2d');
  // Colours come from CSS — wait one frame so a just-switched theme has applied.
  requestAnimationFrame(() => { readColors(); resize(); loop(0); });
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', onVisibility);
}

function stop() {
  cancelAnimationFrame(fx.raf);
  fx.raf = 0;
  fx.canvas?.remove();
  fx.canvas = null;
  fx.ctx = null;
  fx.parts = [];
  window.removeEventListener('resize', resize);
  document.removeEventListener('visibilitychange', onVisibility);
}

function onVisibility() {
  if (!fx.canvas) return;
  cancelAnimationFrame(fx.raf);
  if (!document.hidden) fx.raf = requestAnimationFrame(loop);
}

function resize() {
  if (!fx.canvas) return;
  fx.dpr = Math.min(window.devicePixelRatio || 1, 2);
  fx.w = fx.canvas.width = Math.floor(innerWidth * fx.dpr);
  fx.h = fx.canvas.height = Math.floor(innerHeight * fx.dpr);
  seed();
}

function seed() {
  const { w, h, dpr } = fx;
  const area = (w * h) / (dpr * dpr);
  if (fx.mode === 'rain') {
    const size = 16 * dpr;
    fx.parts = Array.from({ length: Math.ceil(w / size) }, () => ({ y: rand(-h, 0), speed: rand(0.6, 1.3) }));
  } else if (fx.mode === 'petals') {
    fx.parts = Array.from({ length: Math.round(Math.min(34, area / 40000)) }, () => petal(true));
  } else if (fx.mode === 'sparkle') {
    fx.parts = Array.from({ length: Math.round(Math.min(46, area / 30000)) }, () => ({
      x: rand(0, w), y: rand(0, h), r: rand(3, 8) * dpr, phase: rand(0, Math.PI * 2), speed: rand(0.02, 0.05), c: Math.floor(rand(0, 3))
    }));
  } else if (fx.mode === 'stars') {
    fx.parts = Array.from({ length: Math.round(Math.min(160, area / 9000)) }, () => ({
      x: rand(0, w), y: rand(0, h), r: rand(0.4, 1.5) * dpr, phase: rand(0, Math.PI * 2), speed: rand(0.01, 0.04)
    }));
    fx.shoot = null;
  } else if (fx.mode === 'dust') {
    fx.parts = Array.from({ length: Math.round(Math.min(70, area / 20000)) }, () => mote(true));
  }
}

const petal = (anywhere) => ({
  x: rand(0, fx.w), y: anywhere ? rand(0, fx.h) : rand(-60, -10) * fx.dpr,
  r: rand(5, 10) * fx.dpr, vy: rand(0.5, 1.2) * fx.dpr, vx: rand(-0.3, 0.6) * fx.dpr,
  rot: rand(0, Math.PI * 2), vr: rand(-0.03, 0.03), sway: rand(0, Math.PI * 2), c: Math.random() < 0.7 ? 1 : 0
});

const mote = (anywhere) => ({
  x: rand(0, fx.w), y: anywhere ? rand(0, fx.h) : fx.h + 10,
  r: rand(0.6, 2.2) * fx.dpr, vy: rand(0.15, 0.5) * fx.dpr, phase: rand(0, Math.PI * 2)
});

function loop(t) {
  fx.raf = requestAnimationFrame(loop);
  if (t - fx.last < FRAME[fx.mode]) return;
  fx.last = t;
  const { ctx, w, h, dpr } = fx;
  if (!ctx) return;
  const [c1, c2, c3, text] = fx.colors;

  if (fx.mode === 'rain') {
    // Fade the previous frame towards transparent so the trails glow out.
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0,0,0,.12)';
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
    const size = 16 * dpr;
    ctx.font = `${size}px 'JetBrains Mono', Consolas, monospace`;
    fx.parts.forEach((d, i) => {
      const ch = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      ctx.fillStyle = Math.random() < 0.08 ? text : c1;
      ctx.fillText(ch, i * size, d.y);
      d.y += size * d.speed;
      if (d.y > h && Math.random() > 0.975) d.y = rand(-h * 0.3, 0);
    });
    return;
  }

  ctx.clearRect(0, 0, w, h);

  if (fx.mode === 'petals') {
    fx.parts.forEach((p, i) => {
      p.sway += 0.02;
      p.x += p.vx + Math.sin(p.sway) * 0.6 * dpr;
      p.y += p.vy;
      p.rot += p.vr;
      if (p.y > h + 20 || p.x > w + 30) fx.parts[i] = petal(false);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.scale(1, 0.62 + Math.sin(p.sway * 2) * 0.18);
      ctx.fillStyle = p.c ? c2 : c1;
      ctx.globalAlpha = 0.75;
      ctx.beginPath();
      ctx.moveTo(0, -p.r);
      ctx.quadraticCurveTo(p.r, -p.r * 0.2, 0, p.r);
      ctx.quadraticCurveTo(-p.r, -p.r * 0.2, 0, -p.r);
      ctx.fill();
      ctx.restore();
    });
  } else if (fx.mode === 'sparkle') {
    const pal = [c1, c2, c3];
    fx.parts.forEach((s) => {
      s.phase += s.speed;
      const a = Math.max(0, Math.sin(s.phase));
      if (a <= 0.01 && Math.random() < 0.02) { s.x = rand(0, w); s.y = rand(0, h); }
      const r = s.r * (0.5 + a * 0.5);
      ctx.globalAlpha = a;
      ctx.fillStyle = pal[s.c];
      ctx.beginPath();
      ctx.moveTo(s.x, s.y - r);
      ctx.quadraticCurveTo(s.x, s.y, s.x + r, s.y);
      ctx.quadraticCurveTo(s.x, s.y, s.x, s.y + r);
      ctx.quadraticCurveTo(s.x, s.y, s.x - r, s.y);
      ctx.quadraticCurveTo(s.x, s.y, s.x, s.y - r);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  } else if (fx.mode === 'stars') {
    ctx.fillStyle = text;
    fx.parts.forEach((s) => {
      s.phase += s.speed;
      ctx.globalAlpha = 0.25 + Math.abs(Math.sin(s.phase)) * 0.75;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    });
    if (!fx.shoot && Math.random() < 0.006) {
      fx.shoot = { x: rand(w * 0.2, w), y: rand(0, h * 0.4), life: 1 };
    }
    if (fx.shoot) {
      const s = fx.shoot;
      const len = 120 * dpr;
      const g = ctx.createLinearGradient(s.x, s.y, s.x + len, s.y - len * 0.4);
      g.addColorStop(0, c1);
      g.addColorStop(1, 'transparent');
      ctx.globalAlpha = s.life;
      ctx.strokeStyle = g;
      ctx.lineWidth = 1.6 * dpr;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x + len, s.y - len * 0.4);
      ctx.stroke();
      s.x -= 14 * dpr;
      s.y += 5.6 * dpr;
      s.life -= 0.04;
      if (s.life <= 0) fx.shoot = null;
    }
    ctx.globalAlpha = 1;
  } else if (fx.mode === 'dust') {
    fx.parts.forEach((m, i) => {
      m.phase += 0.03;
      m.y -= m.vy;
      m.x += Math.sin(m.phase) * 0.3 * dpr;
      if (m.y < -10) fx.parts[i] = mote(false);
      ctx.globalAlpha = 0.3 + Math.abs(Math.sin(m.phase)) * 0.7;
      ctx.fillStyle = i % 3 ? c1 : c2;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }
}
