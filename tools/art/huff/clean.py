# Le Loup 2.0: the owner's 2 animated backgrounds of 15 November 2026 (fond-large.mp4 672 × 448 for computers and wide
# screens, fond-haut.mp4 448 × 672 for phones held upright: the pigs' brick house with its MINI / MAJOR / GRAND JACKPOT
# plates, a starry window, lights, pigs and the wolf) -> assets/games/huff/fond-large.mp4 / fond-haut.mp4 (×2, silent,
# seamless loop) + their first frame as posters (scene-large.webp / scene-haut.webp).
# Cleaned on every frame: the bet "$1.00" (the game writes the bet in KE) and, on the phone, the painted grid of the window
# (the game draws its 5 × 3 reels there).
# python3 tools/art/huff/clean.py   (pip install opencv-python-headless numpy pillow; needs ffmpeg)
import os, sys
import numpy as np
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from videobg import make, mend, box, grow, lum

HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, '../../../assets/games/huff')


def cleaner_large(mean):
    s = mean.shape
    bet = grow(box(s, 48, 386, 120, 422) & (lum(mean) > 120), 2)       # "$1.00"
    return lambda f: mend(f, bet, 4, 1.6)


def cleaner_tall(mean):
    s = mean.shape
    win = box(s, 106, 214, 340, 462)
    lines = np.zeros(s[:2], bool)
    for x in (154, 200.5, 247.5, 294.5): lines |= box(s, int(x - 3), 0, int(x + 4), s[0])
    for y in (285.5, 345.5, 404.5): lines |= box(s, 0, int(y - 3), s[1], int(y + 4))
    lines &= win                                                       # the painted grid of the window
    bet = grow(box(s, 40, 582, 112, 620) & (lum(mean) > 120), 2)       # "$1.00"
    return lambda f: mend(mend(f, lines, 3, 1.0), bet, 4, 1.6)


make(os.path.join(HERE, 'fond-large.mp4'), OUT, 'large', cleaner_large)
make(os.path.join(HERE, 'fond-haut.mp4'), OUT, 'haut', cleaner_tall)
