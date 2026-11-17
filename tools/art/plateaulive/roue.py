#!/usr/bin/env python3
# Le Plateau Live, l'émission (demande du propriétaire du 17 novembre 2026) : sa vidéo roue.mp4 (1920 × 1080, 10 s, avec le
# son) : une présentatrice à côté d'une grande roue à ampoules, elle la lance, la caméra avance et se déplace.
# (Sa vidéo « téléphone » est la même image avec des bandes noires : le jeu n'utilise que celle-ci et la rogne sur le
# téléphone.) Le jeu pose SA roue (nos 79 cases, son centre à nous) sur la roue de la vidéo : il lui faut, pour chaque image,
#   - la position de la roue : un plan vu en perspective = une homographie (disque unité → image), suivie par la caméra
#     (points du décor et du cadre à ampoules, la roue qui tourne et la présentatrice laissés de côté) ;
#   - là où la présentatrice passe devant la roue (détourée par rembg) : son masque, dans le repère du disque, pour qu'elle
#     reste devant notre roue.
# Sorties : assets/games/plateaulive/roue.mp4 (1280 × 694, bandes noires enlevées, AVEC LE SON) + roue.webp (1re image),
#   assets/games/plateaulive/roue-mask.png (planche des masques), et le suivi écrit dans games/plateaulive.js entre
#   /* TRACK */ et /* /TRACK */.
# pip install opencv-python-headless numpy pillow "rembg[cpu]" ; ffmpeg. python3 tools/art/plateaulive/roue.py [--fast]
import json, os, re, subprocess, sys
import numpy as np, cv2
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
OUT = os.path.join(ROOT, 'assets', 'games', 'plateaulive')
WORK = os.environ.get('PL_WORK', '/tmp/pl-work')
SRC = os.path.join(HERE, 'roue.mp4')
TOP, BOT = 18, 1060             # rows of the picture (black bars above and below)
W, H = 960, 521                 # frames are analysed at half size
# frame 0, measured by hand (pixels of the half-size frames): the edge of the slices (inside the rim of bulbs), its
# left / right / top / bottom, and the centre of the hub (not the centre of the ellipse: the wheel is seen a little from
# the left)
E0 = dict(l=400, r=916, t=11, b=515, hub=(640, 265))
CELL = 128                      # one mask of the sheet, in the disc's frame
COLS = 12


def frames():
    d = os.path.join(WORK, 'roue')
    if not os.path.isdir(d) or len(os.listdir(d)) < 200:
        os.makedirs(d, exist_ok=True)
        subprocess.check_call(['ffmpeg', '-v', 'error', '-y', '-i', SRC, '-vf', f'crop=1920:{BOT - TOP}:0:{TOP},scale={W}:{H}', os.path.join(d, '%03d.png')])
    return sorted(os.path.join(d, f) for f in os.listdir(d) if f.endswith('.png'))


def masks(paths):
    d = os.path.join(WORK, 'roue-mask')
    os.makedirs(d, exist_ok=True)
    todo = [p for p in paths if not os.path.exists(os.path.join(d, os.path.basename(p)))]
    if todo:
        from rembg import remove, new_session
        s = new_session('u2net_human_seg')
        for p in todo: remove(Image.open(p).convert('RGB'), session=s, only_mask=True).save(os.path.join(d, os.path.basename(p)))
    return [np.array(Image.open(os.path.join(d, os.path.basename(p))).convert('L')) for p in paths]


# frame 0, outer edge of the rim of bulbs (half-size pixels): cx, cy, rx, ry; RHO = edge of the slices / outer edge of the rim
OUT0 = (665.0, 263.0, 287.0, 280.0)
RHO = 0.899


def klein(e, hub):
    """homography unit disc → the ellipse e (cx, cy, rx, ry), its centre brought to the hub: an affine map onto the ellipse
    after a projective map of the disc onto itself (Klein model) that moves its centre to the hub (the wheel is seen a little
    from the side: the centre of the wheel is not the centre of its outline)"""
    cx, cy, rx, ry = e
    A = np.array([[rx, 0, cx], [0, ry, cy], [0, 0, 1]], float)
    p = np.array([(hub[0] - cx) / rx, (hub[1] - cy) / ry]); a = min(0.6, np.hypot(*p)); al = np.arctan2(p[1], p[0])
    c, s = np.cos(al), np.sin(al); R = np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])
    k = np.sqrt(1 - a * a); K = np.array([[1, 0, a], [0, k, 0], [a, 0, 1]])
    return A @ R @ K @ R.T


def project(Hm, pts):
    q = np.c_[pts, np.ones(len(pts))] @ Hm.T
    return q[:, :2] / q[:, 2:]


def goldness(im):
    f = im.astype(np.float32); b, g, r = f[..., 0], f[..., 1], f[..., 2]
    return 0.55 * r + 0.45 * g - 0.9 * b  # gold rim and bulbs high, purple stage low


