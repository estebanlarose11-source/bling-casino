# Finishing touches done after Blender (numpy + OpenCV): the star glints of the gems (like the white sparkles of the
# owner's painted symbols), bloom, colour grade, vignette and grain for the film. Arrays are float RGB(A) in 0…1.
import numpy as np
import cv2


def star(size, long=1.0, thin=0.018):
    """a 4-ray star with 4 shorter diagonal rays and a soft core, size × size, peak 1"""
    r = size // 2
    y, x = np.mgrid[-r:r + 1, -r:r + 1].astype(np.float32) / r
    d = np.sqrt(x * x + y * y)
    ray = lambda u, v, ln, w: np.exp(-(v / (w * (1 + 2.5 * (1 - np.clip(1 - np.abs(u) / ln, 0, 1))))) ** 2) * np.clip(1 - np.abs(u) / ln, 0, 1) ** 1.4
    s = ray(x, y, long, thin) + ray(y, x, long, thin)
    u, v = (x + y) / np.sqrt(2), (x - y) / np.sqrt(2)
    s += 0.45 * (ray(u, v, long * 0.5, thin * 0.8) + ray(v, u, long * 0.5, thin * 0.8))
    s += 1.2 * np.exp(-(d / 0.07) ** 2) + 0.25 * np.exp(-(d / 0.22) ** 2)
    return np.minimum(s, 1.6)  # each ray is 1 at the centre (dividing by the peak made the rays faint)


def glints(a, n=4, gain=1.0, seed=0, thresh=0.6, color=(0.92, 0.96, 1.0), scale=0.55, inner=0.13):
    """star glints on the n brightest facets of the stone (local maxima above thresh, at least inner × W inside the
    silhouette: not on the gold rim); a = H × W × 4 straight alpha"""
    H, W = a.shape[:2]
    rgb, al = a[..., :3], a[..., 3]
    lum = (rgb @ np.array([0.3, 0.59, 0.11], np.float32)) * al
    lum = cv2.GaussianBlur(lum, (0, 0), 2.0)
    deep = cv2.distanceTransform((al > 0.5).astype(np.uint8), cv2.DIST_L2, 5) > inner * W
    lum = np.where(deep, lum, 0)
    mx = cv2.dilate(lum, np.ones((9, 9), np.uint8))
    ys, xs = np.nonzero((lum >= mx) & (lum > thresh))
    order = np.argsort(-lum[ys, xs])
    picked = []
    for i in order:
        p = (ys[i], xs[i])
        if all((p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 > (0.16 * W) ** 2 for q in picked): picked.append(p)
        if len(picked) >= n: break
    G = np.zeros((H, W), np.float32)
    rng = np.random.default_rng(seed)
    for k, (py, px) in enumerate(picked):
        v = float(np.clip((lum[py, px] - thresh) / (1 - thresh), 0, 1))
        sz = int(W * scale * (0.55 + 0.45 * v) * (1.0 if k == 0 else 0.7)) | 1
        st = star(sz, long=1.0, thin=0.02 + 0.01 * rng.random()) * v * gain * (1.0 if k == 0 else 0.75)
        r = sz // 2
        y0, y1, x0, x1 = max(0, py - r), min(H, py + r + 1), max(0, px - r), min(W, px + r + 1)
        G[y0:y1, x0:x1] += st[y0 - py + r:y1 - py + r, x0 - px + r:x1 - px + r]
    G = np.clip(G, 0, 1.6)
    P = rgb * al[..., None] + G[..., None] * np.array(color, np.float32)
    al2 = 1 - (1 - al) * (1 - np.clip(G, 0, 1))
    out = np.empty_like(a)
    out[..., :3] = np.clip(P / np.maximum(al2, 1e-4)[..., None], 0, 1)
    out[..., 3] = al2
    return out


def bloom(rgb, thresh=0.72, strength=0.55, radii=(3, 9, 24, 60)):
    """glow around the bright parts (lightning, sparkles, gold highlights), several sizes added together"""
    b = np.clip(rgb - thresh, 0, None) / (1 - thresh)
    glow = np.zeros_like(rgb)
    for k, r in enumerate(radii):
        glow += cv2.GaussianBlur(b, (0, 0), r) * (1.0 / (k + 1) ** 0.5)
    return rgb + glow * strength


def grade(rgb, sat=1.12, lift=(0.0, 0.006, 0.02), gamma=1.0, vignette=0.32, grain=0.012, seed=0):
    H, W = rgb.shape[:2]
    l = rgb.mean(-1, keepdims=True)
    rgb = l + (rgb - l) * sat
    rgb = rgb + np.array(lift, np.float32) * (1 - rgb)
    rgb = np.clip(rgb, 0, None) ** gamma
    y, x = np.mgrid[0:H, 0:W].astype(np.float32)
    d = ((x - W / 2) / (W / 2)) ** 2 * 0.8 + ((y - H / 2) / (H / 2)) ** 2
    rgb = rgb * (1 - vignette * np.clip(d, 0, 1.4) ** 1.4)[..., None]
    rgb = rgb + np.random.default_rng(seed).normal(0, grain, (H, W, 1)).astype(np.float32)
    # soft shoulder: bright things roll into white instead of clipping hard
    rgb = np.clip(rgb, 0, None)
    return np.where(rgb < 0.8, rgb, 0.8 + 0.2 * (1 - np.exp(-(rgb - 0.8) / 0.2)))
