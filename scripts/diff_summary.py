# The one source of the picture-change summary: used by the pictures workflow and the laptop's rebaseline helper.
"""Summarise changed e2e baselines: per picture how much and where it changed, pictures grouped by the same
changed regions, and one sheet that shows only the changed regions (old | new), enlarged, once per group.

Usage: python3 diff_summary.py <out.png> <snapshot path>...
Prints NOISE <path> for pictures whose change is below the noise floor (anti-aliasing), so the caller can restore them.
"""
import io
import subprocess
import sys

from PIL import Image, ImageChops, ImageDraw

NOISE_PIXELS = 24      # fewer changed pixels than this ...
NOISE_DELTA = 40       # ... and no channel moved more than this -> anti-aliasing noise
CELL = 16              # grid used to merge changed pixels into regions
PAD = 12               # context around a region in the crop
SCALE = 2
MAX_CROPS = 6          # more changed regions than this -> show the whole picture
PAGE_W, PAGE_H = 1600, 1400


def old_image(path):
    r = subprocess.run(['git', 'show', f'HEAD:{path}'], capture_output=True)
    return Image.open(io.BytesIO(r.stdout)).convert('RGB') if r.returncode == 0 else None


def regions(mask):
    """Merge changed pixels into rectangles on a coarse grid (8-connected cells)."""
    w, h = mask.size
    px = mask.load()
    cells = set()
    for y in range(h):
        for x in range(w):
            if px[x, y]:
                cells.add((x // CELL, y // CELL))
    out, seen = [], set()
    for c in cells:
        if c in seen:
            continue
        stack, xs, ys = [c], [], []
        seen.add(c)
        while stack:
            cx, cy = stack.pop()
            xs.append(cx); ys.append(cy)
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    n = (cx + dx, cy + dy)
                    if n in cells and n not in seen:
                        seen.add(n); stack.append(n)
        out.append((min(xs) * CELL, min(ys) * CELL, min((max(xs) + 1) * CELL, w), min((max(ys) + 1) * CELL, h)))
    return sorted(out, key=lambda b: (b[1], b[0]))


def main():
    out, paths = sys.argv[1], sys.argv[2:]
    groups = {}
    print(f'{"changed":>8}  regions  picture')
    for p in paths:
        new = Image.open(p).convert('RGB')
        old = old_image(p)
        if old is None:
            print(f'{"new":>8}  -        {p}')
            groups.setdefault(('new',), []).append((p, None, new, [(0, 0, new.width, new.height)]))
            continue
        if old.size != new.size:
            print(f'{"size":>8}  -        {p}  {old.size} -> {new.size}')
            groups.setdefault(('size', old.size, new.size), []).append((p, old, new, [(0, 0, new.width, new.height)]))
            continue
        diff = ImageChops.difference(old, new)
        gray = diff.convert('L')
        mask = gray.point(lambda v: 255 if v > 8 else 0)
        count = sum(mask.histogram()[1:])
        if count == 0 or (count < NOISE_PIXELS and max(b[1] for b in diff.getextrema()) < NOISE_DELTA):
            print(f'NOISE {p}')
            continue
        boxes = regions(mask)
        share = 100 * count / (new.width * new.height)
        print(f'{share:7.2f}%  {len(boxes):>7}  {p}')
        key = ('chg', new.size, tuple((round(b[0] / 8), round(b[1] / 8), round(b[2] / 8), round(b[3] / 8)) for b in boxes))
        groups.setdefault(key, []).append((p, old, new, boxes))

    rows = []
    print('\nGroups (look once per group):')
    for i, (key, members) in enumerate(sorted(groups.items(), key=lambda kv: -len(kv[1])), 1):
        p, old, new, boxes = members[0]
        print(f'  G{i}: {len(members)} picture(s), {len(boxes)} region(s): ' + ', '.join(m[0].split('/')[-1] for m in members[:6]) + (' ...' if len(members) > 6 else ''))
        # many scattered changes (corners, a shifted layout): one whole picture at half size reads better than fragments
        whole = len(boxes) > MAX_CROPS or old is None or old.size != new.size
        for b in ([(0, 0, new.width, new.height)] if whole else boxes):
            x0, y0 = max(0, b[0] - PAD), max(0, b[1] - PAD)
            x1, y1 = min(new.width, b[2] + PAD), min(new.height, b[3] + PAD)
            n = new.crop((x0, y0, x1, y1))
            o = old.crop((x0, y0, x1, y1)) if old else Image.new('RGB', n.size, 'white')
            f = 0.5 if whole else SCALE
            o, n = (im.resize((max(1, int(im.width * f)), max(1, int(im.height * f))), Image.LANCZOS if whole else Image.NEAREST) for im in (o, n))
            row = Image.new('RGB', (o.width + n.width + 24, max(o.height, n.height) + 22), 'white')
            row.paste(o, (0, 22)); row.paste(n, (o.width + 24, 22))
            ImageDraw.Draw(row).text((4, 4), f'G{i} x{len(members)}  {p.split("/")[-1]}  [{x0},{y0}] old | new', fill='black')
            rows.append(row)
    # rows go side by side in columns, pages of at most PAGE_H px, so each page stays readable
    pages, page, col, x, y, colw = [], [], [], 0, 0, 0
    for r in rows:
        if y + r.height > PAGE_H and col:
            x += colw + 16; y = 0; colw = 0
            if x + r.width > PAGE_W:
                pages.append(page); page = []; x = 0
            col = []
        page.append((r, x, y)); col.append(r); y += r.height + 8; colw = max(colw, r.width)
    if page:
        pages.append(page)
    print()
    for i, pg in enumerate(pages, 1):
        w = max(px + r.width for r, px, _ in pg); h = max(py + r.height for r, _, py in pg)
        sheet = Image.new('RGB', (w, h), (230, 230, 230))
        for r, px, py in pg:
            sheet.paste(r, (px, py))
        path = out if len(pages) == 1 else out.replace('.png', f'-{i}.png')
        sheet.save(path)
        print(f'sheet: {path}')


if __name__ == '__main__':
    main()
