// Miniatures des jeux (demande du propriétaire du 17 novembre 2026 : « une photo avec la croupière et le tapis, comme Le Plateau
// Live ») : chaque jeu (hors machines à sous) est ouvert dans le navigateur, joué jusqu'à un bel instant, puis la zone du jeu
// est recadrée en 600 × 800 → assets/games/<id>/cover.webp. Le haut carré (600 × 600) est ce que montrent les vignettes.
//   python3 -m http.server 8123   (à la racine du dépôt, dans un autre terminal)
//   node tools/covers/shots.js [id …]   (puis changer CACHE dans sw.js)
// Réglages par jeu dans tools/covers/games.js : mode (phone = iPhone 13, pc = 1280 × 860), steps (eval / click / wait, la capture
// est prise à la fin ; until = attendre que l'expression soit vraie), rect = l'élément dont la boîte sert de cadre, puis soit fit = [cx, cy] (le plus grand cadre 3:4 dans cette
// boîte, centré là), soit col = décalage en px (toute la largeur de la boîte, à partir de son haut + col : l'écran du jeu tel que le
// joueur le voit), soit box = [x0, y0, largeur] en fractions de la boîte (hauteur = 4/3 de la largeur), hide = CSS ajouté.
const { chromium, devices } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs'), path = require('path');

const ROOT = path.resolve(__dirname, '../..'), TMP = fs.mkdtempSync(path.join(require('os').tmpdir(), 'covers-'));
const BASE = process.env.SHOTS_URL || 'http://localhost:8123/';
const G = '__mods["pages/game.js"].currentGame()';
const HIDE = '.bottom-nav,.ct-fab,.toasts,.toast,.ad-offer,.live-tick,.tuto,.bw-offer,.nudge,.lw-modal,.pw-modal,.modal-back,.win-celebrate{display:none!important}';

const GAMES = require('./games.js')(G);

async function shoot(browser, id, c, file) {
  const ctx = await browser.newContext(c.mode === 'phone' ? { ...devices['iPhone 13'], deviceScaleFactor: 3 } : { viewport: c.viewport || { width: 1280, height: 860 }, deviceScaleFactor: c.dpr || 2 });
  await ctx.addInitScript(() => { try { localStorage.setItem('spinbet_tuto_v1', '1'); } catch {} });
  const p = await ctx.newPage();
  await p.goto(`${BASE}?nopub&nointro&nostats#game-${id}`);
  await p.waitForSelector('.game-host > *:not(.game-loading)', { timeout: 20000 }).catch(() => {});
  await p.waitForTimeout(c.load || 3500);
  await p.addStyleTag({ content: HIDE + (c.hide || '') });
  for (const s of c.steps || []) {
    if (s.eval) await p.evaluate(s.eval).catch((e) => console.log('  eval ✗', e.message.split('\n')[0]));
    if (s.click) await p.click(s.click, { timeout: 4000 }).catch(() => console.log('  click ✗', s.click));
    if (s.wait) await p.waitForTimeout(s.wait);
    if (s.until) await p.waitForFunction(s.until, null, { timeout: s.max || 15000, polling: 100 }).catch(() => console.log('  until ✗', s.until.slice(0, 60)));
  }
  const r = await p.evaluate((sel) => { const n = document.querySelector(sel); if (!n) return null; const b = n.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; }, c.rect || '.game-host');
  if (!r) throw new Error(`pas de ${c.rect}`);
  await p.screenshot({ path: file });
  const dpr = await p.evaluate(() => devicePixelRatio);
  await ctx.close();
  if (c.col !== undefined) { // the full width of the rect, from c.col css px under its top (negative = above: the game's meters)
    const w = r.w, h = w * 4 / 3;
    return [r.x * dpr, (r.y + c.col) * dpr, w * dpr, h * dpr].map(Math.round);
  }
  if (c.fit) { // the largest 3:4 box inside the rect, centred on [cx, cy] (fractions of the rect), never outside it
    const [cx, cy] = c.fit, w = Math.min(r.w, r.h * 0.75), h = w * 4 / 3;
    const x = Math.max(r.x, Math.min(r.x + r.w - w, r.x + r.w * cx - w / 2)), y = Math.max(r.y, Math.min(r.y + r.h - h, r.y + r.h * cy - h / 2));
    return [x * dpr, y * dpr, w * dpr, h * dpr].map(Math.round);
  }
  const [bx, by, bw] = c.box || [0, 0, 1];
  const w = r.w * bw, h = w * 4 / 3;
  return [(r.x + r.w * bx) * dpr, (r.y + r.h * by) * dpr, w * dpr, h * dpr].map(Math.round);
}

(async () => {
  const ids = process.argv.length > 2 ? process.argv.slice(2) : Object.keys(GAMES);
  const browser = await chromium.launch();
  for (const id of ids) {
    const c = GAMES[id];
    if (!c) { console.log('✗', id, 'pas de réglage'); continue; }
    try {
      const png = path.join(TMP, `${id}.png`), out = path.join(ROOT, 'assets/games', c.dir || id, c.file || 'cover.webp');
      const [x, y, w, h] = await shoot(browser, id, c, png);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      execFileSync('python3', ['-c', `
import sys
from PIL import Image, ImageEnhance
im = Image.open(sys.argv[1]).convert('RGB')
x, y, w, h = map(int, sys.argv[3:7])
im = im.crop((x, y, x + w, y + h)).resize((600, 800), Image.LANCZOS)
im = ImageEnhance.Color(im).enhance(float(sys.argv[7]))
im.save(sys.argv[2], 'WEBP', quality=84, method=6)
`, png, out, x, y, w, h, String(c.sat || 1.08)].map(String));
      if (process.env.KEEP) fs.copyFileSync(png, path.join(process.env.KEEP, `${id}.png`));
      console.log('✓', id, `${w}×${h} px`);
    } catch (e) { console.log('✗', id, e.message.split('\n')[0]); }
  }
  await browser.close();
  fs.rmSync(TMP, { recursive: true, force: true });
})();
