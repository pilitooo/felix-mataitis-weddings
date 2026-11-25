#!/usr/bin/env python3
"""Genera los videos e imágenes del sitio a partir de _material/ según scripts/media.json.

  python3 scripts/encode_media.py            # todo
  python3 scripts/encode_media.py hero cami-ramiro   # sólo algunos

Salida en public/assets/:
  video/<nombre>.mp4 (+ -sm.mp4)    loops de fondo, H.264 sin audio, faststart
  films/<slug>.mp4                  highlight mudo de cada boda (1080p)
  films/<slug>-preview.mp4          loop corto 640px para el hover de las tarjetas
  img/<nombre>.webp (+ -sm.webp)    pósters y fotos

Todo sin audio y sin metadatos (se descartan GPS/fechas de cámara).
"""
import json, subprocess, sys, os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MAT = ROOT / "_material"
OUT = ROOT / "public" / "assets"
EDL = json.loads((ROOT / "scripts" / "media.json").read_text())
SRC = {k: str(MAT / v) for k, v in EDL["sources"].items()}
only = set(sys.argv[1:])

H264 = ["-c:v", "libx264", "-preset", "slow", "-profile:v", "high", "-pix_fmt", "yuv420p",
        "-r", "25", "-g", "50", "-movflags", "+faststart", "-an", "-map_metadata", "-1"]


def run(args):
    subprocess.run(["ffmpeg", "-v", "error", "-y", *args], check=True)


def cover(w, h):
    """Escala para cubrir w×h y recorta al centro (como object-fit: cover)."""
    return f"scale={w}:{h}:force_original_aspect_ratio=increase:flags=lanczos,crop={w}:{h},setsar=1"


def fit_width(w):
    """Mantiene el aspecto original (cinemascope incluido) con ancho w."""
    return f"scale={w}:-2:flags=lanczos,setsar=1"


def edit(segments, vf, out, crf, fade=0.0, maxrate=None):
    """Concatena segmentos [src, inicio, fin] aplicando vf a cada uno.
    maxrate (kbps) pone techo al bitrate: el grano de película dispara el peso."""
    args, chains = [], []
    for i, (src, a, b) in enumerate(segments):
        args += ["-ss", f"{a}", "-t", f"{b - a}", "-i", SRC[src]]
        chains.append(f"[{i}:v]{vf},fps=25,format=yuv420p[v{i}]")
    n = len(segments)
    graph = ";".join(chains) + ";" + "".join(f"[v{i}]" for i in range(n)) + f"concat=n={n}:v=1:a=0[c]"
    if fade:
        total = sum(b - a for _, a, b in segments)
        graph += f";[c]fade=t=in:st=0:d={fade},fade=t=out:st={total - fade}:d={fade}[o]"
    else:
        graph += ";[c]null[o]"
    out.parent.mkdir(parents=True, exist_ok=True)
    cap = ["-maxrate", f"{maxrate}k", "-bufsize", f"{maxrate * 2}k"] if maxrate else []
    run([*args, "-filter_complex", graph, "-map", "[o]", *H264, "-crf", str(crf), *cap, str(out)])
    print(f"  {out.relative_to(ROOT)}  {out.stat().st_size / 1e6:.2f} MB")


def still(src, t, vf, out, q=80):
    out.parent.mkdir(parents=True, exist_ok=True)
    pre = ["-ss", f"{t}"] if t is not None else []
    run([*pre, "-i", src, "-frames:v", "1", "-vf", vf, "-c:v", "libwebp", "-quality", str(q),
         "-map_metadata", "-1", str(out)])
    print(f"  {out.relative_to(ROOT)}  {out.stat().st_size / 1e3:.0f} KB")


def want(name):
    return not only or name in only


# Loops de fondo (hero, film destacado, CTA)
for name, L in EDL["loops"].items():
    if not want(name):
        continue
    print(name)
    w, h = L["size"]
    # Fondos: denoise suave (van bajo un overlay oscuro) + techo de bitrate.
    dn = "hqdn3d=2:1.5:6:5"
    edit(L["segments"], f"{cover(w, h)},{dn}", OUT / "video" / f"{name}.mp4", L["crf"], maxrate=L.get("kbps", 2200))
    sw, sh = L["small"]
    edit(L["segments"], f"{cover(sw, sh)},{dn}", OUT / "video" / f"{name}-sm.mp4", L["crf"] + 1, maxrate=L.get("kbps_sm", 900))
    s0 = L["segments"][0]
    still(SRC[s0[0]], s0[1] + 0.4, cover(w, h), OUT / "img" / f"{name}.webp", 78)
    still(SRC[s0[0]], s0[1] + 0.4, cover(sw, sh), OUT / "img" / f"{name}-sm.webp", 75)

# Films: highlight mudo + preview + póster
for slug, F in EDL["films"].items():
    if not want(slug):
        continue
    print(slug)
    src = F["src"]
    # Highlight: conserva el grano; techo de 3,5 Mbps (sólo se descarga al tocar play).
    edit([[src, a, b] for a, b in F["segments"]], fit_width(1920), OUT / "films" / f"{slug}.mp4", 23, fade=0.4, maxrate=3500)
    a, b = F["preview"]
    edit([[src, a, b]], f"{cover(640, 400)},hqdn3d=2:1.5:6:5", OUT / "films" / f"{slug}-preview.mp4", 28, maxrate=700)
    still(SRC[src], F["poster"], cover(1600, 1000), OUT / "img" / f"{slug}.webp", 80)
    still(SRC[src], F["poster"], cover(800, 500), OUT / "img" / f"{slug}-sm.webp", 78)
    # Open Graph en JPG (WhatsApp/Facebook no siempre aceptan WebP)
    og = OUT / "og" / f"{slug}.jpg"
    run(["-ss", f"{F['poster']}", "-i", SRC[src], "-frames:v", "1", "-vf", cover(1200, 630), "-q:v", "3",
         "-map_metadata", "-1", str(og)])
    print(f"  {og.relative_to(ROOT)}  {og.stat().st_size / 1e3:.0f} KB")

# Fotos (capturas)
for name, file in EDL["stills"].items():
    if not want(name) and not want("stills"):
        continue
    print(name)
    still(str(MAT / file), None, "scale='min(1600,iw)':-2:flags=lanczos", OUT / "img" / f"{name}.webp", 80)
    still(str(MAT / file), None, "scale=800:-2:flags=lanczos", OUT / "img" / f"{name}-sm.webp", 78)
