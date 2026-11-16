// A movie hacker's screen inside an arcade cabinet: a boot sequence, typed terminals,
// text that decrypts as it scrolls in, pixel sprites, and a small shooter.
import './style.css';

const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Pixel sprites, drawn from little maps of letters ────────────────────────
const COLORS = { H: '#141a2e', h: '#2b3760', F: '#05070d', V: '#3DE8FF', B: '#1b2440', L: '#39435f', G: '#3DFF8B', g: '#D9FFE6',
                 W: '#D9FFE6', R: '#FF3DA6', C: '#3DE8FF', D: '#063b44', Y: '#FFD23D', K: '#3DFF8B' };
const SPRITES = {
  avatar: ['................', '.....HHHHHH.....', '....HhhhhhhH....', '...HhHHHHHHhH...', '...HhFFFFFFhH...', '...HhFVVFVVhH...', '...HhFFFFFFhH...', '...HHhFFFFhHH...',
           '....HHhhhhHH....', '...BBHHHHHHBB...', '..BBBBBBBBBBBB..', '..BBLLLLLLLLBB..', '..BBLGGGGGGLBB..', '..BBLGGGGGGLBB..', '...LLLLLLLLLL...', '................'],
  thermo: ['.....WW.....', '....W..W....', '....W..W....', '....W..W....', '....WKKW....', '....WKKW....', '....WKKW....', '...WKKKKW...', '...WKKKKW...', '...WKKKKW...', '....WWWW....', '............'],
  servers: ['.YYYYYYYYYY.', '.YK......YY.', '.YYYYYYYYYY.', '............', '.YYYYYYYYYY.', '.YK......YY.', '.YYYYYYYYYY.', '............', '.YYYYYYYYYY.', '.YR......YY.', '.YYYYYYYYYY.', '............'],
  shield: ['.CCCCCCCCCC.', '.CDDDDDDDDC.', '.CDDDWWDDDC.', '.CDDDWWDDDC.', '.CDWWWWWWDC.', '.CDWWWWWWDC.', '.CDDDWWDDDC.', '..CDDWWDDC..', '..CDDDDDDC..', '...CDDDDC...', '....CDDC....', '.....CC.....'],
  ship: ['.....RR.....', '.....RR.....', '....RRRR....', '....RFFR....', '...RRFFRR...', '...RFFFFR...', '..RRFFFFRR..', '..RFFFFFFR..', '.RRFFFFFFRR.', '.RRRRRRRRRR.', '....Y..Y....', '............']
};
function paint(canvas, rows, swap) {
  canvas.width = rows[0].length; canvas.height = rows.length;
  const ctx = canvas.getContext('2d');
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    const c = (swap && swap[ch]) || COLORS[ch];
    if (c) { ctx.fillStyle = c; ctx.fillRect(x, y, 1, 1); }
  }));
}
document.querySelectorAll('.sprite').forEach(c => paint(c, SPRITES[c.dataset.sprite]));
const avatar = document.getElementById('avatar');
paint(avatar, SPRITES.avatar);
if (!still) {                                   // it blinks, and its screen flickers as it types
  let n = 0;
  setInterval(() => { n++; paint(avatar, SPRITES.avatar, { V: n % 9 === 0 ? COLORS.F : COLORS.V, G: n % 2 ? COLORS.G : COLORS.g }); }, 330);
}

// ── Typed terminal lines ─────────────────────────────────────────────────────
async function typeLines(term) {
  const lines = [...term.querySelectorAll('.tl')], texts = lines.map(l => l.textContent);
  const cursor = term.querySelector('.cursor');
  lines.forEach(l => { l.textContent = ''; });
  for (let i = 0; i < lines.length; i++) {
    const cmd = lines[i].classList.contains('cmd');
    if (cmd) { for (let k = 1; k <= texts[i].length; k++) { lines[i].textContent = texts[i].slice(0, k); await sleep(34); } await sleep(160); }
    else { lines[i].textContent = texts[i]; await sleep(90); }
  }
  if (cursor) lines[lines.length - 1].appendChild(cursor);
}

