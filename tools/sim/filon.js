#!/usr/bin/env node
// Simulation de Le Filon (games/filon.js) : lit le moteur du jeu (bloc ===ENGINE) et calcule le retour au joueur
// des tours normaux, de la mise boostée, des 3 bonus, des achats et du tour doré. Utilise tous les cœurs.
//   node tools/sim/filon.js [tours normaux, défaut 2 000 000] [bonus par niveau, défaut 20 000]
const fs = require('fs'), path = require('path'), os = require('os');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const src = fs.readFileSync(path.join(__dirname, '../../games/filon.js'), 'utf8');
const engine = src.split('/* ===ENGINE */')[1].split('/* ===END ENGINE */')[0];
const E = new Function(`${engine}; return ENGINE;`)();

function work({ mode, n }) {
  const o = { n, paid: 0, sq: 0, hits: 0, t: [0, 0, 0, 0], cap: 0, big: 0, vals: [] };
  if (mode === 'base' || mode === 'ante' || mode === 'gold') {
    for (let k = 0; k < n; k++) {
      const r = E.spin(mode === 'gold' ? { pre: E.goldPre() } : { ante: mode === 'ante' });
      o.paid += r.total; o.sq += r.total * r.total; if (r.total > 0) o.hits++; if (r.total >= 100) o.big++;
      o.t[E.tierOf(r.scat)]++; if (r.capped) o.cap++;
    }
  } else {
    const tier = +mode.slice(1);
    for (let k = 0; k < n; k++) { const b = E.bonus(tier).total; o.paid += b; o.sq += b * b; if (b >= E.CAPX) o.cap++; o.vals.push(b); }
  }
  return o;
}

if (!isMainThread) { parentPort.postMessage(work(workerData)); return; }

const NB = +process.argv[2] || 2000000, NBO = +process.argv[3] || 20000, CPU = Math.max(1, os.cpus().length);
const jobs = [['base', NB], ['ante', NB / 2], ['gold', NB / 4], ['b1', NBO], ['b2', NBO], ['b3', NBO]];
const run = (mode, n) => Promise.all(Array.from({ length: CPU }, () => new Promise((ok, ko) => {
  const w = new Worker(__filename, { workerData: { mode, n: Math.ceil(n / CPU) } });
  w.on('message', ok); w.on('error', ko);
}))).then((parts) => parts.reduce((a, o) => ({ n: a.n + o.n, paid: a.paid + o.paid, sq: a.sq + o.sq, hits: a.hits + o.hits, big: a.big + o.big, cap: a.cap + o.cap, t: a.t.map((x, i) => x + o.t[i]), vals: a.vals.concat(o.vals) })));

(async () => {
  const R = {};
  for (const [m, n] of jobs) R[m] = await run(m, n);
  const mean = (o) => o.paid / o.n, se = (o) => Math.sqrt(Math.max(0, o.sq / o.n - mean(o) ** 2) / o.n);
  const pc = (x) => `${(x * 100).toFixed(1)} %`, one = (n, k) => (k ? `1 sur ${Math.round(n / k).toLocaleString('fr-FR')}` : 'jamais');
  const B = [0, mean(R.b1), mean(R.b2), mean(R.b3)];
  const part = (o) => [1, 2, 3].reduce((a, t) => a + (o.t[t] / o.n) * B[t], 0);
  const b = R.base, a = R.ante, g = R.gold;
  const bonusN = (o) => o.t[1] + o.t[2] + o.t[3];
  console.log(`${b.n.toLocaleString('fr-FR')} tours normaux : jeu de base ${pc(mean(b))} (±${(se(b) * 100).toFixed(2)}) · un gain ${one(b.n, b.hits)} · ≥ ×100 ${one(b.n, b.big)}`);
  console.log(`  bonus ${one(b.n, bonusN(b))} (${[1, 2, 3].map((t) => `${E.TIERS[t].name} ${one(b.n, b.t[t])}`).join(', ')})`);
  for (const t of [1, 2, 3]) {
    const o = R['b' + t], v = o.vals.sort((x, y) => x - y);
    console.log(`  ${E.TIERS[t].name} : moyenne ×${B[t].toFixed(1)} (±${se(o).toFixed(1)}) · médiane ×${v[v.length >> 1].toFixed(1)} · 9 sur 10 ≤ ×${v[Math.floor(v.length * 0.9)].toFixed(0)} · max win ${one(o.n, o.cap)} · achat ×${E.TIERS[t].cost} → ${pc(B[t] / E.TIERS[t].cost)}`);
  }
  const tot = mean(b) + part(b), ante = (mean(a) + part(a)) / E.ANTE_COST;
  const lucky = E.LUCKY.reduce((s, [k, p]) => s + (p / 100) * B[k], 0) / E.LUCKY_COST;
  const gold = (mean(g) + part(g)) / E.GOLD_COST;
  console.log(`RETOUR ≈ ${pc(tot)} (bonus ${pc(part(b))})`);
  console.log(`mise boostée (×${E.ANTE_COST}) ≈ ${pc(ante)} · bonus ${one(a.n, bonusN(a))}`);
  console.log(`tirage chance ×${E.LUCKY_COST} ≈ ${pc(lucky)} · tour doré ×${E.GOLD_COST} ≈ ${pc(gold)} (tour ×${mean(g).toFixed(2)} ±${se(g).toFixed(2)}, bonus ${one(g.n, bonusN(g))})`);
})();
