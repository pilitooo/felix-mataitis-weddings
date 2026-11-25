(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const saveData = navigator.connection?.saveData;

  /* ---------- Header: sólido al scrollear + menú mobile ---------- */
  const header = $(".site-header");
  if (header && !header.classList.contains("site-header--solid")) {
    const onScroll = () => header.classList.toggle("is-solid", window.scrollY > 60);
    onScroll();
    addEventListener("scroll", onScroll, { passive: true });
  }
  const toggle = $(".nav-toggle");
  toggle?.addEventListener("click", () => {
    const open = document.body.classList.toggle("nav-open");
    toggle.setAttribute("aria-expanded", open);
  });

  /* ---------- Filtros de films ---------- */
  const filters = $("[data-filters]");
  filters?.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    $$("button", filters).forEach((b) => b.classList.toggle("is-active", b === btn));
    const val = btn.dataset.filter;
    $$(".film-card").forEach((c) => c.classList.toggle("is-hidden", val !== "all" && c.dataset.category !== val));
  });

  /* ---------- Reproductor con "fachada" ----------
     El iframe de Vimeo/YouTube (~1 MB de JS) se carga sólo al hacer clic. */
  $$(".player[data-video]").forEach((player) => {
    $(".player-btn", player).addEventListener("click", () => {
      const v = JSON.parse(player.dataset.video);
      let el;
      if (v.type === "file") {
        el = Object.assign(document.createElement("video"), { src: v.src, controls: true, autoplay: true, playsInline: true });
      } else {
        el = document.createElement("iframe");
        el.allow = "autoplay; fullscreen; picture-in-picture";
        el.allowFullscreen = true;
        el.title = "Reproductor de video";
        el.src =
          v.type === "vimeo"
            ? `https://player.vimeo.com/video/${v.id}?autoplay=1&dnt=1`
            : `https://www.youtube-nocookie.com/embed/${v.id}?autoplay=1&rel=0`;
      }
      player.appendChild(el);
      player.classList.add("is-playing");
    });
  });

  /* ---------- Videos de fondo: carga diferida ----------
     <video data-src="..." muted loop playsinline preload="none">
     - Se descargan recién cuando están cerca de la pantalla.
     - Se pausan al salir de pantalla (ahorra batería y CPU).
     - No se cargan con "ahorro de datos" ni con movimiento reducido. */
  const bgVideos = $$("video[data-src]");
  if (bgVideos.length && !saveData && !reduceMotion) {
    const vio = new IntersectionObserver(
      (entries) =>
        entries.forEach(({ target: v, isIntersecting }) => {
          if (isIntersecting) {
            if (!v.src) {
              v.src = v.dataset.src;
              v.addEventListener("loadeddata", () => v.classList.add("is-ready"), { once: true });
            }
            v.play().catch(() => {});
          } else if (v.src) {
            v.pause();
          }
        }),
      { rootMargin: "200px 0px" }
    );
    const start = () => bgVideos.forEach((v) => vio.observe(v));
    // No competir con el primer render: arrancar cuando la página ya cargó.
    document.readyState === "complete" ? start() : addEventListener("load", start, { once: true });
  }

  /* ---------- Reveal on scroll ---------- */
  const reveals = $$(".reveal");
  if (reduceMotion || !("IntersectionObserver" in window)) {
    reveals.forEach((el) => el.classList.add("is-visible"));
  } else {
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add("is-visible");
            io.unobserve(en.target);
          }
        }),
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
    );
    reveals.forEach((el) => io.observe(el));
  }

  /* ---------- Formulario (placeholder) ---------- */
  const form = $("[data-contact-form]");
  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    $(".form-note", form).textContent = "Gracias. (Prototipo: el envío todavía no está conectado.)";
  });
})();
