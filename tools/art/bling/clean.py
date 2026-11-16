# La Tour Bling: the owner's 2 animated decors of 16 November 2026 (fond-large.mp4 736 × 400 for computers, fond-haut.mp4
# 400 × 736 for phones held upright: BLING TOWER title, the city at night, falling coins, a gold frame with a 6 × 7 grid,
# MENU / BONUS / MISE / SPIN) -> assets/games/bling/fond-large.mp4 / fond-haut.mp4 (×2, seamless loop) + scene-*.webp.
# Erased on every frame: the painted bet « 10,00 » (the game writes it in KE). The painted 6 × 7 grid stays (same as the game).
#   python3 tools/art/bling/clean.py   (pip install opencv-python-headless numpy pillow; needs ffmpeg)
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from videobg import make, mend, box, grow, lum

HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, '../../../assets/games/bling')


def cleaner(b):
    def run(mean):
        m = grow(box(mean.shape, *b) & (lum(mean) > 110), 2)
        return lambda f: mend(f, m, 4, 1.6)
    return run


make(os.path.join(HERE, 'fond-haut.mp4'), OUT, 'haut', cleaner((226, 640, 272, 668)))
make(os.path.join(HERE, 'fond-large.mp4'), OUT, 'large', cleaner((380, 344, 442, 380)))
