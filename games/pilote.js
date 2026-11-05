// SpinBet Casino · PiloteGame — loaded on demand by games/impl/index.js (index.html).
// ---- games/impl/pilote.js ----
__mods['games/impl/pilote.js'] = (() => {
// Le Pilote (idée du propriétaire) : un avion décolle d'un porte-avions et vole sans fin fixe au-dessus d'une mer
// semée de porte-avions. Il part avec ×1 (la mise) ; sur sa route : des multiplicateurs (×2 à ×10, +5 à +100) qui le
// font monter, et des bombes (÷2 à ÷10, le gain ne descend jamais sous ×1) qui le font descendre. Quand il n'a plus
// d'altitude (ou plus de carburant, 30 objets au plus ≈ 30 s), il se pose là où il est : la mer (tout est perdu) ou un
// porte-avions qui paie le gain ×1, ×2 ou ×5 (doré). Le vol entier est tiré au décollage (flight), puis animé.
// Simulation (20 millions de vols, tools/sim/pilote.js) : voir CLAUDE.md (retour ≈ 95 %).

const { BaseGame, fmtC } = __mods['core/base.js'];
const { EXTRA_THEMES } = __mods['core/music.js'];
const { sfx } = __mods['audio.js'];

/* ===ENGINE */
const A0 = 15, AMAX = 30, UP = 5, DOWN = 4, MAXN = 30, FLOOR = 1, CAP = 1000;
// mul: ×v · add: +v × la mise · div: ÷v (bombe, jamais sous ×FLOOR). Bonus : l'avion monte de UP ; bombe : descend de DOWN.
const ITEMS = [
  { k: 'mul', v: 2, w: 10 }, { k: 'mul', v: 3, w: 3 }, { k: 'mul', v: 5, w: 1 }, { k: 'mul', v: 10, w: 0.25 },
  { k: 'add', v: 5, w: 2 }, { k: 'add', v: 20, w: 0.5 }, { k: 'add', v: 100, w: 0.05 },
  { k: 'div', v: 2, w: 30 }, { k: 'div', v: 3, w: 9 }, { k: 'div', v: 5, w: 3 }, { k: 'div', v: 10, w: 1 },
];
// where the plane comes down: the sea, or a carrier that multiplies the gain
const SHIPS = [{ m: 0, w: 155 }, { m: 1, w: 50 }, { m: 2, w: 25 }, { m: 5, w: 6 }];
const isBomb = (it) => it.k === 'div';
const sum = (a) => a.reduce((x, y) => x + y.w, 0), ITEMS_W = sum(ITEMS), SHIPS_W = sum(SHIPS);
function pick(list, tot) { let r = Math.random() * tot; for (const it of list) { if (r < it.w) return it; r -= it.w; } return list[0]; }
function flight() {
  const steps = [];
  let T = 1, A = A0;
  while (steps.length < MAXN) {
    const it = pick(ITEMS, ITEMS_W), before = A;
    if (isBomb(it)) { T = Math.max(FLOOR, T / it.v); A -= DOWN; } else { T = it.k === 'add' ? T + it.v : T * it.v; A = Math.min(AMAX, A + UP); }
    steps.push({ it, A: before, after: A, T });
    if (A <= 0) break;
  }
  const ship = pick(SHIPS, SHIPS_W).m;
  return { steps, T, ship, fuel: A > 0, ok: ship > 0, pay: ship ? Math.min(CAP, Math.floor(T * ship * 100) / 100) : 0 };
}
/* ===END ENGINE */

const num = (x) => (Math.floor(x * 100 + 1e-9) / 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 });
const label = (it) => ({ add: '+', mul: '×', div: '÷' }[it.k] + num(it.v));
const isBig = (it) => (it.k === 'mul' && it.v >= 5) || (it.k === 'add' && it.v >= 20) || (it.k === 'div' && it.v >= 5);
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const SHIP = { // look of each kind of carrier
  0: { hull: '#334155', deck: '#475569', mark: '', len: 1 }, // departure
  1: { hull: '#475569', deck: '#64748b', mark: '×1', len: 0.8, c: '#e2e8f0' },
  2: { hull: '#1e3a8a', deck: '#334155', mark: '×2', len: 1, c: '#93c5fd' },
  5: { hull: '#92400e', deck: '#b45309', mark: '×5', len: 1.12, c: '#fde047', gold: true },
};
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
        <div class="pi-top"><div class="pi-total"><small>Gain en vol</small><b>×1</b><em>0 </em></div><div class="pi-road"><i></i><span>⛽</span></div></div>
        <div class="pi-alt"><small>Altitude</small><div class="pi-bars">${Array.from({ length: 6 }, (_, i) => `<i data-a="${6 - i}"></i>`).join('')}</div></div>
        <div class="pi-say">Prends les multiplicateurs, évite les bombes… et pose-toi sur un porte-avions !</div></div>`,
      hello: 'Choisis ta mise et appuie sur DÉCOLLER.',
    });
    this.cv = this.q('.pi-cv'); this.ctx = this.cv.getContext('2d');
    this.state = 'idle'; this.hist = []; this.parts = []; this.texts = []; this.shakeT = 0; this.ships = []; this.decoys = []; this.jy = 0; this.jv = 0; this.ja = 0;
    this.clouds = Array.from({ length: 16 }, (_, i) => ({ x: i * 240 + Math.random() * 200, y: 0.08 + Math.random() * 0.42, s: 0.6 + Math.random() * 0.9, p: 0.25 + Math.random() * 0.45 }));
    this.onResize = () => this.resize();
    addEventListener('resize', this.onResize);
    this.resize();
    this.paintHud(1, A0, 0);
  }

  destroy() {
    // the player leaves during a flight that was going to land on a carrier: its win is paid all the same
    if (this.state === 'fly' && this.f?.ok && !this.paid) { this.paid = true; const c = Math.floor(this.stake * this.f.pay); if (c > 0) this.win(c); }
    cancelAnimationFrame(this.raf); removeEventListener('resize', this.onResize); super.destroy();
  }

  /* ---------- geometry ---------- */
  resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2), W = this.cv.clientWidth || 360, H = this.cv.clientHeight || 320;
    this.cv.width = Math.round(W * dpr); this.cv.height = Math.round(H * dpr);
    const s = Math.max(0.7, Math.min(1.7, Math.min(H / 430, W / 380)));
    Object.assign(this, { dpr, W, H, s });
    this.seaY = H * 0.82; this.deckY = this.seaY - 24 * s; this.topY = H * 0.17;
    this.SP = Math.max(170 * s, Math.min(W * 0.3, 250 * s)); this.CL = 300 * s;
    if (this.state !== 'fly' && !this.f) this.idle();
  }
  yOf(A) { const lo = this.deckY - 30 * this.s; return lo - (Math.max(0, A) / AMAX) * (lo - this.topY); }
  len(m) { return this.CL * SHIP[m].len; }

  // the plane waiting on the departure deck
  idle() {
    this.plane = { x: -this.CL * 0.72, y: this.deckY, ang: 0, on: false };
    this.camX = this.plane.x - this.W * 0.3;
    this.items = []; this.decoys = []; this.ships = [{ x: -this.CL, m: 0 }];
    this.draw();
  }

  // The flight becomes a chain of segments (position, duration) with an event at the end of each one, and the sea
  // gets its carriers: some passed on the way, and at the landing spot the one that was drawn (or none).
  plan(f) {
    const segs = [], S = this.SP, s = this.s, sp = this.turbo ? 0.55 : 1;
    const add = (x1, y1, dur, ev, kind = 'fly') => { const p = segs.length ? segs[segs.length - 1] : { x1: this.plane.x, y1: this.plane.y }; segs.push({ x0: p.x1, y0: p.y1, x1, y1, dur: dur * sp, ev, kind }); };
    add(0, this.deckY, 1.25, { t: 'lift' }, 'run');
    let slow = 1;
    f.steps.forEach((st, i) => {
      let d = (i ? 0.95 : 1.05) * slow;
      if (st.A <= DOWN) d *= 1.3; // slow motion when one more bomb would bring the plane down
      if (isBig(st.it)) d *= 1.2;
      add(S * (i + 1), this.yOf(st.A), d, { t: 'item', i });
      slow = isBomb(st.it) ? 1.35 : 1;
    });
    // Near misses (only for the show, the flight is already drawn): between two items, a bomb the plane skims past
    // or a multiplier it misses by a hair, just above or below its path.
    const decoys = [], dz = [['div', 2, 4], ['div', 3, 3], ['div', 5, 2], ['div', 10, 1.6], ['mul', 2, 2], ['mul', 3, 1.6], ['mul', 5, 1.5], ['mul', 10, 1.4], ['add', 100, 1]];
    const dzW = dz.reduce((a, d) => a + d[2], 0);
    segs.forEach((sg) => {
      if (sg.ev.t !== 'item' || sg.ev.i === 0 || Math.random() > 0.6) return;
      const k = 0.35 + Math.random() * 0.3, x = sg.x0 + (sg.x1 - sg.x0) * k, y0 = sg.y0 + (sg.y1 - sg.y0) * ease(k);
      let off = (36 + Math.random() * 22) * s * (Math.random() < 0.5 ? -1 : 1), y = y0 + off;
      if (y < this.topY - 10 * s || y > this.deckY - 50 * s) y = y0 - off;
      let r = Math.random() * dzW, d = dz[0]; for (const z of dz) { if (r < z[2]) { d = z; break; } r -= z[2]; }
      decoys.push({ x, y, it: { k: d[0], v: d[1] }, t: Math.random() * 6, passed: false, fade: 1, below: y > y0 });
    });
    this.decoys = decoys;
    const n = f.steps.length, xl = S * n + S * 1.2; // touchdown point
    this.xl = xl;
    add(xl, f.ok ? this.deckY : this.seaY + 14 * s, f.fuel ? 2.4 : 1.7, { t: 'touch' }, f.ok ? 'land' : 'fall');
    if (f.ok) add(xl + this.len(f.ship) * 0.55, this.deckY, 0.9, { t: 'stop' }, 'brake');
    // carriers on the sea
    const ships = [{ x: -this.CL, m: 0 }], kinds = [1, 1, 1, 2, 2, 5];
    const zone = f.ok ? [xl - this.len(f.ship) * 0.15, xl + this.len(f.ship) * 0.85] : [xl - 60 * s, xl + 60 * s];
    if (f.ok) ships.push({ x: zone[0], m: f.ship, goal: true });
    else if (Math.random() < 0.6) { const m = kinds[Math.floor(Math.random() * kinds.length)]; ships.push({ x: xl + (40 + Math.random() * 50) * s, m }); } // missed by a hair
    for (let x = S * 1.2; x < xl + S * 6; x += S * (1.4 + Math.random() * 1.8)) {
      const m = kinds[Math.floor(Math.random() * kinds.length)], L = this.len(m);
      if (x + L > zone[0] - 40 * s && x < zone[1] + 40 * s) continue;
      if (ships.some((o) => x < o.x + this.len(o.m) + 30 * s && x + L > o.x - 30 * s)) continue;
      ships.push({ x, m });
    }
    this.ships = ships;
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
      this.f = null; this.idle();
      this.f = f; this.state = 'fly'; this.done = resolve; this.stake = this.bet; this.paid = false;
      this.jy = 0; this.jv = 0; this.ja = 0;
      this.segs = this.plan(f); this.si = 0; this.st = 0; this.T = 1; this.A = A0; this.k = 0;
      this.items = f.steps.map((st, i) => ({ x: this.SP * (i + 1), y: this.yOf(st.A), it: st.it, hit: false, t: Math.random() * 6 }));
      this.slotEl.classList.remove('pi-won', 'pi-lost');
      this.setLast(0); this.winAmt.textContent = '';
      this.say('🛫 Décollage !');
      this.msg(`Mise ${fmtC(this.bet)} · bon vol !`);
      this.paintHud(1, A0, 0);
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
    while (seg && this.st >= seg.dur) { this.st -= seg.dur; this.event(seg.ev, seg); this.si++; seg = this.segs[this.si]; if (this.state !== 'fly') return; }
    if (!seg) return;
    const k = this.st / seg.dur, p = this.plane;
    const kx = seg.kind === 'run' ? k * k : seg.kind === 'brake' ? 1 - (1 - k) ** 2 : k;
    const ky = seg.kind === 'fall' || seg.kind === 'land' ? k * (2 - k) * 0.35 + k * k * 0.65 : ease(k);
    const nx = seg.x0 + (seg.x1 - seg.x0) * kx, ny = seg.y0 + (seg.y1 - seg.y0) * ky;
    const ang = seg.kind === 'run' || seg.kind === 'brake' ? 0 : Math.atan2(ny - p.y, Math.max(0.5, nx - p.x));
    p.ang += (Math.max(-0.6, Math.min(0.9, ang)) - p.ang) * Math.min(1, dt * 8);
    p.x = nx; p.y = ny; p.on = seg.kind !== 'brake';
    if (seg.kind !== 'run' && seg.kind !== 'brake' && Math.random() < dt * 30) this.parts.push({ x: p.x - 30 * this.s, y: p.y + 2, vx: -20, vy: 0, life: 0.6, max: 0.6, c: 'rgba(255,255,255,.55)', r: 3 + Math.random() * 3 });
    for (const d of this.decoys) if (!d.passed && p.x >= d.x) this.nearMiss(d);
    const want = p.x - this.W * (seg.kind === 'land' || seg.kind === 'fall' || seg.kind === 'brake' ? 0.42 : 0.3);
    this.camX += (want - this.camX) * Math.min(1, dt * 4);
  }

  event(ev) {
    const s = this.s, f = this.f;
    if (ev.t === 'lift') { this.say('Prends les multiplicateurs, évite les bombes !'); return; }
    if (ev.t === 'item') {
      const st = f.steps[ev.i], item = this.items[ev.i], it = st.it, prev = this.T, big = isBig(it);
      item.hit = true; this.k = ev.i + 1;
      this.T = st.T; this.A = st.after;
      if (isBomb(it)) {
        this.boom(item.x, item.y, big ? 60 : 34); this.shakeT = big ? 0.8 : 0.45;
        this.jv += (big ? 620 : 460) * s; this.ja += big ? 0.7 : 0.45; // the blast knocks the plane down, it bounces back
        this.text(item.x, item.y - 30 * s, label(it), '#f87171', big ? 44 : 32);
        if (big) this.flash('rgba(239,68,68,.45)');
        sfx.puff();
        const what = `${label(it)} : ×${num(prev)} → ×${num(this.T)}`;
        this.say(st.after <= 0 ? `💥 ${what}… l’avion n’a plus d’altitude, il descend !` : `${big && prev >= 10 ? '😱' : '💥'} ${what}${st.after <= DOWN ? ' · ⚠️ encore une bombe et il descend !' : ''}`);
        if (st.after > 0 && st.after <= DOWN) sfx.tease();
      } else {
        const mul = it.k === 'mul';
        this.jv -= (big ? 520 : 360) * s; this.ja -= 0.3; // the bonus lifts the plane with a jump
        this.burst(item.x, item.y, mul ? ['#f0abfc', '#c084fc', '#fff'] : ['#fde047', '#fbbf24', '#fff'], big ? 70 : 30);
        this.text(item.x, item.y - 30 * s, label(it), mul ? '#f0abfc' : '#fde047', big ? 48 : 34);
        if (big) { this.flash(mul ? 'rgba(217,70,239,.4)' : 'rgba(250,204,21,.45)'); this.shakeT = 0.35; sfx.feature(); } else if (mul) sfx.upgrade(); else sfx.coin();
        this.say(`${big ? '🤑 ÉNORME ! ' : '✨ '}${label(it)} : ×${num(this.T)} à bord${st.A <= DOWN ? ' · l’avion remonte !' : ''}`);
      }
      this.paintHud(this.T, this.A, this.k);
      if (ev.i === f.steps.length - 1) setTimeout(() => {
        if (this.dead || this.state !== 'fly') return;
        this.say(f.fuel ? '⛽ Réservoir vide ! L’avion plane… porte-avions ou mer ?' : '⬇️ L’avion descend… porte-avions ou mer ?');
        sfx.tease();
      }, 700);
      return;
    }
    if (ev.t === 'touch') {
      if (!f.ok) { this.splash(this.plane.x, this.seaY); this.shakeT = 0.5; sfx.huff(); return this.end(false); }
      this.burst(this.plane.x, this.deckY, ['#cbd5e1', '#fff'], 14); sfx.land();
      this.say(`🛬 Porte-avions <b>×${f.ship}</b> ! Le crochet attrape le câble…`);
      return;
    }
    if (ev.t === 'stop') return this.end(true);
  }

  end(ok) {
    const f = this.f;
    this.state = 'over';
    const won = ok ? Math.floor(this.stake * f.pay) : 0;
    this.paid = true;
    this.hist.unshift(ok ? f.pay : -1); this.hist = this.hist.slice(0, 12);
    this.q('.pi-hist').innerHTML = this.hist.map((x) => (x < 0 ? '<span class="lo">🌊</span>' : `<span class="${x < 2 ? 'lo' : x < 10 ? 'mid' : 'hi'}">×${num(x)}</span>`)).join('');
    if (ok) {
      this.slotEl.classList.add('pi-won');
      if (won > 0) this.win(won);
      this.setLast(won);
      this.say(`🛬 Posé sur le porte-avions ×${f.ship} ! ×${num(f.T)}${f.ship > 1 ? ` × ${f.ship}` : ''} = <b>×${num(f.pay)}</b> → <b>${fmtC(won)}</b>`);
      this.msg(`Gain : ${fmtC(won)} (×${num(f.pay)})`);
      if (f.ship >= 5) this.flash('rgba(250,204,21,.5)');
      for (let i = 0; i < 3; i++) setTimeout(() => this.burst(this.plane.x + (i - 1) * 40, this.deckY - 30, f.ship >= 5 ? ['#fde047', '#f59e0b', '#fff'] : ['#4ade80', '#fde047', '#fff'], 22), i * 160);
    } else {
      this.slotEl.classList.add('pi-lost');
      this.flash('rgba(56,189,248,.45)');
      this.say(`🌊 Plouf ! L’avion finit dans la mer avec ×${num(f.T)} à bord.`);
      this.msg(`Perdu · mise ${fmtC(this.stake)}`);
      this.setLast(0);
    }
    this.paintHud(ok ? f.pay : f.T, Math.max(0, this.A), this.k);
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
    this.q('.pi-total b').textContent = `×${num(T)}`;
    this.q('.pi-total em').textContent = fmtC(Math.floor((this.state === 'idle' ? this.bet : this.stake || this.bet) * T));
    const box = this.q('.pi-total'); box.classList.remove('bump'); void box.offsetWidth; box.classList.add('bump');
    const bars = Math.ceil(Math.max(0, A) / (AMAX / 6));
    this.qa('.pi-bars i').forEach((i) => { const a = +i.dataset.a; i.classList.toggle('on', a <= bars); i.classList.toggle('danger', A <= DOWN && a <= bars); });
    this.q('.pi-road i').style.width = `${Math.round((1 - k / MAXN) * 100)}%`;
    this.q('.pi-scene').classList.toggle('low', this.state === 'fly' && A > 0 && A <= DOWN);
  }
  onBetChange() { if (this.state !== 'fly') this.paintHud(1, A0, 0); }

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
    // the plane's bounce after a hit: a damped spring
    for (let i = 0; i < 2; i++) { const h = dt / 2; this.jv += (-160 * this.jy - 11 * this.jv) * h; this.jy += this.jv * h; this.ja += -this.ja * 7 * h; }
    for (const d of this.decoys) if (d.passed) d.fade = Math.max(0, d.fade - dt * (isBomb(d.it) ? 0.5 : 1.6));
  }

  // the plane passes a decoy: a bomb dodged, or a multiplier missed
  nearMiss(d) {
    d.passed = true;
    const s = this.s, bomb = isBomb(d.it), big = isBig(d.it);
    this.text(d.x, d.y + (d.below ? 34 : -34) * s, bomb ? 'ESQUIVÉ !' : 'RATÉ !', bomb ? '#4ade80' : '#cbd5e1', big ? 28 : 22);
    this.jv += (d.below ? -1 : 1) * 170 * s; // the plane swerves away
    if (bomb) { sfx.tick(); if (big) this.say(`😮‍💨 Bombe ${label(d.it)} esquivée de justesse !`); } else {
      this.burst(d.x, d.y, ['#e2e8f0', '#94a3b8'], 10);
      if (big) { this.say(`😩 Le ${label(d.it)} lui passe sous le nez…`); sfx.tease(); }
    }
  }

  /* ---------- drawing ---------- */
  draw() {
    const g = this.ctx, { W, H, s } = this;
    if (!W || !g) return;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const now = performance.now() / 1000;
    const sky = g.createLinearGradient(0, 0, 0, this.seaY);
    sky.addColorStop(0, '#0b2a6f'); sky.addColorStop(0.55, '#2f6fd6'); sky.addColorStop(1, '#f9b17a');
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,236,170,.9)'; g.beginPath(); g.arc(W * 0.82, this.seaY * 0.32, 26 * s, 0, 6.28); g.fill();
    g.fillStyle = 'rgba(255,236,170,.18)'; g.beginPath(); g.arc(W * 0.82, this.seaY * 0.32, 48 * s, 0, 6.28); g.fill();
    const shake = this.shakeT > 0 ? (Math.random() - 0.5) * 10 * this.shakeT : 0;
    const wide = Math.max(1, W / 1200);
    for (const c of this.clouds) {
      const span = 16 * 240 * wide, x = ((c.x * wide - this.camX * c.p) % span + span) % span - 200;
      if (x > W + 100) continue;
      this.cloud(g, x, c.y * this.seaY, c.s * s);
    }
    g.save(); g.translate(-this.camX + shake, shake * 0.5);
    const L = this.camX - 20, R = this.camX + W + 20;
    const sea = g.createLinearGradient(0, this.seaY, 0, H);
    sea.addColorStop(0, '#1e6fb8'); sea.addColorStop(1, '#062a4f');
    g.fillStyle = sea; g.fillRect(L, this.seaY, R - L, H - this.seaY + 10);
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1.5;
    for (let row = 0; row < 4; row++) {
      const y = this.seaY + 6 + row * (H - this.seaY) / 4.5, x0 = Math.floor(L / 24) * 24;
      g.beginPath();
      for (let x = x0; x < R; x += 24) { const yy = y + Math.sin(x * 0.05 + now * 2 + row) * 2; if (x === x0) g.moveTo(x, yy); else g.lineTo(x, yy); }
      g.globalAlpha = 0.5 - row * 0.1; g.stroke(); g.globalAlpha = 1;
    }
    for (const sh of this.ships) if (sh.x < R + 40 && sh.x + this.len(sh.m) > L - 40) this.carrier(g, sh, now);
    for (const d of this.decoys) if (d.fade > 0 && d.x > L - 60 && d.x < R + 60) { g.globalAlpha = d.fade; this.item(g, d, now); g.globalAlpha = 1; }
    for (const it of this.items) if (!it.hit && it.x > L - 60 && it.x < R + 60) this.item(g, it, now);
    for (const p of this.parts) if (p.smoke) { g.globalAlpha = Math.max(0, p.life / p.max) * 0.7; g.fillStyle = p.c; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 6.28); g.fill(); }
    g.globalAlpha = 1;
    if (!(this.state === 'over' && this.f && !this.f.ok)) this.planeDraw(g);
    for (const p of this.parts) if (!p.smoke) { g.globalAlpha = Math.max(0, p.life / p.max); g.fillStyle = p.c; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 6.28); g.fill(); }
    g.globalAlpha = 1;
    for (const t of this.texts) { g.globalAlpha = Math.min(1, t.life * 1.5); say2(g, t.t, t.x, t.y, t.size, t.c, 'rgba(0,0,0,.55)'); }
    g.globalAlpha = 1;
    g.restore();
  }

  cloud(g, x, y, k) {
    g.fillStyle = 'rgba(255,255,255,.75)';
    g.beginPath(); g.ellipse(x, y, 46 * k, 15 * k, 0, 0, 6.28); g.ellipse(x - 26 * k, y + 4 * k, 26 * k, 11 * k, 0, 0, 6.28); g.ellipse(x + 22 * k, y - 6 * k, 30 * k, 14 * k, 0, 0, 6.28); g.fill();
  }

  carrier(g, sh, now) {
    const { s, deckY, seaY } = this, look = SHIP[sh.m], CL = this.len(sh.m), x0 = sh.x, x1 = x0 + CL;
    g.fillStyle = look.hull;
    g.beginPath(); g.moveTo(x0 - 10 * s, deckY); g.lineTo(x1 + 26 * s, deckY); g.lineTo(x1 - 6 * s, seaY + 12 * s); g.lineTo(x0 + 14 * s, seaY + 12 * s); g.closePath(); g.fill();
    g.fillStyle = look.gold ? '#fde047' : '#b91c1c'; g.fillRect(x0 + 10 * s, seaY + 2 * s, CL - 14 * s, 6 * s);
    g.fillStyle = look.deck; g.fillRect(x0 - 10 * s, deckY - 5 * s, CL + 36 * s, 6 * s);
    g.strokeStyle = look.gold ? 'rgba(254,240,138,.9)' : 'rgba(255,255,255,.75)'; g.lineWidth = 1.6 * s; g.setLineDash([10 * s, 8 * s]);
    g.beginPath(); g.moveTo(x0, deckY - 2 * s); g.lineTo(x1 + 20 * s, deckY - 2 * s); g.stroke(); g.setLineDash([]);
    const ix = sh.m ? x0 + CL * 0.72 : x0 + CL * 0.2;
    g.fillStyle = look.gold ? '#d97706' : '#64748b'; g.fillRect(ix, deckY - 46 * s, 30 * s, 41 * s); g.fillRect(ix + 6 * s, deckY - 62 * s, 16 * s, 16 * s);
    g.fillStyle = '#93c5fd'; for (let i = 0; i < 3; i++) g.fillRect(ix + 4 * s + i * 8 * s, deckY - 40 * s, 5 * s, 6 * s);
    g.strokeStyle = '#94a3b8'; g.lineWidth = 2; g.beginPath(); g.moveTo(ix + 14 * s, deckY - 62 * s); g.lineTo(ix + 14 * s, deckY - 82 * s); g.stroke();
    g.fillStyle = sh.m ? (look.gold ? '#fde047' : '#22c55e') : '#3b82f6';
    g.beginPath(); g.moveTo(ix + 14 * s, deckY - 82 * s); g.lineTo(ix + (28 + Math.sin(now * 6) * 2) * s, deckY - 78 * s); g.lineTo(ix + 14 * s, deckY - 74 * s); g.fill();
    if (!sh.m) return;
    const nL = Math.max(3, Math.floor(CL / (22 * s)) - 4);
    for (let i = 0; i < nL; i++) { const on = (Math.floor(now * 6) + i) % 6 < 2; g.fillStyle = on ? (look.gold ? '#fde047' : '#4ade80') : look.gold ? 'rgba(253,224,71,.25)' : 'rgba(74,222,128,.25)'; g.beginPath(); g.arc(x0 + 10 * s + i * 20 * s, deckY - 7 * s, 2.6 * s, 0, 6.28); g.fill(); }
    // the carrier's multiplier, painted big on the hull
    if (look.gold) { g.shadowColor = '#fde047'; g.shadowBlur = 16 * s; }
    say2(g, look.mark, x0 + CL * 0.36, deckY + 15 * s, 19 * s, look.c, 'rgba(0,0,0,.45)');
    g.shadowBlur = 0;
  }

  item(g, it, now) {
    const { s } = this, y = it.y + Math.sin(now * 2.2 + it.t) * 4 * s, k = it.it.k, r = 19 * s, big = isBig(it.it), lab = label(it.it);
    g.save(); g.translate(it.x, y);
    if (big) g.scale(1.3, 1.3);
    if (k === 'div') {
      if (big) { g.shadowColor = '#ef4444'; g.shadowBlur = 22 * s; }
      g.strokeStyle = '#0f172a'; g.lineWidth = 3 * s;
      for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.28 + now * 0.6; g.beginPath(); g.moveTo(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8); g.lineTo(Math.cos(a) * r * 1.25, Math.sin(a) * r * 1.25); g.stroke(); }
      const gr = g.createRadialGradient(-r * 0.3, -r * 0.3, 2, 0, 0, r);
      gr.addColorStop(0, '#64748b'); gr.addColorStop(1, '#0f172a');
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r, 0, 6.28); g.fill(); g.shadowBlur = 0;
      g.fillStyle = Math.floor(now * 4 + it.t) % 2 ? '#ef4444' : '#7f1d1d'; g.beginPath(); g.arc(0, -r * 0.35, 4 * s, 0, 6.28); g.fill();
      const tw = (lab.length * 8 + 12) * s;
      g.fillStyle = '#dc2626'; g.beginPath(); if (g.roundRect) g.roundRect(-tw / 2, r + 3 * s, tw, 17 * s, 4 * s); else g.rect(-tw / 2, r + 3 * s, tw, 17 * s); g.fill();
      say2(g, lab, 0, r + 11.5 * s, 13 * s, '#fff');
    } else {
      const mul = k === 'mul';
      if (big) { g.strokeStyle = mul ? 'rgba(240,171,252,.7)' : 'rgba(253,224,71,.75)'; g.lineWidth = 3 * s; for (let i = 0; i < 12; i++) { const a = (i / 12) * 6.28 + now; g.beginPath(); g.moveTo(Math.cos(a) * r * 1.3, Math.sin(a) * r * 1.3); g.lineTo(Math.cos(a) * r * 1.75, Math.sin(a) * r * 1.75); g.stroke(); } }
      g.shadowColor = mul ? '#e879f9' : '#fbbf24'; g.shadowBlur = (big ? 30 : 18) * s;
      const gr = g.createRadialGradient(-r * 0.3, -r * 0.35, 2, 0, 0, r * 1.1);
      gr.addColorStop(0, mul ? '#fae8ff' : '#fef9c3'); gr.addColorStop(0.5, mul ? '#d946ef' : '#facc15'); gr.addColorStop(1, mul ? '#6b21a8' : '#a16207');
      g.fillStyle = gr; g.beginPath();
      if (mul) { for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i / 10) * 6.28, rr = i % 2 ? r * 0.55 : r * 1.15; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.closePath(); } else g.arc(0, 0, r, 0, 6.28);
      g.fill(); g.shadowBlur = 0;
      if (!mul) { g.strokeStyle = 'rgba(120,53,15,.7)'; g.lineWidth = 2 * s; g.beginPath(); g.arc(0, 0, r * 0.78, 0, 6.28); g.stroke(); }
      g.fillStyle = mul ? '#fff' : '#78350f'; g.font = `900 ${(lab.length > 3 ? 10 : 13) * s}px KeCoin, Archivo, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(lab, 0, 1 * s);
    }
    g.restore();
  }

  planeDraw(g) {
    const { s } = this, p = this.plane;
    g.save(); g.translate(p.x, p.y - 9 * s + this.jy); g.rotate(p.ang + this.ja); g.scale(s, s);
    if (p.on) {
      g.fillStyle = `rgba(253,186,116,${0.6 + Math.random() * 0.4})`;
      g.beginPath(); g.moveTo(-30, -2); g.lineTo(-44 - Math.random() * 10, 1); g.lineTo(-30, 4); g.fill();
    }
    g.fillStyle = '#1e293b'; g.beginPath(); g.moveTo(-4, 2); g.lineTo(14, 2); g.lineTo(-6, 16); g.lineTo(-16, 16); g.closePath(); g.fill();
    g.fillStyle = '#f8fafc'; g.beginPath(); g.moveTo(34, 1); g.quadraticCurveTo(30, -8, 14, -8); g.lineTo(-26, -6); g.lineTo(-32, -1); g.lineTo(-26, 6); g.lineTo(18, 7); g.quadraticCurveTo(32, 6, 34, 1); g.fill();
    g.fillStyle = '#2563eb'; g.fillRect(-24, 0, 44, 3);
    g.fillStyle = '#0ea5e9'; g.beginPath(); g.moveTo(26, -3); g.quadraticCurveTo(22, -11, 10, -10); g.lineTo(12, -4); g.closePath(); g.fill();
    g.fillStyle = '#dc2626'; g.beginPath(); g.moveTo(-18, -6); g.lineTo(-30, -24); g.lineTo(-34, -24); g.lineTo(-30, -4); g.closePath(); g.fill();
    g.fillStyle = '#fde047'; g.font = '900 9px Archivo, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('S', -28, -14);
    g.fillStyle = '#334155'; g.beginPath(); g.moveTo(6, 3); g.lineTo(-10, 3); g.lineTo(-20, 13); g.lineTo(-10, 13); g.closePath(); g.fill();
    g.restore();
  }

  info() {
    const pct = (w, t) => `${Math.round((w / t) * 1000) / 10} %`;
    return this.rules(`<h4>Comment jouer</h4><p>Choisis ta mise et appuie sur <b>DÉCOLLER</b>. L’avion part avec <b>×1</b> (ta mise) et vole au-dessus de la mer, sans fin fixe : il traverse ce qu’il rencontre jusqu’à ce qu’il n’ait plus d’altitude.</p>
      <ul class="rules"><li><b>Étoiles et pièces</b> : ×2, ×3, ×5, ×10, +5, +20 ou +100 sur le gain en vol. L’avion remonte.</li>
      <li><b>Bombes</b> : ÷2, ÷3, ÷5 ou ÷10 sur le gain (il ne descend jamais sous ×1). L’avion descend.</li>
      <li><b>L’atterrissage</b> : quand l’avion n’a plus d’altitude (ou plus de carburant, au bout de ${MAXN} objets), il se pose là où il est. Dans la mer, la mise est perdue. Sur un porte-avions, tu gagnes le gain en vol multiplié par le porte-avions : <b>×1</b>, <b>×2</b> ou <b>×5</b> (doré).</li></ul>
      <p>Gain maximum : ×${num(CAP)} la mise.</p>
      <h4>Chances</h4><p>${ITEMS.map((it) => `${label(it)} : ${pct(it.w, ITEMS_W)}`).join(' · ')}</p>
      <p>Arrivée : ${SHIPS.map((sh) => `${sh.m ? `porte-avions ×${sh.m}` : 'mer'} ${pct(sh.w, SHIPS_W)}`).join(' · ')}</p>
      <h4>Équité</h4><p>Chaque vol est tiré au hasard au décollage. Sur des millions de vols simulés, le retour au joueur est d’environ 95 %.</p>`);
  }
}

return { PiloteGame };
})();
