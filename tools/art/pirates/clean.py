# Le Coffre aux Pirates: the owner's decor of 16 November 2026 -> assets/games/pirates/
#   fond-haut.mp4 (448 × 672, phones held upright: the little pirate on the ship's rail, the lantern, 5 painted columns)
#     -> fond-haut.mp4 (×2, seamless loop) + scene-haut.webp; erased: « x1 » of MULTIPLICATEUR (we write the
#     multiplier) and the bet « 10,00 » (the game writes it in KE)
#   decor-large.jpg (1168 × 784, computers): the captain, the storm, a 5 × 3 grid -> scene-large.webp; the painted rows are
#     merged into 5 columns (the game has 4 rows), « x1 » and « 10,00 » erased
#   python3 tools/art/pirates/clean.py   (pip install opencv-python-headless numpy pillow; needs ffmpeg)
import os, sys
import numpy as np, cv2
from PIL import Image
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from videobg import make, mend, box, grow, lum, disc

HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, '../../../assets/games/pirates')


def cleaner_tall(mean):
    s = mean.shape
    txt = grow((box(s, 192, 60, 252, 88) | box(s, 208, 594, 274, 630)) & (lum(mean) > 110), 2)
    return lambda f: mend(f, txt, 4, 1.6)


if '--image' not in sys.argv: make(os.path.join(HERE, 'fond-haut.mp4'), OUT, 'haut', cleaner_tall)

a = np.asarray(Image.open(os.path.join(HERE, 'decor-large.jpg')).convert('RGB')).copy()
a = mend(a, grow((box(a.shape, 762, 22, 826, 82) | box(a.shape, 566, 652, 704, 716)) & (lum(a) > 110), 3), 6, 2.5)
# 5 columns from the 3 rows: each column takes the navy cloth of its middle cell, stretched, with a thin gold edge
COLS = [(252, 385), (398, 532), (545, 680), (693, 828), (840, 968)]
y0, y1 = 112, 572
orig = a.copy()
for (x0, x1) in COLS:
    src = a[290:400, x0 + 14:x1 - 14].astype(np.float32)
    cloth = cv2.resize(src, (x1 - x0 - 4, y1 - y0 - 4), interpolation=cv2.INTER_CUBIC)
    cloth = cv2.GaussianBlur(cloth, (0, 0), 1.2)
    a[y0 + 2:y1 - 2, x0 + 2:x1 - 2] = cloth.clip(0, 255).astype(np.uint8)
    cv2.rectangle(a, (x0 + 2, y0 + 2), (x1 - 3, y1 - 3), (176, 134, 62), 2, cv2.LINE_AA)
keep = disc(a.shape, 970, 648, 106) | box(a.shape, 958, 380, 1004, 540)  # the ship's wheel and the anchor stay in front
a[keep] = orig[keep]
Image.fromarray(a).save(os.path.join(OUT, 'scene-large.webp'), quality=86, method=6)
print('ok')
