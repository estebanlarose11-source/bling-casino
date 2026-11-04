// Donne un nouveau mot de passe à un joueur qui a perdu l'accès à son compte (demande d'aide reçue sur la page Admin).
// Lancé par GitHub Actions (.github/workflows/mot-de-passe.yml, « Run workflow ») avec le pseudo et le nouveau mot de
// passe. Le dépôt est public : le journal n'affiche jamais le mot de passe, et l'e-mail du compte seulement masqué.
// Secret GitHub nécessaire : FIREBASE_SERVICE_ACCOUNT (le même que pour les notifications).
import admin from 'firebase-admin';

const pseudo = (process.env.PSEUDO || '').trim(), pass = process.env.NEW_PASSWORD || '';
const mask = (e) => { const [u, d] = String(e || '').split('@'); return d ? `${u.slice(0, 2)}${'*'.repeat(Math.max(1, u.length - 2))}@${d}` : '(pas d’e-mail)'; };

async function main() {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) throw new Error('Secret FIREBASE_SERVICE_ACCOUNT manquant (voir FIREBASE.md / CLAUDE.md)');
  if (pseudo.length < 2) throw new Error('Pseudo manquant');
  if (pass.length < 6) throw new Error('Le nouveau mot de passe doit faire au moins 6 caractères');
  let sa;
  // never print the secret, even in an error (the logs are public)
  try { sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT); } catch { throw new Error('Le secret FIREBASE_SERVICE_ACCOUNT n’est pas le bon : il doit contenir tout le fichier .json téléchargé dans Firebase (Paramètres du projet → Comptes de service), qui commence par {'); }
  if (!sa.private_key || !sa.client_email) throw new Error('Le secret FIREBASE_SERVICE_ACCOUNT n’est pas le fichier .json du compte de service Firebase');
  admin.initializeApp({ credential: admin.credential.cert(sa) });
  const db = admin.firestore(), key = pseudo.toLocaleLowerCase('fr');
  // the pseudo is in the public leaderboard and in the player's document; exact match first, then any case
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
  if (found.size > 1) {
    console.log(`Plusieurs comptes ont ce pseudo :`);
    for (const [uid, name] of found) { const u = await admin.auth().getUser(uid).catch(() => null); console.log(`  « ${name} » · ${mask(u?.email)} · créé le ${u?.metadata?.creationTime || '?'}`); }
    throw new Error('Pseudo ambigu : écris-le exactement comme dans le jeu (majuscules comprises)');
  }
  const [uid, name] = [...found][0];
  const user = await admin.auth().updateUser(uid, { password: pass });
  console.log(`✅ Nouveau mot de passe enregistré pour « ${name} ».`);
  console.log(`   E-mail du compte : ${mask(user.email)} (à donner au joueur pour se connecter, avec le nouveau mot de passe).`);
}

main().catch((e) => { console.error(`❌ ${e.message}`); process.exit(1); });
