#!/usr/bin/env python3
# La Pêche, la présentatrice (demande du propriétaire du 18 novembre 2026) : sa vidéo presentatrice.mp4 (1280 × 720, 30 images/s,
# 15,6 s ; son original .mov avait du son : enlevé, voulu par le propriétaire) : une présentatrice en robe rouge à côté d'une roue de
# glace (12 grandes parts avec des poissons, un anneau de verre fixe à boulons, un cristal-pointeur en haut). 2 plans : un plan
# large où la caméra avance (images 0 → 238), puis un plan rapproché presque fixe (239 → 468). La vidéo tourne en boucle dans le
# jeu (la fin → le début = une coupe de caméra) et NOTRE roue de 54 cases est posée sur la sienne, dans son anneau fixe.
# Il faut, pour chaque image :
#   - la position de la roue : un plan vu en perspective = une homographie (disque unité → image), suivie sur l'anneau de verre
#     fixe (points SIFT de l'anneau et des boulons, de proche en proche ; les parts qui tournent et le décor laissés de côté) ;
#     disque unité = le bord de ses parts ;
#   - là où la présentatrice passe devant la roue (sa main, vers 9 s ; détourée par rembg) : son masque dans le repère du
#     disque (planche, une case par image), pour qu'elle reste devant notre roue.
# Fichiers fabriqués (assets/games/peche/) :
#   show.mp4 (muette, 1280 × 720) + show.webp (1re image) ; show-mask.png (planche des masques) ;
#   disc.webp   notre disque de 54 cases (SEGS de games/peche.js, case 0 en haut, sens des aiguilles d'une montre) dans le
#               style de sa roue : verre givré (×2 glace), bleu roi (×2 nuit), turquoise / ambre / rubis (les 3 poissons),
#               rayons de verre clair, boulons ;
#   hub.webp    son moyeu de verre (image 400, redressée), posé fixe au-dessus de notre disque ;
#   ptr.webp    son cristal-pointeur (image 380, redressé, recentré sur le haut de la roue) ; au-dessus, celui de la vidéo
#               (plus long dans le plan large) continue ;
# et le suivi écrit dans games/peche.js entre /* SHOW */ et /* /SHOW */.
# pip install opencv-python-headless numpy pillow "rembg[cpu]" ; ffmpeg.
#   python3 tools/art/peche/presentatrice.py [--fast]   (--fast = sans réencoder la vidéo)
import json, os, re, subprocess, sys
import numpy as np, cv2
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
OUT = os.path.join(ROOT, 'assets', 'games', 'peche')
WORK = os.environ.get('PE_WORK', '/tmp/pe-work')
SRC = os.path.join(HERE, 'presentatrice.mp4')
W, H, FPS = 1280, 720, 30
SHOTS = [(0, 239), (239, 469)]  # the 2 shots (the cut is between frames 238 and 239)
# Each shot's first frame, measured (pixels): ellipse of the end of the wheel's parts (cx, cy, rx, ry) and the hub (the wheel is
# seen a little from the left: the centre of the wheel is not the centre of its outline)
REF = {0: dict(e=(801.0, 350.0, 215.0, 222.0), hub=(796, 347)), 239: dict(e=(850.0, 383.0, 281.0, 295.0), hub=(819, 375))}
B = 1.08            # the game's wheel box: 1000 px for [-B, B]² of the disc (like Le Plateau Live)
RD = 1.035          # our disc covers the wheel's parts up to this radius (the fixed glass ring stays from the video)
CELL, COLS = 128, 12

# The game's wheel: the same list as SEGS in games/peche.js (54 cases).
SEG_COUNT = [('w', 22, 0.5), ('s', 22, 0.25), ('fb', 6, 0.4), ('fo', 3, 0.15), ('fr', 1, 0.66)]
SEGS = [k for _, k in sorted(((i + ph) / n + j * 1e-4, k) for j, (k, n, ph) in enumerate(SEG_COUNT) for i in range(n))]
assert len(SEGS) == 54


