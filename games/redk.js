// SpinBet Casino · RedkGame (Diamants REDK) — loaded on demand by games/impl/index.js (index.html).
// ---- games/impl/redk.js ----
__mods['games/impl/redk.js'] = (() => {
// Diamants REDK (owner's request, 11 November 2026, notes/diamants-redk-cahier-des-charges.txt): 5 reels × 3 rows,
// 20 lines, the owner's symbols (assets/games/redk) over his moving diamond-mine video (bg.mp4, the same in the bonus).
// RED RUBIES carry a value in KE (n × the bet): 6 or more = RUBY LINK (they stay, 3 re-spins put back to 3 by every new
// ruby, 3 locked rows above the grid → up to 5×6, boosters SPIN+ / REELS+ / MULTIPLIER+ / VALUE+, MINI / MINOR / MAJOR,
// GRAND ×1 000 for the 30 cells). 3 pyramids = LES TOURS DE LA PYRAMIDE (free spins, wins ×2, Ruby Link still possible).
// When one ruby (or one pyramid) is missing, the last reels slow down, the camera zooms in, the screen shakes and the
// music gives way to a heartbeat (tease). The owner's BONUS video (intro.mp4) opens every bonus, won or bought.

const { BaseGame, fmtC } = __mods['core/base.js'];
const { Reels } = __mods['core/reels.js'];
const { EXTRA_THEMES } = __mods['core/music.js'];
const { sfx, audioContext, isMuted, duck } = __mods['audio.js'];
const { fx, center } = __mods['fx.js'];

/* ===ENGINE */
// Symbols 0-4: cards 10 J Q K A; 5 scarab, 6 eye, 7 Anubis, 8 pharaoh; 9 WILD crown (reels 2-5, replaces 0-8);
// 10 pyramid SCATTER (one per reel at most); 11 RUBY (carries a value in × the total bet).
// Ruby Link grid: 5 columns × 6 rows, cell = c * 6 + r (r = 0 at the top); rows 3-5 are the base grid, rows 0-2 locked.
const COLS = 5, ROWS = 3, N = 15, BR = 6, BN = 30, NS = 9, WILD = 9, SCAT = 10, RUBY = 11, CAPX = 5000;
const LINES = [
  [1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2], [0, 1, 2, 1, 0], [2, 1, 0, 1, 2],
  [0, 0, 1, 2, 2], [2, 2, 1, 0, 0], [1, 0, 0, 0, 1], [1, 2, 2, 2, 1], [0, 1, 1, 1, 0],
  [2, 1, 1, 1, 2], [1, 0, 1, 2, 1], [1, 2, 1, 0, 1], [0, 1, 0, 1, 0], [2, 1, 2, 1, 2],
  [1, 1, 0, 1, 1], [1, 1, 2, 1, 1], [0, 2, 0, 2, 0], [2, 0, 2, 0, 2], [0, 2, 2, 2, 0],
];
const FS_COUNT = { 3: 10, 4: 12, 5: 15 }, FS_RETRIG = 5;
const JPX = { mini: 10, minor: 25, major: 100, grand: 1000 };
const BUY = { link: 66, super: 175 };
const P = {
  // reel weights of symbols 0-8, WILD weight (reels 2-5), chance of a pyramid on a reel, of a ruby on a cell, stacks
  w: [32, 31, 30, 29, 28, 13, 11, 9, 7], wild: 18, scat: 0.075, ruby: 0.115, stack: 0.3,
  // pays per line in × the line bet (bet / 20) for 3, 4 and 5 symbols, scaled by K (× fsK in the free spins)
  pays: [[5, 15, 50], [5, 15, 50], [5, 20, 75], [10, 25, 100], [10, 30, 125], [15, 50, 200], [20, 75, 300], [30, 100, 400], [50, 150, 750]],
  K: 1.45, fsMul: 3, fsWild: 22, fsRuby: 0.11,
  // ruby values (× the bet) on the reels and in Ruby Link; jackpot rubies on the reels
  val: [[1, 30], [2, 25], [3, 16], [5, 12], [8, 7], [10, 5], [15, 2.6], [25, 1.3], [50, 0.45]], jpBase: [['mini', 1.6], ['minor', 0.35]],
  // Ruby Link: chance per open empty cell on each re-spin, and what lands there
  hp: 0.068,
  land: [['v', 86], ['mini', 3.4], ['minor', 1.1], ['major', 0.22], ['spin', 2.6], ['reels', 2.6], ['mult', 2.1], ['value', 2.4]],
  boost: [[1, 40], [2, 30], [3, 18], [5, 12]], // VALUE+ adds this (× the bet) to every ruby
  unlock: [11, 16, 21], // rubies needed to unlock the 1st, 2nd and 3rd locked row (REELS+ also unlocks one)
  multUp: [[1, 60], [2, 28], [3, 12]], maxMult: 10, maxLeft: 5,
  superRows: 1, superMult: 2, // RUBY LINK SUPER: starts with one row open and ×2
};
function wp(R, l) { let t = 0; for (const x of l) t += x[1]; let q = R() * t; for (const x of l) { if (q < x[1]) return x[0]; q -= x[1]; } return l[l.length - 1][0]; }
function symbol(c, R, free) {
  const ws = c >= 1 ? (free ? P.fsWild : P.wild) : 0;
  let t = ws; for (const x of P.w) t += x;
  let q = R() * t;
  if (q < ws) return WILD; q -= ws;
  for (let i = 0; i < NS; i++) { if (q < P.w[i]) return i; q -= P.w[i]; }
  return 0;
}
const rubyVal = (R) => (R() < 0.04 ? wp(R, P.jpBase) : wp(R, P.val));
const vx = (v) => (typeof v === 'number' ? v : JPX[v]);
// A screen of 15 cells (cell = c * 3 + r): at most one pyramid per reel, rubies carry a value, symbols in stacks.
function screen(R, free) {
  const g = [], vals = {};
  for (let c = 0; c < COLS; c++) {
    const sr = R() < P.scat * (free ? 0.75 : 1) ? Math.floor(R() * ROWS) : -1;
    for (let r = 0; r < ROWS; r++) {
      const i = c * ROWS + r;
      if (r === sr) g[i] = SCAT;
      else if (R() < (free ? P.fsRuby : P.ruby)) { g[i] = RUBY; vals[i] = rubyVal(R); }
      else if (r && g[i - 1] < NS + 1 && R() < P.stack) g[i] = g[i - 1];
      else g[i] = symbol(c, R, free);
    }
  }
  return { g, vals };
}
// 20 lines, left to right, 3+ symbols; the WILD replaces 0-8 (5 WILDs pay like 5 pharaohs).
function lines(g, k = 1) {
  const wins = [];
  LINES.forEach((L, li) => {
    let s = -1, n = 0;
    for (let c = 0; c < COLS; c++) {
      const v = g[c * ROWS + L[c]];
      if (v > WILD) break;
      if (v !== WILD) { if (s < 0) s = v; else if (v !== s) break; }
      n++;
    }
    if (s < 0 && n === COLS) s = NS - 1;
    if (s < 0 || n < 3) return;
    wins.push({ line: li, s, n, x: P.pays[s][n - 3] / 20 * P.K * k, cells: L.slice(0, n).map((r, c) => c * ROWS + r) });
  });
  return wins;
}
const count = (g, v) => g.filter((x) => x === v).length;
// One paid spin (or one free spin): the screen, the line wins (× the bet), the pyramids and the rubies.
function spin(R = Math.random, free = false) {
  const { g, vals } = screen(R, free), wins = lines(g, free ? P.fsMul : 1);
  const sc = count(g, SCAT), rubies = Object.keys(vals).map(Number);
  return { g, vals, wins, x: wins.reduce((a, w) => a + w.x, 0), scat: sc, fs: sc >= 3 ? FS_COUNT[Math.min(5, sc)] : 0, rubies, link: rubies.length >= 6 };
}
// base cell (c, r) → Ruby Link cell (c, r + 3)
const toBig = (i) => Math.floor(i / ROWS) * BR + (i % ROWS) + 3;
// The whole Ruby Link from the starting rubies { bigCell: value }. Every re-spin: { add: [{ i, t, v, b? }], left, rows,
// mult, snap }. rows = open rows (3 to 6, from the bottom), mult = the bonus multiplier (×1 to ×10).
function linkRun(start, R = Math.random, opts = {}) {
  const cur = { ...start }, steps = [];
  let left = 3, rows = 3 + (opts.rows || 0), mult = opts.mult || 1, guard = 0;
  const open = (i) => (i % BR) >= BR - rows;
  const nOpen = () => COLS * rows;
  const unlockAuto = () => { let u = 0; while (rows < BR && Object.keys(cur).length >= P.unlock[rows - 3]) { rows++; u++; } return u; };
  unlockAuto();
  while (left > 0 && guard++ < 400) {
    if (Object.keys(cur).length >= BN) break;
    const add = [];
    let spinPlus = 0;
    for (let c = 0; c < COLS; c++) for (let r = 0; r < BR; r++) {
      const i = c * BR + r;
      if (!open(i) || i in cur || R() >= P.hp) continue;
      const t = wp(R, P.land);
      if (t === 'v') { cur[i] = wp(R, P.val); add.push({ i, t, v: cur[i] }); continue; }
      if (t === 'mini' || t === 'minor' || t === 'major') { cur[i] = t; add.push({ i, t, v: t }); continue; }
      // boosters: they act, then stay as a ruby with a value
      const a = { i, t, v: 0 };
      if (t === 'spin') { spinPlus++; cur[i] = a.v = wp(R, P.val); }
      else if (t === 'reels') { if (rows < BR) { rows++; a.row = rows; } cur[i] = a.v = wp(R, P.val); }
      else if (t === 'mult') { a.up = wp(R, P.multUp); mult = Math.min(P.maxMult, mult + a.up); a.mult = mult; cur[i] = a.v = wp(R, P.val); }
      else { const b = wp(R, P.boost); for (const j in cur) if (typeof cur[j] === 'number') cur[j] += b; cur[i] = a.v = b; a.b = b; }
      add.push(a);
    }
    const auto = unlockAuto();
    left = add.length ? Math.min(P.maxLeft, 3 + spinPlus) : left - 1;
    steps.push({ add, left, rows, mult, auto, snap: { ...cur } });
  }
  const full = Object.keys(cur).length >= BN;
  let sum = 0; for (const j in cur) sum += vx(cur[j]);
  const total = (sum + (full ? JPX.grand : 0)) * mult; // the GRAND is multiplied too
  return { start: { ...start }, steps, cur, rows, mult, sum, total, full };
}
// n random starting rubies (bought Ruby Link) on the 15 cells of the base grid
function startRubies(n = 6, R = Math.random) {
  const cells = [...Array(N).keys()];
  for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; }
  const o = {}; cells.slice(0, n).forEach((i) => { o[toBig(i)] = wp(R, P.val); });
  return o;
}
const startOf = (res) => Object.fromEntries(res.rubies.map((i) => [toBig(i), res.vals[i]]));
// The free spins: list of spins (with their Ruby Link when 6 rubies land) and total (× the bet).
function freeRun(cnt, R = Math.random) {
  const spins = [];
  let left = cnt, total = 0, guard = 0;
  while (left > 0 && guard++ < 300) {
    left--;
    const s = spin(R, true);
    if (s.scat >= 3) { left += FS_RETRIG; s.re = FS_RETRIG; }
    if (s.link) s.run = linkRun(startOf(s), R);
    s.left = left; total += s.x + (s.run ? s.run.total : 0); s.total = total;
    spins.push(s);
  }
  return { spins, total };
}
// A whole paid round (for the simulator): × the bet, capped.
function round(R = Math.random) {
  const s = spin(R, false);
  let t = s.x, link = 0, fs = 0;
  if (s.fs) { fs = freeRun(s.fs, R).total; t += fs; }
  if (s.link) { link = linkRun(startOf(s), R).total; t += link; }
  return { total: Math.min(CAPX, t), line: s.x, link, fs, hasLink: s.link, hasFs: !!s.fs };
}
const buyRun = (kind, R = Math.random) => Math.min(CAPX, linkRun(startRubies(6, R), R, kind === 'super' ? { rows: P.superRows, mult: P.superMult } : {}).total);
const ENGINE = { COLS, ROWS, N, BR, BN, NS, WILD, SCAT, RUBY, CAPX, LINES, FS_COUNT, FS_RETRIG, JPX, BUY, P, wp, screen, lines, spin, toBig, linkRun, startRubies, startOf, freeRun, round, buyRun, vx };
/* ===END ENGINE */

const E = ENGINE;
const { LINES: _L, P: PP } = E;
const IMG_V = 1;
const asset = (p) => window.__assets?.[p] || `${p}?v=${IMG_V}`; // single-file version: images and videos are inlined
const src = (n) => asset(`assets/games/redk/${n}.webp`);
const img = (n, cls = 'rk-img') => `<img class="${cls}" src="${src(n)}" alt="" draggable="false" decoding="async">`;
const NAMES = ['10', 'Valet', 'Dame', 'Roi', 'As', 'Scarabée sacré', 'Œil d’Horus', 'Anubis', 'Pharaon'];
const RUBY_C = ['#fecaca', '#ef4444', '#b91c1c', '#fff'];
const GOLD = ['#fde047', '#facc15', '#fff7d6', '#f59e0b'];
const JP_NAME = { mini: 'MINI', minor: 'MINOR', major: 'MAJOR', grand: 'GRAND' };
const BOOST = {
  spin: { n: 'SPIN+', pic: 'b-spin', c: '#22c55e', say: '+1 RE-SPIN' },
  reels: { n: 'REELS+', pic: 'b-reels', c: '#60a5fa', say: 'UNE RANGÉE EN PLUS' },
  mult: { n: 'MULTI+', pic: 'b-mult', c: '#a855f7', say: 'MULTIPLICATEUR' },
  value: { n: 'VALUE+', pic: 'b-value', c: '#f59e0b', say: 'TOUS LES RUBIS' },
};
const KE = '<i class="rk-ke"></i>';
// Ruby values in KE (owner's choice): 500, 2 500, 25K, 1,5M
const kfmt = (c) => {
  const x = Math.round(c / 100);
  const d = (v) => (Math.round(v * 10) / 10).toLocaleString('fr-FR');
  if (x >= 1e6) return `${d(x / 1e6)}M`;
  if (x >= 1e4) return `${d(x / 1e3)}K`;
  return x.toLocaleString('fr-FR');
};
const vibe = (p) => { try { if (localStorage.getItem('spinbet_vibe') !== '0' && navigator.vibrate && !document.hidden) navigator.vibrate(p); } catch { /* ignore */ } };

/* ---------- the heartbeat of the suspense: two low thumps, faster and faster, over a deep drone ---------- */
class Heart {
  start() {
    if (this.on || isMuted()) return;
    const ctx = audioContext(); if (!ctx) return;
    this.on = true; this.ctx = ctx; this.k = 0;
    const out = ctx.createGain(); out.gain.value = 0.9; out.connect(ctx.destination); this.out = out;
    // drone: two detuned saws through a low-pass, rising slowly
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260; lp.Q.value = 6;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, ctx.currentTime); g.gain.linearRampToValueAtTime(0.11, ctx.currentTime + 2.2);
    this.osc = [55, 55.6, 82.4].map((f) => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(lp); o.start(); return o; });
    lp.frequency.linearRampToValueAtTime(700, ctx.currentTime + 4);
    lp.connect(g); g.connect(out); this.drone = g;
    const beat = () => {
      if (!this.on) return;
      const t = ctx.currentTime + 0.02;
      this.thump(t, 0.9); this.thump(t + 0.2, 0.55);
      vibe([45, 150, 30]);
      this.k++;
      this.timer = setTimeout(beat, Math.max(430, 900 - this.k * 70));
    };
    beat();
  }
  thump(t, v) {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(72, t); o.frequency.exponentialRampToValueAtTime(36, t + 0.16);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g); g.connect(this.out); o.start(t); o.stop(t + 0.32);
  }
  // the sigh when it did not come: a soft falling tone
  sigh() {
    if (isMuted()) return;
    const ctx = audioContext(); if (!ctx) return;
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(392, t); o.frequency.exponentialRampToValueAtTime(147, t + 0.6);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16, t + 0.04); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.72);
  }
  stop() {
    if (!this.on) return;
    this.on = false; clearTimeout(this.timer);
    const ctx = this.ctx, t = ctx.currentTime;
    try { this.drone.gain.cancelScheduledValues(t); this.drone.gain.setValueAtTime(this.drone.gain.value, t); this.drone.gain.linearRampToValueAtTime(0, t + 0.35); } catch { /* ignore */ }
    const osc = this.osc, out = this.out;
    setTimeout(() => { osc.forEach((o) => { try { o.stop(); } catch { /* ignore */ } }); out.disconnect(); }, 450);
  }
}

