"""Les 3 barres violettes « RELANCES » du bonus Jugement, figées (demande du propriétaire du 17 novembre 2026).

Dans sa vidéo de la salle des bonus, les barres s'allument puis s'éteignent toutes seules en boucle. Le jeu les couvre
avec une image fixe : en haut les 3 barres allumées, en bas les 3 éteintes (bande `.jbars` de la vidéo, mêmes % que le
CSS « L'Anubis »). → assets/games/anubis/bars-large.webp / bars-haut.webp
"""
import subprocess, tempfile, os
from PIL import Image

A = os.path.join(os.path.dirname(__file__), '../../../assets/games/anubis')
# vidéo, boîte de .jbars en % (gauche, haut, largeur, hauteur), instant barres allumées, instant barres éteintes
SPEC = {'large': (17.56, 82.14, 64.58, 4.91, 2.0, 0.0), 'haut': (8.93, 87.20, 82.14, 3.57, 2.0, 0.0)}


def frame(src, t):
    with tempfile.TemporaryDirectory() as d:
        p = os.path.join(d, 'f.png')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(t), '-i', src, '-frames:v', '1', p], check=True)
        return Image.open(p).convert('RGB')


for name, (L, T, W, H, on, off) in SPEC.items():
    src = os.path.join(A, f'bonus-{name}.mp4')
    box = None
    rows = []
    for t in (on, off):
        im = frame(src, t)
        iw, ih = im.size
        box = (round(L / 100 * iw), round(T / 100 * ih), round((L + W) / 100 * iw), round((T + H) / 100 * ih))
        rows.append(im.crop(box))
    out = Image.new('RGB', (rows[0].width, rows[0].height * 2))
    out.paste(rows[0], (0, 0)); out.paste(rows[1], (0, rows[0].height))
    out.save(os.path.join(A, f'bars-{name}.webp'), quality=90)
    print(name, out.size)
