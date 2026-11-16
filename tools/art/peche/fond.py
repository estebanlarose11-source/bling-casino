#!/usr/bin/env python3
# La Pêche, le décor derrière la roue (demande du propriétaire du 16 novembre 2026) : ses 2 vidéos d'un lac gelé sous la neige
# (fond-large.mp4 736 × 400 : ordinateur ; fond-haut.mp4 400 × 736 : téléphone tenu droit) → boucles sans coupure, muettes, ×2
# (assets/games/peche/fond-*.mp4 + scene-*.webp, LOOP dans games/peche.js) ; et la roue en verre détourée (roue.webp avait son fond
# bleu nuit) → assets/games/peche/roue-cut.webp : seulement le disque et son bord (le pointeur est dans roue-top.webp).
# python3 tools/art/peche/fond.py
import os, sys
import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'tools', 'art'))
import videobg as vb  # noqa: E402

OUT = os.path.join(ROOT, 'assets', 'games', 'peche')




def main():
    for name in ('large', 'haut'):
        vb.make(os.path.join(HERE, f'fond-{name}.mp4'), OUT, name, lambda mean: (lambda f: f), crf=33)
    im = Image.open(os.path.join(OUT, 'roue.webp')).convert('RGBA')
    W, H = im.size
    # the wheel of the game: centre (50 %, 51.17 %) of the scene, the disc 88.39 % of its width, the rim around it
    cx, cy, r = W * 0.5, H * 0.5117, W * 0.497
    yy, xx = np.mgrid[:H, :W]
    d = np.hypot(xx - cx, yy - cy)
    a = np.clip((r - d) / 3 + 0.5, 0, 1)
    al = Image.fromarray((a * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))
    im.putalpha(al)
    im.save(os.path.join(OUT, 'roue-cut.webp'), quality=88, method=6)
    print('ok')


if __name__ == '__main__':
    main()
