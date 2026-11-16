# Shared tools for the owner's animated slot backgrounds (one video for computers, one for phones held upright):
# read a video, erase painted parts on every frame (inpaint, smooth panel), make a seamless loop and write the files the
# game plays (×2, silent, H.264) + the first frame as poster. Used by tools/art/<game>/clean.py
# (pip install opencv-python-headless numpy pillow; needs ffmpeg).
#
# Seamless loop: the end fades into the start (FADE frames), then the first TAIL frames are written again after the end;
# the game jumps back by one loop (LOOP = (frames - FADE) / FPS seconds) while they play, so the video never stops on
# its last frame (core/videobg.js).
import os, subprocess
import numpy as np, cv2
from PIL import Image

FPS, FADE, TAIL, UP = 24, 24, 12, 2


def read(path):
    w, h = map(int, subprocess.check_output(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', path]).decode().split(',')[:2])
    raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', path, '-map', '0:v:0', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'])
    return np.frombuffer(raw, np.uint8).reshape(-1, h, w, 3).copy()


def gold(a):  # > 0 on gold / white paint, very negative on night-blue or purple panels
    a = a.astype(np.float32)
    return (a[..., 0] + a[..., 1]) / 2 - a[..., 2]


def lum(a):
    a = a.astype(np.float32)
    return 0.3 * a[..., 0] + 0.59 * a[..., 1] + 0.11 * a[..., 2]


def box(shape, x0, y0, x1, y1):
    m = np.zeros(shape[:2], bool); m[y0:y1, x0:x1] = True; return m


def disc(shape, cx, cy, r):
    yy, xx = np.mgrid[:shape[0], :shape[1]]
    return (xx - cx) ** 2 + (yy - cy) ** 2 <= r * r


def grow(m, n):
    return cv2.dilate(m.astype(np.uint8), np.ones((2 * n + 1, 2 * n + 1), np.uint8)) > 0 if n else m


def mend(f, m, r=4, soft=2.0):
    """inpaint the pixels of mask m, then soften them (feathered) so that no trace of the paint stays"""
    if not m.any(): return f
    g = cv2.inpaint(np.ascontiguousarray(f), m.astype(np.uint8), r, cv2.INPAINT_TELEA)
    b = cv2.GaussianBlur(g, (0, 0), soft)
    k = cv2.GaussianBlur(m.astype(np.float32), (0, 0), 1.2)[..., None]
    return (g * (1 - k) + b * k).clip(0, 255).astype(np.uint8)


def loop(fr):
    n = len(fr)
    a = ((np.arange(FADE) + 1) / (FADE + 1))[:, None, None, None]
    head = (fr[n - FADE:].astype(np.float32) * (1 - a) + fr[:FADE].astype(np.float32) * a).round().astype(np.uint8)
    body = np.concatenate([head, fr[FADE:n - FADE]])
    return body, np.concatenate([body, body[:TAIL]])


def write(frames, video, poster, crf=25, gop=24):
    n, h, w, _ = frames.shape
    p = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{w}x{h}', '-r', str(FPS), '-i', '-',
                          '-vf', f'scale={w * UP}:{h * UP}:flags=lanczos,unsharp=5:5:0.45:5:5:0', '-c:v', 'libx264', '-preset', 'veryslow',
                          '-crf', str(crf), '-pix_fmt', 'yuv420p', '-g', str(gop), '-profile:v', 'high', '-movflags', '+faststart', '-an', video],
                         stdin=subprocess.PIPE)
    p.communicate(frames.tobytes())
    Image.fromarray(frames[0]).resize((w * UP, h * UP), Image.LANCZOS).save(poster, quality=82, method=6)


def make(src, out_dir, name, cleaner, crf=25):
    """src video -> out_dir/fond-<name>.mp4 + out_dir/scene-<name>.webp; cleaner(mean frame) returns the per-frame fix"""
    fr = read(src)
    run = cleaner(fr.mean(0).astype(np.uint8))
    fr = np.stack([run(f) for f in fr])
    body, full = loop(fr)
    write(full, os.path.join(out_dir, f'fond-{name}.mp4'), os.path.join(out_dir, f'scene-{name}.webp'), crf)
    print(f'fond-{name}: {len(fr)} frames -> loop {len(body)} + {TAIL} = {len(full) / FPS:.3f} s (LOOP = {len(body)}/{FPS})')
