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
// Chips of the bottom bar, in cents (1 KE = 100). The stake is the sum of the chips placed on the spot.
const CHIPS = [[100, '1'], [500, '5'], [2500, '25'], [10000, '100'], [50000, '500'], [100000, '1K'], [500000, '5K']];
const MAXSTAKE = 1000000;

class BlackjackGame extends BaseGame {
  constructor(root, game) {
    super(root, game, {
      music: EXTRA_THEMES.blackjack, autoplay: false, turbo: true, mainLabel: 'DISTRIBUER', stepper: false, betLabel: 'Mise',
      cls: 'table-game bj',
      stage: `<div class="bjx">
        <div class="bjx-room"><i class="lamp a"></i><i class="lamp b"></i><i class="lamp c"></i><i class="far t1"></i><i class="far t2"></i></div>
        <div class="bjx-light"><div class="bulbs"><i class="g"></i><i class="o"></i><i class="r"></i></div><b class="bjx-state">FAITES VOS JEUX</b></div>
        <div class="bjx-croup"><svg class="bjx-dealer" viewBox="0 0 300 260" aria-hidden="true">
  <defs>
    <linearGradient id="bjxSkin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6d3b8"/><stop offset="1" stop-color="#d9a383"/></linearGradient>
    <linearGradient id="bjxHair" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3a2418"/><stop offset="1" stop-color="#140a06"/></linearGradient>
    <linearGradient id="bjxTop" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#262630"/><stop offset="1" stop-color="#0b0b10"/></linearGradient>
  </defs>
  <g class="bjx-body">
    <path d="M70 260 C70 205 92 178 150 172 C208 178 230 205 230 260 Z" fill="url(#bjxTop)"/>
    <path d="M120 176 Q150 214 180 176 L176 170 Q150 196 124 170 Z" fill="url(#bjxSkin)"/>
    <path d="M96 196 C88 178 112 166 124 170 L118 206 Z M204 196 C212 178 188 166 176 170 L182 206 Z" fill="url(#bjxSkin)" opacity=".9"/>
    <rect x="137" y="146" width="26" height="30" rx="10" fill="url(#bjxSkin)"/>
    <g class="bjx-arm l"><path d="M84 205 C66 232 62 252 78 260 L104 260 C98 246 100 232 106 218 Z" fill="url(#bjxSkin)"/></g>
    <g class="bjx-arm r"><path d="M216 205 C234 232 238 252 222 260 L196 260 C202 246 200 232 194 218 Z" fill="url(#bjxSkin)"/></g>
  </g>
  <g class="bjx-head">
    <path d="M150 40 C112 40 98 70 100 104 C102 140 112 168 104 176 C126 176 132 150 132 132 L168 132 C168 150 174 176 196 176 C188 168 198 140 200 104 C202 70 188 40 150 40 Z" fill="url(#bjxHair)"/>
    <ellipse cx="150" cy="106" rx="34" ry="42" fill="url(#bjxSkin)"/>
    <path d="M114 96 C118 62 182 62 186 96 C176 80 160 72 150 72 C136 72 124 80 114 96 Z" fill="url(#bjxHair)"/>
    <g class="bjx-eyes" fill="#2a1a12"><ellipse cx="137" cy="106" rx="4.2" ry="4.8"/><ellipse cx="163" cy="106" rx="4.2" ry="4.8"/></g>
    <path d="M129 96 Q137 92 144 96 M156 96 Q163 92 171 96" stroke="#2a1a12" stroke-width="2.2" fill="none" stroke-linecap="round"/>
    <path d="M148 112 Q146 122 152 123" stroke="#b9805e" stroke-width="1.6" fill="none"/>
    <path class="bjx-mouth" d="M139 131 Q150 138 161 131 Q150 134 139 131 Z" fill="#b5444f"/>
    <ellipse cx="128" cy="122" rx="6" ry="3.5" fill="#f1a9a0" opacity=".45"/><ellipse cx="172" cy="122" rx="6" ry="3.5" fill="#f1a9a0" opacity=".45"/>
  </g>
</svg></div>
        <div class="bj-table bjx-felt">
          <div class="bj-shoe"></div><div class="bjx-tray"></div><div class="bjx-plate"></div>
          <div class="bj-zone dealer"><div class="bj-label">Croupière <b class="dt"></b></div><div class="bj-cards dc"></div></div>
          <svg class="bjx-arc" viewBox="0 0 600 140" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            <path id="bjxA1" d="M40 20 Q300 150 560 20" fill="none"/><path id="bjxA2" d="M140 80 Q300 162 460 80" fill="none"/>
            <text class="t1"><textPath href="#bjxA1" startOffset="50%" text-anchor="middle">LE BLACKJACK PAIE 6 POUR 5</textPath></text>
            <text class="t2"><textPath href="#bjxA2" startOffset="50%" text-anchor="middle">La croupière reste à 17</textPath></text>
          </svg>
          <div class="bj-hands"></div>
          <div class="bjx-spots"><i></i><i></i><div class="bjx-spot main"><div class="bjx-stack"></div></div><i></i><i></i></div>
        </div>
      </div>`,
      below: `<div class="bj-actions"><button class="bj-btn" data-bj="hit">Tirer <small>+1 carte</small></button><button class="bj-btn" data-bj="stand">Rester</button><button class="bj-btn" data-bj="dbl">Doubler <small>×2, 1 carte</small></button><button class="bj-btn" data-bj="spl">Séparer <small>2 mains</small></button></div><div class="bjx-bar">
        <div class="bjx-info"><div><small>Solde</small><b class="bjx-bal"></b></div><div><small>Mise</small><b class="bjx-bet"></b></div></div>
        <button class="bjx-tool" data-bjx="undo"><i>↶</i><span>Annuler</span></button>
        <div class="bjx-chips">${CHIPS.map(([v, t]) => `<button class="bjx-chip c${t}" data-chip="${v}" aria-label="Jeton ${t}"><span>${t}</span></button>`).join('')}</div>
        <button class="bjx-tool" data-bjx="x2"><i>×2</i><span>Doubler</span></button>
        <button class="bjx-tool" data-bjx="repeat"><i>⟳</i><span>Répéter</span></button>
      </div>`,
      hello: 'Pose tes jetons sur la table, puis distribue.',
    });
    this.shoe = [];
    this.newShoe();
    this.phase = 'bet';
    this.hands = []; this.dealer = []; this.act = 0; this.hole = true; this.results = [];
    this.root.addEventListener('click', (e) => {
      const a = e.target.closest('[data-bj]')?.dataset.bj;
      if (a && !e.target.closest('[data-bj]').disabled) this[a]();
      const chip = e.target.closest('[data-chip]');
      if (chip && !chip.disabled) this.addChip(+chip.dataset.chip, chip);
      const t = e.target.closest('[data-bjx]');
      if (t && !t.disabled) this.tool(t.dataset.bjx);
    });
    this.croup = this.q('.bjx-croup');
    this.blinkT = setInterval(() => { if (!document.hidden) this.croupDo('blink', 180); }, 3800);
    this.renderActions();
  }

