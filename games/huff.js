// SpinBet Casino · HuffGame — loaded on demand by games/impl/index.js (index.html).
// ---- games/impl/huff-engine.js ----
__mods['games/impl/huff-engine.js'] = (() => {
// Huff la Puff XXTrem math (pure, testable in Node: node scripts/sim-huff.mjs).
// Base game: 5×3, 25 lines (original pay table). 3 scatters = Huff 'n' Puff bonus, 4 = XXTREM bonus (house roulette first),
// 5 = MEGA bonus: a wheel gives the GRAND or MAJOR jackpot, a bonus where every landing is a gold house, or a 5-spin bonus.
// Bonus: scatters landing on the board colour cells red → blue → gold; on gold they jump to upgrade another red/blue cell
// straight to gold. Values stay hidden until the wolf blows them open at the end.

const ROWS = 3, COLS = 5, NC = 15, SC = 10;
const LINES = [[1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2], [0, 1, 2, 1, 0], [2, 1, 0, 1, 2], [0, 0, 1, 0, 0], [2, 2, 1, 2, 2], [1, 0, 0, 0, 1], [1, 2, 2, 2, 1], [0, 1, 1, 1, 0], [2, 1, 1, 1, 2], [1, 0, 1, 0, 1], [1, 2, 1, 2, 1], [0, 1, 0, 1, 0], [2, 1, 2, 1, 2], [1, 1, 0, 1, 1], [1, 1, 2, 1, 1], [0, 0, 1, 2, 2], [2, 2, 1, 0, 0], [0, 2, 0, 2, 0], [2, 0, 2, 0, 2], [1, 0, 2, 0, 1], [1, 2, 0, 2, 1], [0, 2, 2, 2, 0], [2, 0, 0, 0, 2]];
// symbols: 0 wolf (wild) 1 brick house 2 wood house 3 straw house 4 pig 5 A 6 K 7 Q 8 J 9 10 | 10 = scatter
const PAY = [[0, 0, 0], [95, 380, 1900], [76, 285, 1140], [57, 190, 760], [48, 142, 570], [28, 76, 285], [28, 76, 285], [19, 48, 190], [19, 48, 190], [19, 48, 190]];
const WTS = [[0, 3, 4, 5, 6, 9, 9, 10, 10, 10], [2, 3, 4, 5, 6, 9, 9, 10, 10, 10], [2, 3, 4, 5, 6, 9, 9, 10, 10, 10], [2, 3, 4, 5, 6, 9, 9, 10, 10, 10], [0, 3, 4, 5, 6, 9, 9, 10, 10, 10]];

// Cell levels: 1 red ×2–×10, 2 blue ×15–×50, 3 gold ×70–×200 or a MINI / MINOR / MAJOR / JACKPOT coin (max win).
const LV = [null, { key: 'red', name: 'Rouge' }, { key: 'blue', name: 'Bleue' }, { key: 'gold', name: 'Dorée' }];
const VALS = [null,
  [[2, 30], [3, 24], [4, 18], [5, 12], [6, 8], [8, 5], [10, 3]],
  [[15, 30], [20, 24], [25, 18], [30, 12], [40, 9], [50, 7]],
  [[70, 30], [80, 22], [100, 18], [120, 12], [150, 9], [200, 6]],
];
const JPV = { mini: 150, minor: 300, major: 1000, grand: 5000 };
const JPN = { mini: 'MINI', minor: 'MINOR', major: 'MAJOR', grand: 'JACKPOT' };
const CAPX = 10000;
const BONUS_SPINS = 3, MEGA_SPINS = 5;
// MEGA wheel outcomes and their weights.
const MEGA = [['grand', 3], ['major', 12], ['gold', 30], ['five', 55]];
// pay: scale on the original line pays. sc: chance of a scatter on each reel (base game). pN/pX: chance per cell per bonus spin. house: roulette weights red/blue/gold.
// jp: chance that a gold cell hides a jackpot instead of a multiplier.
const TUNE = { pay: 0.63, sc: 0.085, pN: 0.03, pX: 0.034, house: [62, 30, 8], jp: { mini: 0.08, minor: 0.035, major: 0.008, grand: 0.0004 } };
const BUYN = 76, BUYX = 300, BUYM = 870;

function pickW(arr) { let t = 0, i; for (i = 0; i < arr.length; i++) t += arr[i]; let r = Math.random() * t; for (i = 0; i < arr.length; i++) { if (r < arr[i]) return i; r -= arr[i]; } return arr.length - 1; }
const rnd = (n) => Math.floor(Math.random() * n);

function drawCell(c) { return pickW(WTS[c]); }
function genGrid(forceSc = 0) {
  const g = [];
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) g.push(drawCell(c));
  let reels;
  if (forceSc) { const pool = [0, 1, 2, 3, 4]; reels = []; for (let k = 0; k < forceSc; k++) reels.push(pool.splice(rnd(pool.length), 1)[0]); }
  else reels = [0, 1, 2, 3, 4].filter(() => Math.random() < TUNE.sc);
  reels.forEach((c) => { g[c * ROWS + rnd(ROWS)] = SC; });
  return g;
}
function scattersIn(g) { const a = []; for (let i = 0; i < g.length; i++) if (g[i] === SC) a.push(i); return a; }
function evalLines(g) {
  const wins = []; let total = 0;
  for (let l = 0; l < LINES.length; l++) {
    const ln = LINES[l]; let first = -1, n = 0, i;
    for (i = 0; i < COLS; i++) { const s = g[i * ROWS + ln[i]]; if (s === SC) break; if (s !== 0) { first = s; break; } }
    const sym = first < 0 ? 1 : first;
    for (i = 0; i < COLS; i++) { const s2 = g[i * ROWS + ln[i]]; if (s2 === SC) break; if (s2 === 0 || s2 === sym) n++; else break; }
    if (n >= 3) { const coef = PAY[sym][n - 3] * TUNE.pay; wins.push({ line: l, sym, n, coef }); total += coef; }
  }
  return { wins, coef: total };
}

function spinHouse() { return 1 + pickW(TUNE.house); }
function spinMega() { return MEGA[pickW(MEGA.map((m) => m[1]))][0]; }

// kind 'n' (3 scatters): scatter cells start red. kind 'x' (4): roulette colour on 6 cells (scatter cells first).
// MEGA bonuses: 'g' scatter cells start gold and every landing is a gold house; 'f' scatter cells start red, 5 spins.
function newBonus(scIdx, kind, house) {
  const lv = new Array(NC).fill(0), spins = kind === 'f' ? MEGA_SPINS : BONUS_SPINS;
  if (kind === 'g') { scIdx.forEach((i) => { lv[i] = 3; }); return { lv, left: spins, spins, kind, house: 3, step: 0, gold: true }; }
  if (kind === 'x') {
    const pool = [...Array(NC).keys()].filter((i) => !scIdx.includes(i));
    const idx = scIdx.slice(0, 6);
    while (idx.length < 6) idx.push(pool.splice(rnd(pool.length), 1)[0]);
    idx.forEach((i) => { lv[i] = house; });
  } else scIdx.forEach((i) => { lv[i] = 1; });
  return { lv, left: spins, spins, kind, house: house || 0, step: 0 };
}

const allGold = (st) => st.lv.every((l) => l === 3);
const bonusDone = (st) => st.left <= 0 || allGold(st) || st.step >= 120;

// One bonus spin. hits: [{i, from, to, target?}] — target is the cell a gold-landing scatter turned gold.
function stepBonus(st) {
  const p = st.kind === 'x' ? TUNE.pX : TUNE.pN, hits = [];
  st.step++;
  const land = []; for (let i = 0; i < NC; i++) if (Math.random() < p) land.push(i);
  for (const i of land) {
    const from = st.lv[i];
    if (from < 3) { const to = st.gold ? 3 : from + 1; st.lv[i] = to; hits.push({ i, from, to }); continue; }
    const tg = []; for (let k = 0; k < NC; k++) if (st.lv[k] === 1 || st.lv[k] === 2) tg.push(k);
    if (tg.length) { const k = tg[rnd(tg.length)]; hits.push({ i, from: 3, to: 3, target: k, tfrom: st.lv[k] }); st.lv[k] = 3; }
    else {
      const em = []; for (let k = 0; k < NC; k++) if (!st.lv[k]) em.push(k);
      if (em.length) { const k = em[rnd(em.length)]; hits.push({ i, from: 3, to: 3, target: k, tfrom: 0 }); st.lv[k] = st.gold ? 3 : 1; }
      else hits.push({ i, from: 3, to: 3 });
    }
  }
  st.left = land.length ? (st.spins || BONUS_SPINS) : st.left - 1;
  return { hits };
}

function cellValue(level) {
  if (level === 3) {
    let r = Math.random(), acc = 0;
    for (const k of ['grand', 'major', 'minor', 'mini']) { acc += TUNE.jp[k]; if (r < acc) return { v: JPV[k], j: k }; }
  }
  const t = VALS[level];
  return { v: t[pickW(t.map((x) => x[1]))][0], j: null };
}
// Values for every coloured cell, drawn when the bonus ends. Total is capped at the max win.
function reveal(st) {
  const vals = st.lv.map((l) => (l ? cellValue(l) : null));
  let total = 0; vals.forEach((x) => { if (x) total += x.v; });
  return { vals, total: Math.min(total, CAPX), capped: total >= CAPX };
}
function playBonus(st) { while (!bonusDone(st)) stepBonus(st); return reveal(st).total; }

return { ROWS, LINES, PAY, LV, JPV, JPN, CAPX, BONUS_SPINS, MEGA_SPINS, MEGA, TUNE, BUYN, BUYX, BUYM, drawCell, genGrid, scattersIn, evalLines, spinHouse, spinMega, newBonus, allGold, bonusDone, stepBonus, cellValue, reveal, playBonus, COLS, NC, SC };
})();

