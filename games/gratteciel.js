// SpinBet Casino · GratteCielGame — loaded on demand by games/impl/index.js (index.html).
// ---- games/impl/gratteciel.js ----
__mods['games/impl/gratteciel.js'] = (() => {
// Le Gratte-Ciel: stack floors on a tower. A floor slides left and right, faster and faster; tap to drop
// it. What hangs over the floor below is cut off, a floor that misses completely falls and loses the stake.
// Each floor also faces a gust of wind (fixed chance P) that topples the tower. The multiplier after
// k floors is 0,96 / (1 − P)^k: a perfect aim gets exactly 96 %, a missed drop only lowers it.

const { BaseGame, fmtC } = __mods['core/base.js'];
const { EXTRA_THEMES } = __mods['core/music.js'];
const { sfx } = __mods['audio.js'];
const { fx, center } = __mods['fx.js'];

/* ===ENGINE */
const EDGE = 0.96, P = 0.15, FLOORS = 30;
const mult = (k) => (k ? Math.floor((EDGE / (1 - P) ** k) * 100) / 100 : 0);
const gust = () => Math.random() < P;
/* ===END ENGINE */

const H = 34; // floor height (px)
const W0 = 52; // starting width (% of the scene)
const PERFECT = 2.2; // % of misalignment still counted as perfect
const COLORS = [['#f43f5e', '#9f1239'], ['#f59e0b', '#b45309'], ['#22c55e', '#15803d'], ['#3b82f6', '#1d4ed8'], ['#a855f7', '#7e22ce'], ['#06b6d4', '#0e7490']];
const xs = (m) => (m >= 100 ? m.toFixed(1).replace('.', ',') : m.toFixed(2).replace('.', ','));
const speedOf = (n) => Math.min(130, 32 + n * 4.2); // % of the width per second

class GratteCielGame extends BaseGame {
  constructor(root, game) {
    super(root, game, {
      music: EXTRA_THEMES.gratteciel, autoplay: false, mainLabel: 'JOUER',
      cls: 'table-game gratteciel',
      head: '<div class="head-meters"><div class="meter gc-fl"><small>Étages</small><b>0 / 30</b></div><div class="meter gc-cur"><small>Multiplicateur</small><b>—</b></div><div class="meter gc-pot"><small>Encaissable</small><b>0,00 KE</b></div></div>',
      stage: `<div class="gc-scene"><div class="gc-sky"></div><div class="gc-wind"></div><div class="gc-world"><div class="gc-ground"></div></div>
          <div class="gc-ladder"></div><div class="gc-say">Mise, puis JOUER : pose les étages bien au-dessus les uns des autres !</div></div>
        <div class="gc-bar"><button type="button" class="gc-cash" disabled><small>ENCAISSER</small><b>—</b></button></div>`,
      hello: 'Vise bien : chaque étage posé multiplie ta mise !',
    });
    this.scene = this.q('.gc-scene'); this.world = this.q('.gc-world');
    this.playing = false; this.n = 0; this.mover = null; this.lock = false;
    this.q('.gc-ladder').innerHTML = Array.from({ length: FLOORS }, (_, i) => `<span data-k="${i + 1}">×${xs(mult(i + 1))}</span>`).reverse().join('');
    this.scene.addEventListener('pointerdown', (e) => { if (this.playing && !e.target.closest('button')) { e.preventDefault(); this.drop(); } });
    this.q('.gc-cash').addEventListener('click', () => this.cash(false));
    this.reset();
    this.paint();
  }

  destroy() { cancelAnimationFrame(this.raf); super.destroy(); }
  say(t) { this.q('.gc-say').innerHTML = t; }

  reset() {
    cancelAnimationFrame(this.raf);
    this.world.querySelectorAll('.gc-blk').forEach((b) => b.remove());
    this.stack = [{ x: 50 - W0 / 2, w: W0 }];
    this.addBlock(0, this.stack[0], 'base');
    this.n = 0; this.mover = null;
    this.world.style.transform = 'translateY(0)';
  }

  addBlock(n, b, cls = '') {
    const [c0, c1] = COLORS[n % COLORS.length];
    const d = document.createElement('div');
    d.className = `gc-blk ${cls}`;
    d.style.cssText = `left:${b.x}%;width:${b.w}%;bottom:${30 + n * H}px;--c0:${c0};--c1:${c1}`;
    this.world.appendChild(d);
    return d;
  }

  paint() {
    const n = this.n, cur = mult(n);
    this.q('.gc-fl b').textContent = `${n} / ${FLOORS}`;
    this.q('.gc-cur b').textContent = n ? `×${xs(cur)}` : '—';
    this.q('.gc-pot b').textContent = fmtC(this.playing ? Math.floor(this.bet * cur) : 0);
    const cash = this.q('.gc-cash');
    cash.disabled = !this.playing || !n || this.lock;
    cash.querySelector('b').textContent = this.playing && n ? fmtC(Math.floor(this.bet * cur)) : '—';
    const lab = this.mainBtn.querySelector('.main-label');
    lab.textContent = this.playing ? 'POSER' : 'JOUER';
    this.mainBtn.disabled = this.playing && this.lock;
    this.qa('.gc-ladder span').forEach((s) => { const k = +s.dataset.k; s.classList.toggle('done', this.playing && k <= n); s.classList.toggle('next', this.playing && k === n + 1); });
    const lad = this.q('.gc-ladder'), nx = lad.querySelector('.next') || lad.lastElementChild;
    lad.scrollTo({ top: nx.offsetTop - lad.clientHeight / 2, behavior: 'smooth' });
    this.q('[data-act="bet-"]').disabled = this.playing || this.bi === 0;
    this.q('[data-act="bet+"]').disabled = this.playing || this.bi === this.cfg.bets.length - 1;
    this.slotEl.classList.toggle('gc-on', this.playing);
  }

  onMeters() { if (this.stack) this.paint(); }
  onBetChange() { this.paint(); }

  onMain() {
    if (this.playing) return this.drop();
    if (!this.pay(this.bet)) return;
    this.lastStake = this.bet;
    this.reset();
    this.playing = true; this.lock = false;
    this.setLast(0); this.winAmt.textContent = '';
    this.slotEl.classList.remove('gc-lost', 'gc-won');
    this.say('Touche l’écran (ou POSER / Espace) pour lâcher l’étage.');
    this.msg(`Mise ${fmtC(this.bet)} · étage 1 : ×${xs(mult(1))}`);
    sfx.spin();
    this.spawn();
    this.paint();
  }

  // A new floor slides in from one side, at a speed that grows with the height.
  spawn() {
    const n = this.n + 1, top = this.stack[this.stack.length - 1];
    const fromLeft = n % 2 === 1;
    const m = { x: fromLeft ? 0 : 100 - top.w, w: top.w, dir: fromLeft ? 1 : -1, v: speedOf(n) };
    m.el = this.addBlock(n, m, 'moving');
    this.mover = m;
    const lift = Math.max(0, (n - 6) * H);
    this.world.style.transform = `translateY(${lift}px)`;
    let last = performance.now();
    const tick = (t) => {
      if (this.dead || this.mover !== m) return;
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      m.x += m.dir * m.v * dt;
      if (m.x <= 0) { m.x = 0; m.dir = 1; }
      if (m.x >= 100 - m.w) { m.x = 100 - m.w; m.dir = -1; }
      m.el.style.left = `${m.x}%`;
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  async drop() {
    if (!this.playing || this.lock || !this.mover) return;
    const m = this.mover, top = this.stack[this.stack.length - 1];
    this.mover = null; cancelAnimationFrame(this.raf);
    this.lock = true; this.paint();
    const n = this.n + 1;
    let x = m.x, w = m.w, perfect = false;
    if (Math.abs(m.x - top.x) <= PERFECT) { x = top.x; perfect = true; }
    const l = Math.max(x, top.x), r = Math.min(x + w, top.x + top.w), ov = r - l;
    if (ov <= 0.4) {
      // missed: the floor falls off the tower
      m.el.classList.add('fall');
      sfx.puff();
      this.shake();
      await this.wait(600);
      return this.lose(`L’étage ${n} est tombé à côté !`);
    }
    if (!perfect && ov < w) {
      // cut what hangs over
      const cutX = x < top.x ? x : r, cutW = w - ov;
      const piece = this.addBlock(n, { x: cutX, w: cutW }, 'cut');
      piece.style.setProperty('--dir', x < top.x ? -1 : 1);
      setTimeout(() => piece.remove(), 900);
      x = l; w = ov;
    }
    m.el.style.left = `${x}%`; m.el.style.width = `${w}%`;
    m.el.classList.remove('moving'); m.el.classList.add('placed');
    sfx.reelStop?.(1);
    const p = center(m.el);
    if (perfect) {
      fx.burst(p.x, p.y, 26, ['#fde047', '#fff', '#38bdf8'], 6);
      fx.floatText(p.x, p.y - 40, 'PARFAIT !', '#fde047', 22);
    } else fx.dust?.(p.x, p.y + H / 2, 10);
    await this.wait(260);
    if (this.dead) return;
    if (gust()) {
      this.scene.classList.add('windy');
      sfx.huff?.();
      fx.wind?.(this.scene.getBoundingClientRect(), 1, 70);
      this.say('🌬️ Coup de vent !');
      await this.wait(700);
      if (this.dead) return;
      this.world.classList.add('topple');
      this.shake();
      await this.wait(700);
      this.scene.classList.remove('windy');
      return this.lose(`🌬️ Coup de vent à l’étage ${n} : la tour s’écroule !`);
    }
    this.stack.push({ x, w });
    this.n = n;
    sfx.coin();
    fx.floatText(p.x, p.y - (perfect ? 70 : 30), `×${xs(mult(n))}`, '#86efac', 22);
    [this.q('.gc-cur'), this.q('.gc-pot')].forEach((e) => { e.classList.remove('bump'); void e.offsetWidth; e.classList.add('bump'); });
    this.lock = false;
    if (n >= FLOORS) return this.cash(true);
    this.say(`${perfect ? '🎯 Parfait ! ' : ''}Étage ${n} : <b>×${xs(mult(n))}</b> · le suivant ×${xs(mult(n + 1))}`);
    this.msg(`Étage ${n} posé · encaisse ou continue`);
    this.spawn();
    this.paint();
  }

  lose(text) {
    this.playing = false; this.lock = false; this.mover = null;
    this.slotEl.classList.add('gc-lost');
    this.flash('rgba(248,113,113,.55)');
    this.say(`${text}${this.n ? ` Tu avais ×${xs(mult(this.n))} en jeu.` : ''}`);
    this.msg(`Perdu · mise ${fmtC(this.bet)}`);
    this.setLast(0);
    this.paint();
    setTimeout(() => { if (!this.playing && !this.dead) { this.world.classList.remove('topple'); } }, 1600);
  }

  cash(top) {
    if (!this.playing || !this.n || this.lock) return;
    if (this.mover) { this.mover.el.remove(); this.mover = null; cancelAnimationFrame(this.raf); }
    const x = mult(this.n), won = Math.floor(this.bet * x);
    this.playing = false;
    this.win(won);
    this.setLast(won);
    this.slotEl.classList.add('gc-won');
    this.say(top ? `🏆 30 étages ! Le gratte-ciel est fini : <b>${fmtC(won)}</b>` : `Encaissé : <b>${fmtC(won)}</b> (×${xs(x)}) avec ${this.n} étage${this.n > 1 ? 's' : ''}`);
    this.msg(`Gain : ${fmtC(won)} (×${xs(x)})`);
    this.paint();
    this.celebrate(won);
  }

  info() {
    return this.rules(`<h4>Comment jouer</h4><p>Choisis ta mise et appuie sur JOUER. Un étage glisse de gauche à droite au-dessus de la tour : touche l’écran (ou POSER, ou Espace) pour le lâcher. La partie qui dépasse est coupée, et l’étage suivant aura la même largeur. Un étage posé presque pile au-dessus est <b>PARFAIT</b> : il garde toute sa largeur. Si l’étage tombe complètement à côté, la mise est perdue. Plus la tour monte, plus les étages vont vite.</p>
      <h4>Coup de vent</h4><p>À chaque étage posé, il y a ${Math.round(P * 100)} % de risque qu’un coup de vent fasse tomber la tour. Tu peux <b>encaisser</b> après chaque étage, jusqu’à 30 étages.</p>
      <h4>Gains (× la mise)</h4><p>${Array.from({ length: FLOORS }, (_, k) => `${k + 1} : ×${xs(mult(k + 1))}`).join(' · ')}</p>
      <h4>Équité</h4><p>Multiplicateur après k étages : 0,96 ÷ 0,85<sup>k</sup>, arrondi au centième inférieur. En visant parfaitement, le retour au joueur est de 96 % ; chaque étage raté le fait baisser.</p>`);
  }
}

return { GratteCielGame };
})();
