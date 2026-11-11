#!/usr/bin/env python3
"""Le Valhalla : symboles découpés dans la planche du propriétaire (`viking-planche.jpg`, 11 novembre 2026).

Chaque dessin est coupé large, détouré (rembg, modèle isnet-general-use : fond rendu transparent), recadré au plus
juste puis rangé dans assets/games/viking/ :
  s0…s3 = J Q K A, s4 corne, s5 marteau, s6 casque, s7 chope, s8 guerrière rousse, s9 corbeaux, s10 viking qui crie,
  wild = la valkyrie (cadre entier, pour les côtés), scat = le vieux viking (cadre entier),
  wild-c / scat-c = leur portrait seul (tête et épaules, pour les cases).

    pip install "rembg[cpu]" && python3 tools/art/viking.py   (puis changer IMG_V dans games/viking.js et CACHE dans sw.js)
"""
import os
from PIL import Image
from rembg import remove, new_session

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', 'assets', 'games', 'viking')
SRC = Image.open(os.path.join(HERE, 'viking-planche.jpg')).convert('RGB')

# name: (box on the sheet, cut out?, output size)
BOXES = {
    's0': ((150, 130, 315, 355), True, 256), 's1': ((385, 130, 555, 355), True, 256),
    's2': ((645, 130, 805, 355), True, 256), 's3': ((885, 130, 1045, 355), True, 256),
    's4': ((80, 400, 345, 660), True, 256), 's5': ((355, 400, 620, 660), True, 256),
    's6': ((620, 395, 890, 660), True, 256), 's7': ((895, 395, 1140, 660), True, 256),
    's8': ((785, 705, 1110, 1040), 'circle', 300), 's9': ((435, 705, 760, 1040), 'circle', 300),
    's10': ((85, 705, 410, 1040), 'circle', 300),
    'wild': ((207, 1100, 557, 1795), 'rect', 600), 'scat': ((615, 1100, 967, 1795), 'rect', 600),
}
session = new_session('isnet-general-use')


def trim(im):
    bb = im.getchannel('A').point(lambda a: 255 if a > 24 else 0).getbbox()
    return im.crop(bb) if bb else im


def fit(im, size):
    im.thumbnail((size, size), Image.LANCZOS)
    return im


for name, (box, mode, size) in BOXES.items():
    crop = SRC.crop(box)
    if mode == 'circle':
        # the round medallions: a clean disc (no AI needed)
        from PIL import ImageDraw
        w, h = crop.size
        big = crop.resize((w * 4, h * 4), Image.LANCZOS)
        m = Image.new('L', big.size, 0)
        ImageDraw.Draw(m).ellipse((10, 10, big.width - 10, big.height - 10), fill=255)
        m = m.resize((w, h), Image.LANCZOS)
        out = crop.convert('RGBA'); out.putalpha(m)
        # rembg on top keeps the spikes of the rim that stick out of the disc
        cut = remove(crop, session=session)
        a = Image.fromarray(__import__('numpy').maximum(__import__('numpy').asarray(m), __import__('numpy').asarray(cut.getchannel('A'))))
        out.putalpha(a)
    elif mode == 'rect':
        out = crop.convert('RGBA')  # the tall frames: kept whole (the cut-out ate the frame)
    else:
        out = remove(crop, session=session)
    out = fit(trim(out), size)
    out.save(os.path.join(OUT, f'{name}.webp'), quality=90, method=6)
    print(name, out.size)

# portraits for the cells: head and shoulders inside the frames
for name, box in {'wild-c': (240, 1150, 525, 1470), 'scat-c': (650, 1150, 935, 1470)}.items():
    im = SRC.crop(box).resize((300, int(300 * (box[3] - box[1]) / (box[2] - box[0]))), Image.LANCZOS)
    im.save(os.path.join(OUT, f'{name}.webp'), quality=90, method=6)
    print(name, im.size)

# the cover: the snowy village of the sheet (blurred, darker) with the valkyrie and the Jarl side by side
from PIL import ImageFilter, ImageEnhance
bg = SRC.crop((0, 1000, 1200, 1901)).resize((1000, 750), Image.LANCZOS).crop((125, 0, 875, 750)).resize((600, 600), Image.LANCZOS)
bg = ImageEnhance.Brightness(bg.filter(ImageFilter.GaussianBlur(6))).enhance(0.55).convert('RGBA')
for name, x, rot in (('wild', 70, 6), ('scat', 300, -6)):
    fr = Image.open(os.path.join(OUT, f'{name}.webp')).convert('RGBA')
    fr = fr.resize((230, 457), Image.LANCZOS).rotate(rot, expand=True, resample=Image.BICUBIC)
    bg.alpha_composite(fr, (x, 30))
bg.convert('RGB').save(os.path.join(OUT, 'cover.webp'), quality=88, method=6)
print('cover', bg.size)
