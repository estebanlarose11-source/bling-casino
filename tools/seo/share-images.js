// Images d'aperçu des liens partagés (WhatsApp, Snap, Discord, Messenger, X…) : une image 1200 × 630 par jeu,
// assets/share/<id>.jpg, utilisée par les pages de partage j/<id>.html (tools/seo.py). L'affiche du jeu (celle du
// site), son nom, « Joue gratuitement », le logo et « argent fictif · 18+ ».
//   python3 -m http.server 8123   (à la racine du dépôt, dans un autre terminal)
//   node tools/seo/share-images.js [id …]   (puis changer CACHE dans sw.js)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');

const ROOT = path.resolve(__dirname, '../..'), OUT = path.join(ROOT, 'assets/share');
const BASE = process.env.SHOTS_URL || 'http://localhost:8123/';
fs.mkdirSync(OUT, { recursive: true });
const bebas = fs.readFileSync(path.join(__dirname, 'bebas.woff2')).toString('base64');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.addInitScript(() => { try { localStorage.setItem('spinbet_tuto_v1', '1'); } catch { /* ignore */ } });
  await page.goto(`${BASE}?nopub&nointro#accueil`);
  await page.waitForFunction(() => typeof __mods !== 'undefined' && !!__mods['covers.js']);
  const ids = process.argv.slice(2).length ? process.argv.slice(2)
    : await page.evaluate(() => __mods['games/index.js'].ALL_GAMES.filter((g) => !g.wip).map((g) => g.id));
  await page.addStyleTag({ content: `@font-face{font-family:'SB Bebas';src:url(data:font/woff2;base64,${bebas}) format('woff2')}
    body>*:not(#share){visibility:hidden!important}
    #share{position:fixed;inset:0;z-index:2147483647;width:1200px;height:630px;overflow:hidden;display:flex;align-items:center;gap:56px;padding:0 64px;
      font-family:'Inter Display','Inter',system-ui,sans-serif;color:#fff;background:#05070c;visibility:visible!important}
    #share *{visibility:visible!important}
    #share .bg{position:absolute;inset:-40px;filter:blur(26px) saturate(1.3);opacity:.55;transform:scale(1.1)}
    #share .bg svg{width:100%;height:100%}
    #share::after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,rgba(5,7,12,.25),rgba(5,7,12,.82) 55%,rgba(5,7,12,.92))}
    #share .art{position:relative;z-index:1;flex:none;width:470px;height:470px;border-radius:28px;overflow:hidden;box-shadow:0 26px 60px rgba(0,0,0,.6),0 0 0 3px rgba(255,255,255,.08)}
    #share .art svg{width:100%;height:100%;display:block}
    #share .txt{position:relative;z-index:1;display:flex;flex-direction:column;gap:14px;min-width:0}
    #share .logo{display:flex;align-items:center;gap:12px;font:900 30px 'Inter Display',sans-serif;letter-spacing:.5px}
    #share .logo i{display:grid;place-items:center;width:46px;height:46px;border-radius:50%;font-style:normal;font-size:26px;background:radial-gradient(circle at 35% 30%,#bae6fd,#3b82f6 60%,#1e3a8a)}
    #share .logo em{font-style:normal;color:#93c5fd}
    #share h1{margin:4px 0 0;font:400 104px/.92 'SB Bebas',Impact,sans-serif;letter-spacing:1px;text-shadow:0 6px 30px rgba(0,0,0,.6)}
    #share .kind{font:800 28px 'Inter Display',sans-serif;color:var(--ac)}
    #share .cta{align-self:flex-start;margin-top:10px;padding:16px 30px;border-radius:999px;font:900 34px 'Inter Display',sans-serif;
      background:linear-gradient(180deg,#7dd3fc,#2563eb);box-shadow:0 10px 30px rgba(37,99,235,.55)}
    #share .note{font:700 20px 'Inter Display',sans-serif;color:#cbd5e1}` });
  for (const id of ids) {
    const ok = await page.evaluate((id) => {
      const g = __mods['games/index.js'].getGame(id);
      if (!g) return false;
      const { coverSVG } = __mods['covers.js'];
      document.getElementById('share')?.remove();
      const kind = g.cat === 'table' ? (g.id.endsWith('-online') ? 'Jeu multijoueur gratuit' : 'Jeu de table gratuit') : g.cat === 'quick' ? 'Jeu rapide gratuit' : 'Machine à sous gratuite';
      const box = document.createElement('div');
      box.id = 'share';
      box.style.setProperty('--ac', g.colors?.[0] || '#7cc8ff');
      box.innerHTML = `<div class="bg">${coverSVG(g, { cls: 'cover', badge: false }).replace('<svg ', '<svg preserveAspectRatio="xMidYMid slice" ')}</div>
        <div class="art">${coverSVG(g, { square: true, badge: false })}</div>
        <div class="txt"><div class="logo"><i>S</i>SPINBET<em>CASINO</em></div><h1>${g.name}</h1><div class="kind">${kind}</div>
          <div class="cta">▶ Joue gratuitement</div><div class="note">Sans téléchargement · argent fictif · 18+</div></div>`;
      document.body.appendChild(box);
      return true;
    }, id);
    if (!ok) { console.log('✗', id); continue; }
    await page.waitForTimeout(900); // the poster's pictures
    // a name too long for one line: smaller
    await page.evaluate(() => { const h = document.querySelector('#share h1'); let s = 104; while (h.scrollWidth > 610 && s > 56) { s -= 6; h.style.fontSize = `${s}px`; } });
    await page.screenshot({ path: path.join(OUT, `${id}.jpg`), type: 'jpeg', quality: 84, clip: { x: 0, y: 0, width: 1200, height: 630 } });
    console.log('✓', id);
  }
  await browser.close();
})();
