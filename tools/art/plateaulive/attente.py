#!/usr/bin/env python3
# Le Plateau Live, l'attente (demande du propriétaire du 17 novembre 2026) : sa vidéo attente.mp4 (1920 × 1080, 25 images/s,
# AVEC SA VOIX) : la présentatrice parle à côté de la grande roue, caméra fixe (son montage continuait par roue.mp4, coupé ici à
# l'image 538, juste avant). Le jeu la joue EN BOUCLE dès qu'on arrive (son coupé tant que le joueur ne l'allume pas), puis passe à
# roue.mp4 au toucher de LANCER (fondu : même cadre, même roue).
#   - boucle sans coupure : images A à B (deux silences de sa voix : 1,64 s et 21,28 s, les deux images les plus proches), la fin
#     se fond dans le début (FADE images, le son aussi), puis les TAIL premières images sont répétées : le jeu recule d'une boucle
#     (LOOP) pendant qu'elles passent (comme core/videobg.js) ;
#   - la roue ne bouge pas : une seule homographie (disque unité → image), mesurée comme roue.py (bord des ampoules + moyeu) ;
#   - la présentatrice touche le bord gauche de la roue : son masque (rembg) dans le repère du disque, une case de la planche par
#     image (les cases presque pareilles ne sont gardées qu'une fois), pour qu'elle reste devant notre roue.
# Sorties : assets/games/plateaulive/attente.mp4 (1280 × 694, bandes noires enlevées, avec le son) + attente.webp (1re image),
#   assets/games/plateaulive/attente-mask.png (planche des masques), et IDLE écrit dans games/plateaulive.js entre /* IDLE */ et
#   /* /IDLE */. pip install opencv-python-headless numpy pillow "rembg[cpu]" ; ffmpeg.
#   python3 tools/art/plateaulive/attente.py [--fast]   (--fast : sans réencoder la vidéo)
import json, os, re, subprocess, sys
import numpy as np, cv2
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import roue  # noqa: E402  (same frame, same wheel: its tracking and its constants)

ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
OUT = roue.OUT
WORK = os.environ.get('PL_WORK', '/tmp/pl-work')
SRC = os.path.join(HERE, 'attente.mp4')
FPS, A, B, FADE, TAIL = 25, 41, 532, 25, 12
W, H, TOP, BOT = roue.W, roue.H, roue.TOP, roue.BOT
OW, OH = 1280, 694
CELL, COLS = roue.CELL, roue.COLS


def frames():
    d = os.path.join(WORK, 'attente')
    if not os.path.isdir(d) or len(os.listdir(d)) < 500:
        os.makedirs(d, exist_ok=True)
        subprocess.check_call(['ffmpeg', '-v', 'error', '-y', '-i', SRC, '-vf', f'crop=1920:{BOT - TOP}:0:{TOP},scale={W}:{H}', os.path.join(d, '%03d.png')])
    return sorted(os.path.join(d, f) for f in os.listdir(d) if f.endswith('.png'))


def masks(paths):
    d = os.path.join(WORK, 'attente-mask')
    os.makedirs(d, exist_ok=True)
    todo = [p for p in paths if not os.path.exists(os.path.join(d, os.path.basename(p)))]
    if todo:
        from rembg import remove, new_session
        s = new_session('u2net_human_seg')
        for p in todo: remove(Image.open(p).convert('RGB'), session=s, only_mask=True).save(os.path.join(d, os.path.basename(p)))
    return [np.array(Image.open(os.path.join(d, os.path.basename(p))).convert('L')) for p in paths]


def body_of(n):
    """the loop: for each of its frames, (frame of the segment, weight) pairs; the first FADE frames blend the end into the start"""
    out = []
    for j in range(n - FADE):
        if j < FADE:
            a = (j + 1) / (FADE + 1)
            out.append([(n - FADE + j, 1 - a), (j, a)])
        else: out.append([(j, 1.0)])
    return out


