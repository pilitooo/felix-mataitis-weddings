// Build estático sin dependencias, bilingüe (es / en).
//   node scripts/build.mjs            → genera dist/
//   SITE_URL=https://felixmataitis.com node scripts/build.mjs
//
// src/layout.html        plantilla común (head, header, footer)
// src/pages/*.html       páginas en español
// src/pages/en/*.html    páginas en inglés
//   Front matter JSON entre líneas "---". Campos: path, title, description, crumb,
//   alt (ruta de la misma página en el otro idioma), header, priority, schema, faq, jsonld, noindex
// src/films.json         catálogo de films (genera /films/<slug>/ y /en/films/<slug>/)
// src/site.json          datos del negocio + textos de interfaz por idioma
// public/                archivos estáticos copiados tal cual

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const SRC = path.join(ROOT, "src");
const OUT = path.join(ROOT, "dist");
const SITE_URL = (process.env.SITE_URL || "http://localhost:8080").replace(/\/$/, "");
const TODAY = new Date().toISOString().slice(0, 10);

const read = (p) => fs.readFileSync(path.join(SRC, p), "utf8");
const site = JSON.parse(read("site.json"));
const films = JSON.parse(read("films.json"));
const layout = read("layout.html");
const LANGS = Object.keys(site.i18n); // ["es", "en"]

const esc = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const clip = (s, n = 158) => (s.length <= n ? s : s.slice(0, s.lastIndexOf(" ", n - 1)).replace(/[,.;:]$/, "") + "…");
const abs = (p) => (/^https?:/.test(p) ? p : SITE_URL + p);

/* ---------- Assets con hash ---------- */
fs.rmSync(OUT, { recursive: true, force: true });
fs.cpSync(path.join(ROOT, "public"), OUT, { recursive: true });
const hashed = (rel) => {
  const buf = fs.readFileSync(path.join(OUT, rel));
  return `/${rel}?v=${crypto.createHash("sha1").update(buf).digest("hex").slice(0, 10)}`;
};
const cssHref = hashed("css/styles.css");
const jsHref = hashed("js/main.js");

/* ---------- Films por idioma ---------- */
const filmIn = (f, lang) => (lang === "es" ? f : { ...f, ...f.en });

/* ---------- Fragmentos ---------- */
// Imagen responsiva: espera <nombre>.webp (1600px) y <nombre>-sm.webp (800px)
const sm = (src) => src.replace(/\.webp$/, "-sm.webp");
const picture = (src, alt, { sizes = "100vw", eager = false, w = 1600, h = 1000 } = {}) =>
  `<img src="${sm(src)}" srcset="${sm(src)} ${w / 2}w, ${src} ${w}w" sizes="${sizes}" alt="${esc(alt)}" width="${w}" height="${h}" ${
    eager ? 'fetchpriority="high"' : 'loading="lazy"'
  } decoding="async">`;

const media = (f, L, label, opts = {}) =>
  f.poster
    ? picture(f.poster, `${f.title}, ${L.filmAlt} ${f.place}`, { sizes: "(max-width: 600px) 100vw, (max-width: 960px) 50vw, 33vw", ...opts })
    : `<span class="ph-label">${label}</span>`;

// Fondo con video en loop: póster inmediato + video diferido (ver main.js)
// En pantallas < 900 px se usa la versión vertical (-sm), igual que el video en main.js.
const BG_SIZE = { feature: [1920, 820] };
const BG_MOBILE = { hero: [720, 1280], cta: [720, 1280], feature: [720, 900] };
const bg = (name, { eager = false, tone = "" } = {}) => {
  const [w, h] = BG_SIZE[name] || [1920, 1080];
  const [mw, mh] = BG_MOBILE[name] || [w / 2, h / 2];
  return `<div class="ph ${tone ? "ph--" + tone : ""} bg-media">
  <picture>
    <source media="(max-width: 899px)" srcset="/assets/img/${name}-sm.webp" width="${mw}" height="${mh}">
    <img src="/assets/img/${name}.webp" alt="" width="${w}" height="${h}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">
  </picture>
  <video data-src="/assets/video/${name}.mp4" data-src-sm="/assets/video/${name}-sm.mp4" muted loop playsinline preload="none" aria-hidden="true"></video>
</div>`;
};

const card = (f, L, h = "h3") => `
<a class="film-card reveal" href="${L.filmsBase}${f.slug}/" data-category="${f.category}">
  <div class="thumb"${f.preview ? ` data-preview="${f.preview}"` : ""}><div class="ph ${f.tone ? "ph--" + f.tone : ""}">${media(f, L, "Video · 16:10")}</div><span class="play" aria-hidden="true"></span></div>
  <${h}>${esc(f.title)}</${h}>
  <p>${esc(f.place)}</p>
</a>`;

