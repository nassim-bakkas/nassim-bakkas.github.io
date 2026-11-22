// Space Game, the web demo: a small version of the real game. Waves of the four
// biomes (triangles, squares, circles, prisms), then the Vault, all on a 128 bpm
// beat. Keyboard, mouse or touch. startArcade({ onExit }) opens it full screen.

const BIOMES = [
  { name: 'TRIANGLE BIOME', color: '#FF3DA6', dark: '#4a0b2c', kind: 'tri' },
  { name: 'SQUARE BIOME', color: '#FFD23D', dark: '#4a3a08', kind: 'sq' },
  { name: 'CIRCLE BIOME', color: '#C48BFF', dark: '#2e1650', kind: 'ci' },
  { name: 'PRISM BIOME', color: '#EEF3FF', dark: '#3a4060', kind: 'pr' }
];
const POINTS = { tri: 100, sq: 150, ci: 150, pr: 200, boss: 2000 };
const BPM = 128, BEAT = 60 / BPM;

export function startArcade({ onExit }) {
  const root = document.getElementById('arcade'), cv = root.querySelector('canvas'), ctx = cv.getContext('2d');
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const touch = matchMedia('(pointer: coarse)').matches;
  root.hidden = false;
  document.body.classList.add('arcading');

  let W = 0, H = 0;
  function resize() {
    const d = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    cv.width = W * d; cv.height = H * d; cv.style.width = W + 'px'; cv.style.height = H + 'px';
    ctx.setTransform(d, 0, 0, d, 0, 0);
  }
  resize();
  addEventListener('resize', resize);

  // ── sound: a kick on the beat, blips and crunches, all synthesised ──
  let ac = null, master = null, muted = false;
  try { ac = new (window.AudioContext || window.webkitAudioContext)(); master = ac.createGain(); master.gain.value = 0.22; master.connect(ac.destination); } catch (e) { ac = null; }
  function tone(freq, dur, type = 'square', vol = 0.3, slide = 0) {
    if (!ac || muted) return;
    const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime;
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur);
  }
  function crunch(dur = 0.25, vol = 0.35) {
    if (!ac || muted) return;
    const n = Math.floor(ac.sampleRate * dur), buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
    const s = ac.createBufferSource(), g = ac.createGain(); g.gain.value = vol;
    s.buffer = buf; s.connect(g); g.connect(master); s.start();
  }
  const kick = () => tone(140, 0.18, 'sine', 0.55, 0.3);

  // ── state ──
  const keys = {};
  let mode = 'title', wave = 0, loop = 0, score = 0, lives = 3, banner = 0, shake = 0, time = 0, beatAt = 0, pulse = 0, beatNo = 0;
  let best = 0;
  try { best = +localStorage.getItem('sg-best') || 0; } catch (e) { /* storage may be blocked */ }
  let player = { x: 0, y: 0, inv: 0 }, shots = [], foes = [], bombs = [], parts = [], fireCd = 0, pointer = null, firing = false, boss = null;
  const stars = Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random(), z: 0.3 + Math.random() * 0.7 }));
  function reset() {
    player = { x: W / 2, y: H - 70, inv: 0 };
    shots = []; foes = []; bombs = []; parts = []; fireCd = 0; boss = null;
    wave = 0; loop = 0; score = 0; lives = 3;
    nextWave();
  }
  const speed = () => 1 + 0.18 * loop;
  function nextWave() {
    wave++;
    const inLoop = (wave - 1) % 5;
    if (inLoop === 0 && wave > 1) loop++;
    banner = 2.2; mode = 'banner';
    if (inLoop === 4) { boss = { x: W / 2, y: -90, hp: 70 + 30 * loop, max: 70 + 30 * loop, ang: 0, flash: 0, move: 0 }; return; }
    const b = BIOMES[inLoop], n = Math.min(18, 7 + wave + loop * 2), cols = Math.min(6, Math.ceil(n / 2));
    for (let i = 0; i < n; i++) {
      const c = i % cols, r = Math.floor(i / cols);
      const sx = W / 2 + (c - (cols - 1) / 2) * Math.min(90, (W - 80) / cols), sy = 90 + r * 62;
      foes.push({ kind: b.kind, biome: b, x: sx, y: -60 - r * 70 - c * 14, sx, sy, hp: b.kind === 'sq' ? 3 : 1, mode: 'enter', t: Math.random() * 6, vx: 0, vy: 0, flash: 0 });
    }
  }
  function burst(x, y, color, n = 14, sp = 160) {
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = sp * (0.4 + Math.random()); parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.5 + Math.random() * 0.4, color }); }
  }
  function aimed(x, y, sp, spread = 0) {
    const a = Math.atan2(player.y - y, player.x - x) + spread;
    bombs.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 5 });
  }
  function hurt() {
    if (player.inv > 0 || mode === 'over') return;
    lives--; player.inv = 1.8; shake = 0.35; burst(player.x, player.y, '#3DE8FF', 24, 220); crunch(0.4, 0.5);
    if (lives <= 0) {
      mode = 'over';
      if (score > best) { best = score; try { localStorage.setItem('sg-best', String(best)); } catch (e) { /* storage may be blocked */ } }
    }
  }

  // ── input ──
  function onKey(e) {
    const k = e.key.toLowerCase();
    if (e.type === 'keydown') {
      if (k === 'escape') { e.preventDefault(); return exit(); }
      if (k === 'm') { muted = !muted; return; }
      if ((mode === 'title' || mode === 'over') && (k === ' ' || k === 'enter' || k === 'r')) { e.preventDefault(); reset(); return; }
    }
    if ([' ', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(k)) e.preventDefault();
    keys[k] = e.type === 'keydown';
  }
  const pos = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  function onDown(e) {
    if (e.target.closest('.arcade-close')) return;
    if (mode === 'title' || mode === 'over') { reset(); return; }
    pointer = pos(e); firing = true;
  }
  function onMove(e) { if (pointer || e.pointerType === 'mouse') pointer = pos(e); }
  function onUp() { firing = false; if (touch) pointer = null; }
  addEventListener('keydown', onKey); addEventListener('keyup', onKey);
  cv.addEventListener('pointerdown', onDown); addEventListener('pointermove', onMove); addEventListener('pointerup', onUp);
  const closeBtn = root.querySelector('.arcade-close');
  closeBtn.onclick = () => exit();

  let raf = 0, last = 0, paused = false;
  const onVis = () => { paused = document.hidden; last = 0; };
  document.addEventListener('visibilitychange', onVis);
  function exit() {
    cancelAnimationFrame(raf);
    removeEventListener('keydown', onKey); removeEventListener('keyup', onKey); removeEventListener('resize', resize);
    cv.removeEventListener('pointerdown', onDown); removeEventListener('pointermove', onMove); removeEventListener('pointerup', onUp);
    document.removeEventListener('visibilitychange', onVis);
    if (ac) ac.close();
    root.hidden = true; document.body.classList.remove('arcading');
    onExit && onExit();
  }

  // ── update ──
  function update(dt) {
    time += dt;
    // the beat
    if (time - beatAt >= BEAT) {
      beatAt += BEAT; beatNo++; pulse = 1;
      if (mode === 'play' || mode === 'banner') {
        if (beatNo % 2 === 0) kick();
        if (mode === 'play') onBeat();
      }
    }
    pulse = Math.max(0, pulse - dt * 4);
    stars.forEach(s => { s.y += dt * 0.06 * s.z * (mode === 'play' ? 1 : 0.5); if (s.y > 1) { s.y = 0; s.x = Math.random(); } });
    parts = parts.filter(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.96; p.vy *= 0.96; p.life -= dt; return p.life > 0; });
    shake = Math.max(0, shake - dt);
    if (mode === 'title' || mode === 'over') return;
    if (mode === 'banner') { banner -= dt; if (banner <= 0) mode = 'play'; }

    // the ship
    const sp = 340;
    let dx = (keys.arrowright || keys.d ? 1 : 0) - (keys.arrowleft || keys.a || keys.q ? 1 : 0);
    let dy = (keys.arrowdown || keys.s ? 1 : 0) - (keys.arrowup || keys.w || keys.z ? 1 : 0);
    if (dx || dy) { player.x += dx * sp * dt; player.y += dy * sp * dt; }
    else if (pointer) {
      const tx = pointer.x, ty = touch ? pointer.y - 70 : pointer.y;
      player.x += (tx - player.x) * Math.min(1, dt * 14); player.y += (ty - player.y) * Math.min(1, dt * 14);
    }
    player.x = Math.max(20, Math.min(W - 20, player.x)); player.y = Math.max(H * 0.35, Math.min(H - 26, player.y));
    player.inv = Math.max(0, player.inv - dt);
    fireCd -= dt;
    const wantFire = keys[' '] || firing || (touch && pointer);
    if (wantFire && fireCd <= 0 && mode === 'play') {
      fireCd = 0.16; shots.push({ x: player.x - 7, y: player.y - 18 }, { x: player.x + 7, y: player.y - 18 });
      tone(880, 0.06, 'square', 0.08, 0.6);
    }
    shots = shots.filter(s => { s.y -= 720 * dt; return s.y > -20; });

    // the enemies
    for (const f of foes) {
      f.t += dt; f.flash = Math.max(0, f.flash - dt);
      if (f.mode === 'enter') {
        f.x += (f.sx - f.x) * Math.min(1, dt * 2.5); f.y += (f.sy - f.y) * Math.min(1, dt * 2.5);
        if (Math.abs(f.sy - f.y) < 2) f.mode = 'hold';
      } else if (f.mode === 'hold') {
        const sway = Math.sin(time * 1.2 + f.sx * 0.01) * 26;
        if (f.kind === 'ci') { f.x = f.sx + Math.cos(f.t * 2) * 22; f.y = f.sy + Math.sin(f.t * 2) * 12; }
        else { f.x = f.sx + sway; f.y = f.sy; }
      } else if (f.mode === 'dive') {
        f.x += f.vx * dt; f.y += f.vy * dt;
        if (f.y > H + 40) { f.y = -40; f.mode = 'enter'; }
      }
      if (Math.hypot(f.x - player.x, f.y - player.y) < 24) { f.hp = 0; burst(f.x, f.y, f.biome.color); hurt(); }
    }
    // the boss: the Vault
    if (boss) {
      boss.flash = Math.max(0, boss.flash - dt); boss.ang += dt * 0.6 * speed();
      boss.move += dt;
      boss.y += ((150) - boss.y) * Math.min(1, dt * 1.5);
      boss.x = W / 2 + Math.sin(boss.move * 0.7) * Math.min(220, W * 0.3);
      if (Math.hypot(boss.x - player.x, boss.y - player.y) < 70) hurt();
    }
    // hits
    for (const s of shots) {
      for (const f of foes) if (f.hp > 0 && Math.abs(s.x - f.x) < 20 && Math.abs(s.y - f.y) < 20) {
        f.hp--; f.flash = 0.08; s.y = -99;
        if (f.hp <= 0) { score += POINTS[f.kind]; burst(f.x, f.y, f.biome.color); crunch(0.18, 0.25); }
        else tone(300, 0.05, 'square', 0.1);
        break;
      }
      if (boss && s.y > 0 && Math.abs(s.x - boss.x) < 60 && Math.abs(s.y - boss.y) < 60) {
        boss.hp--; boss.flash = 0.06; s.y = -99; score += 10;
        if (boss.hp <= 0) { score += POINTS.boss; for (let i = 0; i < 4; i++) burst(boss.x + (i - 1.5) * 30, boss.y, '#FFD23D', 26, 260); crunch(0.8, 0.6); shake = 0.6; boss = null; bombs = []; }
      }
    }
    foes = foes.filter(f => f.hp > 0);
    bombs = bombs.filter(b => {
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (Math.hypot(b.x - player.x, b.y - player.y) < b.r + 8) { hurt(); return false; }
      return b.x > -20 && b.x < W + 20 && b.y > -20 && b.y < H + 20;
    });
    if (mode === 'play' && !foes.length && !boss) nextWave();
  }
  function onBeat() {
    const s = speed();
    for (const f of foes) {
      if (f.mode !== 'hold') continue;
      const roll = Math.random();
      if (f.kind === 'tri' && roll < 0.05 * s) { f.mode = 'dive'; const a = Math.atan2(player.y - f.y, player.x - f.x); f.vx = Math.cos(a) * 260 * s; f.vy = Math.max(160, Math.sin(a) * 260 * s); tone(500, 0.2, 'sawtooth', 0.08, 0.4); }
      if (f.kind === 'sq' && roll < 0.1 * s) bombs.push({ x: f.x, y: f.y + 14, vx: 0, vy: 220 * s, r: 6 });
      if (f.kind === 'ci' && roll < 0.04 * s) for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + f.t; bombs.push({ x: f.x, y: f.y, vx: Math.cos(a) * 140 * s, vy: Math.sin(a) * 140 * s, r: 5 }); }
      if (f.kind === 'pr' && roll < 0.08 * s) aimed(f.x, f.y, 260 * s);
    }
    if (boss && boss.y > 100) {
      if (beatNo % 4 === 0) for (let i = 0; i < 14; i++) { const a = i * Math.PI * 2 / 14 + boss.ang; bombs.push({ x: boss.x, y: boss.y, vx: Math.cos(a) * 170 * s, vy: Math.sin(a) * 170 * s, r: 6 }); }
      else if (beatNo % 2 === 0) for (let k = -1; k <= 1; k++) aimed(boss.x, boss.y + 40, 280 * s, k * 0.16);
    }
  }

  // ── draw ──
  const px = v => Math.round(v);
  function poly(x, y, r, n, rot, fill) {
    ctx.beginPath();
    for (let i = 0; i < n; i++) { const a = rot + i * Math.PI * 2 / n; ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * r, y + Math.sin(a) * r); }
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
  }
  function drawFoe(f) {
    const s = 1 + 0.12 * pulse, c = f.flash > 0 ? '#ffffff' : f.biome.color, d = f.biome.dark;
    const x = px(f.x), y = px(f.y);
    if (f.kind === 'tri') { poly(x, y, 17 * s, 3, Math.PI / 2, c); poly(x, y, 7 * s, 3, Math.PI / 2, d); }
    else if (f.kind === 'sq') { ctx.fillStyle = c; ctx.fillRect(x - 15 * s, y - 15 * s, 30 * s, 30 * s); ctx.fillStyle = d; ctx.fillRect(x - 6 * s, y - 6 * s, 12 * s, 12 * s); if (f.hp < 3) { ctx.fillStyle = '#07070F'; ctx.fillRect(x - 15 * s, y - 2, 30 * s * (3 - f.hp) / 3, 3); } }
    else if (f.kind === 'ci') { ctx.beginPath(); ctx.arc(x, y, 15 * s, 0, Math.PI * 2); ctx.fillStyle = c; ctx.fill(); ctx.beginPath(); ctx.arc(x, y, 7 * s, 0, Math.PI * 2); ctx.fillStyle = d; ctx.fill(); ctx.beginPath(); ctx.arc(x, y, 22 * s, time * 2, time * 2 + 2); ctx.strokeStyle = c; ctx.lineWidth = 3; ctx.stroke(); }
    else { poly(x, y, 18 * s, 4, Math.PI / 2, c); poly(x, y - 3, 7 * s, 3, -Math.PI / 2, d); }
  }
  function drawBoss() {
    const b = boss, s = 1 + 0.06 * pulse, c = b.flash > 0 ? '#ffffff' : '#FFD23D';
    ctx.save(); ctx.translate(px(b.x), px(b.y)); ctx.scale(s, s);
    ctx.fillStyle = '#2a2206'; ctx.fillRect(-60, -60, 120, 120);
    ctx.strokeStyle = c; ctx.lineWidth = 7; ctx.strokeRect(-60, -60, 120, 120);
    const open = b.hp < b.max / 2 ? 8 + 4 * Math.sin(time * 4) : 0;            // rage: the locks spring open
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      ctx.save(); ctx.translate(sx * (60 + open), sy * (60 + open)); if (open) ctx.rotate(time * 2 * sx);
      ctx.fillStyle = c; ctx.fillRect(-15, -15, 30, 30); ctx.fillStyle = '#2a2206'; ctx.fillRect(-6, -6, 12, 12); ctx.restore();
    }
    ctx.rotate(b.ang); ctx.fillStyle = c; ctx.fillRect(-24, -24, 48, 48); ctx.fillStyle = '#4a3a08'; ctx.fillRect(-10, -10, 20, 20);
    ctx.restore();
    // its life bar
    const w = Math.min(420, W - 60);
    ctx.fillStyle = '#20293C'; ctx.fillRect(W / 2 - w / 2, 46, w, 10);
    ctx.fillStyle = '#FFD23D'; ctx.fillRect(W / 2 - w / 2, 46, w * Math.max(0, b.hp) / b.max, 10);
    ctx.font = '9px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#FFD23D'; ctx.fillText('THE VAULT', W / 2, 40);
  }
  function drawShip() {
    if (player.inv > 0 && Math.floor(player.inv * 12) % 2) return;
    const x = px(player.x), y = px(player.y);
    ctx.beginPath(); ctx.moveTo(x, y - 20); ctx.lineTo(x + 18, y + 18); ctx.lineTo(x - 18, y + 18); ctx.closePath(); ctx.fillStyle = '#00FDFF'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(x, y - 8); ctx.lineTo(x + 10, y + 13); ctx.lineTo(x - 10, y + 13); ctx.closePath(); ctx.fillStyle = '#003F42'; ctx.fill();
    ctx.fillStyle = '#8CFEFF'; ctx.fillRect(x - 3, y + 4, 6, 6);
    if (!still) { ctx.fillStyle = Math.random() < 0.5 ? '#FFD23D' : '#FF9A30'; ctx.fillRect(x - 4, y + 19, 8, 5 + Math.random() * 7); }
  }
  function text(t, x, y, size, color, align = 'center') { ctx.font = `${size}px "Press Start 2P", monospace`; ctx.textAlign = align; ctx.fillStyle = color; ctx.fillText(t, x, y); }
  function draw() {
    ctx.save();
    if (shake > 0 && !still) ctx.translate((Math.random() - 0.5) * 14 * shake, (Math.random() - 0.5) * 14 * shake);
    ctx.fillStyle = '#07070F'; ctx.fillRect(-20, -20, W + 40, H + 40);
    const biome = BIOMES[(Math.max(1, wave) - 1) % 5] || { dark: '#3a3008' };
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#07070F'); g.addColorStop(1, (biome.dark || '#3a3008') + 'aa');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    stars.forEach(s => { ctx.fillStyle = `rgba(217,255,230,${0.25 + 0.5 * s.z})`; ctx.fillRect(px(s.x * W), px(s.y * H), s.z > 0.8 ? 2 : 1, s.z > 0.8 ? 2 : 1); });
    parts.forEach(p => { ctx.globalAlpha = Math.max(0, p.life * 1.6); ctx.fillStyle = p.color; ctx.fillRect(px(p.x) - 2, px(p.y) - 2, 4, 4); });
    ctx.globalAlpha = 1;
    if (mode !== 'title') {
      foes.forEach(drawFoe);
      if (boss) drawBoss();
      ctx.fillStyle = '#D9FFE6'; shots.forEach(s => ctx.fillRect(px(s.x) - 2, px(s.y) - 8, 4, 14));
      bombs.forEach(b => { ctx.beginPath(); ctx.arc(px(b.x), px(b.y), b.r + pulse * 1.5, 0, Math.PI * 2); ctx.fillStyle = '#FF3D5E'; ctx.fill(); ctx.beginPath(); ctx.arc(px(b.x), px(b.y), b.r * 0.45, 0, Math.PI * 2); ctx.fillStyle = '#FFE0E6'; ctx.fill(); });
      if (mode !== 'over') drawShip();
      // HUD
      text('SCORE ' + String(score).padStart(6, '0'), 16, 26, 11, '#FFD23D', 'left');
      text('WAVE ' + wave, W - 100, 26, 11, '#3DFF8B', 'right');
      for (let i = 0; i < 3; i++) { ctx.fillStyle = i < lives ? '#3DFF8B' : '#20293C'; ctx.fillRect(16 + i * 22, 38, 16, 9); }
      if (muted) text('MUTED', 16, 66, 8, '#7FB096', 'left');
    }
    if (mode === 'banner') {
      const inLoop = (wave - 1) % 5, name = inLoop === 4 ? 'BOSS: THE VAULT' : BIOMES[inLoop].name, col = inLoop === 4 ? '#FFD23D' : BIOMES[inLoop].color;
      text('WAVE ' + wave, W / 2, H / 2 - 18, 14, '#D9FFE6');
      text(name, W / 2, H / 2 + 16, Math.min(20, W / 22), col);
    }
    if (mode === 'title') {
      text('SPACE GAME', W / 2, H / 2 - 70, Math.min(34, W / 12), '#FF3DA6');
      text('WEB DEMO', W / 2, H / 2 - 34, 11, '#3DE8FF');
      const help = touch ? ['DRAG TO MOVE · FIRES BY ITSELF', 'TAP TO START'] : ['MOVE: ARROWS / WASD / MOUSE', 'FIRE: SPACE OR CLICK · M: MUTE', 'PRESS SPACE TO START'];
      help.forEach((l, i) => text(l, W / 2, H / 2 + 14 + i * 26, Math.min(10, W / 40), i === help.length - 1 ? (Math.floor(time * 2) % 2 ? '#3DFF8B' : '#07070F') : '#D9FFE6'));
      text('THE FULL GAME: JAVA + JAVAFX, 33 WAVES, 13 BOSSES', W / 2, H - 40, Math.min(8, W / 60), '#7FB096');
    }
    if (mode === 'over') {
      text('GAME OVER', W / 2, H / 2 - 40, Math.min(30, W / 13), '#FF3D5E');
      text('SCORE ' + score + '   BEST ' + best, W / 2, H / 2, 11, '#FFD23D');
      text(touch ? 'TAP TO PLAY AGAIN' : 'R: AGAIN · ESC: EXIT', W / 2, H / 2 + 34, 10, Math.floor(time * 2) % 2 ? '#3DFF8B' : '#07070F');
    }
    ctx.restore();
  }
  function frame(ms) {
    raf = requestAnimationFrame(frame);
    if (paused) return;
    const dt = last ? Math.min(0.033, (ms - last) / 1000) : 0; last = ms;
    update(dt); draw();
  }
  raf = requestAnimationFrame(frame);
}