def frames():
    d = os.path.join(WORK, 'full')
    if not os.path.isdir(d) or len(os.listdir(d)) < 469:
        os.makedirs(d, exist_ok=True)
        subprocess.check_call(['ffmpeg', '-v', 'error', '-y', '-i', SRC, os.path.join(d, '%03d.png')])
    return sorted(os.path.join(d, f) for f in os.listdir(d) if f.endswith('.png'))


def host_masks(paths):
    """the presenter (rembg, half size)"""
    d = os.path.join(WORK, 'host')
    os.makedirs(d, exist_ok=True)
    todo = [p for p in paths if not os.path.exists(os.path.join(d, os.path.basename(p)))]
    if todo:
        from rembg import remove, new_session
        s = new_session('u2net_human_seg')
        for p in todo:
            im = Image.open(p).convert('RGB').resize((W // 2, H // 2), Image.LANCZOS)
            remove(im, session=s, only_mask=True).save(os.path.join(d, os.path.basename(p)))
    return [np.array(Image.open(os.path.join(d, os.path.basename(p))).convert('L')) for p in paths]


def klein(e, hub):
    """homography unit disc → the ellipse e, its centre brought to the hub (see tools/art/plateaulive/roue.py)"""
    cx, cy, rx, ry = e
    A = np.array([[rx, 0, cx], [0, ry, cy], [0, 0, 1]], float)
    p = np.array([(hub[0] - cx) / rx, (hub[1] - cy) / ry]); a = min(0.6, np.hypot(*p)); al = np.arctan2(p[1], p[0])
    c, s = np.cos(al), np.sin(al); R = np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])
    k = np.sqrt(1 - a * a); K = np.array([[1, 0, a], [0, k, 0], [a, 0, 1]])
    return A @ R @ K @ R.T


def project(Hm, pts):
    q = np.c_[pts, np.ones(len(pts))] @ Hm.T
    return q[:, :2] / q[:, 2:]


def ring_mask(D, r0, r1, skip_top=False):
    m = np.zeros((H, W), np.uint8)
    th = np.linspace(0, 2 * np.pi, 360); u = np.c_[np.cos(th), np.sin(th)]
    cv2.fillPoly(m, [project(D, u * r1).astype(np.int32)], 255); cv2.fillPoly(m, [project(D, u * r0).astype(np.int32)], 0)
    if skip_top:  # the crystal pointer changes shape: left out
        a = np.radians(np.linspace(-108, -72, 30))
        cv2.fillPoly(m, [np.r_[project(D, np.array([[0, 0]])), project(D, np.c_[np.cos(a), np.sin(a)] * 1.5)].astype(np.int32)], 0)
    return m


def track(paths):
    """the fixed glass ring (and its bolts) followed from keyframe to keyframe in each shot: homography shot start → frame"""
    sift = cv2.SIFT_create(nfeatures=4000); bf = cv2.BFMatcher(cv2.NORM_L2)
    out = [None] * len(paths); weak = 0
    for a, b in SHOTS:
        D0 = klein(REF[a]['e'], REF[a]['hub']); Hp = np.eye(3); kf = None
        for k in range(a, b):
            g = cv2.cvtColor(cv2.imread(paths[k]), cv2.COLOR_BGR2GRAY)
            if kf is None:
                kp, de = sift.detectAndCompute(g, ring_mask(D0, 1.02, 1.17, True)); kf = (k, np.eye(3), kp, de); out[k] = np.eye(3); continue
            m = cv2.dilate(ring_mask(Hp @ D0, 0.99, 1.22), np.ones((9, 9), np.uint8))
            kp, de = sift.detectAndCompute(g, m)
            ms = bf.knnMatch(kf[3], de, k=2)
            good = [x[0] for x in ms if len(x) == 2 and x[0].distance < 0.75 * x[1].distance]
            Hk, ni = None, 0
            if len(good) >= 12:
                P0 = np.float32([kf[2][x.queryIdx].pt for x in good]); P1 = np.float32([kp[x.trainIdx].pt for x in good])
                Hr, inl = cv2.findHomography(P0, P1, cv2.RANSAC, 2.5, maxIters=5000, confidence=0.999)
                ni = int(inl.sum()) if inl is not None else 0
                if Hr is not None and ni >= 15: Hk = Hr @ kf[1]
            if Hk is None: Hk = Hp; weak += 1
            Hp = Hk; out[k] = Hk
            if ni < 120 or k - kf[0] >= 12:
                kp2, de2 = sift.detectAndCompute(g, ring_mask(Hk @ D0, 1.02, 1.17, True)); kf = (k, Hk, kp2, de2)
    print('weak frames', weak, flush=True)
    Ds = [out[k] @ klein(REF[a]['e'], REF[a]['hub']) for a, b in SHOTS for k in range(a, b)]
    return smooth(Ds)


