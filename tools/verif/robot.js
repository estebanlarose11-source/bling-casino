// Vérification complète (à relancer après une grosse modification) : toutes les pages et tous les jeux, sur ordinateur
// et sur téléphone ; relève les erreurs JavaScript, les textes « undefined » / « NaN » et les débordements.
//   python3 -m http.server 8123   (à la racine du dépôt, dans un autre terminal)
//   node tools/verif/robot.js      (≈ 10 min ; « AUCUN PROBLÈME » si tout va bien)
const { chromium, devices } = require('playwright');
const fs = require('fs');
const src = fs.readFileSync(require('path').resolve(__dirname, '../../index.html'), 'utf8');
const block = src.slice(src.indexOf('const ORIGINALS = ['), src.indexOf('].map((g) => ({ ...g, original: true }))'));
const games = ['big-bad-wolf', ...block.split('\n').filter((l) => l.trim().startsWith('{"id"')).map((l) => JSON.parse(l.trim().replace(/,$/, ''))).filter((g) => !g.wip).map((g) => g.id)];
const pages = ['accueil', 'lobby-slot', 'lobby-table', 'lobby-quick', 'succes', 'profil', 'classement', 'recharger', 'responsable', 'appli', 'roue', 'boutique', 'missions', 'parrainage', 'defi', 'special', 'tournois', 'jackpot', 'duels', 'cashback', 'battle', 'paris', 'loto', 'jcc', 'avent'];
const ok = (t) => !/TUNNEL|firebase|Failed to load|ERR_|net::|gstatic|googleapis|adsterra|raw\.githubusercontent|Cannot load/i.test(t);
(async () => {
  const b = await chromium.launch();
  const report = [];
  for (const [nm, opts] of [['pc', { viewport: { width: 1366, height: 860 } }], ['tel', { ...devices['iPhone 13'] }]]) {
    const ctx = await b.newContext(opts);
    await ctx.addInitScript(() => { try { localStorage.setItem('spinbet_tuto_v1', '1'); } catch {} });
    const q = await ctx.newPage();
    let errs = [];
    q.on('pageerror', (e) => ok(e.message) && errs.push(e.message.slice(0, 160)));
    q.on('console', (m) => { if (m.type() === 'error' && ok(m.text())) errs.push('console: ' + m.text().slice(0, 160)); });
    await q.goto(`${process.env.BASE || 'http://localhost:8123/'}?nopub#accueil`); await q.waitForTimeout(3000);
    const check = async (label) => {
      const r = await q.evaluate(() => ({
        undef: /\bundefined\b|\bNaN\b|\[object Object\]/.test(document.getElementById('view')?.innerText || ''),
        over: document.documentElement.scrollWidth > innerWidth + 2,
      }));
      if (errs.length || r.undef || r.over) report.push(`${nm} ${label}: ${errs.join(' / ')}${r.undef ? ' [texte undefined/NaN]' : ''}${r.over ? ' [débordement horizontal]' : ''}`);
      errs = [];
    };
    for (const pg of pages) { await q.evaluate((h) => { location.hash = h; }, '#' + pg); await q.waitForTimeout(1200); await check('#' + pg); }
    for (const g of games) {
      await q.evaluate((h) => { location.hash = h; }, '#game-' + g); await q.waitForTimeout(2600);
      const play = q.locator('.gi-back .gi-play');
      if (await play.count()) { await play.click({ timeout: 4000 }).catch(() => {}); await q.waitForTimeout(400); }
      const main = q.locator('.game-host [data-act="main"]').first();
      if (await main.count()) { await main.click({ timeout: 3000 }).catch(() => {}); await q.waitForTimeout(2500); }
      await check('#game-' + g);
      await q.evaluate(() => { document.querySelectorAll('.modal-back:not(.gi-back) .modal-x').forEach((x) => x.click()); });
    }
    await ctx.close();
  }
  await b.close();
  console.log(report.length ? report.join('\n') : 'AUCUN PROBLÈME', `\n(${pages.length} pages + ${games.length} jeux, ordinateur et téléphone)`);
})();
