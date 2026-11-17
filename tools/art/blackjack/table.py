# Le 21 / Le 21 Électrique / La Bataille: the owner's 2 videos of 17 November 2026 (table-large.mp4 672 × 448 for computers,
# table-haut.mp4 720 × 1280 for phones held upright, 8 s, with the sound): the croupière of the « Platinum VIP » table takes a
# card from the shoe and slides it to her right (frames 34 → 61), then a second card to the middle in front of her
# (146 → 160). The game replays these gestures for every card it deals (CLIPS in games/bjtable.js).
#  - every card of the video lying or sliding on the felt is erased on every frame (white pixels only: her fingers stay),
#    the felt under it comes from the clean first frame;
#  - the painted « BLACK JACK PAYS 3 TO 2 / Dealer must stand on 17 » is erased (our games do not all pay 3 to 2), except
#    where her hand passes over it;
#  - the card she slides is followed frame by frame (centre, size, angle) -> TRACK: the game draws OUR card there (its
#    real face, or its back for the hidden card) while her hand pushes it;
#  - her hands and arms over the felt -> a mask per frame (sheet hand-<l|p>.png): our cards lying on the felt go under
#    her hand when she reaches over them.
# -> assets/games/blackjack/table-<l|p>.mp4 (with the sound, a key frame every 4 frames), table-<l|p>.webp (poster),
#    hand-<l|p>.png, and the TRACK / HAND tables printed for games/bjtable.js.
# python3 tools/art/blackjack/table.py   (pip install opencv-python-headless numpy pillow; needs ffmpeg)
import os, sys, json, subprocess
import numpy as np, cv2
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, '../../../assets/games/blackjack')
sys.path.insert(0, os.path.join(HERE, '..'))
from videobg import read, grow  # noqa: E402

# felt: [x0, y0, x1, y1] where the cards are searched and erased; text: the painted rules; hand: the box of the hand mask
SET = {
    'l': {'src': 'table-large.mp4', 'up': 1.5, 'felt': (150, 238, 600, 400), 'text': (232, 262, 436, 292), 'hand': (150, 230, 600, 400), 'hs': 0.5, 'dx': 372},
    'p': {'src': 'table-haut.mp4', 'up': 1.0, 'felt': (0, 700, 720, 1160), 'text': (85, 755, 625, 820), 'hand': (0, 700, 720, 1160), 'hs': 0.25, 'dx': 470},
}
SLIDES = [(30, 62), (140, 161)]  # frames where the card she pushes is followed (the player's card, then hers)


def white(a):
    a = a.astype(np.int16)
    return (a.min(2) > 150) & ((a.max(2) - a.min(2)) < 60)


