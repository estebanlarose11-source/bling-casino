#!/usr/bin/env python3
# La Roue Folle, le jeu télé (demande du propriétaire du 16 novembre 2026) : ses 2 vidéos d'un animateur qui lance une
# grande roue sur un plateau (show-large.mp4 736 × 400 : ordinateur ; show-haut.mp4 400 × 736 : téléphone, roue vue de biais)
# et sa roue (roue.jpg : cadre doré à ampoules, moyeu au tourbillon). Le jeu pose SA roue (dessinée avec nos 54 cases) sur la
# roue de la vidéo et la fait tourner lui-même : il lui faut, pour chaque image de chaque vidéo,
#   - l'ellipse de la roue de la vidéo (centre et rayons, suivie image par image sur le bord doré, en ignorant l'animateur) ;
#   - là où l'animateur passe devant la roue (détouré par rembg) : un masque, pour qu'il reste devant notre roue.
# Sorties :
#   assets/games/madwheel/show-large.mp4 / show-haut.mp4 (×2, AVEC LE SON) + show-*.webp (1re image),
#   assets/games/madwheel/mask-large.png / mask-haut.png (planche des masques), rim.webp + hub.webp (de roue.jpg),
#   et le suivi écrit dans games/madwheel.js entre /* TRACK */ et /* /TRACK */.
# pip install opencv-python-headless numpy pillow "rembg[cpu]" ; ffmpeg. python3 tools/art/madwheel/build.py [--fast]
import json, os, re, subprocess, sys
import numpy as np, cv2
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
OUT = os.path.join(ROOT, 'assets', 'games', 'madwheel')
WORK = os.environ.get('MW_WORK', '/tmp/mw-work')
FPS = 24
# the wheel of the first frame (outer edge of its gold rim), measured by hand: cx, cy, rx, ry in video pixels
INIT = {'large': (541.5, 167.5, 130.5, 132.5), 'haut': (345, 345, 110, 155)}
# the box of our wheel (and of its mask), around the video's ellipse: room for our pointer above the rim
BOX = (1.05, 1.16, 1.05, 1.05)  # left, top, right, bottom, in radii
CELL = (120, 136)  # one mask in the sheet (w, h)
COLS = 12


def frames(name):
    d = os.path.join(WORK, name)
    if not os.path.isdir(d) or len(os.listdir(d)) < 200:
        os.makedirs(d, exist_ok=True)
        subprocess.check_call(['ffmpeg', '-v', 'error', '-y', '-i', os.path.join(HERE, f'show-{name}.mp4'), os.path.join(d, '%03d.png')])
    return sorted(os.path.join(d, f) for f in os.listdir(d) if f.endswith('.png'))


def masks(name, paths):
    d = os.path.join(WORK, name + '-mask')
    os.makedirs(d, exist_ok=True)
    todo = [p for p in paths if not os.path.exists(os.path.join(d, os.path.basename(p)))]
    if todo:
        from rembg import remove, new_session
        s = new_session('u2net_human_seg')
        for k, p in enumerate(todo):
            m = remove(Image.open(p).convert('RGB'), session=s, only_mask=True)
            m.save(os.path.join(d, os.path.basename(p)))
            if k % 40 == 0: print(f'  {name}: host masks {k}/{len(todo)}', flush=True)
    return [np.array(Image.open(os.path.join(d, os.path.basename(p))).convert('L')) for p in paths]


def goldness(im):
    f = im.astype(np.float32); b, g, r = f[..., 0], f[..., 1], f[..., 2]
    return 0.55 * r + 0.45 * g - 0.9 * b  # gold rim high, stage (blue / purple) low


def fit(im, host, e):
    """Edge points of the rim around the ellipse e (rays from its centre), outside the host; fitted ellipse + quality."""
    H, W = im.shape[:2]; s = cv2.GaussianBlur(goldness(im), (3, 3), 0)
    cx, cy, rx, ry = e; pts = []
    for th in np.arange(0, 360, 2.5):
        t = np.radians(th); ca, sa = np.cos(t), np.sin(t)
        rho = np.linspace(0.86, 1.14, 57)
        xs = cx + rho * rx * ca; ys = cy + rho * ry * sa
        if ((xs >= 1) & (xs < W - 2) & (ys >= 1) & (ys < H - 2)).sum() < 50: continue
        v = cv2.remap(s, xs.astype(np.float32).reshape(1, -1), ys.astype(np.float32).reshape(1, -1), cv2.INTER_LINEAR)[0]
        dv = v[:-1] - v[1:]
        k = int(np.argmax(dv))
        if dv[k] < 18: continue
        r0 = (rho[k] + rho[k + 1]) / 2
        px, py = cx + r0 * rx * ca, cy + r0 * ry * sa
        # skip edges on or next to the host (his hands, his suit)
        x0, y0 = int(np.clip(px, 0, W - 1)), int(np.clip(py, 0, H - 1))
        if host[max(0, y0 - 6):y0 + 7, max(0, x0 - 6):x0 + 7].max() > 60: continue
        pts.append((px, py))
    if len(pts) < 14: return e, 0
    P = np.array(pts, np.float32)
    for _ in range(3):
        (ex, ey), (a, b), ang = cv2.fitEllipse(P)
        t = np.radians(ang); c, s_ = np.cos(t), np.sin(t)
        dx, dy = P[:, 0] - ex, P[:, 1] - ey
        res = np.abs(np.sqrt(((dx * c + dy * s_) / (a / 2)) ** 2 + ((-dx * s_ + dy * c) / (b / 2)) ** 2) - 1)
        keep = res < max(0.02, np.percentile(res, 75))
        if keep.sum() < 12: break
        P = P[keep]
    (ex, ey), (a, b), ang = cv2.fitEllipse(P)
    t = np.radians(ang)
    rxn = np.hypot(a / 2 * np.cos(t), b / 2 * np.sin(t)); ryn = np.hypot(a / 2 * np.sin(t), b / 2 * np.cos(t))
    return (ex, ey, rxn, ryn), len(P)


