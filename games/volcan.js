// SpinBet Casino · VolcanGame — loaded on demand by games/impl/index.js (index.html).
// ---- games/impl/volcan-engine.js ----
__mods['games/impl/volcan-engine.js'] = (() => {
// Le Volcan math (pure, no DOM, so the simulator can check the RTP). Extreme volatility.
// 6×5 grid, pays anywhere (8+ of a kind), tumbles, lava stones ×2 to ×500 (summed, they multiply the spin win),
// and the pressure: every explosion (winning tumble) adds 1 pressure point; past the TUNE.press thresholds the pressure
// multiplier doubles (×1 ×2 ×4 ×8 ×16). In the base game the pressure starts again at 0 each spin; during the
// ÉRUPTION (10 free spins) it never goes down. Extreme buy: the pressure starts at ×4.

const COLS = 6, ROWS = 5, N = 30, MIN = 8, CAPX = 25000;
const SC = 9, LAVA = 10;
// 0 violet crystal, 1 blue crystal, 2 green crystal, 3 yellow crystal, 4 red crystal, 5 shell, 6 ammonite, 7 mask, 8 lava idol
// pays in bet multiples for 8-9, 10-11 and 12+ symbols
const PAYS = [
  [0.25, 0.75, 2], [0.4, 0.9, 4], [0.5, 1, 5], [0.8, 1.2, 8], [1, 1.5, 10],
  [1.5, 2, 12], [2, 5, 15], [2.5, 10, 25], [10, 25, 50],
];
const SCATTER_PAY = { 4: 3, 5: 10, 6: 100 };
const LEVELS = [1, 2, 4, 8, 16];
// tuned by simulation (6 M spins): RTP ≈ 92 %, a win 1 spin in 5, ÉRUPTION 1 spin in 325 (≈ ×130 on average),
// buys ≈ 88 % (×150) and ≈ 87 % (×500), max win ×25 000 reachable
const TUNE = {
  payScale: 0.805, payScaleFree: 0.97, xPress: 6, // xPress: the pressure points the extreme buy starts with
  press: [3, 6, 10, 15], pressFree: [2, 4, 7, 11], // pressure points for ×2 ×4 ×8 ×16 (base spin / ÉRUPTION)
  w: [14, 14, 13, 13, 12, 10, 9, 7, 5], wFree: [20, 19, 17, 15, 12, 10, 8, 6, 4],
  sc: 1.9, scFree: 1.6,
  lava: 0.012, lavaFree: 0.08,
  lavav: [[2, 400], [3, 260], [4, 160], [5, 140], [6, 70], [8, 50], [10, 50], [15, 22], [20, 14], [25, 10], [50, 5], [100, 2.5], [250, 0.6], [500, 0.25]],
  lavavFree: [[2, 200], [3, 160], [4, 120], [5, 110], [6, 70], [8, 60], [10, 60], [15, 30], [20, 22], [25, 16], [50, 8], [100, 4], [250, 1], [500, 0.4]],
};
const FREE_SPINS = 10, RETRIGGER = 5, BUY_COST = 150, BUY_X_COST = 500;
const xStart = () => TUNE.xPress; // extreme buy: the pressure starts high

const wpick = (l) => { let t = 0; for (const x of l) t += x[1]; let r = Math.random() * t; for (const x of l) { if (r < x[1]) return x[0]; r -= x[1]; } return l[l.length - 1][0]; };
const SW = (w) => w.reduce((a, b) => a + b, 0);
const levelOf = (p, free) => { const T = free ? TUNE.pressFree : TUNE.press; let k = 0; while (k < T.length && p >= T[k]) k++; return k; };

function draw(free) {
  if (Math.random() < (free ? TUNE.lavaFree : TUNE.lava)) return { s: LAVA, m: wpick(free ? TUNE.lavavFree : TUNE.lavav) };
  const w = free ? TUNE.wFree : TUNE.w, sw = SW(w), sc = free ? TUNE.scFree : TUNE.sc;
  let x = Math.random() * (sw + sc);
  if (x >= sw) return { s: SC };
  for (let i = 0; i < w.length; i++) { if (x < w[i]) return { s: i }; x -= w[i]; }
  return { s: 0 };
}

const payFor = (s, n, free) => (free ? TUNE.payScaleFree : TUNE.payScale) * (n >= 12 ? PAYS[s][2] : n >= 10 ? PAYS[s][1] : PAYS[s][0]);

// One paid or free spin. Returns the steps to animate and the totals (in bet multiples).
// state.press = pressure points (kept between free spins by the caller; a new object each base spin).
function spin({ free = false, forceScatters = 0, state = { press: 0 } } = {}) {
  const grid = Array.from({ length: N }, () => draw(free));
  if (forceScatters) {
    grid.forEach((c, i) => { if (c.s === SC) grid[i] = { s: 0 }; });
    const idx = [...Array(N).keys()].sort(() => Math.random() - 0.5).slice(0, forceScatters);
    idx.forEach((i) => { grid[i] = { s: SC }; });
  }
  const pressBefore = state.press;
  const steps = [{ k: 'init', grid: grid.map((c) => ({ ...c })) }];
  let tumble = 0, rounds = 0;
  while (rounds < 60) {
    const counts = {};
    grid.forEach((c, i) => { if (c.s < SC) (counts[c.s] = counts[c.s] || []).push(i); });
    const wins = [];
    for (const s in counts) if (counts[s].length >= MIN) wins.push({ s: +s, n: counts[s].length, cells: counts[s], pay: payFor(+s, counts[s].length, free) });
    if (!wins.length) break;
    const removed = new Set(wins.flatMap((w) => w.cells));
    const paid = wins.reduce((a, w) => a + w.pay, 0);
    tumble += paid;
    state.press++;
    for (let c = 0; c < COLS; c++) {
      const keep = [];
      for (let r = 0; r < ROWS; r++) { const i = c * ROWS + r; if (!removed.has(i)) keep.push(grid[i]); }
      const miss = ROWS - keep.length;
      for (let r = 0; r < ROWS; r++) grid[c * ROWS + r] = r < miss ? draw(free) : keep[r - miss];
    }
    steps.push({ k: 'win', wins, paid, removed: [...removed], after: grid.map((c) => ({ ...c })), press: state.press, lvl: levelOf(state.press, free) });
    rounds++;
  }
  const stones = [];
  grid.forEach((c, i) => { if (c.s === LAVA) stones.push({ i, m: c.m }); });
  const lavaSum = stones.reduce((a, o) => a + o.m, 0);
  const scat = grid.filter((c) => c.s === SC).length;
  const lvl = levelOf(state.press, free), pm = LEVELS[lvl];
  const mult = tumble > 0 ? (lavaSum || 1) * pm : 1;
  const win = tumble * mult;
  const scatterWin = SCATTER_PAY[Math.min(scat, 6)] || 0;
  const total = Math.min(CAPX, win + scatterWin);
  steps.push({ k: 'end', stones, lavaSum, pm, lvl, mult, pressBefore, press: state.press, tumble, scat, scatterWin });
  return { steps, total, tumble, lavaSum, pm, mult, scat, scatterWin, capped: win + scatterWin >= CAPX };
}

// Whole ÉRUPTION (used by the simulator; the game plays the same spins one by one).
function freeRound(extreme = false) {
  const state = { press: extreme ? xStart() : 0 };
  let left = FREE_SPINS, total = 0, spins = 0;
  while (left > 0 && spins < 300) {
    left--; spins++;
    const r = spin({ free: true, state });
    total += r.total;
    if (r.scat >= 3) left += RETRIGGER;
    if (total >= CAPX) { total = CAPX; break; }
  }
  return total;
}

return { COLS, ROWS, N, MIN, CAPX, SC, LAVA, PAYS, SCATTER_PAY, LEVELS, TUNE, FREE_SPINS, RETRIGGER, BUY_COST, BUY_X_COST, xStart, levelOf, draw, spin, freeRound };
})();

