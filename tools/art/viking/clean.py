# Le Valhalla: the owner's animated background of 16 November 2026 (fond-haut.mp4, 448 × 672, 8 s: a stone frame in blue
# flames, the Jarl's medallion and his blue bar top left, the valkyrie's medallion and bar on the right, vikings around).
# -> assets/games/viking/fond.mp4 (×2, silent, seamless loop) + fond.webp (poster) + valk.webp (the valkyrie's medallion
# and bar, cut out: it overlaps the frame, so the game puts it ABOVE the reels).
# Cleaned on every frame: the painted grid inside the frame (the game draws its 5 × 4 reels there: a still, clean stone
# patch is pasted, the inside of the frame does not move) and the blue fill of both bars (the game fills them itself
# with the Jarl and valkyrie points).   python3 tools/art/viking/clean.py
import os, sys
import numpy as np, cv2
from PIL import Image
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from videobg import make, read, UP

HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, '../../../assets/games/viking')
IN = (84, 198, 368, 548)             # inside of the frame
BARS = [(25, 159, 151, 172), (309, 417, 426, 433)]  # tracks of the Jarl's and the valkyrie's bars
VALK = {'c': (391, 352, 60), 'bar': (286, 408, 448, 442)}


def clean_inside(mean):
    x0, y0, x1, y1 = IN
    p = mean[y0:y1, x0:x1].copy()
    g = cv2.cvtColor(p, cv2.COLOR_RGB2GRAY)
    bh = cv2.morphologyEx(g, cv2.MORPH_BLACKHAT, cv2.getStructuringElement(cv2.MORPH_RECT, (15, 15)))
    th = cv2.morphologyEx(g, cv2.MORPH_TOPHAT, cv2.getStructuringElement(cv2.MORPH_RECT, (15, 15)))
    m = ((bh > 14) | (th > 22)).astype(np.uint8)
    # keep only long lines (the grid), not the stone grain
    lines = cv2.morphologyEx(m, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (1, 25))) | cv2.morphologyEx(m, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (25, 1)))
    lines = cv2.dilate(lines, np.ones((5, 5), np.uint8))
    p = cv2.inpaint(p, lines, 7, cv2.INPAINT_TELEA)
    return p


def track(f):
    for (x0, y0, x1, y1) in BARS:
        h = y1 - y0
        t = np.linspace(0, 1, h)[:, None, None]
        f[y0:y1, x0:x1] = (np.array([10, 16, 28]) * (1 - abs(t - .5) * .6) + np.array([2, 3, 8])).astype(np.uint8)
    return f


def valk_mask(shape):
    a = np.zeros(shape[:2], np.uint8)
    cx, cy, r = VALK['c']; cv2.circle(a, (cx, cy), r, 255, -1)
    bx0, by0, bx1, by1 = VALK['bar']; a[by0:by1, bx0:bx1] = 255
    cv2.fillConvexPoly(a, np.array([[381, 296], [399, 296], [390, 287]]), 255)
    return cv2.GaussianBlur(a, (0, 0), 1.2)


def cleaner(mean):
    x0, y0, x1, y1 = IN
    patch = clean_inside(mean)
    feather = np.ones((y1 - y0, x1 - x0, 1), np.float32)
    for k in range(4): feather[k, :] = feather[-1 - k, :] = feather[:, k] = feather[:, -1 - k] = min(feather[k, k, 0], (k + 1) / 5)
    keep = valk_mask(mean.shape)[y0:y1, x0:x1, None] / 255.0  # the valkyrie's medallion and bar stay
    feather = feather * (1 - keep)
    def run(f):
        f = f.copy()
        f[y0:y1, x0:x1] = (patch * feather + f[y0:y1, x0:x1] * (1 - feather)).astype(np.uint8)
        return track(f)
    cleaner.first = run(mean)
    return run


make(os.path.join(HERE, 'fond-haut.mp4'), OUT, 'tmp', cleaner)
os.replace(os.path.join(OUT, 'fond-tmp.mp4'), os.path.join(OUT, 'fond.mp4'))
os.replace(os.path.join(OUT, 'scene-tmp.webp'), os.path.join(OUT, 'fond.webp'))
# the valkyrie's medallion and bar, cut out (×2, transparent around)
img = cleaner.first
a = valk_mask(img.shape)
rgba = np.dstack([img, a])
x0, y0, x1, y1 = 280, 285, 448, 448
Image.fromarray(rgba[y0:y1, x0:x1]).resize(((x1 - x0) * UP, (y1 - y0) * UP), Image.LANCZOS).save(os.path.join(OUT, 'valk.webp'), quality=88, method=6)
print('valk box', (x0, y0, x1, y1))
