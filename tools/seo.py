#!/usr/bin/env python3
"""Référencement (SEO) : fabrique les pages que Google peut lire, à partir du catalogue des jeux d'index.html.

    python3 tools/seo.py        (lancé aussi par tools/build.py)

- jeux/index.html      : la liste de tous les jeux, par catégorie ;
- jeux/<id>.html       : une page par jeu (nom, description, nouveautés, RTP, gain max, bouton « Jouer ») ;
- sitemap.xml          : toutes les pages du site pour Google (à déclarer dans Google Search Console) ;
- robots.txt           : autorise l'exploration et donne l'adresse du sitemap.
Le site lui-même est une seule page (#game-…) : Google ne compte pas les « # » comme des pages, d'où ces pages-là.
"""
import datetime, html, json, pathlib, re

SITE = 'https://www.spinbetcaz.com'
root = pathlib.Path(__file__).resolve().parent.parent
src = (root / 'index.html').read_text(encoding='utf8')
today = datetime.date.today().isoformat()
esc = lambda s: html.escape(str(s), quote=True)

# ---- the catalogue: ORIGINALS (one JSON object per line) + the classic slot of GAMES ----
block = src[src.index('const ORIGINALS = ['):src.index('].map((g) => ({ ...g, original: true }))')]
games = [json.loads(l.strip().rstrip(',')) for l in block.splitlines() if l.strip().startswith('{"id"')]
wolf = src[src.index("id: 'big-bad-wolf'"):]
games.insert(0, {'id': 'big-bad-wolf', 'name': re.search(r"name: '([^']+)'", wolf).group(1), 'cat': 'slot', 'tag': 'Machine à sous',
                 'sub': 'Hold & Spin, free spins et le grand méchant loup', 'description': re.search(r'description: "([^"]+)"', wolf).group(1),
                 'features': ['Hold & Spin', 'Free spins avec WILD collants', 'Jackpots MINI, MINOR, MAJOR, GRAND', 'Achat de bonus'], 'rtp': '≈ 92 %', 'vol': 4, 'max': '×1 000'})
CATS = {'slot': ('machines-a-sous', 'Machines à sous', 'Machines à sous gratuites'), 'table': ('roues-et-tables', 'Roues & tables', 'Roulettes, roues, blackjack et poker gratuits'),
        'quick': ('jeux-rapides', 'Jeux rapides', 'Jeux rapides gratuits : crash, mines, plinko…')}
ALIAS = {'big-bad-wolf': 'wolf', 'taco': 'pizza', 'bj-online': 'blackjack', 'holdem-online': 'poker'}
def cover(g):
    for k in [g['id'], ALIAS.get(g['id'], ''), g['id'].replace('-online', '')]:
        if k and (root / f'assets/games/{k}/cover.webp').exists():
            return f'/assets/games/{k}/cover.webp'
    return '/assets/og.jpg'
plain = lambda s: re.sub(r'\s+', ' ', str(s).replace(' ', ' KE').replace('', 'KE')).strip()

CSS = """*{box-sizing:border-box}body{margin:0;font:16px/1.6 Inter,system-ui,sans-serif;background:#0b0f17;color:#e2e8f0}a{color:#fca5a5}
.w{max-width:960px;margin:0 auto;padding:20px 16px 60px}header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:6px 0 18px}
.logo{font:900 22px Archivo,system-ui,sans-serif;color:#fff;text-decoration:none}.logo em{color:#e3132f;font-style:normal}
.btn{display:inline-block;padding:12px 22px;border-radius:4px;background:#e3132f;color:#fff;font-weight:800;text-decoration:none}.btn.ghost{background:#1e293b}
nav.crumbs{font-size:14px;color:#94a3b8;margin-bottom:10px}nav.crumbs a{color:#cbd5e1}h1{font:900 clamp(30px,6vw,48px)/1.1 Archivo,system-ui,sans-serif;margin:6px 0 8px;color:#fff}
.tag{display:inline-block;padding:3px 10px;border-radius:3px;background:#7f1d1d;color:#fecaca;font-size:13px;font-weight:700}.sub{color:#fca5a5;font-weight:700;margin:0 0 14px}
.hero{display:grid;grid-template-columns:minmax(0,300px) 1fr;gap:24px;align-items:start}.hero img{width:100%;border-radius:6px;aspect-ratio:3/4;object-fit:cover;background:#111}
@media(max-width:700px){.hero{grid-template-columns:1fr}.hero img{max-width:300px}}ul.f{padding-left:20px}.facts{display:flex;flex-wrap:wrap;gap:10px;margin:14px 0 20px}
.facts div{padding:10px 14px;border-radius:4px;background:#111827;border:1px solid #1f2937}.facts b{display:block;color:#fff;font-size:18px}.facts small{color:#94a3b8}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px}.card{display:block;padding:12px;border-radius:6px;background:#111827;border:1px solid #1f2937;color:#e2e8f0;text-decoration:none}
.card img{width:100%;aspect-ratio:3/4;object-fit:cover;border-radius:4px;background:#0b0f17}.card b{display:block;color:#fff;margin-top:6px}.card small{color:#94a3b8}
h2{font:900 24px Archivo,system-ui,sans-serif;color:#fff;margin:34px 0 12px}footer{margin-top:40px;font-size:13px;color:#64748b}"""

