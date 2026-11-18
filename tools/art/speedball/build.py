#!/usr/bin/env python3
# Le Speedball (demande du propriétaire du 18 novembre 2026, à la place du Super Keno) : sa vidéo speedball.mp4 (832 × 480,
# 24 images/s, 15,1 s) : une présentatrice à côté d'une sphère pleine de boules blanches et dorées, un tube en spirale, un
# tableau en arc en haut ; plan large (images 0 → 188, caméra fixe), coupe à 7,875 s, gros plan sur le tube (189 → fin).
# Le jeu couvre le tableau, le compteur et la plaque « multiplicateur » par les siens (positions en % dans le CSS) : rien à effacer.
# Sorties (× 1,5, assets/games/speedball/) :
#   attente.mp4 : le plan large en boucle sans coupure (muette ; LOOP de games/speedball.js = (189 - 24) / 24 s) + attente.webp
#   tirage.mp4  : de START (3 s) à la fin, avec le son (le tirage : boules du plan large, puis le gros plan) + tirage.webp
#   cover.webp  : la présentatrice et la sphère
# python3 tools/art/speedball/build.py
import os, sys, subprocess
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..'))
import videobg as V

ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
OUT = os.path.join(ROOT, 'assets', 'games', 'speedball')
SRC = os.path.join(HERE, 'speedball.mp4')
CUT, START = 189, 3.0
V.UP = 1.5


def main():
    os.makedirs(OUT, exist_ok=True)
    fr = V.read(SRC)
    body, full = V.loop(fr[:CUT])
    poster = os.path.join(OUT, 'attente.webp')
    try: V.write(full, os.path.join(OUT, 'attente.mp4'), poster, crf=26)
    except TypeError: pass  # its poster wants a whole scale: made here
    Image.fromarray(full[0]).resize((1248, 720), Image.LANCZOS).save(poster, quality=82, method=6)
    print(f'attente: LOOP = {len(body)}/24 = {len(body) / 24:.4f} s')
    t = os.path.join(OUT, 'tirage.mp4')
    subprocess.check_call(['ffmpeg', '-v', 'error', '-y', '-ss', str(START), '-i', SRC, '-vf', 'scale=1248:720:flags=lanczos,unsharp=5:5:0.45:5:5:0',
                           '-c:v', 'libx264', '-preset', 'veryslow', '-crf', '26', '-pix_fmt', 'yuv420p', '-g', '24', '-c:a', 'aac', '-b:a', '112k',
                           '-movflags', '+faststart', t])
    Image.fromarray(fr[round(START * 24)]).resize((1248, 720), Image.LANCZOS).save(os.path.join(OUT, 'tirage.webp'), quality=82, method=6)
    im = Image.fromarray(fr[150])  # the host and the sphere
    im.crop((0, 0, 720, 480)).resize((900, 600), Image.LANCZOS).save(os.path.join(OUT, 'cover.webp'), quality=82, method=6)
    print('ok')


if __name__ == '__main__':
    main()
