# The finishing of a machine's 3D film (after trailer.py has rendered its frames in BL_TMP/<id>/): each Blender frame
# (the symbols as 3D pieces, the gold title, on a transparent background) is set ×2 over the machine's own decor (the
# owner's video or image, blurred like a depth of field, slowly pushing in), with the light of the machine behind the
# hero, light shafts, the shockwave and sparks of the 2 impacts, the particles of its world (embers, snow, sparkles,
# coins, banknotes…), glints, bloom, grade, the site's address at the end; plus its sound, made here (impacts of its
# world, pings, whooshes, a soft chord under everything).
# -> tools/blender/films/out/<id>.mp4 (1080 × 1920, 30 / s, H.264 + AAC, ≈ 10 MB: ready for Snap and TikTok)
# python3 tools/blender/films/film.py <id> [--still N]
import math, os, subprocess, sys, wave
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, '../olympe'))
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFont
from post import glints, bloom, grade, star
from machines import M

FPS, N = 30, 210
STRIKE1, STRIKE2 = 6, 129
TITLE_IN, SWEEP = (126, 156), (160, 200)
ROOT = os.path.abspath(os.path.join(HERE, '../../..'))
OUT = os.path.join(HERE, 'out'); os.makedirs(OUT, exist_ok=True)
W, H = 1080, 1920


def smooth(t): t = min(1, max(0, t)); return t * t * (3 - 2 * t)


def impact(f):
    v = 0.0
    for s0 in (STRIKE1, STRIKE2):
        d = f - s0
        if 0 <= d < 12: v = max(v, math.exp(-d / 2.6))
    return v


# ---------------- where things are on screen (the camera of trailer.py) ----------------
def project(f, p):
    t = f / FPS
    rise = smooth((f - TITLE_IN[0] + 6) / 36)
    loc = np.array([math.sin(t * 0.35) * 0.45, -11 + 1.3 * smooth(t / 7), 1.8 - 0.3 * smooth(t / 7)])
    fw = np.array([0, 0, 0.55 + 0.1 * rise]) - loc; fw /= np.linalg.norm(fw)
    rt = np.cross(fw, [0, 0, 1]); rt /= np.linalg.norm(rt); up = np.cross(rt, fw)
    q = np.array(p) - loc; z = q @ fw
    k = 45 / 36 * H
    return W / 2 + (q @ rt) / z * k, H / 2 - (q @ up) / z * k


def hero_xy(f):
    rise = smooth((f - TITLE_IN[0] + 6) / 36)
    return project(f, (0, 0.15, 1.45 + 0.35 * rise))


def title_xy(f, lines): return project(f, (0, -1.0, -1.12 if lines else -1.25))   # tz() of trailer.py


# ---------------- the decor ----------------
class Decor:
    """the machine's decor (its video in a loop, or its image), cover-fitted, blurred, darkened, slowly pushing in"""
    def __init__(self, rel, accent):
        p = os.path.join(ROOT, 'assets/games', rel)
        self.frames, self.fps = [], 24
        if p.endswith('.mp4'):
            cap = cv2.VideoCapture(p); self.fps = cap.get(cv2.CAP_PROP_FPS) or 24
            while True:
                ok, fr = cap.read()
                if not ok: break
                self.frames.append(self.fit(fr))
        else:
            self.frames.append(self.fit(cv2.cvtColor(np.asarray(Image.open(p).convert('RGB')), cv2.COLOR_RGB2BGR)))
        self.tint = np.array(accent[::-1], np.float32)

    @staticmethod
    def fit(bgr):
        h, w = bgr.shape[:2]; k = max(600 / w, 1067 / h)
        return cv2.resize(bgr, (round(w * k), round(h * k)), interpolation=cv2.INTER_AREA)

    def get(self, f):
        t = f / FPS
        a = self.frames[int(t * self.fps) % len(self.frames)].astype(np.float32) / 255
        zz = 1.16 + 0.10 * smooth(t / 7)                   # slow push-in (and the machine's buttons off the edges)
        h, w = a.shape[:2]; cw, ch = 600 / zz, 1067 / zz
        x0, y0 = (w - cw) / 2, (h - ch) / 2
        a = cv2.resize(a[int(y0):int(y0 + ch), int(x0):int(x0 + cw)], (540, 960), interpolation=cv2.INTER_AREA)
        a = cv2.GaussianBlur(a, (0, 0), 8.0)                # far behind, out of focus: only its lights and colours
        l = a.mean(-1, keepdims=True); a = l + (a - l) * 0.8
        a = a * 0.42 + self.tint * 0.035
        # darker at the bottom (the machine's buttons, then the site's address) and a little at the top
        y = np.linspace(0, 1, 960, dtype=np.float32)[:, None, None]
        a = a * (1 - 0.62 * np.clip((y - 0.6) / 0.32, 0, 1) ** 1.3) * (1 - 0.3 * np.clip((0.16 - y) / 0.16, 0, 1))
        a = cv2.resize(a, (W, H), interpolation=cv2.INTER_CUBIC)
        return a[..., ::-1].copy()                           # RGB


