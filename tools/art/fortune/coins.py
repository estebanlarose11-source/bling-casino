# La Fortune: the jackpot coins in the colours of the owner's picture: MINI green, MAJOR purple (JACKPOT stays red).
# From the green MAJOR coin (major-vert.webp): mini.webp = the same coin with « MINI », major.webp = turned purple.
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import numpy as np, os, colorsys
HERE = os.path.dirname(__file__); OUT = os.path.join(HERE, '../../../assets/games/fortune')
src = Image.open(os.path.join(HERE, 'major-vert.webp')).convert('RGBA')
W, H = src.size
# purple MAJOR: rotate the green hue towards violet, keep the gold letters (yellow hues untouched)
a = np.asarray(src).astype(float) / 255
rgb = a[..., :3]; out = rgb.copy()
import numpy as _n
hsv = _n.zeros_like(rgb)
mx = rgb.max(-1); mn = rgb.min(-1); d = mx - mn + 1e-9
r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
h = _n.where(mx == r, ((g - b) / d) % 6, _n.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) / 6
s = _n.where(mx > 0, d / (mx + 1e-9), 0); v = mx
green = (h > 0.15) & (h < 0.6) & (s > 0.12)
h2 = _n.where(green, 0.78, h); s2 = _n.where(green, _n.minimum(1, s * 1.15), s)
i = _n.floor(h2 * 6); f = h2 * 6 - i; p = v * (1 - s2); q = v * (1 - f * s2); t = v * (1 - (1 - f) * s2); i = i.astype(int) % 6
sel = [i == k for k in range(6)]
R = _n.select(sel, [v, q, p, p, t, v]); G = _n.select(sel, [t, v, v, q, p, p]); B = _n.select(sel, [p, p, t, v, v, q])
out = _n.stack([R, G, B], -1)
Image.fromarray((_n.concatenate([out, a[..., 3:]], -1) * 255).clip(0, 255).astype('uint8')).save(os.path.join(OUT, 'major.webp'), quality=90, method=6)
# green MINI: cover the word with the coin's own jade (blurred copy of the coin without its middle band), write MINI
coin = src.copy()
# per row: the median of the jade pixels of that row (gold letters left out), plus a little of the coin's own texture
arr = np.asarray(src).astype(float); fill = arr.copy()
for yy in range(H):
    row = arr[yy]; ok = (row[:, 3] > 200) & (row[:, 1] > row[:, 0] + 8) & (row[:, 1] > row[:, 2])
    if ok.sum() > 5: fill[yy, :, :3] = np.median(row[ok, :3], 0)
blur = Image.fromarray(fill.clip(0, 255).astype('uint8')).filter(ImageFilter.GaussianBlur(3))
band = (int(W * 0.04), int(H * 0.3), int(W * 0.96), int(H * 0.7))
m = Image.new('L', src.size, 0); ImageDraw.Draw(m).ellipse(band, fill=255)
m = m.filter(ImageFilter.GaussianBlur(W * 0.02))
coin = Image.composite(blur, coin, m)
dr = ImageDraw.Draw(coin)
font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf', int(H * 0.2))
txt = 'MINI'; bb = dr.textbbox((0, 0), txt, font=font); tw, th = bb[2] - bb[0], bb[3] - bb[1]
x, y = (W - tw) / 2 - bb[0], (H - th) / 2 - bb[1]
dr.text((x + 2, y + 3), txt, font=font, fill=(20, 40, 15, 200))
dr.text((x, y), txt, font=font, fill=(222, 184, 92, 255), stroke_width=max(1, W // 120), stroke_fill=(120, 80, 20, 255))
# keep the round outline of the original coin
coin.putalpha(src.getchannel('A'))
coin.save(os.path.join(OUT, 'mini.webp'), quality=90, method=6)
print('ok', W, H)
