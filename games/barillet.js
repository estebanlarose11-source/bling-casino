// SpinBet Casino · BarilletGame — loaded on demand by games/impl/index.js (index.html).
// ---- games/impl/barillet-engine.js ----
__mods['games/impl/barillet-engine.js'] = (() => {
// La Roulette Russe math (pure, no DOM, so the simulator can check the RTP). Extreme volatility.
// 5 reels × 4 rows, 20 lines (left to right, 3+ in a row). WILD skull on reels 2 to 5. 3+ WANTED posters
// anywhere = LE DUEL (8 / 10 / 12 free spins). During the free spins, golden bullets land and are loaded in the
// 6-chamber barrel: each loaded bullet doubles the barrel multiplier (×1 → ×2 → ×4 … ×64), which multiplies every
// win of the free spins and never goes down. Extreme buy: the barrel starts with bullets already loaded.
// After a bonus the player may play the Russian roulette on the bonus win (GAMBLE, return 96 %: not in the RTP).

const COLS = 5, ROWS = 4, N = 20, CAPX = 20000;
const NS = 10, WILD = 10, SC = 11, BULLET = 12, CHAMBERS = 6;
// 0 spade, 1 heart, 2 diamond, 3 club, 4 cactus, 5 horseshoe, 6 whisky, 7 hat, 8 revolver, 9 sheriff star
// pays per line, in multiples of the total bet, for 3, 4 and 5 in a row
const PAYS = [
  [0.1, 0.25, 1], [0.1, 0.25, 1], [0.15, 0.4, 1.5], [0.15, 0.4, 1.5], [0.2, 0.6, 2],
  [0.25, 1, 4], [0.4, 1.5, 6], [0.6, 2.5, 10], [0.8, 3.5, 15], [1, 5, 25],
];
// rows of each line on the 5 reels (0 = top row)
const LINES = [
  [1, 1, 1, 1, 1], [2, 2, 2, 2, 2], [0, 0, 0, 0, 0], [3, 3, 3, 3, 3], [0, 1, 2, 1, 0],
  [3, 2, 1, 2, 3], [1, 0, 0, 0, 1], [2, 3, 3, 3, 2], [1, 2, 3, 2, 1], [2, 1, 0, 1, 2],
  [0, 1, 1, 1, 0], [3, 2, 2, 2, 3], [1, 1, 0, 1, 1], [2, 2, 3, 2, 2], [0, 1, 0, 1, 0],
  [3, 2, 3, 2, 3], [1, 2, 1, 2, 1], [2, 1, 2, 1, 2], [0, 0, 1, 0, 0], [3, 3, 2, 3, 3],
];
const FS_FOR = { 3: 10, 4: 12, 5: 15 }, RETRIGGER = 4;
const BUY_COST = 150, BUY_X_COST = 500;
// the Russian roulette: k bullets of 6 in the barrel → the win × GAMBLE[k] if the shot is blank (≈ 96 % each)
const GAMBLE = { 1: 1.15, 2: 1.45, 3: 1.92, 4: 2.88, 5: 5.76 };
// tuned by simulation: RTP ≈ 92 %, a win 1 spin in 4, LE DUEL 1 spin in 375 (≈ ×135 on average), buys ≈ 88 %
const TUNE = {
  payScale: 7.45, payScaleFree: 7,
  w: [13, 13, 12, 12, 11, 9, 7, 5.5, 4.5, 3.5], wFree: [13, 13, 12, 12, 11, 9, 7, 5.5, 4.5, 3.5],
  wild: 1.0, wildFree: 1.6, sc: 1.3, scFree: 1.0,
  bullet: 0.035, xLoad: 4, xSpins: 13, // extreme buy: 4 bullets already in the barrel (×16) and 13 free spins
};

const SW = (w) => w.reduce((a, b) => a + b, 0);
function draw(c, free, state) {
  if (free && state && state.loaded < CHAMBERS && Math.random() < TUNE.bullet) return BULLET;
  const w = free ? TUNE.wFree : TUNE.w, sw = SW(w), wd = c > 0 ? (free ? TUNE.wildFree : TUNE.wild) : 0, sc = free ? TUNE.scFree : TUNE.sc;
  let x = Math.random() * (sw + wd + sc);
  if (x >= sw + wd) return SC;
  if (x >= sw) return WILD;
  for (let i = 0; i < w.length; i++) { if (x < w[i]) return i; x -= w[i]; }
  return 0;
}

// the line wins of a grid: [{ line, s, len, pay, cells }] (reel 1 has no wild, so a line always starts on a symbol)
function lineWins(grid, free) {
  const out = [];
  LINES.forEach((L, li) => {
    const s = grid[L[0]];
    if (s >= NS) return;
    let len = 1;
    while (len < COLS) { const v = grid[len * ROWS + L[len]]; if (v === s || v === WILD) len++; else break; }
    if (len >= 3) out.push({ line: li, s, len, cells: L.slice(0, len).map((r, c) => c * ROWS + r), pay: PAYS[s][len - 3] * (free ? TUNE.payScaleFree : TUNE.payScale) });
  });
  return out;
}

// One paid or free spin. state.loaded = bullets in the barrel (kept between free spins).
function spin({ free = false, forceScatters = 0, state = { loaded: 0 } } = {}) {
  const grid = [];
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) grid.push(draw(c, free, state));
  if (forceScatters) {
    for (let i = 0; i < N; i++) if (grid[i] === SC) grid[i] = 0;
    [...Array(COLS).keys()].sort(() => Math.random() - 0.5).slice(0, forceScatters).forEach((c) => { grid[c * ROWS + Math.floor(Math.random() * ROWS)] = SC; });
  }
  // the bullets go into the barrel first: they count for this spin's wins
  const before = state.loaded, bullets = [];
  for (let i = 0; i < N; i++) if (grid[i] === BULLET && state.loaded < CHAMBERS) { state.loaded++; bullets.push(i); }
  const wins = lineWins(grid, free);
  const line = wins.reduce((a, x) => a + x.pay, 0);
  const mult = free ? 2 ** state.loaded : 1;
  const scat = grid.filter((v) => v === SC).length;
  const total = Math.min(CAPX, line * mult);
  return { grid, wins, line, mult, before, loaded: state.loaded, bullets, scat, total };
}

// Whole bonus (used by the simulator; the game plays the same spins one by one). Without the gamble.
function freeRound(spins = 10, extreme = false) {
  const state = { loaded: extreme ? TUNE.xLoad : 0 };
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

return { COLS, ROWS, N, CAPX, NS, WILD, SC, BULLET, CHAMBERS, PAYS, LINES, FS_FOR, RETRIGGER, BUY_COST, BUY_X_COST, GAMBLE, TUNE, draw, lineWins, spin, freeRound };
})();

