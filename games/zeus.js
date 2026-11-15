// SpinBet Casino · ZeusGame — loaded on demand by games/impl/index.js (index.html).
// ---- games/impl/zeus-engine.js ----
__mods['games/impl/zeus-engine.js'] = (() => {
// Zeus Thunder math (pure, no DOM, so scripts/sim-zeus.mjs can check the RTP).
// 6×5 grid, pays anywhere (8+ of a kind), tumbles, multiplier orbs, 15 free spins with a global multiplier.

const COLS = 6, ROWS = 5, N = 30, MIN = 8, CAPX = 5000;
const SC = 9, ORB = 10;
// 0 blue gem, 1 green gem, 2 yellow gem, 3 purple gem, 4 red gem, 5 chalice, 6 ring, 7 hourglass, 8 crown
// pays in bet multiples for 8-9, 10-11 and 12+ symbols
const PAYS = [
  [0.25, 0.75, 2], [0.4, 0.9, 4], [0.5, 1, 5], [0.8, 1.2, 8], [1, 1.5, 10],
  [1.5, 2, 12], [2, 5, 15], [2.5, 10, 25], [10, 25, 50],
];
const SCATTER_PAY = { 4: 3, 5: 5, 6: 100 };
// tuned by simulation for ≈ 92 % RTP (free spins buy ≈ 87 %)
const TUNE = {
  payScale: 0.575,
  w: [21, 19, 17, 15, 13, 10, 8, 6.5, 4.5],
  sc: 2.0, scFree: 1.8,
  orb: 0.014, orbFree: 0.09,
  orbv: [[2, 400], [3, 260], [4, 160], [5, 140], [6, 70], [8, 50], [10, 50], [12, 22], [15, 22], [20, 14], [25, 10], [50, 5], [100, 2.5], [250, 0.6], [500, 0.25]],
  orbvFree: [[2, 200], [3, 160], [4, 120], [5, 110], [6, 70], [8, 60], [10, 60], [12, 30], [15, 30], [20, 22], [25, 16], [50, 8], [100, 4], [250, 1], [500, 0.4]],
};
const FREE_SPINS = 15, RETRIGGER = 5, BUY_COST = 115;

const wpick = (l) => { let t = 0; for (const x of l) t += x[1]; let r = Math.random() * t; for (const x of l) { if (r < x[1]) return x[0]; r -= x[1]; } return l[l.length - 1][0]; };
const SW = () => TUNE.w.reduce((a, b) => a + b, 0);

function draw(free) {
  const r = Math.random();
  const po = free ? TUNE.orbFree : TUNE.orb;
  if (r < po) return { s: ORB, m: wpick(free ? TUNE.orbvFree : TUNE.orbv) };
  const sw = SW(), sc = free ? TUNE.scFree : TUNE.sc;
  let x = Math.random() * (sw + sc);
  if (x >= sw) return { s: SC };
  for (let i = 0; i < TUNE.w.length; i++) { if (x < TUNE.w[i]) return { s: i }; x -= TUNE.w[i]; }
  return { s: 0 };
}

const payFor = (s, n) => TUNE.payScale * (n >= 12 ? PAYS[s][2] : n >= 10 ? PAYS[s][1] : PAYS[s][0]);

// One paid or free spin. Returns the steps to animate and the totals (in bet multiples).
// state.global is the free-spins global multiplier (kept between spins by the caller).
function spin({ free = false, forceScatters = 0, state = { global: 0 } } = {}) {
  const grid = Array.from({ length: N }, () => draw(free));
  if (forceScatters) {
    grid.forEach((c, i) => { if (c.s === SC) grid[i] = { s: 0 }; });
    const idx = [...Array(N).keys()].sort(() => Math.random() - 0.5).slice(0, forceScatters);
    idx.forEach((i) => { grid[i] = { s: SC }; });
  }
  const steps = [{ k: 'init', grid: grid.map((c) => ({ ...c })) }];
  let tumble = 0, rounds = 0;
  while (rounds < 60) {
    const counts = {};
    grid.forEach((c, i) => { if (c.s < SC) (counts[c.s] = counts[c.s] || []).push(i); });
    const wins = [];
    for (const s in counts) if (counts[s].length >= MIN) wins.push({ s: +s, n: counts[s].length, cells: counts[s], pay: payFor(+s, counts[s].length) });
    if (!wins.length) break;
    const removed = new Set(wins.flatMap((w) => w.cells));
    const paid = wins.reduce((a, w) => a + w.pay, 0);
    tumble += paid;
    for (let c = 0; c < COLS; c++) {
      const keep = [];
      for (let r = 0; r < ROWS; r++) { const i = c * ROWS + r; if (!removed.has(i)) keep.push(grid[i]); }
      const miss = ROWS - keep.length;
      for (let r = 0; r < ROWS; r++) grid[c * ROWS + r] = r < miss ? draw(free) : keep[r - miss];
    }
    steps.push({ k: 'win', wins, paid, removed: [...removed], after: grid.map((c) => ({ ...c })) });
    rounds++;
  }
  const orbs = [];
  grid.forEach((c, i) => { if (c.s === ORB) orbs.push({ i, m: c.m }); });
  const orbSum = orbs.reduce((a, o) => a + o.m, 0);
  const scat = grid.filter((c) => c.s === SC).length;
  let win = tumble, mult = 1, globalBefore = state.global;
  if (tumble > 0 && orbSum > 0) {
    if (free) { state.global += orbSum; mult = state.global; } else mult = orbSum;
    win = tumble * mult;
  }
  const scatterWin = SCATTER_PAY[Math.min(scat, 6)] || 0;
  const total = Math.min(CAPX, win + scatterWin);
  steps.push({ k: 'end', orbs, orbSum, mult, globalBefore, global: state.global, tumble, scat, scatterWin });
  return { steps, total, tumble, orbSum, mult, scat, scatterWin, capped: win + scatterWin >= CAPX };
}

// Whole free-spins round (used by the simulator; the game plays the same spins one by one).
function freeRound(scatters = 4) {
  const state = { global: 0 };
  let left = FREE_SPINS, total = 0, spins = 0;
  while (left > 0 && spins < 300) {
    left--; spins++;
    const r = spin({ free: true, state });
    total += r.total;
    if (r.scat >= 3) left += RETRIGGER;
    if (total >= CAPX) { total = CAPX; break; }
  }
  return total;
}

return { COLS, SC, PAYS, SCATTER_PAY, TUNE, FREE_SPINS, draw, spin, freeRound, ROWS, N, MIN, CAPX, ORB, RETRIGGER, BUY_COST };
})();