def fit(im, host, e):
    """outer edge of the rim: on rays from the centre, the strongest fall of goldness (rim → stage) near the ellipse e,
    away from the host and the edges of the picture; ellipse fitted on those points (+ number of points kept)"""
    Hh, Ww = im.shape[:2]; s = cv2.GaussianBlur(goldness(im), (5, 5), 0)
    cx, cy, rx, ry = e; pts = []
    for th in np.arange(0, 360, 2.0):
        t = np.radians(th); ca, sa = np.cos(t), np.sin(t)
        rho = np.linspace(0.9, 1.1, 61)
        xs = cx + rho * rx * ca; ys = cy + rho * ry * sa
        if not ((xs >= 3) & (xs < Ww - 4) & (ys >= 3) & (ys < Hh - 4)).all(): continue
        v = cv2.remap(s, xs.astype(np.float32).reshape(1, -1), ys.astype(np.float32).reshape(1, -1), cv2.INTER_LINEAR)[0]
        dv = v[:-3] - v[3:]
        k = int(np.argmax(dv))
        if dv[k] < 40: continue
        r0 = rho[k + 1]
        px, py = cx + r0 * rx * ca, cy + r0 * ry * sa
        x0, y0 = int(px), int(py)
        if host[max(0, y0 - 8):y0 + 9, max(0, x0 - 8):x0 + 9].max() > 40: continue
        pts.append((px, py))
    if len(pts) < 16: return e, 0
    P = np.array(pts, np.float32)
    for _ in range(3):
        (ex, ey), (a, b), ang = cv2.fitEllipse(P)
        t = np.radians(ang); c, s_ = np.cos(t), np.sin(t)
        dx, dy = P[:, 0] - ex, P[:, 1] - ey
        res = np.abs(np.sqrt(((dx * c + dy * s_) / (a / 2)) ** 2 + ((-dx * s_ + dy * c) / (b / 2)) ** 2) - 1)
        keep = res < max(0.012, np.percentile(res, 70))
        if keep.sum() < 14: break
        P = P[keep]
    (ex, ey), (a, b), ang = cv2.fitEllipse(P)
    t = np.radians(ang)
    rxn = np.hypot(a / 2 * np.cos(t), b / 2 * np.sin(t)); ryn = np.hypot(a / 2 * np.sin(t), b / 2 * np.cos(t))
    return (ex, ey, rxn, ryn), len(P)


def track(paths, host):
    """outer edge of the rim and centre of the hub (it does not turn) on every frame, smoothed in time → disc homographies"""
    e = OUT0; raw, q, hubs = [], [], []
    g0 = cv2.cvtColor(cv2.imread(paths[0]), cv2.COLOR_BGR2GRAY)
    hx, hy = E0['hub']; R0 = 46
    tpl0 = g0[hy - R0:hy + R0, hx - R0:hx + R0]
    hub = np.array(E0['hub'], float)
    for k, p in enumerate(paths):
        im = cv2.imread(p); best, n = e, 0
        for _ in range(3):
            ne, m = fit(im, host[k], best)
            if m >= 16 and all(abs(x - y) < 0.08 * max(best[2], best[3]) for x, y in zip(ne, best)): best, n = ne, m
        raw.append(best); q.append(n); e = best
        # the hub: template of frame 0 at the scale of the rim
        sc = best[2] / OUT0[2]; g = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY)
        tpl = cv2.resize(tpl0, None, fx=sc, fy=sc, interpolation=cv2.INTER_AREA)
        th, tw = tpl.shape; pad = 40
        x0, y0 = int(hub[0] - tw / 2 - pad), int(hub[1] - th / 2 - pad)
        x0, y0 = max(0, x0), max(0, y0)
        roi = g[y0:y0 + th + 2 * pad, x0:x0 + tw + 2 * pad]
        r = cv2.matchTemplate(roi, tpl, cv2.TM_CCOEFF_NORMED); _, mv, _, ml = cv2.minMaxLoc(r)
        if mv > 0.35: hub = np.array([x0 + ml[0] + tw / 2, y0 + ml[1] + th / 2])
        hubs.append(hub.copy())
    data = np.c_[np.array(raw), np.array(hubs)]
    sm = smooth(data, q)
    return [klein(tuple(r[:4]), (r[4], r[5])) @ np.diag([RHO, RHO, 1]) for r in sm], q


