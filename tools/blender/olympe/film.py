# L'Olympe in 3D, the film's finishing (after trailer.py has rendered its frames in BL_TMP): each Blender frame (gems,
# lightning, energy core, gold title, on a transparent background) is set ×2 over a storm sky drawn here (clouds that drift,
# lit by the strikes), with gold dust in front and behind, glints on the facets and the gold letters, bloom, grade, the
# site address at the end; plus its sound, made here too (thunder, sparkles, whoosh, boom of the title).
# -> tools/blender/olympe/out/olympe-3d.mp4 (1080 × 1920, 30 / s, H.264 + AAC)
# python3 tools/blender/olympe/film.py
import math, os, subprocess, sys, wave
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFont
from post import glints, bloom, grade
from trailer import N, FPS, TMP, STRIKE1, STRIKE2, TITLE_IN, SWEEP, strikes

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out'); os.makedirs(OUT, exist_ok=True)
W, H = 1080, 1920
rng = np.random.default_rng(26)


def fbm_layers():
    """4 octaves of value noise, larger than the frame (they drift)"""
    L = []
    for k, (g, amp) in enumerate([(5, 1.0), (10, 0.5), (20, 0.25), (40, 0.12)]):
        L.append((np.random.default_rng(10 + k).random((g * 3, g * 2)).astype(np.float32), amp, g))
    return L


LAYERS = fbm_layers()


