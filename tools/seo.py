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

# Stable dates: a page keeps its date until its content really changes (tools/seo/lastmod.json = path → hash, date),
# so the sitemap's <lastmod> means something to Google. Pages write @@DATE@@ / @@DATEFR@@ where the date goes.
import hashlib
LM_FILE = root / 'tools' / 'seo' / 'lastmod.json'
LM = json.loads(LM_FILE.read_text(encoding='utf8')) if LM_FILE.exists() else {}
def stamp(rel, text):
    h = hashlib.sha1(text.encode('utf8')).hexdigest()[:16]
    if LM.get(rel, {}).get('h') != h:
        LM[rel] = {'h': h, 'd': today}
    d = LM[rel]['d']
    return d, text.replace('@@DATE@@', d).replace('@@DATEFR@@', f'{d[8:10]}/{d[5:7]}/{d[:4]}')
def emit(rel, text):
    (root / rel).write_text(stamp(rel, text)[1], encoding='utf8')

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

# What people type in Google for each game (title, H1, description, image alt). Generic words only: no other
# company's game or brand names. A new game without an entry falls back to its category (KW_CAT).
KW = {
    'big-bad-wolf': 'machine à sous gratuite Hold & Spin du loup', 'cosmic': 'machine à sous gratuite dans l’espace',
    'zeus': 'machine à sous gratuite des dieux grecs', 'huff': 'machine à sous gratuite des trois petits cochons',
    'candy': 'machine à sous gratuite aux bonbons', 'anubis': 'machine à sous gratuite égyptienne',
    'bling': 'machine à sous gratuite aux gemmes', 'pharaon': 'machine à sous gratuite à multiplicateur',
    'chasse': 'machine à sous gratuite de chasse', 'noel': 'machine à sous gratuite de Noël',
    'totemx': 'machine à sous gratuite totem jusqu’à ×100', 'barillet': 'machine à sous gratuite western', 'filon': 'machine à sous gratuite de la mine d’or',
    'taco': 'machine à sous gratuite pizza', 'billets': 'machine à sous gratuite à jackpots',
    'dragons': 'machine à sous gratuite de dragons', 'labo': 'machine à sous gratuite à 3 bonus',
    'fortune': 'machine à sous gratuite chinoise Hold & Spin',
    'madwheel': 'jeu de roue gratuit à 4 bonus', 'storm': 'roulette gratuite à multiplicateurs',
    'doublespin': 'roulette gratuite à deux billes', 'plateau': 'jeu de roue et de dés gratuit',
    'peche': 'jeu de roue gratuit, pêche aux multiplicateurs', 'roueor': 'roue de la fortune gratuite',
    'blackjack': 'blackjack gratuit en ligne', 'lightningbj': 'blackjack gratuit à multiplicateurs',
    'poker': 'poker Texas Hold’em gratuit contre des bots',
    'storm-online': 'roulette multijoueur gratuite', 'bj-online': 'blackjack multijoueur gratuit',
    'holdem-online': 'poker multijoueur gratuit', 'madwheel-online': 'jeu de roue multijoueur gratuit',
    'robots-online': 'course de robots multijoueur gratuite', 'plateau-online': 'jeu de roue et de dés multijoueur',
    'peche-online': 'jeu de pêche multijoueur gratuit', 'roueor-online': 'roue de la fortune multijoueur',
    'mines': 'jeu des mines gratuit', 'avion': 'jeu crash de l’avion gratuit', 'plinko': 'plinko gratuit en ligne',
    'vortex': 'jeu du vortex gratuit', 'casse': 'jeu du coffre-fort gratuit', 'pileface': 'pile ou face en ligne gratuit',
    'robots': 'course de robots gratuite', 'poulet': 'jeu du poulet gratuit', 'gratteciel': 'jeu de cubes à empiler gratuit',
    'penalty': 'jeu de penalty gratuit', 'ticket': 'ticket à gratter gratuit en ligne', 'billes': 'course de billes gratuite', 'pilote': 'jeu d’avion gratuit avec multiplicateurs',
    'foot': 'jeu de foot en ligne gratuit entre amis',
    'boxe': 'jeu de boxe en ligne gratuit entre amis',
}
KW_CAT = {'slot': 'machine à sous gratuite', 'table': 'jeu de casino gratuit', 'quick': 'jeu rapide gratuit'}
kw_of = lambda g: KW.get(g['id']) or KW_CAT.get(g['cat'], 'jeu de casino gratuit')
cap = lambda t: t[:1].upper() + t[1:]

