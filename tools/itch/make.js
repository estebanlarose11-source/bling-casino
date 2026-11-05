// Version itch.io (et Game Jolt) du casino : le site en un seul fichier (python3 tools/bundle.py), sans pub (les
// sites de jeux n'en veulent pas dans les jeux), avec une pastille « Joue sur www.spinbetcaz.com » (compte, tournois,
// multijoueur) qui ramène les joueurs sur le site (?src=itch). Fabrique dist/itch/ : spinbet-itch.zip (à envoyer sur
// itch.io, « HTML », « joué dans le navigateur »), cover.png (630 × 500) et 5 captures (screenshot-*.png).
//   python3 tools/bundle.py && python3 -m http.server 8123 &  node tools/itch/make.js
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs'), path = require('path');

const ROOT = path.resolve(__dirname, '../..'), DIST = path.join(ROOT, 'dist'), OUT = path.join(DIST, 'itch');
const BASE = process.env.SHOTS_URL || 'http://localhost:8123/';
fs.mkdirSync(OUT, { recursive: true });

// 1. the page: no ads, and the way back to the site
let html = fs.readFileSync(path.join(DIST, 'spinbet-casino.html'), 'utf8');
const head = `<script>window.__SB_ITCH = 1; // no ads (adpolicy.js); its visits still count, as « itch »</script>
<style>.itch-pill{position:fixed;left:12px;bottom:12px;z-index:300;display:flex;align-items:center;gap:8px;max-width:calc(100% - 24px);padding:9px 14px;border-radius:999px;
background:linear-gradient(180deg,#7dd3fc,#2563eb);color:#fff;font:800 13px Inter,system-ui,sans-serif;text-decoration:none;box-shadow:0 8px 24px rgba(0,0,0,.45)}
.itch-pill b{font-weight:900}.itch-pill i{font-style:normal;margin-left:4px;opacity:.8}
@media (max-width:900px){.itch-pill{bottom:calc(84px + env(safe-area-inset-bottom,0px))}} body.fs-on .itch-pill{display:none}</style>`;
const pill = `<a class="itch-pill" href="https://www.spinbetcaz.com/?src=itch" target="_blank" rel="noopener">🎰 <span>Garde ta partie, joue avec les autres et gagne les tournois sur <b>www.spinbetcaz.com</b></span><i>↗</i></a>`;
html = html.replace('<head>', `<head>\n${head}`).replace('<body>', `<body>\n${pill}`);
fs.writeFileSync(path.join(OUT, 'index.html'), html);
fs.rmSync(path.join(OUT, 'spinbet-itch.zip'), { force: true });
execFileSync('zip', ['-q', '-j', '-9', path.join(OUT, 'spinbet-itch.zip'), path.join(OUT, 'index.html')]);

// 2. the cover (630 × 500) and 5 screenshots, from the site itself
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 630, height: 500 } });
  await p.addInitScript(() => { try { localStorage.setItem('spinbet_tuto_v1', '1'); } catch { /* ignore */ } });
  await p.goto(`${BASE}?nopub&nointro#accueil`);
  await p.waitForFunction(() => typeof __mods !== 'undefined' && !!__mods['covers.js']);
  const bebas = fs.readFileSync(path.join(ROOT, 'tools/seo/bebas.woff2')).toString('base64');
  await p.addStyleTag({ content: `@font-face{font-family:'SB Bebas';src:url(data:font/woff2;base64,${bebas}) format('woff2')}
    body>*:not(#cv){visibility:hidden!important}
    #cv{position:fixed;inset:0;z-index:2147483647;width:630px;height:500px;overflow:hidden;background:radial-gradient(circle at 50% 0%,#1e3a8a,#05070c 70%);visibility:visible!important;font-family:'Inter Display',Inter,sans-serif;color:#fff}
    #cv *{visibility:visible!important}
    #cv .row{position:absolute;left:0;right:0;top:150px;display:flex;justify-content:center;gap:14px}
    #cv .row div{width:140px;height:186px;border-radius:14px;overflow:hidden;box-shadow:0 14px 30px rgba(0,0,0,.6)}
    #cv .row div:nth-child(2),#cv .row div:nth-child(3){transform:translateY(-14px)}
    #cv .row svg{width:100%;height:100%;display:block}
    #cv h1{position:absolute;top:22px;left:0;right:0;margin:0;text-align:center;font:400 86px/1 'SB Bebas',Impact,sans-serif;letter-spacing:2px;text-shadow:0 6px 24px rgba(0,0,0,.6)}
    #cv h1 em{font-style:normal;color:#93c5fd}
    #cv p{position:absolute;bottom:26px;left:0;right:0;margin:0;text-align:center;font:900 26px 'Inter Display',sans-serif}
    #cv small{position:absolute;bottom:8px;left:0;right:0;text-align:center;font:700 13px 'Inter Display',sans-serif;color:#cbd5e1}` });
  await p.evaluate(() => {
    const { coverSVG } = __mods['covers.js'], G = __mods['games/index.js'].getGame;
    const box = document.createElement('div'); box.id = 'cv';
    box.innerHTML = `<h1>SPINBET <em>CASINO</em></h1><div class="row">${['fortune', 'zeus', 'barillet', 'storm'].map((id) => `<div>${coverSVG(G(id), { badge: false })}</div>`).join('')}</div>
      <p>46 jeux de casino gratuits</p><small>Machines à sous · roulettes · blackjack · poker · argent fictif</small>`;
    document.body.appendChild(box);
  });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: path.join(OUT, 'cover.png'), clip: { x: 0, y: 0, width: 630, height: 500 } });
  const q = await b.newPage({ viewport: { width: 1280, height: 800 } });
  await q.addInitScript(() => { try { localStorage.setItem('spinbet_tuto_v1', '1'); sessionStorage.setItem('spinbet_arrival_ad', '1'); } catch { /* ignore */ } });
  const shots = ['accueil', 'game-fortune', 'game-barillet', 'game-storm', 'game-blackjack'];
  for (const [k, h] of shots.entries()) {
    await q.goto(`${BASE}?nopub&nointro#${h}`);
    await q.waitForTimeout(4500);
    await q.addStyleTag({ content: '.ct-fab,.toasts,.ad-offer,.live-tick,.rw-dot{display:none!important}' });
    if (h.startsWith('game-')) await q.locator('.game-host').scrollIntoViewIfNeeded();
    await q.screenshot({ path: path.join(OUT, `screenshot-${k + 1}.png`) });
  }
  await b.close();
  console.log(`itch.io : ${path.relative(ROOT, OUT)} (zip ${(fs.statSync(path.join(OUT, 'spinbet-itch.zip')).size / 1e6).toFixed(1)} Mo, cover.png, ${shots.length} captures)`);
})();
