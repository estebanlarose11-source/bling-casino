// SpinBet Casino · BlackjackGame — loaded on demand by games/impl/index.js (index.html).
// ---- games/impl/blackjack.js ----
__mods['games/impl/blackjack.js'] = (() => {
// Blackjack, rebuilt on the shared cabinet. 6-deck shoe, dealer stands on 17, blackjack pays 6:5.

const { BaseGame, fmtC } = __mods['core/base.js'];
const { EXTRA_THEMES } = __mods['core/music.js'];
const { sfx } = __mods['audio.js'];
const { fx, sleep, center } = __mods['fx.js'];

/* ===ENGINE (original) */
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'], SUITS = ['♠', '♥', '♦', '♣'];
const cv = (c) => (c.r === 'A' ? 11 : 'JQK'.includes(c.r) || c.r === '10' ? 10 : parseInt(c.r, 10));
function score(cards) { let t = 0, a = 0; cards.forEach((c) => { t += cv(c); if (c.r === 'A') a++; }); while (t > 21 && a > 0) { t -= 10; a--; } return { t, soft: a > 0 }; }
const isBJ = (h) => h.cards.length === 2 && !h.split && score(h.cards).t === 21;
/* ===END ENGINE */

let uid = 0;

class BlackjackGame extends BaseGame {
  constructor(root, game) {
    super(root, game, {
      music: EXTRA_THEMES.blackjack, autoplay: false, turbo: true, mainLabel: 'DISTRIBUER',
      cls: 'table-game bj',
      stage: `<div class="bj-table">
        <div class="bj-shoe"></div>
        <div class="bj-zone dealer"><div class="bj-label">Croupier <b class="dt"></b></div><div class="bj-cards dc"></div></div>
        <div class="bj-arc">LE BLACKJACK PAIE 6 POUR 5 · LE CROUPIER RESTE À 17</div>
        <div class="bj-hands"></div>
      </div>`,
      below: `<div class="bj-actions"><button class="bj-btn" data-bj="hit">Tirer <small>+1 carte</small></button><button class="bj-btn" data-bj="stand">Rester</button><button class="bj-btn" data-bj="dbl">Doubler <small>×2, 1 carte</small></button><button class="bj-btn" data-bj="spl">Séparer <small>2 mains</small></button></div>`,
      hello: 'Choisis ta mise et distribue.',
    });
    this.shoe = [];
    this.newShoe();
    this.phase = 'bet';
    this.hands = []; this.dealer = []; this.act = 0; this.hole = true; this.results = [];
    this.root.addEventListener('click', (e) => {
      const a = e.target.closest('[data-bj]')?.dataset.bj;
      if (a && !e.target.closest('[data-bj]').disabled) this[a]();
    });
    this.renderActions();
  }

  newShoe() {
    this.shoe = [];
    for (let d = 0; d < 6; d++) RANKS.forEach((r) => SUITS.forEach((s) => this.shoe.push({ r, s })));
    for (let i = this.shoe.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [this.shoe[i], this.shoe[j]] = [this.shoe[j], this.shoe[i]]; }
  }
  draw() { if (this.shoe.length < 60) this.newShoe(); return { ...this.shoe.pop(), id: ++uid }; }
  dBJ() { return this.dealer.length === 2 && score(this.dealer).t === 21; }

  cardEl(c, down) {
    const red = c.s === '♥' || c.s === '♦';
    const d = document.createElement('div');
    d.className = 'bj-card' + (red ? ' red' : '') + (down ? ' down' : '');
    d.dataset.id = c.id;
    d.innerHTML = `<div class="bj-in"><div class="bj-f"><span class="tl">${c.r}<i>${c.s}</i></span><span class="mid">${c.s}</span><span class="br">${c.r}<i>${c.s}</i></span></div><div class="bj-k"></div></div>`;
    return d;
  }

  async deal(container, c, down = false) {
    const node = this.cardEl(c, down);
    container.appendChild(node);
    const shoe = this.q('.bj-shoe').getBoundingClientRect(), r = node.getBoundingClientRect();
    node.animate([{ transform: `translate(${shoe.left - r.left}px, ${shoe.top - r.top}px) rotate(-25deg) scale(.7)`, opacity: 0.4 }, { transform: 'none', opacity: 1 }],
      { duration: this.turbo ? 180 : 360, easing: 'cubic-bezier(.2,.8,.25,1)' });
    sfx.click();
    await this.wait(300);
    return node;
  }

  handEl(i) { return this.q('.bj-hands').children[i]; }

  paintTotals() {
    const dt = this.q('.dt');
    dt.innerHTML = this.dealer.length ? (this.hole ? `${cv(this.dealer[0])}` : this.tot(this.dealer)) : '';
    this.hands.forEach((h, i) => {
      const el = this.handEl(i); if (!el) return;
      el.querySelector('.bj-tot').innerHTML = `${this.tot(h.cards)} <span class="chip">${fmtC(h.bet)}</span>`;
      el.classList.toggle('act', this.phase === 'play' && i === this.act);
      const r = this.results[i];
      el.querySelector('.bj-res').textContent = r ? r.t : '';
      el.className = 'bj-hand' + (this.phase === 'play' && i === this.act ? ' act' : '') + (r ? ' ' + r.k : '');
    });
  }

  tot(cards) { const sc = score(cards); return `<b>${sc.t}</b>${sc.soft && sc.t < 21 ? ' <small>souple</small>' : ''}${sc.t > 21 ? ' <small>dépassé</small>' : ''}`; }

  renderActions() {
    const play = this.phase === 'play', h = this.hands[this.act];
    const can = play && h && !h.done;
    const set = (k, v) => { const b = this.q(`[data-bj="${k}"]`); if (b) b.disabled = !v; };
    set('hit', can); set('stand', can);
    set('dbl', can && h.cards.length === 2 && this.balC() >= h.bet);
    set('spl', can && this.hands.length === 1 && h.cards.length === 2 && cv(h.cards[0]) === cv(h.cards[1]) && this.balC() >= h.bet);
    const betting = this.phase === 'bet' || this.phase === 'end';
    this.mainBtn.disabled = !betting;
    this.mainBtn.querySelector('.main-label').textContent = this.phase === 'end' ? 'NOUVELLE MAIN' : 'DISTRIBUER';
    this.q('[data-act="bet-"]').disabled = !betting || this.bi === 0;
    this.q('[data-act="bet+"]').disabled = !betting || this.bi === this.cfg.bets.length - 1;
  }

  onMeters() { if (this.hands) this.renderActions(); }

  onMain() {
    if (!(this.phase === 'bet' || this.phase === 'end')) return;
    const bet = this.bet;
    if (!this.pay(bet)) return;
    this.lastStake = bet;
    this.busyHand = true;
    this.slotEl.classList.add('busy');
    this.startHand(bet);
  }

  async startHand(bet) {
    this.results = []; this.hole = true; this.act = 0;
    this.q('.dc').innerHTML = '';
    const hs = this.q('.bj-hands');
    hs.innerHTML = '';
    this.hands = [{ cards: [], bet, done: false, split: false }];
    this.dealer = [];
    this.phase = 'deal';
    this.renderActions();
    this.msg('Distribution…'); this.setLast(0); this.winAmt.textContent = '';
    hs.appendChild(this.buildHand());
    const pc = () => this.handEl(0).querySelector('.bj-cards');
    let c = this.draw(); this.hands[0].cards.push(c); await this.deal(pc(), c); this.paintTotals();
    c = this.draw(); this.dealer.push(c); await this.deal(this.q('.dc'), c); this.paintTotals();
    c = this.draw(); this.hands[0].cards.push(c); await this.deal(pc(), c); this.paintTotals();
    c = this.draw(); this.dealer.push(c); this.holeEl = await this.deal(this.q('.dc'), c, true); this.paintTotals();
    this.phase = 'play';
    if (isBJ(this.hands[0]) || this.dBJ()) return this.settle();
    this.msg('À toi : tirer, rester, doubler ou séparer.');
    this.paintTotals();
    this.renderActions();
  }

  buildHand() {
    const el = document.createElement('div');
    el.className = 'bj-hand';
    el.innerHTML = '<div class="bj-cards"></div><div class="bj-tot"></div><div class="bj-res"></div>';
    return el;
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
    await this.deal(this.handEl(this.act).querySelector('.bj-cards'), c);
    this.phase = 'play';
    const t = score(h.cards).t;
    if (t > 21) { this.shake(this.handEl(this.act)); sfx.thud ? sfx.thud() : sfx.reelStop(0); }
    if (t >= 21) h.done = true;
    this.paintTotals(); this.renderActions();
    if (h.done) { await this.wait(400); this.next(); }
  }

  stand() { const h = this.hands[this.act]; if (this.phase !== 'play' || h.done) return; h.done = true; this.next(); }

  async dbl() {
    const h = this.hands[this.act]; if (this.phase !== 'play' || h.done || h.cards.length !== 2) return;
    if (!this.pay(h.bet)) return;
    this.lastStake += h.bet;
    h.bet *= 2;
    const c = this.draw(); h.cards.push(c); h.done = true;
    this.phase = 'anim'; this.renderActions();
    await this.deal(this.handEl(this.act).querySelector('.bj-cards'), c);
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
    const hs = this.q('.bj-hands');
    const first = this.handEl(0), moved = first.querySelectorAll('.bj-card')[1];
    const second = this.buildHand();
    hs.appendChild(second);
    second.querySelector('.bj-cards').appendChild(moved);
    this.paintTotals();
    await this.wait(300);
    let c = this.draw(); a.cards.push(c); await this.deal(first.querySelector('.bj-cards'), c);
    c = this.draw(); b.cards.push(c); await this.deal(second.querySelector('.bj-cards'), c);
    [a, b].forEach((x) => { if (score(x.cards).t >= 21) x.done = true; });
    this.phase = 'play';
    this.paintTotals();
    this.msg('Deux mains : joue la première.');
    this.renderActions();
    if (a.done) { await this.wait(400); this.next(); }
  }

  async dealerPlay() {
    this.phase = 'dealer'; this.hole = false; this.renderActions();
    this.holeEl?.classList.remove('down');
    sfx.click();
    this.paintTotals();
    this.msg('Le croupier joue…');
    const live = this.hands.some((h) => score(h.cards).t <= 21);
    await this.wait(600);
    while (live && score(this.dealer).t < 17 && !this.dead) {
      const c = this.draw(); this.dealer.push(c);
      await this.deal(this.q('.dc'), c);
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
      if (ps > 21) res = { k: 'lose', t: 'Perdu (dépassé)' };
      else if (isBJ(h) && !dbj) { pay = Math.floor(h.bet * 2.2); res = { k: 'win', t: `Blackjack ! +${fmtC(pay - h.bet)}` }; big = true; }
      else if (isBJ(h) && dbj) { pay = h.bet; res = { k: 'push', t: 'Égalité' }; }
      else if (dbj) res = { k: 'lose', t: 'Blackjack du croupier' };
      else if (ds > 21 || ps > ds) { pay = h.bet * 2; res = { k: 'win', t: `Gagné +${fmtC(h.bet)}` }; }
      else if (ps === ds) { pay = h.bet; res = { k: 'push', t: 'Égalité' }; }
      else res = { k: 'lose', t: 'Perdu' };
      payAll += pay; net += pay - h.bet;
      return res;
    });
    this.paintTotals();
    this.renderActions();
    this.hands.forEach((h, i) => {
      const r = this.results[i], el = this.handEl(i); if (!el) return;
      const n = (r.k === 'win' ? '+' : r.k === 'lose' ? '−' : '') + (r.k === 'push' ? 'Égalité' : fmtC(Math.abs((r.k === 'win' ? (isBJ(h) ? Math.floor(h.bet * 1.2) : h.bet) : h.bet))));
      this.floatAt(el, n, r.k === 'win' ? '#4ade80' : r.k === 'lose' ? '#f87171' : '#e2e8f0', 22);
      if (r.k === 'win') { const p = center(el); fx.burst(p.x, p.y, big ? 50 : 24, ['#fde047', '#4ade80', '#fff'], 8); }
    });
    if (payAll > 0) this.win(payAll, big ? 'Blackjack' : null);
    this.setLast(payAll);
    this.msg(net > 0 ? `Tu gagnes ${fmtC(net)}.` : net < 0 ? `Tu perds ${fmtC(-net)}.` : 'Égalité, mise récupérée.');
    if (net > 0) { sfx.win(); if (big) { fx.confetti(60); sfx.bigWin(); } }
    else if (net < 0) sfx.reelStop(0);
    this.busyHand = false;
    this.slotEl.classList.remove('busy');
    this.renderActions();
  }

  info() {
    return this.rules(`<h4>Règles</h4><ul class="rules"><li>Sabot de 6 jeux, mélangé quand il reste moins de 60 cartes.</li><li>Le but : approcher 21 sans dépasser. Les figures valent 10, l’As 1 ou 11.</li><li><b>Tirer</b> une carte, <b>Rester</b>, <b>Doubler</b> (mise ×2, une seule carte), <b>Séparer</b> une paire en deux mains.</li><li>Le croupier tire jusqu’à 17.</li><li>Blackjack naturel : <b>6 pour 5</b>. Victoire : 1 pour 1. Égalité : mise rendue.</li></ul>`);
  }
}

return { BlackjackGame };
})();