// ── Text that decrypts as it scrolls into view ───────────────────────────────
const NOISE = '01#$%&@<>/\\[]{}ABCDEF';
function decrypt(el) {
  const text = el.textContent, t0 = performance.now(), dur = 650;
  (function step(now) {
    const k = Math.min(1, (now - t0) / dur), shown = Math.floor(k * text.length);
    el.textContent = text.slice(0, shown) + [...text.slice(shown)].map(ch => ch === ' ' ? ' ' : NOISE[Math.floor(Math.random() * NOISE.length)]).join('');
    if (k < 1) requestAnimationFrame(step); else el.textContent = text;
  })(t0);
}
if (!still) {
  const seen = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { seen.unobserve(e.target); decrypt(e.target); } }), { threshold: 0.6 });
  document.querySelectorAll('[data-decrypt]').forEach(el => seen.observe(el));
}

// ── Falling code behind the profile ──────────────────────────────────────────
(function rain(canvas) {
  const ctx = canvas.getContext('2d'), size = 18;
  let cols = [], W = 0, H = 0, visible = true;
  function resize() {
    W = canvas.width = canvas.clientWidth; H = canvas.height = canvas.clientHeight;
    cols = Array.from({ length: Math.ceil(W / size) }, () => Math.random() * -40);
    ctx.font = size + 'px VT323, monospace';
  }
  new ResizeObserver(resize).observe(canvas);
  resize();
  new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(canvas);
  function frame() {
    if (!visible) return;
    ctx.fillStyle = 'rgba(7, 7, 15, 0.16)'; ctx.fillRect(0, 0, W, H);
    cols.forEach((y, i) => {
      ctx.fillStyle = Math.random() < 0.04 ? '#D9FFE6' : '#3DFF8B';
      ctx.fillText(NOISE[Math.floor(Math.random() * NOISE.length)], i * size, y * size);
      cols[i] = y * size > H && Math.random() < 0.05 ? 0 : y + 1;
    });
  }
  if (still) { for (let i = 0; i < 30; i++) frame(); } else setInterval(frame, 70);
})(document.getElementById('rain'));

// ── Boot: connect, verify, ACCESS GRANTED ────────────────────────────────────
async function boot() {
  const box = document.getElementById('boot'), log = document.getElementById('bootlog');
  let skipped = false, seen = false;
  try { seen = sessionStorage.getItem('booted') === '1'; sessionStorage.setItem('booted', '1'); } catch (e) { /* storage may be blocked */ }
  if (still || seen) return;
  const skip = () => { skipped = true; };
  window.addEventListener('keydown', skip, { once: true });
  box.addEventListener('pointerdown', skip, { once: true });
  document.body.classList.add('booting');
  const lines = ['> ssh visitor@nassim-bakkas', '> handshake .............. OK', '> verifying visitor ...... OK', '> loading profile [##########] 100%'];
  for (const line of lines) {
    for (const ch of line) { if (skipped) break; log.textContent += ch; await sleep(ch === '.' || ch === '#' ? 22 : 12); }
    log.textContent += '\n';
    if (!skipped) await sleep(140);
  }
  if (!skipped) { box.classList.add('done'); await sleep(850); }
  document.body.classList.remove('booting');
}
boot().then(() => { if (!still) typeLines(document.getElementById('term')); });
document.getElementById('again').addEventListener('click', e => { e.preventDefault(); window.scrollTo({ top: 0, behavior: still ? 'auto' : 'smooth' }); });

