// Sends the SpinBet phone notifications to every subscription saved by the site (Firestore push/, see push.js).
// Run by GitHub Actions (.github/workflows/notifications.yml) on a schedule, or by hand with a custom message:
//   - 13 h 35 (heure de Paris) : la roue du jour
//   - 20 h 35 : le tournoi du soir (21 h → minuit) et sa machine du jour (ROT dans events.js, lu dans index.html)
//   - samedi 11 h 35 : le tournoi du week-end
// Two UTC times are scheduled for each one (summer / winter time): the one that is not at the right Paris hour
// does nothing, and push_meta/sent remembers what was sent today, so nothing goes out twice.
// Secrets (GitHub → Settings → Secrets and variables → Actions): FIREBASE_SERVICE_ACCOUNT (the JSON key of the
// Firebase service account) and VAPID_PRIVATE_KEY. Manual run: PUSH_TITLE, PUSH_BODY, PUSH_URL.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import admin from 'firebase-admin';
import webpush from 'web-push';

const SITE = 'https://www.spinbetcaz.com/';
const VAPID_PUBLIC = 'BP746E-M7ljwxT2b21kU4_8qfdP7kRak9DpN4tVX-RQWdmulewPHld68wLN067Dz8l6CLRUixse-3XM4r4Anv8c';
const ROOT = fileURLToPath(new URL('../../', import.meta.url));

const paris = (t = new Date()) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23' })
    .formatToParts(t).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, mi: +p.minute, wd: p.weekday, key: `${p.year}-${p.month}-${p.day}` };
};

// Événements flash: the same draw as flashesOf in extras.js (index.html). Keep both in step.
const FLASH = { per: 3, from: 12, to: 21, minutes: 30 };
const POOL = ['fortune', 'cosmic', 'zeus', 'huff', 'candy', 'anubis', 'bling', 'pharaon', 'taco', 'billets', 'dragons', 'labo', 'chasse', 'big-bad-wolf', 'noel', 'totemx'];
const seedOf = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0) / 4294967296); };
function flashesOf(p) {
  const rnd = seedOf(`flash-${p.key}`), hours = []; // p.key = AAAA-MM-JJ, like the site (extras.js)
  while (hours.length < FLASH.per) { const h = FLASH.from + Math.floor(rnd() * (FLASH.to - FLASH.from + 1)); if (!hours.includes(h)) hours.push(h); }
  return hours.sort((a, b) => a - b).map((h) => { const half = rnd() < 0.5 ? 30 : 0; return { h, mi: half, game: POOL[Math.floor(rnd() * POOL.length)] }; });
}

