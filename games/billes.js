// SpinBet Casino · BillesGame — loaded on demand by games/impl/index.js (index.html).
// ---- games/impl/billes.js ----
__mods['games/impl/billes.js'] = (() => {
// La Descente: five marbles race down a vertical course (funnels, bumpers, windmills, see-saws, boost and mud
// zones) in 2D physics. Before each race every marble gets a chance to win (its form) and its odds = 0,95 / chance.
// When the race starts, the winner is drawn from those chances and one race is simulated; the marbles are identical,
// so the drawn marble takes the colour of that race's winner. The recorded race is played back. Returns ≈ 95 %.

const { BaseGame, fmtC } = __mods['core/base.js'];
const { BetBoard } = __mods['core/roulette.js'];
const { EXTRA_THEMES } = __mods['core/music.js'];
const { sfx } = __mods['audio.js'];
const { fx, sleep, center } = __mods['fx.js'];

/* ===ENGINE */
const NM = 5; // marbles
const W = 360, R = 9; // world width, marble radius
const FPS = 60, SUB = 3, DT = 1 / (FPS * SUB);
const GRAV = 420, VMAX = 520, AIR = 0.9996;
const mulberry = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// The course, top to bottom. seg: wall [x1,y1,x2,y2]; peg: [x,y,r,bounce]; rot: rotating bar [cx,cy,len,speed];
// tilt: see-saw [cx,cy,len,amp,period]; zone: [x,y,w,h,kind] (boost / mud); FIN: finish line.
function makeCourse() {
  const seg = [], peg = [], rot = [], tilt = [], zone = [];
  let y = 0;
  const funnel = (y0, gap) => { seg.push([0, y0, W / 2 - gap / 2, y0 + 120], [W, y0, W / 2 + gap / 2, y0 + 120]); };
  const pegs = (y0, rows, bouncy) => {
    for (let r = 0; r < rows; r++) for (let c = 0; c < 7; c++) {
      const x = 30 + c * 50 + (r % 2 ? 25 : 0);
      if (x > W - 20) continue;
      peg.push([x, y0 + r * 46, bouncy && (r + c) % 4 === 0 ? 11 : 7, bouncy && (r + c) % 4 === 0 ? 1.25 : 0.55]);
    }
  };
  const zig = (y0, n) => {
    for (let k = 0; k < n; k++) {
      const yy = y0 + k * 110;
      if (k % 2) seg.push([W, yy, 70, yy + 90]); else seg.push([0, yy, W - 70, yy + 90]);
    }
  };
  // 1. start + funnel
  funnel(60, 46); y = 200;
  // 2. pin field with bumpers
  pegs(y + 20, 9, true); y += 460;
  // 3. windmills
  rot.push([W * 0.3, y + 70, 110, 1.6], [W * 0.7, y + 70, 110, -1.9], [W * 0.5, y + 210, 150, 1.2]); y += 300;
  // 4. zig-zag ramps with a boost and a mud patch
  zig(y, 6); zone.push([0, y + 40, W, 70, 'boost'], [0, y + 370, W, 80, 'mud']); y += 700;
  // 5. see-saws
  tilt.push([W * 0.32, y + 40, 150, 0.45, 2.6], [W * 0.68, y + 140, 150, 0.45, 3.1]); y += 240;
  // 6. bottleneck + second pin field
  funnel(y, 34); y += 150;
  pegs(y + 10, 8, true); y += 400;
  // 7. last windmill, zig-zag and the mud straight
  rot.push([W * 0.5, y + 60, 170, -2.2]); y += 160;
  zig(y, 4); zone.push([0, y + 300, W, 70, 'boost']); y += 470;
  zone.push([0, y, W, 160, 'mud']); y += 200;
  return { seg, peg, rot, tilt, zone, FIN: y, H: y + 80 };
}
const COURSE = makeCourse();
const rotSeg = (r, t) => { const a = r[3] * t; const dx = Math.cos(a) * r[2] / 2, dy = Math.sin(a) * r[2] / 2; return [r[0] - dx, r[1] - dy, r[0] + dx, r[1] + dy]; };
const tiltSeg = (k, t) => { const a = k[3] * Math.sin((2 * Math.PI * t) / k[4]); const dx = Math.cos(a) * k[2] / 2, dy = Math.sin(a) * k[2] / 2; return [k[0] - dx, k[1] - dy, k[0] + dx, k[1] + dy]; };

// One full race from a seed: positions recorded every frame, finish order.
function simulate(seed, maxT = 75) {
  const rnd = mulberry(seed), C = COURSE;
  const m = Array.from({ length: NM }, (_, i) => ({ x: 70 + i * 55 + (rnd() - 0.5) * 20, y: 20 + rnd() * 10, vx: (rnd() - 0.5) * 40, vy: 0, still: 0, done: false, t: 0 }));
  const frames = [], order = [];
  let t = 0;
  const hitSeg = (b, s, sv, e) => {
    const [x1, y1, x2, y2] = s, dx = x2 - x1, dy = y2 - y1, L2 = dx * dx + dy * dy;
    let u = ((b.x - x1) * dx + (b.y - y1) * dy) / L2; u = u < 0 ? 0 : u > 1 ? 1 : u;
    const px = x1 + u * dx, py = y1 + u * dy, ox = b.x - px, oy = b.y - py, d2 = ox * ox + oy * oy;
    if (d2 >= R * R || d2 === 0) return;
    const d = Math.sqrt(d2), nx = ox / d, ny = oy / d;
    b.x = px + nx * R; b.y = py + ny * R;
    const svx = sv ? sv(px, py)[0] : 0, svy = sv ? sv(px, py)[1] : 0;
    const rvx = b.vx - svx, rvy = b.vy - svy, vn = rvx * nx + rvy * ny;
    if (vn < 0) { b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny; b.vx = svx + (b.vx - svx) * 0.995; }
  };
  for (let step = 0; t < maxT; step++) {
    t += DT;
    for (const b of m) {
      if (b.done) continue;
      b.vy += GRAV * DT;
      // zones
      for (const z of C.zone) if (b.x > z[0] && b.x < z[0] + z[2] && b.y > z[1] && b.y < z[1] + z[3]) { if (z[4] === 'mud') { b.vx *= 0.992; b.vy *= 0.992; } else { b.vy += 520 * DT; b.vx *= 1.002; } }
      b.vx *= AIR; b.vy *= AIR;
      const sp = Math.hypot(b.vx, b.vy); if (sp > VMAX) { b.vx *= VMAX / sp; b.vy *= VMAX / sp; }
      b.x += b.vx * DT; b.y += b.vy * DT;
      for (const s of C.seg) hitSeg(b, s, null, 0.35);
      for (const r of C.rot) { const s = rotSeg(r, t); hitSeg(b, s, (px, py) => [-r[3] * (py - r[1]), r[3] * (px - r[0])], 0.4); }
      for (const k of C.tilt) { const s = tiltSeg(k, t), w = k[3] * Math.cos((2 * Math.PI * t) / k[4]) * (2 * Math.PI / k[4]); hitSeg(b, s, (px, py) => [-w * (py - k[1]), w * (px - k[0])], 0.3); }
      for (const p of C.peg) {
        const ox = b.x - p[0], oy = b.y - p[1], rr = R + p[2], d2 = ox * ox + oy * oy;
        if (d2 < rr * rr && d2 > 0) {
          const d = Math.sqrt(d2), nx = ox / d, ny = oy / d; b.x = p[0] + nx * rr; b.y = p[1] + ny * rr;
          const vn = b.vx * nx + b.vy * ny;
          if (vn < 0) { b.vx -= (1 + p[3]) * vn * nx; b.vy -= (1 + p[3]) * vn * ny; b.vx += (rnd() - 0.5) * 12; }
        }
      }
      if (b.x < R) { b.x = R; b.vx = Math.abs(b.vx) * 0.5; }
      if (b.x > W - R) { b.x = W - R; b.vx = -Math.abs(b.vx) * 0.5; }
      // stuck: a little nudge
      if (Math.abs(b.vx) + Math.abs(b.vy) < 8) { b.still += DT; if (b.still > 1.2) { b.vx += (rnd() - 0.5) * 160; b.vy -= 60; b.still = 0; } } else b.still = 0;
      if (b.y >= C.FIN) { b.done = true; b.t = t; order.push(m.indexOf(b)); }
    }
    // marble against marble
    for (let i = 0; i < NM; i++) for (let j = i + 1; j < NM; j++) {
      const a = m[i], c = m[j]; if (a.done || c.done) continue;
      const ox = c.x - a.x, oy = c.y - a.y, d2 = ox * ox + oy * oy;
      if (d2 < 4 * R * R && d2 > 0) {
        const d = Math.sqrt(d2), nx = ox / d, ny = oy / d, ov = (2 * R - d) / 2;
        a.x -= nx * ov; a.y -= ny * ov; c.x += nx * ov; c.y += ny * ov;
        const vn = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny;
        if (vn < 0) { const k = -0.9 * vn; a.vx -= k * nx; a.vy -= k * ny; c.vx += k * nx; c.vy += k * ny; }
      }
    }
    if (step % SUB === SUB - 1) { const f = new Float32Array(NM * 2); m.forEach((b, i) => { f[i * 2] = b.x; f[i * 2 + 1] = Math.min(b.y, C.FIN + 40); }); frames.push(f); }
    if (order.length === NM) break;
    if (order.length && t > m[order[0]].t + 6) { // the others get placed by how far they are
      m.map((b, i) => [i, b.y]).filter(([i]) => !order.includes(i)).sort((a, b) => b[1] - a[1]).forEach(([i]) => order.push(i));
      break;
    }
  }
  return { frames, order, time: order.length ? m[order[0]].t : maxT, done: order.length === NM };
}
// Chance of each marble this race (its "form"), and the odds paid (× the stake, stake included) for a 95 % return.
function makeForm(rnd = Math.random) {
  const w = Array.from({ length: NM }, () => 0.45 + rnd() * 1.6), s = w.reduce((a, b) => a + b, 0);
  const p = w.map((x) => x / s);
  return { p, odds: p.map((x) => Math.floor((0.95 / x) * 100) / 100) };
}
/* ===END ENGINE */

const BALLS = [
  { k: 'b0', name: 'Rouge', c: '#ef4444', d: '#7f1d1d' },
  { k: 'b1', name: 'Bleue', c: '#3b82f6', d: '#1e3a8a' },
  { k: 'b2', name: 'Verte', c: '#22c55e', d: '#14532d' },
  { k: 'b3', name: 'Jaune', c: '#facc15', d: '#854d0e' },
  { k: 'b4', name: 'Violette', c: '#a855f7', d: '#581c87' },
];
const xs = (m) => m.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pickW = (p) => { let r = Math.random(); for (let i = 0; i < p.length; i++) { if (r < p[i]) return i; r -= p[i]; } return p.length - 1; };
const ballCSS = (b) => `background:radial-gradient(circle at 35% 30%, #fff, ${b.c} 38%, ${b.d})`;

class BillesGame extends BaseGame {
  constructor(root, game) {
    super(root, game, {
      music: EXTRA_THEMES.billes, stepper: false, autoplay: true, mainLabel: 'LANCER LA COURSE', betLabel: 'Mise totale',
      cls: 'table-game billes',
      head: '<div class="hist pt-hist mb-hist"></div>',
      stage: `<div class="mb-view"><canvas class="mb-cv"></canvas>
          <div class="mb-rank"></div><div class="mb-prog"><i class="mb-fin">🏁</i></div><div class="mb-time"></div>
          <div class="mb-count" hidden></div><div class="mb-win" hidden></div></div>`,
      below: `<div class="felt mb-felt"><div class="mb-spots">${BALLS.map((b) => `<button class="mb-spot" data-k="${b.k}" style="--bc:${b.c}"><i class="mb-ball" style="${ballCSS(b)}"></i><b>${b.name}</b><small class="mb-odd">—</small><em class="mb-form"><i></i></em></button>`).join('')}</div>
        <p class="pt-note">🏁<span>Mise sur une ou plusieurs billes. La première en bas gagne : ta mise est payée <b>× sa cote</b>. La cote change à chaque course selon la forme des billes.</span></p>${BetBoard.chipsHTML()}</div>`,
      hello: 'Choisis ta ou tes billes, pose tes jetons et lance la course !',
    });
    this.histArr = [];
    this.board = new BetBoard(this, this.q('.mb-felt'), null);
    this.cv = this.q('.mb-cv'); this.ctx = this.cv.getContext('2d');
    this.newForm();
    this.board.paint();
    this.cam = 0; this.frame = null; this.trails = BALLS.map(() => []);
    this.ro = new ResizeObserver(() => this.draw(this.frame, this.lastT || 0));
    this.ro.observe(this.cv);
    this.idle();
  }

  destroy() { this.ro?.disconnect(); cancelAnimationFrame(this.raf); super.destroy(); }
  stakeLabel() { return this.board ? this.board.total() : 0; }
  chipSound() { sfx.click(); }
  onMeters() { if (this.mainBtn) this.mainBtn.disabled = !this.auto && (this.busy || !this.board?.total()); }

  // New form and odds for the next race, shown on the bet spots.
  newForm() {
    this.form = makeForm();
    const max = Math.max(...this.form.p);
    BALLS.forEach((b, i) => {
      const s = this.q(`.mb-spot[data-k="${b.k}"]`);
      s.querySelector('.mb-odd').textContent = `cote ×${xs(this.form.odds[i])}`;
      s.querySelector('.mb-form i').style.width = `${Math.round((this.form.p[i] / max) * 100)}%`;
      s.title = `Chance de gagner : ${Math.round(this.form.p[i] * 100)} %`;
    });
  }

  // Start grid shown between races: marbles waiting at the top.
  idle() {
    const f = new Float32Array(NM * 2);
    for (let i = 0; i < NM; i++) { f[i * 2] = 70 + i * 55; f[i * 2 + 1] = 24; }
    this.frame = f; this.cam = 0; this.trails = BALLS.map(() => []);
    this.draw(f, 0);
    this.paintRank([0, 1, 2, 3, 4], f);
  }

  /* ---------- drawing ---------- */
  draw(f, t) {
    if (!f || this.dead) return;
    const cv = this.cv, dpr = Math.min(2, devicePixelRatio || 1), cw = cv.clientWidth, ch = cv.clientHeight;
    if (!cw) return;
    if (cv.width !== Math.round(cw * dpr)) { cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr); }
    const g = this.ctx, s = cw / W, C = COURSE, viewH = ch / s;
    // camera follows the leader (lowest marble still racing), smoothly
    let lead = 0; for (let i = 0; i < NM; i++) lead = Math.max(lead, f[i * 2 + 1]);
    const target = Math.max(0, Math.min(C.H - viewH, lead - viewH * 0.55));
    this.cam += (target - this.cam) * 0.12;
    const cam = this.cam;
    g.setTransform(dpr * s, 0, 0, dpr * s, 0, -cam * dpr * s);
    // background
    const bg = g.createLinearGradient(0, cam, 0, cam + viewH);
    bg.addColorStop(0, '#0b1023'); bg.addColorStop(1, '#130a24');
    g.fillStyle = bg; g.fillRect(0, cam, W, viewH);
    g.fillStyle = 'rgba(255,255,255,.035)';
    for (let yy = Math.floor(cam / 40) * 40; yy < cam + viewH; yy += 40) g.fillRect(0, yy, W, 1);
    // zones
    for (const z of C.zone) {
      if (z[1] > cam + viewH || z[1] + z[3] < cam) continue;
      if (z[4] === 'mud') {
        g.fillStyle = 'rgba(120,72,30,.55)'; g.fillRect(z[0], z[1], z[2], z[3]);
        g.fillStyle = 'rgba(60,35,12,.6)'; for (let k = 0; k < 40; k++) { const px = (k * 97) % W, py = z[1] + ((k * 53) % z[3]); g.beginPath(); g.arc(px, py, 3 + (k % 3), 0, 7); g.fill(); }
        g.fillStyle = 'rgba(255,220,180,.7)'; g.font = '900 12px KeCoin, Archivo, sans-serif'; g.textAlign = 'center'; g.fillText('BOUE', W / 2, z[1] + 16);
      } else {
        g.fillStyle = 'rgba(34,197,94,.16)'; g.fillRect(z[0], z[1], z[2], z[3]);
        g.strokeStyle = 'rgba(134,239,172,.8)'; g.lineWidth = 3; const off = (t * 60) % 24;
        for (let x = 20; x < W; x += 50) for (let yy = z[1] + off - 12; yy < z[1] + z[3] - 6; yy += 24) { if (yy < z[1]) continue; g.beginPath(); g.moveTo(x - 7, yy); g.lineTo(x, yy + 7); g.lineTo(x + 7, yy); g.stroke(); }
        g.fillStyle = 'rgba(187,247,208,.9)'; g.font = '900 12px KeCoin, Archivo, sans-serif'; g.textAlign = 'center'; g.fillText('TURBO', W / 2, z[1] + 14);
      }
    }
    // walls
    g.lineCap = 'round';
    const line = (sg, col, w) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(sg[0], sg[1]); g.lineTo(sg[2], sg[3]); g.stroke(); };
    for (const sg of C.seg) { if (Math.max(sg[1], sg[3]) < cam - 20 || Math.min(sg[1], sg[3]) > cam + viewH + 20) continue; line(sg, 'rgba(56,189,248,.25)', 12); line(sg, '#7dd3fc', 4); }
    for (const r of C.rot) { if (r[1] < cam - 120 || r[1] > cam + viewH + 120) continue; const sg = rotSeg(r, t); line(sg, 'rgba(244,114,182,.3)', 14); line(sg, '#f472b6', 6); g.fillStyle = '#fff'; g.beginPath(); g.arc(r[0], r[1], 6, 0, 7); g.fill(); }
    for (const k of C.tilt) { if (k[1] < cam - 120 || k[1] > cam + viewH + 120) continue; const sg = tiltSeg(k, t); line(sg, 'rgba(251,191,36,.3)', 14); line(sg, '#fbbf24', 6); g.fillStyle = '#78350f'; g.beginPath(); g.moveTo(k[0], k[1] + 4); g.lineTo(k[0] - 10, k[1] + 22); g.lineTo(k[0] + 10, k[1] + 22); g.fill(); }
    for (const p of C.peg) {
      if (p[1] < cam - 20 || p[1] > cam + viewH + 20) continue;
      const big = p[3] > 1;
      const gr = g.createRadialGradient(p[0] - p[2] * 0.3, p[1] - p[2] * 0.3, 1, p[0], p[1], p[2]);
      gr.addColorStop(0, '#fff'); gr.addColorStop(1, big ? '#f97316' : '#64748b');
      g.fillStyle = gr; g.beginPath(); g.arc(p[0], p[1], p[2] + (big ? Math.sin(t * 8 + p[0]) * 1.2 : 0), 0, 7); g.fill();
      if (big) { g.strokeStyle = 'rgba(253,186,116,.6)'; g.lineWidth = 2; g.beginPath(); g.arc(p[0], p[1], p[2] + 4, 0, 7); g.stroke(); }
    }
    // finish line
    if (C.FIN < cam + viewH + 20) { const sq = 12; for (let x = 0; x < W; x += sq) for (let r = 0; r < 2; r++) { g.fillStyle = (x / sq + r) % 2 ? '#fff' : '#111'; g.fillRect(x, C.FIN + r * sq, sq, sq); } g.fillStyle = '#fde047'; g.font = '900 16px KeCoin, Archivo, sans-serif'; g.textAlign = 'center'; g.fillText('ARRIVÉE', W / 2, C.FIN - 8); }
    // trails + marbles
    for (let i = 0; i < NM; i++) {
      const x = f[i * 2], y = f[i * 2 + 1], b = BALLS[i], tr = this.trails[i];
      for (let k = 0; k < tr.length; k++) { g.fillStyle = b.c; g.globalAlpha = (k / tr.length) * 0.35; g.beginPath(); g.arc(tr[k][0], tr[k][1], R * (0.4 + (k / tr.length) * 0.5), 0, 7); g.fill(); }
      g.globalAlpha = 1;
      g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.arc(x + 2, y + 3, R, 0, 7); g.fill();
      const gr = g.createRadialGradient(x - R * 0.35, y - R * 0.4, 1, x, y, R);
      gr.addColorStop(0, '#fff'); gr.addColorStop(0.35, b.c); gr.addColorStop(1, b.d);
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, R, 0, 7); g.fill();
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
  }

  paintRank(order, f) {
    this.q('.mb-rank').innerHTML = order.map((i, k) => `<span style="--bc:${BALLS[i].c}"><em>${k + 1}</em><i class="mb-ball" style="${ballCSS(BALLS[i])}"></i></span>`).join('');
    const prog = this.q('.mb-prog');
    if (!prog.querySelector('.mb-dot')) prog.insertAdjacentHTML('beforeend', BALLS.map((b) => `<i class="mb-dot" style="${ballCSS(b)}"></i>`).join(''));
    prog.querySelectorAll('.mb-dot').forEach((d, i) => { d.style.top = `${Math.min(100, (f[i * 2 + 1] / COURSE.FIN) * 100)}%`; });
  }

  histAdd(i) {
    this.histArr.unshift(i); this.histArr = this.histArr.slice(0, 12);
    this.q('.mb-hist').innerHTML = this.histArr.map((k) => `<span style="${ballCSS(BALLS[k])};border-radius:50%;min-width:22px"></span>`).join('');
  }

  /* ---------- a race ---------- */
  onMain() {
    if (!this.board.total() && this.auto) { this.board.rebet(true); this.board.paint(); }
    if (!this.board.total()) { this.stopAuto(); return this.msg('Pose au moins un jeton sur une bille.'); }
    this.round(() => this.race());
  }

  async race() {
    const placed = {}, tt = this.board.total();
    BALLS.forEach((b) => { placed[b.k] = this.board.bets[b.k] || 0; });
    if (!this.pay(tt)) return;
    this.lastStake = tt;
    this.board.last = Object.fromEntries(Object.entries(placed).filter(([, v]) => v));
    this.setLast(0); this.winAmt.textContent = '';
    this.qa('.mb-spot').forEach((s) => s.classList.remove('hit'));
    this.focusStage();
    const odds = this.form.odds.slice(), want = pickW(this.form.p);
    // countdown while the race is being prepared
    const cnt = this.q('.mb-count'); cnt.hidden = false;
    // One physical race; the five marbles are identical, so the colours of its winner and of the drawn winner are
    // swapped: the drawn marble wins a real race.
    const prep = (async () => {
      await sleep(30);
      const r = simulate((Math.random() * 2 ** 31) | 0), w0 = r.order[0];
      if (w0 !== want) {
        for (const f of r.frames) { const x = f[w0 * 2], y = f[w0 * 2 + 1]; f[w0 * 2] = f[want * 2]; f[w0 * 2 + 1] = f[want * 2 + 1]; f[want * 2] = x; f[want * 2 + 1] = y; }
        r.order = r.order.map((i) => (i === w0 ? want : i === want ? w0 : i));
      }
      return r;
    })();
    let run;
    for (const n of ['3', '2', '1']) { cnt.textContent = n; cnt.classList.remove('pop'); void cnt.offsetWidth; cnt.classList.add('pop'); sfx.tick(); await this.wait(700); if (this.dead) return; }
    run = await prep;
    if (this.dead || !run) return;
    cnt.textContent = 'GO !'; cnt.classList.remove('pop'); void cnt.offsetWidth; cnt.classList.add('pop'); sfx.spin?.();
    setTimeout(() => { cnt.hidden = true; }, 600);
    this.msg('C’est parti !');
    // play the recorded race
    const frames = run.frames, speed = this.turbo ? 2 : 1, win = run.order[0];
    this.trails = BALLS.map(() => []);
    await new Promise((res) => {
      const t0 = performance.now();
      let lastRank = 0;
      const step = (ts) => {
        if (this.dead) return res();
        const k = Math.min(frames.length - 1, Math.floor(((ts - t0) / 1000) * FPS * speed)), f = frames[k];
        for (let i = 0; i < NM; i++) { const tr = this.trails[i]; tr.push([f[i * 2], f[i * 2 + 1]]); if (tr.length > 10) tr.shift(); }
        this.frame = f; this.lastT = k / FPS;
        this.draw(f, k / FPS);
        if (ts - lastRank > 150) {
          lastRank = ts;
          const order = [...Array(NM).keys()].sort((a, b) => f[b * 2 + 1] - f[a * 2 + 1]);
          this.paintRank(order, f);
          this.q('.mb-time').textContent = `${Math.floor(k / FPS)} s`;
        }
        if (k < frames.length - 1) this.raf = requestAnimationFrame(step); else res();
      };
      this.raf = requestAnimationFrame(step);
    });
    if (this.dead) return;
    this.paintRank(run.order, frames[frames.length - 1]);
    // result
    const b = BALLS[win], bet = placed[b.k] || 0, ret = Math.round(bet * odds[win]);
    this.histAdd(win);
    this.q(`.mb-spot[data-k="${b.k}"]`).classList.add('hit');
    const wb = this.q('.mb-win');
    wb.hidden = false; wb.style.setProperty('--bc', b.c);
    wb.innerHTML = `<i class="mb-ball big" style="${ballCSS(b)}"></i><b>La bille ${b.name.toLowerCase()} gagne !</b><small>cote ×${xs(odds[win])}</small>`;
    fx.confetti(60); sfx.feature();
    const all = Object.values(placed).reduce((a, x) => a + x, 0);
    this.msg(`${bet ? `Bille ${b.name.toLowerCase()} : ${fmtC(bet)} × ${xs(odds[win])} = ${fmtC(ret)}` : `La bille ${b.name.toLowerCase()} gagne. Pas de mise dessus.`} · Bilan : ${ret - all >= 0 ? '+' : '−'}${fmtC(Math.abs(ret - all))}`);
    if (ret > 0) { this.win(ret); this.setLast(ret); await this.celebrate(ret); }
    await this.wait(1800);
    if (this.dead) return;
    wb.hidden = true;
    this.newForm();
    this.idle();
    this.board.afterRound();
  }

  info() {
    return this.rules(`<h4>Comment jouer</h4><p>Pose tes jetons sur une ou plusieurs des 5 billes (Rouge, Bleue, Verte, Jaune, Violette), puis lance la course. Les billes dévalent le parcours : entonnoirs, plots rebondissants, moulins qui tournent, bascules, zones turbo et boue. La première bille en bas gagne, et ta mise sur elle est payée <b>× sa cote</b> (mise comprise).</p>
      <h4>Les cotes</h4><p>Avant chaque course, chaque bille a une forme (sa chance de gagner, la barre sous son nom). Sa cote vaut 0,95 ÷ sa chance : une bille en forme rapporte moins, une bille en petite forme rapporte plus.</p>
      <h4>Équité</h4><p>Le vainqueur est tiré selon ces chances, puis une vraie course physique est calculée et c’est elle que tu regardes. Retour au joueur ≈ 95 % sur chaque bille.</p>`);
  }
}

return { BillesGame };
})();
