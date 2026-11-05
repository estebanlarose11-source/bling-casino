// Envoi des Shorts du jour (tools/shorts/out) sur la chaîne YouTube de SpinBet, par l'API officielle (YouTube Data
// API v3, accès OAuth « refresh token »). Lancé par .github/workflows/shorts.yml après la fabrication.
// Ne fait rien tant que les secrets GitHub YT_CLIENT_ID, YT_CLIENT_SECRET et YT_REFRESH_TOKEN n'existent pas
// (marche à suivre : notes/youtube-mise-en-route.md).
// YT_PRIVACY (variable du dépôt) : « private » par défaut. Tant que Google n'a pas vérifié l'appli (audit de l'API
// YouTube), YouTube met de toute façon en privé les vidéos envoyées par l'API ; après la vérification : « public ».
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'out');
const { YT_CLIENT_ID: id, YT_CLIENT_SECRET: secret, YT_REFRESH_TOKEN: refresh } = process.env;
if (!id || !secret || !refresh) { console.log('YouTube : pas encore de clés dans les secrets, rien à envoyer'); process.exit(0); }
const privacy = ['public', 'unlisted', 'private'].includes(process.env.YT_PRIVACY) ? process.env.YT_PRIVACY : 'private';

async function token() {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: id, client_secret: secret, refresh_token: refresh, grant_type: 'refresh_token' }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error(`jeton refusé : ${JSON.stringify(j).slice(0, 300)}`);
  return j.access_token;
}

async function upload(at, m) {
  const file = join(OUT, m.file), size = statSync(file).size;
  const meta = {
    snippet: {
      title: `${m.title} #Shorts`.slice(0, 100),
      description: `${m.caption}\n\n▶ Joue gratuitement à ${m.name} : https://www.spinbetcaz.com/jeux/${m.game}.html\n\nJeu de casino gratuit en argent fictif (KE) : aucun dépôt, aucun vrai pari, aucun gain réel. Réservé aux plus de 18 ans.`,
      tags: ['casino gratuit', 'machine à sous', 'machine à sous gratuite', 'bonus', 'slots', 'SpinBet', m.name],
      categoryId: '20', defaultLanguage: 'fr', defaultAudioLanguage: 'fr',
    },
    status: { privacyStatus: privacy, selfDeclaredMadeForKids: false },
  };
  const start = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
    method: 'POST',
    headers: { Authorization: `Bearer ${at}`, 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': 'video/mp4', 'X-Upload-Content-Length': String(size) },
    body: JSON.stringify(meta),
  });
  const loc = start.headers.get('location');
  if (!start.ok || !loc) throw new Error(`début refusé (${start.status}) : ${(await start.text()).slice(0, 300)}`);
  const put = await fetch(loc, { method: 'PUT', headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(size) }, body: readFileSync(file) });
  const j = await put.json().catch(() => ({}));
  if (!put.ok || !j.id) throw new Error(`envoi refusé (${put.status}) : ${JSON.stringify(j).slice(0, 300)}`);
  return j.id;
}

const list = readdirSync(OUT).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(join(OUT, f), 'utf8')));
if (!list.length) { console.log('YouTube : pas de vidéo aujourd’hui'); process.exit(0); }
let failed = 0;
const at = await token();
for (const m of list) {
  try { console.log(`YouTube (${privacy}) : https://youtube.com/shorts/${await upload(at, m)} · ${m.title}`); }
  catch (e) { failed++; console.error(`YouTube : ${m.file} pas envoyée : ${e.message}`); }
}
process.exit(failed ? 1 : 0);
