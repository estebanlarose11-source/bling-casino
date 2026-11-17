#!/usr/bin/env python3
# Le Plateau Live, la vidéo du bonus (demande du propriétaire du 17 novembre 2026) : sa vidéo plateau.mp4 (1080 × 1920, 6 s,
# avec le son) : un plateau de jeu vu de dessus, 3 dés lancés dans un bocal au centre.
#   - le plateau bouge un tout petit peu (≈ 4 px) : chaque image est recalée sur la dernière (stabilisée) ;
#   - les 4 textes en diagonale au centre du plateau sont effacés (le jeu pose ses propres plaques) ;
#   - une fois les dés posés (image 112 → fin), leurs points sont effacés : le jeu dessine dessus les points de SON tirage ;
#   - le cadre est rogné sur le plateau (lignes 400 à 1440), ×0,8.
# Le tour du plateau (les 40 cases) est recouvert par le jeu (ses cases à multiplicateurs, games/plateaulive.js) : les
# noms d'origine ne se voient plus.
# Sorties : assets/games/plateaulive/plateau.mp4 (+ plateau.webp : 1re image, plateau-fin.webp : dernière) et la
# géométrie (bord du plateau, bord du centre, faces des dés, en % de la vidéo) écrite dans games/plateaulive.js entre
# /* BOARD */ et /* /BOARD */.
# pip install opencv-python-headless numpy pillow ; ffmpeg. python3 tools/art/plateaulive/plateau.py
import json, os, re, subprocess
import numpy as np, cv2
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
OUT = os.path.join(ROOT, 'assets', 'games', 'plateaulive')
SRC = os.path.join(HERE, 'plateau.mp4')
Y0, Y1 = 400, 1440          # rows kept (the board and a little of the table)
SC = 0.8                    # 1080 × 1040 → 864 × 832
SETTLE = 112                # the dice do not move any more from this frame on
JAR = (350, 640, 650, 1035) # x0, y0, x1, y1 of the jar (left out of the stabilisation)
# measured on the last frame (pixels of the 1080 × 1920 video)
OUTER = [(44, 477), (986, 480), (1025, 1342), (9, 1341)]      # outer corners of the white ring of cases
INNER = [(160, 586), (871, 586), (880, 1197), (146, 1197)]    # corners of the blue centre (colour bands included in the ring)
FACES = [  # the face of each die (on top) where the game draws its pips: TL, TR, BR, BL
    [(512, 807), (555, 810), (552, 845), (511, 848)],          # the die at the back
    [(463, 918), (498, 923), (495, 949), (456, 946)],          # front left
    [(508, 916), (544, 914), (547, 947), (511, 950)],          # front right
]


def read(path):
    w, h = map(int, subprocess.check_output(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', path]).decode().split(',')[:2])
    raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', path, '-map', '0:v:0', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'])
    return np.frombuffer(raw, np.uint8).reshape(-1, h, w, 3).copy()


def stabilise(fr):
    """every frame warped onto the last one (homography of the board, jar left out), corner paths smoothed in time"""
    g = [cv2.cvtColor(f, cv2.COLOR_RGB2GRAY) for f in fr]
    m = np.zeros(g[0].shape, np.uint8); m[440:1420] = 255; m[JAR[1]:JAR[3], JAR[0]:JAR[2]] = 0
    orb = cv2.ORB_create(5000); bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
    kb, db = orb.detectAndCompute(g[-1], m)
    C = np.float32([[0, 440], [1080, 440], [1080, 1420], [0, 1420]])
    paths = []
    for k in range(len(g)):
        ka, da = orb.detectAndCompute(g[k], m)
        mt = sorted(bf.match(da, db), key=lambda x: x.distance)[:1200]
        P = np.float32([ka[x.queryIdx].pt for x in mt]); Q = np.float32([kb[x.trainIdx].pt for x in mt])
        H, _ = cv2.findHomography(P, Q, cv2.RANSAC, 2.0)
        paths.append(cv2.perspectiveTransform(C.reshape(-1, 1, 2), H).reshape(-1))
    paths = np.array(paths)
    # light smoothing (the camera drifts slowly; keeps the frame-to-frame jitter out)
    sm = paths.copy()
    for i in range(len(paths)):
        a, b = max(0, i - 3), min(len(paths), i + 4)
        sm[i] = paths[a:b].mean(0)
    sm[-1] = C.reshape(-1)
    out = []
    for k, f in enumerate(fr):
        H = cv2.getPerspectiveTransform(C, sm[k].reshape(4, 2).astype(np.float32))
        out.append(cv2.warpPerspective(f, H, (f.shape[1], f.shape[0]), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE))
    return np.stack(out)


