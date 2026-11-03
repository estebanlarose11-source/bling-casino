#!/usr/bin/env node
// Renders the code-drawn covers (Three.js scenes of scenes.js) into assets/games/<id>/cover.webp.
//   cd tools/render3d && npm i three@0.160.0 && node render.js [id …]       (covers)
//   node render.js --pieces [game/name …]                                    (pieces used inside the games)
// Uses the Chromium of Playwright (software WebGL is fine, it only takes longer).
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const here = __dirname, root = path.resolve(here, '../..');
const threeDir = path.resolve(path.dirname(require.resolve('three', { paths: [here, process.cwd()] })), '..');
const types = { '.js': 'text/javascript', '.html': 'text/html', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const f = u.startsWith('/three/') ? path.join(threeDir, u.slice(7)) : path.join(here, u === '/' ? 'index.html' : u);
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); res.end(b); });
}).listen(0);
(async () => {
  const port = server.address().port;
  const src = fs.readFileSync(path.join(here, 'scenes.js'), 'utf8');
  const sprites = process.argv[2] === '--pieces';
  const args = process.argv.slice(sprites ? 3 : 2);
  const head = src.split('export const SPRITES')[0];
  const all = sprites ? [...src.matchAll(/^  '([\w-]+\/[\w-]+)': async/gm)].map((m) => m[1]).concat(
    ...[...src.matchAll(/SPRITES\[`([\w-]+)\/(\w+)\$\{k\}`\]/g)].map((m) => { const n = (src.slice(0, m.index).match(/\[([^\]]*)\]\.forEach\(\(c, k\) => \{\s*$/) || ['', ''])[1].split(',').length; return Array.from({ length: n }, (_, k) => `${m[1]}/${m[2]}${k}`); }))
    : [...head.matchAll(/^  '?([\w-]+)'?: async/gm)].map((m) => m[1]);
  const ids = args.length ? args : all;
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  for (const id of ids) {
    const p = await b.newPage({ viewport: { width: 600, height: 800 } });
    p.on('pageerror', (e) => console.error(id, e.message));
    await p.goto(`http://localhost:${port}/?id=${encodeURIComponent(id)}${sprites ? '&p=1' : ''}`);
    await p.waitForFunction(() => window.__shot || window.__err, null, { timeout: 240000 });
    const err = await p.evaluate(() => window.__err);
    if (err) { console.error(id, err); await p.close(); continue; }
    const data = await p.evaluate(() => window.__shot);
    const dir = path.join(root, 'assets/games', sprites ? path.dirname(id) : id);
    fs.mkdirSync(dir, { recursive: true });
    const out = process.env.OUT ? path.join(process.env.OUT, `${id.replace('/', '-')}.webp`) : path.join(dir, sprites ? `${path.basename(id)}.webp` : 'cover.webp');
    fs.writeFileSync(out, Buffer.from(data.split(',')[1], 'base64'));
    console.log('✓', id, path.relative(root, out));
    await p.close();
  }
  await b.close(); server.close();
})();
