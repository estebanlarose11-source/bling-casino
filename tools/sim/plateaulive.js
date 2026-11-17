#!/usr/bin/env node
// Simulation of Le Plateau Live (games/plateaulive.js): runs the game's own engine (the block between ===ENGINE and
// ===END ENGINE).   node tools/sim/plateaulive.js [spins, default 10 000 000]
// Return of each spot (1 on that spot only), how often each case and each bonus comes, the bonuses bought.
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../../games/plateaulive.js'), 'utf8');
const engine = src.split('/* ===ENGINE */')[1].split('/* ===END ENGINE */')[0];
const E = new Function(`${engine}; return { outcome, payout, boardRun, PRICE, CAPX, SEGS };`)();
const n = +process.argv[2] || 1e7;
const SP = ['1', '2', '5', '10', 'b2', 'b4'], ret = Object.fromEntries(SP.map((k) => [k, 0])), hits = { ...ret };
const bets = Object.fromEntries(SP.map((k) => [k, 1]));
let chance = 0, caps = 0, big = 0;
for (let j = 0; j < n; j++) {
  const O = E.outcome();
  hits[O.seg]++;
  if (O.mult > 1) chance++;
  const p = E.payout(O, bets);
  ret[O.seg] += p.ret;
  if (p.cap) caps++;
  if (p.ret >= 1000) big++;
}
const fr = (x) => x.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
console.log(`${fr(n)} tours de roue (78 cases, ${E.SEGS.length})`);
let tot = 0;
for (const k of SP) { tot += ret[k]; console.log(`${k.padEnd(3)} retour ${(ret[k] / n * 100).toFixed(2)} % · 1 tour sur ${fr(n / hits[k])}`); }
console.log(`toutes les cases ensemble : ${(tot / n / SP.length * 100).toFixed(2)} % · CHANCE 1 tour sur ${fr(n / chance)} · gain ≥ ×1 000 : 1 tour sur ${fr(n / Math.max(1, big))} · gain maximum ×${E.CAPX} : ${caps ? `1 tour sur ${fr(n / caps)}` : 'pas vu'}`);
// the bonuses alone (and bought: no CHANCE)
for (const [k, r] of [['b2', 2], ['b4', 4]]) {
  const m = 2e6; let s = 0, mx = 0, throws = 0, laps = 0; const q = [];
  for (let j = 0; j < m; j++) { const R = E.boardRun(r); s += R.M; throws += R.moves.length; if (R.moves.some((x) => x.full)) laps++; if (R.M > mx) mx = R.M; if (j < 200000) q.push(R.M); }
  q.sort((a, b) => a - b);
  const avg = s / m;
  console.log(`${k} : moyenne ×${avg.toFixed(2)}, médiane ×${q[q.length >> 1]}, max vu ×${mx}, ${(throws / m).toFixed(2)} lancers, tour complet ${(laps / m * 100).toFixed(1)} % · acheté ×${E.PRICE[k]} → ${((avg + 1) / E.PRICE[k] * 100).toFixed(1)} %`);
}
