# La Sweety: the owner's 2 pictures of 15 November 2026 -> scene-haut.webp (720 × 1280, phone held upright) and
# scene-large.webp (1280 × 720, computer and wide screens). The painted pink lattice inside the window is erased (the
# game draws its own 6 × 5 grid) and so is the painted stake « $1.00 ».  python3 tools/art/candy/clean.py
from PIL import Image, ImageFilter
import numpy as np, os, random
HERE = os.path.dirname(__file__); OUT = os.path.join(HERE, '../../../assets/games/candy')
JOBS = {
    'haut': {'win': (140, 342, 589, 904), 'txt': (82, 1088, 218, 1142)},
    'large': {'win': (408, 198, 875, 550), 'txt': (398, 620, 516, 664)},
}
random.seed(9)
for name, job in JOBS.items():
    im = Image.open(os.path.join(HERE, f'decor-{name}.jpg')).convert('RGB')
    a = np.asarray(im).astype(float)
    x0, y0, x1, y1 = job['win']
    reg = im.crop((x0, y0, x1, y1))
    bg = np.asarray(reg.filter(ImageFilter.MinFilter(11)).filter(ImageFilter.GaussianBlur(12))).astype(float)
    r = a[y0:y1, x0:x1]
    # the lattice: pink lines brighter than the purple around them (+ their glow)
    line = (r[..., 0] - bg[..., 0] > 28) | (r.mean(2) - bg.mean(2) > 30)
    line = np.asarray(Image.fromarray((line * 255).astype('uint8')).filter(ImageFilter.MaxFilter(5))).astype(float) > 0
    r[line] = bg[line]
    ys, xs = np.where(line)
    for k in random.sample(range(len(ys)), min(len(ys), 220)):  # a few sparkles back
        v = random.uniform(150, 255); r[ys[k], xs[k]] = (v, v * .8, v)
    a[y0:y1, x0:x1] = r
    tx0, ty0, tx1, ty1 = job['txt']
    ring = np.concatenate([a[ty0 - 3:ty0, tx0:tx1].reshape(-1, 3), a[ty1:ty1 + 3, tx0:tx1].reshape(-1, 3)])
    a[ty0:ty1, tx0:tx1] = np.median(ring, 0)
    Image.fromarray(a.clip(0, 255).astype('uint8')).save(os.path.join(OUT, f'scene-{name}.webp'), quality=85, method=6)
print('ok')
