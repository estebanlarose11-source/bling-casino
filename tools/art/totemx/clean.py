# Le Totem Extrême: the owner's 2 animated decors of 16 November 2026 (fond-large.mp4 672 × 448 for computers,
# fond-haut.mp4 448 × 672 for phones held upright: the temple, MINI / MAJOR / GRAND JACKPOT, a loading bar that fills
# gold, turns red, then catches fire, a 5 × 4 grid, the bar). Not a loop: the game drives the video itself (the bar
# grows with the totem, the fire = FULL SCREEN; FULL / FIRE frames in games/totemx.js). Erased on every frame: the painted
# grid (the game has 6 × 5 cells), the words and amounts of the jackpot plates (no jackpot: we write SOLDE, TOTEM, GAIN)
# and the bet « $1.00 ». Written ×2 with a keyframe every 4 images (the game jumps in the video).
#   python3 tools/art/totemx/clean.py   (pip install opencv-python-headless numpy pillow; needs ffmpeg)
import os, sys
import numpy as np
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from videobg import read, write, mend, box, grow, gold, lum

HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, '../../../assets/games/totemx')


def lattice(s, xs, ys, win, h=6):
    x0, y0, x1, y1 = win
    m = np.zeros(s[:2], bool)
    for x in xs: m |= box(s, x - h, y0, x + h + 1, y1)
    for y in ys: m |= box(s, x0, y - h, x1, y + h + 1)
    return m


JOBS = {
    'haut': {'lines': ([129, 193, 256, 320], [283, 349, 416], (66, 214, 384, 474)),
             'txt': [(62, 68, 152, 90), (162, 60, 286, 84), (296, 68, 394, 90), (78, 556, 138, 588)]},
    'large': {'lines': ([179, 282, 388, 492], [182, 239, 296], (78, 128, 595, 349)),
              'txt': [(84, 16, 214, 44), (108, 60, 190, 86), (246, 26, 430, 58), (282, 54, 392, 82), (456, 16, 594, 44), (476, 60, 574, 86), (54, 404, 112, 430)]},
}
for name, J in JOBS.items():
    fr = read(os.path.join(HERE, f'fond-{name}.mp4'))
    mean = fr[:40].mean(0).astype(np.uint8)
    s = mean.shape
    lines = lattice(s, *J['lines'])
    txt = np.zeros(s[:2], bool)
    for b in J['txt']: txt |= box(s, *b)
    txt = grow(txt & (gold(mean) > 18) & (lum(mean) > 70), 2)
    fr = np.stack([mend(mend(f, lines, 4, 1.4), txt, 4, 1.6) for f in fr])
    write(fr, os.path.join(OUT, f'fond-{name}.mp4'), os.path.join(OUT, f'scene-{name}.webp'), 24, 4)
    print(name, len(fr), 'frames')