def text_mask(last):
    """the white writing of the blue centre (4 diagonal texts), jar left out"""
    a = last.astype(np.int32); lum = 0.3 * a[..., 0] + 0.59 * a[..., 1] + 0.11 * a[..., 2]
    poly = np.array([(170, 600), (860, 600), (868, 1185), (158, 1185)], np.int32)
    inside = np.zeros(lum.shape, np.uint8); cv2.fillPoly(inside, [poly], 1)
    inside[JAR[1] - 10:JAR[3] + 10, JAR[0] - 10:JAR[2] + 10] = 0
    m = (lum > 105) & (inside > 0)
    return cv2.dilate(m.astype(np.uint8), np.ones((7, 7), np.uint8)) > 0


def pip_mask(last):
    """the dark pips on the 3 dice once they lie still"""
    a = last.astype(np.int32); lum = 0.3 * a[..., 0] + 0.59 * a[..., 1] + 0.11 * a[..., 2]
    m = np.zeros(lum.shape, bool)
    for box in ((500, 795, 568, 860), (448, 905, 503, 985), (503, 905, 556, 975)):
        x0, y0, x1, y1 = box
        sub = lum[y0:y1, x0:x1]
        white = (sub > 175).astype(np.uint8)
        n, lab, st, _ = cv2.connectedComponentsWithStats(white)
        if n < 2: continue
        k = 1 + int(np.argmax(st[1:, 4]))
        hull = cv2.convexHull(np.argwhere(lab == k)[:, ::-1].astype(np.int32))
        hm = np.zeros(sub.shape, np.uint8); cv2.fillConvexPoly(hm, hull, 1)
        hm = cv2.erode(hm, np.ones((3, 3), np.uint8))
        dark = (sub < 120) & (hm > 0)
        m[y0:y1, x0:x1] |= dark
    # the front faces of the 2 front dice (in shade: their pips are only a little darker)
    for poly in ([(451, 945), (498, 949), (495, 979), (453, 977)], [(508, 947), (551, 945), (550, 973), (511, 975)]):
        pm = np.zeros(lum.shape, np.uint8); cv2.fillPoly(pm, [np.array(poly, np.int32)], 1)
        m |= (lum < 112) & (pm > 0)
    return cv2.dilate(m.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0


def mend(f, m, r=5):
    if not m.any(): return f
    g = cv2.inpaint(np.ascontiguousarray(f), m.astype(np.uint8), r, cv2.INPAINT_TELEA)
    b = cv2.GaussianBlur(g, (0, 0), 1.6)
    k = cv2.GaussianBlur(m.astype(np.float32), (0, 0), 1.5)[..., None]
    return (g * (1 - k) + b * k).clip(0, 255).astype(np.uint8)


def main():
    os.makedirs(OUT, exist_ok=True)
    fr = read(SRC)
    print('frames', fr.shape, flush=True)
    fr = stabilise(fr)
    last = fr[-1]
    tm = text_mask(last); pm = pip_mask(last)
    print('text px', int(tm.sum()), 'pip px', int(pm.sum()), flush=True)
    for k in range(len(fr)):
        f = mend(fr[k], tm)
        if k >= SETTLE: f = mend(f, pm, 3)
        fr[k] = f
    fr = fr[:, Y0:Y1]
    n, h, w, _ = fr.shape
    W, H = int(round(w * SC / 2) * 2), int(round(h * SC / 2) * 2)
    tmp = os.path.join('/tmp', 'pl-board.mp4')
    p = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{w}x{h}', '-r', '24', '-i', '-',
                          '-vf', f'scale={W}:{H}:flags=lanczos', '-c:v', 'libx264', '-preset', 'slow', '-crf', '23', '-g', '24',
                          '-pix_fmt', 'yuv420p', '-an', tmp], stdin=subprocess.PIPE)
    p.communicate(fr.tobytes())
    # the sound of his video (the dice in the jar) put back
    subprocess.check_call(['ffmpeg', '-v', 'error', '-y', '-i', tmp, '-i', SRC, '-map', '0:v', '-map', '1:a?', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '96k',
                           '-shortest', '-movflags', '+faststart', os.path.join(OUT, 'plateau.mp4')])
    for k, name in ((0, 'plateau.webp'), (n - 1, 'plateau-fin.webp')):
        Image.fromarray(fr[k]).resize((W, H), Image.LANCZOS).save(os.path.join(OUT, name), quality=84, method=6)
    pc = lambda p: [round(p[0] / w * 100, 3), round((p[1] - Y0) / h * 100, 3)]
    geo = {'w': W, 'h': H, 'settle': round(SETTLE / 24, 3), 'outer': [pc(p) for p in OUTER], 'inner': [pc(p) for p in INNER], 'faces': [[pc(p) for p in f] for f in FACES]}
    js = os.path.join(ROOT, 'games', 'plateaulive.js')
    if os.path.exists(js):
        s = open(js, encoding='utf8').read()
        blob = '/* BOARD */ const BOARD_GEO = ' + json.dumps(geo, separators=(',', ':')) + '; /* /BOARD */'
        s = re.sub(r'/\* BOARD \*/.*?/\* /BOARD \*/', lambda m: blob, s, flags=re.S)
        open(js, 'w', encoding='utf8').write(s)
    print(json.dumps(geo))


if __name__ == '__main__':
    main()
