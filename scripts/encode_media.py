#!/usr/bin/env python3
"""Genera los videos e imágenes del sitio a partir de _material/ según scripts/media.json.

  python3 scripts/encode_media.py            # todo
  python3 scripts/encode_media.py hero cami-ramiro   # sólo algunos

Salida en public/assets/:
  video/<nombre>.mp4 (+ -sm.mp4)    loops de fondo (-sm = versión vertical para celular)
  films/<slug>.mp4                  highlight mudo de cada boda (1080p)
  films/<slug>-preview.mp4          loop corto 960px para el hover de las tarjetas
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

# preset slower + tune film: mejor reparto de bits en material con grano y cortes rápidos.
# aq-mode 3 cuida las zonas oscuras (fiestas de noche), que eran las que más se pixelaban.
H264 = ["-c:v", "libx264", "-preset", "slower", "-tune", "film", "-profile:v", "high", "-pix_fmt", "yuv420p",
        "-x264-params", "aq-mode=3:aq-strength=0.9",
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
    # Denoise muy suave: sólo saca el ruido fino que se come los bits, sin lavar la imagen.
    dn = "hqdn3d=1:1:3:3"
    edit(L["segments"], f"{cover(w, h)},{dn}", OUT / "video" / f"{name}.mp4", L["crf"], maxrate=L.get("kbps", 4500))
    # Celular: versión con el formato de la pantalla (vertical), recortada del original.
    # Antes era horizontal y el navegador estiraba una franja angosta → pixelado.
    sw, sh = L["mobile"]
    edit(L["segments"], f"{cover(sw, sh)},{dn}", OUT / "video" / f"{name}-sm.mp4", L["crf"] + 1, maxrate=L.get("kbps_sm", 2000))
    s0 = L["segments"][0]
    still(SRC[s0[0]], s0[1] + 0.4, cover(w, h), OUT / "img" / f"{name}.webp", 82)
    still(SRC[s0[0]], s0[1] + 0.4, cover(sw, sh), OUT / "img" / f"{name}-sm.webp", 80)

# Films: highlight mudo + preview + póster
for slug, F in EDL["films"].items():
    if not want(slug):
        continue
    print(slug)
    src = F["src"]
    # Highlight: conserva el grano; hasta 8 Mbps (sólo se descarga al tocar play).
    edit([[src, a, b] for a, b in F["segments"]], fit_width(1920), OUT / "films" / f"{slug}.mp4", 20, fade=0.4, maxrate=8000)
    a, b = F["preview"]
    # Preview del hover: 960 px para pantallas retina.
    edit([[src, a, b]], f"{cover(960, 600)},hqdn3d=1:1:3:3", OUT / "films" / f"{slug}-preview.mp4", 23, maxrate=1800)
    still(SRC[src], F["poster"], cover(1600, 1000), OUT / "img" / f"{slug}.webp", 80)
    still(SRC[src], F["poster"], cover(800, 500), OUT / "img" / f"{slug}-sm.webp", 78)
    # Open Graph en JPG (WhatsApp/Facebook no siempre aceptan WebP)
    og = OUT / "og" / f"{slug}.jpg"
    run(["-ss", f"{F['poster']}", "-i", SRC[src], "-frames:v", "1", "-vf", cover(1200, 630), "-q:v", "3",
         "-map_metadata", "-1", str(og)])
    print(f"  {og.relative_to(ROOT)}  {og.stat().st_size / 1e3:.0f} KB")

# Fotos (capturas)
for name, spec in EDL["stills"].items():
    if not want(name) and not want("stills"):
        continue
    print(name)
    # spec: "archivo.jpg" o {"file": ..., "crop": "w:h:x:y", "width": 1200}
    if isinstance(spec, str):
        spec = {"file": spec}
    pre = f"crop={spec['crop']}," if "crop" in spec else ""
    w = spec.get("width", 1600)
    still(str(MAT / spec["file"]), None, f"{pre}scale='min({w},iw)':-2:flags=lanczos", OUT / "img" / f"{name}.webp", 82)
    still(str(MAT / spec["file"]), None, f"{pre}scale={w // 2}:-2:flags=lanczos", OUT / "img" / f"{name}-sm.webp", 80)

# Rollo "La historia, cuadro a cuadro" (src/frames.json): cuadros de varias bodas
FR = json.loads((ROOT / "src" / "frames.json").read_text())
if want("frames"):
    print("frames")
    for i, it in enumerate(FR["items"], 1):
        base = OUT / "frames" / f"{i:02d}"
        for suffix, w, h, q in (("", 960, 540, 82), ("-sm", 560, 315, 80)):
            still(SRC[it["src"]], it["t"], cover(w, h), base.with_name(base.name + suffix + ".webp"), q)
