#!/usr/bin/env python3
# La Roue Folle, les vidéos des bonus (demande du propriétaire du 16 novembre 2026) : ses 3 vidéos (672 × 448, 6 s, avec le son)
#   bonus-pachinko.mp4 : un plateau de Plinko (pyramide de picots, 10 cases peintes en bas) et l'animateur ;
#   bonus-canards.mp4  : un mur de 12 × 11 canards qui se mélangent puis tombent ;
#   bonus-roue.mp4     : une grande roue à 3 flèches (rouge, jaune, bleue), cases écrites, et l'animateur.
# Le jeu pose SES éléments par-dessus (nos 16 cases et notre bille au Plinko, les multiplicateurs sur les canards, notre roue de
# multiplicateurs sur la roue) ; il lui faut :
#   - des vidéos stables (la caméra zoome un peu : chaque image est recalée sur la 1re) ;
#   - Plinko : la bille dorée de la vidéo effacée (la nôtre tombe à sa place) ; roue : le panneau « THE BIG SPIN » effacé ;
#   - Plinko et roue : une boucle sans coupure (le bonus peut durer plus de 6 s) ;
#   - l'animateur détouré (rembg) dans la zone de nos éléments : planche de masques, pour qu'il reste devant eux ;
#   - canards : la place de chacun des 132 canards.
# Sorties : assets/games/madwheel/b-<pa|ch|ct>.mp4 (×2, avec le son) + .webp (1re image) + bmask-<pa|ch|ct>.png, et le suivi
# écrit dans games/madwheel.js entre /* BTRACK */ et /* /BTRACK */.
# pip install opencv-python-headless numpy pillow "rembg[cpu]" ; ffmpeg. python3 tools/art/madwheel/bonus.py [--fast]
import json, os, re, subprocess, sys
import numpy as np, cv2
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'tools', 'art'))
import videobg as vb  # noqa: E402

OUT = os.path.join(ROOT, 'assets', 'games', 'madwheel')
WORK = os.environ.get('MW_WORK', '/tmp/mw-bonus')
W, H = 672, 448
SRC = {'pa': 'bonus-pachinko.mp4', 'ch': 'bonus-canards.mp4', 'ct': 'bonus-roue.mp4'}
# the zone of our elements (and of the host's mask), in video pixels: x0, y0, x1, y1
BOX = {'pa': (0, 16, 504, 412), 'ch': (36, 0, 468, 420), 'ct': (56, 0, 452, 392)}
LOOP = {'pa', 'ct'}
SCALE = 3  # a mask cell = the box / 3
COLS = 12


def stab_mask(k):
    m = np.zeros((H, W), np.uint8)
    if k == 'pa': m[5:400, 5:370] = 255
    elif k == 'ct':
        cv2.ellipse(m, ((253, 200), (420, 400), 0), 255, -1); cv2.ellipse(m, ((253, 200), (350, 330), 0), 0, -1); m[:, 440:] = 0
    else:
        m[:, :460] = 255; m[18:398, 64:442] = 0  # the frame of the wall of ducks and the stage on its left, not the ducks
    return m


def stabilize(fr, k):
    """every frame warped onto the first one (the camera zooms in slowly); the warps are smoothed in time"""
    g = [cv2.cvtColor(f, cv2.COLOR_RGB2GRAY).astype(np.float32) for f in fr]
    m = stab_mask(k); Ws = []; Wp = np.eye(2, 3, dtype=np.float32)
    for n in range(len(fr)):
        try:
            _, Wn = cv2.findTransformECC(g[0], g[n], Wp.copy(), cv2.MOTION_AFFINE, (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 80, 1e-5), m, 5)
        except cv2.error:
            Wn = Wp
        Ws.append(Wn); Wp = Wn
    A = np.array(Ws); S = A.copy()
    for n in range(len(A)):
        a, b = max(0, n - 6), min(len(A), n + 7); S[n] = A[a:b].mean(0)
    out = np.stack([cv2.warpAffine(f, S[n], (W, H), flags=cv2.INTER_LINEAR | cv2.WARP_INVERSE_MAP, borderMode=cv2.BORDER_REPLICATE) for n, f in enumerate(fr)])
    print(f'  {k}: camera {S[-1].round(3).tolist()}', flush=True)
    return out