class RedkGame extends BaseGame {
  constructor(root, game) {
    super(root, game, {
      music: EXTRA_THEMES.redk, cls: 'rk-slot',
      stage: `<div class="rk-stage">
        <div class="rk-logo" aria-label="Diamants REDK"><small>DIAMANTS</small><b>REDK</b></div>
        <div class="rk-jps">${['mini', 'minor', 'major', 'grand'].map((k) => `<span class="rk-jp ${k}"><i>${JP_NAME[k]}</i><b data-jp="${k}"></b></span>`).join('')}</div>
        <div class="rk-board"><div class="rk-shake">
          <div class="rk-boost">${Object.entries(BOOST).map(([k, b]) => `<span class="rk-bst ${k}" data-b="${k}">${img(b.pic, 'rk-bimg')}<b>${b.n}</b><em></em></span>`).join('')}</div>
          <div class="rk-reels"></div>
          <div class="rk-link" hidden></div>
        </div></div>
        <div class="rk-word"></div>
      </div>`,
      buys: [
        { id: 'link', icon: '💎', label: 'RUBY LINK · 6 rubis', desc: '6 rubis qui restent, 3 re-spins, 3 rangées à déverrouiller et les boosters', cost: (b) => b * E.BUY.link },
        { id: 'super', icon: '👑', label: 'RUBY LINK SUPER', desc: `6 rubis, une rangée déjà ouverte et le multiplicateur déjà à ×${PP.superMult}`, cost: (b) => b * E.BUY.super },
      ],
      hello: '6 rubis = RUBY LINK · 3 pyramides = tours gratuits',
    });
    // the owner's moving diamond mine behind the whole machine (the same in the bonus)
    const bg = this.q('.slot-bg');
    bg.innerHTML = `<video class="rk-video" src="${asset('assets/games/redk/bg.mp4')}" poster="${src('bg')}" muted autoplay loop playsinline preload="auto" disablepictureinpicture aria-hidden="true"></video><div class="rk-shade"></div><div class="rk-sparks" aria-hidden="true">${Array.from({ length: 18 }, (_, k) => `<i style="left:${(k * 41) % 100}%;top:${(k * 67) % 100}%;--d:${2.2 + (k % 5) * 0.7}s;animation-delay:-${(k * 0.9) % 4}s"></i>`).join('')}</div>`;
    this.video = bg.querySelector('video');
    this.video.muted = true;
    const play = () => { if (!this.dead && !matchMedia('(prefers-reduced-motion: reduce)').matches) this.video.play().catch(() => {}); };
    play();
    this.onVis = () => { if (document.hidden) { this.video.pause(); this.heart.stop(); } else play(); };
    document.addEventListener('visibilitychange', this.onVis);
    this.root.addEventListener('pointerdown', play, { once: true }); // a phone in power-saving mode waits for a touch
    this.heart = new Heart();
    this.vals = {};
    this.reels = new Reels(this.q('.rk-reels'), {
      cols: E.COLS, rows: E.ROWS, game: this, random: (c) => this.filler(c),
      art: (v, i) => this.cellArt(v, i),
      cls: (v) => (v === E.RUBY ? 'ruby' : v === E.SCAT ? 'scat' : v === E.WILD ? 'wild' : v >= 5 ? 'hi' : 'lo'),
    });
    this.reels.el.classList.add('rk-rs');
    this.reels.setAll(this.idle());
    ['ruby', 'wild', 'scat', 'b-spin', 'b-reels', 'b-mult', 'b-value', 's7', 's8'].forEach((n) => { new Image().src = src(n); });
    new Image().src = src('ruby');
    this.paintJps();
  }

