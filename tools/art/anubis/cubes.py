# L'Anubis, Judgment: the owner's 5 cubes of 15 November 2026 (tools/art/anubis/cubes.jpg, black background) cut out with a
# soft alpha -> assets/games/anubis/jc-ice.webp (falling cube), jc-stone.webp (landed cube, carries its multiplier),
# jc-lava.webp, jc-skull.webp (stone skull: adds to the column), jc-gold.webp (golden skull: multiplies the column).
# python3 tools/art/anubis/cubes.py   (pip install opencv-python-headless numpy pillow)
import os
import numpy as np, cv2
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, '../../../assets/games/anubis')
NAMES = ['jc-ice', 'jc-stone', 'jc-lava', 'jc-skull', 'jc-gold']
a = np.array(Image.open(os.path.join(HERE, 'cubes.jpg')).convert('RGB'))
m = (a.max(2) > 22).astype(np.uint8)
n, lab, st, _ = cv2.connectedComponentsWithStats(m)
boxes = sorted([st[i] for i in range(1, n) if st[i][4] > 5000], key=lambda s: s[0])
assert len(boxes) == 5
for name, (x, y, w, h, _) in zip(NAMES, boxes):
    p = 10
    x0, y0, x1, y1 = max(0, x - p), max(0, y - p), min(a.shape[1], x + w + p), min(a.shape[0], y + h + p)
    crop = a[y0:y1, x0:x1]
    k = (lab[y0:y1, x0:x1] > 0).astype(np.uint8)
    k = cv2.morphologyEx(k, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    cs, _ = cv2.findContours(k, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    k = np.zeros_like(k); cv2.fillPoly(k, [cv2.convexHull(np.vstack(cs))], 1)   # a cube is convex: no hole, no notch
    k = cv2.erode(k, np.ones((3, 3), np.uint8))
    alpha = cv2.GaussianBlur(k.astype(np.float32), (0, 0), 1.2)
    rgba = np.dstack([crop, (alpha * 255).clip(0, 255).astype(np.uint8)])
    s = max(x1 - x0, y1 - y0)
    sq = np.zeros((s, s, 4), np.uint8); oy, ox = (s - (y1 - y0)) // 2, (s - (x1 - x0)) // 2
    sq[oy:oy + y1 - y0, ox:ox + x1 - x0] = rgba
    Image.fromarray(sq).resize((240, 240), Image.LANCZOS).save(os.path.join(OUT, name + '.webp'), quality=88, method=6)
    print(name, x, y, w, h)
