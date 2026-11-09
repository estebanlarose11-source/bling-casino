// SpinBet Casino · FilonGame — loaded on demand by games/impl/index.js (index.html).
// ---- games/impl/filon-engine.js ----
__mods['games/impl/filon-engine.js'] = (() => {
/* ===ENGINE */
// Le Filon (pure math, no DOM: tools/sim/filon.js reads this block to check the returns).
// 7×7 grid, pays anywhere: 10 identical symbols or more (the jokers count for every symbol), tumbles.
// Every cell has its own multiplier: ×2 the first time a winning symbol explodes there, then doubled (×4, ×8 …).
// A win pays (table) × the AVERAGE multiplier of its cells (a cell without one counts ×1): every winning cell brings
// its share of the win times its own multiplier.
// Specials: joker (counts for every symbol), mystery ore (turns into a random symbol and multiplies the multiplier of
// its cell by ×2, ×4 or ×8; contagious ore: every cell of that symbol too), dynamite (blows when no win is left: 3×3,
// 5×5 with the big dynamite, clears the paying symbols and doubles the multipliers of the area), lamp (+1 free spin,
// +2 with the double lamps, bonus only), BONUS (3, 4 or 5 anywhere at the end of a paid spin → the 3 bonuses).
// Base game: the multipliers start again from zero every spin and stop at ×128. Bonus: they stay until the end
// (a win doubles them up to ×128, mystery ores and dynamite push them up to ×8 192); the table is worth 1/8 there.
const COLS = 7, ROWS = 7, N = 49, MIN = 10, CAPX = 30000, MCAP = 8192;
const WILD = 9, SC = 10, BOMB = 11, MYS = 12, PLUS = 13, MYSX = 14; // MYSX: contagious mystery ore of the base game
// 0 quartz, 1 copper, 2 emerald, 3 sapphire, 4 ruby, 5 lantern, 6 pickaxe, 7 mine cart, 8 gold ingots
// pays in bet multiples for 10-11, 12-13, 14-16, 17-20 and 21+ symbols, × TUNE.pay (base game) or × TUNE.payFree (bonus)
const PAYS = [
  [0.2, 0.4, 1, 3, 8], [0.25, 0.5, 1.2, 3.5, 10], [0.3, 0.6, 1.5, 4, 12], [0.35, 0.75, 1.8, 5, 15], [0.4, 0.9, 2, 6, 18],
  [0.6, 1.2, 3, 9, 25], [0.8, 1.6, 4, 12, 35], [1, 2, 5, 15, 50], [1.5, 3, 8, 25, 75],
];
// tuned by simulation (node tools/sim/filon.js): RTP ≈ 92 %, a win 1 spin in 2.7, a bonus 1 spin in ≈ 275,
// boosted stake ≈ 92 %, buys ≈ 88 %, max win ×30 000 reachable
const TUNE = {
  pay: 0.445, payFree: 0.055,
  w: [11, 11, 11, 11, 11, 11, 11, 11, 11], wFree: [11, 11, 11, 11, 11, 11, 11, 11, 11],
  wild: 0.002, wildFree: 0.04, sc: 0.0049, ante: 1.61, bomb: 0.003, bombFree: 0.003,
  mys: 0.004, mysFree: 0.006, mysX: 0.0005, plus: 0.0012,
  boost: [[2, 60], [4, 30], [8, 10]], mcapBase: 128, mcapWin: 128,
};
// the 3 bonuses: 3, 4 or 5 BONUS symbols; mods = how many bonuses of the wheel; cost = buy price in × the bet
const TIERS = [null,
  { k: 1, name: 'LA VEINE D’OR', spins: 7, mods: 1, cost: 95 },
  { k: 2, name: 'LA GRANDE GALERIE', spins: 8, mods: 2, cost: 225 },
  { k: 3, name: 'LA RUÉE VERS L’OR', spins: 10, mods: 3, cost: 765 }];
const MODS = ['conta', 'big', 'lamp']; // contagious ores, big dynamite 5×5, double lamps (+2)
const ANTE_COST = 2; // boosted stake: × 2 the bet, BONUS symbols × TUNE.ante
const LUCKY = [[1, 60], [2, 30], [3, 10]], LUCKY_COST = 200; // lucky draw: one of the 3 bonuses
// golden spin (buy): GOLD.n cells start with a multiplier drawn in GOLD.v
const GOLD = { n: 10, v: [[8, 30], [16, 26], [32, 20], [64, 13], [128, 6.5], [256, 2.8], [1024, 1.7]] }, GOLD_COST = 5;
const tierOf = (sc) => (sc >= 5 ? 3 : sc >= 4 ? 2 : sc >= 3 ? 1 : 0);

const wpick = (l) => { let t = 0; for (const x of l) t += x[1]; let r = Math.random() * t; for (const x of l) { if (r < x[1]) return x[0]; r -= x[1]; } return l[l.length - 1][0]; };
const shuffled = (l) => { const a = l.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
const SUM = (a) => a.reduce((x, y) => x + y, 0);
const W0 = SUM(TUNE.w), WF = SUM(TUNE.wFree);
const payOf = () => { let x = Math.random() * W0; for (let i = 0; i < 9; i++) { if (x < TUNE.w[i]) return i; x -= TUNE.w[i]; } return 0; };
// one new symbol falling in (o = { free, ante })
function draw(o) {
  const r = Math.random();
  let t = o.free ? TUNE.wildFree : TUNE.wild;
  if (r < t) return WILD;
  if (!o.free) { t += TUNE.sc * (o.ante ? TUNE.ante : 1); if (r < t) return SC; } else { t += TUNE.plus; if (r < t) return PLUS; }
  t += o.free ? TUNE.bombFree : TUNE.bomb; if (r < t) return BOMB;
  t += o.free ? TUNE.mysFree : TUNE.mys; if (r < t) return MYS;
  if (!o.free) { t += TUNE.mysX; if (r < t) return MYSX; }
  const w = o.free ? TUNE.wFree : TUNE.w;
  let x = Math.random() * (o.free ? WF : W0);
  for (let i = 0; i < 9; i++) { if (x < w[i]) return i; x -= w[i]; }
  return 0;
}
const upM = (v, cap) => (v ? Math.min(cap, v * 2) : 2);
const pay = (s, n, free) => (free ? TUNE.payFree : TUNE.pay) * PAYS[s][n >= 21 ? 4 : n >= 17 ? 3 : n >= 14 ? 2 : n >= 12 ? 1 : 0];
const goldPre = () => shuffled([...Array(N).keys()]).slice(0, GOLD.n).map((i) => [i, wpick(GOLD.v)]);
const pickMods = (n) => shuffled(MODS).slice(0, n);

// One spin. o = { free, ante, mods: [], mm: cell multipliers (kept by the caller during the bonus), pre: [[cell, mult]],
// forceSc }. Returns the steps to animate: init, mys (lamps collected, mystery ores opened), win, bomb, end.
function spin(o = {}) {
  const mods = o.mods || [], big = mods.includes('big'), conta = mods.includes('conta');
  const cap = o.free ? MCAP : TUNE.mcapBase, capW = o.free ? TUNE.mcapWin : TUNE.mcapBase;
  const mm = o.mm || new Array(N).fill(0);
  if (o.pre) for (const [i, m] of o.pre) mm[i] = Math.max(mm[i], m);
  const g = new Array(N);
  for (let i = 0; i < N; i++) g[i] = draw(o);
  if (o.forceSc) {
    for (let i = 0; i < N; i++) if (g[i] === SC) g[i] = payOf();
    shuffled([...Array(N).keys()]).slice(0, o.forceSc).forEach((i) => { g[i] = SC; });
  }
  const steps = [{ k: 'init', grid: g.slice(), mm: mm.slice() }];
  let total = 0, rounds = 0, plus = 0, fresh = [...Array(N).keys()];
  while (rounds < 80) {
    // what just landed: the lamps are collected, the mystery ores open
    const lamps = [], opened = [];
    for (const i of fresh) {
      if (g[i] === PLUS) { plus++; lamps.push(i); }
      if (g[i] === MYS || g[i] === MYSX) {
        const x = conta || g[i] === MYSX, s = payOf(), b = wpick(TUNE.boost);
        g[i] = s; mm[i] = mm[i] ? Math.min(cap, mm[i] * b) : b;
        const spread = [];
        if (x) for (let k = 0; k < N; k++) if (k !== i && g[k] === s) { mm[k] = mm[k] ? Math.min(cap, mm[k] * b) : b; spread.push(k); }
        opened.push({ i, s, b, x, spread });
      }
    }
    if (lamps.length || opened.length) steps.push({ k: 'mys', lamps, opened, grid: g.slice(), mm: mm.slice() });
    // wins anywhere, the jokers count for every symbol
    const cnt = new Array(9).fill(0);
    let wilds = 0;
    for (let i = 0; i < N; i++) { const v = g[i]; if (v < 9) cnt[v]++; else if (v === WILD) wilds++; }
    const wins = [];
    for (let s = 0; s < 9; s++) {
      const n = cnt[s] + wilds;
      if (!cnt[s] || n < MIN) continue;
      const cells = []; for (let i = 0; i < N; i++) if (g[i] === s || g[i] === WILD) cells.push(i);
      let m = 0; for (const c of cells) m += mm[c] > 1 ? mm[c] : 1;
      m /= cells.length;
      wins.push({ s, n, cells, m, p: pay(s, n, o.free) * m });
    }
    const rem = new Set();
    let step;
    if (wins.length) {
      let p = 0;
      for (const w of wins) { p += w.p; for (const c of w.cells) rem.add(c); }
      total += p;
      for (const c of rem) mm[c] = Math.max(mm[c], upM(mm[c], capW));
      step = { k: 'win', wins, p };
    } else {
      const bombs = []; for (let i = 0; i < N; i++) if (g[i] === BOMB) bombs.push(i);
      if (!bombs.length) break;
      const R = big ? 2 : 1, hit = new Set();
      for (const b of bombs) {
        const c0 = Math.floor(b / ROWS), r0 = b % ROWS;
        for (let c = Math.max(0, c0 - R); c <= Math.min(COLS - 1, c0 + R); c++) for (let r = Math.max(0, r0 - R); r <= Math.min(ROWS - 1, r0 + R); r++) hit.add(c * ROWS + r);
      }
      // the blast doubles the multipliers and clears the paying symbols (jokers, BONUS and lamps stay)
      for (const c of hit) { mm[c] = upM(mm[c], cap); if (g[c] < 9 || g[c] === BOMB) rem.add(c); }
      step = { k: 'bomb', bombs, hit: [...hit] };
    }
    // the cleared cells fill from above
    fresh = [];
    for (let c = 0; c < COLS; c++) {
      const keep = []; for (let r = 0; r < ROWS; r++) { const i = c * ROWS + r; if (!rem.has(i)) keep.push(g[i]); }
      const miss = ROWS - keep.length;
      for (let r = 0; r < ROWS; r++) { const i = c * ROWS + r; if (r < miss) { g[i] = draw(o); fresh.push(i); } else g[i] = keep[r - miss]; }
    }
    rounds++;
    steps.push({ ...step, rem: [...rem], after: g.slice(), mm: mm.slice(), run: total });
    if (total >= CAPX) break;
  }
  let scat = 0; for (const v of g) if (v === SC) scat++;
  const capped = total >= CAPX;
  if (capped) total = CAPX;
  steps.push({ k: 'end', scat, plus, total });
  return { steps, total, scat, plus, mm, capped };
}

// A whole bonus (the simulator; the game plays the same spins one by one).
function bonus(tier, mods) {
  const T = TIERS[tier]; mods = mods || pickMods(T.mods);
  const mm = new Array(N).fill(0), lamp = mods.includes('lamp') ? 2 : 1;
  let left = T.spins, total = 0, spins = 0;
  while (left > 0 && spins < 200) {
    left--; spins++;
    const r = spin({ free: true, mods, mm });
    total += r.total; left += r.plus * lamp;
    if (total >= CAPX) { total = CAPX; break; }
  }
  return { total, spins, mods };
}

const ENGINE = { COLS, ROWS, N, MIN, CAPX, MCAP, WILD, SC, BOMB, MYS, MYSX, PLUS, PAYS, TUNE, TIERS, MODS, ANTE_COST, LUCKY, LUCKY_COST, GOLD, GOLD_COST, tierOf, wpick, pickMods, goldPre, pay, draw, spin, bonus };
/* ===END ENGINE */
return ENGINE;
})();

// ---- games/impl/filon.js ----
__mods['games/impl/filon.js'] = (() => {
// Le Filon: an old gold mine. 7×7 pays anywhere (10+), tumbles, a multiplier on every cell (×2 → ×8 192), mystery ores,
// dynamite, golden joker; 3 bonuses (3, 4 or 5 BONUS) with the bonus wheel (contagious ores, big dynamite, double
// lamps); boosted stake, golden spin, lucky draw and 3 bonus buys. Math in filon-engine.js (see the comment above TUNE).

const { BaseGame, fmtC } = __mods['core/base.js'];
const { SymbolGrid } = __mods['core/grid.js'];
const { EXTRA_THEMES } = __mods['core/music.js'];
const E = __mods['games/impl/filon-engine.js'];
const { COLS, ROWS, N, MIN, CAPX, MCAP, WILD, SC, BOMB, MYS, MYSX, PLUS, PAYS, TUNE, TIERS, ANTE_COST, LUCKY, LUCKY_COST, GOLD, GOLD_COST, tierOf, wpick, pickMods, goldPre, spin } = E;
const { sfx } = __mods['audio.js'];
const { fx, center } = __mods['fx.js'];
const { el } = __mods['ui.js'];
const { gifts } = __mods['wheel.js'];
const GIFT_BET = 100; // free rounds of the site are played at 1 KE (FREE_BET of core/base.js): never with the boosted stake

/* ---------- the pictures ---------- */
// The owner's pictures (assets/games/filon/<name>.webp) replace the drawings below as soon as their name is in PICS.
// Names: quartz cuivre emeraude saphir rubis lanterne pioche wagonnet lingots joker bonus dynamite mystere contagieux
// lampe, fond (background of the base game), fond-bonus (background of the bonus).
const PICS = new Set([]);
const PIC_V = 1;
const picSrc = (n) => { const f = `assets/games/filon/${n}.webp`; return window.__assets?.[f] || `${f}?v=${PIC_V}`; };
const pic = (n) => `<img class="fl-img" src="${picSrc(n)}" alt="" draggable="false" decoding="async">`;
const KEY = ['quartz', 'cuivre', 'emeraude', 'saphir', 'rubis', 'lanterne', 'pioche', 'wagonnet', 'lingots', 'joker', 'bonus', 'dynamite', 'mystere', 'lampe', 'contagieux'];
const NAMES = ['Quartz rose', 'Cuivre', 'Émeraude', 'Saphir', 'Rubis', 'Lanterne', 'Pioche', 'Wagonnet', 'Lingots d’or'];

const crystal = (id, a, b, c) => `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset=".5" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></linearGradient>`;
const ROCK = '<path d="M6 96 Q20 84 38 88 Q52 80 66 87 Q82 82 94 96Z" fill="#3b2a1c" stroke="#1a110a" stroke-width="2"/>';
const SVG = [
  // quartz rose: a cluster of 3 crystals on a rock
  `<svg viewBox="0 0 100 100" aria-hidden="true"><defs>${crystal('flQz', '#fff1f7', '#f9a8d4', '#9d174d')}</defs>
   <path d="M18 90 L13 54 L25 34 L37 54 L33 90Z" fill="url(#flQz)" stroke="#831843" stroke-width="2.5" stroke-linejoin="round"/>
   <path d="M64 90 L66 58 L78 40 L89 58 L83 90Z" fill="url(#flQz)" stroke="#831843" stroke-width="2.5" stroke-linejoin="round"/>
   <path d="M35 92 L32 40 L50 6 L68 40 L64 92Z" fill="url(#flQz)" stroke="#831843" stroke-width="3" stroke-linejoin="round"/>
   <path d="M50 6 L50 92 M32 40 L50 52 L68 40 M25 34 L25 90 M78 40 L77 90" stroke="#fff" stroke-opacity=".45" stroke-width="2" fill="none"/>
   <path d="M40 38 L48 14" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".7"/>${ROCK}</svg>`,
  // copper: a big raw nugget
  `<svg viewBox="0 0 100 100" aria-hidden="true"><defs><radialGradient id="flCu" cx=".38" cy=".32" r=".75"><stop offset="0" stop-color="#ffd7b0"/><stop offset=".45" stop-color="#e07a3a"/><stop offset="1" stop-color="#6b2a0c"/></radialGradient></defs>
   <path d="M20 40 C16 22 34 10 52 14 C66 6 88 18 86 38 C96 52 88 76 70 82 C58 94 34 92 24 80 C8 72 8 52 20 40Z" fill="url(#flCu)" stroke="#4a1c06" stroke-width="3"/>
   <path d="M34 34 C40 28 48 30 50 36 M60 56 C66 52 72 56 70 62 M30 60 C34 58 38 62 36 66" stroke="#4a1c06" stroke-width="3" fill="none" stroke-linecap="round" opacity=".55"/>
   <ellipse cx="38" cy="28" rx="10" ry="5" fill="#fff" opacity=".55" transform="rotate(-25 38 28)"/><circle cx="72" cy="34" r="3" fill="#fff" opacity=".6"/></svg>`,
  // emerald: step cut
  `<svg viewBox="0 0 100 100" aria-hidden="true"><defs>${crystal('flEm', '#d1fae5', '#10b981', '#064e3b')}</defs>
   <path d="M30 8 H70 L90 28 V72 L70 92 H30 L10 72 V28Z" fill="url(#flEm)" stroke="#064e3b" stroke-width="3" stroke-linejoin="round"/>
   <path d="M36 22 H64 L76 34 V66 L64 78 H36 L24 66 V34Z" fill="none" stroke="#ecfdf5" stroke-opacity=".55" stroke-width="2.2"/>
   <path d="M30 8 L36 22 M70 8 L64 22 M90 28 L76 34 M90 72 L76 66 M70 92 L64 78 M30 92 L36 78 M10 72 L24 66 M10 28 L24 34" stroke="#ecfdf5" stroke-opacity=".45" stroke-width="2"/>
   <path d="M38 28 H56" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".7"/></svg>`,
  // sapphire: a tall kite cut
  `<svg viewBox="0 0 100 100" aria-hidden="true"><defs>${crystal('flSa', '#e0f2fe', '#3b82f6', '#1e1b4b')}</defs>
   <path d="M50 4 L84 36 L50 96 L16 36Z" fill="url(#flSa)" stroke="#1e1b4b" stroke-width="3" stroke-linejoin="round"/>
   <path d="M16 36 H84 M50 4 L36 36 L50 96 L64 36Z M36 36 L50 22 L64 36" fill="none" stroke="#e0f2fe" stroke-opacity=".5" stroke-width="2"/>
   <path d="M34 26 L46 14" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".75"/></svg>`,
  // ruby: round brilliant seen from above
  `<svg viewBox="0 0 100 100" aria-hidden="true"><defs><radialGradient id="flRu" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#ffe4e6"/><stop offset=".4" stop-color="#ef4444"/><stop offset="1" stop-color="#7f1d1d"/></radialGradient></defs>
   <path d="M50 6 L80 18 L94 50 L80 82 L50 94 L20 82 L6 50 L20 18Z" fill="url(#flRu)" stroke="#5f0f0f" stroke-width="3" stroke-linejoin="round"/>
   <path d="M50 26 L67 33 L74 50 L67 67 L50 74 L33 67 L26 50 L33 33Z" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="2"/>
   <path d="M50 6 L50 26 M80 18 L67 33 M94 50 L74 50 M80 82 L67 67 M50 94 L50 74 M20 82 L33 67 M6 50 L26 50 M20 18 L33 33" stroke="#fff" stroke-opacity=".4" stroke-width="2"/>
   <ellipse cx="38" cy="30" rx="9" ry="5" fill="#fff" opacity=".65" transform="rotate(-35 38 30)"/></svg>`,
  // lantern
  `<svg viewBox="0 0 100 100" aria-hidden="true"><defs><radialGradient id="flLaG" cx=".5" cy=".55" r=".5"><stop offset="0" stop-color="#fff7c2"/><stop offset=".45" stop-color="#fbbf24"/><stop offset="1" stop-color="#b45309" stop-opacity="0"/></radialGradient>
   <linearGradient id="flLaM" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#57534e"/><stop offset=".5" stop-color="#d6d3d1"/><stop offset="1" stop-color="#44403c"/></linearGradient></defs>
   <circle cx="50" cy="56" r="42" fill="url(#flLaG)" opacity=".7"/>
   <path d="M38 14 Q50 0 62 14" fill="none" stroke="#a8a29e" stroke-width="4"/>
   <path d="M30 16 H70 L64 28 H36Z" fill="url(#flLaM)" stroke="#1c1917" stroke-width="2.5"/>
   <path d="M36 28 H64 V78 H36Z" fill="#fde68a" fill-opacity=".35" stroke="#1c1917" stroke-width="2.5"/>
   <path d="M50 70 C40 62 44 50 50 40 C56 50 60 62 50 70Z" fill="#fb923c"/><path d="M50 68 C46 62 48 56 50 50 C52 56 54 62 50 68Z" fill="#fff7c2"/>
   <path d="M36 28 V78 M64 28 V78 M50 28 V36" stroke="url(#flLaM)" stroke-width="4"/>
   <path d="M30 78 H70 L66 90 H34Z" fill="url(#flLaM)" stroke="#1c1917" stroke-width="2.5"/></svg>`,
  // pickaxe
  `<svg viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="flPiW" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d6a46b"/><stop offset="1" stop-color="#6b3a12"/></linearGradient>
   <linearGradient id="flPiM" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f5f5f4"/><stop offset=".5" stop-color="#a8a29e"/><stop offset="1" stop-color="#44403c"/></linearGradient></defs>
   <path d="M30 88 L74 26" stroke="#3b1d08" stroke-width="13" stroke-linecap="round"/><path d="M30 88 L74 26" stroke="url(#flPiW)" stroke-width="8" stroke-linecap="round"/>
   <path d="M10 30 Q44 2 92 18 Q90 26 84 26 Q50 16 22 40 Q12 40 10 30Z" fill="url(#flPiM)" stroke="#1c1917" stroke-width="3" stroke-linejoin="round"/>
   <rect x="64" y="14" width="16" height="20" rx="3" transform="rotate(35 72 24)" fill="#57534e" stroke="#1c1917" stroke-width="2.5"/>
   <path d="M26 24 Q46 12 70 14" stroke="#fff" stroke-width="3" fill="none" opacity=".6"/></svg>`,
  // mine cart full of gold
  `<svg viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="flCaB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#78716c"/><stop offset="1" stop-color="#292524"/></linearGradient>
   <radialGradient id="flCaG" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#fff7c2"/><stop offset=".5" stop-color="#facc15"/><stop offset="1" stop-color="#a16207"/></radialGradient></defs>
   ${[[24, 38, 12], [40, 30, 13], [58, 32, 12], [74, 38, 11], [50, 40, 12], [32, 44, 10], [66, 44, 10]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#flCaG)" stroke="#713f12" stroke-width="2"/>`).join('')}
   <path d="M8 44 H92 L82 80 H18Z" fill="url(#flCaB)" stroke="#0c0a09" stroke-width="3" stroke-linejoin="round"/>
   <path d="M14 54 H86 M18 66 H82" stroke="#a8a29e" stroke-width="2.5" opacity=".7"/>${[22, 50, 78].map((x) => `<circle cx="${x}" cy="50" r="2.2" fill="#d6d3d1"/>`).join('')}
   <circle cx="30" cy="84" r="9" fill="#1c1917" stroke="#a8a29e" stroke-width="3"/><circle cx="70" cy="84" r="9" fill="#1c1917" stroke="#a8a29e" stroke-width="3"/>
   <path d="M4 95 H96" stroke="#57534e" stroke-width="4"/><circle cx="36" cy="26" r="3" fill="#fff" opacity=".8"/></svg>`,
  // gold ingots
  `<svg viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="flGoT" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffbe0"/><stop offset="1" stop-color="#fbbf24"/></linearGradient>
   <linearGradient id="flGoS" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eab308"/><stop offset="1" stop-color="#854d0e"/></linearGradient></defs>
   ${[[6, 62], [50, 62], [28, 30]].map(([x, y]) => `<g transform="translate(${x} ${y})"><path d="M0 30 L8 6 H36 L44 30Z" fill="url(#flGoS)" stroke="#713f12" stroke-width="2.5" stroke-linejoin="round"/><path d="M8 6 H36 L32 14 H12Z" fill="url(#flGoT)" stroke="#713f12" stroke-width="2"/><path d="M14 22 H30" stroke="#fef3c7" stroke-width="2.5" opacity=".7"/></g>`).join('')}
   <path d="M18 18 l3 -8 l3 8 l8 3 l-8 3 l-3 8 l-3 -8 l-8 -3Z M82 46 l2 -5 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2Z" fill="#fff"/></svg>`,
  // golden joker badge
  `<svg viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="flWi" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fffbe0"/><stop offset=".4" stop-color="#facc15"/><stop offset=".75" stop-color="#ca8a04"/><stop offset="1" stop-color="#713f12"/></linearGradient></defs>
   <path d="M50 3 L60 22 L82 16 L76 38 L96 50 L76 62 L82 84 L60 78 L50 97 L40 78 L18 84 L24 62 L4 50 L24 38 L18 16 L40 22Z" fill="url(#flWi)" stroke="#713f12" stroke-width="3" stroke-linejoin="round"/>
   <circle cx="50" cy="50" r="27" fill="#3b2410" stroke="#fde68a" stroke-width="3"/>
   <text x="50" y="58" text-anchor="middle" font-family="KeCoin, Archivo, sans-serif" font-weight="900" font-size="22" fill="#fde68a" letter-spacing="1">WILD</text></svg>`,
  // BONUS: the mine entrance
  `<svg viewBox="0 0 100 100" aria-hidden="true"><defs><radialGradient id="flBoG" cx=".5" cy=".7" r=".6"><stop offset="0" stop-color="#fde68a"/><stop offset=".45" stop-color="#f59e0b" stop-opacity=".8"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
   <linearGradient id="flBoW" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c08442"/><stop offset="1" stop-color="#5b3412"/></linearGradient></defs>
   <path d="M4 96 L10 40 Q50 2 90 40 L96 96Z" fill="#44403c" stroke="#1c1917" stroke-width="3"/>
   <path d="M26 96 V44 H74 V96Z" fill="#0c0a09"/><path d="M26 96 V44 H74 V96Z" fill="url(#flBoG)"/>
   <path d="M40 96 L47 56 M60 96 L53 56 M38 86 H62 M42 74 H58 M45 64 H55" stroke="#a8a29e" stroke-width="2.5" opacity=".8"/>
   <path d="M20 96 V40 M80 96 V40" stroke="url(#flBoW)" stroke-width="10"/><path d="M14 38 H86" stroke="url(#flBoW)" stroke-width="10" stroke-linecap="round"/>
   <path d="M20 96 V40 M80 96 V40 M14 38 H86" stroke="#2a1606" stroke-width="1.5" fill="none" opacity=".6"/>
   <circle cx="36" cy="58" r="3.5" fill="#fde047"/><circle cx="64" cy="66" r="3" fill="#fde047"/><circle cx="50" cy="50" r="2.5" fill="#fff"/></svg>`,
  // dynamite
  `<svg viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="flDy" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7f1d1d"/><stop offset=".45" stop-color="#ef4444"/><stop offset="1" stop-color="#7f1d1d"/></linearGradient></defs>
   ${[22, 40, 58].map((x, k) => `<g transform="rotate(${(k - 1) * 8} 50 90)"><rect x="${x}" y="${k === 1 ? 26 : 34}" width="20" height="${k === 1 ? 64 : 56}" rx="5" fill="url(#flDy)" stroke="#450a0a" stroke-width="2.5"/><path d="M${x + 4} ${k === 1 ? 34 : 42} H${x + 16}" stroke="#fecaca" stroke-width="2" opacity=".6"/></g>`).join('')}
   <path d="M18 60 H82 M18 74 H82" stroke="#1c1917" stroke-width="5"/>
   <path d="M50 26 Q56 12 70 12" fill="none" stroke="#d6d3d1" stroke-width="3"/>
   <circle cx="72" cy="11" r="8" fill="#fde047" opacity=".9"/><path d="M72 1 L74 8 L82 6 L76 11 L82 17 L74 15 L72 22 L70 15 L62 17 L68 11 L62 6 L70 8Z" fill="#fff7c2"/></svg>`,
  // mystery ore
  `<svg viewBox="0 0 100 100" aria-hidden="true"><defs><radialGradient id="flMy" cx=".4" cy=".35" r=".75"><stop offset="0" stop-color="#78716c"/><stop offset="1" stop-color="#1c1917"/></radialGradient></defs>
   <path d="M14 40 L30 14 L62 8 L88 28 L92 62 L72 90 L34 92 L10 70Z" fill="url(#flMy)" stroke="#0c0a09" stroke-width="3" stroke-linejoin="round"/>
   <path d="M30 14 L40 34 L14 40 M62 8 L60 30 L88 28 M92 62 L70 60 L72 90 M34 92 L38 68 L10 70" fill="none" stroke="#fbbf24" stroke-width="2.5" opacity=".75"/>
   <text x="51" y="68" text-anchor="middle" font-family="KeCoin, Archivo, sans-serif" font-weight="900" font-size="46" fill="#fde047" stroke="#713f12" stroke-width="2">?</text></svg>`,
  // lamp (+1 / +2: the label is drawn by CSS)
  `<svg viewBox="0 0 100 100" aria-hidden="true"><defs><radialGradient id="flLpG" cx=".5" cy=".4" r=".5"><stop offset="0" stop-color="#fff7c2"/><stop offset=".5" stop-color="#facc15" stop-opacity=".7"/><stop offset="1" stop-color="#ca8a04" stop-opacity="0"/></radialGradient>
   <linearGradient id="flLpB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fde68a"/><stop offset="1" stop-color="#a16207"/></linearGradient></defs>
   <circle cx="50" cy="40" r="38" fill="url(#flLpG)"/>
   <path d="M50 46 C38 36 42 22 50 8 C58 22 62 36 50 46Z" fill="#fb923c"/><path d="M50 44 C45 36 47 28 50 20 C53 28 55 36 50 44Z" fill="#fff7c2"/>
   <path d="M30 50 H70 L64 60 H36Z" fill="url(#flLpB)" stroke="#713f12" stroke-width="2.5"/>
   <path d="M22 62 Q50 54 78 62 L72 84 Q50 92 28 84Z" fill="url(#flLpB)" stroke="#713f12" stroke-width="3"/>
   <path d="M78 66 Q94 70 86 82" fill="none" stroke="#a16207" stroke-width="4"/></svg>`,
  // contagious mystery ore
  `<svg viewBox="0 0 100 100" aria-hidden="true"><defs><radialGradient id="flMx" cx=".45" cy=".4" r=".7"><stop offset="0" stop-color="#d9f99d"/><stop offset=".45" stop-color="#22c55e"/><stop offset="1" stop-color="#052e16"/></radialGradient></defs>
   <circle cx="50" cy="50" r="47" fill="#22c55e" opacity=".25"/>
   <path d="M14 40 L30 14 L62 8 L88 28 L92 62 L72 90 L34 92 L10 70Z" fill="url(#flMx)" stroke="#052e16" stroke-width="3" stroke-linejoin="round"/>
   <path d="M30 14 L40 34 L14 40 M62 8 L60 30 L88 28 M92 62 L70 60 L72 90 M34 92 L38 68 L10 70" fill="none" stroke="#f0fdf4" stroke-width="2.5" opacity=".7"/>
   <text x="51" y="68" text-anchor="middle" font-family="KeCoin, Archivo, sans-serif" font-weight="900" font-size="46" fill="#fff" stroke="#14532d" stroke-width="2">?</text></svg>`,
];
const symArt = (v) => (PICS.has(KEY[v]) ? pic(KEY[v]) : SVG[v]);
// the labels on the special symbols are drawn by CSS (they change with the bonuses of the wheel: 5×5, +2)
const cellArt = (v) => symArt(v) + (v === SC ? '<i class="fl-tag">BONUS</i>' : v === BOMB ? '<b class="fl-lab fl-area"></b>' : v === PLUS ? '<b class="fl-lab fl-plus"></b>' : '');
const cellCls = (v) => (v === WILD ? 'wild' : v === SC ? 'scatter' : v === BOMB ? 'boom' : v === MYS ? 'mys' : v === MYSX ? 'mys conta' : v === PLUS ? 'lamp' : v >= 5 && v < 9 ? 'hi' : '');
// the cell multipliers: bronze, silver, gold, fire
const mtier = (m) => (m >= 1024 ? 'f4' : m >= 64 ? 'f3' : m >= 8 ? 'f2' : 'f1');
const mtxt = (m) => (m > 1 ? `×${m}` : '');
const fnum = (x) => x.toLocaleString('fr-FR', { maximumFractionDigits: x >= 10 ? 0 : 1 });
const GOLDC = ['#fff7c2', '#fde047', '#f59e0b', '#fff'];
const FIRE = ['#fef08a', '#fb923c', '#ef4444', '#fff'];
const MOD = {
  conta: { icon: '🦠', name: 'Minerai contagieux', short: 'Contagieux', wheel: 'CONTAGIEUX', desc: 'chaque minerai mystère multiplie toutes les cases de son symbole', color: '#22c55e' },
  big: { icon: '🧨', name: 'Grosse dynamite', short: 'Dynamite 5×5', wheel: 'DYNAMITE\n5×5', desc: 'la dynamite explose en 5×5 au lieu de 3×3', color: '#ef4444' },
  lamp: { icon: '🪔', name: 'Lampes doubles', short: 'Lampes +2', wheel: 'LAMPES\n+2', desc: 'chaque lampe donne +2 tours au lieu de +1', color: '#facc15' },
};
// the cells where new symbols fell in after a cascade (the top of each column)
const arrivals = (rem) => { const out = []; for (let c = 0; c < COLS; c++) { let miss = 0; for (const i of rem) if (Math.floor(i / ROWS) === c) miss++; for (let r = 0; r < miss; r++) out.push(c * ROWS + r); } return out; };
const DUST = Array.from({ length: 16 }, (_, i) => `<i style="--x:${(i * 41) % 100}%;--d:${6 + (i % 5)}s;--l:${-(i * 0.9).toFixed(1)}s;--s:${1 + (i % 3)}px"></i>`).join('');

class FilonGame extends BaseGame {
  constructor(root, game) {
    super(root, game, {
      music: EXTRA_THEMES.filon,
      frameCls: 'fl-frame',
      stage: `<div class="fl-stage">
        <div class="fl-bg"><i class="fl-beam l"></i><i class="fl-beam r"></i><i class="fl-beam t"></i><i class="fl-lamp a"></i><i class="fl-lamp b"></i><div class="fl-dust">${DUST}</div></div>
        <div class="fl-top">
          <button class="fl-ante" type="button" data-ante aria-pressed="false"><i class="fl-sw"></i><span><b>MISE BOOSTÉE</b><small>×2 la mise · bonus ×3 plus souvent</small></span></button>
          <div class="fl-mods"></div>
        </div>
        <div class="grid-host"></div>
      </div>`,
      buys: TIERS.slice(1).map((T) => ({ id: `b${T.k}`, icon: ['⛏️', '🪔', '💰'][T.k - 1], label: `${T.name} · ${T.spins} tours`, desc: T.mods === 3 ? 'Les 3 bonus de la roue en même temps' : `${T.mods} bonus de la roue : minerai contagieux, grosse dynamite ou lampes doubles`, cost: (b) => b * T.cost }))
        .concat([
          { id: 'lucky', icon: '🎲', label: 'TIRAGE CHANCE', desc: `Un des 3 bonus au hasard : ${LUCKY.map(([k, p]) => `${TIERS[k].name.toLowerCase()} ${p} %`).join(', ')}`, cost: (b) => b * LUCKY_COST },
          { id: 'gold', icon: '✨', label: 'TOUR DORÉ', desc: `Un tour où ${GOLD.n} cases démarrent avec un multiplicateur de ×${GOLD.v[0][0]} à ×${GOLD.v[GOLD.v.length - 1][0].toLocaleString('fr-FR')}`, cost: (b) => b * GOLD_COST },
        ]),
      opts: [{ id: 'ante', icon: '🔥', label: 'Mise boostée (×2, bonus ×3 plus souvent)' }],
      hello: `${MIN} symboles identiques n’importe où · chaque gain pose un multiplicateur sur sa case`,
    });
    this.ante = this.loadFlag('filon_ante');
    this.mods = [];
    this.mm = null; // cell multipliers kept during the bonus
    this.anteBtn = this.q('[data-ante]');
    this.anteBtn.addEventListener('click', () => { if (!this.busy) { sfx.unlock(); sfx.click(); this.onOpt('ante'); } });
    this.grid = new SymbolGrid(this.q('.grid-host'), { cols: COLS, rows: ROWS, game: this, art: cellArt, cls: cellCls });
    this.grid.setAll(Array.from({ length: N }, () => Math.floor(Math.random() * 9)));
    if (PICS.has('fond')) this.slotEl.style.setProperty('--fl-bg', `url('${picSrc('fond')}')`);
    if (PICS.has('fond-bonus')) this.slotEl.style.setProperty('--fl-bg2', `url('${picSrc('fond-bonus')}')`);
    this.paintAnte();
  }

  /* ---------- boosted stake ---------- */
  optOn(id) { return id === 'ante' ? this.ante : false; }
  onOpt(id) {
    if (id !== 'ante' || this.busy) return;
    this.ante = !this.ante;
    this.saveKey('filon_ante', this.ante ? 1 : 0);
    this.paintAnte();
    this.msg(this.ante ? `🔥 Mise boostée : ${fmtC(this.bet * ANTE_COST)} par tour, les lampes BONUS tombent bien plus souvent` : 'Mise normale');
  }
  // the free rounds of the site (1 KE) are never boosted
  anteOn() { return this.ante && !(this.bet === GIFT_BET && gifts.rounds(this.game.id)); }
  stakeLabel() { return this.anteOn() ? this.bet * ANTE_COST : this.bet; }
  onMeters() { this.paintAnte?.(); }
  paintAnte() {
    if (!this.anteBtn) return;
    this.anteBtn.classList.toggle('on', !!this.ante);
    this.anteBtn.setAttribute('aria-pressed', this.ante ? 'true' : 'false');
    this.anteBtn.disabled = this.busy;
  }
  // max win = ×30 000 the bet (not the boosted stake)
  capC() { return this.game.maxX ? this.game.maxX * this.bet : 0; }
  // with the boosted stake core/base.js compares the win with 2 × the bet and would miss the max win: tell the site here
  maxCheck(stake) {
    const w = this.roundWin || 0, X = this.game.maxX;
    if (!X || stake === this.bet || w < X * this.bet - 1 || this.dead) return;
    dispatchEvent(new CustomEvent('sb:maxwin', { detail: { game: this.game.id, stake: stake / 100, win: w / 100, x: w / stake, bought: false, maxX: X } }));
  }

  /* ---------- the cell multipliers ---------- */
  paintBadges(mm, only = null, pop = false) {
    for (const i of only || this.grid.cells.keys()) {
      this.grid.badge(i, mtxt(mm[i]), mtier(mm[i]));
      if (pop && mm[i] > 1) this.grid.bump(this.grid.cells[i].lastChild);
    }
  }

  /* ---------- rounds ---------- */
  onMain() {
    this.round(async () => {
      const bet = this.bet, ante = this.anteOn(), stake = ante ? bet * ANTE_COST : bet;
      if (!this.pay(stake)) return;
      this.roundStake = stake; this.lastStake = stake;
      const r = await this.playSpin({ ante });
      if (r.total > 0) await this.celebrate(Math.round(r.total * bet), { stake });
      const tier = tierOf(r.scat);
      if (tier && !this.dead && !this.maxHit) { this.stopAuto(); await this.bonusRound(tier); }
      this.maxCheck(stake);
    });
  }

  async onBuy(id) {
    if (id === 'gold') return this.goldSpin();
    let tier = +String(id).slice(1) || 1;
    if (id === 'lucky') {
      tier = wpick(LUCKY);
      const secs = [];
      for (const [k, p] of LUCKY) for (let n = 0; n < p / 10; n++) secs.push({ k, icon: ['⛏️', '🪔', '💰'][k - 1], label: ['VEINE', 'GALERIE', 'RUÉE'][k - 1], name: TIERS[k].name, color: ['#b45309', '#7c3aed', '#ca8a04'][k - 1] });
      const order = [0, 6, 1, 3, 7, 2, 4, 9, 5, 8].map((i) => secs[i]); // the tiers spread around the wheel
      const pickIdx = order.map((s, i) => (s.k === tier ? i : -1)).filter((i) => i >= 0);
      await this.wheel('TIRAGE CHANCE', 'La roue choisit ton bonus…', order, [pickIdx[Math.floor(Math.random() * pickIdx.length)]]);
    }
    await this.bonusRound(tier);
  }

  // Golden spin: 10 cells start with a big multiplier, then a normal spin (a BONUS at the end still opens the bonus).
  async goldSpin() {
    const bet = this.bet, pre = goldPre();
    this.word('TOUR DORÉ', 'gold');
    sfx.upgrade();
    const mm = new Array(N).fill(0);
    for (const [i, m] of pre) mm[i] = m;
    this.paintBadges(new Array(N).fill(0));
    for (const [i] of pre) {
      if (this.dead) return;
      this.paintBadges(mm, [i], true);
      const p = center(this.grid.cells[i]); fx.burst(p.x, p.y, 12, GOLDC, 5);
      sfx.coin();
      await this.wait(120);
    }
    await this.wait(400);
    const r = await this.playSpin({ pre, keepBadges: true });
    if (r.total > 0) await this.celebrate(Math.round(r.total * bet), { stake: bet });
    const tier = tierOf(r.scat);
    if (tier && !this.dead && !this.maxHit) await this.bonusRound(tier);
  }

  // Animates one engine spin and credits it. o = { free, ante, pre, keepBadges }
  async playSpin(o = {}) {
    const bet = this.bet, free = !!o.free;
    const r = spin({ free, ante: !!o.ante, pre: o.pre, mods: free ? this.mods : [], mm: free ? this.mm : undefined });
    this.setLast(0); this.winAmt.textContent = '';
    if (!free) this.msg(o.pre ? 'Les pépites sont posées…' : o.ante ? '🔥 Mise boostée…' : 'Coup de pioche…');
    let run = 0;
    for (const st of r.steps) {
      if (this.dead) return r;
      if (st.k === 'init') {
        if (!o.keepBadges) this.paintBadges(st.mm);
        let sc = 0;
        await this.grid.dropIn(st.grid, {
          tease: (c) => { const t = !free && sc >= 2; for (let k = 0; k < ROWS; k++) if (st.grid[c * ROWS + k] === SC) sc++; return t; },
          onLand: (i, v) => this.landed(i, v),
        });
      } else if (st.k === 'mys') {
        await this.openOres(st, free);
      } else if (st.k === 'win') {
        st.wins.forEach((w) => this.grid.floatOver(w.cells, `+${fmtC(Math.round(w.p * bet))}`));
        this.grid.mark(st.rem);
        this.msg(st.wins.map((w) => `${w.n} ${NAMES[w.s]}${w.m > 1.05 ? ` · ×${fnum(w.m)}` : ''} : +${fmtC(Math.round(w.p * bet))}`).join(' · '));
        sfx.win();
        await this.wait(680);
        this.grid.unmark();
        await this.grid.explode(st.rem, GOLDC);
        this.paintBadges(st.mm, st.rem, true); // every cleared cell gets its multiplier (or doubles it)
        await this.grid.cascade(st.after, new Set(st.rem));
        for (const i of arrivals(st.rem)) this.landed(i, st.after[i]);
        run = st.run;
        this.setLast(Math.round(run * bet));
        if (this.onRun) this.onRun(run);
        await this.wait(160);
      } else if (st.k === 'bomb') {
        await this.blast(st);
        run = st.run;
      }
    }
    const won = Math.round(r.total * bet);
    if (won > 0) { this.win(won, free ? 'Bonus' : null); this.setLast(won); }
    if (!free) {
      const near = r.scat === 2 ? 'Presque… 2 BONUS' : '';
      this.msg(won > 0 ? `Total du tour : ${fmtC(won)}` : near || 'Pas de gain');
    }
    return r;
  }

  // a special symbol lands
  landed(i, v) {
    const cell = this.grid.cells[i];
    if (v === SC) { sfx.land(); this.grid.bump(cell); const p = center(cell); fx.burst(p.x, p.y, 18, GOLDC); }
    else if (v === WILD) { sfx.coin(); const p = center(cell); fx.burst(p.x, p.y, 10, GOLDC, 4); }
    else if (v === BOMB) sfx.land();
  }

  // lamps are collected, mystery ores turn into a symbol and multiply their cell (contagious: every cell of the symbol)
  async openOres(st, free) {
    for (const i of st.lamps) {
      const cell = this.grid.cells[i], n = this.mods.includes('lamp') ? 2 : 1;
      this.grid.bump(cell);
      this.floatAt(cell, `+${n} TOUR${n > 1 ? 'S' : ''}`, '#fde047', 24);
      const p = center(cell); fx.burst(p.x, p.y, 16, GOLDC, 5);
      sfx.upgrade();
      if (this.onLamp) this.onLamp(n);
      await this.wait(260);
    }
    for (const o of st.opened) {
      if (this.dead) return;
      const cell = this.grid.cells[o.i];
      cell.classList.add('fl-open');
      sfx.feature();
      await this.wait(320);
      this.grid.set(o.i, o.s);
      cell.classList.remove('fl-open');
      this.grid.bump(cell);
      const p = center(cell);
      fx.burst(p.x, p.y, o.x ? 26 : 16, o.x ? ['#bbf7d0', '#22c55e', '#fff'] : GOLDC, 6);
      this.floatAt(cell, `×${o.b}`, o.x ? '#86efac' : '#fde047', 30);
      this.paintBadges(st.mm, [o.i], true);
      if (o.spread.length) {
        this.msg(`Minerai contagieux : ${NAMES[o.s]} ×${o.b} partout !`);
        await this.wait(200);
        for (const k of o.spread) fx.trail(p, center(this.grid.cells[k]), '#4ade80', 8);
        await this.wait(380);
        this.paintBadges(st.mm, o.spread, true);
        sfx.upgrade();
      } else this.msg(`Minerai mystère : ${NAMES[o.s]} ×${o.b}`);
      await this.wait(free ? 260 : 220);
    }
  }

  // the dynamite blows: the area flashes, its multipliers double, the paying symbols go
  async blast(st) {
    const big = this.mods.includes('big');
    this.msg(`💥 Dynamite ${big ? '5×5' : '3×3'} : les multiplicateurs de la zone doublent !`);
    for (const b of st.bombs) { const p = center(this.grid.cells[b]); fx.burst(p.x, p.y, 40, FIRE, 9); }
    this.grid.mark(st.hit, 'blast');
    this.flash('rgba(255,140,40,.45)');
    this.shake();
    sfx.bigWin?.();
    await this.wait(420);
    this.paintBadges(st.mm, st.hit, true);
    await this.grid.explode(st.rem, FIRE);
    this.grid.unmark('blast');
    await this.grid.cascade(st.after, new Set(st.rem));
    for (const i of arrivals(st.rem)) this.landed(i, st.after[i]);
    await this.wait(160);
  }

  // big gold word over the grid
  word(t, cls = '') {
    const w = el('div', `fl-word ${cls}`, t);
    this.q('.fl-stage').appendChild(w);
    setTimeout(() => w.remove(), 1400);
  }

  // The bonus wheel: spins (once per pick) and stops on each sector of picks in turn.
  async wheel(title, sub, secs, picks) {
    const n = secs.length, A = 360 / n;
    const pt = (a, r) => { const t = ((a - 90) * Math.PI) / 180; return [100 + r * Math.cos(t), 100 + r * Math.sin(t)]; };
    const fs = n > 6 ? 8 : 9;
    const sectors = secs.map((s, i) => {
      const [x1, y1] = pt(i * A, 92), [x2, y2] = pt((i + 1) * A, 92), [ix, iy] = pt((i + 0.5) * A, 40);
      // the label runs along the rim, upright at the top of the sector (1 or 2 lines)
      const lines = String(s.label).split('\n');
      const text = lines.map((t, k) => { const [tx, ty] = pt((i + 0.5) * A, 76 - k * (fs + 2)); return `<text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" transform="rotate(${((i + 0.5) * A).toFixed(1)} ${tx.toFixed(1)} ${ty.toFixed(1)})" text-anchor="middle" dominant-baseline="middle" font-family="KeCoin, Archivo, sans-serif" font-weight="900" font-size="${fs}" fill="#fff" stroke="#000" stroke-width=".5" paint-order="stroke">${t}</text>`; }).join('');
      return `<path d="M100 100 L${x1.toFixed(1)} ${y1.toFixed(1)} A92 92 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}Z" fill="${s.color}" stroke="#1c1006" stroke-width="2.5"/>
        ${text}<text x="${ix.toFixed(1)}" y="${iy.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" font-size="${n > 6 ? 13 : 17}" transform="rotate(${((i + 0.5) * A).toFixed(1)} ${ix.toFixed(1)} ${iy.toFixed(1)})">${s.icon}</text>`;
    }).join('');
    const ov = this.overlay(`<h3>${title}</h3><p class="fl-wsub">${sub}</p>
      <div class="fl-wheel"><svg viewBox="0 0 200 200" aria-hidden="true"><circle cx="100" cy="100" r="98" fill="#3b2410" stroke="#fde68a" stroke-width="4"/>
        <g class="fl-wrot">${sectors}</g><circle cx="100" cy="100" r="16" fill="url(#flWhC)" stroke="#713f12" stroke-width="3"/>
        <defs><radialGradient id="flWhC" cx=".4" cy=".35"><stop offset="0" stop-color="#fffbe0"/><stop offset="1" stop-color="#ca8a04"/></radialGradient></defs></svg><i class="fl-pin"></i></div>
      <div class="fl-picked"></div><small>Touchez pour aller plus vite</small>`, 'fl-wov');
    const rot = ov.querySelector('.fl-wrot'), out = ov.querySelector('.fl-picked');
    let fast = this.superT, angle = 0;
    ov.addEventListener('click', () => { fast = true; });
    for (const idx of picks) {
      if (this.dead) break;
      // the sector's middle under the pin at the top
      const target = 360 * (fast ? 2 : 4) + (360 - (idx + 0.5) * A) + (Math.random() - 0.5) * A * 0.5;
      angle = Math.ceil(angle / 360) * 360 + target;
      const dur = fast ? 700 : this.turbo ? 1500 : 2600;
      rot.style.transition = `transform ${dur}ms cubic-bezier(.12,.8,.2,1)`;
      rot.style.transform = `rotate(${angle}deg)`;
      sfx.tease();
      await new Promise((res) => setTimeout(res, dur + 80));
      const s = secs[idx];
      sfx.upgrade();
      const p = center(ov.querySelector('.fl-pin')); fx.burst(p.x, p.y + 30, 30, GOLDC, 7);
      out.insertAdjacentHTML('beforeend', `<span class="fl-chip" style="--c:${s.color}">${s.icon} ${s.name || s.label}</span>`);
      await new Promise((res) => setTimeout(res, fast ? 250 : 650));
    }
    await new Promise((res) => setTimeout(res, fast ? 300 : 900));
    ov.classList.add('out');
    await new Promise((res) => setTimeout(res, 300));
    ov.remove();
  }

  // The bonus wheel gives the bonuses of the tier (1, 2 or all 3), then the free spins with their multipliers kept.
  async bonusRound(tier) {
    const T = TIERS[tier], bet = this.bet, stake = this.lastStake || bet;
    const intro = PICS.has('bonus') ? pic('bonus') : SVG[SC];
    await this.featureIntro(T.name, `${T.spins} tours gratuits · ${T.mods === 3 ? 'les 3 bonus de la roue' : `${T.mods} bonus de la roue`} · les multiplicateurs ne repartent jamais à zéro`, intro);
    if (this.dead) return;
    const mods = pickMods(T.mods);
    if (T.mods < 3) {
      const secs = ['conta', 'big', 'lamp', 'conta', 'big', 'lamp'].map((m) => ({ m, icon: MOD[m].icon, label: MOD[m].wheel, name: MOD[m].name, color: { conta: '#15803d', big: '#b91c1c', lamp: '#a16207' }[m] }));
      const picks = mods.map((m) => { const l = secs.map((s, i) => (s.m === m ? i : -1)).filter((i) => i >= 0); return l[Math.floor(Math.random() * l.length)]; });
      await this.wheel('LA ROUE DES BONUS', T.mods === 1 ? 'Un bonus pour tout le tour' : 'Deux bonus pour tout le tour', secs, picks);
    } else {
      this.word('LES 3 BONUS !', 'gold');
      sfx.jackpot?.();
      await this.wait(1100);
    }
    if (this.dead) return;
    this.mods = mods;
    this.mm = new Array(N).fill(0);
    this.slotEl.classList.add('in-free');
    for (const m of ['conta', 'big', 'lamp']) this.slotEl.classList.toggle(`mod-${m}`, mods.includes(m));
    this.q('.fl-mods').innerHTML = mods.map((m) => `<span class="fl-chip" style="--c:${MOD[m].color}" title="${MOD[m].name} : ${MOD[m].desc}">${MOD[m].icon} ${MOD[m].short}</span>`).join('');
    this.paintBadges(this.mm);
    let left = T.spins, done = 0, total = 0;
    const banner = () => this.setBanner(`<b>${T.name}</b><span class="pill">Tour ${done} / ${done + left}</span><span class="pill gold">Gain ${fmtC(total)}</span>`);
    this.onLamp = (n) => { left += n; banner(); };
    this.onRun = (run) => this.setBanner(`<b>${T.name}</b><span class="pill">Tour ${done} / ${done + left}</span><span class="pill gold">Gain ${fmtC(total + Math.round(run * bet))}</span>`);
    while (left > 0 && !this.dead && !this.maxHit) { // stops at the max win (core/base.js)
      left--; done++;
      banner();
      const r = await this.playSpin({ free: true });
      total = Math.min(bet * CAPX, total + Math.round(r.total * bet));
      banner();
      if (total >= bet * CAPX) { this.msg(`MAX WIN ×${CAPX.toLocaleString('fr-FR')} !`); break; }
      await this.wait(380);
    }
    this.onLamp = null; this.onRun = null;
    this.mods = []; this.mm = null;
    this.slotEl.classList.remove('in-free', 'mod-conta', 'mod-big', 'mod-lamp');
    this.q('.fl-mods').innerHTML = '';
    this.setBanner('');
    this.setLast(total);
    await this.celebrate(total, { summary: T.name, stake });
    this.msg(`${T.name} terminée : ${fmtC(total)} gagnés`);
  }

  info() {
    const f = (x) => x.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
    const art = (v) => `<div class="pay-sym svg fl-pay">${symArt(v)}</div>`;
    const rows = NAMES.map((n, s) => `<div class="pay-item">${art(s)}<div class="pay-vals"><b>${n}</b><br><span>${[10, 12, 14, 17, 21].map((n, k) => `${n}+ <b>×${f(PAYS[s][k] * TUNE.pay)}</b>`).join(' · ')}</span></div></div>`).reverse().join('');
    const sp = (v, t, d) => `<div class="pay-item">${art(v)}<div class="pay-vals"><b>${t}</b><br><span>${d}</span></div></div>`;
    return this.rules(`<h4>Table des gains (× la mise)</h4><div class="paytable">${rows}</div>
      <h4>Pay Anywhere et cascades</h4><p>Grille 7×7, pas de lignes : <b>${MIN} symboles identiques ou plus n’importe où</b> paient. Ils disparaissent et de nouveaux tombent, tant qu’il y a des gains.</p>
      <h4>Les multiplicateurs des cases</h4><p>Chaque fois qu’un symbole gagnant disparaît d’une case, la case prend un <b>×2</b>, puis le double à chaque nouveau gain : ×4, ×8, ×16… Chaque case gagnante rapporte sa part du gain multipliée par le multiplicateur de sa case (le gain est multiplié par la moyenne des multiplicateurs de ses cases). Dans un tour normal, les multiplicateurs repartent de zéro au tour suivant et montent jusqu’à ×${TUNE.mcapBase}.</p>
      <h4>Les symboles spéciaux</h4><div class="paytable">
        ${sp(WILD, 'Joker doré', 'Remplace tous les symboles qui paient.')}
        ${sp(MYS, 'Minerai mystère', 'Se change en un symbole au hasard et multiplie le multiplicateur de sa case par ×2, ×4 ou ×8.')}
        ${sp(MYSX, 'Minerai contagieux', 'Pareil, mais sur <b>toutes</b> les cases de ce symbole.')}
        ${sp(BOMB, 'Dynamite', 'Quand il n’y a plus de gain, elle explose : 3×3 cases (5×5 avec la grosse dynamite), les symboles qui paient disparaissent et les multiplicateurs de la zone doublent. Le joker, BONUS et les lampes résistent.')}
        ${sp(PLUS, 'Lampe (bonus seulement)', '+1 tour gratuit (+2 avec les lampes doubles).')}
        ${sp(SC, 'BONUS', '3, 4 ou 5 n’importe où à la fin d’un tour payé lancent le bonus.')}</div>
      <h4>Les 3 bonus</h4><p><b>3 BONUS → ${TIERS[1].name}</b> : ${TIERS[1].spins} tours gratuits, la roue donne 1 bonus.<br><b>4 BONUS → ${TIERS[2].name}</b> : ${TIERS[2].spins} tours gratuits, la roue donne 2 bonus.<br><b>5 BONUS → ${TIERS[3].name}</b> : ${TIERS[3].spins} tours gratuits avec les 3 bonus.</p>
      <p>La roue des bonus : <b>${MOD.conta.name}</b> (${MOD.conta.desc}), <b>${MOD.big.name}</b> (${MOD.big.desc}), <b>${MOD.lamp.name}</b> (${MOD.lamp.desc}).</p>
      <p>Pendant les tours gratuits, <b>les multiplicateurs ne repartent jamais à zéro</b> : un gain les double jusqu’à ×${TUNE.mcapWin}, les minerais et la dynamite jusqu’à ×${MCAP.toLocaleString('fr-FR')}. En échange, la table des gains y vaut 1/${Math.round(TUNE.pay / TUNE.payFree)} de sa valeur.</p>
      <h4>Mise boostée</h4><p>×${ANTE_COST} la mise : les symboles BONUS tombent ${f(TUNE.ante)} fois plus souvent (un bonus environ 3 fois plus souvent). Les gains sont calculés sur la mise de base.</p>
      <h4>Achats</h4><p>${TIERS.slice(1).map((T) => `${T.name} ×${T.cost}`).join(' · ')} · Tirage chance ×${LUCKY_COST} (un des 3 bonus : ${LUCKY.map(([k, p]) => `${p} %`).join(' / ')}) · Tour doré ×${GOLD_COST} (${GOLD.n} cases démarrent avec ×${GOLD.v[0][0]} à ×${GOLD.v[GOLD.v.length - 1][0].toLocaleString('fr-FR')}). Gain maximum ×${CAPX.toLocaleString('fr-FR')} la mise de base, bonus compris.</p>`);
  }
}

return { FilonGame };
})();
