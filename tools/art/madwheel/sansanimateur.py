#!/usr/bin/env python3
# La Roue Folle, bonus : les 3 vidéos du propriétaire (Pachinko, canards, roue à 3 flèches) SANS l'animateur (demande du propriétaire
# du 18 novembre 2026 : la présentatrice du Plateau Live prend sa place, voir femme.py). Chaque vidéo est recalée (bonus.py), puis
# l'animateur (détouré par rembg, un peu élargi, avec son reflet sur le sol brillant) est effacé : chaque pixel caché par lui est pris
# dans l'image la plus proche dans le temps où il ne le cache pas ; ce qu'il cache tout le temps est repeint (inpaint) depuis le fond.
# Sortie : WORK/<k>-clean.npy (images 672 × 448) + WORK/<k>-man.npy (où il était, pour placer la présentatrice dessus).
import os, sys
import numpy as np, cv2
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, '..'))
import bonus as B  # noqa: E402
import videobg as vb  # noqa: E402

W, H = B.W, B.H


def man_mask(host, k):
    out = []
    for h in host:
        m = (h > 28).astype(np.uint8)
        m = cv2.dilate(m, np.ones((11, 11), np.uint8))
        if k == 'ct':  # his reflection on the shiny floor, under his feet
            ys, xs = np.nonzero(m)
            if len(ys):
                low = ys.max()
                if low > 380:
                    cols = np.unique(xs[ys > low - 30])
                    if len(cols): m[low - 10:, max(0, cols.min() - 8):min(W, cols.max() + 9)] = 1
        out.append(m.astype(bool))
    return np.stack(out)


WALL = (62, 16, 442, 400)  # canards: the wall of ducks (x0, y0, x1, y1)
EMPTY = 130                # canards: from this frame on the wall is empty (the ducks have fallen)
XC = np.array([85.2, 118.0, 150.7, 182.9, 214.4, 245.3, 276.3, 306.4, 336.1, 365.7, 395.0, 423.4])  # the 12 columns (bonus.ducks)
SHUFFLE = 68               # canards: the ducks start mixing (the fill never mixes these 3 parts of the video)


