// SpinBet Casino · LightningBJGame — loaded on demand by games/impl/index.js (index.html), after games/bjtable.js.
// ---- games/impl/lightningbj.js ----
__mods['games/impl/lightningbj.js'] = (() => {
// Le 21 Électrique : blackjack à 6 jeux où, avant chaque distribution, la foudre donne à chaque score final de 17 à 21
// un multiplicateur (×1 à ×1000) ; une main gagnante qui finit sur ce score a son gain multiplié. Mises annexes :
// Paires Parfaites, 21+3 et Bust It, en cercles sur le tapis (on y pose des jetons comme sur la mise principale).
// Même table que Le 21 (games/bjtable.js, BjTableGame). RTP vérifié par simulation (jeu principal ≈ 97,5 %).

const { BjTableGame, CX } = __mods['games/impl/bjtable.js'];
const { fmtC, wpick } = __mods['core/base.js'];
const { EXTRA_THEMES } = __mods['core/music.js'];
const { sfx } = __mods['audio.js'];
const { fx, sleep, center } = __mods['fx.js'];

/* ===ENGINE */
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'], SUITS = ['♠', '♥', '♦', '♣'];
const cv = (c) => (c.r === 'A' ? 11 : 'JQK'.includes(c.r) || c.r === '10' ? 10 : parseInt(c.r, 10));
function score(cards) { let t = 0, a = 0; cards.forEach((c) => { t += cv(c); if (c.r === 'A') a++; }); while (t > 21 && a > 0) { t -= 10; a--; } return { t, soft: a > 0 }; }
const isBJ = (h) => h.cards.length === 2 && !h.split && score(h.cards).t === 21;
// Multiplier drawn independently for each final score 17-21, every round.
const LM = [[1, 960], [2, 120], [3, 45], [4, 20], [5, 14], [8, 6], [10, 4], [20, 2], [25, 1.3], [50, 0.7], [100, 0.3], [250, 0.1], [500, 0.04], [1000, 0.015]];
const FEE = 0.25; // "frais Éclair": 25 % of the main bet, paid with every deal
const SCORES = [17, 18, 19, 20, 21];
const lightning = () => Object.fromEntries(SCORES.map((s) => [s, wpick(LM)]));
const RI = (c) => RANKS.indexOf(c.r) + 1;
const RED = (c) => c.s === '♥' || c.s === '♦';
// Perfect Pairs on the player's first two cards
const PP = { perfect: [25, 'Paire parfaite'], colored: [12, 'Paire de couleur'], mixed: [6, 'Paire mixte'] };
function ppOf(a, b) { if (a.r !== b.r) return null; if (a.s === b.s) return 'perfect'; return RED(a) === RED(b) ? 'colored' : 'mixed'; }
// 21+3 on the player's two cards + the dealer's up card (poker hands)
const T3 = { strips: [100, 'Brelan couleur'], sflush: [40, 'Quinte flush'], trips: [30, 'Brelan'], straight: [10, 'Suite'], flush: [5, 'Couleur'] };
function t3Of(cs) {
  const fl = cs.every((c) => c.s === cs[0].s), tr = cs.every((c) => c.r === cs[0].r);
  const v = cs.map(RI).sort((x, y) => x - y);
  const st = (v[1] === v[0] + 1 && v[2] === v[1] + 1) || (v[0] === 1 && v[1] === 12 && v[2] === 13);
  if (tr && fl) return 'strips'; if (st && fl) return 'sflush'; if (tr) return 'trips'; if (st) return 'straight'; if (fl) return 'flush'; return null;
}
// Bust It: the dealer busts, paid by the number of cards in the dealer's hand
const BUST = { 3: 1, 4: 2, 5: 9, 6: 50, 7: 100, 8: 250 };
const bustPay = (n) => BUST[Math.min(n, 8)] || 0;
/* ===END ENGINE */

const SIDES = [
  { id: 'pp', name: 'PAIRES', full: 'Paires Parfaites', sub: '25:1', x: CX - 162, y: 556, r: 38, c: '#9fd4ff' },
  { id: 't3', name: '21+3', full: '21+3', sub: '100:1', x: CX + 162, y: 556, r: 38, c: '#9fd4ff' },
  { id: 'bust', name: 'BUST IT', full: 'Bust It', sub: 'la croupière saute · 250:1', x: CX + 262, y: 205, r: 40, c: '#fca5a5' },
];
const tier = (m) => (m >= 100 ? 't4' : m >= 10 ? 't3' : m >= 2 ? 't2' : 't1');
const BOLT = '<svg class="lb-bolt" viewBox="0 0 40 60" aria-hidden="true"><path d="M24 0 L6 34 H19 L13 60 L34 22 H21 L28 0 Z"/></svg>';
const tot = (cards) => { const sc = score(cards); return sc.t === 21 && cards.length === 2 ? '21' : `${sc.soft && sc.t < 21 ? `${sc.t - 10}/` : ''}${sc.t}`; };
let uid = 0;

class LightningBJGame extends BjTableGame {
  constructor(root, game) {
    super(root, game, { music: EXTRA_THEMES.blackjack, turbo: true, mainLabel: 'DISTRIBUER', cls: 'lbj', hello: 'Choisis ta mise, ajoute des mises annexes si tu veux, puis distribue.' }, {
      t1: '⚡ LE 21 ÉLECTRIQUE ⚡', t2: 'BLACKJACK 3:2 · TON SCORE DE 17 À 21 MULTIPLIE TON GAIN', sides: SIDES,
      overlay: `<div class="lbv-board"><div class="lb-tiles">${SCORES.map((s) => `<div class="lb-tile t1" data-s="${s}">${BOLT}<small>${s}</small><b>×1</b></div>`).join('')}</div></div>`,
    });
    this.shoe = [];
    this.newShoe();
    this.phase = 'bet';
    this.hands = []; this.dealer = []; this.act = 0; this.hole = true; this.results = []; this.sideRes = {};
    this.mult = Object.fromEntries(SCORES.map((s) => [s, 1]));
    this.msg('Pose tes jetons : le cercle du milieu, et les mises annexes si tu veux.');
    this.renderActions();
  }

  /* ---------- bets ---------- */
  fee(main = this.bets.main) { return main > 0 ? Math.max(1, Math.round(main * FEE)) : 0; }
  costOf(b = this.bets) { return (b.main || 0) + this.fee(b.main || 0) + SIDES.reduce((a, x) => a + (b[x.id] || 0), 0); }
  inPlayStake() { return this.lastStake || 0; }
  onBetsChanged() { if (this.bets.main) this.msg(`${fmtC(this.bets.main)} + frais éclair ${fmtC(this.fee())}${SIDES.some((x) => this.bets[x.id]) ? ' + annexes' : ''} = ${fmtC(this.costOf())}`); }

  buttons() {
    if (this.phase === 'end') return [['×2', 'DOUBLER', 'x2'], ['', 'VIDER', 'clear'], ['', 'MISER', 'rebet'], ['', 'REJOUER', 'deal']];
    if (this.betting()) return [['×2', 'DOUBLER', 'x2'], ['', 'VIDER', 'clear'], ['', 'RÉPÉTER', 'repeat'], ['', 'DISTRIBUER', 'deal']];
    const h = this.hands[this.act];
    return [['', 'SÉPARER', 'spl'], ['', 'RESTER', 'stand'], ['', 'TIRER', 'hit'], ['', h && this.phase === 'play' && h.cards.length === 2 ? `DOUBLER<small> ${fmtC(h.bet)}</small>` : 'DOUBLER', 'dbl']];
  }
  can(k) {
    const h = this.hands[this.act], go = this.phase === 'play' && h && !h.done;
    if (k === 'deal') return this.betting() && this.bets.main > 0 && this.balC() >= this.costOf();
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
    this.setState(betting ? 'g' : this.phase === 'play' ? 'r' : 'o', betting ? (this.phase === 'end' ? 'NOUVELLE MAIN' : 'FAITES VOS JEUX') : this.phase === 'play' ? 'À VOUS DE JOUER' : this.phase === 'strike' ? '⚡ ÉCLAIR' : 'DISTRIBUTION');
  }
  onMeters() { this.renderActions(); }

  newShoe() {
    this.shoe = [];
    for (let d = 0; d < 6; d++) RANKS.forEach((r) => SUITS.forEach((s) => this.shoe.push({ r, s })));
    for (let i = this.shoe.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [this.shoe[i], this.shoe[j]] = [this.shoe[j], this.shoe[i]]; }
  }
  draw() { if (this.shoe.length < 60) this.newShoe(); return { ...this.shoe.pop(), id: ++uid }; }
  dBJ() { return this.dealer.length === 2 && score(this.dealer).t === 21; }
  clearTable() { super.clearTable(); this.hands = []; this.dealer = []; this.results = []; this.sideRes = {}; this.qa('.lb-tile').forEach((t) => t.classList.remove('on', 'hit')); }

  /* ---------- lightning ---------- */
  async strike() {
    const tiles = this.qa('.lb-tile'), board = this.q('.lbv-board');
    tiles.forEach((t) => { t.className = 'lb-tile t1 roll'; });
    board.classList.add('charge');
    this.msg('⚡ La foudre choisit les multiplicateurs…');
    const roll = performance.now(), dur = this.turbo ? 350 : 800;
    while (performance.now() - roll < dur) {
      tiles.forEach((t) => { t.querySelector('b').textContent = '×' + wpick(LM.slice(1)); });
      sfx.tick();
      await sleep(70);
    }
    for (const t of tiles) {
      const m = this.mult[+t.dataset.s];
      t.querySelector('b').textContent = '×' + m;
      t.className = `lb-tile ${tier(m)} zap`;
      if (m >= 10) { const p = center(t); fx.burst(p.x, p.y, m >= 100 ? 26 : 14, ['#fff', '#9fd4ff', '#ffe14a'], 7); }
      if (m >= 100) this.flash('rgba(160,200,255,.6)');
      if (m > 1) sfx.upgrade(); else sfx.tick();
      await sleep(this.turbo ? 60 : 150);
    }
    board.classList.remove('charge');
  }

  /* ---------- round ---------- */
  onMain() {
    if (!this.betting()) return;
    if (!this.bets.main) { this.msg('Pose au moins un jeton sur le cercle du milieu'); this.shake(this.q('.bjv-spot.main')); return; }
    const total = this.costOf();
    if (this.balC() < total) { this.msg('Solde insuffisant pour ces mises'); return; }
    if (!this.pay(total)) return;
    this.lastStake = total; this.lastPay = 0;
    this.side = Object.fromEntries(SIDES.map((x) => [x.id, this.bets[x.id] || 0]));
    this.slotEl.classList.add('busy');
    this.startHand(this.bets.main).catch((e) => { console.error(e); this.phase = 'end'; this.slotEl.classList.remove('busy'); this.renderActions(); });
  }

  async startHand(bet) {
    this.newDeal();
    this.results = []; this.hole = true; this.act = 0; this.sideRes = {};
    this.hands = [{ cards: [], bet, done: false, split: false }];
    this.dealer = [];
    this.phase = 'strike';
    this.renderActions();
    this.setLast(0);
    this.mult = lightning();
    await this.strike();
    if (this.dead) return;
    this.phase = 'deal'; this.renderActions();
    this.msg('Distribution…');
    this.buildHand();
    this.placeHands(1);
    const pc = () => this.handEl(0), dc = this.dealerRow();
    let c = this.draw(); this.hands[0].cards.push(c); await this.deal(pc(), c); this.paintTotals();
    c = this.draw(); this.dealer.push(c); await this.deal(dc, c, false, 'd'); this.paintTotals();
    c = this.draw(); this.hands[0].cards.push(c); await this.deal(pc(), c); this.paintTotals();
    c = this.draw(); this.dealer.push(c); this.holeEl = await this.deal(dc, c, true, 'd'); this.paintTotals();
    if (this.dead) return;
    this.resolveEarlySides();
    this.phase = 'play';
    if (isBJ(this.hands[0]) || this.dBJ()) return this.dealerPlay();
    this.msg('À toi : tirer, rester, doubler' + (cv(this.hands[0].cards[0]) === cv(this.hands[0].cards[1]) ? ' ou séparer.' : '.'));
    this.paintTotals();
    this.renderActions();
  }

  // Perfect Pairs and 21+3 are decided by the first cards, like in a real casino.
  resolveEarlySides() {
    const [a, b] = this.hands[0].cards, up = this.dealer[0];
    if (this.side.pp) { const k = ppOf(a, b); this.sideRes.pp = k ? { pay: this.side.pp * (1 + PP[k][0]), t: `${PP[k][1]} ${PP[k][0]}:1` } : { pay: 0, t: 'Pas de paire' }; this.showSide('pp'); }
    if (this.side.t3) { const k = t3Of([a, b, up]); this.sideRes.t3 = k ? { pay: this.side.t3 * (1 + T3[k][0]), t: `${T3[k][1]} ${T3[k][0]}:1` } : { pay: 0, t: 'Pas de combinaison' }; this.showSide('t3'); }
  }
  showSide(id) {
    const r = this.sideRes[id];
    this.sideResult(id, r.pay ? 'win' : 'lose', r.pay ? `+${fmtC(r.pay)}<small>${r.t}</small>` : `PERDU<small>${r.t}</small>`);
    if (r.pay) { const p = center(this.q(`.bjv-spot[data-t="${id}"]`)); fx.burst(p.x, p.y, 18, ['#fde047', '#4ade80', '#fff'], 6); sfx.coin(); }
  }

  paintTotals() {
    this.bubble(this.q('.bjv-bub.d'), this.dealer.length ? (this.hole ? `${cv(this.dealer[0])}` : tot(this.dealer)) : '', !this.hole && score(this.dealer).t > 21 ? 'bust' : '');
    this.layout(this.dealerRow());
    const live = new Set();
    this.hands.forEach((h, i) => {
      const el = this.handEl(i); if (!el) return;
      const t = score(h.cards).t, m = t >= 17 && t <= 21 ? this.mult[t] : 0;
      if (m) live.add(t);
      this.bubble(el.querySelector('.bjv-bub'), `${tot(h.cards)}${m > 1 ? ` <span class="lb-x ${tier(m)}">⚡×${m}</span>` : ''}`, t > 21 ? 'bust' : isBJ(h) ? 'bj' : '');
      el.classList.toggle('act', this.phase === 'play' && i === this.act && this.hands.length > 1);
      const r = this.results[i];
      this.result(el.querySelector('.bjv-res'), r?.k, r?.t);
      this.layout(el);
    });
    this.qa('.lb-tile').forEach((e) => e.classList.toggle('on', live.has(+e.dataset.s)));
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
    if (t > 21) { this.shake(this.handEl(this.act)); sfx.reelStop(0); }
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
    const live = this.hands.some((h) => score(h.cards).t <= 21) && !this.dBJ() && !(this.hands.length === 1 && isBJ(this.hands[0]));
    // the croupière also finishes the hand when Bust It is on the table
    const play = !this.dBJ() && (live || this.side.bust > 0);
    if (play) this.msg('La croupière joue…');
    await this.wait(600);
    while (play && score(this.dealer).t < 17 && !this.dead) {
      const c = this.draw(); this.dealer.push(c);
      await this.deal(this.dealerRow(), c, false, 'd');
      this.paintTotals();
      await this.wait(300);
    }
    if (!this.dead) this.settle();
  }

  async settle() {
    this.hole = false; this.holeEl?.classList.remove('down'); this.phase = 'end';
    const ds = score(this.dealer).t, dbj = this.dBJ();
    let payAll = 0, big = false;
    const zap = [];
    this.results = this.hands.map((h) => {
      const ps = score(h.cards).t, bj = isBJ(h);
      let profit = 0, ret = 0, res;
      if (ps > 21) res = { k: 'lose', t: 'PERDU<small>plus de 21</small>' };
      else if (bj && !dbj) { profit = h.bet * 1.5; res = { k: 'win bj', t: 'BLACKJACK !' }; big = true; }
      else if (bj && dbj) { ret = h.bet; res = { k: 'push', t: 'ÉGALITÉ' }; }
      else if (dbj) res = { k: 'lose', t: 'PERDU<small>blackjack de la croupière</small>' };
      else if (ds > 21 || ps > ds) { profit = h.bet; res = { k: 'win', t: 'GAGNÉ' }; }
      else if (ps === ds) { ret = h.bet; res = { k: 'push', t: 'ÉGALITÉ' }; }
      else res = { k: 'lose', t: 'PERDU' };
      const m = profit > 0 && ps >= 17 && ps <= 21 ? this.mult[ps] : 1;
      if (profit > 0) { profit = Math.round(profit * m); ret = h.bet + profit; res.t += `<small>${m > 1 ? `⚡×${m} ` : ''}+${fmtC(profit)}</small>`; if (m > 1) { zap.push(ps); res.k += ' zap'; } }
      payAll += ret;
      return res;
    });
    if (this.side.bust) {
      const n = this.dealer.length, k = ds > 21 ? bustPay(n) : 0;
      this.sideRes.bust = k ? { pay: this.side.bust * (1 + k), t: `sautée en ${n} cartes ${k}:1` } : { pay: 0, t: ds > 21 ? 'sautée' : `croupière à ${ds}` };
      this.showSide('bust');
    }
    payAll += Object.values(this.sideRes).reduce((a, r) => a + r.pay, 0);
    this.lastPay = payAll;
    this.view.classList.add('done');
    this.paintTotals();
    this.renderActions();
    // lightning hits the winning scores
    for (const s of zap) {
      const t = this.q(`.lb-tile[data-s="${s}"]`);
      t.classList.remove('zap'); void t.offsetWidth; t.classList.add('zap', 'hit');
      const p = center(t); fx.burst(p.x, p.y, 30, ['#fff', '#9fd4ff', '#ffe14a'], 8);
      this.flash('rgba(160,200,255,.7)');
      sfx.bigWin();
    }
    this.hands.forEach((h, i) => {
      const r = this.results[i], el = this.handEl(i); if (!el) return;
      if (r.k.startsWith('win')) { const p = center(el.querySelector('.bjv-res') || el); fx.burst(p.x, p.y, big ? 40 : 20, ['#fde047', '#4ade80', '#fff'], 8); }
    });
    if (payAll > 0) this.win(payAll, zap.length ? 'Éclair' : big ? 'Blackjack' : null);
    this.setLast(payAll);
    const net = payAll - this.lastStake;
    this.msg(`${net > 0 ? `Tu gagnes ${fmtC(net)} !` : net < 0 ? `Tu perds ${fmtC(-net)}.` : 'Égalité.'} Rejouer = mêmes mises.`);
    if (net > 0) { sfx.win(); this.dealerDo('happy', 1600); if (big || zap.length) fx.confetti(50); }
    else if (net < 0) sfx.reelStop(0);
    this.slotEl.classList.remove('busy');
    this.renderActions();
    if (payAll >= this.lastStake * 10) await this.celebrate(payAll, { summary: zap.length ? 'GAIN ÉCLAIR' : null });
  }

  info() {
    const lm = LM.filter((x) => x[0] > 1).map((x) => '×' + x[0]).join(', ');
    return this.rules(`<h4>Le jeu</h4><ul class="rules"><li>Sabot de 6 jeux. Approche 21 sans dépasser : figures = 10, As = 1 ou 11.</li><li><b>Miser</b> : touche un jeton sur le tapis pour le poser sur le cercle du milieu ; touche un cercle de mise annexe pour y poser le jeton choisi.</li><li><b>Tirer</b>, <b>Rester</b>, <b>Doubler</b> (mise ×2, une carte), <b>Séparer</b> une paire (une fois).</li><li>La croupière tire jusqu’à 17 et reste sur tous les 17. Blackjack 3:2, victoire 1:1, égalité = mise rendue.</li></ul>
      <h4>⚡ Multiplicateurs éclair</h4><ul class="rules"><li>Avant chaque distribution, la foudre donne au hasard un multiplicateur à chacun des scores <b>17, 18, 19, 20 et 21</b> : ×1 ou ${lm}.</li><li>Si ta main <b>gagne</b> avec exactement ce score, ton gain de la manche est multiplié tout de suite (un blackjack compte comme 21).</li><li>Chaque distribution coûte la mise + <b>25 % de frais éclair</b> (non remboursés).</li></ul>
      <h4>Mises annexes</h4><ul class="rules"><li><b>Paires Parfaites</b> (tes 2 premières cartes) : paire mixte 6:1, paire de couleur 12:1, paire parfaite 25:1.</li><li><b>21+3</b> (tes 2 cartes + la carte visible de la croupière) : couleur 5:1, suite 10:1, brelan 30:1, quinte flush 40:1, brelan couleur 100:1.</li><li><b>Bust It</b> (la croupière dépasse 21) : 3 cartes 1:1, 4 cartes 2:1, 5 cartes 9:1, 6 cartes 50:1, 7 cartes 100:1, 8 cartes ou plus 250:1.</li></ul>`);
  }
}

return { LightningBJGame };
})();
