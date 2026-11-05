// Rangement des Shorts (lancé par .github/workflows/shorts.yml) : copie les vidéos du jour (tools/shorts/out) dans le
// dossier de la branche « shorts », ne garde que les KEEP derniers jours et écrit index.json, que la page #shorts du
// site lit sur raw.githubusercontent.com.
//   node tools/shorts/store.mjs <dossier de la branche shorts>
import { readdirSync, readFileSync, writeFileSync, copyFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const KEEP = 7; // days
const here = dirname(fileURLToPath(import.meta.url)), OUT = join(here, 'out');
const store = process.argv[2];
if (!store) { console.error('Usage : node tools/shorts/store.mjs <dossier>'); process.exit(1); }
const V = join(store, 'v');
mkdirSync(V, { recursive: true });
if (existsSync(OUT)) for (const f of readdirSync(OUT)) if (/\.(mp4|jpg|json)$/.test(f)) copyFileSync(join(OUT, f), join(V, f));

const since = new Date(Date.now() - KEEP * 864e5).toISOString().slice(0, 10);
const videos = [];
for (const f of readdirSync(V).filter((x) => x.endsWith('.json'))) {
  let m;
  try { m = JSON.parse(readFileSync(join(V, f), 'utf8')); } catch { continue; }
  if (m.date < since || !existsSync(join(V, m.file))) {
    for (const x of [f, m.file, m.poster]) if (x) rmSync(join(V, x), { force: true });
    continue;
  }
  videos.push({ ...m, file: `v/${m.file}`, poster: m.poster ? `v/${m.poster}` : null });
}
// files left without their .json (a failed day): removed too
const keep = new Set(videos.flatMap((m) => [m.file, m.poster]).filter(Boolean).map((x) => x.slice(2)));
for (const f of readdirSync(V)) if (!f.endsWith('.json') && !keep.has(f)) rmSync(join(V, f), { force: true });
videos.sort((a, b) => (b.date + b.game).localeCompare(a.date + a.game));
writeFileSync(join(store, 'index.json'), JSON.stringify({ updated: new Date().toISOString(), videos }, null, 1));
writeFileSync(join(store, 'README.md'), `# Shorts SpinBet\n\nVidéos du jour fabriquées par GitHub Actions (tools/shorts). À regarder et télécharger sur https://www.spinbetcaz.com/#shorts\n`);
console.log(`Shorts : ${videos.length} vidéo(s) sur ${KEEP} jours`);
