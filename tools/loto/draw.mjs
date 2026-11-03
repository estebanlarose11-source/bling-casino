// Le tirage du Loto (loto.js) : tous les soirs à 21 h 30 (heure de Paris), 5 numéros de 1 à 30 tirés au hasard ici
// (crypto.randomInt), jamais dans le site : personne ne peut les connaître avant le tirage.
// Écrit loto/tirages.json : { updated, draws: { 'AAAA-MM-JJ': { n: [5 numéros triés], at } } } (60 derniers jours).
// Lancé par GitHub Actions (.github/workflows/loto.yml) plusieurs fois autour de 21 h 30 ; ne fait rien si le tirage
// du jour est déjà fait. Un jour oublié (GitHub en retard) est tiré au passage suivant.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { randomInt } from 'node:crypto';
import { dirname } from 'node:path';

const OUT = process.argv[2] || 'loto/tirages.json';
const START = '2026-11-04', N = 30, K = 5, HOUR = 21, MIN = 30;

const PF = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
function paris(t) { const o = {}; for (const p of PF.formatToParts(new Date(t))) o[p.type] = p.value; return { y: +o.year, m: +o.month, d: +o.day, h: +o.hour % 24, mi: +o.minute, s: +o.second, key: `${o.year}-${o.month}-${o.day}` }; }
function at(y, m, d, h, mi = 0) { const wall = Date.UTC(y, m - 1, d, h, mi); let t = wall; for (let k = 0; k < 2; k++) { const p = paris(t); t += wall - Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s); } return t; }

let old = {};
try { old = JSON.parse(readFileSync(OUT, 'utf8')).draws || {}; } catch { /* first draw */ }
const draws = { ...old }, now = Date.now(), p = paris(now);
let added = 0;
for (let k = 10; k >= 0; k--) {
  const t = at(p.y, p.m, p.d - k, HOUR, MIN), key = paris(t).key;
  if (key < START || draws[key] || now < t) continue;
  const n = new Set();
  while (n.size < K) n.add(1 + randomInt(N));
  draws[key] = { n: [...n].sort((a, b) => a - b), at: now };
  console.log(`Tirage du ${key} : ${draws[key].n.join(' - ')}`);
  added++;
}
if (!added) { console.log('Rien à tirer'); process.exit(0); }
const keep = Object.fromEntries(Object.entries(draws).sort(([a], [b]) => (a < b ? 1 : -1)).slice(0, 60));
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify({ updated: now, draws: keep }));
