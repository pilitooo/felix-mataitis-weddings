// Build estático sin dependencias.
//   node scripts/build.mjs            → genera dist/
//   SITE_URL=https://dominio.uy node scripts/build.mjs
//
// src/layout.html      plantilla común (head, header, footer)
// src/pages/*.html     páginas: front matter JSON entre líneas "---" + contenido
// src/films.json       catálogo de films (genera /films/<slug>/)
// src/site.json        datos del negocio, menú y links SEO del footer
// public/              archivos estáticos copiados tal cual

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

const esc = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const clip = (s, n = 158) => (s.length <= n ? s : s.slice(0, s.lastIndexOf(" ", n - 1)).replace(/[,.;:]$/, "") + "…");
const abs = (p) => (/^https?:/.test(p) ? p : SITE_URL + p);

/* ---------- Assets con hash para cache largo ---------- */
fs.rmSync(OUT, { recursive: true, force: true });
fs.cpSync(path.join(ROOT, "public"), OUT, { recursive: true });
const hashed = (rel) => {
  const buf = fs.readFileSync(path.join(OUT, rel));
  return `/${rel}?v=${crypto.createHash("sha1").update(buf).digest("hex").slice(0, 10)}`;
};
const cssHref = hashed("css/styles.css");
const jsHref = hashed("js/main.js");

/* ---------- Fragmentos ---------- */
const CATEGORIES = { boda: "Bodas", elopement: "Elopement", preboda: "Preboda", destino: "Destino" };

const media = (f, label) =>
  f.poster
    ? `<img src="${esc(f.poster)}" alt="${esc(`${f.title}, video de boda en ${f.place}`)}" width="1600" height="1000" loading="lazy" decoding="async">`
    : `<span class="ph-label">${label}</span>`;

const card = (f, h = "h3") => `
<a class="film-card reveal" href="/films/${f.slug}/" data-category="${f.category}">
  <div class="thumb"><div class="ph ${f.tone ? "ph--" + f.tone : ""}">${media(f, "Video · 16:10")}</div><span class="play" aria-hidden="true"></span></div>
  <${h}>${esc(f.title)}</${h}>
  <p>${esc(f.place)}</p>
</a>`;

const grid = (list, h) => `<div class="films-grid">${list.map((f) => card(f, h)).join("")}\n</div>`;

const filters = () => {
  const used = [...new Set(films.map((f) => f.category))];
  return `<div class="filters" data-filters role="group" aria-label="Filtrar films">
  <button type="button" class="is-active" data-filter="all">Todos</button>
  ${used.map((c) => `<button type="button" data-filter="${c}">${CATEGORIES[c] || c}</button>`).join("\n  ")}
</div>`;
};

const cta = (tone = "cool") => `
<section class="cta">
  <div class="ph ph--${tone}"><span class="ph-label">Fondo · video loop</span></div>
  <div class="wrap reveal">
    <p class="eyebrow">Fechas disponibles</p>
    <h2 class="display">¿Hablamos de su <em>casamiento</em>?</h2>
    <a class="btn btn--light" href="/contacto/">Consultar fecha</a>
  </div>
</section>`;

const breadcrumbsHtml = (trail) =>
  `<nav class="crumbs" aria-label="Ruta"><ol>${trail
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
const business = {
  "@context": "https://schema.org",
  "@type": "ProfessionalService",
  "@id": businessId,
  name: site.brand,
  alternateName: site.name,
  description: site.description,
  url: SITE_URL + "/",
  image: abs(site.defaultOgImage),
  email: site.email,
  telephone: site.whatsapp,
  priceRange: "$$$",
  address: { "@type": "PostalAddress", addressCountry: site.country },
  areaServed: site.areaServed.map((n) =>
    n === "Uruguay" ? { "@type": "Country", name: n } : { "@type": "City", name: n }
  ),
  founder: { "@type": "Person", name: site.name, jobTitle: "Videógrafo de bodas" },
  knowsAbout: ["Video de bodas", "Filmación de casamientos", "Videografía de bodas", "Bodas de destino", "Elopements"],
  sameAs: [site.instagram],
};
const website = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${SITE_URL}/#web`,
  url: SITE_URL + "/",
  name: site.brand,
  inLanguage: site.lang,
  publisher: { "@id": businessId },
};
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

/* ---------- Render de una página ---------- */
const pages = [];

