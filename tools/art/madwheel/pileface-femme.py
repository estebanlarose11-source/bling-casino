#!/usr/bin/env python3
# La Roue Folle, Pile ou Face avec la présentatrice du Plateau Live (demande du propriétaire du 18 novembre 2026).
# Sa vidéo bonus-pileface.mp4 (1080 × 1920, 12 s) : gros plan, la caméra bouge, l'animateur lance le palet rouge qui retombe dans le
# bocal. L'effacer de tout le gros plan laissait des traces : c'est donc un montage (make()) :
#   1. plan fixe du décor (images 0 à 57, caméra immobile, sa main et le palet enlevés : plate()) avec ELLE derrière la table, qui
#      annonce (2,5 s) ;
#   2. coupe sur la caméra qui suit le palet (images 96 → fin, cadre CAM sur la partie droite) : il retombe dans le bocal, gros plan ;
#      au bord du cadre, la main de l'animateur est remplacée par les autres images (remove_man : caméra suivie image par image) ;
#   3. SA voix tout du long ; version rouge et version bleue (le rouge du palet passé en bleu, pileface.py, jamais sur elle).
# Sorties : assets/games/madwheel/b-pf-r.mp4 / b-pf-b.mp4 (720 × 1280, avec sa voix) + .webp ; PF_AT (le palet vu dans le bocal)
# est à reporter dans games/madwheel.js (PF_AT, ici 8,8 s).
# Il faut d'abord les masques de l'animateur : python3 tools/art/madwheel/pileface-femme.py --masks (rembg u2net_human_seg, 540 × 960),
# et elle détourée (femme.py --matte). MW_WORK=… MW_FEMME=… python3 tools/art/madwheel/pileface-femme.py
import os, subprocess, sys
import numpy as np, cv2
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, '..'))
import bonus as B  # noqa: E402
import femme as F  # noqa: E402

SRC = os.path.join(HERE, 'bonus-pileface.mp4')
WORK = B.WORK
w, h = 540, 960     # work size
OW, OH = 720, 1280  # output size


def masks():
    d = os.path.join(WORK, 'pf-host'); os.makedirs(d, exist_ok=True)
    p = os.path.join(WORK, 'pf-frames.npy')
    if not os.path.exists(p):
        raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', SRC, '-vf', f'scale={w}:{h}:flags=area', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'])
        np.save(p, np.frombuffer(raw, np.uint8).reshape(-1, h, w, 3))
    fr = np.load(p); s = None
    for n, f in enumerate(fr):
        q = os.path.join(d, f'{n:03d}.png')
        if os.path.exists(q): continue
        from rembg import remove, new_session
        s = s or new_session('u2net_human_seg')
        remove(Image.fromarray(f), session=s, only_mask=True).save(q)


def load():
    fr = np.load(os.path.join(WORK, 'pf-frames.npy'))
    M = np.stack([np.array(Image.open(os.path.join(WORK, 'pf-host', f'{n:03d}.png')).convert('L')) for n in range(len(fr))])
    return fr, M


def puck(f):
    hsv = cv2.cvtColor(f, cv2.COLOR_RGB2HSV)
    red = (((hsv[..., 0] <= 10) | (hsv[..., 0] >= 168)) & (hsv[..., 1] > 90) & (hsv[..., 2] > 70)).astype(np.uint8)
    return cv2.dilate(red, np.ones((25, 25), np.uint8)) > 0


def track(fr, man):
    """H[n]: frame n → frame 0 (homography of the set: points away from the host and the puck)"""
    orb = cv2.ORB_create(3000, fastThreshold=7)
    bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
    H = [np.eye(3)]; prev = None
    for n, f in enumerate(fr):
        g = cv2.cvtColor(f, cv2.COLOR_RGB2GRAY)
        ok = (~man[n] & ~puck(f)).astype(np.uint8) * 255
        kp, ds = orb.detectAndCompute(g, ok)
        if prev is not None:
            Hn = np.eye(3)
            if ds is not None and prev[1] is not None and len(kp) > 20:
                m = bf.match(ds, prev[1])
                if len(m) > 20:
                    a = np.float32([kp[x.queryIdx].pt for x in m]); b = np.float32([prev[0][x.trainIdx].pt for x in m])
                    Hh, inl = cv2.findHomography(a, b, cv2.RANSAC, 2.5)
                    if Hh is not None and inl.sum() > 15: Hn = Hh
            H.append(H[-1] @ Hn)
        prev = (kp, ds)
    return np.array(H)


