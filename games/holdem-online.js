// SpinBet Casino · HoldemOnlineGame — loaded on demand by games/impl/index.js (index.html).
// ---- games/impl/holdem-online.js ----
__mods['games/impl/holdem-online.js'] = (() => {
// Le Texas Online: multiplayer Casino Hold’em (online.js). A hand every 30 seconds for the whole table: 9 s to put
// an ante, then each player gets 2 cards and the table sees the same flop; until 21 s, CALL (2 × the ante) or FOLD.
// Then the turn, the river and the dealer's 2 cards, the same for everyone. One shuffled deck per hand: every player
// at the table gets different cards. The dealer qualifies with a pair of 4 or better.
// Ante pays 1 (up to a straight), 2 (flush), 3 (full), 10 (four of a kind), 20 (straight flush), 100 (royal flush).

const { BaseGame, fmtC } = __mods['core/base.js'];
const { OnlineTable, rng, shuffleR, cardHTML, chatHTML, mountChat, esc } = __mods['online.js'];
const { EXTRA_THEMES } = __mods['core/music.js'];
const { sfx } = __mods['audio.js'];
const { fx, center } = __mods['fx.js'];
const { wallet } = __mods['wallet.js'];

/* ===ENGINE */
const LEN = 30000, CLOSE = 9000, DECIDE = 21000;
const ANTE_PAY = { 9: 100, 8: 20, 7: 10, 6: 3, 5: 2 }; // by hand category, else 1
const CAT = ['Hauteur', 'Paire', 'Double paire', 'Brelan', 'Quinte', 'Couleur', 'Full', 'Carré', 'Quinte flush', 'Quinte flush royale'];
const rk = (c) => ((c % 13) + 12) % 13; // 0 = 2 … 12 = As
// 5 cards → comparable score [cat, kickers…]
function eval5(cs) {
  const r = cs.map(rk).sort((a, b) => b - a), s = cs.map((c) => Math.floor(c / 13));
  const flush = s.every((x) => x === s[0]);
  const u = [...new Set(r)];
  let straight = -1;
  if (u.length === 5 && u[0] - u[4] === 4) straight = u[0];
  if (u.join() === '12,3,2,1,0') straight = 3;
  const cnt = {}; r.forEach((x) => { cnt[x] = (cnt[x] || 0) + 1; });
  const g = Object.entries(cnt).map(([x, n]) => [n, +x]).sort((a, b) => b[0] - a[0] || b[1] - a[1]);
  const ks = g.map((x) => x[1]);
  if (straight >= 0 && flush) return [straight === 12 ? 9 : 8, straight];
  if (g[0][0] === 4) return [7, ...ks];
  if (g[0][0] === 3 && g[1][0] === 2) return [6, ...ks];
  if (flush) return [5, ...r];
  if (straight >= 0) return [4, straight];
  if (g[0][0] === 3) return [3, ...ks];
  if (g[0][0] === 2 && g[1][0] === 2) return [2, ...ks];
  if (g[0][0] === 2) return [1, ...ks];
  return [0, ...r];
}
const cmp = (a, b) => { for (let i = 0; i < Math.max(a.length, b.length); i++) { const d = (a[i] ?? -1) - (b[i] ?? -1); if (d) return d; } return 0; };
function best(seven) {
  let top = null;
  for (let a = 0; a < 7; a++) for (let b = a + 1; b < 7; b++) { const five = seven.filter((_, i) => i !== a && i !== b), sc = eval5(five); if (!top || cmp(sc, top) > 0) top = sc; }
  return top;
}
// the hand's deck: flop from seed A, each player (index in the seed's list) 2 cards, the rest shuffled again by seed B
function deal(seedA, players, seedB) {
  const deck = shuffleR(rng(`${seedA}|deck`), [...Array(52).keys()]);
  const flop = deck.slice(0, 3), holes = {};
  players.forEach((u, i) => { holes[u] = [deck[3 + 2 * i], deck[4 + 2 * i]]; });
  if (!seedB) return { flop, holes };
  const rest = shuffleR(rng(`${seedB}|rest`), deck.slice(3 + 2 * players.length));
  return { flop, holes, turn: rest[0], river: rest[1], dealer: [rest[2], rest[3]] };
}
// what a hand returns (cents) for an ante (and the call when called)
function settle(ante, called, hole, D) {
  if (!called) return 0;
  const board = [...D.flop, D.turn, D.river], p = best([...hole, ...board]), d = best([...D.dealer, ...board]);
  const qual = d[0] >= 2 || (d[0] === 1 && d[1] >= 2); // pair of 4 or better
  const anteWin = ante * (ANTE_PAY[p[0]] || 1);
  if (!qual) return ante + anteWin + 2 * ante; // ante paid, call pushed
  const c = cmp(p, d);
  if (c > 0) return ante + anteWin + 4 * ante;
  if (c === 0) return 3 * ante;
  return 0;
}
/* ===END ENGINE */

class HoldemOnlineGame extends BaseGame {
  constructor(root, game) {
    super(root, game, {
      music: EXTRA_THEMES.blackjack, autoplay: false, turbo: false, mainLabel: 'MISER', betLabel: 'Ante',
      cls: 'table-game online-game hdo',
      stage: `<div class="on-timer"><b>Connexion à la table…</b><i><span></span></i></div>
        <div class="bjo-table"><div class="bj-zone dealer"><div class="bj-label">Croupière <b class="dh"></b></div><div class="bj-cards dc"></div></div>
        <div class="hdo-board"><div class="bj-cards bc"></div></div>
        <div class="bj-arc">LA CROUPIÈRE SE QUALIFIE AVEC UNE PAIRE DE 4 OU MIEUX</div>
        <div class="bj-zone me"><div class="bj-label">Ma main <b class="ph"></b></div><div class="bj-cards pc"></div></div></div>`,
      below: `<div class="bj-actions"><button class="bj-btn" data-hd="call">Suivre <small>2 × l’ante</small></button><button class="bj-btn" data-hd="fold">Se coucher</button></div>
        <div class="on-side"><div class="on-players"><div class="on-chat-h">👥 Joueurs à la table</div><div class="on-plist hdo-others"><p class="muted small">Personne n’a misé sur cette main.</p></div></div>${chatHTML()}</div>`,
      hello: 'Choisis ton ante puis MISER avant la fin du compte à rebours.',
    });
    this.qa('[data-hd]').forEach((b) => { b.onclick = () => this.act(b.dataset.hd); });
    this.table = new OnlineTable(game.id, {
      len: LEN, seeds: { a: CLOSE, b: DECIDE }, withPlayers: true,
      onRound: (r) => this.newRound(r), onTick: (t) => this.onTick(t), onSeed: (k, s, d, r) => this.onSeed(k, s, d), onBets: (l) => this.paint(l),
    });
    if (!this.table.me) this.msg('Crée un compte (ou connecte-toi) pour jouer : en invité, tu peux regarder la table.');
    this.table.start();
    mountChat(this.root, game.id).then((f) => { this.stopChat = f; });
  }

  destroy() { this.table.stop(); this.stopChat?.(); super.destroy(); }
  stakeLabel() { return this.ante ? this.ante * (this.choice === 'call' ? 3 : 1) : this.bet; }
  onMeters() { if (this.mainBtn) this.mainBtn.disabled = !!this.ante || this.phase !== 'bet' || !this.table?.me; }

  newRound(r) {
    this.round0 = r; this.ante = 0; this.choice = null; this.A = null; this.B = null; this.players = []; this.paid = false; this.phase = 'bet';
    ['.dc', '.bc', '.pc', '.dh', '.ph'].forEach((s) => { this.q(s).innerHTML = ''; });
    this.q('.bc').innerHTML = [0, 1, 2, 3, 4].map(() => cardHTML(null, true)).join('');
    this.paint([]); this.updateMeters(); this.paintActs();
  }

  onTick(t) {
    const bar = this.q('.on-timer');
    const ph = t < CLOSE ? 'bet' : t < DECIDE ? 'play' : 'show';
    if (ph !== this.phase) {
      this.phase = ph; this.busy = ph !== 'bet'; this.updateMeters(); this.paintActs();
      if (ph === 'show' && this.ante && this.A && !this.choice) { this.choice = 'fold'; this.msg('Temps écoulé : tu te couches.'); }
    }
    const left = ph === 'bet' ? CLOSE - t : ph === 'play' ? DECIDE - t : 0, span = ph === 'bet' ? CLOSE : DECIDE - CLOSE;
    bar.querySelector('b').textContent = ph === 'bet' ? `Faites vos mises · ${Math.ceil(left / 1000)} s` : ph === 'play' ? (this.A ? `Suivre ou se coucher · ${Math.ceil(left / 1000)} s` : 'Distribution…') : 'Abattage';
    bar.querySelector('span').style.width = `${ph === 'show' ? 0 : (left / span) * 100}%`;
    bar.classList.toggle('closed', ph !== 'bet');
    if (t > LEN - 300 && this.ante && !this.paid && !this.refunded) { this.refunded = true; wallet.grant(this.stakeLabel() / 100); this.msg('Main annulée (connexion perdue) : ta mise t’est rendue.'); }
  }

  async onMain() {
    if (this.ante || this.phase !== 'bet') return;
    if (!this.table.me) return this.msg('Crée un compte pour jouer à la table.');
    const b = this.bet;
    if (wallet.cents < b * 3) return this.msg(`Il te faut ${fmtC(b * 3)} : l’ante et de quoi suivre (2 × l’ante).`);
    if (!this.pay(b)) return;
    this.ante = b; this.lastStake = b; this.refunded = false; this.updateMeters();
    this.msg(`Ante de ${fmtC(b)} acceptée · distribution à la fin du compte à rebours`);
    try { await this.table.putBet({ ante: b, c: '' }); }
    catch (e) { console.error(e); wallet.grant(b / 100); this.ante = 0; this.updateMeters(); this.msg('Trop tard pour cette main : ta mise t’est rendue.'); }
  }

  mine() { return this.A && this.ante && this.players.includes(this.table.me); }
  paintActs() { const can = this.phase === 'play' && this.mine() && !this.choice; this.qa('[data-hd]').forEach((b) => { b.disabled = !can; }); }

  async act(a) {
    if (this.phase !== 'play' || !this.mine() || this.choice) return;
    if (a === 'call' && !this.pay(this.ante * 2)) return;
    this.choice = a; sfx.click?.();
    this.msg(a === 'call' ? 'Tu suis : la suite à l’abattage' : 'Tu te couches');
    this.paintActs(); this.paintMe();
    try { await this.table.putBet({ ante: this.ante, c: a === 'call' ? 'c' : 'f' }); } catch (e) { console.error(e); }
  }

  onSeed(k, seed, doc) {
    if (k === 'a') {
      this.A = seed; this.players = Array.isArray(doc.p) ? doc.p : [];
      if (this.ante && !this.players.includes(this.table.me) && !this.refunded) { this.refunded = true; this.paid = true; wallet.grant(this.ante / 100); this.msg('Ta mise est arrivée trop tard pour cette main : elle t’est rendue.'); }
      else if (this.ante) this.msg('Regarde ta main et le flop : suivre (2 × l’ante) ou se coucher ?');
      this.paintActs();
    }
    if (k === 'b') { this.B = seed; if (this.mine() && !this.choice) this.choice = 'fold'; this.finish(); }
    this.paintMe(); this.paint(this.table.bets);
  }

  paintMe() {
    if (!this.A) return;
    const D = deal(this.A, this.players, this.B);
    this.q('.bc').innerHTML = [...D.flop.map((c) => cardHTML(c)), cardHTML(this.B ? D.turn : null, !this.B), cardHTML(this.B ? D.river : null, !this.B)].join('');
    this.q('.dc').innerHTML = this.B ? D.dealer.map((c) => cardHTML(c)).join('') : cardHTML(null, true) + cardHTML(null, true);
    if (this.B) { const d = best([...D.dealer, D.flop[0], D.flop[1], D.flop[2], D.turn, D.river]); this.q('.dh').textContent = CAT[d[0]] + (d[0] >= 2 || (d[0] === 1 && d[1] >= 2) ? '' : ' · pas qualifiée'); }
    if (this.mine()) {
      const h = D.holes[this.table.me];
      this.q('.pc').innerHTML = h.map((c) => cardHTML(c)).join('');
      this.q('.pc').classList.toggle('folded', this.choice === 'fold');
      const seen = this.B ? [...h, ...D.flop, D.turn, D.river] : [...h, ...D.flop];
      this.q('.ph').textContent = seen.length === 7 ? CAT[best(seen)[0]] : CAT[eval5(seen)[0]];
    }
  }

  finish() {
    if (!this.mine() || this.paid) return;
    this.paid = true;
    const D = deal(this.A, this.players, this.B), ret = settle(this.ante, this.choice === 'call', D.holes[this.table.me], D), stake = this.stakeLabel(), net = ret - stake;
    this.msg(this.choice !== 'call' ? `Couché : tu perds ton ante (${fmtC(this.ante)})` : net > 0 ? `Tu gagnes ${fmtC(net)}` : net < 0 ? `Tu perds ${fmtC(-net)}` : 'Égalité, mise rendue');
    if (ret > 0) { this.win(ret); this.setLast(ret); if (net > 0) { const p = center(this.q('.pc')); fx.burst(p.x, p.y, 24, ['#fde047', '#fff', '#86efac'], 7); sfx.win(); } }
  }

  paint(list) {
    const box = this.q('.hdo-others'); if (!box) return;
    const S = __mods['shop.js'], me = this.table?.me;
    const D = this.A ? deal(this.A, this.players, this.B) : null;
    box.innerHTML = list.length ? list.map((b) => {
      const inHand = D && this.players.includes(b.uid), c = b.d?.c || '';
      const res = inHand && this.B ? settle(b.d?.ante || 0, c === 'c', D.holes[b.uid], D) : null;
      const cards = inHand && (this.B || b.uid === me) ? D.holes[b.uid] : null;
      return `<div class="on-p${b.uid === me ? ' me' : ''}">${S?.lookHTML?.(b.look, 'sm') || ''}<b class="pname" data-player="${esc(b.uid)}" data-pname="${esc(b.name)}" ${S?.nameStyle?.(b.look) || ''}>${esc(b.name)}</b>
        <span>${fmtC((b.d?.ante || 0) * (c === 'c' ? 3 : 1))}</span>
        ${cards ? `<span class="on-mini">${cards.map((x) => `<i class="${Math.floor(x / 13) % 3 ? 'red' : ''}">${['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'][x % 13]}</i>`).join('')}</span>` : ''}
        <small class="on-st">${c === 'c' ? 'suit' : c === 'f' || (inHand && this.B) ? 'couché' : inHand ? 'réfléchit…' : 'mise'}</small>
        ${res == null ? '' : res > 0 ? `<em class="w">+${fmtC(res)}</em>` : '<em class="l">perdu</em>'}</div>`;
    }).join('') : '<p class="muted small">Personne n’a misé sur cette main.</p>';
  }

  info() {
    const t = Object.entries(ANTE_PAY).sort((a, b) => b[0] - a[0]).map(([c, x]) => `<li>${CAT[c]} : ${x} pour 1</li>`).join('');
    return this.rules(`<h4>Texas Hold’em contre la croupière, pour toute la table</h4><p>Une main toutes les <b>30 secondes</b>. Pose ton <b>ante</b> pendant le compte à rebours (9 s). Tu reçois 2 cartes et toute la table voit le même flop. Jusqu’à 21 s : <b>suivre</b> (mise de 2 × l’ante) ou <b>se coucher</b> (tu perds l’ante). Sans décision, tu te couches. Puis la turn, la river et les 2 cartes de la croupière, les mêmes pour tous.</p>
      <h4>Les gains</h4><p>La croupière se qualifie avec une paire de 4 ou mieux. Si elle ne se qualifie pas : l’ante est payée selon le tableau, le suivi est rendu. Si elle se qualifie et que tu la bats : ante selon le tableau et suivi 1 pour 1. Égalité : tout est rendu.</p>
      <ul class="rules">${t}<li>Quinte et moins : 1 pour 1</li></ul>
      <p class="muted small">Chaque joueur reçoit ses propres cartes, tirées du même paquet. Tu vois les mises des autres joueurs et leurs cartes à l’abattage. Il faut un compte pour jouer.</p>`);
  }
}

return { HoldemOnlineGame };
})();
