#!/usr/bin/env node
// Le Gratte-Ciel (games/gratteciel.js): survival of the tower for players of different precision, and the
// multiplier table MULT (0,96 / survival of a very good player, 20 ms of timing error). node tools/sim/gratteciel.js
const F = 30, PERF = 0.12, A = 2.0, B = 0.16, D = 0.18; // same as SWAY, SPEED_A, SPEED_B in the game
const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
function surv(sigma, N) {
  const alive = new Array(F + 1).fill(0);
  for (let t = 0; t < N; t++) {
    const xs = [0], ws = [1.5]; let k = 0;
    for (let n = 1; n <= F; n++) {
      let dx = Math.min(9, A + B * n) * sigma * gauss() + D * gauss(); if (Math.abs(dx) <= PERF) dx = 0;
      xs.push(xs[n - 1] + dx); ws.push(1);
      let ok = true, sum = 0;
      for (let j = n; j >= 1; j--) { sum += xs[j]; if (Math.abs(sum / (n - j + 1) - xs[j - 1]) > ws[j - 1] / 2) { ok = false; break; } }
      if (!ok) break; k = n;
    }
    for (let i = 1; i <= k; i++) alive[i]++;
  }
  return alive.map((a) => a / N);
}
const ref = surv(0.02, 2e6);
const mult = [0]; for (let k = 1; k <= F; k++) mult.push(Math.max(mult[k - 1] + 0.01, Math.floor((0.96 / ref[k]) * 100) / 100));
console.log('MULT', JSON.stringify(mult.slice(1)));
for (const sg of [0.012, 0.02, 0.03, 0.045]) { const S = surv(sg, 4e5); let best = 0, bk = 0; for (let k = 1; k <= F; k++) { const ev = S[k] * mult[k]; if (ev > best) { best = ev; bk = k; } } console.log(`sigma ${sg}: best EV ${(best * 100).toFixed(1)}% at ${bk} cubes · EV@3 ${(S[3] * mult[3] * 100).toFixed(1)}% @10 ${(S[10] * mult[10] * 100).toFixed(1)}% @20 ${(S[20] * mult[20] * 100).toFixed(1)}%`); }
