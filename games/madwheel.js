// SpinBet Casino · MadWheelGame — loaded on demand by games/impl/index.js (index.html).
// ---- games/impl/madwheel.js ----
__mods['games/impl/madwheel.js'] = (() => {
// Mad Wheel, rebuilt on the shared cabinet. Wheel, Top Slot and the four bonus games keep the original odds.

const { BaseGame, fmtC, wpick } = __mods['core/base.js'];
const { BetBoard } = __mods['core/roulette.js'];
const { EXTRA_THEMES } = __mods['core/music.js'];
const { sfx, audioContext, isMuted } = __mods['audio.js'];
const { fx, sleep, center } = __mods['fx.js'];
const { mergeOpts, withRoom, wpickR, rng } = __mods['online.js'];

/* ===ENGINE (original) */
// 54 cases spread evenly around the wheel; with the Top Slot odds below every spot returns about 94 %.
const SEG_COUNT = [['1', 22, 0.5], ['2', 15, 0.5], ['5', 7, 0.5], ['10', 4, 0.5], ['cf', 2, 0.3], ['pa', 2, 0.7], ['ch', 1, 0.25], ['ct', 1, 0.75]];
const SEGS = SEG_COUNT.flatMap(([k, n, ph], j) => Array.from({ length: n }, (_, i) => ({ k, at: (i + ph) / n + j * 1e-4 }))).sort((a, b) => a.at - b.at).map((x) => x.k);
const NS = SEGS.length, A = 360 / NS;
const COL = { 1: '#f5c518', 2: '#3aa0ff', 5: '#ff5fa8', 10: '#a259ff', cf: '#1dd3b0', ch: '#8bd93b', pa: '#ff8a3d', ct: '#ff3d54' };
const NAME = { 1: '1', 2: '2', 5: '5', 10: '10', cf: 'Pile ou Face', ch: 'Chasse au Cash', pa: 'Pachinko', ct: 'Méga Folie' };
const SPOTS = ['1', '2', '5', '10', 'cf', 'ch', 'pa', 'ct'];
const HINT = { 1: '1 pour 1', 2: '2 pour 1', 5: '5 pour 1', 10: '10 pour 1', cf: 'Pile ou Face', ch: 'Chasse au Cash', pa: 'Pachinko', ct: 'Méga Folie' };
const TM = [[2, 30], [3, 20], [5, 18], [7, 10], [10, 9], [15, 5], [20, 3.5], [25, 2.5], [30, 1.5], [50, 0.5]];
const TQ = { 1: 0.0562, 2: 0.0351, 5: 0.0458, 10: 0.0309, cf: 0.1141, ch: 0.1335, pa: 0.1369, ct: 0.0986 };
const CL = [[4, 24], [6, 19], [8, 15], [10, 12], [14, 10], [20, 8], [30, 5.5], [40, 3.5], [100, 2], [200, 1.23]];
const CHB = { 10: 26, 12: 18, 14: 14, 16: 11, 18: 8, 20: 8, 24: 6, 30: 5, 40: 4, 50: 3, 60: 2, 80: 1, 200: 1, 950: 1 };
const PV = [500, 250, 100, 50, 25, 'D', 8, 5, 5, 8, 'D', 25, 50, 100, 250, 500];
const CTC = { 5: 16, 10: 14, 15: 10, 20: 7, 25: 5, 50: 4, 100: 2, 200: 1, 500: 1 }, CTSEQ = [], CTA = 360 / 64, CTARR = [0, 120, 240];
(() => {
  const groups = []; for (const v in CTC) groups.push({ v: +v, n: CTC[v] });
  groups.sort((x, y) => y.n - x.n);
  const vals = []; let left = true;
  while (left) { left = false; groups.forEach((g) => { if (g.n > 0) { vals.push(g.v); g.n--; left = true; } }); }
  const P = []; for (let q = 0; q < 64; q++) if (q !== 8 && q !== 40 && q !== 24 && q !== 56) P.push(q);
  const at = {}; vals.forEach((v, k) => { at[P[(k * 17) % P.length]] = v; });
  for (let q2 = 0; q2 < 64; q2++) CTSEQ.push(q2 === 8 || q2 === 40 ? 'D' : q2 === 24 || q2 === 56 ? 'T' : at[q2]);
})();
const CAPX = 25000;
const ZOOM_MAX = 2.4; // camera zoom on the pointer when the wheel stops
const shuffle = (a, R = Math.random) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
// every draw takes its random source R (Math.random, or the shared seed of an online table)
function drawTop(R = Math.random) { const r = R(); let a = 0; for (const k in TQ) { a += TQ[k]; if (r < a) return { seg: k, m: wpickR(R, TM) }; } return null; }
function chBoard(R = Math.random) { const a = []; for (const v in CHB) for (let i = 0; i < CHB[v]; i++) a.push(+v); return shuffle(a, R); }
function coinRun(R = Math.random) { const a = wpickR(R, CL), b = wpickR(R, CL), f = R() < 0.5 ? 0 : 1; return { v: [a, b], face: f, M: [a, b][f] }; }
function pachRun(R = Math.random) {
  let vals = PV.slice(); const drops = [];
  for (let n = 0; n < 40; n++) {
    const path = []; let k = 0; for (let s = 0; s < 15; s++) { const d = R() < 0.5 ? 1 : 0; path.push(d); k += d; }
    drops.push({ path, k, vals: vals.slice() });
    if (vals[k] === 'D') { vals = vals.map((v) => (v === 'D' ? 'D' : v * 2)); continue; }
    return { drops, M: vals[k] };
  }
  return { drops, M: 5 };
}
const ctIdx = (phi) => CTARR.map((a) => Math.floor(((((a - phi) % 360) + 360) % 360) / CTA));
function ctRun(ch, R = Math.random) {
  let mult = 1; const spins = [];
  for (let n = 0; n < 60; n++) {
    const phi = R() * 360, idx = ctIdx(phi), seg = CTSEQ[idx[ch]]; spins.push({ phi, idx });
    if (seg === 'D') mult *= 2; else if (seg === 'T') mult *= 3;
    else return { spins, mult, seg, idx, M: seg * mult };
  }
  return { spins, mult, seg: 5, idx: [0, 0, 0], M: 5 * mult };
}
// A whole round drawn in advance (the same for every player of an online table): Top Slot, the case, and the bonus
// of that case (Méga Folie: one run per arrow colour, the player's arrow picks one).
function outcome(R = Math.random) {
  const top = drawTop(R), idx = Math.floor(R() * NS), seg = SEGS[idx];
  const O = { top, idx, seg };
  if (seg === 'cf') O.cf = coinRun(R);
  else if (seg === 'ch') { O.bd = chBoard(R); O.chm = O.bd[Math.floor(R() * 108)]; }
  else if (seg === 'pa') O.pa = pachRun(R);
  else if (seg === 'ct') O.ct = [0, 1, 2].map((c) => ctRun(c, R));
  return O;
}
// Online, each player's Méga Folie arrow is drawn from the round's seed and the player's account: everyone can work
// out everyone's result.
const arrowOf = (seed, uid) => Math.floor(rng(`${seed}|arrow|${uid || ''}`)() * 3);
const bonusM = (O, arrow) => (O.seg === 'cf' ? O.cf.M : O.seg === 'ch' ? O.chm : O.seg === 'pa' ? O.pa.M : O.seg === 'ct' ? O.ct[arrow].M : 0);
// What a set of bets returns on that round (stake included).
function payout(O, bets, arrow = 0) {
  const seg = O.seg, b = bets[seg] || 0;
  if (!b) return { ret: 0, M: 0, cap: false, tm: 1 };
  const tm = O.top && O.top.seg === seg ? O.top.m : 1;
  let ret, M;
  if (!isNaN(+seg)) { M = +seg; ret = b * (M * tm + 1); } else { M = bonusM(O, arrow); ret = M > 0 ? b * (M * tm + 1) : 0; }
  let cap = false;
  if (ret > b * CAPX) { ret = b * CAPX; cap = true; }
  return { ret, M, cap, tm };
}
/* ===END ENGINE */

const ICON = {
  cf: '<circle r="10" fill="#ffe27a" stroke="#7a5208" stroke-width="1.6"/><circle r="6.8" fill="none" stroke="#b8860b" stroke-width="1.2"/><text y="3.6" text-anchor="middle" font-family="KeCoin,Georgia,serif" font-weight="700" font-size="8" fill="#7a5208">KE</text>',
  ch: '<circle r="10" fill="#fff" stroke="#10061f" stroke-width="1.4"/><circle r="7.4" fill="#e0283c"/><circle r="4.6" fill="#fff"/><circle r="2.2" fill="#10061f"/>',
  pa: '<circle r="9.4" fill="#fff" stroke="#10061f" stroke-width="1.4"/><circle cx="-3" cy="-3.2" r="3" fill="#ffd9ae"/><path d="M-6 6 Q0 10 6 6" stroke="#ff8a3d" stroke-width="2" fill="none" stroke-linecap="round"/>',
  ct: '<circle r="10" fill="#ffe27a" stroke="#10061f" stroke-width="1.4"/><circle cx="-3.4" cy="-2.6" r="1.8" fill="#10061f"/><circle cx="3.4" cy="-2.6" r="1.8" fill="#10061f"/><path d="M-6 1.4 Q0 10 6 1.4 Z" fill="#10061f"/><path d="M-2.6 5.4 Q0 8 2.6 5.4" fill="#ff5f7a"/>',
};
const iconSVG = (k, sz) => `<svg viewBox="-12 -12 24 24" width="${sz}" height="${sz}" aria-hidden="true">${ICON[k]}</svg>`;
const pt = (a, r, cx = 150, cy = 150) => { const t = ((a - 90) * Math.PI) / 180; return [cx + r * Math.cos(t), cy + r * Math.sin(t)]; };
const slicePath = (i, a = A, r = 146) => { const p0 = pt(i * a, r), p1 = pt((i + 1) * a, r); return `M150 150 L${p0[0].toFixed(2)} ${p0[1].toFixed(2)} A${r} ${r} 0 0 1 ${p1[0].toFixed(2)} ${p1[1].toFixed(2)} Z`; };
const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const ctColor = (v) => (v === 'D' || v === 'T' ? '#d62f9c' : v <= 10 ? '#3a7bd5' : v <= 25 ? '#2db36b' : v <= 50 ? '#e0a21a' : v <= 200 ? '#e0507a' : '#e0283c');
const ARC = ['#4f8dff', '#3ee07a', '#ffd23f'], ARN = ['bleue', 'verte', 'jaune'];

function wheelTick(v) {
  if (isMuted()) return;
  const ac = audioContext(); if (!ac) return;
  const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
  o.type = 'square'; o.frequency.value = 1500 + Math.random() * 350;
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t + 0.05);
}

// Momentum, exponential friction, then a slow crawl over the last pegs (original curve).
function spinWheel(el, from, to, o = {}) {
  const AA = o.A || A, k = o.k || 0.5, w1 = o.w1 || 14, Th = to - from, th2 = AA * (o.crawl || 1.3), tr = o.tr || 0.55, Tc = (2 * th2) / w1, th1 = Th - th2;
  let w0 = 0, L = 0;
  const sc = (matchMedia('(prefers-reduced-motion: reduce)').matches ? 8 : 1) * (o.turbo ? 1.8 : 1);
  for (let it = 0; it < 4; it++) { w0 = (th1 + L) * k + w1; L = 0; const n = 60; for (let j = 0; j < n; j++) { const t = ((j + 0.5) * tr) / n; L += w0 * Math.exp(-k * t) * (1 - smooth(t / tr)) * (tr / n); } }
  const T1 = Math.log(w0 / w1) / k, total = T1 + Tc, dexpEnd = (w0 - w1) / k - L;
  const ang = (t) => {
    if (t >= total) return to;
    if (t <= T1) {
      const d = (w0 * (1 - Math.exp(-k * t))) / k; let loss = 0;
      if (t < tr) { const m = Math.max(2, Math.ceil((t / tr) * 60)); for (let j = 0; j < m; j++) { const u = ((j + 0.5) * t) / m; loss += w0 * Math.exp(-k * u) * (1 - smooth(u / tr)) * (t / m); } } else loss = L;
      return from + d - loss;
    }
    const tt = t - T1; return from + dexpEnd + w1 * tt - (w1 * tt * tt) / (2 * Tc);
  };
  return new Promise((res) => {
    let t0 = null, prevA = from, prevT = 0, lastN = Math.floor(from / AA);
    const ptr = o.ptr;
    const frame = (ts) => {
      if (t0 === null) t0 = ts;
      const t = ((ts - t0) / 1000) * sc, a = ang(t);
      el.style.transform = `rotate(${a}deg)`;
      const dt = Math.max(0.001, t - prevT), sp = Math.abs(a - prevA) / dt, nn = Math.floor(a / AA);
      if (nn !== lastN) { lastN = nn; wheelTick(sp < 500 ? 0.16 : 0.05); }
      if (ptr) { const fr = (((a % AA) + AA) % AA) / AA, d = fr > 0.6 ? Math.pow((fr - 0.6) / 0.4, 2) * (sp > 200 ? 20 : 28) : 0; ptr.style.transform = `translateX(-50%) rotate(${(-d).toFixed(1)}deg)`; }
      prevA = a; prevT = t;
      o.onFrame?.(Math.min(1, t / total)); // spin progress 0..1, e.g. for a progressive camera zoom
      if (t >= total) { el.style.transform = `rotate(${to}deg)`; if (ptr) ptr.style.transform = 'translateX(-50%)'; res(); return; }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
}

// Rainbow show wheel (owner's reference photo): bright glossy slices, the value in a white oval near the rim, a ring of
// silver beads around the rim and around the hub, a coloured swirl turning in the hub, and a glass glare on top.
function bigWheelSVG() {
  const f = (v) => v.toFixed(2);
  let s = '<g class="mw-wheel">';
  for (let i = 0; i < NS; i++) {
    const k = SEGS[i], ang = ((i + 0.5) * A).toFixed(2);
    s += `<path d="${slicePath(i, A, 141)}" fill="${COL[k]}" stroke="#10061f" stroke-width="1.2"/>`;
    if (isNaN(+k)) s += `<g transform="rotate(${ang} 150 150) translate(150 27) scale(.7)">${ICON[k]}</g>`;
    else s += `<g transform="rotate(${ang} 150 150)"><ellipse cx="150" cy="28" rx="${k.length === 2 ? 8 : 7}" ry="11.5" fill="#fff" stroke="#10061f" stroke-width="1.1"/><text x="150" y="${k.length === 2 ? 32 : 33}" text-anchor="middle" font-family="KeCoin,'Bebas Neue',Impact,sans-serif" font-size="${k.length === 2 ? 11.5 : 14}" fill="#10061f">${k}</text></g>`;
  }
  s += '<circle cx="150" cy="150" r="141" fill="url(#mwShade)"/>';
  for (let b = 0; b < NS; b++) { const p = pt(b * A, 145.5); s += `<circle cx="${f(p[0])}" cy="${f(p[1])}" r="3.3" fill="url(#mwBead)"/>`; }
  s += '</g>';
  // hub: silver beads, a swirl that keeps turning, a dark glass centre for the texts
  let hub = '<circle cx="150" cy="150" r="42" fill="#10061f"/>';
  for (let b = 0; b < 22; b++) { const p = pt((b * 360) / 22, 38); hub += `<circle cx="${f(p[0])}" cy="${f(p[1])}" r="3.6" fill="url(#mwBead)"/>`; }
  hub += '<circle cx="150" cy="150" r="33" fill="#0b0418"/><g class="mw-swirl">';
  const SW = ['#ff3d54', '#ff8a3d', '#ffd23f', '#8bd93b', '#1dd3b0', '#3aa0ff', '#a259ff', '#ff5fa8'];
  for (let k = 0; k < 16; k++) {
    const a0 = k * 22.5, e = pt(a0, 31), c = pt(a0 + 55, 22);
    hub += `<path d="M150 150 Q${f(c[0])} ${f(c[1])} ${f(e[0])} ${f(e[1])}" stroke="${SW[k % 8]}" stroke-width="2.6" fill="none" stroke-linecap="round" opacity=".9"/>`;
  }
  hub += '</g><circle cx="150" cy="150" r="20" fill="url(#mwHub)" stroke="#ffd23f" stroke-width="1.5"/>';
  const glare = '<path d="M40 92 A125 125 0 0 1 128 22 L132 34 A113 113 0 0 0 52 98 Z" fill="#fff" opacity=".16"/><path d="M228 268 A125 125 0 0 0 270 214 L262 210 A116 116 0 0 1 222 260 Z" fill="#fff" opacity=".1"/>';
  return `<svg class="mw-svg" viewBox="0 0 300 300"><defs>
    <radialGradient id="mwHub"><stop offset="0" stop-color="#3b1060"/><stop offset="1" stop-color="#10061f"/></radialGradient>
    <radialGradient id="mwBead" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#fff"/><stop offset=".5" stop-color="#c9ced9"/><stop offset="1" stop-color="#5d6475"/></radialGradient>
    <radialGradient id="mwShade" cx="150" cy="150" r="141" gradientUnits="userSpaceOnUse"><stop offset=".28" stop-color="#000" stop-opacity=".35"/><stop offset=".55" stop-color="#fff" stop-opacity=".08"/><stop offset=".9" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".3"/></radialGradient></defs>
    <circle cx="150" cy="150" r="149.5" fill="#10061f" stroke="#c9ced9" stroke-width="1"/>${s}${hub}${glare}</svg>`;
}

// The showman next to the wheel: idles, grabs the rim and throws the wheel, then cheers or shrugs.
const HOST = `<svg class="mh-svg" viewBox="0 0 140 260" aria-hidden="true">
  <ellipse cx="70" cy="251" rx="42" ry="6" fill="#000" opacity=".35"/>
  <g class="mh-body">
    <path d="M54 176 L52 244 L66 244 L70 188 L74 244 L88 244 L86 176 Z" fill="#1a1030"/>
    <ellipse cx="57" cy="246" rx="11" ry="5" fill="#0b0614"/><ellipse cx="84" cy="246" rx="11" ry="5" fill="#0b0614"/>
    <path d="M46 106 Q28 128 36 150 Q42 160 52 156" fill="none" stroke="#c8102e" stroke-width="13" stroke-linecap="round"/>
    <circle cx="52" cy="155" r="7" fill="#fff" stroke="#d6d6e6" stroke-width="1.5"/>
    <path d="M44 100 Q70 90 96 100 L100 182 L80 182 L70 152 L60 182 L40 182 Z" fill="#c8102e" stroke="#7a0a1c" stroke-width="2"/>
    <path d="M62 98 L70 142 L78 98 Z" fill="#fff"/>
    <path d="M62 98 L57 132 L68 123 Z M78 98 L83 132 L72 123 Z" fill="#ffd23f"/>
    <circle cx="70" cy="120" r="2" fill="#1a1030"/><circle cx="70" cy="131" r="2" fill="#1a1030"/>
    <path d="M59 95 L70 101 L59 107 Z M81 95 L70 101 L81 107 Z" fill="#ffd23f"/><circle cx="70" cy="101" r="3" fill="#ffb000"/>
    <g class="mh-head">
      <rect x="64" y="82" width="12" height="12" fill="#e9b588"/>
      <circle cx="49" cy="70" r="5" fill="#f6c99b"/><circle cx="91" cy="70" r="5" fill="#f6c99b"/>
      <circle cx="70" cy="68" r="21" fill="#f6c99b" stroke="#c98d5c" stroke-width="1.5"/>
      <circle cx="57" cy="76" r="4" fill="#ff8a8a" opacity=".55"/><circle cx="83" cy="76" r="4" fill="#ff8a8a" opacity=".55"/>
      <g class="mh-eyes"><ellipse cx="62" cy="66" rx="3" ry="4" fill="#1a1030"/><ellipse cx="78" cy="66" rx="3" ry="4" fill="#1a1030"/><circle cx="63" cy="64.5" r="1" fill="#fff"/><circle cx="79" cy="64.5" r="1" fill="#fff"/></g>
      <path d="M57 58 Q62 55 66 58 M74 58 Q78 55 83 58" stroke="#3b2414" stroke-width="2.2" fill="none" stroke-linecap="round"/>
      <path class="mh-smile" d="M62 81 Q70 90 78 81 Z" fill="#7a1d1d" stroke="#7a1d1d" stroke-width="2" stroke-linejoin="round"/>
      <path d="M70 75 Q62 71 56 76 Q52 79 49 75 Q53 84 62 80 Q67 78 70 78 Q73 78 78 80 Q87 84 91 75 Q88 79 84 76 Q78 71 70 75 Z" fill="#3b2414"/>
      <g class="mh-hat"><ellipse cx="70" cy="49" rx="28" ry="6" fill="#1a1030"/><rect x="53" y="17" width="34" height="32" rx="3" fill="#1a1030"/><rect x="53" y="37" width="34" height="7" fill="#ff3d6e"/><ellipse cx="70" cy="17" rx="17" ry="3.5" fill="#2a1a48"/></g>
    </g>
    <g class="mh-arm">
      <path d="M94 104 L120 98 L134 78" fill="none" stroke="#c8102e" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="135" cy="74" r="8" fill="#fff" stroke="#d6d6e6" stroke-width="1.5"/>
    </g>
  </g>
</svg>`;

class MadWheelGame extends BaseGame {
  constructor(root, game, ov) {
    super(root, game, mergeOpts(ov, {
      music: EXTRA_THEMES.madwheel, stepper: false, autoplay: true, mainLabel: 'LANCER', betLabel: 'Mise totale',
      cls: 'table-game',
      head: '<div class="hist mw-hist"></div>',
      stage: `<div class="mw-top"><small>TOP SLOT</small><b class="tsv">—</b></div>
        <div class="mw-view"><div class="mw-zone"><div class="mw-ptr"></div>${bigWheelSVG()}<div class="mw-hub">ROUE<br>FOLLE</div><div class="mw-host">${HOST}</div></div></div>`,
      below: `<div class="felt mw-felt"><div class="mw-spots">${SPOTS.map((k) => `<button class="mw-spot" data-k="${k}" style="--sc:${COL[k]}"><b>${isNaN(+k) ? iconSVG(k, 30) : k}</b><small>${HINT[k]}</small></button>`).join('')}</div>${BetBoard.chipsHTML()}</div>`,
      hello: 'Pose tes jetons sur les cases puis lance la roue.',
    }));
    this.cur = 0;
    this.histArr = [];
    this.board = new BetBoard(this, this.q('.mw-felt'), null);
    this.board.paint();
    this.wheel = this.q('.mw-wheel');
    this.host = this.q('.mw-host');
  }

  pose(cls, ms = 0) {
    clearTimeout(this.poseT);
    this.host.className = 'mw-host' + (cls ? ' ' + cls : '');
    if (ms) this.poseT = setTimeout(() => { if (!this.dead) this.host.className = 'mw-host'; }, ms);
  }

  stakeLabel() { return this.board ? this.board.total() : 0; }
  chipSound() { sfx.click(); }
  onMeters() { if (this.mainBtn) this.mainBtn.disabled = !this.auto && (this.busy || !this.board?.total()); }

  histAdd(seg) {
    this.histArr.unshift(seg);
    this.histArr = this.histArr.slice(0, 12);
    this.q('.mw-hist').innerHTML = this.histArr.map((s) => `<span style="background:${COL[s]}">${isNaN(+s) ? iconSVG(s, 16) : s}</span>`).join('');
  }

  onMain() {
    // automatic spins: the last bets go back on the table for each spin
    if (!this.board.total() && this.auto) { this.board.rebet(true); this.board.paint(); }
    if (!this.board.total()) { this.stopAuto(); return; }
    this.round(async () => {
      const placed = {}, tt = this.board.total();
      SPOTS.forEach((k) => { placed[k] = this.board.bets[k] || 0; });
      if (!this.pay(tt)) return;
      this.lastStake = tt;
      this.board.last = Object.fromEntries(Object.entries(placed).filter(([, v]) => v));
      this.focusStage();
      this.setLast(0); this.winAmt.textContent = '';
      await this.play(outcome(), placed);
      this.board.afterRound();
    });
  }

  // Plays a drawn round on screen (Top Slot, wheel, bonus) and pays the bets in `placed`.
  // arrow: the Méga Folie arrow (chosen by the player alone; drawn for each player at an online table).
  async play(O, placed, ctx = {}) {
    this.q('.mw-hl')?.remove();
    this.qa('.mw-spot').forEach((b) => b.classList.remove('hit', 'tsel'));
    this.msg('Top Slot…');
    this.q('.mw-hub').innerHTML = 'TOP<br>SLOT';
    const top = O.top, tv = this.q('.tsv'), topBox = this.q('.mw-top');
    topBox.classList.add('rolling');
    const t0 = performance.now();
    while (performance.now() - t0 < (this.turbo ? 600 : 1400)) {
      const k = SPOTS[Math.floor(Math.random() * 8)];
      tv.innerHTML = `${isNaN(+k) ? iconSVG(k, 18) : k} ×${wpick(TM)}`;
      sfx.tick();
      await sleep(80);
    }
    topBox.classList.remove('rolling');
    tv.innerHTML = top ? `${isNaN(+top.seg) ? iconSVG(top.seg, 18) + ' ' + NAME[top.seg] : 'Case ' + top.seg} ×${top.m}` : 'Pas de multiplicateur';
    if (top) { topBox.classList.add('hit'); this.q(`.mw-spot[data-k="${top.seg}"]`)?.classList.add('tsel'); sfx.upgrade(); const p = center(topBox); fx.burst(p.x, p.y, 24, ['#ffd23f', '#fff', '#ff3d6e']); }
    await this.wait(600);
    this.msg('Les jeux sont faits…');
    this.q('.mw-hub').innerHTML = 'C’EST<br>PARTI';
    const idx = O.idx, seg = O.seg;
    const delta = ((-(idx + 0.5) * A - this.cur) % 360 + 360) % 360;
    const from = this.cur;
    this.cur += 360 * 6 + delta + (Math.random() - 0.5) * A * 0.7;
    // the showman grabs the rim, then throws the wheel
    this.pose('ready');
    await this.wait(380);
    this.pose('pull');
    await this.wait(260);
    setTimeout(() => { if (!this.dead && this.host.classList.contains('pull')) this.pose('watch'); }, this.turbo ? 300 : 600);
    // long slow crawl over the last slices, with the camera already zooming in on the pointer
    this.zoomStart();
    await spinWheel(this.wheel, from, this.cur, { ptr: this.q('.mw-ptr'), k: 0.68, w1: 9, crawl: 2.2, turbo: this.turbo, onFrame: (p) => this.zoomTo(p) });
    topBox.classList.remove('hit');
    this.histAdd(seg);
    this.q('.mw-hub').innerHTML = isNaN(+seg) ? iconSVG(seg, 34) : `<b class="big">${seg}</b>`;
    this.wheel.insertAdjacentHTML('beforeend', `<path class="mw-hl" d="${slicePath(idx, A, 141)}" fill="#fff"/>`);
    await this.zoomOnResult(seg);
    this.q(`.mw-spot[data-k="${seg}"]`)?.classList.add('hit');
    const p = center(this.q('.mw-ptr')); fx.burst(p.x, p.y + 20, 30, [COL[seg], '#fff']);
    const lines = [];
    const b = placed[seg] || 0, tm = top && top.seg === seg ? top.m : 1;
    this.pose(b > 0 ? 'cheer' : 'sad', 1800);
    if (isNaN(+seg) && b > 0) dispatchEvent(new CustomEvent('sb:bonus', { detail: { game: this.game.id, key: seg } })); // Défi spécial (special.js)
    let arrow = ctx.arrow ?? (ctx.seed ? arrowOf(ctx.seed, this.room?.me) : undefined);
    // a bonus is played when there is a stake on it (always at an online table: everyone watches)
    if (isNaN(+seg) && (b > 0 || this.online)) {
      this.msg(`Bonus : ${NAME[seg]} !`);
      sfx.feature();
      await this.wait(900);
      if (seg === 'cf') await this.bonusCF(tm, O.cf);
      else if (seg === 'ch') await this.bonusCH(tm, O);
      else if (seg === 'pa') await this.bonusPA(tm, O.pa);
      else arrow = await this.bonusCT(tm, O.ct, arrow);
    }
    const { ret, M, cap } = payout(O, placed, arrow ?? 0);
    if (b > 0) {
      if (!isNaN(+seg)) lines.push(`Tu gagnes ${fmtC(ret - b)}${tm > 1 ? ` (Top Slot ×${tm})` : ''}`);
      else lines.push(M > 0 ? `${NAME[seg]} : ×${M * tm} → ${fmtC(ret - b)}` : `${NAME[seg]} : perdu`);
    } else lines.push(`La roue s’arrête sur ${isNaN(+seg) ? NAME[seg] : seg}.${Object.keys(placed).length ? ' Pas de mise dessus.' : ''}`);
    const all = Object.values(placed).reduce((a, x) => a + x, 0);
    this.msg(lines.join(' · ') + (cap ? ' · GAIN MAXIMUM !' : '') + (all ? ` · Bilan : ${ret - all >= 0 ? '+' : '−'}${fmtC(Math.abs(ret - all))}` : ''));
    if (ret > 0) {
      this.win(ret, isNaN(+seg) ? NAME[seg] : null);
      this.setLast(ret);
      if (ret > b) await this.celebrate(ret, { summary: isNaN(+seg) ? NAME[seg].toUpperCase() : null, quick: this.online });
    }
    return ret;
  }

  // The camera closes in on the pointer for the whole spin: slowly at first, then faster, fully in at the stop.
  zoomStart() {
    const view = this.q('.mw-view');
    if (!view) return;
    view.classList.remove('done', 'unzoom');
    view.classList.add('zooming');
    this.zoomTo(0);
  }
  zoomTo(p) {
    const view = this.q('.mw-view');
    if (!view || this.dead) return;
    const e = p * p * (3 - 2 * p) * 0.35 + Math.pow(p, 2.2) * 0.65; // gentle start, steady build, no jump at the end
    view.style.setProperty('--zs', (1 + (ZOOM_MAX - 1) * e).toFixed(4));
    view.style.setProperty('--zp', e.toFixed(3));
  }

  // Once stopped: the result label pops up, the camera holds, then pulls back.
  async zoomOnResult(seg) {
    const view = this.q('.mw-view');
    if (!view || this.dead) return;
    this.zoomTo(1);
    view.dataset.seg = isNaN(+seg) ? NAME[seg] : seg;
    view.style.setProperty('--seg', COL[seg]);
    view.classList.add('done');
    sfx.upgrade();
    await this.wait(1600);
    if (this.dead) return;
    view.classList.add('unzoom');
    view.style.setProperty('--zs', 1);
    view.style.setProperty('--zp', 0);
    await this.wait(900);
    view.classList.remove('zooming', 'done', 'unzoom');
  }

  /* ---------- bonus screens ---------- */
  openOv(html) {
    this.ov = this.overlay(`<div class="mw-ov-in">${html}</div>`, 'mw-ov');
    return this.ov;
  }
  closeOv() { const o = this.ov; if (!o) return; o.classList.add('out'); setTimeout(() => o.remove(), 300); this.ov = null; }
  ovp(t) { const p = this.ov?.querySelector('.msgov'); if (p) p.innerHTML = t; }
  // a tap on one of els; online, a random one after ms if the player does not choose
  waitTap(els, ms = 0) {
    return new Promise((res) => {
      let done = false; const go = (i) => { if (done) return; done = true; clearTimeout(t); res(i); };
      els.forEach((e, i) => { e.onclick = () => go(i); });
      const t = ms ? setTimeout(() => go(Math.floor(Math.random() * els.length)), ms) : 0;
    });
  }
  tmTxt(tm) { return tm > 1 ? ` <b class="tm">Top Slot ×${tm}</b>` : ''; }

  async bonusCF(tm, r = coinRun()) {
    this.openOv(`<h2>Pile ou Face</h2><p class="msgov">La pièce va tourner…${this.tmTxt(tm)}</p>
      <div class="coin3d"><div class="cface r">×${r.v[0] * tm}</div><div class="cface b">×${r.v[1] * tm}</div></div>
      <p class="sub">Rouge ×${r.v[0] * tm} · Bleu ×${r.v[1] * tm}</p>`);
    await this.wait(1400);
    const coin = this.ov.querySelector('.coin3d');
    coin.style.transform = `rotateY(${r.face === 0 ? 1800 : 1980}deg)`;
    sfx.spin();
    await sleep(this.turbo ? 2000 : 3700);
    const p = center(coin); fx.burst(p.x, p.y, 50, r.face === 0 ? ['#ef4444', '#fff'] : ['#3b82f6', '#fff'], 9);
    this.ovp(`${r.face === 0 ? 'Rouge' : 'Bleu'} ! ×${r.M * tm}`);
    sfx.bigWin();
    await this.wait(1700);
    this.closeOv();
    return r.M;
  }

  async bonusCH(tm, O) {
    const bd = O ? O.bd : chBoard();
    this.openOv(`<h2>Chasse au Cash</h2><p class="msgov">Mémorise les multiplicateurs… ils vont se mélanger !${this.tmTxt(tm)}</p><div class="grid12">${bd.map((v) => `<button class="ch-t${v >= 80 ? ' hi' : ''}">${v}</button>`).join('')}</div>`);
    const btns = [...this.ov.querySelectorAll('.ch-t')];
    await this.wait(3000);
    for (let i = 0; i < btns.length; i++) { const b = btns[i]; setTimeout(() => { b.textContent = '🎯'; b.classList.remove('hi'); b.classList.add('hidden'); }, (i % 12) * 30); }
    sfx.spin();
    await sleep(500);
    this.ovp(this.online ? 'Choisis une cible ! (choix auto dans 8 s)' : 'Choisis une cible !');
    const idx = await this.waitTap(btns, this.online ? 8000 : 0);
    const m = O ? O.chm : bd[Math.floor(Math.random() * 108)];
    btns.forEach((b) => { b.onclick = null; });
    const rest = bd.slice(); const pos = rest.indexOf(m); if (pos > -1) rest.splice(pos, 1); shuffle(rest);
    btns[idx].textContent = '×' + m; btns[idx].classList.add('pick');
    const p = center(btns[idx]); fx.burst(p.x, p.y, 40, ['#8bd93b', '#fff', '#fde047'], 8);
    sfx.bigWin();
    this.ovp(`Tu as touché ×${m}${tm > 1 ? ` → ×${m * tm} avec le Top Slot` : ''} !`);
    await this.wait(900);
    let j = 0; btns.forEach((b, i) => { if (i !== idx) { b.textContent = rest[j++]; b.classList.remove('hidden'); b.classList.add('dimmed'); } });
    await this.wait(1800);
    this.closeOv();
    return m;
  }

  async bonusPA(tm, run = pachRun()) {
    const X = (r, k) => 170 + (2 * k - r) * 10, Y = (r) => 26 + r * 20;
    let pegs = '';
    for (let r = 0; r < 15; r++) for (let j = 0; j <= r; j++) pegs += `<i class="peg" style="left:${X(r, j)}px;top:${Y(r) + 10}px"></i>`;
    let slots = '';
    for (let s = 0; s < 16; s++) slots += `<div class="pslot${PV[s] === 'D' ? ' d' : ''}" data-s="${s}" style="left:${X(15, s)}px">${PV[s] === 'D' ? '×2' : PV[s]}</div>`;
    this.openOv(`<h2>Pachinko</h2><p class="msgov">Le palet tombe…${this.tmTxt(tm)}</p><div class="pach">${pegs}${slots}<i class="puck" style="left:170px;top:8px"></i></div>`);
    const puck = this.ov.querySelector('.puck'), sl = [...this.ov.querySelectorAll('.pslot')];
    for (const dr of run.drops) {
      sl.forEach((el, s) => { el.classList.remove('hit'); el.textContent = dr.vals[s] === 'D' ? '×2' : dr.vals[s]; });
      puck.style.transition = 'none'; puck.style.left = '170px'; puck.style.top = '8px'; void puck.offsetWidth; puck.style.transition = '';
      await this.wait(450);
      let k = 0;
      for (let st = 0; st < 15; st++) { k += dr.path[st]; puck.style.left = X(st + 1, k) + 'px'; puck.style.top = Y(st) + 22 + 'px'; sfx.tick(); await sleep(this.turbo ? 70 : 140); }
      puck.style.top = '340px';
      await sleep(350);
      sl[dr.k].classList.add('hit');
      const p = center(sl[dr.k]); fx.burst(p.x, p.y, 30, ['#ff8a3d', '#fff', '#fde047']);
      if (dr.vals[dr.k] === 'D') { this.ovp('DOUBLE ! Tous les multiplicateurs ×2, on relance…'); sfx.upgrade(); this.flash('rgba(255,138,61,.6)'); await this.wait(1600); }
      else { this.ovp(`Palet sur ×${dr.vals[dr.k]}${tm > 1 ? ` → ×${dr.vals[dr.k] * tm} avec le Top Slot` : ''} !`); sfx.bigWin(); await this.wait(1800); }
    }
    this.closeOv();
    return run.M;
  }

  miniWheel(mult) {
    let s = '';
    for (let i = 0; i < 64; i++) {
      const t = CTSEQ[i], lab = t === 'D' ? '×2' : t === 'T' ? '×3' : String(t * mult);
      s += `<path d="${slicePath(i, CTA, 124)}" fill="${ctColor(t)}" stroke="#10061f" stroke-width=".7"/>`;
      s += `<text class="mt" x="150" y="44" text-anchor="middle" dominant-baseline="middle" font-family="KeCoin,Archivo,Impact,sans-serif" font-weight="900" font-size="${lab.length > 3 ? 6.4 : 7.6}" fill="#fff" stroke="#10061f" stroke-width=".35" paint-order="stroke" transform="rotate(${((i + 0.5) * CTA).toFixed(2)} 150 150) rotate(90 150 44)">${lab}</text>`;
    }
    return s;
  }

  async bonusCT(tm, runs = null, arrow) {
    this.openOv(`<h2>Méga Folie</h2><p class="msgov">${arrow != null ? 'Ta flèche est tirée au sort…' : 'Choisis la couleur de ta flèche !'}${this.tmTxt(tm)}</p>
      <div class="flaps">${ARC.map((c, i) => `<button class="apick" style="--c:${c}">▼<small>${ARN[i][0].toUpperCase() + ARN[i].slice(1)}</small></button>`).join('')}</div>
      <p class="sub">La roue tourne : là où ta flèche s’arrête, c’est ton multiplicateur.</p>`);
    let ch;
    if (arrow != null) { ch = arrow; const bt = this.ov.querySelectorAll('.apick')[ch]; bt?.classList.add('on'); await this.wait(1200); } else ch = await this.waitTap([...this.ov.querySelectorAll('.apick')]);
    const run = runs ? runs[ch] : ctRun(ch);
    this.ov.remove();
    let arrows = '';
    for (let c = 0; c < 3; c++) arrows += `<g transform="rotate(${CTARR[c]} 150 150)" opacity="${ch === c ? 1 : 0.45}"><polygon points="150,27 138,1 162,1" fill="${ARC[c]}" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></g>`;
    this.openOv(`<h2>Méga Folie</h2><p class="msgov">Flèche ${ARN[ch]} : la roue tourne…${this.tmTxt(tm)}</p>
      <div class="mw-mini"><svg viewBox="0 0 300 300"><circle cx="150" cy="150" r="127" fill="#fff2b0"/><g class="mwheel">${this.miniWheel(1)}</g>${arrows}</svg></div>`);
    await this.wait(800);
    const wh = this.ov.querySelector('.mwheel');
    let rot = 0, mult = 1;
    for (const sp of run.spins) {
      const delta = ((sp.phi - rot) % 360 + 360) % 360, from = rot;
      rot += 360 * 4 + delta;
      await spinWheel(wh, from, rot, { A: CTA, k: 0.8, w1: 20, turbo: this.turbo });
      const seg = CTSEQ[sp.idx[ch]];
      wh.insertAdjacentHTML('beforeend', `<path class="mw-hl" d="${slicePath(sp.idx[ch], CTA, 124)}" fill="#fff"/>`);
      if (seg === 'D' || seg === 'T') {
        mult *= seg === 'D' ? 2 : 3;
        this.ovp(`${seg === 'D' ? 'DOUBLE' : 'TRIPLE'} ! Tous les montants de la roue sont multipliés, on relance…`);
        this.flash('rgba(214,47,156,.6)'); sfx.upgrade();
        await this.wait(1400);
        const mt = this.ov.querySelectorAll('text.mt');
        mt.forEach((t, q) => { const v = CTSEQ[q]; if (v !== 'D' && v !== 'T') t.textContent = String(v * mult); });
        this.ov.querySelector('.mw-hl')?.remove();
      }
    }
    const vals = run.idx.map((i) => { const t = CTSEQ[i]; return t === 'D' || t === 'T' ? '?' : t * mult; });
    const others = [0, 1, 2].filter((c) => c !== ch).map((c) => `${ARN[c]} ×${vals[c]}`).join(' · ');
    this.ovp(`Ta flèche ${ARN[ch]} s’arrête sur ×${run.M}${tm > 1 ? ` → ×${run.M * tm} avec le Top Slot` : ''} ! <small>(les autres : ${others})</small>`);
    sfx.jackpot(); fx.confetti(80);
    await this.wait(3000);
    this.closeOv();
    return ch;
  }

  destroy() { this.ov?.remove(); super.destroy(); }

  info() {
    return this.rules(`<h4>La roue</h4><p>54 cases : 1 (×22), 2 (×15), 5 (×7), 10 (×4) et 6 cases bonus (Pile ou Face ×2, Pachinko ×2, Chasse au Cash ×1, Méga Folie ×1). Mise sur une ou plusieurs cases : un chiffre paie autant de fois la mise (1 pour 1, 2 pour 1…), mise rendue en plus.</p>
      <h4>Top Slot</h4><p>Avant chaque tour, le Top Slot peut tirer une case et un multiplicateur de ×2 à ×50. Si la roue s’arrête sur cette case, son gain est multiplié.</p>
      <h4>Les 4 bonus</h4><ul class="rules"><li>${iconSVG('cf', 18)} <b>Pile ou Face</b> : une pièce, deux multiplicateurs.</li><li>${iconSVG('ch', 18)} <b>Chasse au Cash</b> : 108 multiplicateurs mélangés, choisis une cible.</li><li>${iconSVG('pa', 18)} <b>Pachinko</b> : le palet tombe dans une case ; ×2 double tout et on relance.</li><li>${iconSVG('ct', 18)} <b>Méga Folie</b> : choisis ta flèche, la roue géante peut doubler ou tripler.</li></ul>
      <p>Gain maximum ×25 000 la mise d’une case.</p>`);
  }
}

// La Roue Folle Online: the same Top Slot, wheel and bonuses for the whole salon (online.js, withRoom).
const MadWheelOnlineGame = withRoom(MadWheelGame, {
  cls: 'g-madwheel',
  outcome: (R) => outcome(R),
  payout: (O, d, { uid, seed }) => payout(O, d, O.seg === 'ct' ? arrowOf(seed, uid) : 0).ret,
  resultMs: (O) => 19000 + (O.seg === 'cf' ? 6000 : O.seg === 'ch' ? 14000 : O.seg === 'pa' ? 2000 + O.pa.drops.length * 3000 : O.seg === 'ct' ? 4000 + Math.max(...O.ct.map((r) => r.spins.length)) * 4500 : 0),
  reset() { this.q('.mw-hl')?.remove(); this.qa('.mw-spot').forEach((b) => b.classList.remove('hit', 'tsel')); this.q('.mw-hub').innerHTML = 'ROUE<br>FOLLE'; this.q('.tsv').textContent = '—'; },
  hello: 'Pose tes jetons puis appuie sur PRÊT : la roue part quand tout le salon est prêt.',
  rules: '<p>À la Méga Folie, la couleur de ta flèche est tirée au sort pour chaque joueur. À la Chasse au Cash, tout le salon gagne le même multiplicateur.</p>',
});

return { MadWheelGame, MadWheelOnlineGame, outcome };
})();
