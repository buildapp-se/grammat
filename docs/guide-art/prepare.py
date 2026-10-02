"""Gör Codex-bilderna webbfärdiga: tar bort den halvgenomskinliga glorian, beskär, skalar till
960 px bredd, sparar WebP i guide-img/ och spårar konturen till en SVG-bana (klipper snittlinjerna).
Kör: uv run --with pillow --with numpy --with scikit-image python docs/guide-art/prepare.py
Skriver guide-img/<djur>.webp och docs/guide-art/<djur>.json (bredd, höjd, kontur). Rutnätsbilder
för att placera snitt hamnar i docs/guide-art/grid-<djur>.png (ignoreras av git)."""
import json, os
import numpy as np
from PIL import Image, ImageDraw
from skimage import measure

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', 'guide-img')
os.makedirs(OUT, exist_ok=True)
W = 960
for n in ['not', 'gris', 'lamm', 'kyckling']:
    im = Image.open(os.path.join(HERE, n + '.png')).convert('RGBA')
    a = np.array(im)
    alpha = a[:, :, 3].astype(int)
    alpha[alpha < 96] = 0  # glorian runt konturen
    a[:, :, 3] = alpha
    ys, xs = np.where(alpha > 0)
    pad = 10
    box = (max(xs.min() - pad, 0), max(ys.min() - pad, 0), min(xs.max() + pad, a.shape[1]), min(ys.max() + pad, a.shape[0]))
    im = Image.fromarray(a).crop(box)
    h = round(im.height * W / im.width)
    im = im.resize((W, h), Image.LANCZOS)
    im.save(os.path.join(OUT, n + '.webp'), 'WEBP', quality=82, method=6)
    mask = np.array(im)[:, :, 3] > 128
    contours = measure.find_contours(np.pad(mask, 1).astype(float), 0.5)
    c = max(contours, key=len) - 1  # största yttre konturen, tillbaka från paddingen
    c = measure.approximate_polygon(c, tolerance=1.2)
    path = 'M' + ' L'.join(f'{x:.0f} {y:.0f}' for y, x in c) + ' Z'
    json.dump({'w': W, 'h': h, 'body': path}, open(os.path.join(HERE, n + '.json'), 'w'))
    grid = im.copy()
    bg = Image.new('RGBA', grid.size, (239, 238, 227, 255))
    bg.alpha_composite(grid)
    d = ImageDraw.Draw(bg)
    for x in range(0, W, 40):
        d.line([(x, 0), (x, h)], fill=(154, 42, 58, 90 if x % 200 else 200), width=1)
        if x % 80 == 0: d.text((x + 2, 2), str(x), fill=(154, 42, 58, 255))
    for y in range(0, h, 40):
        d.line([(0, y), (W, y)], fill=(154, 42, 58, 90 if y % 200 else 200), width=1)
        if y % 80 == 0: d.text((2, y + 2), str(y), fill=(154, 42, 58, 255))
    bg.convert('RGB').save(os.path.join(HERE, 'grid-' + n + '.png'))
    print(n, W, h, os.path.getsize(os.path.join(OUT, n + '.webp')) // 1024, 'kB', len(c), 'punkter')
