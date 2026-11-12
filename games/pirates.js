// SpinBet Casino · PiratesGame (Le Coffre aux Pirates) — loaded on demand by games/impl/index.js (index.html).
// ---- games/impl/pirates.js ----
__mods['games/impl/pirates.js'] = (() => {
// Le Coffre aux Pirates (owner's request, 12 November 2026: his specification « Apex Predators », then the theme changed
// to a pirates' treasure with his video and his symbol board). 5 reels × 4 rows, 20 lines, very high volatility,
// max ×50 000. The owner's video (assets/games/pirates/bg.mp4: a pirate ship at sea) plays behind the whole machine,
// and its sound replaces the music (VideoMusic). Base game: small frequent line wins, GOLD COINS carry a value
// (× the bet), the CRAB (collector, reel 5) collects every coin on the screen. 3 WHIRLPOOLS (scatter) = LA CHASSE AU
// TRÉSOR: a Hold & Win on a 5 × 6 grid (2 rows locked at the top), 3 lives put back to 3 by every new symbol; coins,
// BARRELS (multiply the coins next to them ×2 to ×50), the CRAB (collects all the coins), ANCHORS (open a locked row).
// The 30 cells filled = LE COFFRE AUX PIRATES S'OUVRE: the whole bonus ×500 (straight to the ×50 000 max).
// Pictures: the owner's board, cut into assets/games/pirates/<name>.webp and listed in PICS; emojis until then.

const { BaseGame, fmtC } = __mods['core/base.js'];
const { Reels } = __mods['core/reels.js'];
const { EXTRA_THEMES, Music, musicOn } = __mods['core/music.js'];
const { sfx, audioContext, isMuted, duck } = __mods['audio.js'];
const { fx, center } = __mods['fx.js'];

/* ===ENGINE */
// Symbols 0-3: heart, spade, club, diamond (low); 4 shark, 5 explorer, 6 pirate (high); 7 WILD coconut (reels 2-5);
// 8 WHIRLPOOL (scatter, one per reel at most); 9 GOLD COIN (carries a value × the bet); 10 CRAB (collector, reel 5 only
// in the base game). In the code: CASH = coin, COLL = crab, 'safe' = barrel, 'bomb' = anchor, 'heist' = the bonus.
// Bonus grid: 5 columns × 6 rows, cell = c * 6 + r (r = 0 at the top); rows 2-5 are the base grid, rows 0-1 locked.
const COLS = 5, ROWS = 4, N = 20, BR = 6, BN = 30, NS = 7, WILD = 7, SCAT = 8, CASH = 9, COLL = 10, CAPX = 50000;
const LINES = [
  [1, 1, 1, 1, 1], [2, 2, 2, 2, 2], [0, 0, 0, 0, 0], [3, 3, 3, 3, 3], [0, 1, 2, 1, 0],
  [3, 2, 1, 2, 3], [1, 2, 3, 2, 1], [2, 1, 0, 1, 2], [0, 0, 1, 0, 0], [3, 3, 2, 3, 3],
  [1, 0, 0, 0, 1], [2, 3, 3, 3, 2], [0, 1, 1, 1, 0], [3, 2, 2, 2, 3], [1, 1, 0, 1, 1],
  [2, 2, 3, 2, 2], [1, 1, 2, 1, 1], [2, 2, 1, 2, 2], [0, 1, 0, 1, 0], [3, 2, 3, 2, 3],
];
const HEIST_AT = 3, FULL_X = 500;
const BUY = { heist: 100 };
const P = {
  // reel weights of symbols 0-6, WILD weight (reels 2-5), chance of a chest on a reel, of a CASH on a cell, of the
  // collector on reel 5, stacks
  w: [34, 32, 30, 28, 14, 11, 8], wild: 10, scat: 0.076, cash: 0.065, coll: 0.06, stack: 0.28,
  // pays per line in × the line bet (bet / 20) for 3, 4 and 5 symbols, scaled by K
  pays: [[5, 12, 40], [5, 15, 50], [6, 18, 60], [8, 20, 75], [15, 50, 200], [20, 80, 400], [30, 150, 1000]],
  K: 1.09,
  // CASH values (× the bet) on the reels
  val: [[0.2, 34], [0.5, 30], [1, 18], [2, 9], [3, 4], [5, 2.6], [10, 1.2], [25, 0.3], [50, 0.1]],
  // LA CHASSE AU TRÉSOR: chance per open empty cell on each spin, and what lands there
  hp: 0.055,
  land: [['v', 74], ['safe', 10], ['coll', 12], ['bomb', 4]],
  hval: [[0.5, 21], [1, 27], [2, 20], [3, 12], [5, 9], [10, 6], [25, 2.3], [50, 0.95], [100, 0.32]],
  safe: [[2, 55], [5, 30], [10, 12], [50, 3]], // BARREL: × on the coins next to it (up, down, left, right)
};
function wp(R, l) { let t = 0; for (const x of l) t += x[1]; let q = R() * t; for (const x of l) { if (q < x[1]) return x[0]; q -= x[1]; } return l[l.length - 1][0]; }
function symbol(c, R) {
  const ws = c >= 1 ? P.wild : 0;
  let t = ws; for (const x of P.w) t += x;
  let q = R() * t;
  if (q < ws) return WILD; q -= ws;
  for (let i = 0; i < NS; i++) { if (q < P.w[i]) return i; q -= P.w[i]; }
  return 0;
}
// A screen of 20 cells (cell = c * 4 + r): at most one chest per reel, CASH with a value, the collector on reel 5.
function screen(R) {
  const g = [], vals = {};
  for (let c = 0; c < COLS; c++) {
    const sr = R() < P.scat ? Math.floor(R() * ROWS) : -1;
    const cr = c === COLS - 1 && R() < P.coll ? Math.floor(R() * ROWS) : -1;
    for (let r = 0; r < ROWS; r++) {
      const i = c * ROWS + r;
      if (r === sr) g[i] = SCAT;
      else if (r === cr) g[i] = COLL;
      else if (R() < P.cash) { g[i] = CASH; vals[i] = wp(R, P.val); }
      else if (r && g[i - 1] < NS + 1 && R() < P.stack) g[i] = g[i - 1];
      else g[i] = symbol(c, R);
    }
  }
  return { g, vals };
}
// 20 lines, left to right, 3+ symbols; the WILD replaces 0-6 (5 WILDs pay like 5 pirates).
function lines(g) {
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
    wins.push({ line: li, s, n, x: P.pays[s][n - 3] / 20 * P.K, cells: L.slice(0, n).map((r, c) => c * ROWS + r) });
  });
  return wins;
}
const count = (g, v) => g.filter((x) => x === v).length;
// One paid spin: the screen, the line wins, the collector (collects every CASH) and the chests.
function spin(R = Math.random) {
  const { g, vals } = screen(R), wins = lines(g);
  const sc = count(g, SCAT), cash = Object.keys(vals).map(Number), coll = g.indexOf(COLL);
  const collect = coll >= 0 && cash.length ? cash.reduce((a, i) => a + vals[i], 0) : 0;
  const lx = wins.reduce((a, w) => a + w.x, 0);
  return { g, vals, wins, lx, coll, collect, x: lx + collect, scat: sc, heist: sc >= HEIST_AT, cash };
}
// base cell (c, r) → heist cell (c, r + 2), and back
const toBig = (i) => Math.floor(i / ROWS) * BR + (i % ROWS) + 2;
const toBase = (b) => Math.floor(b / BR) * ROWS + (b % BR) - 2;
const near = (i) => { const c = Math.floor(i / BR), r = i % BR, o = []; if (r > 0) o.push(i - 1); if (r < BR - 1) o.push(i + 1); if (c > 0) o.push(i - BR); if (c < COLS - 1) o.push(i + BR); return o; };
// THE SYNDICATE HEIST from the starting CASH { bigCell: value }. A cell: { t: 'v' | 'coll' | 'safe' | 'bomb', v, m? }.
// The cash-like cells (v, bomb) are the « CASH » the safes multiply and the collectors collect.
// Each spin: { add: [{ i, t, v, m?, hit?: [cells], got?, row? }], lives, rows, snap }; in each spin the CASH land
// first, then the bombs, then the safes multiply, then the collectors collect.
function heistRun(start, R = Math.random) {
  const cur = {}; for (const k in start) cur[k] = { t: 'v', v: start[k] };
  const steps = [];
  let lives = 3, rows = 4, guard = 0;
  const open = (i) => (i % BR) >= BR - rows;
  const isCash = (x) => x && (x.t === 'v' || x.t === 'bomb');
  while (lives > 0 && guard++ < 500) {
    if (Object.keys(cur).length >= BN) break;
    const add = [];
    for (let c = 0; c < COLS; c++) for (let r = 0; r < BR; r++) {
      const i = c * BR + r;
      if (!open(i) || i in cur || R() >= P.hp) continue;
      add.push({ i, t: wp(R, P.land) });
    }
    const order = { v: 0, bomb: 1, safe: 2, coll: 3 };
    add.sort((a, b) => order[a.t] - order[b.t] || a.i - b.i);
    for (const a of add) {
      if (a.t === 'v') { a.v = wp(R, P.hval); cur[a.i] = { t: 'v', v: a.v }; }
      else if (a.t === 'bomb') { a.v = wp(R, P.hval); cur[a.i] = { t: 'bomb', v: a.v }; if (rows < BR) { rows++; a.row = rows; } }
      else if (a.t === 'safe') {
        a.m = wp(R, P.safe); a.v = 0; a.hit = near(a.i).filter((j) => isCash(cur[j]));
        a.hit.forEach((j) => { cur[j] = { ...cur[j], v: cur[j].v * a.m }; });
        cur[a.i] = { t: 'safe', v: 0, m: a.m };
      } else {
        let s = 0; for (const j in cur) if (isCash(cur[j])) s += cur[j].v;
        a.v = a.got = s; cur[a.i] = { t: 'coll', v: s };
      }
    }
    lives = add.length ? 3 : lives - 1;
    const snap = {}; for (const j in cur) snap[j] = { ...cur[j] };
    steps.push({ add, lives, rows, snap });
  }
  const full = Object.keys(cur).length >= BN;
  let sum = 0; for (const j in cur) sum += cur[j].v;
  return { start: { ...start }, steps, cur, rows, sum, full, total: full ? sum * FULL_X : sum };
}
// starting CASH of a won heist: the chests and the CASH on the screen (5 at least); of a bought one: 5 CASH
function startOf(res, R = Math.random) {
  const o = {};
  res.g.forEach((v, i) => { if (v === SCAT) o[toBig(i)] = wp(R, P.hval); });
  res.cash.forEach((i) => { o[toBig(i)] = res.vals[i]; });
  // at least 5 to start, like a bought one
  const free = [...Array(N).keys()].map(toBig).filter((b) => !(b in o));
  while (Object.keys(o).length < 5 && free.length) { const b = free.splice(Math.floor(R() * free.length), 1)[0]; o[b] = wp(R, P.hval); }
  return o;
}
function startBuy(R = Math.random) {
  const cells = [...Array(N).keys()];
  for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; }
  const o = {}; cells.slice(0, 5).forEach((i) => { o[toBig(i)] = wp(R, P.hval); });
  return o;
}
// A whole paid round (for the simulator): × the bet, capped.
function round(R = Math.random) {
  const s = spin(R);
  let t = s.x, heist = 0, full = false;
  if (s.heist) { const h = heistRun(startOf(s, R), R); heist = h.total; full = h.full; t += heist; }
  return { total: Math.min(CAPX, t), line: s.lx, collect: s.collect, heist, hasHeist: s.heist, full };
}
const buyRun = (R = Math.random) => { const h = heistRun(startBuy(R), R); return { total: Math.min(CAPX, h.total), full: h.full }; };
const ENGINE = { COLS, ROWS, N, BR, BN, NS, WILD, SCAT, CASH, COLL, CAPX, LINES, HEIST_AT, FULL_X, BUY, P, wp, symbol, screen, lines, spin, toBig, toBase, near, heistRun, startOf, startBuy, round, buyRun };
/* ===END ENGINE */

