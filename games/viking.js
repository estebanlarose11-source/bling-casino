// SpinBet Casino · VikingGame (Le Valhalla) — loaded on demand by games/impl/index.js (index.html).
// ---- games/impl/viking.js ----
__mods['games/impl/viking.js'] = (() => {
// Le Valhalla (owner's request, 11 November 2026, in place of Le Volcan): 5 reels × 4 rows, 25 lines, the owner's
// symbols (assets/games/viking, cut from his sheet by tools/art/viking.py) in a carved stone machine: crest on top,
// the two heroes' meters on the left, a rune pillar on the right, a stone control bar at the bottom (layout of his
// reference picture, drawings of our own). The old viking is the SCATTER, the valkyrie the WILD.
// 4 scatters = BONUS VALHALLA: 5 WILDs land and stay, 15 free spins, every new WILD stays too (5 scatters = SUPER).
// 1 to 3 scatters fill the old viking's meter (250 = the bonus), every WILD the valkyrie's (500 = SUPER BONUS:
// 10 sticky WILDs from the start). The meters are kept per stake (localStorage spinbet_viking_m).

const { BaseGame, fmtC } = __mods['core/base.js'];
const { Reels } = __mods['core/reels.js'];
const { EXTRA_THEMES } = __mods['core/music.js'];
const { sfx } = __mods['audio.js'];
const { fx, center } = __mods['fx.js'];

/* ===ENGINE */
// 5 reels × 4 rows (cell = c * 4 + r, r = 0 at the top), 25 fixed lines. Symbols 0-3 J Q K A, 4 horn, 5 hammer,
// 6 helmet, 7 mug, 8 red-haired warrior, 9 ravens, 10 roaring viking; 11 WILD valkyrie (reels 2-5, replaces 0-10);
// 12 SCATTER old viking (any reel, one per reel at most).
// Owner's wishes (11 November 2026): 4 scatters = bonus: 5 WILDs land and stay, 15 free spins, every new WILD stays too.
// Side meters (one per stake): each scatter that lands fills the old viking's meter (250 = the bonus without 4 scatters),
// each WILD fills the valkyrie's (500 = the SUPER BONUS: the free spins start with 10 sticky WILDs).
const COLS = 5, ROWS = 4, N = 20, NS = 11, WILD = 11, SCAT = 12, CAPX = 1000;
const LINES = [
  [1, 1, 1, 1, 1], [2, 2, 2, 2, 2], [0, 0, 0, 0, 0], [3, 3, 3, 3, 3], [0, 1, 2, 1, 0],
  [3, 2, 1, 2, 3], [1, 2, 3, 2, 1], [2, 1, 0, 1, 2], [0, 0, 1, 0, 0], [3, 3, 2, 3, 3],
  [1, 0, 0, 0, 1], [2, 3, 3, 3, 2], [0, 1, 1, 1, 0], [3, 2, 2, 2, 3], [1, 1, 0, 1, 1],
  [2, 2, 3, 2, 2], [1, 1, 2, 1, 1], [2, 2, 1, 2, 2], [0, 1, 0, 1, 0], [3, 2, 3, 2, 3],
  [1, 0, 1, 0, 1], [2, 3, 2, 3, 2], [0, 2, 0, 2, 0], [3, 1, 3, 1, 3], [1, 2, 1, 2, 1],
];
const BONUS_AT = 4, FS = 15, START = { bonus: 5, super: 10 };
const METER = { scat: 250, wild: 500 };
const BUY = { bonus: 77, super: 350 };
const P = {
  w: [30, 30, 28, 28, 17, 17, 15, 15, 9, 8, 7], wild: 3.2, scat: 0.125,
  // free spins: weights of the symbols and of a new WILD (reels 2-5)
  wf: [30, 30, 28, 28, 17, 17, 15, 15, 9, 8, 7], wildF: 3.2,
  pays: [[5, 15, 40], [5, 15, 40], [5, 20, 50], [5, 20, 50], [10, 30, 100], [10, 30, 100], [15, 40, 125], [15, 40, 125], [20, 75, 250], [25, 100, 300], [40, 150, 500], [50, 200, 1000]],
  K: 3.8, KF: 0.8,
  pts: { scat: [0, 1, 2, 3], wild: 1 }, // meter points: one per scatter (1 to 3), one per WILD
};
function symbol(c, R, free) {
  const w = free ? P.wf : P.w, ws = c >= 1 ? (free ? P.wildF : P.wild) : 0;
  let t = ws; for (const x of w) t += x;
  let q = R() * t;
  if (q < ws) return WILD; q -= ws;
  for (let i = 0; i < NS; i++) { if (q < w[i]) return i; q -= w[i]; }
  return 0;
}
// a screen of 20 cells; in the free spins, no scatter and the sticky WILDs stay
function screen(R, free, sticky) {
  const g = [];
  for (let c = 0; c < COLS; c++) {
    const sr = !free && R() < P.scat ? Math.floor(R() * ROWS) : -1;
    for (let r = 0; r < ROWS; r++) g[c * ROWS + r] = r === sr ? SCAT : symbol(c, R, free);
  }
  if (sticky) for (const i of sticky) g[i] = WILD;
  return g;
}
function lines(g, k = P.K) {
  const wins = [];
  LINES.forEach((L, li) => {
    let s = -1, n = 0, wn = 0;
    for (let c = 0; c < COLS; c++) {
      const v = g[c * ROWS + L[c]];
      if (v === SCAT) break;
      if (v === WILD) { if (s < 0) wn++; n++; continue; }
      if (s < 0) s = v; else if (v !== s) break;
      n++;
    }
    let pay = s >= 0 && n >= 3 ? P.pays[s][n - 3] : 0, sym = s, cnt = n;
    if (wn >= 3 && P.pays[WILD][wn - 3] > pay) { pay = P.pays[WILD][wn - 3]; sym = WILD; cnt = wn; }
    if (s < 0 && n === COLS) { pay = P.pays[WILD][2]; sym = WILD; cnt = COLS; }
    if (!pay) return;
    wins.push({ line: li, s: sym, n: cnt, x: pay / 25 * k, cells: L.slice(0, cnt).map((r, c) => c * ROWS + r) });
  });
  return wins;
}
const count = (g, v) => g.reduce((a, x) => a + (x === v), 0);
// one paid spin: the screen, the line wins (× the bet), the scatters and WILDs (meter points)
function spin(R = Math.random) {
  const g = screen(R, false), wins = lines(g), sc = count(g, SCAT), wd = count(g, WILD);
  return { g, wins, x: wins.reduce((a, w) => a + w.x, 0), scat: sc, wilds: wd, bonus: sc >= BONUS_AT, superB: sc >= 5,
    ps: sc < BONUS_AT ? P.pts.scat[sc] : 0, pw: wd * P.pts.wild };
}
// n random sticky WILDs on reels 2-5
function startWilds(n, R = Math.random) {
  const cells = []; for (let i = ROWS; i < N; i++) cells.push(i);
  for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; }
  return cells.slice(0, n).sort((a, b) => a - b);
}
// The free spins: { start, spins: [{ g, fresh (new sticky WILDs), wins, x }], total }
function freeRun(n, R = Math.random) {
  const start = startWilds(n, R), sticky = new Set(start), spins = [];
  let total = 0;
  for (let k = 0; k < FS; k++) {
    const g = screen(R, true, sticky), fresh = [];
    for (let i = 0; i < N; i++) if (g[i] === WILD && !sticky.has(i)) { sticky.add(i); fresh.push(i); }
    const wins = lines(g, P.KF), x = wins.reduce((a, w) => a + w.x, 0);
    total += x;
    spins.push({ g, fresh, wins, x, sticky: [...sticky] });
  }
  return { start, spins, total };
}
// A player's long run (simulator): meters kept from spin to spin, like in the game (one stake).
function round(st, R = Math.random) {
  const s = spin(R);
  let t = s.x, bonus = 0, kind = '';
  st.s = Math.min(METER.scat, st.s + s.ps); st.w = Math.min(METER.wild, st.w + s.pw);
  if (s.bonus) kind = s.superB ? 'super' : 'bonus';
  else if (st.w >= METER.wild) { kind = 'super'; st.w = 0; }
  else if (st.s >= METER.scat) { kind = 'bonus'; st.s = 0; }
  if (kind) bonus = freeRun(START[kind], R).total;
  t += bonus;
  return { total: Math.min(CAPX, t), line: s.x, bonus, kind, natural: s.bonus };
}
const buyRun = (kind, R = Math.random) => Math.min(CAPX, freeRun(START[kind], R).total);
const ENGINE = { COLS, ROWS, N, NS, WILD, SCAT, CAPX, LINES, BONUS_AT, FS, START, METER, BUY, P, symbol, screen, lines, spin, startWilds, freeRun, round, buyRun, count };
/* ===END ENGINE */

const E = ENGINE;
const PP = E.P;
const IMG_V = 1;
const asset = (p) => window.__assets?.[p] || `${p}?v=${IMG_V}`; // single-file version: the images are inlined
const src = (n) => asset(`assets/games/viking/${n}.webp`);
const img = (n, cls = 'vk-img') => `<img class="${cls}" src="${src(n)}" alt="" draggable="false" decoding="async">`;
const NAMES = ['Valet', 'Dame', 'Roi', 'As', 'Corne', 'Marteau', 'Casque', 'Chope', 'La guerrière', 'Les corbeaux', 'Le berserker', 'Valkyrie WILD'];
const RUNES = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';
const rune = (n, k = 0) => Array.from({ length: n }, (_, i) => RUNES[(i * 7 + k * 5) % RUNES.length]).join('');
const KEY = 'spinbet_viking_m';
const vibe = (p) => { try { if (localStorage.getItem('spinbet_vibe') !== '0' && navigator.vibrate && !document.hidden) navigator.vibrate(p); } catch { /* ignore */ } };
const BLUE = ['#e0f2fe', '#7dd3fc', '#38bdf8', '#fff'], GOLD = ['#fef3c7', '#fde047', '#f59e0b', '#fff'];

// The stone crest above the reels: a horned helmet carved in the rock, two glowing eyes, runes on both wings.
const CREST = `<svg class="vk-crest" viewBox="0 0 1000 150" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
  <defs>
    <linearGradient id="vkSt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6b7785"/><stop offset=".45" stop-color="#3a434f"/><stop offset="1" stop-color="#1b2129"/></linearGradient>
    <linearGradient id="vkStD" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a5562"/><stop offset="1" stop-color="#151a20"/></linearGradient>
    <radialGradient id="vkEye" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="#7dd3fc"/><stop offset="1" stop-color="#0284c7" stop-opacity="0"/></radialGradient>
  </defs>
  <path d="M20 150 L60 96 L330 84 L380 60 L620 60 L670 84 L940 96 L980 150 Z" fill="url(#vkStD)" stroke="#0b0f14" stroke-width="3"/>
  <path d="M70 112 L340 100 M930 112 L660 100" stroke="#0b0f14" stroke-width="3" opacity=".6"/>
  <text class="vk-run" x="200" y="134" text-anchor="middle">${rune(9, 1)}</text>
  <text class="vk-run" x="800" y="134" text-anchor="middle">${rune(9, 3)}</text>
  <g transform="translate(500 0)">
    <path d="M-150 54 C-200 40 -230 6 -226 -4 C-196 18 -164 22 -128 26 Z" fill="url(#vkSt)" stroke="#0b0f14" stroke-width="3"/>
    <path d="M150 54 C200 40 230 6 226 -4 C196 18 164 22 128 26 Z" fill="url(#vkSt)" stroke="#0b0f14" stroke-width="3"/>
    <path d="M-130 70 C-130 14 -70 -6 0 -6 C70 -6 130 14 130 70 L110 150 L-110 150 Z" fill="url(#vkSt)" stroke="#0b0f14" stroke-width="4"/>
    <path d="M-120 64 H120" stroke="#0b0f14" stroke-width="5"/><path d="M-118 60 H118" stroke="#8a96a3" stroke-width="2" opacity=".6"/>
    <path d="M0 -4 V60" stroke="#0b0f14" stroke-width="4"/><path d="M-6 6 L0 -2 L6 6 V58 H-6 Z" fill="#59636f"/>
    <path d="M-92 82 Q-60 70 -26 84 L-30 100 Q-62 92 -92 98 Z M92 82 Q60 70 26 84 L30 100 Q62 92 92 98 Z" fill="#0b0f14"/>
    <ellipse class="vk-eye" cx="-58" cy="90" rx="26" ry="10" fill="url(#vkEye)"/><ellipse class="vk-eye" cx="58" cy="90" rx="26" ry="10" fill="url(#vkEye)"/>
    <path d="M-16 84 L0 128 L16 84 Z" fill="#2a323c" stroke="#0b0f14" stroke-width="3"/>
    <path d="M-80 124 Q-40 150 0 140 Q40 150 80 124 L70 150 H-70 Z" fill="#2a323c" stroke="#0b0f14" stroke-width="3"/>
    ${[-100, -70, 70, 100].map((x) => `<circle cx="${x}" cy="40" r="6" fill="#8a96a3" stroke="#0b0f14" stroke-width="2"/>`).join('')}
  </g>
</svg>`;
// The rune pillar on the right of the machine.
const PILLAR = `<svg class="vk-pillar" viewBox="0 0 120 600" preserveAspectRatio="none" aria-hidden="true">
  <defs><linearGradient id="vkPl" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1b2129"/><stop offset=".3" stop-color="#4a5562"/><stop offset=".7" stop-color="#3a434f"/><stop offset="1" stop-color="#151a20"/></linearGradient>
  <radialGradient id="vkGem" cx=".4" cy=".35" r=".6"><stop offset="0" stop-color="#fff"/><stop offset=".3" stop-color="#7dd3fc"/><stop offset="1" stop-color="#075985"/></radialGradient></defs>
  <rect x="6" y="0" width="108" height="600" rx="8" fill="url(#vkPl)" stroke="#0b0f14" stroke-width="4"/>
  <rect x="0" y="0" width="120" height="40" rx="6" fill="#3a434f" stroke="#0b0f14" stroke-width="4"/><rect x="0" y="560" width="120" height="40" rx="6" fill="#3a434f" stroke="#0b0f14" stroke-width="4"/>
  <g fill="none" stroke="#0b0f14" stroke-width="7" stroke-linejoin="round">
    <path d="M30 70 H90 V150 H30 Z M30 110 H90 M60 70 V150"/><path d="M60 190 L94 240 L60 290 L26 240 Z M60 214 L78 240 L60 266 L42 240 Z"/>
    <path d="M30 410 H90 V500 H30 Z M30 440 L90 470 M30 470 L90 440"/>
  </g>
  <g fill="none" stroke="#8a96a3" stroke-width="2" opacity=".5"><path d="M33 73 H87 V147 H33 Z"/><path d="M60 194 L90 240 L60 286 L30 240 Z"/><path d="M33 413 H87 V497 H33 Z"/></g>
  <circle class="vk-gem" cx="60" cy="350" r="15" fill="url(#vkGem)" stroke="#0b0f14" stroke-width="4"/>
</svg>`;
// The background: a cold blue sky, snowy mountains and glowing lava cracks (aurora in the free spins).
const SKY = `<svg class="vk-sky" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
  <defs>
    <linearGradient id="vkSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b2a3a"/><stop offset=".55" stop-color="#1d5a6e"/><stop offset="1" stop-color="#0d2531"/></linearGradient>
    <linearGradient id="vkMt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3f6a7c"/><stop offset="1" stop-color="#0f2430"/></linearGradient>
    <linearGradient id="vkMt2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#22414f"/><stop offset="1" stop-color="#081820"/></linearGradient>
    <linearGradient id="vkAur" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#22c55e" stop-opacity="0"/><stop offset=".3" stop-color="#4ade80" stop-opacity=".7"/><stop offset=".6" stop-color="#a855f7" stop-opacity=".6"/><stop offset="1" stop-color="#22d3ee" stop-opacity="0"/></linearGradient>
    <linearGradient id="vkLava" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fde68a"/><stop offset=".5" stop-color="#f97316"/><stop offset="1" stop-color="#b91c1c"/></linearGradient>
  </defs>
  <rect width="1600" height="900" fill="url(#vkSky)"/>
  <path class="vk-aur" d="M0 180 C300 60 520 260 820 140 C1100 30 1300 210 1600 100 L1600 240 C1300 340 1100 170 820 280 C520 390 300 200 0 320 Z" fill="url(#vkAur)"/>
  <path d="M0 560 L180 300 L300 420 L460 220 L620 430 L760 300 L900 460 L1060 250 L1220 420 L1380 280 L1600 520 V900 H0 Z" fill="url(#vkMt)"/>
  <path d="M460 220 L410 300 L470 280 L520 310 Z M1060 250 L1010 330 L1070 300 L1120 340 Z M180 300 L140 360 L200 345 Z M1380 280 L1340 350 L1400 330 Z" fill="#dbeafe" opacity=".7"/>
  <path d="M0 700 L140 560 L260 640 L420 540 L600 660 L800 560 L1000 680 L1180 560 L1360 650 L1600 560 V900 H0 Z" fill="url(#vkMt2)"/>
  <path class="vk-lava" d="M0 820 L60 780 L40 740 L110 700 M1600 800 L1530 770 L1560 720 L1490 680 M1600 860 L1500 840 M0 880 L90 860" fill="none" stroke="url(#vkLava)" stroke-width="7" stroke-linecap="round"/>
</svg>`;
const SNOW = `<div class="vk-snow" aria-hidden="true">${Array.from({ length: 22 }, (_, k) => `<i style="left:${(k * 47) % 100}%;--d:${6 + (k % 5) * 1.6}s;animation-delay:-${(k * 1.3) % 9}s;--s:${2 + (k % 3)}px"></i>`).join('')}</div>`;

class VikingGame extends BaseGame {
  constructor(root, game) {
    super(root, game, {
      music: EXTRA_THEMES.viking, cls: 'vk-slot',
      stage: `<div class="vk-stage">
        <div class="vk-side">
          <div class="vk-meter scat" data-m="s"><div class="vk-por">${img('scat-c', 'vk-pimg')}<i class="vk-aura"></i></div>
            <div class="vk-mtxt"><b class="vk-mname">LE JARL</b><div class="vk-bar"><i></i><b>0/${E.METER.scat}</b></div><small>BONUS</small></div></div>
          <div class="vk-meter wild" data-m="w"><div class="vk-por">${img('wild-c', 'vk-pimg')}<i class="vk-aura"></i></div>
            <div class="vk-mtxt"><b class="vk-mname">LA VALKYRIE</b><div class="vk-bar"><i></i><b>0/${E.METER.wild}</b></div><small>SUPER BONUS</small></div></div>
        </div>
        <div class="vk-machine">
          ${CREST}
          <div class="vk-frame"><i class="vk-knot tl"></i><i class="vk-knot tr"></i><i class="vk-knot bl"></i><i class="vk-knot br"></i>
            <div class="vk-rwrap"><div class="vk-sticky"></div></div>
          </div>
        </div>
        <div class="vk-col">${PILLAR}</div>
        <div class="vk-word"></div>
      </div>`,
      buys: [
        { id: 'bonus', icon: '⚔️', label: 'BONUS VALHALLA · 15 tours', desc: '5 WILD collés dès le départ, chaque nouveau WILD reste jusqu’à la fin', cost: (b) => b * E.BUY.bonus },
        { id: 'super', icon: '👑', label: 'SUPER BONUS · 15 tours', desc: '10 WILD collés dès le départ, chaque nouveau WILD reste jusqu’à la fin', cost: (b) => b * E.BUY.super },
      ],
      hello: `${E.BONUS_AT} Jarls = BONUS · les jauges de gauche lancent le bonus toutes seules`,
    });
    this.q('.slot-bg').innerHTML = SKY + SNOW;
    // the stone control bar, laid out like the owner's picture: lines, stake, max stake, spin, auto, win, balance
    const ctl = this.q('.controls');
    ctl.classList.add('vk-ctl');
    ctl.insertAdjacentHTML('afterbegin', '<div class="vk-c vk-lines"><label>LIGNES</label><b>25</b></div>');
    this.q('.ctl-bet').insertAdjacentHTML('afterend', '<button class="vk-max" type="button" data-vk="max" aria-label="Mise maximum">MISE<br>MAX</button>');
    this.mainBtn.insertAdjacentHTML('afterend', '<button class="vk-auto" type="button" data-act="menu" aria-label="Tours auto et bonus"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M10 8l6 4-6 4z" fill="currentColor"/></svg></button>');
    this.onVk = (e) => { if (e.target.closest('[data-vk="max"]')) this.maxBet(); };
    this.root.addEventListener('click', this.onVk);
    this.reels = new Reels(this.q('.vk-rwrap'), {
      cols: E.COLS, rows: E.ROWS, game: this, random: (c) => this.filler(c), art: (v) => this.cellArt(v),
      cls: (v) => (v === E.SCAT ? 'scat' : v === E.WILD ? 'wild' : v >= 8 ? 'hi' : v >= 4 ? 'mid' : 'lo'),
    });
    this.reels.el.classList.add('vk-rs');
    this.q('.vk-rwrap').appendChild(this.q('.vk-sticky')); // above the reels
    this.stickyEl = this.q('.vk-sticky');
    this.reels.setAll(this.idle());
    this.loadMeters();
    this.paintMeters();
    ['wild-c', 'scat-c', 's8', 's9', 's10'].forEach((n) => { new Image().src = src(n); });
  }

  destroy() { this.root.removeEventListener('click', this.onVk); super.destroy(); }

  /* ---------- the meters (kept per stake) ---------- */
  loadMeters() { try { this.mAll = JSON.parse(localStorage.getItem(KEY)) || {}; } catch { this.mAll = {}; } }
  saveMeters() { try { localStorage.setItem(KEY, JSON.stringify(this.mAll)); } catch { /* ignore */ } }
  get m() { const k = String(this.bet); if (!this.mAll[k]) this.mAll[k] = { s: 0, w: 0 }; return this.mAll[k]; }
  onBetChange() { this.paintMeters(); }
  paintMeters() {
    if (this.dead || !this.mAll) return;
    const m = this.m;
    for (const [k, max] of [['s', E.METER.scat], ['w', E.METER.wild]]) {
      const box = this.q(`.vk-meter[data-m="${k}"]`), v = Math.min(max, m[k]);
      box.querySelector('.vk-bar i').style.width = `${(v / max) * 100}%`;
      box.querySelector('.vk-bar b').textContent = `${v}/${max}`;
      box.classList.toggle('full', v >= max);
      box.classList.toggle('near', v >= max * 0.85 && v < max);
    }
  }
  // points fly from the cells to the hero, who comes alive, and the bar fills
  async addPoints(k, n, cells) {
    if (!n || this.dead) return;
    const box = this.q(`.vk-meter[data-m="${k}"]`), por = box.querySelector('.vk-por'), to = center(por);
    for (const i of cells) { const p = center(this.reels.cell(i)); fx.trail?.(p, to, k === 's' ? '#7dd3fc' : '#fde047', 14); }
    await this.wait(this.superT ? 80 : 380);
    const max = k === 's' ? E.METER.scat : E.METER.wild;
    this.m[k] = Math.min(max, this.m[k] + n);
    this.saveMeters();
    por.classList.remove('hit'); void por.offsetWidth; por.classList.add('hit');
    box.classList.remove('lvl1', 'lvl2', 'lvl3'); box.classList.add(`lvl${Math.min(3, n)}`);
    this.floatAt(por, `+${n}`, k === 's' ? '#7dd3fc' : '#fde047', 26 + Math.min(3, n) * 6);
    fx.burst(to.x, to.y, 8 + n * 6, k === 's' ? BLUE : GOLD, 4 + n);
    if (n >= 2) vibe([30, 30, 50]);
    sfx.coin?.();
    this.paintMeters();
  }

  idle() { const g = E.screen(Math.random, false); for (let i = 0; i < E.N; i++) if (g[i] === E.SCAT) g[i] = E.symbol(Math.floor(i / E.ROWS), Math.random); return g; }
  filler(c) { const r = Math.random(); if (r < 0.06) return E.SCAT; return E.symbol(c, Math.random, this.inFree); }
  cellArt(v) {
    if (v === E.WILD) return `<div class="vk-hero wild">${img('wild-c', 'vk-pimg')}<b>WILD</b></div>`;
    if (v === E.SCAT) return `<div class="vk-hero scat">${img('scat-c', 'vk-pimg')}<b>BONUS</b></div>`;
    return img(`s${v}`);
  }
  maxBet() {
    if (this.busy) return;
    let k = 0;
    while (this.canRaise() && k++ < 40) this.changeBet(1);
    if (!k) this.msg('Mise max avec ton solde');
  }

  word(t, cls = '') {
    const w = this.q('.vk-word');
    w.innerHTML = t; w.className = `vk-word ${cls}`;
    w.getAnimations().forEach((a) => a.cancel());
    w.animate([{ opacity: 0, transform: 'translate(-50%,-50%) scale(.3)' }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1.12)', offset: 0.22 },
      { opacity: 1, transform: 'translate(-50%,-50%) scale(1)', offset: 0.72 }, { opacity: 0, transform: 'translate(-50%,-62%) scale(1.1)' }], { duration: this.turbo ? 900 : 1500, easing: 'ease-out' });
  }

  /* ---------- sticky WILDs (free spins): a layer above the reels, the same grid ---------- */
  stick(i, anim = 'drop') {
    const c = Math.floor(i / E.ROWS), r = i % E.ROWS;
    const n = document.createElement('div');
    n.className = `vk-sw ${anim}`; n.dataset.i = i;
    n.style.gridColumn = c + 1; n.style.gridRow = r + 1;
    n.innerHTML = `<div class="vk-hero wild">${img('wild-c', 'vk-pimg')}<b>WILD</b></div>`;
    this.stickyEl.appendChild(n);
    return n;
  }
  unstickAll() { this.stickyEl.innerHTML = ''; }

  async spinReels(g) {
    let tease = false;
    await this.reels.spin(g, {
      tease: (c, vals) => {
        if (this.inFree || c < 3) return false;
        let s = 0; for (let j = 0; j < c * E.ROWS; j++) if (vals[j] === E.SCAT) s++;
        const t = s === E.BONUS_AT - 1 || (c === 4 && s === E.BONUS_AT);
        if (t && !tease) { tease = true; this.msg(s === E.BONUS_AT ? '⚔️ Un 5e Jarl pour le SUPER BONUS…' : '⚔️ Plus qu’un Jarl pour le BONUS…'); }
        if (t) this.reels.reelEls[c].classList.add('vk-focus');
        return t;
      },
      onStop: (c) => {
        this.reels.reelEls[c].classList.remove('vk-focus');
        for (let r = 0; r < E.ROWS; r++) {
          const i = c * E.ROWS + r, v = g[i];
          if (v !== E.SCAT && v !== E.WILD) continue;
          if (this.inFree && v === E.WILD && this.stuck?.has(i)) continue;
          const n = this.reels.cell(i), p = center(n);
          n?.classList.add('vk-in');
          sfx.land?.();
          fx.burst(p.x, p.y, 10, v === E.SCAT ? BLUE : GOLD, 4);
        }
      },
    });
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
      total = await this.freeSpins(buy, b, cap);
    } else {
      const res = E.spin(Math.random);
      await this.spinReels(res.g);
      if (this.dead) return;
      total = Math.min(Math.round(res.x * b), cap);
      if (res.wins.length) {
        this.reels.mark([...new Set(res.wins.flatMap((w) => w.cells))]);
        this.msg(this.winMsg(res.wins, b));
        this.win(total); this.setLast(total); this.winAmt.textContent = fmtC(total);
      } else this.msg(res.scat === E.BONUS_AT - 1 ? `${res.scat} Jarls… il en fallait ${E.BONUS_AT} !` : 'Pas de gain');
      // the meters: one point per Jarl (1 to 3) and per WILD
      const cells = (v) => res.g.map((x, i) => (x === v ? i : -1)).filter((i) => i >= 0);
      if (res.ps) await this.addPoints('s', res.ps, cells(E.SCAT));
      if (res.pw) await this.addPoints('w', res.pw, cells(E.WILD));
      let kind = '';
      if (res.bonus) kind = res.superB ? 'super' : 'bonus';
      else if (this.m.w >= E.METER.wild) { kind = 'super'; await this.meterFull('w'); }
      else if (this.m.s >= E.METER.scat) { kind = 'bonus'; await this.meterFull('s'); }
      if (kind) {
        this.stopAuto();
        if (total > 0) { sfx.win(); await this.wait(900); }
        this.reels.unmark();
        if (res.bonus) {
          this.reels.mark(cells(E.SCAT), 'win');
          this.word(`${res.scat} JARLS !`, 'gold'); sfx.jackpot?.(); fx.confetti(70); vibe([60, 40, 120]);
          await this.wait(1500);
          this.reels.unmark();
        }
        total += await this.freeSpins(kind, b, cap - total);
      } else if (total > 0) await this.celebrate(total);
      this.reels.unmark();
    }
    this.setLast(total);
    if (total >= cap) this.msg(`GAIN MAXIMUM ! ${fmtC(total)}`);
    else if (total > 0 && (buy || this.bonusDone)) this.msg(`Total du tour : ${fmtC(total)}`);
    this.bonusDone = false;
  }

  // a full meter: the hero roars, the meter empties into the bonus
  async meterFull(k) {
    const box = this.q(`.vk-meter[data-m="${k}"]`), por = box.querySelector('.vk-por'), p = center(por);
    box.classList.add('fire');
    this.word(k === 's' ? 'LE JARL SE RÉVEILLE !' : 'LA VALKYRIE DESCEND !', k === 's' ? 'blue' : 'gold');
    sfx.feature?.(); this.flash(k === 's' ? 'rgba(56,189,248,.5)' : 'rgba(250,204,21,.5)'); this.shake(); vibe([80, 50, 160]);
    fx.burst(p.x, p.y, 50, k === 's' ? BLUE : GOLD, 9);
    await this.wait(1600);
    this.m[k] = 0; this.saveMeters();
    box.classList.remove('fire');
    this.paintMeters();
  }

  winMsg(wins, b) {
    const top = wins.slice().sort((p, q) => q.x - p.x);
    const t = top.slice(0, 2).map((w) => `${w.n} × ${NAMES[w.s]} : +${fmtC(Math.round(w.x * b))}`).join(' · ');
    return top.length > 2 ? `${t} · +${top.length - 2} ligne${top.length > 3 ? 's' : ''}` : t;
  }

  /* ---------- BONUS VALHALLA / SUPER BONUS: 15 free spins, the WILDs stay ---------- */
  async freeSpins(kind, b, capLeft) {
    const sup = kind === 'super', title = sup ? 'SUPER BONUS VALHALLA' : 'BONUS VALHALLA', n0 = E.START[kind];
    await this.featureIntro(title, `${E.FS} tours gratuits · ${n0} WILD collés dès le départ · chaque nouveau WILD reste jusqu’à la fin`, img('wild', 'vk-iimg'), 2600);
    if (this.dead) return 0;
    const run = E.freeRun(n0);
    this.inFree = true; this.stuck = new Set();
    this.slotEl.classList.add('in-free', 'vk-free');
    this.slotEl.classList.toggle('vk-super', sup);
    this.focusStage?.();
    let tot = 0;
    const banner = (k) => this.setBanner(`<b>${title}</b><span class="pill">Tour ${Math.min(k, E.FS)} / ${E.FS}</span><span class="pill vk-wp">WILD ${this.stuck.size}</span><span class="pill gold">${fmtC(tot)}</span>`);
    banner(0);
    // the starting WILDs fall one by one
    this.msg(`La valkyrie pose ${n0} WILD qui restent pendant tout le bonus`);
    for (const i of run.start) {
      if (this.dead) return 0;
      this.stuck.add(i); this.stick(i, 'drop');
      const p = center(this.reels.cell(i)); fx.burst(p.x, p.y, 16, GOLD, 6); sfx.land?.(); vibe(25);
      await this.wait(this.superT ? 60 : 260);
    }
    banner(0);
    await this.wait(500);
    for (let k = 0; k < run.spins.length; k++) {
      if (this.dead) return 0;
      const sp = run.spins[k];
      banner(k + 1);
      this.reels.unmark(); this.qa('.vk-sw.win').forEach((n) => n.classList.remove('win'));
      await this.spinReels(sp.g);
      if (this.dead) return 0;
      // the new WILDs stay
      if (sp.fresh.length) {
        for (const i of sp.fresh) {
          this.stuck.add(i); const n = this.stick(i, 'grab');
          const p = center(n); fx.burst(p.x, p.y, 24, GOLD, 7);
        }
        this.word(sp.fresh.length > 1 ? `${sp.fresh.length} WILD COLLÉS !` : 'WILD COLLÉ !', 'gold'); sfx.upgrade?.(); vibe([40, 30, 70]);
        banner(k + 1);
        await this.wait(this.superT ? 200 : 700);
      }
      if (sp.x > 0) {
        const amt = Math.max(0, Math.min(Math.round(sp.x * b), capLeft - tot));
        const cells = [...new Set(sp.wins.flatMap((w) => w.cells))];
        this.reels.mark(cells);
        cells.forEach((i) => this.stickyEl.querySelector(`.vk-sw[data-i="${i}"]`)?.classList.add('win'));
        this.msg(this.winMsg(sp.wins, b));
        if (amt > 0) { this.win(amt, title); tot += amt; }
        this.winAmt.textContent = fmtC(tot);
        banner(k + 1);
        sfx.win();
        await this.wait(sp.x >= 20 ? 1500 : 900);
      } else await this.wait(this.superT ? 80 : 300);
      if (tot >= capLeft) break;
    }
    this.reels.unmark();
    await this.celebrate(tot, { summary: title, stake: b });
    this.setBanner('');
    this.slotEl.classList.remove('in-free', 'vk-free', 'vk-super');
    this.inFree = false; this.stuck = null;
    this.unstickAll();
    this.reels.setAll(this.idle());
    this.msg(`${title} : ${fmtC(tot)}`);
    this.bonusDone = true;
    return tot;
  }

  info() {
    const f = (x) => (Math.round(x / 25 * PP.K * 100) / 100).toLocaleString('fr-FR');
    const rows = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0].map((s) => `<div class="pay-item"><div class="pay-sym vk-pay">${img(`s${s}`)}</div><div class="pay-vals"><b>${NAMES[s]}</b><br><span>3 : ×${f(PP.pays[s][0])} · 4 : ×${f(PP.pays[s][1])} · 5 : ×${f(PP.pays[s][2])}</span></div></div>`).join('');
    return this.rules(`<h4>Symboles (× la mise, par ligne)</h4><div class="paytable">${rows}
      <div class="pay-item"><div class="pay-sym vk-pay">${img('wild-c')}</div><div class="pay-vals"><b>La valkyrie WILD</b><br><span>Rouleaux 2 à 5, remplace tous les symboles sauf le Jarl · 3 : ×${f(PP.pays[E.WILD][0])} · 4 : ×${f(PP.pays[E.WILD][1])} · 5 : ×${f(PP.pays[E.WILD][2])}</span></div></div>
      <div class="pay-item"><div class="pay-sym vk-pay">${img('scat-c')}</div><div class="pay-vals"><b>Le Jarl (BONUS)</b><br><span>${E.BONUS_AT} Jarls : BONUS VALHALLA · 5 Jarls : SUPER BONUS</span></div></div></div>
      <h4>25 lignes</h4><p>5 rouleaux de 4 cases et 25 lignes fixes. Une ligne paie dès que 3 symboles identiques ou plus se suivent depuis la gauche.</p>
      <h4>BONUS VALHALLA</h4><p>${E.BONUS_AT} Jarls n’importe où : <b>${E.FS} tours gratuits</b>. La valkyrie pose <b>${E.START.bonus} WILD</b> qui restent collés pendant tout le bonus, et <b>chaque nouveau WILD reste aussi</b> jusqu’à la fin : ils s’accumulent tour après tour. 5 Jarls : le SUPER BONUS.</p>
      <h4>Les jauges des héros</h4><p>À gauche, deux jauges (une par mise, gardées d’une partie à l’autre). Chaque Jarl qui tombe (1 à 3) donne 1 point au Jarl : à <b>${E.METER.scat}</b>, le BONUS VALHALLA démarre tout seul, sans les ${E.BONUS_AT} Jarls. Chaque WILD qui tombe donne 1 point à la valkyrie : à <b>${E.METER.wild}</b>, c’est le <b>SUPER BONUS</b> : ${E.FS} tours gratuits avec <b>${E.START.super} WILD collés</b> dès le départ.</p>
      <h4>Achats</h4><p>BONUS VALHALLA ×${E.BUY.bonus} la mise · SUPER BONUS ×${E.BUY.super} la mise. Gain maximum ×${E.CAPX.toLocaleString('fr-FR')}.</p>`);
  }
}

return { VikingGame, ENGINE };
})();
