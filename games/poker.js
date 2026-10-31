// SpinBet Casino · PokerGame — loaded on demand by games/impl/index.js (index.html).
// ---- games/impl/poker.js ----
__mods['games/impl/poker.js'] = (() => {
// Texas Hold'em No Limit against 1 to 5 bots. The buy-in comes from the wallet and goes back to it on leaving.
// Bots decide from a Monte Carlo equity of their hand, their profile and some noise.

const { BaseGame, fmtC } = __mods['core/base.js'];
const { EXTRA_THEMES } = __mods['core/music.js'];
const { sfx } = __mods['audio.js'];
const { fx, sleep, center } = __mods['fx.js'];
const { wallet } = __mods['wallet.js'];
const { toast } = __mods['ui.js'];

/* ===ENGINE */
const SUITS = ['♠', '♥', '♦', '♣'];
const FULL = []; for (let v = 2; v <= 14; v++) for (const s of SUITS) FULL.push({ v, s });
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const newDeck = () => shuffle(FULL.map((c) => ({ ...c })));
const mk = (cat, r) => ({ cat, r, score: cat * 759375 + r.reduce((a, x, i) => a + x * 15 ** (4 - i), 0) });
function straightHigh(vals) {
  const has = new Array(15).fill(false);
  vals.forEach((v) => { has[v] = true; if (v === 14) has[1] = true; });
  for (let h = 14; h >= 5; h--) { let ok = true; for (let k = 0; k < 5; k++) if (!has[h - k]) { ok = false; break; } if (ok) return h; }
  return 0;
}
// Best 5-card hand out of 5 to 7 cards. Categories: 0 high card … 8 straight flush.
function eval7(cards) {
  const cnt = new Array(15).fill(0), bySuit = {};
  for (const c of cards) { cnt[c.v]++; (bySuit[c.s] = bySuit[c.s] || []).push(c.v); }
  let fl = null; for (const s in bySuit) if (bySuit[s].length >= 5) fl = bySuit[s];
  if (fl) { const sf = straightHigh(fl); if (sf) return mk(8, [sf]); }
  const quads = [], trips = [], pairs = [], singles = [];
  for (let v = 14; v >= 2; v--) { if (cnt[v] === 4) quads.push(v); else if (cnt[v] === 3) trips.push(v); else if (cnt[v] === 2) pairs.push(v); else if (cnt[v] === 1) singles.push(v); }
  if (quads.length) return mk(7, [quads[0], Math.max(trips[0] || 0, pairs[0] || 0, singles[0] || 0)]);
  if (trips.length && (trips.length > 1 || pairs.length)) return mk(6, [trips[0], Math.max(trips[1] || 0, pairs[0] || 0)]);
  if (fl) return mk(5, fl.slice().sort((a, b) => b - a).slice(0, 5));
  const st = straightHigh(cards.map((c) => c.v));
  if (st) return mk(4, [st]);
  if (trips.length) return mk(3, [trips[0], ...singles.slice(0, 2)]);
  if (pairs.length >= 2) return mk(2, [pairs[0], pairs[1], Math.max(pairs[2] || 0, singles[0] || 0)]);
  if (pairs.length) return mk(1, [pairs[0], ...singles.slice(0, 3)]);
  return mk(0, singles.slice(0, 5));
}
const NM = (v) => (v <= 10 ? String(v) : ['Valet', 'Dame', 'Roi', 'As'][v - 11]);
const PL = (v) => (v <= 10 ? String(v) : ['Valets', 'Dames', 'Rois', 'As'][v - 11]);
const DE = (v) => (v === 14 ? 'd’As' : `de ${PL(v)}`);
function handName(h) {
  const r = h.r;
  return [`Carte haute ${NM(r[0])}`, `Paire ${DE(r[0])}`, `Double paire ${PL(r[0])} et ${PL(r[1])}`, `Brelan ${DE(r[0])}`, `Quinte hauteur ${NM(r[0])}`,
    `Couleur hauteur ${NM(r[0])}`, `Full aux ${PL(r[0])} par les ${PL(r[1])}`, `Carré ${DE(r[0])}`, r[0] === 14 ? 'Quinte flush royale' : `Quinte flush hauteur ${NM(r[0])}`][h.cat];
}
// Monte Carlo share of the pot won against nOpp random hands (ties split).
function equity(hole, board, nOpp, sims = 220) {
  const key = (c) => c.v * 4 + SUITS.indexOf(c.s);
  const known = new Set([...hole, ...board].map(key));
  const rest = FULL.filter((c) => !known.has(key(c)));
  const need = nOpp * 2 + (5 - board.length);
  let won = 0;
  for (let n = 0; n < sims; n++) {
    for (let i = 0; i < need; i++) { const j = i + Math.floor(Math.random() * (rest.length - i)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
    const b = board.concat(rest.slice(nOpp * 2, need));
    const me = eval7(hole.concat(b)).score;
    let lose = false, ties = 0;
    for (let o = 0; o < nOpp && !lose; o++) { const s = eval7([rest[o * 2], rest[o * 2 + 1], ...b]).score; if (s > me) lose = true; else if (s === me) ties++; }
    if (!lose) won += 1 / (ties + 1);
  }
  return won / sims;
}
// Main pot and side pots from what each player put in this hand.
function buildPots(players) {
  const con = players.filter((p) => p.total > 0);
  const levels = [...new Set(con.map((p) => p.total))].sort((a, b) => a - b);
  const pots = []; let prev = 0;
  for (const lv of levels) {
    const amount = con.reduce((a, p) => a + Math.min(p.total, lv) - Math.min(p.total, prev), 0);
    const elig = con.filter((p) => !p.folded && p.total >= lv);
    prev = lv;
    if (!amount) continue;
    const last = pots[pots.length - 1];
    if (!elig.length && last) last.amount += amount;
    else if (last && last.elig.length === elig.length && last.elig.every((p) => elig.includes(p))) last.amount += amount;
    else pots.push({ amount, elig });
  }
  return pots;
}
/* ===END ENGINE */

const BOTS = [
  { name: 'Tex', av: '🤠', style: 'Requin', tight: 0.04, agg: 0.6, bluff: 0.08 },
  { name: 'Lola', av: '👩‍🦰', style: 'Agressive', tight: -0.04, agg: 0.85, bluff: 0.14 },
  { name: 'Big Ben', av: '🐻', style: 'Prudent', tight: 0.12, agg: 0.25, bluff: 0.02 },
  { name: 'Renard', av: '🦊', style: 'Bluffeur', tight: -0.07, agg: 0.7, bluff: 0.26 },
  { name: 'Mamie Jo', av: '👵', style: 'Suiveuse', tight: -0.1, agg: 0.15, bluff: 0.03, station: true },
  { name: 'Ace', av: '🕶️', style: 'Imprévisible', tight: 0, agg: 0.55, bluff: 0.18, wild: 0.14 },
];
const BLINDS = [[5, 10], [25, 50], [100, 200], [500, 1000]]; // cents
const DEPTHS = [50, 100, 200]; // starting stack in big blinds
const SLOTS = { 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 5], 5: [0, 1, 2, 4, 5], 6: [0, 1, 2, 3, 4, 5] };
// seat centres (%) on the wide oval and on the tall (phone) oval, clockwise from the player at the bottom
const POS = [[50, 83, 50, 87], [9, 64, 13, 67], [15, 15, 13, 27], [50, 7, 50, 7], [85, 15, 87, 27], [91, 64, 87, 67]];
const CEN = [50, 47];
const FACE = (c) => `<span class="r">${c.v <= 10 ? c.v : 'JQKA'[c.v - 11]}</span><span class="s">${c.s}</span>`;
const RED = (c) => c.s === '♥' || c.s === '♦';
const STREETS = ['Pré-flop', 'Flop', 'Turn', 'River'];

class PokerGame extends BaseGame {
  constructor(root, game) {
    super(root, game, {
      music: EXTRA_THEMES.blackjack, stepper: false, autoplay: false, turbo: true, mainLabel: 'LANCER LA PARTIE', betLabel: 'Ton tapis',
      cls: 'table-game poker',
      stage: `<div class="pk">
        <div class="pk-setup">
          <div class="pk-hero"><span>♠ ♥ ♦ ♣</span><h3>Texas Hold’em</h3><p>No Limit · table de 2 à 6 joueurs</p></div>
          <div class="pk-opt"><label>Adversaires</label><div class="pk-seg" data-o="bots">${[1, 2, 3, 4, 5].map((n) => `<button data-v="${n}">${n} bot${n > 1 ? 's' : ''}</button>`).join('')}</div><div class="pk-faces"></div></div>
          <div class="pk-opt"><label>Blindes (petite / grosse)</label><div class="pk-seg" data-o="blind">${BLINDS.map((b, i) => `<button data-v="${i}">${fmtC(b[0])} / ${fmtC(b[1])}</button>`).join('')}</div></div>
          <div class="pk-opt"><label>Tapis de départ (pour toi et chaque bot)</label><div class="pk-seg" data-o="depth"></div></div>
          <p class="pk-note">Ton tapis est pris sur ton solde. Quand tu quittes la table, il t’est rendu avec tes gains.</p>
          <button class="pk-go">▶ Lancer la partie</button>
        </div>
        <div class="pk-table" hidden>
          <div class="pk-top"><span class="pk-info"></span><button class="pk-quit">Quitter la table</button></div>
          <div class="pk-felt"><div class="pk-oval"></div>
            <div class="pk-center"><div class="pk-pot">Pot <b>0</b></div><div class="pk-board">${'<i class="pk-slot"></i>'.repeat(5)}</div><div class="pk-hand"></div></div>
            <div class="pk-seats"></div>
            <div class="pk-over" hidden></div>
          </div>
        </div>
      </div>`,
      below: `<div class="pk-bar off">
        <div class="pk-quick"><button data-pq="min">Min</button><button data-pq=".5">½ pot</button><button data-pq=".75">¾ pot</button><button data-pq="1">Pot</button><button data-pq="all">Tapis</button></div>
        <div class="pk-raise"><input type="range" class="pk-range" min="0" max="1" value="0" aria-label="Montant de la mise"><b class="pk-amt"></b></div>
        <div class="pk-acts"><button data-pa="fold" class="fold">Se coucher</button><button data-pa="call" class="call">Parole</button><button data-pa="raise" class="raise">Miser</button></div>
      </div>`,
      hello: 'Choisis tes adversaires, les blindes et ton tapis, puis lance la partie.',
    });
    this.opt = { bots: 3, blind: 0, depth: 1 };
    try { Object.assign(this.opt, JSON.parse(localStorage.getItem('poker_opt') || '{}')); } catch { /* ignore */ }
    this.state = 'setup';
    this.tok = 0;
    this.players = [];
    this.root.addEventListener('click', (e) => this.onTap(e));
    this.q('.pk-range').addEventListener('input', () => this.paintRaise());
    this.paintSetup();
  }

  /* ---------- setup ---------- */
  bb() { return BLINDS[this.opt.blind][1]; }
  sb() { return BLINDS[this.opt.blind][0]; }
  buyIn() { return DEPTHS[this.opt.depth] * this.bb(); }
  stakeLabel() { return this.state === 'setup' || !this.me ? (this.opt ? this.buyIn() : 0) : this.me.stack; }
  onMeters() { if (this.mainBtn && this.state) this.paintMain(); }

  paintSetup() {
    this.q('.pk-seg[data-o="depth"]').innerHTML = DEPTHS.map((d, i) => `<button data-v="${i}">${d} BB · ${fmtC(d * this.bb())}</button>`).join('');
    this.qa('.pk-seg').forEach((s) => s.querySelectorAll('button').forEach((b) => b.classList.toggle('on', +b.dataset.v === this.opt[s.dataset.o])));
    this.q('.pk-faces').innerHTML = BOTS.slice(0, this.opt.bots).map((b) => `<span><i>${b.av}</i><b>${b.name}</b><small>${b.style}</small></span>`).join('');
    try { localStorage.setItem('poker_opt', JSON.stringify(this.opt)); } catch { /* ignore */ }
    this.updateMeters();
  }

  paintMain() {
    const lab = this.mainBtn.querySelector('.main-label');
    const L = { setup: 'LANCER LA PARTIE', between: 'MAIN SUIVANTE', over: 'NOUVELLE PARTIE' };
    lab.textContent = L[this.state] || 'EN JEU';
    this.mainBtn.disabled = !L[this.state];
  }

  onTap(e) {
    const t = e.target.closest('button');
    if (!t || t.disabled) return;
    const seg = t.closest('.pk-seg');
    if (seg && this.state === 'setup') { this.opt[seg.dataset.o] = +t.dataset.v; sfx.click(); this.paintSetup(); return; }
    if (t.classList.contains('pk-go')) return this.onMain();
    if (t.classList.contains('pk-quit')) return this.quit();
    if (t.dataset.pq) return this.quickRaise(t.dataset.pq);
    if (t.dataset.pa && this.humanRes) {
      const a = t.dataset.pa, res = this.humanRes; this.humanRes = null;
      this.q('.pk-bar').classList.add('off');
      if (a === 'raise') res({ a: 'raise', to: +this.q('.pk-range').value });
      else res({ a: this.toCall(this.me) ? (a === 'call' ? 'call' : 'fold') : (a === 'call' ? 'check' : 'fold') });
    }
  }

  onMain() {
    if (this.state === 'setup') this.start();
    else if (this.state === 'between') this.nextNow?.();
    else if (this.state === 'over') this.toSetup();
  }

  start() {
    const buy = this.buyIn();
    if (!this.pay(buy)) return;
    this.buy = buy; this.cashed = false; this.handNo = 0; this.pot = 0; this.board = []; this.cur = 0; this.tok++;
    const bots = BOTS.slice(0, this.opt.bots);
    this.players = [{ name: 'Toi', av: '😎', human: true }, ...bots.map((b) => ({ ...b }))].map((p, i) => ({ ...p, i, stack: buy, cards: [], folded: false, allIn: false, bet: 0, total: 0, out: false }));
    this.me = this.players[0];
    this.dealer = Math.floor(Math.random() * this.players.length);
    this.q('.pk-setup').hidden = true;
    this.q('.pk-table').hidden = false;
    this.q('.pk-over').hidden = true;
    this.buildSeats();
    this.state = 'play';
    this.updateMeters();
    sfx.click();
    this.loop(this.tok);
  }

  toSetup() {
    this.tok++;
    this.state = 'setup';
    this.q('.pk-table').hidden = true;
    this.q('.pk-setup').hidden = false;
    this.q('.pk-bar').classList.add('off');
    this.msg('Choisis tes adversaires, les blindes et ton tapis, puis lance la partie.');
    this.paintSetup();
  }

  // Leaving the table: your stack goes back to your balance (chips already in the pot are lost, like a fold).
  quit() {
    if (this.state === 'setup') return;
    const back = this.cashOut();
    if (this.humanRes) { const r = this.humanRes; this.humanRes = null; r({ a: 'fold' }); }
    toast(back > 0 ? `Tu quittes la table : ${fmtC(back)} rendus sur ton solde` : 'Tu quittes la table');
    this.toSetup();
  }

  cashOut() {
    if (this.cashed || !this.me) return 0;
    this.cashed = true;
    const s = this.me.stack;
    if (s > 0) wallet.credit(s / 100, s > this.buy ? { game: 'Texas Hold’em', x: s / this.buy } : undefined);
    this.updateMeters();
    return s;
  }

  destroy() { this.tok++; if (this.state !== 'setup') this.cashOut(); super.destroy(); }

  /* ---------- table drawing ---------- */
  buildSeats() {
    const n = this.players.length, slots = SLOTS[n];
    const lerp = (a, b, k) => a + (b - a) * k;
    this.q('.pk-seats').innerHTML = this.players.map((p, i) => {
      const [x, y, xm, ym] = POS[slots[i]];
      const bx = i === 0 ? 64 : lerp(x, CEN[0], 0.42), by = lerp(y, CEN[1], i === 0 ? 0.3 : 0.45), bxm = i === 0 ? 74 : lerp(xm, CEN[0], 0.4), bym = lerp(ym, CEN[1], i === 0 ? 0.28 : 0.4);
      return `<div class="pk-seat${p.human ? ' me' : ''}" data-i="${i}" style="--x:${x}%;--y:${y}%;--xm:${xm}%;--ym:${ym}%">
          <div class="pk-cards"></div>
          <div class="pk-av">${p.av}<i class="pk-dbtn">D</i></div>
          <div class="pk-plate"><b>${p.name}</b>${p.human ? '' : `<small>${p.style}</small>`}<em class="pk-stack"></em></div>
          <div class="pk-bubble"></div><div class="pk-hn"></div>
        </div>
        <div class="pk-bet" data-i="${i}" style="--x:${bx}%;--y:${by}%;--xm:${bxm}%;--ym:${bym}%"><i></i><b></b></div>`;
    }).join('');
    this.paintSeats();
  }

  seat(p) { return this.q(`.pk-seat[data-i="${p.i}"]`); }
  betEl(p) { return this.q(`.pk-bet[data-i="${p.i}"]`); }

  paintSeats() {
    for (const p of this.players) {
      const s = this.seat(p);
      s.querySelector('.pk-stack').textContent = p.out ? 'Éliminé' : p.allIn ? 'TAPIS' : fmtC(p.stack);
      s.classList.toggle('out', p.out);
      s.classList.toggle('folded', p.folded && !p.out);
      s.classList.toggle('dealer', p.i === this.dealer);
      const be = this.betEl(p);
      be.classList.toggle('on', p.bet > 0);
      be.querySelector('b').textContent = p.bet ? fmtC(p.bet) : '';
    }
    const inPlay = this.pot + this.players.reduce((a, p) => a + p.bet, 0);
    this.q('.pk-pot b').textContent = fmtC(inPlay || 0);
    const alive = this.players.filter((p) => !p.out).length;
    this.q('.pk-info').textContent = `Main n°${this.handNo} · Blindes ${fmtC(this.sb())} / ${fmtC(this.bb())} · ${alive} joueur${alive > 1 ? 's' : ''}`;
    this.updateMeters();
  }

  say(p, text, cls = '') {
    const b = this.seat(p).querySelector('.pk-bubble');
    b.textContent = text;
    b.className = `pk-bubble on ${cls}`;
    clearTimeout(p.sayT);
    p.sayT = setTimeout(() => b.classList.remove('on'), 1800);
  }

  cardNode(c, faceUp, cls = '') {
    const d = document.createElement('div');
    d.className = `pk-card ${cls}${faceUp ? '' : ' back'}${RED(c) ? ' red' : ''}`;
    if (faceUp) d.innerHTML = FACE(c);
    return d;
  }

  // card flies from the dealer's deck in the middle of the table
  fly(node, ms) {
    const from = this.q('.pk-pot').getBoundingClientRect(), r = node.getBoundingClientRect();
    node.animate([{ transform: `translate(${from.left + from.width / 2 - r.left - r.width / 2}px, ${from.top - r.top}px) rotate(-30deg) scale(.4)`, opacity: 0 }, { opacity: 1, offset: 0.2 }, { transform: 'none' }],
      { duration: ms, easing: 'cubic-bezier(.25,.7,.3,1)' });
  }

  flip(node, c) {
    const d = this.turbo ? 90 : 150;
    node.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }], { duration: d, easing: 'ease-in' }).finished.then(() => {
      node.classList.remove('back'); node.innerHTML = FACE(c);
      node.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: d, easing: 'ease-out' });
    });
  }

  // bets slide into the pot at the end of each betting round
  async collect() {
    const pot = this.q('.pk-pot').getBoundingClientRect();
    let any = false;
    for (const p of this.players) {
      if (!p.bet) continue;
      any = true;
      const e = this.betEl(p), r = e.getBoundingClientRect();
      e.animate([{ transform: 'translate(-50%,-50%)' }, { transform: `translate(calc(-50% + ${pot.left + pot.width / 2 - r.left - r.width / 2}px), calc(-50% + ${pot.top + pot.height / 2 - r.top - r.height / 2}px)) scale(.6)`, opacity: 0.2 }], { duration: this.turbo ? 200 : 380, easing: 'ease-in' });
    }
    if (any) { sfx.coin(); await sleep(this.turbo ? 200 : 380); }
    for (const p of this.players) { this.pot += p.bet; p.bet = 0; }
    this.paintSeats();
  }

  chipsTo(p, amount) {
    const pot = this.q('.pk-pot').getBoundingClientRect(), s = this.seat(p).querySelector('.pk-av').getBoundingClientRect();
    const c = document.createElement('div');
    c.className = 'pk-fly';
    c.textContent = '+' + fmtC(amount);
    c.style.cssText = `left:${pot.left + pot.width / 2}px;top:${pot.top + pot.height / 2}px`;
    document.body.appendChild(c);
    c.animate([{ transform: 'translate(-50%,-50%) scale(.7)', opacity: 0 }, { opacity: 1, offset: 0.15 }, { transform: `translate(calc(-50% + ${s.left + s.width / 2 - pot.left - pot.width / 2}px), calc(-50% + ${s.top + s.height / 2 - pot.top - pot.height / 2}px)) scale(1.1)`, opacity: 1 }],
      { duration: this.turbo ? 450 : 800, easing: 'cubic-bezier(.3,.6,.3,1)', fill: 'forwards' });
    setTimeout(() => c.remove(), (this.turbo ? 450 : 800) + 500);
  }

  paintHand() {
    const el = this.q('.pk-hand');
    if (!this.me.cards.length || this.me.out) { el.textContent = ''; return; }
    const h = eval7(this.me.cards.concat(this.board));
    el.innerHTML = `${this.me.folded ? 'Couché · ' : 'Ta main : '}<b>${handName(h)}</b>`;
  }

  /* ---------- game loop ---------- */
  async loop(tok) {
    const ok = () => !this.dead && tok === this.tok;
    while (ok()) {
      await this.playHand(tok);
      if (!ok()) return;
      this.players.forEach((p) => { if (p.stack <= 0) p.out = true; });
      this.paintSeats();
      const alive = this.players.filter((p) => !p.out);
      if (this.me.out || alive.length === 1) return this.gameOver(this.me.out ? 'lose' : 'win');
      this.state = 'between';
      this.updateMeters();
      await Promise.race([this.wait(4200), new Promise((r) => { this.nextNow = r; })]);
      this.nextNow = null;
      if (!ok()) return;
      this.state = 'play';
      this.updateMeters();
    }
  }

  gameOver(kind) {
    this.state = 'over';
    const s = this.me.stack, back = this.cashOut(), net = s - this.buy;
    const ov = this.q('.pk-over');
    ov.innerHTML = kind === 'win'
      ? `<h3>🏆 Tu as raflé la table !</h3><p>Tous les bots sont éliminés.</p><p>${fmtC(back)} rendus sur ton solde (${net >= 0 ? '+' : '−'}${fmtC(Math.abs(net))})</p>`
      : '<h3>Éliminé…</h3><p>Tu n’as plus de jetons. Retente ta chance !</p>';
    ov.hidden = false;
    if (kind === 'win') { fx.confetti(90); sfx.bigWin(); } else sfx.reelStop(0);
    this.msg(kind === 'win' ? 'Victoire ! Lance une nouvelle partie quand tu veux.' : 'Partie terminée.');
    this.updateMeters();
  }

  live() { return this.players.filter((p) => !p.out && !p.folded); }
  nextFrom(i, f = (p) => !p.out) { const n = this.players.length; for (let k = 1; k <= n; k++) { const p = this.players[(i + k) % n]; if (f(p)) return p; } return null; }
  toCall(p) { return Math.max(0, this.cur - p.bet); }

  put(p, amount) {
    const a = Math.min(amount, p.stack);
    p.stack -= a; p.bet += a; p.total += a;
    if (p.stack === 0) p.allIn = true;
    return a;
  }

  async playHand(tok) {
    const ok = () => !this.dead && tok === this.tok;
    const W = (ms) => this.wait(ms);
    this.handNo++;
    this.pot = 0; this.board = []; this.cur = 0;
    for (const p of this.players) Object.assign(p, { cards: [], folded: p.out, allIn: false, bet: 0, total: 0 });
    this.qa('.pk-cards').forEach((e) => { e.innerHTML = ''; });
    this.qa('.pk-hn').forEach((e) => { e.textContent = ''; e.className = 'pk-hn'; });
    this.qa('.pk-seat').forEach((e) => e.classList.remove('win', 'lose', 'turn'));
    this.qa('.pk-slot').forEach((e) => { e.innerHTML = ''; });
    this.q('.pk-hand').textContent = '';
    this.setLast(0);
    // button and blinds (heads-up: the button posts the small blind)
    this.dealer = this.nextFrom(this.dealer).i;
    const D = this.players[this.dealer], heads = this.players.filter((p) => !p.out).length === 2;
    const SB = heads ? D : this.nextFrom(D.i), BB = this.nextFrom(SB.i);
    this.put(SB, this.sb()); this.put(BB, this.bb());
    this.cur = this.bb(); this.minRaise = this.bb();
    this.paintSeats();
    this.say(SB, `Petite blinde ${fmtC(SB.bet)}`); this.say(BB, `Grosse blinde ${fmtC(BB.bet)}`);
    this.msg(`Main n°${this.handNo} : ${D.human ? 'tu as' : `${D.name} a`} le bouton.`);
    // two private cards each, one at a time, starting left of the button
    const deck = newDeck();
    for (let r = 0; r < 2; r++) {
      let p = SB;
      do {
        const c = deck.pop(); p.cards.push(c);
        const node = this.cardNode(c, p.human, p.human ? 'big' : 'mini');
        this.seat(p).querySelector('.pk-cards').appendChild(node);
        this.fly(node, this.turbo ? 160 : 280);
        sfx.click();
        await sleep(this.turbo ? 60 : 120);
        p = this.nextFrom(p.i);
      } while (p !== SB);
    }
    if (!ok()) return;
    this.paintHand();
    await W(300);
    for (let st = 0; st < 4; st++) {
      if (st > 0) {
        await this.collect();
        const n = st === 1 ? 3 : 1;
        deck.pop(); // burn
        for (let k = 0; k < n; k++) {
          const c = deck.pop(); this.board.push(c);
          const node = this.cardNode(c, false, 'board');
          this.qa('.pk-slot')[this.board.length - 1].appendChild(node);
          this.fly(node, this.turbo ? 160 : 300);
          await sleep(this.turbo ? 160 : 300);
          this.flip(node, c);
          sfx.click();
          await sleep(this.turbo ? 80 : 160);
        }
        this.msg(`${STREETS[st]} : ${this.board.map((c) => (c.v <= 10 ? c.v : 'JQKA'[c.v - 11]) + c.s).join(' ')}`);
        this.paintHand();
        if (!ok()) return;
        await W(350);
        this.cur = 0; this.minRaise = this.bb();
      }
      if (this.live().length > 1) await this.betting(st, st === 0 ? this.nextFrom(BB.i) : this.nextFrom(D.i), ok);
      if (!ok()) return;
      if (this.live().length === 1) break;
    }
    if (!ok()) return;
    await this.collect();
    await this.showdown(ok);
  }

  async betting(st, first, ok) {
    const acted = new Set();
    let p = first;
    for (let guard = 0; guard < 200; guard++) {
      if (!ok()) return;
      const live = this.live();
      if (live.length <= 1) return;
      const can = live.filter((x) => !x.allIn);
      if (can.every((x) => acted.has(x) && x.bet === this.cur)) return;
      if (can.length <= 1 && can.every((x) => x.bet >= this.cur)) return;
      if (!p.folded && !p.out && !p.allIn && !(acted.has(p) && p.bet === this.cur)) {
        this.qa('.pk-seat').forEach((e) => e.classList.remove('turn'));
        this.seat(p).classList.add('turn');
        const act = p.human ? await this.humanAct(p) : await this.botAct(p, st);
        if (!ok()) return;
        this.seat(p).classList.remove('turn');
        this.apply(p, act, acted);
        await this.wait(p.human ? 150 : 350);
      }
      p = this.nextFrom(p.i);
    }
  }

  apply(p, act, acted) {
    const tc = this.toCall(p), who = p.human ? 'Tu' : p.name;
    let text, cls = '';
    if (act.a === 'fold') { p.folded = true; text = 'Se couche'; cls = 'fold'; this.msg(`${who} ${p.human ? 'te couches' : 'se couche'}.`); this.seat(p).querySelectorAll('.pk-card').forEach((c) => c.classList.add('dead')); }
    else if (act.a === 'check' || (act.a === 'call' && !tc)) { text = 'Parole'; this.msg(`${who} ${p.human ? 'checkes' : 'checke'}.`); }
    else if (act.a === 'call') { const a = this.put(p, tc); text = p.allIn ? `Tapis ! ${fmtC(p.total)}` : `Suit ${fmtC(a)}`; this.msg(`${who} ${p.human ? 'suis' : 'suit'} ${fmtC(a)}.`); sfx.coin(); }
    else {
      const to = Math.min(Math.max(act.to, this.cur + this.minRaise), p.bet + p.stack);
      const before = this.cur;
      this.put(p, to - p.bet);
      if (p.bet > before) { const inc = p.bet - before; if (inc >= this.minRaise) this.minRaise = inc; this.cur = p.bet; acted.clear(); }
      text = p.allIn ? `Tapis ! ${fmtC(p.total)}` : before ? `Relance à ${fmtC(p.bet)}` : `Mise ${fmtC(p.bet)}`;
      cls = 'raise';
      this.msg(p.allIn ? `${who} ${p.human ? 'fais' : 'fait'} tapis : ${fmtC(p.total)} au total !` : before ? `${who} ${p.human ? 'relances' : 'relance'} à ${fmtC(p.bet)}.` : `${who} ${p.human ? 'mises' : 'mise'} ${fmtC(p.bet)}.`);
      sfx.coin();
    }
    acted.add(p);
    this.say(p, text, cls);
    this.paintSeats();
    if (p.human) this.paintHand();
  }

  /* ---------- the player ---------- */
  raiseBounds(p) {
    const max = p.bet + p.stack, min = Math.min(max, this.cur ? this.cur + this.minRaise : this.bb());
    return { min, max };
  }

  humanAct(p) {
    const tc = this.toCall(p), { min, max } = this.raiseBounds(p);
    const bar = this.q('.pk-bar'), rg = this.q('.pk-range');
    bar.classList.remove('off');
    const canRaise = p.stack > tc && this.live().some((x) => x !== p && !x.allIn);
    const call = this.q('[data-pa="call"]');
    call.textContent = tc ? (tc >= p.stack ? `Tapis ${fmtC(p.stack)}` : `Suivre ${fmtC(tc)}`) : 'Parole';
    this.q('[data-pa="fold"]').textContent = tc ? 'Se coucher' : 'Se coucher';
    rg.min = min; rg.max = max; rg.step = this.sb(); rg.value = min;
    bar.classList.toggle('noraise', !canRaise);
    this.q('[data-pa="raise"]').disabled = !canRaise;
    this.paintRaise();
    this.msg(tc ? `À toi : ${fmtC(tc)} à suivre.` : 'À toi de parler.');
    sfx.tick();
    return new Promise((res) => { this.humanRes = res; });
  }

  quickRaise(k) {
    const p = this.me, rg = this.q('.pk-range');
    if (!this.humanRes) return;
    const { min, max } = this.raiseBounds(p);
    const pot = this.pot + this.players.reduce((a, x) => a + x.bet, 0), tc = this.toCall(p);
    let v = k === 'min' ? min : k === 'all' ? max : this.cur + Math.round((pot + tc) * +k);
    v = Math.round(v / this.sb()) * this.sb();
    rg.value = Math.max(min, Math.min(max, v));
    sfx.click();
    this.paintRaise();
  }

  paintRaise() {
    const p = this.me; if (!p) return;
    const v = +this.q('.pk-range').value, all = v >= p.bet + p.stack;
    this.q('.pk-amt').textContent = fmtC(v);
    this.q('[data-pa="raise"]').textContent = all ? `Tapis ${fmtC(v)}` : this.cur ? `Relancer à ${fmtC(v)}` : `Miser ${fmtC(v)}`;
  }

  /* ---------- the bots ---------- */
  async botAct(p, st) {
    const seat = this.seat(p);
    seat.classList.add('think');
    await this.wait(550 + Math.random() * 700);
    seat.classList.remove('think');
    return this.decide(p, st);
  }

  // Hand strength (Monte Carlo equity against the players still in) + the bot's profile + a little noise.
  decide(p, st) {
    const opp = this.live().length - 1, eq = equity(p.cards, this.board, Math.max(1, opp), opp > 3 ? 160 : 220);
    const e = eq + (Math.random() - 0.5) * (0.08 + (p.wild || 0)) - p.tight;
    const tc = this.toCall(p), pot = this.pot + this.players.reduce((a, x) => a + x.bet, 0);
    const odds = tc / (pot + tc), fair = 1 / (opp + 1), r = Math.random();
    const strong = e > Math.max(0.5, fair * 1.9), monster = e > Math.max(0.72, fair * 2.7);
    const { min, max } = this.raiseBounds(p);
    const canRaise = p.stack > tc && this.live().some((x) => x !== p && !x.allIn);
    const size = (k) => {
      let to = st === 0 && this.cur <= this.bb() ? this.bb() * (2.5 + Math.random() * 1.5) : this.cur + (pot + tc) * k;
      if (st === 0 && this.cur > this.bb()) to = this.cur * (2.5 + Math.random());
      to = Math.round(to / this.sb()) * this.sb();
      to = Math.max(min, Math.min(max, to));
      if (to > max * 0.7 || (monster && p.stack < this.bb() * 12)) to = max;
      return { a: 'raise', to };
    };
    if (!tc) {
      if (canRaise && (monster || (strong && r < 0.3 + p.agg * 0.5) || (st > 0 && r < p.bluff))) return size(monster ? 0.6 + Math.random() * 0.5 : 0.45 + Math.random() * 0.4);
      return { a: 'check' };
    }
    if (canRaise && monster && r < 0.35 + p.agg * 0.5) return size(0.7 + Math.random() * 0.6);
    if (e >= odds * 1.05 + 0.02 || (p.station && e >= odds * 0.7)) {
      if (canRaise && strong && r < p.agg * 0.4) return size(0.6 + Math.random() * 0.4);
      return { a: 'call' };
    }
    if (canRaise && r < p.bluff * 0.4 && tc < pot * 0.6) return size(0.6 + Math.random() * 0.4);
    if (tc <= this.bb() && e > fair * 0.8) return { a: 'call' };
    return { a: 'fold' };
  }

  /* ---------- showdown ---------- */
  async showdown(ok) {
    this.qa('.pk-seat').forEach((e) => e.classList.remove('turn'));
    const live = this.live();
    let lines = [];
    if (live.length === 1) {
      const w = live[0], amt = this.pot;
      w.stack += amt;
      this.chipsTo(w, amt);
      lines.push(`${w.human ? 'Tu remportes' : `${w.name} remporte`} ${fmtC(amt)}${w.human ? '' : ' (tout le monde s’est couché)'}.`);
      this.seat(w).classList.add('win');
      if (w.human) { this.setLast(amt); sfx.win(); }
    } else {
      // reveal the bots' cards, one hand after the other
      for (const p of live) {
        if (!p.human) { this.seat(p).querySelectorAll('.pk-card').forEach((n, k) => this.flip(n, p.cards[k])); await this.wait(300); }
        p.hand = eval7(p.cards.concat(this.board));
        const hn = this.seat(p).querySelector('.pk-hn'); hn.textContent = handName(p.hand); hn.className = 'pk-hn on';
      }
      await this.wait(600);
      if (!ok()) return;
      const pots = buildPots(this.players);
      const winners = new Set();
      pots.forEach((pt, k) => {
        const best = Math.max(...pt.elig.map((p) => p.hand.score));
        const ws = pt.elig.filter((p) => p.hand.score === best);
        if (pt.elig.length === 1) { ws[0].stack += pt.amount; this.chipsTo(ws[0], pt.amount); if (k) lines.push(`${ws[0].human ? 'Ta mise non suivie t’est rendue' : `Mise non suivie rendue à ${ws[0].name}`} (${fmtC(pt.amount)}).`); return; }
        const share = Math.floor(pt.amount / ws.length), rest = pt.amount - share * ws.length;
        ws.forEach((w, j) => { const a = share + (j === 0 ? rest : 0); w.stack += a; this.chipsTo(w, a); winners.add(w); if (w.human) this.setLast(a); });
        const label = pots.length > 1 ? (k === 0 ? 'Pot principal' : `Pot secondaire ${k}`) : 'Pot';
        lines.push(`${label} ${fmtC(pt.amount)} : ${ws.map((w) => (w.human ? 'toi' : w.name)).join(' et ')}${ws.length > 1 ? ' (partagé)' : ''} avec ${handName(ws[0].hand)}`);
      });
      live.forEach((p) => this.seat(p).classList.add(winners.has(p) ? 'win' : 'lose'));
      if (winners.has(this.me)) { sfx.win(); const c = center(this.seat(this.me)); fx.burst(c.x, c.y, 30, ['#fde047', '#4ade80', '#fff'], 7); }
    }
    this.pot = 0;
    this.players.forEach((p) => { p.allIn = false; });
    this.msg(lines.join(' · '));
    this.paintSeats();
    this.q('.pk-pot b').textContent = fmtC(0);
  }

  info() {
    return this.rules(`<h4>Déroulement</h4><ul class="rules"><li>Choisis 1 à 5 bots, les blindes et ton tapis de départ (le même pour tout le monde), puis lance la partie.</li><li>Le bouton du donneur tourne à chaque main : le joueur à sa gauche paie la <b>petite blinde</b>, le suivant la <b>grosse blinde</b> (à deux joueurs, le donneur paie la petite blinde).</li><li>Chacun reçoit 2 cartes cachées. Quatre tours d’enchères : <b>pré-flop</b>, <b>flop</b> (3 cartes communes), <b>turn</b> (4e carte) et <b>river</b> (5e carte).</li><li>À ton tour : <b>Se coucher</b>, <b>Parole</b> (checker), <b>Suivre</b> ou <b>Miser / Relancer</b> (raccourcis Min, ½ pot, ¾ pot, Pot, Tapis, ou le curseur). No limit : tu peux miser tout ton tapis.</li><li>Au <b>showdown</b>, les cartes des bots encore en jeu sont retournées : la meilleure main de 5 cartes (parmi tes 2 cartes et les 5 communes) gagne. Égalité = pot partagé, avec pots secondaires si quelqu’un est à tapis.</li></ul>
      <h4>Valeur des mains (de la plus forte à la plus faible)</h4><p>Quinte flush · Carré · Full · Couleur · Quinte · Brelan · Double paire · Paire · Carte haute.</p>
      <h4>Les bots</h4><p>Ils jouent selon la force réelle de leur main (calculée à chaque décision) et leur caractère : Big Ben est prudent, Lola agressive, Renard bluffe, Mamie Jo suit beaucoup, Tex joue solide et Ace est imprévisible.</p>
      <h4>Jetons</h4><p>Ton tapis est pris sur ton solde au lancement et rendu (avec tes gains) quand tu quittes la table ou que tu élimines tous les bots. Si tu quittes en pleine main, les jetons déjà misés sont perdus, comme si tu te couchais.</p>`);
  }
}

return { PokerGame };
})();
