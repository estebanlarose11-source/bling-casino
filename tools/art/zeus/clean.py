# L'Olympe: the owner's 2 animated backgrounds of 15 November 2026 (fond-large.mp4 736 × 400 for computers and wide
# screens, fond-haut.mp4 400 × 736 for phones held upright: lightning, blue flame, moving clouds) -> cleaned videos
# assets/games/zeus/fond-large.mp4 / fond-haut.mp4 (×2, silent, seamless loop) + their first frame as posters
# (scene-large.webp / scene-haut.webp).
# Cleaned on every frame: the painted grid (5 columns: the game has 6 × 5 and draws its own), the "x1" in the medallion
# (the game writes its multiplier), the bet amount "10,00 €" (the game writes the bet), and on the phone the left "+"
# becomes a "−". Seamless loop: the end fades into the start (FADE frames), then the first TAIL frames are repeated after
# the end: the game jumps back by one loop length while it plays them (no stop on the last frame, like a gif).
# pip install opencv-python-headless numpy pillow ; python3 tools/art/zeus/clean.py   (needs ffmpeg)
import os, subprocess
import numpy as np, cv2
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, '../../../assets/games/zeus')
FPS, FADE, TAIL, UP = 24, 24, 12, 2


def read(path):
    w, h = map(int, subprocess.check_output(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', path]).decode().split(',')[:2])
    raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', path, '-map', '0:v:0', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'])
    return np.frombuffer(raw, np.uint8).reshape(-1, h, w, 3).copy()


def gold(a):  # > 0 on gold / white paint, very negative on the night-blue panels
    a = a.astype(np.float32)
    return (a[..., 0] + a[..., 1]) / 2 - a[..., 2]


def lum(a):
    a = a.astype(np.float32)
    return 0.3 * a[..., 0] + 0.59 * a[..., 1] + 0.11 * a[..., 2]


def box(shape, x0, y0, x1, y1):
    m = np.zeros(shape[:2], bool); m[y0:y1, x0:x1] = True; return m


def disc(shape, cx, cy, r):
    yy, xx = np.mgrid[:shape[0], :shape[1]]
    return (xx - cx) ** 2 + (yy - cy) ** 2 <= r * r


def grow(m, n):
    return cv2.dilate(m.astype(np.uint8), np.ones((2 * n + 1, 2 * n + 1), np.uint8)) > 0 if n else m


def mend(f, m, r=4, soft=2.0):
    """inpaint the pixels of mask m, then soften them (feathered) so that no trace of the paint stays"""
    if not m.any(): return f
    g = cv2.inpaint(np.ascontiguousarray(f), m.astype(np.uint8), r, cv2.INPAINT_TELEA)
    b = cv2.GaussianBlur(g, (0, 0), soft)
    k = cv2.GaussianBlur(m.astype(np.float32), (0, 0), 1.2)[..., None]
    return (g * (1 - k) + b * k).clip(0, 255).astype(np.uint8)


def smooth(f, x0, y0, x1, y1, kx, ky, keep=None, edge=2):
    """the inside of the frame becomes an even night blue: the average of its blue pixels over one cell (kx × ky),
    so that no shade of the painted lines stays; the frame's own shadow is kept on `edge` pixels, `keep` is untouched"""
    c = f[y0:y1, x0:x1].astype(np.float32)
    w = ((gold(c) < -20) & (lum(c) < 75)).astype(np.float32)
    if keep is not None: w[keep[y0:y1, x0:x1]] = 0
    S = cv2.blur(c * w[..., None], (kx, ky), borderType=cv2.BORDER_REFLECT) / np.maximum(cv2.blur(w, (kx, ky), borderType=cv2.BORDER_REFLECT), 1e-3)[..., None]
    h, wd = w.shape
    yy, xx = np.mgrid[:h, :wd]
    a = np.clip((np.minimum(np.minimum(xx, wd - 1 - xx), np.minimum(yy, h - 1 - yy)) - edge + 1) / 3, 0, 1)
    if keep is not None: a *= 1 - cv2.GaussianBlur(keep[y0:y1, x0:x1].astype(np.float32), (0, 0), 3)
    a = a[..., None]
    f = f.copy(); f[y0:y1, x0:x1] = (c * (1 - a) + S * a).clip(0, 255).astype(np.uint8)
    return f


