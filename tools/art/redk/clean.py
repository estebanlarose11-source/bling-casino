# Diamants REDK: the owner's 2 animated backgrounds of 15 November 2026 (fond-large.mp4 672 × 448 for computers and
# wide screens, fond-haut.mp4 448 × 672 for phones held upright: a diamond mine, MINI / MAJOR / GRAND JACKPOT plates, a
# jewelled frame with its 5 × 3 cells, mine carts full of gems rolling by) -> assets/games/redk/fond-large.mp4 /
# fond-haut.mp4 (×2, silent, seamless loop) + their first frame as posters (scene-large.webp / scene-haut.webp).
# Cleaned on every frame: the bet "$1.00" (the game writes the bet in KE). The painted cells stay: the reels sit on them.
# python3 tools/art/redk/clean.py   (pip install opencv-python-headless numpy pillow; needs ffmpeg)
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from videobg import make, mend, box, grow, gold, lum

HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, '../../../assets/games/redk')


def cleaner_large(mean):
    bet = grow(box(mean.shape, 118, 378, 190, 418) & (gold(mean) > 20) & (lum(mean) > 90), 2)   # "$1.00", gold on purple
    return lambda f: mend(f, bet, 4, 1.6)


def cleaner_tall(mean):
    bet = grow(box(mean.shape, 52, 585, 122, 618) & (lum(mean) > 120), 1)                      # "$1.00", white
    return lambda f: mend(f, bet, 4, 1.6)


make(os.path.join(HERE, 'fond-large.mp4'), OUT, 'large', cleaner_large)
make(os.path.join(HERE, 'fond-haut.mp4'), OUT, 'haut', cleaner_tall)
