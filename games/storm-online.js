// SpinBet Casino · StormOnlineGame — loaded on demand by games/impl/index.js (index.html), after games/rltable.js.
// ---- games/impl/storm-online.js ----
__mods['games/impl/storm-online.js'] = (() => {
// L’Éclair Online: the lightning roulette of L’Éclair, multiplayer only (online.js, OnlineRoom), on the shared 3D table
// (games/rltable.js, RlTableGame; owner's request: every roulette like La Roulette). Everyone in the room places chips
// and presses PRÊT; the spin starts as soon as every seated player is ready (at once when alone, or 20 s after the first
// PRÊT so an absent player never blocks the table). Lightning and ball are the same for all. Every player sees the
// others' bets and wins (list under the table), and the table has its own chat. Same odds and payouts as L’Éclair.

const { RlTableGame } = __mods['games/impl/rltable.js'];
const { fmtC } = __mods['core/base.js'];
const { ORDER, NP, buildDefs, thunder } = __mods['core/roulette.js'];
const { OnlineRoom, rng, wpickR, chatHTML, mountChat, esc, now } = __mods['online.js'];
const { EXTRA_THEMES } = __mods['core/music.js'];
const { sfx } = __mods['audio.js'];
const { wallet } = __mods['wallet.js'];

/* ===ENGINE (L’Éclair, seeded) */
const RESULT_MS = 10000, WAIT_MS = 20000; // the result stays 10 s after the draw; auto start 20 s after the first PRÊT
const ND = [[1, 0.12], [2, 0.22], [3, 0.30], [4, 0.22], [5, 0.14]];
const MD = [[50, 0.919307], [100, 0.140926], [150, 0.075], [200, 0.045], [250, 0.028], [300, 0.015], [400, 0.01], [500, 0.008], [1000, 0.004], [2000, 0.0015], [5000, 0.0006], [10000, 0.0002], [20000, 0.00008], [50000, 0.00002]];
function drawLucky(r) { const n = wpickR(r, ND), pool = [...Array(NP).keys()], res = {}; for (let j = 0; j < n; j++) { const k = Math.floor(r() * pool.length), num = pool.splice(k, 1)[0]; res[num] = wpickR(r, MD); } return res; }
const L = buildDefs(29);
const payOne = (k, a, n, lucky) => { const d = L.DEF[k]; if (!d || !d.n.includes(n)) return 0; return d.n.length === 1 && d.p === 29 && lucky[n] ? a * (lucky[n] + 1) : a * (d.p + 1); };
function settle(bs, n, lucky) { let t = 0; for (const k in bs) t += payOne(k, bs[k], n, lucky); return t; }
const outcome = (seed) => ({ lucky: drawLucky(rng(`${seed}|lucky`)), n: Math.floor(rng(`${seed}|ball`)() * NP) });
/* ===END ENGINE */

const OVER = `<div class="on-timer bjo-timer"><b>Connexion au salon…</b><i><span></span></i><small class="on-wait"></small></div>
  <div class="rl-feat storm"><small>⚡ ÉCLAIRS</small><div class="rl-fv">La roue part dès que tous les joueurs sont prêts</div></div>`;

class StormOnlineGame extends RlTableGame {
  constructor(root, game) {
    super(root, game, {
      music: EXTRA_THEMES.storm, autoplay: false, turbo: false, mainLabel: 'PRÊT', betLabel: 'Ma mise', cls: 'online-game rl-online',
      below: `<div class="on-side"><div class="on-players"><div class="on-chat-h">👥 Joueurs dans le salon</div><div class="on-plist"><p class="muted small">Personne dans le salon.</p></div></div>${chatHTML()}</div>`,
      hello: 'Pose tes jetons puis appuie sur PRÊT : la roue part quand tout le salon est prêt.',
    }, { L, overlay: OVER });
    this.turbo = true; // a shorter show: the result stays 10 s on the table
    this.placed = null; this.result = null; this.cur = 0; this.ready = false;
    this.room = new OnlineRoom(game.id, { two: false, resultMs: RESULT_MS, waitMs: WAIT_MS, onState: (st) => this.onState(st), onSeed: (k, seed, d, n) => this.reveal(seed, d, n) });
    if (!this.room.me) this.tip('Crée un compte (ou connecte-toi) pour jouer : en invité, tu peux seulement regarder la table.', true);
    this.room.start();
    mountChat(this.root, game.id).then((f) => { this.stopChat = f; });
  }

  destroy() { this.room.stop(); this.stopChat?.(); super.destroy(); }
  stakeLabel() { return this.placed ? Object.values(this.placed).reduce((a, b) => a + b, 0) : this.total ? this.total() : 0; }
  goLabel() { return this.ready ? '✔ PRÊT' : 'PRÊT'; }
  goOff() { return this.ready || this.phase !== 'bet' || !this.room?.me; }
  payOf(k, a, res, lucky) { return payOne(k, a, res.r, lucky || {}); }
  msg(t) { if (this.view) this.tip(t); }

  // the room's state, 4 times a second
  onState(st) {
    if (st.phase === 'bet' && st.n !== this.cur) this.newRound(st.n);
    if (st.phase !== this.phase && !(this.showing && st.phase === 'bet')) { this.phase = st.phase === 'bet' ? 'bet' : 'spin'; this.busy = this.phase !== 'bet' || this.ready; this.paintTop(); }
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
    this.cur = n; this.placed = null; this.ready = false; this.result = null; this.paidN = null; this.showing = false;
    this.clearMarks();
    if (played) this.clearFelt(); else { this.clearLucky(); this.phase = 'bet'; }
    const fv = this.q('.rl-feat .rl-fv'); if (fv) fv.textContent = 'La roue part dès que tous les joueurs sont prêts';
    if (this.view.dataset.cam !== 'bet') this.setCam('bet');
    this.busy = false; this.paintAll();
  }

  // PRÊT: the chips on the table are bet (none = I just watch this spin, without blocking the others)
  async onMain() {
    if (this.ready || this.phase !== 'bet') return;
    if (!this.room.me) return this.tip('Crée un compte (ou connecte-toi) pour jouer au salon.', true);
    const bets = { ...this.bets }, tt = this.total();
    if (tt && !this.pay(tt)) return;
    this.ready = true; this.busy = true;
    if (tt) { this.placed = bets; this.lastStake = tt; this.lastBets = bets; }
    this.paintTop();
    this.tip(tt ? `Prêt avec ${fmtC(tt)} · la roue part quand tout le salon est prêt` : 'Prêt sans mise : tu regardes ce tour');
    await this.room.seat({ n: this.cur, ready: true, d: tt ? bets : {}, rt: now(), acts: '', done: false });
  }

  async reveal(seed, doc, n) {
    if (n !== this.cur) return;
    const { lucky, n: num } = outcome(seed);
    const inIt = (doc.p || []).some((p) => p.u === this.room.me);
    if (this.placed && !inIt) { wallet.grant(this.stakeLabel() / 100); this.placed = null; this.tip('Ton PRÊT est arrivé trop tard pour ce tour : ta mise t’est rendue.', true); }
    this.phase = 'spin'; this.busy = true; this.showing = true; this.paintTop();
    this.clearMarks();
    const nums = Object.keys(lucky).map(Number).sort((a, b) => a - b), fv = this.q('.rl-feat .rl-fv');
    fv.textContent = 'Les éclairs frappent…';
    this.flash('rgba(160,200,255,.85)'); thunder();
    for (const k of nums) { this.markLucky(k, lucky[k]); await this.wait(180); if (this.dead || n !== this.cur) return; }
    fv.innerHTML = nums.map((k) => `<span><b>${k}</b> ×${lucky[k]}</span>`).join('');
    await this.setCam('spin');
    if (this.dead || n !== this.cur) return;
    await this.spinTo([ORDER.indexOf(num)], { fast: true });
    if (this.dead || n !== this.cur) return;
    const res = { r: num };
    this.result = res;
    this.hist.unshift(num); this.hist = this.hist.slice(0, 500); this.saveHist();
    this.showWinner(res, lucky);
    sfx.reelStop?.(0);
    await this.wait(900);
    await this.setCam('bet');
    if (this.dead || n !== this.cur) return;
    this.paintLed();
    if (this.placed && this.paidN !== n) {
      this.paidN = n;
      const tt = this.stakeLabel(), ret = await this.payAnim(this.placed, res, lucky);
      if (ret > 0) { this.win(ret); this.lastPay = ret; this.setLast(ret); if (ret > tt) { sfx.win(); this.celebrate(ret, { quick: true, stake: tt }); } } else this.lastPay = 0;
      this.tip(`${lucky[num] ? `⚡ ×${lucky[num]} · ` : ''}${this.resultText(res, lucky, ret, tt)}`);
    } else this.tip(`Le <b>${num}</b>${lucky[num] ? ` · ⚡ ×${lucky[num]}` : ''} · prochain tour dans quelques secondes`);
    this.paintTop();
    this.paintPlayers((doc.p || []).map((p) => ({ uid: p.u, name: p.nm, d: p.d, ready: true, res: settle(p.d || {}, num, lucky) })));
  }
  winnerText(res, lucky) { return lucky?.[res.r] ? `⚡ NUMÉRO FRAPPÉ ×${lucky[res.r]}` : super.winnerText(res); }

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
    return this.rules(`<h4>Une roulette pour tout le salon</h4><p>Pose tes jetons puis appuie sur <b>PRÊT</b>. La roue part dès que <b>tous les joueurs du salon sont prêts</b> : tout de suite si tu es seul. Si quelqu’un ne répond pas, elle part quand même 20 secondes après le premier PRÊT. Sans jeton, PRÊT veut dire « je regarde ce tour ». La foudre et la bille sont les mêmes pour tout le monde ; tu vois les mises et les gains des autres joueurs sous la table, et le salon a son propre chat.</p>
      <ul class="rules"><li>Plein : 29 pour 1 (ou le multiplicateur de l’éclair, ×50 à ×50 000)</li><li>Cheval : 17 · Transversale : 11 · Carré : 8 · Sixain : 5</li><li>Douzaines et colonnes : 2 · Rouge/Noir, Pair/Impair, 1-18/19-36 : 1</li></ul>
      <p class="muted small">Il faut un compte pour jouer ; en invité, tu peux regarder la table.</p>${this.tableRules()}`);
  }
}

return { StormOnlineGame };
})();