# ---------------- particles ----------------
def sprite(rel, h):
    p = os.path.join(ROOT, 'assets/games', rel + '.webp')
    im = Image.open(p).convert('RGBA'); a = np.asarray(im)[..., 3]
    ys, xs = np.nonzero(a > 20); im = im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    k = h / im.size[1]; im = im.resize((max(2, round(im.size[0] * k)), h), Image.LANCZOS)
    return np.asarray(im).astype(np.float32) / 255


def paste(dst, spr, cx, cy, ang, sx, alpha=1.0):
    """an RGBA sprite turned by ang degrees and squeezed to sx (flipping coin), composited at (cx, cy)"""
    h, w = spr.shape[:2]; R = int(math.hypot(w, h) / 2) + 2
    M_ = cv2.getRotationMatrix2D((w / 2, h / 2), ang, 1.0)
    S = np.array([[max(0.04, abs(sx)), 0, (1 - max(0.04, abs(sx))) * R], [0, 1, 0]], np.float32)
    M_[:, 2] += (R - w / 2, R - h / 2)
    A = np.vstack([M_, [0, 0, 1]]); A = (np.vstack([S, [0, 0, 1]]) @ A)[:2]
    t = cv2.warpAffine(spr, A, (2 * R, 2 * R), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)
    x0, y0 = int(cx - R), int(cy - R)
    xa, ya, xb, yb = max(0, x0), max(0, y0), min(W, x0 + 2 * R), min(H, y0 + 2 * R)
    if xa >= xb or ya >= yb: return
    s = t[ya - y0:yb - y0, xa - x0:xb - x0]
    al = s[..., 3:4] * alpha
    dst[ya:yb, xa:xb] = dst[ya:yb, xa:xb] * (1 - al) + s[..., :3] * al


