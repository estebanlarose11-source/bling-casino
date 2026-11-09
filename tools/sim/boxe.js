#!/usr/bin/env node
// Simulation du Ring (games/boxe.js) : fait boxer l'ordinateur contre l'ordinateur (ou un « humain » qui appuie au
// hasard contre l'ordinateur) avec le moteur du jeu (bloc ===ENGINE), et vérifie qu'un même combat rejoué avec les
// mêmes commandes donne exactement le même résultat (indispensable pour le jeu en ligne).
//   node tools/sim/boxe.js [combats, défaut 200] [rounds, défaut 3] [--bots]
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../../games/boxe.js'), 'utf8');
const engine = src.split('/* ===ENGINE */')[1].split('/* ===END ENGINE */')[0];
const E = new Function(`${engine}; return ENGINE;`)();
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const N = +args[0] || 200, R = +args[1] || 3, BOTS = process.argv.includes('--bots');
const { G, F, PH, HOW } = E;

function bot(seed) { // un « humain » qui bouge et tape au hasard
  let s = seed >>> 0 || 1, x = 0, y = 0, left = 0, b = 0;
  const r = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  return () => {
    if (--left <= 0) { left = 6 + Math.floor(r() * 30); x = r() < 0.5 ? 0 : (r() - 0.5) * 200; y = (r() - 0.35) * 200; const k = r(); b = k < 0.1 ? E.B_R : k < 0.16 ? E.B_C : k < 0.2 ? E.B_U : k < 0.25 ? E.B_E : k < 0.35 ? E.B_G : 0; }
    else if (left < 3) b &= E.B_G;
    return E.encIn(x, y, b | E.B_ON);
  };
}
function fight(seed, lv) {
  const S = E.newMatch({ seed, rounds: R, hum: BOTS ? [1, 0] : [0, 0], ail: BOTS ? [0, lv] : [lv, lv] });
  const b = bot(seed ^ 0x9e3779b9), log = [];
  let n = 0;
  while (S[G.PHASE] !== PH.END && n < 60 * 60 * 30) { const v = BOTS ? b() : E.NEUTRAL; log.push(v); E.step(S, v, E.NEUTRAL); n++; }
  return { S, log, n };
}
const how = {}, stat = { kd: 0, land: 0, thrown: 0, sec: 0, w0: 0, w1: 0, d: 0 };
let bad = 0;
for (let k = 0; k < N; k++) {
  const lv = 1 + (k % 3), { S, log, n } = fight(1000 + k * 7919, lv);
  const h = Object.keys(HOW).find((x) => HOW[x] === S[G.HOW]); how[h] = (how[h] || 0) + 1;
  const a = E.pOf(0), b = E.pOf(1);
  stat.kd += S[a + F.TKD] + S[b + F.TKD]; stat.land += S[a + F.TL] + S[b + F.TL]; stat.thrown += S[a + F.TT] + S[b + F.TT]; stat.sec += n / 60;
  if (S[G.WIN] === 0) stat.w0++; else if (S[G.WIN] === 1) stat.w1++; else stat.d++;
  // déterminisme : le même combat rejoué
  if (k < 20) {
    const S2 = E.newMatch({ seed: 1000 + k * 7919, rounds: R, hum: BOTS ? [1, 0] : [0, 0], ail: BOTS ? [0, lv] : [lv, lv] });
    for (const v of log) E.step(S2, v, E.NEUTRAL);
    if (E.hashState(S) !== E.hashState(S2)) bad++;
  }
}
console.log(`${N} combats de ${R} rounds${BOTS ? ' (« humain » au hasard contre l’ordinateur)' : ' (ordinateur contre ordinateur)'}`);
console.log('fins :', Object.entries(how).map(([k, v]) => `${k} ${(v / N * 100).toFixed(1)} %`).join(' · '));
console.log(`victoires rouge ${stat.w0} · bleu ${stat.w1} · nuls ${stat.d}`);
console.log(`knockdowns par combat ${(stat.kd / N).toFixed(2)} · coups lancés ${(stat.thrown / N).toFixed(0)} · touchés ${(stat.land / N).toFixed(0)} (${(stat.land / stat.thrown * 100).toFixed(0)} %) · durée ${(stat.sec / N / 60).toFixed(1)} min`);
console.log(bad ? `⚠️ ${bad} combats rejoués différents !` : 'déterminisme : OK (combats rejoués identiques)');
