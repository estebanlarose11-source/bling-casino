// SpinBet Casino · PlinkoGame — loaded on demand by games/impl/index.js (index.html).
// ---- games/impl/plinko.js ----
__mods['games/impl/plinko.js'] = (() => {
// Plinko: balls bounce down a peg pyramid into multiplier slots. The slot is drawn when the ball is dropped
// (one left/right coin flip per row); the canvas then animates a gravity path through those exact pegs.

const { BaseGame, fmtC } = __mods['core/base.js'];
const { EXTRA_THEMES } = __mods['core/music.js'];
const { sfx, audioContext, isMuted } = __mods['audio.js'];
const { fx } = __mods['fx.js'];

/* ===ENGINE */
const ROWS_MIN = 8, ROWS_MAX = 16, TARGET = 0.95;
// Multiplier curve per risk: centre value and edge value at 8 and 16 rows.
const RISKS = {
  low: { name: 'Faible', centre: 0.5, edge: [5.6, 16] },
  mid: { name: 'Moyen', centre: 0.4, edge: [13, 110] },
  high: { name: 'Élevé', centre: 0.2, edge: [29, 1000] },
};
function binom(n) { const p = [1]; for (let i = 0; i < n; i++) { for (let k = p.length; k > 0; k--) p[k] = ((p[k] || 0) + p[k - 1]) / 2; p[0] /= 2; } return p; }
const nice = (x) => (x >= 100 ? Math.round(x / 10) * 10 : x >= 10 ? Math.round(x) : Math.max(0.1, Math.round(x * 10) / 10));
const TABLES = {};
// Multipliers for each slot (0..n): centre and edge values are fixed, the curve between them rises geometrically.
// Its steepness is searched so the return is as close to TARGET as the rounding allows (never above).
function table(n, risk) {
  const key = n + risk;
  if (TABLES[key]) return TABLES[key];
  const r = RISKS[risk], edge = r.edge[0] * Math.pow(r.edge[1] / r.edge[0], (n - ROWS_MIN) / (ROWS_MAX - ROWS_MIN)), P = binom(n);
  const build = (q) => P.map((_, k) => nice(r.centre * Math.pow(edge / r.centre, Math.pow(Math.abs(k - n / 2) / (n / 2), q))));
  const ret = (m) => m.reduce((a, x, k) => a + x * P[k], 0);
  let lo = 0.2, hi = 8; // higher q = flatter centre = lower return
  for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (ret(build(mid)) > TARGET) lo = mid; else hi = mid; }
  const m = build(hi);
  return (TABLES[key] = { m, P, rtp: ret(m) });
}
// One ball: a left/right choice at every row; the slot is the number of rights.
function drop(n) { const path = []; for (let i = 0; i < n; i++) path.push(Math.random() < 0.5 ? 0 : 1); return { path, slot: path.reduce((a, b) => a + b, 0) }; }
/* ===END ENGINE */

const BALLS = [1, 3, 5, 10, 20];
const RISK_IDS = Object.keys(RISKS);
const fx2 = (x) => (x >= 100 ? x.toLocaleString('fr-FR') : String(x).replace('.', ','));
// Slot colour from cool (centre) to hot (edges).
const slotColour = (t) => `hsl(${Math.round(48 - 52 * t)}, ${Math.round(85 + 10 * t)}%, ${Math.round(52 - 4 * t)}%)`;

// Soft peg "tick": pitch rises as the ball goes down.
function pegSound(row, n) {
  if (isMuted()) return;
  const c = audioContext(); if (!c) return;
  const t = c.currentTime, o = c.createOscillator(), g = c.createGain();
  o.type = 'sine';
  o.frequency.value = 520 + (row / n) * 520 + Math.random() * 40;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.05, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
  o.connect(g).connect(c.destination);
  o.start(t); o.stop(t + 0.1);
}

class PlinkoGame extends BaseGame {
  constructor(root, game) {
    super(root, game, {
      music: EXTRA_THEMES.plinko, autoplay: false, mainLabel: 'LANCER',
      cls: 'table-game plinko',
      head: '<div class="pl-hist" aria-label="Derniers multiplicateurs"></div>',
      stage: '<div class="pl-board"><canvas class="pl-canvas"></canvas></div>',
      below: `<div class="pl-ctl">
        <div class="pl-grp"><span>Risque</span><div class="pl-seg">${RISK_IDS.map((r) => `<button type="button" data-risk="${r}">${RISKS[r].name}</button>`).join('')}</div></div>
        <div class="pl-grp"><span>Rangées</span><div class="pl-step"><button type="button" class="round-btn" data-rows="-1" aria-label="Moins de rangées">−</button><b class="pl-rows"></b><button type="button" class="round-btn" data-rows="1" aria-label="Plus de rangées">+</button></div></div>
        <div class="pl-grp"><span>Billes par lancer</span><div class="pl-seg">${BALLS.map((b) => `<button type="button" data-balls="${b}">${b}</button>`).join('')}</div></div>
      </div>`,
      hello: 'Choisis ta mise, le risque et le nombre de rangées, puis lance.',
    });
    this.rows = this.loadNum('plinko_rows', 12, ROWS_MIN, ROWS_MAX);
    this.risk = RISK_IDS[this.loadNum('plinko_risk', 1, 0, RISK_IDS.length - 1)];
    this.nBalls = BALLS[this.loadNum('plinko_balls', 0, 0, BALLS.length - 1)];
    this.balls = [];
    this.queued = 0;
    this.pegGlow = new Map();
    this.slotHit = [];
    this.hist = [];
    this.canvas = this.q('.pl-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.root.addEventListener('click', (e) => {
      const r = e.target.closest('[data-risk]'); if (r && !this.inPlay()) this.setRisk(r.dataset.risk);
      const n = e.target.closest('[data-rows]'); if (n && !this.inPlay()) this.setRows(this.rows + +n.dataset.rows);
      const b = e.target.closest('[data-balls]'); if (b) this.setBalls(+b.dataset.balls);
    });
    this.ro = new ResizeObserver(() => this.layout());
    this.ro.observe(this.q('.pl-board'));
    this.frame = this.frame.bind(this);
    this.paintCtl();
    this.layout();
  }

  inPlay() { return this.balls.length > 0 || this.queued > 0; }
  get tab() { return table(this.rows, this.risk); }

  setRisk(r) { this.risk = r; this.saveKey('plinko_risk', RISK_IDS.indexOf(r)); this.slotHit = []; this.paintCtl(); this.draw(); }
  setRows(n) { this.rows = Math.max(ROWS_MIN, Math.min(ROWS_MAX, n)); this.saveKey('plinko_rows', this.rows); this.slotHit = []; this.pegGlow.clear(); this.paintCtl(); this.layout(); }
  setBalls(n) { this.nBalls = n; this.saveKey('plinko_balls', BALLS.indexOf(n)); this.paintCtl(); }

  paintCtl() {
    const busy = this.inPlay();
    this.qa('[data-risk]').forEach((b) => { b.classList.toggle('on', b.dataset.risk === this.risk); b.disabled = busy; });
    this.qa('[data-balls]').forEach((b) => b.classList.toggle('on', +b.dataset.balls === this.nBalls));
    this.q('.pl-rows').textContent = this.rows;
    this.q('[data-rows="-1"]').disabled = busy || this.rows <= ROWS_MIN;
    this.q('[data-rows="1"]').disabled = busy || this.rows >= ROWS_MAX;
    const lab = this.mainBtn?.querySelector('.main-label');
    if (lab) lab.textContent = this.nBalls > 1 ? `LANCER ×${this.nBalls}` : 'LANCER';
  }

  onMeters() { if (this.balls) this.paintCtl(); } // also called by the cabinet before our constructor runs

  /* ---------- geometry ---------- */
  layout() {
    const box = this.q('.pl-board'), w = Math.max(260, box.clientWidth), n = this.rows;
    const gap = Math.min(44, (w - 24) / (n + 2)), h = gap * (n + 1) + gap * 1.6 + 46;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(h * dpr);
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.geo = { w, h, gap, cx: w / 2, top: gap * 1.2, pegR: Math.max(2.4, gap * 0.11), ballR: Math.max(4.5, gap * 0.24) };
    this.geo.slotY = this.geo.top + gap * n + gap * 0.25;
    this.draw();
  }
  pegX(row, j) { return this.geo.cx + (j - (row + 2) / 2) * this.geo.gap; }
  pegY(row) { return this.geo.top + row * this.geo.gap; }
  slotX(k) { return this.geo.cx + (k - this.rows / 2) * this.geo.gap; }

  // Gravity arcs from peg to peg along the drawn path (x linear, y = y0 + v0 t + g t² / 2).
  plan(path) {
    const { gap, pegR, ballR } = this.geo, n = this.rows, g = gap * 60, legs = [];
    let x = this.geo.cx + (Math.random() - 0.5) * gap * 0.16, y = this.pegY(0) - gap * 1.1, vy = 0, c = 0;
    for (let r = 0; r <= n; r++) {
      const last = r === n;
      const tx = last ? this.slotX(c) : this.pegX(r, c + 1) + (Math.random() - 0.5) * gap * 0.1;
      const ty = last ? this.geo.slotY + gap * 0.55 : this.pegY(r) - pegR - ballR * 0.9;
      const dy = ty - y, T = (-vy + Math.sqrt(vy * vy + 2 * g * dy)) / g;
      legs.push({ x0: x, y0: y, x1: tx, vy, g, T, row: last ? -1 : r, peg: last ? null : `${r}:${c + 1}` });
      if (last) break;
      const dir = path[r];
      x = tx; y = ty; vy = -gap * (3.5 + Math.random() * 2);
      c += dir;
    }
    return legs;
  }

  /* ---------- play ---------- */
  onMain() {
    if (this.dead) return;
    const n = this.nBalls;
    for (let i = 0; i < n; i++) {
      this.queued++;
      setTimeout(() => { this.queued--; if (!this.dead) this.dropOne(); this.paintCtl(); }, i * (this.turbo ? 90 : 160));
    }
    this.paintCtl();
  }

  dropOne() {
    const bet = this.bet;
    if (!this.pay(bet)) { this.queued = 0; return; }
    this.lastStake = bet;
    const res = drop(this.rows), tab = this.tab;
    this.balls.push({ bet, slot: res.slot, mult: tab.m[res.slot], legs: this.plan(res.path), leg: 0, t: 0, trail: [], hue: Math.random() * 30 });
    sfx.click();
    if (!this.raf) { this.last = performance.now(); this.raf = requestAnimationFrame(this.frame); }
  }

  land(b) {
    const win = Math.round(b.bet * b.mult);
    this.slotHit[b.slot] = 1;
    this.lastStake = b.bet;
    if (win > 0) this.win(win);
    this.setLast(win);
    this.hist.unshift(b.mult); this.hist = this.hist.slice(0, 12);
    this.q('.pl-hist').innerHTML = this.hist.map((m) => `<span style="--c:${slotColour(Math.min(1, Math.log10(Math.max(m, 0.1) * 10) / 4))}">×${fx2(m)}</span>`).join('');
    const net = win - b.bet;
    this.msg(`×${fx2(b.mult)} · ${win > 0 ? `+${fmtC(win)}` : 'perdu'}${net > 0 ? ` <span class="pill hot">+${fmtC(net)}</span>` : ''}`);
    const rect = this.canvas.getBoundingClientRect(), px = rect.left + this.slotX(b.slot), py = rect.top + this.geo.slotY + this.geo.gap * 0.4;
    if (b.mult >= 10) {
      fx.burst(px, py, b.mult >= 100 ? 60 : 26, ['#fde047', '#fbbf24', '#fff'], b.mult >= 100 ? 10 : 6);
      fx.floatText(px, py - 30, `×${fx2(b.mult)}`, '#fde047', 26);
      if (b.mult >= 100) { this.flash('rgba(253,224,71,.5)'); this.celebrate(win, { stake: b.bet }); } else sfx.win();
    } else if (b.mult >= 1) sfx.coin(); else sfx.tick();
  }

  frame(now) {
    if (this.dead) return;
    const dt = Math.min(0.05, (now - this.last) / 1000) * (this.turbo ? 1.6 : 1);
    this.last = now;
    for (const b of this.balls) {
      b.t += dt;
      let L = b.legs[b.leg];
      while (L && b.t >= L.T) {
        b.t -= L.T;
        if (L.peg) { this.pegGlow.set(L.peg, 1); pegSound(L.row, this.rows); }
        b.leg++;
        L = b.legs[b.leg];
      }
      if (!L) { b.done = true; continue; }
      const k = b.t / L.T;
      b.x = L.x0 + (L.x1 - L.x0) * k;
      b.y = L.y0 + L.vy * b.t + 0.5 * L.g * b.t * b.t;
      b.trail.push([b.x, b.y]); if (b.trail.length > 7) b.trail.shift();
    }
    const done = this.balls.filter((b) => b.done);
    if (done.length) { this.balls = this.balls.filter((b) => !b.done); done.forEach((b) => this.land(b)); this.paintCtl(); }
    for (const [k, v] of this.pegGlow) { const nv = v - dt * 3; if (nv <= 0) this.pegGlow.delete(k); else this.pegGlow.set(k, nv); }
    this.slotHit = this.slotHit.map((v) => Math.max(0, (v || 0) - dt * 3));
    this.draw();
    const busy = this.balls.length || this.pegGlow.size || this.slotHit.some((v) => v > 0);
    this.raf = busy ? requestAnimationFrame(this.frame) : null;
  }

  /* ---------- drawing ---------- */
  draw() {
    if (!this.geo) return;
    const c = this.ctx, { w, h, gap, pegR, ballR } = this.geo, n = this.rows, tab = this.tab;
    c.clearRect(0, 0, w, h);
    // pegs
    for (let r = 0; r < n; r++) {
      for (let j = 0; j < r + 3; j++) {
        const x = this.pegX(r, j), y = this.pegY(r), glow = this.pegGlow.get(`${r}:${j}`) || 0;
        if (glow) { c.fillStyle = `rgba(255, 220, 120, ${0.35 * glow})`; c.beginPath(); c.arc(x, y, pegR * (2.2 + glow * 2), 0, 7); c.fill(); }
        const gr = c.createRadialGradient(x - pegR * 0.35, y - pegR * 0.4, pegR * 0.1, x, y, pegR);
        gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.5, glow ? '#ffe9a8' : '#d9dbe6'); gr.addColorStop(1, glow ? '#e0a52a' : '#7c8094');
        c.fillStyle = gr; c.beginPath(); c.arc(x, y, pegR * (1 + glow * 0.25), 0, 7); c.fill();
      }
    }
    // slots
    const sw = gap * 0.9, sh = Math.max(20, gap * 0.72);
    for (let k = 0; k <= n; k++) {
      const hit = this.slotHit[k] || 0, x = this.slotX(k) - sw / 2, y = this.geo.slotY + hit * 6, t = Math.abs(k - n / 2) / (n / 2);
      const col = slotColour(t);
      c.save();
      c.shadowColor = col; c.shadowBlur = 6 + hit * 18;
      c.fillStyle = col;
      this.rr(x, y, sw, sh, 5); c.fill();
      c.restore();
      c.fillStyle = 'rgba(0,0,0,.28)'; this.rr(x, y + sh - 4, sw, 4, 2); c.fill();
      const lab = fx2(tab.m[k]);
      c.fillStyle = '#1a0b06';
      c.font = `800 ${Math.min(13, Math.max(6, sw / (lab.length * 0.62 + 0.5)))}px Inter, system-ui, sans-serif`;
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(lab, x + sw / 2, y + sh / 2 - 1);
    }
    // balls
    for (const b of this.balls) {
      if (b.x == null) continue;
      b.trail.forEach(([tx, ty], i) => { c.fillStyle = `rgba(255, 90, 110, ${(i + 1) / b.trail.length * 0.18})`; c.beginPath(); c.arc(tx, ty, ballR * (0.5 + i / b.trail.length * 0.4), 0, 7); c.fill(); });
      c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(b.x + 2, b.y + ballR * 0.9, ballR * 0.8, ballR * 0.35, 0, 0, 7); c.fill();
      const gr = c.createRadialGradient(b.x - ballR * 0.35, b.y - ballR * 0.4, ballR * 0.1, b.x, b.y, ballR);
      gr.addColorStop(0, '#fff4f4'); gr.addColorStop(0.35, `hsl(${350 + b.hue}, 95%, 62%)`); gr.addColorStop(1, `hsl(${345 + b.hue}, 90%, 32%)`);
      c.fillStyle = gr; c.beginPath(); c.arc(b.x, b.y, ballR, 0, 7); c.fill();
    }
  }

  rr(x, y, w, h, r) {
    const c = this.ctx;
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }

  destroy() {
    // balls still falling are paid out where they were headed
    this.balls.forEach((b) => { const win = Math.round(b.bet * b.mult); if (win > 0) { this.lastStake = b.bet; this.win(win); } });
    this.balls = [];
    this.queued = 0;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    super.destroy();
  }

  info() {
    const rows = RISK_IDS.map((r) => { const t = table(this.rows, r); return `<li><b>${RISKS[r].name}</b> : ×${fx2(t.m[0])} sur les bords, ×${fx2(t.m[this.rows / 2 | 0])} au centre · retour ${(t.rtp * 100).toFixed(1).replace('.', ',')} %</li>`; }).join('');
    return this.rules(`<h4>Règles</h4><p>Lâche une ou plusieurs billes : à chaque clou, elles partent à gauche ou à droite (une chance sur deux) et finissent dans une case. Ta mise est multipliée par la valeur de la case.</p>
      <p>Les cases du centre sont les plus fréquentes et paient peu ; celles des bords sont très rares et paient gros. Plus il y a de rangées, plus les bords sont rares et chers.</p>
      <h4>Avec ${this.rows} rangées</h4><ul class="rules">${rows}</ul>
      <p class="muted small">Tu peux relancer des billes pendant que les autres tombent. Le risque et le nombre de rangées se changent quand toutes les billes sont arrivées.</p>`);
  }
}

return { PlinkoGame };
})();
