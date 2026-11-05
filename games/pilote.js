// SpinBet Casino · PiloteGame — loaded on demand by games/impl/index.js (index.html).
// ---- games/impl/pilote.js ----
__mods['games/impl/pilote.js'] = (() => {
// Le Pilote (idée du propriétaire) : un avion décolle d'un porte-avions et traverse le ciel. Sur sa route, N objets :
// des bonus (+0,1 à +3 × la mise, ou ×2 / ×5 sur ce qui est déjà ramassé) qui le font monter d'un cran, et des
// bombes qui divisent le gain par 2, le ralentissent et le font descendre de 2 crans. S'il touche la mer (altitude 0),
// tout est perdu ; s'il tient jusqu'au bout, il se pose sur le porte-avions d'arrivée et paie ce qu'il a ramassé.
// Le vol entier est tiré au départ (flight), puis animé. Simulation (10 millions de vols, tools/sim/pilote.js) :
// retour ≈ 95,0 %, atterrissage 55 % des vols, ≥ ×1 32 %, ≥ ×10 un vol sur 210, gain plafonné à ×500.

const { BaseGame, fmtC } = __mods['core/base.js'];
const { EXTRA_THEMES } = __mods['core/music.js'];
const { sfx } = __mods['audio.js'];

/* ===ENGINE */
const N = 10, A0 = 3, AMAX = 6, DROP = 2, CAP = 500;
const ITEMS = [
  { k: 'add', v: 0.1, w: 30 }, { k: 'add', v: 0.25, w: 18 }, { k: 'add', v: 0.5, w: 9 }, { k: 'add', v: 1, w: 4 }, { k: 'add', v: 3, w: 1.2 },
  { k: 'mul', v: 2, w: 5 }, { k: 'mul', v: 5, w: 0.6 }, { k: 'bomb', v: 2, w: 31.5 },
];
const TOTAL_W = ITEMS.reduce((a, b) => a + b.w, 0);
function pick() { let r = Math.random() * TOTAL_W; for (const it of ITEMS) { if (r < it.w) return it; r -= it.w; } return ITEMS[0]; }
// One flight: the items met (with the altitude before each one and the total after it), and how it ends.
function flight() {
  const steps = [];
  let T = 0, A = A0;
  for (let i = 0; i < N; i++) {
    const it = pick(), before = A;
    if (it.k === 'bomb') { T /= it.v; A -= DROP; } else { T = it.k === 'add' ? T + it.v : T * it.v; A = Math.min(AMAX, A + 1); }
    steps.push({ it, A: before, after: A, T });
    if (A <= 0) return { steps, T: 0, ok: false };
  }
  return { steps, T: Math.min(CAP, Math.floor(T * 100) / 100), ok: true };
}
/* ===END ENGINE */

const num = (x) => (Math.round(x * 100) / 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 });
const label = (it) => (it.k === 'add' ? `+${num(it.v)}` : it.k === 'mul' ? `×${it.v}` : '÷2');
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
// Canvas text where a leading ÷ is drawn by hand (bar + 2 dots): in many fonts it looks like a +.
function say2(g, t, x, y, size, fill, stroke) {
  g.font = `900 ${size}px KeCoin, Archivo, sans-serif`; g.textAlign = 'left'; g.textBaseline = 'middle';
  const div = t[0] === '÷', rest = div ? t.slice(1) : t, sw = div ? size * 0.62 : 0, gap = div ? size * 0.1 : 0;
  const x0 = x - (sw + gap + g.measureText(rest).width) / 2;
  const sign = () => { g.fillRect(x0, y - size * 0.07, sw, size * 0.14); [-1, 1].forEach((k) => { g.beginPath(); g.arc(x0 + sw / 2, y + k * size * 0.26, size * 0.1, 0, 6.28); g.fill(); }); };
  if (stroke) {
    g.lineWidth = Math.max(3, size * 0.18); g.strokeStyle = stroke; g.lineJoin = 'round';
    if (div) { g.save(); g.fillStyle = stroke; g.fillRect(x0 - size * 0.08, y - size * 0.15, sw + size * 0.16, size * 0.3); [-1, 1].forEach((k) => { g.beginPath(); g.arc(x0 + sw / 2, y + k * size * 0.26, size * 0.19, 0, 6.28); g.fill(); }); g.restore(); }
    g.strokeText(rest, x0 + sw + gap, y);
  }
  g.fillStyle = fill; if (div) sign(); g.fillText(rest, x0 + sw + gap, y);
}

class PiloteGame extends BaseGame {
  constructor(root, game) {
    super(root, game, {
      music: EXTRA_THEMES.pilote, mainLabel: 'DÉCOLLER',
      cls: 'table-game pilote',
      head: '<div class="hist pi-hist"></div>',
      stage: `<div class="pi-scene"><canvas class="pi-cv"></canvas>
        <div class="pi-top"><div class="pi-total"><small>Gain en vol</small><b>×0</b><em>0 </em></div><div class="pi-road"><i></i><span>🛫</span><span>🛬</span></div></div>
        <div class="pi-alt"><small>Altitude</small><div class="pi-bars">${Array.from({ length: AMAX }, (_, i) => `<i data-a="${AMAX - i}"></i>`).join('')}</div></div>
        <div class="pi-say">Ramasse les bonus, évite les bombes… et pose-toi sur le porte-avions !</div></div>`,
      hello: 'Choisis ta mise et appuie sur DÉCOLLER.',
    });
    this.cv = this.q('.pi-cv'); this.ctx = this.cv.getContext('2d');
    this.state = 'idle'; this.hist = []; this.parts = []; this.texts = []; this.shakeT = 0;
    this.clouds = Array.from({ length: 14 }, (_, i) => ({ x: i * 260 + Math.random() * 200, y: 0.08 + Math.random() * 0.42, s: 0.6 + Math.random() * 0.9, p: 0.25 + Math.random() * 0.45 }));
    this.onResize = () => this.resize();
    addEventListener('resize', this.onResize);
    this.resize();
    this.idle();
    this.paintHud(0, A0, 0);
  }

  destroy() {
    // the player leaves during a flight that was going to land: its win is paid all the same
    if (this.state === 'fly' && this.f?.ok && !this.paid) { this.paid = true; const c = Math.floor(this.stake * this.f.T); if (c > 0) this.win(c); }
    cancelAnimationFrame(this.raf); removeEventListener('resize', this.onResize); super.destroy();
  }

  /* ---------- geometry ---------- */
  resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2), W = this.cv.clientWidth || 360, H = this.cv.clientHeight || 320;
    this.cv.width = Math.round(W * dpr); this.cv.height = Math.round(H * dpr);
    Object.assign(this, { dpr, W, H, s: Math.max(0.75, Math.min(1.3, W / 420)) });
    this.seaY = H * 0.8; this.deckY = this.seaY - 26 * this.s; this.topY = H * 0.2;
    this.SP = Math.max(170, W * 0.42); this.CL = Math.min(340, W * 0.75);
    if (this.state !== 'fly') this.idle();
  }
  yOf(A) { return this.deckY - 26 * this.s - (A / AMAX) * (this.deckY - 26 * this.s - this.topY); }
  arrival() { return this.SP * N + this.SP * 1.15; } // stern of the arrival carrier

  // the plane waiting on the departure deck
  idle() {
    this.plane = { x: -this.CL * 0.72, y: this.deckY, ang: 0, on: false };
    this.camX = this.plane.x - this.W * 0.3;
    this.items = []; this.over = null;
    this.draw();
  }

  // The flight becomes a chain of segments (position, duration) with an event at the end of each one.
  plan(f) {
    const segs = [], S = this.SP, sp = this.turbo ? 0.55 : 1;
    const add = (x1, y1, dur, ev, kind = 'fly') => { const p = segs.length ? segs[segs.length - 1] : { x1: this.plane.x, y1: this.plane.y }; segs.push({ x0: p.x1, y0: p.y1, x1, y1, dur: dur * sp, ev, kind }); };
    add(0, this.deckY, 1.25, { t: 'lift' }, 'run'); // run along the deck
    let slow = 1;
    f.steps.forEach((st, i) => {
      add(S * (i + 1), this.yOf(st.A), (i ? 0.92 : 1.05) * slow * (st.A <= DROP ? 1.35 : 1), { t: 'item', i }); // slow motion when the next bomb would be the last
      slow = st.it.k === 'bomb' ? 1.45 : 1; // a bomb slows the plane down
      if (st.after <= 0) add(S * (i + 1) + S * 0.85, this.seaY + 14 * this.s, 1.1, { t: 'sea' }, 'fall');
    });
    if (f.ok) {
      const st = this.arrival();
      add(st + this.CL * 0.18, this.deckY, 1.25 * slow, { t: 'touch' }, 'land');
      add(st + this.CL * 0.58, this.deckY, 0.9, { t: 'stop' }, 'brake');
    }
    return segs;
  }

  /* ---------- play ---------- */
  onMain() {
    if (this.state === 'fly') return;
    this.round(async () => {
      if (!this.pay(this.bet)) return;
      this.lastStake = this.bet;
      await this.fly(flight());
    });
  }

  fly(f) {
    return new Promise((resolve) => {
      this.idle();
      this.f = f; this.state = 'fly'; this.done = resolve; this.stake = this.bet; this.paid = false;
      this.items = f.steps.map((st, i) => ({ x: this.SP * (i + 1), y: this.yOf(st.A), it: st.it, hit: false, t: Math.random() * 6 }));
      this.segs = this.plan(f); this.si = 0; this.st = 0; this.T = 0; this.A = A0; this.k = 0;
      this.slotEl.classList.remove('pi-won', 'pi-lost');
      this.setLast(0); this.winAmt.textContent = '';
      this.say('🛫 Décollage !');
      this.msg(`Mise ${fmtC(this.bet)} · bon vol !`);
      this.paintHud(0, A0, 0);
      sfx.spin();
      this.last = performance.now();
      cancelAnimationFrame(this.raf);
      this.raf = requestAnimationFrame((t) => this.frame(t));
    });
  }

  frame(now) {
    if (this.dead) return;
    const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
    if (this.state === 'fly') this.advance(dt);
    this.tickFx(dt);
    this.draw();
    if (this.state === 'fly' || this.parts.length || this.texts.length || this.shakeT > 0) this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  advance(dt) {
    let seg = this.segs[this.si];
    this.st += dt;
    while (seg && this.st >= seg.dur) { this.st -= seg.dur; this.event(seg.ev); this.si++; seg = this.segs[this.si]; if (this.state !== 'fly') return; }
    if (!seg) return;
    const k = this.st / seg.dur, p = this.plane;
    const kx = seg.kind === 'run' ? k * k : seg.kind === 'brake' ? 1 - (1 - k) ** 2 : k;
    const ky = seg.kind === 'fall' ? k * k : ease(k);
    const nx = seg.x0 + (seg.x1 - seg.x0) * kx, ny = seg.y0 + (seg.y1 - seg.y0) * ky;
    const ang = seg.kind === 'run' || seg.kind === 'brake' ? 0 : Math.atan2(ny - p.y, Math.max(0.5, nx - p.x));
    p.ang += (Math.max(-0.6, Math.min(0.9, ang)) - p.ang) * Math.min(1, dt * 8);
    p.x = nx; p.y = ny; p.on = seg.kind !== 'brake';
    if (seg.kind !== 'run' && seg.kind !== 'brake' && Math.random() < dt * 30) this.parts.push({ x: p.x - 30 * this.s, y: p.y + 2, vx: -20, vy: 0, life: 0.6, max: 0.6, c: 'rgba(255,255,255,.55)', r: 3 + Math.random() * 3 });
    // camera: the plane at a third of the width, the arrival carrier in view at the end
    const want = p.x - this.W * 0.33;
    this.camX += (want - this.camX) * Math.min(1, dt * 4);
  }

  event(ev) {
    const s = this.s;
    if (ev.t === 'lift') { this.say('Ramasse les bonus, évite les bombes !'); return; }
    if (ev.t === 'item') {
      const st = this.f.steps[ev.i], item = this.items[ev.i], it = st.it;
      item.hit = true; this.k = ev.i + 1;
      this.T = Math.min(CAP, Math.floor(st.T * 100 + 1e-9) / 100); this.A = st.after; // as it would be paid
      if (it.k === 'bomb') {
        this.boom(item.x, item.y, 34); this.shakeT = 0.45;
        this.text(item.x, item.y - 30 * s, '÷2', '#f87171', 30);
        sfx.puff();
        this.say(st.after <= 0 ? '💥 Touché ! L’avion pique vers la mer…' : st.after <= DROP ? `💥 Bombe ! ⚠️ Altitude ${st.after} : encore une bombe et c’est la mer !` : `💥 Bombe ! Le gain est divisé par 2 et l’avion descend (altitude ${st.after}).`);
        if (st.after > 0 && st.after <= DROP) sfx.tease();
      } else {
        this.burst(item.x, item.y, it.k === 'mul' ? ['#f0abfc', '#c084fc', '#fff'] : ['#fde047', '#fbbf24', '#fff'], it.k === 'mul' ? 34 : 22);
        this.text(item.x, item.y - 30 * s, label(it), it.k === 'mul' ? '#f0abfc' : '#fde047', it.k === 'mul' ? 32 : 26);
        if (it.k === 'mul') sfx.upgrade(); else sfx.coin();
        this.say(it.k === 'mul' ? `✨ ×${it.v} sur tout le gain !` : `+${num(it.v)} × la mise${st.A <= DROP ? ' · l’avion remonte !' : ''}`);
      }
      this.paintHud(this.T, this.A, this.k);
      if (ev.i === N - 1 && this.f.ok) setTimeout(() => { if (!this.dead && this.state === 'fly') this.say('🛬 Approche finale… le porte-avions est en vue !'); }, 650);
      return;
    }
    if (ev.t === 'sea') {
      const p = this.plane;
      this.splash(p.x, this.seaY);
      this.shakeT = 0.5; sfx.huff();
      return this.end(false);
    }
    if (ev.t === 'touch') { this.burst(this.plane.x, this.deckY, ['#cbd5e1', '#fff'], 14); sfx.land(); this.say('🛬 Toucher… le crochet attrape le câble !'); return; }
    if (ev.t === 'stop') return this.end(true);
  }

  end(ok) {
    this.state = 'over';
    const won = ok ? Math.floor(this.stake * this.f.T) : 0;
    this.paid = true;
    this.hist.unshift(ok ? this.f.T : -1); this.hist = this.hist.slice(0, 12);
    this.q('.pi-hist').innerHTML = this.hist.map((x) => (x < 0 ? '<span class="lo">💥</span>' : `<span class="${x < 1 ? 'lo' : x < 10 ? 'mid' : 'hi'}">×${num(x)}</span>`)).join('');
    if (ok) {
      this.slotEl.classList.add('pi-won');
      if (won > 0) this.win(won);
      this.setLast(won);
      this.say(won > 0 ? `🛬 Posé sur le porte-avions ! Tu gagnes <b>${fmtC(won)}</b> (×${num(this.f.T)})` : '🛬 Posé… mais rien ramassé dans le ciel.');
      this.msg(won > 0 ? `Gain : ${fmtC(won)} (×${num(this.f.T)})` : 'Posé, sans gain');
      for (let i = 0; i < 3; i++) setTimeout(() => this.burst(this.plane.x + (i - 1) * 40, this.deckY - 30, ['#4ade80', '#fde047', '#fff'], 18), i * 160);
    } else {
      this.slotEl.classList.add('pi-lost');
      this.flash('rgba(56,189,248,.45)');
      this.say(`🌊 Plouf ! L’avion est tombé à la mer${this.T > 0 ? ` avec ×${num(this.T)} à bord` : ''}.`);
      this.msg(`Perdu · mise ${fmtC(this.bet)}`);
      this.setLast(0);
    }
    this.paintHud(ok ? this.f.T : this.T, ok ? this.A : 0, this.k);
    const finish = async () => {
      if (ok && won > 0) await this.celebrate(won);
      await this.wait(ok ? 500 : 900);
      this.state = 'idle';
      const r = this.done; this.done = null; r?.();
    };
    finish();
  }

  /* ---------- HUD ---------- */
  say(t) { this.q('.pi-say').innerHTML = t; }
  paintHud(T, A, k) {
    const b = this.q('.pi-total b'), e = this.q('.pi-total em');
    b.textContent = `×${num(T)}`;
    e.textContent = fmtC(Math.floor(this.bet * T));
    const box = this.q('.pi-total'); box.classList.remove('bump'); void box.offsetWidth; box.classList.add('bump');
    this.qa('.pi-bars i').forEach((i) => { const a = +i.dataset.a; i.classList.toggle('on', a <= A); i.classList.toggle('danger', A <= 2 && a <= A); });
    this.q('.pi-road i').style.width = `${Math.round((k / N) * 100)}%`;
    this.q('.pi-scene').classList.toggle('low', this.state === 'fly' && A > 0 && A <= DROP);
  }
  onBetChange() { if (this.state !== 'fly') this.paintHud(0, A0, 0); }

  /* ---------- effects ---------- */
  burst(x, y, cols, n) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, v = 60 + Math.random() * 180; this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, life: 0.9, max: 0.9, c: cols[i % cols.length], r: 2 + Math.random() * 3, g: 220 }); } }
  boom(x, y, n) {
    this.burst(x, y, ['#fb923c', '#f87171', '#fde047'], n);
    for (let i = 0; i < 12; i++) this.parts.push({ x: x + (Math.random() - 0.5) * 20, y, vx: (Math.random() - 0.5) * 40, vy: -20 - Math.random() * 30, life: 1.4, max: 1.4, c: 'rgba(30,41,59,.65)', r: 8 + Math.random() * 10, smoke: true });
  }
  splash(x, y) { for (let i = 0; i < 46; i++) { const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6, v = 120 + Math.random() * 260; this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1.2, max: 1.2, c: i % 3 ? '#e0f2fe' : '#7dd3fc', r: 2 + Math.random() * 4, g: 520 }); } }
  text(x, y, t, c, size) { this.texts.push({ x, y, t, c, size: size * this.s, life: 1.3 }); }
  tickFx(dt) {
    for (const p of this.parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.g) p.vy += p.g * dt; if (p.smoke) p.r += dt * 14; }
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const t of this.texts) { t.life -= dt; t.y -= 38 * dt; }
    this.texts = this.texts.filter((t) => t.life > 0);
    this.shakeT = Math.max(0, this.shakeT - dt);
  }

  /* ---------- drawing ---------- */
  draw() {
    const g = this.ctx, { W, H, s } = this;
    if (!W || !g) return;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const now = performance.now() / 1000;
    // sky and sun
    const sky = g.createLinearGradient(0, 0, 0, this.seaY);
    sky.addColorStop(0, '#0b2a6f'); sky.addColorStop(0.55, '#2f6fd6'); sky.addColorStop(1, '#f9b17a');
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,236,170,.9)'; g.beginPath(); g.arc(W * 0.82, this.seaY * 0.32, 26 * s, 0, 6.28); g.fill();
    g.fillStyle = 'rgba(255,236,170,.18)'; g.beginPath(); g.arc(W * 0.82, this.seaY * 0.32, 48 * s, 0, 6.28); g.fill();
    const shake = this.shakeT > 0 ? (Math.random() - 0.5) * 10 * this.shakeT : 0;
    // clouds (parallax)
    for (const c of this.clouds) {
      const span = 14 * 260, x = ((c.x - this.camX * c.p) % span + span) % span - 200;
      if (x > W + 100) continue;
      this.cloud(g, x, c.y * this.seaY, c.s * s);
    }
    g.save(); g.translate(-this.camX + shake, shake * 0.5);
    // sea
    const L = this.camX - 20, R = this.camX + W + 20;
    const sea = g.createLinearGradient(0, this.seaY, 0, H);
    sea.addColorStop(0, '#1e6fb8'); sea.addColorStop(1, '#062a4f');
    g.fillStyle = sea; g.fillRect(L, this.seaY, R - L, H - this.seaY + 10);
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1.5;
    for (let row = 0; row < 4; row++) {
      const y = this.seaY + 6 + row * (H - this.seaY) / 4.5;
      g.beginPath();
      for (let x = Math.floor(L / 24) * 24; x < R; x += 24) { const yy = y + Math.sin(x * 0.05 + now * 2 + row) * 2; if (x === Math.floor(L / 24) * 24) g.moveTo(x, yy); else g.lineTo(x, yy); }
      g.globalAlpha = 0.5 - row * 0.1; g.stroke(); g.globalAlpha = 1;
    }
    // carriers
    this.carrier(g, -this.CL, false, now);
    this.carrier(g, this.arrival(), true, now);
    // items
    for (const it of this.items) {
      if (it.hit || it.x < L - 60 || it.x > R + 60) continue;
      this.item(g, it, now);
    }
    // particles behind / plane / particles in front
    for (const p of this.parts) if (p.smoke) { g.globalAlpha = Math.max(0, p.life / p.max) * 0.7; g.fillStyle = p.c; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 6.28); g.fill(); }
    g.globalAlpha = 1;
    if (!(this.state === 'over' && this.f && !this.f.ok)) this.planeDraw(g, now);
    for (const p of this.parts) if (!p.smoke) { g.globalAlpha = Math.max(0, p.life / p.max); g.fillStyle = p.c; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 6.28); g.fill(); }
    g.globalAlpha = 1;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const t of this.texts) {
      g.globalAlpha = Math.min(1, t.life * 1.5);
      say2(g, t.t, t.x, t.y, t.size, t.c, 'rgba(0,0,0,.55)');
    }
    g.globalAlpha = 1;
    g.restore();
  }

  cloud(g, x, y, k) {
    g.fillStyle = 'rgba(255,255,255,.75)';
    g.beginPath(); g.ellipse(x, y, 46 * k, 15 * k, 0, 0, 6.28); g.ellipse(x - 26 * k, y + 4 * k, 26 * k, 11 * k, 0, 0, 6.28); g.ellipse(x + 22 * k, y - 6 * k, 30 * k, 14 * k, 0, 0, 6.28); g.fill();
  }

  carrier(g, x0, arrival, now) {
    const { s, CL, deckY, seaY } = this, x1 = x0 + CL;
    // hull
    g.fillStyle = '#334155';
    g.beginPath(); g.moveTo(x0 - 10 * s, deckY); g.lineTo(x1 + 26 * s, deckY); g.lineTo(x1 - 6 * s, seaY + 12 * s); g.lineTo(x0 + 14 * s, seaY + 12 * s); g.closePath(); g.fill();
    g.fillStyle = '#b91c1c'; g.fillRect(x0 + 10 * s, seaY + 2 * s, CL - 14 * s, 6 * s);
    // deck
    g.fillStyle = '#475569'; g.fillRect(x0 - 10 * s, deckY - 5 * s, CL + 36 * s, 6 * s);
    g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 1.6 * s; g.setLineDash([10 * s, 8 * s]);
    g.beginPath(); g.moveTo(x0, deckY - 2 * s); g.lineTo(x1 + 20 * s, deckY - 2 * s); g.stroke(); g.setLineDash([]);
    // island (tower) and its antenna
    const ix = arrival ? x0 + CL * 0.72 : x0 + CL * 0.2;
    g.fillStyle = '#64748b'; g.fillRect(ix, deckY - 46 * s, 30 * s, 41 * s); g.fillRect(ix + 6 * s, deckY - 62 * s, 16 * s, 16 * s);
    g.fillStyle = '#93c5fd'; for (let i = 0; i < 3; i++) g.fillRect(ix + 4 * s + i * 8 * s, deckY - 40 * s, 5 * s, 6 * s);
    g.strokeStyle = '#94a3b8'; g.lineWidth = 2; g.beginPath(); g.moveTo(ix + 14 * s, deckY - 62 * s); g.lineTo(ix + 14 * s, deckY - 82 * s); g.stroke();
    // the flag, and on the arrival carrier the blinking landing lights and the sign
    g.fillStyle = arrival ? '#22c55e' : '#3b82f6';
    g.beginPath(); g.moveTo(ix + 14 * s, deckY - 82 * s); g.lineTo(ix + (28 + Math.sin(now * 6) * 2) * s, deckY - 78 * s); g.lineTo(ix + 14 * s, deckY - 74 * s); g.fill();
    if (arrival) {
      for (let i = 0; i < 6; i++) { const on = (Math.floor(now * 6) + i) % 6 < 2; g.fillStyle = on ? '#4ade80' : 'rgba(74,222,128,.25)'; g.beginPath(); g.arc(x0 + 10 * s + i * 20 * s, deckY - 7 * s, 2.6 * s, 0, 6.28); g.fill(); }
      g.font = `900 ${11 * s}px Archivo, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = '#fde047'; g.fillText('ARRIVÉE', x0 + CL * 0.35, deckY + 12 * s);
    }
  }

  item(g, it, now) {
    const { s } = this, y = it.y + Math.sin(now * 2.2 + it.t) * 4 * s, k = it.it.k, r = 19 * s;
    g.save(); g.translate(it.x, y);
    if (k === 'bomb') {
      g.strokeStyle = '#0f172a'; g.lineWidth = 3 * s;
      for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.28 + now * 0.6; g.beginPath(); g.moveTo(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8); g.lineTo(Math.cos(a) * r * 1.25, Math.sin(a) * r * 1.25); g.stroke(); }
      const gr = g.createRadialGradient(-r * 0.3, -r * 0.3, 2, 0, 0, r);
      gr.addColorStop(0, '#64748b'); gr.addColorStop(1, '#0f172a');
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r, 0, 6.28); g.fill();
      g.fillStyle = Math.floor(now * 4 + it.t) % 2 ? '#ef4444' : '#7f1d1d'; g.beginPath(); g.arc(0, -r * 0.35, 4 * s, 0, 6.28); g.fill();
      g.fillStyle = '#dc2626'; g.beginPath(); if (g.roundRect) g.roundRect(-17 * s, r + 3 * s, 34 * s, 17 * s, 4 * s); else g.rect(-17 * s, r + 3 * s, 34 * s, 17 * s); g.fill();
      say2(g, '÷2', 0, r + 11.5 * s, 13 * s, '#fff');
    } else {
      const mul = k === 'mul';
      g.shadowColor = mul ? '#e879f9' : '#fbbf24'; g.shadowBlur = 18 * s;
      const gr = g.createRadialGradient(-r * 0.3, -r * 0.35, 2, 0, 0, r * 1.1);
      gr.addColorStop(0, mul ? '#fae8ff' : '#fef9c3'); gr.addColorStop(0.5, mul ? '#d946ef' : '#facc15'); gr.addColorStop(1, mul ? '#6b21a8' : '#a16207');
      g.fillStyle = gr; g.beginPath();
      if (mul) { for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i / 10) * 6.28, rr = i % 2 ? r * 0.55 : r * 1.15; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.closePath(); } else g.arc(0, 0, r, 0, 6.28);
      g.fill(); g.shadowBlur = 0;
      if (!mul) { g.strokeStyle = 'rgba(120,53,15,.7)'; g.lineWidth = 2 * s; g.beginPath(); g.arc(0, 0, r * 0.78, 0, 6.28); g.stroke(); }
      g.fillStyle = mul ? '#fff' : '#78350f'; g.font = `900 ${(mul ? 13 : 12) * s}px KeCoin, Archivo, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(label(it.it), 0, 1 * s);
    }
    g.restore();
  }

  planeDraw(g, now) {
    const { s } = this, p = this.plane;
    g.save(); g.translate(p.x, p.y - 9 * s); g.rotate(p.ang); g.scale(s, s);
    if (p.on) { // engine flame
      g.fillStyle = `rgba(253,186,116,${0.6 + Math.random() * 0.4})`;
      g.beginPath(); g.moveTo(-30, -2); g.lineTo(-44 - Math.random() * 10, 1); g.lineTo(-30, 4); g.fill();
    }
    g.fillStyle = '#1e293b'; g.beginPath(); g.moveTo(-4, 2); g.lineTo(14, 2); g.lineTo(-6, 16); g.lineTo(-16, 16); g.closePath(); g.fill(); // far wing
    g.fillStyle = '#f8fafc'; g.beginPath(); g.moveTo(34, 1); g.quadraticCurveTo(30, -8, 14, -8); g.lineTo(-26, -6); g.lineTo(-32, -1); g.lineTo(-26, 6); g.lineTo(18, 7); g.quadraticCurveTo(32, 6, 34, 1); g.fill(); // fuselage
    g.fillStyle = '#2563eb'; g.fillRect(-24, 0, 44, 3); // stripe
    g.fillStyle = '#0ea5e9'; g.beginPath(); g.moveTo(26, -3); g.quadraticCurveTo(22, -11, 10, -10); g.lineTo(12, -4); g.closePath(); g.fill(); // cockpit
    g.fillStyle = '#dc2626'; g.beginPath(); g.moveTo(-18, -6); g.lineTo(-30, -24); g.lineTo(-34, -24); g.lineTo(-30, -4); g.closePath(); g.fill(); // tail fin
    g.fillStyle = '#fde047'; g.font = '900 9px Archivo, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('S', -28, -14);
    g.fillStyle = '#334155'; g.beginPath(); g.moveTo(6, 3); g.lineTo(-10, 3); g.lineTo(-20, 13); g.lineTo(-10, 13); g.closePath(); g.fill(); // near wing
    g.restore();
  }

  info() {
    const tot = TOTAL_W, pct = (w) => `${Math.round((w / tot) * 1000) / 10} %`;
    return this.rules(`<h4>Comment jouer</h4><p>Choisis ta mise et appuie sur <b>DÉCOLLER</b>. L’avion part du porte-avions et traverse le ciel : il rencontre ${N} objets sur sa route.</p>
      <ul class="rules"><li><b>Pièces d’or</b> : +0,1 à +3 fois la mise ajoutés au gain en vol. L’avion monte d’un cran.</li>
      <li><b>Étoiles</b> : ×2 ou ×5 sur tout le gain déjà ramassé. L’avion monte d’un cran.</li>
      <li><b>Bombes</b> : le gain est divisé par 2, l’avion ralentit et descend de 2 crans.</li></ul>
      <p>L’avion part à l’altitude ${A0} (sur ${AMAX}). S’il tombe à 0, il finit dans la mer et la mise est perdue. S’il tient jusqu’au bout, il se pose sur le porte-avions d’arrivée et tu gagnes tout ce qu’il a ramassé (jusqu’à ×${CAP} la mise).</p>
      <h4>Chances de chaque objet</h4><p>${ITEMS.map((it) => `${it.k === 'bomb' ? 'bombe ÷2' : label(it)} : ${pct(it.w)}`).join(' · ')}</p>
      <h4>Équité</h4><p>Chaque vol est tiré au hasard au décollage. Sur des millions de vols simulés, le retour au joueur est d’environ 95 % ; l’avion se pose une fois sur deux environ.</p>`);
  }
}

return { PiloteGame };
})();
