#!/usr/bin/env python3
# Découpe la planche de symboles du propriétaire (tools/art/pirates/planche.webp, 5 × 5 cases en bois avec leur nom
# écrit dessous) : chaque cadre en bois entier, plus ce qui dépasse au-dessus (têtes, plumes…), sans le texte ni la
# plage autour. Les symboles du jeu vont dans assets/games/pirates/, les autres dans tools/art/pirates/extra/.
#   pip install "rembg[cpu]"  puis  python3 tools/art/pirates/cut.py
import os
from PIL import Image, ImageDraw, ImageFilter
from rembg import remove, new_session
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(HERE, '../../..')
im = Image.open(os.path.join(HERE, 'planche.webp')).convert('RGB')
COLS = [(80, 228), (260, 409), (439, 586), (616, 764), (795, 944)]
ROWS = [(14, 62, 133), (150, 159, 227), (243, 254, 320), (337, 349, 412), (430, 445, 515)]  # haut de la découpe, haut du cadre, bas (avant le texte)
NAMES = [['s6', 's5', 's4', 'tiki', 'macaw'], ['chest', 'map', 'mask', 'compass', 'cannon'], ['s0', 's1', 's3', 's2', 'cash'],
         ['scat', 'wild', 'crown', 'lei', 'bottle'], ['coll', 'safe', 'bomb', 'fschest', 'star']]
USED = {'s0', 's1', 's2', 's3', 's4', 's5', 's6', 'wild', 'scat', 'cash', 'coll', 'safe', 'bomb'}
K = 3; sess = new_session('isnet-general-use')
os.makedirs(os.path.join(HERE, 'extra'), exist_ok=True)
for r, (ct, ft, fb) in enumerate(ROWS):
    for c, (x0, x1) in enumerate(COLS):
        X0, X1 = x0 - 6, x1 + 6
        t = im.crop((X0, ct, X1, fb)).resize(((X1 - X0) * K, (fb - ct) * K), Image.LANCZOS)
        fg = remove(t, session=sess, only_mask=True).convert('L').point(lambda v: 255 if v > 110 else 0)
        m = Image.new('L', t.size, 0)
        ImageDraw.Draw(m).rounded_rectangle([(x0 - X0 + 1) * K, (ft - ct) * K, (x1 - X0 - 1) * K, t.height - 1], radius=11 * K, fill=255)
        above = (ft - ct + 3) * K
        m.paste(255, (0, 0, t.width, above), fg.crop((0, 0, t.width, above)))
        m = m.filter(ImageFilter.GaussianBlur(1.0))
        o = t.convert('RGBA'); o.putalpha(m); o = o.crop(o.getbbox()); o.thumbnail((420, 420), Image.LANCZOS)
        n = NAMES[r][c]
        o.save(os.path.join(ROOT, 'assets/games/pirates', f'{n}.webp') if n in USED else os.path.join(HERE, 'extra', f'{n}.webp'), quality=88)
print('ok')
