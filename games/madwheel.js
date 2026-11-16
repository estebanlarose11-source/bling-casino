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
/* TRACK */ const TRACK = {"large":{"w":736,"h":400,"rows":2,"cols":12,"f":[[73.05,42.38,17.45,34.25,-1],[73.05,42.38,17.45,34.26,-1],[73.05,42.38,17.45,34.27,-1],[73.05,42.39,17.45,34.28,-1],[73.06,42.39,17.45,34.29,-1],[73.06,42.4,17.46,34.3,-1],[73.07,42.4,17.47,34.31,-1],[73.08,42.41,17.47,34.32,-1],[73.09,42.42,17.48,34.33,-1],[73.1,42.42,17.49,34.35,-1],[73.11,42.43,17.5,34.36,-1],[73.12,42.44,17.51,34.37,-1],[73.13,42.45,17.52,34.39,-1],[73.13,42.46,17.54,34.41,-1],[73.13,42.47,17.55,34.42,-1],[73.13,42.49,17.56,34.44,-1],[73.13,42.5,17.57,34.46,-1],[73.12,42.51,17.59,34.48,-1],[73.1,42.53,17.6,34.5,-1],[73.08,42.54,17.61,34.52,-1],[73.05,42.56,17.62,34.53,-1],[73.02,42.58,17.63,34.55,-1],[72.98,42.59,17.64,34.57,-1],[72.94,42.61,17.65,34.59,-1],[72.89,42.63,17.66,34.61,-1],[72.84,42.64,17.67,34.63,0],[72.78,42.66,17.67,34.65,1],[72.73,42.68,17.68,34.66,2],[72.67,42.7,17.69,34.68,3],[72.62,42.72,17.7,34.7,4],[72.57,42.74,17.71,34.72,5],[72.53,42.76,17.72,34.74,6],[72.49,42.78,17.74,34.76,7],[72.46,42.8,17.75,34.78,8],[72.43,42.82,17.76,34.8,9],[72.42,42.83,17.78,34.82,10],[72.4,42.85,17.79,34.85,11],[72.4,42.86,17.81,34.88,12],[72.4,42.87,17.82,34.9,13],[72.4,42.88,17.84,34.93,14],[72.4,42.88,17.85,34.96,15],[72.41,42.89,17.86,34.99,16],[72.41,42.89,17.87,35.01,17],[72.42,42.89,17.88,35.04,18],[72.42,42.9,17.88,35.07,19],[72.43,42.9,17.89,35.09,-1],[72.43,42.9,17.9,35.12,-1],[72.44,42.91,17.91,35.14,-1],[72.45,42.91,17.92,35.16,-1],[72.46,42.92,17.93,35.19,-1],[72.48,42.93,17.94,35.21,-1],[72.49,42.94,17.96,35.23,-1],[72.52,42.95,17.98,35.25,-1],[72.54,42.96,18.0,35.28,-1],[72.57,42.97,18.02,35.31,-1],[72.61,42.99,18.05,35.34,-1],[72.65,43.01,18.07,35.37,-1],[72.69,43.02,18.1,35.4,-1],[72.73,43.04,18.13,35.44,-1],[72.77,43.06,18.16,35.49,-1],[72.82,43.08,18.19,35.53,-1],[72.86,43.1,18.22,35.58,-1],[72.91,43.12,18.26,35.62,-1],[72.95,43.14,18.29,35.67,-1],[72.98,43.16,18.32,35.72,-1],[73.02,43.18,18.35,35.77,-1],[73.05,43.19,18.38,35.82,-1],[73.07,43.2,18.4,35.86,-1],[73.09,43.2,18.42,35.9,-1],[73.1,43.2,18.43,35.94,-1],[73.11,43.2,18.44,35.98,-1],[73.11,43.18,18.44,36.01,-1],[73.12,43.17,18.45,36.03,-1],[73.12,43.16,18.45,36.06,-1],[73.13,43.14,18.45,36.08,-1],[73.14,43.13,18.46,36.1,-1],[73.15,43.13,18.47,36.12,-1],[73.17,43.13,18.48,36.14,-1],[73.19,43.13,18.5,36.17,-1],[73.22,43.14,18.52,36.19,-1],[73.25,43.16,18.54,36.22,-1],[73.27,43.18,18.57,36.26,-1],[73.3,43.21,18.6,36.3,-1],[73.32,43.24,18.63,36.34,-1],[73.34,43.28,18.66,36.38,-1],[73.36,43.32,18.69,36.43,-1],[73.37,43.36,18.72,36.47,-1],[73.39,43.4,18.75,36.52,-1],[73.4,43.45,18.79,36.57,-1],[73.41,43.5,18.82,36.62,-1],[73.42,43.54,18.85,36.67,-1],[73.42,43.58,18.88,36.72,-1],[73.43,43.62,18.9,36.77,-1],[73.44,43.65,18.93,36.81,-1],[73.44,43.67,18.94,36.85,-1],[73.45,43.68,18.96,36.88,-1],[73.47,43.68,18.98,36.92,-1],[73.49,43.69,18.99,36.95,-1],[73.51,43.68,19.01,36.98,-1],[73.55,43.68,19.03,37.02,-1],[73.59,43.68,19.06,37.05,-1],[73.63,43.67,19.09,37.08,-1],[73.68,43.67,19.12,37.12,-1],[73.73,43.67,19.16,37.15,-1],[73.78,43.66,19.2,37.19,-1],[73.83,43.66,19.23,37.22,-1],[73.87,43.66,19.27,37.26,-1],[73.92,43.66,19.31,37.3,-1],[73.95,43.66,19.34,37.34,-1],[73.98,43.67,19.37,37.39,-1],[74.0,43.68,19.4,37.43,-1],[74.01,43.69,19.42,37.47,-1],[74.02,43.71,19.44,37.51,-1],[74.02,43.73,19.46,37.55,-1],[74.02,43.75,19.48,37.59,-1],[74.01,43.77,19.5,37.63,-1],[74.0,43.8,19.51,37.67,-1],[73.99,43.83,19.53,37.71,-1],[73.97,43.86,19.55,37.75,-1],[73.96,43.89,19.56,37.79,-1],[73.95,43.93,19.58,37.83,-1],[73.94,43.96,19.59,37.87,-1],[73.93,43.99,19.61,37.91,-1],[73.92,44.02,19.62,37.95,-1],[73.91,44.05,19.64,37.99,-1],[73.91,44.08,19.66,38.03,-1],[73.91,44.11,19.68,38.07,-1],[73.91,44.14,19.71,38.11,-1],[73.91,44.18,19.74,38.16,-1],[73.92,44.22,19.77,38.21,-1],[73.93,44.26,19.81,38.25,-1],[73.94,44.31,19.85,38.31,-1],[73.95,44.36,19.89,38.36,-1],[73.96,44.41,19.93,38.41,-1],[73.96,44.46,19.97,38.47,-1],[73.96,44.5,20.0,38.52,-1],[73.95,44.55,20.04,38.58,-1],[73.94,44.59,20.06,38.63,-1],[73.92,44.63,20.09,38.68,-1],[73.9,44.67,20.11,38.73,-1],[73.88,44.71,20.13,38.77,-1],[73.86,44.75,20.16,38.82,-1],[73.85,44.8,20.18,38.87,-1],[73.84,44.84,20.21,38.92,-1],[73.83,44.89,20.24,38.97,-1],[73.82,44.93,20.27,39.02,-1],[73.82,44.98,20.3,39.07,-1],[73.82,45.02,20.33,39.12,-1],[73.82,45.06,20.36,39.17,-1],[73.82,45.1,20.39,39.22,-1],[73.83,45.13,20.42,39.27,-1],[73.84,45.16,20.46,39.32,-1],[73.85,45.19,20.5,39.37,-1],[73.86,45.22,20.54,39.42,-1],[73.88,45.25,20.58,39.47,-1],[73.9,45.28,20.62,39.53,-1],[73.91,45.31,20.66,39.58,-1],[73.93,45.34,20.7,39.64,-1],[73.95,45.37,20.75,39.7,-1],[73.96,45.4,20.79,39.77,-1],[73.97,45.43,20.83,39.83,-1],[73.98,45.46,20.86,39.9,-1],[73.99,45.49,20.9,39.96,-1],[74.0,45.52,20.94,40.03,-1],[74.01,45.57,20.98,40.1,-1],[74.03,45.61,21.02,40.17,-1],[74.04,45.67,21.06,40.24,-1],[74.06,45.73,21.1,40.32,-1],[74.08,45.79,21.14,40.39,-1],[74.1,45.86,21.19,40.47,-1],[74.13,45.93,21.24,40.55,-1],[74.15,46.01,21.28,40.62,-1],[74.17,46.08,21.32,40.7,-1],[74.19,46.15,21.36,40.77,-1],[74.21,46.21,21.4,40.84,-1],[74.22,46.27,21.43,40.91,-1],[74.23,46.33,21.46,40.97,-1],[74.24,46.38,21.49,41.04,-1],[74.24,46.42,21.52,41.1,-1],[74.24,46.46,21.55,41.15,-1],[74.24,46.5,21.57,41.21,-1],[74.23,46.54,21.6,41.27,-1],[74.23,46.58,21.63,41.32,-1],[74.22,46.62,21.65,41.38,-1],[74.2,46.66,21.68,41.43,-1],[74.19,46.7,21.71,41.49,-1],[74.17,46.75,21.73,41.55,-1],[74.16,46.8,21.76,41.6,-1],[74.14,46.86,21.79,41.66,-1],[74.12,46.92,21.82,41.72,-1],[74.1,46.98,21.85,41.78,-1],[74.09,47.05,21.88,41.85,-1],[74.07,47.12,21.91,41.91,-1],[74.06,47.19,21.95,41.98,-1],[74.05,47.27,21.98,42.05,-1],[74.04,47.34,22.01,42.11,-1],[74.03,47.41,22.05,42.18,-1],[74.02,47.48,22.08,42.25,-1],[74.01,47.54,22.11,42.32,-1],[74.0,47.59,22.13,42.38,-1],[73.99,47.64,22.16,42.45,-1],[73.98,47.68,22.18,42.51,-1],[73.98,47.71,22.21,42.58,-1],[73.97,47.73,22.23,42.64,-1],[73.97,47.75,22.26,42.7,-1],[73.97,47.77,22.28,42.76,-1],[73.98,47.79,22.31,42.82,-1],[73.98,47.8,22.34,42.88,-1],[73.99,47.82,22.37,42.94,-1],[74.0,47.83,22.39,43.0,-1],[74.01,47.84,22.42,43.06,-1],[74.02,47.86,22.45,43.12,-1],[74.02,47.87,22.48,43.18,-1],[74.03,47.89,22.51,43.24,-1],[74.04,47.9,22.54,43.29,-1],[74.05,47.92,22.57,43.35,-1],[74.05,47.94,22.6,43.4,-1],[74.05,47.96,22.62,43.46,-1],[74.04,47.97,22.65,43.51,-1],[74.03,47.99,22.67,43.56,-1],[74.02,48.01,22.7,43.61,-1],[74.0,48.03,22.72,43.66,-1],[73.98,48.05,22.74,43.71,-1],[73.95,48.07,22.76,43.76,-1],[73.93,48.09,22.78,43.81,-1],[73.9,48.11,22.8,43.86,-1],[73.88,48.12,22.82,43.9,-1],[73.85,48.14,22.84,43.95,-1],[73.83,48.16,22.86,43.99,-1],[73.81,48.18,22.88,44.04,-1],[73.8,48.2,22.9,44.08,-1],[73.79,48.21,22.91,44.12,-1],[73.78,48.23,22.93,44.17,-1],[73.78,48.26,22.95,44.21,-1],[73.79,48.28,22.97,44.25,-1],[73.81,48.3,22.99,44.29,-1],[73.84,48.33,23.02,44.33,-1],[73.88,48.36,23.04,44.36,-1],[73.94,48.39,23.06,44.4,-1],[74.0,48.42,23.08,44.43,-1],[74.07,48.45,23.11,44.47,-1]]},"haut":{"w":400,"h":736,"rows":10,"cols":12,"f":[[89.21,46.54,30.68,21.16,0],[89.28,46.57,30.78,21.18,1],[89.34,46.59,30.87,21.2,2],[89.39,46.62,30.94,21.21,3],[89.42,46.64,31.0,21.22,4],[89.44,46.65,31.06,21.23,5],[89.45,46.67,31.1,21.24,6],[89.45,46.68,31.13,21.25,7],[89.44,46.69,31.15,21.25,8],[89.42,46.7,31.17,21.25,9],[89.39,46.71,31.2,21.26,10],[89.36,46.71,31.22,21.26,11],[89.33,46.72,31.25,21.27,12],[89.28,46.73,31.27,21.27,13],[89.22,46.73,31.28,21.27,14],[89.15,46.73,31.29,21.27,15],[89.06,46.73,31.29,21.27,16],[88.95,46.73,31.28,21.27,17],[88.83,46.72,31.26,21.26,18],[88.7,46.72,31.24,21.26,-1],[88.56,46.71,31.21,21.25,-1],[88.41,46.7,31.19,21.25,-1],[88.26,46.69,31.17,21.25,-1],[88.11,46.68,31.16,21.25,-1],[87.97,46.68,31.15,21.25,-1],[87.84,46.68,31.16,21.26,-1],[87.72,46.69,31.19,21.27,-1],[87.6,46.7,31.22,21.28,19],[87.48,46.71,31.25,21.3,20],[87.37,46.72,31.29,21.31,21],[87.26,46.73,31.32,21.33,22],[87.14,46.74,31.36,21.35,23],[87.01,46.75,31.38,21.36,24],[86.88,46.75,31.4,21.38,25],[86.74,46.76,31.41,21.39,26],[86.59,46.75,31.41,21.41,27],[86.44,46.75,31.41,21.42,28],[86.29,46.75,31.41,21.43,29],[86.14,46.74,31.4,21.45,30],[85.98,46.74,31.37,21.46,31],[85.81,46.72,31.34,21.47,32],[85.64,46.71,31.3,21.49,33],[85.46,46.69,31.25,21.5,34],[85.28,46.68,31.2,21.51,-1],[85.12,46.67,31.16,21.53,-1],[84.98,46.66,31.14,21.55,-1],[84.86,46.65,31.14,21.58,-1],[84.77,46.66,31.16,21.62,-1],[84.72,46.67,31.22,21.66,-1],[84.71,46.7,31.31,21.72,-1],[84.73,46.73,31.42,21.78,-1],[84.78,46.77,31.56,21.84,-1],[84.85,46.81,31.73,21.91,-1],[84.95,46.86,31.9,21.99,-1],[85.06,46.91,32.08,22.07,-1],[85.19,46.96,32.27,22.15,-1],[85.32,47.01,32.47,22.23,-1],[85.47,47.06,32.67,22.31,-1],[85.62,47.12,32.88,22.39,-1],[85.78,47.17,33.08,22.48,-1],[85.94,47.23,33.29,22.56,-1],[86.09,47.28,33.49,22.65,-1],[86.24,47.34,33.68,22.73,-1],[86.38,47.4,33.87,22.82,-1],[86.52,47.45,34.05,22.9,-1],[86.63,47.51,34.21,22.99,-1],[86.73,47.56,34.36,23.07,-1],[86.82,47.61,34.5,23.15,-1],[86.89,47.66,34.63,23.23,-1],[86.96,47.72,34.76,23.31,-1],[87.03,47.77,34.89,23.39,-1],[87.1,47.83,35.03,23.47,-1],[87.16,47.89,35.16,23.55,-1],[87.23,47.96,35.29,23.64,-1],[87.3,48.02,35.43,23.72,-1],[87.37,48.09,35.56,23.81,-1],[87.45,48.16,35.71,23.9,-1],[87.54,48.23,35.87,24.0,-1],[87.64,48.31,36.03,24.1,-1],[87.74,48.38,36.2,24.19,-1],[87.86,48.46,36.39,24.3,-1],[87.98,48.54,36.59,24.4,-1],[88.12,48.63,36.79,24.51,-1],[88.26,48.72,37.01,24.62,-1],[88.4,48.81,37.24,24.73,-1],[88.53,48.9,37.46,24.84,-1],[88.67,49.0,37.69,24.95,-1],[88.79,49.09,37.91,25.06,-1],[88.91,49.19,38.13,25.16,-1],[89.02,49.28,38.35,25.27,-1],[89.12,49.37,38.56,25.38,-1],[89.22,49.47,38.78,25.48,-1],[89.32,49.56,38.99,25.59,-1],[89.41,49.65,39.21,25.7,-1],[89.5,49.74,39.42,25.8,-1],[89.58,49.82,39.64,25.91,-1],[89.66,49.9,39.85,26.01,-1],[89.73,49.98,40.05,26.12,-1],[89.79,50.05,40.26,26.22,-1],[89.85,50.12,40.46,26.32,-1],[89.9,50.18,40.66,26.43,-1],[89.96,50.24,40.87,26.53,-1],[90.02,50.3,41.09,26.64,-1],[90.09,50.35,41.31,26.75,-1],[90.16,50.41,41.54,26.86,-1],[90.23,50.46,41.77,26.97,-1],[90.3,50.51,42.0,27.07,-1],[90.37,50.56,42.23,27.18,-1],[90.44,50.62,42.44,27.29,-1],[90.5,50.67,42.65,27.39,-1],[90.57,50.73,42.85,27.5,-1],[90.63,50.79,43.05,27.6,-1],[90.69,50.86,43.23,27.71,-1],[90.76,50.93,43.41,27.81,-1],[90.83,51.0,43.58,27.92,-1],[90.9,51.08,43.74,28.02,-1],[90.98,51.16,43.89,28.12,-1],[91.05,51.24,44.03,28.23,-1],[91.13,51.33,44.17,28.33,-1],[91.21,51.41,44.31,28.43,-1],[91.3,51.5,44.45,28.53,-1],[91.41,51.57,44.6,28.63,-1],[91.53,51.65,44.77,28.74,-1],[91.67,51.72,44.96,28.84,-1],[91.83,51.78,45.17,28.95,-1],[92.01,51.83,45.4,29.05,-1],[92.2,51.88,45.64,29.16,-1],[92.41,51.92,45.91,29.27,-1],[92.62,51.96,46.18,29.38,-1],[92.83,51.99,46.45,29.48,35],[93.03,52.02,46.71,29.59,36],[93.21,52.05,46.95,29.68,-1],[93.37,52.07,47.17,29.77,-1],[93.51,52.09,47.37,29.86,-1],[93.64,52.11,47.55,29.94,-1],[93.74,52.13,47.7,30.02,-1],[93.83,52.16,47.84,30.09,-1],[93.91,52.18,47.96,30.16,-1],[93.99,52.21,48.08,30.22,37],[94.07,52.23,48.19,30.29,38],[94.16,52.27,48.3,30.35,-1],[94.25,52.3,48.42,30.42,39],[94.35,52.34,48.55,30.48,40],[94.46,52.38,48.69,30.54,41],[94.6,52.41,48.86,30.61,42],[94.77,52.45,49.05,30.68,43],[94.97,52.49,49.28,30.75,44],[95.2,52.52,49.54,30.83,45],[95.45,52.54,49.81,30.91,46],[95.72,52.57,50.1,30.99,47],[95.98,52.59,50.38,31.08,48],[96.23,52.6,50.65,31.15,49],[96.47,52.62,50.88,31.22,50],[96.67,52.64,51.08,31.29,51],[96.83,52.66,51.24,31.34,52],[96.97,52.67,51.36,31.39,53],[97.07,52.69,51.44,31.42,54],[97.15,52.7,51.49,31.45,55],[97.21,52.72,51.52,31.47,56],[97.26,52.73,51.53,31.49,57],[97.3,52.74,51.52,31.5,58],[97.34,52.75,51.51,31.52,59],[97.37,52.76,51.49,31.53,60],[97.41,52.77,51.47,31.54,-1],[97.46,52.79,51.45,31.55,-1],[97.5,52.8,51.43,31.56,-1],[97.54,52.81,51.4,31.57,-1],[97.58,52.83,51.36,31.58,-1],[97.61,52.84,51.32,31.58,-1],[97.65,52.86,51.27,31.59,-1],[97.68,52.87,51.23,31.6,-1],[97.71,52.89,51.18,31.61,-1],[97.75,52.9,51.13,31.62,-1],[97.79,52.91,51.09,31.63,-1],[97.84,52.92,51.05,31.65,-1],[97.89,52.92,51.01,31.66,-1],[97.94,52.93,50.96,31.67,61],[97.99,52.93,50.93,31.69,-1],[98.04,52.93,50.89,31.7,62],[98.11,52.93,50.87,31.71,63],[98.17,52.93,50.85,31.72,64],[98.25,52.92,50.84,31.73,65],[98.33,52.92,50.84,31.74,66],[98.43,52.91,50.86,31.75,67],[98.55,52.9,50.89,31.76,68],[98.67,52.88,50.94,31.78,69],[98.81,52.87,51.01,31.79,70],[98.96,52.85,51.09,31.81,71],[99.12,52.83,51.19,31.84,72],[99.28,52.8,51.3,31.86,73],[99.44,52.78,51.43,31.88,74],[99.6,52.76,51.56,31.91,75],[99.77,52.74,51.71,31.93,76],[99.93,52.72,51.88,31.96,77],[100.08,52.7,52.04,31.99,78],[100.2,52.68,52.19,32.01,79],[100.28,52.67,52.28,32.02,80],[100.29,52.68,52.29,32.02,81],[100.24,52.69,52.21,31.99,82],[100.14,52.71,52.03,31.94,83],[99.99,52.73,51.77,31.87,84],[99.86,52.74,51.46,31.79,-1],[99.75,52.76,51.15,31.7,-1],[99.72,52.76,50.9,31.62,-1],[99.72,52.74,50.67,31.54,-1],[99.8,52.75,50.56,31.51,-1],[99.78,52.81,50.52,31.5,85],[99.72,52.87,50.51,31.49,86],[99.72,52.9,50.5,31.49,87],[99.61,52.96,50.51,31.48,88],[99.49,53.0,50.49,31.47,89],[99.43,53.02,50.45,31.44,-1],[99.43,53.01,50.39,31.41,-1],[99.49,52.97,50.32,31.36,-1],[99.57,52.91,50.25,31.32,90],[99.67,52.9,50.23,31.31,91],[99.68,52.87,50.18,31.28,92],[99.76,52.83,50.13,31.25,93],[99.79,52.8,50.09,31.22,94],[99.7,52.82,50.06,31.2,95],[99.65,52.82,50.02,31.18,96],[99.59,52.8,49.96,31.14,97],[99.51,52.8,49.91,31.11,98],[99.39,52.8,49.86,31.08,99],[99.26,52.81,49.81,31.04,100],[99.19,52.81,49.76,31.02,101],[99.17,52.79,49.71,30.99,102],[99.11,52.78,49.66,30.95,103],[99.08,52.78,49.62,30.93,104],[99.15,52.75,49.58,30.9,105],[99.14,52.75,49.53,30.87,106],[99.22,52.74,49.48,30.84,107],[99.78,52.76,49.43,30.81,108],[99.77,52.8,49.41,30.8,109],[98.84,52.82,49.34,30.75,110],[97.02,52.85,49.28,30.71,111],[94.88,52.89,49.19,30.66,112],[92.17,52.94,49.1,30.61,113],[89.26,52.99,49.03,30.56,114],[86.84,53.04,48.93,30.5,115],[86.86,53.11,48.86,30.45,116]]}}; /* /TRACK */

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