  destroy() { document.removeEventListener('visibilitychange', this.onVis); this.video?.pause(); this.heart.stop(); super.destroy(); }
  onBetChange() { this.paintJps(); }
  onMeters() { this.paintJps(); }
  paintJps() { if (this.dead) return; this.qa('[data-jp]').forEach((n) => { n.innerHTML = `${kfmt(E.JPX[n.dataset.jp] * this.bet)}${KE}`; }); }

  // a calm screen without bonus symbols in excess (shown at the opening and after a bonus)
  idle() { const { g, vals } = E.screen(Math.random, false); this.vals = vals; return g; }
  filler(c) {
    const r = Math.random();
    if (r < 0.1) return E.RUBY;
    if (r < 0.125) return E.SCAT;
    return E.screen(Math.random, this.inFree).g[c * E.ROWS];
  }
  rubyHTML(v) {
    if (typeof v === 'string') return `${img('ruby', 'rk-img rk-rb jp')}<b class="rk-v jp ${v}"><small>${JP_NAME[v]}</small>${kfmt(E.JPX[v] * this.bet)}</b>`;
    return `${img('ruby', `rk-img rk-rb${v >= 15 ? ' big' : ''}`)}<b class="rk-v${v >= 15 ? ' big' : ''}">${kfmt(v * this.bet)}${KE}</b>`;
  }
  cellArt(v, i) {
    if (v === E.RUBY) return this.rubyHTML(i >= 0 && this.vals[i] !== undefined ? this.vals[i] : E.wp(Math.random, PP.val));
    if (v === E.WILD) return img('wild');
    if (v === E.SCAT) return img('scat');
    return img(`s${v}`);
  }

