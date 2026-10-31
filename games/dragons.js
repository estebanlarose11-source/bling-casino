// SpinBet Casino · DragonsGame — loaded on demand by games/impl/index.js (index.html).
// ---- games/impl/dragons.js ----
__mods['games/impl/dragons.js'] = (() => {
// Têtes de Dragon: 3 pairs of framed reels × 3 rows in a dragon's lair, with cascades. Left reels drop left halves of
// dragon heads, right reels right halves; when both halves of the same dragon sit side by side, the divider fades,
// the two cells become one and the dragon pays; then it vanishes, the halves above fall into the gap, new ones drop
// in and every new pair pays again. Tuned by simulation (RTP ≈ 92 %, buy ≈ 88 %).

const { BaseGame, fmtC, art } = __mods['core/base.js'];
const { SymbolGrid } = __mods['core/grid.js'];
const { EXTRA_THEMES } = __mods['core/music.js'];
const { sfx } = __mods['audio.js'];
const { fx, sleep, center } = __mods['fx.js'];
const { el } = __mods['ui.js'];

/* ===ENGINE */
// 3 pairs of reels × 3 rows, with cascades. Left reels drop left halves of dragon heads, right reels right halves; when
// both halves of the same dragon sit side by side in a pair they fuse, pay the dragon's power × the bet (× K) and
// vanish; everything above falls down, new halves drop in, and new pairs pay again. A pearl half completes any half;
// stones never match. 3+ dragon eggs (counted when the cascades stop): free spins with more pearls, every dragon pays
// ×fsMult.
const PAIRS = 3, COLS = 6, ROWS = 3, N = 18, PEARL = 9, EGG = 10, STONE = 11, CAPX = 5000, FS_SPINS = 8;
const POWER = [2, 5, 10, 20, 50, 100], JP = [10, 50, 500]; // dragons 6, 7, 8 are MINI, MAJEUR, JACKPOT (× the bet)
const P = {
  w: [30, 25, 20, 14, 8, 4, 1.4, 0.4, 0.05], pearl: 1.2, pearlFS: 5.9, egg: 4.2, stone: 120, stoneFS: 0.6, K: 0.168, fsMult: 3,
};
function draw(fs) {
  const wj = fs ? P.pearlFS : P.pearl, wb = fs ? P.egg * 0.6 : P.egg, wp = P.stone * (fs ? P.stoneFS : 1);
  let t = wj + wb + wp; for (const x of P.w) t += x;
  let r = Math.random() * t;
  if (r < wp) return STONE; r -= wp;
  if (r < wj) return PEARL; r -= wj;
  if (r < wb) return EGG; r -= wb;
  for (let i = 0; i < P.w.length; i++) { if (r < P.w[i]) return i; r -= P.w[i]; }
  return 0;
}
const payOf = (s) => (s < 6 ? POWER[s] * P.K : JP[s - 6]);
function fitsOf(g, fs) {
  const out = [];
  for (let p = 0; p < PAIRS; p++) for (let r = 0; r < ROWS; r++) {
    const li = (2 * p) * ROWS + r, ri = (2 * p + 1) * ROWS + r, a = g[li], b = g[ri];
    if (a === EGG || b === EGG || a === STONE || b === STONE) continue;
    let s = -1;
    if (a === b && a !== PEARL) s = a;
    else if (a === PEARL && b === PEARL) s = 5;
    else if (a === PEARL) s = b; else if (b === PEARL) s = a;
    if (s >= 0) out.push({ p, r, li, ri, s, x: payOf(s) * (fs ? P.fsMult : 1), jp: s >= 6 });
  }
  return out;
}
function spin(o) {
  const g = []; for (let i = 0; i < N; i++) g.push(draw(o.fs));
  const steps = [{ k: 'init', grid: g.slice() }];
  let total = 0, rounds = 0;
  while (rounds < 40) {
    const fits = fitsOf(g, o.fs);
    if (!fits.length) break;
    const rem = new Set();
    fits.forEach((f) => { total += f.x; rem.add(f.li); rem.add(f.ri); });
    for (let c = 0; c < COLS; c++) {
      const keep = []; for (let r = 0; r < ROWS; r++) { const j = c * ROWS + r; if (!rem.has(j)) keep.push(g[j]); }
      const miss = ROWS - keep.length;
      for (let r = 0; r < ROWS; r++) g[c * ROWS + r] = r < miss ? draw(o.fs) : keep[r - miss];
    }
    steps.push({ k: 'fuse', fits, rem: [...rem], after: g.slice() });
    rounds++;
  }
  let eggs = 0; g.forEach((v) => { if (v === EGG) eggs++; });
  return { steps, total, eggs };
}
/* ===END ENGINE */

const DID = ['dg0', 'dg1', 'dg2', 'dg3', 'dg4', 'dg5', 'dg6', 'dg7', 'dg8'];
const DNAME = ['Dragon vert', 'Dragon bleu', 'Dragon rouge', 'Dragon violet', 'Dragon noir', 'Dragon blanc', 'Dragon de bronze MINI', 'Dragon d’argent MAJEUR', 'Dragon d’or JACKPOT'];
const FIRE = [['#4ade80', '#bbf7d0'], ['#60a5fa', '#bfdbfe'], ['#f97316', '#fde047'], ['#c084fc', '#e9d5ff'], ['#ef4444', '#1f2937'], ['#e0f2fe', '#22d3ee'], ['#fb923c', '#fde68a'], ['#93c5fd', '#f1f5f9'], ['#fde047', '#fff7c2']];
const BUY_FS = 59;
const WORDS = ['FUSION !', 'DOUBLE FUSION !', 'RUGISSEMENT !', 'TEMPÊTE DE FEU !', 'DRAGONS DÉCHAÎNÉS !'];
const half = (id, side) => `<svg viewBox="${side ? 64 : 0} -8 64 76" preserveAspectRatio="${side ? 'xMinYMid' : 'xMaxYMid'} meet" aria-hidden="true"><use href="#${id}" width="128" height="76" y="-8"/></svg>`;
const full = (id) => `<svg viewBox="0 -8 128 76" aria-hidden="true"><use href="#${id}" width="128" height="76" y="-8"/></svg>`;
function cellArt(v, i) {
  if (v === EGG) return art('dge');
  if (v === STONE) return art('dgs');
  return half(v === PEARL ? 'dgj' : DID[v], Math.floor(i / ROWS) % 2);
}

class DragonsGame extends BaseGame {
  constructor(root, game) {
    super(root, game, {
      music: EXTRA_THEMES.dragons,
      frameCls: 'dg-frame',
      stage: `<div class="dg-lair"><i class="dg-glow"></i><i class="dg-embers"></i><i class="dg-gold l"></i><i class="dg-gold r"></i></div>
        <div class="dg-top"><div class="dg-jp mini"><small>MINI</small><b data-jp="0"></b></div><div class="dg-logo"><b>TÊTES</b><em>de dragon</em></div><div class="dg-jp major"><small>MAJEUR</small><b data-jp="1"></b></div></div>
        <div class="dg-grand"><small>JACKPOT</small><b data-jp="2"></b></div>
        <div class="grid-host"></div><div class="dg-word"></div>`,
      buys: [{ id: 'fs', icon: '🥚', label: `Free spins · ${FS_SPINS} tours`, desc: `Perles fréquentes, chaque dragon paie ×${P.fsMult}`, cost: (b) => b * BUY_FS }],
      hello: 'Deux moitiés de la même tête côte à côte : elles fusionnent, paient, et ça retombe',
    });
    this.grid = new SymbolGrid(this.q('.grid-host'), {
      cols: COLS, rows: ROWS, game: this, art: cellArt,
      cls: (v, i) => (Math.floor(i / ROWS) % 2 ? 'rt ' : 'lt ') + (v === EGG ? 'egg' : v === STONE ? 'stone' : v === PEARL ? 'pearl' : v >= 6 ? 'jp' : ''),
    });
    this.grid.setAll(Array.from({ length: N }, () => draw(false)));
    this.onBetChange();
  }

  onBetChange() { this.qa('[data-jp]').forEach((n) => { n.textContent = fmtC(JP[+n.dataset.jp] * this.bet); }); }

  word(t, cls = '') {
    const w = this.q('.dg-word');
    w.textContent = t; w.className = `dg-word ${cls}`;
    w.getAnimations().forEach((a) => a.cancel());
    w.animate([{ opacity: 0, transform: 'translate(-50%,-50%) scale(.3)' }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1.1)', offset: 0.25 },
      { opacity: 1, transform: 'translate(-50%,-50%) scale(1)', offset: 0.7 }, { opacity: 0, transform: 'translate(-50%,-62%) scale(1.15)' }], { duration: this.turbo ? 700 : 1150, easing: 'ease-out' });
  }

  onMain() { this.round(() => this.playRound(false)); }
  async onBuy() { await this.playRound(true); }

  async playRound(buy) {
    const b = this.bet;
    if (!buy && !this.pay(b)) return;
    this.lastStake = b;
    this.setLast(0); this.winAmt.textContent = ''; this.setBanner('');
    let total = 0;
    if (buy) total = await this.freeSpins();
    else {
      const res = spin({ fs: false });
      total = Math.min(res.total * b, b * CAPX);
      await this.play(res, b, false);
      if (total > 0) { this.win(Math.round(total)); this.setLast(total); }
      if (res.eggs >= 3) {
        this.stopAuto();
        if (total > 0) await this.celebrate(Math.round(total));
        total += await this.freeSpins();
      } else if (total > 0) await this.celebrate(Math.round(total));
    }
    this.setLast(total);
    this.msg(total >= b * CAPX ? `GAIN MAXIMUM ! ${fmtC(total)}` : total > 0 ? `Total du tour : ${fmtC(total)}` : 'Aucune tête complète');
  }

  // One fused dragon: the divider fades, both cells become one big framed cell with the whole head, then it pays.
  async fuse(f, b, fs) {
    const L = this.grid.cells[f.li], Rc = this.grid.cells[f.ri];
    L.classList.add('fusing'); Rc.classList.add('fusing');
    sfx.click();
    await this.wait(320);
    const g = this.grid.el.getBoundingClientRect(), a = L.getBoundingClientRect(), z = Rc.getBoundingClientRect();
    const big = el('div', `dg-fused${f.jp ? ' jp' : ''}`, `${full(f.s === PEARL ? 'dgj' : DID[f.s])}`);
    big.style.cssText = `left:${a.left - g.left}px;top:${a.top - g.top}px;width:${z.right - a.left}px;height:${a.height}px`;
    this.grid.el.appendChild(big);
    L.classList.add('hidden'); Rc.classList.add('hidden');
    const J = FIRE[f.s], sx = (a.right + z.left) / 2, sy = a.top + a.height / 2;
    fx.burst(sx, sy, f.jp ? 40 : 22, [...J, '#fff'], f.jp ? 9 : 6);
    const amt = Math.round(f.x * b);
    fx.floatText(sx, sy - a.height * 0.3, `+${fmtC(amt)}`, f.jp ? '#fde047' : J[1], f.jp ? 30 : 24);
    this.msg(`${DNAME[f.s]}${f.s < 6 ? ` ×${POWER[f.s]}` : ''}${fs ? ` · ×${P.fsMult}` : ''} → +${fmtC(amt)}`);
    if (f.jp) { this.word(['MINI !', 'MAJEUR !', 'JACKPOT !'][f.s - 6], 'jp'); this.flash('rgba(253,224,71,.6)'); sfx.jackpot(); this.q(f.s === 8 ? '.dg-grand' : f.s === 7 ? '.dg-jp.major' : '.dg-jp.mini')?.classList.add('flash'); fx.confetti(80); }
    else sfx.win();
    return big;
  }

  async play(res, b, fs) {
    let k = 0;
    for (const st of res.steps) {
      if (this.dead) return;
      if (st.k === 'init') {
        await this.grid.dropIn(st.grid, {
          tease: (c) => { let n = 0; for (let j = 0; j < c * ROWS; j++) if (st.grid[j] === EGG) n++; return n >= 2; },
          onLand: (i, v) => { if (v === EGG) { sfx.land(); const p = center(this.grid.cells[i]); fx.burst(p.x, p.y, 10, ['#fde047', '#f59e0b'], 4); } },
        });
      } else {
        const bigs = [];
        for (const f of st.fits) { bigs.push(await this.fuse(f, b, fs)); await this.wait(this.turbo ? 120 : 260); }
        if (st.fits.length > 1 || k > 0) this.word(WORDS[Math.min(k + st.fits.length - 1, WORDS.length - 1)]);
        await this.wait(this.turbo ? 300 : 650);
        // the fused heads burst into flames and vanish, the halves above fall into the gaps
        bigs.forEach((n) => n.animate([{ transform: 'scale(1)', opacity: 1, filter: 'brightness(1)' }, { transform: 'scale(1.15)', opacity: 1, filter: 'brightness(2.2)', offset: 0.4 }, { transform: 'scale(.2)', opacity: 0 }], { duration: this.turbo ? 220 : 380, fill: 'forwards' }));
        st.fits.forEach((f) => { const p = center(this.grid.cells[f.li]); fx.burst(p.x + 20, p.y, 18, [...FIRE[f.s], '#fde047'], 7); });
        sfx.coin();
        await sleep(this.turbo ? 220 : 380);
        bigs.forEach((n) => n.remove());
        st.rem.forEach((i) => this.grid.cells[i].classList.remove('hidden', 'fusing'));
        await this.grid.cascade(st.after, new Set(st.rem));
        k++;
        await this.wait(160);
      }
    }
    this.grid.cells.forEach((c) => c.classList.remove('hidden', 'fusing'));
    this.qa('.flash').forEach((n) => n.classList.remove('flash'));
    if (res.eggs >= 3) { this.word(fs ? '+3 TOURS' : 'FREE SPINS !', 'fs'); await this.wait(900); }
  }

  async freeSpins() {
    const b = this.bet, cap = b * CAPX;
    let left = FS_SPINS, tot = 0, done = 0;
    this.lastStake = b;
    await this.featureIntro('L’ÉCLOSION', `${FS_SPINS} tours gratuits · perles fréquentes · chaque dragon paie ×${P.fsMult}`, art('dge'));
    this.slotEl.classList.add('in-free');
    while (left > 0 && tot < cap && !this.dead) {
      left--; done++;
      this.setBanner(`<b>L’ÉCLOSION</b><span class="pill">Tour ${done} / ${done + left}</span><span class="pill">Dragons ×${P.fsMult}</span><span class="pill gold">Gain ${fmtC(Math.round(tot))}</span>`);
      const res = spin({ fs: true });
      const add = Math.min(res.total * b, cap - tot);
      await this.play(res, b, true);
      tot += add;
      if (add > 0) this.win(Math.round(add), 'L’éclosion');
      this.setLast(Math.round(tot));
      if (res.eggs >= 3) left += 3;
      await this.wait(250);
    }
    this.slotEl.classList.remove('in-free');
    this.setBanner('');
    await this.celebrate(Math.round(tot), { summary: 'L’ÉCLOSION', stake: b });
    return tot;
  }

  info() {
    const rows = DID.map((id, s) => `<div class="pay-item"><div class="pay-sym svg dgp">${full(id)}</div><div class="pay-vals"><b>${DNAME[s]}</b><br><span>${s < 6 ? `Puissance ${POWER[s]} : ×${String(Math.round(POWER[s] * P.K * 1000) / 1000).replace('.', ',')} la mise` : `Jackpot : ×${JP[s - 6]} la mise`}</span></div></div>`).join('');
    return this.rules(`<h4>Têtes de dragon (gain à chaque fusion)</h4><div class="paytable">${rows}
      <div class="pay-item"><div class="pay-sym svg dgp">${full('dgj')}</div><div class="pay-vals"><b>Perle du dragon</b><br><span>Une demi-perle complète n’importe quelle demi-tête. Deux demi-perles = Dragon blanc.</span></div></div>
      <div class="pay-item"><div class="pay-sym svg">${art('dge')}</div><div class="pay-vals"><b>Œuf de dragon</b><br><span>3 ou plus quand les cascades s’arrêtent : ${FS_SPINS} free spins</span></div></div></div>
      <h4>Fusion et cascades</h4><p>Les rouleaux vont par paires : à gauche des moitiés gauches de têtes, à droite des moitiés droites. Quand les deux moitiés de la même tête sont côte à côte sur une ligne d’une paire, la séparation s’efface, les deux cases n’en font plus qu’une et le dragon paie. Il disparaît ensuite, les cases du dessus retombent, de nouvelles moitiés arrivent et chaque nouvelle tête complète paie à son tour. Les pierres ne fusionnent jamais.</p>
      <h4>L’éclosion</h4><p>3 œufs ou plus : ${FS_SPINS} tours gratuits, perles bien plus fréquentes, chaque dragon paie ×${P.fsMult}. 3 œufs de plus : +3 tours. Achat ×${BUY_FS} la mise. Gain maximum ×${CAPX.toLocaleString('fr-FR')}.</p>`);
  }
}

return { DragonsGame };
})();