const E = ENGINE;
const { P: PP } = E;
/* ---------- the pictures: the owner's images once they are in assets/games/pirates/ (listed in PICS), emojis until then ---------- */
const PICS = new Set(['s0', 's1', 's2', 's3', 's4', 's5', 's6', 'wild', 'scat', 'cash', 'coll', 'safe', 'bomb']); // the owner's board, cut by tools/art/pirates/cut.py
const IMG_V = 1;
const asset = (p) => window.__assets?.[p] || `${p}?v=${IMG_V}`;
const ART = {
  s0: ['❤️', ''], s1: ['♠️', ''], s2: ['☘️', ''], s3: ['💎', ''],
  s4: ['🦈', 'REQUIN'], s5: ['🧭', 'EXPLORATRICE'], s6: ['🏴‍☠️', 'PIRATE'],
  wild: ['🥥', 'WILD'], scat: ['🌀', 'SCATTER'], cash: ['🪙', ''], coll: ['🦀', 'COLLECT'], safe: ['🛢️', ''], bomb: ['⚓', 'EXPAND'],
};
const pic = (n, cls = '') => (PICS.has(n)
  ? `<img class="ap-img ${cls}" src="${asset(`assets/games/pirates/${n}.webp`)}" alt="" draggable="false" decoding="async">`
  : `<span class="ap-emo ${cls}"><i>${ART[n][0]}</i>${ART[n][1] ? `<small>${ART[n][1]}</small>` : ''}</span>`);
