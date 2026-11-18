# La Pêche · the owner's videos (15 November 2026) -> the files the game uses (assets/games/peche/).
# Needs ffmpeg. Run from the repository root:
#   python3 tools/art/peche/clean.py
#
# The wheel is now the presenter's video (tools/art/peche/presentatrice.py, 18 November 2026); the old glass wheel (roue.mp4 →
# roue.webp, roue-disc.webp, roue-top.webp) is no longer used.
# The 9 fishing videos (bleu / orange / rouge × canne = small fish, grue = medium, helico = big): H.264 at their own size
#    (448 × 672 is enough for the bonus box, and light to load on a phone), sharpened, silent,
#    + their first frame as poster -> <fb|fo|fr>-<1|2|3>.mp4 / .webp
import os, subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', '..', 'assets', 'games', 'peche')

# ---- the fishing videos ----
FISH = {'fb': 'bleu', 'fo': 'orange', 'fr': 'rouge'}
SIZE = {1: 'canne', 2: 'grue', 3: 'helico'}


def fishing():
    for k, col in FISH.items():
        for n, how in SIZE.items():
            src = os.path.join(HERE, f'{col}-{how}.mp4')
            dst = os.path.join(OUT, f'{k}-{n}.mp4')
            subprocess.check_call(['ffmpeg', '-v', 'error', '-y', '-i', src, '-vf', 'unsharp=5:5:0.4:5:5:0',
                                   '-c:v', 'libx264', '-preset', 'slow', '-crf', '30', '-g', '48', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
                                   '-movflags', '+faststart', '-an', dst])
            subprocess.check_call(['ffmpeg', '-v', 'error', '-y', '-i', dst, '-frames:v', '1', '-c:v', 'libwebp', '-quality', '78',
                                   os.path.join(OUT, f'{k}-{n}.webp')])
            print(dst, os.path.getsize(dst) // 1000, 'ko')


if __name__ == '__main__':
    fishing()
