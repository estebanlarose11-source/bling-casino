# Le 21 / Le 21 Électrique / La Bataille: the owner's video of 19 November 2026 (copied as ouverture.mp4: 1080 × 1920, 30 / s,
# 15.1 s, with the sound). It is a montage of 4 shots:
#   frames   0 →  38  the end of the opening: « Bonsoir, la table est ouverte. » (label « la table est ouverte », captions);
#   frames  39 → 251  the wide table, she deals 3 cards (not used: the game keeps its own dealing video, table-<l|p>.mp4);
#   frames 252 → 267  the start of the same opening (« Bonsoir, … »): 252 → 267 then 0 → 38 is the whole sentence;
#   frames 268 → 453  a close-up of her at the table, alive (smiles, looks at her hands, sits back), slow camera push-in.
# -> assets/games/blackjack/ouverture.mp4 (+ .webp): the opening (252 → 267 + 0 → 38, with her voice), played once when the
#    player comes to the table;
# -> assets/games/blackjack/attente.mp4 (+ .webp): the close-up as an endless loop while nobody plays (muted). The camera moves
#    in, so the loop goes forward then back (its turns eased: the speed goes smoothly from +1 to −1 over EASE frames); the
#    first TAIL frames are written again after the end, the game jumps back by LOOP = BODY / 30 s (like core/videobg.js).
#    The painted « BLACK JACK PAYS 3 TO 2 / Dealer must stand on 17 » is erased (our games do not all pay 3 to 2): the felt
#    plane is followed frame by frame (SIFT, homography from frame 268), a clean felt made once on frame 268 is laid on it.
# python3 tools/art/blackjack/attente.py   (pip install opencv-python-headless numpy pillow; needs ffmpeg)
import os, sys, subprocess
import numpy as np, cv2
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, '../../../assets/games/blackjack')
SRC = os.path.join(HERE, 'ouverture.mp4')
W, H, FPS = 720, 1280, 30
OPEN = [(252, 268), (0, 39)]          # the opening: frames [a, b) one after the other
IDLE = (268, 454)                     # the close-up
BAND = (58, 793, 642, 868)            # the painted rules on frame 268 (720 × 1280)
EASE, TAIL = 24, 15


def read():
    raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', SRC, '-vf', f'scale={W}:{H}:flags=lanczos', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'])
    return np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3)


def grow(m, n):
    return cv2.dilate(m.astype(np.uint8), np.ones((2 * n + 1, 2 * n + 1), np.uint8)) > 0


def encode(frames, path, audio=None, crf=24, gop=30):
    n, h, w, _ = frames.shape
    cmd = ['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{w}x{h}', '-r', str(FPS), '-i', '-']
    if audio:
        cmd += ['-i', SRC, '-filter_complex', audio, '-map', '0:v', '-map', '[a]', '-c:a', 'aac', '-b:a', '96k']
    else:
        cmd += ['-an']
    cmd += ['-vf', 'unsharp=5:5:0.25:5:5:0', '-c:v', 'libx264', '-preset', 'veryslow', '-crf', str(crf), '-pix_fmt', 'yuv420p',
            '-g', str(gop), '-profile:v', 'high', '-movflags', '+faststart', path]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    p.communicate(np.ascontiguousarray(frames).tobytes())
    if p.returncode: raise SystemExit(f'ffmpeg failed: {path}')


def opening(fr):
    seq = np.concatenate([fr[a:b] for a, b in OPEN])
    parts = ''.join(f'[1:a]atrim={a / FPS:.5f}:{b / FPS:.5f},asetpts=PTS-STARTPTS[a{i}];' for i, (a, b) in enumerate(OPEN))
    audio = parts + ''.join(f'[a{i}]' for i in range(len(OPEN))) + f'concat=n={len(OPEN)}:v=0:a=1[a]'
    encode(seq, os.path.join(OUT, 'ouverture.mp4'), audio, crf=22, gop=15)
    Image.fromarray(seq[0]).save(os.path.join(OUT, 'ouverture.webp'), quality=80, method=6)
    print(f'ouverture: {len(seq)} frames = {len(seq) / FPS:.3f} s')


