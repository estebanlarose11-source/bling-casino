#!/usr/bin/env python3
# La Roue Folle, bonus avec la présentatrice du Plateau Live (demande du propriétaire du 18 novembre 2026 : « la même animatrice
# pour la roue folle et le plateau… tu la mets à la place du présentateur dans les bonus »).
#   1. sansanimateur.py : les 3 vidéos (Pachinko, canards, roue à 3 flèches) recalées et SANS l'animateur → WORK/<k>-clean.npy ;
#   2. la présentatrice détourée image par image dans SA vidéo (tools/art/plateaulive/attente.mp4 : elle parle à côté de la roue,
#      micro à la main) : rembg « isnet-general-use » (net autour du micro et des cheveux) → FEMME/NNN.png (RGBA, découpe X0, Y0) :
#      python3 tools/art/madwheel/femme.py --matte ;
#   3. ici : elle est posée à la place de l'animateur (même hauteur de tête, coupée par le bas de l'image comme dans sa vidéo),
#      couleurs un peu rapprochées de la scène, en 1344 × 896 ; SA VOIX remplace celle de l'animateur (même passage que l'image :
#      ses lèvres vont avec) ; Pachinko et roue : boucle sans coupure (le fond ET elle : un passage où elle revient à la même pose) ;
#      sa planche de masques (bmask-*.png) pour qu'elle reste devant nos éléments, et BTRACK réécrit dans games/madwheel.js.
# Sorties : assets/games/madwheel/b-<pa|ch|ct>.mp4 + .webp + bmask-<pa|ch|ct>.png.
# pip install opencv-python-headless numpy pillow "rembg[cpu]" ; ffmpeg.
#   MW_WORK=… python3 tools/art/madwheel/sansanimateur.py ; MW_FEMME=… python3 tools/art/madwheel/femme.py --matte ;
#   MW_WORK=… MW_FEMME=… python3 tools/art/madwheel/femme.py [pa ch ct] ; puis pileface-femme.py --masks et pileface-femme.py
import json, os, re, subprocess, sys
import numpy as np, cv2
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, '..'))
import bonus as B  # noqa: E402

OUT = B.OUT
WORK = B.WORK
FEMME = os.environ.get('MW_FEMME', '/tmp/mw-femme')
ATT = os.path.join(ROOT, 'tools', 'art', 'plateaulive', 'attente.mp4')  # 1920 × 1080, 25 images/s, avec sa voix
X0, Y0, CW, CH = 360, 180, 640, 900  # the crop of her frames in attente.mp4 (matte.py)
NATT = 538
W2, H2 = B.W * 2, B.H * 2
# where she stands, per video (output pixels, 1344 × 896): top of her head, centre of her body; she is cut by the bottom of the
# picture as in her own video
PLACE = {'pa': (196, 1146), 'ch': (122, 1050), 'ct': (150, 1032)}
SEG = {'ch': 70, 'pf': 150}  # Tir aux Cibles, Pile ou Face: her passage starts here (frames at 24/s); the loops find theirs


def her(q):
    a = np.array(Image.open(os.path.join(FEMME, f'{q:03d}.png')).convert('RGBA'))
    return a


def her_box():
    """her head top and body centre in the crop (median over a few frames)"""
    tops, cxs = [], []
    for q in range(0, NATT, 40):
        if not os.path.exists(os.path.join(FEMME, f"{q:03d}.png")): continue
        al = her(q)[..., 3] > 128
        ys, xs = np.nonzero(al)
        tops.append(ys.min()); cxs.append(np.median(xs))
    return float(np.median(tops)), float(np.median(cxs))


def src_frame(n, s):
    return min(NATT - 1, int(round((s + n) * 25 / 24)))


def up2(f):
    g = cv2.resize(f, (W2, H2), interpolation=cv2.INTER_LANCZOS4).astype(np.float32)
    b = cv2.GaussianBlur(g, (0, 0), 1.0)
    return np.clip(g + 0.45 * (g - b), 0, 255).astype(np.uint8)


def match(img, ref):
    """her colours brought a little towards the light of the scene around her"""
    m1 = img.reshape(-1, 3).mean(0); m2 = ref.reshape(-1, 3).mean(0)
    k = np.clip((m2 / np.maximum(m1, 1)) ** 0.18, 0.9, 1.1)
    return np.clip(img * k * 0.97, 0, 255)


