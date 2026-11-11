#!/usr/bin/env node
// Simulation du Valhalla (games/viking.js) : lit le moteur du jeu (bloc ===ENGINE) et calcule le retour au joueur
// (lignes, bonus des 4 scatters, bonus des jauges), la fréquence des bonus, puis les deux achats.
//   node tools/sim/viking.js [tours payés, défaut 4 000 000] [achats, défaut 200 000]
const fs = require('fs'), path = require('path'), os = require('os');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const file = process.env.VK_FILE || path.join(__dirname, '../../games/viking.js');
const src = fs.readFileSync(file, 'utf8');
const engine = src.split('/* ===ENGINE */')[1].split('/* ===END ENGINE */')[0];
const E = new Function(`${engine}; return ENGINE;`)();

function work({ mode, n }) {
  const o = { n, paid: 0, sq: 0, hits: 0, line: 0, bonus: 0, nNat: 0, nMs: 0, nMw: 0, cap: 0, big: 0, vals: [] };
  if (mode === 'base') {
    const st = { s: 0, w: 0 };
    for (let k = 0; k < n; k++) {
      const r = E.round(st);
      o.line += r.line; o.bonus += Math.min(r.bonus, E.CAPX);
      if (r.kind) { if (r.natural) o.nNat++; else if (r.kind === 'super') o.nMw++; else o.nMs++; }
      if (r.total >= E.CAPX) o.cap++;
      if (r.total >= 100) o.big++;
      o.paid += r.total; o.sq += r.total * r.total; if (r.total > 0) o.hits++;
    }
  } else {
    for (let k = 0; k < n; k++) {
      const b = E.buyRun(mode);
      o.paid += b; o.sq += b * b; if (b >= E.CAPX) o.cap++;
      if (o.vals.length < 50000) o.vals.push(b);
    }
  }
  return o;
}
if (!isMainThread) { parentPort.postMessage(work(workerData)); return; }

const run = (mode, n) => {
  const k = Math.max(1, Math.min(os.cpus().length, 8)), per = Math.ceil(n / k);
  return Promise.all(Array.from({ length: k }, () => new Promise((res, rej) => {
    const w = new Worker(__filename, { workerData: { mode, n: per } }); w.on('message', res); w.on('error', rej);
  }))).then((rs) => rs.reduce((a, r) => { for (const key in r) a[key] = key === 'vals' ? [...(a[key] || []), ...r[key]] : (a[key] || 0) + r[key]; return a; }, {}));
};
const pct = (x) => `${(x * 100).toFixed(2)} %`;
(async () => {
  const N = +process.argv[2] || 4e6, B = +process.argv[3] || 2e5;
  const b = await run('base', N);
  console.log(`Tours payés : ${b.n.toLocaleString('fr-FR')}`);
  console.log(`RTP total : ${pct(b.paid / b.n)}  (lignes ${pct(b.line / b.n)}, bonus ${pct(b.bonus / b.n)})`);
  console.log(`Un gain : 1 tour sur ${(b.n / b.hits).toFixed(2)} · ≥ ×100 : 1 sur ${Math.round(b.n / b.big)} · max ×${E.CAPX} : ${b.cap}`);
  const nb = b.nNat + b.nMs + b.nMw;
  console.log(`Bonus : 1 tour sur ${Math.round(b.n / nb)} (4 scatters 1 sur ${Math.round(b.n / b.nNat)}, jauge scatter 1 sur ${Math.round(b.n / b.nMs)}, jauge wild (super) 1 sur ${Math.round(b.n / b.nMw)})`);
  console.log(`Écart type d'un tour : ×${Math.sqrt(b.sq / b.n - (b.paid / b.n) ** 2).toFixed(1)}`);
  for (const kind of ['bonus', 'super']) {
    const r = await run(kind, B), v = r.vals.sort((p, q) => p - q);
    console.log(`Achat ${kind} (×${E.BUY[kind]}) : moyenne ×${(r.paid / r.n).toFixed(1)} → ${pct(r.paid / r.n / E.BUY[kind])} · médiane ×${v[v.length >> 1].toFixed(1)} · max atteint ${r.cap} fois`);
  }
})();