def smooth(Ds, win=9):
    """the 4 corners of the unit square, smoothed in time inside each shot (local quadratic fit), → homographies"""
    sq = np.float32([[-1, -1], [1, -1], [1, 1], [-1, 1]])
    P = np.array([project(D, sq).reshape(-1) for D in Ds])
    out = []
    for a, b in SHOTS:
        for i in range(a, b):
            lo, hi = max(a, i - win // 2), min(b, i + win // 2 + 1)
            t = np.arange(lo, hi) - i; w = 1 - (np.abs(t) / (win / 2 + 1)) ** 2
            q = np.array([np.polyval(np.polyfit(t, P[lo:hi, j], 2, w=np.sqrt(w)), 0) for j in range(8)], np.float32).reshape(4, 2)
            out.append(cv2.getPerspectiveTransform(sq, q).astype(float))
    return out


def front(im, D, x0, y0, x1, y1, U, interp=cv2.INTER_CUBIC):
    """the picture redressed: disc coordinates [x0, x1] × [y0, y1] at U pixels per unit"""
    M = np.array([[1 / U, 0, x0], [0, 1 / U, y0], [0, 0, 1]])
    return cv2.warpPerspective(im, D @ M, (int(round((x1 - x0) * U)), int(round((y1 - y0) * U))), flags=interp | cv2.WARP_INVERSE_MAP)


def sheet(host, Ds):
    """the presenter's mask in the disc's frame (CELL × CELL for [-B, B]²), frames where she covers the wheel"""
    cells, idx = [], []
    S = CELL * 2; Hf = np.diag([0.5, 0.5, 1])
    Mpix = np.array([[2 * B / S, 0, -B], [0, 2 * B / S, -B], [0, 0, 1]])
    yy, xx = np.mgrid[0:S, 0:S]; rr = np.hypot((xx + 0.5) * 2 * B / S - B, (yy + 0.5) * 2 * B / S - B)
    for k, D in enumerate(Ds):
        m = cv2.dilate(host[k], np.ones((3, 3), np.uint8))
        c = cv2.warpPerspective(m, Hf @ D @ Mpix, (S, S), flags=cv2.INTER_LINEAR | cv2.WARP_INVERSE_MAP, borderValue=0)
        if (c[rr < RD + 0.02] > 80).mean() < 0.0015: idx.append(-1); continue
        c = cv2.resize(c, (CELL, CELL), interpolation=cv2.INTER_AREA)
        idx.append(len(cells)); cells.append(255 - c)
    rows = max(1, (len(cells) + COLS - 1) // COLS)
    Sh = np.zeros((rows * CELL, COLS * CELL), np.uint8)
    for i, c in enumerate(cells): Sh[(i // COLS) * CELL:(i // COLS + 1) * CELL, (i % COLS) * CELL:(i % COLS + 1) * CELL] = c
    a = Image.fromarray(Sh).filter(ImageFilter.GaussianBlur(0.7))
    Image.merge('RGBA', [Image.new('L', a.size, 255)] * 3 + [a]).save(os.path.join(OUT, 'show-mask.png'), optimize=True)
    return idx, rows


def noise(n, seed, scales=((4, 0.5), (16, 0.3), (64, 0.2))):
    """fractal noise in [-1, 1]"""
    rs = np.random.RandomState(seed); out = np.zeros((n, n), np.float32)
    for s, w in scales:
        g = rs.randn(s, s).astype(np.float32)
        out += w * cv2.resize(g, (n, n), interpolation=cv2.INTER_CUBIC)
    return out / max(1e-6, np.abs(out).max())


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)


def disc(N=1200):
    """our 54 cases in the style of her wheel (see the header)"""
    U = N / 2 / RD
    yy, xx = np.mgrid[0:N, 0:N].astype(np.float32)
    x = (xx + 0.5 - N / 2) / U; y = (yy + 0.5 - N / 2) / U
    r = np.hypot(x, y); th = np.mod(np.arctan2(x, -y), 2 * np.pi)  # from the top, clockwise
    A = 2 * np.pi / 54; ci = np.minimum(53, (th / A).astype(int)); f = th / A - ci
    kind = np.array(SEGS)[ci]
    n1, n2, n3 = noise(N, 1), noise(N, 2, ((32, 0.4), (128, 0.4), (300, 0.2))), noise(N, 3, ((200, 0.5), (500, 0.5)))
    # frost: streaks along the radius (noise stretched in polar coordinates) and sparkles
    pol = cv2.resize(noise(256, 4, ((6, 0.3), (40, 0.4), (120, 0.3))), (256, 1024), interpolation=cv2.INTER_CUBIC)
    streak = cv2.remap(pol, (th / (2 * np.pi) * 255).astype(np.float32), (np.clip(r / RD, 0, 1) * 1023).astype(np.float32), cv2.INTER_LINEAR)
    spark = np.clip((n3 - 0.82) * 6, 0, 1)
    t = smoothstep(0.2, 0.97, r)[..., None]
    def lerp(c0, c1): return np.array(c0, np.float32) * (1 - t) + np.array(c1, np.float32) * t
    col = np.zeros((N, N, 3), np.float32)
    glow = np.exp(-((f - 0.5) / 0.32) ** 2)[..., None]  # light in the middle of each case (thick glass)
    base = {
        'w': lerp((0.48, 0.66, 0.87), (0.68, 0.83, 0.95)),
        's': lerp((0.04, 0.14, 0.50), (0.09, 0.27, 0.80)),
        'fb': lerp((0.03, 0.42, 0.66), (0.16, 0.74, 0.95)),
        'fo': lerp((0.62, 0.24, 0.03), (0.98, 0.58, 0.16)),
        'fr': lerp((0.45, 0.02, 0.08), (0.88, 0.12, 0.18)),
    }
    for k, c in base.items():
        m = (kind == k)[..., None]
        g = glow * (0.12 if k == 'w' else 0.2)
        tex = (streak * (0.13 if k == 'w' else 0.06) + n2 * (0.06 if k == 'w' else 0.05))[..., None]
        col = np.where(m, c + g + tex, col)
    # sparkles of frost, more on the light glass
    sw = np.where(kind == 'w', 0.45, 0.22)
    col += (spark * sw)[..., None]
    # the clear glass spokes between the cases (width in pixels), with a thin shadow
    cw = r * A * U  # case width in pixels at this radius
    d = np.minimum(f, 1 - f) * cw
    spoke = (1 - smoothstep(0.7, 2.0, d)) * smoothstep(0.2, 0.26, r) * 0.85
    shade = (smoothstep(2.4, 3.2, d) * (1 - smoothstep(3.6, 5.5, d)))
    col = col * (1 - 0.18 * shade[..., None])
    col = col * (1 - spoke[..., None]) + np.array([0.88, 0.95, 1.0], np.float32) * spoke[..., None]
    # golden edge for the red fish (the rarest case)
    gold = (kind == 'fr') & (d < 5.5) & (d > 2.2) & (r > 0.24) & (r < 0.95)
    col[gold] = col[gold] * 0.3 + np.array([1.0, 0.82, 0.32]) * 0.7
    # a clear glass band at the edge (the end of the parts), then it fades into her fixed ring
    band = smoothstep(0.935, 0.965, r)
    bandc = (np.array([0.66, 0.79, 0.93], np.float32) + (streak * 0.08 + n2 * 0.05)[..., None] + (0.10 * np.exp(-((r - 0.972) / 0.01) ** 2))[..., None])
    col = col * (1 - band[..., None]) + bandc * band[..., None]
    # the shadow of the hub, and a little depth toward the edge
    col *= (0.78 + 0.22 * smoothstep(0.2, 0.42, r))[..., None]
    # bolts every 3 cases, on the spokes, near the edge
    for i in range(0, 54, 3):
        a = i * A; bx, by = 0.905 * np.sin(a), -0.905 * np.cos(a)
        dd = np.hypot(x - bx, y - by) / 0.019
        m = dd < 1.25
        sh = np.clip(1 - dd, 0, 1)
        hl = np.exp(-((x - bx + 0.006) ** 2 + (y - by + 0.007) ** 2) / (0.006 ** 2))
        bolt = np.stack([0.55 + 0.35 * sh + 0.4 * hl] * 3, -1) * np.array([0.92, 0.96, 1.0])
        edge = np.clip((1.25 - dd) / 0.25, 0, 1)[..., None]
        col = np.where(m[..., None], col * (1 - edge) + bolt * edge, col)
    col = np.clip(col, 0, 1)
    alpha = 1 - smoothstep(RD - 0.035, RD, r)
    rgba = np.dstack([col * 255, alpha * 255]).astype(np.uint8)
    Image.fromarray(rgba, 'RGBA').save(os.path.join(OUT, 'disc.webp'), quality=86, method=6)


def hub(paths, Ds, k=400, R=0.225, U=640):
    im = cv2.imread(paths[k]); f = front(im, Ds[k], -R, -R, R, R, U)
    n = f.shape[0]; yy, xx = np.mgrid[0:n, 0:n]; rr = np.hypot(xx + 0.5 - n / 2, yy + 0.5 - n / 2) / U
    a = (1 - smoothstep(R - 0.014, R, rr)) * 255
    Image.fromarray(np.dstack([cv2.cvtColor(f, cv2.COLOR_BGR2RGB), a.astype(np.uint8)]), 'RGBA').save(os.path.join(OUT, 'hub.webp'), quality=88, method=6)


# the crystal of frame 380, redressed at 600 px per unit from (-0.4, -1.35): its outline (pixels of that crop), its axis is at
# x = -0.035 (moved to 0: the game's pointer is right above the centre)
PTR_POLY = [(95, 37), (104, 18), (160, 6), (346, 38), (344, 44), (325, 90), (280, 190), (246, 272), (224, 313), (210, 313),
            (199, 290), (170, 210), (130, 125)]
PTR_AX = -0.035
PTR_BOX = (-0.27, -1.36, 0.27, -0.80)  # what ptr.webp covers, in disc units


def pointer(paths, Ds, k=380, U=600):
    im = cv2.imread(paths[k])
    x0, y0 = -0.4, -1.35
    cr = cv2.cvtColor(front(im, Ds[k], x0, y0, 0.4, -0.7, U), cv2.COLOR_BGR2RGB).astype(np.float32)
    m = np.zeros(cr.shape[:2], np.float32)
    cv2.fillPoly(m, [np.int32(PTR_POLY)], 1.0)
    bx0, by0, bx1, by1 = PTR_BOX
    OW, OH = int((bx1 - bx0) * U), int((by1 - by0) * U)
    out = np.zeros((OH, OW, 3), np.float32); al = np.zeros((OH, OW), np.float32)
    # place the crystal crop: crop x = (X + PTR_AX - x0) * U, crop y = (Y - y0) * U
    ox = int(round((bx0 + PTR_AX - x0) * U)); oy = int(round((by0 - y0) * U))  # crop pixel at out (0, 0)
    for yy in range(OH):
        cy = yy + oy
        if 0 <= cy < cr.shape[0]:
            row = cr[cy, max(0, ox):ox + OW]; mr = m[cy, max(0, ox):ox + OW]
            out[yy, :len(row)] = row; al[yy, :len(row)] = mr
    al = cv2.GaussianBlur(al, (0, 0), 1.2)
    rgba = np.dstack([np.clip(out, 0, 255), np.clip(al * 255, 0, 255)]).astype(np.uint8)
    Image.fromarray(rgba, 'RGBA').save(os.path.join(OUT, 'ptr.webp'), quality=90, method=6)


def video():
    subprocess.check_call(['ffmpeg', '-v', 'error', '-y', '-i', SRC, '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '30', '-g', '30',
                           '-pix_fmt', 'yuv420p', '-movflags', '+faststart', os.path.join(OUT, 'show.mp4')])
    tmp = os.path.join(WORK, 'poster.png')
    subprocess.check_call(['ffmpeg', '-v', 'error', '-y', '-i', SRC, '-frames:v', '1', tmp])
    Image.open(tmp).save(os.path.join(OUT, 'show.webp'), quality=80, method=6)


def check(paths, Ds):
    th = np.linspace(0, 2 * np.pi, 240); u = np.c_[np.cos(th), np.sin(th)]
    tiles = []
    for k in (0, 60, 120, 180, 238, 239, 300, 360, 420, 468):
        im = cv2.imread(paths[k]); D = Ds[k]
        for r, c in ((1, (0, 255, 0)), (RD, (255, 0, 255)), (1.15, (0, 200, 255))): cv2.polylines(im, [project(D, u * r).astype(np.int32)], True, c, 2)
        cv2.putText(im, str(k), (20, 40), 0, 1.2, (0, 255, 255), 3)
        tiles.append(cv2.resize(im, (640, 360)))
    cv2.imwrite(os.path.join(WORK, 'check.jpg'), np.vstack([np.hstack(tiles[i:i + 2]) for i in range(0, len(tiles), 2)]))


def main():
    os.makedirs(OUT, exist_ok=True); os.makedirs(WORK, exist_ok=True)
    paths = frames()
    Ds = track(paths)
    check(paths, Ds)
    host = host_masks(paths)
    idx, rows = sheet(host, Ds)
    print(f'{sum(1 for i in idx if i >= 0)} frames with the presenter in front of the wheel', flush=True)
    disc(); hub(paths, Ds); pointer(paths, Ds)
    N = np.diag([100 / W, 100 / H, 1])
    f = []
    for D, i in zip(Ds, idx):
        M = N @ D; M = M / M[2, 2]
        f.append([round(float(x), 5) for x in M.reshape(-1)[:8]] + [i])
    data = {'fps': FPS, 'rows': rows, 'cols': COLS, 'f': f}
    if '--fast' not in sys.argv: video()
    js = os.path.join(ROOT, 'games', 'peche.js')
    s = open(js, encoding='utf8').read()
    blob = '/* SHOW */ const SHOW = ' + json.dumps(data, separators=(',', ':')) + '; /* /SHOW */'
    s, n = re.subn(r'/\* SHOW \*/.*?/\* /SHOW \*/', lambda m: blob, s, flags=re.S)
    if n: open(js, 'w', encoding='utf8').write(s)
    else: open(os.path.join(WORK, 'show.js'), 'w').write(blob); print('no /* SHOW */ in games/peche.js: written to', os.path.join(WORK, 'show.js'))
    print('ok')


if __name__ == '__main__':
    main()
