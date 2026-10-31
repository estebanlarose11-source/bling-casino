// SpinBet Casino · DoubleSpinGame — loaded on demand by games/impl/index.js (index.html).
// ---- games/impl/doublespin.js ----
__mods['games/impl/doublespin.js'] = (() => {
// Double Spin, rebuilt on the shared cabinet. Two balls; the yellow one pays a multiplier on straight bets (original math).

const { BaseGame, fmtC, wpick } = __mods['core/base.js'];
const { ORDER, NP, colr, buildDefs, tableHTML, wheelSVG, spinBalls, thunder, ballTick, BetBoard } = __mods['core/roulette.js'];
const { EXTRA_THEMES } = __mods['core/music.js'];
const { sfx } = __mods['audio.js'];
const { fx, sleep, center } = __mods['fx.js'];

/* ===ENGINE (original) */
const MD = [[10, 1.898664], [15, 0.18], [20, 0.13], [25, 0.09], [50, 0.08], [75, 0.05], [100, 0.04], [150, 0.03], [200, 0.025], [300, 0.018], [500, 0.013], [750, 0.008], [1000, 0.006], [2000, 0.0035], [5000, 0.0015], [10000, 0.0007], [25000, 0.0003], [50000, 0.0001], [100000, 0.00004]];
const drawMult = () => wpick(MD);
const L = buildDefs(33);
// The yellow multiplier only pays when both balls stop on the same number and the player has a straight on it (straights ≈ 95 %).
function settle(bs, rw, ry, M) { let t = 0; for (const k in bs) { const d = L.DEF[k]; if (d.n.includes(rw)) t += bs[k] * (d.p + 1); if (d.n.length === 1 && d.n[0] === ry && ry === rw) t += bs[k] * M; } return t; }
/* ===END ENGINE */

const name = (n) => `${n} (${colr(n) === 'g' ? 'zéro' : colr(n) === 'r' ? 'rouge' : 'noir'})`;

class DoubleSpinGame extends BaseGame {
  constructor(root, game) {
    super(root, game, {
      music: EXTRA_THEMES.doublespin, stepper: false, autoplay: false, mainLabel: 'LANCER', betLabel: 'Mise totale',
      cls: 'table-game',
      head: '<div class="head-meters"><div class="meter ymult"><small>Bille jaune</small><b>×?</b></div></div><div class="hist pairs"></div>',
      stage: `<div class="wheel-zone"><svg class="rwheel" viewBox="0 0 300 300">${wheelSVG(2)}</svg><div class="rres"></div><div class="rres y"></div><div class="bolt-bar">⚪ La blanche paie les mises classiques · 🟡 la jaune paie son multiplicateur si elle rejoint la blanche sur ton plein</div></div>`,
      below: `<div class="felt">${tableHTML(L)}${BetBoard.chipsHTML()}</div>`,
      hello: 'Pose tes jetons puis lance les deux billes.',
    });
    this.wstate = { wcur: 0 };
    this.board = new BetBoard(this, this.q('.felt'), L);
    this.board.paint();
    this.histArr = [];
  }

  stakeLabel() { return this.board ? this.board.total() : 0; }
  chipSound() { sfx.click(); }
  onMeters() { if (this.mainBtn) this.mainBtn.disabled = this.busy || !this.board?.total(); }

  async revealMult(M) {
    const box = this.q('.ymult'), mv = box.querySelector('b');
    box.classList.add('rolling');
    this.flash('rgba(255,210,63,.6)'); thunder();
    const t0 = performance.now();
    while (performance.now() - t0 < (this.turbo ? 600 : 1500)) {
      mv.textContent = '×' + MD[Math.floor(Math.random() * MD.length)][0];
      sfx.tick();
      await sleep(70);
    }
    box.classList.remove('rolling');
    mv.textContent = '×' + M;
    this.board.root && this.board.paint();
    const big = M >= 1000;
    if (M >= 100000) { this.msg('🟡 ×100 000 ! Le multiplicateur maximum !'); fx.coins(120); }
    box.classList.toggle('big', M >= 500);
    const p = center(box);
    fx.burst(p.x, p.y, big ? 60 : 24, ['#ffd23f', '#fff', '#f59e0b'], big ? 9 : 6);
    if (big) { this.flash('rgba(255,210,63,.8)'); fx.confetti(60); sfx.jackpot(); } else sfx.upgrade();
    await this.wait(800);
  }

  histAdd(w, y) {
    this.histArr.unshift([w, y]);
    this.histArr = this.histArr.slice(0, 10);
    this.q('.hist').innerHTML = this.histArr.map(([a, b]) => `<span class="pair"><span class="${colr(a)}">${a}</span><span class="y">${b}</span></span>`).join('');
  }

  onMain() {
    if (!this.board.total()) return;
    this.round(async () => {
      const placed = { ...this.board.bets }, tt = this.board.total();
      if (!this.pay(tt)) return;
      this.lastStake = tt;
      this.board.last = placed;
      this.focusStage();
      this.setLast(0); this.winAmt.textContent = '';
      this.qa('.rres').forEach((e) => e.classList.remove('on'));
      this.qa('.rt-c.hit, .rt-c.yel').forEach((e) => e.classList.remove('hit', 'yel'));
      this.msg('Le multiplicateur de la bille jaune est tiré…');
      const M = drawMult();
      await this.revealMult(M);
      this.msg('Rien ne va plus… deux billes !');
      const rw = Math.floor(Math.random() * NP), ry = Math.floor(Math.random() * NP);
      await spinBalls(this.q('.rwheel'), this.wstate, [ORDER.indexOf(rw), ORDER.indexOf(ry)], { turbo: this.turbo, tick: ballTick });
      const [w1, y1] = this.qa('.rres');
      w1.textContent = rw; w1.className = 'rres on ' + colr(rw);
      y1.textContent = ry; y1.className = 'rres y on';
      this.histAdd(rw, ry);
      this.board.els['n' + rw]?.classList.add('hit');
      const ye = this.board.els['n' + ry];
      ye?.classList.add('yel');
      const ret = settle(placed, rw, ry, M), net = ret - tt;
      let m = `⚪ ${name(rw)} · 🟡 ${name(ry)} ×${M}`;
      if (placed['n' + ry] && ry === rw) m += ` · les deux billes sur ton plein ! +${fmtC(placed['n' + ry] * M)}`;
      else if (ry === rw) m += ' · les deux billes sur le même numéro !';
      m += ' · ' + (net > 0 ? `Tu gagnes ${fmtC(net)}` : net < 0 ? `Tu perds ${fmtC(-net)}` : 'Mise rendue');
      this.msg(m);
      if (ret > 0) {
        this.win(ret);
        this.setLast(ret);
        if (placed['n' + ry] && ry === rw && ye) { const p = center(ye); fx.burst(p.x, p.y, 50, ['#ffd23f', '#fff'], 9); this.flash('rgba(255,210,63,.8)'); }
        if (net > 0) await this.celebrate(ret);
      }
      this.board.afterRound();
    });
  }

  info() {
    return this.rules(`<h4>Deux billes</h4><p>Roulette européenne à un zéro. Avant chaque tour, un multiplicateur de <b>×10 à ×100 000</b> est tiré pour la bille jaune.</p>
      <ul class="rules"><li>⚪ <b>Bille blanche</b> : paie toutes les mises normalement (plein 33 pour 1, cheval 17, transversale 11, carré 8, sixain 5, douzaines et colonnes 2, chances simples 1).</li>
      <li>🟡 <b>Bille jaune</b> : si elle tombe sur <b>le même numéro que la blanche</b> et que tu as un plein dessus, elle paie la mise × son multiplicateur, en plus de la blanche.</li></ul>
`);
  }
}

return { DoubleSpinGame };
})();
