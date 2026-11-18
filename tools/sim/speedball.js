// Le Speedball : retour d'une grille, en lisant le moteur de games/speedball.js.
// node tools/sim/speedball.js [tirages]
// Le retour est calculé à partir des chances de chaque nombre de lignes (et du SPEEDBALL dans l'une d'elles), mesurées par
// le tirage : beaucoup plus stable que la moyenne des gains (le ×200 du SPEEDBALL rend celle-ci très bruitée).
const fs = require('fs');
const src = fs.readFileSync(require('path').join(__dirname, '../../games/speedball.js'), 'utf8');
const eng = src.slice(src.indexOf('/* ===ENGINE */'), src.indexOf('/* ===END ENGINE */'));
const E = new Function(eng + '; return { draw, makeCard, cardResult, PAY, MULT, CAPX };')();
const R = +process.argv[2] || 4e6;
const n = [], g = []; let ret = 0, hit = 0, big = 0, mx = 0;
for (let i = 0; i < R; i++) {
  const r = E.cardResult(E.makeCard(), E.draw());
  n[r.lines] = (n[r.lines] || 0) + 1; if (r.inGold) g[r.lines] = (g[r.lines] || 0) + 1;
  ret += r.x; if (r.x > 0) hit++; if (r.x >= 100) big++; if (r.x > mx) mx = r.x;
}
let tw = 0, tm = 0; for (const [m, w] of E.MULT) { tw += w; tm += m * w; }
const EM = tm / tw; let rtp = 0;
for (let L = 1; L < n.length; L++) {
  if (!n[L]) continue;
  const p = n[L] / R, pg = (g[L] || 0) / n[L];
  rtp += p * E.PAY[L] * (1 + pg * (EM - 1));
  console.log(`${L} ligne${L > 1 ? 's' : ' '} : 1 grille sur ${Math.round(1 / p)}, SPEEDBALL dedans ${(pg * 100).toFixed(1)} %`);
}
console.log(`retour ≈ ${(rtp * 100).toFixed(2)} % (moyenne brute ${(ret / R * 100).toFixed(2)} %), une grille gagne 1 fois sur ${(R / hit).toFixed(1)}, ≥ ×100 1 sur ${Math.round(R / Math.max(1, big))}, plus gros vu ×${mx} (plafond ×${E.CAPX})`);