const NAMES = ['Cœur', 'Pique', 'Trèfle', 'Carreau', 'Le Requin', 'L’Exploratrice', 'Le Pirate'];
const KEY = (v) => (v < E.NS ? `s${v}` : v === E.WILD ? 'wild' : v === E.SCAT ? 'scat' : v === E.CASH ? 'cash' : 'coll');
const NEON = ['#f0abfc', '#d946ef', '#22d3ee', '#a3e635', '#fff'];
const GOLD = ['#fde047', '#facc15', '#fff7d6', '#f59e0b'];
const KE = '<i class="ap-ke"></i>';
const kfmt = (c) => {
  const x = c / 100, d = (v) => (Math.round(v * 10) / 10).toLocaleString('fr-FR');
  if (x >= 1e6) return `${d(x / 1e6)}M`;
  if (x >= 1e4) return `${d(x / 1e3)}K`;
  return x.toLocaleString('fr-FR', { maximumFractionDigits: x < 10 ? 2 : 0 }); // 0,2 at a 1 KE bet
};
const vibe = (p) => { try { if (localStorage.getItem('spinbet_vibe') !== '0' && navigator.vibrate && !document.hidden) navigator.vibrate(p); } catch { /* ignore */ } };

/* ---------- sounds of the heist: heartbeat of the suspense, police siren of the bonus ---------- */
class Tension {
  start() {
    if (this.on || isMuted()) return;
    const ctx = audioContext(); if (!ctx) return;
    this.on = true; this.ctx = ctx; this.k = 0;
    const out = ctx.createGain(); out.gain.value = 0.9; out.connect(ctx.destination); this.out = out;
    const beat = () => {
      if (!this.on) return;
      const t = ctx.currentTime + 0.02;
      this.thump(t, 0.9); this.thump(t + 0.19, 0.55); this.hat(t + 0.38);
      vibe([40, 140, 30]);
      this.k++;
      this.timer = setTimeout(beat, Math.max(380, 820 - this.k * 80));
    };
    beat();
  }
  thump(t, v) {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(34, t + 0.16);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g); g.connect(this.out); o.start(t); o.stop(t + 0.32);
  }
  hat(t) {
    const ctx = this.ctx, b = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = 'highpass'; f.frequency.value = 6000; g.gain.value = 0.18;
    s.buffer = b; s.connect(f); f.connect(g); g.connect(this.out); s.start(t);
  }
  stop() { if (!this.on) return; this.on = false; clearTimeout(this.timer); const o = this.out; setTimeout(() => o.disconnect(), 400); }
}