class Placer:
    def __init__(self, k):
        top, cx = PLACE[k]
        ht, hc = her_box()
        self.s = (H2 - top) / (CH - ht)  # her head top → top, the bottom of the crop → the bottom of the picture
        self.w, self.h = int(round(CW * self.s)), int(round(CH * self.s))
        self.x = int(round(cx - hc * self.s)); self.y = H2 - self.h

    def put(self, bg, rgba, ref=None):
        im = cv2.resize(rgba, (self.w, self.h), interpolation=cv2.INTER_AREA if self.s < 1 else cv2.INTER_CUBIC).astype(np.float32)
        a = im[..., 3:] / 255
        a = cv2.GaussianBlur(cv2.erode(a, np.ones((2, 2), np.uint8)), (0, 0), 0.7)[..., None]
        col = im[..., :3]
        if ref is not None: col = match(col, ref)
        out = bg.astype(np.float32); full = np.zeros((H2, W2), np.float32)
        x0, y0 = max(0, self.x), max(0, self.y); x1, y1 = min(W2, self.x + self.w), min(H2, self.y + self.h)
        sx, sy = x0 - self.x, y0 - self.y
        aa = a[sy:sy + y1 - y0, sx:sx + x1 - x0]
        out[y0:y1, x0:x1] = out[y0:y1, x0:x1] * (1 - aa) + col[sy:sy + y1 - y0, sx:sx + x1 - x0] * aa
        full[y0:y1, x0:x1] = aa[..., 0]
        return out.round().astype(np.uint8), full


def att_audio():
    p = os.path.join(WORK, 'att.wav')
    if not os.path.exists(p):
        subprocess.check_call(['ffmpeg', '-v', 'error', '-y', '-i', ATT, '-vn', '-ac', '2', '-ar', '48000', p])
    raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', p, '-f', 's16le', '-ac', '2', '-ar', '48000', '-'])
    return np.frombuffer(raw, np.int16).reshape(-1, 2).astype(np.float32)


def thumbs():
    p = os.path.join(WORK, 'her-thumbs.npy')
    if os.path.exists(p): return np.load(p)
    t = np.stack([cv2.resize(her(q), (64, 90), interpolation=cv2.INTER_AREA) for q in range(NATT)]).astype(np.float32)
    np.save(p, t); return t


def her_loop(i, j, n_out, aud):
    """the passage s of her video (in frames at 24/s) where she comes back to the same pose and is quiet across the seam"""
    th = thumbs(); best = None; L = j - i
    rms = lambda t: float(np.sqrt((aud[max(0, int(t * 48000) - 2400):int(t * 48000) + 2400] ** 2).mean() + 1))
    for s in range(0, int(NATT * 24 / 25) - n_out - 2):
        a, b = th[src_frame(i, s)], th[src_frame(j, s)]
        d = np.abs(a - b).mean() + 0.02 * (rms((s + j + 1) / 24) + rms((s + i + 1) / 24)) / 100
        if best is None or d < best[0]: best = (d, s)
    print(f'  her loop: passage {best[1]} (difference {best[0]:.2f})', flush=True)
    return best[1]


def audio_for(aud, s, n_frames, seam=None):
    """her voice for the frames: from s/24 on; with a loop (i, j): after frame j, the voice of frame i + 1 again"""
    sr = 48000; t0 = int(s / 24 * sr)
    if seam is None:
        return aud[t0:t0 + int(n_frames / 24 * sr)]
    i, j = seam
    a = aud[t0:t0 + int((j + 1) / 24 * sr)].copy()
    t1 = int((s + i + 1) / 24 * sr); b = aud[t1:t1 + int((n_frames - j - 1) / 24 * sr) + sr // 10].copy()
    f = 480
    ramp = np.linspace(0, 1, f)[:, None]
    a[-f:] = a[-f:] * (1 - ramp) + b[:f] * ramp
    return np.concatenate([a, b[f:]])


def write(k, frames, audio, size=(W2, H2), crf=27, gop=12):
    wav = os.path.join(WORK, f'{k}-voice.wav')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 's16le', '-ar', '48000', '-ac', '2', '-i', '-', wav],
                   input=np.clip(audio, -32768, 32767).astype(np.int16).tobytes(), check=True)
    p = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{size[0]}x{size[1]}', '-r', '24', '-i', '-', '-i', wav,
                          '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'slow', '-crf', str(crf), '-g', str(gop), '-pix_fmt', 'yuv420p',
                          '-c:a', 'aac', '-b:a', '112k', '-shortest', '-movflags', '+faststart', os.path.join(OUT, f'b-{k}.mp4')], stdin=subprocess.PIPE)
    p.communicate(frames.tobytes())
    Image.fromarray(frames[0]).save(os.path.join(OUT, f'b-{k}.webp'), quality=80, method=6)
    print(f'  b-{k}.mp4: {len(frames)} frames', flush=True)


