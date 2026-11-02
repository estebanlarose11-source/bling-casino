// SpinBet Casino · StormOnlineGame — loaded on demand by games/impl/index.js (index.html).
// ---- games/impl/storm-online.js ----
__mods['games/impl/storm-online.js'] = (() => {
// L’Éclair Online: the lightning roulette of L’Éclair, multiplayer only. A spin every 15 seconds for the whole
// table (online.js): 7,5 s to place chips, then the lightning and the ball, the same for everyone. Every player
// sees the others' bets and wins, and the table has its own chat. Same odds and payouts as L’Éclair.

const { BaseGame, fmtC } = __mods['core/base.js'];
const { ORDER, NP, colr, buildDefs, tableHTML, wheelSVG, spinBalls, thunder, ballTick, BetBoard } = __mods['core/roulette.js'];
const { OnlineTable, rng, wpickR, chatHTML, mountChat, esc } = __mods['online.js'];
const { EXTRA_THEMES } = __mods['core/music.js'];
const { sfx } = __mods['audio.js'];
const { fx, center } = __mods['fx.js'];
const { wallet } = __mods['wallet.js'];

/* ===ENGINE (L’Éclair, seeded) */
const LEN = 15000, CLOSE = 7500;
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
      music: EXTRA_THEMES.storm, stepper: false, autoplay: false, turbo: false, mainLabel: 'MISER', betLabel: 'Ma mise',
      cls: 'table-game online-game',
      head: '<div class="hist"></div>',
      stage: `<div class="on-timer"><b>Connexion à la table…</b><i><span></span></i></div>
        <div class="wheel-zone"><svg class="rwheel" viewBox="0 0 300 300">${wheelSVG(1)}</svg><div class="rres"></div><div class="bolt-bar">⚡ Un tour toutes les 15 secondes, pour toute la table</div></div>`,
      below: `<div class="felt">${tableHTML(L)}${BetBoard.chipsHTML()}</div>
        <div class="on-side"><div class="on-players"><div class="on-chat-h">👥 Joueurs à la table</div><div class="on-plist"><p class="muted small">Personne n’a misé sur ce tour.</p></div></div>${chatHTML()}</div>`,
      hello: 'Pose tes jetons pendant le compte à rebours : ils partent tout seuls au tour suivant.',
    });
    this.wstate = { wcur: 0 }; this.histArr = []; this.placed = null; this.result = null;
    this.board = new BetBoard(this, this.q('.felt'), L);
    this.board.paint();
    this.table = new OnlineTable(game.id, {
      len: LEN, seeds: { a: CLOSE },
      onRound: (r) => this.newRound(r), onTick: (t) => this.onTick(t), onSeed: (k, seed, d, r) => this.reveal(seed, r), onBets: (l) => this.paintPlayers(l),
    });
    if (!this.table.me) this.msg('Crée un compte (ou connecte-toi) pour miser : en invité, tu peux seulement regarder la table.');
    this.table.start();
    mountChat(this.root, game.id).then((f) => { this.stopChat = f; });
  }

  destroy() { this.table.stop(); this.stopChat?.(); super.destroy(); }
  stakeLabel() { return this.placed ? Object.values(this.placed).reduce((a, b) => a + b, 0) : this.board ? this.board.total() : 0; }
  chipSound() { sfx.click(); }
  onMeters() { if (this.mainBtn) this.mainBtn.disabled = !!this.placed || this.closed || !this.board?.total() || !this.table?.me; }

  newRound(r) {
    const played = !!this.placed;
    this.round0 = r; this.placed = null; this.result = null; this.closed = false; this.busy = false;
    this.q('.rres').classList.remove('on');
    this.qa('.rt-c.hit').forEach((e) => e.classList.remove('hit'));
    this.qa('.rt-c.lucky').forEach((e) => { e.classList.remove('lucky'); e.querySelector('.lm')?.remove(); });
    this.q('.bolt-bar').textContent = '⚡ Faites vos jeux : la foudre frappe à la fin du compte à rebours';
    if (played) this.board.afterRound();
    else this.board.paint();
    this.paintPlayers([]);
    this.updateMeters();
  }

  onTick(t) {
    const left = Math.max(0, CLOSE - t), bar = this.q('.on-timer');
    bar.querySelector('b').textContent = t < CLOSE ? `Faites vos jeux · ${Math.ceil(left / 1000)} s` : this.result ? 'Résultat' : 'Rien ne va plus';
    bar.querySelector('span').style.width = `${t < CLOSE ? (left / CLOSE) * 100 : 0}%`;
    bar.classList.toggle('closed', t >= CLOSE);
    if (!this.placed && t >= CLOSE - 450 && t < CLOSE && this.board.total() > 0) this.confirm();
    if (t >= CLOSE && !this.closed) { this.closed = true; this.busy = true; this.updateMeters(); }
    // nobody could draw the spin (connection lost): the bet comes back
    if (t > LEN - 250 && this.placed && !this.result && !this.refunded) { this.refunded = true; wallet.grant(this.stakeLabel() / 100); this.msg('Tour annulé (connexion perdue) : ta mise t’est rendue.'); }
  }

  onMain() { this.confirm(); }

  async confirm() {
    if (this.placed || this.closed || !this.board.total()) return;
    if (!this.table.me) return this.msg('Crée un compte (ou connecte-toi) pour miser à la table.');
    const bets = { ...this.board.bets }, tt = this.board.total();
    if (!this.pay(tt)) return;
    this.placed = bets; this.lastStake = tt; this.board.last = bets; this.refunded = false; this.busy = true;
    this.updateMeters();
    this.msg(`Mise de ${fmtC(tt)} acceptée · attends la foudre…`);
    try { await this.table.putBet({ b: bets, t: tt }); }
    catch (e) { console.error(e); this.placed = null; wallet.grant(tt / 100); this.msg('Trop tard pour ce tour : ta mise t’est rendue.'); this.updateMeters(); }
  }

  async reveal(seed, r) {
    const { lucky, n } = outcome(seed);
    const t0 = this.tNow();
    this.slotEl.classList.add('storming');
    const nums = Object.keys(lucky).map(Number).sort((a, b) => a - b);
    if (t0 < LEN - 6000) {
      this.flash('rgba(160,200,255,.85)'); thunder();
      for (const k of nums) { this.markLucky(k, lucky[k]); thunder(); await this.wait(170); if (this.dead || this.round0 !== r) return; }
    } else nums.forEach((k) => this.markLucky(k, lucky[k]));
    this.slotEl.classList.remove('storming');
    this.q('.bolt-bar').innerHTML = '⚡ ' + nums.map((k) => `<b>${k}</b> ×${lucky[k]}`).join(' · ');
    if (this.tNow() < LEN - 3800) await spinBalls(this.q('.rwheel'), this.wstate, [ORDER.indexOf(n)], { turbo: true, speed: 1.4, tick: ballTick }); // ≈ 3,5 s
    if (this.dead || this.round0 !== r) return;
    this.result = { n, lucky };
    const rs = this.q('.rres'); rs.textContent = n; rs.className = 'rres on ' + colr(n);
    this.histArr.unshift(n); this.histArr = this.histArr.slice(0, 14);
    this.q('.hist').innerHTML = this.histArr.map((x) => `<span class="${colr(x)}">${x}</span>`).join('');
    const he = this.board.els['n' + n]; he?.classList.add('hit');
    if (this.placed) {
      const tt = this.stakeLabel(), ret = settle(this.placed, n, lucky), net = ret - tt;
      this.msg(`Le <b>${n}</b>${lucky[n] ? ` · ⚡ ×${lucky[n]}` : ''} · ${net > 0 ? `Tu gagnes ${fmtC(net)}` : net < 0 ? `Tu perds ${fmtC(-net)}` : 'Mise rendue'}`);
      if (ret > 0) { this.win(ret); this.setLast(ret); if (he) { const p = center(he); fx.burst(p.x, p.y, 30, ['#fde047', '#fff', '#9fd4ff'], 8); } if (net > 0) this.celebrate(ret, { quick: true }); }
    } else this.msg(`Le <b>${n}</b>${lucky[n] ? ` · ⚡ ×${lucky[n]}` : ''} · pose tes jetons pour le prochain tour !`);
    this.paintPlayers(this.table.bets);
  }

  tNow() { const { now } = __mods['online.js']; return now() - this.round0 * LEN; }
  markLucky(k, m) {
    const e = this.board.els['n' + k]; if (!e) return;
    e.classList.add('lucky');
    const lm = document.createElement('b'); lm.className = 'lm'; lm.textContent = '×' + m; e.appendChild(lm);
    const p = center(e); fx.burst(p.x, p.y, 12, ['#fff', '#9fd4ff', '#ffe14a'], 6);
  }

  paintPlayers(list) {
    const box = this.q('.on-plist'); if (!box) return;
    const S = __mods['shop.js'], me = this.table?.me;
    box.innerHTML = list.length ? list.map((b) => {
      const tt = b.d?.t || 0, ret = this.result ? settle(b.d?.b || {}, this.result.n, this.result.lucky) : null;
      return `<div class="on-p${b.uid === me ? ' me' : ''}">${S?.lookHTML?.(b.look, 'sm') || ''}<b class="pname" data-player="${esc(b.uid)}" data-pname="${esc(b.name)}" ${S?.nameStyle?.(b.look) || ''}>${esc(b.name)}</b>
        <span>${fmtC(tt)}</span>${ret == null ? '<em>…</em>' : ret > 0 ? `<em class="w">+${fmtC(ret)}</em>` : '<em class="l">perdu</em>'}</div>`;
    }).join('') : '<p class="muted small">Personne n’a misé sur ce tour.</p>';
  }

  info() {
    return this.rules(`<h4>Une roulette pour toute la table</h4><p>Un tour toutes les <b>15 secondes</b>, le même pour tous les joueurs présents. Pendant le compte à rebours (7,5 s), pose tes jetons : ils partent tout seuls à la fin (ou appuie sur MISER). Ensuite la foudre frappe et la bille tourne. Tu vois les mises et les gains des autres joueurs, et la table a son propre chat.</p>
      <ul class="rules"><li>Plein : 29 pour 1 (ou le multiplicateur de l’éclair, ×50 à ×50 000)</li><li>Cheval : 17 · Transversale : 11 · Carré : 8 · Sixain : 5</li><li>Douzaines et colonnes : 2 · Rouge/Noir, Pair/Impair, 1-18/19-36 : 1</li></ul>
      <p class="muted small">Il faut un compte pour miser ; en invité, tu peux regarder la table.</p>`);
  }
}

return { StormOnlineGame };
})();
