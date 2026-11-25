# Felix Mataitis — Wedding Films

Sitio de Felix Mataitis, videógrafo de bodas en Uruguay.

## Estructura

```
src/site.json        Datos del negocio + textos de interfaz por idioma (es / en)
src/films.json       Catálogo de films (genera /films/<slug>/ automáticamente)
src/layout.html      Plantilla común: <head>, metadatos, header y footer
src/pages/*.html     Páginas en español (front matter JSON + contenido)
src/pages/en/*.html  Páginas en inglés ("alt" en el front matter = su par en el otro idioma)
public/              Estáticos: css, js, assets, favicon, _headers, _redirects
scripts/build.mjs    Build sin dependencias → dist/ (+ sitemap.xml y robots.txt)
_material/           Videos originales (no se sube a git)
```

## Desarrollo

```bash
npm run dev
```

Genera `dist/` y lo sirve en http://localhost:8080. Después de editar, volver a correrlo.

## Cargar un film

En `src/films.json` completar:

- `video`: `{ "type": "vimeo", "id": "123" }`, `{ "type": "youtube", "id": "abc" }` o `{ "type": "file", "src": "/assets/videos/x.mp4" }`
- `poster`: `/assets/posters/x.webp` (1600×1000)
- `uploadDate`: `2026-01-15` (activa el schema VideoObject para Google)

## Videos de fondo (hero / secciones)

Originales en `_material/`. Para web: MP4 H.264 sin audio, 1080p, 2–4 Mbps, 8–15 s, `+faststart`, < 4 MB.
Se insertan como `<video data-src="..." muted loop playsinline preload="none">`: se cargan solos al acercarse a la pantalla.

## SEO

- Títulos, descripciones, canonical, Open Graph y Twitter por página
- Schema.org: ProfessionalService, WebSite, BreadcrumbList, FAQPage, Service, VideoObject
- `sitemap.xml` y `robots.txt` generados en cada build
- Landings por zona (enlazadas desde el footer): Montevideo, Punta del Este, Colonia/Carmelo, bodegas, bodas de destino

## Idiomas

Español en `/`, inglés en `/en/`. Cada página declara su par con `"alt"` y el build genera
los `hreflang` recíprocos y el selector ES/EN. Los films se traducen con el bloque `"en"` de `src/films.json`.

## Deploy

Cada push a `main` corre `.github/workflows/deploy.yml` → **GitHub Pages** (gratis, repo público).

- Dominio: `felixmataitis.com` (archivo `public/CNAME`)
- DNS en Namecheap: 4 registros A `@` → 185.199.108–111.153 y CNAME `www` → `pilitooo.github.io`
- Variable opcional `SITE_URL` (por defecto `https://felixmataitis.com`)
