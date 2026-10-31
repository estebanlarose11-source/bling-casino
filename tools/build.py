#!/usr/bin/env python3
"""Updates the ?v= version of every game file in index.html (module games/impl/index.js).

Run it after changing anything in games/:  python3 tools/build.py
Each game's code lives in games/<file>.js and is loaded the first time the game is opened; the version is a
hash of the file, so browsers and the service worker fetch the new file right after an update.
"""
import hashlib, pathlib, re

root = pathlib.Path(__file__).resolve().parent.parent
index = root / 'index.html'
s = index.read_text(encoding='utf8')

def bump(m):
    name = m.group(1)
    digest = hashlib.sha1((root / 'games' / f'{name}.js').read_bytes()).hexdigest()[:10]
    return f"['{name}', {m.group(2)}, '{digest}']"

s2, n = re.subn(r"\['([\w-]+)', ('games/impl/[\w-]+\.js', '\w+'), '\w*'\]", bump, s)
index.write_text(s2, encoding='utf8')
print(f'{n} game files versioned' + ('' if s2 != s else ' (no change)'))
