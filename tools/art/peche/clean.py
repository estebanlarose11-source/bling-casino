# La Pêche · the owner's videos (15 November 2026) -> the files the game uses (assets/games/peche/).
# pip install opencv-python-headless numpy pillow ; needs ffmpeg. Run from the repository root:
#   python3 tools/art/peche/clean.py
#
# 1. The wheel (roue.mp4, a glass wheel that always stops at the same place): the game turns the wheel itself, so that
#    it can stop on any case. From the last frame (wheel at rest):
#    - roue.webp       the scene (background, glass rim, crystal pointer, reflection), made round (the video's wheel is
#                      4 % taller than wide) and ×2;
#    - roue-disc.webp  the turning glass disc, rebuilt with the game's 54 cases (SEGS of games/peche.js, case 0 from the
#                      top, clockwise): each case is a fish-free glass wedge of the video (light for ×2 glace, dark for
#                      ×2 nuit, mid-blue for the fish), stretched to 1/54 of a turn;
#    - roue-top.webp   what stays above the turning disc: the crystal pointer and the glass hub (found where the spinning
#                      video does not change), transparent elsewhere.
# 2. The 9 fishing videos (bleu / orange / rouge × canne = small fish, grue = medium, helico = big): H.264 at their own size
#    (448 × 672 is enough for the bonus box, and light to load on a phone), sharpened, silent,
#    + their first frame as poster -> <fb|fo|fr>-<1|2|3>.mp4 / .webp
import os, sys, subprocess
import numpy as np, cv2
from PIL import Image
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from videobg import read

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', '..', 'assets', 'games', 'peche')

# ---- the wheel ----
CX, CY = 224, 332          # wheel centre in the video (448 × 672)
RIN, KY = 198, 207 / 198   # glass disc radius (horizontal) and the vertical stretch of the video's wheel
HUB = 33                   # glass hub radius
UP = 2
Y0, Y1 = 30, 620           # part of the frame kept (pointer to the reflection)
DISC = 800                 # size of roue-disc.webp

# The game's wheel: the same list as SEGS in games/peche.js (54 cases).
SEG_COUNT = [('w', 22, 0.5), ('s', 22, 0.25), ('fb', 6, 0.4), ('fo', 3, 0.15), ('fr', 1, 0.66)]
SEGS = [k for _, k in sorted(((i + ph) / n + j * 1e-4, k) for j, (k, n, ph) in enumerate(SEG_COUNT) for i in range(n))]
assert len(SEGS) == 54

# Fish-free wedges of the video's wheel (degrees from the top, clockwise, divider to divider), found on the
# unwrapped last frame.
CLEAN = [(17.2, 27.2), (28.2, 38.8), (70.5, 80.2), (81, 90.2), (101, 112), (113, 123.2), (124, 134.5), (135.5, 145.5),
         (158.2, 168.5), (194.8, 204.5), (205.2, 217.8), (219, 229.2), (252.5, 262.5), (263.8, 273.8), (274.5, 284.5),
         (296.5, 306.5), (307.8, 317.5), (317.5, 329.5), (330.2, 341.5)]


def src_xy(r, th):  # video pixel of the glass disc at radius r (0..RIN) and angle th (radians from the top, clockwise)
    return CX + r * np.sin(th), CY - r * np.cos(th) * KY