// ---- games/impl/volcan.js ----
__mods['games/impl/volcan.js'] = (() => {
// Le Volcan: 6×5 pays anywhere, tumbles, lava stones ×2 to ×500 and the pressure (×1 → ×16) that climbs with every
// explosion; ÉRUPTION = 10 free spins where the pressure never goes down. Extreme volatility.
// Math lives in volcan-engine.js (checked by simulation, see the comment above TUNE).

const { BaseGame, fmtC } = __mods['core/base.js'];
const { SymbolGrid } = __mods['core/grid.js'];
const { EXTRA_THEMES } = __mods['core/music.js'];
const E = __mods['games/impl/volcan-engine.js'];
const { COLS, ROWS, N, SC, LAVA, PAYS, TUNE, SCATTER_PAY, LEVELS, FREE_SPINS, RETRIGGER, BUY_COST, BUY_X_COST, CAPX, spin, levelOf, xStart } = E;
const { sfx } = __mods['audio.js'];
const { fx, center } = __mods['fx.js'];
const { el, animateNumber } = __mods['ui.js'];

/* ---------- the symbols (drawn in SVG) ---------- */
const NAMES = ['Améthyste', 'Saphir', 'Jade', 'Topaze', 'Rubis', 'Conque', 'Ammonite', 'Masque', 'Idole de lave'];
const GEM = [
  ['#f5d0fe', '#a855f7', '#4c1d95', 'M50 6 L84 26 L84 72 L50 94 L16 72 L16 26Z', 'M50 6 L50 94 M16 26 L50 46 L84 26 M16 72 L50 56 L84 72'],
  ['#e0f2fe', '#3b82f6', '#1e3a8a', 'M50 4 L90 50 L50 96 L10 50Z', 'M10 50 L90 50 M50 4 L30 50 L50 96 L70 50Z'],
  ['#dcfce7', '#22c55e', '#14532d', 'M34 8 L66 8 L88 40 L50 94 L12 40Z', 'M12 40 L88 40 M34 8 L28 40 L50 94 L72 40 L66 8'],
  ['#fef9c3', '#eab308', '#713f12', 'M50 8 C76 8 92 28 92 52 C92 76 74 94 50 94 C26 94 8 76 8 52 C8 28 24 8 50 8Z', 'M22 40 Q50 22 78 40 M30 70 Q50 82 70 70'],
  ['#ffe4e6', '#ef4444', '#7f1d1d', 'M50 94 L12 44 C4 30 14 10 32 10 C42 10 48 18 50 24 C52 18 58 10 68 10 C86 10 96 30 88 44Z', 'M50 24 L50 94 M24 30 L50 60 L76 30'],
];
const gemSVG = (k) => { const [a, b, c, d, f] = GEM[k]; return `<svg viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="vcG${k}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset=".45" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></linearGradient></defs>
  <path d="${d}" fill="url(#vcG${k})" stroke="${c}" stroke-width="3" stroke-linejoin="round"/><path d="${f}" fill="none" stroke="#fff" stroke-opacity=".4" stroke-width="2"/>
  <ellipse cx="36" cy="28" rx="10" ry="5" fill="#fff" opacity=".55" transform="rotate(-30 36 28)"/></svg>`; };
const SHELL = `<svg viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="vcSh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff1e6"/><stop offset=".5" stop-color="#fb923c"/><stop offset="1" stop-color="#9a3412"/></linearGradient></defs>
  <path d="M50 92 L8 44 C14 16 34 6 50 6 C66 6 86 16 92 44Z" fill="url(#vcSh)" stroke="#7c2d12" stroke-width="3" stroke-linejoin="round"/>
  <path d="M50 92 L50 8 M50 92 L28 12 M50 92 L72 12 M50 92 L14 28 M50 92 L86 28" stroke="#7c2d12" stroke-width="2.5" opacity=".55"/><path d="M38 92 H62 L56 98 H44Z" fill="#7c2d12"/></svg>`;
const AMMO = `<svg viewBox="0 0 100 100" aria-hidden="true"><defs><radialGradient id="vcAm" cx=".4" cy=".35"><stop offset="0" stop-color="#fde68a"/><stop offset=".55" stop-color="#b45309"/><stop offset="1" stop-color="#451a03"/></radialGradient></defs>
  <circle cx="50" cy="50" r="44" fill="url(#vcAm)" stroke="#451a03" stroke-width="3"/>
  <path d="M50 50 m0 -6 a6 6 0 1 1 -6 6 a12 12 0 1 1 12 12 a20 20 0 1 1 -20 -20 a28 28 0 1 1 28 28 a36 36 0 0 1 -36 -36" fill="none" stroke="#451a03" stroke-width="3.5" stroke-linecap="round"/>
  ${[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((a) => `<path d="M${50 + 30 * Math.cos(a * Math.PI / 180)} ${50 + 30 * Math.sin(a * Math.PI / 180)} L${50 + 42 * Math.cos(a * Math.PI / 180)} ${50 + 42 * Math.sin(a * Math.PI / 180)}" stroke="#fde68a" stroke-width="2" opacity=".5"/>`).join('')}</svg>`;
const MASK = `<svg viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="vcMk" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d6a46b"/><stop offset=".5" stop-color="#92400e"/><stop offset="1" stop-color="#3b1505"/></linearGradient></defs>
  <path d="M22 8 H78 Q86 8 86 18 V74 Q86 94 50 96 Q14 94 14 74 V18 Q14 8 22 8Z" fill="url(#vcMk)" stroke="#2a0f03" stroke-width="3"/>
  <path d="M22 22 H78" stroke="#2a0f03" stroke-width="4"/><circle cx="34" cy="40" r="10" fill="#2a0f03"/><circle cx="66" cy="40" r="10" fill="#2a0f03"/>
  <circle cx="34" cy="40" r="4.5" fill="#fb923c"/><circle cx="66" cy="40" r="4.5" fill="#fb923c"/><path d="M50 46 L42 62 H58Z" fill="#2a0f03"/>
  <rect x="28" y="68" width="44" height="16" rx="5" fill="#2a0f03"/><path d="M34 68 V84 M42 68 V84 M50 68 V84 M58 68 V84 M66 68 V84" stroke="#fde68a" stroke-width="2.5"/></svg>`;
const IDOL = `<svg viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="vcId" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#475569"/><stop offset=".6" stop-color="#1e293b"/><stop offset="1" stop-color="#020617"/></linearGradient>
  <linearGradient id="vcIl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fef08a"/><stop offset=".5" stop-color="#f97316"/><stop offset="1" stop-color="#dc2626"/></linearGradient></defs>
  <path d="M28 6 H72 Q82 6 82 18 V60 Q82 72 74 76 L70 96 H30 L26 76 Q18 72 18 60 V18 Q18 6 28 6Z" fill="url(#vcId)" stroke="#000" stroke-width="3"/>
  <path d="M26 30 H44 L40 40 H28Z M56 30 H74 L72 40 H60Z" fill="url(#vcIl)"/><path d="M44 46 L50 60 L56 46" fill="none" stroke="#000" stroke-width="3"/>
  <path d="M32 70 H68 L64 80 H36Z" fill="url(#vcIl)"/><path d="M50 6 L46 18 L54 24 L48 30 M74 50 L66 56 L70 64 M24 48 L30 56" fill="none" stroke="url(#vcIl)" stroke-width="2.5"/></svg>`;
const CRATER = `<svg viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="vcCr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#57534e"/><stop offset="1" stop-color="#1c1917"/></linearGradient>
  <radialGradient id="vcCf" cx=".5" cy=".8"><stop offset="0" stop-color="#fff7ae"/><stop offset=".4" stop-color="#fb923c"/><stop offset="1" stop-color="#dc2626" stop-opacity="0"/></radialGradient></defs>
  <path d="M50 4 C30 14 26 30 40 40 C34 22 50 18 50 4Z M50 4 C70 14 74 30 60 40 C66 22 50 18 50 4Z" fill="#f97316"/><circle cx="50" cy="36" r="24" fill="url(#vcCf)"/>
  <path d="M4 94 L36 40 H64 L96 94Z" fill="url(#vcCr)" stroke="#0c0a09" stroke-width="3" stroke-linejoin="round"/>
  <path d="M36 40 Q50 48 64 40 L56 58 L60 70 L50 62 L44 80 L42 60 L38 54Z" fill="#f97316"/><path d="M40 42 Q50 46 60 42" stroke="#fef08a" stroke-width="3" fill="none"/></svg>`;
const STONE = `<svg viewBox="0 0 100 100" aria-hidden="true"><defs><radialGradient id="vcSt" cx=".45" cy=".4"><stop offset="0" stop-color="#44403c"/><stop offset="1" stop-color="#0c0a09"/></radialGradient>
  <radialGradient id="vcSg" cx=".5" cy=".5"><stop offset="0" stop-color="#fb923c" stop-opacity=".9"/><stop offset="1" stop-color="#dc2626" stop-opacity="0"/></radialGradient></defs>
  <circle cx="50" cy="52" r="48" fill="url(#vcSg)"/><path d="M22 30 L46 12 L76 20 L90 48 L78 80 L44 90 L14 70 L10 44Z" fill="url(#vcSt)" stroke="#000" stroke-width="2.5"/>
  <path d="M46 12 L50 34 L30 50 L44 66 L44 90 M50 34 L76 40 L78 80 M76 40 L90 48 M30 50 L10 44" fill="none" stroke="#fdba74" stroke-width="3.5" stroke-linejoin="round"/>
  <path d="M46 12 L50 34 L30 50 L44 66 L44 90 M50 34 L76 40 L78 80" fill="none" stroke="#fef08a" stroke-width="1.2"/></svg>`;
const ART = [0, 1, 2, 3, 4].map(gemSVG).concat([SHELL, AMMO, MASK, IDOL]);
const lab = (t) => `<b class="sg-lab vc-lab">${t}</b>`;
const cellArt = (c) => (c.s === LAVA ? STONE + lab('×' + c.m) : c.s === SC ? CRATER + '<i class="vc-tag">BONUS</i>' : ART[c.s]);
const cellCls = (c) => (c.s === LAVA ? `lava${c.m >= 50 ? ' hot' : ''}` : c.s === SC ? 'scatter' : c.s >= 5 ? 'hi' : '');
const EMBERS = Array.from({ length: 18 }, (_, i) => `<i style="--x:${(i * 37) % 100}%;--d:${4 + (i % 5)}s;--l:${-(i * 0.7).toFixed(1)}s;--s:${2 + (i % 3)}px"></i>`).join('');

class VolcanGame extends BaseGame {
  constructor(root, game) {
    super(root, game, {
      music: EXTRA_THEMES.volcan,
      frameCls: 'vc-frame',
      stage: `<div class="vc-stage">
        <div class="vc-sky"><i class="vc-mount"></i><i class="vc-lava-flow"></i><div class="vc-embers">${EMBERS}</div></div>
        <div class="vc-top">
          <div class="vc-press"><small>Pression</small>
            <div class="vc-lv">${LEVELS.map((m, k) => `<i data-k="${k}">×${m}</i>`).join('')}</div>
            <div class="vc-bar"><b></b></div><em class="vc-pts">0 explosion</em></div>
          <div class="vc-lava"><small>Lave</small><b>×<span>0</span></b></div>
        </div>
        <div class="grid-host"></div>
      </div>`,
      buys: [
        { id: 'fs', icon: '🌋', label: `ÉRUPTION · ${FREE_SPINS} tours`, desc: 'La pression ne redescend jamais : ×2, ×4, ×8, ×16', cost: (b) => b * BUY_COST },
        { id: 'fsx', icon: '🔥', label: `ÉRUPTION EXTRÊME · ${FREE_SPINS} tours`, desc: 'La pression démarre à ×4, à une explosion du ×8', cost: (b) => b * BUY_X_COST },
      ],
      hello: '8 symboles identiques n’importe où · chaque explosion fait monter la pression',
    });
    this.pressEl = this.q('.vc-press');
    this.lavaEl = this.q('.vc-lava');
    this.lavaVal = 0;
    this.grid = new SymbolGrid(this.q('.grid-host'), { cols: COLS, rows: ROWS, game: this, art: cellArt, cls: cellCls });
    this.grid.setAll(Array.from({ length: N }, () => ({ s: Math.floor(Math.random() * 9) })));
    this.setPress(0, false);
  }

  // The pressure gauge: the reached level glows, the bar fills toward the next one.
  setPress(p, free, bump = false) {
    const T = free ? TUNE.pressFree : TUNE.press, k = levelOf(p, free);
    const lo = k ? T[k - 1] : 0, hi = T[k] ?? T[T.length - 1];
    const frac = k >= T.length ? 1 : (p - lo) / Math.max(1, hi - lo);
    this.pressEl.querySelectorAll('.vc-lv i').forEach((n) => n.classList.toggle('on', +n.dataset.k <= k));
    this.pressEl.querySelector('.vc-bar b').style.width = `${Math.round(frac * 100)}%`;
    this.pressEl.querySelector('.vc-pts').textContent = k >= T.length ? 'PRESSION MAX ×16' : `${p} explosion${p > 1 ? 's' : ''} · ×${LEVELS[k + 1]} à ${hi}`;
    this.slotEl.dataset.lvl = k;
    if (bump) { this.pressEl.classList.remove('bump'); void this.pressEl.offsetWidth; this.pressEl.classList.add('bump'); }
    return k;
  }

  setLava(v, bump = false) {
    const num = this.lavaEl.querySelector('span'), from = this.lavaVal;
    this.lavaVal = v;
    this.lavaEl.classList.toggle('hot', v > 0);
    if (bump && v > from) { animateNumber(num, from, v, this.turbo ? 200 : 500, (x) => Math.round(x)); this.lavaEl.classList.remove('bump'); void this.lavaEl.offsetWidth; this.lavaEl.classList.add('bump'); } else num.textContent = v;
  }

  // the volcano roars: the pressure reached a new level
  erupt(k) {
    const m = LEVELS[k];
    this.flash(m >= 8 ? 'rgba(255,80,0,.55)' : 'rgba(255,150,40,.4)');
    this.shake();
    sfx.upgrade();
    const p = center(this.pressEl);
    fx.burst(p.x, p.y, m >= 8 ? 60 : 30, ['#fef08a', '#fb923c', '#ef4444'], 8);
    const w = el('div', 'vc-word', `PRESSION ×${m}`);
    this.q('.vc-stage').appendChild(w);
    setTimeout(() => w.remove(), 1300);
  }

  onMain() {
    this.round(async () => {
      const bet = this.bet;
      if (!this.pay(bet)) return;
      this.lastStake = bet;
      const r = await this.playSpin(false, { press: 0 });
      if (r.total > 0) await this.celebrate(Math.round(r.total * bet));
      if (r.scat >= 4) { this.stopAuto(); await this.eruption(false); }
    });
  }

  async onBuy(id) { await this.eruption(id === 'fsx'); }

  // Animates one engine spin; credits it; returns the engine result.
  async playSpin(free, state) {
    const bet = this.bet;
    const r = spin({ free, state });
    this.setLast(0); this.winAmt.textContent = '';
    this.setLava(0);
    this.setPress(r.steps[r.steps.length - 1].pressBefore, free);
    this.msg(free ? 'Le volcan gronde…' : 'La terre tremble…');
    let run = 0, lvl = levelOf(r.steps[r.steps.length - 1].pressBefore, free);
    for (const st of r.steps) {
      if (this.dead) return r;
      if (st.k === 'init') {
        let sc = 0;
        await this.grid.dropIn(st.grid, {
          tease: (c) => { const t = sc >= 3; for (let k = 0; k < ROWS; k++) if (st.grid[c * ROWS + k].s === SC) sc++; return t; },
          onLand: (i, v) => this.landed(i, v),
        });
      } else if (st.k === 'win') {
        st.wins.forEach((w) => this.grid.floatOver(w.cells, `+${fmtC(Math.round(w.pay * bet))}`));
        this.grid.mark(st.removed);
        this.msg(st.wins.map((w) => `${w.n} × ${NAMES[w.s]} : +${fmtC(Math.round(w.pay * bet))}`).join(' · '));
        sfx.win();
        await this.wait(650);
        this.grid.unmark();
        await this.grid.explode(st.removed, ['#fef08a', '#fb923c', '#ef4444']);
        // every explosion pushes the pressure up
        this.setPress(st.press, free, true);
        if (st.lvl > lvl) { lvl = st.lvl; this.erupt(lvl); }
        await this.grid.cascade(st.after, new Set(st.removed));
        for (let c = 0; c < COLS; c++) {
          const miss = st.removed.filter((i) => Math.floor(i / ROWS) === c).length;
          for (let k = 0; k < miss; k++) { const i = c * ROWS + k; if (st.after[i].s === LAVA) this.landed(i, st.after[i]); }
        }
        run += st.paid;
        this.setLast(Math.round(run * bet));
        await this.wait(180);
      } else if (st.k === 'end') {
        if (st.tumble > 0 && st.mult > 1) await this.applyMult(st);
        if (st.scatterWin) { this.msg(`${st.scat} cratères : +${fmtC(st.scatterWin * bet)}`); sfx.jackpot(); }
      }
    }
    const won = Math.round(r.total * bet);
    if (won > 0) { this.win(won, free ? 'Éruption' : null); this.setLast(won); }
    if (!free) this.msg(won > 0 ? `Total du tour : ${fmtC(won)}` : r.scat === 3 ? 'Presque… 3 cratères' : 'Pas de gain');
    return r;
  }

  landed(i, v) {
    const cell = this.grid.cells[i];
    if (v.s === LAVA) {
      sfx.coin();
      const p = center(cell); fx.burst(p.x, p.y, v.m >= 50 ? 34 : 14, ['#fef08a', '#fb923c', '#ef4444'], 6);
      if (v.m >= 100) { this.flash('rgba(255,120,0,.45)'); this.floatAt(cell, `×${v.m} !`, '#fdba74', 34); }
    } else if (v.s === SC) { sfx.land(); this.grid.bump(cell); const p = center(cell); fx.burst(p.x, p.y, 18, ['#fb923c', '#fef08a', '#57534e']); }
  }

  // the lava stones fly into the lava meter, then the win is multiplied by the lava and the pressure
  async applyMult(st) {
    const bet = this.bet;
    sfx.feature();
    let run = 0;
    const target = center(this.lavaEl);
    for (const o of st.stones) {
      const cell = this.grid.cells[o.i];
      cell.classList.add('win');
      await this.wait(140);
      fx.trail(center(cell), target, '#fb923c', 12);
      await this.wait(240);
      run += o.m;
      this.setLava(run, true);
      sfx.upgrade();
    }
    this.flash('rgba(255,140,40,.5)');
    this.shake();
    const before = Math.round(st.tumble * bet), after = Math.round(st.tumble * st.mult * bet);
    const parts = [st.lavaSum ? `lave ×${st.lavaSum}` : '', st.pm > 1 ? `pression ×${st.pm}` : ''].filter(Boolean).join(' · ');
    this.msg(`${fmtC(before)} × ${st.mult.toLocaleString('fr-FR')} (${parts}) = <b>${fmtC(after)}</b>`);
    this.floatAt(this.q('.grid-host'), `×${st.mult.toLocaleString('fr-FR')}`, '#fdba74', 50);
    await this.wait(1100);
    this.grid.unmark();
  }

  async eruption(extreme) {
    const bet = this.bet, state = { press: extreme ? xStart() : 0 };
    let left = FREE_SPINS, done = 0, total = 0;
    this.lastStake = bet;
    await this.featureIntro(extreme ? 'ÉRUPTION EXTRÊME' : 'ÉRUPTION', extreme ? `${FREE_SPINS} tours · la pression démarre à ×${LEVELS[levelOf(state.press, true)]}` : `${FREE_SPINS} tours · la pression ne redescend jamais`, CRATER);
    this.slotEl.classList.add('in-free');
    this.setPress(state.press, true);
    while (left > 0 && !this.dead && !this.maxHit) { // stops at the max win (core/base.js)
      left--; done++;
      this.setBanner(`<b>${extreme ? 'ÉRUPTION EXTRÊME' : 'ÉRUPTION'}</b><span class="pill">Tour ${done} / ${done + left}</span><span class="pill hot">Pression ×${LEVELS[levelOf(state.press, true)]}</span><span class="pill gold">Gain ${fmtC(total)}</span>`);
      const r = await this.playSpin(true, state);
      total = Math.min(bet * CAPX, total + Math.round(r.total * bet));
      if (r.scat >= 3) { left += RETRIGGER; await this.featureIntro(`+${RETRIGGER} TOURS`, 'Le volcan se réveille encore !', CRATER, 1300); }
      if (total >= bet * CAPX) { this.msg(`MAX WIN ×${CAPX.toLocaleString('fr-FR')} !`); break; }
      await this.wait(420);
    }
    this.slotEl.classList.remove('in-free');
    this.setBanner('');
    this.setPress(0, false);
    this.setLava(0);
    this.setLast(total);
    await this.celebrate(total, { summary: extreme ? 'ÉRUPTION EXTRÊME' : 'ÉRUPTION', stake: bet });
    this.msg(`Éruption terminée : ${fmtC(total)} gagnés`);
  }

  info() {
    const f = (x) => x.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
    const rows = ART.map((a, s) => `<div class="pay-item"><div class="pay-sym svg">${a}</div><div class="pay-vals"><b>${NAMES[s]}</b><br><span>8-9 : ×${f(PAYS[s][0] * TUNE.payScale)} · 10-11 : ×${f(PAYS[s][1] * TUNE.payScale)} · 12+ : ×${f(PAYS[s][2] * TUNE.payScale)}</span></div></div>`).reverse().join('');
    return this.rules(`<h4>Table des gains (× la mise)</h4><div class="paytable">${rows}
      <div class="pay-item"><div class="pay-sym svg">${CRATER}</div><div class="pay-vals"><b>Cratère (bonus)</b><br><span>4 : ×${SCATTER_PAY[4]} · 5 : ×${SCATTER_PAY[5]} · 6 : ×${SCATTER_PAY[6]}</span></div></div></div>
      <h4>Volatilité extrême</h4><p>Cette machine est faite pour les vrais joueurs : beaucoup de tours ne paient rien, mais un tour peut payer jusqu’à <b>×${CAPX.toLocaleString('fr-FR')} la mise</b>.</p>
      <h4>Pay Anywhere et cascades</h4><p>Grille 6×5, pas de lignes : <b>8 symboles identiques ou plus n’importe où</b> paient. Ils explosent et de nouveaux tombent, tant qu’il y a des gains.</p>
      <h4>La pression</h4><p>Chaque explosion fait monter la pression du volcan. Dans un tour normal : ${TUNE.press.map((p, k) => `${p} explosions = ×${LEVELS[k + 1]}`).join(', ')}. Elle repart de zéro au tour suivant.</p>
      <h4>Pierres de lave</h4><p>Des pierres de lave de <b>×2 à ×500</b> tombent n’importe quand. À la fin du tour, s’il y a eu un gain, elles <b>s’additionnent</b>, puis le gain est multiplié par la lave <b>et</b> par la pression.</p>
      <h4>Éruption</h4><p>4 cratères ou plus : <b>${FREE_SPINS} tours gratuits</b>. La pression <b>ne redescend jamais</b> pendant tout le bonus : ${TUNE.pressFree.map((p, k) => `${p} explosions = ×${LEVELS[k + 1]}`).join(', ')}. 3 cratères pendant le bonus : +${RETRIGGER} tours.</p>
      <h4>Achats</h4><p>Éruption ×${BUY_COST} la mise. Éruption extrême ×${BUY_X_COST} la mise : la pression démarre à ×${LEVELS[levelOf(xStart(), true)]}, à une explosion du ×${LEVELS[levelOf(xStart(), true) + 1]}. Gain maximum ×${CAPX.toLocaleString('fr-FR')}.</p>`);
  }
}

return { VolcanGame };
})();