/* ---------- pirate sounds, soft (owner's wish: « des bruits de pirates, pas trop fort ») ---------- */
const Sounds = {
  ctx() { if (isMuted()) return null; const c = audioContext(); if (!c) return null; if (!this.out) { this.out = c.createGain(); this.out.gain.value = 0.55; this.out.connect(c.destination); } return c; },
  noise(c, dur) { const b = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; const s = c.createBufferSource(); s.buffer = b; return s; },
  env(c, g, t, a, v, d) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + d); },
  tone(f1, f2, dur, v, type = 'sine', at = 0) {
    const c = this.ctx(); if (!c) return; const t = c.currentTime + at, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f1, t); if (f2 !== f1) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    this.env(c, g, t, 0.008, v, dur); o.connect(g); g.connect(this.out); o.start(t); o.stop(t + dur + 0.05);
  },
  hiss(dur, v, type, f, q = 1, at = 0, f2) {
    const c = this.ctx(); if (!c) return; const t = c.currentTime + at, s = this.noise(c, dur), fl = c.createBiquadFilter(), g = c.createGain();
    fl.type = type; fl.frequency.setValueAtTime(f, t); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur); fl.Q.value = q;
    this.env(c, g, t, 0.01, v, dur); s.connect(fl); fl.connect(g); g.connect(this.out); s.start(t); s.stop(t + dur);
  },
  // a gold coin: two bright pings (three for a big one)
  coin(big) { this.tone(2637, 2637, 0.12, 0.06); this.tone(3520, 3520, 0.18, 0.05, 'sine', 0.06); if (big) this.tone(4186, 4186, 0.3, 0.05, 'sine', 0.13); },
  // the crab: claws clicking
  crab() { for (let k = 0; k < 5; k++) this.hiss(0.03, 0.18, 'bandpass', 2600, 6, k * 0.07); },
  // a wooden barrel: two hollow knocks
  barrel() { this.tone(190, 95, 0.18, 0.22); this.hiss(0.06, 0.12, 'lowpass', 900, 1); this.tone(160, 80, 0.2, 0.2, 'sine', 0.16); },
  // the anchor's chain
  chain() { for (let k = 0; k < 8; k++) this.hiss(0.04, 0.09, 'bandpass', 4200 + (k % 3) * 600, 8, k * 0.045); },
  // a cannon far away
  cannon() { this.hiss(1.1, 0.35, 'lowpass', 380, 0.7, 0, 90); this.tone(70, 32, 0.6, 0.3); },
  // the whirlpool lands: a whoosh of water
  whirl() { this.hiss(0.6, 0.12, 'bandpass', 300, 1.5, 0, 1800); },
  // the ship's bell
  bell() { this.tone(880, 880, 1.4, 0.07); this.tone(2350, 2350, 0.9, 0.025); },
  // the conch horn of the bonus: « à l'abordage ! »
  horn() {
    const c = this.ctx(); if (!c) return; const t = c.currentTime, lp = c.createBiquadFilter(), g = c.createGain();
    lp.type = 'lowpass'; lp.frequency.value = 700; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.35); g.gain.setValueAtTime(0.12, t + 1.1); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.7);
    lp.connect(g); g.connect(this.out);
    [110, 165, 220.5].forEach((f) => { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f * 0.94, t); o.frequency.linearRampToValueAtTime(f, t + 0.3); o.connect(lp); o.start(t); o.stop(t + 1.75); });
  },
};

/* ---------- the owner's video behind the machine; its sound is the music of the game (🎵 and 🔊 of the menu) ---------- */
class VideoMusic {
  constructor(video) { this.v = video; this.playing = false; }
  sync() { const on = this.playing && musicOn() && !isMuted(); this.v.muted = !on; if (on) this.v.volume = 0.5; }
  start() { if (!musicOn()) return; this.playing = true; this.sync(); this.v.play().catch(() => {}); }
  stop() { this.playing = false; this.sync(); }
  setEnabled(on) { Music.prototype.setEnabled.call({ start() {}, stop() {} }, on); if (on) this.start(); else this.stop(); }
}

class PiratesGame extends BaseGame {
  constructor(root, game) {
    super(root, game, {
      music: EXTRA_THEMES.pirates, cls: 'ap-slot',
      stage: `<div class="ap-stage">
        <div class="ap-logo" aria-label="Le Coffre aux Pirates"><small>LE COFFRE AUX</small><b>PIRATES</b></div>
        <div class="ap-board"><div class="ap-shake">
          <div class="ap-reels"></div>
          <div class="ap-heist" hidden></div>
        </div></div>
        <div class="ap-word"></div>
      </div>`,
      buys: [
        { id: 'heist', icon: '🌀', label: 'LA CHASSE AU TRÉSOR', desc: '5 pièces d’or pour commencer, 3 vies remises à 3 à chaque nouveau symbole, le Tonneau, le Crabe et l’Ancre', cost: (b) => b * E.BUY.heist },
      ],
      hello: `${E.HEIST_AT} tourbillons = LA CHASSE AU TRÉSOR · le Crabe ramasse toutes les pièces`,
    });
    this.tension = new Tension();
    const bg = this.q('.slot-bg');
    bg.innerHTML = `<video class="ap-video" src="${asset('assets/games/pirates/bg.mp4')}" poster="${asset('assets/games/pirates/bg.webp')}" muted autoplay loop playsinline preload="auto" disablepictureinpicture aria-hidden="true"></video><div class="ap-shade"></div>`;
    this.video = bg.querySelector('video');
    this.video.muted = true;
    this.music.stop();
    this.music = new VideoMusic(this.video);
    const play = () => { if (!this.dead && !matchMedia('(prefers-reduced-motion: reduce)').matches) this.video.play().catch(() => {}); };
    play();
    this.root.addEventListener('pointerdown', play, { once: true }); // a phone in power-saving mode waits for a touch
    this.syncT = setInterval(() => this.music.sync(), 700); // the 🔊 button of the menu mutes the sea too
    this.vals = {};
    this.reels = new Reels(this.q('.ap-reels'), {
      cols: E.COLS, rows: E.ROWS, game: this, random: (c) => this.filler(c),
      art: (v, i) => this.cellArt(v, i),
      cls: (v) => (v === E.CASH ? 'cash' : v === E.COLL ? 'coll' : v === E.SCAT ? 'scat' : v === E.WILD ? 'wild' : v >= 4 ? 'hi' : 'lo'),
    });
    this.reels.el.classList.add('ap-rs');
    this.reels.setAll(this.idle());
    this.onVis = () => { if (document.hidden) { this.tension.stop(); this.video.pause(); } else play(); };
    document.addEventListener('visibilitychange', this.onVis);
  }

  destroy() { document.removeEventListener('visibilitychange', this.onVis); clearInterval(this.syncT); this.tension.stop(); this.video.pause(); this.video.muted = true; super.destroy(); }

