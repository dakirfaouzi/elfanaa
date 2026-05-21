"""
Remove the white/cream background from a product photograph and save a
clean transparent PNG. Tuned for Sugarbear-style studio product shots
(white seamless background, no foreground-touches-edge cases).

Algorithm:
  1.  Load image and force RGBA.
  2.  Run a 4-connected flood fill from each of the four corners. A pixel
      is "background" if its R, G, B are all >= WHITE_THRESHOLD.
  3.  Feather the alpha mask near the edges of the cleared area: any
      surviving pixel that is *almost* white (between SOFT_LO and the
      hard threshold) gets a graded alpha so we don't leave a hard
      jagged outline around the bottles.
  4.  Multiply alpha by a tiny mask blur for one extra pass of softness.

Usage:
    python scripts/remove-bg.py <source.png> <out.png>
"""

from __future__ import annotations

import sys
from collections import deque
from pathlib import Path

from PIL import Image, ImageFilter

# ── Tunables ──────────────────────────────────────────────────────────────
WHITE_THRESHOLD = 238      # pixel >= this on R,G,B → background candidate
SOFT_LO         = 215      # pixels in [SOFT_LO, WHITE_THRESHOLD] = soft edge
ALPHA_BLUR_PX   = 0.7      # final mask blur radius (0 to disable)


def is_bg(px: tuple[int, int, int, int]) -> bool:
    r, g, b, _ = px
    return r >= WHITE_THRESHOLD and g >= WHITE_THRESHOLD and b >= WHITE_THRESHOLD


def edge_softness(px: tuple[int, int, int, int]) -> int:
    """Return alpha 0–255 for a pixel near the cleared border."""
    r, g, b, _ = px
    luma = (r + g + b) / 3
    if luma <= SOFT_LO:
        return 255
    if luma >= WHITE_THRESHOLD:
        return 0
    # linear ramp: SOFT_LO → 255, WHITE_THRESHOLD → 0
    span = WHITE_THRESHOLD - SOFT_LO
    return int(255 * (WHITE_THRESHOLD - luma) / span)


def remove_white_bg(src: Path, dst: Path) -> None:
    img = Image.open(src).convert("RGBA")
    width, height = img.size
    px = img.load()

    print(f"  source : {src.name}  ({width}×{height})")

    # 1. Flood fill from corners.
    visited: set[tuple[int, int]] = set()
    queue: deque[tuple[int, int]] = deque()
    seeds = [(0, 0), (width - 1, 0), (0, height - 1), (width - 1, height - 1)]
    for sx, sy in seeds:
        if is_bg(px[sx, sy]) and (sx, sy) not in visited:
            queue.append((sx, sy))
            visited.add((sx, sy))

    cleared = 0
    while queue:
        x, y = queue.popleft()
        px[x, y] = (255, 255, 255, 0)
        cleared += 1
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < width and 0 <= ny < height and (nx, ny) not in visited:
                if is_bg(px[nx, ny]):
                    queue.append((nx, ny))
                    visited.add((nx, ny))

    print(f"  cleared: {cleared:,} px via flood fill")

    # 2. Feather: any pixel that is *almost* white (and adjacent to a
    #    cleared region) gets a graded alpha so the silhouette breathes.
    feathered = 0
    for y in range(height):
        for x in range(width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            if r >= SOFT_LO and g >= SOFT_LO and b >= SOFT_LO:
                # check neighbours for a cleared cell
                near_clear = False
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < width and 0 <= ny < height:
                        if px[nx, ny][3] == 0:
                            near_clear = True
                            break
                if near_clear:
                    px[x, y] = (r, g, b, edge_softness((r, g, b, a)))
                    feathered += 1

    print(f"  edges  : {feathered:,} px feathered")

    # 3. Optional gentle blur on the alpha channel only.
    if ALPHA_BLUR_PX > 0:
        r, g, b, a = img.split()
        a = a.filter(ImageFilter.GaussianBlur(ALPHA_BLUR_PX))
        img = Image.merge("RGBA", (r, g, b, a))

    dst.parent.mkdir(parents=True, exist_ok=True)
    img.save(dst, "PNG", optimize=True)
    print(f"  saved  : {dst}")


def main() -> int:
    if len(sys.argv) != 3:
        print("usage: python scripts/remove-bg.py <source.png> <out.png>")
        return 2
    remove_white_bg(Path(sys.argv[1]), Path(sys.argv[2]))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
