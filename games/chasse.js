// SpinBet Casino · ChasseGame — loaded on demand by games/impl/index.js (index.html).
// ---- games/impl/chasse.js ----
__mods['games/impl/chasse.js'] = (() => {
// La Chasse: one stake buys 5 cartridges (each worth a fifth of the stake). For 30 seconds game crosses the field:
// ducks and pheasants in the sky, rabbits, boars and deer on the ground, behind or in front of trees, bushes and
// logs. Every animal hit reveals a random multiplier of its cartridge (×0 to ×100, the same odds for every
// animal); the rare golden deer pays ×1 000 if the shot lands (it is fast and often dodges). The round pays the
// sum. A missed shot, or a shot into a tree / bush / log in front of the animal, is lost. Painted art by the owner
// in assets/games/chasse/. Tuned so that a perfect shooter gets ≈ 95 % back; any missed shot only lowers it.

const { BaseGame, fmtC } = __mods['core/base.js'];
const { EXTRA_THEMES } = __mods['core/music.js'];
const { sfx, isMuted, audioContext } = __mods['audio.js'];
const { fx } = __mods['fx.js'];

/* ===ENGINE */
const SHOTS = 5, ROUND_S = 30;
// multiplier of the cartridge for any animal hit (expected value 0,90)
const MULTS = [[0, 0.409], [0.5, 0.2], [1, 0.25], [2, 0.1], [5, 0.03], [10, 0.01], [100, 0.001]];
const GOLD = { x: 1000, appear: 1 / 250, success: 1 / 16 }; // ≈ +0,05 of the stake for a perfect shooter
const drawMult = () => { let r = Math.random(); for (const [m, p] of MULTS) { if (r < p) return m; r -= p; } return 0; };
const goldRound = () => Math.random() < GOLD.appear;
const goldHit = () => Math.random() < GOLD.success;
const payout = (bet, sum) => Math.floor((bet * sum) / SHOTS); // cents
/* ===END ENGINE */

const IMG_V = 3;
const asset = (p) => window.__assets?.[p] || `${p}?v=${IMG_V}`; // single-file version: images are inlined
const src = (n) => asset(`assets/games/chasse/${n}.webp`);
const xs = (m) => (m >= 100 ? Math.round(m).toLocaleString('fr-FR') : String(m).replace('.', ','));
// sprites: image, natural facing (1 right, -1 left), width (% of the field), sky or ground, crossing time (s), weight
const KINDS = {
  duck: { img: 'duck', face: 1, w: 14, sky: true, t: 4.6, wgt: 3, name: 'Canard' },
  pheasant: { img: 'pheasant', face: 1, w: 15, sky: true, t: 3.9, wgt: 2, name: 'Faisan' },
  rabbit: { img: 'rabbit', face: 1, w: 9, t: 3.6, wgt: 3, hop: true, name: 'Lapin' },
  boar: { img: 'boar', face: 1, w: 15, t: 4.3, wgt: 2, name: 'Sanglier' },
  deer: { img: 'deer', face: 1, w: 21, t: 3.4, wgt: 1, name: 'Cerf' },
  deer2: { img: 'deer2', face: -1, w: 19, t: 3.2, wgt: 1, hop: true, name: 'Cerf' },
};
const RATIO = { duck: 304 / 900, pheasant: 361 / 900, rabbit: 462 / 900, boar: 451 / 900, deer: 610 / 900, deer2: 724 / 900, gold: 610 / 900, tree: 519 / 800, log: 152 / 900 };
const TOD = ['day', 'dusk', 'night'];
const pickKind = () => { const l = Object.entries(KINDS); let r = Math.random() * l.reduce((a, [, k]) => a + k.wgt, 0); for (const [id, k] of l) { if (r < k.wgt) return id; r -= k.wgt; } return 'duck'; };
const rand = (a, b) => a + Math.random() * (b - a);
const SCOPE = '<svg viewBox="0 0 60 60"><circle cx="30" cy="30" r="22" fill="none" stroke="#000" stroke-opacity=".45" stroke-width="4"/><circle cx="30" cy="30" r="22" fill="none" stroke="#fff" stroke-width="2"/><path d="M30 2 V20 M30 40 V58 M2 30 H20 M40 30 H58" stroke="#fff" stroke-width="2"/><circle cx="30" cy="30" r="2" fill="#ef4444"/></svg>';

class ChasseGame extends BaseGame {
  constructor(root, game) {
    super(root, game, {
      music: EXTRA_THEMES.chasse, autoplay: false, mainLabel: 'JOUER', turbo: false,
      cls: 'table-game chasse',
      head: '<div class="head-meters"><div class="meter ht-m-shots"><small>Cartouches</small><b>5</b></div><div class="meter ht-m-sum"><small>Total</small><b>×0</b></div><div class="meter ht-m-win"><small>Gain</small><b>—</b></div></div>',
      stage: `<div class="ht-field">
          <div class="ht-hud"><span class="ht-shells">${'<i></i>'.repeat(SHOTS)}</span><span class="ht-time">${ROUND_S}<small> s</small></span><span class="ht-sum">×0</span></div>
          <div class="ht-layer"></div><div class="ht-scope">${SCOPE}</div><div class="ht-banner"></div>
          <div class="ht-start"><b>5 cartouches · 30 secondes</b><span>Chaque animal touché révèle un multiplicateur.<br>Le cerf doré vaut ×1 000 !</span><small>Choisis ta mise puis JOUER</small></div>
          <div class="ht-rotate"><b>↻</b><span>Tourne ton téléphone pour jouer en grand</span></div>
        </div>`,
      hello: 'Vise les animaux : chaque tir réussi révèle un multiplicateur !',
    });
    this.field = this.q('.ht-field'); this.layer = this.q('.ht-layer'); this.scope = this.q('.ht-scope');
    this.playing = false; this.animals = []; this.obst = [];
    this.setTod(Math.floor(Math.random() * 3));
    this.field.addEventListener('pointerdown', (e) => this.shoot(e));
    this.field.addEventListener('pointermove', (e) => this.aim(e));
    this.field.addEventListener('pointerleave', () => this.scope.classList.remove('on'));
    this.onFs = () => this.lockLandscape();
    document.addEventListener('fullscreenchange', this.onFs);
    ['duck', 'pheasant', 'rabbit', 'boar', 'deer', 'deer2', 'gold', 'tree', 'log', 'bg-day', 'bg-dusk', 'bg-night'].forEach((n) => { new Image().src = src(n); });
    this.paint();
  }

  destroy() {
    cancelAnimationFrame(this.raf); clearTimeout(this.goldT);
    document.removeEventListener('fullscreenchange', this.onFs);
    try { screen.orientation?.unlock?.(); } catch { /* ignore */ }
    super.destroy();
  }

  // phones: in full screen, hold the landscape orientation (Android; iPhone shows the "turn your phone" hint)
  lockLandscape() {
    if (!matchMedia('(pointer: coarse)').matches) return;
    try { if (document.fullscreenElement) screen.orientation?.lock?.('landscape').catch(() => {}); else screen.orientation?.unlock?.(); } catch { /* ignore */ }
  }

  setTod(i) { this.tod = i; this.field.style.backgroundImage = `url("${src(`bg-${TOD[i]}`)}")`; this.field.dataset.tod = TOD[i]; }

  aim(e) {
    if (e.pointerType !== 'mouse') return;
    const r = this.field.getBoundingClientRect();
    this.scope.style.left = `${e.clientX - r.left}px`; this.scope.style.top = `${e.clientY - r.top}px`;
    this.scope.classList.toggle('on', this.playing);
  }

  paint() {
    const left = this.playing ? this.shots : SHOTS;
    this.q('.ht-m-shots b').textContent = left;
    this.q('.ht-m-sum b').textContent = `×${xs(this.sum || 0)}`;
    this.q('.ht-m-win b').textContent = this.playing || this.sum ? fmtC(payout(this.lastStake || this.bet, this.sum || 0)) : '—';
    this.qa('.ht-shells i').forEach((s, k) => s.classList.toggle('used', k >= left));
    this.q('.ht-sum').textContent = `×${xs(this.sum || 0)}`;
    const lab = this.mainBtn.querySelector('.main-label');
    lab.textContent = this.playing ? 'EN CHASSE…' : 'JOUER';
    this.mainBtn.disabled = this.playing;
    this.q('[data-act="bet-"]').disabled = this.playing || this.bi === 0;
    this.q('[data-act="bet+"]').disabled = this.playing || this.bi === this.cfg.bets.length - 1;
    this.slotEl.classList.toggle('ht-on', this.playing);
  }

  onMeters() { if (this.field) this.paint(); }
  onBetChange() { this.paint(); }

  /* ---------- the field ---------- */
  // 3 to 4 obstacles: trees (they hide low birds too), bushes and logs, each at a depth (bottom line, %)
  layout() {
    this.obst.forEach((o) => o.el.remove());
    const types = ['tree', 'tree', 'bush', 'bush', 'log', 'log'].sort(() => Math.random() - 0.5).slice(0, 3 + (Math.random() < 0.5 ? 1 : 0));
    const slots = [12, 34, 58, 82].sort(() => Math.random() - 0.5);
    this.obst = types.map((t, i) => {
      const w = t === 'tree' ? rand(17, 22) : t === 'bush' ? rand(10, 13) : rand(17, 22);
      const bottom = t === 'tree' ? rand(80, 88) : t === 'bush' ? rand(100, 104) : rand(90, 97);
      const el = document.createElement('img');
      el.className = `ht-o ht-${t}`; el.src = src(t === 'log' ? 'log' : 'tree'); el.alt = ''; el.draggable = false;
      el.style.cssText = `left:${slots[i] + rand(-5, 5) - w / 2}%;width:${w}%;bottom:${100 - bottom}%;z-index:${Math.round(bottom * 10)}`;
      this.layer.appendChild(el);
      return { el, t, z: Math.round(bottom * 10) };
    });
  }

  spawn(kind, gold = false) {
    const k = gold ? { img: 'gold', face: 1, w: 21, t: 1.7, name: 'Cerf doré' } : KINDS[kind];
    const dir = Math.random() < 0.5 ? 1 : -1, fw = this.field.clientWidth || 800, fh = this.field.clientHeight || 450;
    const depth = k.sky ? 1 : rand(0, 1); // 0 far, 1 near
    const sc = k.sky ? rand(0.8, 1.15) : 0.7 + depth * 0.5;
    const w = k.w * sc * (fw < 520 ? 1.3 : 1);
    const hPct = (w / 100) * fw * RATIO[k.img] / fh * 100;
    const bottom = k.sky ? rand(30, 52) : 74 + depth * 22; // % from the top of the field
    const el = document.createElement('img');
    el.className = `ht-a${gold ? ' gold' : ''}`; el.src = src(k.img); el.alt = ''; el.draggable = false;
    el.style.width = `${w}%`;
    el.style.setProperty('--flip', dir * k.face < 0 ? -1 : 1);
    const z = k.sky ? 5 : Math.round(bottom * 10) - 1;
    el.style.zIndex = z;
    this.layer.appendChild(el);
    const a = { el, k, gold, dir, w, hPct, bottom, z, x: dir > 0 ? -w : 100, speed: (100 + w) / (k.t * (gold ? 1 : rand(0.85, 1.2))), ph: rand(0, 6), bob: k.sky ? rand(2, 6) : 0, alive: true };
    this.animals.push(a);
    return a;
  }

  loop(t) {
    if (this.dead) return;
    const dt = Math.min(0.05, (t - (this.last || t)) / 1000); this.last = t;
    if (this.playing) {
      this.left -= dt;
      this.q('.ht-time').firstChild.textContent = Math.max(0, Math.ceil(this.left));
      this.field.classList.toggle('hurry', this.left < 6);
      if (this.left <= 0) { this.endRound('time'); }
      this.nextSpawn -= dt;
      if (this.nextSpawn <= 0 && this.animals.filter((a) => a.alive).length < 4) { this.spawn(pickKind()); this.nextSpawn = rand(0.55, 1.3); }
    }
    for (const a of this.animals) {
      if (!a.alive) continue;
      a.x += a.dir * a.speed * dt * (a.flee ? 2.6 : 1);
      let top = a.bottom - a.hPct;
      if (a.k.sky) top += Math.sin(a.ph + t / 380) * a.bob;
      else if (a.k.hop) top -= Math.abs(Math.sin(a.ph + t / 160)) * 3;
      a.el.style.left = `${a.x}%`; a.el.style.top = `${top}%`;
      if (a.x > 102 || a.x < -a.w - 2) { a.alive = false; a.el.remove(); }
    }
    this.animals = this.animals.filter((a) => a.alive || a.falling);
    this.raf = requestAnimationFrame((n) => this.loop(n));
  }

  onMain() {
    if (this.playing || !this.pay(this.bet)) return;
    this.lastStake = this.bet;
    this.animals.forEach((a) => a.el.remove()); this.animals = [];
    this.setTod(Math.floor(Math.random() * 3));
    this.layout();
    this.playing = true; this.shots = SHOTS; this.sum = 0; this.left = ROUND_S; this.nextSpawn = 0.3;
    this.q('.ht-start').classList.add('hide');
    this.setLast(0); this.winAmt.textContent = '';
    this.msg(`Mise ${fmtC(this.bet)} · 5 cartouches à ${fmtC(this.bet / SHOTS)}`);
    sfx.spin();
    if (window.__htGold || goldRound()) this.goldT = setTimeout(() => { if (this.playing) { this.spawn('deer', true); this.flashGold(); } }, rand(4, 20) * 1000 * (window.__htGold ? 0.1 : 1));
    this.last = 0; cancelAnimationFrame(this.raf); this.raf = requestAnimationFrame((n) => this.loop(n));
    this.paint();
  }

  flashGold() { const b = this.q('.ht-banner'); b.innerHTML = '<b>✨ CERF DORÉ ! ✨</b><span>×1 000 si tu le touches</span>'; b.className = 'ht-banner gold on'; setTimeout(() => b.classList.remove('on'), 1600); }

  bang() {
    if (isMuted()) return;
    try {
      const c = audioContext(); if (!c) return;
      const t = c.currentTime, len = Math.floor(c.sampleRate * 0.35), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
      const s = c.createBufferSource(); s.buffer = buf;
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(3200, t); f.frequency.exponentialRampToValueAtTime(300, t + 0.3);
      const g = c.createGain(); g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      s.connect(f).connect(g).connect(c.destination); s.start(t);
      const o = c.createOscillator(), og = c.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.18);
      og.gain.setValueAtTime(0.7, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.2); o.connect(og).connect(c.destination); o.start(t); o.stop(t + 0.22);
    } catch { /* no audio */ }
  }

  // A shot: the front-most thing under the sight takes it (tree, bush, log or animal).
  shoot(e) {
    if (!this.playing || this.shots <= 0) return;
    e.preventDefault();
    const px = e.clientX, py = e.clientY, fr = this.field.getBoundingClientRect();
    this.shots--;
    this.bang();
    this.mark(px - fr.left, py - fr.top);
    this.field.classList.remove('recoil'); void this.field.offsetWidth; this.field.classList.add('recoil');
    const inside = (el, m) => { const r = el.getBoundingClientRect(); return px >= r.left + r.width * m && px <= r.right - r.width * m && py >= r.top + r.height * m && py <= r.bottom - r.height * m; };
    const cands = [
      ...this.obst.filter((o) => inside(o.el, o.t === 'log' ? 0.02 : 0.14)).map((o) => ({ z: o.z, o })),
      ...this.animals.filter((a) => a.alive && !a.flee && inside(a.el, 0.1)).map((a) => ({ z: a.z, a })),
    ].sort((p, q) => q.z - p.z);
    const top = cands[0];
    if (!top) this.pop('💨 Raté !', fr, px, py, 'miss');
    else if (top.o) this.pop(top.o.t === 'tree' ? '🌳 Dans l’arbre !' : top.o.t === 'log' ? '🪵 Dans le tronc !' : '🌿 Dans le buisson !', fr, px, py, 'miss');
    else this.hit(top.a, fr, px, py);
    this.paint();
    if (this.shots <= 0) setTimeout(() => this.endRound('shots'), 900);
  }

  hit(a, fr, px, py) {
    if (a.gold) {
      if (!(window.__htGold || goldHit())) { a.flee = true; this.pop('😮 Le cerf doré a esquivé !', fr, px, py, 'miss'); return; }
      this.sum += GOLD.x;
      this.fall(a);
      this.pop(`×${xs(GOLD.x)}`, fr, px, py, 'jack');
      this.flash('rgba(253,224,71,.6)'); fx.confetti(120); sfx.jackpot?.();
      return;
    }
    const m = drawMult();
    this.sum = Math.round((this.sum + m) * 10) / 10;
    this.fall(a);
    this.pop(`×${xs(m)}`, fr, px, py, m === 0 ? 'zero' : m >= 100 ? 'jack' : m >= 5 ? 'big' : m >= 1 ? 'ok' : 'low');
    fx.burst(px, py, a.k.sky ? 26 : 14, a.k.sky ? ['#fff', '#e7d3b5', '#8b5a2b'] : ['#fde68a', '#fbbf24', '#fff'], a.k.sky ? 7 : 5);
    if (m >= 5) sfx.bigWin?.(); else if (m > 0) sfx.coin(); else sfx.tick?.();
  }

  fall(a) {
    a.alive = false; a.falling = true;
    a.el.classList.add(a.k.sky ? 'fall-sky' : 'fall');
    setTimeout(() => { a.el.remove(); a.falling = false; }, 1100);
  }

  pop(text, fr, px, py, cls) {
    const p = document.createElement('b');
    p.className = `ht-pop ${cls}`; p.textContent = text;
    p.style.left = `${px - fr.left}px`; p.style.top = `${py - fr.top}px`;
    this.field.appendChild(p); setTimeout(() => p.remove(), 1500);
  }

  mark(x, y) {
    const m = document.createElement('i');
    m.className = 'ht-shot'; m.style.left = `${x}px`; m.style.top = `${y}px`;
    this.field.appendChild(m); setTimeout(() => m.remove(), 800);
  }

  endRound(why) {
    if (!this.playing) return;
    this.playing = false;
    clearTimeout(this.goldT);
    this.animals.forEach((a) => { if (a.alive) a.flee = true; });
    this.field.classList.remove('hurry');
    this.scope.classList.remove('on');
    const won = payout(this.lastStake, this.sum);
    const b = this.q('.ht-banner');
    b.innerHTML = `<small>${why === 'time' ? 'Temps écoulé' : 'Fin de la chasse'}</small><b>Total ×${xs(this.sum)}</b><span>${won > 0 ? `+${fmtC(won)}` : 'Pas de gain cette fois'}</span>`;
    b.className = 'ht-banner on end';
    setTimeout(() => { b.classList.remove('on'); this.q('.ht-start').classList.remove('hide'); }, 2600);
    if (won > 0) { this.win(won); this.setLast(won); this.celebrate(won); }
    this.msg(won > 0 ? `Gain : ${fmtC(won)} (total ×${xs(this.sum)} sur 5 cartouches)` : 'Pas de gain : retente ta chance !');
    this.paint();
  }

  info() {
    const rows = MULTS.map(([m, p]) => `<tr><td>×${xs(m)}</td><td>${(p * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %</td></tr>`).join('');
    return this.rules(`<h4>Comment jouer</h4><p>Choisis ta mise et appuie sur JOUER : tu as <b>5 cartouches</b> (chacune vaut un cinquième de la mise) et <b>30 secondes</b>. Canards, faisans, lapins, sangliers et cerfs traversent le terrain : <b>clique (ou touche) un animal pour tirer</b>.</p>
      <h4>Le tir</h4><p>Un tir à côté, ou dans un arbre, un buisson ou un tronc placé devant l’animal, est perdu. Chaque animal touché révèle un multiplicateur de sa cartouche, tiré au hasard (les mêmes chances pour tous les animaux) :</p>
      <table class="ht-rules"><tr><th>Multiplicateur</th><th>Chance</th></tr>${rows}</table>
      <h4>Le cerf doré</h4><p>Il passe rarement et très vite. S’il est touché et qu’il n’esquive pas : <b>×1 000</b> la cartouche.</p>
      <h4>Le gain</h4><p>À la fin (5 tirs ou 30 secondes), les multiplicateurs s’additionnent : gain = mise × total ÷ 5. Retour au joueur pour un tireur parfait : environ 95 % ; chaque tir raté le diminue.</p>
      <h4>Plein écran</h4><p>Le bouton Plein écran agrandit le terrain sur tout l’écran ; sur téléphone, tourne-le à l’horizontale.</p>`);
  }
}

return { ChasseGame };
})();
