#!/usr/bin/env node
// Simulation of Le Pilote (games/pilote.js): runs the game's own engine (the block between ===ENGINE and
// ===END ENGINE) millions of times.   node tools/sim/pilote.js [flights, default 10 000 000]
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../../games/pilote.js'), 'utf8');
const engine = src.split('/* ===ENGINE */')[1].split('/* ===END ENGINE */')[0];
const { flight, CAP } = new Function(`${engine}; return { flight, CAP };`)();
const n = +process.argv[2] || 1e7;
let paid = 0, land = 0, ge2 = 0, ge10 = 0, ge100 = 0, cap = 0, items = 0, fuel = 0, peak20 = 0, gold = 0;
const lens = new Array(31).fill(0);
for (let j = 0; j < n; j++) {
  const f = flight();
  items += f.steps.length; lens[f.steps.length]++;
  if (f.fuel) fuel++;
  if (Math.max(...f.steps.map((s) => s.T)) >= 20) peak20++;
  if (!f.ok) continue;
  land++; paid += f.pay; if (f.ship === 5) gold++;
  if (f.pay >= 2) ge2++; if (f.pay >= 10) ge10++; if (f.pay >= 100) ge100++; if (f.pay >= CAP) cap++;
}
let acc = 0, med = 0, p90 = 0;
lens.forEach((c, i) => { acc += c; if (!med && acc >= n / 2) med = i; if (!p90 && acc >= n * 0.9) p90 = i; });
const pct = (x) => `${((x / n) * 100).toFixed(2)} %`, one = (x) => (x ? `1 vol sur ${Math.round(n / x).toLocaleString('fr-FR')}` : 'jamais');
console.log(`${n.toLocaleString('fr-FR')} vols`);
console.log(`retour au joueur : ${pct(paid)}`);
console.log(`posé sur un porte-avions : ${pct(land)} (doré ×5 : ${one(gold)}) · gain ≥ ×2 : ${pct(ge2)} · ≥ ×10 : ${one(ge10)} · ≥ ×100 : ${one(ge100)} · ×${CAP} : ${one(cap)}`);
console.log(`objets par vol : moyenne ${(items / n).toFixed(1)}, médiane ${med}, 9 vols sur 10 ≤ ${p90} · réservoir vide : ${pct(fuel)} · ×20 à bord au moins une fois : ${pct(peak20)}`);