// ---- games/impl/huff.js ----
__mods['games/impl/huff.js'] = (() => {
// Huff la Puff XXTrem, rebuilt on the shared cabinet. Math in huff-engine.js.
// 3 scatters: Huff 'n' Puff bonus (scatter cells turn red). 4: XXTREM bonus, the house roulette gives 6 red, blue or gold cells.
// 5: MEGA bonus, the wolf's wheel gives the GRAND or MAJOR jackpot, the gold-houses bonus or a 5-spin bonus.
// Scatters in the bonus colour cells red → blue → gold; values stay hidden until the wolf blows the houses away.

const { BaseGame, fmtC, shortC } = __mods['core/base.js'];
const { Reels } = __mods['core/reels.js'];
const { DEFS } = __mods['art/huff.js'];
const { sfx } = __mods['audio.js'];
const { fx, sleep, center } = __mods['fx.js'];
const { el, animateNumber } = __mods['ui.js'];
const { profiles } = __mods['profile.js'];
const { ROWS, COLS, NC, SC, LINES, PAY, LV, JPV, JPN, CAPX, BONUS_SPINS, MEGA_SPINS, TUNE, BUYN, BUYX, BUYM,
  drawCell, genGrid, scattersIn, evalLines, spinHouse, spinMega, newBonus, stepBonus, bonusDone, reveal, } = __mods['games/impl/huff-engine.js'];

const SAVE = 'huff_bonus';
const saveKey = () => `${SAVE}:${profiles.store.current || ''}`; // one unfinished bonus per player
const SYMID = ['wf', 'hb', 'hw', 'hs', 'pg', 'ca', 'ck', 'cq', 'cj', 'ct', 'hsc'];
const NAMES = ['Loup (Wild)', 'Maison en briques', 'Maison en bois', 'Maison en paille', 'Cochon casqué', 'As', 'Roi', 'Dame', 'Valet', 'Dix'];
// House drawn on each coloured cell: red = straw, blue = wood, gold = bricks.
const LVHOUSE = [null, 'hs', 'hw', 'hb'];
const LVCOL = [null, ['#fca5a5', '#ef4444', '#fff'], ['#bfdbfe', '#3b82f6', '#fff'], ['#fde68a', '#fbbf24', '#fff']];
const WHEEL = [1, 2, 1, 1, 2, 1, 3, 1, 1, 2, 1, 1]; // 8 red, 3 blue, 1 gold (the result itself follows TUNE.house)
const HOUSE_NAME = [null, 'MAISON ROUGE', 'MAISON BLEUE', 'MAISON OR'];
// MEGA wheel as drawn (the result itself follows MEGA in the engine).
const MWHEEL = ['five', 'gold', 'five', 'major', 'five', 'gold', 'five', 'grand', 'five', 'gold', 'five', 'major'];
const MLAB = { five: ['5 TOURS', 'Bonus 5 tours'], gold: ['MAISONS OR', 'Bonus maisons en or'], major: ['MAJOR', 'MAJOR JACKPOT'], grand: ['JACKPOT', 'GRAND JACKPOT'] };
const BONUS_NAME = { n: 'HUFF ’N’ PUFF', x: 'XXTREM PUFF', g: 'MAISONS EN OR', f: 'MEGA PUFF' };
const art = (id) => `<svg viewBox="0 0 64 64" aria-hidden="true"><use href="#${id}" width="64" height="64"/></svg>`;
const MUSIC = { sd: 0.21, len: 16, root: 196, lead: { wave: 'square', vol: 0.03, dur: 0.18, pat: [12, null, 16, null, 19, null, 16, null, 14, null, 17, null, 21, null, 19, null] }, bass: { wave: 'triangle', vol: 0.11, dur: 0.26, pat: [-12, null, -5, null, -12, null, -5, null, -7, null, 0, null, -7, null, 0, null] }, comp: { wave: 'square', vol: 0.016, dur: 0.12, map: { 2: [0, 4, 7], 6: [0, 4, 7], 10: [5, 9, 12], 14: [5, 9, 12] } }, kick: [0, 8], hat: [4, 12], kv: 0.16, hv: 0.02 };
const LINE_COLORS = ['#ff4a4a', '#4aa8ff', '#ffd23f', '#6aff7a', '#d27aff', '#ff9a3a', '#3affd2', '#ff6ac8'];
const xs = (n) => String(n).replace('.', ',');

class HuffGame extends BaseGame {
  constructor(root, game) {
    super(root, game, {
      defs: DEFS,
      music: MUSIC,
      betLabel: 'Mise totale',
      head: `<div class="jackpots">${['mini', 'minor', 'major', 'grand'].map((k) => `<div class="jp jp-${k}" data-jp="${k}"><small>${JPN[k]}</small><b></b></div>`).join('')}</div>`,
      stage: '<div class="reels-host"></div><svg class="paylines" viewBox="0 0 500 300" preserveAspectRatio="none"></svg>',
      buys: [
        { id: 'n', icon: '🏠', label: 'Huff ’n’ Puff · 3 scatters', desc: '3 cases rouges au départ, 3 tours remis à zéro à chaque scatter', cost: (b) => b * BUYN },
        { id: 'x', icon: '🐺', label: 'XXTREM · 4 scatters', desc: 'Roulette des maisons : 6 cases rouges, bleues ou dorées d’entrée', cost: (b) => b * BUYX },
        { id: 'm', icon: '👑', label: 'MEGA BONUS · 5 scatters', desc: `La roue du loup : JACKPOT ×${JPV.grand}, MAJOR, bonus maisons en or ou bonus 5 tours`, cost: (b) => b * BUYM },
      ],
      hello: '3 scatters = Huff ’n’ Puff · 4 = XXTREM · 5 = MEGA BONUS',
    });
    this.reels = new Reels(this.q('.reels-host'), {
      cols: COLS, rows: ROWS, game: this,
      random: (c) => (Math.random() < 0.06 ? SC : drawCell(c)),
      art: (v) => art(SYMID[v]),
      cls: (v) => (v === SC ? 'scat' : v === 0 ? 'wild' : ''),
    });
    this.reels.setAll([1, 2, 4, 5, 0, 3, 6, SC, 7, 8, 2, 0, 9, 4, 3]);
    this.svg = this.q('.paylines');
    try { localStorage.removeItem('huff_state'); } catch { /* old Hold & Spin save */ }
    this.onBetChange();
    this.resume();
  }

  onBetChange() {
    this.qa('.jp').forEach((n) => { n.querySelector('b').textContent = shortC(JPV[n.dataset.jp] * this.bet); });
  }

  onMain() {
    this.round(async () => {
      const bet = this.bet;
      if (!this.pay(bet)) return;
      this.lastStake = bet;
      this.setLast(0);
      this.reels.unmark(); this.svg.innerHTML = ''; this.winAmt.textContent = '';
      this.msg('Les rouleaux tournent…');
      const grid = genGrid();
      await this.spinTo(grid);
      if (this.dead) return;
      const ev = evalLines(grid), win = Math.round(ev.coef * bet / 25), sc = scattersIn(grid);
      if (win > 0) {
        this.showWins(ev);
        this.win(win);
        this.setLast(win);
        this.msg(`${ev.wins.length} ligne${ev.wins.length > 1 ? 's' : ''} gagnante${ev.wins.length > 1 ? 's' : ''} : +${fmtC(win)}`);
        await this.celebrate(win);
      } else this.msg(sc.length === 2 ? 'Presque… 2 scatters' : 'Pas de gain');
      if (sc.length >= 3) { this.stopAuto(); await this.trigger(sc, bet); }
    });
  }

  async spinTo(grid) {
    sfx.spin();
    await this.reels.spin(grid, {
      tease: (c, vals) => c >= 2 && scattersIn(vals.slice(0, c * ROWS)).length >= 2,
      onStop: (c) => {
        for (let r = 0; r < ROWS; r++) {
          const i = c * ROWS + r;
          if (grid[i] !== SC) continue;
          const n = this.reels.cell(i); n?.classList.add('pop');
          const p = center(n); fx.burst(p.x, p.y, 14, ['#fde047', '#ef4444', '#fff']); sfx.land();
        }
      },
    });
  }

  async onBuy(kind) {
    const bet = this.bet;
    this.setLast(0);
    this.reels.unmark(); this.svg.innerHTML = '';
    const grid = genGrid(kind === 'm' ? 5 : kind === 'x' ? 4 : 3);
    await this.spinTo(grid);
    await this.trigger(scattersIn(grid), bet);
  }

  async trigger(sc, bet) {
    this.reels.mark(sc);
    sfx.jackpot();
    this.flash('rgba(253,224,71,.45)');
    this.msg(`${sc.length} scatters !`);
    await this.wait(1100);
    if (sc.length >= 5) return this.megaBonus(sc, bet);
    let st;
    if (sc.length >= 4) {
      await this.featureIntro('XXTREM PUFF', `${sc.length} scatters · la roulette des maisons décide de tes 6 cases`, art('wf'));
      const house = spinHouse();
      await this.houseRoulette(house);
      st = newBonus(sc, 'x', house);
    } else {
      await this.featureIntro('HUFF ’N’ PUFF', 'Les cases des scatters deviennent rouges · 3 tours', art('hsc'));
      st = newBonus(sc, 'n');
    }
    await this.runBonus(st, bet, false);
  }

  showWins(ev) {
    const idx = new Set();
    let svg = '<defs><filter id="hglow"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>';
    ev.wins.forEach((w, k) => {
      for (let c = 0; c < w.n; c++) idx.add(c * 3 + LINES[w.line][c]);
      svg += `<polyline points="${LINES[w.line].map((r, c) => `${c * 100 + 50},${r * 100 + 50}`).join(' ')}" stroke="${LINE_COLORS[k % LINE_COLORS.length]}" filter="url(#hglow)"/>`;
    });
    this.reels.mark([...idx]);
    this.svg.innerHTML = svg;
    sfx.coin();
  }

  /* ---------- house roulette (XXTREM) ---------- */
  houseRoulette(house) {
    const n = WHEEL.length, seg = 360 / n, R = 100;
    const pt = (a, r) => { const t = (a - 90) * Math.PI / 180; return `${(R + r * Math.cos(t)).toFixed(2)} ${(R + r * Math.sin(t)).toFixed(2)}`; };
    const slices = WHEEL.map((lv, k) => {
      const a0 = k * seg, a1 = a0 + seg, mid = a0 + seg / 2, ic = pt(mid, 64).split(' ');
      return `<path class="wseg w${lv}" d="M${R} ${R} L${pt(a0, 96)} A96 96 0 0 1 ${pt(a1, 96)} Z"/>
        <g transform="rotate(${mid} ${ic[0]} ${ic[1]})"><use href="#${LVHOUSE[lv]}" x="${ic[0] - 17}" y="${ic[1] - 17}" width="34" height="34"/></g>`;
    }).join('');
    const ov = this.overlay(`<h3>ROULETTE DES MAISONS</h3>
      <div class="hr-wheel"><div class="hr-pointer"></div><svg class="hr-disc" viewBox="0 0 200 200">${slices}<circle cx="100" cy="100" r="96" class="hr-rim"/></svg>
      <div class="hr-hub">${art('wf')}</div></div>
      <div class="hr-res">La roue tourne…</div>`, 'house-roulette');
    const disc = ov.querySelector('.hr-disc'), res = ov.querySelector('.hr-res');
    const opts = WHEEL.map((lv, k) => (lv === house ? k : -1)).filter((k) => k >= 0);
    const k = opts[Math.floor(Math.random() * opts.length)];
    const turns = this.turbo ? 3 : 6, dur = this.turbo ? 2600 : 4800;
    const final = turns * 360 - (k * seg + seg / 2) + (Math.random() - 0.5) * seg * 0.6;
    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        disc.style.transition = `transform ${dur}ms cubic-bezier(.15,.85,.2,1)`;
        disc.style.transform = `rotate(${final}deg)`;
      });
      let last = 0;
      const tick = setInterval(() => {
        const m = new DOMMatrix(getComputedStyle(disc).transform);
        const ang = (Math.atan2(m.b, m.a) * 180 / Math.PI + 360) % 360, s = Math.floor(ang / seg);
        if (s !== last) { last = s; sfx.tick(); }
      }, 30);
      setTimeout(async () => {
        clearInterval(tick);
        ov.classList.add(`won${house}`);
        res.innerHTML = `<b>${HOUSE_NAME[house]}</b> · 6 cases ${LV[house].name.toLowerCase()}s`;
        sfx.jackpot();
        const p = center(ov.querySelector('.hr-wheel'));
        fx.burst(p.x, p.y, 60, LVCOL[house], 9);
        if (house === 3) { fx.confetti(120); fx.coins(40); }
        await sleep(this.turbo ? 900 : 1800);
        ov.classList.add('out');
        setTimeout(() => { ov.remove(); resolve(); }, 300);
      }, dur + 120);
    });
  }

  /* ---------- MEGA bonus (5 scatters) ---------- */
  async megaBonus(sc, bet) {
    await this.featureIntro('MEGA BONUS', '5 scatters · la roue du loup choisit ton bonus', art('wf'));
    const o = spinMega();
    await this.megaWheel(o);
    if (this.dead) return;
    if (o === 'grand' || o === 'major') {
      const total = Math.round(JPV[o] * bet);
      this.jpHit(o);
      fx.confetti(160); fx.coins(60);
      this.win(total, 'Mega bonus');
      this.setLast(total);
      await this.celebrate(total, { summary: MLAB[o][1], stake: bet });
      this.msg('Choisis ta mise et lance.');
      return;
    }
    await this.runBonus(newBonus(sc, o === 'gold' ? 'g' : 'f'), bet, false);
  }

  megaWheel(outcome) {
    const n = MWHEEL.length, seg = 360 / n, R = 100;
    const pt = (a, r) => { const t = (a - 90) * Math.PI / 180; return `${(R + r * Math.cos(t)).toFixed(2)} ${(R + r * Math.sin(t)).toFixed(2)}`; };
    const slices = MWHEEL.map((o, k) => {
      const a0 = k * seg, a1 = a0 + seg, mid = a0 + seg / 2;
      return `<path class="mseg m-${o}" d="M${R} ${R} L${pt(a0, 96)} A96 96 0 0 1 ${pt(a1, 96)} Z"/>
        <g transform="rotate(${mid} 100 100)"><text class="mtxt" x="100" y="42" transform="rotate(90 100 42)" text-anchor="middle" dominant-baseline="middle">${MLAB[o][0]}</text></g>`;
    }).join('');
    const ov = this.overlay(`<h3>MEGA BONUS</h3>
      <div class="hr-wheel"><div class="hr-pointer"></div><svg class="hr-disc" viewBox="0 0 200 200">${slices}<circle cx="100" cy="100" r="96" class="hr-rim"/></svg>
      <div class="hr-hub">${art('wf')}</div></div>
      <div class="hr-res">La roue du loup tourne…</div>`, 'house-roulette mega-wheel');
    const disc = ov.querySelector('.hr-disc'), res = ov.querySelector('.hr-res');
    const opts = MWHEEL.map((o, k) => (o === outcome ? k : -1)).filter((k) => k >= 0);
    const k = opts[Math.floor(Math.random() * opts.length)];
    const turns = this.turbo ? 4 : 7, dur = this.turbo ? 3200 : 6200;
    const final = turns * 360 - (k * seg + seg / 2) + (Math.random() - 0.5) * seg * 0.6;
    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        disc.style.transition = `transform ${dur}ms cubic-bezier(.12,.85,.12,1)`;
        disc.style.transform = `rotate(${final}deg)`;
      });
      let last = 0;
      const tick = setInterval(() => {
        const m = new DOMMatrix(getComputedStyle(disc).transform);
        const ang = (Math.atan2(m.b, m.a) * 180 / Math.PI + 360) % 360, s = Math.floor(ang / seg);
        if (s !== last) { last = s; sfx.tick(); }
      }, 30);
      setTimeout(async () => {
        clearInterval(tick);
        ov.classList.add(`mwon-${outcome}`);
        res.innerHTML = `<b>${MLAB[outcome][1]}</b>${outcome === 'grand' || outcome === 'major' ? ` · ×${JPV[outcome].toLocaleString('fr-FR')} la mise` : outcome === 'gold' ? ' · chaque scatter devient une maison en or' : ` · ${MEGA_SPINS} tours qui se rechargent`}`;
        sfx.jackpot();
        const p = center(ov.querySelector('.hr-wheel'));
        fx.burst(p.x, p.y, 70, ['#fde047', '#fbbf24', '#fff'], 10);
        if (outcome !== 'five') { fx.confetti(140); fx.coins(50); }
        await sleep(this.turbo ? 1000 : 2000);
        ov.classList.add('out');
        setTimeout(() => { ov.remove(); resolve(); }, 300);
      }, dur + 120);
    });
  }

  /* ---------- colour-cell bonus ---------- */
  saveState(st, b) { try { localStorage.setItem(saveKey(), JSON.stringify({ st, b })); } catch { /* ignore */ } }
  clearState() { try { localStorage.removeItem(saveKey()); } catch { /* ignore */ } }

  resume() {
    try {
      const raw = localStorage.getItem(saveKey());
      if (!raw) return;
      const s0 = JSON.parse(raw);
      if (s0?.st?.lv?.length === NC) this.round(() => this.runBonus(s0.st, s0.b, true));
      else this.clearState();
    } catch { this.clearState(); }
  }

  cellHTML(lv) {
    // empty cells hold a hidden reel strip that spins with the board
    if (!lv) return `<div class="hs-empty"><div class="hc-strip">${['hsc', 'hs', 'hw', 'hb', 'hsc', 'hs', 'hw', 'hb'].map(art).join('')}</div></div>`;
    return `<div class="hs-sym hc lv${lv}">${art(LVHOUSE[lv])}<b class="q">?</b></div>`;
  }

  paint(i, lv, anim) {
    const n = this.hsCells[i];
    n.className = `hs-cell hcell${lv ? ` locked c${lv}` : ''}`;
    n.innerHTML = this.cellHTML(lv);
    if (anim) { void n.offsetWidth; n.classList.add(anim); }
  }

  hud(st) {
    const cnt = [0, 0, 0, 0]; st.lv.forEach((l) => cnt[l]++);
    this.setBanner(`<b>${BONUS_NAME[st.kind] || BONUS_NAME.n}</b>
      <span class="pill respins">${Array.from({ length: st.spins || BONUS_SPINS }, (_, k) => `<i class="dot${k < st.left ? ' on' : ''}"></i>`).join('')} Tours</span>
      <span class="pill hcnt c1">${cnt[1]}</span><span class="pill hcnt c2">${cnt[2]}</span><span class="pill hcnt c3">${cnt[3]}</span>`);
  }

  jpHit(j) {
    const e = this.q(`.jp-${j}`);
    if (e) { e.classList.remove('hit'); void e.offsetWidth; e.classList.add('hit'); const p = center(e); fx.burst(p.x, p.y, 40, ['#fde047', '#fbbf24', '#fff'], 8); }
    sfx.jackpot();
    this.flash('rgba(253,224,71,.6)');
  }

  // A scatter drops onto cell i and the cell (or the target of a gold jump) changes colour.
  async landScatter(h, st) {
    const n = this.hsCells[h.i], p = center(n);
    const drop = el('div', 'hc-drop', art('hsc'));
    n.appendChild(drop);
    sfx.land();
    await this.wait(320);
    fx.burst(p.x, p.y, 18, ['#fde047', '#fff', '#ef4444']);
    drop.remove();
    if (h.from < 3) {
      this.paint(h.i, h.to, h.from ? 'upgrade' : 'pop');
      if (h.from) sfx.upgrade(); else sfx.coin();
      fx.burst(p.x, p.y, h.to === 3 ? 40 : 24, LVCOL[h.to]);
      fx.floatText(p.x, p.y - 26, h.from ? `▲ ${LV[h.to].name.toUpperCase()}` : 'ROUGE', LVCOL[h.to][0], h.to === 3 ? 22 : 18);
      if (h.to === 3) this.flash('rgba(253,224,71,.35)');
      await this.wait(h.from ? 420 : 260);
      return;
    }
    n.classList.add('shake');
    if (h.target === undefined) { fx.floatText(p.x, p.y - 26, 'DÉJÀ DORÉE', '#fde68a', 16); await this.wait(300); return; }
    const t = this.hsCells[h.target];
    fx.floatText(p.x, p.y - 26, 'BOND DORÉ !', '#fde047', 18);
    fx.trail(p, center(t), '#fde047', 14);
    await this.wait(520);
    this.paint(h.target, st.lv[h.target], 'upgrade');
    const q = center(t);
    fx.burst(q.x, q.y, 40, LVCOL[st.lv[h.target]]);
    sfx.upgrade();
    if (st.lv[h.target] === 3) this.flash('rgba(253,224,71,.4)');
    await this.wait(420);
  }

  async runBonus(st, b, resumed) {
    this.lastStake = b;
    this.reels.unmark(); this.svg.innerHTML = '';
    const board = el('div', 'hs-board hc-board');
    this.hsCells = [];
    for (let i = 0; i < NC; i++) {
      const n = el('div', 'hs-cell hcell');
      n.style.gridColumn = Math.floor(i / ROWS) + 1;
      n.style.gridRow = (i % ROWS) + 1;
      board.appendChild(n);
      this.hsCells.push(n);
    }
    this.layer.innerHTML = '';
    this.layer.appendChild(board);
    this.slotEl.classList.add('in-hold');
    for (let i = 0; i < NC; i++) { this.paint(i, st.lv[i]); if (st.lv[i]) setTimeout(() => this.hsCells[i].classList.add('pop'), i * 50); }
    this.hud(st);
    const spins = st.spins || BONUS_SPINS;
    if (!resumed) { this.msg(st.gold ? `Maisons en or : chaque scatter devient une maison en or · ${spins} tours` : `Bonus : ${spins} tours, remis à ${spins} à chaque scatter`); await this.wait(1100); }
    this.saveState(st, b);
    while (!bonusDone(st) && !this.dead) {
      this.hud(st);
      this.msg('Les scatters tombent…');
      board.classList.remove('spin'); void board.offsetWidth; board.classList.add('spin');
      sfx.spin();
      await this.wait(900);
      const { hits } = stepBonus(st);
      board.classList.remove('spin');
      if (!hits.length) sfx.tick();
      for (const h of hits) { if (this.dead) return; await this.landScatter(h, st); }
      this.saveState(st, b);
      this.hud(st);
      if (hits.length) { this.msg(`${hits.length} scatter${hits.length > 1 ? 's' : ''} ! Les tours repartent à ${spins}`); this.banner.querySelector('.respins')?.classList.add('reset'); }
      else this.msg(st.left ? `Rien… ${st.left} tour${st.left > 1 ? 's' : ''} restant${st.left > 1 ? 's' : ''}` : 'Derniers tours terminés');
      await this.wait(hits.length ? 450 : 350);
    }
    if (this.dead) return;
    if (st.lv.every((l) => l === 3)) { this.msg('TOUT EST DORÉ !'); fx.confetti(140); sfx.jackpot(); await this.wait(1200); }
    const res = reveal(st);
    await this.wolfReveal(st, res, b);
    if (this.dead) return;
    // collect
    const total = Math.round(res.total * b);
    this.setBanner('<b>COLLECTE</b><span class="pill gold">Total <em class="hs-tot">0,00\u00a0\uE1E0</em></span>');
    const totEl = this.banner.querySelector('.hs-tot'), tgt = center(totEl);
    let run = 0;
    for (let i = 0; i < NC; i++) {
      const v = res.vals[i];
      if (!v) continue;
      this.hsCells[i].classList.add('collect');
      fx.trail(center(this.hsCells[i]), tgt, LVCOL[st.lv[i]][1], 8);
      const before = run;
      run = Math.min(total, run + Math.round(v.v * b));
      animateNumber(totEl, before, run, 160, fmtC);
      sfx.coin();
      await sleep(this.turbo ? 50 : 130);
    }
    totEl.textContent = fmtC(total);
    await this.wait(700);
    this.clearState();
    this.win(total, 'Bonus');
    this.setLast(total);
    board.classList.add('out');
    await this.wait(300);
    this.layer.innerHTML = '';
    this.slotEl.classList.remove('in-hold');
    this.setBanner('');
    const big = (res.capped || res.vals.some((v) => v?.j === 'grand')) ? 'MAX WIN' : null;
    await this.celebrate(total, { summary: big || BONUS_NAME[st.kind] || BONUS_NAME.n, stake: b });
    this.msg('Choisis ta mise et lance.');
  }

  // The wolf huffs and puffs, the houses fly off and every cell shows what it hid.
  async wolfReveal(st, res, b) {
    this.setBanner('<b>LE LOUP SOUFFLE</b><span class="pill gold">Révélation</span>');
    this.msg('Le loup va souffler sur les maisons…');
    await this.wait(500);
    const actor = el('div', 'wolf-actor', `<div class="wolf-wrap"><div class="wolf-glow"></div><div class="wolf-face svgwolf"><svg viewBox="0 2 64 46" aria-hidden="true"><use href="#wf" width="64" height="64"/></svg></div><div class="cheek l"></div><div class="cheek r"></div><div class="breath"></div></div><div class="huff-text"></div>`);
    this.slotEl.appendChild(actor);
    const txt = actor.querySelector('.huff-text');
    this.slotEl.classList.add('wolf-night');
    sfx.growl();
    await this.wait(60);
    actor.classList.add('enter');
    await this.wait(650);
    txt.textContent = 'HUFF…'; txt.className = 'huff-text show';
    actor.classList.add('inhale'); sfx.huff();
    await this.wait(800);
    actor.classList.remove('inhale'); txt.className = 'huff-text';
    await this.wait(100);
    txt.textContent = 'AND PUFF !'; txt.className = 'huff-text show big';
    actor.classList.add('blow'); sfx.puff();
    fx.wind(this.stage.getBoundingClientRect(), 1.2, 200);
    this.stage.classList.add('quake');
    let run = 0;
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) {
        const i = c * ROWS + r, v = res.vals[i];
        if (!v) continue;
        const n = this.hsCells[i], p = center(n), lv = st.lv[i];
        n.classList.add('blown');
        fx.dust(p.x, p.y + 14, 16);
        await this.wait(this.turbo ? 90 : 180);
        // jackpots come out of the gold house as a coin: MINI, MINOR, MAJOR or JACKPOT, worth a multiple of the stake
        const lab = v.j ? `<span class="hc-coin"><small>${JPN[v.j]}</small><b>${shortC(v.v * b)}</b></span>` : `<b class="mx">×${xs(v.v)}</b><small>${shortC(v.v * b)}</small>`;
        n.querySelector('.hs-sym').innerHTML = `<div class="hc-val${v.j ? ` jpv jp-${v.j}` : ''}">${lab}</div>`;
        n.classList.add('revealed');
        fx.burst(p.x, p.y, lv === 3 ? 30 : 16, LVCOL[lv]);
        run += v.v;
        this.banner.querySelector('.pill').textContent = `Total ${fmtC(Math.round(Math.min(run, CAPX) * b))}`;
        if (v.j) { this.jpHit(v.j); await this.wait(900); } else sfx.coin();
        await this.wait(this.turbo ? 60 : lv === 3 ? 260 : 140);
      }
    }
    this.stage.classList.remove('quake');
    await this.wait(500);
    actor.classList.add('leave');
    this.slotEl.classList.remove('wolf-night');
    await this.wait(450);
    actor.remove();
  }

  info() {
    const rows = SYMID.slice(0, 10).map((id, s) => {
      const p = PAY[s].map((x) => (x * TUNE.pay / 25).toFixed(2).replace('.', ','));
      const t = s === 0 ? `Remplace tout sauf le scatter. Seul, il paie comme la maison en briques.` : `5 : ×${p[2]} · 4 : ×${p[1]} · 3 : ×${p[0]}`;
      return `<div class="pay-item"><div class="pay-sym svg">${art(id)}</div><div class="pay-vals"><b>${NAMES[s]}</b><br><span>${t}</span></div></div>`;
    }).join('');
    return this.rules(`<h4>Table des gains (× la mise totale)</h4><div class="paytable">${rows}</div>
      <div class="pay-item"><div class="pay-sym svg">${art('hsc')}</div><div class="pay-vals"><b>Scatter BONUS</b><br><span>3 = Huff ’n’ Puff · 4 ou 5 = XXTREM Puff</span></div></div>
      <h4>Huff ’n’ Puff (3 scatters)</h4><ul class="rules"><li>Les cases où sont tombés les scatters deviennent <b>rouges</b>.</li><li>3 tours, remis à 3 à chaque scatter qui tombe.</li><li>Scatter sur une case vide : elle devient rouge. Sur une rouge : elle devient <b>bleue</b>. Sur une bleue : elle devient <b>dorée</b>.</li><li>Scatter sur une case dorée : elle ne monte plus, le scatter <b>bondit</b> sur une case rouge ou bleue et la rend dorée.</li></ul>
      <h4>XXTREM Puff (4 scatters)</h4><p>La roulette des maisons tourne d’abord : <b>maison rouge</b>, <b>maison bleue</b> ou <b>maison OR</b>. Tu commences avec 6 cases de cette couleur, puis le bonus se joue comme Huff ’n’ Puff.</p>
      <h4>MEGA BONUS (5 scatters)</h4><p>La roue du loup choisit entre : le <b>GRAND JACKPOT ×${JPV.grand}</b> la mise, le <b>MAJOR ×${JPV.major}</b>, le bonus <b>maisons en or</b> (les 5 cases de départ et chaque scatter qui tombe deviennent directement des maisons en or) ou un bonus <b>${MEGA_SPINS} tours</b> qui se rechargent à ${MEGA_SPINS} au lieu de ${BONUS_SPINS}.</p>
      <h4>Valeurs cachées</h4><ul class="rules"><li>Rouge : ×2 à ×10 la mise.</li><li>Bleue : ×15 à ×50.</li><li>Rouge = maison de paille, bleue = maison en bois, dorée = maison en briques.</li><li>Dorée : ×70 à ×200, ou une <b>pièce jackpot</b> : MINI ×${JPV.mini}, MINOR ×${JPV.minor}, MAJOR ×${JPV.major} ou JACKPOT ×${JPV.grand} (max win). Le montant suit ta mise.</li><li>Tout reste caché jusqu’à la fin : le loup souffle sur les maisons et révèle chaque case.</li><li>Gain plafonné à ×${CAPX}.</li></ul>
      <h4>Achats</h4><p>Huff ’n’ Puff ×${BUYN} · XXTREM Puff ×${BUYX} · MEGA BONUS ×${BUYM}. RTP ≈ 92 %.</p>`);
  }
}

return { HuffGame };
})();
