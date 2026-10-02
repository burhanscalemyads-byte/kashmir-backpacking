#!/usr/bin/env python3
"""Resize / crop photos into web JPEGs using macOS's built-in `sips`.

    python3 tools/img.py <in> <out.jpg> <maxWidth> [quality 0-100] [cropX cropY cropW cropH]

Crop values are fractions (0-1) of the source image, measured from the top-left.
Example, the middle band of a photo:  python3 tools/img.py in.jpg out.jpg 1200 75 0 0.3 1 0.4
"""
import os, subprocess, sys, tempfile


def dims(path):
    out = subprocess.run(["sips", "-g", "pixelWidth", "-g", "pixelHeight", path],
                         capture_output=True, text=True, check=True).stdout
    vals = {l.split(":")[0].strip(): int(l.split(":")[1]) for l in out.splitlines()[1:] if ":" in l}
    return vals["pixelWidth"], vals["pixelHeight"]


def main(a):
    src, out, max_w = a[0], a[1], int(a[2])
    quality = a[3] if len(a) > 3 else "75"
    tmp = tempfile.mktemp(suffix=".jpg")
    work = src
    if len(a) >= 8:
        w, h = dims(src)
        cx, cy, cw, ch = (float(v) for v in a[4:8])
        x, y = round(cx * w), round(cy * h)
        pw, ph = min(round(cw * w), w - x), min(round(ch * h), h - y)
        # sips wants --cropOffset (Y X) before -c (H W)
        subprocess.run(["sips", "--cropOffset", str(y), str(x), "-c", str(ph), str(pw), src, "--out", tmp],
                       capture_output=True, check=True)
        work = tmp
    w, _ = dims(work)
    cmd = ["sips", "-s", "format", "jpeg", "-s", "formatOptions", str(quality)]
    if w > max_w:
        cmd += ["--resampleWidth", str(max_w)]
    subprocess.run(cmd + [work, "--out", out], capture_output=True, check=True)
    if os.path.exists(tmp):
        os.remove(tmp)
    ow, oh = dims(out)
    print(f"{out}: {ow}x{oh}, {os.path.getsize(out) // 1024} KB")


if __name__ == "__main__":
    if len(sys.argv) < 4:
        sys.exit(__doc__)
    main(sys.argv[1:])
