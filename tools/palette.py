#!/usr/bin/env python3
"""Destination colour palettes.

  python3 tools/palette.py palettes/kashmir.json            check contrast, write palette.css, set theme-color in the pages
  python3 tools/palette.py palettes/vietnam-a.json --check  contrast report only
  python3 tools/palette.py palettes/kashmir.json --css SELECTOR   print the declarations under SELECTOR (design system bundle)
  python3 tools/palette.py palettes/kashmir.json --tokens   print the colour values as JSON (design system tokens.json)

A palette JSON gives nine role colours and three sky stops. Everything else (photo scrims, shadows,
field borders, icons…) is worked out from them; "overrides" pins exact values instead.
"""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
ROLES = ["ground", "ground-soft", "ink", "text", "line", "accent", "on-accent", "alert", "alert-soft"]
WHITE = (255, 255, 255)
BLACK = (0, 0, 0)


def rgb(hex_colour):
    h = hex_colour.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def hexc(c):
    return "#" + "".join(f"{round(v):02X}" for v in c)


def mix(a, b, t):
    """t = share of b."""
    return tuple(round(x + (y - x) * t) for x, y in zip(a, b))


def luminance(c):
    def lin(v):
        v /= 255
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    r, g, b = (lin(v) for v in c)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast(a, b):
    la, lb = sorted((luminance(a), luminance(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


def svg_uri(svg):
    return 'url("data:image/svg+xml,' + svg.replace("<", "%3C").replace(">", "%3E").replace("#", "%23") + '")'


def build(p):
    o = p.get("overrides", {})
    c = {k: rgb(p["roles"][k]) for k in ROLES}
    sky = [rgb(s) for s in p["sky"]]
    ink, text, ground, line = c["ink"], c["text"], c["ground"], c["line"]
    shades = {"scrim": 0.35, "glass": 0.2, "shadow": 0.5, "caption": 0.55, "glow": 0.3}

    out = {k: p["roles"][k] for k in ROLES}
    for name, t in shades.items():
        out[f"{name}-rgb"] = ", ".join(map(str, rgb(o[name]) if name in o else mix(ink, BLACK, t)))
    out["accent-rgb"] = ", ".join(map(str, c["accent"]))
    field = rgb(o["field-line"]) if "field-line" in o else mix(line, text, 0.55)
    if "field-line" not in o:
        while contrast(field, WHITE) < 3:
            field = mix(field, text, 0.15)
    out["field-line"] = hexc(field)
    out["chart-label"] = o.get("chart-label", p["roles"]["text"])
    ph = [mix(ground, text, 0.25), mix(ground, text, 0.6), mix(ground, ink, 0.6)]
    for i, v in enumerate(o.get("placeholder", [hexc(x) for x in ph]), 1):
        out[f"ph-{i}"] = v
    for i, v in enumerate(p["sky"], 1):
        out[f"sky-{i}"] = v
    ridges = [mix(sky[2], sky[0], 0.3), mix(sky[2], sky[0], 0.55), mix(ground, text, 0.7), mix(text, ink, 0.5)]
    for i, v in enumerate(o.get("ridges", [hexc(x) for x in ridges]), 1):
        out[f"ridge-{i}"] = v

    ink_hex, text_hex, on_accent = p["roles"]["ink"].upper(), p["roles"]["text"].upper(), p["roles"]["on-accent"].upper()
    out["icon-chevron"] = svg_uri(f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8'><path d='M1 1l5 5 5-5' fill='none' stroke='{ink_hex}' stroke-width='1.6'/></svg>")
    out["icon-tick"] = svg_uri(f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'><path d='M6 10.5l2.6 2.5L14 7.5' fill='none' stroke='{on_accent}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/></svg>")
    out["icon-dash"] = svg_uri(f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'><path d='M6.5 10h7' stroke='{text_hex}' stroke-width='2' stroke-linecap='round'/></svg>")
    out["icon-plus"] = svg_uri(f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'><path d='M10 5v10M5 10h10' stroke='{ink_hex}' stroke-width='1.8' stroke-linecap='round'/></svg>")
    return out, c, field


def report(p, c, field):
    chart = rgb(p.get("overrides", {}).get("chart-label", p["roles"]["text"]))
    checks = [
        ("text on ground", c["text"], c["ground"], 4.5),
        ("text on ground-soft", c["text"], c["ground-soft"], 4.5),
        ("text on white", c["text"], WHITE, 4.5),
        ("ink on white", c["ink"], WHITE, 7),
        ("ink on ground", c["ink"], c["ground"], 4.5),
        ("white on ink", WHITE, c["ink"], 7),
        ("on-accent on accent", c["on-accent"], c["accent"], 4.5),
        ("accent on ink (arrow, chart dots)", c["accent"], c["ink"], 3),
        ("alert on white", c["alert"], WHITE, 4.5),
        ("alert on alert-soft", c["alert"], c["alert-soft"], 4.5),
        ("field-line on white", field, WHITE, 3),
        ("chart-label on white", chart, WHITE, 4.5),
    ]
    exempt = set(p.get("exempt", []))
    failed = False
    print(f"{p['name']}: contrast")
    for label, a, b, floor in checks:
        r = contrast(a, b)
        ok = r >= floor
        key = label.split(" on ")[0]
        status = "ok  " if ok else ("warn" if key in exempt else "FAIL")
        failed |= status == "FAIL"
        print(f"  {status} {label:<36} {r:5.2f}:1  (needs {floor}:1)")
    return not failed


def declarations(out, indent="  "):
    return "\n".join(f"{indent}--{k}: {v};" for k, v in out.items())


def main():
    args = sys.argv[1:]
    if not args:
        sys.exit(__doc__)
    path = pathlib.Path(args[0])
    p = json.loads(path.read_text(encoding="utf-8"))
    out, c, field = build(p)

    if "--css" in args:
        sel = args[args.index("--css") + 1]
        print(f"{sel} {{\n{declarations(out)}\n}}")
        return
    if "--tokens" in args:
        print(json.dumps({k: v for k, v in out.items() if not k.startswith("icon-")}, indent=1))
        return

    ok = report(p, c, field)
    if "--check" in args:
        sys.exit(0 if ok else 1)
    if not ok:
        sys.exit("Contrast floors failed: palette.css not written.")
    css = (f"/* {p['name']} colours. Generated by tools/palette.py from {path.as_posix()}; edit that file, not this one. */\n"
           f":root {{\n{declarations(out)}\n}}\n")
    (ROOT / "palette.css").write_text(css, encoding="utf-8")
    for page in ("index.html", "thank-you.html"):
        f = ROOT / page
        html = f.read_text(encoding="utf-8")
        f.write_text(re.sub(r'(<meta name="theme-color" content=")[^"]*(")', rf'\g<1>{p["roles"]["ground"]}\g<2>', html), encoding="utf-8")
    print(f"Wrote palette.css ({len(out)} variables) and set theme-color to {p['roles']['ground']}.")


if __name__ == "__main__":
    main()
