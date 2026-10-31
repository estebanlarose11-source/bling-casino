#!/usr/bin/env python3
"""Builds the whole site as ONE html file (for an Artifact or any single-file host):

    python3 tools/bundle.py            # → dist/spinbet-casino.html

- every game file of games/ is put inside the page, ready to start the first time its game is opened
  (same as the normal site, without downloading games/<id>.js);
- the icons of assets/ become data: URLs; the service worker and the web-app manifest are left out
  (a single file cannot install itself as an app).
Google Fonts, Firebase (accounts, leaderboard) and the A-ADS ads are still loaded from the internet.
"""
import base64, json, pathlib, re

root = pathlib.Path(__file__).resolve().parent.parent
html = (root / 'index.html').read_text(encoding='utf8')

# 1. games: each file becomes a function, run on demand by the loader
files = re.search(r"const FILES = \{(.*?)\n\};", html, re.S)
assert files, 'FILES not found in index.html'
lazy = []
for name, mod in re.findall(r"\['([\w-]+)', '(games/impl/[\w-]+\.js)', '\w+', '\w*'\]", files.group(1)):
    code = (root / 'games' / f'{name}.js').read_text(encoding='utf8')
    lazy.append(f"__lazy[{json.dumps(mod)}] = function () {{\n{code}\n}};")
games_js = '<script>\nwindow.__lazy = {};\n' + '\n'.join(lazy).replace('</script', '<\\/script') + '\n</script>\n'

old = "    loading[file] = loadScript(`games/${file}.js?v=${v}`);"
assert html.count(old) == 1, 'loader not found'
html = html.replace(old, "    loading[file] = window.__lazy?.[mod] ? Promise.resolve().then(() => { if (!__mods[mod]) window.__lazy[mod](); }) : loadScript(`games/${file}.js?v=${v}`);")

# the game functions must exist before the site starts: put them just before the main <script>
first = html.index('<script>')
html = html[:first] + games_js + html[first:]

# 2. no service worker, no manifest in a single file
html = html.replace("  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;", "  return; // single-file version: no service worker")
html = html.replace('  <link rel="manifest" href="manifest.webmanifest">\n', '')

# 3. icons as data: URLs
for icon in ['apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'icon-maskable.png']:
    p = root / 'assets' / icon
    if p.exists():
        html = html.replace(f'assets/{icon}', 'data:image/png;base64,' + base64.b64encode(p.read_bytes()).decode())

out = root / 'dist' / 'spinbet-casino.html'
out.parent.mkdir(exist_ok=True)
out.write_text(html, encoding='utf8')
print(f'{out.relative_to(root)} · {len(lazy)} jeux intégrés · {out.stat().st_size / 1e6:.2f} Mo')
