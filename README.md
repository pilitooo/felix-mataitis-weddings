# Felix Mataitis — Wedding Films

Sitio web de presentación de mi trabajo como filmmaker / videomaker de bodas.

## Estructura

```
index.html        Inicio (hero, manifiesto, films destacados, sobre mí, proceso, contacto)
films.html        Portfolio completo con filtros y reproductor
contacto.html     Formulario de consulta
css/styles.css    Estilos
js/films.js       Catálogo de films (acá se cargan los videos)
js/main.js        Interacciones (menú, filtros, lightbox, animaciones)
assets/           Videos y fotos (cuando los tengamos)
```

Sitio estático: no necesita build. Los bloques con gradiente son placeholders de video/foto.

## Ver en local

```bash
python3 -m http.server 8080
```

y abrir http://localhost:8080

## Cargar un film

Editar `js/films.js` y completar `video` (Vimeo, YouTube o archivo) y `poster`.

## Deploy

Cada push a `main` dispara `.github/workflows/deploy.yml`, que publica en **Cloudflare Pages**.
Necesita los secrets `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID` en GitHub.