class FX:
    """the particles of the machine's world; every position is a function of time (any frame renders alone)"""
    def __init__(self, cfg):
        self.kind = cfg['fx']; self.acc = np.array(cfg['accent'], np.float32)
        r = np.random.default_rng(abs(hash(cfg['title'])) % 2 ** 31)
        n = {'snow': 170, 'embers': 110, 'blue_embers': 110, 'sparkles': 46, 'dust': 140, 'stars': 120, 'confetti': 70,
             'straw': 60, 'fireflies': 60, 'leaves': 40, 'coins': 26, 'notes': 22}[self.kind]
        self.P = [dict(x=r.random(), y=r.random(), z=r.random(), ph=r.random() * 6.283, sp=0.6 + 0.8 * r.random(),
                       c=r.random(), rot=r.uniform(-1, 1)) for _ in range(n)]
        self.spr = []
        if self.kind == 'coins': self.spr = [sprite(cfg['coin'], 90)]
        if self.kind == 'notes': self.spr = [sprite(f'billets/b{i}', 110) for i in range(6)]
        self.burst = [dict(a=r.random() * 6.283, v=0.5 + r.random(), c=r.random(), l=0.6 + 0.6 * r.random()) for _ in range(80)]
        self.star = {s: star(s, 1.0, 0.03) for s in (31, 51, 81)}

    def colour(self, c):
        k = self.kind
        if k == 'embers': return np.array([1.0, 0.35 + 0.45 * c, 0.08 + 0.1 * c])
        if k == 'blue_embers': return np.array([0.3 + 0.3 * c, 0.65 + 0.3 * c, 1.0])
        if k in ('dust', 'straw'): return np.array([1.0, 0.78, 0.36]) * (0.7 + 0.3 * c)
        if k == 'fireflies': return np.array([0.85, 1.0, 0.45])
        if k == 'confetti': return [np.array([1.0, 0.36, 0.75]), np.array([1.0, 0.85, 0.95]), np.array([0.72, 0.45, 1.0]), np.array([1.0, 0.82, 0.3])][int(c * 4) % 4]
        if k == 'leaves': return [np.array([0.85, 0.42, 0.1]), np.array([0.7, 0.55, 0.15]), np.array([0.55, 0.25, 0.08])][int(c * 3) % 3]
        return 0.55 + 0.45 * self.acc * (0.6 + 0.4 * c)

    def draw(self, img, f, near):
        """add (glowing kinds) or paint (solid kinds) the particles of one depth layer onto img (H × W × 3)"""
        t = f / FPS; k = self.kind
        add = np.zeros((H // 2, W // 2, 3), np.float32)           # glow layer, half size
        for p in self.P:
            if (p['z'] > 0.8) != near: continue
            z = p['z']; sp = p['sp']; ph = p['ph']
            if k in ('embers', 'blue_embers', 'dust', 'fireflies'):
                vy = {'embers': 0.09, 'blue_embers': 0.08, 'dust': 0.02, 'fireflies': 0.012}[k] * sp * (0.5 + z)
                x = (p['x'] + 0.02 * math.sin(t * 1.3 * sp + ph) + (0.03 * math.sin(t * 0.6 + ph * 2) if k == 'fireflies' else 0)) * W
                y = ((p['y'] - t * vy) % 1.1 - 0.05) * H
                fl = 0.5 + 0.5 * math.sin(t * (9 if 'embers' in k else 2.5) * sp + ph)
                r = (1.2 + 2.6 * z) * (1.6 if near else 1) * (1.5 if k == 'fireflies' else 1)
                a = (0.35 + 0.65 * fl) * (0.35 + 0.65 * z) * (0.7 if k == 'dust' else 1.1)
                cv2.circle(add, (int(x / 2), int(y / 2)), max(1, int(r / 2 + 0.5)), (self.colour(p['c']) * a).tolist(), -1, cv2.LINE_AA)
            elif k == 'snow':
                x = (p['x'] + 0.03 * math.sin(t * 0.9 * sp + ph)) * W
                y = ((p['y'] + t * (0.035 + 0.06 * z) * sp) % 1.1 - 0.05) * H
                r = 1.5 + 3.5 * z + (5 if near else 0)
                cv2.circle(add, (int(x / 2), int(y / 2)), max(1, int(r / 2)), (np.array([0.8, 0.86, 1.0]) * (0.35 + 0.5 * z)).tolist(), -1, cv2.LINE_AA)
            elif k == 'stars':
                # warp: points rushing out of the centre
                cx, cy = W / 2, H * 0.36
                u = (p['y'] + t * 0.22 * sp) % 1.0
                d = (u ** 2.2) * 1.3 * H; a = p['ph']
                x, y = cx + math.cos(a) * d, cy + math.sin(a) * d
                ln = 6 + 160 * u ** 2.2 * (0.5 + z)
                x2, y2 = x - math.cos(a) * ln, y - math.sin(a) * ln
                cv2.line(add, (int(x / 2), int(y / 2)), (int(x2 / 2), int(y2 / 2)), (self.colour(p['c']) * u * (0.5 + z)).tolist(), 1, cv2.LINE_AA)
            elif k == 'sparkles':
                life = (t * 0.55 * sp + p['ph'] / 6.283) % 1.0
                a = math.sin(math.pi * life) ** 3
                s = 81 if near else (51 if z > 0.4 else 31)
                st = self.star[s] * a * (0.7 + 0.5 * z)
                x, y = int(p['x'] * W / 2), int(((p['y'] + 0.37 * math.floor(t * 0.55 * sp + p['ph'] / 6.283)) % 1.0) * H / 2)
                r = s // 2
                x0, y0, x1, y1 = max(0, x - r), max(0, y - r), min(W // 2, x + r + 1), min(H // 2, y + r + 1)
                if x0 < x1 and y0 < y1:
                    add[y0:y1, x0:x1] += st[y0 - y + r:y1 - y + r, x0 - x + r:x1 - x + r, None] * self.colour(p['c'])
        if k in ('confetti', 'leaves', 'straw', 'coins', 'notes'):
            for p in self.P:
                if (p['z'] > 0.75) != near: continue
                z = p['z']; sp = p['sp']; ph = p['ph']
                fall = {'confetti': 0.10, 'leaves': 0.07, 'straw': 0.05, 'coins': 0.16, 'notes': 0.09}[k]
                x = (p['x'] + 0.05 * math.sin(t * 1.6 * sp + ph) + (0.12 * t * sp if k == 'straw' else 0)) % 1.0 * W
                y = ((p['y'] + t * fall * sp * (0.6 + 0.6 * z)) % 1.15 - 0.075) * H
                ang = math.degrees(t * 2.5 * p['rot'] + ph); flip = math.cos(t * 4.5 * sp + ph)
                if k in ('coins', 'notes'):
                    spr = self.spr[int(p['c'] * len(self.spr)) % len(self.spr)]
                    s = 0.45 + 0.75 * z
                    sp_ = cv2.resize(spr, (max(2, int(spr.shape[1] * s)), max(2, int(spr.shape[0] * s))), interpolation=cv2.INTER_AREA)
                    if near: sp_ = cv2.GaussianBlur(sp_, (0, 0), 2.5)
                    # at the end, the big ones in front stay off the title and the site's address
                    al = 0.95 * (1 - smooth((f - 140) / 20) * (y > 0.58 * H)) if near else 0.95
                    if al > 0.02: paste(img, sp_, x, y, ang * 0.5, flip, al)
                else:
                    L = (14 if k == 'confetti' else 26 if k == 'leaves' else 30) * (0.5 + 0.8 * z) * (1.5 if near else 1)
                    Wd = (8 if k == 'confetti' else 12 if k == 'leaves' else 2.5) * (0.5 + 0.8 * z) * max(0.15, abs(flip)) * (1.5 if near else 1)
                    box = cv2.boxPoints(((x, y), (L, Wd), ang)).astype(np.int32)
                    col = self.colour(p['c']) * (0.75 + 0.25 * flip)
                    if k == 'leaves': cv2.ellipse(img, ((x, y), (L, Wd), ang), col.tolist(), -1, cv2.LINE_AA)
                    else: cv2.fillConvexPoly(img, box, col.tolist(), cv2.LINE_AA)
        if add.any():
            add = cv2.resize(add, (W, H), interpolation=cv2.INTER_LINEAR)
            glow = cv2.GaussianBlur(add, (0, 0), 6 if near else 3)
            img += (cv2.GaussianBlur(add, (0, 0), 3 if near else 0.8) * 1.1 + glow * 0.9)

    def sparks(self, img, f, centre, s0):
        """the sparks thrown by an impact"""
        d = f - s0
        if not 0 <= d < 30: return
        layer = np.zeros((H, W, 3), np.float32)
        cx, cy = centre
        for b in self.burst:
            dist = lambda dd: b['v'] * 900 * (1 - math.exp(-dd / 7))
            p1, p0 = dist(d), dist(max(0, d - 1.5))
            a = b['a']
            x1, y1 = cx + math.cos(a) * p1, cy + math.sin(a) * p1 * 0.85 + 40 * (d / 30) ** 2 * 10
            x0, y0 = cx + math.cos(a) * p0, cy + math.sin(a) * p0 * 0.85 + 40 * (max(0, d - 1.5) / 30) ** 2 * 10
            fade = (1 - d / 30) ** 1.5 * b['l']
            col = (np.array([1, 1, 1]) * 0.5 + self.acc * 0.5) * fade * 1.4
            cv2.line(layer, (int(x0), int(y0)), (int(x1), int(y1)), col.tolist(), 3, cv2.LINE_AA)
        img += layer + cv2.GaussianBlur(layer, (0, 0), 5) * 1.2


def shock(img, f, centre, s0, acc):
    """the shockwave ring and the flash of an impact"""
    d = f - s0
    if not 0 <= d < 26: return
    cx, cy = centre
    yy, xx = np.ogrid[:H, :W]
    dist = np.sqrt((xx - cx) ** 2 + ((yy - cy) / 0.82) ** 2).astype(np.float32)
    R = 30 + 1150 * (1 - math.exp(-d / 7)); th = 10 + 40 * (1 - math.exp(-d / 5))
    a = (1 - d / 26) ** 1.6
    ring = np.exp(-((dist - R) / th) ** 2) * a
    col = np.array(acc, np.float32) * 0.6 + 0.4
    img += ring[..., None] * col * 0.9
    if d < 10:
        core = np.exp(-(dist / (180 + 40 * d)) ** 2) * math.exp(-d / 2.5)
        img += core[..., None] * (col * 1.6)


def shafts(rgb, centre, strength, thresh=0.55):
    """light shafts from the hero: the bright parts blurred outwards from its centre (zoom blur)"""
    if strength <= 0.01: return rgb
    q = cv2.resize(np.clip(rgb - thresh, 0, None), (W // 4, H // 4), interpolation=cv2.INTER_AREA)
    cx, cy = centre[0] / 4, centre[1] / 4
    acc = np.zeros_like(q)
    for i in range(10):
        s = 1 + 0.045 * i
        Mz = np.float32([[s, 0, cx * (1 - s)], [0, s, cy * (1 - s)]])
        acc += cv2.warpAffine(q, Mz, (W // 4, H // 4)) * (1 - i / 10)
    return rgb + cv2.resize(acc / 5.5, (W, H), interpolation=cv2.INTER_LINEAR) * strength


FONT_B = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'


def caption(f):
    a = min(1, max(0, (f - 168) / 14))
    if a <= 0: return None
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    def ctext(y, txt, font, fill):
        w = d.textlength(txt, font=font); d.text(((W - w) / 2 + 2, y + 3), txt, font=font, fill=(0, 0, 0, int(fill[3] * 0.6))); d.text(((W - w) / 2, y), txt, font=font, fill=fill)
    ctext(1660, 'JOUE GRATUITEMENT SUR', ImageFont.truetype(FONT_B, 38), (255, 236, 190, int(220 * a)))
    ctext(1712, 'www.spinbetcaz.com', ImageFont.truetype(FONT_B, 58), (255, 255, 255, int(255 * a)))
    ctext(1800, 'jeu gratuit · argent fictif · 18+', ImageFont.truetype(FONT, 30), (215, 215, 232, int(210 * a)))
    return np.asarray(im).astype(np.float32) / 255


class Film:
    def __init__(self, mid):
        self.mid = mid; self.cfg = cfg = M[mid]
        self.dir = os.path.join(os.environ.get('BL_TMP', '/tmp/films3d'), mid)
        self.decor = Decor(cfg['bg'], cfg['accent'])
        self.fx = FX(cfg)
        self.acc = np.array(cfg['accent'], np.float32)
        self.lines = cfg['title'].count('\n')
        # light paintings (La Sweety's white tiles) must not glow white: a higher threshold, less glow
        self.bloom, self.glow = cfg.get('bloom', 0.7), cfg.get('glow', 1.0)

    def compose(self, f):
        t = f / FPS; v = impact(f); acc = self.acc
        hx, hy = hero_xy(f); tx, ty = title_xy(f, self.lines)
        bg = self.decor.get(f)
        # the machine's light behind the hero
        yy, xx = np.ogrid[:H, :W]
        g = np.exp(-(((xx - hx) / 430.0) ** 2 + ((yy - hy) / 470.0) ** 2)).astype(np.float32)
        on = smooth((f - STRIKE1) / 14)
        bg += g[..., None] * acc * (0.42 + 0.08 * math.sin(t * 5)) * on
        tl = np.exp(-(((xx - tx) / 520.0) ** 2 + ((yy - ty) / 170.0) ** 2)).astype(np.float32)
        bg += tl[..., None] * acc * 0.22 * smooth((f - TITLE_IN[0]) / 20)
        self.fx.draw(bg, f, False)
        fr = np.asarray(Image.open(f'{self.dir}/f{f:04d}.png').convert('RGBA').resize((W, H), Image.LANCZOS)).astype(np.float32) / 255
        fr = glints(fr, 4, 0.9, seed=f, thresh=0.8, scale=0.10, inner=0.004)
        a = fr[..., 3:4]
        out = bg * (1 - a) + fr[..., :3] * a
        out = shafts(out, (hx, hy), (0.18 * on + 0.7 * v) * self.glow, self.bloom - 0.15)
        self.fx.draw(out, f, True)
        shock(out, f, (hx, hy), STRIKE1, acc); shock(out, f, (tx, ty), STRIKE2, acc)
        self.fx.sparks(out, f, (hx, hy), STRIKE1); self.fx.sparks(out, f, (tx, ty), STRIKE2)
        out += acc * v * 0.12
        out = bloom(out, self.bloom, (0.42 + 0.5 * v) * self.glow)
        out = grade(out, sat=1.08, vignette=0.40, grain=0.008, seed=f)
        c = caption(f)
        if c is not None: out = out * (1 - c[..., 3:4]) + c[..., :3] * c[..., 3:4]
        fade = smooth(f / 4)
        return (np.clip(out * fade, 0, 1) * 255).round().astype(np.uint8)


# ---------------- sound (48 kHz stereo) ----------------
SR = 48000


def env(n, a, d):
    t = np.arange(n) / SR
    return np.minimum(1, t / max(a, 1e-4)) * np.exp(-t / d)


def lowpass(x, fc):
    a = math.exp(-2 * math.pi * fc / SR); y = np.empty_like(x); s = 0.0
    for i in range(len(x)): s = (1 - a) * x[i] + a * s; y[i] = s
    return y


def sound(mid, path):
    kind = M[mid].get('sound', 'boom')
    major = kind in ('chime', 'bells', 'gong')
    n = int(SR * N / FPS) + SR // 2
    L = np.zeros(n, np.float32); R = np.zeros(n, np.float32)
    r = np.random.default_rng(len(mid) * 7 + 3)
    T = np.arange(n) / SR

    def add(at, sig, pan=0.0, gain=1.0):
        i = int(at * SR); j = min(n, i + len(sig)); s = sig[:j - i] * gain
        L[i:j] += s * (1 - max(0, pan)); R[i:j] += s * (1 + min(0, pan))

    def boom(at, g=0.9, f0=70):
        m = int(SR * 1.6); t = np.arange(m) / SR
        f = f0 * np.exp(-t * 1.6) + 36
        add(at, (np.sin(2 * math.pi * np.cumsum(f) / SR) * np.exp(-t / 0.55)).astype(np.float32), 0, g)
        crack = r.standard_normal(int(SR * 0.06)).astype(np.float32) * env(int(SR * 0.06), 0.001, 0.02)
        add(at, crack, 0.15, 0.35)
        rum_n = int(SR * 2.2); add(at + 0.01, lowpass(r.standard_normal(rum_n).astype(np.float32), 120) * 8 * env(rum_n, 0.02, 0.6), -0.1, 0.55)

    def ping(at, f0, pan, g=0.14, dec=0.22):
        m = int(SR * 0.9); t = np.arange(m) / SR
        s = (np.sin(2 * math.pi * f0 * t) + 0.35 * np.sin(2 * math.pi * f0 * 2.01 * t) + 0.12 * np.sin(2 * math.pi * f0 * 3.02 * t)) * np.exp(-t / dec)
        add(at, s.astype(np.float32), pan, g)

    def whoosh(at, dur, g=0.5):
        m = int(SR * dur); x = r.standard_normal(m).astype(np.float32)
        t = np.linspace(0, 1, m, dtype=np.float32)
        lo = lowpass(x, 300); hi = x - lowpass(x, 2500)
        add(at, (lo * (1 - t) * 2 + hi * t * 0.6) * np.sin(math.pi * t) ** 1.5, 0, g)

    def special(at):
        if kind == 'roar':
            m = int(SR * 1.5); t = np.arange(m) / SR
            nz = lowpass(r.standard_normal(m).astype(np.float32), 380) * 6
            am = 0.6 + 0.4 * np.sin(2 * math.pi * 31 * t) * np.sin(2 * math.pi * 7 * t)
            add(at + 0.05, nz * am * env(m, 0.12, 0.55), 0, 0.9)
        elif kind == 'gong':
            m = int(SR * 3.5); t = np.arange(m) / SR
            s = sum(a * np.sin(2 * math.pi * 98 * k * t * (1 + 0.002 * np.sin(2 * math.pi * 4 * t))) * np.exp(-t / d)
                    for k, a, d in ((1, 1, 2.2), (1.47, 0.6, 1.6), (2.09, 0.45, 1.2), (2.56, 0.3, 0.9), (3.18, 0.25, 0.7)))
            add(at, (s * np.minimum(1, t / 0.01)).astype(np.float32), 0, 0.35)
        elif kind == 'shot':
            m = int(SR * 0.12); x = r.standard_normal(m).astype(np.float32) * env(m, 0.0005, 0.03)
            for k, (dt, g) in enumerate(((0, 0.9), (0.19, 0.3), (0.38, 0.12))):
                add(at + dt, x - lowpass(x, 900) * 0.5, 0.1 - 0.2 * k, g)
        elif kind == 'bells':
            for k in range(26): ping(at + r.random() * 0.7, 3600 + r.random() * 3000, r.uniform(-0.8, 0.8), 0.05, 0.05)
            ping(at, 523.25, 0, 0.25, 1.2); ping(at, 659.25, 0, 0.18, 1.0)
        elif kind == 'chime':
            for k, fq in enumerate((1046.5, 1318.5, 1568.0, 2093.0)): ping(at + 0.04 * k, fq, -0.6 + 0.4 * k, 0.12, 0.6)
        elif kind == 'wind':
            whoosh(at - 0.1, 1.3, 0.8)

    # a soft chord under everything (minor, or major for the sweet worlds), swelling at the title
    root = 110.0
    chord = (1, 1.4983, 2, 2.5198 if major else 2.3784, 3.0)
    pad = sum(np.sin(2 * math.pi * root * c * T * (1 + 0.0015 * k)) * (0.5 + 0.5 * np.sin(2 * math.pi * 0.2 * T + k)) for k, c in enumerate(chord))
    swell = 0.5 + 0.5 * np.clip((T - TITLE_IN[0] / FPS) / 0.8, 0, 1)
    pad = pad * np.clip(T / 0.8, 0, 1) * swell * 0.045
    L += pad.astype(np.float32); R += pad.astype(np.float32)

    whoosh(0.0, 0.3, 0.25)
    boom(STRIKE1 / FPS); special(STRIKE1 / FPS)
    scale = [1, 9 / 8, 5 / 4 if major else 6 / 5, 3 / 2, 5 / 3 if major else 8 / 5, 2]
    for k in range(9): ping(STRIKE1 / FPS + 0.25 + k * 0.09 + r.random() * 0.04, 880 * scale[r.integers(6)] * (2 if r.random() < 0.5 else 1), r.uniform(-0.8, 0.8))
    for k in range(6): ping(1.4 + k * 0.42 + r.random() * 0.1, 1760 * scale[r.integers(6)], r.uniform(-0.8, 0.8), 0.07)
    whoosh(TITLE_IN[0] / FPS - 0.9, 0.95, 0.55)
    boom(STRIKE2 / FPS, 1.0, 62); special(STRIKE2 / FPS)
    for k in range(10): ping(SWEEP[0] / FPS + k * 0.11, 1320 * scale[k % 6] * (1 + k // 6), -0.8 + k * 0.17, 0.10)
    mx = max(np.abs(L).max(), np.abs(R).max(), 1e-6)
    L, R = np.tanh(L / mx * 1.3) * 0.85, np.tanh(R / mx * 1.3) * 0.85
    fade = np.ones(n, np.float32); fade[-SR // 2:] = np.linspace(1, 0, SR // 2); L *= fade; R *= fade
    with wave.open(path, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.stack([L, R], 1) * 32767).astype('<i2').tobytes())


def main(mid):
    fl = Film(mid)
    wav = f'{fl.dir}/sound.wav'; sound(mid, wav)
    out = f'{OUT}/{mid}.mp4'
    p = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                          '-i', wav, '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'slow', '-crf', '21', '-pix_fmt', 'yuv420p',
                          '-profile:v', 'high', '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', out], stdin=subprocess.PIPE)
    for f in range(N):
        p.stdin.write(fl.compose(f).tobytes())
        if f % 30 == 0: print(mid, 'frame', f, flush=True)
    p.stdin.close(); p.wait()
    print(out, os.path.getsize(out) // 1024, 'KB')


if __name__ == '__main__':
    mid = next(x for x in sys.argv[1:] if x in M)
    if '--still' in sys.argv:
        f = int(sys.argv[sys.argv.index('--still') + 1])
        Image.fromarray(Film(mid).compose(f)).save(f'{OUT}/{mid}-{f:04d}.jpg', quality=88)
    else:
        main(mid)
