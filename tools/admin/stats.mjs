// Bilan des visites (monitor.js → Firestore stats/AAAA-MM-JJ) : visites, nouveaux visiteurs, comptes créés, d'où
// viennent les joueurs (sources) et jeux les plus joués, jour par jour. Lancé par GitHub Actions « Stats »
// (.github/workflows/stats.yml) : le bilan s'affiche dans le résumé de la tâche (et son journal).
// Secret GitHub nécessaire : FIREBASE_SERVICE_ACCOUNT.
import admin from 'firebase-admin';
import { appendFileSync } from 'node:fs';

const DAYS = Math.max(1, Math.min(60, +process.env.DAYS || 14));
if (!process.env.FIREBASE_SERVICE_ACCOUNT) { console.error('Secret FIREBASE_SERVICE_ACCOUNT manquant'); process.exit(1); }
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = admin.firestore();

const days = Array.from({ length: DAYS }, (_, k) => new Date(Date.now() - k * 864e5).toISOString().slice(0, 10));
const docs = await Promise.all(days.map((d) => db.collection('stats').doc(d).get()));
const n = (x) => Math.round(x || 0).toLocaleString('fr-FR');
const top = (o, k = 5) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, k);
const total = { visit: 0, new: 0, compte: 0, src: {}, games: {} };
const rows = [];
docs.forEach((d, i) => {
  const o = d.exists ? d.data().opens || {} : {}, s = d.exists ? d.data().spins || {} : {};
  const src = Object.fromEntries(Object.entries(o).filter(([k]) => k.startsWith('_src_')).map(([k, v]) => [k.slice(5), v]));
  const games = Object.fromEntries(Object.entries(s).filter(([k]) => !k.startsWith('_')));
  total.visit += o._visit || 0; total.new += o._new || 0; total.compte += o._compte || 0;
  for (const [k, v] of Object.entries(src)) total.src[k] = (total.src[k] || 0) + v;
  for (const [k, v] of Object.entries(games)) total.games[k] = (total.games[k] || 0) + v;
  rows.push(`| ${days[i]} | ${n(o._visit)} | ${n(o._new)} | ${n(o._compte)} | ${top(src, 4).map(([k, v]) => `${k} ${n(v)}`).join(', ') || '—'} | ${top(games, 3).map(([k, v]) => `${k} ${n(v)}`).join(', ') || '—'} |`);
});
const md = [
  `## SpinBet · bilan des ${DAYS} derniers jours`,
  '',
  `**${n(total.visit)} visites**, dont **${n(total.new)} nouveaux visiteurs**, et **${n(total.compte)} comptes créés**.`,
  '',
  `**D’où viennent les visites :** ${top(total.src, 12).map(([k, v]) => `${k} ${n(v)}`).join(' · ') || 'pas encore de données'}`,
  '',
  `**Jeux les plus joués (tours) :** ${top(total.games, 10).map(([k, v]) => `${k} ${n(v)}`).join(' · ') || '—'}`,
  '',
  '| Jour | Visites | Nouveaux | Comptes | Sources | Jeux (tours) |',
  '|---|---|---|---|---|---|',
  ...rows,
  '',
  '_Les visites sont comptées depuis la mise en ligne du suivi (5 novembre 2026). Sources : le ?src= des liens du kit de lancement, sinon le site d’où vient le visiteur._',
].join('\n');
// Erreurs JavaScript des joueurs (monitor.js → errors/), regroupées par jeu et par message, sur la même période
const since = new Date(Date.now() - DAYS * 864e5);
const errs = await db.collection('errors').where('at', '>=', since).orderBy('at', 'desc').limit(2000).get();
const groups = {};
errs.forEach((d) => {
  const e = d.data(), k = `${e.game || '(site)'} · ${e.msg}`;
  const g = groups[k] || (groups[k] = { n: 0, users: new Set(), src: e.src, stack: e.stack, ua: e.ua, last: e.at?.toDate?.() });
  g.n++; g.users.add(e.uid || e.ua);
});
const errMd = [
  '', `## Erreurs des joueurs (${errs.size} sur ${DAYS} jours)`, '',
  ...Object.entries(groups).sort((a, b) => b[1].n - a[1].n).slice(0, 25).map(([k, g]) =>
    `- **${g.n}×** (${g.users.size} joueur${g.users.size > 1 ? 's' : ''}) ${k.replace(/\|/g, '/')}\n  - ${g.src || ''} · dernière ${g.last ? g.last.toISOString().slice(0, 16) : '?'}\n  - \`${(g.stack || '').split('\n').slice(0, 3).join(' ⟵ ').slice(0, 400)}\`\n  - ${String(g.ua || '').slice(0, 120)}`),
].join('\n');
console.log(md + errMd);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + errMd + '\n');
