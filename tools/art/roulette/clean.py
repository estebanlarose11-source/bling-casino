# La Roulette: the owner's 2nd video of 16 November 2026 (lancer.mp4, 672 × 448, 10 s): the betting felt with the croupière,
# the camera goes down to the wheel, she launches the ball, close-up on the ball still rolling (one does not see where it
# lands: the game draws the number at random and announces it at the end).
# -> assets/games/roulette/lancer.mp4 (×1,5, silent: the game plays it at each spin)
#    tapis.webp  : its first frame, the felt where the chips go (the 2 « 2 to 1 » painted by mistake in the bottom row and
#                  the scrambled line under ROULETTE erased)
# python3 tools/art/roulette/clean.py   (pip install opencv-python-headless numpy pillow; needs ffmpeg)
import os, subprocess, sys
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, '../../../assets/games/roulette')
W, H, UP = 672, 448, 1.5
ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26]
REDS = {1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36}
FONT = '/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf'

# the close-up (last frame): number tiles of the wheel, left to right, as dividers (outer point, inner point);
# the ball sits in the pocket of tile BALL. Tile i lies between divider i and i + 1.
DIV = [((0, 456), (84, 456)), ((0, 393), (95, 396)), ((0, 330), (108, 334)), ((20, 267), (123, 302)), ((72, 220), (157, 262)),
       ((137, 180), (205, 230)), ((210, 152), (253, 202)), ((303, 124), (325, 183)), ((360, 107), (390, 170)),
       ((440, 104), (457, 164)), ((520, 102), (528, 163)), ((605, 103), (602, 165)), ((684, 106), (676, 168))]
BALL = 7  # tile « 33 » in the video (black)
BLUR = [2.6, 2.2, 1.8, 1.3, 0.9, 0.6, 0.4, 0.3, 0.3, 0.35, 0.45, 0.6]


def read(path):
    raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', path, '-map', '0:v:0', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'])
    return np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3).copy()


def poly_mask(shape, pts, k=1):
    m = np.zeros(shape[:2], np.uint8)
    cv2.fillPoly(m, [np.round(np.array(pts) * k).astype(np.int32)], 1)
    return m.astype(bool)


def inpaint(img, m, r=5):
    return cv2.inpaint(np.ascontiguousarray(img), cv2.dilate(m.astype(np.uint8), np.ones((3, 3), np.uint8)), r, cv2.INPAINT_TELEA)


def color_of(n): return 'g' if n == 0 else 'r' if n in REDS else 'b'


def recolor(a, m, frm, to):
    """tile / pocket pixels of mask m from colour frm to colour to (r, b, g); gold, ball and wood untouched"""
    if frm == to: return
    f = a.astype(np.float32); R, G, B = f[..., 0], f[..., 1], f[..., 2]
    mx, mn = f.max(2), f.min(2)
    red = m & (R - np.maximum(G, B) > 85)
    dark = m & (mx < 95) & (mx - mn < 30)
    src = red if frm == 'r' else dark
    v = np.clip(R / 200 if frm == 'r' else (f.mean(2) + 4) / 34, 0, 1.4)  # shade 0..1
    if to == 'b': new = np.stack([10 + 22 * v, 8 + 20 * v, 8 + 20 * v], -1)
    elif to == 'r': new = np.stack([np.minimum(235, 75 + 140 * v), 8 + 16 * v, 12 + 18 * v], -1)
    else: new = np.stack([8 + 14 * v, 50 + 95 * v, 28 + 50 * v], -1)
    a[src] = new[src].clip(0, 255).astype(np.uint8)


def text_tile(n, w, h):
    """the number on a flat tile (RGBA), upright: its top goes to the wheel's rim"""
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    s = str(n); size = int(h * 0.95)
    while size > 8:
        f = ImageFont.truetype(FONT, size); bb = d.textbbox((0, 0), s, font=f)
        if bb[2] - bb[0] <= w * 0.9 and bb[3] - bb[1] <= h * 0.84: break
        size -= 2
    bb = d.textbbox((0, 0), s, font=f)
    x, y = (w - (bb[2] - bb[0])) / 2 - bb[0], (h - (bb[3] - bb[1])) / 2 - bb[1]
    d.text((x + 1.5, y + 2), s, font=f, fill=(0, 0, 0, 90))
    d.text((x, y), s, font=f, fill=(238, 224, 190, 255))
    return np.asarray(im).astype(np.float32)