def wheel():
    fr = read(os.path.join(HERE, 'roue.mp4'))
    last = fr[-1]
    spin = fr[20:160].astype(np.float32).std(0).mean(-1)  # turning pixels change a lot, the pointer and the hub do not
    # shade of each clean wedge (mean light in the middle of the glass)
    def lumw(a, b):
        th = np.radians(np.linspace(a + 2, b - 2, 20)); r = np.linspace(70, 180, 20)
        T, R = np.meshgrid(th, r); x, y = src_xy(R, T)
        px = cv2.remap(last, x.astype(np.float32), y.astype(np.float32), cv2.INTER_LINEAR)
        return float(px.mean())
    lw = sorted(CLEAN, key=lambda w: lumw(*w))
    n = len(lw)
    dark, mid, light = lw[:n // 3], lw[n // 3:2 * n // 3], lw[2 * n // 3:]
    pools = {'s': dark, 'w': light, 'f': mid}
    used = {'s': 0, 'w': 0, 'f': 0}
    # rebuild the disc: output pixel (polar) -> case i, place u in the case -> the same place in a source wedge
    yy, xx = np.mgrid[:DISC, :DISC].astype(np.float32)
    c = (DISC - 1) / 2
    dx, dy = xx - c, yy - c
    rr = np.hypot(dx, dy) / c * RIN
    th = np.degrees(np.arctan2(dx, -dy)) % 360
    A = 360 / 54
    seg = np.minimum((th // A).astype(int), 53)
    u = (th - seg * A) / A
    sa = np.zeros_like(th); sb = np.zeros_like(th)
    for i, k in enumerate(SEGS):
        pool = pools[k[0]]; w = pool[used[k[0]] % len(pool)]; used[k[0]] += 1
        m = seg == i; sa[m] = w[0]; sb[m] = w[1]
    sth = np.radians(sa + (sb - sa) * u)
    x, y = src_xy(np.minimum(rr, RIN), sth)
    big = cv2.resize(last, None, fx=UP, fy=UP, interpolation=cv2.INTER_CUBIC)
    disc = cv2.remap(big, (x * UP).astype(np.float32), (y * UP).astype(np.float32), cv2.INTER_CUBIC)
    alpha = np.clip((c - np.hypot(dx, dy)) * 1.5 + 1, 0, 1)  # soft round edge
    Image.fromarray(np.dstack([disc, (alpha * 255).astype(np.uint8)])).save(os.path.join(OUT, 'roue-disc.webp'), quality=86, method=6)
    # the scene: round wheel (vertical squash 1 / KY), ×2, cropped
    H = int(round((Y1 - Y0) / KY * UP)); W = 448 * UP
    sy, sx = np.mgrid[:H, :W].astype(np.float32)
    mx = sx / UP; my = Y0 + sy / UP * KY
    scene = cv2.remap(last, mx, my, cv2.INTER_CUBIC)
    Image.fromarray(scene).save(os.path.join(OUT, 'roue.webp'), quality=84, method=6)
    # above the disc: pointer (still pixels near the top) and hub, soft edges
    still = cv2.remap(spin, mx, my, cv2.INTER_LINEAR)
    ccx, ccy = CX * UP, (CY - Y0) / KY * UP
    d = np.hypot(sx - ccx, sy - ccy)
    ptr = (still < 9) & (np.abs(sx - ccx) < 40 * UP) & (sy < ccy - 150 * UP) & (d > (RIN - 30) * UP) & (d < (RIN + 2) * UP)
    ptr = cv2.morphologyEx(ptr.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    ptr = cv2.morphologyEx(ptr, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8)) > 0
    # the part of the pointer outside the disc stays in the scene: keep from the rim's inner edge down
    a = np.zeros((H, W), np.float32)
    a[ptr] = 1
    a = np.maximum(a, np.clip((HUB * UP - d) / 3 + 1, 0, 1))
    a = cv2.GaussianBlur(a, (0, 0), 1.2)
    top = np.dstack([scene, (np.clip(a, 0, 1) * 255).astype(np.uint8)])
    Image.fromarray(top).save(os.path.join(OUT, 'roue-top.webp'), quality=90, method=6)
    print(f'roue.webp {W}×{H}: centre ({ccx:.1f}, {ccy:.1f}), disc radius {RIN * UP} px '
          f'-> left {(ccx - RIN * UP) / W * 100:.2f} %, top {(ccy - RIN * UP) / H * 100:.2f} %, '
          f'width {2 * RIN * UP / W * 100:.2f} %, height {2 * RIN * UP / H * 100:.2f} %, hub {2 * HUB / (2 * RIN) * 100:.1f} % of the disc')


# ---- the fishing videos ----
FISH = {'fb': 'bleu', 'fo': 'orange', 'fr': 'rouge'}
SIZE = {1: 'canne', 2: 'grue', 3: 'helico'}


def fishing():
    for k, col in FISH.items():
        for n, how in SIZE.items():
            src = os.path.join(HERE, f'{col}-{how}.mp4')
            dst = os.path.join(OUT, f'{k}-{n}.mp4')
            subprocess.check_call(['ffmpeg', '-v', 'error', '-y', '-i', src, '-vf', 'unsharp=5:5:0.4:5:5:0',
                                   '-c:v', 'libx264', '-preset', 'slow', '-crf', '30', '-g', '48', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
                                   '-movflags', '+faststart', '-an', dst])
            subprocess.check_call(['ffmpeg', '-v', 'error', '-y', '-i', dst, '-frames:v', '1', '-c:v', 'libwebp', '-quality', '78',
                                   os.path.join(OUT, f'{k}-{n}.webp')])
            print(dst, os.path.getsize(dst) // 1000, 'ko')


if __name__ == '__main__':
    if '--videos' not in sys.argv: wheel()
    if '--roue' not in sys.argv: fishing()
