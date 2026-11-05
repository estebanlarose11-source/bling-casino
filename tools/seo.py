#!/usr/bin/env python3
"""Référencement (SEO) : fabrique les pages que Google peut lire, à partir du catalogue des jeux d'index.html.

    python3 tools/seo.py        (lancé aussi par tools/build.py)

- jeux/index.html      : la liste de tous les jeux, par catégorie ;
- jeux/<id>.html       : une page par jeu (nom, description, RTP, gain max, astuces, captures d'écran, questions
                         fréquentes, bouton « Jouer ») ; captures : assets/shots/<id>.webp et <id>-tel.webp
                         (node tools/seo/shots.js) ;
- articles/…           : les guides (« Meilleures machines à sous gratuites 2026 »…), liste ARTICLES ci-dessous ;
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
games = [g for g in games if not g.get('wip')]  # a game en travaux gets no page until it opens
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

def shots(g):
    """The screenshots of a game (an -online game uses its solo version's)."""
    for k in [g['id'], g['id'].replace('-online', ''), ALIAS.get(g['id'], '')]:
        if k and (root / f'assets/shots/{k}.webp').exists():
            return [f'/assets/shots/{k}.webp'] + ([f'/assets/shots/{k}-tel.webp'] if (root / f'assets/shots/{k}-tel.webp').exists() else [])
    return []

def tips(g):
    """Tips for the player, written from the game's catalogue entry (category, volatility, features, max win)."""
    name, vol, feats, f = g['name'], int(g.get('vol', 3)), [plain(x) for x in g.get('features', [])], ' '.join(g.get('features', [])).lower()
    out = []
    if g['cat'] == 'slot':
        if vol >= 4:
            out.append(f"Volatilité {'extrême' if vol >= 5 else 'élevée'} : {name} peut rester calme plusieurs dizaines de tours puis tout donner d’un coup dans le bonus. Joue petit (1 % de ton solde par tour environ) pour tenir jusqu’au bonus.")
        elif vol <= 2:
            out.append(f"Volatilité basse : {name} paie souvent, par petits gains. Parfait pour jouer longtemps ou pour remplir les missions et la barre des cartes à collectionner.")
        else:
            out.append(f"Volatilité moyenne : des petits gains réguliers et un bonus qui peut monter haut. Une mise autour de 1 à 2 % de ton solde est un bon équilibre.")
        if feats:
            out.append(f"Ce qu’il faut viser : {', '.join(feats[:3]).lower()}. C’est là que se font les gros gains.")
        if 'achat' in f or 'buy' in f:
            out.append("L’achat de bonus fait gagner du temps, mais il rend un peu moins en moyenne (≈ 88 %) que les tours normaux (≈ 92 %) : achète plutôt un bonus quand tu as un gros solde à faire tourner.")
        out.append(f"Le gain maximum est de {plain(g.get('max', '×5 000'))} la mise : l’atteindre fait aussi tomber le jackpot commun du site.")
        out.append("Pendant l’heure de la machine mystère (une fois par jour), le bonus de la machine cachée tombe 3 fois plus souvent : guette la vignette « ? » sur l’accueil.")
        out.append("Chaque bonus gagné en jouant compte pour le Défi spécial : débloque tous les bonus du casino pour gagner 1 000 000 KE.")
    elif g['cat'] == 'table':
        out.append(f"Le retour au joueur de {name} est de {g.get('rtp', '≈ 95 %')} : sur la durée, la banque garde un peu d’avance. Fixe-toi un objectif de gain et une limite de perte avant de jouer.")
        if g['id'].endswith('-online'):
            out.append("Version en ligne : la partie part quand tout le salon a appuyé sur PRÊT. Invite tes amis avec le bouton de partage pour jouer à la même table.")
        if 'blackjack' in (name + f).lower() or g['id'] in ('blackjack', 'lightningbj', 'bj-online'):
            out.append("Stratégie de base : reste à partir de 17, tire jusqu’à 12 face à un 2 ou un 3 du croupier, double sur 11 et sépare toujours les As et les 8.")
        elif g['id'] in ('poker', 'holdem-online'):
            out.append("Ne joue pas toutes les mains : les paires, As-Roi, As-Dame et les cartes assorties qui se suivent valent la peine, le reste se jette souvent avant le flop.")
        else:
            out.append("Les cases bonus paient le plus mais tombent rarement : répartis tes jetons entre une mise sûre et un petit pari sur un bonus.")
        out.append("La roue et les cartes n’ont pas de mémoire : une série de rouge ne rend pas le noir plus probable au tour suivant.")
    else:
        out.append(f"{name} se joue en quelques secondes : le retour au joueur est de {g.get('rtp', '≈ 95 %')} quelle que soit ta stratégie, seul le risque change.")
        if 'encaisse' in f or 'encaisse' in plain(g.get('description', '')).lower():
            out.append("Choisis ton objectif avant de lancer (×2, ×5…) et encaisse dès qu’il est atteint : chaque étape de plus ajoute du risque.")
        out.append("Les petites mises répétées font monter tes niveaux, tes missions et la barre des cartes à collectionner aussi bien que les grosses.")
    out.append("Tout est en KE, une monnaie fictive : le cadeau du jour, la roue du jour et les codes du Snapchat spinbetcazino te redonnent des KE gratuitement.")
    return out

def faq(g):
    name = g['name']
    q = [(f"{name} est-il gratuit ?", f"Oui. {name} se joue gratuitement sur SpinBet Casino, dans le navigateur, sur téléphone comme sur ordinateur, avec des KE (monnaie fictive) : aucun dépôt."),
         (f"Peut-on gagner de l’argent réel à {name} ?", "Non. SpinBet Casino est un jeu de divertissement : les KE n’ont aucune valeur réelle et ne s’échangent pas contre de l’argent."),
         (f"Quel est le RTP de {name} ?", f"Le retour au joueur de {name} est {g.get('rtp', '≈ 92 %')}" + (f", avec un gain maximum de {plain(g['max'])} la mise." if g.get('max') else '.'))]
    if g['cat'] == 'slot':
        q.append((f"Comment déclencher le bonus de {name} ?", plain(g.get('description', ''))))
    return q

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
h2{font:900 24px Archivo,system-ui,sans-serif;color:#fff;margin:34px 0 12px}footer{margin-top:40px;font-size:13px;color:#64748b}
.shots{display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap}.shots img{border-radius:6px;border:1px solid #1f2937;background:#111;height:auto}.shots .pc{width:min(100%,620px)}.shots .tel{width:min(46%,210px)}
ol.tips li,ul.tips li{margin:0 0 8px}details{background:#111827;border:1px solid #1f2937;border-radius:6px;padding:10px 14px;margin:0 0 8px}summary{cursor:pointer;font-weight:700;color:#fff}
article h2{margin-top:30px}.rank{display:grid;grid-template-columns:120px 1fr;gap:16px;align-items:start;padding:14px;margin:0 0 12px;border-radius:6px;background:#111827;border:1px solid #1f2937}
.rank img{width:100%;aspect-ratio:3/4;object-fit:cover;border-radius:4px}.rank h3{margin:0 0 4px;color:#fff;font:900 20px Archivo,system-ui,sans-serif}.rank p{margin:4px 0}.rank .meta{color:#94a3b8;font-size:14px}
@media(max-width:560px){.rank{grid-template-columns:84px 1fr}}.lead{font-size:18px;color:#cbd5e1}"""

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

def shotsHTML(g):
    l = shots(g)
    if not l:
        return ''
    alt = lambda k: f"{g['name']} : capture d’écran du jeu sur {'téléphone' if k else 'ordinateur'}"
    return f"<h2>{esc(g['name'])} en images</h2><div class=\"shots\">" + ''.join(
        f'<img class="{"tel" if k else "pc"}" src="{u}" alt="{esc(alt(k))}" loading="lazy" decoding="async">' for k, u in enumerate(l)) + '</div>'

# ---- the guides (articles/…): their slug, title, description and which game categories link to them ----
ARTICLES = [
    {'slug': 'meilleures-machines-a-sous-gratuites-2026', 'cats': ['slot'], 'title': 'Les meilleures machines à sous gratuites en 2026',
     'desc': 'Notre classement des meilleures machines à sous gratuites de 2026, sans téléchargement ni dépôt : bonus, multiplicateurs, gain maximum et astuces pour chaque machine.'},
    {'slug': 'jeux-de-casino-gratuits-sans-telechargement', 'cats': ['table'], 'title': 'Roulette, blackjack et poker gratuits sans téléchargement',
     'desc': 'Les meilleurs jeux de table gratuits en 2026 : roulettes à multiplicateurs, blackjack, poker Texas Hold’em et grandes roues, en solo ou en multijoueur, dans le navigateur.'},
    {'slug': 'jeux-crash-mines-plinko-gratuits', 'cats': ['quick'], 'title': 'Jeux crash, mines et plinko gratuits : le guide 2026',
     'desc': 'Crash, mines, plinko, grattage, courses : tous les jeux rapides gratuits de SpinBet Casino, comment ils marchent et comment bien encaisser.'},
    {'slug': 'rtp-volatilite-machines-a-sous', 'cats': ['slot', 'table', 'quick'], 'title': 'RTP et volatilité : comprendre une machine à sous',
     'desc': 'RTP, volatilité, gain maximum, achat de bonus : ce que veulent dire ces mots, exemples à l’appui, pour choisir la machine à sous qui te ressemble.'},
]

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
{shotsHTML(g)}<h2>Astuces pour {esc(name)}</h2><ol class="tips">{''.join(f'<li>{esc(t)}</li>' for t in tips(g))}</ol>
<h2>Questions fréquentes</h2>{''.join(f'<details><summary>{esc(a)}</summary><p>{esc(b)}</p></details>' for a, b in faq(g))}
<h2>À lire aussi</h2><ul class="f">{''.join(f'<li><a href="/articles/{a["slug"]}.html">{esc(a["title"])}</a></li>' for a in ARTICLES if g['cat'] in a['cats'])}</ul>
<h2>D’autres {esc(cat[1].lower())}</h2><div class="grid">{''.join(card(x) for x in same)}</div>"""
    ld = [{'@context': 'https://schema.org', '@type': 'VideoGame', 'name': name, 'description': desc, 'url': f'{SITE}/jeux/{g["id"]}.html', 'image': SITE + cover(g),
           'genre': kind, 'gamePlatform': ['Navigateur web', 'Android', 'iOS'], 'applicationCategory': 'Game', 'inLanguage': 'fr', 'isAccessibleForFree': True,
           'offers': {'@type': 'Offer', 'price': 0, 'priceCurrency': 'EUR'}, 'publisher': {'@type': 'Organization', 'name': 'SpinBet Casino', 'url': SITE}},
          {'@context': 'https://schema.org', **crumb([('Accueil', SITE + '/'), ('Jeux', SITE + '/jeux/'), (name, f'{SITE}/jeux/{g["id"]}.html')])},
          {'@context': 'https://schema.org', '@type': 'FAQPage', 'mainEntity': [{'@type': 'Question', 'name': a, 'acceptedAnswer': {'@type': 'Answer', 'text': b}} for a, b in faq(g)]}]
    if shots(g):
        ld[0]['screenshot'] = [SITE + x for x in shots(g)]
    (out / f'{g["id"]}.html').write_text(page(f'jeux/{g["id"]}.html', title, meta, body, ld, SITE + cover(g)), encoding='utf8')

# ---- the list of all games ----
secs = ''
for c, (slug, label, h) in CATS.items():
    lst = [g for g in games if g['cat'] == c]
    secs += f'<h2 id="{slug}">{esc(h)} ({len(lst)})</h2><div class="grid">{"".join(card(g) for g in lst)}</div>'
intro = f"""<nav class="crumbs"><a href="/">Accueil</a> › Jeux</nav><h1>Tous les jeux de SpinBet Casino</h1>
<p>{len(games)} jeux de casino gratuits, à jouer dans le navigateur sans téléchargement : machines à sous avec bonus et jackpots, roulettes, roues de la fortune, blackjack, poker Texas Hold’em, tables multijoueurs en direct et jeux rapides (crash, mines, plinko, grattage…). Tout se joue en argent fictif : aucun dépôt, aucun vrai pari.</p>
<p><a class="btn" href="/">Ouvrir le casino</a> <a class="btn ghost" href="/#special">Le Défi spécial : 1 000 000 KE</a> <a class="btn ghost" href="/articles/">Guides et astuces</a></p>{secs}"""
ld = {'@context': 'https://schema.org', '@type': 'ItemList', 'name': 'Jeux de SpinBet Casino', 'numberOfItems': len(games),
      'itemListElement': [{'@type': 'ListItem', 'position': k + 1, 'url': f'{SITE}/jeux/{g["id"]}.html', 'name': g['name']} for k, g in enumerate(games)]}
(out / 'index.html').write_text(page('jeux/', f'Tous les jeux gratuits ({len(games)}) : machines à sous, roulette, blackjack | SpinBet Casino',
                                     f'Les {len(games)} jeux de casino gratuits de SpinBet Casino : machines à sous, roulettes, roues, blackjack, poker, tables multijoueurs et jeux rapides, en argent fictif.', intro, ld), encoding='utf8')

# ---- the guides ----
art_dir = root / 'articles'
art_dir.mkdir(exist_ok=True)
for old in art_dir.glob('*.html'):
    old.unlink()
G = {g['id']: g for g in games}
stars = lambda g: '★' * int(g.get('vol', 3)) + '☆' * (5 - int(g.get('vol', 3)))
PUBLISHED = '2026-11-04'

def rank_item(k, g, tip=0):
    t = tips(g)
    return f"""<div class="rank"><a href="/jeux/{g['id']}.html"><img src="{cover(g)}" alt="{esc(g['name'])}" loading="lazy" width="120" height="160"></a><div>
<h3>{k}. {esc(g['name'])}</h3><p class="meta">{esc(g.get('tag', ''))} · RTP {esc(g.get('rtp', '—'))} · volatilité {stars(g)}{' · gain max ' + esc(plain(g['max'])) if g.get('max') else ''}</p>
<p>{esc(plain(g.get('description', '')))}</p><p><b>Notre astuce :</b> {esc(t[min(tip, len(t) - 1)])}</p>
<p><a href="/jeux/{g['id']}.html">Fiche et astuces</a> · <a href="/#game-{g['id']}">Jouer gratuitement à {esc(g['name'])}</a></p></div></div>"""

def article(a, body, faqs=()):
    url = f'{SITE}/articles/{a["slug"]}.html'
    others = ''.join(f'<li><a href="/articles/{b["slug"]}.html">{esc(b["title"])}</a></li>' for b in ARTICLES if b is not a)
    html_body = f"""<nav class="crumbs"><a href="/">Accueil</a> › <a href="/articles/">Guides</a> › {esc(a['title'])}</nav><article>
<h1>{esc(a['title'])}</h1><p class="sub">Mis à jour le {today[8:10]}/{today[5:7]}/{today[:4]} · par l’équipe SpinBet Casino</p>{body}
{'<h2>Questions fréquentes</h2>' + ''.join(f'<details><summary>{esc(q)}</summary><p>{esc(r)}</p></details>' for q, r in faqs) if faqs else ''}
<p><a class="btn" href="/">Jouer gratuitement sur SpinBet Casino</a> <a class="btn ghost" href="/jeux/">Tous les jeux</a></p>
<h2>D’autres guides</h2><ul class="f">{others}</ul></article>"""
    ld = [{'@context': 'https://schema.org', '@type': 'Article', 'headline': a['title'], 'description': a['desc'], 'url': url, 'inLanguage': 'fr',
           'datePublished': PUBLISHED, 'dateModified': today, 'image': f'{SITE}/assets/og.jpg',
           'author': {'@type': 'Organization', 'name': 'SpinBet Casino', 'url': SITE}, 'publisher': {'@type': 'Organization', 'name': 'SpinBet Casino', 'url': SITE}},
          {'@context': 'https://schema.org', **crumb([('Accueil', SITE + '/'), ('Guides', SITE + '/articles/'), (a['title'], url)])}]
    if faqs:
        ld.append({'@context': 'https://schema.org', '@type': 'FAQPage', 'mainEntity': [{'@type': 'Question', 'name': q, 'acceptedAnswer': {'@type': 'Answer', 'text': r}} for q, r in faqs]})
    (art_dir / f'{a["slug"]}.html').write_text(page(f'articles/{a["slug"]}.html', f'{a["title"]} | SpinBet Casino', a['desc'], html_body, ld), encoding='utf8')

FREE_FAQ = [('Faut-il payer ou télécharger quelque chose ?', 'Non. Tous les jeux de SpinBet Casino se jouent gratuitement dans le navigateur, sur téléphone ou ordinateur. Une appli gratuite existe aussi pour Android et iPhone (icône sur l’écran d’accueil).'),
            ('Peut-on gagner de l’argent réel ?', 'Non : les KE sont une monnaie fictive, sans valeur réelle. SpinBet Casino est un jeu de divertissement réservé aux plus de 18 ans.'),
            ('Comment avoir plus de KE ?', 'Le cadeau du jour (jusqu’à 10 000 KE au 7e jour), la roue du jour, les missions, les tournois, le cashback et les pubs récompensées que tu choisis de regarder.')]

ORDER = ['fortune', 'zeus', 'cosmic', 'barillet', 'totemx', 'anubis', 'huff', 'candy', 'chasse', 'noel', 'billets', 'dragons', 'labo', 'taco', 'pharaon', 'bling', 'big-bad-wolf']
slots = [G[i] for i in ORDER if i in G] + [g for g in games if g['cat'] == 'slot' and g['id'] not in ORDER]
a = ARTICLES[0]
article(a, f"""<p class="lead">Envie de faire tourner des rouleaux sans sortir ta carte bancaire ? Voici notre sélection des {len(slots)} meilleures machines à sous gratuites de 2026, toutes jouables tout de suite dans le navigateur, sans téléchargement ni inscription.</p>
<h2>Comment on les a classées</h2><p>On a regardé ce qui compte vraiment pour le joueur : la qualité du bonus (free spins, Hold &amp; Spin, multiplicateurs), le gain maximum, la volatilité (gains fréquents ou rares mais énormes) et le plaisir de jeu sur téléphone. Toutes ont un retour au joueur (RTP) d’environ 92 %, vérifié par des millions de tours simulés.</p>
<h2>Le classement 2026</h2>{''.join(rank_item(k + 1, g, 1) for k, g in enumerate(slots))}
<h2>Nos conseils pour bien jouer</h2><ul class="f"><li>Adapte ta mise à la volatilité : petite mise sur les machines à volatilité élevée pour tenir jusqu’au bonus.</li>
<li>Guette la <b>machine mystère</b> : une fois par jour, pendant 1 h, une machine cachée voit son bonus tomber 3 fois plus souvent.</li>
<li>Les tournois du soir (21 h – minuit) et du week-end classent le plus gros gain en × la mise : une petite mise peut gagner.</li>
<li>Chaque bonus débloqué en jouant compte pour le Défi spécial à 1 000 000 KE.</li></ul>
<p>Pour comprendre les mots RTP et volatilité, lis notre guide <a href="/articles/rtp-volatilite-machines-a-sous.html">RTP et volatilité</a>.</p>""",
        [('Quelle est la meilleure machine à sous gratuite en 2026 ?', f'Sur SpinBet Casino, {slots[0]["name"]} et {slots[1]["name"]} sont les plus jouées, mais la meilleure dépend de ton style : volatilité basse pour jouer longtemps, élevée pour viser un très gros gain.')] + FREE_FAQ)

tables = [g for g in games if g['cat'] == 'table' and not g['id'].endswith('-online')]
online = [g for g in games if g['id'].endswith('-online')]
a = ARTICLES[1]
article(a, f"""<p class="lead">Roulette, blackjack, poker ou grande roue : les jeux de table se jouent aussi gratuitement, sans rien installer. Voici les {len(tables)} tables de SpinBet Casino et leurs {len(online)} versions multijoueurs en direct.</p>
<h2>Les jeux de table en solo</h2>{''.join(rank_item(k + 1, g) for k, g in enumerate(tables))}
<h2>En multijoueur, avec les autres joueurs</h2><p>Les tables « Online » partent quand tout le salon a appuyé sur PRÊT : chacun joue sa propre mise, mais tout le monde voit la même roue ou les mêmes cartes, avec un chat de table.</p>
<ul class="f">{''.join(f'<li><a href="/jeux/{g["id"]}.html">{esc(g["name"])}</a> : {esc(plain(g.get("sub", "")))}</li>' for g in online)}</ul>
<h2>Bien jouer aux jeux de table</h2><ul class="f"><li>Au blackjack, la stratégie de base (rester dès 17, doubler sur 11, séparer les As et les 8) rapproche le retour de 98 %.</li>
<li>À la roulette, aucune martingale ne bat la banque : la bille n’a pas de mémoire.</li><li>Sur les roues à bonus, mise un peu sur les cases bonus : elles sont rares mais paient le plus.</li></ul>""", FREE_FAQ)

quick = [g for g in games if g['cat'] == 'quick']
a = ARTICLES[2]
article(a, f"""<p class="lead">Une partie en 10 secondes, des multiplicateurs qui grimpent et un bouton « Encaisser » : les jeux rapides sont les stars des casinos en ligne. Voici les {len(quick)} jeux rapides gratuits de SpinBet Casino.</p>
<h2>Tous les jeux rapides</h2>{''.join(rank_item(k + 1, g) for k, g in enumerate(quick))}
<h2>La règle d’or : savoir encaisser</h2><p>Dans un jeu crash, mines ou penalty, chaque étape de plus multiplie le gain… et le risque. Le retour au joueur (environ 95 %) ne change pas selon ta façon de jouer : seul le risque change. Fixe-toi un objectif (×2, ×5) avant de lancer et encaisse dès qu’il est atteint.</p>""", FREE_FAQ)

a = ARTICLES[3]
by_vol = sorted([g for g in games if g['cat'] == 'slot'], key=lambda g: (-int(g.get('vol', 3)), g['name']))
article(a, f"""<p class="lead">RTP, volatilité, gain maximum, achat de bonus : quatre mots qu’on voit partout sur les machines à sous. Voici ce qu’ils veulent dire, avec les vraies valeurs des machines de SpinBet Casino.</p>
<h2>Le RTP (retour au joueur)</h2><p>Le RTP, c’est la part des mises que la machine rend en moyenne, sur des millions de tours. Avec un RTP de 92 %, 100 KE misés rapportent en moyenne 92 KE. C’est une moyenne : sur 50 tours, tout peut arriver, dans un sens comme dans l’autre. Sur SpinBet Casino, les machines à sous visent 92 %, les jeux de table et les jeux rapides 94 à 98 %.</p>
<h2>La volatilité</h2><p>La volatilité dit <b>comment</b> la machine rend cet argent. Volatilité basse : souvent, par petits gains. Volatilité élevée ou extrême : rarement, mais parfois énormément d’un coup, surtout dans le bonus. Deux machines au même RTP peuvent donc donner des parties très différentes.</p>
<h2>Le gain maximum</h2><p>C’est le plafond d’un tour, bonus compris, en nombre de fois la mise (par exemple ×5 000). Sur SpinBet Casino, atteindre le gain maximum d’une machine fait aussi tomber le jackpot commun.</p>
<h2>L’achat de bonus</h2><p>Payer pour lancer le bonus tout de suite (souvent 50 à 500 fois la mise) fait gagner du temps, mais rend un peu moins en moyenne : environ 88 % au lieu de 92 %.</p>
<h2>Les machines de SpinBet Casino, de la plus volatile à la plus calme</h2>
<ul class="f">{''.join(f'<li><a href="/jeux/{g["id"]}.html">{esc(g["name"])}</a> : volatilité {stars(g)}, RTP {esc(g.get("rtp", "—"))}{", gain max " + esc(plain(g["max"])) if g.get("max") else ""}</li>' for g in by_vol)}</ul>""",
        [('Un RTP élevé veut-il dire qu’on gagne à coup sûr ?', 'Non : le RTP est une moyenne sur des millions de tours. Sur une courte partie, le hasard compte bien plus que le RTP.'),
         ('Quelle volatilité choisir ?', 'Basse pour jouer longtemps avec un petit solde, élevée si tu cherches le très gros gain et acceptes de longues séries sans rien.')] + FREE_FAQ[:2])

intro = f"""<nav class="crumbs"><a href="/">Accueil</a> › Guides</nav><h1>Guides et astuces SpinBet Casino</h1>
<p class="lead">Classements, conseils et explications pour mieux profiter des jeux de casino gratuits.</p>
{''.join(f'<div class="rank" style="grid-template-columns:1fr"><div><h3><a href="/articles/{a["slug"]}.html">{esc(a["title"])}</a></h3><p>{esc(a["desc"])}</p></div></div>' for a in ARTICLES)}"""
(art_dir / 'index.html').write_text(page('articles/', 'Guides et astuces : machines à sous, roulette, blackjack gratuits | SpinBet Casino',
                                         'Les guides de SpinBet Casino : meilleures machines à sous gratuites 2026, roulette et blackjack gratuits, jeux crash et mines, RTP et volatilité expliqués.', intro,
                                         {'@context': 'https://schema.org', '@type': 'CollectionPage', 'name': 'Guides SpinBet Casino', 'url': f'{SITE}/articles/'}), encoding='utf8')

# ---- sitemap.xml + robots.txt ----
urls = [(f'{SITE}/', '1.0', 'daily'), (f'{SITE}/jeux/', '0.9', 'weekly'), (f'{SITE}/articles/', '0.8', 'weekly')] + [(f'{SITE}/articles/{a["slug"]}.html', '0.8', 'monthly') for a in ARTICLES] + [(f'{SITE}/jeux/{g["id"]}.html', '0.8', 'weekly') for g in games]
xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + ''.join(
    f'  <url><loc>{u}</loc><lastmod>{today}</lastmod><changefreq>{f}</changefreq><priority>{p}</priority></url>\n' for u, p, f in urls) + '</urlset>\n'
(root / 'sitemap.xml').write_text(xml, encoding='utf8')
(root / 'sitemap.txt').write_text(''.join(f'{u}\n' for u, _, _ in urls), encoding='utf8')  # the same list, one address per line
(root / 'robots.txt').write_text(f'User-agent: *\nAllow: /\nDisallow: /dist/\n\nSitemap: {SITE}/sitemap.xml\nSitemap: {SITE}/sitemap.txt\n', encoding='utf8')
print(f'SEO : {len(games)} pages de jeux, {len(ARTICLES)} guides (articles/), jeux/index.html, sitemap.xml + sitemap.txt ({len(urls)} adresses), robots.txt')
