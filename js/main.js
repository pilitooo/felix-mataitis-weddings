(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  /* ---------- Header: sólido al scrollear + menú mobile ---------- */
  const header = $(".site-header");
  if (header && !header.classList.contains("site-header--dark")) {
    const onScroll = () => header.classList.toggle("is-solid", window.scrollY > 60);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }
  const toggle = $(".nav-toggle");
  if (toggle) {
    toggle.addEventListener("click", () => {
      const open = document.body.classList.toggle("nav-open");
      toggle.setAttribute("aria-expanded", open);
    });
    $$(".nav a").forEach((a) => a.addEventListener("click", () => document.body.classList.remove("nav-open")));
  }

  /* ---------- Render de films ---------- */
  const films = window.FILMS || [];
  const cats = window.FILM_CATEGORIES || {};

  const thumb = (f) => {
    const media = f.poster ? `<img src="${f.poster}" alt="" loading="lazy">` : `<span class="ph-label">Video · 16:10</span>`;
    return `<div class="thumb"><div class="ph ${f.tone ? "ph--" + f.tone : ""}">${media}</div><span class="play" aria-hidden="true"></span></div>`;
  };

  const card = (f, i) => `
    <button class="film-card reveal" data-index="${i}" data-category="${f.category}" aria-label="Ver film de ${f.title}">
      ${thumb(f)}
      <h3>${f.title}</h3>
      <p>${f.place}</p>
    </button>`;

  $$("[data-films]").forEach((grid) => {
    const onlyFeatured = grid.dataset.films === "featured";
    grid.innerHTML = films
      .map((f, i) => (onlyFeatured && !f.featured ? "" : card(f, i)))
      .join("");
  });

  /* ---------- Filtros ---------- */
  const filters = $("[data-filters]");
  if (filters) {
    const used = [...new Set(films.map((f) => f.category))];
    filters.innerHTML =
      `<button class="is-active" data-filter="all">Todos</button>` +
      used.map((c) => `<button data-filter="${c}">${cats[c] || c}</button>`).join("");
    filters.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      $$("button", filters).forEach((b) => b.classList.toggle("is-active", b === btn));
      const val = btn.dataset.filter;
      $$(".film-card").forEach((c) => c.classList.toggle("is-hidden", val !== "all" && c.dataset.category !== val));
    });
  }

  /* ---------- Lightbox ---------- */
  const lb = document.createElement("div");
  lb.className = "lightbox";
  lb.setAttribute("role", "dialog");
  lb.setAttribute("aria-modal", "true");
  lb.innerHTML = `<button class="lightbox-close">Cerrar ✕</button><div><div class="lightbox-frame"></div><div class="lightbox-title"></div></div>`;
  document.body.appendChild(lb);
  const frame = $(".lightbox-frame", lb);
  const title = $(".lightbox-title", lb);

  const embed = (v) => {
    if (!v) return `<div class="ph"><span>Acá va el film</span></div>`;
    if (v.type === "vimeo") return `<iframe src="https://player.vimeo.com/video/${v.id}?autoplay=1&dnt=1" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`;
    if (v.type === "youtube") return `<iframe src="https://www.youtube-nocookie.com/embed/${v.id}?autoplay=1&rel=0" allow="autoplay; fullscreen" allowfullscreen></iframe>`;
    if (v.type === "file") return `<video src="${v.src}" controls autoplay playsinline></video>`;
    return "";
  };

  const open = (f) => {
    frame.innerHTML = embed(f.video);
    title.textContent = `${f.title} — ${f.place}`;
    lb.classList.add("is-open");
    document.body.style.overflow = "hidden";
  };
  const close = () => {
    lb.classList.remove("is-open");
    document.body.style.overflow = "";
    setTimeout(() => (frame.innerHTML = ""), 400);
  };

  document.addEventListener("click", (e) => {
    const c = e.target.closest(".film-card, [data-film]");
    if (c) {
      e.preventDefault();
      const i = c.dataset.index ?? c.dataset.film;
      if (films[i]) open(films[i]);
    }
  });
  lb.addEventListener("click", (e) => {
    if (e.target === lb || e.target.closest(".lightbox-close")) close();
  });
  document.addEventListener("keydown", (e) => e.key === "Escape" && close());

  /* ---------- Reveal on scroll ---------- */
  const io = new IntersectionObserver(
    (entries) => entries.forEach((en) => {
      if (en.isIntersecting) {
        en.target.classList.add("is-visible");
        io.unobserve(en.target);
      }
    }),
    { threshold: 0.12 }
  );
  $$(".reveal").forEach((el) => io.observe(el));

  /* ---------- Formulario (placeholder) ---------- */
  const form = $("[data-contact-form]");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const note = $(".form-note", form);
      note.textContent = "Gracias. (Prototipo: el envío todavía no está conectado.)";
    });
  }

  /* Año en el footer */
  $$("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));
})();
