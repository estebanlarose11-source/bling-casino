// SpinBet Casino · VortexGame — loaded on demand by games/impl/index.js (index.html).
// ---- games/impl/vortex.js ----
__mods['games/impl/vortex.js'] = (() => {
// Roue Rouge Noire: a big wheel of concentric spinning rings cut into red and black slots, seen face on. The bet
// ball drops from the top of the wheel straight down towards the centre: each ring stops under it, a red slot lets
// it fall to the next ring (bigger multiplier), a black slot blocks it and pays that ring. The share of red slots
// on each ring is exactly the chance to fall further (RTP ≈ 95 %).

const { BaseGame, fmtC, shortC } = __mods['core/base.js'];
const { EXTRA_THEMES } = __mods['core/music.js'];
const { sfx } = __mods['audio.js'];
const { fx } = __mods['fx.js'];

/* ===ENGINE */
const SEG = 24;
// Outer ring first. m: what a block on this ring pays (× the bet); red: open slots out of SEG.
const RINGS = [
  { m: 0, red: 11 }, { m: 1.2, red: 9 }, { m: 2, red: 7 }, { m: 4, red: 7 }, { m: 6, red: 7 },
  { m: 8, red: 7 }, { m: 12, red: 7 }, { m: 25, red: 5 }, { m: 60, red: 4 },
];
// One red slot of some rings carries a bonus that multiplies the final win when the ball goes through it.
const BONUS = [1, 2, 1, 2, 1, 4, 1, 2, 1];
const CENTER = 1000; // reaching the centre
const CAPX = 5000; // total multiplier cap
const RETRY_FROM = 3; // from the 4th ring a blocked ball can be re-spun for a price
const multAt = (i) => (i >= RINGS.length ? CENTER : RINGS[i].m);
const passes = (i) => Math.random() < RINGS[i].red / SEG;
const bonusHit = (i) => BONUS[i] > 1 && Math.random() < 1 / RINGS[i].red;
const VAL = {};
// Expected win (× the bet, cap included) for a ball arriving on ring i with bonus multiplier acc already collected.
function value(i, acc = 1) {
  if (i >= RINGS.length) return Math.min(CAPX, acc * CENTER);
  const key = `${i}:${acc}`;
  if (VAL[key] !== undefined) return VAL[key];
  const q = RINGS[i].red / SEG, b = BONUS[i] > 1 && RINGS[i].red ? 1 / RINGS[i].red : 0;
  const next = b * value(i + 1, acc * BONUS[i]) + (1 - b) * value(i + 1, acc);
  return (VAL[key] = (1 - q) * Math.min(CAPX, acc * RINGS[i].m) + q * next);
}
// Price (× the bet) to re-spin ring i: what the re-spin adds on average, sold at a 95 % return.
function retryPrice(i, acc) {
  const q = RINGS[i].red / SEG, b = BONUS[i] > 1 && RINGS[i].red ? 1 / RINGS[i].red : 0;
  const next = b * value(i + 1, acc * BONUS[i]) + (1 - b) * value(i + 1, acc);
  return (q * (next - Math.min(CAPX, acc * RINGS[i].m))) / 0.95;
}
const rtp = () => value(0);
/* ===END ENGINE */

const isRed = (n, k) => Math.floor(((k + 1) * n) / SEG) > Math.floor((k * n) / SEG); // red slots spread evenly
const redSlots = (i) => { const o = []; for (let k = 0; k < SEG; k++) if (isRed(RINGS[i].red, k)) o.push(k); return o; };
const bonusSlot = (i) => (BONUS[i] > 1 ? redSlots(i)[Math.floor(RINGS[i].red / 2)] : -1);
const xs = (m) => (m >= 100 ? m.toLocaleString('fr-FR') : String(m).replace('.', ','));
const ease = (t) => 1 - Math.pow(1 - t, 4); // long, readable crawl at the end of each ring's spin
const SLOT = (Math.PI * 2) / SEG, FRONT = -Math.PI / 2; // the ball sits at 12 o'clock on each ring
const ZOOM = 2.6; // camera zoom on the ball while a ring is decided

class VortexGame extends BaseGame {
  constructor(root, game) {
    super(root, game, {
      music: EXTRA_THEMES.vortex, mainLabel: 'LANCER',
      cls: 'table-game vortex',
      head: '<div class="vx-hist" aria-label="Derniers résultats"></div>',
      stage: '<div class="vx-board"><canvas class="vx-canvas"></canvas><div class="vx-offer" hidden></div></div>',
      below: `<div class="vx-ladder">${RINGS.map((g, i) => `<span data-lv="${i}">${i ? `×${xs(g.m)}` : 'Perdu'}</span>`).join('')}<span data-lv="${RINGS.length}" class="vx-top">×${xs(CENTER)}</span></div>`,
      hello: 'Choisis ta mise et lâche la bille sur la roue.',
    });
    this.rot = RINGS.map((_, i) => i * 0.7);
    this.spin = RINGS.map((_, i) => (i % 2 ? -1 : 1) * (0.22 + i * 0.05));
    this.hold = RINGS.map(() => null); // { from, d, dir, t0, T, done } while settling, true once stopped
    this.ball = null;
    this.glow = null; // lit slot under the ball: { i, red, t0 }
    this.focus = null; // ring being decided: the others are dimmed
    this.verdict = null; // label under the ball: { text, kind, t0 }
    this.cam = { z: 1, fx: 0, fy: 0 }; // camera: zoom z around the focus point (fx, fy)
    this.camTo = { z: 1, fx: 0, fy: 0 };
    this.hub = { main: `×${xs(CENTER)}`, sub: 'AU CENTRE', col: '#fde68a' };
    this.hist = [];
    this.canvas = this.q('.vx-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.ro = new ResizeObserver(() => this.layout());
    this.ro.observe(this.q('.vx-board'));
    this.frame = this.frame.bind(this);
    this.layout();
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  /* ---------- geometry and pre-rendered layers ---------- */
  layout() {
    const w = Math.max(260, this.q('.vx-board').clientWidth), R = Math.min(w * 0.46, 300);
    const cy = R + Math.max(34, R * 0.16), h = Math.round(cy + R + 16);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(h * dpr);
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const outer = R * 0.89, hubR = R * 0.215;
    this.geo = { w, h, cx: w / 2, cy, R, outer, hubR, step: (outer - hubR) / RINGS.length, dpr };
    this.buildLayers();
  }
  ringR(i) { return this.geo.outer - i * this.geo.step; }
  laneY(i) { return this.geo.cy - (this.ringR(i) + this.ringR(i + 1)) / 2; }

  // Each ring is drawn once into its own canvas (gradients, glow, bevels), then only rotated every frame.
  buildLayers() {
    const { R, dpr } = this.geo;
    this.layers = RINGS.map((g, i) => {
      const R0 = this.ringR(i) - 1.2, R1 = this.ringR(i + 1) + 1.2, size = Math.ceil((R0 + 12) * 2);
      const cv = document.createElement('canvas'); cv.width = size * dpr; cv.height = size * dpr;
      const c = cv.getContext('2d'); c.scale(dpr, dpr);
      const o = size / 2, gap = Math.min(0.03, 1.6 / R1);
      const bk = bonusSlot(i);
      for (let k = 0; k < SEG; k++) {
        const a0 = k * SLOT + gap / 2, a1 = (k + 1) * SLOT - gap / 2, red = isRed(g.red, k);
        const gr = c.createRadialGradient(o, o, R1, o, o, R0);
        if (k === bk) { gr.addColorStop(0, '#7c2d12'); gr.addColorStop(0.45, '#f59e0b'); gr.addColorStop(0.8, '#fde047'); gr.addColorStop(1, '#b45309'); } else if (red) { gr.addColorStop(0, '#8d0a1d'); gr.addColorStop(0.45, '#f0213f'); gr.addColorStop(0.8, '#ff4d63'); gr.addColorStop(1, '#a50d22'); } else { gr.addColorStop(0, '#050608'); gr.addColorStop(0.5, '#23262f'); gr.addColorStop(0.8, '#2e323c'); gr.addColorStop(1, '#0b0c10'); }
        c.save();
        if (red) { c.shadowColor = k === bk ? 'rgba(253, 224, 71, .9)' : 'rgba(255, 35, 64, .75)'; c.shadowBlur = 7; }
        c.beginPath(); c.arc(o, o, R0, a0, a1); c.arc(o, o, R1, a1, a0, true); c.closePath();
        c.fillStyle = gr; c.fill();
        c.restore();
        // glossy top edge
        c.beginPath(); c.arc(o, o, R0 - 1, a0 + 0.004, a1 - 0.004);
        c.strokeStyle = red ? 'rgba(255, 210, 215, .55)' : 'rgba(255, 255, 255, .14)'; c.lineWidth = 1.2; c.stroke();
        if (k === bk) { // bonus label, upright along the slot
          const mid = (a0 + a1) / 2, rm = (R0 + R1) / 2;
          c.save(); c.translate(o + Math.cos(mid) * rm, o + Math.sin(mid) * rm); c.rotate(mid + Math.PI / 2);
          c.font = `900 ${Math.max(8, (R0 - R1) * 0.5)}px Orbitron, Inter, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
          c.fillStyle = '#3b0a00'; c.fillText(`×${BONUS[i]}`, 0, 1); c.restore();
        }
      }
      return { cv, size };
    });
    // static frame: soft halo, dark metal rim with a thin gold bevel
    const size = Math.ceil(R * 2 + 40), cv = document.createElement('canvas');
    cv.width = size * dpr; cv.height = size * dpr;
    const c = cv.getContext('2d'); c.scale(dpr, dpr);
    const o = size / 2;
    const halo = c.createRadialGradient(o, o, R * 0.7, o, o, R + 20);
    halo.addColorStop(0, 'rgba(255, 35, 64, .25)'); halo.addColorStop(1, 'rgba(255, 35, 64, 0)');
    c.fillStyle = halo; c.fillRect(0, 0, size, size);
    const metal = c.createLinearGradient(0, o - R, 0, o + R);
    metal.addColorStop(0, '#3a3f4b'); metal.addColorStop(0.5, '#111318'); metal.addColorStop(1, '#2b2f38');
    c.beginPath(); c.arc(o, o, R, 0, 7); c.fillStyle = metal; c.fill();
    c.beginPath(); c.arc(o, o, R - 1, 0, 7); c.strokeStyle = 'rgba(253, 224, 71, .7)'; c.lineWidth = 1.5; c.stroke();
    c.beginPath(); c.arc(o, o, this.ringR(0) + 3, 0, 7); c.strokeStyle = 'rgba(253, 224, 71, .55)'; c.lineWidth = 1.5; c.stroke();
    c.beginPath(); c.arc(o, o, this.ringR(0) + 1.5, 0, 7); c.fillStyle = '#050507'; c.fill();
    this.frameLayer = { cv, size };
  }

  // Camera: dive onto the ball and its slot while a ring is decided, back to the whole wheel otherwise.
  zoomOn(i) { this.camTo = i == null ? { z: 1, fx: this.geo.cx, fy: this.geo.cy } : { z: ZOOM, fx: this.geo.cx, fy: this.laneY(i) }; }

  /* ---------- animation ---------- */
  frame(now) {
    if (this.dead) return;
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const k = Math.min(1, dt * (this.turbo ? 6 : 3.4)), cam = this.cam, to = this.camTo;
    cam.z += (to.z - cam.z) * k; cam.fx += ((to.fx || this.geo.cx) - cam.fx) * k; cam.fy += ((to.fy || this.geo.cy) - cam.fy) * k;
    RINGS.forEach((_, i) => {
      const h = this.hold[i];
      if (!h) this.rot[i] += this.spin[i] * dt;
      else if (h !== true) {
        const t = Math.min(1, (now - h.t0) / h.T), a = h.from + h.dir * h.d * ease(t);
        if (Math.floor((a - FRONT) / SLOT) !== Math.floor((this.rot[i] - FRONT) / SLOT)) sfx.tick();
        this.rot[i] = a;
        if (t >= 1) { this.hold[i] = true; h.done(); }
      }
    });
    const b = this.ball;
    if (b?.anim) {
      const a = b.anim, t = Math.min(1, (now - a.t0) / a.T);
      // gravity drop, then a small bounce on landing
      const fall = Math.min(1, t / 0.78), y = a.y0 + (a.y1 - a.y0) * fall * fall;
      const bt = Math.max(0, (t - 0.78) / 0.22), bounce = Math.sin(bt * Math.PI) * a.hop;
      b.y = y - bounce;
      b.trail.push(b.y); if (b.trail.length > 6) b.trail.shift();
      if (t >= 1) { b.y = a.y1; b.anim = null; a.done(); }
    } else if (b) { b.trail.push(b.y); if (b.trail.length > 6) b.trail.shift(); }
    this.draw(now);
    this.raf = requestAnimationFrame(this.frame);
  }

  dropBall(y1, T, hop) {
    const b = this.ball;
    return new Promise((done) => { b.anim = { y0: b.y, y1, t0: performance.now(), T: this.turbo ? T * 0.55 : T, hop, done }; });
  }

  // Spins ring i on to rest with a slot of the wanted kind ('black', 'red' or 'bonus') under the ball (12 o'clock).
  settle(i, kind) {
    const bk = bonusSlot(i), opts = [];
    for (let k = 0; k < SEG; k++) {
      const red = isRed(RINGS[i].red, k);
      if (kind === 'bonus' ? k === bk : kind === 'red' ? red && k !== bk : !red) opts.push(k);
    }
    const k = opts[Math.floor(Math.random() * opts.length)], dir = Math.sign(this.spin[i]);
    const target = FRONT - (k + 0.5) * SLOT, from = this.rot[i];
    let d = (((target - from) * dir) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    d += Math.PI * 2; // one whole extra turn: the chosen slot ends exactly under the ball
    return new Promise((done) => { this.hold[i] = { from, d, dir, t0: performance.now(), T: this.turbo ? 1000 : 1900, done }; });
  }

  ladder(lv, cls) {
    this.qa('.vx-ladder span').forEach((n) => n.classList.remove('on', 'hit', 'lost'));
    if (lv != null) this.q(`.vx-ladder [data-lv="${lv}"]`)?.classList.add(cls || 'on');
  }

  // Shows the colour the ball landed on, with a short pause so it can be read.
  async announce(kind, acc) {
    this.verdict = { kind, t0: performance.now(), text: kind === 'black' ? 'NOIR · BLOQUÉE' : kind === 'bonus' ? `BONUS ×${acc} ↓` : 'ROUGE ↓' };
    if (kind === 'black') sfx.puff(); else if (kind === 'bonus') sfx.upgrade(); else sfx.coin();
    await this.wait(kind === 'black' ? 700 : 750);
  }

  // From the 4th ring a blocked ball can be re-spun: resolves true to pay and re-spin, false to cash in.
  offerRetry(win, price) {
    if (this.auto > 0 || this.balC() < price) return Promise.resolve(false);
    const box = this.q('.vx-offer');
    box.innerHTML = `<b>Bloquée !</b><small>Encaisse ou paie pour relancer cet anneau : rouge, la bille continue ; noir, tu gardes ton gain.</small>
      <div><button type="button" class="btn ghost" data-v="0">Encaisser ${fmtC(win)}</button><button type="button" class="btn primary" data-v="1">Relancer · ${fmtC(price)}</button></div>`;
    box.hidden = false;
    return new Promise((res) => {
      box.querySelectorAll('[data-v]').forEach((n) => { n.onclick = () => { box.hidden = true; res(n.dataset.v === '1'); }; });
    });
  }

  onMain() {
    this.round(async () => {
      const bet = this.bet;
      if (!this.pay(bet)) return;
      this.lastStake = bet;
      this.setLast(0); this.winAmt.textContent = '';
      this.hold = RINGS.map(() => null);
      this.glow = null; this.verdict = null;
      this.hub = { main: fmtC(bet), sub: 'MISE', col: '#fff' };
      this.msg('La bille tombe…');
      this.ball = { x: this.geo.cx, y: this.geo.cy - this.geo.R - 26, lv: 0, trail: [] };
      sfx.spin();
      await this.dropBall(this.laneY(0), 620, 7);
      let i = 0, acc = 1;
      while (i < RINGS.length && !this.dead) {
        this.ball.lv = i;
        this.focus = i;
        this.ladder(i);
        this.verdict = null;
        sfx.land();
        this.zoomOn(i);
        const goes = passes(i), kind = goes ? (bonusHit(i) ? 'bonus' : 'red') : 'black';
        await this.settle(i, kind);
        if (this.dead) return;
        this.glow = { i, red: goes, t0: performance.now() };
        if (kind === 'bonus') acc *= BONUS[i];
        await this.announce(kind, BONUS[i]);
        if (this.dead) return;
        if (goes) {
          this.hub = { main: `×${xs(Math.min(CAPX, acc * multAt(i + 1)))}`, sub: acc > 1 ? `BONUS ×${acc}` : (i + 1 < RINGS.length ? 'EN COURS' : 'JACKPOT'), col: acc > 1 ? '#fde047' : '#ff4d63' };
          this.hold[i] = null;
          this.verdict = null;
          if (i + 1 >= RINGS.length) this.zoomOn(null);
          await this.dropBall(i + 1 < RINGS.length ? this.laneY(i + 1) : this.geo.cy, 380, 4);
          i++;
          continue;
        }
        if (i >= RETRY_FROM) {
          const win = Math.round(bet * Math.min(CAPX, acc * multAt(i))), price = Math.ceil(bet * retryPrice(i, acc));
          this.focus = null;
          this.zoomOn(null);
          this.hub = { main: `+${fmtC(win)}`, sub: 'OU RELANCE ?', col: '#fde047' };
          this.msg(`Bloquée sur ×${xs(multAt(i))}${acc > 1 ? ` (bonus ×${acc})` : ''}. Encaisser ou relancer ?`);
          if (await this.offerRetry(win, price) && this.pay(price)) {
            this.msg('Relance de l’anneau…');
            this.glow = null; this.verdict = null;
            this.hold[i] = null;
            await this.wait(350);
            continue;
          }
        }
        break;
      }
      if (this.dead) return;
      this.focus = null;
      this.zoomOn(null);
      await this.wait(this.turbo ? 250 : 450);
      this.land(i, bet, acc);
    });
  }

  land(stop, bet, acc) {
    const m = Math.min(CAPX, acc * multAt(stop)), win = Math.round(bet * m);
    this.ladder(stop, win > 0 ? 'hit' : 'lost');
    this.hist.unshift(m); this.hist = this.hist.slice(0, 10);
    this.q('.vx-hist').innerHTML = this.hist.map((x) => `<span class="${x === 0 ? 'z' : x >= 8 ? 'hot' : ''}">${x ? `×${xs(x)}` : '✕'}</span>`).join('');
    const r = this.canvas.getBoundingClientRect();
    if (win > 0) {
      this.verdict = null;
      this.hub = { main: `+${fmtC(win)}`, sub: `GAGNÉ · ×${xs(m)}`, col: '#fde047', big: true };
      this.win(win);
      this.setLast(win);
      this.msg(`${stop >= RINGS.length ? 'CENTRE DE LA ROUE ! ' : ''}×${xs(m)}${acc > 1 ? ` (bonus ×${acc})` : ''} · +${fmtC(win)}`);
      fx.burst(r.left + this.geo.cx, r.top + this.geo.cy, m >= 8 ? 60 : 24, ['#fde047', '#ff2340', '#fff'], m >= 8 ? 10 : 6);
      if (m >= 12) { this.flash('rgba(255,35,64,.4)'); this.celebrate(win, { summary: stop >= RINGS.length ? 'CENTRE DE LA ROUE' : null }); } else if (m >= 2) sfx.win(); else sfx.coin();
    } else {
      this.hub = { main: 'PERDU', sub: `MISE ${fmtC(bet)}`, col: '#9ca3af' };
      this.msg(`Case noire : la bille est bloquée. Tu perds ${fmtC(bet)}.`);
    }
  }

  /* ---------- drawing ---------- */
  draw(now) {
    const c = this.ctx, { w, h, cx, cy, R, hubR } = this.geo, pulse = 0.5 + 0.5 * Math.sin(now / 260);
    c.clearRect(0, 0, w, h);
    // camera: zoom around the focus point, which slides towards the middle of the view as it zooms in
    const cam = this.cam, z = cam.z, zt = Math.max(0, (z - 1) / (ZOOM - 1));
    const sx = cam.fx + (w / 2 - cam.fx) * zt, sy = cam.fy + (h * 0.46 - cam.fy) * zt;
    c.save(); c.translate(sx, sy); c.scale(z, z); c.translate(-cam.fx, -cam.fy);
    const F = this.frameLayer;
    c.drawImage(F.cv, cx - F.size / 2, cy - F.size / 2, F.size, F.size);
    // bulbs chasing round the rim, gold and red
    const nL = 36, rl = (R + this.ringR(0) + 3) / 2, br = Math.max(2.2, (R - this.ringR(0)) * 0.2), step = Math.floor(now / 110);
    for (let k = 0; k < nL; k++) {
      const a = (k / nL) * Math.PI * 2 - Math.PI / 2, x = cx + Math.cos(a) * rl, y = cy + Math.sin(a) * rl;
      const on = (step + k) % 4 === 0 || (this.busy && (step + k) % 2 === 0), col = k % 2 ? '255, 70, 90' : '255, 214, 120';
      const g = c.createRadialGradient(x, y, 0, x, y, br * (on ? 2.6 : 1.4));
      g.addColorStop(0, on ? '#fffaf0' : `rgba(${col}, .45)`); g.addColorStop(0.35, `rgba(${col}, ${on ? 0.95 : 0.35})`); g.addColorStop(1, `rgba(${col}, 0)`);
      c.fillStyle = g; c.beginPath(); c.arc(x, y, br * (on ? 2.6 : 1.4), 0, 7); c.fill();
    }
    // rings
    this.layers.forEach((L, i) => {
      c.save(); c.translate(cx, cy); c.rotate(this.rot[i]);
      if (z > 1.05 && i === this.focus) this.ringVector(i); // close up: redraw the decided ring sharp
      else c.drawImage(L.cv, -L.size / 2, -L.size / 2, L.size, L.size);
      c.restore();
    });
    // the ring being decided stays bright, the others dim
    if (this.focus != null) {
      const R0 = this.ringR(this.focus), R1 = this.ringR(this.focus + 1);
      const ring = (ro, ri) => { if (ro - ri < 1) return; c.beginPath(); c.arc(cx, cy, ro, 0, Math.PI * 2); c.moveTo(cx + ri, cy); c.arc(cx, cy, ri, Math.PI * 2, 0, true); c.fill(); };
      c.fillStyle = 'rgba(3, 3, 6, .55)';
      ring(this.ringR(0) + 0.5, R0 + 0.5);
      ring(R1 - 0.5, hubR);
    }
    // lit slot under the ball
    if (this.glow) {
      const g = this.glow, age = (now - g.t0) / 1000, a = g.red ? Math.max(0, 1 - age * 1.6) : 0.55 + 0.35 * pulse;
      if (a > 0) {
        const R0 = this.ringR(g.i), R1 = this.ringR(g.i + 1);
        c.save(); c.shadowColor = g.red ? '#ff2340' : '#ffffff'; c.shadowBlur = 18;
        c.beginPath(); c.arc(cx, cy, R0 - 1, FRONT - SLOT / 2, FRONT + SLOT / 2); c.arc(cx, cy, R1 + 1, FRONT + SLOT / 2, FRONT - SLOT / 2, true); c.closePath();
        c.fillStyle = g.red ? `rgba(255, 90, 110, ${0.65 * a})` : `rgba(255, 255, 255, ${0.28 * a})`; c.fill();
        c.strokeStyle = g.red ? `rgba(255, 220, 225, ${a})` : `rgba(255, 255, 255, ${a})`; c.lineWidth = 2; c.stroke();
        c.restore();
      }
    }
    // glass lane at 12 o'clock with the multiplier of each ring beside it
    const laneW = this.geo.step * 0.62, top = cy - this.ringR(0);
    const lg = c.createLinearGradient(cx - laneW, 0, cx + laneW, 0);
    lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.5, 'rgba(255,255,255,.10)'); lg.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = lg; c.fillRect(cx - laneW, top, laneW * 2, this.ringR(0) - hubR);
    const fs = Math.max(9, Math.min(12, this.geo.step * 0.4));
    c.font = `700 ${fs}px Inter, system-ui, sans-serif`; c.textBaseline = 'middle'; c.textAlign = 'left';
    c.save(); c.globalAlpha = Math.max(0, 1 - zt * 1.6); // the lane labels fade out in close-up (the ladder stays below)
    for (let i = 0; i < RINGS.length; i++) {
      const y = this.laneY(i), cur = this.ball && this.ball.lv === i, t = i ? `×${xs(RINGS[i].m)}` : '✕';
      const tw = c.measureText(t).width + 10, x = cx + laneW + 4;
      c.fillStyle = cur ? 'rgba(255, 35, 64, .9)' : 'rgba(5, 6, 9, .72)';
      this.pill(x, y - fs * 0.85, tw, fs * 1.7, fs * 0.85); c.fill();
      c.fillStyle = cur ? '#fff' : 'rgba(255,255,255,.78)'; c.fillText(t, x + 5, y + 0.5);
    }
    c.restore();
    // hub: glass disc that shows the bet, the running multiplier, then the result
    c.save(); c.shadowColor = 'rgba(0,0,0,.7)'; c.shadowBlur = 16;
    const hg = c.createRadialGradient(cx - hubR * 0.3, cy - hubR * 0.4, hubR * 0.1, cx, cy, hubR);
    hg.addColorStop(0, '#2c303a'); hg.addColorStop(1, '#07080b');
    c.fillStyle = hg; c.beginPath(); c.arc(cx, cy, hubR - 2, 0, 7); c.fill(); c.restore();
    c.beginPath(); c.arc(cx, cy, hubR - 2, 0, 7); c.strokeStyle = 'rgba(253, 224, 71, .8)'; c.lineWidth = 2; c.stroke();
    c.beginPath(); c.arc(cx, cy - hubR * 0.15, hubR * 0.8, Math.PI * 1.1, Math.PI * 1.9); c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = hubR * 0.12; c.stroke();
    const hb = this.hub, mainSize = Math.min(hubR * (hb.big ? 0.42 : 0.5), (hubR * 1.7) / Math.max(3, hb.main.length * 0.62));
    c.textAlign = 'center'; c.fillStyle = hb.col;
    c.save(); if (hb.big) { c.shadowColor = hb.col; c.shadowBlur = 14 * pulse + 4; }
    c.font = `900 ${mainSize}px Orbitron, Inter, sans-serif`; c.fillText(hb.main, cx, cy - hubR * 0.06); c.restore();
    c.font = `700 ${Math.max(8, hubR * 0.15)}px Inter, sans-serif`; c.fillStyle = 'rgba(255,255,255,.6)';
    c.fillText(hb.sub, cx, cy + hubR * 0.38);
    // drop marker
    c.fillStyle = '#fde047'; c.beginPath(); c.moveTo(cx - 8, cy - R - 2); c.lineTo(cx + 8, cy - R - 2); c.lineTo(cx, cy - R + 9); c.closePath(); c.fill();
    // chrome ball
    const b = this.ball;
    if (b) {
      const r = Math.max(6, this.geo.step * 0.3);
      b.trail.forEach((ty, k) => { c.fillStyle = `rgba(255, 255, 255, ${((k + 1) / b.trail.length) * 0.12})`; c.beginPath(); c.arc(b.x, ty, r * (0.6 + (k / b.trail.length) * 0.3), 0, 7); c.fill(); });
      c.fillStyle = 'rgba(0,0,0,.45)'; c.beginPath(); c.ellipse(b.x + r * 0.25, b.y + r * 0.55, r * 0.9, r * 0.45, 0, 0, 7); c.fill();
      const bg = c.createRadialGradient(b.x - r * 0.35, b.y - r * 0.4, r * 0.05, b.x, b.y, r);
      bg.addColorStop(0, '#ffffff'); bg.addColorStop(0.3, '#e5e7eb'); bg.addColorStop(0.7, '#6b7280'); bg.addColorStop(1, '#1f2937');
      c.fillStyle = bg; c.beginPath(); c.arc(b.x, b.y, r, 0, 7); c.fill();
      c.fillStyle = 'rgba(255,255,255,.9)'; c.beginPath(); c.arc(b.x - r * 0.35, b.y - r * 0.38, r * 0.22, 0, 7); c.fill();
    }
    c.restore();
    // verdict label, in screen space just under the ball
    const v = this.verdict;
    if (v && b) {
      const age = (now - v.t0) / 1000, k = Math.min(1, age * 6), fsz = Math.max(13, Math.min(18, w * 0.03));
      c.font = `900 ${fsz}px Orbitron, Inter, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
      const tw = c.measureText(v.text).width + 26, x = sx + (b.x - cam.fx) * z, y = sy + (b.y - cam.fy) * z + Math.max(6, this.geo.step * 0.3) * z + fsz * 1.6;
      c.save(); c.globalAlpha = k; c.translate(x, y); c.scale(0.8 + 0.2 * k, 0.8 + 0.2 * k);
      c.shadowColor = v.kind === 'black' ? 'rgba(255,255,255,.6)' : v.kind === 'bonus' ? '#fde047' : '#ff2340'; c.shadowBlur = 18;
      c.fillStyle = v.kind === 'black' ? '#f8fafc' : v.kind === 'bonus' ? '#fbbf24' : '#e11d48';
      this.pill(-tw / 2, -fsz * 1.05, tw, fsz * 2.1, fsz * 1.05); c.fill();
      c.shadowBlur = 0; c.fillStyle = v.kind === 'black' ? '#0b0b0f' : v.kind === 'bonus' ? '#3b0a00' : '#fff';
      c.fillText(v.text, 0, 1); c.restore();
    }
  }

  // Sharp vector version of ring i (used when the camera is close); same look as its pre-rendered layer.
  ringVector(i) {
    const c = this.ctx, g = RINGS[i], R0 = this.ringR(i) - 1.2, R1 = this.ringR(i + 1) + 1.2, gap = Math.min(0.03, 1.6 / R1), bk = bonusSlot(i);
    for (let k = 0; k < SEG; k++) {
      const a0 = k * SLOT + gap / 2, a1 = (k + 1) * SLOT - gap / 2, red = isRed(g.red, k);
      const gr = c.createRadialGradient(0, 0, R1, 0, 0, R0);
      if (k === bk) { gr.addColorStop(0, '#7c2d12'); gr.addColorStop(0.45, '#f59e0b'); gr.addColorStop(0.8, '#fde047'); gr.addColorStop(1, '#b45309'); } else if (red) { gr.addColorStop(0, '#8d0a1d'); gr.addColorStop(0.45, '#f0213f'); gr.addColorStop(0.8, '#ff4d63'); gr.addColorStop(1, '#a50d22'); } else { gr.addColorStop(0, '#050608'); gr.addColorStop(0.5, '#23262f'); gr.addColorStop(0.8, '#2e323c'); gr.addColorStop(1, '#0b0c10'); }
      c.beginPath(); c.arc(0, 0, R0, a0, a1); c.arc(0, 0, R1, a1, a0, true); c.closePath();
      c.fillStyle = gr; c.fill();
      c.beginPath(); c.arc(0, 0, R0 - 1, a0 + 0.004, a1 - 0.004);
      c.strokeStyle = red ? 'rgba(255, 210, 215, .55)' : 'rgba(255, 255, 255, .14)'; c.lineWidth = 1.2; c.stroke();
      if (k === bk) {
        const mid = (a0 + a1) / 2, rm = (R0 + R1) / 2;
        c.save(); c.translate(Math.cos(mid) * rm, Math.sin(mid) * rm); c.rotate(mid + Math.PI / 2);
        c.font = `900 ${Math.max(8, (R0 - R1) * 0.5)}px Orbitron, Inter, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillStyle = '#3b0a00'; c.fillText(`×${BONUS[i]}`, 0, 1); c.restore();
      }
    }
  }

  pill(x, y, w, h, r) {
    const c = this.ctx;
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }

  destroy() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    super.destroy();
  }

  info() {
    const rows = RINGS.map((g, i) => `<li>Anneau ${i + 1} : ${i ? `arrêt = <b>×${xs(g.m)}</b>` : 'arrêt = <b>perdu</b>'} · ${g.red} cases rouges sur ${SEG}${BONUS[i] > 1 ? ` dont une bonus ×${BONUS[i]}` : ''}</li>`).join('');
    return this.rules(`<h4>Règles</h4><p>Ta mise tombe dans une bille en haut de la roue. Chaque anneau tourne puis s’arrête sous la bille : sur une <b>case rouge</b>, elle tombe vers l’anneau suivant ; sur une <b>case noire</b>, elle est bloquée et tu gagnes le multiplicateur de cet anneau.</p>
      <p>Plus la bille se rapproche du centre, plus le multiplicateur monte et moins il y a de rouge. Au centre : <b>×${xs(CENTER)}</b>.</p>
      <h4>Cases bonus</h4><p>Sur certains anneaux, une case dorée porte un bonus (×2 ou ×4). Si la bille passe par elle, ton gain final est multiplié d’autant. Gain maximum ×${CAPX.toLocaleString('fr-FR')}.</p>
      <h4>Relance</h4><p>À partir du ${RETRY_FROM + 1}<sup>e</sup> anneau, quand la bille est bloquée, tu peux <b>encaisser</b> ou <b>payer pour relancer</b> cet anneau. Rouge : la bille continue sa descente. Noir : tu gardes ton gain, mais le prix de la relance est perdu. Le prix dépend de l’anneau et des bonus déjà gagnés.</p>
      <h4>Les anneaux, de l’extérieur vers le centre</h4><ul class="rules">${rows}<li>Centre de la roue : <b>×${xs(CENTER)}</b></li></ul>
      <p class="muted small">La proportion de cases rouges sur chaque anneau est exactement la chance de descendre. Retour théorique ${(rtp() * 100).toFixed(1).replace('.', ',')} %.</p>`);
  }
}

return { VortexGame };
})();
