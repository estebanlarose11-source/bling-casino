# Le 21 / Le 21 Électrique: the owner's video of 16 November 2026 (donne.mp4, 448 × 672, 10 s): a croupière seen from
# the player's seat deals 4 blank cards (her first card at 1,7 s, the player's two at 4,9 s and 6,6 s, her hidden card
# at 8,8 s). The game replays pieces of it (clips in games/bjtable.js, CLIPS, in frames at 24 / s) for every card it
# deals: so the cards resting on the felt are erased from the moment they land (white pixels only: her fingers stay),
# and the game draws its own cards there. -> assets/games/blackjack/donne.mp4 (×1,5, silent, a key frame every 6 frames
# so that each clip starts at once) + donne.webp (first frame: poster and blurred background).
# python3 tools/art/blackjack/clean.py   (pip install opencv-python-headless numpy pillow; needs ffmpeg)
import os, subprocess
import numpy as np, cv2
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, '../../../assets/games/blackjack')
W, H, UP = 448, 672, 1.5
# landed cards: rect (x, y, w, h), erased from frame `f`; `skip` = frames where another card comes over it (the game's
# own card covers it there)
CARDS = [
    {'r': (274, 416, 75, 39), 'f': 44, 'skip': [(146, 162), (196, 212)]},  # her first card
    {'r': (141, 487, 76, 60), 'f': 120},                                     # player, left
    {'r': (229, 483, 77, 61), 'f': 160},                                     # player, right
    {'r': (275, 409, 76, 46), 'f': 212},                                     # her hidden card
]


def read(path):
    raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', path, '-map', '0:v:0', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'])
    return np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3).copy()


def clean(f, i):
    a = f.astype(np.int16)
    white = (a.min(2) > 140) & ((a.max(2) - a.min(2)) < 50)
    zone = np.zeros((H, W), bool)
    for c in CARDS:
        if i < c['f'] or any(s <= i < e for s, e in c.get('skip', [])): continue
        x, y, w, h = c['r']; zone[max(0, y - 5):y + h + 5, max(0, x - 5):x + w + 5] = True
    m = (white & zone).astype(np.uint8)
    if not m.any(): return f
    m = cv2.dilate(m, np.ones((5, 5), np.uint8), iterations=1)
    g = cv2.inpaint(np.ascontiguousarray(f), m, 5, cv2.INPAINT_TELEA)
    b = cv2.GaussianBlur(g, (0, 0), 1.6)
    k = cv2.GaussianBlur(m.astype(np.float32), (0, 0), 1.5)[..., None]
    return (g * (1 - k) + b * k).clip(0, 255).astype(np.uint8)


fr = read(os.path.join(HERE, 'donne.mp4'))
fr = np.stack([clean(f, i) for i, f in enumerate(fr)])
w, h = int(W * UP), int(H * UP)
p = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', '24', '-i', '-',
                      '-vf', f'scale={w}:{h}:flags=lanczos,unsharp=5:5:0.4:5:5:0', '-c:v', 'libx264', '-preset', 'veryslow', '-crf', '25',
                      '-pix_fmt', 'yuv420p', '-g', '6', '-keyint_min', '6', '-sc_threshold', '0', '-profile:v', 'high', '-movflags', '+faststart', '-an',
                      os.path.join(OUT, 'donne.mp4')], stdin=subprocess.PIPE)
p.communicate(fr.tobytes())
Image.fromarray(fr[0]).resize((w, h), Image.LANCZOS).save(os.path.join(OUT, 'donne.webp'), quality=80, method=6)
np.save('/tmp/bj_clean.npy', fr) if os.environ.get('BJ_DEBUG') else None
print('ok', len(fr), 'frames')