function render(fm, body) {
  const isHome = fm.path === "/";
  const trail = isHome ? [] : [["Inicio", "/"], ...(fm.parent ? [fm.parent] : []), [fm.crumb || fm.h || fm.title, fm.path]];
  const canonical = abs(fm.path === "/404" ? "/" : fm.path);

  let content = body
    .replace(/\{\{films:featured\}\}/g, () => grid(films.filter((f) => f.featured), "h3"))
    .replace(/\{\{films:all\}\}/g, () => grid(films, "h2"))
    .replace(/\{\{films:cat:(\w+)\}\}/g, (_, c) => grid(films.filter((f) => f.category === c).slice(0, 3), "h3"))
    .replace(/\{\{films:place:([^}]+)\}\}/g, (_, q) => {
      const terms = q.split("|");
      const list = films.filter((f) => terms.some((t) => f.place.includes(t))).slice(0, 3);
      return grid(list.length ? list : films.filter((f) => f.featured), "h3");
    })
    .replace(/\{\{filters\}\}/g, filters)
    .replace(/\{\{cta(?::(\w+))?\}\}/g, (_, t) => cta(t))
    .replace(/\{\{breadcrumbs\}\}/g, () => breadcrumbsHtml(trail))
    .replace(/\{\{faq\}\}/g, () => faqHtml(fm.faq || []))
    .replace(/\{\{site\.(\w+)\}\}/g, (_, k) => esc(site[k]));

  const schema = [];
  if (fm.schema?.includes("website")) schema.push(website);
  if (fm.schema?.includes("business")) schema.push(business);
  if (fm.faq?.length) schema.push(faqLd(fm.faq));
  if (fm.jsonld) schema.push(...JSON.parse(JSON.stringify(fm.jsonld).replaceAll("{{SITE}}", SITE_URL)));
  if (!isHome && fm.path !== "/404") schema.push(breadcrumbLd(trail));

  const nav = site.nav
    .map((n) => {
      const active = n.href === "/" ? isHome : fm.path.startsWith(n.href);
      return `        <a href="${n.href}"${active ? ' aria-current="page"' : ""}>${n.label}</a>`;
    })
    .join("\n");
  const linkList = (list) => list.map((n) => `        <a href="${n.href}">${esc(n.label)}</a>`).join("\n");

  const vars = {
    lang: site.lang,
    locale: site.locale,
    title: esc(fm.title),
    ogTitle: esc(fm.ogTitle || fm.title),
    description: esc(fm.description),
    robots: fm.noindex ? "noindex, follow" : "index, follow, max-image-preview:large, max-video-preview:-1",
    canonical,
    ogType: fm.ogType || (isHome ? "website" : "article"),
    ogImage: abs(fm.ogImage || site.defaultOgImage),
    siteName: esc(site.name),
    brand: esc(site.brand),
    email: esc(site.email),
    instagram: esc(site.instagram),
    headerClass: fm.header === "hero" ? "" : " site-header--solid",
    head: fm.head || "",
    jsonld: ld(schema),
    nav,
    footerNav: linkList(site.nav),
    footerSeo: linkList(site.footerSeo),
    cssHref,
    jsHref,
    year: new Date().getFullYear(),
    content,
  };
  const html = layout.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? vars[k] : m));

  const file = fm.path === "/404" ? "404.html" : path.join(fm.path, "index.html");
  const dest = path.join(OUT, file);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, html);
  if (!fm.noindex && fm.path !== "/404") pages.push({ loc: abs(fm.path), priority: fm.priority ?? 0.6 });
}

/* ---------- Páginas de src/pages ---------- */
for (const name of fs.readdirSync(path.join(SRC, "pages")).filter((n) => n.endsWith(".html")).sort()) {
  const raw = read(path.join("pages", name));
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error(`Falta el front matter en ${name}`);
  render(JSON.parse(m[1]), m[2]);
}

/* ---------- Una página por film ---------- */
for (const f of films) {
  const others = films.filter((x) => x !== f);
  const related = [...others.filter((x) => x.category === f.category), ...others].filter((x, i, a) => a.indexOf(x) === i).slice(0, 3);
  const kind = { boda: "Video de boda", elopement: "Elopement", preboda: "Video preboda", destino: "Boda de destino" }[f.category];
  const jsonld = [];
  if (f.video && f.poster && f.uploadDate) {
    jsonld.push({
      "@context": "https://schema.org",
      "@type": "VideoObject",
      name: `${f.title} — ${kind} en ${f.place}`,
      description: f.summary,
      thumbnailUrl: abs(f.poster),
      uploadDate: f.uploadDate,
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
    <div class="ph ${f.tone ? "ph--" + f.tone : ""}">${media(f, f.video ? "Film" : "Film · próximamente")}</div>
    <button class="player-btn" type="button" aria-label="Reproducir el film de ${esc(f.title)}"><span class="play" aria-hidden="true"></span></button>
  </div>
</section>

<section class="section--tight">
  <div class="wrap film-body">
    <div class="prose reveal">
      <p class="lead">${esc(f.summary)}</p>
      <p>${esc(f.story)}</p>
    </div>
    <dl class="film-meta reveal">
      <dt>Lugar</dt><dd>${esc(f.place)}</dd>
      <dt>Locación</dt><dd>${esc(f.venue)}</dd>
      <dt>Temporada</dt><dd>${esc(f.season)}</dd>
      <dt>Tipo</dt><dd>${CATEGORIES[f.category] || f.category}</dd>
    </dl>
  </div>
</section>

<section class="section--tight section--deep">
  <div class="wrap">
    <h2 class="display display--sm center reveal">Más films</h2>
    ${grid(related, "h3")}
  </div>
</section>
{{cta:warm}}`;
  const tmp = { jsonld };
  render(
    {
      path: `/films/${f.slug}/`,
      title: ((t) => (t.length + site.name.length + 3 <= 60 ? `${t} | ${site.name}` : t))(`${f.title} · ${kind} en ${f.place}`),
      ogTitle: `${f.title} — ${kind} en ${f.place}`,
      description: clip(`${f.summary} Film de ${site.name}, videógrafo de bodas en Uruguay.`),
      crumb: f.title,
      parent: ["Films", "/films/"],
      ogType: f.video ? "video.other" : "article",
      ogImage: f.poster || undefined,
      priority: 0.5,
      ...tmp,
    },
    body
  );
}

/* ---------- sitemap.xml y robots.txt ---------- */
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
