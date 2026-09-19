#!/usr/bin/env python3
"""Build the 10 False God composite portraits for the SU build calculator.

Each False God is fought as 6 independent "creatures" (body parts) laid out in the
battle formation's 3x2 grid; their art is drawn so the six frames read as one massive
creature.  This stitches the six battle-sprite frames (spr_crits_battle_<frame>.png in
the sibling _su_extract dump) back into a single transparent PNG per False God, in the
same reading-order layout the game uses (parts 1-3 across the top row, 4-6 across the
bottom), and drops each into assets/falsegods/<key>.png.

The frame indices below are code-grounded from _su_extract creature_sprites.json
(records named <god>_1..6 / caliban_01..06 / jotinir_1..6 with consecutive battle_frame).

Run from anywhere:  python tools/build_falsegods.py
"""
import os
import sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.normpath(os.path.join(ROOT, "..", "_su_extract", "assets", "sprites"))
OUT = os.path.join(ROOT, "assets", "falsegods")

# key -> ordered 6 battle-sprite frame indices (parts 1..6)
FRAMES = {
    "CALIBAN":       [1331, 1332, 1333, 1334, 1335, 1336],
    "HYDRANOX":      [2630, 2631, 2632, 2633, 2634, 2635],
    "IMPIMPINGTON":  [2636, 2637, 2638, 2639, 2640, 2641],
    "JOTUNIR":       [2642, 2643, 2644, 2645, 2646, 2647],
    "LOIDPRIME":     [2648, 2649, 2650, 2651, 2652, 2653],
    "LOSTCONSTRUCT": [2654, 2655, 2656, 2657, 2658, 2659],
    "MINDWURM":      [2660, 2661, 2662, 2663, 2664, 2665],
    "NEBODAR":       [2666, 2667, 2668, 2669, 2670, 2671],
    "SAINTALTHEA":   [2672, 2673, 2674, 2675, 2676, 2677],
    "THEANCESTOR":   [2678, 2679, 2680, 2681, 2682, 2683],
}

CELL = 64   # original spr_crits_battle cell size; parts are bbox-trimmed within it
COLS, ROWS = 3, 2


def build(key, frames):
    imgs = []
    for f in frames:
        p = os.path.join(SRC, f"spr_crits_battle_{f}.png")
        if not os.path.exists(p):
            print(f"  MISSING frame {f} for {key}: {p}", file=sys.stderr)
            return False
        imgs.append(Image.open(p).convert("RGBA"))
    canvas = Image.new("RGBA", (CELL * COLS, CELL * ROWS), (0, 0, 0, 0))
    for idx, im in enumerate(imgs):
        r, c = divmod(idx, COLS)                 # reading order: 0,1,2 / 3,4,5
        # The frames are bbox-trimmed, so each part must align toward the composite's
        # CENTER (where the 3x2 cells meet) for the seams to join into one creature:
        #   col 0 (parts 1,4) right-aligned · col 1 (2,5) centered · col 2 (3,6) left-aligned
        #   row 0 (top) bottom-aligned · row 1 (bottom) top-aligned
        if c == 0:   x = c * CELL + (CELL - im.width)      # right edge of cell
        elif c == 1: x = c * CELL + (CELL - im.width) // 2  # centered
        else:        x = c * CELL                           # left edge of cell
        y = r * CELL + (CELL - im.height) if r == 0 else r * CELL
        canvas.alpha_composite(im, (x, y))
    bbox = canvas.getbbox()                        # trim outer transparency
    if bbox:
        canvas = canvas.crop(bbox)
    os.makedirs(OUT, exist_ok=True)
    canvas.save(os.path.join(OUT, f"{key}.png"))
    return True


def main():
    if not os.path.isdir(SRC):
        print(f"source sprites not found: {SRC}", file=sys.stderr)
        sys.exit(1)
    ok = 0
    for key, frames in FRAMES.items():
        if build(key, frames):
            ok += 1
    print(f"built {ok}/{len(FRAMES)} False God composites -> {OUT}")
    if ok != len(FRAMES):
        sys.exit(1)


if __name__ == "__main__":
    main()
