# La Fortune: the owner's picture (decor.jpg) -> the scene without the painted amounts (they are written by the game),
# the spin button alone (it turns while the reels spin) and a blurred backdrop for the sides of the screen.
# python3 tools/art/fortune/clean.py
from PIL import Image, ImageFilter
import numpy as np, os, random
HERE = os.path.dirname(__file__); OUT = os.path.join(HERE, '../../../assets/games/fortune')
im = Image.open(os.path.join(HERE, 'decor.jpg')).convert('RGB')
a = np.asarray(im).astype(float)
random.seed(3)
# (x0, y0, x1, y1): rectangles of painted text, filled with a gradient between their left and right edges
BOXES = [
    (138, 233, 296, 278),   # MAJOR amount
    (380, 224, 644, 280),   # JACKPOT amount
    (728, 233, 892, 278),   # MINI amount
    (150, 842, 230, 890),   # MISE value
    (318, 842, 356, 890),   # NIVEAU value
    (640, 840, 738, 892),   # PIECES value
    (768, 840, 896, 892),   # SOLDE value
    (428, 921, 598, 954),   # BONNE CHANCE !
]
for x0, y0, x1, y1 in BOXES:
    for y in range(y0, y1):
        L = a[y, x0 - 3:x0].mean(0); R = a[y, x1:x1 + 3].mean(0)
        for x in range(x0, x1):
            t = (x - x0) / max(1, x1 - x0 - 1)
            a[y, x] = L * (1 - t) + R * t + random.uniform(-3, 3)
    # soften the seams
    reg = Image.fromarray(a[y0 - 2:y1 + 2, x0 - 2:x1 + 2].clip(0, 255).astype('uint8')).filter(ImageFilter.GaussianBlur(1.6))
    a[y0 - 2:y1 + 2, x0 - 2:x1 + 2] = np.asarray(reg)
out = Image.fromarray(a.clip(0, 255).astype('uint8'))
out.save(os.path.join(OUT, 'scene.webp'), quality=86, method=6)
# spin button: a disc cut out of the original (centre 512, 849)
cx, cy, r = 512, 849, 70
b = im.crop((cx - r, cy - r, cx + r, cy + r)).convert('RGBA')
m = Image.new('L', (4 * 2 * r, 4 * 2 * r), 0)
from PIL import ImageDraw
ImageDraw.Draw(m).ellipse((0, 0, 8 * r - 1, 8 * r - 1), fill=255)
b.putalpha(m.resize((2 * r, 2 * r), Image.LANCZOS))
b.save(os.path.join(OUT, 'spin.webp'), quality=90, method=6)
# blurred backdrop (sides of a wide screen)
out.resize((384, 384)).filter(ImageFilter.GaussianBlur(9)).save(os.path.join(OUT, 'back.webp'), quality=70)
print('ok')