  word(t, cls = '') {
    const w = this.q('.rk-word');
    w.innerHTML = t; w.className = `rk-word ${cls}`;
    w.getAnimations().forEach((a) => a.cancel());
    w.animate([{ opacity: 0, transform: 'translate(-50%,-50%) scale(.3) rotateX(40deg)' }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1.12)', offset: 0.22 },
      { opacity: 1, transform: 'translate(-50%,-50%) scale(1)', offset: 0.72 }, { opacity: 0, transform: 'translate(-50%,-64%) scale(1.15)' }], { duration: this.turbo ? 900 : 1500, easing: 'ease-out' });
  }

  /* ---------- the suspense (one ruby or one pyramid missing) ---------- */
  // node = the reel (or cell) that can still bring it: slow reel, zoom on it, the screen shakes, heartbeat
  tense(node, level = 1) {
    const board = this.q('.rk-board'), shake = this.q('.rk-shake');
    if (!node) {
      if (!this.tensing) return;
      this.tensing = false;
      this.heart.stop();
      this.slotEl.classList.remove('rk-tense');
      shake.classList.remove('q1', 'q2', 'q3');
      board.style.transform = '';
      this.qa('.rk-focus').forEach((n) => n.classList.remove('rk-focus'));
      if (this.musicWas) { this.musicWas = false; this.music.start(); }
      return;
    }
    if (!this.tensing) {
      this.tensing = true;
      if (this.music.playing) { this.musicWas = true; this.music.stop(); }
      this.heart.start();
      this.slotEl.classList.add('rk-tense');
    }
    this.qa('.rk-focus').forEach((n) => n.classList.remove('rk-focus'));
    node.classList.add('rk-focus');
    // the zoom: the board grows around the reel / cell that may still bring it
    const a = board.getBoundingClientRect(), b = node.getBoundingClientRect(), k = a.width / (board.offsetWidth || 1) || 1;
    const x = (b.left + b.width / 2 - a.left) / k, y = (b.top + b.height / 2 - a.top) / k;
    board.style.transformOrigin = `${x}px ${y}px`;
    board.style.transform = `scale(${level >= 2 ? 1.32 : 1.2})`;
    shake.classList.remove('q1', 'q2', 'q3'); void shake.offsetWidth; shake.classList.add(`q${Math.min(3, level)}`);
  }
  // the end of the suspense: an explosion of red light if it came, a sigh if not
  tenseEnd(ok) {
    if (!this.tensing) return;
    this.tense(null);
    if (ok) { this.flash('rgba(239,68,68,.6)'); this.shake(); sfx.jackpot(); vibe([90, 50, 160]); }
    else this.heart.sigh();
  }

  /* ---------- a spin of the reels with the suspense ---------- */
  async spinReels(res) {
    const tease = new Set();
    await this.reels.spin(res.g, {
      tease: (c, vals) => {
        let r = 0, s = 0;
        for (let j = 0; j < c * E.ROWS; j++) { if (vals[j] === E.RUBY) r++; if (vals[j] === E.SCAT) s++; }
        const t = (r === 5 || s === 2) && !this.superT;
        if (t) tease.add(c);
        return t;
      },
      onStop: (c) => {
        for (let r = 0; r < E.ROWS; r++) {
          const i = c * E.ROWS + r, v = res.g[i];
          if (v === E.RUBY || v === E.SCAT) {
            sfx.land();
            const n = this.reels.cell(i), p = center(n);
            fx.burst(p.x, p.y, v === E.RUBY ? 14 : 12, v === E.RUBY ? RUBY_C : GOLD, 5);
            n?.classList.add('rk-in');
          }
        }
        if (this.dead) return;
        if (tease.has(c + 1)) { this.tense(this.reels.reelEls[c + 1], [...tease].indexOf(c + 1) + 1); this.msg(res.rubies.filter((i) => i < (c + 1) * E.ROWS).length === 5 ? '💎 Plus qu’un rubis…' : '🔺 Plus qu’une pyramide…'); }
        else if (tease.has(c)) this.tenseEnd(res.link || res.fs > 0);
      },
    });
    this.tense(null);
  }

  onMain() { this.round(() => this.playRound(null)); }
  async onBuy(kind) { await this.playRound(kind); }

  async playRound(buy) {
    const b = this.bet, cap = this.capC() || E.CAPX * b;
    if (!buy && !this.pay(b)) return;
    this.lastStake = b;
    this.setLast(0); this.winAmt.textContent = ''; this.setBanner('');
    let total = 0;
    if (buy) total = await this.rubyLink(E.startRubies(6), b, cap, buy === 'super' ? { rows: PP.superRows, mult: PP.superMult, title: 'RUBY LINK SUPER' } : {});
    else {
      const res = E.spin(Math.random, false);
      this.vals = res.vals;
      await this.spinReels(res);
      if (this.dead) return;
      total = Math.min(Math.round(res.x * b), cap);
      if (res.wins.length) {
        this.reels.mark([...new Set(res.wins.flatMap((w) => w.cells))]);
        this.msg(this.winMsg(res.wins, b));
        this.win(total); this.setLast(total); this.winAmt.textContent = fmtC(total);
      } else this.msg(res.rubies.length === 5 ? '5 rubis… il en fallait 6 !' : res.scat === 2 ? 'Deux pyramides… il en fallait une de plus !' : res.rubies.length ? `${res.rubies.length} rubis · il en faut 6 pour le RUBY LINK` : 'Pas de gain');
      if (res.link || res.fs) {
        this.stopAuto();
        if (total > 0) { sfx.win(); await this.wait(900); }
        this.reels.unmark();
        if (res.link) {
          this.reels.mark(res.rubies, 'win');
          this.word('6 RUBIS !', 'ruby'); await this.wait(1200);
          this.reels.unmark();
          total += await this.rubyLink(E.startOf(res), b, cap - total);
        }
        if (res.fs && total < cap) {
          this.reels.mark(res.g.map((v, i) => (v === E.SCAT ? i : -1)).filter((i) => i >= 0), 'win');
          this.word(`${res.scat} PYRAMIDES !`, 'fs'); sfx.feature(); await this.wait(1200);
          this.reels.unmark();
          total += await this.freeSpins(res.fs, b, cap - total);
        }
      } else if (total > 0) await this.celebrate(total);
      this.reels.unmark();
    }
    this.setLast(total);
    if (total >= cap) this.msg(`GAIN MAXIMUM ! ${fmtC(total)}`);
    else if (total > 0 && (buy || this.bonusDone)) this.msg(`Total du tour : ${fmtC(total)}`);
    this.bonusDone = false;
  }

  winMsg(wins, b) {
    const top = wins.slice().sort((p, q) => q.x - p.x);
    const t = top.slice(0, 2).map((w) => `${w.n} × ${NAMES[w.s]} : +${fmtC(Math.round(w.x * b))}`).join(' · ');
    return top.length > 2 ? `${t} · +${top.length - 2} ligne${top.length > 3 ? 's' : ''}` : t;
  }

  /* ---------- the owner's BONUS video opens every bonus (won or bought) ---------- */
  bonusIntro(title, sub) {
    // achievements.js, special.js and the music listen: a bonus started (bought or not)
    dispatchEvent(new CustomEvent('sb:feature', { detail: { game: this.game.id, title, bought: !!this.buyRound, re: false } }));
    duck(0.12, this.turbo ? 3 : 6.5);
    vibe([60, 50, 60, 50, 150]);
    const ov = this.overlay(`<video class="rk-ivid" src="${asset('assets/games/redk/intro.mp4')}" playsinline preload="auto" disablepictureinpicture></video>
      <div class="rk-ititle"><b>${title}</b><p>${sub}</p></div><small>Touchez pour passer</small>`, 'rk-intro');
    const v = ov.querySelector('video');
    v.muted = isMuted();
    v.volume = 0.85;
    if (this.turbo) v.playbackRate = this.superT ? 2 : 1.5;
    return new Promise((resolve) => {
      let over = false;
      const done = () => { if (over) return; over = true; clearTimeout(t); ov.classList.add('out'); v.pause(); setTimeout(() => { ov.remove(); resolve(); }, 320); };
      const t = setTimeout(done, this.superT ? 2400 : this.turbo ? 4600 : 7000);
      v.addEventListener('ended', done);
      v.play().catch(() => { v.muted = true; v.play().catch(() => { ov.classList.add('novid'); fx.confetti(60); sfx.feature(); }); });
      ov.addEventListener('click', done);
      const watch = setInterval(() => { if (this.dead) { clearInterval(watch); done(); } if (over) clearInterval(watch); }, 400);
    });
  }

  /* ---------- LES TOURS DE LA PYRAMIDE (free spins, wins ×3) ---------- */
  async freeSpins(count, b, capLeft) {
    await this.bonusIntro('LES TOURS DE LA PYRAMIDE', `${count} tours gratuits · tous les gains ×${PP.fsMul} · plus de couronnes WILD · 6 rubis lancent encore le RUBY LINK`);
    if (this.dead) return 0;
    this.inFree = true;
    this.slotEl.classList.add('rk-free');
    try { this.video.playbackRate = 1.3; } catch { /* ignore */ }
    let sum = 0, done = 0, max = count, left = count, capped = false;
    const banner = () => this.setBanner(`<b>TOURS DE LA PYRAMIDE</b><span class="pill">Tour ${done} / ${max}</span><span class="pill">Gains ×${PP.fsMul}</span><span class="pill gold">${fmtC(Math.round(Math.min(sum, capLeft)))}</span>`);
    banner();
    while (left > 0 && !this.dead) {
      left--; done++; banner();
      const s = E.spin(Math.random, true);
      this.vals = s.vals;
      await this.spinReels(s);
      if (this.dead) return 0;
      const won = Math.round(s.x * b);
      if (s.wins.length) {
        this.reels.mark([...new Set(s.wins.flatMap((w) => w.cells))]);
        this.msg(`${this.winMsg(s.wins, b)} <b class="rk-x">×${PP.fsMul}</b>`);
        sum += won; banner();
        this.winAmt.textContent = fmtC(Math.round(Math.min(sum, capLeft)));
        sfx.win();
        await this.wait(s.x >= 10 ? 1300 : 800);
      } else { this.msg('Pas de gain sur ce tour'); await this.wait(350); }
      if (s.scat >= 3) {
        this.reels.mark(s.g.map((v, i) => (v === E.SCAT ? i : -1)).filter((i) => i >= 0), 'win');
        left += E.FS_RETRIG; max += E.FS_RETRIG; banner();
        this.word(`+${E.FS_RETRIG} TOURS !`, 'fs'); sfx.feature(); fx.confetti(50);
        await this.wait(1300);
      }
      this.reels.unmark();
      if (s.link && sum < capLeft) {
        this.reels.mark(s.rubies, 'win');
        this.word('6 RUBIS !', 'ruby'); await this.wait(1100);
        this.reels.unmark();
        const w = await this.rubyLink(E.startOf(s), b, capLeft - sum, { inFree: true });
        sum += w; banner();
        if (this.dead) return 0;
      }
      if (sum >= capLeft) { capped = true; break; }
    }
    this.inFree = false;
    this.slotEl.classList.remove('rk-free');
    try { this.video.playbackRate = 1; } catch { /* ignore */ }
    this.setBanner('');
    const won = Math.min(sum, capLeft);
    // the free-spin line wins are paid here (the Ruby Links inside were paid already)
    const lineWon = won - (this.linkInFree || 0);
    this.linkInFree = 0;
    if (lineWon > 0) this.win(lineWon, 'Tours de la pyramide');
    this.setLast(won);
    await this.celebrate(won, { summary: 'TOURS DE LA PYRAMIDE', stake: b });
    this.msg(capped ? `GAIN MAXIMUM ! ${fmtC(won)}` : won > 0 ? `Tours de la pyramide : ${max} tours, ${fmtC(won)}` : 'Les tours de la pyramide sont finis : pas de gain cette fois');
    this.bonusDone = true;
    this.reels.setAll(this.idle());
    return won;
  }

  /* ---------- RUBY LINK ---------- */
  linkCell(i) { return this.linkEl.children[i]; }
  buildLink(rows) {
    const L = this.q('.rk-link');
    this.linkEl = L;
    let h = '';
    for (let i = 0; i < E.BN; i++) { const c = Math.floor(i / E.BR), r = i % E.BR; h += `<div class="rk-lc" style="grid-column:${c + 1};grid-row:${r + 1}"><i class="rk-alc"></i></div>`; }
    L.innerHTML = h;
    this.lockEls = [0, 1, 2].map((r) => { const n = document.createElement('div'); n.className = 'rk-lock'; n.style.gridRow = `${r + 1}`; n.innerHTML = '<i class="rk-pad">🔒</i><span><b>POUR DÉVERROUILLER</b><em></em></span>'; L.appendChild(n); return n; });
    this.rows = rows;
    this.paintLocks();
  }
  open(i) { return (i % E.BR) >= E.BR - this.rows; }
  paintLocks(fresh = false) {
    const have = Object.keys(this.lv).length;
    this.lockEls.forEach((n, r) => {
      const locked = r < E.BR - this.rows;
      if (!locked && !n.classList.contains('gone')) {
        n.classList.add('gone');
        if (fresh) { const p = center(n); fx.burst(p.x, p.y, 40, GOLD, 9); }
      }
      if (!locked) return;
      const next = r === E.BR - this.rows - 1;
      n.classList.toggle('next', next);
      const thr = PP.unlock[E.BR - 1 - r - 3]; // row r opens when the open rows go from 6 - r - 1 to 6 - r
      n.querySelector('em').innerHTML = next ? (thr - have > 0 ? `encore <b>${thr - have}</b> rubis · ou REELS+` : 'ÇA S’OUVRE…') : `${thr} rubis`;
    });
  }
  setLinkCell(i, v, kind) {
    const n = this.linkCell(i); if (!n) return;
    n.className = `rk-lc on${typeof v === 'string' ? ` jp ${v}` : ''}${kind ? ` b-${kind}` : ''}${v >= 15 ? ' big' : ''}`;
    n.innerHTML = this.rubyHTML(v);
  }
  dropIn(i) { this.linkCell(i)?.animate([{ transform: 'translateY(-80%) scale(.6)', filter: 'blur(4px) brightness(2)', opacity: 0 }, { transform: 'translateY(6%) scale(1.06)', filter: 'none', opacity: 1, offset: 0.7 }, { transform: 'none' }], { duration: 360, easing: 'ease-out' }); }
  pop(i) { this.linkCell(i)?.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.2)', filter: 'brightness(1.6)' }, { transform: 'scale(1)' }], { duration: 380, easing: 'ease-out' }); }

  async rubyLink(start, b, capLeft, opts = {}) {
    const title = opts.title || 'RUBY LINK';
    await this.bonusIntro(title, `${Object.keys(start).length} rubis restent en place · 3 re-spins, remis à 3 à chaque nouveau rubis · déverrouille les 3 rangées du haut · SPIN+, REELS+, MULTI+, VALUE+ · grille pleine : GRAND`);
    if (this.dead) return 0;
    const run = E.linkRun(start, Math.random, opts);
    this.slotEl.classList.add('rk-linking');
    this.lv = { ...run.start };
    this.mult = opts.mult || 1;
    this.buildLink(3 + (opts.rows || 0));
    this.q('.rk-link').hidden = false;
    for (const i in this.lv) this.setLinkCell(+i, this.lv[i]);
    this.paintBoost();
    const sumNow = () => { let t = 0; for (const j in this.lv) t += E.vx(this.lv[j]); return t; };
    const banner = (left) => this.setBanner(`<b>${title}</b><span class="pill rk-left">Re-spins <i class="rk-dots">${[0, 1, 2, 3, 4].slice(0, Math.max(3, left)).map((k) => `<i class="${k < left ? 'on' : ''}"></i>`).join('')}</i></span><span class="pill">×${this.mult}</span><span class="pill gold">${fmtC(Math.round(Math.min(sumNow() * this.mult * b, capLeft)))}</span>`);
    banner(3);
    this.msg('Les rubis restent : 3 re-spins');
    this.focusStage?.();
    await this.wait(700);
    // rows already opened by the starting rubies
    let r0 = this.rows; while (r0 < E.BR && Object.keys(this.lv).length >= PP.unlock[r0 - 3]) r0++;
    if (r0 > this.rows) await this.unlockRows(r0);
    let left = 3;
    for (const st of run.steps) {
      if (this.dead) return 0;
      banner(Math.max(0, left - 1));
      this.msg('Re-spin…');
      // suspense: one ruby missing to open the next row, or one cell left for the GRAND
      const have = Object.keys(this.lv).length, empty = [];
      for (let i = 0; i < E.BN; i++) if (this.open(i) && !(i in this.lv)) empty.push(i);
      const oneRow = this.rows < E.BR && have === PP.unlock[this.rows - 3] - 1;
      const oneGrand = this.rows === E.BR && empty.length === 1;
      await this.respin(st, b, oneGrand ? this.linkCell(empty[0]) : oneRow ? this.lockEls[E.BR - this.rows - 1] : null, oneGrand ? 3 : 2);
      left = st.left;
      if (st.mult !== this.mult) this.mult = st.mult;
      if (st.rows !== this.rows) await this.unlockRows(st.rows);
      banner(st.left);
      if (st.add.length) { const pl = this.banner?.querySelector('.rk-left'); pl?.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.35)', boxShadow: '0 0 18px #ef4444' }, { transform: 'scale(1)' }], { duration: 600, easing: 'ease-out' }); }
      const nb = `${Object.keys(this.lv).length} / ${E.COLS * this.rows} rubis`;
      this.msg(st.add.length ? `${nb} · ${st.add.length} nouveau${st.add.length > 1 ? 'x' : ''} : les re-spins repartent à ${st.left} !` : st.left ? `${nb} · encore ${st.left} re-spin${st.left > 1 ? 's' : ''}` : `${nb} · dernier re-spin terminé`);
      await this.wait(this.turbo ? 200 : 420);
    }
    // the count, ruby by ruby, then the multiplier and the GRAND
    let tot = 0;
    for (let i = 0; i < E.BN; i++) {
      if (!(i in this.lv)) continue;
      tot += E.vx(this.lv[i]) * b;
      this.linkCell(i)?.classList.add('counted');
      this.winAmt.textContent = fmtC(Math.round(Math.min(tot, capLeft)));
      sfx.tick();
      await this.wait(this.turbo ? 30 : 75);
    }
    if (run.full) {
      this.word(`GRAND<br><small>${kfmt(E.JPX.grand * b)}${KE}</small>`, 'grand'); this.flash('rgba(255,255,255,.85)'); fx.confetti(160); sfx.jackpot(); vibe([200, 80, 200, 80, 400]);
      tot += E.JPX.grand * b; this.winAmt.textContent = fmtC(Math.round(Math.min(tot, capLeft)));
      await this.wait(1800);
    }
    if (this.mult > 1 && tot > 0) {
      this.word(`×${this.mult}`, 'mult'); sfx.upgrade(); this.flash('rgba(168,85,247,.45)');
      const p = center(this.q('.rk-bst.mult')); fx.burst(p.x, p.y, 40, ['#e9d5ff', '#a855f7', '#fff'], 8);
      await this.wait(700);
      tot *= this.mult;
      this.winAmt.textContent = fmtC(Math.round(Math.min(tot, capLeft)));
      sfx.bigWin();
      await this.wait(900);
    }
    const won = Math.min(Math.round(tot), capLeft);
    if (won > 0) { this.win(won, title === 'RUBY LINK SUPER' ? 'Ruby Link Super' : 'Ruby Link'); this.setLast(won); }
    if (opts.inFree) this.linkInFree = (this.linkInFree || 0) + won;
    await this.celebrate(won, { summary: title, stake: b });
    this.setBanner('');
    this.slotEl.classList.remove('rk-linking');
    this.q('.rk-link').hidden = true;
    this.msg(`${title} : ${fmtC(won)}${run.full ? ' · GRILLE PLEINE !' : ''}`);
    this.bonusDone = true;
    this.lv = {};
    if (!opts.inFree) this.reels.setAll(this.idle());
    if (opts.inFree) this.setBanner('');
    return won;
  }

  paintBoost(flash) {
    this.qa('.rk-bst').forEach((n) => { n.querySelector('em').textContent = n.dataset.b === 'mult' ? `×${this.mult}` : ''; });
    if (flash) { const n = this.q(`.rk-bst.${flash}`); n?.classList.remove('hit'); void n?.offsetWidth; n?.classList.add('hit'); }
  }

  async unlockRows(rows) {
    while (this.rows < rows && !this.dead) {
      this.rows++;
      const n = this.lockEls[E.BR - this.rows];
      this.word('RANGÉE DÉVERROUILLÉE !', 'unlock');
      sfx.huff?.(); sfx.upgrade(); this.shake(); vibe([40, 40, 80]);
      n.classList.add('break');
      await this.wait(this.turbo ? 300 : 650);
      this.paintLocks(true);
      await this.wait(this.turbo ? 200 : 500);
    }
    this.paintLocks();
  }

  // One re-spin: the open empty cells turn, column after column they stop; new rubies drop, boosters act.
  async respin(st, b, tenseNode, level) {
    const empties = [];
    for (let i = 0; i < E.BN; i++) if (this.open(i) && !(i in this.lv)) empties.push(i);
    empties.forEach((i) => this.linkCell(i)?.classList.add('rolling'));
    sfx.spin?.();
    const slow = !!tenseNode && !this.superT;
    if (slow) { this.tense(tenseNode, level); this.msg(level >= 3 ? '👑 UNE SEULE CASE POUR LE GRAND…' : '🔒 Plus qu’un rubis pour déverrouiller…'); }
    await this.wait(slow ? 2600 : this.turbo ? 380 : 700);
    const addAt = new Map(st.add.map((a) => [a.i, a]));
    for (let c = 0; c < E.COLS; c++) {
      if (this.dead) return;
      const col = empties.filter((i) => Math.floor(i / E.BR) === c);
      col.forEach((i) => { const n = this.linkCell(i); if (!n) return; n.classList.remove('rolling'); if (!addAt.has(i)) n.animate([{ transform: 'translateY(-5%)' }, { transform: 'translateY(3%)' }, { transform: 'none' }], { duration: 200, easing: 'ease-out' }); });
      if (col.length) sfx.tick?.();
      await this.wait(slow ? 260 : this.turbo ? 40 : 90);
    }
    if (slow) this.tenseEnd(st.add.length > 0);
    for (const a of st.add) {
      if (this.dead) return;
      const n0 = this.linkCell(a.i), p = center(n0);
      if (BOOST[a.t]) {
        const B = BOOST[a.t];
        // the booster lands, flies to its place above the grid and acts
        n0.className = `rk-lc on boost b-${a.t}`;
        n0.innerHTML = `${img(B.pic, 'rk-img rk-bimg')}<b class="rk-bn">${B.n}</b>`;
        this.dropIn(a.i); sfx.feature(); vibe([30, 40, 60]);
        await this.wait(this.turbo ? 200 : 420);
        const to = center(this.q(`.rk-bst.${a.t}`));
        fx.trail?.(p, to, B.c, 16);
        await this.wait(this.turbo ? 160 : 320);
        if (a.t === 'mult') this.mult = a.mult;
        this.paintBoost(a.t);
        if (a.t === 'value') {
          for (const j in this.lv) if (typeof this.lv[j] === 'number') { this.lv[j] += a.b; this.setLinkCell(+j, this.lv[j]); this.pop(+j); }
          this.word(`VALUE+ · +${kfmt(a.b * b)}${KE}<br><small>sur tous les rubis</small>`, 'value');
        } else if (a.t === 'mult') this.word(`MULTI+ · ×${a.mult}`, 'mult');
        else if (a.t === 'spin') this.word('SPIN+ · +1 RE-SPIN', 'spin');
        else this.word(a.row ? 'REELS+ · UNE RANGÉE EN PLUS' : 'REELS+', 'reels');
        this.flash(`${B.c}55`); sfx.upgrade();
        await this.wait(this.turbo ? 350 : 800);
        this.lv[a.i] = a.v;
        this.setLinkCell(a.i, a.v, a.t); this.pop(a.i);
        if (a.t === 'reels' && a.row) await this.unlockRows(a.row);
      } else {
        this.lv[a.i] = a.v;
        this.setLinkCell(a.i, a.v);
        this.dropIn(a.i);
        if (typeof a.v === 'string') { this.word(`${JP_NAME[a.v]}<br><small>${kfmt(E.JPX[a.v] * b)}${KE}</small>`, `jp ${a.v}`); sfx.jackpot(); vibe([80, 50, 120]); await this.wait(900); }
        else sfx.coin();
        fx.burst(p.x, p.y, a.v >= 15 ? 22 : 12, RUBY_C, a.v >= 15 ? 7 : 5);
        await this.wait(this.turbo ? 70 : 140);
      }
    }
    this.paintLocks();
  }

  info() {
    const f = (x) => (Math.round(x / 20 * PP.K * 100) / 100).toLocaleString('fr-FR');
    const rows = [8, 7, 6, 5, 4, 3, 2, 1, 0].map((s) => `<div class="pay-item"><div class="pay-sym rk-pay">${img(`s${s}`)}</div><div class="pay-vals"><b>${NAMES[s]}</b><br><span>3 : ×${f(PP.pays[s][0])} · 4 : ×${f(PP.pays[s][1])} · 5 : ×${f(PP.pays[s][2])}</span></div></div>`).join('');
    const jp = (k) => `<b>${JP_NAME[k]} ×${E.JPX[k].toLocaleString('fr-FR')}</b>`;
    return this.rules(`<h4>Symboles (× la mise, par ligne)</h4><div class="paytable">${rows}
      <div class="pay-item"><div class="pay-sym rk-pay">${img('wild')}</div><div class="pay-vals"><b>Couronne WILD</b><br><span>Rouleaux 2 à 5, remplace tous les symboles sauf le rubis et la pyramide</span></div></div>
      <div class="pay-item"><div class="pay-sym rk-pay">${img('scat')}</div><div class="pay-vals"><b>Pyramide</b><br><span>3 : ${E.FS_COUNT[3]} tours gratuits · 4 : ${E.FS_COUNT[4]} · 5 : ${E.FS_COUNT[5]}</span></div></div>
      <div class="pay-item"><div class="pay-sym rk-pay">${img('ruby')}</div><div class="pay-vals"><b>Rubis rouge</b><br><span>Porte sa valeur en KE (1 à 50 fois la mise, ou MINI / MINOR) · 6 ou plus : RUBY LINK</span></div></div></div>
      <h4>20 lignes</h4><p>5 rouleaux de 3 cases et 20 lignes fixes. Une ligne paie dès que 3 symboles identiques ou plus se suivent depuis la gauche.</p>
      <h4>RUBY LINK</h4><p>6 rubis ou plus : ils <b>restent en place</b> et tu as <b>3 re-spins</b>. Chaque nouveau rubis reste et remet les re-spins à 3. Au-dessus de la grille, <b>3 rangées verrouillées</b> : chacune s’ouvre quand assez de rubis sont posés (${PP.unlock.join(', ')}) ou avec <b>REELS+</b>, jusqu’à 5 × 6 cases. Les boosters : <b>SPIN+</b> (+1 re-spin), <b>REELS+</b> (une rangée en plus), <b>MULTI+</b> (le multiplicateur du bonus monte, jusqu’à ×${PP.maxMult}), <b>VALUE+</b> (ajoute sa valeur à tous les rubis posés). Rubis spéciaux : ${jp('mini')}, ${jp('minor')}, ${jp('major')} la mise. Les 30 cases remplies : ${jp('grand')}. À la fin, tous les rubis sont additionnés, puis multipliés.</p>
      <h4>Les tours de la pyramide</h4><p>3 pyramides ou plus : <b>${E.FS_COUNT[3]}, ${E.FS_COUNT[4]} ou ${E.FS_COUNT[5]} tours gratuits</b>, tous les gains ×${PP.fsMul}, plus de couronnes WILD. 3 pyramides : +${E.FS_RETRIG} tours. 6 rubis lancent le RUBY LINK pendant les tours gratuits.</p>
      <h4>Le suspense</h4><p>Quand il ne manque qu’un rubis (ou qu’une pyramide), les derniers rouleaux ralentissent… à toi de retenir ton souffle.</p>
      <h4>Achats</h4><p>RUBY LINK ×${E.BUY.link} la mise (6 rubis) · RUBY LINK SUPER ×${E.BUY.super} (une rangée déjà ouverte, multiplicateur ×${PP.superMult}). Gain maximum ×${E.CAPX.toLocaleString('fr-FR')}.</p>`);
  }
}

return { RedkGame, ENGINE };
})();
