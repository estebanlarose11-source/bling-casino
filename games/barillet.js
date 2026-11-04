// SpinBet Casino · BarilletGame — loaded on demand by games/impl/index.js (index.html).
// ---- games/impl/barillet-engine.js ----
__mods['games/impl/barillet-engine.js'] = (() => {
// La Roulette Russe math (pure, no DOM, so the simulator can check the RTP). Extreme volatility.
// 5 reels of 3-4-4-4-3 cells = 576 ways (a symbol on adjacent reels from the left, any row, 3+ reels).
// The WILD outlaw lands on reels 2 to 4 and covers its whole reel (expanding wild).
// SHOTS: when a spin has a win and a golden bullet anywhere on the reels, the revolver fires 1 to 3 bullets
// (+1 per extra golden bullet) at cells of the winning ways. Each hit cell catches fire with a multiplier (×2 to ×10).
// A symbol's win = pay × ways × the mean multiplier of its ways (on each reel the multipliers of its cells are summed,
// then the reels multiply: Π Σ mult / Π count), capped at TUNE.lineCap: so the multipliers of a connection multiply.
// LE DUEL (3+ WANTED posters, 10 / 12 / 15 free spins): every winning spin fires BIG bullets (×2 to ×50) and the
// burning cells stay on fire (and keep their multiplier) until the end; a cell hit again multiplies its multiplier
// (up to TUNE.capFree). Extreme buy: more spins and cells already burning. After a bonus the player may play the
// Russian roulette on the bonus win (GAMBLE, return 96 %: not in the RTP).

const COLS = 5, RO = [3, 4, 4, 4, 3], OFF = [0, 3, 7, 11, 15], N = 18, CAPX = 20000, WAYS = 576;
const NS = 11, WILD = 11, SC = 12, BULLET = 13;
const colOf = (i) => (i < 3 ? 0 : i < 7 ? 1 : i < 11 ? 2 : i < 15 ? 3 : 4);
// 0 ten, 1 jack, 2 queen, 3 king, 4 ace, 5 whiskey, 6 pocket watch, 7 gold bars, 8 sheriff star, 9 revolver, 10 cowboy
// pays per way, in multiples of the total bet, for 3, 4 and 5 reels
const PAYS = [
  [0.1, 0.25, 1], [0.1, 0.25, 1], [0.12, 0.3, 1.2], [0.15, 0.4, 1.5], [0.15, 0.4, 1.5],
  [0.25, 1, 4], [0.3, 1.2, 5], [0.4, 1.5, 6], [0.6, 2.5, 10], [0.8, 3.5, 15], [1, 5, 25],
];
const FS_FOR = { 3: 10, 4: 12, 5: 15 }, RETRIGGER = 4;
const BUY_COST = 150, BUY_X_COST = 500;
// the Russian roulette: k bullets of 6 in the barrel → the win × GAMBLE[k] if the shot is blank (≈ 96 % each)
const GAMBLE = { 1: 1.15, 2: 1.45, 3: 1.92, 4: 2.88, 5: 5.76 };
// tuned by simulation (3.6 M spins): RTP ≈ 92 %, a win 1 spin in 4 (mostly small), LE DUEL 1 spin in 385 (≈ ×130),
// buys ≈ 88 % (×150) and ≈ 89 % (×500), max win ×20 000 reachable
const TUNE = {
  payScale: 0.57, payScaleFree: 0.67,
  w: [10, 10, 10, 10, 10, 9, 9, 9, 8, 8, 8], wFree: [13, 13, 12, 12, 11, 9, 8, 7, 5.5, 4.5, 3.5],
  wild: 0.6, wildFree: 1.4, sc: 1.65, scFree: 1.0, bullet: 1.2, bulletFree: 1.2,
  shots: [[1, 60], [2, 30], [3, 10]], shotsFree: [[1, 65], [2, 28], [3, 7]],
  small: [[2, 50], [3, 28], [5, 15], [10, 7]],
  big: [[2, 30], [3, 30], [5, 22], [10, 12], [25, 5], [50, 1]],
  cap: 100, capFree: 25, lineCap: 100, lineCapFree: 200, // the most a cell's / a connection's multiplier can reach
  xSpins: 13, xBurn: [[5, 2], [3, 1]], // extreme buy: 13 free spins, 3 cells already burning (×5, ×5, ×3)
};

const wpick = (l) => { let t = 0; for (const x of l) t += x[1]; let r = Math.random() * t; for (const x of l) { if (r < x[1]) return x[0]; r -= x[1]; } return l[l.length - 1][0]; };
const SW = (w) => w.reduce((a, b) => a + b, 0);
function draw(c, free) {
  const w = free ? TUNE.wFree : TUNE.w, sw = SW(w), wd = c > 0 && c < 4 ? (free ? TUNE.wildFree : TUNE.wild) : 0, sc = free ? TUNE.scFree : TUNE.sc, bu = free ? TUNE.bulletFree : TUNE.bullet;
  let x = Math.random() * (sw + wd + sc + bu);
  if (x >= sw + wd + sc) return BULLET;
  if (x >= sw + wd) return SC;
  if (x >= sw) return WILD;
  for (let i = 0; i < w.length; i++) { if (x < w[i]) return i; x -= w[i]; }
  return 0;
}

// the ways wins of a grid: [{ s, len, ways, cells, perReel }] (reel 1 has no wild)
function wayWins(grid, free) {
  const out = [];
  for (let s = 0; s < NS; s++) {
    const perReel = [];
    for (let c = 0; c < COLS; c++) {
      const hit = [];
      for (let r = 0; r < RO[c]; r++) { const i = OFF[c] + r, v = grid[i]; if (v === s || (v === WILD && c > 0)) hit.push(i); }
      if (!hit.length) break;
      perReel.push(hit);
    }
    if (perReel.length >= 3) out.push({ s, len: perReel.length, perReel, cells: perReel.flat(), ways: perReel.reduce((a, h) => a * h.length, 1), pay: PAYS[s][perReel.length - 3] * (free ? TUNE.payScaleFree : TUNE.payScale) });
  }
  return out;
}

// One paid or free spin. state.burn = { cell: multiplier } of the burning cells (kept between free spins).
function spin({ free = false, forceScatters = 0, state = { burn: {} } } = {}) {
  const grid = [];
  for (let c = 0; c < COLS; c++) for (let r = 0; r < RO[c]; r++) grid.push(draw(c, free));
  if (forceScatters) {
    for (let i = 0; i < N; i++) if (grid[i] === SC) grid[i] = 0;
    [...Array(COLS).keys()].sort(() => Math.random() - 0.5).slice(0, forceScatters).forEach((c) => { grid[OFF[c] + Math.floor(Math.random() * RO[c])] = SC; });
  }
  // a WILD on reels 2 to 4 covers its whole reel
  const expanded = [];
  for (let c = 1; c < 4; c++) {
    let w = false;
    for (let r = 0; r < RO[c]; r++) if (grid[OFF[c] + r] === WILD) w = true;
    if (w) { expanded.push(c); for (let r = 0; r < RO[c]; r++) grid[OFF[c] + r] = WILD; }
  }
  const burn = state.burn;
  const wins = wayWins(grid, free);
  const bullets = grid.filter((v) => v === BULLET).length;
  // the revolver fires at the winning cells (always in the duel, with a golden bullet in the base game)
  const shots = [];
  if (wins.length && (free || bullets > 0)) {
    const pool = [...new Set(wins.flatMap((w) => w.cells))];
    const n = wpick(free ? TUNE.shotsFree : TUNE.shots) + Math.max(0, bullets - 1);
    for (let k = 0; k < n; k++) {
      const i = pool[Math.floor(Math.random() * pool.length)], m = wpick(free ? TUNE.big : TUNE.small);
      burn[i] = Math.min(free ? TUNE.capFree : TUNE.cap, (burn[i] || 1) * m);
      shots.push({ i, m, to: burn[i] });
    }
  }
  wins.forEach((w) => {
    const weighted = w.perReel.reduce((a, h) => a * h.reduce((b, i) => b + (burn[i] || 1), 0), 1);
    w.mult = Math.min(free ? TUNE.lineCapFree : TUNE.lineCap, Math.round(weighted / w.ways * 100) / 100);
    w.won = w.pay * w.ways * w.mult;
  });
  const line = wins.reduce((a, w) => a + w.won, 0);
  const scat = grid.filter((v) => v === SC).length;
  const total = Math.min(CAPX, line);
  return { grid, expanded, wins, shots, bullets, line, scat, total, burn: { ...burn } };
}

// the burning cells an extreme buy starts with
function startBurn(extreme) {
  const burn = {};
  if (extreme) TUNE.xBurn.forEach(([m, n]) => { for (let k = 0; k < n; k++) { let i; do i = Math.floor(Math.random() * N); while (burn[i]); burn[i] = m; } });
  return burn;
}
// Whole bonus (used by the simulator; the game plays the same spins one by one). Without the gamble.
function freeRound(spins = 10, extreme = false) {
  const state = { burn: startBurn(extreme) };
  let left = spins, total = 0, n = 0;
  while (left > 0 && n < 300) {
    left--; n++;
    const r = spin({ free: true, state });
    total += r.total;
    if (r.scat >= 3) left += RETRIGGER;
    if (total >= CAPX) { total = CAPX; break; }
  }
  return total;
}

return { COLS, RO, OFF, N, CAPX, WAYS, NS, WILD, SC, BULLET, PAYS, FS_FOR, RETRIGGER, BUY_COST, BUY_X_COST, GAMBLE, TUNE, colOf, draw, wayWins, spin, startBurn, freeRound };
})();

