# L'Hydre: the owner's 2 animated backgrounds of 15 November 2026 (fond-large.mp4 672 × 448 for computers and wide
# screens, fond-haut.mp4 448 × 672 for phones held upright: the dragons' lair, MINI / MAJOR / GRAND JACKPOT plates, a
# dragon-scale frame with 3 × 3 painted cells, a red dragon, fire and lava) -> assets/games/dragons/fond-large.mp4 /
# fond-haut.mp4 (×2, silent, seamless loop) + their first frame as posters (scene-large.webp / scene-haut.webp).
# Cleaned on every frame: the bet "$1.00" (the game writes the bet in KE). The 9 painted cells stay: each one holds a
# pair of half-heads (3 pairs × 3 rows).
# python3 tools/art/dragons/clean.py   (pip install opencv-python-headless numpy pillow; needs ffmpeg)
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from videobg import make, mend, box, grow, lum

HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, '../../../assets/games/dragons')


def cleaner_large(mean):
    bet = grow(box(mean.shape, 44, 368, 104, 394) & (lum(mean) > 110), 1)   # "$1.00", gold
    return lambda f: mend(f, bet, 4, 1.6)


def cleaner_tall(mean):
    bet = grow(box(mean.shape, 50, 476, 116, 508) & (lum(mean) > 120), 1)   # "$1.00", white
    return lambda f: mend(f, bet, 4, 1.6)


make(os.path.join(HERE, 'fond-large.mp4'), OUT, 'large', cleaner_large)
make(os.path.join(HERE, 'fond-haut.mp4'), OUT, 'haut', cleaner_tall)
