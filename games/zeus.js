// SpinBet Casino · ZeusGame — loaded on demand by games/impl/index.js (index.html).
// ---- games/impl/zeus-engine.js ----
__mods['games/impl/zeus-engine.js'] = (() => {
// Zeus Thunder math (pure, no DOM, so scripts/sim-zeus.mjs can check the RTP).
// 6×5 grid, pays anywhere (8+ of a kind), tumbles, multiplier orbs, 15 free spins with a global multiplier.

const COLS = 6, ROWS = 5, N = 30, MIN = 8, CAPX = 5000;
const SC = 9, ORB = 10;
// 0 blue gem, 1 green gem, 2 yellow gem, 3 purple gem, 4 red gem, 5 chalice, 6 ring, 7 hourglass, 8 crown
// pays in bet multiples for 8-9, 10-11 and 12+ symbols
const PAYS = [
  [0.25, 0.75, 2], [0.4, 0.9, 4], [0.5, 1, 5], [0.8, 1.2, 8], [1, 1.5, 10],
  [1.5, 2, 12], [2, 5, 15], [2.5, 10, 25], [10, 25, 50],
];
const SCATTER_PAY = { 4: 3, 5: 5, 6: 100 };
// tuned by simulation for ≈ 92 % RTP (free spins buy ≈ 87 %)
const TUNE = {
  payScale: 0.575,
  w: [21, 19, 17, 15, 13, 10, 8, 6.5, 4.5],
  sc: 2.0, scFree: 1.8,
  orb: 0.014, orbFree: 0.09,
  orbv: [[2, 400], [3, 260], [4, 160], [5, 140], [6, 70], [8, 50], [10, 50], [12, 22], [15, 22], [20, 14], [25, 10], [50, 5], [100, 2.5], [250, 0.6], [500, 0.25]],
  orbvFree: [[2, 200], [3, 160], [4, 120], [5, 110], [6, 70], [8, 60], [10, 60], [12, 30], [15, 30], [20, 22], [25, 16], [50, 8], [100, 4], [250, 1], [500, 0.4]],
};
const FREE_SPINS = 15, RETRIGGER = 5, BUY_COST = 115;

const wpick = (l) => { let t = 0; for (const x of l) t += x[1]; let r = Math.random() * t; for (const x of l) { if (r < x[1]) return x[0]; r -= x[1]; } return l[l.length - 1][0]; };
const SW = () => TUNE.w.reduce((a, b) => a + b, 0);

function draw(free) {
  const r = Math.random();
  const po = free ? TUNE.orbFree : TUNE.orb;
  if (r < po) return { s: ORB, m: wpick(free ? TUNE.orbvFree : TUNE.orbv) };
  const sw = SW(), sc = free ? TUNE.scFree : TUNE.sc;
  let x = Math.random() * (sw + sc);
  if (x >= sw) return { s: SC };
  for (let i = 0; i < TUNE.w.length; i++) { if (x < TUNE.w[i]) return { s: i }; x -= TUNE.w[i]; }
  return { s: 0 };
}

const payFor = (s, n) => TUNE.payScale * (n >= 12 ? PAYS[s][2] : n >= 10 ? PAYS[s][1] : PAYS[s][0]);

// One paid or free spin. Returns the steps to animate and the totals (in bet multiples).
// state.global is the free-spins global multiplier (kept between spins by the caller).
function spin({ free = false, forceScatters = 0, state = { global: 0 } } = {}) {
  const grid = Array.from({ length: N }, () => draw(free));
  if (forceScatters) {
    grid.forEach((c, i) => { if (c.s === SC) grid[i] = { s: 0 }; });
    const idx = [...Array(N).keys()].sort(() => Math.random() - 0.5).slice(0, forceScatters);
    idx.forEach((i) => { grid[i] = { s: SC }; });
  }
  const steps = [{ k: 'init', grid: grid.map((c) => ({ ...c })) }];
  let tumble = 0, rounds = 0;
  while (rounds < 60) {
    const counts = {};
    grid.forEach((c, i) => { if (c.s < SC) (counts[c.s] = counts[c.s] || []).push(i); });
    const wins = [];
    for (const s in counts) if (counts[s].length >= MIN) wins.push({ s: +s, n: counts[s].length, cells: counts[s], pay: payFor(+s, counts[s].length) });
    if (!wins.length) break;
    const removed = new Set(wins.flatMap((w) => w.cells));
    const paid = wins.reduce((a, w) => a + w.pay, 0);
    tumble += paid;
    for (let c = 0; c < COLS; c++) {
      const keep = [];
      for (let r = 0; r < ROWS; r++) { const i = c * ROWS + r; if (!removed.has(i)) keep.push(grid[i]); }
      const miss = ROWS - keep.length;
      for (let r = 0; r < ROWS; r++) grid[c * ROWS + r] = r < miss ? draw(free) : keep[r - miss];
    }
    steps.push({ k: 'win', wins, paid, removed: [...removed], after: grid.map((c) => ({ ...c })) });
    rounds++;
  }
  const orbs = [];
  grid.forEach((c, i) => { if (c.s === ORB) orbs.push({ i, m: c.m }); });
  const orbSum = orbs.reduce((a, o) => a + o.m, 0);
  const scat = grid.filter((c) => c.s === SC).length;
  let win = tumble, mult = 1, globalBefore = state.global;
  if (tumble > 0 && orbSum > 0) {
    if (free) { state.global += orbSum; mult = state.global; } else mult = orbSum;
    win = tumble * mult;
  }
  const scatterWin = SCATTER_PAY[Math.min(scat, 6)] || 0;
  const total = Math.min(CAPX, win + scatterWin);
  steps.push({ k: 'end', orbs, orbSum, mult, globalBefore, global: state.global, tumble, scat, scatterWin });
  return { steps, total, tumble, orbSum, mult, scat, scatterWin, capped: win + scatterWin >= CAPX };
}

// Whole free-spins round (used by the simulator; the game plays the same spins one by one).
function freeRound(scatters = 4) {
  const state = { global: 0 };
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

return { COLS, SC, PAYS, SCATTER_PAY, TUNE, FREE_SPINS, draw, spin, freeRound, ROWS, N, MIN, CAPX, ORB, RETRIGGER, BUY_COST };
})();

// ---- games/impl/zeus.js ----
__mods['games/impl/zeus.js'] = (() => {
// Zeus Thunder: 6×5 pays anywhere, tumbles, winged multiplier orbs and 15 free spins with a global multiplier.
// Math lives in zeus-engine.js (checked with scripts/sim-zeus.mjs).

const { BaseGame, fmtC } = __mods['core/base.js'];
let { art } = __mods['core/base.js'];
const { SymbolGrid } = __mods['core/grid.js'];
const { EXTRA_THEMES } = __mods['core/music.js'];
const { ZEUS_FIG } = __mods['art/zeus.js'];
const { COLS, ROWS, N, SC, ORB, PAYS, TUNE, SCATTER_PAY, FREE_SPINS, RETRIGGER, BUY_COST, CAPX, spin } = __mods['games/impl/zeus-engine.js'];
const { sfx } = __mods['audio.js'];
const { fx, sleep, center } = __mods['fx.js'];
const { el, animateNumber } = __mods['ui.js'];

const IDS = ['z0', 'z1', 'z2', 'z3', 'z4', 'z5', 'z6', 'z7', 'z8'];
// Painted images from the owner (assets/games/zeus): the 9 symbols, the scatter (Zeus head), the multiplier orb
// (fist and lightning), Zeus beside the grid, the background and the cover.
const IMG_V = 1;
const asset = (p) => window.__assets?.[p] || `${p}?v=${IMG_V}`; // single-file version: images are inlined
const PAINT = { z0: 's0', z1: 's1', z2: 's2', z3: 's3', z4: 's4', z5: 's5', z6: 's6', z7: 's7', z8: 's8', zsc: 'scatter', zorb: 'orb' };
const svgArt = art;
art = (id) => (PAINT[id] ? `<img class="z-img" src="${asset(`assets/games/zeus/${PAINT[id]}.webp`)}" alt="" draggable="false" decoding="async">` : svgArt(id));
const NAMES = ['Saphir', 'Émeraude', 'Topaze', 'Améthyste', 'Rubis', 'Calice', 'Anneau', 'Sablier', 'Couronne'];
const lab = (t) => `<b class="sg-lab">${t}</b>`;
const cellArt = (c) => (c.s === ORB ? art('zorb') + lab('×' + c.m) : c.s === SC ? art('zsc') + '<i class="lbl zl">SCATTER</i>' : art(IDS[c.s]));
const cellCls = (c) => (c.s === ORB ? 'orb' : c.s === SC ? 'scatter' : c.s >= 5 ? 'hi' : '');

class ZeusGame extends BaseGame {
  constructor(root, game) {
    super(root, game, {
      music: EXTRA_THEMES.zeus,
      frameCls: 'zeus-frame',
      stage: `<div class="zeus-stage">
        <div class="zeus-sky"><i class="cl c1"></i><i class="cl c2"></i><i class="cl c3"></i><i class="col l"></i><i class="col r"></i></div>
        <div class="zeus-fig painted"><img class="z-fig-img" src="${asset('assets/games/zeus/zeus.webp')}" alt="" draggable="false"><div class="zeus-say"></div></div>
        <div class="zeus-board">
          <div class="zeus-top">
            <div class="zeus-plaque"><span>⚡</span>MONT OLYMPE<span>⚡</span></div>
            <div class="zeus-mult"><small>Multiplicateur</small><b><em>×</em><span class="zm-v">0</span></b><i class="zm-sub">8+ symboles n’importe où</i></div>
          </div>
          <div class="grid-host"></div>
        </div>
      </div>`,
      buys: [{ id: 'fs', icon: '⚡', label: `${FREE_SPINS} Free Spins · 4 scatters`, desc: 'Multiplicateur global qui ne se réinitialise pas entre les tours', cost: (b) => b * BUY_COST }],
      hello: '8 symboles identiques n’importe où pour gagner',
    });
    this.zeus = this.q('.zeus-fig');
    this.q('.zeus-sky').style.setProperty('--z-bg', `url("${asset('assets/games/zeus/bg.webp')}")`);
    Object.values(PAINT).forEach((n) => { new Image().src = asset(`assets/games/zeus/${n}.webp`); });
    this.meter = this.q('.zeus-mult');
    this.meterVal = 0;
    this.grid = new SymbolGrid(this.q('.grid-host'), { cols: COLS, rows: ROWS, game: this, art: cellArt, cls: cellCls });
    this.grid.setAll(Array.from({ length: N }, () => ({ s: Math.floor(Math.random() * 9) })));
  }

  say(t) {
    const s = this.q('.zeus-say');
    s.textContent = t;
    s.classList.remove('on'); void s.offsetWidth; s.classList.add('on');
  }

  pose(cls, ms = 900) {
    this.zeus.classList.remove('raise', 'flick');
    void this.zeus.offsetWidth;
    this.zeus.classList.add(cls);
    clearTimeout(this.poseT);
    this.poseT = setTimeout(() => this.zeus.classList.remove(cls), this.turbo ? ms / 2 : ms);
  }

  // Framed multiplier, top right of the grid: counts up and flares when it grows.
  setMeter(v, { bump = false, label = null } = {}) {
    const box = this.meter, num = box.querySelector('.zm-v');
    if (label) box.querySelector('small').textContent = label;
    const from = this.meterVal;
    this.meterVal = v;
    box.classList.toggle('hot', v > 0);
    box.classList.toggle('big', v >= 100);
    if (v > from && bump) {
      animateNumber(num, from, v, this.turbo ? 250 : 650, (x) => Math.round(x));
      box.classList.remove('bump'); void box.offsetWidth; box.classList.add('bump');
      const p = center(box); fx.burst(p.x, p.y, v >= 100 ? 50 : 26, ['#fde047', '#fff', '#93c5fd'], 7);
    } else num.textContent = v;
  }

  bolt(target) {
    // the bolt leaves from Zeus' raised fist (top left of the painted figure)
    const fig = this.q('.z-fig-img') || this.q('.z-hand'), r = fig.getBoundingClientRect();
    const from = this.q('.z-hand') ? center(this.q('.z-hand')) : { x: r.left + r.width * 0.12, y: r.top + r.height * 0.1 }, to = center(target);
    const o = el('div', 'g-bolt g-overlay');
    let d = `M ${from.x} ${from.y}`;
    for (let i = 1; i <= 8; i++) { const k = i / 8; d += ` L ${from.x + (to.x - from.x) * k + (i < 8 ? (Math.random() - 0.5) * 34 : 0)} ${from.y + (to.y - from.y) * k + (i < 8 ? (Math.random() - 0.5) * 34 : 0)}`; }
    o.innerHTML = `<svg width="100%" height="100%"><path d="${d}" stroke="#fff" stroke-width="3.5" fill="none" filter="drop-shadow(0 0 8px #93c5fd)"/><path d="${d}" stroke="#fde047" stroke-width="9" fill="none" opacity=".35"/></svg>`;
    document.body.appendChild(o);
    setTimeout(() => o.remove(), 380);
    fx.burst(to.x, to.y, 20, ['#fff', '#fde047', '#93c5fd'], 7);
  }

  onMain() {
    this.round(async () => {
      const bet = this.bet;
      if (!this.pay(bet)) return;
      this.lastStake = bet;
      this.setMeter(0, { label: 'Multiplicateur' });
      const r = await this.playSpin(false, { global: 0 });
      if (r.total > 0) await this.celebrate(Math.round(r.total * bet));
      if (r.scat >= 4) { this.stopAuto(); await this.freeSpins(); }
    });
  }

  async onBuy() { await this.freeSpins(); }

  // Animates one engine spin; credits it; returns the engine result.
  async playSpin(free, state) {
    const bet = this.bet;
    const r = spin({ free, state });
    this.setLast(0); this.winAmt.textContent = '';
    this.msg(free ? 'Tour gratuit…' : 'Les dieux lancent la tempête…');
    let run = 0;
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
        await this.wait(700);
        this.grid.unmark();
        await this.grid.explode(st.removed, ['#93c5fd', '#fde047', '#fff']);
        await this.grid.cascade(st.after, new Set(st.removed));
        // orbs that just fell in: the top `miss` cells of each column
        for (let c = 0; c < COLS; c++) {
          const miss = st.removed.filter((i) => Math.floor(i / ROWS) === c).length;
          for (let k = 0; k < miss; k++) { const i = c * ROWS + k; if (st.after[i].s === ORB) this.landed(i, st.after[i]); }
        }
        run += st.paid;
        this.setLast(Math.round(run * bet));
        await this.wait(200);
      } else if (st.k === 'end') {
        if (st.tumble > 0 && st.orbSum > 0) await this.applyOrbs(st, free);
        else if (free) this.setMeter(st.global);
        if (st.scatterWin) { this.msg(`${st.scat} scatters : +${fmtC(st.scatterWin * bet)}`); sfx.jackpot(); }
      }
    }
    const won = Math.round(r.total * bet);
    if (won > 0) { this.win(won, free ? 'Free Spins' : null); this.setLast(won); }
    if (!free) this.msg(won > 0 ? `Total du tour : ${fmtC(won)}` : r.scat === 3 ? 'Presque… 3 scatters' : 'Pas de gain');
    return r;
  }

  landed(i, v) {
    const cell = this.grid.cells[i];
    if (v.s === ORB) {
      this.pose('flick', 500);
      this.bolt(cell);
      sfx.coin();
      if (v.m >= 50) { this.flash('rgba(253,224,71,.5)'); this.say(`×${v.m} !`); }
    } else if (v.s === SC) { sfx.land(); this.grid.bump(cell); const p = center(cell); fx.burst(p.x, p.y, 16, ['#93c5fd', '#fde047', '#fff']); }
  }

  // Zeus raises his arm, strikes every orb and multiplies the tumble win.
  async applyOrbs(st, free) {
    const bet = this.bet;
    this.pose('raise', 2200);
    this.say(free ? `+×${st.orbSum}` : `×${st.orbSum}`);
    sfx.feature();
    // each orb is struck, then flies into the framed multiplier, which climbs orb by orb
    let run = free ? st.globalBefore : 0;
    this.setMeter(run, { label: free ? 'Multiplicateur global' : 'Multiplicateur' });
    const target = center(this.meter);
    for (const o of st.orbs) {
      const cell = this.grid.cells[o.i];
      cell.classList.add('win');
      this.bolt(cell);
      sfx.coin();
      await this.wait(180);
      fx.trail(center(cell), target, '#fde047', 12);
      await this.wait(260);
      run += o.m;
      this.setMeter(run, { bump: true });
      sfx.upgrade();
    }
    this.flash('rgba(147,197,253,.55)');
    this.shake();
    if (free) this.msg(`Multiplicateur global : ×${st.globalBefore} + ${st.orbSum} = <b>×${st.global}</b>`);
    const before = Math.round(st.tumble * bet), after = Math.round(st.tumble * st.mult * bet);
    this.msg(`${fmtC(before)} × ${st.mult} = <b>${fmtC(after)}</b>`);
    this.floatAt(this.q('.grid-host'), `×${st.mult}`, '#fde047', 46);
    await this.wait(1100);
    this.grid.unmark();
  }

  async freeSpins() {
    const bet = this.bet, state = { global: 0 };
    let left = FREE_SPINS, done = 0, total = 0;
    this.lastStake = bet;
    this.pose('raise', 2500);
    await this.featureIntro(`${FREE_SPINS} FREE SPINS`, 'Chaque multiplicateur s’ajoute au multiplicateur global', art('zsc'));
    this.slotEl.classList.add('in-free');
    this.setMeter(0, { label: 'Multiplicateur global' });
    while (left > 0 && !this.dead) {
      left--; done++;
      this.setBanner(`<b>FREE SPINS</b><span class="pill">Tour ${done} / ${done + left}</span><span class="pill hot">Global ×${state.global || 0}</span><span class="pill gold">Gain ${fmtC(total)}</span>`);
      const r = await this.playSpin(true, state);
      total = Math.min(bet * CAPX, total + Math.round(r.total * bet));
      if (r.scat >= 3) { left += RETRIGGER; this.pose('raise', 1500); await this.featureIntro(`+${RETRIGGER} TOURS`, 'Retrigger !', art('zsc'), 1300); }
      if (total >= bet * CAPX) { this.msg('MAX WIN ×5 000 !'); break; }
      await this.wait(450);
    }
    this.slotEl.classList.remove('in-free');
    this.setBanner('');
    this.setMeter(0, { label: 'Multiplicateur' });
    this.setLast(total);
    await this.celebrate(total, { summary: 'FREE SPINS', stake: bet });
    this.msg(`Bonus terminé : ${fmtC(total)} gagnés`);
  }

  destroy() { clearTimeout(this.poseT); super.destroy(); }

  info() {
    const f = (x) => x.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
    const rows = IDS.map((id, s) => `<div class="pay-item"><div class="pay-sym svg">${art(id)}</div><div class="pay-vals"><b>${NAMES[s]}</b><br><span>8-9 : ×${f(PAYS[s][0] * TUNE.payScale)} · 10-11 : ×${f(PAYS[s][1] * TUNE.payScale)} · 12+ : ×${f(PAYS[s][2] * TUNE.payScale)}</span></div></div>`).reverse().join('');
    return this.rules(`<h4>Table des gains (× la mise)</h4><div class="paytable">${rows}
      <div class="pay-item"><div class="pay-sym svg">${art('zsc')}</div><div class="pay-vals"><b>Zeus (scatter)</b><br><span>4 : ×${SCATTER_PAY[4]} · 5 : ×${SCATTER_PAY[5]} · 6 : ×${SCATTER_PAY[6]}</span></div></div></div>
      <h4>Pay Anywhere et cascades</h4><p>Grille 6×5, pas de lignes : <b>8 symboles identiques ou plus n’importe où</b> paient. Les symboles gagnants disparaissent et de nouveaux tombent, tant qu’il y a des gains.</p>
      <h4>Orbes multiplicateurs</h4><p>Zeus lance des orbes dorés ailés de <b>×2 à ×500</b> à n’importe quel moment. À la fin des cascades, s’il y a eu un gain, tous les orbes présents <b>s’additionnent</b> et multiplient le gain du tour.</p>
      <h4>Free Spins</h4><p>4 scatters Zeus ou plus : <b>${FREE_SPINS} tours gratuits</b>. Chaque orbe qui tombe sur un tour gagnant s’ajoute à un <b>multiplicateur global</b> qui ne se réinitialise pas, et qui multiplie ce tour. 3 scatters pendant le bonus : +${RETRIGGER} tours.</p>
      <h4>Achat</h4><p>Free Spins ×${BUY_COST} la mise. Gain maximum ×${CAPX.toLocaleString('fr-FR')}.</p>`);
  }
}

return { ZeusGame };
})();