def sky(f):
    t = f / FPS
    h, w = H // 4, W // 4
    acc = np.zeros((h, w), np.float32)
    for k, (base, amp, g) in enumerate(LAYERS):
        big = cv2.resize(base, (w * 2, h * 3 // 2), interpolation=cv2.INTER_CUBIC)
        ox = int((t * (6 + 4 * k)) % (w)); oy = int((t * (3 + k)) % (h // 2))
        acc += big[oy:oy + h, ox:ox + w] * amp
    acc /= 1.87
    clouds = np.clip((acc - 0.42) * 2.2, 0, 1) ** 1.3
    y = np.linspace(0, 1, h, dtype=np.float32)[:, None]
    x = np.linspace(-1, 1, w, dtype=np.float32)[None, :]
    top, mid, low = np.array([0.012, 0.018, 0.06]), np.array([0.07, 0.04, 0.16]), np.array([0.10, 0.05, 0.14])
    g = np.clip(y / 0.55, 0, 1)[..., None]
    col = top * (1 - g) + mid * g
    col = col + (low - mid) * np.clip((y - 0.55) / 0.45, 0, 1)[..., None]
    col = np.broadcast_to(col, (h, w, 3)).copy()
    v = strikes(f)
    # glow of the storm energy behind the ring, flashes in the clouds
    gx, gy = 0.0, 0.33
    d = np.sqrt((x - gx) ** 2 * 0.6 + (y - gy) ** 2 * 2.2)
    energy = min(1, max(0, (f - STRIKE1) / 12))
    col += np.array([0.10, 0.20, 0.55]) * (np.exp(-(d / 0.35) ** 2) * (0.35 + 0.15 * math.sin(t * 9)) * energy)[..., None]
    lit = np.array([0.20, 0.24, 0.42]) + np.array([0.9, 1.0, 1.25]) * v * 1.6
    col += clouds[..., None] * lit * (0.55 + 0.45 * (1 - y))[..., None]
    return cv2.resize(col.astype(np.float32), (W, H), interpolation=cv2.INTER_CUBIC)


# gold dust: far (small, sharp, slow) and near (big, blurred, faster) motes drifting up, twinkling
DUST = [dict(x=rng.random(), y=rng.random(), z=rng.random(), ph=rng.random() * 6.3, sp=0.5 + rng.random()) for _ in range(140)]


def dust(f, near):
    t = f / FPS
    layer = np.zeros((H, W, 3), np.float32)
    for p in DUST:
        if (p['z'] > 0.82) != near: continue
        z = p['z']
        x = (p['x'] + 0.012 * math.sin(t * p['sp'] + p['ph'])) * W
        y = ((p['y'] - t * (0.012 + 0.04 * z) * p['sp']) % 1.0) * H
        r = 1.2 + 2.2 * z + (10 * (z - 0.82) / 0.18 if near else 0)
        a = (0.35 + 0.65 * (0.5 + 0.5 * math.sin(t * 3 * p['sp'] + p['ph']))) * (0.25 + 0.6 * z) * (0.6 if near else 1)
        cv2.circle(layer, (int(x), int(y)), max(1, int(r)), (1.0 * a, 0.78 * a, 0.36 * a), -1, cv2.LINE_AA)
    k = 7 if near else 1.2
    return cv2.GaussianBlur(layer, (0, 0), k)


FONT_B = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'


def caption(f):
    """the address at the end, like the daily Shorts"""
    a = min(1, max(0, (f - 168) / 14))
    if a <= 0: return None
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    def ctext(y, txt, font, fill):
        w = d.textlength(txt, font=font); d.text(((W - w) / 2, y), txt, font=font, fill=fill)
    ctext(1640, 'JOUE GRATUITEMENT SUR', ImageFont.truetype(FONT_B, 38), (255, 236, 190, int(220 * a)))
    ctext(1692, 'www.spinbetcaz.com', ImageFont.truetype(FONT_B, 58), (255, 255, 255, int(255 * a)))
    ctext(1782, 'jeu gratuit · argent fictif · 18+', ImageFont.truetype(FONT, 30), (210, 210, 230, int(200 * a)))
    return np.asarray(im).astype(np.float32) / 255


def compose(f):
    bg = sky(f) + dust(f, False)
    fr = np.asarray(Image.open(f'{TMP}/f{f:04d}.png').convert('RGBA').resize((W, H), Image.LANCZOS)).astype(np.float32) / 255
    fr = glints(fr, 5, 1.0, seed=f, thresh=0.7, scale=0.12, inner=0.004)
    a = fr[..., 3:4]
    out = bg * (1 - a) + fr[..., :3] * a
    out += dust(f, True)
    v = strikes(f)
    out += np.array([0.5, 0.6, 0.9], np.float32) * v * 0.18          # the flash fills the whole frame for a moment
    out = bloom(out, 0.68, 0.5 + 0.5 * v)
    out = grade(out, sat=1.1, vignette=0.36, grain=0.010, seed=f)
    c = caption(f)
    if c is not None: out = out * (1 - c[..., 3:4]) + c[..., :3] * c[..., 3:4]
    return (np.clip(out, 0, 1) * 255).round().astype(np.uint8)


# ---------------- sound (48 kHz stereo) ----------------
SR = 48000


def env(n, a, d):
    t = np.arange(n) / SR
    return np.minimum(1, t / max(a, 1e-4)) * np.exp(-t / d)


def lowpass(x, fc):
    a = math.exp(-2 * math.pi * fc / SR); y = np.empty_like(x); s = 0.0
    for i in range(len(x)): s = (1 - a) * x[i] + a * s; y[i] = s
    return y


def sound():
    n = int(SR * N / FPS) + SR // 2
    L = np.zeros(n, np.float32); R = np.zeros(n, np.float32)
    r = np.random.default_rng(5)
    def add(at, sig, pan=0.0, gain=1.0):
        i = int(at * SR); j = min(n, i + len(sig)); s = sig[:j - i] * gain
        L[i:j] += s * (1 - max(0, pan)); R[i:j] += s * (1 + min(0, pan))
    def thunder(at, big):
        crack = r.standard_normal(int(SR * 0.09)).astype(np.float32) * env(int(SR * 0.09), 0.001, 0.025)
        rum_n = int(SR * 3.2); rum = lowpass(r.standard_normal(rum_n).astype(np.float32), 140) * 9
        rum *= env(rum_n, 0.02, 0.9 if big else 0.6)
        add(at, crack, 0.2, 0.55); add(at + 0.02, rum, -0.1, 0.9 if big else 0.6)
    def ping(at, f0, pan, g=0.16):
        m = int(SR * 0.7); t = np.arange(m) / SR
        s = (np.sin(2 * math.pi * f0 * t) + 0.4 * np.sin(2 * math.pi * f0 * 2.01 * t)) * np.exp(-t / 0.22)
        add(at, s.astype(np.float32), pan, g)
    def whoosh(at, dur, up=True, g=0.5):
        m = int(SR * dur); x = r.standard_normal(m).astype(np.float32)
        t = np.linspace(0, 1, m, dtype=np.float32)
        lo = lowpass(x, 300); hi = x - lowpass(x, 2500)
        mixk = t if up else 1 - t
        s = (lo * (1 - mixk) * 2 + hi * mixk * 0.6) * np.sin(math.pi * t) ** 1.5
        add(at, s, 0.0, g)
    def boom(at):
        m = int(SR * 1.6); t = np.arange(m) / SR
        f = 70 * np.exp(-t * 1.6) + 38
        s = np.sin(2 * math.pi * np.cumsum(f) / SR) * np.exp(-t / 0.55)
        add(at, s.astype(np.float32), 0.0, 0.9)
    whoosh(0.0, 0.25, True, 0.25)
    thunder(STRIKE1 / FPS, True)
    for k in range(9): ping(STRIKE1 / FPS + 0.25 + k * 0.09 + r.random() * 0.05, 1800 + r.random() * 2600, r.uniform(-0.8, 0.8))
    for k in range(6): ping(1.4 + k * 0.42 + r.random() * 0.1, 2200 + r.random() * 2400, r.uniform(-0.8, 0.8), 0.08)
    whoosh(TITLE_IN[0] / FPS - 0.9, 0.95, True, 0.55)
    thunder(STRIKE2 / FPS, True); boom(STRIKE2 / FPS + 0.03)
    for k in range(10): ping(SWEEP[0] / FPS + k * 0.11, 2600 + k * 220, -0.8 + k * 0.17, 0.11)
    mx = max(np.abs(L).max(), np.abs(R).max(), 1e-6)
    L, R = np.tanh(L / mx * 1.3) * 0.85, np.tanh(R / mx * 1.3) * 0.85
    fade = np.ones(n, np.float32); fade[-SR // 2:] = np.linspace(1, 0, SR // 2); L *= fade; R *= fade
    path = f'{TMP}/sound.wav'
    with wave.open(path, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.stack([L, R], 1) * 32767).astype('<i2').tobytes())
    return path


def main():
    wav = sound()
    out = f'{OUT}/olympe-3d.mp4'
    p = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                          '-i', wav, '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p',
                          '-profile:v', 'high', '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', out], stdin=subprocess.PIPE)
    for f in range(N):
        p.stdin.write(compose(f).tobytes())
        if f % 30 == 0: print('frame', f, flush=True)
    p.stdin.close(); p.wait()
    print(out, os.path.getsize(out) // 1024, 'KB')


if __name__ == '__main__':
    if '--still' in sys.argv:
        f = int(sys.argv[sys.argv.index('--still') + 1])
        Image.fromarray(compose(f)).save(f'{OUT}/still-{f:04d}.jpg', quality=90)
    else:
        main()
