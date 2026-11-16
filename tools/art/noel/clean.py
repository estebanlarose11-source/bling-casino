# La Tournée du Père Noël: the owner's 2 animated decors of 16 November 2026 (fond-large.mp4 672 × 448 for computers,
# fond-haut.mp4 448 × 672 for phones held upright: the snowy arch, the Santas, MINI / MAJOR / GRAND JACKPOT plates, white
# 5 × 6 grid, red and green bar) -> assets/games/noel/fond-large.mp4 / fond-haut.mp4 (×2, seamless loop) + scene-*.webp.
# Erased on every frame: the 5 painted rows of the grid (the game has 7 rows: only the 5 columns stay), the painted
# jackpot amounts « $500.00 … » (the game writes MINI / MAXI / GRAND in KE) and the bet « $1.00 ».
#   python3 tools/art/noel/clean.py   (pip install opencv-python-headless numpy pillow; needs ffmpeg)
import os, sys
import numpy as np
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from videobg import make, mend, box, grow, lum

HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, '../../../assets/games/noel')


def rows(s, ys, x0, x1, h=4):
    m = np.zeros(s[:2], bool)
    for y in ys: m |= box(s, x0, y - h, x1, y + h + 1)
    return m


def cleaner_tall(mean):
    s = mean.shape
    lines = rows(s, [220, 287, 353, 419, 485], 50, 400)
    txt = grow((box(s, 56, 106, 146, 140) | box(s, 166, 104, 282, 142) | box(s, 298, 106, 404, 140) | box(s, 48, 594, 142, 634)) & (lum(mean) > 150), 2)
    return lambda f: mend(mend(f, lines, 4, 1.4), txt, 4, 1.6)


def cleaner_large(mean):
    s = mean.shape
    lines = rows(s, [115, 164, 212, 261, 309], 122, 558, 3)
    txt = grow(box(s, 80, 392, 144, 424) & (lum(mean) > 150), 2)
    return lambda f: mend(mend(f, lines, 4, 1.4), txt, 4, 1.6)


make(os.path.join(HERE, 'fond-haut.mp4'), OUT, 'haut', cleaner_tall)
make(os.path.join(HERE, 'fond-large.mp4'), OUT, 'large', cleaner_large)