// ---- games/impl/barillet.js ----
__mods['games/impl/barillet.js'] = (() => {
// La Roulette Russe: an old saloon, 5 reels of 3-4-4-4-3 cells (576 ways, laid out like the owner's reference: wooden
// reels, the two outer reels set apart, the WILD covering its reel), the owner's painted symbols (assets/games/barillet).
// Beside the reels, a full revolver barrel: every shot takes one bullet out (it reloads when empty). A line win with a
// golden bullet on the reels makes the revolver fire 1 to 3 bullets at the winning cells: they catch fire with a
// multiplier, and the multipliers of a line multiply each other. LE DUEL: big bullets, the burning cells stay on fire.
// At the end of the duel, the Russian roulette (1 to 5 bullets to multiply the win… or lose it all).
// Math lives in barillet-engine.js (checked by simulation, see the comment above TUNE).

const { BaseGame, fmtC } = __mods['core/base.js'];
const { Reels } = __mods['core/reels.js'];
const { EXTRA_THEMES } = __mods['core/music.js'];
const E = __mods['games/impl/barillet-engine.js'];
const { COLS, RO, OFF, N, WAYS, NS, WILD, SC, BULLET, PAYS, FS_FOR, RETRIGGER, BUY_COST, BUY_X_COST, GAMBLE, TUNE, CAPX, colOf, draw, spin, startBurn } = E;
const { sfx } = __mods['audio.js'];
const { fx, sleep, center } = __mods['fx.js'];
const { el } = __mods['ui.js'];
const { warm } = __mods['core/pixi.js'];

/* ---------- the owner's symbols ---------- */
const IMG_V = 2;
const asset = (p) => window.__assets?.[p] || `${p}?v=${IMG_V}`; // single-file version: images are inlined
const FILE = ['s0', 's1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 's10'];
const NAMES = ['10', 'Valet', 'Dame', 'Roi', 'As', 'Whisky', 'Montre à gousset', 'Lingots d’or', 'Étoile du shérif', 'Revolver', 'Le Cow-boy'];
const img = (f, cls = '') => `<img class="rr-img ${cls}" src="${asset(`assets/games/barillet/${f}.webp`)}" alt="" draggable="false" decoding="async">`;
const fileOf = (v) => (v === WILD ? 'wild' : v === SC ? 'scat' : v === BULLET ? 'bullet' : FILE[v] || FILE[0]);
const cellArt = (v) => img(fileOf(v));
const cellCls = (v) => (v === WILD ? 'wild' : v === SC ? 'scat' : v === BULLET ? 'bullet' : v >= 8 ? 'hi' : '');

// the revolver barrel: the owner's photo (tools/art/barillet.py cuts the cylinder and the cartridge out of it),
// 6 chambers around the ejector star (chamber 0 on top), each one filled with the photo's cartridge when loaded
const CH = Array.from({ length: 6 }, (_, k) => { const a = (k * 60 - 90) * Math.PI / 180; return [50 + 31.66 * Math.cos(a), 50 + 31.66 * Math.sin(a)]; });
const PR = 14.6;
const barrelSVG = (cls = '') => `<svg class="rr-barrel-svg ${cls}" viewBox="0 0 100 100" aria-hidden="true">
  <g class="rr-rot"><image href="${asset('assets/games/barillet/barrel.webp')}" x="0" y="0" width="100" height="100"/>
  ${CH.map(([x, y], k) => `<g class="rr-ch" data-k="${k}"><image class="rr-pr" href="${asset('assets/games/barillet/prime.webp')}" x="${(x - PR).toFixed(2)}" y="${(y - PR).toFixed(2)}" width="${2 * PR}" height="${2 * PR}" transform="rotate(${k * 60 - 60} ${x.toFixed(2)} ${y.toFixed(2)})"/></g>`).join('')}
  </g></svg>`;
const FLAMES = '<i class="rr-fl f1"></i><i class="rr-fl f2"></i><i class="rr-fl f3"></i><i class="rr-sm"></i><b class="rr-fm"></b>';
const xs = (m) => `×${m.toLocaleString('fr-FR')}`;

// Reels with a different number of cells per reel (3-4-4-4-3): cell i = OFF[c] + row, like the engine.
class ShapedReels extends Reels {
  constructor(host, opts) {
    super(host, { ...opts, rows: 4 });
    this.reelEls.forEach((r, c) => { r.style.setProperty('--rows', RO[c]); r.classList.add(`rr-r${c}`); });
    this.values = new Array(N).fill(null);
  }
  colVals(vals, c) { return vals.slice(OFF[c], OFF[c] + RO[c]); }
  setAll(vals) {
    this.values = vals.slice();
    for (let c = 0; c < this.cols; c++) {
      const strip = this.reelEls[c].firstChild;
      strip.innerHTML = this.colVals(vals, c).map((v, r) => this.cellHTML(v, OFF[c] + r)).join('');
      strip.style.transform = 'translate3d(0,0,0)';
    }
    requestAnimationFrame(() => warm(this.el.querySelectorAll('.rs-cell')));
  }
  set(i, v) { this.values[i] = v; const c = colOf(i), node = this.reelEls[c].firstChild.children[i - OFF[c]]; if (node) node.outerHTML = this.cellHTML(v, i); }
  cell(i) { const c = colOf(i); return this.reelEls[c].firstChild.children[i - OFF[c]]; }
  async spin(vals, { tease = () => false, onStop = null } = {}) {
    const t = this.game?.turbo;
    const base = (t ? 300 : 620) * this.durK, step = (t ? 70 : 160) * this.durK;
    let extra = 0;
    const jobs = [];
    for (let c = 0; c < this.cols; c++) {
      const slow = !t && tease(c, vals);
      if (slow) extra += 850;
      jobs.push(this.spinCol(c, this.colVals(vals, c), base + c * step + extra, slow).then(() => onStop?.(c)));
    }
    await Promise.all(jobs);
    this.values = vals.slice();
  }
  spinCol(c, finalCol, dur, slow) {
    const R = RO[c], reel = this.reelEls[c], strip = reel.firstChild;
    const h = reel.clientHeight / R;
    const current = this.colVals(this.values, c);
    const filler = Array.from({ length: Math.max(8, Math.floor(dur / 38)) }, () => this.random(c));
    const cells = [this.random(c), ...finalCol, ...filler, ...current.map((v) => (v == null ? this.random(c) : v))];
    const html = cells.map((v, k) => this.cellHTML(v, k >= 1 && k <= R ? OFF[c] + k - 1 : -1));
    const end = -h, start = -(cells.length - R) * h, bounce = h * 0.22;
    const px = this.px, col = px?.column(reel, html, R);
    if (col) { strip.innerHTML = ''; strip.style.visibility = 'hidden'; col.set(start); } else strip.innerHTML = html.join('');
    strip.style.transform = `translate3d(0,${start}px,0)`;
    reel.classList.add('spinning');
    let unTease = null;
    if (slow) { reel.classList.add('tease'); setTimeout(() => sfx.tease(), dur - 900); unTease = px?.tease(reel); }
    return new Promise((resolve) => {
      const t0 = performance.now(), mainDur = dur * 0.9;
      const frame = (now) => {
        if (this.game?.dead) { col?.end(); unTease?.(); return resolve(); }
        const tt = now - t0;
        let y;
        if (tt < mainDur) {
          const p = tt / mainDur;
          const e = p < 0.08 ? -0.015 * Math.sin((p / 0.08) * Math.PI) : 1 - Math.pow(1 - (p - 0.08) / 0.92, 2.6);
          y = start + (end + bounce - start) * e;
          if (p > 0.82) reel.classList.remove('spinning');
        } else {
          const q = Math.min(1, (tt - mainDur) / (dur - mainDur));
          y = end + bounce * Math.pow(1 - q, 2);
        }
        if (col) col.set(y); else strip.style.transform = `translate3d(0,${y}px,0)`;
        if (tt < dur) return requestAnimationFrame(frame);
        strip.innerHTML = finalCol.map((v, r) => this.cellHTML(v, OFF[c] + r)).join('');
        strip.style.transform = 'translate3d(0,0,0)';
        if (col) { col.end(); strip.style.visibility = ''; }
        unTease?.();
        px?.land(reel, slow);
        warm(strip.children);
        reel.classList.remove('spinning', 'tease', 'landed');
        void reel.offsetWidth;
        reel.classList.add('landed');
        sfx.reelStop(c);
        resolve();
      };
      requestAnimationFrame(frame);
    });
  }
}

class BarilletGame extends BaseGame {
  constructor(root, game) {
    super(root, game, {
      music: EXTRA_THEMES.barillet,
      frameCls: 'rr-frame',
      stage: `<div class="rr-stage">
        <div class="rr-board">
          <div class="rr-machine">
            <div class="rr-top"><span class="rr-ways">${WAYS}<small>FAÇONS</small></span><span class="rr-plaque">ROULETTE RUSSE</span><span class="rr-brand"><i class="logo-mark">S</i><span class="rr-max">MAX<b>×${CAPX.toLocaleString('fr-FR')}</b></span></span></div>
            <div class="rr-reels"></div>
            <i class="rr-corner l">${img('bullet')}</i><i class="rr-corner r">${img('bullet')}</i>
          </div>
          <div class="rr-side"><div class="rr-barrel">${barrelSVG()}<i class="rr-muzzle"></i></div><div class="rr-mult"><small>Barillet</small><b>6</b><em>balles</em></div></div>
        </div>
      </div>`,
      buys: [
        { id: 'fs', icon: '🔫', label: 'LE DUEL · 10 tours', desc: 'Grosses balles à chaque gain : les cases en feu restent jusqu’à la fin', cost: (b) => b * BUY_COST },
        { id: 'fsx', icon: '💀', label: `LE DUEL EXTRÊME · ${TUNE.xSpins} tours`, desc: `${TUNE.xBurn.reduce((a, x) => a + x[1], 0)} cases déjà en feu (${TUNE.xBurn.flatMap(([m, n]) => Array(n).fill(xs(m))).join(', ')})`, cost: (b) => b * BUY_X_COST },
      ],
      hello: `${WAYS} façons de gagner · une balle d’or + une connexion = le revolver tire`,
    });
    this.slotEl.style.setProperty('--rr-bg', `url("${asset('assets/games/barillet/bg.webp')}")`);
    this.slotEl.style.setProperty('--rr-planks', `url("${asset('assets/games/barillet/planks.webp')}")`);
    this.slotEl.style.setProperty('--rr-wood', `url("${asset('assets/games/barillet/frame.webp')}")`);
    [...FILE, 'wild', 'wildtall', 'scat', 'bullet', 'barrel', 'prime'].forEach((f) => { new Image().src = asset(`assets/games/barillet/${f}.webp`); });
    this.reels = new ShapedReels(this.q('.rr-reels'), { cols: COLS, game: this, art: cellArt, cls: cellCls, random: (c) => (c === 0 || c === 4 ? draw(c, false) : (() => { const v = draw(c, false); return v === WILD ? 0 : v; })()) });
    // over each reel: its fire cells and the expanding WILD panel
    this.fire = [];
    this.reels.reelEls.forEach((reel, c) => {
      const f = el('div', 'rr-fire');
      f.innerHTML = Array.from({ length: RO[c] }, () => `<div class="rr-fc">${FLAMES}</div>`).join('');
      reel.appendChild(f);
      this.fire.push(...f.children);
      if (c > 0 && c < 4) reel.insertAdjacentHTML('beforeend', `<div class="rr-xw">${img('wildtall', 'xw')}<b class="rr-xb top">WILD</b><b class="rr-xb bot">×1</b></div>`);
    });
    this.reels.setAll(Array.from({ length: N }, (_, i) => { const v = draw(colOf(i), false); return v === WILD ? 0 : v; }));
    this.ammo = 6;
    this.pendingC = 0;
    this.setAmmo(6);
  }

  /* ---------- the barrel beside the reels: the bullets left ---------- */
  setAmmo(n) {
    this.ammo = n;
    this.qa('.rr-barrel .rr-ch').forEach((g) => g.classList.toggle('on', +g.dataset.k < n));
    this.q('.rr-mult b').textContent = n;
    this.q('.rr-mult em').textContent = n > 1 ? 'balles' : 'balle';
  }
  async reload() {
    this.q('.rr-barrel').classList.add('reload');
    for (let k = 1; k <= 6; k++) { this.setAmmo(k); sfx.click(); await this.wait(70); }
    this.q('.rr-barrel').classList.remove('reload');
  }

  /* ---------- the burning cells ---------- */
  setFire(i, m, fresh = false) {
    const f = this.fire[i];
    f.classList.toggle('on', m > 1);
    f.classList.toggle('hot', m >= 25);
    f.querySelector('.rr-fm').textContent = m > 1 ? xs(m) : '';
    if (fresh) { f.classList.remove('hit'); void f.offsetWidth; f.classList.add('hit'); }
  }
  clearFire() { this.fire.forEach((f) => f.classList.remove('on', 'hot', 'hit')); }
  // the WILD panels over the expanded reels, with the reel's mean multiplier at the bottom
  setWilds(cols, burn = {}, grow = false) {
    this.reels.reelEls.forEach((reel, c) => {
      const p = reel.querySelector('.rr-xw');
      if (!p) return;
      const on = cols.includes(c);
      if (on && grow && !p.classList.contains('on')) { p.classList.remove('grow'); void p.offsetWidth; p.classList.add('grow'); }
      p.classList.toggle('on', on);
      let sum = 0;
      for (let r = 0; r < RO[c]; r++) sum += burn[OFF[c] + r] || 1;
      const m = Math.round(sum / RO[c] * 100) / 100;
      p.querySelector('.bot').textContent = `×${m.toLocaleString('fr-FR')}`;
    });
  }
  showBurn(burn) { this.clearFire(); Object.entries(burn).forEach(([i, m]) => this.setFire(+i, m)); }

  // one shot: a bullet leaves the barrel, flies to the cell, the cell catches fire
  async shoot(s, big) {
    if (this.ammo <= 0) await this.reload();
    this.setAmmo(this.ammo - 1);
    const bar = this.q('.rr-barrel'), from = center(bar), to = center(this.fire[s.i]);
    bar.classList.remove('fire'); void bar.offsetWidth; bar.classList.add('fire');
    sfx.land();
    fx.trail(from, to, big ? '#fb923c' : '#fde047', big ? 18 : 12);
    await this.wait(big ? 300 : 230);
    fx.burst(to.x, to.y, big ? 40 : 22, ['#fff7c2', '#fb923c', '#ef4444'], big ? 9 : 6);
    if (big) this.shake();
    this.flash(big ? 'rgba(251,146,60,.35)' : 'rgba(253,224,71,.22)');
    this.setFire(s.i, s.to, true);
    sfx.upgrade();
    this.floatAt(this.fire[s.i], s.to > s.m ? `${xs(s.m)} → ${xs(s.to)}` : xs(s.m), big ? '#fdba74' : '#fde047', big ? 30 : 24);
    await this.wait(big ? 380 : 300);
  }

  onMain() {
    this.round(async () => {
      const bet = this.bet;
      if (!this.pay(bet)) return;
      this.lastStake = bet;
      this.clearFire();
      const r = await this.playSpin(false, { burn: {} });
      const won = Math.round(r.total * bet);
      if (won > 0) { this.win(won); await this.celebrate(won); }
      if (r.scat >= 3) { this.stopAuto(); await this.duel(FS_FOR[Math.min(5, r.scat)], false); }
    });
  }

  async onBuy(id) { await this.duel(id === 'fsx' ? TUNE.xSpins : 10, id === 'fsx'); }

  // Spins the reels, fires the shots, shows the line wins; returns the engine result (not credited here).
  async playSpin(free, state) {
    const bet = this.bet;
    const r = spin({ free, state });
    this.setLast(0); this.winAmt.textContent = '';
    this.reels.unmark();
    this.setWilds([]);
    this.msg(free ? 'Le duel continue…' : 'Les rouleaux tournent…');
    let sc = 0;
    await this.reels.spin(r.grid, {
      tease: (c, vals) => { const t = sc >= 2; for (let k = 0; k < RO[c]; k++) if (vals[OFF[c] + k] === SC) sc++; return t; },
      onStop: (c) => { if (r.expanded.includes(c)) { this.setWilds(r.expanded.filter((x) => x <= c), r.burn, true); sfx.feature(); this.shake(); } for (let k = 0; k < RO[c]; k++) { const v = r.grid[OFF[c] + k]; if (v === SC || v === BULLET) { sfx.land(); const p = center(this.reels.cell(OFF[c] + k)); fx.burst(p.x, p.y, 14, v === SC ? ['#f2dfb4', '#a16207'] : ['#fde047', '#fff']); } } },
    });
    if (this.dead) return r;
    if (r.wins.length) {
      const cells = [...new Set(r.wins.flatMap((w) => w.cells))];
      this.reels.mark(cells);
      // the golden bullets light up, then the revolver fires at the winning cells
      if (r.shots.length) {
        if (!free) r.grid.forEach((v, i) => { if (v === BULLET) this.reels.cell(i)?.classList.add('win'); });
        this.msg(free ? `🔥 GROSSES BALLES · ${r.shots.length} tir${r.shots.length > 1 ? 's' : ''}` : `🔫 La balle d’or arme le revolver · ${r.shots.length} tir${r.shots.length > 1 ? 's' : ''}`);
        sfx.feature();
        await this.wait(450);
        for (const s of r.shots) { if (this.dead) return r; await this.shoot(s, free); }
        this.setWilds(r.expanded, r.burn);
      }
      const best = r.wins.slice().sort((a, b) => b.won - a.won)[0];
      const multi = r.wins.filter((w) => w.mult > 1);
      this.msg(`${best.ways} façon${best.ways > 1 ? 's' : ''} × ${NAMES[best.s]} sur ${best.len} rouleaux${best.mult > 1 ? ` · ×${best.mult.toLocaleString('fr-FR')} 🔥` : ''}${r.wins.length > 1 ? ` · ${r.wins.length} symboles` : ''} : <b>+${fmtC(Math.round(r.total * bet))}</b>`);
      if (multi.length) this.floatAt(this.q('.rr-reels'), `×${Math.max(...multi.map((w) => w.mult)).toLocaleString('fr-FR')}`, '#fdba74', 46);
      sfx.win();
      this.setLast(Math.round(r.total * bet));
      await this.wait(r.shots.length ? 1100 : 650);
    } else if (!free) this.msg(r.scat === 2 ? 'Presque… 2 avis de recherche' : r.bullets ? 'Une balle d’or… mais pas de connexion' : 'Pas de gain');
    return r;
  }

  async duel(spins, extreme) {
    const bet = this.bet, state = { burn: startBurn(extreme) }, cap = (this.capC() || CAPX * bet) - (this.roundWin || 0);
    let left = spins, done = 0, total = 0;
    this.lastStake = bet;
    await this.featureIntro(extreme ? 'LE DUEL EXTRÊME' : 'LE DUEL', `${spins} tours · grosses balles à chaque gain, les cases en feu restent`, img('scat', 'intro'));
    this.slotEl.classList.add('in-free');
    this.reels.unmark();
    this.showBurn(state.burn);
    if (this.ammo < 6) await this.reload();
    while (left > 0 && !this.dead) {
      left--; done++;
      const hot = Object.keys(state.burn).length;
      this.setBanner(`<b>${extreme ? 'DUEL EXTRÊME' : 'LE DUEL'}</b><span class="pill">Tour ${done} / ${done + left}</span><span class="pill hot">🔥 ${hot} case${hot > 1 ? 's' : ''} en feu</span><span class="pill gold">Gain ${fmtC(total)}</span>`);
      const r = await this.playSpin(true, state);
      total = Math.min(cap, total + Math.round(r.total * bet));
      this.pendingC = total;
      if (r.scat >= 3) { left += RETRIGGER; await this.featureIntro(`+${RETRIGGER} TOURS`, 'Encore des avis de recherche !', img('scat', 'intro'), 1300); }
      if (total >= cap) { this.msg(`MAX WIN ×${CAPX.toLocaleString('fr-FR')} !`); break; }
      await this.wait(380);
    }
    if (this.dead) return;
    this.slotEl.classList.remove('in-free');
    this.setBanner('');
    this.reels.unmark();
    this.clearFire();
    this.setWilds([]);
    // the Russian roulette on the bonus win, then the win is paid
    const final = total > 0 && total < cap ? await this.roulette(total, cap) : total;
    this.pendingC = 0;
    if (final > 0) this.win(final, 'Le Duel');
    this.setLast(final);
    await this.celebrate(final, { summary: final > 0 || total === 0 ? (extreme ? 'DUEL EXTRÊME' : 'LE DUEL') : 'PAN !', stake: bet });
    this.msg(final > 0 || total === 0 ? `Duel terminé : ${fmtC(final)} gagnés` : '💥 Le barillet a parlé… tout est perdu');
  }

  // The gamble: k bullets of 6 → the win × GAMBLE[k] if the shot is blank. Returns the final amount (cents).
  roulette(amount, cap) {
    return new Promise((resolve) => {
      const ov = this.overlay(`<div class="rr-gamble"><h3>ROULETTE RUSSE</h3><p class="rr-gsub">Mets des balles dans le barillet et tire : plus il y a de balles, plus ça multiplie… si tu survis.</p>
        <div class="rr-gbarrel">${barrelSVG('big')}<i class="rr-gfx"></i></div>
        <div class="rr-gamt"><small>Ton gain</small><b></b></div>
        <div class="rr-gopts"></div>
        <button class="btn primary lg rr-take">💰 Je ramasse</button></div>`, 'rr-gov');
      const box = ov.querySelector('.rr-gamble'), opts = box.querySelector('.rr-gopts'), take = box.querySelector('.rr-take'), rot = box.querySelector('.rr-rot');
      let angle = 0, busy = false, closed = false;
      const finish = (v) => { if (closed) return; closed = true; clearInterval(watch); ov.classList.add('out'); setTimeout(() => ov.remove(), 300); resolve(v); };
      const watch = setInterval(() => { if (this.dead) finish(amount); }, 500);
      const load = (k) => box.querySelectorAll('.rr-ch').forEach((g) => g.classList.toggle('on', +g.dataset.k < k));
      const paint = () => {
        box.querySelector('.rr-gamt b').textContent = fmtC(amount);
        take.textContent = `💰 Je ramasse ${fmtC(amount)}`;
        opts.innerHTML = [1, 2, 3, 4, 5].map((k) => `<button class="rr-gopt" data-k="${k}"><b>${k} balle${k > 1 ? 's' : ''}</b><span>×${GAMBLE[k].toLocaleString('fr-FR')}</span><em>${fmtC(Math.min(cap, Math.round(amount * GAMBLE[k])))}</em><small>${6 - k} chance${6 - k > 1 ? 's' : ''} sur 6</small></button>`).join('');
        load(0);
      };
      paint();
      take.addEventListener('click', () => { if (!busy) { sfx.coin(); finish(amount); } });
      opts.addEventListener('pointerover', (e) => { const b = e.target.closest('[data-k]'); if (b && !busy) load(+b.dataset.k); });
      opts.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-k]');
        if (!b || busy) return;
        busy = true;
        const k = +b.dataset.k;
        box.classList.add('busy');
        load(k);
        // the chambers 0..k-1 hold the bullets; the barrel turns and stops on chamber `hit` (on top = shot)
        const dead = Math.random() < k / 6;
        const hit = dead ? Math.floor(Math.random() * k) : k + Math.floor(Math.random() * (6 - k));
        angle += 1080 + ((360 - hit * 60) - (angle % 360) + 360) % 360;
        sfx.tease();
        rot.style.transition = `transform ${this.turbo ? 0.9 : 1.9}s cubic-bezier(.15,.7,.2,1)`;
        rot.style.transform = `rotate(${angle}deg)`;
        await sleep(this.turbo ? 1000 : 2050);
        if (this.dead) return finish(amount);
        const fxEl = box.querySelector('.rr-gfx');
        if (dead) {
          fxEl.textContent = '💥 PAN !'; fxEl.className = 'rr-gfx pan';
          this.flash('rgba(239,68,68,.75)'); this.shake(box); sfx.land();
          amount = 0;
          box.querySelector('.rr-gamt b').textContent = fmtC(0);
          await sleep(1500);
          return finish(0);
        }
        fxEl.textContent = 'CLIC…'; fxEl.className = 'rr-gfx clic';
        amount = Math.min(cap, Math.round(amount * GAMBLE[k]));
        sfx.upgrade(); fx.coins?.(16);
        const p = center(box.querySelector('.rr-gamt')); fx.burst(p.x, p.y, 30, ['#fde047', '#fff', '#f59e0b'], 7);
        await sleep(900);
        fxEl.className = 'rr-gfx';
        box.classList.remove('busy');
        busy = false;
        if (amount >= cap) return finish(amount);
        paint();
      });
    });
  }

  destroy() {
    // the player leaves in the middle of a duel: the bonus win so far is paid
    if (this.pendingC > 0) { const c = this.pendingC; this.pendingC = 0; this.win(c, 'Le Duel'); }
    super.destroy();
  }

  info() {
    const f = (x) => (x * TUNE.payScale).toLocaleString('fr-FR', { maximumFractionDigits: 2 });
    const rows = FILE.map((a, s) => `<div class="pay-item"><div class="pay-sym">${img(a)}</div><div class="pay-vals"><b>${NAMES[s]}</b><br><span>3 rouleaux : ×${f(PAYS[s][0])} · 4 : ×${f(PAYS[s][1])} · 5 : ×${f(PAYS[s][2])}</span></div></div>`).reverse().join('');
    const sm = TUNE.small.map((x) => xs(x[0])).join(', '), bg = TUNE.big.map((x) => xs(x[0])).join(', ');
    return this.rules(`<h4>Table des gains (× la mise, par façon)</h4><div class="paytable">${rows}
      <div class="pay-item"><div class="pay-sym">${img('wild')}</div><div class="pay-vals"><b>WILD</b><br><span>Sur les rouleaux 2 à 4, couvre tout le rouleau et remplace tous les symboles sauf l’avis de recherche et la balle d’or</span></div></div>
      <div class="pay-item"><div class="pay-sym">${img('bullet')}</div><div class="pay-vals"><b>Balle d’or</b><br><span>Avec une connexion, le revolver tire sur les cases gagnantes</span></div></div>
      <div class="pay-item"><div class="pay-sym">${img('scat')}</div><div class="pay-vals"><b>Avis de recherche</b><br><span>3 : ${FS_FOR[3]} tours · 4 : ${FS_FOR[4]} tours · 5 : ${FS_FOR[5]} tours</span></div></div></div>
      <h4>Volatilité extrême</h4><p>Beaucoup de tours ne paient rien, mais une partie peut payer jusqu’à <b>×${CAPX.toLocaleString('fr-FR')} la mise</b>.</p>
      <h4>${WAYS} façons de gagner</h4><p>Rouleaux de 3, 4, 4, 4 et 3 cases. Un symbole paie quand il est sur 3 rouleaux côte à côte ou plus, en partant de la gauche, <b>sur n’importe quelle rangée</b> : chaque combinaison de cases compte (2 symboles sur un rouleau = 2 fois plus de façons). Le <b>WILD</b> tombe sur les rouleaux 2 à 4 et <b>couvre tout son rouleau</b>.</p>
      <h4>Le revolver</h4><p>Une <b>balle d’or</b> n’importe où + une connexion : le revolver tire <b>1 à 3 balles</b> (une de plus par balle d’or en plus) sur les cases de la connexion. Chaque case touchée <b>prend feu</b> avec un multiplicateur (${sm}). Les multiplicateurs des cases en feu d’une ligne <b>se multiplient entre eux</b> (jusqu’à ×${TUNE.lineCap.toLocaleString('fr-FR')} par connexion). Le barillet a 6 balles et se recharge quand il est vide.</p>
      <h4>Le Duel</h4><p>3 avis de recherche ou plus : tours gratuits. À chaque gain, le revolver tire des <b>grosses balles</b> (${bg}). Les cases en feu <b>restent en feu</b> jusqu’à la fin, et une case touchée à nouveau multiplie encore son multiplicateur (jusqu’à ×${TUNE.capFree} par case, ×${TUNE.lineCapFree.toLocaleString('fr-FR')} par connexion). 3 avis de recherche : +${RETRIGGER} tours.</p>
      <h4>La roulette russe</h4><p>À la fin du duel, tu peux jouer ton gain : choisis combien de balles mettre dans le barillet (1 à 5), puis tire. Si la chambre est vide, ton gain est multiplié (${[1, 2, 3, 4, 5].map((k) => `${k} balle${k > 1 ? 's' : ''} ×${GAMBLE[k].toLocaleString('fr-FR')}`).join(', ')}) et tu peux rejouer. Si le coup part, <b>tout est perdu</b>. Ou ramasse ton gain quand tu veux.</p>
      <h4>Achats</h4><p>Le Duel ×${BUY_COST} la mise (10 tours). Le Duel extrême ×${BUY_X_COST} la mise : ${TUNE.xSpins} tours et des cases déjà en feu (${TUNE.xBurn.flatMap(([m, n]) => Array(n).fill(xs(m))).join(', ')}). Gain maximum ×${CAPX.toLocaleString('fr-FR')}.</p>`);
  }
}

return { BarilletGame };
})();
