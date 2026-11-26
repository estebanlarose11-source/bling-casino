# L'Olympe in 3D: the 5 gem symbols rendered by Blender (gems.py) for the game.
#  - <key>.webp: the gem at rest (front, 320 × 320), the symbol of the grid;
#  - <key>-win.webp: its win animation, FRAMES images side by side (SIZE × SIZE each): a full spin on itself (eased, with
#    motion blur) that catches every light of the studio, star glints added on the brightest facets (post()).
# -> assets/games/zeus/3d/ (played by games/zeus.js in 3D mode).
# python3 tools/blender/olympe/sprites.py [s0 s1 …]   (≈ 3 min per gem on 4 processor cores)
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
import bpy
import gems
from PIL import Image
from post import glints

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../assets/games/zeus/3d')
TMP = os.environ.get('BL_TMP', '/tmp/olympe3d')
FRAMES, SIZE, STILL = 24, 224, 320
TILT = math.radians(62)   # the table faces the camera, a little from above


def scene(key):
    gems.reset()
    piv = bpy.data.objects.new('pivot', None); bpy.context.scene.collection.objects.link(piv)
    for o in (gems.stone(key), gems.setting(key)):
        o.rotation_euler = (TILT, 0, 0)
        o.parent = piv
    gems.studio(); gems.strips(1.0)
    gems.camera((0, -6.2, 0.9), (0, 0, 0), lens=88)
    return piv


def ease(t):  # slow start, fast middle, soft landing
    return t * t * (3 - 2 * t) if t < 1 else 1.0


def render(key):
    os.makedirs(TMP, exist_ok=True); os.makedirs(OUT, exist_ok=True)
    # 1. the gem at rest, sharp
    piv = scene(key); sc = bpy.context.scene
    gems.cycles(256, STILL, STILL, transparent=True)
    sc.render.filepath = f'{TMP}/{key}-still.png'
    bpy.ops.render.render(write_still=True)
    # 2. the spin: 20 frames of turn (eased), then 4 frames at rest (the glints twinkle)
    piv = scene(key); sc = bpy.context.scene
    gems.cycles(128, SIZE, SIZE, transparent=True)
    sc.render.use_motion_blur = True; sc.render.motion_blur_shutter = 0.6
    sc.frame_start, sc.frame_end = 0, FRAMES - 1
    for f in range(FRAMES + 1):
        t = min(1.0, f / 20)
        piv.rotation_euler = (0, 0, 2 * math.pi * ease(t))
        piv.keyframe_insert('rotation_euler', frame=f)
    for f in range(FRAMES):
        sc.frame_set(f)
        sc.render.filepath = f'{TMP}/{key}-{f:02d}.png'
        bpy.ops.render.render(write_still=True)


def crop_box(path):
    """the square around the gem at rest (3 % margin), as fractions of the image: the same for the still and every frame
    of the spin (no jump in size when the grid switches from one to the other)"""
    a = np.asarray(Image.open(path).convert('RGBA'))[..., 3]
    ys, xs = np.nonzero(a > 6)
    cx, cy = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
    half = max(xs.max() - xs.min(), ys.max() - ys.min()) / 2 * 1.03
    n = a.shape[0]
    return [(cx - half) / n, (cy - half) / n, (cx + half) / n, (cy + half) / n]


def load(path, box, size):
    im = Image.open(path).convert('RGBA'); n = im.size[0]
    im = im.crop(tuple(round(v * n) for v in box)).resize((size, size), Image.LANCZOS)
    return np.asarray(im).astype(np.float32) / 255


def pack(key):
    box = crop_box(f'{TMP}/{key}-still.png')
    still = load(f'{TMP}/{key}-still.png', box, STILL)
    Image.fromarray((glints(still, 3, 1.1, seed=1) * 255).round().astype(np.uint8)).save(f'{OUT}/{key}.webp', quality=88, method=6)
    sheet = Image.new('RGBA', (SIZE * FRAMES, SIZE))
    for f in range(FRAMES):
        a = load(f'{TMP}/{key}-{f:02d}.png', box, SIZE)
        a = glints(a, 4, 1.2 + 0.6 * math.sin(math.pi * min(1, f / 20)), seed=f)
        sheet.paste(Image.fromarray((a * 255).round().astype(np.uint8)), (f * SIZE, 0))
    sheet.save(f'{OUT}/{key}-win.webp', quality=82, method=6)
    print(key, 'sheet', os.path.getsize(f'{OUT}/{key}-win.webp') // 1024, 'KB')


if __name__ == '__main__':
    keys = [k for k in sys.argv[1:] if k in gems.GEMS] or list(gems.GEMS)
    for k in keys:
        if '--pack' not in sys.argv: render(k)
        pack(k)
