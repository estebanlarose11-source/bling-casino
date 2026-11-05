#!/usr/bin/env python3
"""IndexNow : prévient Bing, Yandex, Seznam, Naver… (et les moteurs qui s'en servent : Ecosia, Qwant, DuckDuckGo,
Yahoo) des pages nouvelles ou modifiées. Google ne lit pas IndexNow : pour lui, sitemap.xml + Search Console suffisent.

    python3 tools/seo/indexnow.py            pages dont la date (<lastmod>) a changé depuis le commit précédent
    python3 tools/seo/indexnow.py --tout     toutes les pages du sitemap

Lancé par GitHub Actions (.github/workflows/indexnow.yml) après chaque mise en ligne qui change sitemap.xml.
La clé est le fichier <clé>.txt à la racine du site (il doit rester en ligne).
"""
import json, pathlib, re, subprocess, sys, urllib.request

root = pathlib.Path(__file__).resolve().parents[2]
if {'-h', '--help'} & set(sys.argv):
    sys.exit(__doc__)
HOST = 'www.spinbetcaz.com'
key = next((f.stem for f in root.glob('*.txt') if re.fullmatch(r'[0-9a-f]{32}', f.stem)), None)
if not key:
    sys.exit('Pas de fichier de clé IndexNow (<32 caractères hexadécimaux>.txt) à la racine')

def parse(xml):
    return dict(re.findall(r'<loc>([^<]+)</loc><lastmod>([^<]+)</lastmod>', xml or ''))

new = parse((root / 'sitemap.xml').read_text(encoding='utf8'))
if '--tout' in sys.argv:
    urls = list(new)
else:
    try:
        old = parse(subprocess.run(['git', 'show', 'HEAD~1:sitemap.xml'], cwd=root, capture_output=True, text=True, check=True).stdout)
    except subprocess.CalledProcessError:
        old = {}
    urls = [u for u, d in new.items() if old.get(u) != d]
if not urls:
    print('Rien de nouveau à signaler')
    sys.exit(0)
body = json.dumps({'host': HOST, 'key': key, 'keyLocation': f'https://{HOST}/{key}.txt', 'urlList': urls[:10000]}).encode()
req = urllib.request.Request('https://api.indexnow.org/indexnow', data=body, headers={'Content-Type': 'application/json; charset=utf-8'})
try:
    with urllib.request.urlopen(req, timeout=30) as r:
        print(f'IndexNow : {len(urls)} adresse(s) envoyée(s), réponse {r.status}')
except urllib.error.HTTPError as e:
    sys.exit(f'IndexNow a refusé ({e.code}) : {e.read()[:300]!r}')
for u in urls[:50]:
    print(' ', u)
