#!/usr/bin/env python3
"""La Roulette Russe : images fabriquées par code.

- `barrel.webp` / `prime.webp` : le barillet découpé dans la photo du propriétaire (`barillet-photo.webp`).
  La balle est retirée (la chambre est remplie avec une chambre vide de la même photo), puis découpée à part
  pour remplir les 6 chambres. Le barillet est tourné de 30° : une chambre en haut (celle qui tire).
- `planks.webp` (fond des rouleaux) et `frame.webp` (cadre de la machine) : bois usé, sombre et net, dessinés
  par bruit (aucune image reprise d'un autre jeu).

    python3 tools/art/barillet.py      → assets/games/barillet/…  (puis changer IMG_V / CACHE si besoin)
"""
import math, os
import numpy as np
from PIL import Image, ImageFilter, ImageDraw, ImageEnhance

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', 'assets', 'games', 'barillet')
rng = np.random.default_rng(7)

# ---------- the barrel (photo) ----------
CX, CY = 151.0, 167.5     # centre of the cylinder (ejector star) in the photo
R_CYL = 125.5             # cylinder radius
R_RING = 82.0             # chambers ring radius
R_HOLE = 35.0             # chamber radius (with its chamfer)
R_PRIME = 37.5            # cartridge rim radius
BULLET_ANG = 180          # the cartridge sits in the chamber on the left
EMPTY_ANG = 0             # the chamber on the right is empty: copied over the cartridge
S = 4                     # work at 4× (the photo is small)
SIZE = 1024               # output size of barrel.webp


def circle_mask(w, h, cx, cy, r, feather):
    y, x = np.mgrid[0:h, 0:w]
    d = np.hypot(x - cx, y - cy)
    return np.clip((r - d) / feather + 0.5, 0, 1)


def barrel():
    src = Image.open(os.path.join(HERE, 'barillet-photo.webp')).convert('RGB')
    big = src.resize((src.width * S, src.height * S), Image.LANCZOS)
    big = big.filter(ImageFilter.UnsharpMask(radius=3, percent=90, threshold=2))
    a = np.asarray(big).astype(np.float32)
    cx, cy = CX * S, CY * S

    def pos(ang):
        t = math.radians(ang)
        return cx + R_RING * S * math.cos(t), cy + R_RING * S * math.sin(t)

    # 1) the cartridge, cut out on its own (RGBA)
    bx, by = pos(BULLET_ANG)
    r = R_PRIME * S
    box = (int(bx - r - 8), int(by - r - 8), int(bx + r + 8), int(by + r + 8))
    prime = big.crop(box)
    m = circle_mask(prime.width, prime.height, bx - box[0], by - box[1], r, 2.5)
    prime = np.dstack([np.asarray(prime).astype(np.float32), m * 255]).astype(np.uint8)
    prime = Image.fromarray(prime, 'RGBA')
    prime = ImageEnhance.Color(ImageEnhance.Contrast(prime).enhance(1.15)).enhance(1.35)
    prime.resize((256, 256), Image.LANCZOS).save(os.path.join(OUT, 'prime.webp'), quality=92, method=6)

    # 2) the empty chamber on the right, turned by 180° and laid over the cartridge
    rot = np.asarray(big.rotate(180, center=(cx, cy), resample=Image.BICUBIC)).astype(np.float32)
    m = circle_mask(a.shape[1], a.shape[0], bx, by, (R_PRIME + 2.5) * S, 6 * S)[..., None]
    a = a * (1 - m) + rot * m

    # 3) the cylinder alone, turned so a chamber sits on top, on a transparent background
    im = Image.fromarray(a.clip(0, 255).astype(np.uint8))
    im = im.rotate(-30, center=(cx, cy), resample=Image.BICUBIC)
    r = R_CYL * S
    side = int(r * 2 + 8 * S)
    box = (int(cx - side / 2), int(cy - side / 2), int(cx - side / 2) + side, int(cy - side / 2) + side)
    cyl = im.crop(box)
    m = circle_mask(side, side, cx - box[0], cy - box[1], r - 1 * S, 1.5 * S)
    cyl = Image.fromarray(np.dstack([np.asarray(cyl), (m * 255).astype(np.uint8)]), 'RGBA')
    cyl = cyl.resize((SIZE, SIZE), Image.LANCZOS)
    cyl.save(os.path.join(OUT, 'barrel.webp'), quality=90, method=6)
    # where things land in the 100×100 SVG viewBox
    k = 100 / side
    print('barrel: ring', round(R_RING * S * k, 2), 'hole', round(R_HOLE * S * k, 2), 'prime', round(R_PRIME * S * k, 2),
          'centre', round((cx - box[0]) * k, 2), round((cy - box[1]) * k, 2))


# ---------- weathered wood ----------
def noise1(n, scale, octaves=4):
    """smooth 1-D noise of length n"""
    out = np.zeros(n)
    amp, tot = 1.0, 0.0
    for o in range(octaves):
        k = max(2, int(n / scale * 2 ** o) + 2)
        pts = rng.standard_normal(k)
        out += amp * np.interp(np.linspace(0, k - 1, n), np.arange(k), pts)
        tot += amp
        amp *= 0.5
    return out / tot


