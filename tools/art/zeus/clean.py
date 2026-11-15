# L'Olympe: the owner's picture of 15 November 2026 (decor.jpg, 1024 × 1024) -> scene.webp without the 4 painted column
# separators (the grid has 6 columns, drawn by the game), the spin disc alone (spin.webp, it turns during the spins).
# python3 tools/art/zeus/clean.py
from PIL import Image, ImageDraw, ImageFilter
import numpy as np, os, random
HERE = os.path.dirname(__file__); OUT = os.path.join(HERE, '../../../assets/games/zeus')
im = Image.open(os.path.join(HERE, 'decor.jpg')).convert('RGB')
a = np.asarray(im).astype(float)
random.seed(5)
Y0, Y1 = 333, 846
for d in (282, 433, 583, 734):
    x0, x1 = d - 9, d + 10
    for y in range(Y0, Y1):
        L = a[y, x0 - 3:x0].mean(0); R = a[y, x1:x1 + 3].mean(0)
        for x in range(x0, x1):
            t = (x - x0) / (x1 - x0 - 1)
            a[y, x] = L * (1 - t) + R * t + random.uniform(-2, 2)
    reg = Image.fromarray(a[Y0:Y1, x0 - 3:x1 + 3].clip(0, 255).astype('uint8')).filter(ImageFilter.GaussianBlur(1.4))
    a[Y0:Y1, x0 - 3:x1 + 3] = np.asarray(reg)
out = Image.fromarray(a.clip(0, 255).astype('uint8'))
out.save(os.path.join(OUT, 'scene.webp'), quality=86, method=6)
cx, cy, r = 808, 925, 72
b = im.crop((cx - r, cy - r, cx + r, cy + r)).convert('RGBA')
m = Image.new('L', (8 * r, 8 * r), 0); ImageDraw.Draw(m).ellipse((0, 0, 8 * r - 1, 8 * r - 1), fill=255)
b.putalpha(m.resize((2 * r, 2 * r), Image.LANCZOS))
b.save(os.path.join(OUT, 'spin.webp'), quality=90, method=6)
print('ok')
