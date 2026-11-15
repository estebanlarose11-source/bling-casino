#!/usr/bin/env node
// Simulation of La Pêche (games/peche.js): runs the game's own engine (the block between ===ENGINE and ===END ENGINE).
//   node tools/sim/peche.js [spins, default 20 000 000]
// Return of each spot (1 on that spot only), how often each fish and each size comes, the bought fishings.
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../../games/peche.js'), 'utf8');
const engine = src.split('/* ===ENGINE */')[1].split('/* ===END ENGINE */')[0];
const wpickR = (r, l) => { let t = 0; for (const x of l) t += x[1]; let q = r() * t; for (const x of l) { if (q < x[1]) return x[0]; q -= x[1]; } return l[l.length - 1][0]; };
const E = new Function('wpickR', `${engine}; return { outcome, payout, fishDraw, FISH, PRICE, CAPX, SEGS };`)(wpickR);
const n = +process.argv[2] || 2e7;
const SP = ['w', 's', 'fb', 'fo', 'fr'], ret = Object.fromEntries(SP.map((k) => [k, 0])), hits = { ...ret };
const sizes = { fb: [0, 0, 0, 0], fo: [0, 0, 0, 0], fr: [0, 0, 0, 0] }, caps = { fb: 0, fo: 0, fr: 0 };
const bets = Object.fromEntries(SP.map((k) => [k, 1]));
for (let j = 0; j < n; j++) {
  const O = E.outcome();
  hits[O.seg]++;
  const p = E.payout(O, bets);
  ret[O.seg] += p.ret;
  if (O.size) { sizes[O.seg][O.size]++; if (p.cap) caps[O.seg]++; }
}
const fr = (x) => x.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
console.log(`${fr(n)} lancers`);
for (const k of SP) console.log(`${k.padEnd(3)} retour ${(ret[k] / n * 100).toFixed(2)} % · 1 lancer sur ${fr(n / hits[k])}`);
for (const k of ['fb', 'fo', 'fr']) {
  const s = sizes[k], t = s[1] + s[2] + s[3];
  console.log(`${k} tailles : canne ${(s[1] / t * 100).toFixed(1)} % · grue ${(s[2] / t * 100).toFixed(1)} % · hélico ${(s[3] / t * 100).toFixed(1)} % (1 lancer sur ${fr(n / s[3])}) · max win ${caps[k] ? `1 lancer sur ${fr(n / caps[k])}` : 'pas vu'}`);
}
// bought fishings (no lightning): exact expectation from the tables
for (const k of ['fb', 'fo', 'fr']) {
  const T = E.FISH[k], W = T.reduce((a, x) => a + x[0], 0);
  const ev = T.reduce((a, [w, l]) => { const L = l.reduce((b, x) => b + x[1], 0); return a + (w / W) * l.reduce((b, [v, q]) => b + v * q / L, 0); }, 0);
  const pm = (T[2][0] / W) * (T[2][1].at(-1)[1] / T[2][1].reduce((b, x) => b + x[1], 0));
  console.log(`achat ${k} ×${E.PRICE[k]} : moyenne ×${ev.toFixed(2)} → retour ${(ev / E.PRICE[k] * 100).toFixed(2)} % · max win 1 achat sur ${fr(Math.round(1 / pm))}`);
}
