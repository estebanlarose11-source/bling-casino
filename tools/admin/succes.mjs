// Corrige le meilleur gain (× la mise) d'un joueur sur une machine pour les succès « gain d'au moins ×… »
// (profile.ach.s.<jeu>.x dans users/{uid}) : quand un gain prouvé (vidéo…) n'a pas été compté. Ne baisse jamais.
// Lancé par GitHub Actions (.github/workflows/succes.yml) avec le pseudo, l'id du jeu et le ×. Le joueur récupère
// ensuite la récompense dans Succès. Ses sessions sont coupées (un onglet resté ouvert réécrirait l'ancienne valeur).
// Secret GitHub nécessaire : FIREBASE_SERVICE_ACCOUNT.
import admin from 'firebase-admin';

const pseudo = (process.env.PSEUDO || '').trim(), game = (process.env.JEU || '').trim();
const x = Number(String(process.env.GAIN_X || '').replace(/[×x\s]/gi, '').replace(',', '.'));

async function main() {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) throw new Error('Secret FIREBASE_SERVICE_ACCOUNT manquant');
  if (pseudo.length < 2) throw new Error('Pseudo manquant');
  if (!/^[\w-]{2,32}$/.test(game)) throw new Error('Id du jeu invalide (ex. bling, zeus, huff)');
  if (!Number.isFinite(x) || x <= 0 || x > 100000) throw new Error('Gain en × invalide');
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
  const ref = db.collection('users').doc(uid), u = await ref.get();
  if (!u.exists) throw new Error(`Le compte « ${name} » n’a pas de profil enregistré`);
  const ach = u.data().ach || {}, st = (ach.s || {})[game] || {}, before = st.x || 0;
  const p = (ach.p || {})[game] || 0;
  if (x <= before) { console.log(`ℹ️ « ${name} » a déjà ×${before} sur ${game} (prestige ${p}) : rien à changer.`); return; }
  await admin.auth().revokeRefreshTokens(uid).catch(() => {});
  await ref.update({ [`ach.s.${game}`]: { n: 0, w: 0, b: 0, a: 0, ...st, x } });
  console.log(`✅ « ${name} » · ${game} (prestige ${p}) : meilleur gain ×${before} → ×${x}. Il récupère sa récompense dans Succès.`);
  console.log('   Ses sessions sont coupées : il doit se reconnecter (ou recharger la page).');
}

main().catch((e) => { console.error(`❌ ${e.message}`); process.exit(1); });
