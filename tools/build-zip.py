#!/usr/bin/env python3
"""Build kashmir-live.zip for Hostinger:  python3 tools/build-zip.py

First it stamps every CSS/JS link in the pages with ?v=<fingerprint of that file>. A changed file
gets a new link, so after an upload every browser and CDN loads the files that belong to the new
page, never an old cached copy. Old cached copies mixed with a new page break the form.
"""
import hashlib
import pathlib
import re
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
ASSETS = ["palette.css", "styles.css", "site.js", "main.js", "thank-you.js"]
PAGES = ["index.html", "thank-you.html"]

versions = {name: hashlib.sha1((ROOT / name).read_bytes()).hexdigest()[:8] for name in ASSETS}
for page in PAGES:
    path = ROOT / page
    html = path.read_text(encoding="utf-8")
    for name, version in versions.items():
        html = re.sub(r'((?:href|src)=")' + re.escape(name) + r'(?:\?v=[0-9a-f]+)?"',
                      lambda m: f'{m.group(1)}{name}?v={version}"', html)
    path.write_text(html, encoding="utf-8")

files = PAGES + ASSETS + [".htaccess"]
files += [f"images/{p.name}" for p in sorted((ROOT / "images").iterdir()) if p.is_file() and not p.name.startswith(".")]
out = ROOT / "kashmir-live.zip"
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    for name in files:
        z.write(ROOT / name, name)

print(f"Built {out.name}: {len(files)} files, {out.stat().st_size / 1024 / 1024:.1f} MB")
for name, version in versions.items():
    print(f"  {name}?v={version}")