const grid = (list, L, lang, h) =>
  `<div class="films-grid">${list.map((f) => card(filmIn(f, lang), L, h)).join("")}\n</div>`;

const filters = (L) => {
  const used = [...new Set(films.map((f) => f.category))];
  if (used.length < 2) return ""; // con una sola categoría el filtro no aporta
  return `<div class="filters" data-filters role="group" aria-label="${L.filterLabel}">
  <button type="button" class="is-active" data-filter="all">${L.filterAll}</button>
  ${used.map((c) => `<button type="button" data-filter="${c}">${L.categories[c] || c}</button>`).join("\n  ")}
</div>`;
};

const cta = (L, tone = "cool") => `
<section class="cta">
  ${bg("cta", { tone })}
  <div class="wrap reveal">
    <p class="eyebrow">${L.ctaEyebrow}</p>
    <h2 class="display">${L.ctaTitle}</h2>
    <a class="btn btn--light" href="${L.contact}">${L.askDate}</a>
  </div>
</section>`;

const breadcrumbsHtml = (trail) =>
  `<nav class="crumbs" aria-label="Breadcrumb"><ol>${trail
    .map(([name, href], i) =>
      i === trail.length - 1 ? `<li aria-current="page">${esc(name)}</li>` : `<li><a href="${href}">${esc(name)}</a></li>`
    )
    .join("")}</ol></nav>`;

const faqHtml = (faq) =>
  `<div class="faq">${faq
    .map((x) => `<details class="reveal"><summary>${esc(x.q)}</summary><div><p>${x.a}</p></div></details>`)
    .join("\n")}</div>`;