  idle() { const { g, vals } = E.screen(Math.random); for (let i = 0; i < E.N; i++) if (g[i] === E.SCAT || g[i] === E.COLL) g[i] = E.symbol(Math.floor(i / E.ROWS), Math.random); this.vals = vals; return g; }
  filler(c) {
    const r = Math.random();
    if (r < 0.07) return E.CASH;
    if (r < 0.1) return E.SCAT;
    if (c === E.COLS - 1 && r < 0.13) return E.COLL;
    return E.symbol(c, Math.random);
  }
  cashHTML(v, kind = 'cash') {
    const big = v >= 10;
    return `${pic(kind, `ap-cs${big ? ' big' : ''}`)}<b class="ap-v${big ? ' big' : ''}">${kfmt(v * this.bet)}${KE}</b>`;
  }
  cellArt(v, i) {
    if (v === E.CASH) return this.cashHTML(i >= 0 && this.vals[i] !== undefined ? this.vals[i] : E.wp(Math.random, PP.val));
    return pic(KEY(v));
  }

  word(t, cls = '') {
    const w = this.q('.ap-word');
    w.innerHTML = t; w.className = `ap-word ${cls}`;
    w.getAnimations().forEach((a) => a.cancel());
    w.animate([{ opacity: 0, transform: 'translate(-50%,-50%) scale(.3) skewX(-12deg)' }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1.12) skewX(-6deg)', offset: 0.22 },
      { opacity: 1, transform: 'translate(-50%,-50%) scale(1) skewX(-6deg)', offset: 0.72 }, { opacity: 0, transform: 'translate(-50%,-64%) scale(1.15) skewX(-6deg)' }], { duration: this.turbo ? 900 : 1500, easing: 'ease-out' });
  }

  /* ---------- the suspense: two whirlpools are there, the last reels slow down ---------- */
  tense(node) {
    if (!node) {
      if (!this.tensing) return;
      this.tensing = false; this.tension.stop();
      this.slotEl.classList.remove('ap-tense');
      this.qa('.ap-focus').forEach((n) => n.classList.remove('ap-focus'));
      if (this.musicWas) { this.musicWas = false; this.music.start(); }
      return;
    }
    if (!this.tensing) {
      this.tensing = true;
      if (this.music.playing) { this.musicWas = true; this.music.stop(); }
      this.tension.start();
      this.slotEl.classList.add('ap-tense');
    }
    this.qa('.ap-focus').forEach((n) => n.classList.remove('ap-focus'));
    node.classList.add('ap-focus');
  }
  async spinReels(res) {
    const tease = new Set();
    await this.reels.spin(res.g, {
      tease: (c, vals) => {
        let s = 0; for (let j = 0; j < c * E.ROWS; j++) if (vals[j] === E.SCAT) s++;
        const t = s === E.HEIST_AT - 1 && !this.superT;
        if (t) tease.add(c);
        return t;
      },
      onStop: (c) => {
        for (let r = 0; r < E.ROWS; r++) {
          const i = c * E.ROWS + r, v = res.g[i];
          if (v === E.SCAT || v === E.CASH || v === E.COLL) {
            if (v === E.SCAT) Sounds.whirl(); else if (v === E.CASH) Sounds.coin(); else Sounds.crab();
            const n = this.reels.cell(i), p = center(n);
            fx.burst(p.x, p.y, 12, v === E.CASH ? GOLD : NEON, 5);
            n?.classList.add('ap-in');
          }
        }
        if (this.dead) return;
        if (tease.has(c + 1)) { this.tense(this.reels.reelEls[c + 1]); this.msg('🌀🌀 Plus qu’un tourbillon pour la chasse au trésor…'); }
        else if (tease.has(c)) { this.tense(null); if (res.heist) { this.flash('rgba(56,189,248,.55)'); this.shake(); Sounds.bell(); vibe([90, 50, 160]); } }
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
    if (buy) {
      const start = E.startBuy();
      await this.buyReveal(start);
      if (this.dead) return;
      total = await this.heist(start, b, cap);
    } else {
      const res = E.spin(Math.random);
      this.vals = res.vals;
      await this.spinReels(res);
      if (this.dead) return;
      const lineC = Math.min(Math.round(res.lx * b), cap);
      if (res.wins.length) {
        this.reels.mark([...new Set(res.wins.flatMap((w) => w.cells))]);
        this.msg(this.winMsg(res.wins, b));
        this.win(lineC); total = lineC; this.setLast(total); this.winAmt.textContent = fmtC(total);
      } else this.msg(res.scat === E.HEIST_AT - 1 ? `${res.scat} tourbillons… il en fallait ${E.HEIST_AT} !` : res.coll >= 0 && !res.cash.length ? 'Le Crabe est là… mais pas de pièce à ramasser' : res.cash.length ? `${res.cash.length} pièce${res.cash.length > 1 ? 's' : ''} d’or · le Crabe (rouleau 5) les ramasse` : 'Pas de gain');
      if (res.collect > 0 && total < cap) {
        if (res.wins.length) await this.wait(700);
        const c = Math.min(Math.round(res.collect * b), cap - total);
        await this.collectBase(res, c, total);
        total += c;
      }
      if (res.heist) {
        this.stopAuto();
        if (total > 0) { sfx.win(); await this.wait(800); }
        this.reels.unmark();
        this.reels.mark(res.g.map((v, i) => (v === E.SCAT ? i : -1)).filter((i) => i >= 0), 'win');
        this.word(`${res.scat} TOURBILLONS !`, 'neon'); await this.wait(1300);
        this.reels.unmark();
        if (total < cap) total += await this.heist(E.startOf(res), b, cap - total);
      } else if (total > 0) await this.celebrate(total);
      this.reels.unmark();
    }
    this.setLast(total);
    if (total >= cap) this.msg(`GAIN MAXIMUM ! ${fmtC(total)}`);
    else if (total > 0 && (buy || this.bonusDone)) this.msg(`Total du tour : ${fmtC(total)}`);
    this.bonusDone = false;
  }

  // the Crab of reel 5 collects every gold coin of the screen
  async collectBase(res, c, before = 0) {
    const to = this.reels.cell(res.coll), pt = center(to);
    to?.classList.add('ap-boss');
    this.word('LE CRABE RAMASSE', 'boss'); Sounds.crab();
    for (const i of res.cash) {
      if (this.dead) return;
      const n = this.reels.cell(i); n?.classList.add('win');
      fx.trail?.(center(n), pt, '#facc15', 12);
      Sounds.coin(); await this.wait(this.turbo ? 80 : 200);
    }
    this.flash('rgba(250,204,21,.4)'); fx.burst(pt.x, pt.y, 30, GOLD, 8); vibe([40, 30, 70]);
    this.floatAt(to, `+${fmtC(c)}`, '#fde047', 24);
    this.win(c);
    this.winAmt.textContent = fmtC(before + c); this.setLast(before + c);
    this.msg(`🦀 Le Crabe ramasse ${res.cash.length} pièce${res.cash.length > 1 ? 's' : ''} : +${fmtC(c)}`);
    await this.wait(this.turbo ? 400 : 900);
    to?.classList.remove('ap-boss');
  }

  // a bought bonus: the reels turn and land 3 whirlpools, then the bonus starts with 5 coins
  async buyReveal() {
    const { g } = E.screen(Math.random);
    for (let i = 0; i < E.N; i++) if (g[i] === E.SCAT || g[i] === E.CASH || g[i] === E.COLL) g[i] = E.symbol(Math.floor(i / E.ROWS), Math.random);
    const cols = [0, 1, 2, 3, 4].sort(() => Math.random() - 0.5).slice(0, 3);
    cols.forEach((c) => { g[c * E.ROWS + Math.floor(Math.random() * E.ROWS)] = E.SCAT; });
    this.vals = {};
    this.msg('Les rouleaux tournent…');
    await this.spinReels({ g, heist: true });
    if (this.dead) return;
    this.reels.mark(g.map((v, i) => (v === E.SCAT ? i : -1)).filter((i) => i >= 0), 'win');
    this.word('3 TOURBILLONS !', 'neon');
    await this.wait(1200);
    this.reels.unmark();
  }

  winMsg(wins, b) {
    const top = wins.slice().sort((p, q) => q.x - p.x);
    const t = top.slice(0, 2).map((w) => `${w.n} × ${NAMES[w.s]} : +${fmtC(Math.round(w.x * b))}`).join(' · ');
    return top.length > 2 ? `${t} · +${top.length - 2} ligne${top.length > 3 ? 's' : ''}` : t;
  }

  /* ---------- LA CHASSE AU TRÉSOR ---------- */
  async heistIntro() {
    const title = 'LA CHASSE AU TRÉSOR';
    dispatchEvent(new CustomEvent('sb:feature', { detail: { game: this.game.id, title, bought: !!this.buyRound, re: false } }));
    duck(0.15, this.turbo ? 2 : 4);
    Sounds.horn();
    vibe([60, 50, 60, 50, 150]);
    fx.confetti(70);
    const ov = this.overlay(`<div class="ap-ibeam"></div><div class="ap-ititle"><small>À L’ABORDAGE !</small><b>${title}</b>
      <p>3 vies, remises à 3 à chaque nouveau symbole · 🛢️ Tonneau ×2 à ×50 · 🦀 le Crabe ramasse toutes les pièces · ⚓ Ancre : une rangée en plus · les 30 cases : LE COFFRE AUX PIRATES S’OUVRE ×${E.FULL_X}</p></div><small>Touchez pour continuer</small>`, 'ap-intro');
    await new Promise((resolve) => {
      let over = false;
      const done = () => { if (over) return; over = true; clearTimeout(t); ov.classList.add('out'); setTimeout(() => { ov.remove(); resolve(); }, 300); };
      const t = setTimeout(done, this.superT ? 900 : this.turbo ? 2200 : 3800);
      ov.addEventListener('click', done);
    });
  }
  cellH(i) { return this.heistEl.children[i]; }
  buildHeist() {
    const L = this.q('.ap-heist');
    this.heistEl = L;
    let h = '';
    for (let i = 0; i < E.BN; i++) { const c = Math.floor(i / E.BR), r = i % E.BR; h += `<div class="ap-hc" style="grid-column:${c + 1};grid-row:${r + 1}"><i class="ap-slotc"></i></div>`; }
    L.innerHTML = h;
    this.lockEls = [0, 1].map((r) => { const n = document.createElement('div'); n.className = 'ap-lock'; n.style.gridRow = `${r + 1}`; n.innerHTML = '<i>🔒</i><span><b>RANGÉE VERROUILLÉE</b><em>⚓ une Ancre l’ouvre</em></span>'; L.appendChild(n); return n; });
    this.rows = 4;
  }
  open(i) { return (i % E.BR) >= E.BR - this.rows; }
  setCell(i, x) {
    const n = this.cellH(i); if (!n) return;
    n.className = `ap-hc on t-${x.t}${x.v >= 10 ? ' big' : ''}`;
    if (x.t === 'safe') n.innerHTML = `${pic('safe')}<b class="ap-m">×${x.m}</b>`;
    else if (x.t === 'coll') n.innerHTML = `${pic('coll')}<b class="ap-v big">${kfmt(x.v * this.bet)}${KE}</b>`;
    else n.innerHTML = this.cashHTML(x.v, x.t === 'bomb' ? 'bomb' : 'cash');
  }
  dropIn(i) { this.cellH(i)?.animate([{ transform: 'translateY(-80%) scale(.6)', filter: 'blur(4px) brightness(2)', opacity: 0 }, { transform: 'translateY(6%) scale(1.06)', filter: 'none', opacity: 1, offset: 0.7 }, { transform: 'none' }], { duration: 360, easing: 'ease-out' }); }
  pop(i) { this.cellH(i)?.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.22)', filter: 'brightness(1.7)' }, { transform: 'scale(1)' }], { duration: 400, easing: 'ease-out' }); }

  async heist(start, b, capLeft) {
    await this.heistIntro();
    if (this.dead) return 0;
    const run = E.heistRun(start, Math.random);
    this.slotEl.classList.add('ap-heisting');
    this.buildHeist();
    this.cur = {};
    for (const k in run.start) { this.cur[k] = { t: 'v', v: run.start[k] }; this.setCell(+k, this.cur[k]); }
    this.q('.ap-heist').hidden = false;
    this.focusStage?.();
    const sumNow = () => { let t = 0; for (const j in this.cur) t += this.cur[j].v; return t; };
    const banner = (lives) => this.setBanner(`<b>CHASSE AU TRÉSOR</b><span class="pill ap-lives">Vies <i class="ap-dots">${[0, 1, 2].map((k) => `<i class="${k < lives ? 'on' : ''}"></i>`).join('')}</i></span><span class="pill">${Object.keys(this.cur).length} / ${E.COLS * this.rows}</span><span class="pill gold">${fmtC(Math.round(Math.min(sumNow() * b, capLeft)))}</span>`);
    banner(3);
    this.msg('Les pièces restent en place : 3 vies');
    await this.wait(800);
    for (const st of run.steps) {
      if (this.dead) return 0;
      const empty = []; for (let i = 0; i < E.BN; i++) if (this.open(i) && !(i in this.cur)) empty.push(i);
      const last = this.rows === E.BR && empty.length === 1;
      await this.respin(st, b, empty, last);
      banner(st.lives);
      if (st.add.length) this.banner?.querySelector('.ap-lives')?.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.35)', boxShadow: '0 0 18px #d946ef' }, { transform: 'scale(1)' }], { duration: 600, easing: 'ease-out' });
      const nb = `${Object.keys(this.cur).length} / ${E.COLS * this.rows}`;
      this.msg(st.add.length ? `${nb} · ${st.add.length} nouveau${st.add.length > 1 ? 'x' : ''} : 3 vies !` : st.lives ? `${nb} · encore ${st.lives} vie${st.lives > 1 ? 's' : ''}` : `${nb} · plus de vies`);
      await this.wait(this.turbo ? 200 : 420);
    }
    // the count, cell by cell, then the full screen
    let tot = 0;
    for (let i = 0; i < E.BN; i++) {
      if (!(i in this.cur)) continue;
      tot += this.cur[i].v * b;
      this.cellH(i)?.classList.add('counted');
      this.winAmt.textContent = fmtC(Math.round(Math.min(tot, capLeft)));
      sfx.tick(); await this.wait(this.turbo ? 30 : 70);
    }
    if (run.full) {
      this.word('FULL SCREEN !', 'neon big'); this.flash('rgba(255,255,255,.9)'); sfx.jackpot(); vibe([200, 80, 200]);
      await this.wait(1500);
      this.slotEl.classList.add('ap-boom');
      this.word(`LE COFFRE AUX PIRATES S’OUVRE<br><small>×${E.FULL_X}</small>`, 'gold big'); this.shake(); fx.confetti(200); sfx.bigWin(); vibe([300, 80, 300, 80, 500]);
      Sounds.cannon(); Sounds.horn();
      await this.wait(2200);
      tot *= E.FULL_X;
      this.winAmt.textContent = fmtC(Math.round(Math.min(tot, capLeft)));
      await this.wait(900);
      this.slotEl.classList.remove('ap-boom');
    }
    const won = Math.min(Math.round(tot), capLeft);
    if (won > 0) { this.win(won, 'La Chasse au trésor'); this.setLast(won); }
    await this.celebrate(won, { summary: 'LA CHASSE AU TRÉSOR', stake: b });
    this.setBanner('');
    this.slotEl.classList.remove('ap-heisting');
    this.q('.ap-heist').hidden = true;
    this.msg(`La Chasse au trésor : ${fmtC(won)}${run.full ? ' · FULL SCREEN !' : ''}`);
    this.bonusDone = true;
    this.cur = {};
    this.reels.setAll(this.idle());
    return won;
  }

  async unlockRow(rows) {
    while (this.rows < rows && !this.dead) {
      this.rows++;
      const n = this.lockEls[E.BR - this.rows];
      this.word('ANCRE · RANGÉE OUVERTE', 'boom'); Sounds.cannon(); sfx.upgrade(); this.shake(); this.flash('rgba(249,115,22,.5)'); vibe([40, 40, 80]);
      const p = center(n); fx.burst(p.x, p.y, 40, ['#fed7aa', '#f97316', '#fde047'], 9);
      n.classList.add('gone');
      await this.wait(this.turbo ? 300 : 700);
    }
  }

  // One spin of the bonus: the open empty cells turn and stop column after column; then, in order, the coins land, the
  // anchors open a row, the barrels multiply their neighbours, the crab collects
  async respin(st, b, empties, last) {
    empties.forEach((i) => this.cellH(i)?.classList.add('rolling'));
    sfx.spin?.();
    const slow = last && !this.superT;
    if (slow) { this.tense(this.cellH(empties[0])); this.msg('💥 UNE SEULE CASE POUR LE FULL SCREEN…'); }
    await this.wait(slow ? 2800 : this.turbo ? 380 : 700);
    const addAt = new Set(st.add.map((a) => a.i));
    for (let c = 0; c < E.COLS; c++) {
      if (this.dead) return;
      empties.filter((i) => Math.floor(i / E.BR) === c).forEach((i) => { const n = this.cellH(i); if (!n) return; n.classList.remove('rolling'); if (!addAt.has(i)) n.animate([{ transform: 'translateY(-5%)' }, { transform: 'translateY(3%)' }, { transform: 'none' }], { duration: 200, easing: 'ease-out' }); });
      sfx.tick?.(); await this.wait(slow ? 240 : this.turbo ? 40 : 90);
    }
    if (slow) this.tense(null);
    for (const a of st.add) {
      if (this.dead) return;
      const n0 = this.cellH(a.i), p = center(n0);
      if (a.t === 'v') {
        this.cur[a.i] = { t: 'v', v: a.v }; this.setCell(a.i, this.cur[a.i]); this.dropIn(a.i);
        Sounds.coin(a.v >= 10); fx.burst(p.x, p.y, a.v >= 10 ? 22 : 12, GOLD, a.v >= 10 ? 7 : 5);
        await this.wait(this.turbo ? 70 : 150);
      } else if (a.t === 'bomb') {
        this.cur[a.i] = { t: 'bomb', v: a.v }; this.setCell(a.i, this.cur[a.i]); this.dropIn(a.i);
        await this.wait(this.turbo ? 150 : 350);
        Sounds.chain(); if (a.row) await this.unlockRow(a.row); else { this.word('ANCRE', 'boom'); await this.wait(this.turbo ? 250 : 500); }
      } else if (a.t === 'safe') {
        this.cur[a.i] = { t: 'safe', v: 0, m: a.m }; this.setCell(a.i, this.cur[a.i]); this.dropIn(a.i);
        Sounds.barrel(); vibe([30, 40, 60]);
        await this.wait(this.turbo ? 200 : 450);
        this.word(`TONNEAU ×${a.m}`, a.m >= 10 ? 'gold' : 'neon');
        if (a.hit.length) {
          for (const j of a.hit) { fx.trail?.(p, center(this.cellH(j)), '#22d3ee', 10); this.cur[j] = { ...this.cur[j], v: this.cur[j].v * a.m }; this.setCell(j, this.cur[j]); this.pop(j); }
          this.flash('rgba(34,211,238,.35)'); sfx.upgrade();
        } else this.msg('Le Tonneau n’a pas de pièce à côté de lui…');
        await this.wait(this.turbo ? 350 : 800);
      } else {
        // the crab: every coin flies to it
        this.cur[a.i] = { t: 'coll', v: 0 }; this.setCell(a.i, this.cur[a.i]); this.dropIn(a.i);
        this.word('LE CRABE RAMASSE', 'boss'); Sounds.crab(); vibe([60, 40, 90]);
        await this.wait(this.turbo ? 250 : 600);
        for (const j in this.cur) { const x = this.cur[j]; if (x.t === 'v' || x.t === 'bomb') { fx.trail?.(center(this.cellH(+j)), p, '#facc15', 10); this.pop(+j); } }
        await this.wait(this.turbo ? 200 : 450);
        this.cur[a.i] = { t: 'coll', v: a.got }; this.setCell(a.i, this.cur[a.i]); this.pop(a.i);
        fx.burst(p.x, p.y, 34, GOLD, 9); this.flash('rgba(250,204,21,.4)'); sfx.bigWin?.();
        await this.wait(this.turbo ? 350 : 800);
      }
    }
  }

  info() {
    const f = (x) => (Math.round(x / 20 * PP.K * 100) / 100).toLocaleString('fr-FR');
    const rows = [6, 5, 4, 3, 2, 1, 0].map((s) => `<div class="pay-item"><div class="pay-sym ap-pay">${pic(`s${s}`)}</div><div class="pay-vals"><b>${NAMES[s]}</b><br><span>3 : ×${f(PP.pays[s][0])} · 4 : ×${f(PP.pays[s][1])} · 5 : ×${f(PP.pays[s][2])}</span></div></div>`).join('');
    return this.rules(`<h4>Symboles (× la mise, par ligne)</h4><div class="paytable">${rows}
      <div class="pay-item"><div class="pay-sym ap-pay">${pic('wild')}</div><div class="pay-vals"><b>Noix de coco WILD</b><br><span>Rouleaux 2 à 5, remplace tous les symboles sauf le tourbillon, la pièce d’or et le crabe</span></div></div>
      <div class="pay-item"><div class="pay-sym ap-pay">${pic('scat')}</div><div class="pay-vals"><b>Tourbillon</b><br><span>${E.HEIST_AT} tourbillons ou plus : LA CHASSE AU TRÉSOR</span></div></div>
      <div class="pay-item"><div class="pay-sym ap-pay">${pic('cash')}</div><div class="pay-vals"><b>Pièce d’or</b><br><span>Porte sa valeur en KE (0,2 à 50 fois la mise)</span></div></div>
      <div class="pay-item"><div class="pay-sym ap-pay">${pic('coll')}</div><div class="pay-vals"><b>Le Crabe</b><br><span>Rouleau 5 : ramasse toutes les pièces d’or de l’écran</span></div></div></div>
      <h4>20 lignes</h4><p>5 rouleaux de 4 cases et 20 lignes fixes. Une ligne paie dès que 3 symboles identiques ou plus se suivent depuis la gauche.</p>
      <h4>LA CHASSE AU TRÉSOR</h4><p>${E.HEIST_AT} tourbillons ou plus : les tourbillons et les pièces de l’écran deviennent des pièces d’or qui <b>restent en place</b> (5 au moins) et tu as <b>3 vies</b>. Seuls des symboles spéciaux tombent ; chaque nouveau symbole reste et remet les vies à 3. <b>🛢️ Tonneau</b> : multiplie les pièces juste à côté de lui (haut, bas, gauche, droite) par ×${PP.safe.map((x) => x[0]).join(', ×')}. <b>🦀 Le Crabe</b> : ramasse la valeur de toutes les pièces de la grille. <b>⚓ Ancre</b> : ouvre une des 2 rangées verrouillées du haut (jusqu’à 5 × 6 cases). À la fin, tout est additionné.</p>
      <h4>FULL SCREEN</h4><p>Les 30 cases remplies avant la fin des vies : <b>LE COFFRE AUX PIRATES S’OUVRE</b> et multiplie tout le bonus <b>×${E.FULL_X}</b>, jusqu’au gain maximum.</p>
      <h4>Le suspense</h4><p>2 tourbillons sont là ? Les derniers rouleaux ralentissent…</p>
      <h4>Achat</h4><p>LA CHASSE AU TRÉSOR ×${E.BUY.heist} la mise (5 pièces d’or pour commencer). Gain maximum ×${E.CAPX.toLocaleString('fr-FR')}.</p>`);
  }
}

return { PiratesGame, ENGINE };
})();
