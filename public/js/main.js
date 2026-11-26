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
  const setNav = (open) => {
    document.body.classList.toggle("nav-open", open);
    toggle?.setAttribute("aria-expanded", open);
  };
  toggle?.addEventListener("click", () => setNav(!document.body.classList.contains("nav-open")));
  $$(".nav a").forEach((a) => a.addEventListener("click", () => setNav(false)));
  addEventListener("keydown", (e) => e.key === "Escape" && setNav(false));
  matchMedia("(min-width: 761px)").addEventListener("change", (e) => e.matches && setNav(false));

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
        // Los highlights son mudos: muted garantiza que el autoplay no se bloquee.
        el = Object.assign(document.createElement("video"), { src: v.src, controls: true, autoplay: true, muted: true, loop: true, playsInline: true });
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
          v._onScreen = isIntersecting;
          if (isIntersecting) {
            if (!v.src) {
              // Pantallas < 900 px: versión vertical (mismo corte que el <picture> del build)
              // autoplay nativo (muted + playsinline): el navegador lo arranca apenas tiene datos.
              v.autoplay = true;
              v.src = (matchMedia("(max-width: 899px)").matches && v.dataset.srcSm) || v.dataset.src;
              // En celulares play() falla si se pide antes de que haya datos: reintentar al cargar.
              v.addEventListener("loadeddata", () => {
                v.classList.add("is-ready");
                if (v._onScreen) v.play().catch(() => {});
              }, { once: true });
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

  /* ---------- Preview de films al pasar el mouse ----------
     Sólo en dispositivos con mouse; el clip (~300 KB) se descarga recién al primer hover. */
  if (matchMedia("(hover: hover) and (pointer: fine)").matches && !saveData && !reduceMotion) {
    $$(".thumb[data-preview]").forEach((thumb) => {
      let v;
      thumb.addEventListener("pointerenter", () => {
        if (!v) {
          v = Object.assign(document.createElement("video"), { muted: true, loop: true, playsInline: true, className: "preview" });
          v.setAttribute("aria-hidden", "true");
          v.src = thumb.dataset.preview;
          $(".ph", thumb).appendChild(v);
        }
        thumb.classList.add("is-previewing");
        v.play().catch(() => {});
      });
      thumb.addEventListener("pointerleave", () => {
        thumb.classList.remove("is-previewing");
        v?.pause();
      });
    });
  }

  /* ---------- Rollo de película ----------
     Rollo infinito (los cuadros se duplican una vez). Avanza solo y lento mientras
     está en pantalla; se pausa con el mouse encima; se arrastra con inercia;
     en celular usa el deslizamiento nativo. Flechas y botones avanzan un cuadro. */
  $$("[data-reel]").forEach((root) => {
    const track = $(".reel-track", root);
    const list = $(".reel-frames", root);
    [...list.children].forEach((li) => {
      const c = li.cloneNode(true);
      c.setAttribute("aria-hidden", "true");
      $$("a", c).forEach((a) => (a.tabIndex = -1));
      list.appendChild(c);
    });

    const half = () => list.scrollWidth / 2;
    const frameW = () => list.children[0].getBoundingClientRect().width + 10;
    let pos = 1;
    const setPos = (p) => {
      const h = half();
      if (p >= h) p -= h;
      if (p < 1) p += h;
      pos = p;
      track.scrollLeft = p;
    };

    // Arranca con el cuadro 01 entero y el último asomando a la izquierda
    requestAnimationFrame(() => setPos(half() - track.clientWidth * 0.08));

    let visible = false, hovering = false, dragging = false;
    let vel = 0, resumeAt = 0, anim = null, last = performance.now();
    const SPEED = 0.6; // px por cuadro de animación (~36 px/s)
    const rest = () => (resumeAt = performance.now() + 2500);

    const tick = (now) => {
      const dt = Math.min(50, now - last);
      last = now;
      if (visible && !dragging) {
        if (anim) {
          const k = Math.min(1, (now - anim.start) / anim.dur);
          const e = 1 - Math.pow(1 - k, 3);
          setPos(anim.from + (anim.to - anim.from) * e);
          if (k === 1) anim = null;
        } else if (Math.abs(vel) > 0.02) {
          setPos(pos + vel * dt);
          vel *= Math.pow(0.95, dt / 16);
        } else if (!reduceMotion && !hovering && now > resumeAt) {
          setPos(pos + (SPEED * dt) / 16);
        }
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    // Scroll del usuario (trackpad, dedo): sincronizar y pausar el avance
    track.addEventListener("scroll", () => {
      if (Math.abs(track.scrollLeft - pos) > 2) {
        pos = track.scrollLeft;
        if (pos >= half() || pos < 1) setPos(pos);
        anim = null;
        vel = 0;
        rest();
      }
    }, { passive: true });

    // Mouse: pausa al pasar por encima y arrastre con inercia
    let startX = 0, startPos = 0, lastX = 0, lastT = 0, moved = 0;
    track.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") hovering = true; });
    track.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") { hovering = false; rest(); } });
    track.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      dragging = true; moved = 0; anim = null; vel = 0;
      startX = lastX = e.clientX; startPos = pos; lastT = performance.now();
      track.setPointerCapture(e.pointerId);
    });
    track.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const now = performance.now();
      moved = Math.max(moved, Math.abs(e.clientX - startX));
      if (moved > 4) track.classList.add("is-dragging");
      setPos(startPos - (e.clientX - startX));
      vel = -(e.clientX - lastX) / Math.max(1, now - lastT);
      lastX = e.clientX; lastT = now;
    });
    const endDrag = () => {
      if (!dragging) return;
      dragging = false;
      rest();
      setTimeout(() => track.classList.toggle("is-dragging", false), 0);
    };
    track.addEventListener("pointerup", endDrag);
    track.addEventListener("pointercancel", endDrag);
    // Si fue un arrastre, no abrir el film al soltar
    track.addEventListener("click", (e) => { if (moved > 4) { e.preventDefault(); e.stopPropagation(); } }, true);

    // Botones y teclado: un cuadro por vez
    const step = (dir) => { vel = 0; anim = { from: pos, to: pos + dir * frameW(), start: performance.now(), dur: 650 }; rest(); };
    $$(".reel-btn", root).forEach((b) => b.addEventListener("click", () => step(+b.dataset.dir)));
    track.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") { e.preventDefault(); step(1); }
      if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
    });

    new IntersectionObserver((en) => en.forEach((x) => {
      visible = x.isIntersecting;
      last = performance.now();
    }), { rootMargin: "100px 0px" }).observe(track);
  });

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
  // Sin servidor: arma el mensaje y lo abre en WhatsApp con el número de Felix.
  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    const en = document.documentElement.lang.startsWith("en");
    const lines = $$(".field", form)
      .map((f) => {
        const input = $("input, select, textarea", f);
        const label = $("label", f).textContent.trim();
        return input.value.trim() ? `${label}: ${input.value.trim()}` : "";
      })
      .filter(Boolean);
    const text = (en ? "Hi Felix! Wedding inquiry from the website:\n\n" : "¡Hola Felix! Consulta desde la web:\n\n") + lines.join("\n");
    window.open(`${form.dataset.whatsapp}?text=${encodeURIComponent(text)}`, "_blank", "noopener");
    $(".form-note", form).textContent = en
      ? "Opening WhatsApp with your message… If it doesn't open, write to the email on the left."
      : "Abriendo WhatsApp con tu mensaje… Si no se abre, escribime al email de la izquierda.";
  });
})();
