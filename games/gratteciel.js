// SpinBet Casino · GratteCielGame — loaded on demand by games/impl/index.js (index.html).
// ---- games/impl/gratteciel.js ----
__mods['games/impl/gratteciel.js'] = (() => {
// Le Gratte-Ciel: a crane carries a cube left and right at the top of the screen, faster and faster; tap to drop
// it. The cube swings a little on its rope, so it lands near where it was released (SWAY). No wind (owner's request):
// the tower is built like a real stack — it stands as long as the weight of the cubes above each cube rests on it
// (centre of mass over the cube below); a cube missed too much, or a tower leaning too far, and everything falls.
// A near-perfect drop snaps into place (PARFAIT). The multipliers MULT come from tools/sim/gratteciel.js: a very
// good player (20 ms of timing error) gets ≈ 96 % back wherever he cashes in, a less precise one gets less.

const { BaseGame, fmtC } = __mods['core/base.js'];
const { EXTRA_THEMES } = __mods['core/music.js'];
const { sfx } = __mods['audio.js'];
const { fx, center } = __mods['fx.js'];

/* ===ENGINE */
const FLOORS = 30, SWAY = 0.18, SPEED_A = 2.0, SPEED_B = 0.16; // sway: spread of the landing (× cube size); crane speed: cubes/s
const MULT = [0.96, 0.97, 0.98, 1.01, 1.06, 1.12, 1.19, 1.28, 1.39, 1.52, 1.67, 1.84, 2.04, 2.27, 2.54, 2.86, 3.23, 3.66, 4.16, 4.75, 5.45, 6.28, 7.26, 8.41, 9.79, 11.44, 13.43, 15.81, 18.69, 22.14];
const mult = (k) => (k ? MULT[k - 1] : 0);
const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
// Does the stack stand? For every cube, the centre of mass of all the cubes above it must rest over it.
// Returns the worst lean (0 = straight, 1 = about to fall, > 1 = falls).
function lean(stack) {
  let worst = 0, sum = 0;
  for (let j = stack.length - 1; j >= 1; j--) { sum += stack[j].x; const com = sum / (stack.length - j); worst = Math.max(worst, Math.abs(com - stack[j - 1].x) / (stack[j - 1].w / 2)); }
  return worst;
}
/* ===END ENGINE */

const PERFECT = 0.12; // misalignment (× cube size) still counted as perfect
const BASE_H = 26; // ground strip (px)
const COLORS = [['#f43f5e', '#9f1239'], ['#f59e0b', '#b45309'], ['#22c55e', '#15803d'], ['#3b82f6', '#1d4ed8'], ['#a855f7', '#7e22ce'], ['#06b6d4', '#0e7490']];
const xs = (m) => (m >= 100 ? m.toFixed(1).replace('.', ',') : m.toFixed(2).replace('.', ','));

class GratteCielGame extends BaseGame {
  constructor(root, game) {
    super(root, game, {
      music: EXTRA_THEMES.gratteciel, autoplay: false, mainLabel: 'JOUER',
      cls: 'table-game gratteciel',
      head: '<div class="head-meters"><div class="meter gc-fl"><small>Cubes</small><b>0 / 30</b></div><div class="meter gc-cur"><small>Multiplicateur</small><b>—</b></div><div class="meter gc-pot"><small>Encaissable</small><b>0,00\u00a0\uE1E0</b></div></div>',
      stage: `<div class="gc-scene"><div class="gc-sky"></div>
          <div class="gc-world"><div class="gc-ground"></div><div class="gc-socle"><span>START</span></div></div>
          <div class="gc-crane"><div class="gc-rail"></div><div class="gc-hook"><i class="gc-rope"></i><b class="gc-claw"></b></div></div>
          <div class="gc-ladder"></div><div class="gc-say">Mise, puis JOUER : lâche les cubes bien au-dessus les uns des autres !</div></div>
        <div class="gc-bar"><button type="button" class="gc-cash" disabled><small>ENCAISSER</small><b>—</b></button></div>`,
      hello: 'Vise bien : chaque cube posé multiplie ta mise !',
    });
    this.scene = this.q('.gc-scene'); this.world = this.q('.gc-world'); this.hook = this.q('.gc-hook');
    this.playing = false; this.n = 0; this.mover = null; this.lock = false;
    this.q('.gc-ladder').innerHTML = Array.from({ length: FLOORS }, (_, i) => `<span data-k="${i + 1}">×${xs(mult(i + 1))}</span>`).reverse().join('');
    this.scene.addEventListener('pointerdown', (e) => { if (this.playing && !e.target.closest('button')) { e.preventDefault(); this.drop(); } });
    this.q('.gc-cash').addEventListener('click', () => this.cash(false));
    this.reset();
    this.paint();
  }

  destroy() { cancelAnimationFrame(this.raf); super.destroy(); }
  say(t) { this.q('.gc-say').innerHTML = t; }

  // Sizes come from the scene: cube side ≈ 17 % of the width (max 74 px), square base a bit wider.
  measure() {
    const W = this.scene.clientWidth || 360, H = this.scene.clientHeight || 360;
    this.W = W; this.H = H;
    this.cs = Math.round(Math.min(74, Math.max(44, W * 0.17)));
    this.sw = Math.round(this.cs * 1.5);
    this.scene.style.setProperty('--cs', `${this.cs}px`);
    this.scene.style.setProperty('--sw', `${this.sw}px`);
  }

  reset() {
    cancelAnimationFrame(this.raf);
    this.world.querySelectorAll('.gc-cube').forEach((b) => b.remove());
    this.world.classList.remove('topple');
    this.measure();
    // the socle is the first "top": a square centred at the bottom
    this.stack = [{ x: this.W / 2, w: this.sw }];
    this.n = 0; this.mover = null; this.lift = 0;
    this.world.style.transform = 'translateY(0)';
    this.hook.style.left = `${this.W / 2}px`;
    this.hook.classList.remove('has');
    this.hook.querySelector('.gc-cube')?.remove();
  }

  cubeEl(n) {
    const [c0, c1] = COLORS[n % COLORS.length];
    const d = document.createElement('div');
    d.className = 'gc-cube';
    d.style.cssText = `--c0:${c0};--c1:${c1}`;
    d.innerHTML = `<i></i><b>${n}</b>`;
    return d;
  }

  topY(n) { return BASE_H + this.sw + n * this.cs; } // world height of the top of n cubes (from the bottom)

  paint() {
    const n = this.n, cur = mult(n);
    this.q('.gc-fl b').textContent = `${n} / ${FLOORS}`;
    this.q('.gc-cur b').textContent = n ? `×${xs(cur)}` : '—';
    this.q('.gc-pot b').textContent = fmtC(this.playing ? Math.floor(this.bet * cur) : 0);
    const cash = this.q('.gc-cash');
    cash.disabled = !this.playing || !n || this.lock;
    cash.querySelector('b').textContent = this.playing && n ? fmtC(Math.floor(this.bet * cur)) : '—';
    this.mainBtn.querySelector('.main-label').textContent = this.playing ? 'LÂCHER' : 'JOUER';
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
    this.say('Touche l’écran (ou LÂCHER / Espace) quand le cube est au-dessus du socle.');
    this.msg(`Mise ${fmtC(this.bet)} · 1er cube : ×${xs(mult(1))}`);
    sfx.spin();
    this.spawn();
    this.paint();
  }

  // The crane brings the next cube and moves it left and right, faster with the height.
  spawn() {
    const n = this.n + 1, cs = this.cs, W = this.W;
    const cube = this.cubeEl(n);
    this.hook.appendChild(cube);
    this.hook.classList.add('has');
    const lo = cs / 2 + 6, hi = W - cs / 2 - 70; // keep clear of the multiplier ladder on the right
    const m = { x: n % 2 ? lo : hi, dir: n % 2 ? 1 : -1, v: cs * Math.min(9, SPEED_A + SPEED_B * n), el: cube, lo, hi };
    this.mover = m;
    // camera: keep the top of the tower around the middle of the scene
    this.lift = Math.max(0, this.topY(this.n) - this.H * 0.5);
    this.world.style.transform = `translateY(${this.lift}px)`;
    let last = performance.now();
    const tick = (t) => {
      if (this.dead || this.mover !== m) return;
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      m.x += m.dir * m.v * dt;
      if (m.x <= m.lo) { m.x = m.lo; m.dir = 1; }
      if (m.x >= m.hi) { m.x = m.hi; m.dir = -1; }
      this.hook.style.left = `${m.x}px`;
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  async drop() {
    if (!this.playing || this.lock || !this.mover) return;
    const m = this.mover, top = this.stack[this.stack.length - 1], cs = this.cs;
    this.mover = null; cancelAnimationFrame(this.raf);
    this.lock = true; this.paint();
    const n = this.n + 1;
    let x = m.x + SWAY * cs * gauss(); // the cube was swinging on its rope: it lands a little off
    const dx = x - top.x, perfect = Math.abs(dx) <= cs * PERFECT, lands = Math.abs(dx) <= top.w / 2;
    if (perfect) x = top.x;
    const tilt = lands ? lean([...this.stack, { x, w: cs }]) : 2;
    // the cube leaves the hook and falls (gravity) to the top of the stack, drawn in the scene's coordinates
    const hr = this.hook.querySelector('.gc-cube').getBoundingClientRect(), sr = this.scene.getBoundingClientRect();
    const startY = hr.top - sr.top; // top of the falling cube in the scene
    this.hook.querySelector('.gc-cube').remove(); this.hook.classList.remove('has');
    const fall = this.cubeEl(n);
    fall.classList.add('falling');
    fall.style.left = `${m.x - cs / 2}px`; fall.style.top = `${startY}px`;
    this.scene.appendChild(fall);
    const landTop = this.H - (this.topY(this.n) - this.lift) - cs; // scene y of the cube's top once landed
    const dist = landTop - startY, T = Math.max(220, Math.sqrt(Math.max(1, dist)) * 26) * (this.turbo ? 0.6 : 1);
    sfx.click();
    if (!lands) {
      // misses the top: falls past it and tumbles off the side
      const side = dx < 0 ? -1 : 1;
      fall.animate([{ transform: 'translate(0,0) rotate(0)' }, { transform: `translate(0, ${dist}px) rotate(0)`, offset: 0.55 }, { transform: `translate(${side * 90}px, ${this.H}px) rotate(${side * 160}deg)` }], { duration: T * 2.2, easing: 'cubic-bezier(.45,0,1,1)', fill: 'forwards' });
      await this.wait(T * 1.2);
      sfx.puff(); this.shake();
      await this.wait(T * 0.4);
      if (this.n) { this.world.classList.add('topple'); this.shake(); await this.wait(900); }
      fall.remove();
      return this.lose(this.n ? `Le cube ${n} est tombé à côté… et toute la tour s’écroule !` : `Le cube ${n} est tombé à côté !`);
    }
    await fall.animate([{ transform: 'translate(0,0)' }, { transform: `translate(${x - m.x}px, ${dist}px)` }], { duration: T, easing: 'cubic-bezier(.5,0,1,1)', fill: 'forwards' }).finished.catch(() => {});
    if (this.dead) return;
    fall.remove();
    const cube = this.cubeEl(n);
    cube.style.left = `${x - cs / 2}px`; cube.style.bottom = `${this.topY(this.n)}px`;
    // an off-centre cube leans a little
    cube.style.setProperty('--tilt', `${perfect ? 0 : Math.max(-6, Math.min(6, (dx / cs) * 10)).toFixed(1)}deg`);
    cube.classList.add('placed');
    this.world.appendChild(cube);
    sfx.reelStop?.(1);
    const p = center(cube);
    if (perfect) {
      fx.burst(p.x, p.y, 26, ['#fde047', '#fff', '#38bdf8'], 6);
      fx.floatText(p.x, p.y - 40, 'PARFAIT !', '#fde047', 22);
    } else fx.dust?.(p.x, p.y + cs / 2, 10);
    await this.wait(240);
    if (this.dead) return;
    if (tilt > 1) { // the weight is no longer over the cubes below: the tower tips over
      this.say('😱 La tour penche trop…');
      this.world.classList.add('topple');
      sfx.puff?.(); this.shake();
      await this.wait(1000);
      if (this.dead) return;
      return this.lose(`Le cube ${n} était trop décalé : la tour perd l’équilibre et s’écroule !`);
    }
    this.stack.push({ x, w: cs });
    this.n = n;
    sfx.coin();
    fx.floatText(p.x, p.y - (perfect ? 70 : 30), `×${xs(mult(n))}`, '#86efac', 22);
    [this.q('.gc-cur'), this.q('.gc-pot')].forEach((e) => { e.classList.remove('bump'); void e.offsetWidth; e.classList.add('bump'); });
    this.lock = false;
    if (n >= FLOORS) return this.cash(true);
    this.say(`${perfect ? '🎯 Parfait ! ' : tilt > 0.7 ? '⚠️ La tour penche ! ' : ''}Cube ${n} : <b>×${xs(mult(n))}</b> · le suivant ×${xs(mult(n + 1))}`);
    this.msg(`Cube ${n} posé · encaisse ou continue`);
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
  }

  cash(top) {
    if (!this.playing || !this.n || this.lock) return;
    if (this.mover) { this.mover = null; cancelAnimationFrame(this.raf); this.hook.querySelector('.gc-cube')?.remove(); this.hook.classList.remove('has'); }
    const x = mult(this.n), won = Math.floor(this.bet * x);
    this.playing = false;
    this.win(won);
    this.setLast(won);
    this.slotEl.classList.add('gc-won');
    this.say(top ? `🏆 30 cubes ! Le gratte-ciel est fini : <b>${fmtC(won)}</b>` : `Encaissé : <b>${fmtC(won)}</b> (×${xs(x)}) avec ${this.n} cube${this.n > 1 ? 's' : ''}`);
    this.msg(`Gain : ${fmtC(won)} (×${xs(x)})`);
    this.paint();
    this.celebrate(won);
  }

  info() {
    return this.rules(`<h4>Comment jouer</h4><p>Choisis ta mise et appuie sur JOUER. En haut, la grue promène un cube de gauche à droite : touche l’écran (ou LÂCHER, ou Espace) pour le lâcher. Il tombe sur le socle carré en bas, puis sur les cubes déjà posés. Si le milieu du cube arrive au-dessus du cube d’en dessous, il tient ; un cube lâché presque pile au-dessus est <b>PARFAIT</b> et se cale tout droit. Sinon il tombe à côté et la mise est perdue. Plus la tour monte, plus la grue va vite.</p>
      <h4>Une vraie tour</h4><p>Pas de coup de vent : la tour tient tant qu’elle est équilibrée. Le cube se balance un peu au bout du câble, il tombe donc près de l’endroit où tu le lâches. S’il tombe trop à côté, ou si les cubes décalés font trop pencher la tour, <b>tout s’écroule</b>. Un cube PARFAIT se cale bien droit et redresse la tour. Tu peux <b>encaisser</b> après chaque cube, jusqu’à 30 cubes.</p>
      <h4>Gains (× la mise)</h4><p>${Array.from({ length: FLOORS }, (_, k) => `${k + 1} : ×${xs(mult(k + 1))}`).join(' · ')}</p>
      <h4>Équité</h4><p>Les multiplicateurs sont calculés sur des millions de tours simulés : un très bon joueur récupère environ 96 % de ses mises, où qu’il encaisse ; viser moins bien fait baisser ce retour.</p>`);
  }
}

return { GratteCielGame };
})();