// The evening tournament's machine, worked out like events.js (soirOf): ROT[day number % ROT.length].
function eveningGame(p) {
  const html = readFileSync(ROOT + 'index.html', 'utf8');
  const rot = (html.match(/const ROT = \[([^\]]+)\]/) || [])[1];
  if (!rot) return null;
  const ids = [...rot.matchAll(/'([\w-]+)'/g)].map((m) => m[1]);
  const names = Object.fromEntries([...html.matchAll(/\{"id": "([\w-]+)", "name": "([^"]+)"/g)].map((m) => [m[1], m[2]]));
  names['big-bad-wolf'] = 'Le Loup';
  const live = ids.filter((id) => names[id]);
  const id = live[Math.round(Date.UTC(p.y, p.m - 1, p.d) / 864e5) % live.length];
  return { id, name: names[id] };
}

function messages(p) { return [flashMsg(p), message(p)].filter(Boolean); }

function flashMsg(p) {
  if (process.env.PUSH_BODY) return null;
  // a flash that started less than 20 minutes ago
  const now = p.h * 60 + p.mi, f = flashesOf(p).find((x) => now >= x.h * 60 + x.mi && now < x.h * 60 + x.mi + 20);
  if (!f) return null;
  {
    const names = Object.fromEntries([...readFileSync(ROOT + 'index.html', 'utf8').matchAll(/\{"id": "([\w-]+)", "name": "([^"]+)"/g)].map((m) => [m[1], m[2]]));
    names['big-bad-wolf'] = 'Le Loup';
    return { key: `flash-${f.h}-${f.mi}`, title: `⚡ Événement flash : gains ×2 !`, body: `Pendant ${FLASH.minutes} minutes sur ${names[f.game] || 'une machine'} : tous tes gains sont doublés. Vite !`, url: `${SITE}#game-${f.game}`, tag: 'flash', ttl: 1500 };
  }
}

function message(p) {
  if (process.env.PUSH_BODY) {
    return { key: null, title: process.env.PUSH_TITLE || 'SpinBet Casino', body: process.env.PUSH_BODY, url: process.env.PUSH_URL || SITE, tag: 'annonce' };
  }
  if (p.h === 13 && p.mi >= 30) return { key: 'roue', title: '🎡 Ta roue du jour est prête', body: 'Un tour gratuit : des KE, de l’XP ou un bonus. Ton bonus du jour t’attend aussi !', url: SITE + '#roue', tag: 'roue', ttl: 6 * 3600 };
  if (p.h === 20 && p.mi >= 30) {
    const g = eveningGame(p);
    return { key: 'soir', title: '🏁 Tournoi du soir à 21 h', body: g ? `Ce soir sur ${g.name} : 10 000 KE au n°1. Ton plus gros gain en × la mise compte !` : '10 000 KE au n°1. Ton plus gros gain en × la mise compte !', url: SITE + (g ? `#game-${g.id}` : '#tournois'), tag: 'soir', ttl: 3 * 3600 };
  }
  if (p.h === 11 && p.mi >= 30 && p.wd === 'Sat') return { key: 'we', title: '🏆 Le tournoi du week-end est lancé', body: '50 000 KE au n°1, jusqu’à dimanche minuit. Viens marquer ton meilleur gain !', url: SITE + '#tournois', tag: 'we', ttl: 12 * 3600 };
  return null;
}

async function main() {
  const p = paris(), list = messages(p);
  if (!list.length) { console.log(`Rien à envoyer à ${p.h} h ${p.mi} (Paris).`); return; }
  if (!process.env.FIREBASE_SERVICE_ACCOUNT || !process.env.VAPID_PRIVATE_KEY) throw new Error('Secrets FIREBASE_SERVICE_ACCOUNT et VAPID_PRIVATE_KEY manquants');
  let key;
  try { key = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT); } catch { throw new Error('Secret FIREBASE_SERVICE_ACCOUNT invalide : il doit contenir tout le fichier .json du compte de service Firebase'); }
  admin.initializeApp({ credential: admin.credential.cert(key) });
  const db = admin.firestore();
  webpush.setVapidDetails(SITE, VAPID_PUBLIC, process.env.VAPID_PRIVATE_KEY);
  for (const msg of list) await send(db, p, msg);
}

async function send(db, p, msg) {
  const meta = db.collection('push_meta').doc('sent');
  if (msg.key) {
    const done = (await meta.get()).data() || {};
    if (done[msg.key] === p.key) { console.log(`Déjà envoyé aujourd’hui (${msg.key}).`); return; }
    await meta.set({ [msg.key]: p.key }, { merge: true });
  }
  const snap = await db.collection('push').get();
  const payload = JSON.stringify({ title: msg.title, body: msg.body, url: msg.url, tag: msg.tag });
  let ok = 0, gone = 0, fail = 0;
  const docs = snap.docs;
  for (let i = 0; i < docs.length; i += 25) {
    await Promise.all(docs.slice(i, i + 25).map(async (d) => {
      const s = d.data();
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: msg.ttl || 24 * 3600, urgency: 'normal' });
        ok++;
      } catch (e) {
        if (e.statusCode === 404 || e.statusCode === 410) { gone++; await d.ref.delete().catch(() => {}); } // unsubscribed / app removed
        else { fail++; console.warn(e.statusCode, e.body || e.message); }
      }
    }));
  }
  console.log(`« ${msg.title} » : ${ok} envoyées, ${gone} abonnements supprimés (appli désinstallée), ${fail} échecs, sur ${docs.length}.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
