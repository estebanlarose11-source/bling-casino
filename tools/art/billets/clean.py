# Le Coffre-Fort: the owner's 2 pictures of 16 November 2026 (decor-large.jpg 1168 × 784 for computers, decor-haut.jpg
# 784 × 1168 for phones held upright: neon frame, MINOR / MAJOR / JACKPOT plates, bills flying) -> assets/games/billets/
# scene-large.webp / scene-haut.webp. Erased: the painted cells of the window (the game draws its 5 × 3 reels there), the
# painted bet « $ 2.50 » / « 25.00 » and, on the phone, « BALANCE 2,450.00 · TOTAL BET 25.00 · WIN 0.00 » (our plates).
#   python3 tools/art/billets/clean.py   (pip install opencv-python-headless numpy pillow)
import os, sys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from videobg import mend, box, grow, lum

HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, '../../../assets/games/billets')
JOBS = {
    'large': {'win': (176, 226, 992, 525), 'txt': [(418, 601, 532, 640, 110)]},
    'haut': {'win': (118, 344, 666, 742), 'txt': [(322, 916, 458, 965, 110), (26, 1094, 762, 1140, 80)]},
}
for name, J in JOBS.items():
    a = np.asarray(Image.open(os.path.join(HERE, f'decor-{name}.jpg')).convert('RGB')).copy()
    for (x0, y0, x1, y1, t) in J['txt']:
        a = mend(a, grow(box(a.shape, x0, y0, x1, y1) & (lum(a) > t), 3), 6, 2.5)
    x0, y0, x1, y1 = J['win']                       # the window: one dark glass, faintly lit in the middle
    h, w = y1 - y0, x1 - x0
    yy, xx = np.mgrid[:h, :w]
    d = np.sqrt(((xx - w / 2) / (w / 2)) ** 2 + ((yy - h / 2) / (h / 2)) ** 2)
    glow = np.clip(1 - d, 0, 1)[..., None]
    a[y0:y1, x0:x1] = (np.array([8, 4, 16]) * (1 - glow) + np.array([26, 10, 44]) * glow).astype(np.uint8)
    Image.fromarray(a).save(os.path.join(OUT, f'scene-{name}.webp'), quality=86, method=6)
print('ok')
