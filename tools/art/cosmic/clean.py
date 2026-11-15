# Le Cosmique: the owner's 2 pictures of 15 November 2026 -> scene-large.webp (1248 × 832, page and wide screens) and
# scene-haut.webp (720 × 1280, phone held upright). The painted lattice of the window is erased (the game draws its
# own 6 × 5 grid) and so is the painted stake « 2.50 » (the game writes the real one).  python3 tools/art/cosmic/clean.py
from PIL import Image, ImageFilter
import numpy as np, os, random
HERE = os.path.dirname(__file__); OUT = os.path.join(HERE, '../../../assets/games/cosmic')
JOBS = {
    'large': {'win': (370, 200, 936, 560), 'txt': [(338, 702, 418, 742)]},
    'haut': {'win': (160, 425, 608, 768), 'txt': [(118, 1018, 196, 1052)], 'oval': (392, 530, 224, 232)},
}
random.seed(7)
for name, job in JOBS.items():
    im = Image.open(os.path.join(HERE, f'decor-{name}.jpg')).convert('RGB')
    a = np.asarray(im).astype(float)
    x0, y0, x1, y1 = job['win']
    reg = im.crop((x0, y0, x1, y1))
    med = np.asarray(reg.filter(ImageFilter.MinFilter(9)).filter(ImageFilter.GaussianBlur(10))).astype(float)
    r = a[y0:y1, x0:x1]
    lum = r.mean(2); mlum = med.mean(2)
    # the dark space of the window (not the moon's rock: far from any bright pixel): every pixel brighter than the dark
    # around it is the lattice
    near = np.asarray(Image.fromarray(lum.clip(0, 255).astype('uint8')).filter(ImageFilter.MaxFilter(15)).filter(ImageFilter.GaussianBlur(4))).astype(float)
    rock = (lum > 70) & (np.abs(r[..., 2] - r[..., 0]) < 40)
    rockn = np.asarray(Image.fromarray((rock * 255).astype('uint8')).filter(ImageFilter.MinFilter(11)).filter(ImageFilter.MaxFilter(25))).astype(float) > 0  # big bright blobs only (not the lattice's nodes)
    # only above the moon's rock, with a margin for its blue glow (per column: the first rock from the top)
    H_, W_ = lum.shape
    above = np.zeros_like(rockn)
    for x in range(W_):
        ys_ = np.where(rockn[:, x])[0]; cut = ys_.min() - 24 if len(ys_) else H_
        above[:max(0, cut), x] = True
    dark = above & (mlum < 45)
    # the lattice is blue (the rock is grey): blue pixels and the white hearts of its nodes next to them
    blue = ((r[..., 2] - r[..., 0]) > 22) & (lum > mlum + 6)
    nearb = np.asarray(Image.fromarray((blue * 255).astype('uint8')).filter(ImageFilter.MaxFilter(7))).astype(float) > 0
    line = dark & (lum > mlum + 6) & nearb
    if 'oval' in job:  # the round window of the tall picture: only inside its blue rim
        cx, cy, rx, ry = job['oval']; yy, xx = np.mgrid[y0:y1, x0:x1]
        line &= ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 < 1
    r[line] = med[line]
    # a few faint stars back
    ys, xs = np.where(dark)
    for k in random.sample(range(len(ys)), min(len(ys), 260)):
        v = random.uniform(80, 200); r[ys[k], xs[k]] = (v * .85, v * .9, v)
    a[y0:y1, x0:x1] = r
    for tx0, ty0, tx1, ty1 in job['txt']:
        ring = np.concatenate([a[ty0 - 4:ty0, tx0:tx1].reshape(-1, 3), a[ty1:ty1 + 4, tx0:tx1].reshape(-1, 3)])
        a[ty0:ty1, tx0:tx1] = np.median(ring, 0)
        b = Image.fromarray(a[ty0 - 2:ty1 + 2, tx0 - 2:tx1 + 2].clip(0, 255).astype('uint8')).filter(ImageFilter.GaussianBlur(1.5))
        a[ty0 - 2:ty1 + 2, tx0 - 2:tx1 + 2] = np.asarray(b)
    Image.fromarray(a.clip(0, 255).astype('uint8')).save(os.path.join(OUT, f'scene-{name}.webp'), quality=85, method=6)
print('ok')
