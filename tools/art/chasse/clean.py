# The Hunt: the owner's 2 pictures of 16 November 2026 -> scene-haut.webp (784 × 1168, phone held upright) and
# scene-large.webp (1168 × 784, computer and wide screens). The painted 5 × 5 lattice inside the frame is erased (the
# game draws its own 5 × 3 reels), and so are the words MINI / MAJOR / GRAND JACKPOT (the game has no jackpot: we write
# SOLDE / GAIN / GAIN MAX on the plaques) and the painted stake « $1.00 ».
#   pip install opencv-python-headless ; python3 tools/art/chasse/clean.py
from PIL import Image
import numpy as np, cv2, os
HERE = os.path.dirname(__file__); OUT = os.path.join(HERE, '../../../assets/games/chasse')
JOBS = {
    'large': {
        'win': (209, 177, 962, 583), 'vx': [359, 510, 661, 812], 'hy': [262, 343, 422, 502], 'hw': 6,
        'txt': [(193, 78, 330, 134), (493, 88, 678, 157), (830, 78, 970, 136), (190, 670, 304, 720)],
    },
    'haut': {
        'win': (140, 256, 658, 860), 'vx': [245, 347, 448, 549], 'hy': [377, 497, 617, 737], 'hw': 9,
        'txt': [(138, 133, 284, 217), (320, 128, 472, 214), (510, 133, 657, 217), (97, 1014, 201, 1066)],
    },
}


def band(a, axis, c, hw, lo, hi, shift):
    """Erase a painted bar: copy the texture `shift` px away over it, feathered on its edges."""
    n = 2 * hw + 1
    ramp = np.ones(n); f = 4
    ramp[:f] = np.linspace(0.25, 1, f); ramp[-f:] = np.linspace(1, 0.25, f)
    if axis == 'x':
        src = a[lo:hi, c - hw - shift:c + hw + 1 - shift].copy(); dst = a[lo:hi, c - hw:c + hw + 1]
        m = ramp[None, :, None]
    else:
        src = a[c - hw - shift:c + hw + 1 - shift, lo:hi].copy(); dst = a[c - hw:c + hw + 1, lo:hi]
        m = ramp[:, None, None]
    dst[:] = dst * (1 - m) + src * m


for name, job in JOBS.items():
    a = np.asarray(Image.open(os.path.join(HERE, f'decor-{name}.jpg')).convert('RGB')).astype(float)
    x0, y0, x1, y1 = job['win']; hw = job['hw']
    for c in job['vx']: band(a, 'x', c, hw, y0, y1, 34)
    for c in job['hy']: band(a, 'y', c, hw, x0, x1, 34)
    # the window: a touch darker and smoother so the reels read well (the game puts its own tiles on it)
    win = a[y0:y1, x0:x1]
    blur = cv2.GaussianBlur(win, (0, 0), 2.2)
    a[y0:y1, x0:x1] = blur * 0.88
    img = a.clip(0, 255).astype('uint8')
    # painted words: the bright gold letters, inpainted from the wood around them
    mask = np.zeros(img.shape[:2], 'uint8')
    for (tx0, ty0, tx1, ty1) in job['txt']:
        r = img[ty0:ty1, tx0:tx1].astype(float); lum = r.mean(2)
        med = cv2.medianBlur(lum.astype('uint8'), 31).astype(float)
        mask[ty0:ty1, tx0:tx1] = ((lum - med > 14) | (lum > 120)) * 255
    mask = cv2.dilate(mask, np.ones((5, 5), 'uint8'), iterations=2)
    img = cv2.inpaint(img[..., ::-1].copy(), mask, 9, cv2.INPAINT_TELEA)[..., ::-1]
    for (tx0, ty0, tx1, ty1) in job['txt']:  # smooth the patches
        img[ty0:ty1, tx0:tx1] = cv2.GaussianBlur(img[ty0:ty1, tx0:tx1], (0, 0), 2.5)
    Image.fromarray(np.ascontiguousarray(img)).save(os.path.join(OUT, f'scene-{name}.webp'), quality=86, method=6)
print('ok')
