#!/usr/bin/env node
// Simulation of Le Pilote (games/pilote.js): runs the game's own engine (the block between ===ENGINE and
// ===END ENGINE) millions of times.   node tools/sim/pilote.js [flights, default 10 000 000]
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../../games/pilote.js'), 'utf8');
const engine = src.split('/* ===ENGINE */')[1].split('/* ===END ENGINE */')[0];
const { flight, CAP } = new Function(`${engine}; return { flight, CAP };`)();
const n = +process.argv[2] || 1e7;
let paid = 0, land = 0, ge1 = 0, ge10 = 0, ge100 = 0, cap = 0, bombs = 0;
for (let j = 0; j < n; j++) {
  const f = flight();
  bombs += f.steps.filter((s) => s.it.k === 'bomb').length;
  if (!f.ok) continue;
  land++; paid += f.T;
  if (f.T >= 1) ge1++; if (f.T >= 10) ge10++; if (f.T >= 100) ge100++; if (f.T >= CAP) cap++;
}
const pct = (x) => `${((x / n) * 100).toFixed(2)} %`, one = (x) => (x ? `1 vol sur ${Math.round(n / x).toLocaleString('fr-FR')}` : 'jamais');
console.log(`${n.toLocaleString('fr-FR')} vols`);
console.log(`retour au joueur : ${pct(paid)}`);
console.log(`atterrissage : ${pct(land)} · gain ≥ ×1 : ${pct(ge1)} · ≥ ×10 : ${one(ge10)} · ≥ ×100 : ${one(ge100)} · ×${CAP} : ${one(cap)}`);
console.log(`bombes par vol : ${(bombs / n).toFixed(2)}`);