def page(path, title, desc, body, jsonld, image=f'{SITE}/assets/og.jpg'):
    url = f'{SITE}/{path}'
    return f"""<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}">
<link rel="canonical" href="{url}">
<meta name="robots" content="index, follow">
<meta property="og:type" content="website"><meta property="og:site_name" content="SpinBet Casino"><meta property="og:locale" content="fr_FR">
<meta property="og:title" content="{esc(title)}"><meta property="og:description" content="{esc(desc)}"><meta property="og:url" content="{url}"><meta property="og:image" content="{image}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="{image}">
<meta name="theme-color" content="#0b0f17">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🎰</text></svg>">
<style>{CSS}</style>
<script type="application/ld+json">{json.dumps(jsonld, ensure_ascii=False)}</script>
</head>
<body><div class="w">
<header><a class="logo" href="/">SPINBET<em>CASINO</em></a><a class="btn" href="/">Jouer gratuitement</a></header>
{body}
<footer>SpinBet Casino · jeux de casino gratuits en argent fictif (KE) : aucun dépôt, aucun vrai pari, aucun gain réel. Réservé aux 18 ans et plus. <a href="/#responsable">Jeu responsable</a> · <a href="/jeux/">Tous les jeux</a></footer>
</div></body>
</html>
"""

out = root / 'jeux'
out.mkdir(exist_ok=True)
for old in out.glob('*.html'):
    old.unlink()
crumb = lambda items: {'@type': 'BreadcrumbList', 'itemListElement': [{'@type': 'ListItem', 'position': k + 1, 'name': n, 'item': u} for k, (n, u) in enumerate(items)]}
card = lambda g: f'<a class="card" href="/jeux/{g["id"]}.html"><img src="{cover(g)}" alt="{esc(g["name"])}" loading="lazy" width="300" height="400"><b>{esc(g["name"])}</b><small>{esc(plain(g.get("sub", "")))}</small></a>'

# ---- one page per game ----
for g in games:
    cat = CATS.get(g['cat'], CATS['slot'])
    name, desc = g['name'], plain(g.get('description', ''))
    kind = g.get('tag', cat[1])
    online = g['id'].endswith('-online')
    title = f"{name} · {'jeu multijoueur' if online else kind.lower()} gratuit | SpinBet Casino"
    meta = f"Joue gratuitement à {name} sur SpinBet Casino : {plain(g.get('sub', ''))}. {desc}"[:300]
    same = [x for x in games if x['cat'] == g['cat'] and x['id'] != g['id']][:8]
    body = f"""<nav class="crumbs"><a href="/">Accueil</a> › <a href="/jeux/">Jeux</a> › <a href="/jeux/#{cat[0]}">{cat[1]}</a> › {esc(name)}</nav>
<div class="hero"><img src="{cover(g)}" alt="{esc(name)} – {esc(kind)} SpinBet Casino" width="300" height="400">
<div><span class="tag">{esc(kind)}</span><h1>{esc(name)}</h1><p class="sub">{esc(plain(g.get('sub', '')))}</p><p>{esc(desc)}</p>
<div class="facts"><div><b>{esc(g.get('rtp', '—'))}</b><small>Retour au joueur</small></div><div><b>{esc(plain(g.get('max', '—')))}</b><small>Gain maximum</small></div><div><b>{'★' * int(g.get('vol', 3))}</b><small>Volatilité</small></div></div>
<a class="btn" href="/#game-{g['id']}">Jouer à {esc(name)} gratuitement</a></div></div>
<h2>Ce qu’il y a dans {esc(name)}</h2><ul class="f">{''.join(f'<li>{esc(plain(f))}</li>' for f in g.get('features', []))}</ul>
<h2>Comment jouer</h2><p>{esc(name)} se joue directement dans le navigateur, sur téléphone comme sur ordinateur, sans téléchargement. Tu reçois des KE, la monnaie fictive du site : aucun dépôt, aucun vrai pari. {'Ici, tu joues en direct avec les autres joueurs du salon, avec un chat de table.' if online else 'Choisis ta mise, lance, et vise les bonus.'}</p>
<h2>D’autres {esc(cat[1].lower())}</h2><div class="grid">{''.join(card(x) for x in same)}</div>"""
    ld = [{'@context': 'https://schema.org', '@type': 'VideoGame', 'name': name, 'description': desc, 'url': f'{SITE}/jeux/{g["id"]}.html', 'image': SITE + cover(g),
           'genre': kind, 'gamePlatform': ['Navigateur web', 'Android', 'iOS'], 'applicationCategory': 'Game', 'inLanguage': 'fr', 'isAccessibleForFree': True,
           'offers': {'@type': 'Offer', 'price': 0, 'priceCurrency': 'EUR'}, 'publisher': {'@type': 'Organization', 'name': 'SpinBet Casino', 'url': SITE}},
          {'@context': 'https://schema.org', **crumb([('Accueil', SITE + '/'), ('Jeux', SITE + '/jeux/'), (name, f'{SITE}/jeux/{g["id"]}.html')])}]
    (out / f'{g["id"]}.html').write_text(page(f'jeux/{g["id"]}.html', title, meta, body, ld, SITE + cover(g)), encoding='utf8')

