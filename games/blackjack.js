// SpinBet Casino · BlackjackGame — loaded on demand by games/impl/index.js (index.html), after games/bjtable.js.
// ---- games/impl/blackjack.js ----
__mods['games/impl/blackjack.js'] = (() => {
// Le 21 : blackjack à 6 jeux, la croupière reste à 17, blackjack payé 6 pour 5. La table (croupière, tapis, jetons,
// caméra, boutons) est commune aux 3 blackjacks : games/bjtable.js (BjTableGame). Ici, seulement les règles.

const { BjTableGame, CX } = __mods['games/impl/bjtable.js'];
const { fmtC } = __mods['core/base.js'];
const { EXTRA_THEMES } = __mods['core/music.js'];
const { sfx } = __mods['audio.js'];
const { fx, center } = __mods['fx.js'];

/* ===ENGINE (original) */
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'], SUITS = ['♠', '♥', '♦', '♣'];
const cv = (c) => (c.r === 'A' ? 11 : 'JQK'.includes(c.r) || c.r === '10' ? 10 : parseInt(c.r, 10));
function score(cards) { let t = 0, a = 0; cards.forEach((c) => { t += cv(c); if (c.r === 'A') a++; }); while (t > 21 && a > 0) { t -= 10; a--; } return { t, soft: a > 0 }; }
const isBJ = (h) => h.cards.length === 2 && !h.split && score(h.cards).t === 21;
/* ===END ENGINE */

let uid = 0;
const tot = (cards) => { const sc = score(cards); return sc.t === 21 && cards.length === 2 ? '21' : `${sc.soft && sc.t < 21 ? `${sc.t - 10}/` : ''}${sc.t}`; };

class BlackjackGame extends BjTableGame {
  constructor(root, game) {
    super(root, game, { music: EXTRA_THEMES.blackjack, turbo: true, mainLabel: 'DISTRIBUER', hello: 'Choisis un jeton, pose-le sur le cercle, puis distribue.' }, {});
    this.shoe = [];
    this.newShoe();
    this.phase = 'bet';
    this.hands = []; this.dealer = []; this.act = 0; this.hole = true; this.results = [];
    this.msg('Choisis un jeton et touche le cercle de mise.');
    this.renderActions();
  }

  inPlayStake() { return this.hands.reduce((a, h) => a + h.bet, 0); }
  buttons() {
    if (this.phase === 'end') return [['×2', 'DOUBLER', 'x2'], ['', 'VIDER', 'clear'], ['', 'MISER', 'rebet'], ['', 'REJOUER', 'deal']];
    if (this.betting()) return [['×2', 'DOUBLER', 'x2'], ['', 'VIDER', 'clear'], ['', 'RÉPÉTER', 'repeat'], ['', 'DISTRIBUER', 'deal']];
    const h = this.hands[this.act];
    return [['', 'SÉPARER', 'spl'], ['', 'RESTER', 'stand'], ['', 'TIRER', 'hit'], ['', h && this.phase === 'play' && h.cards.length === 2 ? `DOUBLER<small> ${fmtC(h.bet)}</small>` : 'DOUBLER', 'dbl']];
  }
  can(k) {
    const h = this.hands[this.act], go = this.phase === 'play' && h && !h.done;
    if (k === 'deal') return this.betting() && this.bets.main > 0 && this.balC() >= this.bets.main;
    if (k === 'hit' || k === 'stand') return go;
    if (k === 'dbl') return go && h.cards.length === 2 && this.balC() >= h.bet;
    if (k === 'spl') return go && this.hands.length === 1 && h.cards.length === 2 && cv(h.cards[0]) === cv(h.cards[1]) && this.balC() >= h.bet;
    return this.canBetKey(k);
  }
  onButton(k) { if (k === 'deal') this.onMain(); else if (['hit', 'stand', 'dbl', 'spl'].includes(k)) this[k](); }

  renderActions() {
    if (!this.view || !this.hands) return;
    this.paintHud();
    this.mainBtn.disabled = !this.can('deal');
    const betting = this.betting();
    this.setState(betting ? 'g' : this.phase === 'play' ? 'r' : 'o', betting ? (this.phase === 'end' ? 'NOUVELLE MAIN' : 'FAITES VOS JEUX') : this.phase === 'play' ? 'À VOUS DE JOUER' : 'DISTRIBUTION');
  }
  onMeters() { this.renderActions(); }

  newShoe() {
    this.shoe = [];
    for (let d = 0; d < 6; d++) RANKS.forEach((r) => SUITS.forEach((s) => this.shoe.push({ r, s })));
    for (let i = this.shoe.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [this.shoe[i], this.shoe[j]] = [this.shoe[j], this.shoe[i]]; }
  }
  draw() { if (this.shoe.length < 60) this.newShoe(); return { ...this.shoe.pop(), id: ++uid }; }
  dBJ() { return this.dealer.length === 2 && score(this.dealer).t === 21; }

  clearTable() { super.clearTable(); this.hands = []; this.dealer = []; this.results = []; }

  onMain() {
    if (!this.betting()) return;
    const bet = this.bets.main || 0;
    if (!bet) { this.msg('Pose au moins un jeton sur le cercle de mise'); this.shake(this.q('.bjv-spot.main')); return; }
    if (this.balC() < bet) { this.msg('Solde insuffisant pour cette mise'); return; }
    if (!this.pay(bet)) return;
    this.lastStake = bet; this.lastPay = 0;
    this.busyHand = true;
    this.slotEl.classList.add('busy');
    this.startHand(bet);
  }

  async startHand(bet) {
    this.newDeal();
    this.results = []; this.hole = true; this.act = 0;
    this.hands = [{ cards: [], bet, done: false, split: false }];
    this.dealer = [];
    this.phase = 'deal';
    this.renderActions();
    this.msg('Distribution…');
    this.buildHand();
    this.placeHands(1);
    await this.wait(380);
    const pc = () => this.handEl(0), dc = this.dealerRow();
    let c = this.draw(); this.hands[0].cards.push(c); await this.deal(pc(), c); this.paintTotals();
    c = this.draw(); this.dealer.push(c); await this.deal(dc, c, false, 'd'); this.paintTotals();
    c = this.draw(); this.hands[0].cards.push(c); await this.deal(pc(), c); this.paintTotals();
    c = this.draw(); this.dealer.push(c); this.holeEl = await this.deal(dc, c, true, 'd'); this.paintTotals();
    this.phase = 'play';
    if (isBJ(this.hands[0]) || this.dBJ()) return this.settle();
    this.msg('À toi : tirer, rester, doubler' + (cv(this.hands[0].cards[0]) === cv(this.hands[0].cards[1]) ? ' ou séparer.' : '.'));
    this.paintTotals();
    this.renderActions();
  }

  paintTotals() {
    const ds = score(this.dealer);
    this.bubble(this.q('.bjv-bub.d'), this.dealer.length ? (this.hole ? `${cv(this.dealer[0])}` : tot(this.dealer)) : '', !this.hole && ds.t > 21 ? 'bust' : '');
    this.layout(this.dealerRow());
    this.hands.forEach((h, i) => {
      const el = this.handEl(i); if (!el) return;
      const t = score(h.cards).t;
      this.bubble(el.querySelector('.bjv-bub'), tot(h.cards), t > 21 ? 'bust' : isBJ(h) ? 'bj' : '');
      el.classList.toggle('act', this.phase === 'play' && i === this.act && this.hands.length > 1);
      const r = this.results[i];
      this.result(el.querySelector('.bjv-res'), r?.k, r?.t);
      this.layout(el);
    });
  }

  next() {
    while (this.act < this.hands.length && this.hands[this.act].done) this.act++;
    if (this.act >= this.hands.length) { this.act = this.hands.length - 1; return this.dealerPlay(); }
    this.paintTotals(); this.renderActions();
  }

  async hit() {
    const h = this.hands[this.act]; if (this.phase !== 'play' || h.done) return;
    const c = this.draw(); h.cards.push(c);
    this.phase = 'anim'; this.renderActions();
    await this.deal(this.handEl(this.act), c);
    this.phase = 'play';
    const t = score(h.cards).t;
    if (t > 21) { this.shake(this.handEl(this.act)); sfx.thud ? sfx.thud() : sfx.reelStop(0); }
    if (t >= 21) h.done = true;
    this.paintTotals(); this.renderActions();
    if (h.done) { await this.wait(400); this.next(); }
  }

  stand() { const h = this.hands[this.act]; if (this.phase !== 'play' || h.done) return; h.done = true; sfx.click(); this.next(); }

  async dbl() {
    const h = this.hands[this.act]; if (this.phase !== 'play' || h.done || h.cards.length !== 2) return;
    if (!this.pay(h.bet)) return;
    this.lastStake += h.bet;
    h.bet *= 2;
    const c = this.draw(); h.cards.push(c); h.done = true;
    this.phase = 'anim'; this.renderActions();
    await this.deal(this.handEl(this.act), c);
    this.phase = 'play';
    this.paintTotals();
    await this.wait(400);
    this.next();
  }

  async spl() {
    const h = this.hands[this.act];
    if (this.phase !== 'play' || this.hands.length !== 1 || h.cards.length !== 2 || cv(h.cards[0]) !== cv(h.cards[1])) return;
    if (!this.pay(h.bet)) return;
    this.lastStake += h.bet;
    const a = { cards: [h.cards[0]], bet: h.bet, done: false, split: true }, b = { cards: [h.cards[1]], bet: h.bet, done: false, split: true };
    this.hands = [a, b]; this.act = 0;
    this.phase = 'anim'; this.renderActions();
    const first = this.handEl(0), moved = first.querySelectorAll('.bjv-card')[1];
    const second = this.buildHand();
    second.appendChild(moved);
    this.placeHands(2);
    this.paintTotals();
    await this.wait(320);
    let c = this.draw(); a.cards.push(c); await this.deal(first, c);
    c = this.draw(); b.cards.push(c); await this.deal(second, c);
    [a, b].forEach((x) => { if (score(x.cards).t >= 21) x.done = true; });
    this.phase = 'play';
    this.paintTotals();
    this.msg('Deux mains : joue celle de gauche, puis celle de droite.');
    this.renderActions();
    if (a.done) { await this.wait(400); this.next(); }
  }

  async dealerPlay() {
    this.phase = 'dealer'; this.hole = false; this.renderActions();
    this.dealerDo('flip', 600);
    await this.wait(200);
    this.holeEl?.classList.remove('down');
    sfx.click();
    this.paintTotals();
    this.msg('La croupière joue…');
    const live = this.hands.some((h) => score(h.cards).t <= 21);
    await this.wait(650);
    while (live && score(this.dealer).t < 17 && !this.dead) {
      const c = this.draw(); this.dealer.push(c);
      await this.deal(this.dealerRow(), c, false, 'd');
      this.paintTotals();
      await this.wait(350);
    }
    this.settle();
  }

  async settle() {
    this.hole = false; this.holeEl?.classList.remove('down'); this.phase = 'end';
    const ds = score(this.dealer).t, dbj = this.dBJ();
    let net = 0, payAll = 0, big = false;
    this.results = this.hands.map((h) => {
      const ps = score(h.cards).t; let pay = 0, res;
      if (ps > 21) res = { k: 'lose', t: 'PERDU<small>plus de 21</small>' };
      else if (isBJ(h) && !dbj) { pay = Math.floor(h.bet * 2.2); res = { k: 'win bj', t: `BLACKJACK !<small>+${fmtC(pay - h.bet)}</small>` }; big = true; }
      else if (isBJ(h) && dbj) { pay = h.bet; res = { k: 'push', t: 'ÉGALITÉ' }; }
      else if (dbj) res = { k: 'lose', t: 'PERDU<small>blackjack de la croupière</small>' };
      else if (ds > 21 || ps > ds) { pay = h.bet * 2; res = { k: 'win', t: `GAGNÉ<small>+${fmtC(h.bet)}</small>` }; }
      else if (ps === ds) { pay = h.bet; res = { k: 'push', t: 'ÉGALITÉ' }; }
      else res = { k: 'lose', t: 'PERDU' };
      payAll += pay; net += pay - h.bet;
      return res;
    });
    this.lastPay = payAll;
    this.view.classList.add('done');
    this.paintTotals();
    this.renderActions();
    this.hands.forEach((h, i) => {
      const r = this.results[i], el = this.handEl(i); if (!el) return;
      if (r.k.startsWith('win')) { const p = center(el.querySelector('.bjv-res') || el); fx.burst(p.x, p.y, big ? 50 : 24, ['#fde047', '#4ade80', '#fff'], 8); }
    });
    if (payAll > 0) this.win(payAll, big ? 'Blackjack' : null);
    this.setLast(payAll);
    this.msg(`${net > 0 ? `Tu gagnes ${fmtC(net)} !` : net < 0 ? `Tu perds ${fmtC(-net)}.` : 'Égalité : ta mise t’est rendue.'} Rejouer = même mise, Miser = changer tes jetons.`);
    if (net > 0) { sfx.win(); this.dealerDo('happy', 1600); if (big) { fx.confetti(60); sfx.bigWin(); } }
    else if (net < 0) sfx.reelStop(0);
    this.busyHand = false;
    this.slotEl.classList.remove('busy');
    this.renderActions();
  }

  info() {
    return this.rules(`<h4>Règles</h4><ul class="rules"><li>Sabot de 6 jeux, mélangé quand il reste moins de 60 cartes.</li><li>Le but : approcher 21 sans dépasser. Les figures valent 10, l’As 1 ou 11.</li><li><b>Miser</b> : touche un jeton sur le tapis pour le poser sur le cercle (touche-le encore pour en ajouter, ou touche le cercle). <b>Doubler</b> double ta mise, <b>Vider</b> reprend tes jetons, <b>Répéter</b> remet la mise de la main d’avant.</li><li>Pendant la main : <b>Tirer</b> une carte, <b>Rester</b>, <b>Doubler</b> (mise ×2, une seule carte), <b>Séparer</b> une paire en deux mains.</li><li>La croupière tire jusqu’à 16 et reste à 17.</li><li>Blackjack naturel : <b>6 pour 5</b>. Victoire : 1 pour 1. Égalité : mise rendue.</li></ul>`);
  }
}

return { BlackjackGame };
})();
