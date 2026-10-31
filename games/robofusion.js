// SpinBet Casino · RoboFusionGame — loaded on demand by games/impl/index.js (index.html).
// ---- games/impl/robofusion.js ----
__mods['games/impl/robofusion.js'] = (() => {
// Robo Fusion: 3 pairs of reels × 3 rows in a neon robot workshop. Left reels carry left halves of robots, right reels
// right halves; when both halves of the same robot stop side by side in a pair they slide together, get welded and
// pay the robot's power. Joker chip halves complete any half; 3+ batteries start free spins. RTP ≈ 92 %, buy ≈ 88 %.

const { BaseGame, fmtC, art } = __mods['core/base.js'];
const { Reels } = __mods['core/reels.js'];
const { EXTRA_THEMES } = __mods['core/music.js'];
const { sfx } = __mods['audio.js'];
const { fx, sleep, center } = __mods['fx.js'];

/* ===ENGINE */
// 3 pairs of reels × 4 rows. Left reels show left halves of robots, right reels right halves; a left and a right half
// of the same robot side by side in a pair assemble and pay the robot's power × the bet (× K). A joker half
// completes any half; spare parts (gears, bolts) never assemble. 3+ batteries: free spins where joker halves are more common and every robot pays double.
const PAIRS = 3, COLS = 6, ROWS = 3, N = 18, JOKER = 9, BATT = 10, PARTS = 11, CAPX = 5000, FS_SPINS = 8;
const POWER = [2, 5, 10, 20, 50, 100], JP = [10, 50, 500]; // robots 6, 7, 8 are MINI, MAJEUR, JACKPOT (× the bet)
const P = {
  w: [30, 25, 20, 14, 8, 4, 1.4, 0.4, 0.05], joker: 1.2, jokerFS: 8, batt: 4.2, parts: 120, partsFS: 0.6, K: 0.175, fsMult: 3,
};
function draw(fs) {
  const wj = fs ? P.jokerFS : P.joker, wb = fs ? P.batt * 0.6 : P.batt;
  const wp = P.parts * (fs ? P.partsFS : 1);
  let t = wj + wb + wp; for (const x of P.w) t += x;
  let r = Math.random() * t;
  if (r < wp) return PARTS; r -= wp;
  if (r < wj) return JOKER; r -= wj;
  if (r < wb) return BATT; r -= wb;
  for (let i = 0; i < P.w.length; i++) { if (r < P.w[i]) return i; r -= P.w[i]; }
  return 0;
}
const payOf = (s) => (s < 6 ? POWER[s] * P.K : JP[s - 6]);
function spin(o) {
  const g = []; for (let i = 0; i < N; i++) g.push(draw(o.fs));
  const fits = [];
  let total = 0, batt = 0;
  g.forEach((v) => { if (v === BATT) batt++; });
  for (let p = 0; p < PAIRS; p++) for (let r = 0; r < ROWS; r++) {
    const li = (2 * p) * ROWS + r, ri = (2 * p + 1) * ROWS + r, a = g[li], b = g[ri];
    if (a === BATT || b === BATT || a === PARTS || b === PARTS) continue;
    let s = -1;
    if (a === b && a !== JOKER) s = a;
    else if (a === JOKER && b === JOKER) s = 5;
    else if (a === JOKER) s = b; else if (b === JOKER) s = a;
    if (s < 0) continue;
    const x = payOf(s) * (o.fs ? P.fsMult : 1);
    total += x; fits.push({ p, r, li, ri, s, x, jp: s >= 6 });
  }
  return { g, fits, total, batt };
}
/* ===END ENGINE */

const RIGHT = 100; // reel values carry their side: v (left half) or RIGHT + v (right half)
const RID = ['rf0', 'rf1', 'rf2', 'rf3', 'rf4', 'rf5', 'rf6', 'rf7', 'rf8'];
const RNAME = ['Bip', 'Rouge', 'Pixel', 'Mécano', 'Vert-de-gris', 'Néon', 'MINI', 'MAJEUR', 'JACKPOT'];
const BUY_FS = 67;
const SPARK = ['#fde047', '#fb923c', '#fff', '#22d3ee'];
const half = (id, side) => `<svg viewBox="${side ? 64 : 0} -6 64 70" preserveAspectRatio="${side ? 'xMinYMid' : 'xMaxYMid'} meet" aria-hidden="true"><use href="#${id}" width="128" height="70" y="-6"/></svg>`;
function cellArt(code) {
  const side = code >= RIGHT ? 1 : 0, v = code % RIGHT;
  if (v === BATT) return art('rfb');
  if (v === PARTS) return art('rfp');
  return half(v === JOKER ? 'rfj' : RID[v], side);
}
const encode = (g) => g.map((v, i) => (Math.floor(i / ROWS) % 2 ? RIGHT + v : v));

class RoboFusionGame extends BaseGame {
  constructor(root, game) {
    super(root, game, {
      music: EXTRA_THEMES.robofusion,
      frameCls: 'rf-frame',
      stage: `<div class="rf-shop"><i class="rf-belt"></i><i class="rf-arm l"></i><i class="rf-arm r"></i><i class="rf-grid"></i></div>
        <div class="rf-top"><div class="rf-jp mini"><small>MINI</small><b data-jp="0"></b></div><div class="rf-logo"><b>ROBO</b><em>FUSION</em></div><div class="rf-jp major"><small>MAJEUR</small><b data-jp="1"></b></div></div>
        <div class="rf-grand"><small>JACKPOT</small><b data-jp="2"></b></div>
        <div class="reels-host"></div><div class="rf-word"></div>`,
      buys: [{ id: 'fs', icon: '🔋', label: `Free spins · ${FS_SPINS} tours`, desc: `Jokers fréquents, chaque robot paie ×${P.fsMult}`, cost: (b) => b * BUY_FS }],
      hello: 'Deux moitiés du même robot côte à côte = il est assemblé et paie sa puissance',
    });
    this.reels = new Reels(this.q('.reels-host'), {
      cols: COLS, rows: ROWS, game: this,
      random: (c) => (c % 2 ? RIGHT : 0) + draw(this.inFree),
      art: (v) => cellArt(v),
      cls: (v) => { const x = v % RIGHT; return (v >= RIGHT ? 'rt ' : 'lt ') + (x === BATT ? 'batt' : x === PARTS ? 'parts' : x === JOKER ? 'joker' : x >= 6 ? 'jp' : ''); },
    });
    this.reels.setAll(encode(Array.from({ length: N }, () => draw(false))));
    this.onBetChange();
  }

  onBetChange() { this.qa('[data-jp]').forEach((n) => { n.textContent = fmtC(JP[+n.dataset.jp] * this.bet); }); }

  word(t, cls = '') {
    const w = this.q('.rf-word');
    w.textContent = t; w.className = `rf-word ${cls}`;
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
      await this.show(res, b, false);
      if (total > 0) { this.win(Math.round(total)); this.setLast(total); }
      if (res.batt >= 3) {
        this.stopAuto();
        if (total > 0) await this.celebrate(Math.round(total));
        total += await this.freeSpins();
      } else if (total > 0) await this.celebrate(Math.round(total));
    }
    this.setLast(total);
    this.msg(total >= b * CAPX ? `GAIN MAXIMUM ! ${fmtC(total)}` : total > 0 ? `Total du tour : ${fmtC(total)}` : 'Aucun robot assemblé');
  }

  async show(res, b, fs) {
    await this.reels.spin(encode(res.g), {
      tease: (c, vals) => { let k = 0; for (let j = 0; j < c * ROWS; j++) if (vals[j] % RIGHT === BATT) k++; return k >= 2; },
      onStop: (c) => { for (let r = 0; r < ROWS; r++) if (res.g[c * ROWS + r] === BATT) { sfx.land(); const p = center(this.reels.cell(c * ROWS + r)); fx.burst(p.x, p.y, 10, ['#22d3ee', '#fde047'], 4); } },
    });
    if (this.dead) return;
    // the assemblies, one after the other: halves slide together, weld sparks along the seam, eyes light up
    for (const f of res.fits) {
      if (this.dead) return;
      const L = this.reels.cell(f.li), Rc = this.reels.cell(f.ri);
      L.classList.add('fuse'); Rc.classList.add('fuse');
      sfx.click();
      await this.wait(260);
      const a = L.getBoundingClientRect(), z = Rc.getBoundingClientRect(), sx = (a.right + z.left) / 2;
      for (let k = 0; k < 4; k++) { fx.burst(sx, a.top + (a.height * (k + 0.5)) / 4, 8, SPARK, 4); sfx.tick(); await sleep(this.turbo ? 25 : 60); }
      L.classList.add('fused'); Rc.classList.add('fused');
      const amt = Math.round(f.x * b);
      this.floatAt(L, `+${fmtC(amt)}`, f.jp ? '#fde047' : '#a5f3fc', f.jp ? 30 : 22);
      const nm = f.s >= 6 ? `${RNAME[f.s]} !` : `${RNAME[f.s]} ×${POWER[f.s]}`;
      this.msg(`Robot assemblé : ${nm}${fs ? ` · ×${P.fsMult}` : ''} → +${fmtC(amt)}`);
      if (f.jp) { this.word(RNAME[f.s] + ' !', 'jp'); this.flash('rgba(253,224,71,.6)'); sfx.jackpot(); this.q(f.s === 8 ? '.rf-grand' : f.s === 7 ? '.rf-jp.major' : '.rf-jp.mini')?.classList.add('flash'); fx.confetti(80); await this.wait(900); }
      else sfx.win();
      await this.wait(this.turbo ? 200 : 420);
    }
    if (res.fits.length >= 3) this.word(res.fits.length >= 5 ? 'MÉGA USINE !' : 'FUSION !');
    if (res.fits.length) await this.wait(700);
    this.reels.el.querySelectorAll('.fuse, .fused').forEach((n) => n.classList.remove('fuse', 'fused'));
    this.qa('.flash').forEach((n) => n.classList.remove('flash'));
    if (res.batt >= 3) { this.word(fs ? '+3 TOURS' : 'FREE SPINS !', 'fs'); await this.wait(900); }
  }

  async freeSpins() {
    const b = this.bet, cap = b * CAPX;
    let left = FS_SPINS, tot = 0, done = 0;
    this.lastStake = b;
    await this.featureIntro('FREE SPINS', `${FS_SPINS} tours gratuits · jokers fréquents · chaque robot paie ×${P.fsMult}`, art('rfb'));
    this.inFree = true;
    this.slotEl.classList.add('in-free');
    while (left > 0 && tot < cap && !this.dead) {
      left--; done++;
      this.setBanner(`<b>FREE SPINS</b><span class="pill">Tour ${done} / ${done + left}</span><span class="pill">Robots ×${P.fsMult}</span><span class="pill gold">Gain ${fmtC(Math.round(tot))}</span>`);
      const res = spin({ fs: true });
      const add = Math.min(res.total * b, cap - tot);
      await this.show(res, b, true);
      tot += add;
      if (add > 0) this.win(Math.round(add), 'Free spins');
      this.setLast(Math.round(tot));
      if (res.batt >= 3) left += 3;
      await this.wait(250);
    }
    this.inFree = false;
    this.slotEl.classList.remove('in-free');
    this.setBanner('');
    await this.celebrate(Math.round(tot), { summary: 'FREE SPINS', stake: b });
    return tot;
  }

  info() {
    const full = (id) => `<svg viewBox="0 -6 128 70" aria-hidden="true"><use href="#${id}" width="128" height="70" y="-6"/></svg>`;
    const rows = RID.map((id, s) => `<div class="pay-item"><div class="pay-sym svg rfp">${full(id)}</div><div class="pay-vals"><b>${RNAME[s]}</b><br><span>${s < 6 ? `Puissance ${POWER[s]} : ×${String(Math.round(POWER[s] * P.K * 100) / 100).replace('.', ',')} la mise` : `Jackpot ${RNAME[s]} : ×${JP[s - 6]} la mise`}</span></div></div>`).join('');
    return this.rules(`<h4>Robots (gain quand il est assemblé)</h4><div class="paytable">${rows}
      <div class="pay-item"><div class="pay-sym svg rfp">${full('rfj')}</div><div class="pay-vals"><b>Puce joker</b><br><span>Une demi-puce complète n’importe quelle moitié de robot. Deux demi-puces = robot Néon.</span></div></div>
      <div class="pay-item"><div class="pay-sym svg">${art('rfb')}</div><div class="pay-vals"><b>Batterie</b><br><span>3 ou plus : ${FS_SPINS} free spins</span></div></div></div>
      <h4>Assemblage</h4><p>Les rouleaux vont par paires. Le rouleau de gauche porte des moitiés gauches de robots, celui de droite des moitiés droites. Quand les deux moitiés du même robot s’arrêtent sur la même ligne d’une paire, il est assemblé et paie. 3 paires × 3 lignes = jusqu’à 9 robots par tour. Les pièces détachées ne s’assemblent jamais.</p>
      <h4>Free spins</h4><p>3 batteries ou plus : ${FS_SPINS} tours gratuits, jokers bien plus fréquents, chaque robot paie ×${P.fsMult}. 3 batteries de plus : +3 tours. Achat ×${BUY_FS} la mise. Gain maximum ×${CAPX.toLocaleString('fr-FR')}.</p>`);
  }
}

return { RoboFusionGame };
})();
