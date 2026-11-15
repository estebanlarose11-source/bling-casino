#!/usr/bin/env node
// Simulation de La Fortune (games/fortune.js) : lit le moteur (bloc ===ENGINE) et calcule le retour au joueur
// (façons, tas de pièces, Hold & Spin, Méga Bonus, jackpots MINI / MAJOR / JACKPOT) puis les deux achats.
// Les jackpots progressifs sont comptés à leur valeur de départ + la part des mises qui les fait monter (PROG).
//   node tools/sim/fortune.js [tours, défaut 3 000 000] [achats, défaut 200 000]
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../../games/fortune.js'), 'utf8');
const engine = src.split('/* ===ENGINE */')[1].split('/* ===END ENGINE */')[0];
const E = new Function(`${engine}; return { spin, holdRun, startCoins, P, JP, PROG, CAPX, N };`)();
const n = +process.argv[2] || 3e6, nb = +process.argv[3] || 2e5;
const pct = (x) => `${(x * 100).toFixed(2)} %`;
let ways = 0, pot = 0, hold = 0, mega = 0, nh = 0, nm = 0, hits = 0, cap = 0; const jp = { mini: 0, major: 0, jackpot: 0 };
for (let k = 0; k < n; k++) {
  const r = E.spin();
  let t = r.base; ways += r.base; pot += r.pot;
  if (r.hold || r.mega) {
    let start = Object.fromEntries(r.coins.map((i) => [i, r.vals[i]]));
    if (r.mega && Object.keys(start).length < 6) start = { ...E.startCoins(6), ...start };
    const h = E.holdRun(start, r.mega), w = Math.min(h.total, E.CAPX);
    if (r.mega) { mega += w; nm++; } else { hold += w; nh++; }
    for (const i in h.cur) if (typeof h.cur[i] === 'string') jp[h.cur[i]]++;
    t += w; if (w >= E.CAPX) cap++;
  }
  if (t > 0) hits++;
}
const prog = Object.values(E.PROG).reduce((a, b) => a + b, 0);
const rtp = (ways + pot + hold + mega) / n + prog;
console.log(`${n.toLocaleString('fr-FR')} tours · RTP ≈ ${pct(rtp)} (façons ${pct(ways / n)}, tas ${pct(pot / n)}, Hold & Spin ${pct(hold / n)}, Méga ${pct(mega / n)}, progressifs ${pct(prog)})`);
console.log(`un gain 1 tour sur ${(n / hits).toFixed(1)} · Hold & Spin 1 sur ${(n / nh).toFixed(0)} (≈ ×${(hold / nh).toFixed(1)}) · Méga 1 sur ${(n / nm).toFixed(0)} (≈ ×${(mega / nm).toFixed(1)})`);
console.log(`MINI 1 tour sur ${(n / jp.mini).toFixed(0)} · MAJOR 1 sur ${(n / jp.major).toFixed(0)} · JACKPOT 1 sur ${(n / jp.jackpot).toFixed(0)} · max win ${cap}`);
const BUY = src.match(/BUY_HOLD = (\d+), BUY_MEGA = (\d+)/);
for (const [mg, cost] of [[false, +BUY[1]], [true, +BUY[2]]]) {
  let s = 0; for (let k = 0; k < nb; k++) s += Math.min(E.holdRun(E.startCoins(6), mg).total, E.CAPX);
  console.log(`achat ${mg ? 'MÉGA' : 'Hold & Spin'} ×${cost} : ${pct(s / nb / cost)}`);
}
