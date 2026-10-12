# MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
# Usage: python make-icon.py <dir>  → <dir>/icon.png + icon.ico (needs Pillow).
# Renders the sidebar's .app-mark (windows/app.css) at 1024 px: 34 css px -> 1024.
import sys
from PIL import Image, ImageDraw
out = sys.argv[1]
S = 1024; k = S / 34.0
def hexc(h): return tuple(int(h[i:i+2], 16) for i in (1, 3, 5))
stops = [(0.0, hexc('#5ac8fa')), (0.55, hexc('#0a84ff')), (1.0, hexc('#5e5ce6'))]
def grad(t):
    for (a, ca), (b, cb) in zip(stops, stops[1:]):
        if t <= b:
            u = (t - a) / (b - a)
            return tuple(round(ca[i] + (cb[i] - ca[i]) * u) for i in range(3))
    return stops[-1][1]
# 135deg gradient: along the top-left -> bottom-right diagonal.
g = Image.new('RGB', (S, S))
px = g.load()
lut = [grad(i / (2 * S - 2)) for i in range(2 * S - 1)]
for y in range(S):
    for x in range(S):
        px[x, y] = lut[x + y]
mask = Image.new('L', (S, S), 0)
ImageDraw.Draw(mask).rounded_rectangle((0, 0, S - 1, S - 1), radius=round(8 * k), fill=255)
im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
im.paste(g, (0, 0), mask)
# Two screens: 11x9 border-box with a 2 px border, top 10, left 5 / right 5, radius 2.
def screen(left, alpha):
    layer = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    x0, y0 = left * k, 10 * k
    ImageDraw.Draw(layer).rounded_rectangle((x0, y0, x0 + 11 * k, y0 + 9 * k), radius=round(2 * k),
                                            outline=(255, 255, 255, alpha), width=round(2 * k))
    return layer
im = Image.alpha_composite(im, screen(5, 255))
im = Image.alpha_composite(im, screen(34 - 5 - 11, round(255 * 0.8)))
im.resize((256, 256), Image.LANCZOS).save(out + '/icon.png')
im.save(out + '/icon.ico', sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
