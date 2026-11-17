# La Roulette: the owner's 2 videos of 17 November 2026 (show-large.mp4 672 × 448 for computers, show-haut.mp4 448 × 672 for
# phones held upright, 12 s, with her voice): the croupière next to the wheel speaks (0 → 3,5 s), spins the wheel and
# throws the ball (≈ 4 → 5 s), the wheel turns to the end. The felt is in the picture (fixed camera): the game puts its
# betting cells on it (XGEO in games/rltable.js).
#  - computer: the row « 2 to 1 / 2 to 1 / 2 to 1 » under the numbers is not a bet of the real table (the columns are on the
#    right): its words are erased, the dozens take the row;
#  - phone: the « 2 to 1 » row = the 3 columns (« 1re colonne »…), the green « 0 » diamond = the black diamond, the red
#    diamond loses its words;
# -> assets/games/roulette/show-<l|p>.mp4 (×1,5, with the sound, a key frame every 12 frames) + show-<l|p>.webp (poster)
# python3 tools/art/roulette/show.py   (pip install opencv-python-headless numpy pillow; needs ffmpeg)
import os, sys, subprocess
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, '../../../assets/games/roulette')
sys.path.insert(0, os.path.join(HERE, '..'))
from videobg import read  # noqa: E402

FONT = '/usr/share/fonts/truetype/freefont/FreeSerifBoldItalic.ttf'


def textmask(f, box, thr=70):
    """the words in a felt cell: every pixel far from the cell's own colour (letters and their dark shadow)"""
    x0, y0, x1, y1 = box
    a = f[y0:y1, x0:x1].astype(np.int16)
    med = np.median(a.reshape(-1, 3), axis=0)
    m = np.abs(a - med).sum(2) > thr
    out = np.zeros(f.shape[:2], np.uint8); out[y0:y1, x0:x1] = m
    return cv2.dilate(out, np.ones((3, 3), np.uint8))


def flat(f, m, box):
    """the masked pixels painted with the cell's own colour (a little blurred: the felt keeps its grain around)"""
    x0, y0, x1, y1 = box
    a = f[y0:y1, x0:x1]
    med = np.median(a.reshape(-1, 3), axis=0)
    g = f.copy(); g[m > 0] = med.astype(np.uint8)
    k = cv2.GaussianBlur((m > 0).astype(np.float32), (0, 0), 1.0)[..., None]
    return (f * (1 - k) + g * k).astype(np.uint8)


def large(fr):
    # the 3 « 2 to 1 » words of the row under the numbers (inside the cells, without their lines)
    boxes = [(80, 376, 230, 389), (262, 376, 432, 389), (456, 376, 622, 389)]
    for i, f in enumerate(fr):
        for b in boxes: f = flat(f, textmask(f, b), b)
        fr[i] = f
    return fr


def haut(fr):
    f0 = np.median(fr[:8], axis=0).astype(np.uint8)
    g = f0.copy()
    # the « 2 to 1 » words of the column row, then our words
    cells = [(10, 503, 150, 542), (160, 503, 300, 542), (308, 503, 444, 542)]
    for b in cells: g = flat(g, textmask(g, b), b)
    im = Image.fromarray(g); d = ImageDraw.Draw(im)
    # the « 0 » diamond becomes the black one, the red diamond loses its words (inside their gold outline)
    d.polygon([(183 - 26, 573), (183, 573 - 20), (183 + 26, 573), (183, 573 + 20)], fill=(20, 20, 22))
    a = g[562:588, 238:282].reshape(-1, 3).astype(np.int16)
    red = np.median(a[(a[:, 0] > 100) & (a[:, 1] < 70)], axis=0).astype(int)
    d.polygon([(259 - 33, 575), (259, 575 - 22), (259 + 33, 575), (259, 575 + 22)], fill=tuple(red))
    font = ImageFont.truetype(FONT, 15)
    for (x0, y0, x1, y1), t in zip(cells, ['1re colonne', '2e colonne', '3e colonne']):
        tw = d.textlength(t, font=font)
        d.text(((x0 + x1) / 2 - tw / 2, (y0 + y1) / 2 - 10), t, font=font, fill=(236, 230, 214))
    g = np.array(im)
    # pasted on every frame (the felt does not move, her hands stay on the rail above it)
    zone = np.zeros(g.shape[:2], np.float32); zone[498:592, :] = 1
    k = cv2.GaussianBlur(zone, (0, 0), 1.0)[..., None]
    for i, f in enumerate(fr):
        fr[i] = (f * (1 - k) + g * k).astype(np.uint8)
    return fr


def run(k, src, fn):
    p = os.path.join(HERE, src)
    fr = fn(read(p))
    H, W = fr.shape[1:3]
    w, h = int(W * 1.5) // 2 * 2, int(H * 1.5) // 2 * 2
    pr = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', '24', '-i', '-', '-i', p,
                           '-map', '0:v', '-map', '1:a', '-vf', f'scale={w}:{h}:flags=lanczos,unsharp=5:5:0.35:5:5:0', '-c:v', 'libx264',
                           '-preset', 'veryslow', '-crf', '25', '-pix_fmt', 'yuv420p', '-g', '12', '-keyint_min', '12', '-sc_threshold', '0',
                           '-profile:v', 'high', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', os.path.join(OUT, f'show-{k}.mp4')], stdin=subprocess.PIPE)
    pr.communicate(fr.tobytes())
    Image.fromarray(fr[0]).resize((w, h), Image.LANCZOS).save(os.path.join(OUT, f'show-{k}.webp'), quality=82, method=6)
    if os.environ.get('RL_DEBUG'): np.save(f'/tmp/rl_{k}.npy', fr[::12])
    print(k, len(fr), 'frames')


for k in (sys.argv[1:] or ['l', 'p']):
    run(k, *{'l': ('show-large.mp4', large), 'p': ('show-haut.mp4', haut)}[k])