def smooth(raw, q, win=21):
    raw = np.array(raw, float); q = np.array(q, float); n = len(raw); out = np.zeros_like(raw)
    w0 = np.clip(q / max(1, q.max()), 0.03, 1) ** 2
    for i in range(n):
        a, b = max(0, i - win // 2), min(n, i + win // 2 + 1)
        t = np.arange(a, b) - i; w = w0[a:b] * (1 - (np.abs(t) / (win / 2 + 1)) ** 2)
        for j in range(raw.shape[1]):
            ww = w if j < 4 else np.ones_like(w) * (1 - (np.abs(t) / (win / 2 + 1)) ** 2)
            out[i, j] = np.polyval(np.polyfit(t, raw[a:b, j], 2, w=np.sqrt(ww)), 0)
    return out


def sheet(host, Ds):
    """the host's mask in the disc's frame (CELL × CELL for the square [-1.08, 1.08]²), frames where she covers it"""
    cells, idx = [], []
    S = CELL * 2; sc = 1.08
    Mpix = np.array([[2 * sc / S, 0, -sc], [0, 2 * sc / S, -sc], [0, 0, 1]])  # cell pixel → disc coords
    for k, D in enumerate(Ds):
        m = cv2.dilate(host[k], np.ones((3, 3), np.uint8))
        c = cv2.warpPerspective(m, D @ Mpix, (S, S), flags=cv2.INTER_LINEAR | cv2.WARP_INVERSE_MAP, borderValue=0)
        c = cv2.resize(c, (CELL, CELL), interpolation=cv2.INTER_AREA)
        if (c > 80).mean() < 0.002: idx.append(-1); continue
        idx.append(len(cells)); cells.append(255 - c)
    rows = max(1, (len(cells) + COLS - 1) // COLS)
    Sh = np.zeros((rows * CELL, COLS * CELL), np.uint8)
    for i, c in enumerate(cells): Sh[(i // COLS) * CELL:(i // COLS + 1) * CELL, (i % COLS) * CELL:(i % COLS + 1) * CELL] = c
    a = Image.fromarray(Sh).filter(ImageFilter.GaussianBlur(0.7))
    Image.merge('RGBA', [Image.new('L', a.size, 255)] * 3 + [a]).save(os.path.join(OUT, 'roue-mask.png'), optimize=True)
    return idx, rows


def video():
    subprocess.check_call(['ffmpeg', '-v', 'error', '-y', '-i', SRC, '-vf', f'crop=1920:{BOT - TOP}:0:{TOP},scale=1280:694:flags=lanczos', '-c:v', 'libx264',
                           '-preset', 'slow', '-crf', '29', '-g', '48', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart',
                           os.path.join(OUT, 'roue.mp4')])
    tmp = os.path.join(WORK, 'roue-poster.png')
    subprocess.check_call(['ffmpeg', '-v', 'error', '-y', '-i', SRC, '-frames:v', '1', '-vf', f'crop=1920:{BOT - TOP}:0:{TOP},scale=1280:694:flags=lanczos', tmp])
    Image.open(tmp).save(os.path.join(OUT, 'roue.webp'), quality=80, method=6)


def check(paths, Ds, idx):
    """control pictures: the disc's edge, its centre and 8 spokes drawn on a few frames"""
    th = np.linspace(0, 2 * np.pi, 180); ring = np.c_[np.cos(th), np.sin(th)]
    for k in (0, 70, 120, 170, 200, 240):
        if k >= len(paths): continue
        im = cv2.imread(paths[k]); D = Ds[k]
        cv2.polylines(im, [project(D, ring).astype(np.int32)], True, (0, 255, 0), 1)
        for a in np.linspace(0, 2 * np.pi, 8, endpoint=False):
            seg = project(D, np.array([[0, 0], [np.cos(a), np.sin(a)]]))
            cv2.line(im, tuple(seg[0].astype(int)), tuple(seg[1].astype(int)), (255, 0, 255), 1)
        cv2.imwrite(os.path.join(WORK, f'check-{k:03d}.png'), im)


def main():
    os.makedirs(OUT, exist_ok=True); os.makedirs(WORK, exist_ok=True)
    paths = frames(); host = masks(paths)
    Ds, q = track(paths, host)
    print('weak fits', sum(1 for x in q if x < 16), flush=True)
    idx, rows = sheet(host, Ds)
    check(paths, Ds, idx)
    # per frame: the homography unit disc → picture (in % of its width / height), 8 numbers (h33 = 1), mask cell
    N = np.diag([100 / W, 100 / H, 1])
    f = []
    for D, i in zip(Ds, idx):
        M = N @ D; M = M / M[2, 2]
        f.append([round(float(x), 5) for x in M.reshape(-1)[:8]] + [i])
    data = {'w': 1280, 'h': 694, 'rows': rows, 'cols': COLS, 'f': f}
    print(f'{sum(1 for i in idx if i >= 0)} frames with the host in front of the wheel', flush=True)
    if '--fast' not in sys.argv: video()
    js = os.path.join(ROOT, 'games', 'plateaulive.js')
    if os.path.exists(js):
        s = open(js, encoding='utf8').read()
        blob = '/* TRACK */ const TRACK = ' + json.dumps(data, separators=(',', ':')) + '; /* /TRACK */'
        s = re.sub(r'/\* TRACK \*/.*?/\* /TRACK \*/', lambda m: blob, s, flags=re.S)
        open(js, 'w', encoding='utf8').write(s)
    print('ok')


if __name__ == '__main__':
    main()
