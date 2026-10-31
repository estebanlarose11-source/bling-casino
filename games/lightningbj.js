// SpinBet Casino · LightningBJGame — loaded on demand by games/impl/index.js (index.html).
// ---- games/impl/lightningbj.js ----
__mods['games/impl/lightningbj.js'] = (() => {
// Lightning Blackjack: classic 6-deck blackjack where, before every deal, lightning gives each final score
// from 17 to 21 a multiplier (×1 to ×1000). A winning hand that ends on that exact score has its win multiplied
// in the same round. Side bets: Perfect Pairs, 21+3 and Bust It. RTP checked by simulation (main game ≈ 97.5 %).

const { BaseGame, fmtC, wpick } = __mods['core/base.js'];
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
  { id: 'pp', name: 'Paires Parfaites', hint: 'jusqu’à 25:1' },
  { id: 't3', name: '21+3', hint: 'jusqu’à 100:1' },
  { id: 'bust', name: 'Bust It', hint: 'jusqu’à 250:1' },
];
const SIDE_F = [0, 0.5, 1, 2]; // side bet = this fraction of the main bet (tap to cycle)
const tier = (m) => (m >= 100 ? 't4' : m >= 10 ? 't3' : m >= 2 ? 't2' : 't1');
const BOLT = '<svg class="lb-bolt" viewBox="0 0 40 60" aria-hidden="true"><path d="M24 0 L6 34 H19 L13 60 L34 22 H21 L28 0 Z"/></svg>';
let uid = 0;

class LightningBJGame extends BaseGame {
  constructor(root, game) {
    super(root, game, {
      music: EXTRA_THEMES.blackjack, autoplay: false, turbo: true, mainLabel: 'DISTRIBUER', betLabel: 'Mise totale',
      cls: 'table-game lbj',
      stage: `<div class="lb-table">
        <div class="bj-shoe lb-shoe"><i></i></div>
        <div class="lb-board"><div class="lb-bt">⚡ MULTIPLICATEURS ÉCLAIR ⚡</div>
          <div class="lb-tiles">${SCORES.map((s) => `<div class="lb-tile t1" data-s="${s}">${BOLT}<small>${s}</small><b>×1</b></div>`).join('')}</div></div>
        <div class="bj-zone dealer"><div class="bj-label">Croupier <b class="dt"></b></div><div class="bj-cards dc"></div></div>
        <div class="bj-arc">BLACKJACK 3:2 · CROUPIER RESTE À 17 · ⚡ TON SCORE FINAL MULTIPLIE TON GAIN</div>
        <div class="bj-hands"></div>
        <div class="lb-recap"></div>
      </div>`,
      below: `<div class="lb-below">
        <div class="lb-sides">
          <div class="lb-main"><small>Mise principale</small><b class="lb-mb"></b><em>+25 % éclair <span class="lb-fee"></span></em></div>
          ${SIDES.map((x) => `<button class="lb-side" data-side="${x.id}"><b>${x.name}</b><small>${x.hint}</small><i class="lb-amt">+ Miser</i></button>`).join('')}
        </div>
        <div class="bj-actions"><button class="bj-btn" data-bj="hit">Tirer <small>+1 carte</small></button><button class="bj-btn" data-bj="stand">Rester</button><button class="bj-btn" data-bj="dbl">Doubler <small>×2, 1 carte</small></button><button class="bj-btn" data-bj="spl">Séparer <small>2 mains</small></button></div>
      </div>`,
      hello: 'Choisis ta mise, ajoute des side bets si tu veux, puis distribue.',
    });
    this.shoe = [];
    this.newShoe();
    this.phase = 'bet';
    this.hands = []; this.dealer = []; this.act = 0; this.hole = true; this.results = [];
    this.sideF = { pp: 0, t3: 0, bust: 0 };
    this.side = { pp: 0, t3: 0, bust: 0 };
    this.mult = Object.fromEntries(SCORES.map((s) => [s, 1]));
    this.root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-bj],[data-side]');
      if (!b || b.disabled) return;
      if (b.dataset.bj) this[b.dataset.bj]();
      else this.cycleSide(b.dataset.side);
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

  /* ---------- bets ---------- */
  fee() { return Math.max(1, Math.round(this.bet * FEE)); }
  sideAmt(id) { return SIDE_F[this.sideF[id]] ? Math.max(1, Math.round(this.bet * SIDE_F[this.sideF[id]])) : 0; }
  stakeLabel() { return this.sideF ? this.bet + this.fee() + SIDES.reduce((a, x) => a + this.sideAmt(x.id), 0) : this.bet; }
  betting() { return this.phase === 'bet' || this.phase === 'end'; }

  cycleSide(id) {
    if (!this.betting()) return;
    this.sideF[id] = (this.sideF[id] + 1) % SIDE_F.length;
    sfx.click();
    this.updateMeters();
  }

  paintSides() {
    const mb = this.q('.lb-mb'); if (!mb) return;
    mb.textContent = fmtC(this.bet);
    this.q('.lb-fee').textContent = `(${fmtC(this.fee())})`;
    SIDES.forEach((x) => {
      const b = this.q(`[data-side="${x.id}"]`), a = this.betting() ? this.sideAmt(x.id) : this.side[x.id];
      b.classList.toggle('on', a > 0);
      b.disabled = !this.betting();
      if (!b.classList.contains('won') && !b.classList.contains('lost')) b.querySelector('.lb-amt').textContent = a ? fmtC(a) : '+ Miser';
    });
  }

  /* ---------- cards ---------- */
  cardEl(c) {
    const red = RED(c);
    const d = document.createElement('div');
    d.className = 'bj-card down' + (red ? ' red' : '');
    d.dataset.id = c.id;
    d.innerHTML = `<div class="bj-in"><div class="bj-f"><span class="tl">${c.r}<i>${c.s}</i></span><span class="mid">${c.s}</span><span class="br">${c.r}<i>${c.s}</i></span></div><div class="bj-k"></div></div>`;
    return d;
  }

  // The card leaves the shoe face down, glides over the felt with a little lift, and turns over as it lands.
  async deal(container, c, down = false) {
    const node = this.cardEl(c);
    container.appendChild(node);
    const shoe = this.q('.lb-shoe').getBoundingClientRect(), r = node.getBoundingClientRect();
    const dx = shoe.left + shoe.width / 2 - (r.left + r.width / 2), dy = shoe.top + shoe.height / 2 - (r.top + r.height / 2);
    const d = this.turbo ? 260 : 520;
    node.animate([
      { transform: `translate(${dx}px, ${dy}px) rotate(-70deg) scale(.55)`, opacity: 0 },
      { transform: `translate(${dx * 0.85}px, ${dy * 0.85}px) rotate(-55deg) scale(.6)`, opacity: 1, offset: 0.12 },
      { transform: 'translate(0, -10px) rotate(4deg) scale(1.06)', offset: 0.78 },
      { transform: 'none' },
    ], { duration: d, easing: 'cubic-bezier(.25,.7,.3,1)' });
    sfx.click();
    if (!down) setTimeout(() => node.classList.remove('down'), d * 0.55);
    await sleep(d + (this.turbo ? 40 : 120));
    return node;
  }

  handEl(i) { return this.q('.bj-hands').children[i]; }
  buildHand() {
    const el = document.createElement('div');
    el.className = 'bj-hand';
    el.innerHTML = '<div class="bj-cards"></div><div class="bj-tot"></div><div class="bj-res"></div>';
    return el;
  }

  tot(cards) { const sc = score(cards); return `<b>${sc.t}</b>${sc.soft && sc.t < 21 ? ' <small>souple</small>' : ''}${sc.t > 21 ? ' <small>dépassé</small>' : ''}`; }

  paintTotals() {
    const dt = this.q('.dt');
    dt.innerHTML = this.dealer.length ? (this.hole ? `${cv(this.dealer[0])}` : this.tot(this.dealer)) : '';
    const live = new Set();
    this.hands.forEach((h, i) => {
      const el = this.handEl(i); if (!el) return;
      const t = score(h.cards).t, m = t >= 17 && t <= 21 ? this.mult[t] : 0;
      if (m) live.add(t);
      el.querySelector('.bj-tot').innerHTML = `${this.tot(h.cards)}${m > 1 ? ` <span class="lb-x ${tier(m)}">⚡×${m}</span>` : ''} <span class="chip">${fmtC(h.bet)}</span>`;
      const r = this.results[i];
      el.querySelector('.bj-res').innerHTML = r ? r.t : '';
      el.className = 'bj-hand' + (this.phase === 'play' && i === this.act ? ' act' : '') + (r ? ' ' + r.k : '');
    });
    this.qa('.lb-tile').forEach((e) => e.classList.toggle('on', live.has(+e.dataset.s)));
  }

  renderActions() {
    const play = this.phase === 'play', h = this.hands[this.act];
    const can = play && h && !h.done;
    const set = (k, v) => { const b = this.q(`[data-bj="${k}"]`); if (b) b.disabled = !v; };
    set('hit', can); set('stand', can);
    set('dbl', can && h.cards.length === 2 && this.balC() >= h.bet);
    set('spl', can && this.hands.length === 1 && h.cards.length === 2 && cv(h.cards[0]) === cv(h.cards[1]) && this.balC() >= h.bet);
    const betting = this.betting();
    this.mainBtn.disabled = !betting;
    this.mainBtn.querySelector('.main-label').textContent = this.phase === 'end' ? 'NOUVELLE MAIN' : 'DISTRIBUER';
    this.q('[data-act="bet-"]').disabled = !betting || this.bi === 0;
    this.q('[data-act="bet+"]').disabled = !betting || this.bi === this.cfg.bets.length - 1;
    this.paintSides();
  }

  onMeters() { if (this.hands) this.renderActions(); }

  /* ---------- lightning ---------- */
  async strike() {
    const tiles = this.qa('.lb-tile'), board = this.q('.lb-board');
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
    const total = this.stakeLabel();
    if (!this.pay(total)) return;
    this.lastStake = total;
    SIDES.forEach((x) => { this.side[x.id] = this.sideAmt(x.id); });
    this.slotEl.classList.add('busy');
    this.startHand(this.bet).catch((e) => { console.error(e); this.phase = 'end'; this.slotEl.classList.remove('busy'); this.renderActions(); });
  }

  async startHand(bet) {
    this.results = []; this.hole = true; this.act = 0; this.sideRes = {};
    this.q('.dc').innerHTML = '';
    this.q('.lb-recap').classList.remove('on');
    this.qa('.lb-side').forEach((b) => b.classList.remove('won', 'lost'));
    const hs = this.q('.bj-hands');
    hs.innerHTML = '';
    this.hands = [{ cards: [], bet, done: false, split: false }];
    this.dealer = [];
    this.phase = 'deal';
    this.renderActions();
    this.setLast(0); this.winAmt.textContent = '';
    this.mult = lightning();
    await this.strike();
    if (this.dead) return;
    this.msg('Distribution…');
    hs.appendChild(this.buildHand());
    const pc = () => this.handEl(0).querySelector('.bj-cards');
    let c = this.draw(); this.hands[0].cards.push(c); await this.deal(pc(), c); this.paintTotals();
    c = this.draw(); this.dealer.push(c); await this.deal(this.q('.dc'), c); this.paintTotals();
    c = this.draw(); this.hands[0].cards.push(c); await this.deal(pc(), c); this.paintTotals();
    c = this.draw(); this.dealer.push(c); this.holeEl = await this.deal(this.q('.dc'), c, true); this.paintTotals();
    if (this.dead) return;
    this.resolveEarlySides();
    this.phase = 'play';
    if (isBJ(this.hands[0]) || this.dBJ()) return this.dealerPlay();
    this.msg('À toi : tirer, rester, doubler ou séparer.');
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
    const r = this.sideRes[id], b = this.q(`[data-side="${id}"]`);
    b.classList.add(r.pay ? 'won' : 'lost');
    b.querySelector('.lb-amt').textContent = r.pay ? `+${fmtC(r.pay)}` : 'Perdu';
    if (r.pay) { const p = center(b); fx.burst(p.x, p.y, 18, ['#fde047', '#4ade80', '#fff'], 6); this.floatAt(b, r.t, '#fde047', 16); sfx.coin(); }
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
    if (t > 21) { this.shake(this.handEl(this.act)); sfx.reelStop(0); }
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
    const live = this.hands.some((h) => score(h.cards).t <= 21) && !this.dBJ() && !(this.hands.length === 1 && isBJ(this.hands[0]));
    // the dealer also finishes the hand when Bust It is on the table
    const play = !this.dBJ() && (live || this.side.bust > 0);
    if (play) this.msg('Le croupier joue…');
    await this.wait(600);
    while (play && score(this.dealer).t < 17 && !this.dead) {
      const c = this.draw(); this.dealer.push(c);
      await this.deal(this.q('.dc'), c);
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
      if (ps > 21) res = { k: 'lose', t: 'Perdu (dépassé)' };
      else if (bj && !dbj) { profit = h.bet * 1.5; res = { k: 'win', t: 'Blackjack !' }; big = true; }
      else if (bj && dbj) { ret = h.bet; res = { k: 'push', t: 'Égalité' }; }
      else if (dbj) res = { k: 'lose', t: 'Blackjack du croupier' };
      else if (ds > 21 || ps > ds) { profit = h.bet; res = { k: 'win', t: 'Gagné' }; }
      else if (ps === ds) { ret = h.bet; res = { k: 'push', t: 'Égalité' }; }
      else res = { k: 'lose', t: 'Perdu' };
      const m = profit > 0 && ps >= 17 && ps <= 21 ? this.mult[ps] : 1;
      if (profit > 0) { profit = Math.round(profit * m); ret = h.bet + profit; res.t += m > 1 ? ` <span class="lb-x ${tier(m)}">⚡×${m}</span> +${fmtC(profit)}` : ` +${fmtC(profit)}`; if (m > 1) zap.push(ps); }
      res.ret = ret; res.m = m; res.ps = ps;
      payAll += ret;
      return res;
    });
    if (this.side.bust) {
      const n = this.dealer.length, k = ds > 21 ? bustPay(n) : 0;
      this.sideRes.bust = k ? { pay: this.side.bust * (1 + k), t: `Croupier sauté en ${n} cartes ${k}:1` } : { pay: 0, t: ds > 21 ? 'Sauté' : `Croupier à ${ds}` };
      this.showSide('bust');
    }
    const sidePay = Object.values(this.sideRes).reduce((a, r) => a + r.pay, 0);
    payAll += sidePay;
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
      if (r.k === 'win') { const p = center(el); fx.burst(p.x, p.y, big ? 40 : 20, ['#fde047', '#4ade80', '#fff'], 8); }
    });
    this.recap(payAll);
    if (payAll > 0) this.win(payAll, zap.length ? 'Éclair' : big ? 'Blackjack' : null);
    this.setLast(payAll);
    const net = payAll - this.lastStake;
    this.msg(net > 0 ? `Tu gagnes ${fmtC(net)}.` : net < 0 ? `Tu perds ${fmtC(-net)}.` : 'Égalité.');
    if (net > 0) { sfx.win(); if (big || zap.length) fx.confetti(50); }
    else if (net < 0) sfx.reelStop(0);
    this.slotEl.classList.remove('busy');
    this.renderActions();
    if (payAll >= this.lastStake * 10) await this.celebrate(payAll, { summary: zap.length ? 'GAIN ÉCLAIR' : null });
  }

  // End-of-round breakdown: every hand and side bet, with what it paid.
  recap(payAll) {
    const ds = score(this.dealer).t;
    const rows = this.hands.map((h, i) => {
      const r = this.results[i];
      return `<li class="${r.k}"><span>${this.hands.length > 1 ? `Main ${i + 1}` : 'Main'} · ${r.ps} contre ${ds > 21 ? 'sauté' : ds}</span><b>${r.k === 'win' ? `${r.m > 1 ? `⚡×${r.m} ` : ''}+${fmtC(r.ret)}` : r.k === 'push' ? `rendu ${fmtC(r.ret)}` : '—'}</b></li>`;
    });
    SIDES.forEach((x) => { const r = this.sideRes[x.id]; if (r) rows.push(`<li class="${r.pay ? 'win' : 'lose'}"><span>${x.name} · ${r.t}</span><b>${r.pay ? `+${fmtC(r.pay)}` : '—'}</b></li>`); });
    rows.push(`<li class="fee"><span>Frais éclair (25 %)</span><b>−${fmtC(this.fee())}</b></li>`);
    const net = payAll - this.lastStake;
    const box = this.q('.lb-recap');
    box.innerHTML = `<h4>Résultat de la manche</h4><ul>${rows.join('')}</ul><div class="lb-net ${net > 0 ? 'win' : net < 0 ? 'lose' : ''}">Total gagné ${fmtC(payAll)} · mise ${fmtC(this.lastStake)} · bilan ${net >= 0 ? '+' : '−'}${fmtC(Math.abs(net))}</div>`;
    box.classList.add('on');
  }

  info() {
    const lm = LM.filter((x) => x[0] > 1).map((x) => '×' + x[0]).join(', ');
    return this.rules(`<h4>Le jeu</h4><ul class="rules"><li>Sabot de 6 jeux. Approche 21 sans dépasser : figures = 10, As = 1 ou 11.</li><li><b>Tirer</b>, <b>Rester</b>, <b>Doubler</b> (mise ×2, une carte), <b>Séparer</b> une paire (une fois).</li><li>Le croupier tire jusqu’à 17 et reste sur tous les 17. Blackjack 3:2, victoire 1:1, égalité = mise rendue.</li></ul>
      <h4>⚡ Multiplicateurs éclair</h4><ul class="rules"><li>Avant chaque distribution, la foudre donne au hasard un multiplicateur à chacun des scores <b>17, 18, 19, 20 et 21</b> : ×1 ou ${lm}.</li><li>Si ta main <b>gagne</b> avec exactement ce score, ton gain de la manche est multiplié tout de suite (un blackjack compte comme 21).</li><li>Chaque distribution coûte la mise + <b>25 % de frais éclair</b> (non remboursés).</li></ul>
      <h4>Side bets</h4><ul class="rules"><li><b>Paires Parfaites</b> (tes 2 premières cartes) : paire mixte 6:1, paire de couleur 12:1, paire parfaite 25:1.</li><li><b>21+3</b> (tes 2 cartes + la carte visible du croupier) : couleur 5:1, suite 10:1, brelan 30:1, quinte flush 40:1, brelan couleur 100:1.</li><li><b>Bust It</b> (le croupier dépasse 21) : 3 cartes 1:1, 4 cartes 2:1, 5 cartes 9:1, 6 cartes 50:1, 7 cartes 100:1, 8 cartes ou plus 250:1.</li><li>Touche un side bet pour le poser : ½, 1 ou 2 fois la mise principale (re-touche pour changer ou enlever).</li></ul>`);
  }
}

return { LightningBJGame };
})();
