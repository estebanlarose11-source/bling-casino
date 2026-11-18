// SpinBet Casino · MadWheelGame — loaded on demand by games/impl/index.js (index.html).
// ---- games/impl/madwheel.js ----
__mods['games/impl/madwheel.js'] = (() => {
// La Roue Folle: the TV show of the owner (his host throws the wheel in his videos, our 54-case wheel on it), the Boost and
// the four bonus games keep the original odds; the bonuses can be bought (about 88 %).

const { BaseGame, fmtC, wpick } = __mods['core/base.js'];
const { BetBoard } = __mods['core/roulette.js'];
const { EXTRA_THEMES } = __mods['core/music.js'];
const { sfx, audioContext, isMuted, duck } = __mods['audio.js'];
const { fx, sleep, center } = __mods['fx.js'];
const { mergeOpts, withRoom, wpickR, rng } = __mods['online.js'];

/* ===ENGINE (original) */
// 54 cases spread evenly around the wheel; with the Top Slot odds below every spot returns about 94 %.
const SEG_COUNT = [['1', 22, 0.5], ['2', 15, 0.5], ['5', 7, 0.5], ['10', 4, 0.5], ['cf', 2, 0.3], ['pa', 2, 0.7], ['ch', 1, 0.25], ['ct', 1, 0.75]];
const SEGS = SEG_COUNT.flatMap(([k, n, ph], j) => Array.from({ length: n }, (_, i) => ({ k, at: (i + ph) / n + j * 1e-4 }))).sort((a, b) => a.at - b.at).map((x) => x.k);
const NS = SEGS.length, A = 360 / NS;
const COL = { 1: '#f5c518', 2: '#3aa0ff', 5: '#ff5fa8', 10: '#a259ff', cf: '#1dd3b0', ch: '#8bd93b', pa: '#ff8a3d', ct: '#ff3d54' };
const NAME = { 1: '1', 2: '2', 5: '5', 10: '10', cf: 'Pile ou Face', ch: 'Tir aux Cibles', pa: 'Pachinko', ct: 'Méga Folie' };
const SPOTS = ['1', '2', '5', '10', 'cf', 'ch', 'pa', 'ct'];
const HINT = { 1: '1 pour 1', 2: '2 pour 1', 5: '5 pour 1', 10: '10 pour 1', cf: 'Pile ou Face', ch: 'Tir aux Cibles', pa: 'Pachinko', ct: 'Méga Folie' };
const TM = [[2, 30], [3, 20], [5, 18], [7, 10], [10, 9], [15, 5], [20, 3.5], [25, 2.5], [30, 1.5], [50, 0.5]];
const TQ = { 1: 0.0562, 2: 0.0351, 5: 0.0458, 10: 0.0309, cf: 0.1141, ch: 0.1335, pa: 0.1369, ct: 0.0986 };
const CL = [[4, 24], [6, 19], [8, 15], [10, 12], [14, 10], [20, 8], [30, 5.5], [40, 3.5], [100, 2], [200, 1.23]];
const CHB = { 10: 26, 12: 18, 14: 14, 16: 11, 18: 8, 20: 8, 24: 6, 30: 5, 40: 4, 50: 3, 60: 2, 80: 1, 200: 1, 950: 1 };
const PV = [500, 250, 100, 50, 25, 'D', 8, 5, 5, 8, 'D', 25, 50, 100, 250, 500];
// Méga Folie (the owner's wheel with 3 arrows, its cases rubbed out): 32 cases of medium and big multipliers, 1 DOUBLE and
// 1 TRIPLE (everything ×2 / ×3, spin again); the 3 arrows (red, yellow, blue) are where his video has them (−27°, 2°, 32°).
const CTC = { 10: 11, 15: 7, 20: 4, 25: 3, 50: 2, 100: 2, 200: 1 }, CTN = 32, CTSEQ = [], CTA = 360 / CTN, CTARR = [-27, 2, 32];
(() => {
  // big ones spread around, the DOUBLE and TRIPLE facing each other, never two equal neighbours
  const vals = []; for (const v in CTC) for (let i = 0; i < CTC[v]; i++) vals.push(+v);
  vals.sort((a, b) => b - a);
  const P = []; for (let q = 0; q < CTN; q++) if (q !== 4 && q !== 20) P.push(q);
  const at = {}; vals.forEach((v, k) => { at[P[(k * 7) % P.length]] = v; });
  for (let q = 0; q < CTN; q++) CTSEQ.push(q === 4 ? 'D' : q === 20 ? 'T' : at[q]);
})();
const CAPX = 25000;
const ZOOM_MAX = 2.4; // camera zoom on the pointer when the wheel stops
const shuffle = (a, R = Math.random) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
// every draw takes its random source R (Math.random, or the shared seed of an online table)
function drawTop(R = Math.random) { const r = R(); let a = 0; for (const k in TQ) { a += TQ[k]; if (r < a) return { seg: k, m: wpickR(R, TM) }; } return null; }
// Tir aux Cibles: the 132 ducks of the owner's video, each with a multiplier drawn at random (odds of CHB), new ones every time
const NDUCK = 132, CHW = Object.entries(CHB).map(([v, n]) => [+v, n]);
function chBoard(R = Math.random) { return Array.from({ length: NDUCK }, () => wpickR(R, CHW)); }
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
  else if (seg === 'ch') { O.bd = chBoard(R); O.chm = O.bd[Math.floor(R() * NDUCK)]; }
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
/* BTRACK */ const BTRACK = {"pa":{"w":672,"h":448,"box":[0.0,3.571,75.0,91.964],"at":3.8333,"loop":3.0,"rows":9,"cols":12,"f":[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99,100,101,102,103]},"ch":{"w":672,"h":448,"box":[5.357,0.0,69.643,93.75],"ducks":[[12.77,8.98],[17.6,9.41],[22.49,10.22],[27.23,10.06],[31.94,10.41],[36.53,10.57],[41.06,11.1],[45.53,11.66],[49.91,11.68],[54.27,11.88],[58.59,12.64],[62.79,12.37],[12.72,16.43],[17.82,17.02],[22.46,16.82],[27.22,17.13],[31.91,17.58],[36.51,16.88],[41.09,17.98],[45.54,18.35],[49.96,18.52],[54.27,19.07],[58.58,19.03],[62.88,19.52],[12.73,23.76],[17.58,24.02],[22.45,24.21],[27.23,24.99],[31.92,24.72],[36.5,24.9],[41.19,25.49],[45.55,25.22],[49.95,25.46],[54.37,26.05],[58.61,25.85],[62.8,25.91],[12.85,31.65],[17.6,31.9],[22.42,31.55],[27.22,31.7],[31.9,31.89],[36.52,31.99],[41.09,32.27],[45.63,32.91],[49.94,32.5],[54.34,32.47],[58.72,33.18],[62.96,31.93],[12.7,38.67],[17.56,38.9],[22.44,38.15],[27.21,39.02],[31.91,38.14],[36.51,39.7],[41.11,39.39],[45.57,39.44],[49.98,39.0],[54.39,38.15],[58.88,39.68],[62.88,39.56],[12.66,46.26],[17.66,45.45],[22.42,46.26],[27.21,46.28],[31.92,46.42],[36.51,46.46],[41.11,46.56],[45.64,46.26],[49.98,46.28],[54.39,46.42],[58.83,46.46],[62.98,46.55],[12.72,52.81],[17.58,53.7],[22.41,53.79],[27.3,54.26],[31.91,53.78],[36.45,52.78],[41.14,53.72],[45.61,53.78],[50.07,54.26],[54.38,53.78],[58.77,52.78],[63.01,53.72],[12.65,61.27],[17.54,61.26],[22.41,61.2],[27.27,60.44],[31.86,61.55],[36.51,61.06],[41.13,61.01],[45.63,61.19],[50.04,60.44],[54.33,61.55],[58.83,61.06],[63.0,61.01],[12.61,68.96],[17.04,69.56],[22.52,69.25],[27.18,68.6],[31.92,68.45],[36.5,68.37],[41.15,68.3],[45.62,67.2],[49.95,68.59],[54.38,68.44],[58.83,68.37],[63.02,68.3],[12.57,76.61],[17.52,76.47],[22.38,76.22],[27.23,75.25],[31.89,75.98],[36.53,75.64],[41.13,75.59],[45.63,75.42],[50.04,75.14],[54.47,74.2],[58.79,74.81],[63.02,74.77],[12.57,84.25],[17.56,83.21],[22.35,83.84],[27.18,83.61],[31.93,83.26],[36.53,82.29],[41.15,82.83],[45.63,82.66],[50.15,83.05],[54.44,82.22],[58.78,82.01],[63.84,82.22]],"rows":13,"cols":12,"f":[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99,100,101,102,103,104,105,106,107,108,109,110,111,112,113,114,115,116,117,118,119,120,121,122,123,124,125,126,127,128,129,130,131,132,133,134,135,136,137,138,139,140,141,142,143,144]},"ct":{"w":672,"h":448,"box":[8.333,0.0,67.262,87.5],"at":3.9167,"loop":3.0,"rows":9,"cols":12,"f":[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99,100,101,102,103,104,105]}}; /* /BTRACK */

const ICON = {
  cf: '<circle r="10" fill="#ffe27a" stroke="#7a5208" stroke-width="1.6"/><circle r="6.8" fill="none" stroke="#b8860b" stroke-width="1.2"/><text y="3.6" text-anchor="middle" font-family="KeCoin,Georgia,serif" font-weight="700" font-size="8" fill="#7a5208">KE</text>',
  ch: '<circle r="10" fill="#fff" stroke="#10061f" stroke-width="1.4"/><circle r="7.4" fill="#e0283c"/><circle r="4.6" fill="#fff"/><circle r="2.2" fill="#10061f"/>',
  pa: '<circle r="9.4" fill="#fff" stroke="#10061f" stroke-width="1.4"/><circle cx="-3" cy="-3.2" r="3" fill="#ffd9ae"/><path d="M-6 6 Q0 10 6 6" stroke="#ff8a3d" stroke-width="2" fill="none" stroke-linecap="round"/>',
  ct: '<circle r="10" fill="#ffe27a" stroke="#10061f" stroke-width="1.4"/><circle cx="-3.4" cy="-2.6" r="1.8" fill="#10061f"/><circle cx="3.4" cy="-2.6" r="1.8" fill="#10061f"/><path d="M-6 1.4 Q0 10 6 1.4 Z" fill="#10061f"/><path d="M-2.6 5.4 Q0 8 2.6 5.4" fill="#ff5f7a"/>',
};
const iconSVG = (k, sz) => `<svg viewBox="-12 -12 24 24" width="${sz}" height="${sz}" aria-hidden="true">${ICON[k]}</svg>`;
const pt = (a, r, cx = 150, cy = 150) => { const t = ((a - 90) * Math.PI) / 180; return [cx + r * Math.cos(t), cy + r * Math.sin(t)]; };
const slicePath = (i, a = A, r = 146, cx = 150) => { const p0 = pt(i * a, r, cx, cx), p1 = pt((i + 1) * a, r, cx, cx); return `M${cx} ${cx} L${p0[0].toFixed(2)} ${p0[1].toFixed(2)} A${r} ${r} 0 0 1 ${p1[0].toFixed(2)} ${p1[1].toFixed(2)} Z`; };
const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const ARC = ['#e8222f', '#ffd21f', '#2563eb'], ARN = ['rouge', 'jaune', 'bleue']; // the 3 arrows of the owner's wheel, left to right
const CTPAL = ['#e0283c', '#7b2fbf', '#1f6fe0', '#0ea5b7', '#f97316', '#16a34a', '#c026d3', '#2b3bd6'];
const CTTIP = [[97.3, 47.3], [154.2, 45.8], [211.8, 51]];
const BCROP = { pa: [0, 600], ch: [40, 520], ct: [40, 520], pf: [0, 672] }; // x, width (pixels of the 672 of the video): her face stays in
const PF_AT = 8.8; // Pile ou Face: the face of the puck is seen in the jar (s of b-pf-*.mp4, tools/art/madwheel/pileface-femme.py)
const pvColor = (v) => (v === 'D' ? '#d62f9c' : v >= 500 ? '#e0283c' : v >= 250 ? '#f97316' : v >= 100 ? '#7b2fbf' : v >= 50 ? '#16a34a' : v >= 25 ? '#1f6fe0' : '#0ea5b7');

function wheelTick(v) {
  if (isMuted()) return;
  const ac = audioContext(); if (!ac) return;
  const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
  o.type = 'square'; o.frequency.value = 1500 + Math.random() * 350;
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t + 0.05);
}

// Momentum, exponential friction, then a slow crawl over the last pegs (the Méga Folie wheel of the bonus).
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
    const frame = (ts) => {
      if (t0 === null) t0 = ts;
      const t = ((ts - t0) / 1000) * sc, a = ang(t);
      el.style.transform = `rotate(${a}deg)`;
      const dt = Math.max(0.001, t - prevT), sp = Math.abs(a - prevA) / dt, nn = Math.floor(a / AA);
      if (nn !== lastN) { lastN = nn; wheelTick(sp < 500 ? 0.16 : 0.05); }
      prevA = a; prevT = t;
      if (t >= total) { el.style.transform = `rotate(${to}deg)`; res(); return; }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
}

/* ---------- the TV show (owner's request of 18 November 2026: the same show as Le Plateau Live) ----------
   The videos of Le Plateau Live (the host in her red dress throws the big wheel of light bulbs: roue.mp4, and talks next to it
   while one waits: attente.mp4, both with their sound) and their tracking (SHOW of games/plateaulive.js, loaded first: DEPS of
   games/impl/index.js): OUR wheel of 54 cases lies on her wheel by a homography per frame (.plx-wb, matrix3d), she stays in
   front of it by her mask, our hub « SPIN BET » and our pointer as on Le Plateau Live. Phone held upright: the right part. */
const PLX = () => __mods['games/impl/plateaulive.js'].SHOW;
const PAL = ['#f4a6c9', '#f8d042', '#7fc6ec', '#b98ae0', '#f7963c', '#ea4b44', '#6cc24c', '#3f8ddf', '#8f5cd8']; // 54 = 6 × 9: no two neighbours alike
const GLYPH = { // white signs of the bonus cases, drawn around 0,0 (± 16)
  cf: '<circle r="15" fill="none" stroke="#fff" stroke-width="4"/><path d="M-5-8V8M-5 0 6-8M-5 0 6 8" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>',
  ch: '<circle r="15" fill="none" stroke="#fff" stroke-width="3.6"/><circle r="8.5" fill="none" stroke="#fff" stroke-width="3.6"/><circle r="3" fill="#fff"/>',
  pa: '<circle cy="-10" r="3.4" fill="#fff"/><circle cx="-6" cy="-1" r="3.4" fill="#fff"/><circle cx="6" cy="-1" r="3.4" fill="#fff"/><circle cx="-12" cy="8" r="3.4" fill="#fff"/><circle cy="8" r="3.4" fill="#fff"/><circle cx="12" cy="8" r="3.4" fill="#fff"/>',
  ct: '<circle r="15" fill="none" stroke="#fff" stroke-width="3.6"/><circle cx="-5.5" cy="-4" r="2.8" fill="#fff"/><circle cx="5.5" cy="-4" r="2.8" fill="#fff"/><path d="M-8 3Q0 13 8 3Z" fill="#fff"/>',
};
// The disc of the game (54 cases), 1000 × 1000: rainbow slices, a dark square with the value near the rim (white sign on
// the colour of the bonus for the 4 bonus cases), soft shading towards the hub.
function discSVG() {
  const C = 500, R = 496, f = (v) => v.toFixed(1);
  let s = `<circle cx="${C}" cy="${C}" r="${R}" fill="#170b2e"/>`;
  for (let i = 0; i < NS; i++) s += `<path d="${slicePath(i, A, R, C)}" fill="${PAL[i % PAL.length]}"/>`;
  for (let i = 0; i < NS; i++) { const p0 = pt(i * A, 150, C, C), p = pt(i * A, R, C, C); s += `<line x1="${f(p0[0])}" y1="${f(p0[1])}" x2="${f(p[0])}" y2="${f(p[1])}" stroke="#fff" stroke-opacity=".55" stroke-width="2.4"/>`; }
  s += `<circle cx="${C}" cy="${C}" r="${R}" fill="url(#sh)"/>`;
  for (let i = 0; i < NS; i++) {
    const k = SEGS[i], a = ((i + 0.5) * A).toFixed(2), bonus = isNaN(+k);
    s += `<g transform="rotate(${a} ${C} ${C}) translate(${C} 76)"><rect x="-28" y="-28" width="56" height="56" rx="9" fill="${bonus ? COL[k] : '#121018'}" stroke="#e8b63a" stroke-width="3.5"/>${bonus ? GLYPH[k] : `<text y="${k.length > 1 ? 11 : 13}" text-anchor="middle" font-family="Arial Black,Arial,Helvetica,sans-serif" font-weight="900" font-size="${k.length > 1 ? 30 : 38}" fill="#fff">${k}</text>`}</g>`;
  }
  for (let i = 0; i < NS; i++) { const p = pt(i * A, R - 9, C, C); s += `<circle cx="${f(p[0])}" cy="${f(p[1])}" r="5" fill="url(#peg)" stroke="#5a3a08" stroke-width="1.2"/>`; }
  s += `<circle cx="${C}" cy="${C}" r="${R - 2}" fill="none" stroke="#ffd76a" stroke-width="5"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000"><defs><radialGradient id="sh" cx="500" cy="500" r="${R}" gradientUnits="userSpaceOnUse"><stop offset=".22" stop-color="#000" stop-opacity=".38"/><stop offset=".5" stop-color="#000" stop-opacity=".08"/><stop offset=".86" stop-color="#fff" stop-opacity=".1"/><stop offset="1" stop-color="#000" stop-opacity=".25"/></radialGradient><radialGradient id="peg" cx=".35" cy=".3"><stop offset="0" stop-color="#fff8d6"/><stop offset=".5" stop-color="#ffd23f"/><stop offset="1" stop-color="#a86b0c"/></radialGradient></defs>${s}</svg>`;
}
let DISC = null;
const discURL = () => (DISC ||= `data:image/svg+xml;charset=utf-8,${encodeURIComponent(discSVG())}`);
// the same disc blurred around its centre (fast spins): drawn once on a canvas, shown more or less with the speed
function blurDisc(img) {
  try {
    const S = 640, c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d'), n = 14;
    g.globalAlpha = 1 / n * 1.6;
    for (let i = 0; i < n; i++) { g.save(); g.translate(S / 2, S / 2); g.rotate(((i / (n - 1) - 0.5) * A * 1.6 * Math.PI) / 180); g.drawImage(img, -S / 2, -S / 2, S, S); g.restore(); }
    return c;
  } catch { return null; }
}
const asset = (p) => window.__assets?.[p] || `${p}?v=1`;

class MadWheelGame extends BaseGame {
  constructor(root, game, ov) {
    const online = !!ov?.online, S = PLX();
    super(root, game, mergeOpts(ov, {
      music: EXTRA_THEMES.madwheel, stepper: false, autoplay: true, mainLabel: 'LANCER', betLabel: 'Mise totale',
      cls: 'table-game mwlive',
      head: '<div class="hist mw-hist"></div>',
      stage: `<div class="plx plx-l mw-live"><div class="plx-art">
          <video class="plx-vid" playsinline preload="auto" disablepictureinpicture aria-hidden="true"></video>
          <video class="plx-idle" playsinline muted preload="auto" disablepictureinpicture aria-hidden="true"></video>
          <div class="plx-wb"><div class="plx-rot"><img class="plx-disc" alt="" draggable="false"><canvas class="plx-blur"></canvas></div>${S.HUB}<i class="plx-hl"></i>${S.POINTER}</div>
        </div>
        <div class="mw-top"><small>BOOST</small><b class="tsv">—</b></div>
        <div class="plx-res"></div>
        <button class="plx-snd" type="button" aria-label="Son de l’émission"></button></div>`,
      below: `<div class="felt mw-felt"><div class="mw-spots">${SPOTS.map((k) => `<button class="mw-spot" data-k="${k}" style="--sc:${COL[k]}"><b>${isNaN(+k) ? iconSVG(k, 30) : k}</b><small>${HINT[k]}</small></button>`).join('')}</div>${BetBoard.chipsHTML()}</div>`,
      hello: 'Pose tes jetons sur les cases puis appuie sur LANCER : la présentatrice lance la roue.',
      // bonuses to buy (owner's request): the wheel lands on it, then the bonus; prices for a return of about 88 %
      // (average of each bonus by simulation: Pile ou Face ×15, Pachinko ×13,9, Tir aux Cibles ×28,8, Méga Folie ×32,1)
      buys: online ? [] : [
        { id: 'cf', icon: '🪙', label: 'Pile ou Face', desc: 'La présentatrice lance la roue, elle s’arrête sur Pile ou Face', cost: (b) => b * 18 },
        { id: 'pa', icon: '🎳', label: 'Pachinko', desc: 'La roue s’arrête sur le Pachinko : la bille tombe dans les multiplicateurs', cost: (b) => b * 17 },
        { id: 'ch', icon: '🎯', label: 'Tir aux Cibles', desc: '132 canards, un multiplicateur sur chacun : ils se mélangent, tu en choisis un', cost: (b) => b * 34 },
        { id: 'ct', icon: '🤪', label: 'Méga Folie', desc: 'La grande roue à 3 flèches : multiplicateurs moyens et gros, DOUBLE et TRIPLE', cost: (b) => b * 38 },
      ],
    }));
    this.cur = 0;
    this.histArr = [];
    this.board = new BetBoard(this, this.q('.mw-felt'), null);
    this.board.paint();
    // the show: the videos of Le Plateau Live, our wheel on hers
    this.S = S;
    this.sc = this.q('.plx'); this.art = this.q('.plx-art'); this.vid = this.q('.plx-vid');
    this.wb = this.q('.plx-wb'); this.rot = this.q('.plx-rot'); this.blurC = this.q('.plx-blur');
    const disc = this.q('.plx-disc');
    disc.onload = () => { const c = blurDisc(disc); if (c && !this.dead) { this.blurC.width = c.width; this.blurC.height = c.height; this.blurC.getContext('2d').drawImage(c, 0, 0); } };
    disc.src = discURL();
    // the 2 mask sheets (the host in front of our wheel): loaded now, a mask not yet loaded would hide the wheel
    this.mk = { show: asset('assets/games/plateaulive/roue-mask.png'), idle: asset('assets/games/plateaulive/attente-mask.png') };
    Object.values(this.mk).forEach((u) => { new Image().src = u; });
    this.vid.muted = true;
    this.vid.poster = asset('assets/games/plateaulive/roue.webp');
    this.vid.src = asset('assets/games/plateaulive/roue.mp4');
    this.vid.addEventListener('seeked', () => this.showFrame());
    this.vid.addEventListener('loadeddata', () => this.showFrame());
    // ready for LANCER: the show waits on the moment it starts from (GO), already decoded
    this.vid.addEventListener('loadedmetadata', () => { if (!this.vidOn && !this.inBonus) try { this.vid.currentTime = S.GO; } catch { /* ignore */ } });
    this.vid.addEventListener('ended', () => { this.vidOn = false; if (!this.inBonus) this.toIdle(); });
    this.vid.addEventListener('error', () => { if (!this.inBonus) this.vidBad = true; });
    // the wait: she talks next to the wheel, in a loop from the arrival, the sound off until the player turns it on; LANCER goes
    // straight to her throw (fromIdle), and the wait comes back once the show is over
    const iv = this.idle = this.q('.plx-idle');
    this.idleOn = true;
    iv.muted = true;
    iv.poster = asset('assets/games/plateaulive/attente.webp');
    iv.src = asset('assets/games/plateaulive/attente.mp4');
    iv.addEventListener('timeupdate', () => {
      if (iv.currentTime >= S.IDLE.loop) iv.currentTime -= S.IDLE.loop; // its first frames again: back by one loop, no cut
      if (this.idleOn && !iv.muted && !iv.paused) this.duckIdle();
    });
    iv.addEventListener('play', () => this.followIdle());
    iv.addEventListener('loadeddata', () => this.showFrame());
    iv.addEventListener('error', () => { this.idleBad = true; this.idleOn = false; iv.classList.add('off'); this.showFrame(); });
    // a touch: a phone saving power may wait for one to play the wait, and an iPhone to give it its sound
    this.root.addEventListener('pointerdown', () => { if (this.idleOn && (iv.paused || (this.sndOn && iv.muted && !isMuted()))) this.playIdle(); });
    this.onVis = () => {
      if (document.hidden) { if (this.vidOn || this.inBonus) this.vid.pause(); iv.pause(); }
      else if (this.inBonus) return;
      else if (this.idleOn) this.playIdle();
      else if (this.vidOn && this.vid.paused && !this.vid.ended) this.vid.play().catch(() => {});
    };
    document.addEventListener('visibilitychange', this.onVis);
    this.sndOn = false; // owner's request: the sound of the show is off when one arrives, the player turns it on
    this.paintSnd();
    this.q('.plx-snd').addEventListener('click', () => this.toggleSnd());
    this.ro = new ResizeObserver(() => this.layout());
    this.ro.observe(this.sc);
    this.onRs = () => requestAnimationFrame(() => this.layout());
    addEventListener('resize', this.onRs);
    this.layout();
    this.playIdle();
  }

  get bet() { return this.board?.chip || 100; } // a bought bonus is played at the chip chosen
  stakeLabel() { return this.board ? this.board.total() : 0; }
  chipSound() { sfx.click(); }
  onMeters() { if (this.mainBtn) this.mainBtn.disabled = !this.auto && (this.busy || !this.board?.total()); }

  // 🔊 on the show: off when one arrives (owner's request), on for this visit of the game once the player turns it on
  toggleSnd() {
    this.sndOn = !this.sndOn;
    this.paintSnd();
    const m = !this.sndOn || isMuted();
    this.vid.muted = m; this.idle.muted = m;
    if (m) return;
    if (this.idleOn && !this.inBonus) { this.playIdle(); this.duckIdle(true); } else if (!this.vid.paused) duck?.(0.12, 6);
  }
  paintSnd() {
    [this.q('.plx-snd'), this.ov?.querySelector('.mwb-snd')].forEach((b) => {
      if (!b) return;
      b.innerHTML = `<i>${this.sndOn ? '🔊' : '🔇'}</i><b>SON ${this.sndOn ? 'ON' : 'OFF'}</b>`;
      b.classList.toggle('on', this.sndOn); b.setAttribute('aria-pressed', String(this.sndOn));
      b.title = this.sndOn ? 'Couper le son de l’émission' : 'Mettre le son de l’émission';
    });
  }
  // the music stays low while her voice plays
  duckIdle(now = false) { const t = performance.now(); if (now || t - (this.dkT || 0) > 1500) { this.dkT = t; duck?.(0.12, 3); } }

  /* ---------- the show and our wheel on it (as on Le Plateau Live) ---------- */
  // computers and phones held sideways: the whole picture; phone held upright: its right part (the host and the wheel)
  layout() {
    if (this.dead) return;
    const full = !!this.slotEl.closest('.is-full');
    const port = full ? innerWidth < innerHeight && innerWidth < 900 : innerWidth < 700 && innerHeight > innerWidth;
    this.sc.classList.toggle('plx-p', port); this.sc.classList.toggle('plx-l', !port);
    this.vw = this.vid.offsetWidth; this.vh = this.vid.offsetHeight;
    this.fk = null; this.showFrame();
  }
  // our wheel on frame k of the show (TRACK) or of the wait (src 'idle': IDLE, the camera does not move): the homography of the
  // disc (unit disc → % of the video) and her mask when she is in front
  frame(k, src = 'show') {
    const { TRACK, IDLE, mul, css3d } = this.S, idle = src === 'idle', T = TRACK.f;
    if (!this.vw || (!idle && (!T || !T.length))) return;
    const f = idle ? IDLE.h : T[Math.max(0, Math.min(T.length - 1, k))];
    const c = idle ? IDLE.m[((k % IDLE.n) + IDLE.n) % IDLE.n] : f[8], s = this.wb.style;
    if (this.fk !== f || this.fw !== this.vw) {
      this.fk = f; this.fw = this.vw;
      const S = 1000, L = [2.16 / S, 0, -1.08, 0, 2.16 / S, -1.08, 0, 0, 1];
      const H = [f[0], f[1], f[2], f[3], f[4], f[5], f[6], f[7], 1];
      const P = [this.vw / 100, 0, 0, 0, this.vh / 100, 0, 0, 0, 1];
      s.transform = css3d(mul(P, mul(H, L)));
    }
    const sh = idle ? IDLE : TRACK;
    if (this.fsrc !== src) { this.fsrc = src; this.fc = undefined; s.setProperty('--mk', `url("${this.mk[src]}")`); s.setProperty('--cols', sh.cols || 1); s.setProperty('--rows', sh.rows || 1); }
    if (this.fc === c) return;
    this.fc = c;
    this.wb.classList.toggle('mk', c >= 0);
    if (c >= 0) {
      const cols = sh.cols, rows = sh.rows;
      s.setProperty('--mx', `${cols > 1 ? ((c % cols) / (cols - 1)) * 100 : 0}%`);
      s.setProperty('--my', `${rows > 1 ? (Math.floor(c / cols) / (rows - 1)) * 100 : 0}%`);
    }
  }
  showFrame() {
    if (this.inBonus) return;
    if (this.idleOn) this.frame(Math.round((this.idle.currentTime || 0) * this.S.IDLE.fps), 'idle');
    else this.frame(Math.round((this.vid.currentTime || 0) * 24));
  }
  follow() {
    const v = this.vid, gen = (this.fGen = (this.fGen || 0) + 1);
    if (v.requestVideoFrameCallback) {
      const cb = (now, md) => { if (this.dead || this.inBonus || gen !== this.fGen) return; if (!this.idleOn) this.frame(Math.round(md.mediaTime * 24)); if (!v.paused && !v.ended) v.requestVideoFrameCallback(cb); };
      v.requestVideoFrameCallback(cb);
    } else {
      const loop = () => { if (this.dead || this.inBonus || gen !== this.fGen) return; this.showFrame(); if (!v.paused && !v.ended) requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
    }
  }
  rate() { return this.online ? 1.25 : this.turbo ? 1.6 : 1; }

  /* ---------- the wait: she talks next to the wheel, in a loop, before and between the throws ---------- */
  playIdle() {
    const v = this.idle;
    if (this.dead || this.idleBad || this.inBonus || document.hidden || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    v.muted = !this.sndOn || isMuted();
    v.play()?.catch(() => { if (!v.muted) { v.muted = true; v.play().catch(() => {}); } });
  }
  followIdle() {
    const v = this.idle, gen = (this.iGen = (this.iGen || 0) + 1), fps = this.S.IDLE.fps;
    const tick = (t) => { if (this.dead || gen !== this.iGen || v.paused) return false; if (this.idleOn && !this.inBonus) this.frame(Math.round(t * fps), 'idle'); return true; };
    if (v.requestVideoFrameCallback) { const cb = (now, md) => { if (tick(md.mediaTime)) v.requestVideoFrameCallback(cb); }; v.requestVideoFrameCallback(cb); }
    else { const loop = () => { if (tick(v.currentTime)) requestAnimationFrame(loop); }; requestAnimationFrame(loop); }
  }
  // back to the wait at once (the show is over, the bonus is over)
  toIdle() {
    if (this.dead || this.idleBad || this.inBonus) return;
    this.swGen = (this.swGen || 0) + 1;
    const i = this.idle;
    this.idleOn = true;
    i.classList.add('cut'); i.classList.remove('off'); void i.offsetWidth; i.classList.remove('cut');
    this.showFrame(); this.playIdle();
  }
  // LANCER: as soon as the show shows its first frame, the wait melts into it (same camera, same wheel), then it pauses
  fromIdle() {
    if (!this.idleOn) return;
    const v = this.vid, gen = (this.swGen = (this.swGen || 0) + 1);
    let done = false;
    const go = () => {
      if (done || gen !== this.swGen || this.dead || !this.idleOn || !this.vidOn) return;
      done = true; this.idleOn = false;
      this.idle.classList.add('off');
      this.showFrame();
      setTimeout(() => { if (!this.idleOn && gen === this.swGen) this.idle.pause(); }, 450);
    };
    if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(go);
    else v.addEventListener('playing', () => setTimeout(go, 60), { once: true });
  }
  // she throws the wheel (called from the tap itself, so that the sound may play): the show starts from GO, a little before
  // her throw, so that LANCER throws the wheel right away
  startShow(t0 = this.S.GO) {
    const v = this.vid;
    if (this.vidBad || matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    try {
      v.pause(); if (Math.abs(v.currentTime - t0) > 0.03) v.currentTime = t0;
      v.playbackRate = this.rate();
      v.muted = !this.sndOn || isMuted();
      const p = v.play();
      this.vidOn = true; this.follow(); this.fromIdle();
      p?.catch(() => { v.muted = true; v.play().catch(() => { this.vidOn = false; }); });
      if (!v.muted) duck?.(0.12, (10 - t0) / this.rate());
      return true;
    } catch { this.vidOn = false; return false; }
  }
  // seconds of video already played (0 when there is no video)
  vt() { return this.vidOn ? this.vid.currentTime : 0; }
  async untilVideo(t, maxMs) {
    const t0 = performance.now();
    while (this.vidOn && !this.dead && this.vid.currentTime < t && performance.now() - t0 < maxMs) await sleep(30);
  }

  // The wheel turns from her throw to the stop, and lands on case idx (the pointer is on top).
  spinTo(idx, ms) {
    const from = this.cur, delta = ((-(idx + 0.5) * A - from) % 360 + 360) % 360;
    const to = from + 360 * Math.max(3, Math.round(ms / 1500)) + delta + (Math.random() - 0.5) * A * 0.7;
    this.cur = to;
    const rot = this.rot, blur = this.blurC, ptr = this.q('.plx-ptr');
    return new Promise((res) => {
      let t0 = null, lastN = Math.floor(from / A), prevA = from, prevT = 0;
      const step = (ts) => {
        if (this.dead) return res();
        if (t0 === null) t0 = ts;
        const t = Math.min(1, (ts - t0) / ms), e = 1 - Math.pow(1 - t, 3.2), a = from + (to - from) * e;
        rot.style.transform = `rotate(${a.toFixed(2)}deg)`;
        const sp = Math.abs(a - prevA) / Math.max(1, ts - prevT) * 1000; prevA = a; prevT = ts; // degrees per second
        blur.style.opacity = Math.min(1, Math.max(0, (sp - 120) / 380)).toFixed(2);
        const nn = Math.floor(a / A);
        if (nn !== lastN) {
          lastN = nn;
          if (sp < 260) { wheelTick(0.12); ptr.animate([{ rotate: '-16deg' }, { rotate: '0deg' }], { duration: 160, easing: 'ease-out' }); }
        }
        if (t < 1) requestAnimationFrame(step); else { rot.style.transform = `rotate(${to.toFixed(2)}deg)`; blur.style.opacity = 0; res(); }
      };
      requestAnimationFrame(step);
    });
  }

  histAdd(seg) {
    this.histArr.unshift(seg);
    this.histArr = this.histArr.slice(0, 12);
    this.q('.mw-hist').innerHTML = this.histArr.map((s) => `<span style="background:${COL[s]}">${isNaN(+s) ? iconSVG(s, 16) : s}</span>`).join('');
  }

  onMain() {
    // automatic spins: the last bets go back on the table for each spin
    if (!this.board.total() && this.auto) { this.board.rebet(true); this.board.paint(); }
    if (!this.board.total()) { this.stopAuto(); return; }
    if (this.busy || this.board.total() > this.balC()) { this.round(async () => { this.pay(this.board.total()); }); return; }
    this.showStarted = this.startShow(); // in the tap itself: the sound of the show may play
    this.round(async () => {
      const placed = {}, tt = this.board.total();
      SPOTS.forEach((k) => { placed[k] = this.board.bets[k] || 0; });
      if (!this.pay(tt)) { this.vid.pause(); this.vidOn = false; this.toIdle(); return; }
      this.lastStake = tt;
      this.board.last = Object.fromEntries(Object.entries(placed).filter(([, v]) => v));
      this.focusStage();
      this.setLast(0); this.winAmt.textContent = '';
      await this.play(outcome(), placed);
      this.board.afterRound();
    });
  }

  // A bought bonus: the host throws the wheel, it lands on that bonus, then the bonus is played at the chosen chip.
  async onBuy(id) {
    const b = this.bet, cases = SEGS.map((k, i) => (k === id ? i : -1)).filter((i) => i >= 0);
    const O = { top: null, idx: cases[Math.floor(Math.random() * cases.length)], seg: id };
    if (id === 'cf') O.cf = coinRun();
    else if (id === 'ch') { O.bd = chBoard(); O.chm = O.bd[Math.floor(Math.random() * NDUCK)]; }
    else if (id === 'pa') O.pa = pachRun();
    else O.ct = [0, 1, 2].map((c) => ctRun(c));
    if (!this.vidOn) this.showStarted = this.startShow();
    this.setLast(0); this.winAmt.textContent = '';
    await this.play(O, { [id]: b }, { bought: true });
  }

  // Plays a drawn round on screen (Boost, the host and the wheel, bonus) and pays the bets in `placed`.
  // arrow: the Méga Folie arrow (chosen by the player alone; drawn for each player at an online table).
  async play(O, placed, ctx = {}) {
    this.qa('.mw-spot').forEach((b) => b.classList.remove('hit', 'tsel'));
    const res = this.q('.plx-res'); res.className = 'plx-res'; res.innerHTML = '';
    this.wb.classList.remove('won');
    if (!this.vidOn) this.showStarted = this.startShow(); // online rounds and automatic spins start here
    const rate = this.rate(), video = this.vidOn, TH = 2.75, ST = 8.1; // her throw, the stop of her wheel (s of roue.mp4)
    const top = O.top, tv = this.q('.tsv'), topBox = this.q('.mw-top');
    // the Boost runs while the host gets ready (until she throws the wheel)
    if (!ctx.bought) {
      this.msg('Boost…');
      topBox.classList.add('rolling', 'on');
      const t0 = performance.now(), boostMs = video ? Math.max(600, ((TH - 0.35 - this.vt()) * 1000) / rate) : (this.turbo ? 600 : 1400);
      while (performance.now() - t0 < boostMs && !this.dead) {
        const k = SPOTS[Math.floor(Math.random() * 8)];
        tv.innerHTML = `${isNaN(+k) ? iconSVG(k, 18) : k} ×${wpick(TM)}`;
        sfx.tick();
        await sleep(80);
      }
      topBox.classList.remove('rolling');
      tv.innerHTML = top ? `${isNaN(+top.seg) ? iconSVG(top.seg, 18) + ' ' + NAME[top.seg] : 'Case ' + top.seg} ×${top.m}` : 'Pas de Boost';
      if (top) { topBox.classList.add('hit'); this.q(`.mw-spot[data-k="${top.seg}"]`)?.classList.add('tsel'); sfx.upgrade(); const p = center(topBox); fx.burst(p.x, p.y, 24, ['#ffd23f', '#fff', '#ff3d6e']); }
    }
    this.msg('Les jeux sont faits…');
    // the host throws the wheel: it turns until the moment of the video where it stops
    if (video) await this.untilVideo(TH, 4000);
    const spinMs = video ? Math.max(1800, ((ST - Math.max(TH, this.vt())) * 1000) / rate) : (this.turbo ? 2600 : 4600);
    const idx = O.idx, seg = O.seg;
    await this.spinTo(idx, spinMs);
    topBox.classList.remove('hit', 'on');
    this.histAdd(seg);
    this.wb.classList.add('won');
    res.style.setProperty('--seg', COL[seg]);
    res.innerHTML = isNaN(+seg) ? `${iconSVG(seg, 34)}<b>${NAME[seg]}</b>` : `<b class="n">${seg}</b>`;
    res.classList.add('on');
    sfx.upgrade();
    this.q(`.mw-spot[data-k="${seg}"]`)?.classList.add('hit');
    const pp = center(this.q('.plx-ptr')); fx.burst(pp.x, pp.y + 10, 30, [COL[seg], '#fff']);
    const lines = [];
    const b = placed[seg] || 0, tm = top && top.seg === seg ? top.m : 1;
    if (isNaN(+seg) && b > 0 && !ctx.bought) dispatchEvent(new CustomEvent('sb:bonus', { detail: { game: this.game.id, key: seg } })); // Défi spécial (special.js)
    let arrow = ctx.arrow ?? (ctx.seed ? arrowOf(ctx.seed, this.room?.me) : undefined);
    await this.wait(900);
    // a bonus is played when there is a stake on it (always at an online table: everyone watches)
    if (isNaN(+seg) && (b > 0 || this.online)) {
      this.msg(`Bonus : ${NAME[seg]} !`);
      sfx.feature();
      await this.wait(700);
      if (seg === 'cf') await this.bonusCF(tm, O.cf);
      else if (seg === 'ch') await this.bonusCH(tm, O);
      else if (seg === 'pa') await this.bonusPA(tm, O.pa);
      else arrow = await this.bonusCT(tm, O.ct, arrow);
    }
    const { ret, M, cap } = payout(O, placed, arrow ?? 0);
    if (b > 0) {
      if (!isNaN(+seg)) lines.push(`Tu gagnes ${fmtC(ret - b)}${tm > 1 ? ` (Boost ×${tm})` : ''}`);
      else lines.push(M > 0 ? `${NAME[seg]} : ×${M * tm} → ${fmtC(ret - b)}` : `${NAME[seg]} : perdu`);
    } else lines.push(`La roue s’arrête sur ${isNaN(+seg) ? NAME[seg] : seg}.${Object.keys(placed).length ? ' Pas de mise dessus.' : ''}`);
    const all = Object.values(placed).reduce((a, x) => a + x, 0);
    this.msg(lines.join(' · ') + (cap ? ' · GAIN MAXIMUM !' : '') + (all && !ctx.bought ? ` · Bilan : ${ret - all >= 0 ? '+' : '−'}${fmtC(Math.abs(ret - all))}` : ''));
    if (ret > 0) {
      this.win(ret, isNaN(+seg) ? NAME[seg] : null);
      this.setLast(ret);
      if (ret > b) await this.celebrate(ret, { summary: isNaN(+seg) ? NAME[seg].toUpperCase() : null, quick: this.online });
    }
    return ret; // the result stays on the screen until the next throw
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
  tmTxt(tm) { return tm > 1 ? ` <b class="tm">Boost ×${tm}</b>` : ''; }

  // Pile ou Face: her video (she announces it behind the table, then the camera follows the puck into the jar), red or blue
  // version (tools/art/madwheel/pileface-femme.py)
  async bonusCF(tm, r = coinRun()) {
    const red = r.face === 0;
    this.openShow('pf', 'Pile ou Face', '', '', `<div class="mwb-pf-v"><b class="r">ROUGE<i>×${r.v[0] * tm}</i></b><b class="b">BLEU<i>×${r.v[1] * tm}</i></b></div>`, red ? 'pf-r' : 'pf-b');
    this.ovp(`Le palet va tomber dans le bocal : rouge ou bleu ?${this.tmTxt(tm)}`);
    const vid = this.bPlay(0);
    if (vid) await this.bUntil(PF_AT, 13000); else { sfx.spin(); await this.wait(2500); }
    if (!this.ov) return r.M;
    this.ov.querySelector(`.mwb-pf-v .${red ? 'r' : 'b'}`)?.classList.add('win');
    this.ov.querySelector(`.mwb-pf-v .${red ? 'b' : 'r'}`)?.classList.add('lose');
    const p = center(this.ov.querySelector('.mwb')); fx.burst(p.x, p.y, 50, red ? ['#ef4444', '#fff'] : ['#3b82f6', '#fff'], 9);
    this.ovp(`${red ? 'Rouge' : 'Bleu'} ! ×${r.M * tm}`);
    this.bBig(`×${r.M * tm}`);
    sfx.bigWin();
    await this.wait(1900);
    this.closeShow();
    return r.M;
  }

  /* ---------- the bonus shows (owner's videos of 16 November 2026; since 18 November 2026 with the host of Le Plateau Live
     in place of his host and with her voice: tools/art/madwheel/sansanimateur.py then femme.py) ----------
     Pachinko, Tir aux Cibles and Méga Folie are played on his videos (a Plinko board, a wall of 132 ducks, a big wheel with 3
     arrows), with her voice, our elements on top in % of the video (.mwb-full) and the host kept in front by her mask
     (BTRACK: zone of our elements, a cell of bmask-*.png per frame). The video plays in the element of the show, moved into
     the bonus screen: the tap on LANCER already allowed it to play with its sound (iPhone). */
  // (phone held upright: only the part BCROP of the video, so that the ducks are big enough to be touched)
  openShow(k, title, inner, below = '', extra = '', src = k) {
    const T = BTRACK[k] || { box: [0, 0, 100, 100], cols: 1, rows: 1, f: [] }, b = T.box, bw = b[2] - b[0], bh = b[3] - b[1];
    this.openOv(`<h2>${title}</h2><p class="msgov"></p>
      <div class="mwb mwb-${k}" style="--cx0:${BCROP[k][0]};--cw:${BCROP[k][1]}"><div class="mwb-st"><div class="mwb-vh"></div>
        <div class="mwb-box" style="left:${b[0]}%;top:${b[1]}%;width:${bw}%;height:${bh}%;--mk:url('${asset(`assets/games/madwheel/bmask-${k}.png`)}');--cols:${T.cols};--rows:${T.rows}">
          <div class="mwb-full" style="left:${((-b[0] / bw) * 100).toFixed(3)}%;top:${((-b[1] / bh) * 100).toFixed(3)}%;width:${(10000 / bw).toFixed(3)}%;height:${(10000 / bh).toFixed(3)}%">${inner}</div></div>
        ${extra}<div class="mwb-big"></div></div><button class="mwx-snd mwb-snd" type="button"></button></div>${below}`);
    this.ov.classList.add('mw-show');
    this.ov.querySelector('.mwb-snd').addEventListener('click', () => this.toggleSnd());
    this.paintSnd();
    const v = this.vid;
    this.inBonus = true; this.bT = T; this.bBox = this.ov.querySelector('.mwb-box'); this.bLoops = 0;
    this.swGen = (this.swGen || 0) + 1; this.fGen = (this.fGen || 0) + 1; this.idle.pause();
    try { v.pause(); } catch { /* ignore */ }
    this.vidOn = false;
    this.ov.querySelector('.mwb-vh').appendChild(v);
    v.poster = asset(`assets/games/madwheel/b-${src}.webp`);
    v.src = asset(`assets/games/madwheel/b-${src}.mp4`);
    v.load();
    this.bMask(0);
    return this.ov;
  }
  // the host's mask of frame n
  bMask(n) {
    const T = this.bT, box = this.bBox; if (!T || !box) return;
    const c = T.f[Math.max(0, Math.min(T.f.length - 1, n))];
    if (c === this.bCell) return;
    this.bCell = c;
    box.classList.toggle('mk', c >= 0);
    if (c >= 0) {
      box.style.setProperty('--mx', `${T.cols > 1 ? ((c % T.cols) / (T.cols - 1)) * 100 : 0}%`);
      box.style.setProperty('--my', `${T.rows > 1 ? (Math.floor(c / T.cols) / (T.rows - 1)) * 100 : 0}%`);
    }
  }
  // plays the bonus video (from t0 when given) with its sound; Pachinko and Méga Folie go round without a cut, sound kept
  bPlay(t0 = null) {
    const v = this.vid;
    if (this.vidBad || matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    try {
      if (t0 != null) v.currentTime = t0;
      v.playbackRate = this.turbo ? 1.25 : 1;
      v.muted = !this.sndOn || isMuted(); // the sound of the show all through the bonus, loops included (owner's request)
      const p = v.play();
      p?.catch(() => { v.muted = true; v.play().catch(() => {}); });
      if (!v.muted) duck?.(0.12, 6);
      const T = this.bT, gen = (this.bGen = (this.bGen || 0) + 1);
      const tick = (t) => {
        if (this.dead || !this.inBonus || gen !== this.bGen) return false;
        if (T.loop && t >= T.at + 0.2) { v.currentTime = t - T.loop; this.bLoops++; if (!v.muted) duck?.(0.12, 6); }
        this.bMask(Math.round(t * 24));
        return !v.paused && !v.ended;
      };
      if (v.requestVideoFrameCallback) { const cb = (now, md) => { if (tick(md.mediaTime)) v.requestVideoFrameCallback(cb); }; v.requestVideoFrameCallback(cb); }
      else { const loop = () => { if (tick(v.currentTime)) requestAnimationFrame(loop); }; requestAnimationFrame(loop); }
      return true;
    } catch { return false; }
  }
  async bUntil(t, maxMs) {
    const v = this.vid, t0 = performance.now();
    while (this.inBonus && !this.dead && !v.paused && !v.ended && v.currentTime < t && performance.now() - t0 < maxMs) await sleep(30);
  }
  bBig(html) { const b = this.ov?.querySelector('.mwb-big'); if (!b) return; b.innerHTML = html; b.classList.add('on'); }
  // back to the show: the video element goes home, the show's video comes back, then the wait
  closeShow() {
    if (!this.inBonus) return this.closeOv();
    const v = this.vid; this.inBonus = false; this.bT = null; this.bBox = null; this.bCell = undefined; this.bGen = (this.bGen || 0) + 1;
    try { v.pause(); } catch { /* ignore */ }
    v.poster = asset('assets/games/plateaulive/roue.webp');
    v.src = asset('assets/games/plateaulive/roue.mp4');
    this.art.prepend(v);
    v.load();
    this.layout();
    this.toIdle();
    this.closeOv();
  }

  // Pachinko: our ball falls from the star through the pegs of his board into our 16 cases (laid on his painted ones)
  async bonusPA(tm, run = pachRun()) {
    const SX = (s) => 15 + (s + 0.5) * 29.875;
    const X = (r, k) => 283 + ((254 - 283) * r) / 15 + (k - r / 2) * 29.875, Y = (r) => 82 + (r * (334 - 82)) / 15;
    const L = (x) => `${(x / 6.72).toFixed(2)}%`, T = (y) => `${(y / 4.48).toFixed(2)}%`;
    const slots = PV.map((v) => `<b class="mwb-ps${v === 'D' ? ' d' : ''}" style="--c:${pvColor(v)}"></b>`).join('');
    this.openShow('pa', 'Pachinko', `<div class="mwb-slots">${slots}</div><i class="mwb-ball"></i>`);
    this.ovp(`La bille va tomber…${this.tmTxt(tm)}`);
    this.bPlay(0);
    const ball = this.ov.querySelector('.mwb-ball'), sl = [...this.ov.querySelectorAll('.mwb-ps')];
    const st = this.turbo ? 75 : 140;
    for (const dr of run.drops) {
      sl.forEach((el, s) => { el.classList.remove('hit'); el.textContent = dr.vals[s] === 'D' ? '×2' : dr.vals[s]; });
      ball.style.left = L(283); ball.style.top = T(Y(0));
      ball.animate([{ opacity: 0, transform: 'scale(.3)' }, { opacity: 1, transform: 'none' }], { duration: 300, easing: 'ease-out' });
      await this.wait(this.turbo ? 300 : 550);
      let k = 0, x0 = 283, y0 = Y(0);
      for (let r = 0; r < 15; r++) {
        k += dr.path[r];
        const x1 = X(r + 1, k), y1 = Y(r + 1);
        ball.style.left = L(x1); ball.style.top = T(y1);
        ball.animate([{ left: L(x0), top: T(y0) }, { left: L(x0 * 0.55 + x1 * 0.45), top: T(y0 - 5), offset: 0.35 }, { left: L(x1), top: T(y1) }], { duration: st, easing: 'ease-in' });
        sfx.tick();
        await sleep(st);
        x0 = x1; y0 = y1;
      }
      ball.style.top = T(372);
      ball.animate([{ top: T(y0) }, { top: T(372) }], { duration: st * 1.6, easing: 'cubic-bezier(.5,0,1,.6)' });
      await sleep(st * 1.6);
      sl[dr.k].classList.add('hit');
      const p = center(sl[dr.k]); fx.burst(p.x, p.y, 30, ['#ffd23f', '#fff', '#ff8a3d']);
      if (dr.vals[dr.k] === 'D') { this.ovp('DOUBLE ! Toutes les cases ×2, on relance la bille…'); sfx.upgrade(); this.flash('rgba(214,47,156,.5)'); await this.wait(1500); }
      else {
        this.ovp(`La bille tombe sur ×${dr.vals[dr.k]}${tm > 1 ? ` → ×${dr.vals[dr.k] * tm} avec le Boost` : ''} !`);
        this.bBig(`×${dr.vals[dr.k] * tm}`);
        sfx.bigWin(); await this.wait(1900);
      }
    }
    this.closeShow();
    return run.M;
  }

  // Tir aux Cibles: a multiplier on each of his 132 ducks (drawn at random every time); they mix, the player shoots one
  async bonusCH(tm, O) {
    const bd = O ? O.bd : chBoard(), D = BTRACK.ch.ducks;
    const html = D.map((p, i) => `<button class="mwb-duck${bd[i] >= 80 ? ' hi' : ''}" type="button" style="left:${p[0]}%;top:${p[1]}%;--d:${((i % 12) * 22 + Math.floor(i / 12) * 30)}ms" aria-label="Canard ${i + 1}"><b>${bd[i]}</b></button>`).join('');
    this.openShow('ch', 'Tir aux Cibles', html);
    const show = this.ov.querySelector('.mwb'), btns = [...this.ov.querySelectorAll('.mwb-duck')];
    this.ovp(`Mémorise les multiplicateurs… les canards vont se mélanger !${this.tmTxt(tm)}`);
    const vid = this.bPlay(0);
    if (vid) await this.bUntil(2.9, 5000); else await this.wait(3000);
    btns.forEach((b, i) => setTimeout(() => { b.firstChild.textContent = '?'; b.classList.remove('hi'); b.classList.add('q'); }, (i % 12) * 20 + Math.floor(i / 12) * 14));
    sfx.spin();
    if (vid) { await this.bUntil(3.4, 1500); this.vid.pause(); } else await sleep(500);
    this.ovp(this.online ? 'Choisis un canard ! (choix auto dans 8 s)' : 'Choisis un canard !');
    show.classList.add('pick');
    const idx = await this.waitTap(btns, this.online ? 8000 : 0);
    show.classList.remove('pick');
    const m = O ? O.chm : bd[Math.floor(Math.random() * bd.length)];
    btns.forEach((b) => { b.onclick = null; });
    const rest = bd.slice(); const pos = rest.indexOf(m); if (pos > -1) rest.splice(pos, 1); shuffle(rest);
    const me = btns[idx]; me.firstChild.textContent = '×' + m; me.classList.remove('q'); me.classList.add('pick');
    const p = center(me); fx.burst(p.x, p.y, 40, ['#8bd93b', '#fff', '#fde047'], 8);
    sfx.bigWin();
    this.ovp(`Tu as touché ×${m}${tm > 1 ? ` → ×${m * tm} avec le Boost` : ''} !`);
    await this.wait(900);
    let j = 0; btns.forEach((b, i) => { if (i !== idx) { b.firstChild.textContent = rest[j++]; b.classList.remove('q'); b.classList.add('dim'); } });
    await this.wait(1700);
    // the ducks fall, the result stays on the empty wall
    show.classList.add('fall');
    if (vid) { this.bPlay(); await this.bUntil(5.4, 3500); }
    this.bBig(`×${m * tm}`);
    sfx.upgrade();
    await this.wait(1500);
    this.closeShow();
    return m;
  }

  // Méga Folie: his wheel with 3 arrows, its cases replaced by ours (medium and big multipliers, DOUBLE, TRIPLE)
  ctDisc(mult) {
    let s = '';
    for (let i = 0; i < CTN; i++) {
      const t = CTSEQ[i], sp = t === 'D' || t === 'T', big = !sp && t >= 100;
      s += `<path d="${slicePath(i, CTA, 125)}" fill="${sp ? '#14061f' : big ? 'url(#mwbGold)' : CTPAL[i % CTPAL.length]}" stroke="#2a1606" stroke-width=".8"/>`;
      const lab = t === 'D' ? 'DOUBLE' : t === 'T' ? 'TRIPLE' : `×${t * mult}`;
      s += `<text class="mt" x="150" y="62" text-anchor="middle" dominant-baseline="middle" font-family="KeCoin,Archivo,Impact,sans-serif" font-weight="900" font-size="${lab.length > 5 ? 11 : lab.length > 4 ? 12.5 : 14}" fill="${sp ? (t === 'D' ? '#ff5fd2' : '#ffd23f') : big ? '#3a1d00' : '#fff'}" stroke="${big ? 'none' : '#10061f'}" stroke-width=".6" paint-order="stroke" transform="rotate(${((i + 0.5) * CTA).toFixed(2)} 150 150) rotate(90 150 62)">${lab}</text>`;
    }
    return s;
  }

  async bonusCT(tm, runs = null, arrow) {
    let arrows = '';
    // upright like his arrows, on top of them (their tips, in units of our wheel: CTTIP; CTARR = the angle of each tip)
    const AR = 'M138 -4 H162 V19 H176 L150 43 L124 19 H138 Z';
    for (let c = 0; c < 3; c++) arrows += `<g class="mwb-arr" transform="translate(${CTTIP[c][0] - 150} ${CTTIP[c][1] - 43})"><path d="${AR}" fill="${ARC[c]}" stroke="#fff" stroke-width="2.6" stroke-linejoin="round"/><path d="${AR}" fill="none" stroke="#10061f" stroke-width=".8" stroke-linejoin="round"/><path d="M142 0 H147 V20 H142 Z" fill="#fff" opacity=".35"/></g>`;
    const svg = `<svg class="mwb-wsvg" viewBox="0 0 300 300" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="mwbGold" x1="0" x2="1"><stop offset="0" stop-color="#b8780a"/><stop offset=".5" stop-color="#ffe9a0"/><stop offset="1" stop-color="#d49a1c"/></linearGradient></defs>
      <circle cx="150" cy="150" r="128" fill="#8a5a12"/><g class="mwheel">${this.ctDisc(1)}</g>
      <circle cx="150" cy="150" r="126" fill="none" stroke="#ffd76a" stroke-width="3"/>
      <image href="${asset('assets/games/madwheel/hub.webp')}" x="118" y="118" width="64" height="64"/>${arrows}</svg>`;
    this.openShow('ct', 'Méga Folie', `<div class="mwb-wh">${svg}</div>`,
      `<div class="flaps">${ARC.map((c, i) => `<button class="apick" style="--c:${c}">▼<small>${ARN[i][0].toUpperCase() + ARN[i].slice(1)}</small></button>`).join('')}</div><p class="sub">La roue tourne : là où ta flèche s’arrête, c’est ton multiplicateur.</p>`,
      '<div class="mwb-sign"><b>MÉGA</b><b>FOLIE</b></div>');
    this.ovp(`${arrow != null ? 'Ta flèche est tirée au sort…' : 'Choisis ta flèche : rouge, jaune ou bleue !'}${this.tmTxt(tm)}`);
    this.bPlay(0);
    const picks = [...this.ov.querySelectorAll('.apick')], arrs = [...this.ov.querySelectorAll('.mwb-arr')];
    let ch;
    if (arrow != null) { ch = arrow; await this.wait(1200); }
    else { this.ov.querySelector('.mwb').classList.add('pick'); ch = (await this.waitTap([...picks, ...arrs])) % 3; this.ov.querySelector('.mwb').classList.remove('pick'); }
    picks.forEach((b, i) => { b.onclick = null; b.classList.toggle('on', i === ch); b.disabled = true; });
    arrs.forEach((a, i) => { a.onclick = null; a.classList.toggle('off', i !== ch); a.classList.toggle('me', i === ch); });
    const run = runs ? runs[ch] : ctRun(ch);
    this.ovp(`Flèche ${ARN[ch]} : la roue tourne…${this.tmTxt(tm)}`);
    await this.wait(500);
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
        this.ovp(`${seg === 'D' ? 'DOUBLE' : 'TRIPLE'} ! Tous les multiplicateurs de la roue ×${seg === 'D' ? 2 : 3}, on relance…`);
        this.flash('rgba(214,47,156,.6)'); sfx.upgrade();
        await this.wait(1400);
        this.ov.querySelectorAll('text.mt').forEach((t, q) => { const v = CTSEQ[q]; if (v !== 'D' && v !== 'T') t.textContent = `×${v * mult}`; });
        this.ov.querySelector('.mw-hl')?.remove();
      }
    }
    const vals = run.idx.map((i) => { const t = CTSEQ[i]; return t === 'D' || t === 'T' ? '?' : t * mult; });
    const others = [0, 1, 2].filter((c) => c !== ch).map((c) => `${ARN[c]} ×${vals[c]}`).join(' · ');
    this.ovp(`Ta flèche ${ARN[ch]} s’arrête sur ×${run.M}${tm > 1 ? ` → ×${run.M * tm} avec le Boost` : ''} ! <small>(les autres : ${others})</small>`);
    this.bBig(`×${run.M * tm}`);
    sfx.jackpot(); fx.confetti(80);
    await this.wait(3000);
    this.closeShow();
    return ch;
  }

  destroy() {
    this.ov?.remove(); this.ro?.disconnect(); removeEventListener('resize', this.onRs); document.removeEventListener('visibilitychange', this.onVis);
    for (const v of [this.vid, this.idle]) try { v.pause(); v.removeAttribute('src'); v.load(); } catch { /* ignore */ } // frees the decoders (a phone has few)
    super.destroy();
  }

  info() {
    return this.rules(`<h4>L’émission</h4><p>Pose tes jetons puis appuie sur LANCER : la présentatrice lance la grande roue à ampoules. La flèche en haut indique la case gagnante.</p>
      <h4>La roue</h4><p>54 cases : 1 (×22), 2 (×15), 5 (×7), 10 (×4) et 6 cases bonus (Pile ou Face ×2, Pachinko ×2, Tir aux Cibles ×1, Méga Folie ×1). Mise sur une ou plusieurs cases : un chiffre paie autant de fois la mise (1 pour 1, 2 pour 1…), mise rendue en plus.</p>
      <h4>Boost</h4><p>Avant chaque tour, le Boost peut tirer une case et un multiplicateur de ×2 à ×50. Si la roue s’arrête sur cette case, son gain est multiplié.</p>
      <h4>Les 4 bonus</h4><ul class="rules"><li>${iconSVG('cf', 18)} <b>Pile ou Face</b> : une pièce, deux multiplicateurs.</li><li>${iconSVG('ch', 18)} <b>Tir aux Cibles</b> : un multiplicateur sur chacun des 132 canards (tirés au hasard à chaque fois) ; les canards se mélangent, choisis-en un.</li><li>${iconSVG('pa', 18)} <b>Pachinko</b> : la bille tombe à travers les picots dans une des 16 cases ; ×2 double toutes les cases et on relance.</li><li>${iconSVG('ct', 18)} <b>Méga Folie</b> : choisis ta flèche (rouge, jaune ou bleue), la grande roue a 32 cases : multiplicateurs de ×10 à ×200, DOUBLE et TRIPLE (tout ×2 ou ×3, on relance).</li></ul>
      <h4>Acheter un bonus</h4><p>Dans « Bonus &amp; menu » : la roue s’arrête sur le bonus choisi, joué au jeton choisi (Pile ou Face ×18, Pachinko ×17, Tir aux Cibles ×34, Méga Folie ×38 le jeton). Le Boost ne joue pas sur un bonus acheté.</p>
      <p>Gain maximum ×25 000 la mise d’une case.</p>`);
  }
}

// La Roue Folle Online: the same Top Slot, wheel and bonuses for the whole salon (online.js, withRoom).
const MadWheelOnlineGame = withRoom(MadWheelGame, {
  cls: 'g-madwheel',
  outcome: (R) => outcome(R),
  payout: (O, d, { uid, seed }) => payout(O, d, O.seg === 'ct' ? arrowOf(seed, uid) : 0).ret,
  resultMs: (O) => 19000 + (O.seg === 'cf' ? 14000 : O.seg === 'ch' ? 19000 : O.seg === 'pa' ? 3000 + O.pa.drops.length * 4200 : O.seg === 'ct' ? 6000 + Math.max(...O.ct.map((r) => r.spins.length)) * 4500 : 0),
  reset() { this.qa('.mw-spot').forEach((b) => b.classList.remove('hit', 'tsel')); this.q('.plx-wb')?.classList.remove('won'); this.q('.plx-res')?.classList.remove('on'); this.q('.tsv').textContent = '—'; },
  hello: 'Pose tes jetons puis appuie sur PRÊT : la roue part quand tout le salon est prêt.',
  rules: '<p>À la Méga Folie, la couleur de ta flèche est tirée au sort pour chaque joueur. Au Tir aux Cibles, tout le salon gagne le même multiplicateur.</p>',
});

return { MadWheelGame, MadWheelOnlineGame, outcome };
})();
