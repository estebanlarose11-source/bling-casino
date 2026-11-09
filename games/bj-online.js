// SpinBet Casino · BjOnlineGame — loaded on demand by games/impl/index.js (index.html), after games/bjtable.js.
// ---- games/impl/bj-online.js ----
__mods['games/impl/bj-online.js'] = (() => {
// Le 21 Online: multiplayer blackjack (online.js, OnlineRoom) on the same table as Le 21 (games/bjtable.js,
// BjTableGame): the other players sit at the places around the player (avatar, name, bet, cards). Everyone in the
// room bets with the chips and presses PRÊT; the cards are dealt as soon as every seated player is ready (at once
// when alone, or 20 s after the first PRÊT). Each player then hits, stands or doubles; the croupière plays when
// everyone is done (or after 25 s), the same for all. Infinite shoe, blackjack pays 6 to 5, the croupière hits soft
// 17, no split, double on the first two cards; with no peek, a dealer blackjack beats everything but a player
// blackjack. Simulated with the basic strategy: ≈ 97,5 %.

const { BjTableGame, fromIndex } = __mods['games/impl/bjtable.js'];
const { fmtC } = __mods['core/base.js'];
const { OnlineRoom, rng, chatHTML, mountChat, esc, now } = __mods['online.js'];
const { EXTRA_THEMES } = __mods['core/music.js'];
const { sfx } = __mods['audio.js'];
const { fx, center } = __mods['fx.js'];
const { wallet } = __mods['wallet.js'];

/* ===ENGINE */
const DECIDE_MS = 25000, RESULT_MS = 7000, WAIT_MS = 20000, BJ_PAY = 1.2;
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

const tot = (cards) => { const v = total(cards); return isBJ(cards) ? '21' : `${v.soft && v.t < 21 ? `${v.t - 10}/` : ''}${v.t}`; };

class BjOnlineGame extends BjTableGame {
  constructor(root, game) {
    super(root, game, { music: EXTRA_THEMES.blackjack, turbo: false, mainLabel: 'PRÊT', betLabel: 'Ma mise', cls: 'bjo',
      below: `<div class="on-side"><div class="on-players"><div class="on-chat-h">👥 Joueurs dans le salon</div><div class="on-plist bjo-others"><p class="muted small">Personne dans le salon.</p></div></div>${chatHTML()}</div>`,
      hello: 'Choisis ta mise puis PRÊT : les cartes partent quand tout le salon est prêt.' }, {
      t2: 'LA CROUPIÈRE TIRE À 17 SOUPLE', seats: true,
      overlay: '<div class="on-timer bjo-timer"><b>Connexion au salon…</b><i><span></span></i><small class="on-wait"></small></div>',
    });
    this.cur = 0; this.phase = 'bet'; this.myBet = 0; this.acts = '';
    this.room = new OnlineRoom(game.id, { two: true, decideMs: DECIDE_MS, resultMs: RESULT_MS, waitMs: WAIT_MS, onState: (st) => this.onState(st), onSeed: (k, s, d, n) => this.onSeed(k, s, d, n) });
    if (!this.room.me) this.msg('Crée un compte (ou connecte-toi) pour jouer : en invité, tu peux regarder la table.');
    this.room.start();
    mountChat(this.root, game.id).then((f) => { this.stopChat = f; });
    this.renderActions();
  }

  destroy() { this.room.stop(); this.stopChat?.(); super.destroy(); }
  betting() { return this.phase === 'bet' && !this.myBet; }
  stakeLabel() { return this.myBet ? this.myBet * (this.acts?.includes('d') ? 2 : 1) : this.bets?.main || 0; }
  inPlayStake() { return this.stakeLabel(); }
  myHand() { return this.A && this.inHand ? handOf(this.A, this.room.me, this.acts) : []; }

  buttons() {
    if (this.phase === 'play' && this.inHand) return [['', 'SÉPARER', 'none'], ['', 'RESTER', 's'], ['', 'TIRER', 'h'], ['', 'DOUBLER', 'd']];
    return [['×2', 'DOUBLER', 'x2'], ['', 'VIDER', 'clear'], ['', 'RÉPÉTER', 'repeat'], ['', this.myBet && this.phase === 'bet' ? 'PRÊT ✔' : 'PRÊT', 'ready']];
  }
  can(k) {
    if (k === 'ready') return this.betting() && !!this.room?.me && this.bets.main > 0 && this.balC() >= this.bets.main;
    if (['h', 's', 'd'].includes(k)) {
      const ok = this.phase === 'play' && this.A && this.inHand && !this.done;
      return ok && (k !== 'd' || (this.myHand().length === 2 && wallet.cents >= this.myBet));
    }
    if (k === 'none') return false;
    return this.canBetKey(k);
  }
  onButton(k) { if (k === 'ready') this.onMain(); else if (['h', 's', 'd'].includes(k)) this.act(k); }
  renderActions() {
    if (!this.view || !this.room) return;
    this.paintHud();
    if (this.mainBtn) this.mainBtn.disabled = !this.can('ready');
    const p = this.phase;
    this.setState(p === 'bet' ? 'g' : p === 'play' ? 'r' : 'o', p === 'bet' ? (this.myBet ? 'PRÊT ✔' : 'FAITES VOS JEUX') : p === 'play' ? (this.inHand && !this.done ? 'À VOUS DE JOUER' : 'LES JOUEURS JOUENT') : 'RÉSULTAT');
  }
  onMeters() { this.renderActions(); }
  paintActs() { this.renderActions(); }

  onState(st) {
    if (st.phase === 'bet' && st.n !== this.cur) this.newRound(st.n);
    if (st.phase !== this.phase) {
      this.phase = st.phase; this.busy = st.phase !== 'bet' || !!this.myBet; this.updateMeters();
      if (st.phase === 'result' && this.myBet && !this.done) this.done = true;
      this.setCam(st.phase === 'bet' && !this.myBet ? 'bet' : 'play');
      this.renderActions();
    }
    const bar = this.q('.on-timer'), b = bar.querySelector('b'), w = bar.querySelector('.on-wait'), sp = bar.querySelector('span');
    if (st.phase === 'bet') {
      const total = st.present.length, nr = st.ready.length, left = st.autoAt ? Math.max(0, st.autoAt - now()) : 0;
      b.textContent = !total ? 'Faites vos mises · appuie sur PRÊT' : `Faites vos mises · ${nr} / ${total} prêt${nr > 1 ? 's' : ''}`;
      w.textContent = nr && st.waiting.length ? `En attente de ${st.waiting.map((s) => s.name).slice(0, 4).join(', ')}${st.waiting.length > 4 ? '…' : ''} · distribution auto dans ${Math.ceil(left / 1000)} s` : '';
      sp.style.width = `${total ? (nr / total) * 100 : 0}%`; bar.classList.remove('closed');
      const list = st.present.map((s) => ({ uid: s.uid, name: s.name, look: s.look, bet: s.n === st.n && s.ready ? s.d?.bet : 0, ready: s.n === st.n && s.ready }));
      this.paint(list); this.paintSeats(list);
    } else if (st.phase === 'play') {
      const left = Math.max(0, st.deadline - now());
      b.textContent = this.myBet && !this.done ? `À toi de jouer · ${Math.ceil(left / 1000)} s` : `Les joueurs jouent · ${Math.ceil(left / 1000)} s`;
      w.textContent = ''; sp.style.width = `${(left / DECIDE_MS) * 100}%`; bar.classList.add('closed');
      if (left <= 0 && this.myBet && !this.done) { this.done = true; this.renderActions(); }
      this.paintPlay(st);
    } else { b.textContent = 'Résultat'; w.textContent = ''; sp.style.width = '100%'; bar.classList.add('closed'); }
  }

  newRound(n) {
    this.cur = n; this.myBet = 0; this.acts = ''; this.A = null; this.B = null; this.inHand = false; this.done = false; this.paid = false; this.dealt = null;
    this.clearTable(); this.q('.bjv-hands').innerHTML = ''; this.lastPay = this.lastPay || 0;
    this.busy = false; this.updateMeters(); this.setCam('bet'); this.renderActions();
  }

  async onMain() {
    if (!this.betting()) return;
    if (!this.room.me) return this.msg('Crée un compte pour jouer au salon.');
    const b = this.bets.main;
    if (!b) { this.msg('Pose au moins un jeton sur le cercle de mise'); this.shake(this.q('.bjv-spot.main')); return; }
    if (!this.pay(b)) return;
    this.myBet = b; this.lastStake = b; this.lastBets = { ...this.bets }; this.busy = true; this.updateMeters();
    this.msg(`Prêt avec ${fmtC(b)} · les cartes partent quand tout le salon est prêt`);
    this.setCam('play'); this.renderActions();
    await this.room.seat({ n: this.cur, ready: true, d: { bet: b }, rt: now(), acts: '', done: false });
  }

  async act(a) {
    if (this.phase !== 'play' || !this.A || !this.inHand || this.done) return;
    if (a === 'd' && !this.pay(this.myBet)) return;
    this.acts += a;
    const pc = this.myHand(), v = total(pc).t;
    if (a !== 'h' || v >= 21) this.done = true;
    sfx.click?.();
    this.paintTable(true); this.renderActions();
    if (v > 21) this.msg('Tu dépasses 21…');
    await this.room.seat({ n: this.cur, acts: this.acts, done: this.done });
  }

  onSeed(k, seed, doc, n) {
    if (n !== this.cur) return;
    if (k === 'a') {
      this.A = seed; this.dealt = doc.p || [];
      this.inHand = this.dealt.some((p) => p.u === this.room.me);
      if (this.myBet && !this.inHand) { wallet.grant(this.myBet / 100); this.myBet = 0; this.msg('Ton PRÊT est arrivé trop tard pour cette main : ta mise t’est rendue.'); }
      else if (this.inHand) {
        const pc = handOf(seed, this.room.me);
        if (isBJ(pc)) { this.done = true; this.msg('BLACKJACK !'); this.room.seat({ n: this.cur, acts: '', done: true }); } else this.msg('À toi : tirer, rester ou doubler');
      }
      this.phase = 'play'; this.busy = true; this.updateMeters(); this.setCam('play');
      this.focusStage?.(); this.paintTable(true); this.renderActions();
    }
    if (k === 'b') { this.B = seed; this.finalActs = doc.acts || {}; this.done = true; this.renderActions(); this.finish(); }
  }

  /* ---------- the cards on the table ---------- */
  // brings a row up to date: new cards fly from the shoe (anim), the rest is drawn at once
  async syncRow(row, list, anim, to = 'p') {
    if (!row) return;
    const key = list.map((c) => (c == null ? 'x' : c)).join(',');
    const have = (row.dataset.cards || '').split(',').filter(Boolean);
    const want = key.split(',').filter(Boolean);
    row.dataset.cards = key;
    const same = have.length <= want.length && have.every((c, i) => c === want[i] || (c === 'x' && want[i] !== 'x' && i === have.length - 1));
    if (!anim || !same) { this.putCards(row, want.map((c, i) => (c === 'x' ? { r: 'A', s: '♠', down: true, id: `x${i}` } : fromIndex(+c, `${c}-${i}`)))); return; }
    // a face-down card that now has a value: it turns over
    const nodes = [...row.querySelectorAll(':scope > .bjv-card')];
    have.forEach((c, i) => { if (c === 'x' && want[i] !== 'x' && nodes[i]) { const n = this.cardEl(fromIndex(+want[i])); n.classList.add('down'); row.replaceChild(n, nodes[i]); this.layout(row); setTimeout(() => n.classList.remove('down'), 60); } });
    for (let i = have.length; i < want.length; i++) await this.deal(row, want[i] === 'x' ? { r: 'A', s: '♠' } : fromIndex(+want[i]), want[i] === 'x', to);
  }
  myRow() {
    let el = this.handEl(0);
    if (!el) { el = this.buildHand(); this.placeHands(1); }
    return el;
  }
  paintTable(anim) {
    if (!this.A) return;
    const dc = dealerOf(this.A, this.B), dl = this.B ? dc : [...dc, null];
    this.syncRow(this.dealerRow(), dl, anim, 'd');
    this.bubble(this.q('.bjv-bub.d'), tot(dc), total(dc).t > 21 ? 'bust' : '');
    if (this.inHand) {
      const pc = this.myHand(), el = this.myRow();
      this.syncRow(el, pc, anim);
      this.bubble(el.querySelector('.bjv-bub'), tot(pc), total(pc).t > 21 ? 'bust' : isBJ(pc) ? 'bj' : '');
    }
  }
  // the other players at the places around the table (4 at most; everybody is in the list under the table)
  others(list) { const me = this.room?.me; return list.filter((x) => x.uid !== me).slice(0, 4); }
  paintSeats(list, play) {
    const S = __mods['shop.js'], others = this.others(list);
    for (let i = 0; i < 4; i++) {
      const seat = this.seatEl(i), x = others[i], tag = seat.querySelector('.bjv-tag');
      if (!x) { tag.hidden = true; this.putCards(seat, []); seat.dataset.cards = ''; this.bubble(seat.querySelector('.bjv-bub'), ''); this.result(seat.querySelector('.bjv-res')); continue; }
      const html = `${S?.lookHTML?.(x.look, 'sm') || `<span class="bjv-ini2">${esc(String(x.name || '?').charAt(0).toUpperCase())}</span>`}<b>${esc(x.name)}</b>${x.bet ? `<em>${fmtC(x.bet * ((x.acts || '').includes('d') ? 2 : 1))}</em>` : ''}`;
      if (tag.dataset.h !== html) { tag.dataset.h = html; tag.innerHTML = html; }
      tag.hidden = false; tag.classList.toggle('ok', !!x.ready || !!x.done);
      if (play && this.A) {
        const pc = handOf(this.A, x.uid, x.acts || '');
        this.syncRow(seat, pc, true);
        this.bubble(seat.querySelector('.bjv-bub'), tot(pc), total(pc).t > 21 ? 'bust' : isBJ(pc) ? 'bj' : '');
        this.result(seat.querySelector('.bjv-res'), x.res > 0 ? 'win' : 'lose', x.res != null ? (x.res > 0 ? `+${fmtC(x.res)}` : 'PERDU') : '');
      }
    }
  }

  paintPlay(st) {
    // the other players' hands, live from their seats
    const list = (this.dealt || []).map((p) => {
      const s = this.room.seats[p.u], acts = s && s.n === this.cur ? String(s.acts || '') : '';
      return { uid: p.u, name: p.nm, look: s?.look, bet: p.d?.bet || 0, acts, done: s && s.n === this.cur && s.done };
    });
    this.paint(list); this.paintSeats(list, true);
  }

  finish() {
    this.paintTable(true);
    const dc = dealerOf(this.A, this.B);
    const list = (this.dealt || []).map((p) => {
      const acts = p.u === this.room.me ? this.acts : this.finalActs[p.u] || '';
      return { uid: p.u, name: p.nm, look: this.room.seats[p.u]?.look, bet: p.d?.bet || 0, acts, res: settle(p.d?.bet || 0, acts, handOf(this.A, p.u, acts), dc) };
    });
    this.paint(list); this.paintSeats(list, true);
    this.dealerDo('flip', 600);
    if (!this.inHand || !this.myBet || this.paid) return;
    this.paid = true;
    const pc = this.myHand(), ret = settle(this.myBet, this.acts, pc, dc), stake = this.stakeLabel(), net = ret - stake;
    this.lastPay = ret;
    const el = this.myRow();
    this.result(el.querySelector('.bjv-res'), net > 0 ? (isBJ(pc) ? 'win bj' : 'win') : net < 0 ? 'lose' : 'push', net > 0 ? `${isBJ(pc) ? 'BLACKJACK !' : 'GAGNÉ'}<small>+${fmtC(net)}</small>` : net < 0 ? `PERDU${isBJ(dc) ? '<small>blackjack de la croupière</small>' : total(pc).t > 21 ? '<small>plus de 21</small>' : ''}` : 'ÉGALITÉ');
    this.view.classList.add('done');
    this.msg(`Croupière ${total(dc).t > 21 ? 'saute' : total(dc).t} · ${net > 0 ? `Tu gagnes ${fmtC(net)}` : net < 0 ? `Tu perds ${fmtC(-net)}` : 'Égalité, mise rendue'}`);
    if (ret > 0) { this.win(ret); this.setLast(ret); if (net > 0) { const pt = center(el.querySelector('.bjv-res') || el); fx.burst(pt.x, pt.y, 24, ['#fde047', '#fff', '#86efac'], 7); sfx.win(); this.dealerDo('happy', 1600); } }
    this.renderActions();
  }

  paint(list) {
    const box = this.q('.bjo-others'); if (!box) return;
    const S = __mods['shop.js'], me = this.room?.me, R = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const html = list.length ? list.map((x) => {
      const pc = this.A && x.acts != null ? handOf(this.A, x.uid, x.acts) : null;
      return `<div class="on-p${x.uid === me ? ' me' : ''}">${S?.lookHTML?.(x.look, 'sm') || ''}<b class="pname" data-player="${esc(x.uid)}" data-pname="${esc(x.name)}" ${S?.nameStyle?.(x.look) || ''}>${esc(x.name)}</b>
        <span>${x.bet ? fmtC(x.bet * ((x.acts || '').includes('d') ? 2 : 1)) : ''}</span>
        ${pc ? `<span class="on-mini">${pc.map((c) => `<i class="${Math.floor(c / 13) % 3 ? 'red' : ''}">${R[c % 13]}</i>`).join('')}<small>${isBJ(pc) ? 'BJ' : total(pc).t}</small></span>` : ''}
        ${x.res != null ? (x.res > 0 ? `<em class="w">+${fmtC(x.res)}</em>` : '<em class="l">perdu</em>') : x.ready ? '<em class="w">✔ prêt</em>' : x.done ? '<em>fini</em>' : pc ? '<em>joue…</em>' : '<em>…</em>'}</div>`;
    }).join('') : '<p class="muted small">Personne dans le salon pour l’instant.</p>';
    if (box.dataset.h !== html) { box.dataset.h = html; box.innerHTML = html; }
  }

  info() {
    return this.rules(`<h4>Un blackjack pour tout le salon</h4><p>Choisis ta mise puis appuie sur <b>PRÊT</b>. Les cartes partent dès que <b>tous les joueurs du salon sont prêts</b> : tout de suite si tu es seul ; si quelqu’un ne répond pas, 20 secondes après le premier PRÊT. Ensuite chacun <b>tire</b>, <b>reste</b> ou <b>double</b> (sur ses 2 premières cartes). La croupière joue quand tout le monde a fini (ou au bout de 25 s : sans décision, tu restes).</p>
      <ul class="rules"><li>Blackjack : 6 pour 5</li><li>Main gagnante : 1 pour 1 · Égalité : mise rendue</li><li>Blackjack de la croupière : bat toutes les mains sauf un blackjack (égalité), doubles compris</li><li>La croupière tire sur 17 souple · pas de séparation de paires · sabot infini</li></ul>
      <p class="muted small">Tu vois les mains et les gains des autres joueurs. Il faut un compte pour jouer.</p>`);
  }
}

return { BjOnlineGame };
})();
