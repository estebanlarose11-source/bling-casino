#!/usr/bin/env python3
# La Roue Folle, bonus Pile ou Face (demande du propriétaire du 16 novembre 2026) : sa vidéo bonus-pileface.mp4 (1080 × 1920, 12 s,
# avec le son) : l'animateur lance un palet rouge (bord bleu) qui tourne et retombe face ROUGE dans un bocal.
# Le jeu tire rouge ou bleu : il faut aussi la version BLEUE. Ici le rouge du palet est passé en bleu image par image (l'animateur,
# détouré par rembg, n'est pas touché : ses lèvres, sa peau).
# Sorties : assets/games/madwheel/b-pf-r.mp4 (rouge) et b-pf-b.mp4 (bleu), 720 × 1280, avec le son, + b-pf-r.webp / b-pf-b.webp.
# pip install opencv-python-headless numpy pillow "rembg[cpu]" ; ffmpeg. python3 tools/art/madwheel/pileface.py
import os, subprocess, sys
import numpy as np, cv2
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'tools', 'art'))
import videobg as vb  # noqa: E402

OUT = os.path.join(ROOT, 'assets', 'games', 'madwheel')
WORK = os.environ.get('MW_WORK', '/tmp/mw-bonus')
SRC = os.path.join(HERE, 'bonus-pileface.mp4')
W, H = 720, 1280


def hosts(fr):
    d = os.path.join(WORK, 'pf-host'); os.makedirs(d, exist_ok=True)
    out, s = [], None
    for n, f in enumerate(fr):
        p = os.path.join(d, f'{n:03d}.png')
        if not os.path.exists(p):
            from rembg import remove, new_session
            s = s or new_session('u2net_human_seg')
            small = Image.fromarray(f).resize((W // 2, H // 2), Image.LANCZOS)
            remove(small, session=s, only_mask=True).save(p)
        out.append(cv2.resize(np.array(Image.open(p).convert('L')), (W, H), interpolation=cv2.INTER_LINEAR))
    return out


def blue(f, h):
    """the red of the disc turned blue (the blue of its rim), not on the host"""
    hsv = cv2.cvtColor(f, cv2.COLOR_RGB2HSV).astype(np.int16)
    hu, sa, va = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    red = ((hu <= 10) | (hu >= 168)) & (sa > 70) & (va > 70)
    # the very saturated red is the disc everywhere (also in his hand, and when the camera is close to the bocal, where rembg
    # gets it wrong); the paler red only away from the host (his skin, his lips)
    strong = red & (sa >= 160)
    k = cv2.GaussianBlur((red & ~strong).astype(np.float32), (0, 0), 1.2)
    k *= 1 - np.clip(cv2.GaussianBlur(h.astype(np.float32) / 255, (0, 0), 3) * 1.6, 0, 1)
    k = np.maximum(k, cv2.GaussianBlur(strong.astype(np.float32), (0, 0), 1.2))
    g = hsv.copy()
    g[..., 0] = 112  # the blue of the rim
    g[..., 1] = np.clip(sa * 1.05, 0, 255)
    g[..., 2] = np.clip(va * 0.9, 0, 255)
    nb = cv2.cvtColor(g.astype(np.uint8), cv2.COLOR_HSV2RGB).astype(np.float32)
    return (f * (1 - k[..., None]) + nb * k[..., None]).round().astype(np.uint8)


def write(frames, name):
    n, h, w, _ = frames.shape
    p = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{w}x{h}', '-r', '24', '-i', '-', '-i', SRC,
                          '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'slow', '-crf', '26', '-g', '24', '-pix_fmt', 'yuv420p',
                          '-c:a', 'aac', '-b:a', '112k', '-shortest', '-movflags', '+faststart', os.path.join(OUT, f'b-{name}.mp4')], stdin=subprocess.PIPE)
    p.communicate(frames.tobytes())
    Image.fromarray(frames[0]).save(os.path.join(OUT, f'b-{name}.webp'), quality=80, method=6)
    print(f'  b-{name}.mp4: {n} frames', flush=True)


def main():
    os.makedirs(WORK, exist_ok=True)
    fr = np.stack([cv2.resize(f, (W, H), interpolation=cv2.INTER_AREA) for f in vb.read(SRC)])
    write(fr, 'pf-r')
    host = hosts(fr)
    write(np.stack([blue(f, h) for f, h in zip(fr, host)]), 'pf-b')
    print('ok')


if __name__ == '__main__':
    main()