def remove_man(fr, man, H):
    n = len(fr); out = fr.copy(); left_any = 0
    Hinv = [np.linalg.inv(x) for x in H]
    for t in range(n):
        hole = man[t].copy()
        if not hole.any(): continue
        order = sorted([u for u in range(n) if u != t], key=lambda u: abs(u - t))
        for u in order[:120]:
            Htu = Hinv[t] @ H[u]  # u → t
            ww = cv2.warpPerspective(fr[u], Htu, (w, h), flags=cv2.INTER_LINEAR, borderValue=0)
            valid = cv2.warpPerspective(np.ones((h, w), np.uint8), Htu, (w, h), flags=cv2.INTER_NEAREST) > 0
            mu = cv2.warpPerspective(man[u].astype(np.uint8), Htu, (w, h), flags=cv2.INTER_NEAREST) > 0
            pu = cv2.warpPerspective(puck(fr[u]).astype(np.uint8), Htu, (w, h), flags=cv2.INTER_NEAREST) > 0
            c = hole & valid & ~mu & ~pu
            if c.any(): out[t][c] = ww[c]; hole &= ~c
            if not hole.any(): break
        if hole.any():
            left_any += hole.mean()
            out[t] = cv2.inpaint(np.ascontiguousarray(out[t]), hole.astype(np.uint8), 9, cv2.INPAINT_TELEA)
        e = cv2.GaussianBlur(man[t].astype(np.float32), (0, 0), 2)
        e = (e * (1 - e) * 4)[..., None]
        out[t] = (out[t] * (1 - e) + cv2.GaussianBlur(out[t], (0, 0), 1.5) * e).round().astype(np.uint8)
    print(f'  never seen: {left_any / n * 100:.2f} % of the picture on average', flush=True)
    return out


# ---------- the new Pile ou Face: a TV edit (owner's request of 18 November 2026) ----------
# Part 1, the host: the set seen by the still camera of the start (frames 0 to 57, the host's hand and the puck taken out: a still
# plate), SHE stands behind the table and talks (2,5 s). Part 2, the puck: a cut to the camera that follows the puck (frames 96 to
# the end of his video, framed on the right part where the puck flies, lands on the jar and falls in; the camera follows it down,
# then the close-up of the jar), the host's pointing hand at the edge taken out (filled from the other frames, remove_man).
# Her voice all along (the same passage as her picture in part 1, then over the puck).
HOST_N = 60                  # frames of part 1
P2 = 96                      # first frame of his video in part 2
EDGE = 1032                  # the far edge of the table in the plate (her body is hidden under it), output pixels
HERE_AT = (256, 245, 1.05)   # her head top (y), the centre of her body (x), her scale (output px per px of her frames)
# the frame of the following camera: original frame → (left edge, centre of the height), both in fractions of the picture; the
# width is 1 − left (always up to the right edge), the height the same fraction (9 : 16 like the video)
CAM = [(96, .54, .50), (104, .54, .43), (110, .54, .41), (124, .54, .42), (140, .54, .45), (160, .54, .52), (176, .54, .60),
       (186, .54, .68), (200, .50, .70), (210, .45, .70), (220, .40, .68), (230, .30, .65), (242, .30, .65), (250, .15, .57),
       (258, .04, .52), (264, .0, .5), (289, .0, .5)]
FILL_UNTIL = 216             # after this frame his rembg mask is not reliable (the jar is taken for a person): no fill
PF_AT = None                 # set by make(): when the face of the puck is seen (s), for the game


def cam(t):
    ts = [c[0] for c in CAM]
    t = min(max(t, ts[0]), ts[-1])
    i = max(k for k in range(len(ts)) if ts[k] <= t)
    if i == len(ts) - 1: return CAM[-1][1:]
    a, b = CAM[i], CAM[i + 1]; u = (t - a[0]) / (b[0] - a[0]); u = u * u * (3 - 2 * u)
    return a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u


def stream(path, w0, h0):
    p = subprocess.Popen(['ffmpeg', '-v', 'error', '-i', path, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], stdout=subprocess.PIPE)
    n = w0 * h0 * 3
    while True:
        b = p.stdout.read(n)
        if len(b) < n: break
        yield np.frombuffer(b, np.uint8).reshape(h0, w0, 3)


def plate():
    fr = np.load(os.path.join(WORK, 'pf720.npy')) if os.path.exists(os.path.join(WORK, 'pf720.npy')) else None
    pp = os.path.join(WORK, 'pf-plate2.npy')
    if os.path.exists(pp): return np.load(pp)
    if fr is None:
        fr = np.stack([cv2.resize(f, (OW, OH), interpolation=cv2.INTER_AREA) for f in vb_read(SRC)])
    M = [cv2.resize(np.array(Image.open(os.path.join(WORK, 'pf-host', f'{n:03d}.png')).convert('L')), (OW, OH)) for n in range(58)]
    st = fr[:58].astype(np.float32)
    for t in range(58):
        bad = (cv2.dilate((M[t] > 20).astype(np.uint8), np.ones((41, 41), np.uint8)) > 0) | (cv2.resize(puck(cv2.resize(fr[t], (w, h))).astype(np.uint8), (OW, OH)) > 0)
        st[t][bad] = np.nan
    pl = np.nanmedian(st, axis=0); hole = np.isnan(pl).any(2)
    pl = np.nan_to_num(pl).astype(np.uint8)
    hole[540:780, :56] = True  # his shoulder at the very left edge, in every frame
    pl = cv2.inpaint(pl, hole.astype(np.uint8), 11, cv2.INPAINT_TELEA)
    np.save(pp, pl); return pl