def noise2(h, w, sy, sx, octaves=4):
    """smooth 2-D value noise, cell size sy × sx"""
    out = np.zeros((h, w), np.float32)
    amp, tot = 1.0, 0.0
    for o in range(octaves):
        gy, gx = max(2, int(h / sy * 2 ** o) + 2), max(2, int(w / sx * 2 ** o) + 2)
        g = Image.fromarray(rng.standard_normal((gy, gx)).astype(np.float32), 'F')
        out += amp * np.asarray(g.resize((w, h), Image.BICUBIC))
        tot += amp
        amp *= 0.5
    return out / tot


def boards(h, w, widths, base, light, seed_knots=3, groove=7):
    """planks of the given widths (along x), grain along y; returns float RGB 0..255"""
    img = np.zeros((h, w, 3), np.float32)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    x0 = 0
    for bw in widths:
        x1 = min(w, x0 + bw)
        ww = x1 - x0
        X, Y = xx[:, x0:x1] - x0, yy[:, x0:x1]
        # wood: stripes along the board, bent by slow noise, of uneven width
        warp = noise2(h, ww, 300, 50, 3) * 14 + noise2(h, ww, 60, 20, 2) * 3
        u = X + warp + rng.uniform(0, 100)
        f = 0.11 + 0.05 * noise2(h, ww, 500, 200, 1)
        rings = np.abs(np.sin(u * f))
        late = rings ** 0.35                          # wide light early wood, thin dark late wood
        fib = noise2(h, ww, 90, 1.3, 2)                # long fibres
        scr = noise2(h, ww, 3, 1, 1)                   # fine scratches
        tone = noise2(h, ww, 400, 120, 2) * 0.35 + rng.normal(0, 0.12)
        t = 0.18 + 0.42 * late + 0.10 * fib + 0.05 * scr + tone
        # knots with rings around them
        for _ in range(rng.integers(0, seed_knots + 1)):
            ky, kx, kr = rng.uniform(80, h - 80), rng.uniform(ww * .25, ww * .75), rng.uniform(ww * .05, ww * .1)
            d = np.hypot((X - kx) / kr, (Y - ky) / (kr * 2.4))
            t = t - 0.45 * np.exp(-d ** 2 * 1.5) + 0.12 * np.exp(-((d - 1.6) ** 2) * 3) * np.sin(d * 10)
        # cracks: a few thin dark lines along the grain
        for _ in range(rng.integers(0, 3)):
            cx0, cy0, ln = rng.uniform(10, ww - 10), rng.uniform(0, h), rng.uniform(h * .1, h * .4)
            line = np.exp(-((X - cx0 - warp * .6) / 1.1) ** 2) * ((Y > cy0) & (Y < cy0 + ln))
            t = t - 0.5 * line
        # worn lighter edges, dark groove between boards
        e = np.minimum(X, ww - 1 - X)
        t = t + 0.16 * np.exp(-((e - groove) / 3) ** 2) * (e > groove - 2)
        t = np.where(e < groove, t * (0.18 + 0.5 * (e / groove) ** 2), t)
        t = np.clip(t, 0, 1.2)[..., None]
        img[:, x0:x1] = base + (light - base) * t
        x0 = x1
        if x0 >= w:
            break
    img *= (1 + 0.06 * noise2(h, w, 150, 150, 2))[..., None]
    return img


def nail(img, x, y, r):
    h, w, _ = img.shape
    yy, xx = np.mgrid[0:h, 0:w]
    d = np.hypot(xx - x, yy - y)
    head = np.clip(r - d + .5, 0, 1)[..., None]
    shade = np.clip(1 - np.hypot(xx - (x - r * .35), yy - (y - r * .35)) / (r * 1.6), 0, 1)[..., None]
    col = np.array([40, 38, 36]) + shade * np.array([120, 112, 100])
    ring = np.clip(1 - np.abs(d - r - 1.2) / 1.5, 0, 1)[..., None] * 0.6
    img[:] = img * (1 - ring) + img * ring * 0.3
    img[:] = img * (1 - head) + col * head


def planks():
    # one reel: three narrow dark boards, grain running down, like an old barn wall
    h, w = 1400, 420
    img = boards(h, w, [138, 144, 138], np.array([24, 21, 18]), np.array([96, 84, 72]), groove=8)
    for x in (69, 210, 351):
        for y in (60, h - 60):
            nail(img, x, y, 7)
    Image.fromarray(img.clip(0, 255).astype(np.uint8)).save(os.path.join(OUT, 'planks.webp'), quality=86, method=6)


def frame():
    # the frame of the machine: grey weathered boards laid flat (grain across), lighter than the reels
    h, w = 900, 1600
    img = boards(w, h, [150, 170, 160, 140, 180, 150, 160, 170, 160, 160], np.array([40, 38, 34]), np.array([128, 122, 110]), seed_knots=2, groove=6)
    img = np.transpose(img, (1, 0, 2)).copy()
    Image.fromarray(img.clip(0, 255).astype(np.uint8)).save(os.path.join(OUT, 'frame.webp'), quality=84, method=6)


if __name__ == '__main__':
    barrel()
    planks()
    frame()
