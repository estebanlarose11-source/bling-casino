# Le Loup: the owner's 2 animated backgrounds of 16 November 2026 (fond-large.mp4 672 × 448 for computers and wide screens,
# fond-haut.mp4 448 × 672 for phones held upright: a dark forest under the full moon, a frame of branches with 5 × 3 painted
# cells, the wolf watching, a bar BET / SPIN / BONUS) -> assets/games/wolf/fond-large.mp4 / fond-haut.mp4 (×2, silent,
# seamless loop) + their first frame as posters (scene-large.webp / scene-haut.webp).
# Cleaned on every frame: the painted bets « $2.00 » / « 10.00 » (the game writes the bet in KE), and on the phone the
# painted title (the name of another game: our plates for the jackpots go there) and « 2,450.00 TOTAL BALANCE » (we write
# SOLDE and GAIN on that plate).
# python3 tools/art/wolf/clean.py   (pip install opencv-python-headless numpy pillow; needs ffmpeg)
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from videobg import make, mend, box, grow, lum

HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, '../../../assets/games/wolf')


def cleaner_large(mean):
    s = mean.shape
    bet = grow(box(s, 98, 368, 184, 412) & (lum(mean) > 105), 2)       # "$2.00"
    return lambda f: mend(f, bet, 4, 1.6)


def cleaner_tall(mean):
    s = mean.shape; L = lum(mean)
    title = grow(box(s, 70, 12, 258, 70) & (L > 85), 2)               # "BIG BAD WOLF / THREE LITTLE PIGS"
    plate = grow(box(s, 320, 20, 437, 65) & (L > 60), 2)              # coin, "2,450.00", "TOTAL BALANCE"
    bet = grow(box(s, 50, 565, 101, 601) & (L > 105), 2)              # "10.00"
    return lambda f: mend(mend(mend(f, title, 5, 1.8), plate, 5, 2.2), bet, 4, 1.6)


make(os.path.join(HERE, 'fond-large.mp4'), OUT, 'large', cleaner_large)
make(os.path.join(HERE, 'fond-haut.mp4'), OUT, 'haut', cleaner_tall)