def cleaner_large(mean):
    s = mean.shape
    G = gold(mean)
    grid = grow(box(s, 163, 117, 577, 293) & (G > -18), 1)            # the painted 5 × 5 lines (and their glow)
    med = grow(disc(s, 101, 39, 35) & box(s, 0, 29, 736, 400) & (G > -8), 2) & disc(s, 101, 39, 36)   # "x1"
    bet = grow(box(s, 303, 353, 448, 382) & (lum(mean) > 70), 2)        # "10,00 €"
    def run(f):
        f = smooth(mend(f, grid, 3, 1.2), 162, 116, 578, 294, 85, 37)
        return mend(mend(f, med, 5, 2.4), bet, 4, 1.8)
    return run


def cleaner_tall(mean):
    s = mean.shape
    G = gold(mean)
    yy, xx = np.mgrid[:s[0], :s[1]]
    # kept as they are: the brazier and the bottom ornament (in front of the frame); the blue flame, found on each frame
    fixed = ((xx < 96) & (yy > 428)) | box(s, 207, 502, 227, 512)
    zone = box(s, 0, 300, 112, 452)
    lines = grow(box(s, 65, 261, 370, 508) & (G > -22), 1)          # the 5 painted columns
    med = grow(disc(s, 107.2, 219.5, 29) & box(s, 0, 212, 400, 736) & (G > -8), 2) & disc(s, 107.2, 219.5, 29.5)   # "x1"
    bet = grow(box(s, 171, 650, 237, 681) & (lum(mean) > 100), 2)       # "10,00"
    # left "+" -> "−": its vertical stroke is filled across, row by row, from the button on its left and on its right
    # (on the bar's rows: from the bar, which goes on)
    cx, cy = 157, 666
    def run(f):
        a = f.astype(np.float32)
        flame = zone & (((lum(a) > 55) & (a[..., 2] > a[..., 1])) | ((a[..., 2] > a[..., 0] + 90) & (lum(a) > 35)))
        keep = grow(flame, 3) | fixed
        f = smooth(mend(f, lines & ~grow(keep, 1), 3, 1.2), 63, 260, 372, 509, 61, 15, keep)
        f = mend(mend(f, med, 5, 2.4), bet, 4, 1.8)
        a = f.astype(np.float32)
        for y in range(cy - 11, cy + 12):
            L, R = a[y, cx - 6:cx - 4].mean(0), a[y, cx + 5:cx + 7].mean(0)
            for x in range(cx - 4, cx + 5):
                t = (x - (cx - 4.5)) / 9.5
                a[y, x] = L * (1 - t) + R * t
        b = cv2.GaussianBlur(a[cy - 12:cy + 13, cx - 6:cx + 7], (0, 0), 0.6)
        a[cy - 11:cy + 12, cx - 5:cx + 6] = b[1:-1, 1:-1]
        return a.clip(0, 255).astype(np.uint8)
    return run


def clean(frames, run):
    return np.stack([run(f) for f in frames])


def loop(fr):
    n = len(fr)
    a = ((np.arange(FADE) + 1) / (FADE + 1))[:, None, None, None]
    head = (fr[n - FADE:].astype(np.float32) * (1 - a) + fr[:FADE].astype(np.float32) * a).round().astype(np.uint8)
    body = np.concatenate([head, fr[FADE:n - FADE]])
    return body, np.concatenate([body, body[:TAIL]])


def write(frames, name):
    n, h, w, _ = frames.shape
    p = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{w}x{h}', '-r', str(FPS), '-i', '-',
                          '-vf', f'scale={w * UP}:{h * UP}:flags=lanczos,unsharp=5:5:0.45:5:5:0', '-c:v', 'libx264', '-preset', 'veryslow',
                          '-crf', '25', '-pix_fmt', 'yuv420p', '-g', '24', '-profile:v', 'high', '-movflags', '+faststart', '-an',
                          os.path.join(OUT, f'{name}.mp4')], stdin=subprocess.PIPE)
    p.communicate(frames.tobytes())
    first = Image.fromarray(frames[0]).resize((w * UP, h * UP), Image.LANCZOS)
    first.save(os.path.join(OUT, f'scene-{name.split("-")[1]}.webp'), quality=82, method=6)


for src, mk in (('fond-large', cleaner_large), ('fond-haut', cleaner_tall)):
    fr = read(os.path.join(HERE, f'{src}.mp4'))
    fr = clean(fr, mk(fr.mean(0).astype(np.uint8)))
    body, full = loop(fr)
    write(full, src)
    print(src, len(fr), 'frames ->', len(body), 'loop +', TAIL, f'tail = {len(full) / FPS:.3f} s, loop {len(body) / FPS:.4f} s')
