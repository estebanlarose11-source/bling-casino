#!/usr/bin/env node
// Simulation de Diamants REDK (games/redk.js) : lit le moteur du jeu (bloc ===ENGINE) et calcule le retour au joueur
// (lignes, Ruby Link, La Pyramide d'or), la fréquence des bonus, du suspense et du max win, puis l'achat du Ruby Link.
//   node tools/sim/redk.js [tours payés, défaut 4 000 000] [achats, défaut 200 000] [pyramides d'or, défaut 100 000]
const fs = require('fs'), path = require('path'), os = require('os');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const src = fs.readFileSync(path.join(__dirname, '../../games/redk.js'), 'utf8');
const engine = src.split('/* ===ENGINE */')[1].split('/* ===END ENGINE */')[0];
const E = new Function(`${engine}; return ENGINE;`)();

function work({ mode, n }) {
  const o = { n, paid: 0, sq: 0, hits: 0, line: 0, link: 0, gold: 0, nLink: 0, nGold: 0, tease: 0, cap: 0, big: 0, grand: 0, rows3: 0, vals: [] };
  if (mode === 'base') {
    for (let k = 0; k < n; k++) {
      const r = E.round();
      o.line += r.line; o.link += r.link; o.gold += r.gold;
      if (r.hasLink) o.nLink++;
      if (r.hasGold) o.nGold++;
      if (r.total >= E.CAPX) o.cap++;
      if (r.total >= 100) o.big++;
      o.paid += r.total; o.sq += r.total * r.total; if (r.total > 0) o.hits++;
    }
    // tease frequency on separate screens: exactly one ruby (5) or one pyramid (3) missing before the last reel
    for (let k = 0; k < n / 4; k++) {
      const s = E.spin();
      const rb = s.rubies.filter((i) => i < 12).length, sc = s.g.slice(0, 12).filter((v) => v === E.SCAT).length;
      if (rb === 5 || sc === E.GOLD_AT - 1) o.tease += 4;
    }
  } else {
    for (let k = 0; k < n; k++) {
      const r = mode === 'gold' ? E.linkRun(E.startRubies(E.P.gStart, Math.random, true), Math.random, { gold: true }) : E.linkRun(E.startRubies(6));
      const b = Math.min(E.CAPX, r.total);
      o.paid += b; o.sq += b * b; if (b >= E.CAPX) o.cap++; if (r.full) o.grand++; if (r.rows === 6) o.rows3++;
      if (o.vals.length < 50000) o.vals.push(b);
    }
  }
  return o;
}

if (!isMainThread) { parentPort.postMessage(work(workerData)); return; }

const NB = +process.argv[2] || 4000000, NBO = +process.argv[3] || 200000, NG = +process.argv[4] || 100000, CPU = Math.max(1, os.cpus().length);
const run = (mode, n) => Promise.all(Array.from({ length: CPU }, () => new Promise((ok, ko) => {
  const w = new Worker(__filename, { workerData: { mode, n: Math.ceil(n / CPU) } });
  w.on('message', ok); w.on('error', ko);
}))).then((parts) => parts.reduce((a, o) => { for (const k in o) a[k] = k === 'vals' ? a[k].concat(o[k]) : a[k] + o[k]; return a; }));

(async () => {
  const pc = (x) => `${(x * 100).toFixed(2)} %`, one = (n, k) => (k ? `1 sur ${Math.round(n / k).toLocaleString('fr-FR')}` : 'jamais');
  const b = await run('base', NB);
  const se = Math.sqrt(Math.max(0, b.sq / b.n - (b.paid / b.n) ** 2) / b.n);
  console.log(`Tours payés : ${b.n.toLocaleString('fr-FR')}`);
  console.log(`RTP total        ${pc(b.paid / b.n)} (± ${pc(2 * se)})`);
  console.log(`  lignes         ${pc(b.line / b.n)}`);
  console.log(`  Ruby Link      ${pc(b.link / b.n)}  · ${one(b.n, b.nLink)} · moyenne ×${(b.link / Math.max(1, b.nLink)).toFixed(1)}`);
  console.log(`  Pyramide d'or  ${pc(b.gold / b.n)}  · ${one(b.n, b.nGold)} · moyenne ×${(b.gold / Math.max(1, b.nGold)).toFixed(0)}`);
  console.log(`Un gain          ${one(b.n, b.hits)}`);
  console.log(`Suspense         ${one(b.n, b.tease)}`);
  console.log(`≥ ×100           ${one(b.n, b.big)} · max win ×${E.CAPX} ${one(b.n, b.cap)}`);
  const o = await run('link', NBO), v = o.vals.sort((x, y) => x - y), mean = o.paid / o.n;
  console.log(`Achat RUBY LINK ×${E.BUY.link} : moyenne ×${mean.toFixed(1)} = ${pc(mean / E.BUY.link)} · médiane ×${v[v.length >> 1].toFixed(0)} · max win ${one(o.n, o.cap)} · GRAND ${one(o.n, o.grand)} · 3 rangées ${one(o.n, o.rows3)}`);
  const g = await run('gold', NG), gv = g.vals.sort((x, y) => x - y);
  console.log(`Pyramide d'or seule : moyenne ×${(g.paid / g.n).toFixed(0)} · médiane ×${gv[gv.length >> 1].toFixed(0)} · max win ${one(g.n, g.cap)} · GRAND ${one(g.n, g.grand)}`);
})();
