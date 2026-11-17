// Essais pour les miniatures : ouvre un jeu, joue des étapes, prend des captures à plusieurs instants.
//   python3 -m http.server 8123  puis  node tools/covers/probe.js <id> <phone|pc> <dossier> '<étapes JSON>'
// étapes : [{ "eval": "js" } | { "click": "sélecteur" } | { "wait": ms } | { "shot": "nom" }]
const { chromium, devices } = require('playwright');
const [,, id, mode, out, stepsJson] = process.argv;
const BASE = process.env.SHOTS_URL || 'http://localhost:8123/';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext(mode === 'phone' ? { ...devices['iPhone 13'], deviceScaleFactor: 2 } : { viewport: { width: 1280, height: 860 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => { try { localStorage.setItem('spinbet_tuto_v1', '1'); } catch {} });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.goto(`${BASE}?nopub&nointro&nostats#game-${id}`);
  await p.waitForSelector('.game-host > *:not(.game-loading)', { timeout: 20000 }).catch(() => {});
  await p.waitForTimeout(3500);
  await p.addStyleTag({ content: '.ct-fab,.toasts,.toast,.ad-offer,.live-tick,.tuto,.bw-offer,.nudge,.lw-modal,.pw-modal,.modal-back{display:none!important}' });
  for (const s of JSON.parse(stepsJson || '[]')) {
    if (s.eval) console.log('eval', await p.evaluate(s.eval).catch((e) => 'x ' + e.message));
    if (s.click) await p.click(s.click, { timeout: 4000 }).catch((e) => console.log('click x', s.click));
    if (s.wait) await p.waitForTimeout(s.wait);
    if (s.full) await p.evaluate(() => document.querySelector('[data-act="full"], .fs-btn, [data-full]')?.click());
    if (s.shot) await p.screenshot({ path: `${out}/${id}-${mode}-${s.shot}.png` });
  }
  await b.close();
})();
