#!/usr/bin/env python3
# Le Super Keno (demande du propriétaire du 16 novembre 2026) : ses 2 vidéos d'un animateur devant un tube transparent où tombent
# 20 boules une par une, une colonne lumineuse derrière lui (keno-large.mp4 736 × 400 : ordinateur ; keno-haut.mp4 1080 × 1920 :
# téléphone, le même plateau cadré de plus près). Les 2 vidéos ont le même rythme : une boule entre dans la boîte du tube aux
# instants BALLS de games/keno.js (mesurés ici sur l'activité de la boîte), la 20e (la dernière, celle du multiplicateur) à 18,8 s.
# Sorties : assets/games/keno/show-large.mp4 (×2) et show-haut.mp4 (lignes CROP de la vidéo haute, 720 px de large), avec le son,
# + show-*.webp (1re image) + cover.webp. python3 tools/art/keno/build.py
import os, subprocess
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
OUT = os.path.join(ROOT, 'assets', 'games', 'keno')
CROP = (300, 1720)  # rows of the tall video shown on a phone (the host and the tube)


def run(*a): subprocess.check_call(['ffmpeg', '-v', 'error', '-y', *a])


def main():
    os.makedirs(OUT, exist_ok=True)
    big, tall = os.path.join(HERE, 'keno-large.mp4'), os.path.join(HERE, 'keno-haut.mp4')
    enc = ['-c:v', 'libx264', '-preset', 'slow', '-crf', '26', '-g', '25', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '112k', '-movflags', '+faststart']
    run('-i', big, '-vf', 'scale=1472:800:flags=lanczos', *enc, os.path.join(OUT, 'show-large.mp4'))
    h = CROP[1] - CROP[0]
    vf = f'crop=1080:{h}:0:{CROP[0]},scale=720:{round(h * 720 / 1080 / 2) * 2}:flags=lanczos'
    run('-i', tall, '-vf', vf, *enc, os.path.join(OUT, 'show-haut.mp4'))
    for name, src, f in (('large', big, 'scale=1472:800:flags=lanczos'), ('haut', tall, vf)):
        p = os.path.join(OUT, f'show-{name}.png'); run('-i', src, '-frames:v', '1', '-vf', f, p)
        Image.open(p).save(os.path.join(OUT, f'show-{name}.webp'), quality=80, method=6); os.remove(p)
    p = os.path.join(OUT, 'c.png'); run('-ss', '12', '-i', big, '-frames:v', '1', p)
    im = Image.open(p).convert('RGB'); w, hh = im.size  # the host and the balls, square-ish
    im.crop((int(w * 0.02), 0, int(w * 0.02) + hh * 3 // 2, hh)).resize((900, 600), Image.LANCZOS).save(os.path.join(OUT, 'cover.webp'), quality=82, method=6)
    os.remove(p)
    print('ok', h)


if __name__ == '__main__':
    main()
