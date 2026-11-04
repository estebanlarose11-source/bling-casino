// Tournois (events.js) : compare le record de chaque joueur gardé dans son profil (users/{uid}.tour[tid]) avec le
// classement public (tournois/{tid}/scores/{uid}) des tournois des 3 derniers jours, et remet dans le classement les
// scores qui n'y sont pas arrivés (envoi refusé, coupure…). Lancé par GitHub Actions (.github/workflows/tournoi.yml).
// MODE=verifier : liste seulement ; MODE=reparer : écrit aussi les scores manquants (jamais plus bas que l'existant).
// Secret GitHub nécessaire : FIREBASE_SERVICE_ACCOUNT.
import admin from 'firebase-admin';

const MODE = (process.env.MODE || 'verifier').trim();

async function main() {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) throw new Error('Secret FIREBASE_SERVICE_ACCOUNT manquant');
  let sa;
  try { sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT); } catch { throw new Error('Le secret FIREBASE_SERVICE_ACCOUNT n’est pas le bon fichier .json'); }
  admin.initializeApp({ credential: admin.credential.cert(sa) });
  const db = admin.firestore(), now = Date.now(), since = now - 3 * 864e5;
  const users = await db.collection('users').get();
  const boards = {};
  const board = async (tid) => (boards[tid] ||= (async () => {
    const q = await db.collection('tournois').doc(tid).collection('scores').get();
    return Object.fromEntries(q.docs.map((d) => [d.id, d.data()]));
  })());
  let fixed = 0, missing = 0;
  const seen = new Set();
  for (const u of users.docs) {
    const p = u.data(), tour = p.tour || {};
    for (const [tid, rec] of Object.entries(tour)) {
      const end = +String(tid).split('_')[2] || 0;
      if (end < since || !(rec?.best > 0)) continue;
      const b = await board(tid);
      if (!seen.has(tid)) { seen.add(tid); console.log(`\n== ${tid} (${rec.game}) : ${Object.keys(b).length} joueur(s) dans le classement`); }
      const pub = b[u.id], name = String(p.name || 'Joueur').slice(0, 64);
      if (pub && pub.best >= rec.best) continue;
      missing++;
      console.log(`  ${name} : record ×${rec.best} (${rec.spins} tours) · classement ${pub ? `×${pub.best}` : 'absent'}`);
      if (MODE !== 'reparer') continue;
      await db.collection('tournois').doc(tid).collection('scores').doc(u.id).set({
        name, best: Math.min(10000, rec.best), spins: Math.max(rec.spins || 0, pub?.spins || 0), game: rec.game || pub?.game || '', updated: now,
        ...(pub?.look ? { look: pub.look } : {}),
      });
      fixed++;
      console.log('    ✅ remis dans le classement');
    }
  }
  console.log(`\n${missing} score(s) manquant(s)${MODE === 'reparer' ? `, ${fixed} remis` : ' (mode vérifier : rien écrit)'}.`);
}

main().catch((e) => { console.error(`❌ ${e.message}`); process.exit(1); });
