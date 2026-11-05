// SpinBet Casino · PiloteGame — loaded on demand by games/impl/index.js (index.html).
// ---- games/impl/pilote.js ----
__mods['games/impl/pilote.js'] = (() => {
// Le Pilote (idée du propriétaire) : un avion décolle d'un porte-avions et vole sans fin fixe au-dessus d'une mer
// semée de porte-avions. Il part avec ×1 (la mise). Sur sa route : multiplicateurs (×2 à ×10, +5 à +100) qui le font
// monter, bombes (÷2 à ÷10, le gain ne tombe jamais sous ×1) qui le font descendre, boosts (grand saut vers le haut),
// trous d'air (chute d'un coup) et, rarement, le BONUS : tous les porte-avions ×10 jusqu'à la fin du vol. Sans
// altitude (ou sans carburant, 30 objets au plus), il se pose là où il est : la mer (perdu) ou un porte-avions ×1, ×2,
// ×5 (doré) qui multiplie le gain. Le vol entier est tiré au décollage (flight), puis animé sur une trajectoire lisse.
// Simulation : node tools/sim/pilote.js (chiffres dans CLAUDE.md, retour ≈ 97 %, voulu par le propriétaire : le jeu qui rend le plus).

const { BaseGame, fmtC } = __mods['core/base.js'];
const { EXTRA_THEMES } = __mods['core/music.js'];
const { sfx } = __mods['audio.js'];

/* ===ENGINE */
const A0 = 15, AMAX = 30, UP = 5, DOWN = 5, BOOST = 12, POCKET = 9, MAXN = 30, FLOOR = 1, CAP = 1000, BONUS_X = 10;
// mul ×v · add +v × la mise (l'avion monte de UP) · div ÷v (bombe, descend de DOWN, jamais sous ×FLOOR)
// boost : monte de BOOST · pocket (trou d'air) : descend de POCKET · bonus : monte de UP, porte-avions ×BONUS_X
const ITEMS = [
  { k: 'mul', v: 2, w: 3.2 }, { k: 'mul', v: 3, w: 0.96 }, { k: 'mul', v: 5, w: 0.32 }, { k: 'mul', v: 10, w: 0.08 },
  { k: 'add', v: 5, w: 2 }, { k: 'add', v: 20, w: 0.5 }, { k: 'add', v: 100, w: 0.05 },
  { k: 'div', v: 2, w: 18 }, { k: 'div', v: 3, w: 5.4 }, { k: 'div', v: 5, w: 1.8 }, { k: 'div', v: 10, w: 0.6 }, // about half the bombs of before (owner's request)
  { k: 'boost', v: BOOST, w: 4 }, { k: 'pocket', v: POCKET, w: 9 }, { k: 'bonus', v: BONUS_X, w: 0.06 },
];
// where the plane comes down: the sea, or a carrier that multiplies the gain
const SHIPS = [{ m: 0, w: 176 }, { m: 1, w: 50 }, { m: 2, w: 25 }, { m: 5, w: 6 }];
const sum = (a) => a.reduce((x, y) => x + y.w, 0), ITEMS_W = sum(ITEMS), SHIPS_W = sum(SHIPS);
function pick(list, tot) { let r = Math.random() * tot; for (const it of list) { if (r < it.w) return it; r -= it.w; } return list[0]; }
function flight() {
  const steps = [];
  let T = 1, A = A0, bonus = false;
  while (steps.length < MAXN) {
    const it = pick(ITEMS, ITEMS_W), before = A;
    if (it.k === 'div') { T = Math.max(FLOOR, T / it.v); A -= DOWN; } else if (it.k === 'boost') A = Math.min(AMAX, A + BOOST);
    else if (it.k === 'pocket') A -= POCKET;
    else { if (it.k === 'bonus') bonus = true; else T = it.k === 'add' ? T + it.v : T * it.v; A = Math.min(AMAX, A + UP); }
    steps.push({ it, A: before, after: A, T });
    if (A <= 0) break;
  }
  const ship = pick(SHIPS, SHIPS_W).m, m = ship * (bonus ? BONUS_X : 1);
  return { steps, T, ship, bonus, m, fuel: A > 0, ok: ship > 0, pay: m ? Math.min(CAP, Math.floor(T * m * 100) / 100) : 0 };
}
/* ===END ENGINE */

const num = (x) => (Math.floor(x * 100 + 1e-9) / 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 });
const label = (it) => ({ add: '+', mul: '×', div: '÷' }[it.k] || '') + (it.k === 'add' || it.k === 'mul' || it.k === 'div' ? num(it.v) : '');
const isBig = (it) => (it.k === 'mul' && it.v >= 5) || (it.k === 'add' && it.v >= 20) || (it.k === 'div' && it.v >= 5) || it.k === 'bonus';
const SHIP = { // look of each kind of carrier
  0: { hull: '#334155', deck: '#475569', len: 1 }, // departure
  1: { hull: '#475569', deck: '#64748b', len: 0.8, c: '#e2e8f0' },
  2: { hull: '#1e3a8a', deck: '#334155', len: 1, c: '#93c5fd' },
  5: { hull: '#92400e', deck: '#b45309', len: 1.12, c: '#fde047', gold: true },
};
// Monotone cubic (Fritsch–Carlson) through the control points: a smooth path that never overshoots.
function spline(pts) {
  const n = pts.length, xs = pts.map((p) => p.x), ys = pts.map((p) => p.y), d = [], m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (!d[i]) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], h = a * a + b * b;
    if (h > 9) { const t = 3 / Math.sqrt(h); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  let k = 0;
  return (x) => { // [y, dy/dx]
    if (x <= xs[0]) return [ys[0], 0];
    if (x >= xs[n - 1]) return [ys[n - 1], d[n - 2] || 0];
    while (k > 0 && x < xs[k]) k--;
    while (k < n - 2 && x > xs[k + 1]) k++;
    const h = xs[k + 1] - xs[k], t = (x - xs[k]) / h, t2 = t * t, t3 = t2 * t, y0 = ys[k], y1 = ys[k + 1], m0 = m[k] * h, m1 = m[k + 1] * h;
    return [(2 * t3 - 3 * t2 + 1) * y0 + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) * y1 + (t3 - t2) * m1,
      ((6 * t2 - 6 * t) * y0 + (3 * t2 - 4 * t + 1) * m0 + (-6 * t2 + 6 * t) * y1 + (3 * t2 - 2 * t) * m1) / h];
  };
}
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
      opts: [{ id: 'super', icon: '🚀', label: 'Super turbo' }], // faster than the Turbo (owner's request)
      cls: 'table-game pilote',
      head: '<div class="hist pi-hist"></div>',
      stage: `<div class="pi-scene"><canvas class="pi-cv"></canvas>
        <div class="pi-hud"><div class="pi-total"><small>Gain en vol</small><b>×1</b><em>0 </em></div>
          <div class="pi-inst"><small>Altitude</small><b class="pi-altv">0 m<i></i></b><small>Vitesse</small><span class="pi-spd">0 km/h</span><small>Distance</small><span class="pi-dst">0,0 km</span></div></div>
        <div class="pi-fuel"><i></i><span>⛽</span></div>
        <div class="pi-bonus">🌟 BONUS<span> : TOUS LES PORTE-AVIONS</span> ×${BONUS_X}</div>
        <div class="pi-say">Prends les multiplicateurs, évite les bombes… et pose-toi sur un porte-avions !</div></div>`,
      hello: 'Choisis ta mise et appuie sur DÉCOLLER.',
    });
    try { this.superT = localStorage.getItem('spinbet_pilote_super') === '1'; } catch { this.superT = false; }
    this.cv = this.q('.pi-cv'); this.ctx = this.cv.getContext('2d'); this.scene = this.q('.pi-scene');
    this.inst = { box: this.q('.pi-inst'), alt: this.q('.pi-altv'), spd: this.q('.pi-spd'), dst: this.q('.pi-dst'), last: {} };
    this.state = 'idle'; this.hist = []; this.parts = []; this.texts = []; this.shakeT = 0;
    this.ships = []; this.items = []; this.decoys = []; this.lines = [];
    this.jy = 0; this.jv = 0; this.ja = 0; this.spd = 0; this.turbT = 0; this.zoom = 1; this.alarmT = 0; this.clock = 0;
    this.clouds = Array.from({ length: 16 }, (_, i) => ({ x: i * 240 + Math.random() * 200, y: 0.08 + Math.random() * 0.42, s: 0.6 + Math.random() * 0.9, p: 0.25 + Math.random() * 0.45 }));
    this.near = Array.from({ length: 4 }, (_, i) => ({ x: i * 700 + Math.random() * 400, y: 0.15 + Math.random() * 0.5, s: 1.4 + Math.random() * 0.8 })); // clouds in front of the plane
    this.onResize = () => this.resize();
    addEventListener('resize', this.onResize);
    this.resize();
    this.paintHud(1, 0);
    this.instruments(0);
  }

  destroy() {
    // the player leaves during a flight that was going to land on a carrier: its win is paid all the same
    if (this.state === 'fly' && this.f?.ok && !this.paid) { this.paid = true; const c = Math.floor(this.stake * this.f.pay); if (c > 0) this.win(c); }
    if (this.bonusOn) dispatchEvent(new CustomEvent('sb:featureend', { detail: { game: this.game.id } }));
    cancelAnimationFrame(this.raf); removeEventListener('resize', this.onResize); super.destroy();
  }

  // Super turbo, in « Bonus & menu »: the flight goes about 3 times faster than normal (Turbo: 1,7 times)
  optOn(id) { return id === 'super' && this.superT; }
  onOpt(id) {
    if (id !== 'super') return;
    this.superT = !this.superT;
    try { localStorage.setItem('spinbet_pilote_super', this.superT ? '1' : '0'); } catch { /* private mode */ }
  }

  /* ---------- geometry ---------- */
  resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2), W = this.cv.clientWidth || 360, H = this.cv.clientHeight || 320;
    this.cv.width = Math.round(W * dpr); this.cv.height = Math.round(H * dpr);
    const s = Math.max(0.7, Math.min(1.7, Math.min(H / 430, W / 380)));
    Object.assign(this, { dpr, W, H, s });
    this.seaY = H * 0.84; this.deckY = this.seaY - 24 * s; this.topY = H * 0.2; this.lo = this.deckY - 90 * s; // lowest cruising level: above the towers
    // on a narrow screen the plane flies under the instruments (top left), not behind them
    const hud = this.q('.pi-hud');
    if (hud && W * 0.3 - 40 * s < hud.offsetLeft + hud.offsetWidth) this.topY = Math.max(this.topY, Math.min(this.lo - 120 * s, hud.offsetTop + hud.offsetHeight + 26 * s));
    this.SP = Math.max(260 * s, Math.min(W * 0.46, 380 * s)); this.CL = 300 * s; this.vx0 = this.SP / 0.95; // wide gaps: few objects on screen at once (owner's request)
    if (this.state !== 'fly' && !this.f) this.idle();
  }
  yOf(A) { return this.lo - (Math.max(0, Math.min(AMAX, A)) / AMAX) * (this.lo - this.topY); }
  len(m) { return this.CL * SHIP[m].len; }

  // the plane waiting on the departure deck
  idle() {
    this.x0 = -Math.min(this.CL * 0.85, this.vx0 * 0.6);
    this.plane = { x: this.x0, y: this.deckY, ang: 0, on: false };
    this.camX = this.plane.x - this.W * 0.3; this.zoom = 1;
    this.items = []; this.decoys = []; this.ships = [{ x: -this.CL, m: 0 }]; this.path = null;
    this.draw();
  }

  // The flight becomes a smooth path through control points: each item sits on it, a bomb knocks the plane down
  // right away, an air pocket drops it at once, a boost throws it up. Then the sea gets its carriers.
  plan(f) {
    const S = this.SP, s = this.s, pts = [{ x: -S, y: this.deckY }, { x: 0, y: this.deckY }];
    // a boost (not the last item) throws the plane way up into the sky: a long arc, the camera zooms out (owner's request)
    const HUMP = 6.2, n = f.steps.length, hump = (i) => f.steps[i].it.k === 'boost' && i < n - 1;
    const xs = []; f.steps.forEach((st, i) => xs.push((i ? xs[i - 1] : 0) + (i && hump(i - 1) ? S * HUMP : S)));
    const peak = this.topY - this.H * 1.2;
    this.items = f.steps.map((st, i) => {
      const x = xs[i], yb = this.yOf(st.A), ya = this.yOf(st.after), k = st.it.k;
      pts.push({ x, y: yb });
      if (k === 'div') pts.push({ x: x + S * 0.3, y: yb + (ya - yb) * 0.8 });
      else if (k === 'pocket') pts.push({ x: x + S * 0.2, y: yb + (ya - yb) * 0.95 });
      else if (hump(i)) pts.push({ x: x + S * 0.9, y: (this.topY + peak) / 2 }, { x: x + S * 1.6, y: peak }, { x: x + S * 4.4, y: peak + 12 * s }, { x: x + S * 5.3, y: (this.topY + peak) / 2 }); // up there for a while
      else if (k === 'boost') pts.push({ x: x + S * 0.32, y: yb + (ya - yb) * 0.9 });
      return { x, y: yb - 9 * s, it: st.it, hit: false, t: Math.random() * 6 };
    });
    const xn = xs[n - 1], xl = xn + S * (f.fuel ? 2.4 : 1.7); // touchdown point
    pts.push({ x: xn + S * (f.fuel ? 1.3 : 0.75), y: Math.max(this.yOf(f.steps[n - 1].after), this.lo) + (f.fuel ? 0 : 10 * s) });
    pts.push({ x: xl, y: f.ok ? this.deckY : this.seaY + 16 * s });
    this.path = spline(pts); this.xl = xl; this.xn = xn;
    // near misses, only for the show (the flight is already drawn): a bomb, a cloud or a multiplier just above or
    // below the path, between two items — no label, the plane just swerves
    const dz = [['div', 2, 2], ['div', 3, 1.5], ['div', 5, 1], ['div', 10, 0.8], ['mul', 2, 2], ['mul', 3, 1.6], ['mul', 5, 1.5], ['mul', 10, 1.4], ['add', 100, 1], ['pocket', POCKET, 1.2], ['boost', BOOST, 1], ['bonus', BONUS_X, 0.25]];
    const dzW = dz.reduce((a, d) => a + d[2], 0);
    this.decoys = [];
    for (let i = 1; i < n; i++) {
      if (hump(i - 1)) { // up there: bombs all around the plane, it weaves between them
        for (let j = 0; j < 2; j++) {
          const x = xs[i - 1] + S * (2.2 + j * 1.4 + Math.random() * 0.2), y0 = this.path(x)[0] - 9 * s, off = (60 + Math.random() * 70) * s * (j % 2 ? 1 : -1);
          const d = [['div', 2], ['div', 3], ['div', 5], ['div', 10]][Math.floor(Math.random() * 4)];
          this.decoys.push({ x, y: y0 + off, it: { k: d[0], v: d[1] }, t: Math.random() * 6, passed: false, fade: 1, below: off > 0, wob: 0, sc: 2.2 });
        }
        continue;
      }
      if (Math.random() > 0.22) continue; // only now and then
      const x = xs[i - 1] + (xs[i] - xs[i - 1]) * (0.45 + Math.random() * 0.3), y0 = this.path(x)[0] - 9 * s;
      let off = (30 + Math.random() * 22) * s * (Math.random() < 0.5 ? -1 : 1), y = y0 + off;
      if (y < this.topY - 20 * s || y > this.lo + 10 * s) { off = -off; y = y0 + off; }
      let r = Math.random() * dzW, d = dz[0]; for (const z of dz) { if (r < z[2]) { d = z; break; } r -= z[2]; }
      this.decoys.push({ x, y, it: { k: d[0], v: d[1] }, t: Math.random() * 6, passed: false, fade: 1, below: off > 0, wob: 0 });
    }
    this.path(0); // back to the start of the path (the spline keeps its last segment)
    // carriers on the sea
    const ships = [{ x: -this.CL, m: 0 }], kinds = [1, 1, 1, 2, 2, 5];
    const zone = f.ok ? [xl - this.len(f.ship) * 0.15, xl + this.len(f.ship) * 0.85] : [xl - 60 * s, xl + 60 * s];
    if (f.ok) ships.push({ x: zone[0], m: f.ship, goal: true });
    else if (Math.random() < 0.6) ships.push({ x: xl + (40 + Math.random() * 50) * s, m: kinds[Math.floor(Math.random() * kinds.length)] }); // missed by a hair
    for (let x = S * 1.2; x < xl + S * 6; x += S * (1.4 + Math.random() * 1.8)) {
      const m = kinds[Math.floor(Math.random() * kinds.length)], L = this.len(m);
      if (x + L > xn - S * 0.2 && x < zone[1] + 40 * s) continue; // nothing under the final approach
      if (ships.some((o) => x < o.x + this.len(o.m) + 30 * s && x + L > o.x - 30 * s)) continue;
      ships.push({ x, m });
    }
    this.ships = ships;
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
      this.phase = 'run'; this.rt = 0; this.runT = this.superT ? 0.45 : this.turbo ? 0.75 : 1.2; this.tm = this.superT ? 3 : this.turbo ? 1.7 : 1;
      this.k = 0; this.T = 1; this.A = A0; this.spd = 0; this.slowT = 0; this.boostT = 0; this.slowmoT = 0; this.turbT = 0;
      this.jy = 0; this.jv = 0; this.ja = 0; this.bonusOn = false; this.scene.classList.remove('bonus');
      this.plan(f);
      this.slotEl.classList.remove('pi-won', 'pi-lost');
      this.setLast(0); this.winAmt.textContent = '';
      this.say('🛫 Décollage !');
      this.msg(`Mise ${fmtC(this.bet)} · bon vol !`);
      this.paintHud(1, 0);
      sfx.spin();
      this.last = performance.now();
      cancelAnimationFrame(this.raf);
      this.raf = requestAnimationFrame((t) => this.frame(t));
    });
  }

  frame(now) {
    if (this.dead) return;
    const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now; this.clock += dt;
    if (this.state === 'fly') this.advance(dt);
    this.tickFx(dt);
    this.draw();
    if (this.state === 'fly' || this.parts.length || this.texts.length || this.shakeT > 0 || Math.abs(this.jv) > 1) this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  advance(dt) {
    const p = this.plane, f = this.f, s = this.s;
    let shown = 0; // speed on the dial (1 = cruising)
    if (this.phase === 'run') {
      this.rt += dt; const k = Math.min(1, this.rt / this.runT);
      p.x = this.x0 + (0 - this.x0) * k * k; p.y = this.deckY; p.ang = 0; p.on = true; shown = k;
      if (k >= 1) { this.phase = 'air'; this.spd = 1; this.say('Prends les multiplicateurs, évite les bombes !'); }
    } else if (this.phase === 'air') {
      this.slowT -= dt; this.boostT -= dt; this.slowmoT -= dt;
      let tgt = 1;
      if (this.slowT > 0) tgt = 0.62;
      if (this.boostT > 0) tgt = 2.1;
      const next = this.items[this.k];
      if (next && this.A <= DOWN && next.x - p.x < this.SP * 0.8) tgt = Math.min(tgt, 0.55); // one more bomb and it is over: slow motion
      if (!next) tgt = Math.min(tgt, 0.78); // final approach
      if (this.slowmoT > 0) tgt = this.superT ? 0.6 : 0.3;
      if (this.superT) tgt = Math.max(tgt, 0.75); // super turbo: almost no slow motion
      this.spd += (tgt - this.spd) * Math.min(1, dt * (tgt > this.spd ? 4 : 2.5));
      p.x += this.vx0 * this.spd * this.tm * dt; shown = this.spd;
      while (this.k < this.items.length && p.x >= this.items[this.k].x) this.hit(this.k);
      for (const d of this.decoys) if (!d.passed && p.x >= d.x) this.brush(d);
      const [y, dy] = this.path(p.x);
      p.y = y; p.on = true;
      const ang = Math.max(-0.75, Math.min(0.95, Math.atan(dy)));
      p.ang += (ang - p.ang) * Math.min(1, dt * 10);
      if (!f.ok && this.k >= this.items.length && p.y >= this.seaY - 2 * s) return this.touch();
      if (p.x >= this.xl) return this.touch();
    } else if (this.phase === 'brake') {
      this.rt += dt; const k = Math.min(1, this.rt / this.brT);
      p.x = this.bx0 + this.bd * (1 - (1 - k) ** 2); p.y = this.deckY; p.ang += (0 - p.ang) * Math.min(1, dt * 12); p.on = false; shown = (1 - k) * 0.6;
      if (k >= 1) { this.phase = 'done'; this.instruments(0); return this.end(true); }
    }
    // stall alarm when the next bomb would bring the plane down, faster on the final approach
    if (this.phase === 'air' && (this.A <= DOWN || this.k >= this.items.length)) {
      this.alarmT -= dt;
      if (this.alarmT <= 0) { sfx.tick(); this.alarmT = this.k >= this.items.length ? 0.22 : 0.45; }
    }
    if (this.phase === 'air' && Math.random() < dt * (this.boostT > 0 ? 70 : 30)) this.parts.push({ x: p.x - 30 * s, y: p.y - 7 * s + this.jy, vx: -20, vy: 0, life: 0.6, max: 0.6, c: this.boostT > 0 ? 'rgba(125,211,252,.7)' : 'rgba(255,255,255,.55)', r: 3 + Math.random() * 3 });
    const lead = this.phase === 'brake' || this.k >= this.items.length || this.boostT > 0 ? 0.42 : 0.3;
    // high in the sky the camera zooms out: the carriers far below become tiny
    const zt = Math.max(0.28, Math.min(1, (this.seaY - this.topY * 0.9) / Math.max(1, this.seaY - p.y + 110 * s)));
    this.zoom += (zt - this.zoom) * Math.min(1, dt * (zt < this.zoom ? 7 : 3)); // zooms out fast, comes back gently
    this.camX += (p.x - (this.W * lead) / this.zoom - this.camX) * Math.min(1, dt * 4);
    this.instruments(shown);
  }

  // the plane reaches an item
  hit(i) {
    const s = this.s, f = this.f, st = f.steps[i], item = this.items[i], it = st.it, prev = this.T, big = isBig(it);
    item.hit = true; this.k = i + 1;
    this.T = st.T; this.A = st.after;
    if (it.k === 'div') {
      this.boom(item.x, item.y, big ? 60 : 34); this.shakeT = big ? 0.8 : 0.45;
      this.text(item.x, item.y - 30 * s, label(it), '#f87171', big ? 44 : 32);
      if (big) this.flash('rgba(239,68,68,.45)');
      this.jv += (big ? 640 : 480) * s; this.ja += big ? 0.6 : 0.4; this.slowT = 0.9; // the blast knocks the plane down
      sfx.puff();
      const what = `${label(it)} : ×${num(prev)} → ×${num(this.T)}`;
      this.say(st.after <= 0 ? `💥 ${what}… plus d’altitude, l’avion descend !` : `${big && prev >= 10 ? '😱' : '💥'} ${what}${st.after <= DOWN ? ' · ⚠️ encore une bombe et il descend !' : ''}`);
    } else if (it.k === 'pocket') {
      this.turbT = 1; this.shakeT = 0.6; this.jv += 360 * s; this.ja += 0.5;
      for (let j = 0; j < 18; j++) this.parts.push({ x: item.x + (Math.random() - 0.5) * 50 * s, y: item.y + (Math.random() - 0.5) * 30 * s, vx: (Math.random() - 0.5) * 60, vy: 40 + Math.random() * 120, life: 1, max: 1, c: 'rgba(148,163,184,.7)', r: 4 + Math.random() * 6, smoke: true });
      sfx.growl();
      this.say(st.after <= 0 ? '🌪️ Trou d’air ! L’avion chute… et n’a plus d’altitude !' : `🌪️ Trou d’air ! L’avion chute d’un coup${st.after <= DOWN ? ' · ⚠️ plus beaucoup d’altitude !' : ''}`);
    } else if (it.k === 'boost') {
      this.boostT = 0.95; this.jv -= 420 * s; this.ja -= 0.35; this.shakeT = 0.3;
      this.burst(item.x, item.y, ['#7dd3fc', '#e0f2fe', '#fff'], 40);
      this.text(item.x, item.y - 30 * s, 'BOOST', '#7dd3fc', 34);
      sfx.spin(); sfx.upgrade();
      this.say(i < f.steps.length - 1 ? '🚀 BOOST ! L’avion file tout là-haut… attention aux bombes !' : '🚀 BOOST ! L’avion fait un bond vers le ciel');
    } else if (it.k === 'bonus') {
      this.burst(item.x, item.y, ['#fde047', '#f59e0b', '#fff', '#f0abfc'], 90); this.shakeT = 0.5; this.jv -= 300 * s;
      if (!this.bonusOn) {
        this.bonusOn = true; this.slowmoT = 1.3;
        this.scene.classList.add('bonus');
        const banner = document.createElement('div'); banner.className = 'pi-big';
        banner.innerHTML = `<b>BONUS !</b><span>Tous les porte-avions ×${BONUS_X}</span>`;
        this.scene.appendChild(banner); setTimeout(() => banner.remove(), 2300);
        this.flash('rgba(250,204,21,.55)'); sfx.jackpot();
        dispatchEvent(new CustomEvent('sb:feature', { detail: { game: this.game.id, title: `BONUS ×${BONUS_X}`, bought: false, re: false, quiet: true } }));
        this.say(`🌟 BONUS ! Tous les porte-avions sont multipliés par ${BONUS_X} jusqu’à l’atterrissage !`);
      } else { sfx.upgrade(); this.say('🌟 Encore un bonus : l’avion remonte !'); }
    } else {
      const mul = it.k === 'mul';
      this.burst(item.x, item.y, mul ? ['#f0abfc', '#c084fc', '#fff'] : ['#fde047', '#fbbf24', '#fff'], big ? 70 : 30);
      this.text(item.x, item.y - 30 * s, label(it), mul ? '#f0abfc' : '#fde047', big ? 48 : 34);
      this.jv -= (big ? 420 : 260) * s; this.ja -= 0.25; // the bonus lifts the plane with a jump
      if (big) { this.flash(mul ? 'rgba(217,70,239,.4)' : 'rgba(250,204,21,.45)'); this.shakeT = 0.35; sfx.feature(); } else if (mul) sfx.upgrade(); else sfx.coin();
      this.say(`${big ? '🤑 ÉNORME ! ' : '✨ '}${label(it)} : ×${num(this.T)} à bord${st.A <= DOWN ? ' · l’avion remonte !' : ''}`);
    }
    this.paintHud(this.T, this.k);
    if (i === f.steps.length - 1) setTimeout(() => {
      if (this.dead || this.state !== 'fly') return;
      this.say(f.fuel ? '⛽ Réservoir vide ! L’avion plane… porte-avions ou mer ?' : '⬇️ L’avion descend… porte-avions ou mer ?');
      sfx.tease();
    }, 750);
  }

  // the plane brushes past a decoy: it swerves, nothing is written
  brush(d) {
    d.passed = true; d.wob = 1;
    this.jv += (d.below ? -1 : 1) * 190 * this.s; this.ja += (d.below ? -1 : 1) * 0.12;
    if (d.it.k === 'div' || d.it.k === 'pocket') sfx.tick(); else if (isBig(d.it)) sfx.tease();
  }

  touch() {
    const f = this.f, p = this.plane;
    if (!f.ok) { this.phase = 'done'; this.splash(p.x, this.seaY); this.shakeT = 0.5; sfx.huff(); return this.end(false); }
    this.burst(p.x, this.deckY, ['#cbd5e1', '#fff'], 14); sfx.land();
    this.phase = 'brake'; this.rt = 0; this.bx0 = p.x; this.bd = Math.max(20 * this.s, this.xl + this.len(f.ship) * 0.55 - p.x);
    this.brT = Math.max(0.5, (2 * this.bd) / Math.max(1, this.vx0 * this.spd * this.tm));
    this.jv = 0; this.ja = 0;
    this.say(`🛬 Porte-avions <b>×${f.m}</b>${f.bonus ? ' (BONUS)' : ''} ! Le crochet attrape le câble…`);
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
      this.say(`🛬 Posé sur le porte-avions ×${f.m}${f.bonus ? ' (BONUS)' : ''} ! ×${num(f.T)}${f.m > 1 ? ` × ${f.m}` : ''} = <b>×${num(f.pay)}</b> → <b>${fmtC(won)}</b>`);
      this.msg(`Gain : ${fmtC(won)} (×${num(f.pay)})`);
      if (f.m >= 5) this.flash('rgba(250,204,21,.5)');
      for (let i = 0; i < 3; i++) setTimeout(() => this.burst(this.plane.x + (i - 1) * 40, this.deckY - 30, f.m >= 5 ? ['#fde047', '#f59e0b', '#fff'] : ['#4ade80', '#fde047', '#fff'], 22), i * 160);
    } else {
      this.slotEl.classList.add('pi-lost');
      this.flash('rgba(56,189,248,.45)');
      this.say(`🌊 Plouf ! L’avion finit dans la mer avec ×${num(f.T)} à bord${f.bonus ? ' (et le BONUS…)' : ''}.`);
      this.msg(`Perdu · mise ${fmtC(this.stake)}`);
      this.setLast(0);
    }
    this.paintHud(ok ? f.pay : f.T, this.k);
    this.instruments(0);
    const finish = async () => {
      if (ok && won > 0) await this.celebrate(won);
      if (this.bonusOn) dispatchEvent(new CustomEvent('sb:featureend', { detail: { game: this.game.id } }));
      this.bonusOn = false; this.scene.classList.remove('bonus');
      await this.wait(this.superT ? 200 : ok ? 500 : 900);
      this.state = 'idle';
      const r = this.done; this.done = null; r?.();
    };
    finish();
  }

  /* ---------- HUD ---------- */
  say(t) { this.q('.pi-say').innerHTML = t; }
  paintHud(T, k) {
    this.q('.pi-total b').textContent = `×${num(T)}`;
    this.q('.pi-total em').textContent = fmtC(Math.floor((this.state === 'idle' ? this.bet : this.stake || this.bet) * T));
    const box = this.q('.pi-total'); box.classList.remove('bump'); void box.offsetWidth; box.classList.add('bump');
    this.q('.pi-fuel i').style.width = `${Math.round((1 - k / MAXN) * 100)}%`;
  }
  // altitude, speed and distance, top left (only the texts that changed are written)
  instruments(shown) {
    const p = this.plane, I = this.inst;
    if (!p) return;
    const flying = this.state === 'fly' && this.phase === 'air';
    const alt = flying ? Math.max(0, Math.round(((this.deckY - p.y - this.jy * 0.4) / (this.deckY - this.topY)) * 3000 / 10) * 10) : 0;
    const vs = flying && this.path ? this.path(p.x)[1] : 0;
    const altTxt = `${alt.toLocaleString('fr-FR')} m`, arrow = vs < -0.08 ? '▲' : vs > 0.08 ? '▼' : '';
    if (I.last.alt !== altTxt + arrow) { I.last.alt = altTxt + arrow; I.alt.innerHTML = `${altTxt}<i>${arrow}</i>`; }
    const spdTxt = `${Math.round((shown * 720) / 10) * 10} km/h`;
    if (I.last.spd !== spdTxt) { I.last.spd = spdTxt; I.spd.textContent = spdTxt; }
    const dst = this.state === 'fly' || this.state === 'over' ? Math.max(0, (p.x / this.SP) * 0.9) : 0;
    const dstTxt = `${dst.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;
    if (I.last.dst !== dstTxt) { I.last.dst = dstTxt; I.dst.textContent = dstTxt; }
    const final = flying && this.k >= this.items.length, danger = flying && (this.A <= DOWN || final), warn = flying && this.A <= DOWN * 2;
    I.box.classList.toggle('danger', danger); I.box.classList.toggle('warn', warn && !danger);
    this.scene.classList.toggle('low', flying && !final && this.A > 0 && this.A <= DOWN);
  }
  onBetChange() { if (this.state !== 'fly') this.paintHud(1, 0); }

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
    this.shakeT = Math.max(0, this.shakeT - dt); this.turbT = Math.max(0, this.turbT - dt);
    // the plane's bounce after a hit: a damped spring
    for (let i = 0; i < 3; i++) { const h = dt / 3; this.jv += (-150 * this.jy - 10 * this.jv) * h; this.jy += this.jv * h; this.ja += -this.ja * 6 * h; }
    for (const d of this.decoys) { if (d.passed) d.fade = Math.max(0, d.fade - dt * (d.it.k === 'div' ? 0.45 : 1.4)); d.wob = Math.max(0, d.wob - dt * 2); }
    // speed lines while boosting
    if (this.state === 'fly' && this.boostT > 0 && Math.random() < dt * 40) this.lines.push({ x: this.W + 20, y: Math.random() * this.seaY, l: 60 + Math.random() * 140, v: 1400 + Math.random() * 900, life: 0.7 });
    for (const l of this.lines) { l.x -= l.v * dt; l.life -= dt; }
    this.lines = this.lines.filter((l) => l.life > 0 && l.x + l.l > 0);
  }

  /* ---------- drawing ---------- */
  draw() {
    const g = this.ctx, { W, H, s } = this;
    if (!W || !g) return;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const now = performance.now() / 1000;
    const sky = g.createLinearGradient(0, 0, 0, this.seaY);
    if (this.bonusOn) { sky.addColorStop(0, '#3b0764'); sky.addColorStop(0.5, '#9d174d'); sky.addColorStop(1, '#fbbf24'); } else { sky.addColorStop(0, '#0b2a6f'); sky.addColorStop(0.55, '#2f6fd6'); sky.addColorStop(1, '#f9b17a'); }
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,236,170,.9)'; g.beginPath(); g.arc(W * 0.82, this.seaY * 0.32, 26 * s, 0, 6.28); g.fill();
    g.fillStyle = 'rgba(255,236,170,.18)'; g.beginPath(); g.arc(W * 0.82, this.seaY * 0.32, 48 * s, 0, 6.28); g.fill();
    const shake = this.shakeT > 0 ? (Math.random() - 0.5) * 10 * this.shakeT : 0;
    const wide = Math.max(1, W / 1200);
    for (const c of this.clouds) {
      const span = 16 * 240 * wide, x = ((c.x * wide - this.camX * c.p) % span + span) % span - 200;
      if (x > W + 100) continue;
      this.cloud(g, x, c.y * this.seaY, c.s * s, 0.75);
    }
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 2;
    for (const l of this.lines) { g.globalAlpha = Math.min(1, l.life * 2); g.beginPath(); g.moveTo(l.x, l.y); g.lineTo(l.x + l.l, l.y); g.stroke(); }
    g.globalAlpha = 1;
    const z = this.zoom || 1;
    g.save(); g.translate(shake, this.seaY + shake * 0.5); g.scale(z, z); g.translate(-this.camX, -this.seaY);
    const L = this.camX - 20 / z, R = this.camX + (W + 20) / z;
    const sea = g.createLinearGradient(0, this.seaY, 0, H);
    sea.addColorStop(0, '#1e6fb8'); sea.addColorStop(1, '#062a4f');
    g.fillStyle = sea; g.fillRect(L, this.seaY, R - L, (H - this.seaY) / z + 10);
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1.5;
    for (let row = 0; row < 4; row++) {
      const y = this.seaY + 6 + row * (H - this.seaY) / 4.5, x0 = Math.floor(L / 24) * 24;
      g.beginPath();
      for (let x = x0; x < R; x += 24) { const yy = y + Math.sin(x * 0.05 + now * 2 + row) * 2; if (x === x0) g.moveTo(x, yy); else g.lineTo(x, yy); }
      g.globalAlpha = 0.5 - row * 0.1; g.stroke(); g.globalAlpha = 1;
    }
    for (const sh of this.ships) if (sh.x < R + 40 && sh.x + this.len(sh.m) > L - 40) this.carrier(g, sh, now);
    for (const d of this.decoys) if (d.fade > 0 && d.x > L - 80 && d.x < R + 80) { g.globalAlpha = d.fade; this.item(g, d, now); g.globalAlpha = 1; }
    for (const it of this.items) if (!it.hit && it.x > L - 80 && it.x < R + 80) this.item(g, it, now);
    for (const p of this.parts) if (p.smoke) { g.globalAlpha = Math.max(0, p.life / p.max) * 0.7; g.fillStyle = p.c; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 6.28); g.fill(); }
    g.globalAlpha = 1;
    if (!(this.state === 'over' && this.f && !this.f.ok)) this.planeDraw(g);
    for (const p of this.parts) if (!p.smoke) { g.globalAlpha = Math.max(0, p.life / p.max); g.fillStyle = p.c; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 6.28); g.fill(); }
    g.globalAlpha = 1;
    for (const t of this.texts) { g.globalAlpha = Math.min(1, t.life * 1.5); say2(g, t.t, t.x, t.y, t.size, t.c, 'rgba(0,0,0,.55)'); }
    g.globalAlpha = 1;
    g.restore();
    // clouds in front of the plane: it flies through them
    for (const c of this.near) {
      const span = 4 * 700 * wide, x = ((c.x * wide - this.camX * 1.35) % span + span) % span - 300;
      if (x > W + 200) continue;
      this.cloud(g, x, c.y * this.seaY, c.s * s, 0.42);
    }
  }

  cloud(g, x, y, k, a) {
    g.fillStyle = `rgba(255,255,255,${a})`;
    g.beginPath(); g.ellipse(x, y, 46 * k, 15 * k, 0, 0, 6.28); g.ellipse(x - 26 * k, y + 4 * k, 26 * k, 11 * k, 0, 0, 6.28); g.ellipse(x + 22 * k, y - 6 * k, 30 * k, 14 * k, 0, 0, 6.28); g.fill();
  }

  carrier(g, sh, now) {
    const { s, deckY, seaY } = this, look = SHIP[sh.m], CL = this.len(sh.m), x0 = sh.x, x1 = x0 + CL, glow = this.bonusOn && sh.m;
    if (glow) { g.shadowColor = '#fde047'; g.shadowBlur = (14 + Math.sin(now * 6) * 6) * s; }
    g.fillStyle = look.hull;
    g.beginPath(); g.moveTo(x0 - 10 * s, deckY); g.lineTo(x1 + 26 * s, deckY); g.lineTo(x1 - 6 * s, seaY + 12 * s); g.lineTo(x0 + 14 * s, seaY + 12 * s); g.closePath(); g.fill();
    g.shadowBlur = 0;
    g.fillStyle = look.gold || glow ? '#fde047' : '#b91c1c'; g.fillRect(x0 + 10 * s, seaY + 2 * s, CL - 14 * s, 6 * s);
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
    const nL = Math.max(3, Math.floor(CL / (22 * s)) - 4), gold = look.gold || glow;
    for (let i = 0; i < nL; i++) { const on = (Math.floor(now * 6) + i) % 6 < 2; g.fillStyle = on ? (gold ? '#fde047' : '#4ade80') : gold ? 'rgba(253,224,71,.25)' : 'rgba(74,222,128,.25)'; g.beginPath(); g.arc(x0 + 10 * s + i * 20 * s, deckY - 7 * s, 2.6 * s, 0, 6.28); g.fill(); }
    // the carrier's multiplier, painted big on the hull (×10 with the bonus)
    if (gold) { g.shadowColor = '#fde047'; g.shadowBlur = 16 * s; }
    say2(g, `×${sh.m * (this.bonusOn ? BONUS_X : 1)}`, x0 + CL * 0.36, deckY + 15 * s, (glow ? 22 : 19) * s, glow ? '#fde047' : look.c, 'rgba(0,0,0,.5)');
    g.shadowBlur = 0;
  }

  item(g, it, now) {
    const { s } = this, k = it.it.k, r = 19 * s, big = isBig(it.it), lab = label(it.it), wob = it.wob ? Math.sin(now * 40) * it.wob * 4 * s : 0;
    const y = it.y + Math.sin(now * 2.2 + it.t) * 4 * s;
    g.save(); g.translate(it.x + wob, y);
    if (it.sc) g.scale(it.sc, it.sc);
    if (big && k !== 'bonus') g.scale(1.3, 1.3);
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
    } else if (k === 'pocket') { // air pocket: a dark swirling cloud with arrows going down
      for (let i = 0; i < 6; i++) { const a = now * 1.6 + i * 1.05; g.fillStyle = `rgba(${51 + i * 8},${65 + i * 8},${85 + i * 8},.55)`; g.beginPath(); g.arc(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.35, r * (0.75 - i * 0.05), 0, 6.28); g.fill(); }
      g.fillStyle = '#e2e8f0';
      for (const dx of [-0.42, 0.42]) { const yy = ((now * 1.4 + (dx > 0 ? 0.5 : 0)) % 1) * r * 0.9 - r * 0.45; g.beginPath(); g.moveTo(dx * r - 6 * s, yy); g.lineTo(dx * r + 6 * s, yy); g.lineTo(dx * r, yy + 8 * s); g.closePath(); g.fill(); }
    } else if (k === 'boost') { // boost: a cyan ring with chevrons
      g.shadowColor = '#38bdf8'; g.shadowBlur = 20 * s;
      g.strokeStyle = '#7dd3fc'; g.lineWidth = 4 * s; g.beginPath(); g.ellipse(0, 0, r * 0.75, r * 1.25, 0, 0, 6.28); g.stroke();
      g.shadowBlur = 0; g.strokeStyle = '#e0f2fe'; g.lineWidth = 3.5 * s; g.lineCap = 'round';
      for (let i = 0; i < 2; i++) { const yy = -r * 0.25 - i * 9 * s + ((now * 30) % 9) * s * 0.3; g.beginPath(); g.moveTo(-7 * s, yy + 6 * s); g.lineTo(0, yy); g.lineTo(7 * s, yy + 6 * s); g.stroke(); }
    } else if (k === 'bonus') { // the ×10 bonus: a golden medal with rays
      const pulse = 1 + Math.sin(now * 5) * 0.06; g.scale(1.45 * pulse, 1.45 * pulse);
      g.strokeStyle = 'rgba(253,224,71,.8)'; g.lineWidth = 3 * s;
      for (let i = 0; i < 16; i++) { const a = (i / 16) * 6.28 + now * 0.8; g.beginPath(); g.moveTo(Math.cos(a) * r * 1.2, Math.sin(a) * r * 1.2); g.lineTo(Math.cos(a) * r * 1.8, Math.sin(a) * r * 1.8); g.stroke(); }
      g.shadowColor = '#fde047'; g.shadowBlur = 30 * s;
      const gr = g.createRadialGradient(-r * 0.3, -r * 0.35, 2, 0, 0, r * 1.1);
      gr.addColorStop(0, '#fff7c2'); gr.addColorStop(0.55, '#facc15'); gr.addColorStop(1, '#b45309');
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r, 0, 6.28); g.fill(); g.shadowBlur = 0;
      g.fillStyle = '#7c2d12'; g.font = `900 ${8 * s}px KeCoin, Archivo, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('BONUS', 0, -5 * s); g.font = `900 ${11 * s}px KeCoin, Archivo, sans-serif`; g.fillText(`×${BONUS_X}`, 0, 6 * s);
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
    const { s } = this, p = this.plane, t = this.clock;
    // turbulence: a light constant shiver, strong in an air pocket
    const amp = (this.state === 'fly' && this.phase === 'air' ? 1.3 : 0) + this.turbT * 7;
    const tb = amp * s * (Math.sin(t * 7.3) + Math.sin(t * 11.7 + 1.3) * 0.6 + Math.sin(t * 3.1 + 2) * 0.8) / 2.4;
    g.save(); g.translate(p.x, p.y - 9 * s + this.jy + tb); g.rotate(p.ang + this.ja + tb * 0.004); g.scale(s / (this.zoom || 1) ** 0.6, s / (this.zoom || 1) ** 0.6);
    if (p.on) {
      const boost = this.boostT > 0, fl = boost ? 34 : 12;
      g.fillStyle = boost ? `rgba(125,211,252,${0.7 + Math.random() * 0.3})` : `rgba(253,186,116,${0.6 + Math.random() * 0.4})`;
      g.beginPath(); g.moveTo(-30, -3); g.lineTo(-32 - fl - Math.random() * 10, 1); g.lineTo(-30, 5); g.fill();
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
    const pct = (w, t) => `${Math.round((w / t) * 1000) / 10} %`, name = (it) => ({ boost: 'boost', pocket: 'trou d’air', bonus: `bonus ×${BONUS_X}` }[it.k] || label(it));
    return this.rules(`<h4>Comment jouer</h4><p>Choisis ta mise et appuie sur <b>DÉCOLLER</b>. L’avion part avec <b>×1</b> (ta mise) et vole au-dessus de la mer, sans fin fixe, jusqu’à ce qu’il n’ait plus d’altitude.</p>
      <ul class="rules"><li><b>Étoiles et pièces</b> : ×2, ×3, ×5, ×10, +5, +20 ou +100 sur le gain en vol. L’avion remonte.</li>
      <li><b>Bombes</b> : ÷2, ÷3, ÷5 ou ÷10 sur le gain (il ne descend jamais sous ×1). L’avion descend.</li>
      <li><b>Boost</b> : l’avion fait un grand bond vers le haut. <b>Trou d’air</b> : il chute d’un coup.</li>
      <li><b>BONUS</b> : tous les porte-avions sont multipliés par ${BONUS_X} jusqu’à l’atterrissage (×10, ×20, ×50).</li>
      <li><b>L’atterrissage</b> : sans altitude (ou sans carburant, au bout de ${MAXN} objets), l’avion se pose là où il est. Dans la mer, la mise est perdue. Sur un porte-avions, tu gagnes le gain en vol multiplié par le porte-avions : <b>×1</b>, <b>×2</b> ou <b>×5</b> (doré).</li></ul>
      <p>En haut à gauche : ton gain en vol, l’altitude, la vitesse et la distance parcourue. Gain maximum : ×${num(CAP)} la mise.</p>
      <h4>Chances</h4><p>${ITEMS.map((it) => `${name(it)} : ${pct(it.w, ITEMS_W)}`).join(' · ')}</p>
      <p>Arrivée : ${SHIPS.map((sh) => `${sh.m ? `porte-avions ×${sh.m}` : 'mer'} ${pct(sh.w, SHIPS_W)}`).join(' · ')}</p>
      <h4>Équité</h4><p>Chaque vol est tiré au hasard au décollage ; les objets que l’avion frôle sans les toucher ne changent rien. Sur des millions de vols simulés, le retour au joueur est d’environ 97 % : le plus généreux du casino.</p>`);
  }
}

return { PiloteGame };
})();