# ---- the list of all games ----
secs = ''
for c, (slug, label, h) in CATS.items():
    lst = [g for g in games if g['cat'] == c]
    secs += f'<h2 id="{slug}">{esc(h)} ({len(lst)})</h2><div class="grid">{"".join(card(g) for g in lst)}</div>'
intro = f"""<nav class="crumbs"><a href="/">Accueil</a> › Jeux</nav><h1>Tous les jeux de SpinBet Casino</h1>
<p>{len(games)} jeux de casino gratuits, à jouer dans le navigateur sans téléchargement : machines à sous avec bonus et jackpots, roulettes, roues de la fortune, blackjack, poker Texas Hold’em, tables multijoueurs en direct et jeux rapides (crash, mines, plinko, grattage…). Tout se joue en argent fictif : aucun dépôt, aucun vrai pari.</p>
<p><a class="btn" href="/">Ouvrir le casino</a> <a class="btn ghost" href="/#special">Le Défi spécial : 1 000 000 KE</a></p>{secs}"""
ld = {'@context': 'https://schema.org', '@type': 'ItemList', 'name': 'Jeux de SpinBet Casino', 'numberOfItems': len(games),
      'itemListElement': [{'@type': 'ListItem', 'position': k + 1, 'url': f'{SITE}/jeux/{g["id"]}.html', 'name': g['name']} for k, g in enumerate(games)]}
(out / 'index.html').write_text(page('jeux/', f'Tous les jeux gratuits ({len(games)}) : machines à sous, roulette, blackjack | SpinBet Casino',
                                     f'Les {len(games)} jeux de casino gratuits de SpinBet Casino : machines à sous, roulettes, roues, blackjack, poker, tables multijoueurs et jeux rapides, en argent fictif.', intro, ld), encoding='utf8')

# ---- sitemap.xml + robots.txt ----
urls = [(f'{SITE}/', '1.0', 'daily'), (f'{SITE}/jeux/', '0.9', 'weekly')] + [(f'{SITE}/jeux/{g["id"]}.html', '0.8', 'weekly') for g in games]
xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + ''.join(
    f'  <url><loc>{u}</loc><lastmod>{today}</lastmod><changefreq>{f}</changefreq><priority>{p}</priority></url>\n' for u, p, f in urls) + '</urlset>\n'
(root / 'sitemap.xml').write_text(xml, encoding='utf8')
(root / 'sitemap.txt').write_text(''.join(f'{u}\n' for u, _, _ in urls), encoding='utf8')  # the same list, one address per line
(root / 'robots.txt').write_text(f'User-agent: *\nAllow: /\nDisallow: /dist/\n\nSitemap: {SITE}/sitemap.xml\nSitemap: {SITE}/sitemap.txt\n', encoding='utf8')
print(f'SEO : {len(games)} pages de jeux, jeux/index.html, sitemap.xml + sitemap.txt ({len(urls)} adresses), robots.txt')