/* ---------- Schema.org ---------- */
const businessId = `${SITE_URL}/#negocio`;
const business = (L) => ({
  "@context": "https://schema.org",
  "@type": "ProfessionalService",
  "@id": businessId,
  name: site.brand,
  alternateName: site.name,
  description: L.description,
  url: SITE_URL + "/",
  image: abs(site.defaultOgImage),
  email: site.email,
  telephone: site.whatsapp,
  priceRange: "$$$",
  address: { "@type": "PostalAddress", addressCountry: site.country },
  areaServed: site.areaServed.map((n) =>
    n === "Uruguay" ? { "@type": "Country", name: n } : { "@type": "City", name: n }
  ),
  founder: { "@type": "Person", name: site.name, jobTitle: L.jobTitle, image: abs("/assets/img/felix.webp"), sameAs: [site.instagram] },
  knowsAbout: ["Video de bodas", "Wedding videography", "Filmación de casamientos", "Destination weddings", "Elopements"],
  availableLanguage: ["es", "en"],
  sameAs: [site.instagram],
});
const website = (L) => ({
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${SITE_URL}/#web`,
  url: SITE_URL + "/",
  name: site.brand,
  inLanguage: ["es-UY", "en"],
  publisher: { "@id": businessId },
});
const breadcrumbLd = (trail) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: trail.map(([name, href], i) => ({ "@type": "ListItem", position: i + 1, name, item: abs(href) })),
});
const faqLd = (faq) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faq.map((x) => ({
    "@type": "Question",
    name: x.q,
    acceptedAnswer: { "@type": "Answer", text: x.a.replace(/<[^>]+>/g, "") },
  })),
});
const ld = (objs) =>
  objs.map((o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, "\\u003c")}</script>`).join("\n  ");

/* ---------- Render ---------- */
const pages = [];

function render(fm, body) {
  const lang = fm.lang || "es";
  const L = site.i18n[lang];
  const isHome = fm.path === L.home;
  const is404 = fm.path === "/404";
  const trail = isHome ? [] : [[L.homeCrumb, L.home], ...(fm.parent ? [fm.parent] : []), [fm.crumb || fm.title, fm.path]];
  const canonical = abs(is404 ? "/" : fm.path);

  // hreflang: la página en su idioma + su par en el otro idioma
  const alts = { [lang]: fm.path };
  if (fm.alt) alts[lang === "es" ? "en" : "es"] = fm.alt;
  const hreflang = is404
    ? ""
    : Object.entries(alts)
        .map(([k, p]) => `<link rel="alternate" hreflang="${site.i18n[k].lang}" href="${abs(p)}">`)
        .concat(`<link rel="alternate" hreflang="x-default" href="${abs(alts.es || fm.path)}">`)
        .join("\n  ");
  const otherLang = lang === "es" ? "en" : "es";
  const switchHref = alts[otherLang] || site.i18n[otherLang].home;
  const langSwitch = `<a class="lang-switch" href="${switchHref}" hreflang="${site.i18n[otherLang].lang}" lang="${site.i18n[otherLang].lang}" title="${site.i18n[otherLang].langName}">${site.i18n[otherLang].label}</a>`;

  let content = body
    .replace(/\{\{films:featured\}\}/g, () => grid(films.filter((f) => f.featured), L, lang, "h3"))
    .replace(/\{\{films:all\}\}/g, () => grid(films, L, lang, "h2"))
    .replace(/\{\{films:cat:(\w+)\}\}/g, (_, c) => grid(films.filter((f) => f.category === c).slice(0, 3), L, lang, "h3"))
    .replace(/\{\{films:place:([^}]+)\}\}/g, (_, q) => {
      const terms = q.split("|");
      const list = films.filter((f) => terms.some((t) => f.place.includes(t))).slice(0, 3);
      return grid(list.length ? list : films.filter((f) => f.featured), L, lang, "h3");
    })
    .replace(/\{\{bg:(\w+)(:eager)?\}\}/g, (_, n, e) => bg(n, { eager: !!e }))
    // {{img:nombre:texto alternativo}} o {{img:nombre:texto|ancho:alto}}
    .replace(/\{\{img:([\w-]+):([^}|]*)(?:\|(\d+):(\d+))?\}\}/g, (_, n, alt, w, h) =>
      picture(`/assets/img/${n}.webp`, alt, {
        sizes: "(max-width: 860px) 100vw, 50vw",
        ...(w && { w: +w, h: +h }),
      })
    )
    .replace(/\{\{filters\}\}/g, () => filters(L))
    .replace(/\{\{cta(?::(\w+))?\}\}/g, (_, t) => cta(L, t))
    .replace(/\{\{breadcrumbs\}\}/g, () => breadcrumbsHtml(trail))
    .replace(/\{\{faq\}\}/g, () => faqHtml(fm.faq || []))
    .replace(/\{\{site\.(\w+)\}\}/g, (_, k) => esc(site[k]));

  const schema = [];
  if (fm.schema?.includes("website")) schema.push(website(L));
  if (fm.schema?.includes("business")) schema.push(business(L));
  if (fm.faq?.length) schema.push(faqLd(fm.faq));
  if (fm.jsonld) schema.push(...JSON.parse(JSON.stringify(fm.jsonld).replaceAll("{{SITE}}", SITE_URL)));
  if (!isHome && !is404) schema.push(breadcrumbLd(trail));

  const nav = L.nav
    .map((n) => {
      const active = n.href === L.home ? isHome : fm.path.startsWith(n.href);
      return `        <a href="${n.href}"${active ? ' aria-current="page"' : ""}>${n.label}</a>`;
    })
    .join("\n");
  const linkList = (list) => list.map((n) => `        <a href="${n.href}">${esc(n.label)}</a>`).join("\n");

  const vars = {
    lang: L.lang,
    locale: L.locale,
    localeAlt: site.i18n[otherLang].locale,
    title: esc(fm.title),
    ogTitle: esc(fm.ogTitle || fm.title),
    description: esc(fm.description),
    robots: fm.noindex ? "noindex, follow" : "index, follow, max-image-preview:large, max-video-preview:-1",
    canonical,
    hreflang,
    ogType: fm.ogType || (isHome ? "website" : "article"),
    ogImage: abs(fm.ogImage || site.defaultOgImage),
    siteName: esc(site.name),
    brand: esc(site.brand),
    brandSmall: L.brandSmall,
    home: L.home,
    skip: L.skip,
    menu: L.menu,
    email: esc(site.email),
    instagram: esc(site.instagram),
    instagramHandle: esc(site.instagramHandle),
    whatsapp: esc(site.whatsapp),
    whatsappLink: esc(site.whatsappLink),
    headerClass: fm.header === "hero" ? "" : " site-header--solid",
    head: fm.head || "",
    jsonld: ld(schema),
    nav,
    langSwitch,
    footerBlurb: L.footerBlurb,
    footerSections: L.footerSections,
    footerSeoTitle: L.footerSeoTitle,
    footerContact: L.footerContact,
    footerNav: linkList(L.nav),
    footerSeo: linkList(L.footerSeo),
    contact: L.contact,
    askDate: L.askDate,
    copyright: L.copyright,
    cssHref,
    jsHref,
    year: new Date().getFullYear(),
    content,
  };
  const html = layout.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? vars[k] : m));

  const file = is404 ? "404.html" : path.join(fm.path, "index.html");
  const dest = path.join(OUT, file);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, html);
  if (!fm.noindex && !is404) pages.push({ loc: abs(fm.path), priority: fm.priority ?? 0.6 });
}

/* ---------- Páginas de src/pages (y src/pages/en) ---------- */
const pageFiles = (dir) =>
  fs.readdirSync(path.join(SRC, dir), { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? pageFiles(path.join(dir, d.name)) : d.name.endsWith(".html") ? [path.join(dir, d.name)] : []
  );
const seenPaths = new Set();
for (const file of pageFiles("pages").sort()) {
  const m = read(file).match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error(`Falta el front matter en ${file}`);
  const fm = JSON.parse(m[1]);
  fm.lang ||= file.startsWith(path.join("pages", "en")) ? "en" : "es";
  if (seenPaths.has(fm.path)) throw new Error(`Ruta duplicada: ${fm.path}`);
  seenPaths.add(fm.path);
  render(fm, m[2]);
}

/* ---------- Una página por film y por idioma ---------- */
for (const lang of LANGS) {
  const L = site.i18n[lang];
  for (const raw of films) {
    const f = filmIn(raw, lang);
    const others = films.filter((x) => x !== raw);
    const related = [...others.filter((x) => x.category === raw.category), ...others]
      .filter((x, i, a) => a.indexOf(x) === i)
      .slice(0, 3);
    const kind = L.kinds[f.category];
    const where = lang === "es" ? "en" : "in";
    const jsonld = [];
    if (f.video && f.poster && f.uploadDate) {
      jsonld.push({
        "@context": "https://schema.org",
        "@type": "VideoObject",
        name: `${f.title} — ${kind} ${where} ${f.place}`,
        description: f.summary,
        thumbnailUrl: abs(f.poster),
        uploadDate: f.uploadDate,
        ...(f.duration && { duration: f.duration }),
        inLanguage: L.lang,
        ...(f.video.type === "vimeo" && { embedUrl: `https://player.vimeo.com/video/${f.video.id}` }),
        ...(f.video.type === "youtube" && { embedUrl: `https://www.youtube.com/embed/${f.video.id}` }),
        ...(f.video.type === "file" && { contentUrl: abs(f.video.src) }),
        publisher: { "@id": "{{SITE}}/#negocio" },
      });
    }
    const body = `
<section class="page-head page-head--film">
  <div class="wrap">
    {{breadcrumbs}}
    <p class="eyebrow">${kind} · ${esc(f.place)}</p>
    <h1 class="display">${esc(f.title)}</h1>
  </div>
</section>

<section class="wrap">
  <div class="player" ${f.video ? `data-video='${esc(JSON.stringify(f.video))}'` : ""}>
    <div class="ph ${f.tone ? "ph--" + f.tone : ""}">${media(f, L, f.video ? "Film" : L.filmSoon, { eager: true, sizes: "(max-width: 1240px) 100vw, 1240px" })}</div>
    <button class="player-btn" type="button" aria-label="${L.play} ${esc(f.title)}"><span class="play" aria-hidden="true"></span></button>
  </div>
</section>

<section class="section--tight">
  <div class="wrap film-body">
    <div class="prose reveal">
      <p class="lead">${esc(f.summary)}</p>
      <p>${esc(f.story)}</p>
    </div>
    <dl class="film-meta reveal">
      <dt>${L.meta.place}</dt><dd>${esc(f.place)}</dd>
      <dt>${L.meta.venue}</dt><dd>${esc(f.venue)}</dd>
      <dt>${L.meta.season}</dt><dd>${esc(f.season)}</dd>
      <dt>${L.meta.type}</dt><dd>${L.categories[f.category] || f.category}</dd>
    </dl>
  </div>
</section>

<section class="section--tight section--deep">
  <div class="wrap">
    <h2 class="display display--sm center reveal section-head">${L.more}</h2>
    ${grid(related, L, lang, "h3")}
  </div>
</section>
{{cta:warm}}`;
    const t = `${f.title} · ${kind} ${where} ${f.place}`;
    render(
      {
        lang,
        path: `${L.filmsBase}${f.slug}/`,
        alt: `${site.i18n[lang === "es" ? "en" : "es"].filmsBase}${f.slug}/`,
        title: t.length + site.name.length + 3 <= 60 ? `${t} | ${site.name}` : t,
        ogTitle: `${f.title} — ${kind} ${where} ${f.place}`,
        description: clip(`${f.summary} ${L.filmDescSuffix}`),
        crumb: f.title,
        parent: ["Films", L.filmsBase],
        ogType: f.video ? "video.other" : "article",
        ogImage: f.poster ? `/assets/og/${f.slug}.jpg` : undefined,
        priority: 0.5,
        jsonld,
      },
      body
    );
  }
}

/* ---------- sitemap.xml (con alternates hreflang) y robots.txt ---------- */
fs.writeFileSync(
  path.join(OUT, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages
  .sort((a, b) => b.priority - a.priority)
  .map((p) => `  <url><loc>${p.loc}</loc><lastmod>${TODAY}</lastmod><priority>${p.priority.toFixed(1)}</priority></url>`)
  .join("\n")}
</urlset>
`
);
fs.writeFileSync(path.join(OUT, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);

console.log(`✓ ${pages.length} páginas indexables → dist/ (SITE_URL=${SITE_URL})`);
