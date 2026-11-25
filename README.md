# Felix Mataitis — Wedding Films

Sitio de Felix Mataitis, videógrafo de bodas en Uruguay.

## Estructura

```
src/site.json        Datos del negocio, menú y links SEO del footer
src/films.json       Catálogo de films (genera /films/<slug>/ automáticamente)
src/layout.html      Plantilla común: <head>, metadatos, header y footer
src/pages/*.html     Una página por archivo (front matter JSON + contenido)
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

## Deploy

Cada push a `main` corre `.github/workflows/deploy.yml` → Cloudflare Pages (plan gratuito).

- Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
- Variable: `SITE_URL` (dominio definitivo, para canonical y sitemap)