def hosts(fr, k):
    d = os.path.join(WORK, f'{k}-host'); os.makedirs(d, exist_ok=True)
    out = []; s = None
    for n, f in enumerate(fr):
        p = os.path.join(d, f'{n:03d}.png')
        if not os.path.exists(p):
            from rembg import remove, new_session
            s = s or new_session('u2net_human_seg')
            remove(Image.fromarray(f), session=s, only_mask=True).save(p)
        out.append(np.array(Image.open(p).convert('L')))
    return out


def no_ball(fr, host):
    """Plinko: the video's gold ball is erased (the plate behind it = the median of all the frames)"""
    plate = np.median(fr, axis=0).astype(np.uint8)
    pf = plate.astype(np.int16); n0 = 0
    zone = np.zeros((H, W), bool); zone[20:448, 0:510] = True
    floor = np.zeros((H, W), np.float32); floor[404:H, 0:500] = 1; floor = cv2.GaussianBlur(floor, (0, 0), 4)[..., None]
    out = []
    for f, h in zip(fr, host):
        a = f.astype(np.int16); r, g, b = a[..., 0], a[..., 1], a[..., 2]
        diff = np.abs(a - pf).max(axis=2)
        goldish = (r > 120) & (g > 90) & (b < r - 25) & (r + g > 260)
        m = (zone & (diff > 40) & goldish & (cv2.dilate(h, np.ones((9, 9), np.uint8)) < 60)).astype(np.uint8)
        m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
        k, lab, st, _ = cv2.connectedComponentsWithStats(m)
        keep = np.zeros((H, W), np.uint8)
        for i in range(1, k):
            if st[i, 4] >= 30: keep[lab == i] = 1
        if keep.any():
            n0 += 1
            keep = cv2.dilate(keep, np.ones((15, 15), np.uint8)).astype(np.float32)
            keep = cv2.GaussianBlur(keep, (0, 0), 2.5)[..., None]
            f = (f * (1 - keep) + plate * keep).round().astype(np.uint8)
        # the reflection of his painted cases on the floor (ours are on top of them): blurred away, the host stays in front
        fl = cv2.GaussianBlur(f, (0, 0), 9) * floor + f * (1 - floor)
        hk = np.clip(cv2.GaussianBlur(h.astype(np.float32) / 255, (0, 0), 2), 0, 1)[..., None]
        f = (fl * (1 - hk) + f * hk).round().astype(np.uint8)
        out.append(f)
    print(f'  pa: ball erased on {n0} frames', flush=True)
    return np.stack(out)


def no_sign(fr, host):
    """roue: the words of the sign on the right (« THE BIG SPIN ») erased (from the median frame, the host stays in front)"""
    med = np.median(fr, axis=0).astype(np.uint8)
    a = med.astype(np.int16); r, g, b = a[..., 0], a[..., 1], a[..., 2]
    hsv = cv2.cvtColor(med, cv2.COLOR_RGB2HSV)
    m = np.zeros((H, W), np.uint8)
    word = ((hsv[..., 2] > 140) & ((hsv[..., 1] > 110) | (hsv[..., 2] > 200))) | ((r > 150) & (b < 120))
    m[148:266, 594:W] = word[148:266, 594:W]
    refl = (r > 120) & (r > g + 40)  # its red reflection on the floor
    m[352:430, 585:W] |= refl[352:430, 585:W]
    m = cv2.dilate(m, np.ones((7, 7), np.uint8))
    clean = vb.mend(med, m > 0, 6, 2.5)
    # the face of the wheel (its written cases) under ours: blurred and still, nothing can be read there
    face = np.zeros((H, W), np.float32); cv2.ellipse(face, ((253, 200), (356, 336), 0), 1, -1)
    face = cv2.GaussianBlur(face, (0, 0), 3)
    blur = cv2.GaussianBlur(med, (0, 0), 14)
    clean = (clean * (1 - face[..., None]) + blur * face[..., None]).round().astype(np.uint8)
    k0 = np.maximum(cv2.GaussianBlur(m.astype(np.float32), (0, 0), 2), face)
    k = k0[..., None]
    out = []
    for f, h in zip(fr, host):
        kk = k * (1 - np.clip(h.astype(np.float32) / 255, 0, 1)[..., None])
        out.append((f * (1 - kk) + clean * kk).round().astype(np.uint8))
    return np.stack(out)