def felt_tracks(fr, ref_i):
    """homography ref -> every frame of the close-up, from the felt (logo, places, rules), smoothed in time"""
    sift = cv2.SIFT_create(3000)
    g = lambda f: cv2.cvtColor(f, cv2.COLOR_RGB2GRAY)
    mr = np.zeros((H, W), np.uint8); mr[780:] = 255
    kr, dr = sift.detectAndCompute(g(fr[ref_i]), mr)
    mf = np.zeros((H, W), np.uint8); mf[700:] = 255
    bm = cv2.BFMatcher()
    corners = np.float32([[0, 780], [W, 780], [W, H], [0, H]]).reshape(-1, 1, 2)
    tr = []
    for i in range(IDLE[0], IDLE[1]):
        kf, df = sift.detectAndCompute(g(fr[i]), mf)
        good = [m for m, n in bm.knnMatch(dr, df, k=2) if m.distance < 0.72 * n.distance]
        pa = np.float32([kr[m.queryIdx].pt for m in good]); pb = np.float32([kf[m.trainIdx].pt for m in good])
        Hm, inl = cv2.findHomography(pa, pb, cv2.RANSAC, 2.5)
        tr.append(cv2.perspectiveTransform(corners, Hm).reshape(-1))
    tr = np.array(tr)
    k = 7  # moving average (the camera moves smoothly; the matches jitter a little)
    pad = np.concatenate([np.repeat(tr[:1], k // 2, 0), tr, np.repeat(tr[-1:], k // 2, 0)])
    sm = np.stack([pad[j:j + len(tr)] for j in range(k)]).mean(0)
    return [cv2.getPerspectiveTransform(corners.reshape(-1, 2), s.reshape(-1, 2).astype(np.float32)) for s in sm]


def idle(fr):
    ref = fr[IDLE[0]]
    x0, y0, x1, y1 = BAND
    # the clean felt of frame 268: the whole band (letters, their dark edges and glow) replaced by the felt around it, a smooth
    # quadratic of x, y fitted on the felt next to the band, with the felt's own fine grain
    ra = ref.astype(np.int16)
    gold = grow(((ra[..., 0] + ra[..., 1]) // 2 - ra[..., 2] > 16) & (ra[..., 0] > 80), 4)
    band = np.zeros((H, W), bool); band[y0:y1, x0:x1] = True
    near = np.zeros((H, W), bool); near[y0 - 16:y1 + 3, max(0, x0 - 40):x1 + 40] = True
    fit = near & ~grow(band, 3) & ~gold
    yy, xx = np.nonzero(fit)
    A_ = lambda x, y: np.stack([np.ones_like(x), x, y, x * x, x * y, y * y], 1).astype(np.float64)
    sx, sy = W / 2, (y0 + y1) / 2
    coef = np.linalg.lstsq(A_((xx - sx) / W, (yy - sy) / 100), ref[yy, xx].astype(np.float64), rcond=None)[0]
    by, bx = np.mgrid[0:H, 0:W]
    est = (A_((bx.ravel() - sx) / W, (by.ravel() - sy) / 100) @ coef).reshape(H, W, 3)
    hp = ref.astype(np.float32) - cv2.GaussianBlur(ref, (0, 0), 3).astype(np.float32)
    grain = float(np.std(hp[fit])) * 0.8
    est += np.random.default_rng(7).normal(0, grain, (H, W, 1))
    k0 = cv2.GaussianBlur(band.astype(np.float32), (0, 0), 2.0)[..., None]
    clean = (ref.astype(np.float32) * (1 - k0) + est * k0).clip(0, 255).astype(np.uint8)
    # the band laid on every frame, feathered (its whole area: the letters wobble from frame to frame)
    bmask = np.zeros((H, W), np.float32); bmask[y0:y1, x0:x1] = 1
    bmask = cv2.GaussianBlur(bmask, (0, 0), 3.0)
    ring = (grow(band, 18) & ~grow(band, 4))
    Hs = felt_tracks(fr, IDLE[0])
    rblur = cv2.GaussianBlur(ref, (0, 0), 5).astype(np.int16)
    out = []
    for j, i in enumerate(range(IDLE[0], IDLE[1])):
        f = fr[i]; Hm = Hs[j]
        wc = cv2.warpPerspective(clean, Hm, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE).astype(np.float32)
        wm = cv2.warpPerspective(bmask, Hm, (W, H), flags=cv2.INTER_LINEAR)
        wr = cv2.warpPerspective(ring.astype(np.uint8), Hm, (W, H), flags=cv2.INTER_NEAREST) > 0
        wb = cv2.warpPerspective(rblur, Hm, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
        # her hands / arms over it stay (what differs from the felt of frame 268, at a coarse scale)
        hand = grow(np.abs(cv2.GaussianBlur(f, (0, 0), 5).astype(np.int16) - wb).sum(2) > 70, 6)
        # the light of this frame (the AI video breathes): the clean felt brought to it
        fa = f.astype(np.int16); fg = ((fa[..., 0] + fa[..., 1]) // 2 - fa[..., 2] > 28) & (fa[..., 0] > 90)
        sel = wr & ~hand & ~fg
        off = np.median(f[sel].astype(np.float32) - wc[sel], axis=0) if sel.sum() > 200 else np.zeros(3, np.float32)
        k = (wm * (~hand))[..., None]
        out.append((f * (1 - k) + (wc + off).clip(0, 255) * k).astype(np.uint8))
    return np.stack(out)


def pingpong(seq):
    """forward then back, the two turns eased (a triangle wave averaged over EASE frames), fractional frames blended"""
    n = len(seq); P = 2 * (n - 1)
    tri = lambda t: np.where((t % P) <= n - 1, t % P, P - (t % P))
    s = np.linspace(-EASE / 2, EASE / 2, 121)
    pos = np.array([tri(k + s).mean() for k in range(P)])
    f32 = seq.astype(np.float32)
    out = []
    for p in pos:
        a = int(np.floor(p)); b = min(n - 1, a + 1); t = p - a
        out.append((f32[a] * (1 - t) + f32[b] * t).round().astype(np.uint8))
    return np.stack(out)


if __name__ == '__main__':
    fr = read()
    print('frames', len(fr))
    if 'idle' not in sys.argv[1:]: opening(fr)
    if 'ouverture' not in sys.argv[1:]:
        seq = idle(fr)
        if os.environ.get('BJ_DEBUG'): np.save('/tmp/bj_idle.npy', seq)
        body = pingpong(seq)
        full = np.concatenate([body, body[:TAIL]])
        encode(full, os.path.join(OUT, 'attente.mp4'), crf=25, gop=30)
        Image.fromarray(body[0]).save(os.path.join(OUT, 'attente.webp'), quality=80, method=6)
        print(f'attente: {len(seq)} frames -> loop {len(body)} + {TAIL} (LOOP = {len(body)}/{FPS} = {len(body) / FPS:.4f} s)')
