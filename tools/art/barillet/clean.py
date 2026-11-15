# La Roulette Russe: the owner's 2 animated backgrounds of 15 November 2026 (fond-large.mp4 672 × 448 for computers and
# wide screens, fond-haut.mp4 448 × 672 for phones held upright: the saloon, the cowboy at the bar, the lantern, MINI /
# MAJOR / GRAND plates, a wooden frame with painted cells, a bar BET / BONUS MENU / SPIN / MAX BET and a revolver)
# -> assets/games/barillet/fond-large.mp4 / fond-haut.mp4 (×2, silent, seamless loop) + their first frame as posters
# (scene-large.webp / scene-haut.webp).
# Cleaned on every frame: the bet "$1.00", the jackpot words and amounts (the game has no jackpot: it writes its own
# plates, SOLDE / BARILLET / GAIN, on them) and "HOLD FOR AUTO" (the game writes it in French).
# python3 tools/art/barillet/clean.py   (pip install opencv-python-headless numpy pillow; needs ffmpeg)
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from videobg import make, mend, box, grow, lum

HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, '../../../assets/games/barillet')


def paint(mean, boxes, t):
    m = None
    for b in boxes:
        k = box(mean.shape, *b) & (lum(mean) > t)
        m = k if m is None else m | k
    return grow(m, 1)


def cleaner_large(mean):
    words = paint(mean, [(100, 2, 166, 27), (288, 2, 382, 27), (484, 2, 578, 27)], 105)          # MINI, MAJOR, GRAND
    sums = paint(mean, [(94, 29, 176, 56), (280, 28, 392, 58), (476, 29, 592, 56)], 80)          # $50.00, $250.00, $2,500.00
    bet = paint(mean, [(32, 400, 102, 428)], 80)                                                   # $1.00
    hold = paint(mean, [(280, 409, 392, 429)], 85)                                                 # HOLD FOR AUTO
    m = words | sums | bet | hold
    return lambda f: mend(f, m, 4, 1.6)


def cleaner_tall(mean):
    words = paint(mean, [(48, 24, 146, 72), (174, 24, 274, 72), (302, 24, 402, 72)], 95)          # MINI / MAJOR / GRAND JACKPOT
    bet = paint(mean, [(40, 584, 92, 612)], 95)                                                    # $1.00
    m = words | bet
    return lambda f: mend(f, m, 4, 1.6)


make(os.path.join(HERE, 'fond-large.mp4'), OUT, 'large', cleaner_large)
make(os.path.join(HERE, 'fond-haut.mp4'), OUT, 'haut', cleaner_tall)