def ending(base, n):
    """last frame with pocket BALL = n (base: the last frame ×2, numbers already erased)"""
    k2 = 2
    a = base.copy()
    i0 = ORDER.index(n)
    for t in range(len(DIV) - 1):
        num = ORDER[(i0 + t - BALL) % 37]
        orig = 'b' if (t - BALL) % 2 == 0 else 'r'
        (o0, n0), (o1, n1) = DIV[t], DIV[t + 1]
        tile = [o0, o1, n1, n0]
        tm = poly_mask(a.shape, tile, k2)
        # the pocket under the tile (inside the wheel)
        d0 = np.subtract(n0, o0); d1 = np.subtract(n1, o1)
        pocket = [n0, n1, tuple(np.add(n1, d1 * 0.8)), tuple(np.add(n0, d0 * 0.8))]
        pm = poly_mask(a.shape, pocket, k2)
        recolor(a, tm | (pm if t >= 4 else False), orig, color_of(num))  # far left (blurred): the pockets' frets are not clear enough, only the tiles
        # the number, warped on the tile
        q = np.array(tile, np.float32) * k2
        ins = lambda p, c, f: p + (c - p) * f
        cx = q.mean(0)
        qi = np.array([ins(q[0], cx, .1), ins(q[1], cx, .1), ins(q[2], cx, .14), ins(q[3], cx, .14)], np.float32)
        tw, th = 200, 140
        tex = text_tile(num, tw, th)
        M = cv2.getPerspectiveTransform(np.float32([[0, 0], [tw, 0], [tw, th], [0, th]]), qi)
        warped = cv2.warpPerspective(tex, M, (a.shape[1], a.shape[0]), flags=cv2.INTER_LINEAR)
        if BLUR[t] > 0.35: warped = cv2.GaussianBlur(warped, (0, 0), BLUR[t] * k2 * 0.7)
        al = (warped[..., 3:4] / 255) * tm[..., None]
        a[:] = (a * (1 - al) + warped[..., :3] * al).clip(0, 255).astype(np.uint8)
    # the winning tile: a thin golden light around it
    (o0, n0), (o1, n1) = DIV[BALL], DIV[BALL + 1]
    glow = np.zeros(a.shape[:2], np.float32)
    cv2.polylines(glow, [np.round(np.array([o0, o1, n1, n0]) * k2).astype(np.int32)], True, 1.0, 3, cv2.LINE_AA)
    glow = np.maximum(glow, cv2.GaussianBlur(glow, (0, 0), 6) * 2.2).clip(0, 1)[..., None]
    a[:] = (a * (1 - glow * .85) + np.array([255, 214, 110]) * glow * .85).clip(0, 255).astype(np.uint8)
    return a


def main():
    fr = read(os.path.join(HERE, 'lancer.mp4'))
    # 1. the felt (first frame): the 2 « 2 to 1 » of the bottom row and the scrambled line under ROULETTE
    f0 = fr[0].copy(); a = f0.astype(int)
    cream = (a[..., 0] > 120) & (a[..., 1] > 95) & (a[..., 2] < 150) & (a[..., 0] - a[..., 2] > 25)
    zone = poly_mask(f0.shape, [(409, 379), (522, 379), (523, 410), (410, 410)]) | poly_mask(f0.shape, [(255, 247), (375, 247), (375, 263), (255, 263)])
    f0 = inpaint(f0, cream & zone, 4)
    big = lambda img: Image.fromarray(img).resize((int(W * UP), int(H * UP)), Image.LANCZOS)
    big(f0).save(os.path.join(OUT, 'tapis.webp'), quality=84, method=6)
    # 2. the video (×1,5, a key frame every 12 frames)
    w, h = int(W * UP), int(H * UP)
    fr2 = fr.copy(); fr2[0] = f0
    p = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', '24', '-i', '-',
                          '-vf', f'scale={w}:{h}:flags=lanczos,unsharp=5:5:0.4:5:5:0', '-c:v', 'libx264', '-preset', 'veryslow', '-crf', '26',
                          '-pix_fmt', 'yuv420p', '-g', '12', '-profile:v', 'high', '-movflags', '+faststart', '-an', os.path.join(OUT, 'lancer.mp4')], stdin=subprocess.PIPE)
    p.communicate(fr2.tobytes())
    print('ok')


main()
