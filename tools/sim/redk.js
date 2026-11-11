#!/usr/bin/env node
// Simulation de Diamants REDK (games/redk.js) : lit le moteur du jeu (bloc ===ENGINE) et calcule le retour au joueur
// (lignes, tours de la pyramide, Ruby Link), la fréquence des bonus, du suspense et du max win, puis les deux achats.
//   node tools/sim/redk.js [tours payés, défaut 4 000 000] [achats, défaut 200 000]
const fs = require('fs'), path = require('path'), os = require('os');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const src = fs.readFileSync(path.join(__dirname, '../../games/redk.js'), 'utf8');
const engine = src.split('/* ===ENGINE */')[1].split('/* ===END ENGINE */')[0];
const E = new Function(`${engine}; return ENGINE;`)();

function work({ mode, n }) {
  const o = { n, paid: 0, sq: 0, hits: 0, line: 0, link: 0, fs: 0, nLink: 0, nFs: 0, tease: 0, cap: 0, big: 0, grand: 0, rows3: 0, vals: [] };
  if (mode === 'base') {
    for (let k = 0; k < n; k++) {
      const s = E.spin(Math.random, false);
      let t = s.x;
      // tease: exactly one ruby missing (5) or one pyramid missing (2) before the last reel
      const rb = s.rubies.filter((i) => i < 12).length, sc = s.g.slice(0, 12).filter((v) => v === E.SCAT).length;
      if (rb === 5 || sc === 2) o.tease++;
      o.line += s.x;
      if (s.fs) { const f = E.freeRun(s.fs).total; o.fs += f; t += f; o.nFs++; }
      if (s.link) { const r = E.linkRun(E.startOf(s)); o.link += r.total; t += r.total; o.nLink++; if (r.full) o.grand++; if (r.rows === 6) o.rows3++; }
      t = Math.min(E.CAPX, t);
      if (t >= E.CAPX) o.cap++;
      if (t >= 100) o.big++;
      o.paid += t; o.sq += t * t; if (t > 0) o.hits++;
    }
  } else {
    for (let k = 0; k < n; k++) {
      const r = E.linkRun(E.startRubies(6), Math.random, mode === 'super' ? { rows: E.P.superRows, mult: E.P.superMult } : {});
      const b = Math.min(E.CAPX, r.total);
      o.paid += b; o.sq += b * b; if (b >= E.CAPX) o.cap++; if (r.full) o.grand++; if (r.rows === 6) o.rows3++;
      if (o.vals.length < 50000) o.vals.push(b);
    }
  }
  return o;
}

if (!isMainThread) { parentPort.postMessage(work(workerData)); return; }

const NB = +process.argv[2] || 4000000, NBO = +process.argv[3] || 200000, CPU = Math.max(1, os.cpus().length);
const run = (mode, n) => Promise.all(Array.from({ length: CPU }, () => new Promise((ok, ko) => {
  const w = new Worker(__filename, { workerData: { mode, n: Math.ceil(n / CPU) } });
  w.on('message', ok); w.on('error', ko);
}))).then((parts) => parts.reduce((a, o) => { for (const k in o) a[k] = k === 'vals' ? a[k].concat(o[k]) : a[k] + o[k]; return a; }));

(async () => {
  const pc = (x) => `${(x * 100).toFixed(2)} %`, one = (n, k) => (k ? `1 sur ${Math.round(n / k).toLocaleString('fr-FR')}` : 'jamais');
  const b = await run('base', NB);
  const se = Math.sqrt(Math.max(0, b.sq / b.n - (b.paid / b.n) ** 2) / b.n);
  console.log(`Tours payés : ${b.n.toLocaleString('fr-FR')}`);
  console.log(`RTP total      ${pc(b.paid / b.n)} (± ${pc(2 * se)})`);
  console.log(`  lignes       ${pc(b.line / b.n)}`);
  console.log(`  pyramide     ${pc(b.fs / b.n)}  · ${one(b.n, b.nFs)} · moyenne ×${(b.fs / Math.max(1, b.nFs)).toFixed(1)}`);
  console.log(`  Ruby Link    ${pc(b.link / b.n)}  · ${one(b.n, b.nLink)} · moyenne ×${(b.link / Math.max(1, b.nLink)).toFixed(1)}`);
  console.log(`Un gain        ${one(b.n, b.hits)}`);
  console.log(`Suspense       ${one(b.n, b.tease)}`);
  console.log(`≥ ×100         ${one(b.n, b.big)} · max win ×${E.CAPX} ${one(b.n, b.cap)} · GRAND ${one(b.n, b.grand)} · 3 rangées ouvertes ${one(b.nLink, b.rows3)} Ruby Link`);
  for (const m of ['link', 'super']) {
    const o = await run(m, NBO), mean = o.paid / o.n, v = o.vals.sort((x, y) => x - y);
    console.log(`Achat ${m === 'link' ? 'RUBY LINK      ' : 'RUBY LINK SUPER'} ×${E.BUY[m]} : moyenne ×${mean.toFixed(1)} = ${pc(mean / E.BUY[m])} · médiane ×${v[v.length >> 1].toFixed(0)} · max win ${one(o.n, o.cap)} · GRAND ${one(o.n, o.grand)} · 3 rangées ${one(o.n, o.rows3)}`);
  }
})();
