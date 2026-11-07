// Change le solde d'un joueur (triche, erreur…) : dans son compte (users/{uid}.bal, en centimes) et dans le classement
// (leaderboard/{uid}.bal, en KE). Lancé par GitHub Actions (.github/workflows/solde.yml, « Run workflow ») avec le pseudo
// et le nouveau solde en KE. Les sessions du joueur sont coupées (il doit se reconnecter) pour qu'un onglet resté ouvert
// ne réécrive pas l'ancien solde. Secret GitHub nécessaire : FIREBASE_SERVICE_ACCOUNT.
import admin from 'firebase-admin';

const pseudo = (process.env.PSEUDO || '').trim(), ke = Number(String(process.env.SOLDE || '').replace(/[\s_.]/g, '').replace(',', '.'));
const fmt = (n) => `${Math.round(n).toLocaleString('fr-FR')} KE`;

async function main() {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) throw new Error('Secret FIREBASE_SERVICE_ACCOUNT manquant');
  if (pseudo.length < 2) throw new Error('Pseudo manquant');
  if (!Number.isFinite(ke) || ke < 0 || ke > 100000000) throw new Error('Solde invalide (de 0 à 100 000 000 KE)');
  let sa;
  try { sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT); } catch { throw new Error('Le secret FIREBASE_SERVICE_ACCOUNT n’est pas le bon'); }
  admin.initializeApp({ credential: admin.credential.cert(sa) });
  const db = admin.firestore(), key = pseudo.toLocaleLowerCase('fr');
  const found = new Map();
  for (const col of ['leaderboard', 'users']) {
    const q = await db.collection(col).where('name', '==', pseudo).get();
    q.docs.forEach((d) => found.set(d.id, d.data().name));
  }
  if (!found.size) {
    for (const col of ['leaderboard', 'users']) {
      const q = await db.collection(col).select('name').get();
      q.docs.forEach((d) => { if (String(d.data().name || '').toLocaleLowerCase('fr') === key) found.set(d.id, d.data().name); });
    }
  }
  if (!found.size) throw new Error(`Aucun compte avec le pseudo « ${pseudo} »`);
  if (found.size > 1) throw new Error(`Plusieurs comptes ont ce pseudo (${[...found.values()].join(', ')}) : écris-le exactement comme dans le jeu`);
  const [uid, name] = [...found][0];
  const userRef = db.collection('users').doc(uid), boardRef = db.collection('leaderboard').doc(uid);
  const [u, b] = await Promise.all([userRef.get(), boardRef.get()]);
  if (!u.exists) throw new Error(`Le compte « ${name} » n’a pas de profil enregistré`);
  const before = (u.data().bal ?? 0) / 100;
  await admin.auth().revokeRefreshTokens(uid).catch(() => {});
  await userRef.update({ bal: Math.round(ke * 100) });
  if (b.exists) await boardRef.update({ bal: Math.round(ke * 100) / 100, updated: Date.now() });
  console.log(`✅ Solde de « ${name} » : ${fmt(before)} → ${fmt(ke)} (compte${b.exists ? ' et classement' : ''}).`);
  if (b.exists) console.log(`   Classement : record d’un tour ${fmt(b.data().best || 0)}, record de bonus ${fmt(b.data().bestBonus || 0)} (inchangés).`);
  console.log('   Ses sessions sont coupées : il devra se reconnecter.');
}

main().catch((e) => { console.error(`❌ ${e.message}`); process.exit(1); });
