// Captures d'écran des jeux pour les pages Google (jeux/<id>.html) : une sur ordinateur, une sur téléphone.
//   python3 -m http.server 8123   (à la racine du dépôt, dans un autre terminal)
//   node tools/seo/shots.js [id …]   → assets/shots/<id>.webp et <id>-tel.webp (puis changer CACHE dans sw.js)
// Les jeux « Online » reprennent les images de leur version solo (tools/seo.py).
const { chromium, devices } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs'), path = require('path');

const ROOT = path.resolve(__dirname, '../..'), OUT = path.join(ROOT, 'assets/shots'), TMP = path.join(OUT, `.tmp-${process.pid}`);
const BASE = process.env.SHOTS_URL || 'http://localhost:8123/';
fs.mkdirSync(TMP, { recursive: true });
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const block = src.slice(src.indexOf('const ORIGINALS = ['), src.indexOf('].map((g) => ({ ...g, original: true }))'));
let ids = ['big-bad-wolf', ...block.split('\n').filter((l) => l.trim().startsWith('{"id"')).map((l) => JSON.parse(l.trim().replace(/,$/, ''))).filter((g) => !g.wip).map((g) => g.id)];
ids = ids.filter((id) => !id.endsWith('-online'));
if (process.argv.length > 2) ids = process.argv.slice(2);

async function shoot(browser, opts, id, file, phone) {
  const ctx = await browser.newContext(opts);
  await ctx.addInitScript(() => { try { localStorage.setItem('spinbet_tuto_v1', '1'); } catch {} });
  const p = await ctx.newPage();
  await p.goto(`${BASE}?nopub#game-${id}`);
  await p.waitForSelector('.game-host > *:not(.game-loading)', { timeout: 20000 }).catch(() => {});
  await p.waitForTimeout(4500);
  await p.addStyleTag({ content: '.ct-fab,.toasts,.ad-offer,.live-tick,.tuto,.bw-offer{display:none!important}' });
  const host = p.locator('.game-host');
  await host.scrollIntoViewIfNeeded();
  await p.waitForTimeout(400);
  if (phone) await p.screenshot({ path: file }); else await host.screenshot({ path: file });
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  for (const id of ids) {
    try {
      const a = path.join(TMP, `${id}.png`), b = path.join(TMP, `${id}-tel.png`);
      await shoot(browser, { viewport: { width: 1280, height: 900 } }, id, a, false);
      await shoot(browser, { ...devices['iPhone 13'] }, id, b, true);
      execFileSync('python3', ['-c', `
import sys
from PIL import Image
for src, dst, w in [(sys.argv[1], sys.argv[2], 960), (sys.argv[3], sys.argv[4], 420)]:
    im = Image.open(src).convert('RGB'); im.thumbnail((w, 4000)); im.save(dst, 'WEBP', quality=72, method=6)
`, a, path.join(OUT, `${id}.webp`), b, path.join(OUT, `${id}-tel.webp`)]);
      console.log('✓', id);
    } catch (e) { console.log('✗', id, e.message.split('\n')[0]); }
  }
  await browser.close();
  fs.rmSync(TMP, { recursive: true, force: true });
})();
