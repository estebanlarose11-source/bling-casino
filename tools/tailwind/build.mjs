// Compiles the Tailwind CSS of the Tailwind games (Le Totem, Le Totem Extrême) into index.html, <style id="tw-games">.
// Run after any change of their classes (games/pharaon.js, games/totemx.js) or of pharaon.css / totemx.css:
//   cd tools/tailwind && npm i && node build.mjs
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const page = fileURLToPath(new URL('../../index.html', import.meta.url));
const css = execFileSync(process.execPath, [here + 'node_modules/tailwindcss/lib/cli.js', '-c', here + 'tailwind.config.cjs', '-i', here + 'input.css', '--minify'], { cwd: here, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim();
let html = readFileSync(page, 'utf8');
const block = `<style id="tw-games">/* Le Totem et Le Totem Extrême · Tailwind compilé par tools/tailwind/build.mjs, ne pas modifier à la main */\n${css}\n</style>`;
const re = /<style id="tw-(?:pharaon|games)">[\s\S]*?<\/style>/;
html = re.test(html) ? html.replace(re, () => block) : html.replace('</head>', () => `${block}\n</head>`);
writeFileSync(page, html);
console.log(`Totems : ${(css.length / 1024).toFixed(1)} Ko de CSS Tailwind dans index.html`);