def ducks(f0):
    """the 132 ducks of the first frame (12 columns × 11 rows): centre of each, in % of the video"""
    hsv = cv2.cvtColor(f0, cv2.COLOR_RGB2HSV)
    m = ((hsv[..., 1] > 120) & (hsv[..., 2] > 110)).astype(np.uint8)
    m[:, :60] = 0; m[:, 445:] = 0; m[:15] = 0; m[400:] = 0
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    k, lab, st, c = cv2.connectedComponentsWithStats(m)
    C = c[1:][st[1:, 4] > 40]
    X = [85.2, 118.0, 150.7, 182.9, 214.4, 245.3, 276.3, 306.4, 336.1, 365.7, 395.0, 423.4]
    y0, dy = 42.0, 32.9
    for _ in range(4):  # refine the rows
        rows = np.clip(np.round((C[:, 1] - y0) / dy), 0, 10)
        A = np.stack([np.ones(len(C)), rows], 1); y0, dy = np.linalg.lstsq(A, C[:, 1], rcond=None)[0]
    out = []
    for i in range(11):
        for j in range(12):
            px, py = X[j], y0 + i * dy
            near = C[np.hypot(C[:, 0] - px, C[:, 1] - py) < 13]
            if len(near): px, py = near[:, 0].mean(), near[:, 1].mean()
            out.append([round(px / W * 100, 2), round(py / H * 100, 2)])
    return out


