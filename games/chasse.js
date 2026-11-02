// SpinBet Casino · ChasseGame (The Hunt) — loaded on demand by games/impl/index.js (index.html).
// ---- games/impl/chasse.js ----
__mods['games/impl/chasse.js'] = (() => {
// The Hunt (ex-La Chasse): 5×3 slot, 243 ways, with the owner's painted animals (lapin, canard, faisan, sanglier, cerf), card
// symbols 10 J Q K A, the golden deer WILD and the shotgun cartridge SCATTER. 3 cartridges open the hunt (the
// field of the old La Chasse) with 3 shots, 4 or 5 cartridges the big hunt with 5 shots, where the golden deer may
// cross (×500). Every animal hit reveals a multiplier × the bet (×2 to ×250). Tuned by simulation: ≈ 92,6 % for a
// perfect shooter (≈ 90 % when 15 % of the shots miss); hunt buys ≈ 89 % (3 shots) and ≈ 87,5 % (5 shots).

const { BaseGame, fmtC } = __mods['core/base.js'];
const { Reels } = __mods['core/reels.js'];
const { EXTRA_THEMES } = __mods['core/music.js'];
const { sfx, isMuted, audioContext } = __mods['audio.js'];
const { fx, center } = __mods['fx.js'];

/* ===ENGINE */
// 5×3, 243 ways. Low cards 10 J Q K A (0-4), animals (5-9: lapin, canard, faisan, sanglier, cerf), golden deer WILD
// (10, reels 2-4) and the cartridge SCATTER (11, any reel, one per reel at most). 3 cartridges: the hunt with 3 shots;
// 4 or 5: the big hunt with 5 shots (and the golden deer may cross). Each animal hit pays a multiplier × the bet.
const COLS = 5, ROWS = 3, N = 15, WILD = 10, SCAT = 11, CAPX = 5000;
const P = {
  w: [30, 28, 26, 24, 22, 13, 11, 9, 7, 5], wild: 3.2, scat: 0.095,
  pays: [[0.25, 0.5, 1], [0.25, 0.5, 1.2], [0.3, 0.6, 1.5], [0.4, 0.8, 2], [0.5, 1, 2.5], [0.8, 2, 5], [1, 2.5, 6], [1.2, 3, 8], [1.5, 4, 12], [2, 6, 20]],
  K: 1.96,
};
// hunt: multiplier × the bet for every animal hit (same odds for every animal)
const HUNT = [[2, 30], [3, 24], [5, 18], [8, 12], [10, 8], [15, 4], [25, 2.5], [50, 1.1], [100, 0.35], [250, 0.05]];
const GOLD = { x: 500, appear: 1 / 12, success: 1 / 8 }; // big hunt only
const SHOTS = { 3: 3, 4: 5, 5: 5 };
function wpick(l) { let t = 0; for (const x of l) t += x[1]; let r = Math.random() * t; for (const x of l) { if (r < x[1]) return x[0]; r -= x[1]; } return l[l.length - 1][0]; }
function sym(c) {
  const ws = c >= 1 && c <= 3 ? P.wild : 0;
  let t = ws; for (const x of P.w) t += x;
  let q = Math.random() * t;
  if (q < ws) return WILD; q -= ws;
  for (let i = 0; i < P.w.length; i++) { if (q < P.w[i]) return i; q -= P.w[i]; }
  return 0;
}
function reel(c) {
  const col = [sym(c), sym(c), sym(c)];
  if (Math.random() < P.scat) col[Math.floor(Math.random() * ROWS)] = SCAT;
  return col;
}
function ways(g) {
  const wins = [];
  for (let s = 0; s < P.w.length; s++) {
    let n = 0, w = 1; const cells = [];
    for (let c = 0; c < COLS; c++) {
      let k = 0;
      for (let r = 0; r < ROWS; r++) { const v = g[c * ROWS + r]; if (v === s || v === WILD) { k++; cells.push(c * ROWS + r); } }
      if (!k) break; n++; w *= k;
    }
    if (n >= 3) wins.push({ s, n, ways: w, x: P.pays[s][n - 3] * P.K * w, cells: cells.filter((i) => Math.floor(i / ROWS) < n) });
  }
  return wins;
}
function spin() {
  const g = [];
  for (let c = 0; c < COLS; c++) g.push(...reel(c));
  const wins = ways(g);
  const scat = g.filter((v) => v === SCAT).length;
  return { g, wins, x: wins.reduce((a, w) => a + w.x, 0), scat, shots: scat >= 3 ? SHOTS[Math.min(5, scat)] : 0 };
}
const huntMult = () => wpick(HUNT);
/* ===END ENGINE */

const BUY3 = 21, BUY5 = 41;
const HUNT_S = { 3: 20, 5: 30 }; // seconds of hunt for 3 and 5 shots

const IMG_V = 3;
const asset = (p) => window.__assets?.[p] || `${p}?v=${IMG_V}`; // single-file version: images are inlined
const src = (n) => asset(`assets/games/chasse/${n}.webp`);
const xs = (m) => (m >= 100 ? Math.round(m).toLocaleString('fr-FR') : String(m).replace('.', ','));
const CARDS = ['10', 'J', 'Q', 'K', 'A'];
const ANIMALS = ['rabbit', 'duck', 'pheasant', 'boar', 'deer'];
const NAMES = ['10', 'Valet', 'Dame', 'Roi', 'As', 'Lapin', 'Canard', 'Faisan', 'Sanglier', 'Cerf'];
// the shotgun cartridge (scatter): red ribbed shell, brass head
const SHELL = `<svg class="ch-shell" viewBox="0 0 44 100" aria-hidden="true"><defs>
  <linearGradient id="chRed" x1="0" x2="1"><stop offset="0" stop-color="#6b0f0f"/><stop offset=".3" stop-color="#f05252"/><stop offset=".55" stop-color="#d61f1f"/><stop offset="1" stop-color="#5c0b0b"/></linearGradient>
  <linearGradient id="chBrass" x1="0" x2="1"><stop offset="0" stop-color="#7c4a03"/><stop offset=".32" stop-color="#fff2b8"/><stop offset=".55" stop-color="#f2b632"/><stop offset="1" stop-color="#6b3d02"/></linearGradient></defs>
  <path d="M9 14 Q22 4 35 14 V66 H9 Z" fill="url(#chRed)" stroke="#3f0606" stroke-width="1.2"/>
  <path d="M13 12 L22 6 L31 12 M15 14 L22 9 L29 14" fill="none" stroke="#3f0606" stroke-opacity=".6" stroke-width="1.2"/>
  <g stroke="#ffffff" stroke-opacity=".18" stroke-width="1.4"><path d="M14 20 V64 M19 18 V64 M24 18 V64 M29 20 V64"/></g>
  <path d="M12 18 Q14 16 15 18 V62 H12 Z" fill="#fff" fill-opacity=".3"/>
  <rect x="7" y="64" width="30" height="24" rx="2" fill="url(#chBrass)" stroke="#5b3402" stroke-width="1.2"/>
  <rect x="4" y="86" width="36" height="8" rx="2.5" fill="url(#chBrass)" stroke="#5b3402" stroke-width="1.2"/>
  <circle cx="22" cy="76" r="4.2" fill="#b7791f" stroke="#5b3402" stroke-width="1"/><circle cx="22" cy="76" r="1.6" fill="#fde68a"/>
</svg>`;
// card symbols: a carved wooden medallion with a brass rim and a coloured enamel letter
const CARD_COL = [['#7dd3fc', '#1e3a8a'], ['#86efac', '#14532d'], ['#f9a8d4', '#831843'], ['#fdba74', '#7c2d12'], ['#fde047', '#854d0e']];
const cardSVG = (v) => { const [a, b] = CARD_COL[v]; return `<svg class="ch-card" viewBox="0 0 100 100" aria-hidden="true"><defs>
  <radialGradient id="chW${v}" cx=".45" cy=".35" r=".7"><stop offset="0" stop-color="#7a4a20"/><stop offset=".7" stop-color="#4a2a10"/><stop offset="1" stop-color="#2a1606"/></radialGradient>
  <linearGradient id="chM" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff4c2"/><stop offset=".35" stop-color="#e2a93b"/><stop offset=".65" stop-color="#8a5a12"/><stop offset="1" stop-color="#f6d77a"/></linearGradient>
  <linearGradient id="chE${v}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".25" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
  <circle cx="50" cy="50" r="45" fill="url(#chW${v})" stroke="url(#chM)" stroke-width="6"/>
  <circle cx="50" cy="50" r="38" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="1.5"/>
  <path d="M22 30 Q50 18 78 30" fill="none" stroke="#fff" stroke-opacity=".12" stroke-width="5" stroke-linecap="round"/>
  <text x="50" y="${v === 0 ? 64 : 67}" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-weight="900" font-size="${v === 0 ? 40 : 50}" fill="url(#chE${v})" stroke="#1a0d03" stroke-width="2.5" paint-order="stroke">${CARDS[v]}</text>
</svg>`; };
const symArt = (v) => (v === SCAT ? SHELL
  : v === WILD ? `<img class="ch-img gold" src="${src('gold')}" alt="" draggable="false"><b class="ch-wild">WILD</b>`
  : v >= 5 ? `<img class="ch-img" src="${src(ANIMALS[v - 5])}" alt="" draggable="false">`
  : cardSVG(v));

// the hunt field (sprites of the old La Chasse)
const KINDS = {
  duck: { img: 'duck', face: 1, w: 14, sky: true, t: 4.6, wgt: 3 },
  pheasant: { img: 'pheasant', face: 1, w: 15, sky: true, t: 3.9, wgt: 2 },
  rabbit: { img: 'rabbit', face: 1, w: 9, t: 3.6, wgt: 3, hop: true },
  boar: { img: 'boar', face: 1, w: 15, t: 4.3, wgt: 2 },
  deer: { img: 'deer', face: 1, w: 21, t: 3.4, wgt: 1 },
  deer2: { img: 'deer2', face: -1, w: 19, t: 3.2, wgt: 1, hop: true },
};
const RATIO = { duck: 304 / 900, pheasant: 361 / 900, rabbit: 462 / 900, boar: 451 / 900, deer: 610 / 900, deer2: 724 / 900, gold: 610 / 900, tree: 519 / 800, log: 152 / 900 };
const TOD = ['day', 'dusk', 'night'];
const pickKind = () => { const l = Object.entries(KINDS); let r = Math.random() * l.reduce((a, [, k]) => a + k.wgt, 0); for (const [id, k] of l) { if (r < k.wgt) return id; r -= k.wgt; } return 'duck'; };
const rand = (a, b) => a + Math.random() * (b - a);
const SCOPE = '<svg viewBox="0 0 60 60"><circle cx="30" cy="30" r="22" fill="none" stroke="#000" stroke-opacity=".45" stroke-width="4"/><circle cx="30" cy="30" r="22" fill="none" stroke="#fff" stroke-width="2"/><path d="M30 2 V20 M30 40 V58 M2 30 H20 M40 30 H58" stroke="#fff" stroke-width="2"/><circle cx="30" cy="30" r="2" fill="#ef4444"/></svg>';

class ChasseGame extends BaseGame {
  constructor(root, game) {
    super(root, game, {
      music: EXTRA_THEMES.chasse, cls: 'ch-slot',
      stage: `<div class="ch-logo"><b>THE HUNT</b><span><i>${SHELL}×3</i> la chasse<small> · 3 tirs</small> <em>✦</em> <i>${SHELL}×4</i> grande chasse<small> · 5 tirs</small></span></div>
        <div class="ch-reels"><i class="ch-corner tl"></i><i class="ch-corner tr"></i><i class="ch-corner bl"></i><i class="ch-corner br"></i><div class="reels-host"></div></div>
        <div class="ht-field" hidden>
          <div class="ht-hud"><span class="ht-shells"></span><span class="ht-time">20<small> s</small></span><span class="ht-sum">×0</span></div>
          <div class="ht-layer"></div><div class="ht-scope">${SCOPE}</div><div class="ht-banner"></div>
          <div class="ht-rotate"><b>↻</b><span>Tourne ton téléphone pour chasser en grand</span></div>
        </div><div class="ch-word"></div>`,
      buys: [
        { id: 'h3', icon: '🎯', label: 'La Chasse · 3 cartouches', desc: '3 tirs, chaque animal touché paie ×2 à ×250 la mise', cost: (b) => b * BUY3 },
        { id: 'h5', icon: '🦌', label: 'La Grande Chasse · 5 cartouches', desc: '5 tirs, et le cerf doré peut passer (×500)', cost: (b) => b * BUY5 },
      ],
      hello: '243 façons de gagner · 3 cartouches = la chasse, 4 cartouches = la grande chasse',
    });
    this.reels = new Reels(this.q('.reels-host'), {
      cols: COLS, rows: ROWS, game: this, random: (c) => (Math.random() < P.scat / 3 ? SCAT : sym(c)),
      art: (v) => symArt(v), cls: (v) => (v === SCAT ? 'scat' : v === WILD ? 'wild' : v >= 5 ? `an a${v}` : `card c${v}`),
    });
    this.reels.setAll(Array.from({ length: N }, (_, i) => sym(Math.floor(i / ROWS))));
    this.field = this.q('.ht-field'); this.layer = this.q('.ht-layer'); this.scope = this.q('.ht-scope');
    this.playing = false; this.animals = []; this.obst = [];
    this.field.addEventListener('pointerdown', (e) => this.shoot(e));
    this.field.addEventListener('pointermove', (e) => this.aim(e));
    this.field.addEventListener('pointerleave', () => this.scope.classList.remove('on'));
    [...ANIMALS, 'gold'].forEach((n) => { new Image().src = src(n); });
  }

  destroy() { cancelAnimationFrame(this.raf); clearTimeout(this.goldT); this.huntDone?.(0); super.destroy(); }

  word(t, cls = '') {
    const w = this.q('.ch-word');
    w.textContent = t; w.className = `ch-word ${cls}`;
    w.getAnimations().forEach((a) => a.cancel());
    w.animate([{ opacity: 0, transform: 'translate(-50%,-50%) scale(.3)' }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1.1)', offset: 0.25 },
      { opacity: 1, transform: 'translate(-50%,-50%) scale(1)', offset: 0.7 }, { opacity: 0, transform: 'translate(-50%,-62%) scale(1.15)' }], { duration: this.turbo ? 700 : 1300, easing: 'ease-out' });
  }

  onMain() { this.round(() => this.playRound(null)); }
  async onBuy(kind) { await this.playRound(kind); }

  async playRound(buy) {
    const b = this.bet, cap = b * CAPX;
    if (!buy && !this.pay(b)) return;
    this.lastStake = b;
    this.setLast(0); this.winAmt.textContent = ''; this.setBanner('');
    let total = 0;
    if (buy) total = await this.hunt(buy === 'h3' ? 3 : 5, b, true);
    else {
      const res = spin();
      await this.reels.spin(res.g, {
        tease: (c, vals) => { let k = 0; for (let j = 0; j < c * ROWS; j++) if (vals[j] === SCAT) k++; return k >= 2; },
        onStop: (c) => { for (let r = 0; r < ROWS; r++) if (res.g[c * ROWS + r] === SCAT) { sfx.land(); const p = center(this.reels.cell(c * ROWS + r)); fx.burst(p.x, p.y, 10, ['#ef4444', '#fde68a', '#fff'], 4); } },
      });
      if (this.dead) return;
      total = Math.min(Math.round(res.x * b), cap);
      if (res.wins.length) {
        this.reels.mark([...new Set(res.wins.flatMap((w) => w.cells))]);
        this.msg(res.wins.map((w) => `${w.n} × ${NAMES[w.s]}${w.ways > 1 ? ` (${w.ways} façons)` : ''} : +${fmtC(Math.round(w.x * b))}`).join(' · '));
        this.win(total); this.setLast(total);
      } else this.msg(res.scat === 2 ? 'Deux cartouches… il en fallait une de plus !' : 'Pas de gain');
      if (res.shots) {
        this.stopAuto();
        if (total > 0) await this.celebrate(total);
        this.reels.mark(res.g.map((v, i) => (v === SCAT ? i : -1)).filter((i) => i >= 0), 'win');
        this.word(res.shots === 5 ? 'GRANDE CHASSE !' : 'LA CHASSE !', 'hunt');
        sfx.feature(); await this.wait(1200);
        this.reels.unmark();
        total += await this.hunt(res.shots, b, false, cap - total);
      } else if (total > 0) await this.celebrate(total);
      this.reels.unmark();
    }
    this.setLast(total);
    if (total >= cap) this.msg(`GAIN MAXIMUM ! ${fmtC(total)}`);
  }

  /* ---------- the hunt (bonus) ---------- */
  async hunt(shots, b, bought, capLeft = b * CAPX) {
    const big = shots === 5;
    await this.featureIntro(big ? 'LA GRANDE CHASSE' : 'LA CHASSE', `${shots} cartouches · ${HUNT_S[shots]} secondes · chaque animal touché paie ×2 à ×250 la mise${big ? ' · le cerf doré vaut ×500 !' : ''}`, SHELL);
    if (this.dead) return 0;
    this.q('.ch-reels').hidden = true; this.q('.ch-logo').hidden = true; this.field.hidden = false;
    this.slotEl.classList.add('in-free', 'ht-on');
    this.focusStage?.();
    this.setTod(Math.floor(Math.random() * 3));
    this.animals.forEach((a) => a.el.remove()); this.animals = [];
    this.layout();
    this.maxShots = shots; this.shots = shots; this.sum = 0; this.left = HUNT_S[shots]; this.nextSpawn = 0.3; this.stake = b;
    this.q('.ht-shells').innerHTML = '<i></i>'.repeat(shots);
    this.paintHud();
    this.msg(`À toi de tirer : ${shots} cartouches, touche les animaux !`);
    const sum = await new Promise((resolve) => {
      this.huntDone = (v) => { this.huntDone = null; resolve(v); };
      this.playing = true;
      if (big && (window.__htGold || Math.random() < GOLD.appear)) this.goldT = setTimeout(() => { if (this.playing) { this.spawn('deer', true); this.flashGold(); } }, rand(3, HUNT_S[shots] - 8) * 1000);
      this.last = 0; cancelAnimationFrame(this.raf); this.raf = requestAnimationFrame((n) => this.loop(n));
    });
    if (this.dead) return 0;
    const won = Math.min(Math.round(sum * b), capLeft);
    await this.wait(2400);
    cancelAnimationFrame(this.raf);
    this.field.hidden = true; this.q('.ch-reels').hidden = false; this.q('.ch-logo').hidden = false;
    this.slotEl.classList.remove('in-free', 'ht-on');
    if (won > 0) { this.win(won, big ? 'Grande chasse' : 'Chasse'); this.setLast(won); }
    await this.celebrate(won, { summary: big ? 'GRANDE CHASSE' : 'LA CHASSE', stake: b });
    this.msg(won > 0 ? `Chasse : total ×${xs(sum)} → ${fmtC(won)}` : 'La chasse est finie : pas de gain cette fois');
    return won;
  }

  setTod(i) { this.field.style.backgroundImage = `url("${src(`bg-${TOD[i]}`)}")`; this.field.dataset.tod = TOD[i]; }

  aim(e) {
    if (e.pointerType !== 'mouse') return;
    const r = this.field.getBoundingClientRect();
    this.scope.style.left = `${e.clientX - r.left}px`; this.scope.style.top = `${e.clientY - r.top}px`;
    this.scope.classList.toggle('on', this.playing);
  }

  paintHud() {
    this.qa('.ht-shells i').forEach((s, k) => s.classList.toggle('used', k >= this.shots));
    this.q('.ht-sum').textContent = `×${xs(this.sum || 0)}`;
    this.setBanner(`<b>${this.maxShots === 5 ? 'GRANDE CHASSE' : 'LA CHASSE'}</b><span class="pill">Cartouches ${this.shots} / ${this.maxShots}</span><span class="pill gold">Total ×${xs(this.sum || 0)} · ${fmtC(Math.round((this.sum || 0) * this.stake))}</span>`);
  }

  // 3 to 4 obstacles: trees, bushes and logs, each at a depth (bottom line, %)
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
    const k = gold ? { img: 'gold', face: 1, w: 21, t: 1.7 } : KINDS[kind];
    const dir = Math.random() < 0.5 ? 1 : -1, fw = this.field.clientWidth || 800, fh = this.field.clientHeight || 450;
    const depth = k.sky ? 1 : rand(0, 1);
    const sc = k.sky ? rand(0.8, 1.15) : 0.7 + depth * 0.5;
    const w = k.w * sc * (fw < 520 ? 1.3 : 1);
    const hPct = (w / 100) * fw * RATIO[k.img] / fh * 100;
    const bottom = k.sky ? rand(30, 52) : 74 + depth * 22;
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
      if (this.left <= 0) this.endHunt('time');
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

  flashGold() { const b = this.q('.ht-banner'); b.innerHTML = `<b>✨ CERF DORÉ ! ✨</b><span>×${GOLD.x} la mise si tu le touches</span>`; b.className = 'ht-banner gold on'; setTimeout(() => b.classList.remove('on'), 1600); }

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
    this.paintHud();
    if (this.shots <= 0) setTimeout(() => this.endHunt('shots'), 900);
  }

  hit(a, fr, px, py) {
    if (a.gold) {
      if (!(window.__htGold || Math.random() < GOLD.success)) { a.flee = true; this.pop('😮 Le cerf doré a esquivé !', fr, px, py, 'miss'); return; }
      this.sum += GOLD.x;
      this.fall(a);
      this.pop(`×${xs(GOLD.x)}`, fr, px, py, 'jack');
      this.flash('rgba(253,224,71,.6)'); fx.confetti(120); sfx.jackpot?.();
      return;
    }
    const m = huntMult();
    this.sum += m;
    this.fall(a);
    this.pop(`×${xs(m)}`, fr, px, py, m >= 100 ? 'jack' : m >= 10 ? 'big' : 'ok');
    fx.burst(px, py, a.k.sky ? 26 : 14, a.k.sky ? ['#fff', '#e7d3b5', '#8b5a2b'] : ['#fde68a', '#fbbf24', '#fff'], a.k.sky ? 7 : 5);
    if (m >= 10) sfx.bigWin?.(); else sfx.coin();
  }

  fall(a) { a.alive = false; a.falling = true; a.el.classList.add(a.k.sky ? 'fall-sky' : 'fall'); setTimeout(() => { a.el.remove(); a.falling = false; }, 1100); }

  pop(text, fr, px, py, cls) {
    const p = document.createElement('b');
    p.className = `ht-pop ${cls}`; p.textContent = text;
    p.style.left = `${px - fr.left}px`; p.style.top = `${py - fr.top}px`;
    this.field.appendChild(p); setTimeout(() => p.remove(), 1500);
  }

  mark(x, y) { const m = document.createElement('i'); m.className = 'ht-shot'; m.style.left = `${x}px`; m.style.top = `${y}px`; this.field.appendChild(m); setTimeout(() => m.remove(), 800); }

  endHunt(why) {
    if (!this.playing) return;
    this.playing = false;
    clearTimeout(this.goldT);
    this.animals.forEach((a) => { if (a.alive) a.flee = true; });
    this.field.classList.remove('hurry');
    this.scope.classList.remove('on');
    const won = Math.round(this.sum * this.stake);
    const b = this.q('.ht-banner');
    b.innerHTML = `<small>${why === 'time' ? 'Temps écoulé' : 'Fin de la chasse'}</small><b>Total ×${xs(this.sum)}</b><span>${won > 0 ? `+${fmtC(won)}` : 'Pas de gain cette fois'}</span>`;
    b.className = 'ht-banner on end';
    setTimeout(() => b.classList.remove('on'), 2300);
    this.huntDone?.(this.sum);
  }

  info() {
    const pay = (s) => `3 : ×${xs(Math.round(P.pays[s][0] * P.K * 100) / 100)} · 4 : ×${xs(Math.round(P.pays[s][1] * P.K * 100) / 100)} · 5 : ×${xs(Math.round(P.pays[s][2] * P.K * 100) / 100)}`;
    const rows = [9, 8, 7, 6, 5, 4, 3, 2, 1, 0].map((s) => `<div class="pay-item"><div class="pay-sym ch-pay">${symArt(s)}</div><div class="pay-vals"><b>${NAMES[s]}</b><br><span>${pay(s)}</span></div></div>`).join('');
    const tot = HUNT.reduce((a, x) => a + x[1], 0);
    const hunt = HUNT.map(([m, w]) => `<tr><td>×${xs(m)}</td><td>${(w / tot * 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} %</td></tr>`).join('');
    return this.rules(`<h4>Symboles (× la mise, par façon)</h4><div class="paytable">${rows}
      <div class="pay-item"><div class="pay-sym ch-pay">${symArt(WILD)}</div><div class="pay-vals"><b>Cerf doré WILD</b><br><span>Rouleaux 2 à 4, remplace tous les symboles sauf la cartouche</span></div></div>
      <div class="pay-item"><div class="pay-sym ch-pay">${SHELL}</div><div class="pay-vals"><b>Cartouche</b><br><span>3 : la chasse (3 tirs) · 4 ou 5 : la grande chasse (5 tirs)</span></div></div></div>
      <h4>243 façons de gagner</h4><p>Un symbole paie dès qu’il apparaît sur 3 rouleaux d’affilée ou plus depuis la gauche, à n’importe quelle hauteur.</p>
      <h4>La chasse</h4><p>3 cartouches : <b>3 tirs</b> et ${HUNT_S[3]} secondes. 4 ou 5 cartouches : <b>la grande chasse</b>, <b>5 tirs</b> et ${HUNT_S[5]} secondes. Touche (ou clique) les animaux qui traversent le terrain : chaque animal touché révèle un multiplicateur de <b>la mise</b>. Un tir à côté, ou dans un arbre, un buisson ou un tronc devant l’animal, est perdu.</p>
      <table class="ht-rules"><tr><th>Multiplicateur</th><th>Chance</th></tr>${hunt}</table>
      <h4>Le cerf doré</h4><p>Pendant la grande chasse, il peut traverser le terrain très vite. S’il est touché et qu’il n’esquive pas : <b>×${GOLD.x}</b> la mise.</p>
      <h4>Achats</h4><p>La chasse ×${BUY3} la mise · la grande chasse ×${BUY5}. Gain maximum ×${CAPX.toLocaleString('fr-FR')}. Retour au joueur ≈ 92,6 % pour un tireur parfait ; chaque tir raté le diminue.</p>`);
  }
}

return { ChasseGame };
})();