// ---- games/impl/barillet.js ----
__mods['games/impl/barillet.js'] = (() => {
// La Roulette Russe: western saloon, 5 reels × 4 rows, 20 lines. 3+ WANTED posters = LE DUEL: golden bullets load the
// 6-chamber barrel during the free spins (×2 per bullet, up to ×64). At the end of the bonus, the Russian roulette:
// the player puts 1 to 5 bullets in the barrel to multiply the bonus win (or loses it all), or collects.
// Math lives in barillet-engine.js (checked by simulation, see the comment above TUNE).

const { BaseGame, fmtC } = __mods['core/base.js'];
const { Reels } = __mods['core/reels.js'];
const { EXTRA_THEMES } = __mods['core/music.js'];
const E = __mods['games/impl/barillet-engine.js'];
const { COLS, ROWS, NS, WILD, SC, BULLET, CHAMBERS, PAYS, LINES, FS_FOR, RETRIGGER, BUY_COST, BUY_X_COST, GAMBLE, TUNE, CAPX, draw, spin } = E;
const { sfx } = __mods['audio.js'];
const { fx, sleep, center } = __mods['fx.js'];

/* ---------- the symbols (drawn in SVG) ---------- */
const NAMES = ['Pique', 'Cœur', 'Carreau', 'Trèfle', 'Cactus', 'Fer à cheval', 'Whisky', 'Chapeau', 'Revolver', 'Étoile du shérif'];
const SUIT = [['♠', '#1e293b', '#94a3b8'], ['♥', '#b91c1c', '#fca5a5'], ['♦', '#c2410c', '#fdba74'], ['♣', '#14532d', '#86efac']];
const suitSVG = (k) => { const [g, c, l] = SUIT[k]; return `<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="44" fill="#f5e6c8" stroke="${c}" stroke-width="5"/>
  <circle cx="50" cy="50" r="36" fill="none" stroke="${l}" stroke-width="2" stroke-dasharray="6 5"/>
  <text x="50" y="68" text-anchor="middle" font-size="54" font-family="Georgia, 'Times New Roman', serif" fill="${c}">${g}</text></svg>`; };
const CACTUS = `<svg viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="rrCa" x1="0" x2="1"><stop offset="0" stop-color="#4ade80"/><stop offset=".6" stop-color="#16a34a"/><stop offset="1" stop-color="#14532d"/></linearGradient></defs>
  <path d="M42 94 V20 Q42 8 50 8 Q58 8 58 20 V94Z M42 56 H28 Q20 56 20 48 V30 Q20 24 26 24 Q32 24 32 30 V46 H42 M58 46 H68 V24 Q68 18 74 18 Q80 18 80 24 V48 Q80 58 70 58 H58" fill="url(#rrCa)" stroke="#052e16" stroke-width="3" stroke-linejoin="round"/>
  <path d="M50 14 V90" stroke="#052e16" stroke-width="2" opacity=".4"/><path d="M30 94 H70 L66 98 H34Z" fill="#92400e"/><circle cx="50" cy="8" r="5" fill="#f472b6"/></svg>`;
const SHOE = `<svg viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="rrHs" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f1f5f9"/><stop offset=".5" stop-color="#94a3b8"/><stop offset="1" stop-color="#334155"/></linearGradient></defs>
  <path d="M22 92 L14 50 Q12 10 50 8 Q88 10 86 50 L78 92 H62 L68 52 Q70 28 50 26 Q30 28 32 52 L38 92Z" fill="url(#rrHs)" stroke="#1e293b" stroke-width="3" stroke-linejoin="round"/>
  ${[[22, 72], [19, 54], [24, 34], [78, 72], [81, 54], [76, 34]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.2" fill="#1e293b"/>`).join('')}</svg>`;
const WHISKY = `<svg viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="rrWh" x1="0" x2="1"><stop offset="0" stop-color="#fbbf24"/><stop offset=".5" stop-color="#b45309"/><stop offset="1" stop-color="#78350f"/></linearGradient></defs>
  <path d="M40 4 H60 V26 Q76 34 76 52 V90 Q76 96 70 96 H30 Q24 96 24 90 V52 Q24 34 40 26Z" fill="url(#rrWh)" stroke="#451a03" stroke-width="3" stroke-linejoin="round"/>
  <rect x="38" y="2" width="24" height="8" rx="2" fill="#451a03"/><rect x="30" y="54" width="40" height="26" rx="3" fill="#f5e6c8" stroke="#451a03" stroke-width="2"/>
  <text x="50" y="72" text-anchor="middle" font-size="15" font-weight="900" font-family="Georgia, serif" fill="#7f1d1d">XXX</text><path d="M32 36 Q30 60 32 88" stroke="#fff" stroke-width="3" opacity=".4" fill="none"/></svg>`;
const HAT = `<svg viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="rrHt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d6a46b"/><stop offset=".6" stop-color="#92400e"/><stop offset="1" stop-color="#451a03"/></linearGradient></defs>
  <path d="M30 60 Q28 26 40 20 Q50 30 60 20 Q72 26 70 60Z" fill="url(#rrHt)" stroke="#2a0f03" stroke-width="3" stroke-linejoin="round"/>
  <path d="M4 62 Q20 54 30 58 H70 Q80 54 96 62 Q90 78 50 78 Q10 78 4 62Z" fill="url(#rrHt)" stroke="#2a0f03" stroke-width="3" stroke-linejoin="round"/>
  <path d="M30 54 H70" stroke="#7f1d1d" stroke-width="6"/><circle cx="62" cy="54" r="3" fill="#fde68a"/></svg>`;
const GUN = `<svg viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="rrGn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e2e8f0"/><stop offset=".5" stop-color="#64748b"/><stop offset="1" stop-color="#1e293b"/></linearGradient></defs>
  <path d="M6 30 H70 L74 26 H84 V44 H54 L50 50 H36 L30 44 H6Z" fill="url(#rrGn)" stroke="#0f172a" stroke-width="3" stroke-linejoin="round"/>
  <circle cx="44" cy="40" r="10" fill="#475569" stroke="#0f172a" stroke-width="3"/><path d="M36 50 L50 50 L56 90 Q56 96 48 96 H34 Q28 96 28 88Z" fill="#7c2d12" stroke="#2a0f03" stroke-width="3" stroke-linejoin="round"/>
  <path d="M50 50 Q60 56 56 66" fill="none" stroke="#0f172a" stroke-width="3"/><path d="M36 64 H48 M35 74 H50" stroke="#fde68a" stroke-width="2" opacity=".6"/></svg>`;
const STAR = `<svg viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="rrSt" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff7c2"/><stop offset=".45" stop-color="#f5c518"/><stop offset="1" stop-color="#92400e"/></linearGradient></defs>
  <path d="M50 4 L62 34 L94 36 L68 56 L78 88 L50 70 L22 88 L32 56 L6 36 L38 34Z" fill="url(#rrSt)" stroke="#713f12" stroke-width="3" stroke-linejoin="round"/>
  ${[[50, 4], [94, 36], [78, 88], [22, 88], [6, 36]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5" fill="#fde68a" stroke="#713f12" stroke-width="2"/>`).join('')}
  <circle cx="50" cy="50" r="15" fill="none" stroke="#713f12" stroke-width="2.5"/><text x="50" y="56" text-anchor="middle" font-size="14" font-weight="900" font-family="Georgia, serif" fill="#713f12">★</text></svg>`;
const SKULL = `<svg viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="rrSk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffbeb"/><stop offset="1" stop-color="#d6c7a1"/></linearGradient></defs>
  <path d="M4 22 Q10 40 28 36 Q22 28 26 20 Q14 24 4 22Z M96 22 Q90 40 72 36 Q78 28 74 20 Q86 24 96 22Z" fill="#e7dcc0" stroke="#57534e" stroke-width="2.5"/>
  <path d="M26 30 Q50 14 74 30 Q80 52 66 66 L62 88 Q50 96 38 88 L34 66 Q20 52 26 30Z" fill="url(#rrSk)" stroke="#57534e" stroke-width="3" stroke-linejoin="round"/>
  <path d="M32 44 L46 48 L42 58 L32 54Z M68 44 L54 48 L58 58 L68 54Z" fill="#1c1917"/><path d="M44 72 H56 M46 78 H54" stroke="#57534e" stroke-width="3"/>
  <rect x="14" y="80" width="72" height="18" rx="4" fill="#7f1d1d" stroke="#fde68a" stroke-width="2"/><text x="50" y="94" text-anchor="middle" font-size="15" font-weight="900" font-family="Georgia, serif" fill="#fde68a" letter-spacing="2">WILD</text></svg>`;
const WANTED = `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M12 4 H88 L92 96 H8Z" fill="#f2dfb4" stroke="#78350f" stroke-width="3" stroke-linejoin="round"/>
  <path d="M12 4 L18 12 M88 4 L84 14 M8 96 L18 88" stroke="#a16207" stroke-width="2"/>
  <text x="50" y="24" text-anchor="middle" font-size="17" font-weight="900" font-family="Georgia, serif" fill="#451a03" letter-spacing="1">WANTED</text>
  <rect x="26" y="30" width="48" height="38" fill="#d6c7a1" stroke="#451a03" stroke-width="2"/><circle cx="50" cy="45" r="9" fill="#57534e"/><path d="M34 68 Q50 50 66 68Z" fill="#57534e"/><path d="M36 38 H64 L58 32 H42Z" fill="#292524"/>
  <text x="50" y="84" text-anchor="middle" font-size="12" font-weight="900" font-family="Georgia, serif" fill="#7f1d1d">BONUS</text></svg>`;
const BULLET_SVG = `<svg viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="rrBu" x1="0" x2="1"><stop offset="0" stop-color="#92400e"/><stop offset=".35" stop-color="#fff2b8"/><stop offset=".6" stop-color="#f2b632"/><stop offset="1" stop-color="#7c4a03"/></linearGradient>
  <radialGradient id="rrBg"><stop offset="0" stop-color="#fde047" stop-opacity=".8"/><stop offset="1" stop-color="#fde047" stop-opacity="0"/></radialGradient></defs>
  <circle cx="50" cy="50" r="48" fill="url(#rrBg)"/><path d="M36 40 Q36 8 50 4 Q64 8 64 40Z" fill="#b87333" stroke="#451a03" stroke-width="2.5"/>
  <rect x="34" y="40" width="32" height="48" fill="url(#rrBu)" stroke="#451a03" stroke-width="2.5"/><rect x="31" y="86" width="38" height="8" rx="2" fill="#7c4a03" stroke="#451a03" stroke-width="2"/></svg>`;
const ART = [0, 1, 2, 3].map(suitSVG).concat([CACTUS, SHOE, WHISKY, HAT, GUN, STAR]);
const cellArt = (v) => (v === WILD ? SKULL : v === SC ? WANTED : v === BULLET ? BULLET_SVG : ART[v] || ART[0]);
const cellCls = (v) => (v === WILD ? 'wild' : v === SC ? 'scat' : v === BULLET ? 'bullet' : v >= 5 ? 'hi' : '');

// the barrel seen from the back: 6 chambers around the axis (chamber 0 on top)
const CH = Array.from({ length: CHAMBERS }, (_, k) => { const a = (k * 60 - 90) * Math.PI / 180; return [50 + 29 * Math.cos(a), 50 + 29 * Math.sin(a)]; });
const barrelSVG = (cls = '') => `<svg class="rr-barrel-svg ${cls}" viewBox="0 0 100 100" aria-hidden="true"><defs>
  <radialGradient id="rrBl" cx=".4" cy=".35"><stop offset="0" stop-color="#cbd5e1"/><stop offset=".55" stop-color="#475569"/><stop offset="1" stop-color="#0f172a"/></radialGradient>
  <radialGradient id="rrPr" cx=".4" cy=".35"><stop offset="0" stop-color="#fff7c2"/><stop offset=".5" stop-color="#f5c518"/><stop offset="1" stop-color="#92400e"/></radialGradient></defs>
  <g class="rr-rot"><path d="M50 2 L62 10 L80 12 L88 28 L98 40 L94 58 L98 72 L84 84 L72 96 L56 92 L40 98 L28 86 L12 80 L8 62 L2 48 L10 32 L14 14 L32 10Z" fill="url(#rrBl)" stroke="#020617" stroke-width="2"/>
  ${CH.map(([x, y], k) => `<g class="rr-ch" data-k="${k}"><circle cx="${x}" cy="${y}" r="11.5" fill="#020617" stroke="#94a3b8" stroke-width="1.5"/><circle class="rr-pr" cx="${x}" cy="${y}" r="8.5" fill="url(#rrPr)"/><circle class="rr-pr" cx="${x}" cy="${y}" r="3" fill="#92400e"/></g>`).join('')}
  <circle cx="50" cy="50" r="7" fill="#1e293b" stroke="#94a3b8" stroke-width="1.5"/></g></svg>`;

class BarilletGame extends BaseGame {
  constructor(root, game) {
    super(root, game, {
      music: EXTRA_THEMES.barillet,
      frameCls: 'rr-frame',
      stage: `<div class="rr-stage">
        <div class="rr-sky"><i class="rr-sun"></i><i class="rr-mesa"></i><i class="rr-dust"></i></div>
        <div class="rr-board">
          <div class="rr-reels"></div>
          <div class="rr-side"><div class="rr-barrel">${barrelSVG()}</div><div class="rr-mult"><small>Barillet</small><b>×1</b><em>0 / ${CHAMBERS} balles</em></div></div>
        </div>
      </div>`,
      buys: [
        { id: 'fs', icon: '🔫', label: 'LE DUEL · 10 tours', desc: 'Les balles d’or chargent le barillet : ×2 par balle, jusqu’à ×64', cost: (b) => b * BUY_COST },
        { id: 'fsx', icon: '💀', label: `LE DUEL EXTRÊME · ${TUNE.xSpins} tours`, desc: `${TUNE.xLoad} balles déjà dans le barillet : tout démarre à ×${2 ** TUNE.xLoad}`, cost: (b) => b * BUY_X_COST },
      ],
      hello: '20 lignes · 3 avis de recherche pour LE DUEL',
    });
    this.reels = new Reels(this.q('.rr-reels'), { cols: COLS, rows: ROWS, game: this, art: cellArt, cls: cellCls, random: (c) => draw(c, false, null) });
    this.reels.setAll(Array.from({ length: COLS * ROWS }, (_, i) => draw(Math.floor(i / ROWS), false, null)));
    this.pendingC = 0;
    this.setBarrel(0);
  }

  // the side barrel: loaded chambers shine, the multiplier ×2^loaded
  setBarrel(n, bump = false) {
    this.loaded = n;
    this.qa('.rr-barrel .rr-ch').forEach((g) => g.classList.toggle('on', +g.dataset.k < n));
    const m = this.q('.rr-mult');
    m.querySelector('b').textContent = `×${2 ** n}`;
    m.querySelector('em').textContent = `${n} / ${CHAMBERS} balle${n > 1 ? 's' : ''}`;
    m.classList.toggle('hot', n > 0);
    m.classList.toggle('full', n >= CHAMBERS);
    if (bump) { m.classList.remove('bump'); void m.offsetWidth; m.classList.add('bump'); }
  }

  onMain() {
    this.round(async () => {
      const bet = this.bet;
      if (!this.pay(bet)) return;
      this.lastStake = bet;
      const r = await this.playSpin(false, { loaded: 0 });
      const won = Math.round(r.total * bet);
      if (won > 0) { this.win(won); await this.celebrate(won); }
      if (r.scat >= 3) { this.stopAuto(); await this.duel(FS_FOR[Math.min(5, r.scat)], false); }
    });
  }

  async onBuy(id) { await this.duel(id === 'fsx' ? TUNE.xSpins : 10, id === 'fsx'); }

  // Spins the reels, loads the bullets, shows the line wins; returns the engine result (not credited here).
  async playSpin(free, state) {
    const bet = this.bet;
    const r = spin({ free, state });
    this.setLast(0); this.winAmt.textContent = '';
    this.msg(free ? 'Le duel continue…' : 'Les rouleaux tournent…');
    let sc = 0;
    await this.reels.spin(r.grid, {
      tease: (c, vals) => { const t = sc >= 2; for (let k = 0; k < ROWS; k++) if (vals[c * ROWS + k] === SC) sc++; return t; },
      onStop: (c) => { for (let k = 0; k < ROWS; k++) { const v = r.grid[c * ROWS + k]; if (v === SC || v === BULLET) { sfx.land(); const p = center(this.reels.cell(c * ROWS + k)); fx.burst(p.x, p.y, 14, v === SC ? ['#f2dfb4', '#a16207'] : ['#fde047', '#fff']); } } },
    });
    if (this.dead) return r;
    // the golden bullets fly into the barrel: each one doubles the multiplier
    for (let k = 0; k < r.bullets.length; k++) {
      const cell = this.reels.cell(r.bullets[k]), ch = this.qa('.rr-barrel .rr-ch')[r.before + k];
      cell?.classList.add('win');
      fx.trail(center(cell), center(ch), '#fde047', 12);
      sfx.coin();
      await this.wait(380);
      this.setBarrel(r.before + k + 1, true);
      sfx.upgrade();
      this.flash('rgba(253,224,71,.35)');
      this.floatAt(this.q('.rr-mult'), `×${2 ** (r.before + k + 1)}`, '#fde047', 30);
      if (r.before + k + 1 === CHAMBERS) { this.msg('<b>BARILLET PLEIN : ×64 !</b>'); this.shake(); }
      await this.wait(260);
    }
    this.reels.unmark();
    if (r.wins.length) {
      this.reels.mark([...new Set(r.wins.flatMap((w) => w.cells))]);
      const best = r.wins.slice().sort((a, b) => b.pay - a.pay)[0];
      this.msg(`${r.wins.length} ligne${r.wins.length > 1 ? 's' : ''} · ${best.len} × ${NAMES[best.s]}${r.mult > 1 ? ` · barillet ×${r.mult}` : ''} : <b>+${fmtC(Math.round(r.total * bet))}</b>`);
      sfx.win();
      this.setLast(Math.round(r.total * bet));
      await this.wait(r.mult > 1 ? 1000 : 700);
    } else if (!free) this.msg(r.scat === 2 ? 'Presque… 2 avis de recherche' : 'Pas de gain');
    return r;
  }

  async duel(spins, extreme) {
    const bet = this.bet, state = { loaded: extreme ? TUNE.xLoad : 0 }, cap = (this.capC() || CAPX * bet) - (this.roundWin || 0);
    let left = spins, done = 0, total = 0;
    this.lastStake = bet;
    await this.featureIntro(extreme ? 'LE DUEL EXTRÊME' : 'LE DUEL', `${spins} tours · chaque balle d’or double le barillet`, WANTED);
    this.slotEl.classList.add('in-free');
    this.setBarrel(state.loaded);
    while (left > 0 && !this.dead) {
      left--; done++;
      this.setBanner(`<b>${extreme ? 'DUEL EXTRÊME' : 'LE DUEL'}</b><span class="pill">Tour ${done} / ${done + left}</span><span class="pill hot">Barillet ×${2 ** state.loaded}</span><span class="pill gold">Gain ${fmtC(total)}</span>`);
      const r = await this.playSpin(true, state);
      total = Math.min(cap, total + Math.round(r.total * bet));
      this.pendingC = total;
      if (r.scat >= 3) { left += RETRIGGER; await this.featureIntro(`+${RETRIGGER} TOURS`, 'Encore des avis de recherche !', WANTED, 1300); }
      if (total >= cap) { this.msg(`MAX WIN ×${CAPX.toLocaleString('fr-FR')} !`); break; }
      await this.wait(380);
    }
    if (this.dead) return;
    this.slotEl.classList.remove('in-free');
    this.setBanner('');
    this.reels.unmark();
    // the Russian roulette on the bonus win, then the win is paid
    const final = total > 0 && total < cap ? await this.roulette(total, cap) : total;
    this.pendingC = 0;
    this.setBarrel(0);
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
      const paint = () => {
        box.querySelector('.rr-gamt b').textContent = fmtC(amount);
        take.textContent = `💰 Je ramasse ${fmtC(amount)}`;
        opts.innerHTML = [1, 2, 3, 4, 5].map((k) => `<button class="rr-gopt" data-k="${k}"><b>${k} balle${k > 1 ? 's' : ''}</b><span>×${GAMBLE[k].toLocaleString('fr-FR')}</span><em>${fmtC(Math.min(cap, Math.round(amount * GAMBLE[k])))}</em><small>${6 - k} chance${6 - k > 1 ? 's' : ''} sur 6</small></button>`).join('');
        box.querySelectorAll('.rr-ch').forEach((g) => g.classList.remove('on'));
      };
      paint();
      take.addEventListener('click', () => { if (!busy) { sfx.coin(); finish(amount); } });
      opts.addEventListener('pointerover', (e) => { const b = e.target.closest('[data-k]'); if (!b || busy) return; box.querySelectorAll('.rr-ch').forEach((g) => g.classList.toggle('on', +g.dataset.k < +b.dataset.k)); });
      opts.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-k]');
        if (!b || busy) return;
        busy = true;
        const k = +b.dataset.k;
        box.classList.add('busy');
        box.querySelectorAll('.rr-ch').forEach((g) => g.classList.toggle('on', +g.dataset.k < k));
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
    const rows = ART.map((a, s) => `<div class="pay-item"><div class="pay-sym svg">${a}</div><div class="pay-vals"><b>${NAMES[s]}</b><br><span>3 : ×${f(PAYS[s][0])} · 4 : ×${f(PAYS[s][1])} · 5 : ×${f(PAYS[s][2])}</span></div></div>`).reverse().join('');
    return this.rules(`<h4>Table des gains (× la mise, par ligne)</h4><div class="paytable">${rows}
      <div class="pay-item"><div class="pay-sym svg">${SKULL}</div><div class="pay-vals"><b>WILD</b><br><span>Sur les rouleaux 2 à 5, remplace tous les symboles sauf l’avis de recherche</span></div></div>
      <div class="pay-item"><div class="pay-sym svg">${WANTED}</div><div class="pay-vals"><b>Avis de recherche</b><br><span>3 : ${FS_FOR[3]} tours · 4 : ${FS_FOR[4]} tours · 5 : ${FS_FOR[5]} tours</span></div></div></div>
      <h4>Volatilité extrême</h4><p>Beaucoup de tours ne paient rien, mais le duel peut payer jusqu’à <b>×${CAPX.toLocaleString('fr-FR')} la mise</b>.</p>
      <h4>${LINES.length} lignes</h4><p>3 symboles identiques ou plus, côte à côte en partant du premier rouleau, sur une des ${LINES.length} lignes. Les gains de toutes les lignes s’additionnent.</p>
      <h4>Le Duel</h4><p>Pendant les tours gratuits, des <b>balles d’or</b> tombent. Chaque balle se loge dans le barillet et <b>double</b> le multiplicateur de tous les gains : ×2, ×4, ×8, ×16, ×32, jusqu’à <b>×64</b> quand les 6 chambres sont pleines. Il ne redescend jamais. 3 avis de recherche : +${RETRIGGER} tours.</p>
      <h4>La roulette russe</h4><p>À la fin du duel, tu peux jouer ton gain : choisis combien de balles mettre dans le barillet (1 à 5), puis tire. Si la chambre est vide, ton gain est multiplié (${[1, 2, 3, 4, 5].map((k) => `${k} balle${k > 1 ? 's' : ''} ×${GAMBLE[k].toLocaleString('fr-FR')}`).join(', ')}) et tu peux rejouer. Si le coup part, <b>tout est perdu</b>. Ou ramasse ton gain quand tu veux.</p>
      <h4>Achats</h4><p>Le Duel ×${BUY_COST} la mise (10 tours). Le Duel extrême ×${BUY_X_COST} la mise : ${TUNE.xLoad} balles déjà dans le barillet (×${2 ** TUNE.xLoad}) et ${TUNE.xSpins} tours. Gain maximum ×${CAPX.toLocaleString('fr-FR')}.</p>`);
  }
}

return { BarilletGame };
})();