/* ---------- the TV show (owner's request of 16 November 2026) ----------
   His 2 videos of a host throwing a big wheel on a TV set (show-large.mp4: computers, show-haut.mp4: phones held upright,
   played WITH THEIR SOUND), and his wheel (gold rim with light bulbs, swirl hub: rim.webp / hub.webp cut from his picture by
   tools/art/madwheel/build.py). Our wheel (the 54 cases of the game, drawn below in the style of his picture) lies on the
   wheel of the video: TRACK gives, for every frame, its ellipse (centre and radii in % of the video) and, when the host
   passes in front of it, a cell of the mask sheet (mask-*.png) so that he stays in front of our wheel. */
const VID = {
  large: { w: 1472, h: 800, throw: 1.1, stop: 8.4 },
  haut: { w: 800, h: 1472, throw: 1.45, stop: 8.4, crop: [70, 650] }, // the phone shows rows 70 to 650 of the 736 of the video
};
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
  const C = 500, R = 452, f = (v) => v.toFixed(1);
  let s = '';
  for (let i = 0; i < NS; i++) s += `<path d="${slicePath(i, A, R, C)}" fill="${PAL[i % PAL.length]}"/>`;
  for (let i = 0; i < NS; i++) { const p = pt(i * A, R, C, C); s += `<line x1="${C}" y1="${C}" x2="${f(p[0])}" y2="${f(p[1])}" stroke="#fff" stroke-opacity=".55" stroke-width="2.4"/>`; }
  s += `<circle cx="${C}" cy="${C}" r="${R}" fill="url(#sh)"/>`;
  for (let i = 0; i < NS; i++) {
    const k = SEGS[i], a = ((i + 0.5) * A).toFixed(2), bonus = isNaN(+k);
    s += `<g transform="rotate(${a} ${C} ${C}) translate(${C} 104)"><rect x="-27" y="-27" width="54" height="54" rx="9" fill="${bonus ? COL[k] : '#121018'}" stroke="#e8b63a" stroke-width="3.5"/>${bonus ? GLYPH[k] : `<text y="${k.length > 1 ? 11 : 13}" text-anchor="middle" font-family="Arial Black,Arial,Helvetica,sans-serif" font-weight="900" font-size="${k.length > 1 ? 30 : 38}" fill="#fff">${k}</text>`}</g>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000"><defs><radialGradient id="sh" cx="500" cy="500" r="${R}" gradientUnits="userSpaceOnUse"><stop offset=".22" stop-color="#000" stop-opacity=".38"/><stop offset=".5" stop-color="#000" stop-opacity=".08"/><stop offset=".86" stop-color="#fff" stop-opacity=".1"/><stop offset="1" stop-color="#000" stop-opacity=".25"/></radialGradient></defs>${s}</svg>`;
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
const POINTER = '<svg class="mwx-ptr" viewBox="0 0 60 84" aria-hidden="true"><defs><linearGradient id="mwxG" x1="0" x2="1"><stop offset="0" stop-color="#8a5a12"/><stop offset=".45" stop-color="#ffe9a6"/><stop offset="1" stop-color="#8a5a12"/></linearGradient><radialGradient id="mwxR" cx=".4" cy=".3"><stop offset="0" stop-color="#ffb3b3"/><stop offset=".45" stop-color="#e01b2b"/><stop offset="1" stop-color="#5c0610"/></radialGradient></defs><path d="M6 6 Q30 -4 54 6 L48 40 L30 80 L12 40 Z" fill="url(#mwxG)" stroke="#5a3a08" stroke-width="2"/><path d="M15 14 Q30 8 45 14 L40 40 L30 66 L20 40 Z" fill="url(#mwxR)" stroke="#3a0408" stroke-width="1.5"/><path d="M22 18 Q28 15 33 17 L27 38 Z" fill="#fff" opacity=".55"/></svg>';
const asset = (p) => window.__assets?.[p] || `${p}?v=1`;

class MadWheelGame extends BaseGame {
  constructor(root, game, ov) {
    const online = !!ov?.online;
    super(root, game, mergeOpts(ov, {
      music: EXTRA_THEMES.madwheel, stepper: false, autoplay: true, mainLabel: 'LANCER', betLabel: 'Mise totale',
      cls: 'table-game',
      head: '<div class="hist mw-hist"></div>',
      stage: `<div class="mwx mwx-l"><div class="mwx-art">
          <video class="mwx-vid" playsinline preload="auto" disablepictureinpicture aria-hidden="true"></video>
          <div class="mwx-wb"><div class="mwx-wh"><div class="mwx-rot"><img class="mwx-disc" alt="" draggable="false"><canvas class="mwx-blur"></canvas><img class="mwx-hub" alt="" draggable="false"></div>
            <img class="mwx-rim" alt="" draggable="false"><i class="mwx-glow"></i>${POINTER}</div></div>
          <div class="mw-top"><small>BOOST</small><b class="tsv">—</b></div>
          <div class="mwx-res"></div>
          <button class="mwx-snd" type="button" aria-label="Son de l’émission">🔊</button>
        </div></div>`,
      below: `<div class="felt mw-felt"><div class="mw-spots">${SPOTS.map((k) => `<button class="mw-spot" data-k="${k}" style="--sc:${COL[k]}"><b>${isNaN(+k) ? iconSVG(k, 30) : k}</b><small>${HINT[k]}</small></button>`).join('')}</div>${BetBoard.chipsHTML()}</div>`,
      hello: 'Pose tes jetons sur les cases puis appuie sur LANCER : l’animateur lance la roue.',
      // bonuses to buy (owner's request): the wheel lands on it, then the bonus; prices for a return of about 88 %
      // (average of each bonus by simulation: Pile ou Face ×15, Pachinko ×13,9, Tir aux Cibles ×28,8, Méga Folie ×32,1)
      buys: online ? [] : [
        { id: 'cf', icon: '🪙', label: 'Pile ou Face', desc: 'L’animateur lance la roue, elle s’arrête sur Pile ou Face', cost: (b) => b * 18 },
        { id: 'pa', icon: '🎳', label: 'Pachinko', desc: 'La roue s’arrête sur le Pachinko : le palet tombe', cost: (b) => b * 17 },
        { id: 'ch', icon: '🎯', label: 'Tir aux Cibles', desc: '108 multiplicateurs cachés, tu choisis ta cible', cost: (b) => b * 34 },
        { id: 'ct', icon: '🤪', label: 'Méga Folie', desc: 'La roue géante qui double et triple tout', cost: (b) => b * 38 },
      ],
    }));
    this.cur = 0;
    this.histArr = [];
    this.board = new BetBoard(this, this.q('.mw-felt'), null);
    this.board.paint();
    // the show
    this.sc = this.q('.mwx'); this.art = this.q('.mwx-art'); this.vid = this.q('.mwx-vid');
    this.wb = this.q('.mwx-wb'); this.rot = this.q('.mwx-rot'); this.blurC = this.q('.mwx-blur');
    const disc = this.q('.mwx-disc');
    disc.onload = () => { const c = blurDisc(disc); if (c && !this.dead) { this.blurC.width = c.width; this.blurC.height = c.height; this.blurC.getContext('2d').drawImage(c, 0, 0); } };
    disc.src = discURL();
    this.q('.mwx-hub').src = asset('assets/games/madwheel/hub.webp');
    this.q('.mwx-rim').src = asset('assets/games/madwheel/rim.webp');
    this.vid.muted = true;
    this.vid.addEventListener('seeked', () => this.showFrame());
    this.vid.addEventListener('loadeddata', () => this.showFrame());
    this.vid.addEventListener('ended', () => { this.vidOn = false; });
    this.vid.addEventListener('error', () => { this.vidBad = true; });
    this.onVis = () => { if (document.hidden && this.vidOn) this.vid.pause(); };
    document.addEventListener('visibilitychange', this.onVis);
    this.sndOn = (() => { try { return localStorage.getItem('spinbet_madwheel_snd') !== '0'; } catch { return true; } })();
    this.paintSnd();
    this.q('.mwx-snd').addEventListener('click', () => this.toggleSnd());
    this.ro = new ResizeObserver(() => this.layout());
    this.ro.observe(this.sc);
    this.onRs = () => requestAnimationFrame(() => this.layout());
    addEventListener('resize', this.onRs);
    this.layout();
  }

  get bet() { return this.board?.chip || 100; } // a bought bonus is played at the chip chosen
  stakeLabel() { return this.board ? this.board.total() : 0; }
  chipSound() { sfx.click(); }
  onMeters() { if (this.mainBtn) this.mainBtn.disabled = !this.auto && (this.busy || !this.board?.total()); }

  // 🔊 on the show: its sound on or off (kept on this device)
  toggleSnd() { this.sndOn = !this.sndOn; try { localStorage.setItem('spinbet_madwheel_snd', this.sndOn ? '1' : '0'); } catch { /* ignore */ } this.paintSnd(); this.vid.muted = !this.sndOn || isMuted(); }
  paintSnd() { const b = this.q('.mwx-snd'); if (b) { b.textContent = this.sndOn ? '🔊' : '🔇'; b.title = this.sndOn ? 'Couper le son de l’émission' : 'Remettre le son de l’émission'; } }

  /* ---------- the video and the wheel on it ---------- */
  // wide video on computers, tall one on a phone held upright (its middle part: rows VID.haut.crop)
  layout() {
    if (this.dead) return;
    const full = !!this.slotEl.closest('.is-full');
    const port = full ? innerWidth < innerHeight && innerWidth < 900 : innerWidth < 700 && innerHeight > innerWidth;
    const name = port ? 'haut' : 'large';
    if (this.name === name) return;
    this.name = name; this.trk = TRACK[name]; this.vd = VID[name];
    this.sc.classList.toggle('mwx-p', port); this.sc.classList.toggle('mwx-l', !port);
    this.vidOn = false;
    this.vid.poster = asset(`assets/games/madwheel/show-${name}.webp`);
    this.vid.src = asset(`assets/games/madwheel/show-${name}.mp4`);
    this.vid.load();
    this.wb.style.setProperty('--mk', `url("${asset(`assets/games/madwheel/mask-${name}.png`)}")`);
    this.wb.style.setProperty('--cols', this.trk.cols); this.wb.style.setProperty('--rows', this.trk.rows);
    this.frame(0);
  }
  // our wheel on frame k of the video: its ellipse, and the host's mask when he is in front of it
  frame(k) {
    const f = this.trk.f[Math.max(0, Math.min(this.trk.f.length - 1, k))], s = this.wb.style;
    if (this.fk === f) return;
    this.fk = f;
    s.setProperty('--cx', f[0]); s.setProperty('--cy', f[1]); s.setProperty('--rx', f[2]); s.setProperty('--ry', f[3]);
    s.setProperty('--sx', ((f[2] * this.trk.w) / (f[3] * this.trk.h)).toFixed(4));
    const c = f[4];
    this.wb.classList.toggle('mk', c >= 0);
    if (c >= 0) {
      const cols = this.trk.cols, rows = this.trk.rows;
      s.setProperty('--mx', `${cols > 1 ? ((c % cols) / (cols - 1)) * 100 : 0}%`);
      s.setProperty('--my', `${rows > 1 ? (Math.floor(c / cols) / (rows - 1)) * 100 : 0}%`);
    }
  }
  showFrame() { if (this.trk) this.frame(Math.round((this.vid.currentTime || 0) * 24)); }
  // follows the video frame by frame while it plays (requestVideoFrameCallback when the browser has it)
  follow() {
    const v = this.vid;
    if (v.requestVideoFrameCallback) {
      const cb = (now, md) => { if (this.dead) return; this.frame(Math.round(md.mediaTime * 24)); if (!v.paused && !v.ended) v.requestVideoFrameCallback(cb); };
      v.requestVideoFrameCallback(cb);
    } else {
      const loop = () => { if (this.dead) return; this.showFrame(); if (!v.paused && !v.ended) requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
    }
  }
  rate() { return this.online ? 1.25 : this.turbo ? 1.6 : 1; }
  // the host starts the show (called from the tap itself, so that the sound may play)
  startShow() {
    const v = this.vid;
    if (this.vidBad || matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    try {
      v.pause(); v.currentTime = 0; v.playbackRate = this.rate();
      v.muted = !this.sndOn || isMuted();
      const p = v.play();
      this.vidOn = true; this.follow();
      p?.catch(() => { v.muted = true; v.play().catch(() => { this.vidOn = false; }); });
      if (!v.muted) duck?.(0.12, 9 / this.rate());
      return true;
    } catch { this.vidOn = false; return false; }
  }
  // seconds of video already played (0 when there is no video)
  vt() { return this.vidOn ? this.vid.currentTime : 0; }
  async untilVideo(t, maxMs) {
    const t0 = performance.now();
    while (this.vidOn && !this.dead && this.vid.currentTime < t && performance.now() - t0 < maxMs) await sleep(30);
  }

  // The wheel turns from the throw to the stop of the video, and lands on case idx (the pointer is on top).
  spinTo(idx, ms) {
    const from = this.cur, delta = ((-(idx + 0.5) * A - from) % 360 + 360) % 360;
    const to = from + 360 * Math.max(3, Math.round(ms / 1500)) + delta + (Math.random() - 0.5) * A * 0.7;
    this.cur = to;
    const rot = this.rot, blur = this.blurC, ptr = this.q('.mwx-ptr');
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
      if (!this.pay(tt)) { this.vid.pause(); this.vidOn = false; return; }
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
    else if (id === 'ch') { O.bd = chBoard(); O.chm = O.bd[Math.floor(Math.random() * 108)]; }
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
    const res = this.q('.mwx-res'); res.className = 'mwx-res'; res.innerHTML = '';
    this.q('.mwx-wh').classList.remove('won');
    if (!this.vidOn) this.showStarted = this.startShow(); // online rounds and automatic spins start here
    const rate = this.rate(), video = this.vidOn, V = this.vd;
    const top = O.top, tv = this.q('.tsv'), topBox = this.q('.mw-top');
    // the Boost runs while the host gets ready (until he throws the wheel)
    if (!ctx.bought) {
      this.msg('Boost…');
      topBox.classList.add('rolling', 'on');
      const t0 = performance.now(), boostMs = video ? Math.max(600, ((V.throw - 0.35) * 1000) / rate) : (this.turbo ? 600 : 1400);
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
    if (video) await this.untilVideo(V.throw, 2500);
    const spinMs = video ? Math.max(1800, ((V.stop - Math.max(V.throw, this.vt())) * 1000) / rate) : (this.turbo ? 2600 : 4600);
    const idx = O.idx, seg = O.seg;
    await this.spinTo(idx, spinMs);
    topBox.classList.remove('hit', 'on');
    this.histAdd(seg);
    this.q('.mwx-wh').classList.add('won');
    res.style.setProperty('--seg', COL[seg]);
    res.innerHTML = isNaN(+seg) ? `${iconSVG(seg, 34)}<b>${NAME[seg]}</b>` : `<b class="n">${seg}</b>`;
    res.classList.add('on');
    sfx.upgrade();
    this.q(`.mw-spot[data-k="${seg}"]`)?.classList.add('hit');
    const pp = center(this.q('.mwx-ptr')); fx.burst(pp.x, pp.y + 10, 30, [COL[seg], '#fff']);
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
    this.openOv(`<h2>Tir aux Cibles</h2><p class="msgov">Mémorise les multiplicateurs… ils vont se mélanger !${this.tmTxt(tm)}</p><div class="grid12">${bd.map((v) => `<button class="ch-t${v >= 80 ? ' hi' : ''}">${v}</button>`).join('')}</div>`);
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
    this.ovp(`Tu as touché ×${m}${tm > 1 ? ` → ×${m * tm} avec le Boost` : ''} !`);
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
      else { this.ovp(`Palet sur ×${dr.vals[dr.k]}${tm > 1 ? ` → ×${dr.vals[dr.k] * tm} avec le Boost` : ''} !`); sfx.bigWin(); await this.wait(1800); }
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
    this.ovp(`Ta flèche ${ARN[ch]} s’arrête sur ×${run.M}${tm > 1 ? ` → ×${run.M * tm} avec le Boost` : ''} ! <small>(les autres : ${others})</small>`);
    sfx.jackpot(); fx.confetti(80);
    await this.wait(3000);
    this.closeOv();
    return ch;
  }

  destroy() {
    this.ov?.remove(); this.ro?.disconnect(); removeEventListener('resize', this.onRs); document.removeEventListener('visibilitychange', this.onVis);
    try { this.vid.pause(); this.vid.removeAttribute('src'); this.vid.load(); } catch { /* ignore */ } // frees the decoder (a phone has few)
    super.destroy();
  }

  info() {
    return this.rules(`<h4>L’émission</h4><p>Pose tes jetons puis appuie sur LANCER : l’animateur lance la roue sur le plateau. Le pointeur rouge en haut indique la case gagnante.</p>
      <h4>La roue</h4><p>54 cases : 1 (×22), 2 (×15), 5 (×7), 10 (×4) et 6 cases bonus (Pile ou Face ×2, Pachinko ×2, Tir aux Cibles ×1, Méga Folie ×1). Mise sur une ou plusieurs cases : un chiffre paie autant de fois la mise (1 pour 1, 2 pour 1…), mise rendue en plus.</p>
      <h4>Boost</h4><p>Avant chaque tour, le Boost peut tirer une case et un multiplicateur de ×2 à ×50. Si la roue s’arrête sur cette case, son gain est multiplié.</p>
      <h4>Les 4 bonus</h4><ul class="rules"><li>${iconSVG('cf', 18)} <b>Pile ou Face</b> : une pièce, deux multiplicateurs.</li><li>${iconSVG('ch', 18)} <b>Tir aux Cibles</b> : 108 multiplicateurs mélangés, choisis une cible.</li><li>${iconSVG('pa', 18)} <b>Pachinko</b> : le palet tombe dans une case ; ×2 double tout et on relance.</li><li>${iconSVG('ct', 18)} <b>Méga Folie</b> : choisis ta flèche, la roue géante peut doubler ou tripler.</li></ul>
      <h4>Acheter un bonus</h4><p>Dans « Bonus &amp; menu » : la roue s’arrête sur le bonus choisi, joué au jeton choisi (Pile ou Face ×18, Pachinko ×17, Tir aux Cibles ×34, Méga Folie ×38 le jeton). Le Boost ne joue pas sur un bonus acheté.</p>
      <p>Gain maximum ×25 000 la mise d’une case.</p>`);
  }
}

// La Roue Folle Online: the same Top Slot, wheel and bonuses for the whole salon (online.js, withRoom).
const MadWheelOnlineGame = withRoom(MadWheelGame, {
  cls: 'g-madwheel',
  outcome: (R) => outcome(R),
  payout: (O, d, { uid, seed }) => payout(O, d, O.seg === 'ct' ? arrowOf(seed, uid) : 0).ret,
  resultMs: (O) => 19000 + (O.seg === 'cf' ? 6000 : O.seg === 'ch' ? 14000 : O.seg === 'pa' ? 2000 + O.pa.drops.length * 3000 : O.seg === 'ct' ? 4000 + Math.max(...O.ct.map((r) => r.spins.length)) * 4500 : 0),
  reset() { this.qa('.mw-spot').forEach((b) => b.classList.remove('hit', 'tsel')); this.q('.mwx-wh')?.classList.remove('won'); this.q('.mwx-res')?.classList.remove('on'); this.q('.tsv').textContent = '—'; },
  hello: 'Pose tes jetons puis appuie sur PRÊT : la roue part quand tout le salon est prêt.',
  rules: '<p>À la Méga Folie, la couleur de ta flèche est tirée au sort pour chaque joueur. À la Tir aux Cibles, tout le salon gagne le même multiplicateur.</p>',
});

return { MadWheelGame, MadWheelOnlineGame, outcome };
})();
