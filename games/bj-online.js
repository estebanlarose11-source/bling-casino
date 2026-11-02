// SpinBet Casino · BjOnlineGame — loaded on demand by games/impl/index.js (index.html).
// ---- games/impl/bj-online.js ----
__mods['games/impl/bj-online.js'] = (() => {
// Le 21 Online: multiplayer blackjack (online.js). A round every 30 seconds for the whole table: 9 s to bet,
// then everyone gets their cards and has until 21 s to hit, stand or double; then the dealer reveals her hidden
// card and draws, the same for all. Infinite shoe, blackjack pays 6 to 5, the dealer hits soft 17, no split, double on
// the first two cards; with no peek, a dealer blackjack beats everything but a player blackjack.
// Simulated with the basic strategy: ≈ 97,5 %.

const { BaseGame, fmtC } = __mods['core/base.js'];
const { OnlineTable, rng, cardHTML, chatHTML, mountChat, esc, now } = __mods['online.js'];
const { EXTRA_THEMES } = __mods['core/music.js'];
const { sfx } = __mods['audio.js'];
const { fx, center } = __mods['fx.js'];
const { wallet } = __mods['wallet.js'];

/* ===ENGINE */
const LEN = 30000, CLOSE = 9000, DECIDE = 21000, BJ_PAY = 1.2;
const draw = (seed, who, k) => Math.floor(rng(`${seed}|${who}|${k}`)() * 52);
const cval = (i) => { const r = i % 13; return r === 0 ? 1 : r >= 9 ? 10 : r + 1; };
function total(cards) { let t = 0, a = 0; for (const c of cards) { const v = cval(c); t += v; if (v === 1) a++; } const soft = a > 0 && t + 10 <= 21; return { t: soft ? t + 10 : t, soft }; }
// a player's cards: 2 dealt + one per hit / double, all drawn from the deal seed and the player's id
function handOf(seedA, uid, acts = '') {
  const c = [draw(seedA, uid, 0), draw(seedA, uid, 1)];
  for (const a of acts) { if (a === 'h' || a === 'd') c.push(draw(seedA, uid, c.length)); if (a === 'd' || a === 's') break; if (total(c).t > 21) break; }
  return c;
}
function dealerOf(seedA, seedB) {
  const c = [draw(seedA, 'D', 0)];
  if (!seedB) return c;
  c.push(draw(seedB, 'D', 1));
  while (true) { const v = total(c); if (v.t > 17 || (v.t === 17 && !v.soft)) break; c.push(draw(seedB, 'D', c.length)); }
  return c;
}
const isBJ = (c) => c.length === 2 && total(c).t === 21;
// what a bet returns (cents), with the double
function settle(bet, acts, pc, dc) {
  const stake = bet * (acts.includes('d') ? 2 : 1), p = total(pc).t, d = total(dc).t;
  if (isBJ(pc)) return isBJ(dc) ? bet : Math.round(bet * (1 + BJ_PAY));
  if (isBJ(dc) || p > 21) return 0;
  if (d > 21 || p > d) return stake * 2;
  return p === d ? stake : 0;
}
/* ===END ENGINE */

class BjOnlineGame extends BaseGame {
  constructor(root, game) {
    super(root, game, {
      music: EXTRA_THEMES.blackjack, autoplay: false, turbo: false, mainLabel: 'MISER', betLabel: 'Ma mise',
      cls: 'table-game online-game bjo',
      stage: `<div class="on-timer"><b>Connexion à la table…</b><i><span></span></i></div>
        <div class="bjo-table"><div class="bj-zone dealer"><div class="bj-label">Croupière <b class="dt"></b></div><div class="bj-cards dc"></div></div>
        <div class="bj-arc">LE BLACKJACK PAIE 6 POUR 5 · LA CROUPIÈRE TIRE À 17 SOUPLE</div>
        <div class="bj-zone me"><div class="bj-label">Ma main <b class="pt"></b></div><div class="bj-cards pc"></div></div></div>`,
      below: `<div class="bj-actions"><button class="bj-btn" data-bj="h">Tirer <small>+1 carte</small></button><button class="bj-btn" data-bj="s">Rester</button><button class="bj-btn" data-bj="d">Doubler <small>×2, 1 carte</small></button></div>
        <div class="on-side"><div class="on-players"><div class="on-chat-h">👥 Joueurs à la table</div><div class="on-plist bjo-others"><p class="muted small">Personne n’a misé sur cette main.</p></div></div>${chatHTML()}</div>`,
      hello: 'Choisis ta mise puis MISER avant la fin du compte à rebours.',
    });
    this.qa('[data-bj]').forEach((b) => { b.onclick = () => this.act(b.dataset.bj); });
    this.table = new OnlineTable(game.id, {
      len: LEN, seeds: { a: CLOSE, b: DECIDE },
      onRound: (r) => this.newRound(r), onTick: (t) => this.onTick(t), onSeed: (k, s, d, r) => this.onSeed(k, s, r), onBets: (l) => this.paint(l),
    });
    if (!this.table.me) this.msg('Crée un compte (ou connecte-toi) pour jouer : en invité, tu peux regarder la table.');
    this.table.start();
    mountChat(this.root, game.id).then((f) => { this.stopChat = f; });
  }

  destroy() { this.table.stop(); this.stopChat?.(); super.destroy(); }
  stakeLabel() { return this.myBet ? this.myBet * (this.acts?.includes('d') ? 2 : 1) : this.bet; }
  onMeters() { if (this.mainBtn) this.mainBtn.disabled = !!this.myBet || this.phase !== 'bet' || !this.table?.me; }

  newRound(r) {
    this.round0 = r; this.myBet = 0; this.acts = ''; this.A = null; this.B = null; this.done = false; this.paid = false; this.phase = 'bet';
    this.q('.dc').innerHTML = ''; this.q('.pc').innerHTML = ''; this.q('.dt').textContent = ''; this.q('.pt').textContent = '';
    this.paint([]); this.updateMeters(); this.paintActs();
  }

  onTick(t) {
    const bar = this.q('.on-timer');
    const ph = t < CLOSE ? 'bet' : t < DECIDE ? 'play' : 'dealer';
    if (ph !== this.phase) { this.phase = ph; this.busy = ph !== 'bet'; this.updateMeters(); this.paintActs(); if (ph === 'dealer' && this.myBet && !this.done) { this.done = true; this.msg('Temps écoulé : tu restes.'); } }
    const left = ph === 'bet' ? CLOSE - t : ph === 'play' ? DECIDE - t : 0, span = ph === 'bet' ? CLOSE : DECIDE - CLOSE;
    bar.querySelector('b').textContent = ph === 'bet' ? `Faites vos mises · ${Math.ceil(left / 1000)} s` : ph === 'play' ? (this.A ? `À vous de jouer · ${Math.ceil(left / 1000)} s` : 'Distribution…') : 'La croupière joue';
    bar.querySelector('span').style.width = `${ph === 'dealer' ? 0 : (left / span) * 100}%`;
    bar.classList.toggle('closed', ph !== 'bet');
    if (t > LEN - 300 && this.myBet && !this.paid && !this.refunded) { this.refunded = true; wallet.grant(this.stakeLabel() / 100); this.msg('Main annulée (connexion perdue) : ta mise t’est rendue.'); }
  }

  async onMain() {
    if (this.myBet || this.phase !== 'bet') return;
    if (!this.table.me) return this.msg('Crée un compte pour jouer à la table.');
    const b = this.bet;
    if (!this.pay(b)) return;
    this.myBet = b; this.lastStake = b; this.refunded = false; this.updateMeters();
    this.msg(`Mise de ${fmtC(b)} acceptée · distribution à la fin du compte à rebours`);
    try { await this.table.putBet({ bet: b, acts: '' }); }
    catch (e) { console.error(e); wallet.grant(b / 100); this.myBet = 0; this.updateMeters(); this.msg('Trop tard pour cette main : ta mise t’est rendue.'); }
  }

  paintActs() {
    const can = this.phase === 'play' && this.A && this.myBet && !this.done;
    const pc = this.A && this.myBet ? handOf(this.A, this.table.me, this.acts) : [];
    this.qa('[data-bj]').forEach((b) => { b.disabled = !can || (b.dataset.bj === 'd' && (pc.length !== 2 || wallet.cents < this.myBet)); });
  }

  async act(a) {
    if (this.phase !== 'play' || !this.A || !this.myBet || this.done) return;
    if (a === 'd' && !this.pay(this.myBet)) return;
    this.acts += a;
    const pc = handOf(this.A, this.table.me, this.acts), v = total(pc).t;
    if (a !== 'h' || v >= 21) this.done = true;
    sfx.click?.();
    this.paintMe(); this.paintActs();
    if (v > 21) this.msg('Tu dépasses 21…');
    try { await this.table.putBet({ bet: this.myBet, acts: this.acts }); } catch (e) { console.error(e); }
  }

  onSeed(k, seed) {
    if (k === 'a') { this.A = seed; sfx.click?.(); this.paintMe(true); if (this.myBet && isBJ(handOf(seed, this.table.me))) { this.done = true; this.msg('BLACKJACK !'); } else if (this.myBet) this.msg('À toi : tirer, rester ou doubler'); this.paintActs(); }
    if (k === 'b') { this.B = seed; this.done = true; this.paintActs(); this.finish(); }
    this.paint(this.table.bets);
  }

  paintMe(fresh) {
    if (!this.A) return;
    const dc = dealerOf(this.A, this.B);
    this.q('.dc').innerHTML = dc.map((c) => cardHTML(c)).join('') + (this.B ? '' : cardHTML(null, true));
    this.q('.dt').textContent = this.B ? total(dc).t : total(dc).t;
    if (this.myBet) {
      const pc = handOf(this.A, this.table.me, this.acts);
      this.q('.pc').innerHTML = pc.map((c) => cardHTML(c)).join('');
      const v = total(pc);
      this.q('.pt').textContent = isBJ(pc) ? 'BLACKJACK' : `${v.t}${v.soft && v.t < 21 ? ' (souple)' : ''}`;
    } else if (fresh) this.q('.pc').innerHTML = '<p class="muted small">Pas de mise sur cette main : regarde la table et mise sur la suivante.</p>';
  }

  async finish() {
    this.paintMe();
    if (!this.myBet || this.paid) return;
    this.paid = true;
    const pc = handOf(this.A, this.table.me, this.acts), dc = dealerOf(this.A, this.B);
    const ret = settle(this.myBet, this.acts, pc, dc), stake = this.stakeLabel(), net = ret - stake;
    this.msg(`Croupière ${total(dc).t > 21 ? 'saute' : total(dc).t} · ${net > 0 ? `Tu gagnes ${fmtC(net)}` : net < 0 ? `Tu perds ${fmtC(-net)}` : 'Égalité, mise rendue'}`);
    if (ret > 0) { this.win(ret); this.setLast(ret); if (net > 0) { const p = center(this.q('.pc')); fx.burst(p.x, p.y, 24, ['#fde047', '#fff', '#86efac'], 7); sfx.win(); } }
  }

  paint(list) {
    const box = this.q('.bjo-others'); if (!box) return;
    const S = __mods['shop.js'], me = this.table?.me;
    const dc = this.A ? dealerOf(this.A, this.B) : null;
    box.innerHTML = list.length ? list.map((b) => {
      const pc = this.A ? handOf(this.A, b.uid, b.d?.acts || '') : null, v = pc ? total(pc).t : null;
      const res = pc && this.B ? settle(b.d?.bet || 0, b.d?.acts || '', pc, dc) : null;
      return `<div class="on-p${b.uid === me ? ' me' : ''}">${S?.lookHTML?.(b.look, 'sm') || ''}<b class="pname" data-player="${esc(b.uid)}" data-pname="${esc(b.name)}" ${S?.nameStyle?.(b.look) || ''}>${esc(b.name)}</b>
        <span>${fmtC((b.d?.bet || 0) * ((b.d?.acts || '').includes('d') ? 2 : 1))}</span>
        ${pc ? `<span class="on-mini">${pc.map((c) => `<i class="${Math.floor(c / 13) % 3 ? 'red' : ''}">${['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'][c % 13]}</i>`).join('')}<small>${isBJ(pc) ? 'BJ' : v}</small></span>` : ''}
        ${res == null ? '<em>…</em>' : res > 0 ? `<em class="w">+${fmtC(res)}</em>` : '<em class="l">perdu</em>'}</div>`;
    }).join('') : '<p class="muted small">Personne n’a misé sur cette main.</p>';
  }

  info() {
    return this.rules(`<h4>Un blackjack pour toute la table</h4><p>Une main toutes les <b>30 secondes</b>, la même croupière pour tous. Mise pendant le compte à rebours (9 s), puis tu as jusqu’à 21 s pour <b>tirer</b>, <b>rester</b> ou <b>doubler</b> (sur tes 2 premières cartes). Sans décision, tu restes. Ensuite la croupière retourne sa carte et tire jusqu’à 17 (elle tire sur 17 souple).</p>
      <ul class="rules"><li>Blackjack : 6 pour 5</li><li>Main gagnante : 1 pour 1 · Égalité : mise rendue</li><li>Blackjack de la croupière : bat toutes les mains sauf un blackjack (égalité), doubles compris</li><li>Pas de séparation de paires · sabot infini</li></ul>
      <p class="muted small">Tu vois les mains et les gains des autres joueurs. Il faut un compte pour jouer.</p>`);
  }
}

return { BjOnlineGame };
})();
