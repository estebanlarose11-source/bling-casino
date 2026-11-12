#!/usr/bin/env node
// Simulation du Coffre aux Pirates (games/pirates.js) : lit le moteur du jeu (bloc ===ENGINE) et calcule
// le retour au joueur (lignes, Crabe, La Chasse au trésor), la fréquence des gains, des bonus, du full screen
// et du max win, puis l'achat du bonus.
//   node tools/sim/pirates.js [tours payés, défaut 4 000 000] [achats, défaut 300 000]
const fs = require('fs'), path = require('path'), os = require('os');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const src = fs.readFileSync(path.join(__dirname, '../../games/pirates.js'), 'utf8');
const engine = src.split('/* ===ENGINE */')[1].split('/* ===END ENGINE */')[0];
const E = new Function(`${engine}; return ENGINE;`)();

function work({ mode, n }) {
  const o = { n, paid: 0, hits: 0, line: 0, collect: 0, heist: 0, nHeist: 0, fs: 0, nFs: 0, fv: [], jmini: 0, jminor: 0, jmajor: 0, jgrand: 0, full: 0, cap: 0, b10: 0, b100: 0, b1000: 0, hv: [] };
  for (let k = 0; k < n; k++) {
    const r = mode === 'base' ? E.round() : E.buyRun(Math.random, mode);
    if (mode === 'base') {
      o.line += r.line; o.collect += r.collect; o.heist += r.heist;
      if (r.hasHeist) { o.nHeist++; if (o.hv.length < 20000) o.hv.push(r.heist); }
      o.fs += r.fs; if (r.hasFs) { o.nFs++; if (o.fv.length < 20000) o.fv.push(r.fs); }
      if (r.jp) o['j' + r.jp]++;
    } else if (o.hv.length < 20000) o.hv.push(r.total);
    if (r.full) o.full++;
    if (r.total >= E.CAPX) o.cap++;
    if (r.total >= 10) o.b10++; if (r.total >= 100) o.b100++; if (r.total >= 1000) o.b1000++;
    o.paid += r.total; if (r.total > 0) o.hits++;
  }
  return o;
}
if (!isMainThread) { parentPort.postMessage(work(workerData)); return; }

const run = (mode, n) => {
  const k = Math.max(1, os.cpus().length), per = Math.ceil(n / k);
  return Promise.all(Array.from({ length: k }, () => new Promise((res, rej) => {
    const w = new Worker(__filename, { workerData: { mode, n: per } }); w.on('message', res); w.on('error', rej);
  }))).then((L) => L.reduce((a, o) => { for (const key in o) a[key] = Array.isArray(o[key]) ? (a[key] || []).concat(o[key]) : (a[key] || 0) + o[key]; return a; }, {}));
};
const pc = (x) => `${(x * 100).toFixed(2)} %`, one = (n, k) => (k ? `1 sur ${Math.round(n / k).toLocaleString('fr-FR')}` : 'jamais');
const med = (L) => { const s = [...L].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
(async () => {
  const nb = +process.argv[2] || 4e6, nbuy = +process.argv[3] || 3e5;
  const b = await run('base', nb);
  console.log(`Jeu payé (${nb.toLocaleString('fr-FR')} tours)`);
  console.log(`  RTP ${pc(b.paid / b.n)} · lignes ${pc(b.line / b.n)} · Crabe ${pc(b.collect / b.n)} · Chasse au trésor ${pc(b.heist / b.n)} · Tours gratuits ${pc(b.fs / b.n)}`);
  console.log(`  Tours gratuits ${one(b.n, b.nFs)} (moyenne ×${(b.fs / b.nFs).toFixed(1)}, médiane ×${med(b.fv)}) · meilleur jackpot d'une Chasse : MINI ${one(b.n, b.jmini)}, MINOR ${one(b.n, b.jminor)}, MAJOR ${one(b.n, b.jmajor)}, GRAND ${one(b.n, b.jgrand)}`);
  console.log(`  gain ${one(b.n, b.hits)} · ≥ ×10 ${one(b.n, b.b10)} · ≥ ×100 ${one(b.n, b.b100)} · ≥ ×1 000 ${one(b.n, b.b1000)}`);
  console.log(`  Chasse au trésor ${one(b.n, b.nHeist)} (moyenne ×${(b.heist / b.nHeist).toFixed(1)}, médiane ×${med(b.hv)}) · full screen ${one(b.n, b.full)} · max ×50 000 ${one(b.n, b.cap)}`);
  for (const kind of ['heist', 'fs']) {
    const y = await run(kind, nbuy);
    console.log(`Achat ${kind === 'fs' ? 'Tours gratuits' : 'Chasse au trésor'} ×${E.BUY[kind]} (${nbuy.toLocaleString('fr-FR')}) : retour ${pc(y.paid / y.n / E.BUY[kind])} · moyenne ×${(y.paid / y.n).toFixed(1)} · médiane ×${med(y.hv)} · full screen ${one(y.n, y.full)} · ≥ ×1 000 ${one(y.n, y.b1000)}`);
  }
})();