  // The stake replaces the usual −/+ ladder: it is the sum of the chips on the spot (kept between hands).
  get bet() { return this.stake ?? this.loadStake(); }
  loadStake() { let v = 100; try { v = Math.max(100, Math.min(MAXSTAKE, +localStorage.getItem('bjx_stake') || 100)); } catch { /* ignore */ } this.stake = v; this.chipsOn = [v]; return v; }
  saveStake() { try { localStorage.setItem('bjx_stake', String(this.stake)); } catch { /* ignore */ } }
  canBet() { return this.phase === 'bet' || this.phase === 'end'; }
  setStake(v, chips) {
    this.stake = Math.max(0, Math.min(MAXSTAKE, v)); this.chipsOn = chips || [this.stake];
    if (this.stake) this.saveStake();
    this.paintStake(); this.updateMeters(); this.renderActions();
  }
  addChip(v, node) {
    if (!this.canBet()) return;
    const room = Math.min(MAXSTAKE, this.balC()) - (this.stake || 0);
    if (v > room) { this.msg('Solde insuffisant pour ce jeton'); return; }
    if (this.phase === 'end') this.clearTable();
    // the chip flies from the bar to the spot
    const to = this.q('.bjx-stack').getBoundingClientRect(), from = node.getBoundingClientRect();
    const fly = node.cloneNode(true); fly.classList.add('bjx-fly');
    fly.style.cssText = `left:${from.left}px;top:${from.top}px;width:${from.width}px;height:${from.height}px`;
    document.body.appendChild(fly);
    fly.animate([{ transform: 'none' }, { transform: `translate(${to.left + to.width / 2 - from.left - from.width / 2}px, ${to.top - from.top - from.height / 3}px) scale(.7)` }], { duration: 320, easing: 'cubic-bezier(.3,.7,.4,1)' }).finished.then(() => fly.remove());
    sfx.click();
    setTimeout(() => this.setStake((this.stake || 0) + v, [...(this.chipsOn || []).filter(Boolean), v]), 300);
  }
  tool(k) {
    if (!this.canBet()) return;
    if (k === 'undo') { const c = (this.chipsOn || []).slice(); c.pop(); this.setStake(c.reduce((a, x) => a + x, 0), c); }
    if (k === 'x2') { const v = Math.min(MAXSTAKE, (this.stake || 0) * 2, this.balC()); this.setStake(v, [...(this.chipsOn || []), v - (this.stake || 0)].filter((x) => x > 0)); }
    if (k === 'repeat' && this.lastHand) this.setStake(Math.min(this.lastHand, this.balC()), [Math.min(this.lastHand, this.balC())]);
    sfx.click();
  }
  // Chip stack drawn on the main spot: the stake split into the biggest chips (at most 8 discs).
  paintStake() {
    const st = this.q('.bjx-stack'); if (!st) return;
    let v = this.stake || 0; const discs = [];
    for (let k = CHIPS.length - 1; k >= 0 && discs.length < 8; k--) while (v >= CHIPS[k][0] && discs.length < 8) { discs.push(CHIPS[k][1]); v -= CHIPS[k][0]; }
    st.innerHTML = discs.reverse().map((t, k) => `<i class="bjx-disc c${t}" style="--k:${k}"></i>`).join('') + (this.stake ? `<b>${fmtC(this.stake)}</b>` : '<em>Mise</em>');
    const bb = this.q('.bjx-bet'); if (bb) bb.textContent = fmtC(this.stake || 0);
    const bal = this.q('.bjx-bal'); if (bal) bal.textContent = fmtC(this.balC());
  }
  clearTable() { this.q('.dc').innerHTML = ''; this.q('.bj-hands').innerHTML = ''; this.hands = []; this.dealer = []; this.results = []; this.q('.dt').innerHTML = ''; this.phase = 'bet'; }
  croupDo(cls, ms) { const c = this.croup; if (!c) return; c.classList.remove(cls); void c.offsetWidth; c.classList.add(cls); setTimeout(() => c.classList.remove(cls), ms); }
  destroy() { clearInterval(this.blinkT); super.destroy(); }

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
    this.croupDo('deal', 360);
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
    this.mainBtn.disabled = !betting || !this.stake;
    this.mainBtn.querySelector('.main-label').textContent = this.phase === 'end' ? 'REJOUER' : 'DISTRIBUER';
    const room = Math.min(MAXSTAKE, this.balC()) - (this.stake || 0);
    this.qa('[data-chip]').forEach((c) => { c.disabled = !betting || +c.dataset.chip > room; });
    this.qa('[data-bjx]').forEach((t) => { t.disabled = !betting || (t.dataset.bjx === 'repeat' ? !this.lastHand : t.dataset.bjx === 'undo' ? !this.stake : !this.stake || room <= 0); });
    const st = betting ? ['g', 'FAITES VOS JEUX'] : this.phase === 'play' ? ['r', 'À VOUS DE JOUER'] : ['o', 'DISTRIBUTION'];
    const L = this.q('.bjx-light'); if (L) { L.dataset.s = st[0]; L.querySelector('.bjx-state').textContent = st[1]; }
    this.paintStake();
  }

  onMeters() { if (this.hands) this.renderActions(); else this.paintStake?.(); }

  onMain() {
    if (!(this.phase === 'bet' || this.phase === 'end')) return;
    const bet = this.stake || 0;
    if (!bet) { this.msg('Pose au moins un jeton sur la table'); return; }
    if (!this.pay(bet)) return;
    this.lastStake = bet; this.lastHand = bet;
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
    if (net > 0) { sfx.win(); this.croupDo('smile', 1600); if (big) { fx.confetti(60); sfx.bigWin(); } }
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
