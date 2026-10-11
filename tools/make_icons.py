#!/usr/bin/env python3
"""App icons from the painting (tools/originals/app-icon-source.png).

The source is a mock-up: the painting sits on a navy card as a rounded tile with a glassy rim and a
drop shadow. This cuts the painting out square from inside the rim, paints the corners the tile had
rounded off back in from the art around them (so no navy or rim shows whatever shape a phone masks
it to), and writes every size the app uses.

usage: python3 tools/make_icons.py
"""
import os

import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
SRC = os.path.join(ROOT, "tools", "originals", "app-icon-source.png")
OUT = os.path.join(ROOT, "site", "icons")

# where the tile sits in the source (measured): its edges, corner radius and rim width
TILE = (72, 56, 1180, 1189)
RADIUS = 252
RIM = 20
# the square taken from inside the rim
CROP = (86, 78, 1176, 1168)


def corner_holes(w, h):
    """Pixels of the crop that lie in the tile's rounded-off corners or on its rim there."""
    x0, y0, x1, y1 = TILE
    cx, cy = CROP[0], CROP[1]
    ys, xs = np.mgrid[0:h, 0:w]
    X, Y = xs + cx, ys + cy
    hole = np.zeros((h, w), bool)
    for ccx, ccy, sx, sy in ((x0 + RADIUS, y0 + RADIUS, -1, -1), (x1 - RADIUS, y0 + RADIUS, 1, -1),
                             (x0 + RADIUS, y1 - RADIUS, -1, 1), (x1 - RADIUS, y1 - RADIUS, 1, 1)):
        q = ((X - ccx) * sx > 0) & ((Y - ccy) * sy > 0)
        hole |= q & (np.hypot(X - ccx, Y - ccy) > RADIUS - RIM)
    return hole


def fill(img, hole):
    """Push-pull fill: average the known pixels down a pyramid, then paint the holes back up from it."""
    known = (~hole).astype(np.float32)
    levels = [(img * known[..., None], known)]
    while min(levels[-1][1].shape) > 8:
        a, k = levels[-1]
        h, w = (k.shape[0] // 2) * 2, (k.shape[1] // 2) * 2
        a = a[:h, :w].reshape(h // 2, 2, w // 2, 2, 3).sum((1, 3))
        k = k[:h, :w].reshape(h // 2, 2, w // 2, 2).sum((1, 3))
        levels.append((a, k))
    a, k = levels[-1]
    est = a / np.maximum(k, 1e-6)[..., None]
    for a, k in reversed(levels[:-1]):
        up = np.stack([np.asarray(Image.fromarray(est[..., c].astype(np.float32)).resize((k.shape[1], k.shape[0]), Image.BILINEAR)) for c in range(3)], -1)
        own = a / np.maximum(k, 1e-6)[..., None]
        t = np.clip(k, 0, 1)[..., None]
        est = own * t + up * (1 - t)
    out = img.copy()
    out[hole] = est[hole]
    return out


def rounded(im, size, radius):
    """The plain ("any") icon: rounded like the old one, transparent outside."""
    big = 4 * size
    mask = Image.new("L", (big, big), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, big - 1, big - 1), radius=radius * 4, fill=255)
    out = im.resize((size, size), Image.LANCZOS).convert("RGBA")
    out.putalpha(mask.resize((size, size), Image.LANCZOS))
    return out


def main():
    src = np.asarray(Image.open(SRC).convert("RGB")).astype(np.float32)
    art = src[CROP[1]:CROP[3], CROP[0]:CROP[2]]
    art = fill(art, corner_holes(art.shape[1], art.shape[0]))
    master = Image.fromarray(np.clip(art + 0.5, 0, 255).astype(np.uint8))
    master.resize((512, 512), Image.LANCZOS).save(os.path.join(OUT, "maskable-512.png"), optimize=True)
    # iOS rounds the corners itself and shows transparency as black, so this one is full bleed
    master.resize((180, 180), Image.LANCZOS).save(os.path.join(OUT, "apple-touch-icon.png"), optimize=True)
    for size in (512, 192):
        rounded(master, size, round(size * 112 / 512)).save(os.path.join(OUT, f"icon-{size}.png"), optimize=True)
    rounded(master, 32, 7).save(os.path.join(OUT, "favicon-32.png"), optimize=True)
    print("icons written to site/icons/")


main()