def hand(fr):
    """canards: his hand over the ducks (frames before the shuffle), which rembg leaves out: skin colour near his sleeve"""
    out = np.zeros(fr.shape[:3], bool)
    for t in range(min(len(fr), 96)):
        hsv = cv2.cvtColor(fr[t], cv2.COLOR_RGB2HSV).astype(np.int16)
        hu, sa, va = hsv[..., 0], hsv[..., 1], hsv[..., 2]
        sk = ((hu <= 22) | (hu >= 172)) & (sa >= 25) & (sa <= 160) & (va >= 110)
        z = np.zeros(sk.shape, bool); z[170:330, 280:448] = True
        m = cv2.morphologyEx((sk & z).astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
        k, lab, st, _ = cv2.connectedComponentsWithStats(m)
        keep = np.zeros(m.shape, np.uint8)
        for i in range(1, k):
            if st[i, 4] >= 120: keep[lab == i] = 1
        out[t] = cv2.dilate(keep, np.ones((13, 13), np.uint8)) > 0
    return out


def refine(fr, M, k):
    """what rembg misses (fingers, the edge of a sleeve): near him, the pixels far from the still set (median without him)"""
    if k == 'ch':  # the ducks move near him: rembg's outline and his hand; before the shuffle, his arm's place in every frame
        M = M | hand(fr)
        z = np.zeros(M.shape[1:], bool); z[160:340, 270:448] = True
        arm = cv2.dilate((M[:SHUFFLE].any(0) & z).astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
        M[:SHUFFLE] |= arm
        return M
    first, _ = remove(fr, M, quiet=True)
    plate = np.median(first, axis=0).astype(np.int16)
    out = []
    for f, m in zip(fr, M):
        near = cv2.dilate(m.astype(np.uint8), np.ones((41, 41), np.uint8)) > 0
        d = np.abs(f.astype(np.int16) - plate).max(axis=2) > 46
        extra = cv2.morphologyEx((near & d).astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
        out.append(m | (cv2.dilate(extra, np.ones((7, 7), np.uint8)) > 0))
    return np.stack(out)


def phase(t): return 0 if t < SHUFFLE else 1 if t < EMPTY else 2


def remove(fr, M, quiet=False, k=None):
    n = len(fr); out = fr.copy(); hole = M.copy()
    if k == 'ch':  # once the ducks have fallen, the empty wall behind him comes from the last frames (not from falling ducks)
        x0, y0, x1, y1 = WALL; wz = np.zeros(M.shape[1:], bool); wz[y0:y1, x0:x1] = True
        free = ~M[EMPTY + 4:].any(0)
        tail = np.median(fr[EMPTY + 4:], axis=0).astype(np.uint8)
        for t in range(EMPTY, n):
            c = hole[t] & wz & free
            out[t][c] = tail[c]; hole[t] &= ~c
    for d in range(1, n):
        if not hole.any(): break
        for t in range(n):
            if not hole[t].any(): continue
            for u in (t - d, t + d):
                if 0 <= u < n and (k != 'ch' or phase(t) == phase(u)):
                    c = hole[t] & ~M[u]
                    if c.any(): out[t][c] = fr[u][c]; hole[t] &= ~c
    if k == 'ch':  # ducks never seen (under his hand all the time): the ducks of 2 columns to the left (same grid)
        x0, y0, x1, y1 = WALL
        for t in range(n):
            c = hole[t].copy(); c[:, :x0 + 64] = False; c[:y0] = False; c[y1:] = False; c[:, x1:] = False
            if t >= EMPTY or not c.any(): continue
            # whole ducks: every cell the hole touches is replaced (no duck half one colour, half another)
            cells = np.zeros_like(c)
            for i in range(11):
                cy = 42.0 + i * 32.9
                for jj, cx in enumerate(XC):
                    y0c, y1c, x0c, x1c = int(cy - 16), int(cy + 17), int(cx - 15), int(cx + 15)
                    if c[y0c:y1c, x0c:x1c].any(): cells[y0c:y1c, x0c:x1c] = True
            c = cells; hole[t] |= cells
            ys, xs = np.nonzero(c)
            j = np.abs(xs[:, None] - XC[None, :]).argmin(1)          # the column of each pixel
            for back in (5, 6, 7):                                    # its duck 5 (6, 7) columns to the left, same row
                ok = j - back >= 0
                sx = np.round(xs + (XC[np.maximum(j - back, 0)] - XC[j])).astype(int)
                ok &= (sx >= x0) & ~hole[t][ys, np.clip(sx, 0, W - 1)]
                out[t][ys[ok], xs[ok]] = out[t][ys[ok], sx[ok]]; hole[t][ys[ok], xs[ok]] = False
                ys, xs, j = ys[~ok], xs[~ok], j[~ok]
                if not len(ys): break
    left = hole.any(0)
    if not quiet: print(f'  never seen: {left.mean() * 100:.2f} % of the picture', flush=True)
    if left.any():
        plate = np.median(out, axis=0).astype(np.uint8)
        fill = vb.mend(plate, left, 9, 3.0)
        for t in range(n):
            if hole[t].any(): out[t][hole[t]] = fill[hole[t]]
    # the seams of the filled zones softened a little (lights flicker between frames)
    for t in range(n):
        e = cv2.GaussianBlur(M[t].astype(np.float32), (0, 0), 1.5)
        e = (e * (1 - e) * 4)[..., None]
        out[t] = (out[t] * (1 - e) + cv2.GaussianBlur(out[t], (0, 0), 1.2) * e).round().astype(np.uint8)
    return out, left


def main():
    work = B.WORK; os.makedirs(work, exist_ok=True)
    for k in (sys.argv[1:] or ['pa', 'ch', 'ct']):
        print(k, flush=True)
        fr = B.stabilize(vb.read(os.path.join(HERE, B.SRC[k])), k)
        host = B.hosts(fr, k)
        if k == 'pa': fr = B.no_ball(fr, host)
        if k == 'ct': fr = B.no_sign(fr, host)
        M = refine(fr, man_mask(host, k), k)
        clean, left = remove(fr, M, k=k)
        np.save(os.path.join(work, f'{k}-clean.npy'), clean)
        np.save(os.path.join(work, f'{k}-man.npy'), np.stack([M.any(0), left]))


if __name__ == '__main__':
    main()