// ── Bonus stage: fly the ship, shoot a shape, land on that mission ───────────
(function play(canvas) {
  const ctx = canvas.getContext('2d');
  const ids = [...document.querySelectorAll('#missions .grid:first-of-type .mission')];
  const targets = [['HVAC', 3, '#3DFF8B'], ['VMSWARM', 4, '#FFD23D'], ['MODBUS', 0, '#3DE8FF'], ['SPACE GAME', 6, '#FF3DA6']]
    .map(([label, sides, color], i) => ({ label, sides, color, el: ids[i], x: 0, y: 0, hit: 0 }));
  let W = 0, H = 0, shipX = null, shots = [], keys = {}, visible = false, last = 0, time = 0, score = 0;
  function resize() {
    const d = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = W * d; canvas.height = H * d;
    ctx.setTransform(d, 0, 0, d, 0, 0);
    if (shipX === null) shipX = W / 2;
  }
  new ResizeObserver(resize).observe(canvas);
  resize();
  const fire = () => { if (shots.length < 6) shots.push({ x: shipX, y: H - 56 }); };
  const at = e => { shipX = e.clientX - canvas.getBoundingClientRect().left; };
  canvas.addEventListener('pointermove', at);
  canvas.addEventListener('pointerdown', e => { at(e); fire(); });
  canvas.addEventListener('keydown', e => {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); fire(); }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); keys[e.key] = true; }
  });
  canvas.addEventListener('keyup', e => { keys[e.key] = false; });
  new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) { last = 0; requestAnimationFrame(frame); } }).observe(canvas);
  const px = v => Math.round(v / 4) * 4;                      // everything snaps to a 4-pixel grid
  function shape(t, r) {
    ctx.beginPath();
    if (!t.sides) ctx.arc(px(t.x), px(t.y), r, 0, Math.PI * 2);
    else for (let i = 0; i < t.sides; i++) {
      const a = -Math.PI / 2 + i * 2 * Math.PI / t.sides + (t.sides === 4 ? Math.PI / 4 : 0);
      ctx[i ? 'lineTo' : 'moveTo'](px(t.x) + Math.cos(a) * r, px(t.y) + Math.sin(a) * r);
    }
    ctx.closePath();
  }
  function frame(ms) {
    if (!visible) return;
    const dt = last ? Math.min(0.05, (ms - last) / 1000) : 0; last = ms;
    if (!still) time += dt;
    if (keys.ArrowLeft) shipX -= 420 * dt;
    if (keys.ArrowRight) shipX += 420 * dt;
    shipX = Math.max(20, Math.min(W - 20, shipX));
    ctx.clearRect(0, 0, W, H);
    ctx.font = '10px "Press Start 2P", monospace'; ctx.textAlign = 'left'; ctx.fillStyle = '#FFD23D';
    ctx.fillText('SCORE ' + String(score).padStart(4, '0'), 12, 22);
    ctx.textAlign = 'center';
    targets.forEach((t, i) => {
      t.x = (i + 0.5) / targets.length * W + Math.sin(time * 0.7 + i * 1.7) * Math.min(34, W / 14);
      t.y = 92 + Math.sin(time * 1.1 + i * 2.3) * 12;
      if (t.hit > 0) {
        t.hit -= dt;
        const k = 1 - Math.max(0, t.hit) / 0.6;
        ctx.strokeStyle = t.color; ctx.globalAlpha = 1 - k; ctx.lineWidth = 4;
        shape(t, 24 + k * 46); ctx.stroke(); ctx.globalAlpha = 1;
        if (t.hit <= 0 && t.el) t.el.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'center' });
      } else {
        ctx.fillStyle = t.color; shape(t, 24); ctx.fill();
        ctx.fillStyle = '#020205'; shape(t, 9); ctx.fill();
      }
      ctx.fillStyle = '#7FB096'; ctx.font = '8px "Press Start 2P", monospace';
      ctx.fillText(t.label, px(t.x), px(t.y) + 52);
    });
    shots = shots.filter(s => {
      s.y -= 620 * dt;
      for (const t of targets) if (t.hit <= 0 && Math.hypot(s.x - t.x, s.y - t.y) < 28) { t.hit = 0.6; score += 100; return false; }
      ctx.fillStyle = '#D9FFE6'; ctx.fillRect(px(s.x) - 2, px(s.y) - 8, 4, 16);
      return s.y > -20;
    });
    const x = px(shipX), y = H - 34;                          // the ship, in blocks
    ctx.fillStyle = '#3DE8FF';
    [[0, -20, 8, 8], [-8, -12, 24, 8], [-12, -4, 32, 8], [-16, 4, 40, 8]].forEach(([dx, dy, w, h]) => ctx.fillRect(x + dx - 4, y + dy, w, h));
    ctx.fillStyle = '#FFD23D'; ctx.fillRect(x - 12, y + 12, 4, 6); ctx.fillRect(x + 8, y + 12, 4, 6);
    requestAnimationFrame(frame);
  }
})(document.getElementById('play'));