def vb_read(path):
    import videobg as vb
    return vb.read(path)


def woman(bg, rgba):
    y0, cx, sc = HERE_AT
    ht, hc = F.her_box()
    ww, hh = int(round(F.CW * sc)), int(round(F.CH * sc))
    x = int(round(cx - hc * sc)); y = int(round(y0 - ht * sc))
    im = cv2.resize(rgba, (ww, hh), interpolation=cv2.INTER_CUBIC).astype(np.float32)
    a = cv2.GaussianBlur(cv2.erode(im[..., 3] / 255, np.ones((2, 2), np.uint8)), (0, 0), 0.8)
    col = im[..., :3]
    lay = np.zeros((OH, OW, 3), np.float32); al = np.zeros((OH, OW), np.float32)
    x0, y1 = max(0, x), min(OH, y + hh); x1 = min(OW, x + ww)
    lay[y:y1, x0:x1] = col[:y1 - y, x0 - x:x1 - x]; al[y:y1, x0:x1] = a[:y1 - y, x0 - x:x1 - x]
    # the table hides her below its far edge (soft over 3 px); her faint reflection on the glossy table
    cut = np.clip((EDGE - np.arange(OH)) / 3 + 0.5, 0, 1)[:, None]
    ref = lay.copy(); ra = al.copy()
    k = min(OH - EDGE, EDGE)
    ref[EDGE:EDGE + k] = lay[EDGE - 1:EDGE - 1 - k:-1]; ra[EDGE:EDGE + k] = al[EDGE - 1:EDGE - 1 - k:-1] * np.linspace(0.16, 0, k)[:, None]
    ra[:EDGE] = 0; ref = cv2.GaussianBlur(ref, (0, 0), 3); ra = cv2.GaussianBlur(ra, (0, 0), 3)
    al = al * cut
    ref_box = bg[max(0, y):EDGE, x0:x1]
    lay = F.match(lay, ref_box) if ref_box.size else lay
    out = bg.astype(np.float32)
    out = out * (1 - ra[..., None]) + ref * ra[..., None]
    out = out * (1 - al[..., None]) + lay * al[..., None]
    return out.round().astype(np.uint8)


def make():
    global PF_AT
    import pileface as PFm
    pl = plate()
    fr, M = load()
    clean = np.load(os.path.join(WORK, 'pf-clean.npy'))
    aud = F.att_audio()
    s = F.SEG.get('pf', 150)
    n2 = 289 - P2
    out = []
    for n in range(HOST_N):
        out.append(woman(pl, F.her(F.src_frame(n, s))))
    for t, f in enumerate(stream(SRC, 1080, 1920)):
        if t < P2: continue
        f = f.copy()
        if t <= FILL_UNTIL:  # his hand at the left edge of the frame of the camera: from remove_man
            m = cv2.dilate((M[t] > 28).astype(np.uint8), np.ones((19, 19), np.uint8))
            m = cv2.resize(m, (1080, 1920), interpolation=cv2.INTER_NEAREST) > 0
            c = cv2.resize(clean[t], (1080, 1920), interpolation=cv2.INTER_CUBIC)
            soft = cv2.GaussianBlur(m.astype(np.float32), (0, 0), 4)[..., None]
            f = (f * (1 - soft) + c * soft).round().astype(np.uint8)
        x0, cy = cam(t); wf = 1 - x0
        X0 = int(round(x0 * 1080)); Wd = 1080 - X0; Hd = int(round(Wd * 16 / 9))
        Y0 = int(round(min(max(cy * 1920 - Hd / 2, 0), 1920 - Hd)))
        out.append(cv2.resize(f[Y0:Y0 + Hd, X0:X0 + Wd], (OW, OH), interpolation=cv2.INTER_AREA if Wd >= OW else cv2.INTER_LANCZOS4))
    out = np.stack(out)
    PF_AT = round((HOST_N + 248 - P2) / 24, 2)
    voice = F.audio_for(aud, s, len(out))
    blue = np.stack([f if n < HOST_N else PFm.blue(f, np.zeros(f.shape[:2], np.uint8)) for n, f in enumerate(out)])
    for name, frames in (('pf-r', out), ('pf-b', blue)):
        F.write(name, frames, voice, size=(OW, OH), crf=26, gop=24)
    print(f'  Pile ou Face: {len(out)} frames, the face of the puck at {PF_AT} s', flush=True)


def main():
    if '--masks' in sys.argv: masks(); return
    fr, M = load()
    man = np.stack([cv2.dilate((m > 28).astype(np.uint8), np.ones((15, 15), np.uint8)) > 0 for m in M])
    Hp = os.path.join(WORK, 'pf-H.npy')
    if os.path.exists(Hp): H = np.load(Hp)
    else: H = track(fr, man); np.save(Hp, H)
    cp = os.path.join(WORK, 'pf-clean.npy')
    if os.path.exists(cp): clean = np.load(cp)
    else: clean = remove_man(fr, man, H); np.save(cp, clean)
    make()


if __name__ == '__main__':
    main()
