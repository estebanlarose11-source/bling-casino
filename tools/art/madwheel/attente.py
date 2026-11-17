#!/usr/bin/env python3
# La Roue Folle, l'attente (demande du propriétaire du 17 novembre 2026, comme Le Plateau Live) : dès qu'on arrive, l'émission tourne
# en boucle (son coupé tant que le joueur ne l'allume pas) et LANCER enchaîne tout de suite sur le lancer de l'animateur.
# Il n'y a pas de vidéo d'attente : la boucle est faite avec la fin de ses vidéos show-*.mp4, où l'animateur montre la roue arrêtée
# (images A à B, peu de mouvement). Aller-retour (B, B−1 … A, A+1 … B−1), répété, pour une boucle sans coupure qui commence sur
# l'image B : à la fin d'un lancer, l'émission passe à l'attente sur cette image-là, sans saut. Puis les TAIL premières images
# encore une fois (le jeu recule d'une boucle pendant qu'elles passent, comme core/videobg.js).
# Le son : l'ambiance du plateau (public) de la fin de show-large.mp4 (8,25 s → 10 s), en boucle avec un fondu, de la même durée.
# Sorties : assets/games/madwheel/attente-large.mp4 / attente-haut.mp4 (×2 comme show-*.mp4) + attente-*.webp (1re image),
#   IDLE écrit dans games/madwheel.js entre /* IDLE */ et /* /IDLE */ : pour chaque image de la boucle, l'image de show-*.mp4
#   qu'elle montre (TRACK et la planche des masques de l'émission servent tels quels).
#   python3 tools/art/madwheel/attente.py ; ffmpeg, numpy, pillow.
import json, os, re, subprocess
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
OUT = os.path.join(ROOT, 'assets', 'games', 'madwheel')
FPS, TAIL, SR = 24, 12, 48000
# segment [A, B] of each video and number of back-and-forths (large: the host holds his pose, still wheel; haut: he points at the
# wheel before walking away, the camera moves a little)
SEG = {'large': (222, 240, 4), 'haut': (214, 230, 5)}
AMB = (8.25, 10.0)  # the crowd of the set, at the end of show-large.mp4 (no voice)
FADE_S = 0.25


def read(path):
    w, h = map(int, subprocess.check_output(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', path]).decode().split(',')[:2])
    raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', path, '-map', '0:v:0', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'])
    return np.frombuffer(raw, np.uint8).reshape(-1, h, w, 3)


def ambience(n_frames, k):
    """n_frames of sound made of k times the same loop cut in the crowd of the set (its end fades into its start)"""
    pcm = np.frombuffer(subprocess.check_output(['ffmpeg', '-v', 'error', '-i', os.path.join(HERE, 'show-large.mp4'), '-vn', '-ac', '2', '-ar', str(SR), '-f', 's16le', '-']), np.int16).reshape(-1, 2).astype(np.float32)
    L = round(n_frames / FPS * SR); U = L // k; f = round(FADE_S * SR)
    s0 = round(AMB[0] * SR); seg = pcm[s0:s0 + U + f]
    assert len(seg) == U + f, 'not enough sound'
    a = (np.arange(f) + 0.5)[:, None] / f
    unit = np.concatenate([seg[U:U + f] * np.sqrt(1 - a) + seg[:f] * np.sqrt(a), seg[f:U]])
    out = np.tile(unit, (k, 1))
    out = np.concatenate([out, np.zeros((L - len(out), 2), np.float32)]) if len(out) < L else out[:L]
    return out


def make(name):
    A, B, reps = SEG[name]
    fr = read(os.path.join(HERE, f'show-{name}.mp4'))
    cyc = list(range(B, A, -1)) + list(range(A, B))  # B, B-1 … A+1, A, A+1 … B-1
    body = cyc * reps
    h, w = fr.shape[1:3]
    frames = np.stack([fr[i] for i in body + body[:TAIL]])
    au = ambience(len(body), reps)
    au = np.concatenate([au, au[:round(TAIL / FPS * SR)]]).clip(-32768, 32767).astype(np.int16)
    raw = os.path.join('/tmp', f'mw-attente-{name}.raw'); au.tofile(raw)
    vid = os.path.join(OUT, f'attente-{name}.mp4')
    p = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{w}x{h}', '-r', str(FPS), '-i', '-',
                          '-f', 's16le', '-ar', str(SR), '-ac', '2', '-i', raw, '-vf', 'scale=iw*2:ih*2:flags=lanczos', '-c:v', 'libx264', '-preset', 'slow',
                          '-crf', '26', '-g', str(FPS), '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '64k', '-shortest', '-movflags', '+faststart', vid], stdin=subprocess.PIPE)
    p.communicate(frames.tobytes())
    os.remove(raw)
    Image.fromarray(fr[B]).resize((w * 2, h * 2), Image.LANCZOS).save(os.path.join(OUT, f'attente-{name}.webp'), quality=82)
    print(f'attente-{name}: {len(body)} frames = {len(body) / FPS:.3f} s (+{TAIL})')
    return {'fps': FPS, 'loop': round(len(body) / FPS, 4), 'from': B, 'f': body}


def main():
    data = {n: make(n) for n in SEG}
    js = os.path.join(ROOT, 'games', 'madwheel.js')
    s = open(js, encoding='utf8').read()
    blob = '/* IDLE */ const IDLE = ' + json.dumps(data, separators=(',', ':')) + '; /* /IDLE */'
    if '/* IDLE */' in s: s = re.sub(r'/\* IDLE \*/.*?/\* /IDLE \*/', lambda m: blob, s, flags=re.S)
    else: s = s.replace('/* BTRACK */', blob + '\n/* BTRACK */', 1)
    open(js, 'w', encoding='utf8').write(s)
    print('ok')


if __name__ == '__main__':
    main()
