// SpinBet Casino · BatailleGame — loaded on demand by games/impl/index.js (index.html), after games/bjtable.js.
// ---- games/impl/bataille.js ----
__mods['games/impl/bataille.js'] = (() => {
// La Bataille (demande du propriétaire) : la table du 21 (games/bjtable.js, BjTableGame : croupière, tapis, jetons,
// caméra, 4 boutons) avec les règles de la bataille. Une carte pour le joueur, une pour la croupière : la plus haute
// gagne (As le plus fort), gain 1 pour 1 ; égalité = la banque gagne la mise principale. Mise annexe « ÉGALITÉ »
// payée 12 pour 1. SÉRIE : 5 victoires d'affilée avec la même mise = la 5e main paie ×5 la mise (au lieu de ×2), puis
// la série repart à zéro (changer de mise la remet à zéro aussi). Simulation : node tools/sim/bataille.js
// (mise principale ≈ 96 %, dont 3,5 points de bonus de série, bonus 1 main sur 86 ; mise Égalité ≈ 96 %).

const { BjTableGame, CX } = __mods['games/impl/bjtable.js'];
const { fmtC } = __mods['core/base.js'];
const { EXTRA_THEMES } = __mods['core/music.js'];
const { sfx } = __mods['audio.js'];
const { fx, center } = __mods['fx.js'];

/* ===ENGINE */
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'], SUITS = ['♠', '♥', '♦', '♣'];
const rv = (c) => RANKS.indexOf(c.r); // 0 (2) … 12 (As)
const TIE_PAY = 12; // mise Égalité : 12 pour 1
const STREAK_N = 5, STREAK_X = 5; // 5e victoire d'affilée : la main paie ×5 la mise
/* ===END ENGINE */

const NAMES = { J: 'Valet', Q: 'Dame', K: 'Roi', A: 'As' };
const nameOf = (c) => NAMES[c.r] || c.r;
const SIDES = [{ id: 'tie', name: 'ÉGALITÉ', full: 'Égalité', sub: 'paie 12 pour 1', x: CX + 196, y: 560, r: 42, c: '#fde68a' }];
const SERIE_KEY = 'spinbet_bataille_serie';
let uid = 0;

class BatailleGame extends BjTableGame {
  constructor(root, game) {
    super(root, game, { music: EXTRA_THEMES.bataille || EXTRA_THEMES.blackjack, turbo: true, mainLabel: 'DISTRIBUER', cls: 'btl', hello: 'Pose tes jetons puis distribue : la carte la plus haute gagne.' }, {
      t1: 'LA CARTE LA PLUS HAUTE GAGNE', t2: '5 VICTOIRES D’AFFILÉE : LA 5e MAIN PAIE ×5', sides: SIDES,
      overlay: `<div class="btl-serie"><small>SÉRIE</small><div class="btl-pips">${Array.from({ length: STREAK_N }, (_, i) => `<i data-i="${i}">${i === STREAK_N - 1 ? '×5' : i + 1}</i>`).join('')}</div><em></em></div>`,
    });
    this.shoe = [];
    this.newShoe();
    this.phase = 'bet';
    this.pc = null; this.dc = null; this.res = null;
    try { const s = JSON.parse(localStorage.getItem(SERIE_KEY) || 'null'); this.serie = s && s.n > 0 && s.n < STREAK_N ? s : { n: 0, bet: 0 }; } catch { this.serie = { n: 0, bet: 0 }; }
    this.msg('Choisis un jeton et touche le cercle de mise.');
    this.renderActions();
  }

  saveSerie() { try { localStorage.setItem(SERIE_KEY, JSON.stringify(this.serie)); } catch { /* ignore */ } }
  // the series only goes on with the same main bet
  serieLive() { return this.serie.n > 0 && this.serie.bet === (this.bets.main || 0); }
  paintSerie() {
    const n = this.allOn ? STREAK_N : this.betting() && this.phase !== 'end' && !this.serieLive() ? 0 : this.serie.n;
    this.qa('.btl-pips i').forEach((p, i) => { p.classList.toggle('on', i < n); p.classList.toggle('pop', i === this.popI); });
    const e = this.q('.btl-serie em');
    if (e) e.textContent = n >= STREAK_N - 1 ? 'Prochaine victoire : ×5 la mise !' : n > 0 ? `${n} victoire${n > 1 ? 's' : ''} d’affilée` : '5 victoires d’affilée = ×5';
    this.q('.btl-serie')?.classList.toggle('hot', n >= STREAK_N - 1);
  }
  onBetsChanged() {
    if (this.serie.n > 0 && this.betting() && this.bets.main !== this.serie.bet) this.msg(`Mise changée : ta série de ${this.serie.n} repart à zéro si tu joues cette mise (reviens à ${fmtC(this.serie.bet)} pour la garder).`);
    this.paintSerie();
  }

  inPlayStake() { return this.lastStake || 0; }
  buttons() {
    if (this.phase === 'end') return [['×2', 'DOUBLER', 'x2'], ['', 'VIDER', 'clear'], ['', 'MISER', 'rebet'], ['', 'REJOUER', 'deal']];
    return [['×2', 'DOUBLER', 'x2'], ['', 'VIDER', 'clear'], ['', 'RÉPÉTER', 'repeat'], ['', 'DISTRIBUER', 'deal']];
  }
  can(k) {
    if (k === 'deal') return this.betting() && this.bets.main > 0 && this.balC() >= this.costOf();
    return this.canBetKey(k);
  }
  onButton(k) { if (k === 'deal') this.onMain(); }

  renderActions() {
    if (!this.view || !this.serie) return;
    this.paintHud();
    this.mainBtn.disabled = !this.can('deal');
    const betting = this.betting();
    this.setState(betting ? 'g' : 'o', betting ? (this.phase === 'end' ? 'NOUVELLE MAIN' : 'FAITES VOS JEUX') : this.phase === 'war' ? 'ÉGALITÉ' : 'DISTRIBUTION');
    this.paintSerie();
  }
  onMeters() { this.renderActions(); }

  newShoe() {
    this.shoe = [];
    for (let d = 0; d < 6; d++) RANKS.forEach((r) => SUITS.forEach((s) => this.shoe.push({ r, s })));
    for (let i = this.shoe.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [this.shoe[i], this.shoe[j]] = [this.shoe[j], this.shoe[i]]; }
  }
  draw() { if (this.shoe.length < 60) this.newShoe(); return { ...this.shoe.pop(), id: ++uid }; }
  clearTable() { super.clearTable(); this.popI = -1; this.pc = null; this.dc = null; this.res = null; this.sideResult('tie', '', ''); }

  onMain() {
    if (!this.betting()) return;
    const bet = this.bets.main || 0;
    if (!bet) { this.msg('Pose au moins un jeton sur le cercle de mise'); this.shake(this.q('.bjv-spot.main')); return; }
    const total = this.costOf();
    if (this.balC() < total) { this.msg('Solde insuffisant pour ces mises'); return; }
    if (!this.pay(total)) return;
    this.lastStake = total; this.lastPay = 0;
    this.side = this.bets.tie || 0;
    if (!this.serieLive()) this.serie = { n: 0, bet };
    this.slotEl.classList.add('busy');
    this.play(bet).catch((e) => { console.error(e); this.phase = 'end'; this.slotEl.classList.remove('busy'); this.renderActions(); });
  }

  async play(bet) {
    this.newDeal();
    this.phase = 'deal';
    this.renderActions();
    this.setLast(0);
    this.msg('Distribution…');
    const hand = this.buildHand();
    this.placeHands(1);
    await this.wait(300);
    this.pc = this.draw(); await this.deal(hand, this.pc);
    this.bubble(hand.querySelector('.bjv-bub'), nameOf(this.pc));
    this.layout(hand);
    this.dc = this.draw();
    const dEl = await this.deal(this.dealerRow(), this.dc, true, 'd');
    if (this.dead) return;
    // suspense, then the croupière turns her card over
    await this.wait(this.serie.n >= STREAK_N - 1 ? 900 : 380);
    this.dealerDo('flip', 600);
    await this.wait(200);
    dEl.classList.remove('down');
    sfx.click();
    this.bubble(this.q('.bjv-bub.d'), nameOf(this.dc));
    this.layout(this.dealerRow());
    await this.wait(420);
    this.settle(bet, hand);
  }

  async settle(bet, hand) {
    const p = rv(this.pc), d = rv(this.dc);
    let pay = 0, res, big = false, prevN = this.serie.n;
    if (p > d) {
      this.serie.n++;
      if (this.serie.n >= STREAK_N) { pay = bet * STREAK_X; big = true; res = { k: 'win bj', t: `SÉRIE ×${STREAK_X} !<small>+${fmtC(pay - bet)}</small>` }; }
      else { pay = bet * 2; res = { k: 'win', t: `GAGNÉ<small>+${fmtC(bet)}</small>` }; }
    } else if (p === d) res = { k: 'lose', t: 'ÉGALITÉ<small>la banque gagne</small>' };
    else res = { k: 'lose', t: 'PERDU' };
    if (p <= d) this.serie.n = 0;
    let sidePay = 0;
    if (this.side) {
      sidePay = p === d ? this.side * (TIE_PAY + 1) : 0;
      this.sideResult('tie', sidePay ? 'win' : 'lose', sidePay ? `+${fmtC(sidePay)}<small>Égalité 12:1</small>` : 'PERDU<small>pas d’égalité</small>');
      if (sidePay) { const c = center(this.q('.bjv-spot[data-t="tie"]')); fx.burst(c.x, c.y, 24, ['#fde047', '#4ade80', '#fff'], 7); sfx.coin(); }
    }
    this.result(hand.querySelector('.bjv-res'), res.k, res.t);
    this.bubble(hand.querySelector('.bjv-bub'), nameOf(this.pc), p > d ? 'bj' : p < d ? 'bust' : '');
    this.layout(hand);
    const total = pay + sidePay, net = total - this.lastStake;
    this.lastPay = total;
    this.phase = 'end';
    this.view.classList.add('done');
    this.popI = p > d ? Math.min(this.serie.n, STREAK_N) - 1 : -1;
    if (big) { this.serie.n = 0; this.allOn = true; }
    this.saveSerie();
    this.renderActions();
    if (pay) { const c = center(hand.querySelector('.bjv-res') || hand); fx.burst(c.x, c.y, big ? 60 : 24, ['#fde047', '#4ade80', '#fff'], 8); }
    if (total > 0) this.win(total, big ? 'Série ×5' : null);
    this.setLast(total);
    if (big) {
      this.flash('rgba(253,224,71,.6)');
      fx.confetti(80); sfx.bigWin();
      this.dealerDo('happy', 1600);
      this.msg(`🔥 5 victoires d’affilée : ta mise paie ×${STREAK_X} ! Tu gagnes ${fmtC(net)}. Nouvelle série !`);
      setTimeout(() => { this.allOn = false; this.popI = -1; if (!this.dead) this.paintSerie(); }, 2600);
    } else {
      const tail = p > d ? (this.serie.n === STREAK_N - 1 ? ' Encore une victoire et la mise paie ×5 !' : ` Série : ${this.serie.n}/${STREAK_N}.`) : prevN >= 2 ? ` Ta série de ${prevN} s’arrête.` : '';
      this.msg(`${p > d ? `${nameOf(this.pc)} contre ${nameOf(this.dc)} : tu gagnes ${fmtC(net)} !` : p === d ? `Égalité (${nameOf(this.pc)}) : la banque gagne${sidePay ? `, mais ta mise Égalité paie ${fmtC(sidePay)} !` : '.'}` : `${nameOf(this.pc)} contre ${nameOf(this.dc)} : perdu.`}${tail}`);
      if (net > 0) { sfx.win(); this.dealerDo('happy', 1400); } else sfx.reelStop(0);
    }
    if (total > 0 && total >= this.lastStake * 10) await this.celebrate(total, { stake: this.lastStake });
    this.slotEl.classList.remove('busy');
    this.renderActions();
  }

  info() {
    return this.rules(`<h4>Règles</h4><ul class="rules"><li>Sabot de 6 jeux, mélangé quand il reste moins de 60 cartes.</li><li>Tu reçois une carte, la croupière aussi : <b>la carte la plus haute gagne</b>. Ordre : 2, 3 … 10, Valet, Dame, Roi, <b>As</b> (le plus fort). Les couleurs ne comptent pas.</li><li>Victoire : <b>1 pour 1</b> (ta mise doublée). Égalité : la banque gagne la mise du cercle.</li><li><b>SÉRIE</b> : gagne <b>5 mains d’affilée</b> avec la même mise et la 5e main paie <b>×5 ta mise</b> au lieu de ×2. Puis la série repart à zéro. Une défaite, une égalité ou un changement de mise la remet à zéro.</li><li>Mise annexe <b>ÉGALITÉ</b> (cercle de droite) : si les deux cartes ont la même valeur, elle paie <b>12 pour 1</b>.</li><li><b>Miser</b> : touche un jeton sur le tapis pour le poser sur le cercle (touche un cercle pour y poser le jeton choisi). <b>Doubler</b> double tes mises, <b>Vider</b> reprend tes jetons, <b>Répéter</b> remet les mises de la main d’avant.</li></ul>`);
  }
}

return { BatailleGame };
})();
