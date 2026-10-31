// SpinBet Casino · StormGame — loaded on demand by games/impl/index.js (index.html).
// ---- games/impl/storm.js ----
__mods['games/impl/storm.js'] = (() => {
// Lightning Storm, rebuilt on the shared cabinet. Lightning odds and payouts are the original game's.

const { BaseGame, fmtC, wpick } = __mods['core/base.js'];
const { ORDER, NP, colr, buildDefs, tableHTML, wheelSVG, spinBalls, thunder, ballTick, BetBoard } = __mods['core/roulette.js'];
const { EXTRA_THEMES } = __mods['core/music.js'];
const { sfx } = __mods['audio.js'];
const { fx, center } = __mods['fx.js'];

/* ===ENGINE (original) */
const ND = [[1, 0.12], [2, 0.22], [3, 0.30], [4, 0.22], [5, 0.14]];
const MD = [[50, 0.919307], [100, 0.140926], [150, 0.075], [200, 0.045], [250, 0.028], [300, 0.015], [400, 0.01], [500, 0.008], [1000, 0.004], [2000, 0.0015], [5000, 0.0006], [10000, 0.0002], [20000, 0.00008], [50000, 0.00002]];
function drawLucky() { const n = wpick(ND), pool = [...Array(NP).keys()], res = {}; for (let j = 0; j < n; j++) { const k = Math.floor(Math.random() * pool.length), num = pool.splice(k, 1)[0]; res[num] = wpick(MD); } return res; }
const L = buildDefs(29);
function settle(bs, r, lucky) { let t = 0; for (const k in bs) { const d = L.DEF[k]; if (!d.n.includes(r)) continue; t += (d.n.length === 1 && d.p === 29 && lucky[r]) ? bs[k] * (lucky[r] + 1) : bs[k] * (d.p + 1); } return t; }
/* ===END ENGINE */

class StormGame extends BaseGame {
  constructor(root, game) {
    super(root, game, {
      music: EXTRA_THEMES.storm, stepper: false, autoplay: false, mainLabel: 'LANCER', betLabel: 'Mise totale',
      cls: 'table-game',
      head: '<div class="hist"></div>',
      stage: `<div class="wheel-zone"><svg class="rwheel" viewBox="0 0 300 300">${wheelSVG(1)}</svg><div class="rres"></div><div class="bolt-bar">⚡ Avant chaque tour, la foudre frappe 1 à 5 numéros chanceux</div></div>`,
      below: `<div class="felt">${tableHTML(L)}${BetBoard.chipsHTML()}</div>`,
      hello: 'Pose tes jetons sur le tapis puis lance la bille.',
    });
    this.wstate = { wcur: 0 };
    this.board = new BetBoard(this, this.q('.felt'), L);
    this.board.paint();
    this.histArr = [];
    this.lucky = {};
  }

  stakeLabel() { return this.board ? this.board.total() : 0; }
  chipSound() { sfx.click(); }
  onMeters() { if (this.mainBtn) this.mainBtn.disabled = this.busy || !this.board?.total(); }

  clearLucky() { this.qa('.rt-c.lucky').forEach((e) => { e.classList.remove('lucky'); e.querySelector('.lm')?.remove(); }); this.lucky = {}; }

  async strike(lucky) {
    const nums = Object.keys(lucky).map(Number).sort((a, b) => a - b);
    this.q('.bolt-bar').textContent = '⚡ Les éclairs frappent…';
    this.slotEl.classList.add('storming');
    this.flash('rgba(160,200,255,.85)'); thunder();
    await this.wait(500);
    for (const n of nums) {
      const e = this.board.els['n' + n];
      if (e) {
        e.classList.add('lucky');
        const lm = document.createElement('b'); lm.className = 'lm'; lm.textContent = '×' + lucky[n]; e.appendChild(lm);
        const p = center(e);
        for (let k = 0; k < 3; k++) fx.burst(p.x, p.y, 14, ['#fff', '#9fd4ff', '#ffe14a'], 7);
        this.boltTo(e);
        if (lucky[n] >= 500) this.flash('rgba(255,230,120,.7)');
      }
      thunder();
      await this.wait(480);
    }
    this.slotEl.classList.remove('storming');
    this.q('.bolt-bar').innerHTML = '⚡ ' + nums.map((n) => `<b>${n}</b> ×${lucky[n]}`).join(' · ');
  }

  boltTo(target) {
    const b = target.getBoundingClientRect();
    const bolt = document.createElement('div');
    bolt.className = 'g-bolt g-overlay';
    const x = b.left + b.width / 2;
    let d = `M ${x + (Math.random() - 0.5) * 120} 0`;
    const steps = 9;
    for (let i = 1; i <= steps; i++) d += ` L ${x + (Math.random() - 0.5) * 60 * (1 - i / steps)} ${(b.top + b.height / 2) * (i / steps)}`;
    bolt.innerHTML = `<svg width="100%" height="100%"><path d="${d}" stroke="#fff" stroke-width="4" fill="none" filter="drop-shadow(0 0 8px #9fd4ff)"/><path d="${d}" stroke="#9fd4ff" stroke-width="9" fill="none" opacity=".35"/></svg>`;
    document.body.appendChild(bolt);
    setTimeout(() => bolt.remove(), 380);
  }

  histAdd(n) {
    this.histArr.unshift(n);
    this.histArr = this.histArr.slice(0, 14);
    this.q('.hist').innerHTML = this.histArr.map((x) => `<span class="${colr(x)}">${x}</span>`).join('');
  }

  onMain() {
    if (!this.board.total()) return this.msg('Pose au moins un jeton sur le tapis.');
    this.round(async () => {
      const placed = { ...this.board.bets }, tt = this.board.total();
      if (!this.pay(tt)) return;
      this.lastStake = tt;
      this.board.last = placed;
      this.focusStage();
      this.setLast(0); this.winAmt.textContent = '';
      this.q('.rres').classList.remove('on');
      this.qa('.rt-c.hit').forEach((e) => e.classList.remove('hit'));
      this.clearLucky();
      this.msg('Les éclairs arrivent…');
      const lucky = drawLucky();
      this.lucky = lucky;
      await this.strike(lucky);
      this.msg('Rien ne va plus…');
      const r = Math.floor(Math.random() * NP);
      await spinBalls(this.q('.rwheel'), this.wstate, [ORDER.indexOf(r)], { turbo: this.turbo, tick: ballTick });
      const rs = this.q('.rres');
      rs.textContent = r; rs.className = 'rres on ' + colr(r);
      this.histAdd(r);
      const he = this.board.els['n' + r];
      he?.classList.add('hit');
      const ret = settle(placed, r, lucky), net = ret - tt;
      let m = `Le <b>${r}</b> (${colr(r) === 'g' ? 'zéro' : colr(r) === 'r' ? 'rouge' : 'noir'})`;
      if (lucky[r] && placed['n' + r]) m += ` · ⚡ numéro frappé ×${lucky[r]} !`;
      else if (lucky[r]) m += ` · ⚡ numéro frappé ×${lucky[r]} (pas de plein dessus)`;
      m += ' · ' + (net > 0 ? `Tu gagnes ${fmtC(net)}` : net < 0 ? `Tu perds ${fmtC(-net)}` : 'Mise rendue');
      this.msg(m);
      if (ret > 0) {
        this.win(ret);
        this.setLast(ret);
        if (he) { const p = center(he); fx.burst(p.x, p.y, 30, ['#fde047', '#fff', '#9fd4ff'], 8); }
        if (lucky[r] && placed['n' + r]) { this.flash('rgba(255,230,120,.8)'); thunder(); }
        if (net > 0) await this.celebrate(ret);
      }
      this.board.afterRound();
    });
  }

  info() {
    return this.rules(`<h4>Roulette européenne</h4><p>Un seul zéro, 37 cases. Pose tes jetons (10 000\u00a0\uE1E0 maximum par case). Touche un numéro pour un plein, les bords et les coins pour cheval, carré ou transversale.</p>
      <ul class="rules"><li>Plein : 29 pour 1 (ou le multiplicateur de l’éclair)</li><li>Cheval : 17 · Transversale : 11 · Carré : 8 · Sixain : 5</li><li>Douzaines et colonnes : 2 · Rouge/Noir, Pair/Impair, 1-18/19-36 : 1</li></ul>
      <h4>Les éclairs</h4><p>Avant chaque tour, 1 à 5 numéros sont frappés et reçoivent un multiplicateur de <b>×50 à ×50 000</b>. Si la bille s’arrête sur un numéro frappé où tu as un plein, il paie ce multiplicateur à la place de 29 pour 1.</p>`);
  }
}

return { StormGame };
})();