def clip(t, n=158):
    """A meta description Google shows whole: cut at the last word before n characters."""
    t = re.sub(r'\s+', ' ', t).strip()
    return t if len(t) <= n else t[:n].rsplit(' ', 1)[0].rstrip(' ,;:·') + '…'

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
    if g['id'] == 'foot':  # Le Derby: a football match between friends, not a game against the house
        return [
            "Commence par l’entraînement contre l’ordinateur (Facile, Normal, Difficile) pour apprendre les commandes avant de miser contre un ami.",
            "Tiens le bouton TIR pour frapper plus fort et pousse le stick vers un côté du but pour viser le poteau : une frappe trop chargée passe au-dessus.",
            "Ne tacle pas par derrière : c’est faute, et dans ta surface c’est penalty. Préfère le tacle debout quand l’attaquant est face à toi.",
            "En défense, PASSE change de joueur et TIR appelle un coéquipier au pressing : à deux, le ballon se récupère beaucoup plus vite.",
            "Avec le ballon, TACLE devient DRIBBLE : un crochet rapide qui évite le tacle de l’adversaire.",
            "La mise est libre : chacun mise la même somme, le gagnant prend toute la cagnotte et un match nul rend sa mise à chacun. Tout est en KE, une monnaie fictive.",
        ]
    if g['id'] == 'boxe':  # Le Ring: a boxing match between friends, not a game against the house
        return [
            "Commence par l’entraînement contre l’ordinateur (Facile, Normal, Difficile) pour apprendre les coups avant de miser contre un ami.",
            "La DROITE est rapide et porte loin : parfaite pour garder l’adversaire à distance. Le CROCHET et l’UPPERCUT font plus mal mais laissent plus de temps pour être esquivés.",
            "Esquive puis frappe : après une esquive réussie, ton coup suivant est un CONTRE, plus rapide et 1,5 fois plus fort.",
            "Attention à l’esquive basse : elle évite la droite et le crochet, mais un uppercut dedans fait très mal.",
            "Vise le corps (stick vers le bas + coup) : l’adversaire s’épuise, ses coups deviennent lents et mous.",
            "Au tapis, tape très vite sur les boutons pour te relever avant 10. Trois knockdowns dans le même round, et l’arbitre arrête le combat.",
            "La mise est libre : chacun mise la même somme, le vainqueur prend toute la bourse et un match nul rend sa mise à chacun. Tout est en KE, une monnaie fictive.",
        ]
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
    if g['id'] == 'foot':
        return [(f"{name} est-il gratuit ?", f"Oui. {name} se joue gratuitement sur SpinBet Casino, dans le navigateur, sur téléphone comme sur ordinateur, avec des KE (monnaie fictive) : aucun dépôt, rien à télécharger."),
                ("Comment défier un ami ?", "Crée ton compte, ajoute ton ami avec son pseudo (chat › Amis), puis dans Le Derby choisis-le, ta mise et la durée du match. Dès qu’il accepte, le match commence en direct sur vos deux appareils."),
                ("Que se passe-t-il en cas de match nul ?", "Chacun récupère sa mise. Sinon le gagnant prend toute la cagnotte (les deux mises). Abandonner en cours de match fait perdre."),
                (f"Peut-on jouer à {name} sur ordinateur ?", "Oui : les flèches ou ZQSD pour courir, K pour la passe, L ou Espace pour le tir, J pour le tacle et Maj pour sprinter. Une manette marche aussi."),
                (f"Peut-on gagner de l’argent réel à {name} ?", "Non. SpinBet Casino est un jeu de divertissement : les KE n’ont aucune valeur réelle et ne s’échangent pas contre de l’argent.")]
    if g['id'] == 'boxe':
        return [(f"{name} est-il gratuit ?", f"Oui. {name} se joue gratuitement sur SpinBet Casino, dans le navigateur, sur téléphone comme sur ordinateur, avec des KE (monnaie fictive) : aucun dépôt, rien à télécharger."),
                ("Comment défier un ami à la boxe ?", "Crée ton compte, ajoute ton ami avec son pseudo (chat › Amis), puis dans Le Ring choisis-le, ta mise et le nombre de rounds. Dès qu’il accepte, le combat commence en direct sur vos deux appareils."),
                ("Peut-on jouer en vue à la première personne ?", "Oui : choisis la 1re personne (tes gants devant toi, l’adversaire en face), la 3e personne (derrière ton boxeur) ou la vue TV, avant le combat ou pendant, avec le bouton caméra."),
                ("Comment se termine un combat ?", "Par K.-O. (pas relevé avant 10), par arrêt de l’arbitre (3 knockdowns dans le même round) ou à la décision de 3 juges qui notent chaque round. En cas d’égalité, match nul : chacun récupère sa mise."),
                (f"Peut-on gagner de l’argent réel à {name} ?", "Non. SpinBet Casino est un jeu de divertissement : les KE n’ont aucune valeur réelle et ne s’échangent pas contre de l’argent.")]
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
nav.crumbs{font-size:14px;color:#94a3b8;margin-bottom:10px}nav.crumbs a{color:#cbd5e1}h1{font:900 clamp(30px,6vw,48px)/1.1 Archivo,system-ui,sans-serif;margin:6px 0 8px;color:#fff}h1 small{display:block;margin-top:6px;font:700 clamp(15px,2.4vw,19px)/1.3 Inter,system-ui,sans-serif;color:#fca5a5}
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
@media(max-width:560px){.rank{grid-template-columns:84px 1fr}}.lead{font-size:18px;color:#cbd5e1}
h3{font:800 18px Archivo,system-ui,sans-serif;color:#fff;margin:22px 0 6px}.tw{overflow-x:auto;margin:8px 0 16px}
table.bs{border-collapse:collapse;min-width:520px;width:100%;font-size:14px;text-align:center}table.bs th,table.bs td{border:1px solid #1f2937;padding:6px 4px}
table.bs thead th{background:#111827;color:#fff}table.bs tbody th{background:#111827;color:#fff;text-align:left;padding-left:8px;white-space:nowrap}
.bs-T{background:#7f1d1d;color:#fff}.bs-R{background:#14532d;color:#fff}.bs-D{background:#1e3a8a;color:#fff}.bs-S{background:#713f12;color:#fff;font-weight:800}"""

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
<footer>SpinBet Casino · jeux de casino gratuits en argent fictif (KE) : aucun dépôt, aucun vrai pari, aucun gain réel. Réservé aux 18 ans et plus. <a href="/#responsable">Jeu responsable</a> · <a href="/jeux/">Tous les jeux</a> · <a href="/confidentialite.html">Confidentialité</a></footer>
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
    {'slug': 'comment-gagner-aux-machines-a-sous', 'cats': ['slot'], 'title': 'Comment gagner aux machines à sous ? Vrais conseils et idées reçues',
     'desc': 'Machine « chaude », heure de jeu, presque-gagné : ce qui est faux, et ce qui marche vraiment aux machines à sous (mise, volatilité, bonus, événements), expliqué simplement.'},
    {'slug': 'strategie-blackjack', 'cats': [], 'games': ['blackjack', 'lightningbj', 'bj-online'], 'title': 'Stratégie de base au blackjack : le tableau complet',
     'desc': 'Quand tirer, rester, doubler ou séparer au blackjack : le tableau de la stratégie de base (6 jeux, croupier qui reste à 17), avec les règles à retenir et des exemples.'},
    {'slug': 'martingale-roulette', 'cats': [], 'games': ['storm', 'doublespin', 'storm-online'], 'title': 'Martingale à la roulette : est-ce que ça marche vraiment ?',
     'desc': 'La martingale (doubler après chaque perte) expliquée avec les vrais chiffres : séries noires, mise maximale, avantage de la maison, et ce qu’il faut en retenir.'},
    {'slug': 'casino-gratuit-sur-telephone', 'cats': ['slot', 'table', 'quick'], 'title': 'Casino gratuit sur téléphone, sans téléchargement (Android et iPhone)',
     'desc': 'Jouer aux machines à sous, à la roulette et au blackjack gratuitement sur téléphone : dans le navigateur, en appli sur l’écran d’accueil, avec notifications et plein écran.'},
]
art_for = lambda g: [a for a in ARTICLES if g['id'] in a.get('games', []) or g['cat'] in a['cats']]

# ---- one page per game ----
for g in games:
    cat = CATS.get(g['cat'], CATS['slot'])
    name, desc = g['name'], plain(g.get('description', ''))
    kind = g.get('tag', cat[1])
    online = g['id'].endswith('-online')
    kw = kw_of(g)
    title = f"{name} : {kw} | SpinBet Casino"
    if len(title) > 66:
        title = f"{name} : {kw} | SpinBet"
    meta = clip(f"{name}, {kw} sans téléchargement ni dépôt. {desc}")
    same = [x for x in games if x['cat'] == g['cat'] and x['id'] != g['id']][:8]
    body = f"""<nav class="crumbs"><a href="/">Accueil</a> › <a href="/jeux/">Jeux</a> › <a href="/jeux/#{cat[0]}">{cat[1]}</a> › {esc(name)}</nav>
<div class="hero"><img src="{cover(g)}" alt="{esc(name)}, {esc(kw)} sur SpinBet Casino" width="300" height="400">
<div><span class="tag">{esc(kind)}</span><h1>{esc(name)}<small>{esc(cap(kw))}</small></h1><p class="sub">{esc(plain(g.get('sub', '')))}</p><p>{esc(desc)}</p>
<div class="facts"><div><b>{esc(g.get('rtp', '—'))}</b><small>Retour au joueur</small></div><div><b>{esc(plain(g.get('max', '—')))}</b><small>Gain maximum</small></div><div><b>{'★' * int(g.get('vol', 3))}</b><small>Volatilité</small></div></div>
<a class="btn" href="/#game-{g['id']}">Jouer à {esc(name)} gratuitement</a></div></div>
<h2>Ce qu’il y a dans {esc(name)}</h2><ul class="f">{''.join(f'<li>{esc(plain(f))}</li>' for f in g.get('features', []))}</ul>
<h2>Comment jouer</h2><p>{esc(name)} se joue directement dans le navigateur, sur téléphone comme sur ordinateur, sans téléchargement. Tu reçois des KE, la monnaie fictive du site : aucun dépôt, aucun vrai pari. {'Ici, tu joues en direct avec les autres joueurs du salon, avec un chat de table.' if online else 'Choisis ta mise, lance, et vise les bonus.'}</p>
{shotsHTML(g)}<h2>Astuces pour {esc(name)}</h2><ol class="tips">{''.join(f'<li>{esc(t)}</li>' for t in tips(g))}</ol>
<h2>Questions fréquentes</h2>{''.join(f'<details><summary>{esc(a)}</summary><p>{esc(b)}</p></details>' for a, b in faq(g))}
<h2>À lire aussi</h2><ul class="f">{''.join(f'<li><a href="/articles/{a["slug"]}.html">{esc(a["title"])}</a></li>' for a in art_for(g))}</ul>
<h2>D’autres {esc(cat[1].lower())}</h2><div class="grid">{''.join(card(x) for x in same)}</div>"""
    ld = [{'@context': 'https://schema.org', '@type': 'VideoGame', 'name': name, 'description': desc, 'url': f'{SITE}/jeux/{g["id"]}.html', 'image': SITE + cover(g),
           'genre': kind, 'gamePlatform': ['Navigateur web', 'Android', 'iOS'], 'applicationCategory': 'Game', 'inLanguage': 'fr', 'isAccessibleForFree': True,
           'offers': {'@type': 'Offer', 'price': 0, 'priceCurrency': 'EUR'}, 'publisher': {'@type': 'Organization', 'name': 'SpinBet Casino', 'url': SITE}},
          {'@context': 'https://schema.org', **crumb([('Accueil', SITE + '/'), ('Jeux', SITE + '/jeux/'), (name, f'{SITE}/jeux/{g["id"]}.html')])},
          {'@context': 'https://schema.org', '@type': 'FAQPage', 'mainEntity': [{'@type': 'Question', 'name': a, 'acceptedAnswer': {'@type': 'Answer', 'text': b}} for a, b in faq(g)]}]
    if shots(g):
        ld[0]['screenshot'] = [SITE + x for x in shots(g)]
    emit(f'jeux/{g["id"]}.html', page(f'jeux/{g["id"]}.html', title, meta, body, ld, SITE + cover(g)))

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
emit('jeux/index.html', page('jeux/', f'Tous les jeux gratuits ({len(games)}) : machines à sous, roulette, blackjack | SpinBet Casino',
                                     f'Les {len(games)} jeux de casino gratuits de SpinBet Casino : machines à sous, roulettes, roues, blackjack, poker, tables multijoueurs et jeux rapides, en argent fictif.', intro, ld))

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
<h1>{esc(a['title'])}</h1><p class="sub">Mis à jour le @@DATEFR@@ · par l’équipe SpinBet Casino</p>{body}
{'<h2>Questions fréquentes</h2>' + ''.join(f'<details><summary>{esc(q)}</summary><p>{esc(r)}</p></details>' for q, r in faqs) if faqs else ''}
<p><a class="btn" href="/">Jouer gratuitement sur SpinBet Casino</a> <a class="btn ghost" href="/jeux/">Tous les jeux</a></p>
<h2>D’autres guides</h2><ul class="f">{others}</ul></article>"""
    ld = [{'@context': 'https://schema.org', '@type': 'Article', 'headline': a['title'], 'description': a['desc'], 'url': url, 'inLanguage': 'fr',
           'datePublished': PUBLISHED, 'dateModified': '@@DATE@@', 'image': f'{SITE}/assets/og.jpg',
           'author': {'@type': 'Organization', 'name': 'SpinBet Casino', 'url': SITE}, 'publisher': {'@type': 'Organization', 'name': 'SpinBet Casino', 'url': SITE}},
          {'@context': 'https://schema.org', **crumb([('Accueil', SITE + '/'), ('Guides', SITE + '/articles/'), (a['title'], url)])}]
    if faqs:
        ld.append({'@context': 'https://schema.org', '@type': 'FAQPage', 'mainEntity': [{'@type': 'Question', 'name': q, 'acceptedAnswer': {'@type': 'Answer', 'text': r}} for q, r in faqs]})
    emit(f'articles/{a["slug"]}.html', page(f'articles/{a["slug"]}.html', f'{a["title"]} | SpinBet Casino', a['desc'], html_body, ld))

FREE_FAQ = [('Faut-il payer ou télécharger quelque chose ?', 'Non. Tous les jeux de SpinBet Casino se jouent gratuitement dans le navigateur, sur téléphone ou ordinateur. Une appli gratuite existe aussi pour Android et iPhone (icône sur l’écran d’accueil).'),
            ('Peut-on gagner de l’argent réel ?', 'Non : les KE sont une monnaie fictive, sans valeur réelle. SpinBet Casino est un jeu de divertissement réservé aux plus de 18 ans.'),
            ('Comment avoir plus de KE ?', 'Le cadeau du jour (jusqu’à 10 000 KE au 7e jour), la roue du jour, les missions, les tournois, le cashback et les pubs récompensées que tu choisis de regarder.')]

ORDER = ['fortune', 'zeus', 'cosmic', 'filon', 'barillet', 'totemx', 'anubis', 'huff', 'candy', 'chasse', 'noel', 'billets', 'dragons', 'labo', 'taco', 'pharaon', 'bling', 'big-bad-wolf']
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

# ---- the newer guides ----
AS = {a['slug']: a for a in ARTICLES}
link = lambda gid, txt=None: f'<a href="/jeux/{gid}.html">{esc(txt or G[gid]["name"])}</a>' if gid in G else esc(txt or gid)

article(AS['comment-gagner-aux-machines-a-sous'], f"""<p class="lead">Existe-t-il une méthode pour gagner aux machines à sous ? La réponse honnête : aucune astuce ne change le hasard d’un tour. Mais certains choix changent beaucoup ta partie, et certaines croyances te font perdre plus vite. Voici le tri, avec les vrais chiffres.</p>
<h2>Ce qui est faux</h2>
<h3>« Cette machine est chaude, elle va payer »</h3><p>Chaque tour est tiré au hasard, indépendamment des tours d’avant. Une machine qui n’a rien donné depuis 200 tours n’a pas plus de chances de payer au 201e. Il n’y a ni machine « chaude » ni machine « froide » : seulement des séries, qui n’annoncent rien.</p>
<h3>« Il y a des heures où ça paie plus »</h3><p>Le tirage ne dépend pas de l’heure, ni du nombre de joueurs connectés. Sur SpinBet, ce sont les <b>événements</b> qui changent à certaines heures (voir plus bas), pas le hasard des rouleaux.</p>
<h3>« J’ai failli gagner, ça va tomber »</h3><p>Deux scatters sur trois, un symbole juste au-dessus de la ligne : ce « presque » ne veut rien dire pour le tour suivant. C’est une impression, pas un signal.</p>
<h3>« Il faut augmenter la mise après une perte »</h3><p>Monter la mise pour « se refaire » ne change pas le retour moyen : ça fait seulement fondre le solde plus vite pendant les mauvaises séries. C’est la même erreur que la <a href="/articles/martingale-roulette.html">martingale à la roulette</a>.</p>
<h2>Ce qui marche vraiment</h2>
<h3>1. Choisir la volatilité qui te va</h3><p>Deux machines au même retour (RTP ≈ 92 %) peuvent donner des parties opposées. Volatilité basse : des petits gains souvent, idéal pour jouer longtemps. Volatilité élevée : de longues séries calmes puis parfois un énorme bonus. Toutes les valeurs sont dans notre guide <a href="/articles/rtp-volatilite-machines-a-sous.html">RTP et volatilité</a>.</p>
<h3>2. Régler sa mise sur son solde</h3><p>Une bonne règle : environ 1 % de ton solde par tour sur une machine très volatile, 2 % sur une machine calme. Avec 10 000 KE, une mise de 100 KE te laisse le temps de voir arriver un bonus ; une mise de 2 000 KE peut tout perdre en quelques tours.</p>
<h3>3. Savoir ce que coûte l’achat de bonus</h3><p>Acheter le bonus (souvent 50 à 500 fois la mise) fait gagner du temps, mais il rend en moyenne un peu moins (≈ 88 %) que les tours normaux (≈ 92 %). Garde-le pour quand ton solde est confortable.</p>
<h3>4. Profiter des événements (c’est là que se trouvent les vrais bons plans)</h3><ul class="f">
<li><b>Happy Hour</b> (22 h – 23 h) : gains ×2 sur la machine du tournoi du soir.</li>
<li><b>Événements flash</b> : 3 fois par jour, 30 minutes de gains ×2 sur une machine à sous.</li>
<li><b>Machine mystère</b> : une fois par jour pendant 1 h, une machine cachée où le bonus tombe 3 fois plus souvent.</li>
<li><b>Cashback</b> : chaque jour, 5 à 25 % des pertes de la veille reviennent.</li>
<li><b>Tournois</b> : le classement compte le plus gros gain en × la mise, donc une petite mise peut gagner le tournoi.</li></ul>
<h3>5. Se fixer une limite</h3><p>Décide avant de jouer combien de KE tu acceptes de perdre et quand tu t’arrêtes après un beau gain. Même en argent fictif, c’est la meilleure habitude à prendre.</p>
<h2>Par où commencer ?</h2><p>Pour découvrir : {link('candy')} ou {link('fortune')}. Pour viser très haut : {link('barillet')} ou {link('totemx')}. Le classement complet est dans <a href="/articles/meilleures-machines-a-sous-gratuites-2026.html">les meilleures machines à sous gratuites en 2026</a>.</p>""",
        [('Peut-on prévoir quand une machine à sous va payer ?', 'Non. Chaque tour est tiré au hasard, sans lien avec les tours précédents ni avec l’heure de la journée.'),
         ('Quelle mise choisir aux machines à sous ?', 'Environ 1 % du solde par tour sur une machine à volatilité élevée, jusqu’à 2 % sur une machine calme, pour tenir jusqu’au bonus.'),
         ('L’achat de bonus est-il rentable ?', 'Il rend un peu moins en moyenne (≈ 88 %) que les tours normaux (≈ 92 %) : il fait gagner du temps, pas des KE.')] + FREE_FAQ[1:2])

# basic strategy table (6 decks, dealer stands on 17, double on any 2 cards, double after split, no surrender)
UP = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'A']
def row(label, codes):
    return f'<tr><th>{label}</th>' + ''.join(f'<td class="bs-{c}">{c}</td>' for c in codes.split()) + '</tr>'
def bs_table(title, rows):
    return (f'<h3>{title}</h3><div class="tw"><table class="bs"><thead><tr><th>Ta main</th>' + ''.join(f'<th>{u}</th>' for u in UP)
            + '</tr></thead><tbody>' + ''.join(row(l, c) for l, c in rows) + '</tbody></table></div>')
HARD = [('5 à 8', 'T T T T T T T T T T'), ('9', 'T D D D D T T T T T'), ('10', 'D D D D D D D D T T'), ('11', 'D D D D D D D D D T'),
        ('12', 'T T R R R T T T T T'), ('13 à 16', 'R R R R R T T T T T'), ('17 et plus', 'R R R R R R R R R R')]
SOFT = [('A-2, A-3', 'T T T D D T T T T T'), ('A-4, A-5', 'T T D D D T T T T T'), ('A-6', 'T D D D D T T T T T'),
        ('A-7', 'R D D D D R R T T T'), ('A-8, A-9', 'R R R R R R R R R R')]
PAIRS = [('A-A', 'S S S S S S S S S S'), ('10-10', 'R R R R R R R R R R'), ('9-9', 'S S S S S R S S R R'), ('8-8', 'S S S S S S S S S S'),
         ('7-7', 'S S S S S S T T T T'), ('6-6', 'S S S S S T T T T T'), ('5-5', 'D D D D D D D D T T'), ('4-4', 'T T T S S T T T T T'),
         ('2-2, 3-3', 'S S S S S S T T T T')]
article(AS['strategie-blackjack'], f"""<p class="lead">Au blackjack, contrairement aux machines à sous, tes choix comptent. La « stratégie de base » donne, pour chaque main, le meilleur choix face à la carte visible du croupier. Bien appliquée, elle réduit l’avantage de la maison au minimum.</p>
<h2>Les règles de ce tableau</h2><p>Il est fait pour les règles de {link('blackjack')} et du {link('bj-online')} : sabot de 6 jeux, le croupier tire jusqu’à 16 et <b>reste sur tous les 17</b>, doubler sur deux cartes (aussi après une séparation), une seule séparation, pas d’abandon. Le blackjack naturel paie 6 pour 5.</p>
<h2>Comment lire le tableau</h2><p>Cherche ta main à gauche et la carte visible du croupier en haut. <b>T</b> = tirer, <b>R</b> = rester, <b>D</b> = doubler (si tu as déjà 3 cartes : tire, sauf A-7 où tu restes), <b>S</b> = séparer. Une main « souple » contient un As compté 11 (par exemple A-6 = 17 souple).</p>
{bs_table('Mains dures (sans As compté 11)', HARD)}
{bs_table('Mains souples (avec un As compté 11)', SOFT)}
{bs_table('Les paires', PAIRS)}
<h2>Les 7 règles à retenir si tu ne veux pas apprendre le tableau</h2><ol class="tips">
<li>Toujours séparer les As et les 8.</li><li>Ne jamais séparer les 10 ni les 5 (une paire de 5, c’est un 10 : double).</li>
<li>Doubler sur 11, sauf contre un As ; doubler sur 10 contre 2 à 9.</li><li>Avec 12 à 16 : rester si le croupier montre 2 à 6 (sauf 12 contre 2 ou 3), tirer contre 7 et plus.</li>
<li>Toujours rester à partir de 17 dur.</li><li>Tirer sur un 17 souple (A-6) ou moins, sauf pour doubler.</li><li>Ne pas prendre de risque « au feeling » : le tableau a été calculé sur des millions de mains.</li></ol>
<h2>Pourquoi le croupier « faible » compte autant</h2><p>Quand le croupier montre 4, 5 ou 6, il doit souvent tirer sur une main de 12 à 16 et dépasse 21 dans environ 40 % des cas. C’est pour ça que la stratégie te fait rester avec des mains moyennes et doubler davantage contre ces cartes.</p>
<h2>Et le Blackjack électrique ?</h2><p>Sur {link('lightningbj')}, avant chaque distribution, les totaux 17 à 21 reçoivent un multiplicateur de ×1 à ×1000. La stratégie de base reste le bon point de départ ; une main gagnante sur un total multiplié paie tout de suite son multiplicateur.</p>""",
        [('Que veut dire « le croupier reste à 17 » ?', 'Le croupier tire tant que sa main vaut 16 ou moins, et s’arrête dès 17, même avec un As compté 11 (17 souple).'),
         ('Faut-il toujours séparer les As ?', 'Oui : deux mains qui commencent par un As valent bien mieux qu’une main de 12.'),
         ('La stratégie de base fait-elle gagner à coup sûr ?', 'Non, elle rend seulement le meilleur choix à chaque main. La banque garde un petit avantage sur la durée.')] + FREE_FAQ[1:2])

article(AS['martingale-roulette'], f"""<p class="lead">La martingale est la « méthode » la plus connue à la roulette : miser sur rouge (ou noir), doubler après chaque perte, revenir à la mise de départ après un gain. Sur le papier, chaque série finit par rapporter la mise de départ. Dans la réalité, voici ce qui se passe.</p>
<h2>Le principe</h2><p>Tu mises 1 KE sur rouge. Perdu ? 2 KE. Encore perdu ? 4, puis 8, 16, 32… Le jour où le rouge sort, tu récupères toutes tes pertes plus 1 KE. Et tu recommences à 1 KE.</p>
<h2>Le problème : les séries noires arrivent</h2><p>Sur une roulette européenne (37 cases avec le zéro), une mise sur rouge perd 19 fois sur 37 (le zéro fait perdre aussi). Perdre plusieurs fois de suite semble rare, mais :</p>
<div class="tw"><table class="bs"><thead><tr><th>Pertes d’affilée</th><th>Chance que ça arrive</th><th>Mise suivante (départ 1 KE)</th><th>Déjà perdu</th></tr></thead><tbody>
<tr><th>5</th><td>1 série sur 28</td><td>32 KE</td><td>31 KE</td></tr><tr><th>8</th><td>1 série sur 207</td><td>256 KE</td><td>255 KE</td></tr>
<tr><th>10</th><td>1 série sur 784</td><td>1 024 KE</td><td>1 023 KE</td></tr><tr><th>13</th><td>1 série sur 5 792</td><td>8 192 KE</td><td>8 191 KE</td></tr></tbody></table></div>
<p>Sur 1 000 tours de roulette, il y a environ <b>46 % de chances</b> de croiser au moins une série de 10 pertes d’affilée (calcul par simulation).</p>
<h2>Le mur : la mise maximale et le solde</h2><p>Avec 10 000 KE de solde et un départ à 1 KE, tu peux encaisser 13 pertes d’affilée (8 191 KE perdus) : la 14e mise (8 192 KE) dépasse ce qu’il te reste. Résultat : tu gagnes 1 KE presque à chaque série… et une fois sur 5 800 environ, tu perds 8 191 KE d’un coup. En moyenne, chaque série te coûte environ 0,4 KE : exactement l’avantage de la maison (2,7 % avec un seul zéro), que la martingale ne fait pas disparaître.</p>
<h2>Et les autres systèmes ?</h2><ul class="f"><li><b>D’Alembert</b> (+1 après une perte, −1 après un gain) : pertes plus lentes, même avantage de la maison.</li>
<li><b>Fibonacci</b> (mises 1, 1, 2, 3, 5, 8…) : moins brutale que la martingale, même résultat moyen.</li>
<li><b>Paroli</b> (doubler après un gain) : petites pertes, parfois une belle série, toujours le même retour moyen.</li></ul>
<p>Aucun système de mises ne change la probabilité de chaque tour : la bille n’a pas de mémoire.</p>
<h2>Ce qu’on te conseille</h2><p>Joue la roulette pour le suspense, avec une mise fixe et une limite de pertes. Sur {link('storm')}, la foudre frappe 1 à 5 numéros à chaque tour avec un multiplicateur de ×50 à ×50 000 sur les pleins ; sur {link('doublespin')}, une deuxième bille peut multiplier ton plein jusqu’à ×100 000. Tu peux essayer la martingale gratuitement, en KE, et voir par toi-même.</p>""",
        [('La martingale est-elle gagnante à la roulette ?', 'Non. Elle gagne souvent de petites sommes mais finit par une série de pertes qui coûte tout. En moyenne, elle perd l’avantage de la maison, comme n’importe quelle mise.'),
         ('Combien de fois de suite le rouge peut-il ne pas sortir ?', 'Sans limite : 10 pertes d’affilée arrivent environ une série sur 784 sur une roulette européenne.'),
         ('Existe-t-il un système pour battre la roulette ?', 'Non. Chaque tour est indépendant et l’avantage de la maison (2,7 % avec un seul zéro) reste le même quel que soit le système de mises.')] + FREE_FAQ[1:2])

article(AS['casino-gratuit-sur-telephone'], f"""<p class="lead">Pas envie d’installer une appli de plus ? SpinBet Casino se joue directement dans le navigateur de ton téléphone, gratuitement, avec les mêmes jeux que sur ordinateur. Et si tu veux, tu peux l’ajouter à ton écran d’accueil en 10 secondes.</p>
<h2>Jouer tout de suite, sans téléchargement</h2><p>Ouvre <a href="/">www.spinbetcaz.com</a> dans Chrome, Safari ou n’importe quel navigateur : tu joues immédiatement en invité, avec des KE offerts. Crée ensuite un compte gratuit pour garder ton solde, ta progression et tes cartes sur tous tes appareils.</p>
<h2>L’ajouter à l’écran d’accueil (comme une vraie appli)</h2><ul class="f">
<li><b>Android (Chrome)</b> : menu ⋮ → « Installer l’application » (ou « Ajouter à l’écran d’accueil »). Il existe aussi un fichier APK sur la page <a href="/#telecharger">Télécharger l’appli</a>.</li>
<li><b>iPhone (Safari)</b> : bouton Partager → « Sur l’écran d’accueil ». Depuis TikTok, Instagram ou Snapchat, ouvre d’abord le lien dans Safari.</li></ul>
<p>L’icône SpinBet s’ouvre alors en plein écran, sans barre d’adresse, et les mises à jour arrivent toutes seules.</p>
<h2>Les notifications (gratuites, désactivables)</h2><p>Une fois l’appli installée, active les notifications : la roue du jour, le tournoi du soir, les événements flash à gains ×2 et ton cadeau du jour te sont rappelés au bon moment. Sur iPhone, elles marchent depuis l’icône de l’écran d’accueil.</p>
<h2>Les jeux qui tournent le mieux sur téléphone</h2><p>Machines à sous : {link('fortune')}, {link('zeus')}, {link('candy')}. Tables : {link('blackjack')}, {link('storm')}. Jeux rapides pour une partie de 10 secondes : {link('mines')}, {link('avion')}, {link('plinko')}. Le bouton « Plein écran » de chaque jeu agrandit la partie, et sur Android le téléphone vibre aux gains et aux bonus.</p>
<h2>Bon à savoir</h2><ul class="f"><li>Tout est en KE, une monnaie fictive : aucun dépôt, aucun paiement, aucun gain réel.</li>
<li>Le site est léger : les jeux se chargent seulement quand tu les ouvres.</li><li>Réservé aux plus de 18 ans. Joue pour le plaisir et fais des pauses.</li></ul>""",
        [('Faut-il télécharger une application pour jouer ?', 'Non, tout marche dans le navigateur. L’ajout à l’écran d’accueil est facultatif et gratuit.'),
         ('SpinBet Casino marche-t-il sur iPhone ?', 'Oui, dans Safari, et en plein écran une fois ajouté à l’écran d’accueil (Partager → Sur l’écran d’accueil).')] + FREE_FAQ)

intro = f"""<nav class="crumbs"><a href="/">Accueil</a> › Guides</nav><h1>Guides et astuces SpinBet Casino</h1>
<p class="lead">Classements, conseils et explications pour mieux profiter des jeux de casino gratuits.</p>
{''.join(f'<div class="rank" style="grid-template-columns:1fr"><div><h3><a href="/articles/{a["slug"]}.html">{esc(a["title"])}</a></h3><p>{esc(a["desc"])}</p></div></div>' for a in ARTICLES)}"""
emit('articles/index.html', page('articles/', 'Guides et astuces : machines à sous, roulette, blackjack gratuits | SpinBet Casino',
                                         'Les guides de SpinBet Casino : meilleures machines à sous gratuites 2026, roulette et blackjack gratuits, jeux crash et mines, RTP et volatilité expliqués.', intro,
                                         {'@context': 'https://schema.org', '@type': 'CollectionPage', 'name': 'Guides SpinBet Casino', 'url': f'{SITE}/articles/'}))

# ---- share pages j/<id>.html: what the site's « Partager » buttons send (WhatsApp, Snap, Discord, X…). The apps read
# their tags and show the game's big picture (assets/share/<id>.jpg, tools/seo/share-images.js); a person is sent
# straight into the game, with the link's ?ref= (referral) and ?src= (where the visit comes from). noindex: Google
# keeps the jeux/ pages.
share_dir = root / 'j'
share_dir.mkdir(exist_ok=True)
for old_page in share_dir.glob('*.html'):
    old_page.unlink()
for g in [{'id': x['id'], 'name': x['name'], 'cat': x['cat'], 'sub': x.get('sub', '')} for x in games]:
    img = f'/assets/share/{g["id"]}.jpg' if (root / f'assets/share/{g["id"]}.jpg').exists() else '/assets/og.jpg'
    t = f"🎰 {g['name']} · joue gratuitement sur SpinBet Casino"
    d = f"{cap(kw_of(g))} : {plain(g['sub'])}. Sans téléchargement, en argent fictif. 18+"
    (share_dir / f'{g["id"]}.html').write_text(f"""<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(t)}</title>
<meta name="robots" content="noindex, follow">
<meta name="description" content="{esc(d)}">
<meta property="og:type" content="website"><meta property="og:site_name" content="SpinBet Casino"><meta property="og:locale" content="fr_FR">
<meta property="og:title" content="{esc(t)}"><meta property="og:description" content="{esc(d)}">
<meta property="og:url" content="{SITE}/j/{g['id']}.html">
<meta property="og:image" content="{SITE}{img}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="{esc(g['name'])}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="{SITE}{img}">
<meta name="theme-color" content="#0b0f17">
<script>location.replace('/' + location.search + '#game-{g['id']}');</script>
<noscript><meta http-equiv="refresh" content="0;url=/#game-{g['id']}"></noscript>
</head>
<body style="background:#0b0f17;color:#fff;font:16px system-ui,sans-serif;text-align:center;padding:40px">
<p><a style="color:#7cc8ff" href="/#game-{g['id']}">Jouer à {esc(g['name'])}</a></p>
</body>
</html>
""", encoding='utf8')

# ---- the home page (index.html): a block of real links in its footer, for Google (it does not follow #game-…) ----
groups = [('Machines à sous gratuites', [g for g in games if g['cat'] == 'slot']),
          ('Roulette, blackjack, poker et roues', [g for g in games if g['cat'] == 'table' and not g['id'].endswith('-online')]),
          ('Tables multijoueurs', [g for g in games if g['id'].endswith('-online')]),
          ('Jeux rapides gratuits', [g for g in games if g['cat'] == 'quick'])]
foot = ('<section class="seo-foot" aria-label="Tous les jeux de SpinBet Casino"><p><b>SpinBet Casino</b>, casino gratuit en ligne : '
        f'{len(games)} jeux de casino gratuits sans téléchargement ni dépôt, en argent fictif (KE). Machines à sous avec bonus et jackpots, '
        'roulettes, blackjack, poker Texas Hold’em, roues de la fortune, tables multijoueurs et jeux rapides (mines, crash, plinko), '
        'sur téléphone comme sur ordinateur. Aucun vrai pari, aucun gain réel.</p><div class="seo-cols">'
        + ''.join(f'<div><b>{esc(h)}</b>' + ''.join(f'<a href="jeux/{g["id"]}.html">{esc(g["name"])}</a>' for g in l) + '</div>' for h, l in groups if l)
        + '<div><b>Guides et astuces</b>' + ''.join(f'<a href="articles/{a["slug"]}.html">{esc(a["title"])}</a>' for a in ARTICLES) + '</div></div></section>')
ix = root / 'index.html'
src2 = ix.read_text(encoding='utf8')
a0, a1 = '<!-- seo-links (fabriqué par tools/seo.py : ne pas modifier à la main) -->', '<!-- /seo-links -->'
if a0 in src2 and a1 in src2:
    new = src2[:src2.index(a0) + len(a0)] + foot + src2[src2.index(a1):]
    if new != src2:
        ix.write_text(new, encoding='utf8')

# ---- sitemap.xml + robots.txt ----
# the home page's date follows its own content (index.html), the others the stamp of their file
stamp('index.html', (root / 'index.html').read_text(encoding='utf8'))
pages = [('index.html', '', '1.0', 'daily', []), ('jeux/index.html', 'jeux/', '0.9', 'weekly', []), ('articles/index.html', 'articles/', '0.8', 'weekly', [])]
pages += [(f'articles/{a["slug"]}.html', f'articles/{a["slug"]}.html', '0.8', 'monthly', []) for a in ARTICLES]
pages += [(f'jeux/{g["id"]}.html', f'jeux/{g["id"]}.html', '0.8', 'weekly', [cover(g)] + shots(g)) for g in games]
urls = [(f'{SITE}/{u}', p, f) for _, u, p, f, _ in pages]
img = lambda l: ''.join(f'<image:image><image:loc>{SITE}{x}</image:loc></image:image>' for x in l if x.startswith('/'))
xml = ('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n'
       + ''.join(f'  <url><loc>{SITE}/{u}</loc><lastmod>{LM[rel]["d"]}</lastmod><changefreq>{f}</changefreq><priority>{p}</priority>{img(im)}</url>\n' for rel, u, p, f, im in pages)
       + '</urlset>\n')
LM_FILE.write_text(json.dumps(dict(sorted(LM.items())), ensure_ascii=False, indent=0) + '\n', encoding='utf8')
(root / 'sitemap.xml').write_text(xml, encoding='utf8')
(root / 'sitemap.txt').write_text(''.join(f'{u}\n' for u, _, _ in urls), encoding='utf8')  # the same list, one address per line
(root / 'robots.txt').write_text(f'User-agent: *\nAllow: /\nDisallow: /dist/\n\nSitemap: {SITE}/sitemap.xml\nSitemap: {SITE}/sitemap.txt\n', encoding='utf8')
print(f'SEO : {len(games)} pages de jeux, {len(ARTICLES)} guides (articles/), jeux/index.html, sitemap.xml + sitemap.txt ({len(urls)} adresses), robots.txt')