def cells(host, D, body):
    """the host's mask in the disc's frame (CELL × CELL for the square [-1.08, 1.08]²) for each frame of the loop (union of
    the 2 frames on a blended one); a cell almost like the last one kept is used again"""
    S = CELL * 2; sc = 1.08
    Mpix = np.array([[2 * sc / S, 0, -sc], [0, 2 * sc / S, -sc], [0, 0, 1]])
    warp = {}
    def cell(k):
        if k not in warp:
            m = cv2.dilate(host[k], np.ones((3, 3), np.uint8))
            c = cv2.warpPerspective(m, D @ Mpix, (S, S), flags=cv2.INTER_LINEAR | cv2.WARP_INVERSE_MAP, borderValue=0)
            warp[k] = cv2.resize(c, (CELL, CELL), interpolation=cv2.INTER_AREA)
        return warp[k]
    kept, idx = [], []
    for parts in body:
        c = np.max([cell(A + k) for k, _ in parts], axis=0)
        if (c > 80).mean() < 0.002: idx.append(-1); continue
        if kept and np.abs(c.astype(np.int16) - kept[-1].astype(np.int16)).max() < 40 and (np.abs(c.astype(np.int16) - kept[-1].astype(np.int16)) > 16).mean() < 0.0015:
            idx.append(len(kept) - 1); continue
        idx.append(len(kept)); kept.append(c)
    rows = max(1, (len(kept) + COLS - 1) // COLS)
    Sh = np.zeros((rows * CELL, COLS * CELL), np.uint8)
    for i, c in enumerate(kept): Sh[(i // COLS) * CELL:(i // COLS + 1) * CELL, (i % COLS) * CELL:(i % COLS + 1) * CELL] = 255 - c
    a = Image.fromarray(Sh).filter(ImageFilter.GaussianBlur(0.7))
    Image.merge('RGBA', [Image.new('L', a.size, 255)] * 3 + [a]).save(os.path.join(OUT, 'attente-mask.png'), optimize=True)
    return idx, rows


def video(body):
    """the loop at 1280 × 694 (blended start) + its first TAIL frames again, with its sound looped the same way"""
    n = B - A + 1
    raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', SRC, '-vf', f'select=between(n\\,{A}\\,{B}),crop=1920:{BOT - TOP}:0:{TOP},scale={OW}:{OH}:flags=lanczos',
                                   '-vsync', '0', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'])
    fr = np.frombuffer(raw, np.uint8).reshape(-1, OH, OW, 3)
    assert len(fr) == n, len(fr)
    out = np.stack([sum(fr[k].astype(np.float32) * w for k, w in parts).round().astype(np.uint8) for parts in body])
    out = np.concatenate([out, out[:TAIL]])
    # the sound: same cut, the end fading into the start
    SR = 48000
    pcm = np.frombuffer(subprocess.check_output(['ffmpeg', '-v', 'error', '-i', SRC, '-vn', '-ac', '2', '-ar', str(SR), '-f', 's16le', '-']), np.int16).reshape(-1, 2).astype(np.float32)
    s0, s1, sf = round(A / FPS * SR), round((B + 1) / FPS * SR), round(FADE / FPS * SR)
    seg = pcm[s0:s1]; m = len(seg)
    a = (np.arange(sf) + 0.5)[:, None] / sf
    head = seg[m - sf:] * np.sqrt(1 - a) + seg[:sf] * np.sqrt(a)
    au = np.concatenate([head, seg[sf:m - sf]])
    au = np.concatenate([au, au[:round(TAIL / FPS * SR)]]).clip(-32768, 32767).astype(np.int16)
    wav = os.path.join(WORK, 'attente.raw'); au.tofile(wav)
    p = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{OW}x{OH}', '-r', str(FPS), '-i', '-',
                          '-f', 's16le', '-ar', str(SR), '-ac', '2', '-i', wav, '-c:v', 'libx264', '-preset', 'slow', '-crf', '30', '-g', str(FPS),
                          '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '80k', '-shortest', '-movflags', '+faststart', os.path.join(OUT, 'attente.mp4')], stdin=subprocess.PIPE)
    p.communicate(out.tobytes())
    Image.fromarray(out[0]).save(os.path.join(OUT, 'attente.webp'), quality=80, method=6)


def main():
    os.makedirs(OUT, exist_ok=True); os.makedirs(WORK, exist_ok=True)
    paths = frames(); host = masks(paths)
    Ds, q = roue.track(paths, host)
    print('weak fits', sum(1 for x in q if x < 16), flush=True)
    # the camera does not move: the median of the frames
    D = np.median(np.array([d / d[2, 2] for d in Ds]), axis=0)
    body = body_of(B - A + 1)
    idx, rows = cells(host, D, body)
    N = np.diag([100 / W, 100 / H, 1]); M = N @ D; M = M / M[2, 2]
    data = {'fps': FPS, 'n': len(body), 'loop': round(len(body) / FPS, 4), 'h': [round(float(x), 5) for x in M.reshape(-1)[:8]],
            'rows': rows, 'cols': COLS, 'm': idx}
    print(f'loop {len(body)} frames = {len(body) / FPS:.2f} s, {max(idx) + 1} mask cells ({rows} rows)', flush=True)
    if '--fast' not in sys.argv: video(body)
    js = os.path.join(ROOT, 'games', 'plateaulive.js')
    s = open(js, encoding='utf8').read()
    blob = '/* IDLE */ const IDLE = ' + json.dumps(data, separators=(',', ':')) + '; /* /IDLE */'
    if '/* IDLE */' in s: s = re.sub(r'/\* IDLE \*/.*?/\* /IDLE \*/', lambda m: blob, s, flags=re.S)
    else: s = s.replace('/* BOARD */', blob + '\n/* BOARD */', 1)
    open(js, 'w', encoding='utf8').write(s)
    print('ok')


if __name__ == '__main__':
    main()
