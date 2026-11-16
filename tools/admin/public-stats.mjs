// Les jeux du moment (page #stats du site, tableau.js) : chaque heure, GitHub Actions « Tendances »
// (.github/workflows/tendances.yml) lit Firestore stats/ (monitor.js) et range un résumé public dans
// stats/public.json sur la branche « data » (lu par le site sur raw.githubusercontent.com : aucune lecture Firestore
// par les joueurs). Par jeu : o ouvertures, s tours, t secondes, b KE misés, n bonus déclenchés ; pour aujourd'hui,
// 7 jours et 30 jours, plus les tours de chaque jour (14 jours). Ni les gains des joueurs ni ce que rapporte le casino.
// Secret nécessaire : FIREBASE_SERVICE_ACCOUNT.   node public-stats.mjs <fichier de sortie>
import admin from 'firebase-admin';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const OUT = process.argv[2] || 'public.json';
if (!process.env.FIREBASE_SERVICE_ACCOUNT) { console.error('Secret FIREBASE_SERVICE_ACCOUNT manquant'); process.exit(1); }
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = admin.firestore();
const DAYS = 30;
const days = Array.from({ length: DAYS }, (_, k) => new Date(Date.now() - k * 864e5).toISOString().slice(0, 10)); // today first
const get = async (id) => { const d = await db.collection('stats').doc(id).get(); return d.exists ? d.data() : {}; };
const rows = await Promise.all(days.map(async (d) => ({ d, a: await get(d), m: await get(`${d}_m`), w: await get(`${d}_w`) })));
const r1 = (x) => Math.round(x || 0);
function period(list) {
  const G = {}, T = { v: 0, s: 0, t: 0, b: 0, n: 0 };
  const g = (id) => G[id] || (G[id] = { o: 0, s: 0, t: 0, b: 0, n: 0 });
  for (const r of list) {
    T.v += r.a.opens?._visit || 0;
    for (const [k, v] of Object.entries(r.a.opens || {})) if (!k.startsWith('_')) g(k).o += v;
    for (const [k, v] of Object.entries(r.a.spins || {})) if (!k.startsWith('_')) g(k).s += v;
    for (const [k, v] of Object.entries(r.m.opens || {})) g(k).t += v;
    for (const [k, v] of Object.entries(r.m.spins || {})) g(k).b += v;
    for (const [k, v] of Object.entries(r.w.spins || {})) g(k).n += v;
  }
  for (const x of Object.values(G)) { for (const k in x) x[k] = r1(x[k]); T.s += x.s; T.t += x.t; T.b += x.b; T.n += x.n; }
  return { tot: T, games: G };
}
const out = {
  at: Date.now(),
  periods: { 1: period(rows.slice(0, 1)), 7: period(rows.slice(0, 7)), 30: period(rows) },
  daily: rows.slice(0, 14).reverse().map((r) => ({ d: r.d, s: Object.entries(r.a.spins || {}).filter(([k]) => !k.startsWith('_')).reduce((a, [, v]) => a + v, 0) })),
};
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(out));
console.log(`Tendances : ${Object.keys(out.periods[7].games).length} jeux sur 7 jours, ${out.periods[7].tot.s} tours`);
