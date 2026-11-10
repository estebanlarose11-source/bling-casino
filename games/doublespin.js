// SpinBet Casino · DoubleSpinGame — loaded on demand by games/impl/index.js (index.html), after games/rltable.js.
// ---- games/impl/doublespin.js ----
__mods['games/impl/doublespin.js'] = (() => {
// La Double Bille : deux billes sur la table en 3D commune (games/rltable.js, RlTableGame, demande du propriétaire :
// toutes les roulettes comme La Roulette). La blanche paie les mises classiques ; la jaune paie son multiplicateur
// (×10 à ×100 000, tiré avant le tour) si elle rejoint la blanche sur un plein du joueur. Calcul d'origine.

const { RlTableGame, numXY } = __mods['games/impl/rltable.js'];
const { wpick } = __mods['core/base.js'];
const { NP, buildDefs, thunder } = __mods['core/roulette.js'];
const { EXTRA_THEMES } = __mods['core/music.js'];
const { sfx } = __mods['audio.js'];
const { fx, sleep, center } = __mods['fx.js'];

/* ===ENGINE (original) */
const MD = [[10, 1.898664], [15, 0.18], [20, 0.13], [25, 0.09], [50, 0.08], [75, 0.05], [100, 0.04], [150, 0.03], [200, 0.025], [300, 0.018], [500, 0.013], [750, 0.008], [1000, 0.006], [2000, 0.0035], [5000, 0.0015], [10000, 0.0007], [25000, 0.0003], [50000, 0.0001], [100000, 0.00004]];
const drawMult = () => wpick(MD);
const L = buildDefs(33);
// The yellow multiplier only pays when both balls stop on the same number and the player has a straight on it (straights ≈ 95 %).
function payOne(k, a, rw, ry, M) { const d = L.DEF[k]; if (!d) return 0; let t = 0; if (d.n.includes(rw)) t += a * (d.p + 1); if (d.n.length === 1 && d.n[0] === ry && ry === rw) t += a * M; return t; }
/* ===END ENGINE */

const FEAT = '<div class="rl-feat ds"><small>🟡 BILLE JAUNE</small><b class="rl-fm">×?</b><div class="rl-fv">Elle paie son multiplicateur si elle rejoint la blanche sur ton plein</div></div>';

class DoubleSpinGame extends RlTableGame {
  constructor(root, game) {
    super(root, game, { music: EXTRA_THEMES.doublespin, cls: 'rl-ds', hello: 'Pose tes jetons puis lance les deux billes.' }, { L, balls: 2, overlay: FEAT });
  }
  payOf(k, a, res, M) { return payOne(k, a, res.r, res.y, M || 0); }
  draw() { return { r: Math.floor(Math.random() * NP), y: Math.floor(Math.random() * NP) }; }
  async beforeSpin() {
    const M = drawMult(), box = this.q('.rl-feat'), mv = box.querySelector('.rl-fm');
    box.classList.add('rolling');
    this.flash('rgba(255,210,63,.6)'); thunder();
    const t0 = performance.now();
    while (performance.now() - t0 < (this.turbo ? 600 : 1400)) { mv.textContent = '×' + MD[Math.floor(Math.random() * MD.length)][0]; sfx.tick(); await sleep(70); if (this.dead) return M; }
    box.classList.remove('rolling');
    mv.textContent = '×' + M.toLocaleString('fr-FR');
    box.classList.toggle('big', M >= 500);
    const big = M >= 1000, p = center(box);
    fx.burst(p.x, p.y, big ? 60 : 24, ['#ffd23f', '#fff', '#f59e0b'], big ? 9 : 6);
    if (big) { this.flash('rgba(255,210,63,.8)'); fx.confetti(60); sfx.jackpot(); } else sfx.upgrade();
    await this.wait(600);
    this.tip('Rien ne va plus… deux billes !');
    return M;
  }
  winnerText(res, M) { return res.y === res.r ? `🟡 LES DEUX BILLES ENSEMBLE · ×${M.toLocaleString('fr-FR')}` : `⚪ BLANCHE ${res.r} · 🟡 JAUNE ${res.y}`; }
  showWinner(res, M) {
    super.showWinner(res, M);
    // the yellow ball's number: a gold ring on the felt
    const [x, y] = numXY(res.y);
    this.q('.rl-lk').insertAdjacentHTML('beforeend', `<g class="rl-lkn yel" transform="translate(${x} ${y})"><circle r="38" class="rl-lkring"/></g>`);
  }
  resultText(res, M, ret, tt) {
    const plein = this.lastBets?.['n' + res.y];
    const pre = res.y === res.r ? (plein ? `🟡 Les deux billes sur ton plein ! ×${M.toLocaleString('fr-FR')} · ` : '🟡 Les deux billes sur le même numéro ! ') : '';
    return pre + super.resultText(res, M, ret, tt);
  }
  async resolve(placed, res, tt, M) {
    if (res.y === res.r && placed['n' + res.y]) { this.flash('rgba(255,210,63,.8)'); fx.confetti(50); }
    return super.resolve(placed, res, tt, M);
  }
  clearFelt() { super.clearFelt(); const b = this.q('.rl-feat'); if (b) { b.classList.remove('big'); b.querySelector('.rl-fm').textContent = '×?'; } }
  info() {
    return this.rules(`<h4>Deux billes</h4><p>Roulette européenne à un zéro. Avant chaque tour, un multiplicateur de <b>×10 à ×100 000</b> est tiré pour la bille jaune.</p>
      <ul class="rules"><li>⚪ <b>Bille blanche</b> : paie toutes les mises normalement (plein 33 pour 1, cheval 17, transversale 11, carré 8, sixain 5, douzaines et colonnes 2, chances simples 1).</li>
      <li>🟡 <b>Bille jaune</b> : si elle tombe sur <b>le même numéro que la blanche</b> et que tu as un plein dessus, elle paie la mise × son multiplicateur, en plus de la blanche.</li></ul>${this.tableRules()}`);
  }
}

return { DoubleSpinGame };
})();
