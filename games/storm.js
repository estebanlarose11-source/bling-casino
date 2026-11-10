// SpinBet Casino · StormGame — loaded on demand by games/impl/index.js (index.html), after games/rltable.js.
// ---- games/impl/storm.js ----
__mods['games/impl/storm.js'] = (() => {
// L’Éclair : la roulette éclair sur la table en 3D commune (games/rltable.js, RlTableGame, demande du propriétaire :
// toutes les roulettes comme La Roulette). Avant chaque tour, la foudre frappe 1 à 5 numéros du tapis (×50 à ×50 000).
// Cotes et paiements d'origine.

const { RlTableGame } = __mods['games/impl/rltable.js'];
const { wpick } = __mods['core/base.js'];
const { NP, buildDefs, thunder } = __mods['core/roulette.js'];
const { EXTRA_THEMES } = __mods['core/music.js'];

/* ===ENGINE (original) */
const ND = [[1, 0.12], [2, 0.22], [3, 0.30], [4, 0.22], [5, 0.14]];
const MD = [[50, 0.919307], [100, 0.140926], [150, 0.075], [200, 0.045], [250, 0.028], [300, 0.015], [400, 0.01], [500, 0.008], [1000, 0.004], [2000, 0.0015], [5000, 0.0006], [10000, 0.0002], [20000, 0.00008], [50000, 0.00002]];
function drawLucky() { const n = wpick(ND), pool = [...Array(NP).keys()], res = {}; for (let j = 0; j < n; j++) { const k = Math.floor(Math.random() * pool.length), num = pool.splice(k, 1)[0]; res[num] = wpick(MD); } return res; }
const L = buildDefs(29);
const payStorm = (k, a, r, lucky) => { const d = L.DEF[k]; if (!d || !d.n.includes(r)) return 0; return d.n.length === 1 && lucky[r] ? a * (lucky[r] + 1) : a * (d.p + 1); };
/* ===END ENGINE */

const FEAT = '<div class="rl-feat storm"><small>⚡ ÉCLAIRS</small><div class="rl-fv">Avant chaque tour, la foudre frappe 1 à 5 numéros</div></div>';

class StormGame extends RlTableGame {
  constructor(root, game) {
    super(root, game, { music: EXTRA_THEMES.storm, cls: 'rl-storm' }, { L, overlay: FEAT });
  }
  payOf(k, a, res, lucky) { return payStorm(k, a, res.r, lucky || {}); }
  // the lightning, on the felt, before the spin
  async beforeSpin() {
    const lucky = drawLucky(), nums = Object.keys(lucky).map(Number).sort((a, b) => a - b);
    await this.strike(lucky, nums, this.turbo ? 220 : 480);
    return lucky;
  }
  async strike(lucky, nums, step) {
    const fv = this.q('.rl-feat .rl-fv');
    fv.textContent = 'Les éclairs frappent…';
    this.flash('rgba(160,200,255,.85)'); thunder();
    await this.wait(400);
    for (const n of nums) {
      if (this.dead) return;
      this.markLucky(n, lucky[n]);
      if (lucky[n] >= 500) this.flash('rgba(255,230,120,.7)');
      await this.wait(step);
    }
    fv.innerHTML = nums.map((n) => `<span><b>${n}</b> ×${lucky[n]}</span>`).join('');
  }
  winnerText(res, lucky) { return lucky?.[res.r] ? `⚡ NUMÉRO FRAPPÉ ×${lucky[res.r]}` : super.winnerText(res); }
  resultText(res, lucky, ret, tt) {
    const hit = lucky?.[res.r], plein = this.lastBets?.['n' + res.r];
    return (hit ? (plein ? `⚡ Ton plein est frappé ×${hit} ! ` : `⚡ Numéro frappé ×${hit} (pas de plein dessus). `) : '') + super.resultText(res, lucky, ret, tt);
  }
  async resolve(placed, res, tt, lucky) {
    if (lucky?.[res.r] && placed['n' + res.r]) { this.flash('rgba(255,230,120,.8)'); thunder(); }
    return super.resolve(placed, res, tt, lucky);
  }
  clearFelt() { super.clearFelt(); const fv = this.q('.rl-feat .rl-fv'); if (fv) fv.textContent = 'Avant chaque tour, la foudre frappe 1 à 5 numéros'; }
  info() {
    return this.rules(`<h4>Roulette européenne éclair</h4><p>Un seul zéro, 37 cases.</p>
      <ul class="rules"><li>Plein : 29 pour 1 (ou le multiplicateur de l’éclair)</li><li>Cheval : 17 · Transversale : 11 · Carré : 8 · Sixain : 5</li><li>Douzaines et colonnes : 2 · Rouge/Noir, Pair/Impair, 1-18/19-36 : 1</li></ul>
      <h4>Les éclairs</h4><p>Avant chaque tour, 1 à 5 numéros du tapis sont frappés et reçoivent un multiplicateur de <b>×50 à ×50 000</b>. Si la bille s’arrête sur un numéro frappé où tu as un plein, il paie ce multiplicateur à la place de 29 pour 1.</p>${this.tableRules()}`);
  }
}

return { StormGame, L, payStorm, ND, MD };
})();