// ---- games/impl/zeus.js ----
__mods['games/impl/zeus.js'] = (() => {
// Zeus Thunder: 6×5 pays anywhere, tumbles, winged multiplier orbs and 15 free spins with a global multiplier.
// Math lives in zeus-engine.js (checked with scripts/sim-zeus.mjs).

const { BaseGame, fmtC } = __mods['core/base.js'];
let { art } = __mods['core/base.js'];
const { SymbolGrid } = __mods['core/grid.js'];
const { EXTRA_THEMES } = __mods['core/music.js'];
const { COLS, ROWS, N, SC, ORB, PAYS, TUNE, SCATTER_PAY, FREE_SPINS, RETRIGGER, BUY_COST, CAPX, spin } = __mods['games/impl/zeus-engine.js'];
const { sfx } = __mods['audio.js'];
const { fx, sleep, center } = __mods['fx.js'];
const { el, animateNumber } = __mods['ui.js'];

const IDS = ['z0', 'z1', 'z2', 'z3', 'z4', 'z5', 'z6', 'z7', 'z8'];
// Painted images from the owner (assets/games/zeus): the 9 symbols, the scatter (Zeus head), the multiplier orb,
// the cover, and the whole machine: his 2 animated backgrounds of 15 November 2026 (fond-large.mp4 for computers and
// wide screens, fond-haut.mp4 for phones held upright: lightning, blue flame, moving clouds; scene-*.webp = their first
// frame, shown until the video plays), cleaned by tools/art/zeus/clean.py.
const IMG_V = 3;
const asset = (p) => window.__assets?.[p] || `${p}?v=${IMG_V}`; // single-file version: images are inlined
const PAINT = { z0: 's0', z1: 's1', z2: 's2', z3: 's3', z4: 's4', z5: 's5', z6: 's6', z7: 's7', z8: 's8', zsc: 'scatter', zorb: 'orb' };
const svgArt = art;
art = (id) => (PAINT[id] ? `<img class="z-img" src="${asset(`assets/games/zeus/${PAINT[id]}.webp`)}" alt="" draggable="false" decoding="async">` : svgArt(id));
const NAMES = ['Saphir', 'Émeraude', 'Topaze', 'Améthyste', 'Rubis', 'Calice', 'Anneau', 'Sablier', 'Couronne'];
const lab = (t) => `<b class="sg-lab">${t}</b>`;
const cellArt = (c) => (c.s === ORB ? art('zorb') + lab('×' + c.m) : c.s === SC ? art('zsc') + '<i class="lbl zl">SCATTER</i>' : art(IDS[c.s]));
const cellCls = (c) => (c.s === ORB ? 'orb' : c.s === SC ? 'scatter' : c.s >= 5 ? 'hi' : '');

// The videos: a 121-frame loop (24 images/s), then its first 12 frames again: the game jumps back by one loop while they
// play, so the video never stops on its last frame (seamless, like a gif). See tools/art/zeus/clean.py.
const LOOP = 121 / 24;

class ZeusGame extends BaseGame {
  constructor(root, game) {
    super(root, game, {
      music: EXTRA_THEMES.zeus,
      frameCls: 'zeus-frame',
      // the owner's 2 animated backgrounds of 15 November 2026 (wide: computers, tall: phones held upright): medallion
      // MULTIPLICATEUR, the 6 × 5 grid in the golden frame, his bar made clickable (menu, BONUS, MISE − / +, SPIN);
      // balance and win on a plaque (under the medallion on the wide one, under the frame on the tall one)
      stage: `<div class="zo-scene zo-l"><i class="zo-safe"></i><div class="zo-art">
          <video class="zo-vid" muted loop playsinline preload="auto" disablepictureinpicture aria-hidden="true"></video>
          <div class="zo-med"><small>Multiplicateur</small><b><em>×</em><span class="zm-v">0</span></b></div>
          <div class="zo-info"><div><small>SOLDE</small><b class="zo-bal"></b></div><div class="zo-mid"><small>GAIN</small><b class="zo-gain">0</b></div><div class="zo-fs"><small>TOURS</small><b class="zo-left"></b></div></div>
          <i class="zo-gem"></i>
          <div class="zo-win"><div class="grid-host"></div><div class="zo-word"></div></div>
          <div class="zo-ov"></div>
          <button class="zo-hot zo-menu" type="button" data-act="menu" aria-label="Tours auto et réglages"></button>
          <button class="zo-hot zo-bonus" type="button" data-zo="buy" aria-label="Acheter le bonus"></button>
          <button class="zo-hot zo-bm" type="button" data-act="bet-" aria-label="Diminuer la mise"></button>
          <b class="zo-bet"></b>
          <button class="zo-hot zo-bp" type="button" data-act="bet+" aria-label="Augmenter la mise"></button>
          <button class="zo-hot zo-spin" type="button" data-act="main" aria-label="Lancer"><span class="auto-count"></span><span class="fr-badge" hidden></span></button>
        </div><button class="zo-hot zo-full" type="button" data-act="full" aria-label="Plein écran">⛶<span hidden>Plein écran</span></button></div>`,
      buys: [{ id: 'fs', icon: '⚡', label: `${FREE_SPINS} Free Spins · 4 scatters`, desc: 'Multiplicateur global qui ne se réinitialise pas entre les tours', cost: (b) => b * BUY_COST }],
      hello: '8 symboles identiques n’importe où pour gagner',
    });
    Object.values(PAINT).forEach((n) => { new Image().src = asset(`assets/games/zeus/${n}.webp`); });
    for (const sel of ['.controls', '.slot > .win-bar']) this.q(sel)?.style.setProperty('display', 'none', 'important');
    this.root.addEventListener('click', (e) => { if (e.target.closest('[data-zo="buy"]')) this.askBuy(); });
    this.gainObs = new MutationObserver(() => this.paintGain());
    this.gainObs.observe(this.winAmt, { childList: true, characterData: true, subtree: true });
    this.ro = new ResizeObserver(() => this.layout());
    this.ro.observe(this.q('.zo-scene'));
    this.onRs = () => requestAnimationFrame(() => this.layout());
    addEventListener('resize', this.onRs);
    // the animated background: muted, plays by itself, paused when the page is hidden (and never with reduced motion)
    const v = this.video = this.q('.zo-vid');
    v.muted = true;
    v.addEventListener('timeupdate', () => { if (v.currentTime >= LOOP) v.currentTime -= LOOP; });
    this.root.addEventListener('pointerdown', () => this.playBg(), { once: true }); // a phone in power-saving mode waits for a touch
    this.onVis = () => { if (document.hidden) v.pause(); else this.playBg(); };
    document.addEventListener('visibilitychange', this.onVis);
    this.meter = this.q('.zo-med');
    this.meterVal = 0;
    this.grid = new SymbolGrid(this.q('.grid-host'), { cols: COLS, rows: ROWS, game: this, art: cellArt, cls: cellCls });
    this.grid.setAll(Array.from({ length: N }, () => ({ s: Math.floor(Math.random() * 9) })));
    this.onMeters(); this.paintGain(); this.layout();
  }

  /* ---------- the owner's picture: bar, plaque, full screen ---------- */
  onMeters() {
    const set = (c, t) => { const n = this.q(c); if (n && n.textContent !== t) { n.textContent = t; n.style.setProperty('--n', Math.max(7, t.length)); } };
    set('.zo-bet', fmtC(this.bet)); set('.zo-bal', fmtC(this.balC()));
  }
  paintGain() {
    const n = this.q('.zo-gain'); if (!n) return;
    const w = this.winAmt.textContent.trim().replace(/^[-−]\s*/, '');
    n.textContent = this.fsTotal != null ? fmtC(this.fsTotal) : w || fmtC(0);
    n.style.setProperty('--n', Math.max(7, n.textContent.length));
    n.parentElement.classList.toggle('won', !!w || !!this.fsTotal);
  }
  // BONUS button: a plaque in the frame to buy the free spins (price shown), or not
  askBuy() {
    if (this.busy || this.dead) return;
    const cost = BUY_COST * this.bet;
    this.panel(`<div class="zo-pglyph">${art('zsc')}</div><h3>${FREE_SPINS} FREE SPINS</h3><p>Multiplicateur global qui ne se remet pas à zéro</p>
      <div class="zo-pbtns"><button type="button" class="zo-yes">ACHETER · ${fmtC(cost)}</button><button type="button" class="zo-no">Non merci</button></div>`, 'ask', 60000, (e) => {
      if (e.target.closest('.zo-yes')) { this.startBuy('fs'); return true; }
      return !!e.target.closest('.zo-no') || e.target === this.q('.zo-ov');
    });
  }
  // a panel in the frame (bonus intro, end, buy): gold border on night blue; done on a touch (or `pick` says so)
  panel(html, cls, dur, pick) {
    const ov = this.q('.zo-ov');
    ov.className = `zo-ov on ${cls}`; ov.innerHTML = `<div class="zo-pan">${html}</div>`;
    return new Promise((resolve) => {
      let over = false;
      const done = () => { if (over) return; over = true; clearTimeout(t); ov.removeEventListener('click', on); ov.classList.add('out'); setTimeout(() => { if (ov.classList.contains('out')) { ov.className = 'zo-ov'; ov.innerHTML = ''; } resolve(); }, 300); };
      const on = (e) => { if (!pick || pick(e)) done(); };
      const t = setTimeout(done, this.superT ? dur / 4 : this.turbo ? dur / 2 : dur);
      ov.addEventListener('click', on);
    });
  }
  featureIntro(title, sub, glyph, dur = 2600) {
    dispatchEvent(new CustomEvent('sb:feature', { detail: { game: this.game.id, title, bought: !!this.buyRound, re: /^\+/.test(title) } }));
    sfx.feature(); this.flash('rgba(147,197,253,.45)');
    const p = center(this.q('.zo-win')); fx.burst(p.x, p.y, 50, ['#fde047', '#fff', '#93c5fd'], 9);
    return this.panel(`<div class="zo-pglyph">${glyph}</div><h3>${title}</h3><p>${sub}</p><small>Touchez pour continuer</small>`, 'intro', dur);
  }
  async celebrate(amountC, o = {}) {
    if (!o.summary) return super.celebrate(amountC, o);
    dispatchEvent(new CustomEvent('sb:featureend', { detail: { game: this.game.id } }));
    if (this.dead) return;
    const x = amountC / (o.stake || this.bet);
    sfx.bigWin?.(); fx.confetti(60);
    const pr = this.panel(`<div class="zo-pglyph">${art('zsc')}</div><h3>${o.summary}</h3><b class="zo-ptot">0</b><p>×${x >= 100 ? Math.round(x) : x.toFixed(1).replace('.', ',')} la mise</p><small>Touchez pour continuer</small>`, 'end', 2600 + Math.min(2400, x * 12));
    const tot = this.q('.zo-ptot'), t0 = performance.now(), T = this.superT ? 300 : this.turbo ? 700 : Math.min(2600, 900 + x * 15);
    const step = (ts) => { if (this.dead || !tot.isConnected) return; const k = Math.min(1, (ts - t0) / T); tot.textContent = fmtC(Math.round(amountC * k)); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
    await pr;
    this.winAmt.textContent = fmtC(amountC);
    if (x >= 10) await super.celebrate(amountC, { stake: o.stake, quick: true }); // GROS GAIN ! stays everywhere
  }

  playBg() { if (!this.dead && !document.hidden && this.video.src && !matchMedia('(prefers-reduced-motion: reduce)').matches) this.video.play().catch(() => {}); }
  // the wide or the tall background (and its places for the grid and the buttons, in the CSS: .zo-l / .zo-p)
  orient(port) {
    const sc = this.q('.zo-scene'), name = port ? 'haut' : 'large';
    sc.classList.toggle('zo-p', port); sc.classList.toggle('zo-l', !port);
    if (this.vidName === name) return;
    this.vidName = name;
    this.video.poster = asset(`assets/games/zeus/scene-${name}.webp`);
    this.video.src = asset(`assets/games/zeus/fond-${name}.mp4`);
    this.playBg();
  }
  // Wide background on a computer, tall one on a phone held upright. Full screen: the one that fits the screen's shape
  // covers the whole screen, cropped on its edges but never cutting the medallion, the grid or the bar (KEY, in the
  // video's pixels); a screen of another shape gets the rest of the background, blurred, around it.
  layout() {
    if (this.dead) return;
    const sc = this.q('.zo-scene'), art = this.q('.zo-art');
    const full = !!this.slotEl.closest('.is-full');
    sc.classList.toggle('zo-fullsc', full);
    if (!full) {
      sc.classList.remove('zo-bandx', 'zo-bandy');
      this.orient(innerWidth < 700 && innerHeight > innerWidth);
      art.style.cssText = ''; return;
    }
    const cs = getComputedStyle(this.q('.zo-safe')), sp = (k) => parseFloat(cs[k]) || 0;
    const top = sp('paddingTop'), bot = sp('paddingBottom'), lft = sp('paddingLeft'), rgt = sp('paddingRight');
    const W = sc.clientWidth - lft - rgt, H = sc.clientHeight - top - bot;
    if (!W || !H) return;
    const port = W / H < 1, iw = port ? 400 : 736, ih = port ? 736 : 400;
    this.orient(port);
    const [kx0, ky0, kx1, ky1] = port ? [4, 172, 396, 730] : [14, 0, 722, 398];
    const k = Math.min(Math.max(W / iw, H / ih), W / (kx1 - kx0), H / (ky1 - ky0)), w = iw * k, h = ih * k;
    // larger than the screen: centred, then moved so that the screen stays covered and the key part stays on it
    const fit = (S, len, a0, a1) => {
      if (len <= S) return null;
      let v = (S - len) / 2;
      v = Math.min(0, Math.max(S - len, v));
      return Math.min(S - a1 * k, Math.max(-a0 * k, v));
    };
    const x = fit(W, w, kx0, kx1) ?? (W - w) / 2;
    const y = fit(H, h, ky0, ky1) ?? (port ? H - h : (H - h) / 2); // a phone thinner than the video: the video at the bottom, sky above
    art.style.cssText = `width:${w.toFixed(1)}px;height:${h.toFixed(1)}px;left:${(lft + x).toFixed(1)}px;top:${(top + y).toFixed(1)}px`;
    sc.classList.toggle('zo-bandx', x > 0.5); sc.classList.toggle('zo-bandy', y > 0.5);
  }

  say(t) {
    const s = this.q('.zo-word');
    s.textContent = t;
    s.classList.remove('on'); void s.offsetWidth; s.classList.add('on');
  }

  // the winged gem on top of the frame lights up (Zeus' power) — it throws the bolts
  pose(cls, ms = 900) {
    const g = this.q('.zo-gem');
    g.classList.remove('raise', 'flick'); void g.offsetWidth; g.classList.add(cls);
    clearTimeout(this.poseT);
    this.poseT = setTimeout(() => g.classList.remove(cls), this.turbo ? ms / 2 : ms);
  }

  // Framed multiplier, top right of the grid: counts up and flares when it grows.
  setMeter(v, { bump = false, label = null } = {}) {
    const box = this.meter, num = box.querySelector('.zm-v');
    if (label) { box.querySelector('small').textContent = label; box.classList.toggle('glob', /global/i.test(label)); }
    const from = this.meterVal;
    this.meterVal = v;
    box.classList.toggle('hot', v > 0);
    box.classList.toggle('big', v >= 100);
    if (v > from && bump) {
      animateNumber(num, from, v, this.turbo ? 250 : 650, (x) => Math.round(x));
      box.classList.remove('bump'); void box.offsetWidth; box.classList.add('bump');
      const p = center(box); fx.burst(p.x, p.y, v >= 100 ? 50 : 26, ['#fde047', '#fff', '#93c5fd'], 7);
    } else num.textContent = v;
  }

  bolt(target) {
    // the bolt leaves from the winged gem on top of the frame
    const from = center(this.q('.zo-gem')), to = center(target);
    const o = el('div', 'g-bolt g-overlay');
    let d = `M ${from.x} ${from.y}`;
    for (let i = 1; i <= 8; i++) { const k = i / 8; d += ` L ${from.x + (to.x - from.x) * k + (i < 8 ? (Math.random() - 0.5) * 34 : 0)} ${from.y + (to.y - from.y) * k + (i < 8 ? (Math.random() - 0.5) * 34 : 0)}`; }
    o.innerHTML = `<svg width="100%" height="100%"><path d="${d}" stroke="#fff" stroke-width="3.5" fill="none" filter="drop-shadow(0 0 8px #93c5fd)"/><path d="${d}" stroke="#fde047" stroke-width="9" fill="none" opacity=".35"/></svg>`;
    document.body.appendChild(o);
    setTimeout(() => o.remove(), 380);
    fx.burst(to.x, to.y, 20, ['#fff', '#fde047', '#93c5fd'], 7);
  }

  onMain() {
    this.round(async () => {
      const bet = this.bet;
      if (!this.pay(bet)) return;
      this.lastStake = bet;
      this.setMeter(0, { label: 'Multiplicateur' });
      const r = await this.playSpin(false, { global: 0 });
      if (r.total > 0) await this.celebrate(Math.round(r.total * bet));
      if (r.scat >= 4) { this.stopAuto(); await this.freeSpins(); }
    });
  }

  async onBuy() { await this.freeSpins(); }

  // Animates one engine spin; credits it; returns the engine result.
  async playSpin(free, state) {
    const bet = this.bet;
    const r = spin({ free, state });
    this.setLast(0); this.winAmt.textContent = '';
    this.msg(free ? 'Tour gratuit…' : 'Les dieux lancent la tempête…');
    let run = 0;
    for (const st of r.steps) {
      if (this.dead) return r;
      if (st.k === 'init') {
        let sc = 0;
        await this.grid.dropIn(st.grid, {
          tease: (c) => { const t = sc >= 3; for (let k = 0; k < ROWS; k++) if (st.grid[c * ROWS + k].s === SC) sc++; return t; },
          onLand: (i, v) => this.landed(i, v),
        });
      } else if (st.k === 'win') {
        st.wins.forEach((w) => this.grid.floatOver(w.cells, `+${fmtC(Math.round(w.pay * bet))}`));
        this.grid.mark(st.removed);
        this.msg(st.wins.map((w) => `${w.n} × ${NAMES[w.s]} : +${fmtC(Math.round(w.pay * bet))}`).join(' · '));
        sfx.win();
        await this.wait(700);
        this.grid.unmark();
        await this.grid.explode(st.removed, ['#93c5fd', '#fde047', '#fff']);
        await this.grid.cascade(st.after, new Set(st.removed));
        // orbs that just fell in: the top `miss` cells of each column
        for (let c = 0; c < COLS; c++) {
          const miss = st.removed.filter((i) => Math.floor(i / ROWS) === c).length;
          for (let k = 0; k < miss; k++) { const i = c * ROWS + k; if (st.after[i].s === ORB) this.landed(i, st.after[i]); }
        }
        run += st.paid;
        this.setLast(Math.round(run * bet));
        await this.wait(200);
      } else if (st.k === 'end') {
        if (st.tumble > 0 && st.orbSum > 0) await this.applyOrbs(st, free);
        else if (free) this.setMeter(st.global);
        if (st.scatterWin) { this.msg(`${st.scat} scatters : +${fmtC(st.scatterWin * bet)}`); sfx.jackpot(); }
      }
    }
    const won = Math.round(r.total * bet);
    if (won > 0) { this.win(won, free ? 'Free Spins' : null); this.setLast(won); }
    if (!free) this.msg(won > 0 ? `Total du tour : ${fmtC(won)}` : r.scat === 3 ? 'Presque… 3 scatters' : 'Pas de gain');
    return r;
  }

  landed(i, v) {
    const cell = this.grid.cells[i];
    if (v.s === ORB) {
      this.pose('flick', 500);
      this.bolt(cell);
      sfx.coin();
      if (v.m >= 50) { this.flash('rgba(253,224,71,.5)'); this.say(`×${v.m} !`); }
    } else if (v.s === SC) { sfx.land(); this.grid.bump(cell); const p = center(cell); fx.burst(p.x, p.y, 16, ['#93c5fd', '#fde047', '#fff']); }
  }

  // Zeus raises his arm, strikes every orb and multiplies the tumble win.
  async applyOrbs(st, free) {
    const bet = this.bet;
    this.pose('raise', 2200);
    this.say(free ? `+×${st.orbSum}` : `×${st.orbSum}`);
    sfx.feature();
    // each orb is struck, then flies into the framed multiplier, which climbs orb by orb
    let run = free ? st.globalBefore : 0;
    this.setMeter(run, { label: free ? 'Multiplicateur global' : 'Multiplicateur' });
    const target = center(this.meter);
    for (const o of st.orbs) {
      const cell = this.grid.cells[o.i];
      cell.classList.add('win');
      this.bolt(cell);
      sfx.coin();
      await this.wait(180);
      fx.trail(center(cell), target, '#fde047', 12);
      await this.wait(260);
      run += o.m;
      this.setMeter(run, { bump: true });
      sfx.upgrade();
    }
    this.flash('rgba(147,197,253,.55)');
    this.shake();
    if (free) this.msg(`Multiplicateur global : ×${st.globalBefore} + ${st.orbSum} = <b>×${st.global}</b>`);
    const before = Math.round(st.tumble * bet), after = Math.round(st.tumble * st.mult * bet);
    this.msg(`${fmtC(before)} × ${st.mult} = <b>${fmtC(after)}</b>`);
    this.floatAt(this.q('.grid-host'), `×${st.mult}`, '#fde047', 46);
    await this.wait(1100);
    this.grid.unmark();
  }

  async freeSpins() {
    const bet = this.bet, state = { global: 0 };
    let left = FREE_SPINS, done = 0, total = 0;
    this.lastStake = bet;
    this.pose('raise', 2500);
    await this.featureIntro(`${FREE_SPINS} FREE SPINS`, 'Chaque multiplicateur s’ajoute au multiplicateur global', art('zsc'));
    this.slotEl.classList.add('in-free');
    this.setMeter(0, { label: 'Multiplicateur global' });
    while (left > 0 && !this.dead && !this.maxHit) { // stops at the max win (core/base.js)
      left--; done++;
      this.q('.zo-left').textContent = `${done} / ${done + left}`; this.fsTotal = total; this.paintGain();
      const r = await this.playSpin(true, state);
      total = Math.min(bet * CAPX, total + Math.round(r.total * bet));
      this.fsTotal = total; this.paintGain();
      if (r.scat >= 3) { left += RETRIGGER; this.pose('raise', 1500); await this.featureIntro(`+${RETRIGGER} TOURS`, 'Retrigger !', art('zsc'), 1300); }
      if (total >= bet * CAPX) { this.msg('MAX WIN ×5 000 !'); break; }
      await this.wait(450);
    }
    this.slotEl.classList.remove('in-free');
    this.fsTotal = null; this.paintGain();
    this.setMeter(0, { label: 'Multiplicateur' });
    this.setLast(total);
    await this.celebrate(total, { summary: 'FREE SPINS', stake: bet });
    this.msg(`Bonus terminé : ${fmtC(total)} gagnés`);
  }

  destroy() {
    clearTimeout(this.poseT); this.gainObs?.disconnect(); this.ro?.disconnect(); removeEventListener('resize', this.onRs);
    document.removeEventListener('visibilitychange', this.onVis);
    this.video.pause(); this.video.removeAttribute('src'); this.video.load(); // frees the video decoder (phones have few)
    super.destroy();
  }

  info() {
    const f = (x) => x.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
    const rows = IDS.map((id, s) => `<div class="pay-item"><div class="pay-sym svg">${art(id)}</div><div class="pay-vals"><b>${NAMES[s]}</b><br><span>8-9 : ×${f(PAYS[s][0] * TUNE.payScale)} · 10-11 : ×${f(PAYS[s][1] * TUNE.payScale)} · 12+ : ×${f(PAYS[s][2] * TUNE.payScale)}</span></div></div>`).reverse().join('');
    return this.rules(`<h4>Table des gains (× la mise)</h4><div class="paytable">${rows}
      <div class="pay-item"><div class="pay-sym svg">${art('zsc')}</div><div class="pay-vals"><b>Zeus (scatter)</b><br><span>4 : ×${SCATTER_PAY[4]} · 5 : ×${SCATTER_PAY[5]} · 6 : ×${SCATTER_PAY[6]}</span></div></div></div>
      <h4>Pay Anywhere et cascades</h4><p>Grille 6×5, pas de lignes : <b>8 symboles identiques ou plus n’importe où</b> paient. Les symboles gagnants disparaissent et de nouveaux tombent, tant qu’il y a des gains.</p>
      <h4>Orbes multiplicateurs</h4><p>Zeus lance des orbes dorés ailés de <b>×2 à ×500</b> à n’importe quel moment. À la fin des cascades, s’il y a eu un gain, tous les orbes présents <b>s’additionnent</b> et multiplient le gain du tour.</p>
      <h4>Free Spins</h4><p>4 scatters Zeus ou plus : <b>${FREE_SPINS} tours gratuits</b>. Chaque orbe qui tombe sur un tour gagnant s’ajoute à un <b>multiplicateur global</b> qui ne se réinitialise pas, et qui multiplie ce tour. 3 scatters pendant le bonus : +${RETRIGGER} tours.</p>
      <h4>Achat</h4><p>Free Spins ×${BUY_COST} la mise. Gain maximum ×${CAPX.toLocaleString('fr-FR')}.</p>`);
  }
}

return { ZeusGame };
})();
