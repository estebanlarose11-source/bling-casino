# L'Anubis: the owner's 4 animated backgrounds of 15 November 2026: the temple of the base game (fond-large.mp4 672 × 448
# for computers and wide screens, fond-haut.mp4 448 × 672 for phones held upright: Anubis statues, MINI / MAJOR / GRAND
# JACKPOT, a 5 × 6 grid of painted cells, a bar BET − / + · BONUS MENU · SPIN · MAX BET) and the hall of the Judgment
# (bonus-large.mp4 / bonus-haut.mp4: 5 painted cells on top for the column multipliers, the 5 × 6 grid, 3 purple bars
# LIVES = the respins). -> assets/games/anubis/<name>.mp4 (×2, silent, seamless loop) + scene-<name>.webp posters.
# Cleaned on every frame: the jackpot words (the game has no jackpot: it writes SOLDE / MULTIPLICATEUR / GAIN there),
# the bet "$1.00" and the word LIVES (the game writes RELANCES).
# python3 tools/art/anubis/clean.py   (pip install opencv-python-headless numpy pillow; needs ffmpeg)
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from videobg import make, mend, box, grow, lum

HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, '../../../assets/games/anubis')


def paint(mean, boxes, t):
    m = None
    for b in boxes:
        k = box(mean.shape, *b) & (lum(mean) > t)
        m = k if m is None else m | k
    return grow(m, 1)


def cleaner(boxes, t=95):
    def run(mean):
        m = paint(mean, boxes, t)
        return lambda f: mend(f, m, 4, 1.6)
    return run


def save(src, name, fn):
    make(os.path.join(HERE, src), OUT, name, fn)
    # make() names the video fond-<name>.mp4: the bonus ones are bonus-large.mp4 / bonus-haut.mp4 (posters scene-bonus-*.webp)
    if name.startswith('bonus'):
        os.replace(os.path.join(OUT, f'fond-{name}.mp4'), os.path.join(OUT, f'{name}.mp4'))


save('fond-large.mp4', 'large', cleaner([(44, 28, 182, 60), (228, 20, 444, 62), (472, 28, 624, 60), (118, 366, 198, 391)], 58))
save('fond-haut.mp4', 'haut', cleaner([(54, 38, 150, 102), (168, 40, 282, 98), (302, 40, 392, 98), (52, 590, 116, 622)], 90))
save('bonus-large.mp4', 'bonus-large', cleaner([(262, 390, 372, 410)], 55))
save('bonus-haut.mp4', 'bonus-haut', cleaner([(180, 612, 268, 638)], 55))
