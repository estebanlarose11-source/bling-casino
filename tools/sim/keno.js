// Super Keno : retour de chaque type de grille (1 à 10 numéros), en lisant le moteur de games/keno.js.
// node tools/sim/keno.js [tirages]
const fs = require('fs');
const src = fs.readFileSync(require('path').join(__dirname, '../../games/keno.js'), 'utf8');
const eng = src.slice(src.indexOf('/* ===ENGINE */'), src.indexOf('/* ===END ENGINE */'));
const E = new Function(eng + '; return { draw, gridResult, PAY, MAXK, N };')();
const R = +process.argv[2] || 5e6;
const ret = Array(11).fill(0), hit = Array(11).fill(0), big = Array(11).fill(0), bon = Array(11).fill(0); let mx = 0;
const grids = []; for (let k = 1; k <= 10; k++) grids[k] = Array.from({ length: k }, (_, i) => i * 7 + 1); // any fixed grid: all are alike
for (let i = 0; i < R; i++) {
  const O = E.draw();
  for (let k = 1; k <= 10; k++) { const r = E.gridResult(grids[k], O); ret[k] += r.x; if (r.x > 0) hit[k]++; if (r.bonus) bon[k]++; if (r.x >= 100) big[k]++; if (r.x > mx) mx = r.x; }
}
let all = 0;
for (let k = 1; k <= 10; k++) { all += ret[k] / R; console.log(`${String(k).padStart(2)} numéros : retour ${(ret[k] / R * 100).toFixed(2)} %, une grille gagne 1 fois sur ${(R / hit[k]).toFixed(1)}, avec la dernière boule 1 sur ${Math.round(R / Math.max(1, bon[k]))}, ≥ ×100 1 sur ${big[k] ? Math.round(R / big[k]) : '—'}`); }
console.log(`moyenne ${(all / 10 * 100).toFixed(2)} %, plus gros gain vu ×${mx}`);