def smooth(raw, q, win=31):
    """Each parameter follows a smooth curve in time: weighted local quadratic fits (good frames weigh more)."""
    raw = np.array(raw); q = np.array(q, float); n = len(raw); out = np.zeros_like(raw)
    w0 = np.clip(q / max(1, q.max()), 0.02, 1) ** 2
    for i in range(n):
        a, b = max(0, i - win // 2), min(n, i + win // 2 + 1)
        t = np.arange(a, b) - i; w = w0[a:b] * (1 - (np.abs(t) / (win / 2 + 1)) ** 2)
        for j in range(raw.shape[1]):
            c = np.polyfit(t, raw[a:b, j], 2, w=np.sqrt(w))
            out[i, j] = c[-1]
    return out


# Where the rim can no longer be seen (téléphone: the host in front of it and its right half out of the picture at the
# end), the wheel follows the camera instead: the stage around it (ORB points, the host left out) moved from a frame
# where the fit was good. name: (reference frame, first frame that uses it), 1-based.
CAM = {'haut': (180, 198)}


def camera(paths, host, ref, e):
    orb = cv2.ORB_create(3000); bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
    def feats(k):
        g = cv2.cvtColor(cv2.imread(paths[k]), cv2.COLOR_BGR2GRAY)
        m = (cv2.dilate((host[k] > 60).astype(np.uint8), np.ones((15, 15), np.uint8)) == 0).astype(np.uint8) * 255
        return orb.detectAndCompute(g, m)
    ka, da = feats(ref); cx, cy, rx, ry = e; out = {}
    for k in range(ref, len(paths)):
        kb, db = feats(k)
        mt = sorted(bf.match(da, db), key=lambda x: x.distance)[:600]
        P = np.float32([ka[m.queryIdx].pt for m in mt]); Q = np.float32([kb[m.trainIdx].pt for m in mt])
        M, _ = cv2.estimateAffinePartial2D(P, Q, ransacReprojThreshold=2.5)
        sc = np.hypot(M[0, 0], M[1, 0]); c = M @ np.array([cx, cy, 1])
        out[k] = (c[0], c[1], rx * sc, ry * sc)
    return out


def track(name):
    paths = frames(name)
    host = masks(name, paths)
    e = INIT[name]; raw, q = [], []
    for k, p in enumerate(paths):
        im = cv2.imread(p); best, n = e, 0
        for _ in range(2):
            ne, m = fit(im, host[k], best)
            if m >= 14 and all(abs(x - y) < 0.12 * max(best[2], best[3]) for x, y in zip(ne, best)): best, n = ne, m
        raw.append(best); q.append(n); e = best
    sm = smooth(raw, q)
    sm = smooth(sm, [1] * len(sm), 15)
    if name in CAM:
        ref, start = CAM[name][0] - 1, CAM[name][1] - 1
        cam = camera(paths, host, ref, tuple(sm[ref]))
        for k in range(start, len(paths)):
            a = min(1, (k - start) / 8)  # cross-fade over 8 frames
            sm[k] = (1 - a) * sm[k] + a * np.array(cam[k])
        sm[start - 8:] = smooth(sm[start - 8:], [1] * (len(sm) - start + 8), 11)
    return paths, host, sm, q


def sheet(name, paths, host, T):
    H, W = host[0].shape
    cells, idx = [], []
    for k, (cx, cy, rx, ry) in enumerate(T):
        x0, y0, x1, y1 = cx - BOX[0] * rx, cy - BOX[1] * ry, cx + BOX[2] * rx, cy + BOX[3] * ry
        m = cv2.dilate(host[k], np.ones((3, 3), np.uint8))
        # crop the box (outside the video = no host), as many pixels as the box, then the cell size
        M = np.float32([[CELL[0] * 2 / (x1 - x0), 0, -x0 * CELL[0] * 2 / (x1 - x0)], [0, CELL[1] * 2 / (y1 - y0), -y0 * CELL[1] * 2 / (y1 - y0)]])
        c = cv2.warpAffine(m, M, (CELL[0] * 2, CELL[1] * 2), flags=cv2.INTER_AREA, borderValue=0)
        c = cv2.resize(c, CELL, interpolation=cv2.INTER_AREA)
        if (c > 80).mean() < 0.004: idx.append(-1); continue
        idx.append(len(cells)); cells.append(255 - c)  # alpha: our wheel shows where the host is not
    rows = max(1, (len(cells) + COLS - 1) // COLS)
    S = np.zeros((rows * CELL[1], COLS * CELL[0]), np.uint8)
    for i, c in enumerate(cells): S[(i // COLS) * CELL[1]:(i // COLS + 1) * CELL[1], (i % COLS) * CELL[0]:(i % COLS + 1) * CELL[0]] = c
    a = Image.fromarray(S).filter(ImageFilter.GaussianBlur(0.6))
    rgba = Image.merge('RGBA', [Image.new('L', a.size, 255)] * 3 + [a])
    rgba.save(os.path.join(OUT, f'mask-{name}.png'), optimize=True)
    return idx, rows


def video(name):
    src = os.path.join(HERE, f'show-{name}.mp4')
    subprocess.check_call(['ffmpeg', '-v', 'error', '-y', '-i', src, '-vf', 'scale=iw*2:ih*2:flags=lanczos', '-c:v', 'libx264', '-preset', 'slow', '-crf', '24',
                           '-g', '24', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', os.path.join(OUT, f'show-{name}.mp4')])
    subprocess.check_call(['ffmpeg', '-v', 'error', '-y', '-i', src, '-frames:v', '1', '-vf', 'scale=iw*2:ih*2:flags=lanczos', os.path.join(WORK, f'{name}-poster.png')])
    Image.open(os.path.join(WORK, f'{name}-poster.png')).save(os.path.join(OUT, f'show-{name}.webp'), quality=82)


def wheel_parts():
    im = Image.open(os.path.join(HERE, 'roue.jpg')).convert('RGB')
    a = np.array(im).astype(int)
    on = a.sum(axis=2) > 90
    ys, xs = np.where(on[100:1050]); ys = ys + 100
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    S = 1024
    sq = im.crop((x0, y0, x1 + 1, y1 + 1)).resize((S, S), Image.LANCZOS)  # the slightly oval painting made round
    yy, xx = np.mgrid[:S, :S]; r = np.hypot(xx - S / 2 + 0.5, yy - S / 2 + 0.5) / (S / 2)
    def alpha(lo, hi, soft=0.004):
        return np.clip(np.minimum((r - lo) / soft + 0.5, (hi - r) / soft + 0.5), 0, 1)
    rim = sq.convert('RGBA'); rim.putalpha(Image.fromarray((alpha(0.885, 0.998) * 255).astype(np.uint8)))
    rim.save(os.path.join(OUT, 'rim.webp'), quality=88)
    hub = sq.crop((S // 2 - 136, S // 2 - 136, S // 2 + 136, S // 2 + 136)).convert('RGBA')
    hy, hx = np.mgrid[:272, :272]; hr = np.hypot(hx - 135.5, hy - 135.5) / 136
    hub.putalpha(Image.fromarray((np.clip((0.905 - hr) / 0.02 + 0.5, 0, 1) * 255).astype(np.uint8)))  # its gold ring, not the slices around
    hub.save(os.path.join(OUT, 'hub.webp'), quality=90)


def main():
    os.makedirs(OUT, exist_ok=True); os.makedirs(WORK, exist_ok=True)
    wheel_parts()
    data = {}
    for name in ('large', 'haut'):
        print(f'{name}: tracking the wheel', flush=True)
        paths, host, T, q = track(name)
        H, W = host[0].shape
        idx, rows = sheet(name, paths, host, T)
        # per frame: cx %, cy %, rx %, ry % (of the video's width / height), mask cell (-1: the host is not in front)
        data[name] = {'w': W, 'h': H, 'rows': rows, 'cols': COLS, 'f': [[round(cx / W * 100, 2), round(cy / H * 100, 2), round(rx / W * 100, 2), round(ry / H * 100, 2), i] for (cx, cy, rx, ry), i in zip(T.tolist(), idx)]}
        print(f'  {name}: {sum(1 for i in idx if i >= 0)} frames with the host in front, weak fits {sum(1 for x in q if x < 14)}', flush=True)
        if '--fast' not in sys.argv: video(name)
    js = os.path.join(ROOT, 'games', 'madwheel.js'); s = open(js, encoding='utf8').read()
    blob = '/* TRACK */ const TRACK = ' + json.dumps(data, separators=(',', ':')) + '; /* /TRACK */'
    s = re.sub(r'/\* TRACK \*/.*?/\* /TRACK \*/', lambda m: blob, s, flags=re.S) if '/* TRACK */' in s else s.replace('/* ===END ENGINE */', '/* ===END ENGINE */\n' + blob, 1)
    open(js, 'w', encoding='utf8').write(s)
    print('ok')


if __name__ == '__main__':
    main()