def run(k):
    S = SET[k]
    fr = read(os.path.join(HERE, S['src']))
    n, H, W = fr.shape[:3]
    x0, y0, x1, y1 = S['felt']
    felt = np.zeros((H, W), bool); felt[y0:y1, x0:x1] = True
    plate = np.median(fr[:5], axis=0).astype(np.uint8)
    static_white = grow(white(plate) & felt, 4)  # the cards in the shoes (left / right): kept
    # the painted rules erased from the plate
    tx0, ty0, tx1, ty1 = S['text']
    pa = plate.astype(np.int16)
    gold = (pa[..., 0] > 70) & (pa[..., 0] - pa[..., 2] > 16)
    tm = np.zeros((H, W), bool); tm[ty0:ty1, tx0:tx1] = True; tm &= gold
    tm = grow(tm, 3)
    clean = cv2.inpaint(plate, tm.astype(np.uint8), 6, cv2.INPAINT_TELEA)
    clean = np.where(tm[..., None], cv2.GaussianBlur(clean, (0, 0), 1.4), clean)
    tbox = np.zeros((H, W), bool); tbox[ty0 - 4:ty1 + 4, tx0 - 4:tx1 + 4] = True
    pblur6 = cv2.GaussianBlur(plate, (0, 0), 5).astype(np.int16)
    track = {}
    hx0, hy0, hx1, hy1 = S['hand']; hs = S['hs']
    hw, hh = int((hx1 - hx0) * hs), int((hy1 - hy0) * hs)
    masks = []
    out = np.empty_like(fr)
    for i, f in enumerate(fr):
        g = f.copy()
        # 1. the cards on the felt
        wm = white(f) & felt & ~static_white
        if any(a <= i <= b for a, b in SLIDES):
            sm = wm.copy()
            if i >= SLIDES[1][0]: sm[:, S['dx']:] = False  # her card only (the player's cards rest on the right)
            num, lab, st, _ = cv2.connectedComponentsWithStats(sm.astype(np.uint8), 8)
            if num > 1:
                j = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))
                if st[j, cv2.CC_STAT_AREA] > (60 if k == 'l' else 300):
                    pts = np.column_stack(np.nonzero(lab == j))[:, ::-1].astype(np.float32)
                    (cx, cy), (rw, rh), ang = cv2.minAreaRect(pts)
                    if rw < rh: rw, rh, ang = rh, rw, ang + 90
                    track[i] = [round(float(cx), 1), round(float(cy), 1), round(float(rw), 1), round(float(rh), 1), round(float(ang), 1)]
        # each card: its whole shape (its convex hull: the red / black pips inside go too)
        m = np.zeros((H, W), np.uint8)
        cs, _ = cv2.findContours(cv2.morphologyEx(wm.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8)), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        for c in cs:
            if cv2.contourArea(c) > 4: cv2.fillConvexPoly(m, cv2.convexHull(c), 1)
        m = grow(m > 0, 4 if k == 'l' else 8)
        # the light of this frame (the AI video breathes a little): the clean felt brought to it
        ring = felt & ~grow(m, 8) & ~tbox
        off = np.median(f[ring].astype(np.float32) - clean[ring].astype(np.float32), axis=0)
        cl = (clean.astype(np.float32) + off).clip(0, 255)
        k2 = cv2.GaussianBlur(m.astype(np.float32), (0, 0), 1.2)[..., None]
        g = (g * (1 - k2) + cl * k2).astype(np.uint8)
        # 2. the painted rules (their letters wobble from frame to frame), except under her hand
        fa = f.astype(np.int16)
        tf = tbox & (fa[..., 0] > 70) & (fa[..., 0] - fa[..., 2] > 16)
        hand = grow(np.abs(cv2.GaussianBlur(g, (0, 0), 5).astype(np.int16) - pblur6).sum(2) > 50, 3)
        st_ = tbox & grow(tm | tf, 3) & ~hand
        k3 = cv2.GaussianBlur(st_.astype(np.float32), (0, 0), 1.0)[..., None]
        g = (g * (1 - k3) + cl * k3).astype(np.uint8)
        out[i] = g
        # 3. her hands over the felt (what differs from the clean plate), for the cards' mask
        d2 = np.abs(g.astype(np.int16) - clean.astype(np.int16)).sum(2)
        hm = (d2 > 60)[hy0:hy1, hx0:hx1].astype(np.uint8)
        hm = cv2.morphologyEx(hm, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
        hm = cv2.dilate(hm, np.ones((5, 5), np.uint8))
        masks.append(cv2.resize(hm * 255, (hw, hh), interpolation=cv2.INTER_AREA))
    # the hand masks: only frames with a hand over the felt; identical/empty frames share one cell
    cells, idx = [], []
    blank = None
    for m in masks:
        if m.max() < 40 or (m > 128).sum() < 20:
            if blank is None: blank = len(cells); cells.append(np.zeros_like(m))
            idx.append(blank); continue
        idx.append(len(cells)); cells.append(m)
    cols = 8
    rows = (len(cells) + cols - 1) // cols
    sheet = np.zeros((rows * hh, cols * hw), np.uint8)
    for j, c in enumerate(cells): sheet[(j // cols) * hh:(j // cols + 1) * hh, (j % cols) * hw:(j % cols + 1) * hw] = c
    # the mask image: white = the card layer shows, transparent = her hand (CSS mask)
    rgba = np.zeros(sheet.shape + (4,), np.uint8); rgba[..., :3] = 255; rgba[..., 3] = 255 - sheet
    Image.fromarray(rgba, 'RGBA').save(os.path.join(OUT, f'hand-{k}.png'), optimize=True)
    # the video, with its sound
    up = S['up']; w, h = int(W * up) // 2 * 2, int(H * up) // 2 * 2
    vf = f'scale={w}:{h}:flags=lanczos,unsharp=5:5:0.35:5:5:0' if up != 1 else 'unsharp=5:5:0.25:5:5:0'
    p = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', '24', '-i', '-',
                          '-i', os.path.join(HERE, S['src']), '-map', '0:v', '-map', '1:a', '-vf', vf, '-c:v', 'libx264', '-preset', 'veryslow',
                          '-crf', '24', '-pix_fmt', 'yuv420p', '-g', '4', '-keyint_min', '4', '-sc_threshold', '0', '-profile:v', 'high',
                          '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', os.path.join(OUT, f'table-{k}.mp4')], stdin=subprocess.PIPE)
    p.communicate(out.tobytes())
    Image.fromarray(out[0]).resize((w, h), Image.LANCZOS).save(os.path.join(OUT, f'table-{k}.webp'), quality=82, method=6)
    if os.environ.get('BJ_DEBUG'): np.save(f'/tmp/bj_{k}.npy', out)
    return {'track': track, 'hand': {'box': [hx0, hy0, hx1, hy1], 'cols': cols, 'rows': rows, 'w': hw, 'h': hh, 'idx': idx}, 'size': [W, H]}


def smooth(tr, a, b, land):
    """the card she pushes, frame a..land: [cx, cy, width, angle] smoothed (the fingers hide a part of it)"""
    fs = [f for f in range(a, b + 1) if str(f) in tr]
    if not fs: return None
    raw = {f: tr[str(f)] for f in fs}
    wmed = float(np.median([raw[f][2] for f in fs]))
    out = []
    for f in range(fs[0], land + 1):
        near = [raw[g] for g in range(f - 2, f + 3) if g in raw] or [raw[min(fs, key=lambda g: abs(g - f))]]
        cx = float(np.mean([r[0] for r in near])); cy = float(np.mean([r[1] for r in near]))
        w = float(np.median([min(max(r[2], wmed * 0.7), wmed * 1.15) for r in near]))
        an = [((r[4] + 45) % 90) - 45 for r in near]
        out.append([round(cx, 1), round(cy, 1), round(w, 1), round(float(np.median(an)), 1)])
    return {'s': fs[0], 'f': out}


def inject(res):
    js = {}
    for k, r in res.items():
        js[k] = {'p': smooth(r['track'], *SLIDES[0], 61), 'd': smooth(r['track'], *SLIDES[1], 161), 'hand': r['hand']}
    path = os.path.join(HERE, '../../../games/bjtable.js')
    src = open(path).read()
    a, b = src.index('/* BJTRACK */'), src.index('/* /BJTRACK */')
    src = src[:a] + '/* BJTRACK */ const BJTRACK = ' + json.dumps(js, separators=(',', ':')) + '; ' + src[b:]
    open(path, 'w').write(src)


if sys.argv[1:] == ['--inject']:
    inject(json.load(open(os.path.join(HERE, 'table.json'))))
else:
    res = {k: run(k) for k in (sys.argv[1:] or SET)}
    with open(os.path.join(HERE, 'table.json'), 'w') as fh: json.dump(res, fh)
    for k, r in res.items(): print(k, 'tracked', len(r['track']), 'cells', r['hand']['rows'] * r['hand']['cols'])
    inject(res)