def make(k, aud):
    print(k, flush=True)
    fr = np.load(os.path.join(WORK, f'{k}-clean.npy'))
    d = {'w': B.W, 'h': B.H, 'box': [round(B.BOX[k][0] / B.W * 100, 3), round(B.BOX[k][1] / B.H * 100, 3), round(B.BOX[k][2] / B.W * 100, 3), round(B.BOX[k][3] / B.H * 100, 3)]}
    if k == 'ch': d['ducks'] = B.ducks(fr[0])
    seam = None
    if k in B.LOOP:
        dd, i, j = B.seam(fr, [np.zeros(fr.shape[1:3], np.uint8)] * len(fr))
        print(f'  {k}: loop {i} -> {j} (difference {dd:.1f})', flush=True)
        fr, _ = B.looped(fr, [np.zeros(fr.shape[1:3], np.uint8)] * len(fr), i, j)
        d['at'] = round((j + 1) / 24, 4); d['loop'] = round((j - i) / 24, 4)
        seam = (i, j)
        s = her_loop(i, j, len(fr), aud)
    else:
        s = SEG.get(k, 0)
    P = Placer(k)
    out, alphas = [], []
    for n in range(len(fr)):
        m = n if seam is None or n <= seam[1] else n - (seam[1] - seam[0])  # after the seam: her frames of the loop again
        bg = up2(fr[n])
        ref = bg[max(0, P.y):, max(0, P.x):P.x + P.w]
        o, a = P.put(bg, her(src_frame(m, s)), ref)
        out.append(o); alphas.append(cv2.resize((a * 255).astype(np.uint8), (B.W, B.H), interpolation=cv2.INTER_AREA))
    out = np.stack(out)
    idx, rows = B.sheet(k, alphas, len(out))
    d.update({'rows': rows, 'cols': B.COLS, 'f': idx})
    print(f'  {k}: in front of our elements on {sum(1 for x in idx if x >= 0)} / {len(idx)} frames', flush=True)
    write(k, out, audio_for(aud, s, len(out), seam))
    return d


def matte():
    """her matte, every frame of attente.mp4 (crop X0, Y0, CW × CH) → FEMME/NNN.png (RGBA); about 3 s a frame on a computer"""
    from rembg import remove, new_session
    os.makedirs(FEMME, exist_ok=True)
    raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', ATT, '-vf', f'crop={CW}:{CH}:{X0}:{Y0}', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'])
    fr = np.frombuffer(raw, np.uint8).reshape(-1, CH, CW, 3); s = new_session('isnet-general-use')
    for n, f in enumerate(fr):
        p = os.path.join(FEMME, f'{n:03d}.png')
        if os.path.exists(p): continue
        im = Image.fromarray(f); Image.merge('RGBA', [*im.split(), remove(im, session=s, only_mask=True)]).save(p)


def main():
    if '--matte' in sys.argv: matte(); return
    ks = [a for a in sys.argv[1:] if not a.startswith('-')] or ['pa', 'ch', 'ct']
    aud = att_audio()
    js = os.path.join(ROOT, 'games', 'madwheel.js'); s = open(js, encoding='utf8').read()
    m = re.search(r'/\* BTRACK \*/ const BTRACK = (.*?); /\* /BTRACK \*/', s, flags=re.S)
    data = json.loads(m.group(1)) if m else {}
    for k in ks: data[k] = make(k, aud)
    blob = '/* BTRACK */ const BTRACK = ' + json.dumps(data, separators=(',', ':')) + '; /* /BTRACK */'
    s = re.sub(r'/\* BTRACK \*/.*?/\* /BTRACK \*/', lambda _: blob, s, flags=re.S)
    open(js, 'w', encoding='utf8').write(s)
    print('ok')


if __name__ == '__main__':
    main()
