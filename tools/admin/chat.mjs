// Efface les messages du chat de plus de 48 heures (voulu par le propriétaire : le site ne garde pas tous les messages).
// Chat général chat/{id} et chat de chaque table tables/{jeu}/chat/{id}. Lancé par GitHub Actions « Chat »
// (.github/workflows/chat.yml) toutes les 6 heures, ou à la main. Secret GitHub nécessaire : FIREBASE_SERVICE_ACCOUNT.
// Le site cache déjà les messages de plus de 48 h (CHAT_TTL dans index.html) : cette tâche les retire de la base.
import admin from 'firebase-admin';
import { appendFileSync } from 'node:fs';

const HOURS = Math.max(1, +process.env.HOURS || 48);
if (!process.env.FIREBASE_SERVICE_ACCOUNT) { console.error('Secret FIREBASE_SERVICE_ACCOUNT manquant'); process.exit(1); }
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = admin.firestore();
const cutoff = admin.firestore.Timestamp.fromMillis(Date.now() - HOURS * 3600e3);

// deletes, 400 at a time, every message of a chat collection older than the cutoff
async function purge(col) {
  let n = 0;
  for (;;) {
    const q = await col.where('at', '<', cutoff).limit(400).get();
    if (q.empty) return n;
    const b = db.batch();
    q.docs.forEach((d) => b.delete(d.ref));
    await b.commit();
    n += q.size;
  }
}
const general = await purge(db.collection('chat'));
let tables = 0;
for (const t of await db.collection('tables').listDocuments()) tables += await purge(t.collection('chat'));
const msg = `Chat : ${general} message(s) du chat général et ${tables} message(s) des tables effacés (plus de ${HOURS} h).`;
console.log(msg);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${msg}\n`);
process.exit(0);
