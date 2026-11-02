// SpinBet Casino · StormOnlineGame — loaded on demand by games/impl/index.js (index.html).
// ---- games/impl/storm-online.js ----
__mods['games/impl/storm-online.js'] = (() => {
// L’Éclair Online: the lightning roulette of L’Éclair, multiplayer only (online.js, OnlineRoom). Everyone in the room
// places chips and presses PRÊT; the spin starts as soon as every seated player is ready (at once when alone, or
// 20 s after the first PRÊT so an absent player never blocks the table). Lightning and ball are the same for all.
// Every player sees the others' bets and wins, and the table has its own chat. Same odds and payouts as L’Éclair.

const { BaseGame, fmtC } = __mods['core/base.js'];
const { ORDER, NP, colr, buildDefs, tableHTML, wheelSVG, spinBalls, thunder, ballTick, BetBoard } = __mods['core/roulette.js'];
const { OnlineRoom, rng, wpickR, chatHTML, mountChat, esc, now } = __mods['online.js'];
const { EXTRA_THEMES } = __mods['core/music.js'];
const { sfx } = __mods['audio.js'];
const { fx, center } = __mods['fx.js'];
const { wallet } = __mods['wallet.js'];

/* ===ENGINE (L’Éclair, seeded) */
const RESULT_MS = 10000, WAIT_MS = 20000; // the result stays 10 s after the draw; auto start 20 s after the first PRÊT
const ND = [[1, 0.12], [2, 0.22], [3, 0.30], [4, 0.22], [5, 0.14]];
const MD = [[50, 0.919307], [100, 0.140926], [150, 0.075], [200, 0.045], [250, 0.028], [300, 0.015], [400, 0.01], [500, 0.008], [1000, 0.004], [2000, 0.0015], [5000, 0.0006], [10000, 0.0002], [20000, 0.00008], [50000, 0.00002]];
function drawLucky(r) { const n = wpickR(r, ND), pool = [...Array(NP).keys()], res = {}; for (let j = 0; j < n; j++) { const k = Math.floor(r() * pool.length), num = pool.splice(k, 1)[0]; res[num] = wpickR(r, MD); } return res; }
const L = buildDefs(29);
function settle(bs, n, lucky) { let t = 0; for (const k in bs) { const d = L.DEF[k]; if (!d || !d.n.includes(n)) continue; t += (d.n.length === 1 && d.p === 29 && lucky[n]) ? bs[k] * (lucky[n] + 1) : bs[k] * (d.p + 1); } return t; }
const outcome = (seed) => ({ lucky: drawLucky(rng(`${seed}|lucky`)), n: Math.floor(rng(`${seed}|ball`)() * NP) });
/* ===END ENGINE */

class StormOnlineGame extends BaseGame {
  constructor(root, game) {
    super(root, game, {
      music: EXTRA_THEMES.storm, stepper: false, autoplay: false, turbo: false, mainLabel: 'PRÊT', betLabel: 'Ma mise',
      cls: 'table-game online-game',
      head: '<div class="hist"></div>',
      stage: `<div class="on-timer"><b>Connexion au salon…</b><i><span></span></i><small class="on-wait"></small></div>
        <div class="wheel-zone"><svg class="rwheel" viewBox="0 0 300 300">${wheelSVG(1)}</svg><div class="rres"></div><div class="bolt-bar">⚡ La roue part dès que tous les joueurs sont prêts</div></div>`,
      below: `<div class="felt">${tableHTML(L)}${BetBoard.chipsHTML()}</div>
        <div class="on-side"><div class="on-players"><div class="on-chat-h">👥 Joueurs dans le salon</div><div class="on-plist"><p class="muted small">Personne dans le salon.</p></div></div>${chatHTML()}</div>`,
      hello: 'Pose tes jetons puis appuie sur PRÊT : la roue part quand tout le salon est prêt.',
    });
    this.wstate = { wcur: 0 }; this.histArr = []; this.placed = null; this.result = null; this.cur = 0;
    this.board = new BetBoard(this, this.q('.felt'), L);
    this.board.paint();
    this.room = new OnlineRoom(game.id, { two: false, resultMs: RESULT_MS, waitMs: WAIT_MS, onState: (st) => this.onState(st), onSeed: (k, seed, d, n) => this.reveal(seed, d, n) });
    if (!this.room.me) this.msg('Crée un compte (ou connecte-toi) pour jouer : en invité, tu peux seulement regarder la table.');
    this.room.start();
    mountChat(this.root, game.id).then((f) => { this.stopChat = f; });
  }

  destroy() { this.room.stop(); this.stopChat?.(); super.destroy(); }
  stakeLabel() { return this.placed ? Object.values(this.placed).reduce((a, b) => a + b, 0) : this.board ? this.board.total() : 0; }
  chipSound() { sfx.click(); }
  onMeters() { if (this.mainBtn) this.mainBtn.disabled = this.ready || this.phase !== 'bet' || !this.room?.me; }

  // the room's state, 4 times a second
  onState(st) {
    if (st.phase === 'bet' && st.n !== this.cur) this.newRound(st.n);
    if (st.phase !== this.phase) { this.phase = st.phase; this.busy = st.phase !== 'bet' || this.ready; this.updateMeters(); }
    const bar = this.q('.on-timer'), b = bar.querySelector('b'), w = bar.querySelector('.on-wait'), sp = bar.querySelector('span');
    if (st.phase === 'bet') {
      const total = st.present.length, nr = st.ready.length, left = st.autoAt ? Math.max(0, st.autoAt - now()) : 0;
      b.textContent = !total ? 'Faites vos jeux · appuie sur PRÊT' : `Faites vos jeux · ${nr} / ${total} prêt${nr > 1 ? 's' : ''}`;
      w.textContent = nr && st.waiting.length ? `En attente de ${st.waiting.map((s) => s.name).slice(0, 4).join(', ')}${st.waiting.length > 4 ? '…' : ''} · départ auto dans ${Math.ceil(left / 1000)} s` : '';
      sp.style.width = `${total ? (nr / total) * 100 : 0}%`;
      bar.classList.remove('closed');
      this.paintPlayers(st.present.map((s) => ({ uid: s.uid, name: s.name, look: s.look, d: s.n === st.n ? s.d : null, ready: s.n === st.n && s.ready })));
    } else {
      b.textContent = this.result ? 'Résultat' : 'Rien ne va plus'; w.textContent = '';
      sp.style.width = '100%'; bar.classList.add('closed');
    }
  }

  newRound(n) {
    const played = !!this.placed;
    this.cur = n; this.placed = null; this.ready = false; this.result = null; this.paidN = null;
    this.q('.rres').classList.remove('on');
    this.qa('.rt-c.hit').forEach((e) => e.classList.remove('hit'));
    this.qa('.rt-c.lucky').forEach((e) => { e.classList.remove('lucky'); e.querySelector('.lm')?.remove(); });
    this.q('.bolt-bar').textContent = '⚡ La roue part dès que tous les joueurs sont prêts';
    if (played) this.board.afterRound(); else this.board.paint();
    this.busy = false; this.updateMeters();
  }

  // PRÊT: the chips on the table are bet (none = I just watch this spin, without blocking the others)
  async onMain() {
    if (this.ready || this.phase !== 'bet') return;
    if (!this.room.me) return this.msg('Crée un compte (ou connecte-toi) pour jouer au salon.');
    const bets = { ...this.board.bets }, tt = this.board.total();
    if (tt && !this.pay(tt)) return;
    this.ready = true; this.busy = true; this.updateMeters();
    if (tt) { this.placed = bets; this.lastStake = tt; this.board.last = bets; }
    this.msg(tt ? `Prêt avec ${fmtC(tt)} · la roue part quand tout le salon est prêt` : 'Prêt sans mise : tu regardes ce tour');
    await this.room.seat({ n: this.cur, ready: true, d: tt ? bets : {}, rt: now(), acts: '', done: false });
  }

  async reveal(seed, doc, n) {
    if (n !== this.cur) return;
    const { lucky, n: num } = outcome(seed);
    const inIt = (doc.p || []).some((p) => p.u === this.room.me);
    if (this.placed && !inIt) { wallet.grant(this.stakeLabel() / 100); this.placed = null; this.msg('Ton PRÊT est arrivé trop tard pour ce tour : ta mise t’est rendue.'); }
    this.phase = 'result'; this.busy = true; this.updateMeters();
    this.focusStage?.();
    this.slotEl.classList.add('storming');
    const nums = Object.keys(lucky).map(Number).sort((a, b) => a - b);
    this.flash('rgba(160,200,255,.85)'); thunder();
    for (const k of nums) { this.markLucky(k, lucky[k]); thunder(); await this.wait(170); if (this.dead) return; }
    this.slotEl.classList.remove('storming');
    this.q('.bolt-bar').innerHTML = '⚡ ' + nums.map((k) => `<b>${k}</b> ×${lucky[k]}`).join(' · ');
    await spinBalls(this.q('.rwheel'), this.wstate, [ORDER.indexOf(num)], { turbo: true, speed: 1.4, tick: ballTick });
    if (this.dead || n !== this.cur) return;
    this.result = { n: num, lucky };
    const rs = this.q('.rres'); rs.textContent = num; rs.className = 'rres on ' + colr(num);
    this.histArr.unshift(num); this.histArr = this.histArr.slice(0, 14);
    this.q('.hist').innerHTML = this.histArr.map((x) => `<span class="${colr(x)}">${x}</span>`).join('');
    const he = this.board.els['n' + num]; he?.classList.add('hit');
    if (this.placed && this.paidN !== n) {
      this.paidN = n;
      const tt = this.stakeLabel(), ret = settle(this.placed, num, lucky), net = ret - tt;
      this.msg(`Le <b>${num}</b>${lucky[num] ? ` · ⚡ ×${lucky[num]}` : ''} · ${net > 0 ? `Tu gagnes ${fmtC(net)}` : net < 0 ? `Tu perds ${fmtC(-net)}` : 'Mise rendue'}`);
      if (ret > 0) { this.win(ret); this.setLast(ret); if (he) { const p = center(he); fx.burst(p.x, p.y, 30, ['#fde047', '#fff', '#9fd4ff'], 8); } if (net > 0) this.celebrate(ret, { quick: true }); }
    } else this.msg(`Le <b>${num}</b>${lucky[num] ? ` · ⚡ ×${lucky[num]}` : ''} · prochain tour dans quelques secondes`);
    this.paintPlayers((doc.p || []).map((p) => ({ uid: p.u, name: p.nm, d: p.d, ready: true, res: settle(p.d || {}, num, lucky) })));
  }

  markLucky(k, m) {
    const e = this.board.els['n' + k]; if (!e) return;
    e.classList.add('lucky');
    const lm = document.createElement('b'); lm.className = 'lm'; lm.textContent = '×' + m; e.appendChild(lm);
    const p = center(e); fx.burst(p.x, p.y, 12, ['#fff', '#9fd4ff', '#ffe14a'], 6);
  }

  paintPlayers(list) {
    const box = this.q('.on-plist'); if (!box) return;
    const S = __mods['shop.js'], me = this.room?.me;
    const html = list.length ? list.map((b) => {
      const tt = b.d ? Object.values(b.d).reduce((x, y) => x + y, 0) : 0;
      return `<div class="on-p${b.uid === me ? ' me' : ''}">${S?.lookHTML?.(b.look, 'sm') || ''}<b class="pname" data-player="${esc(b.uid)}" data-pname="${esc(b.name)}" ${S?.nameStyle?.(b.look) || ''}>${esc(b.name)}</b>
        <span>${tt ? fmtC(tt) : b.ready ? 'regarde' : ''}</span>${b.res != null ? (b.res > 0 ? `<em class="w">+${fmtC(b.res)}</em>` : tt ? '<em class="l">perdu</em>' : '') : b.ready ? '<em class="w">✔ prêt</em>' : '<em>…</em>'}</div>`;
    }).join('') : '<p class="muted small">Personne dans le salon pour l’instant.</p>';
    if (box.dataset.h !== html) { box.dataset.h = html; box.innerHTML = html; }
  }

  info() {
    return this.rules(`<h4>Une roulette pour tout le salon</h4><p>Pose tes jetons puis appuie sur <b>PRÊT</b>. La roue part dès que <b>tous les joueurs du salon sont prêts</b> : tout de suite si tu es seul. Si quelqu’un ne répond pas, elle part quand même 20 secondes après le premier PRÊT. Sans jeton, PRÊT veut dire « je regarde ce tour ». La foudre et la bille sont les mêmes pour tout le monde ; tu vois les mises et les gains des autres joueurs, et le salon a son propre chat.</p>
      <ul class="rules"><li>Plein : 29 pour 1 (ou le multiplicateur de l’éclair, ×50 à ×50 000)</li><li>Cheval : 17 · Transversale : 11 · Carré : 8 · Sixain : 5</li><li>Douzaines et colonnes : 2 · Rouge/Noir, Pair/Impair, 1-18/19-36 : 1</li></ul>
      <p class="muted small">Il faut un compte pour jouer ; en invité, tu peux regarder la table.</p>`);
  }
}

return { StormOnlineGame };
})();