def sheet(k, host, n):
    x0, y0, x1, y1 = BOX[k]; cw, chh = (x1 - x0) // SCALE, (y1 - y0) // SCALE
    cells, idx = [], []
    for h in host[:n]:
        c = cv2.dilate(h, np.ones((3, 3), np.uint8))[y0:y1, x0:x1]
        c = cv2.resize(c, (cw, chh), interpolation=cv2.INTER_AREA)
        if (c > 80).mean() < 0.002: idx.append(-1); continue
        idx.append(len(cells)); cells.append(255 - c)
    rows = max(1, (len(cells) + COLS - 1) // COLS)
    S = np.full((rows * chh, COLS * cw), 255, np.uint8)
    for i, c in enumerate(cells): S[(i // COLS) * chh:(i // COLS + 1) * chh, (i % COLS) * cw:(i % COLS + 1) * cw] = c
    a = Image.fromarray(S).filter(ImageFilter.GaussianBlur(0.6))
    Image.merge('RGBA', [Image.new('L', a.size, 255)] * 3 + [a]).save(os.path.join(OUT, f'bmask-{k}.png'), optimize=True)
    return idx, rows


def seam(fr, host, gap=72):
    """the loop: frame j looks most like an earlier frame i (the host at the same place, same pose), at least gap frames apart"""
    sm = np.stack([cv2.resize(f, (168, 112), interpolation=cv2.INTER_AREA) for f in fr]).astype(np.float32)
    hm = np.stack([cv2.resize(h, (168, 112), interpolation=cv2.INTER_AREA) for h in host]).astype(np.float32)
    best = None
    for i in range(4, len(fr) // 2):
        for j in range(i + gap, len(fr) - 1):
            d = np.abs(sm[i] - sm[j]).mean() + 0.5 * np.abs(hm[i] - hm[j]).mean()
            if best is None or d < best[0]: best = (d, i, j)
    return best


def looped(fr, host, i, j, fade=6, tail=12):
    """frames 0..j (the last ones fade into those before i), then i+1.. again: the game jumps back by j - i frames"""
    fr = fr.astype(np.float32); hs = np.stack(host).astype(np.float32)
    out, hout = fr[:j + 1].copy(), hs[:j + 1].copy()
    for q in range(fade):
        a = (q + 1) / (fade + 1); src = j - fade + 1 + q; dst = i - fade + 1 + q
        out[src] = fr[src] * (1 - a) + fr[dst] * a; hout[src] = np.maximum(hs[src] * (1 - a), hs[dst] * a)
    out = np.concatenate([out, fr[i + 1:i + 1 + tail]]); hout = np.concatenate([hout, hs[i + 1:i + 1 + tail]])
    return out.round().astype(np.uint8), list(hout.astype(np.uint8))


def write(k, frames):
    src = os.path.join(HERE, SRC[k]); n = len(frames)
    p = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', '24', '-i', '-', '-i', src,
                          '-map', '0:v', '-map', '1:a', '-vf', f'scale={W * 2}:{H * 2}:flags=lanczos,unsharp=5:5:0.45:5:5:0', '-c:v', 'libx264',
                          '-preset', 'slow', '-crf', '27', '-g', '12', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '112k', '-shortest',
                          '-movflags', '+faststart', os.path.join(OUT, f'b-{k}.mp4')], stdin=subprocess.PIPE)
    p.communicate(frames.tobytes())
    Image.fromarray(frames[0]).resize((W * 2, H * 2), Image.LANCZOS).save(os.path.join(OUT, f'b-{k}.webp'), quality=80, method=6)
    print(f'  b-{k}.mp4: {n} frames', flush=True)


def main():
    os.makedirs(WORK, exist_ok=True)
    data = {}
    for k, f in SRC.items():
        print(k, flush=True)
        fr = stabilize(vb.read(os.path.join(HERE, f)), k)
        host = hosts(fr, k)
        if k == 'pa': fr = no_ball(fr, host)
        if k == 'ct': fr = no_sign(fr, host)
        d = {'w': W, 'h': H, 'box': [round(BOX[k][0] / W * 100, 3), round(BOX[k][1] / H * 100, 3), round(BOX[k][2] / W * 100, 3), round(BOX[k][3] / H * 100, 3)]}
        if k == 'ch': d['ducks'] = ducks(fr[0])
        if k in LOOP:
            dd, i, j = seam(fr, host)
            print(f'  {k}: loop {i} -> {j} (difference {dd:.1f})', flush=True)
            fr, host = looped(fr, host, i, j)
            d['at'] = round((j + 1) / 24, 4); d['loop'] = round((j - i) / 24, 4)
        idx, rows = sheet(k, host, len(fr))
        d.update({'rows': rows, 'cols': COLS, 'f': idx})
        print(f'  {k}: host in front on {sum(1 for i in idx if i >= 0)} / {len(idx)} frames', flush=True)
        if '--fast' not in sys.argv: write(k, fr)
        data[k] = d
    js = os.path.join(ROOT, 'games', 'madwheel.js'); s = open(js, encoding='utf8').read()
    blob = '/* BTRACK */ const BTRACK = ' + json.dumps(data, separators=(',', ':')) + '; /* /BTRACK */'
    s = re.sub(r'/\* BTRACK \*/.*?/\* /BTRACK \*/', lambda m: blob, s, flags=re.S) if '/* BTRACK */' in s else s.replace('/* /TRACK */', '/* /TRACK */\n' + blob, 1)
    open(js, 'w', encoding='utf8').write(s)
    print('ok')


if __name__ == '__main__':
    main()
