(function () {
  const REDUCIR_MOVIMIENTO = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- 1. Enlace activo en el nav ----------
  const paginaDe = (u) => u.pathname.split('/').pop() || 'index.html';

  // Se leen los enlaces cada vez, porque auth.js agrega algunos después de cargar el header
  function obtenerEnlaces() {
    return [...document.querySelectorAll('#header-placeholder .nav-links a')]
      .filter(a => !a.closest('.dropdown') && !a.closest('#navAccount'))  // sin el dropdown ni "Salir"
      .filter(a => {
        const href = a.getAttribute('href');
        return href && href !== '#';
      })
      .map(a => ({ a, url: new URL(a.getAttribute('href'), location.href) }))
      .filter(e => e.url.origin === location.origin)
      .map(e => ({ a: e.a, pagina: paginaDe(e.url), hash: e.url.hash }));
  }

  function actualizarNav() {
    const enlaces = obtenerEnlaces();
    if (enlaces.length === 0) return;

    const paginaActual = paginaDe(location);
    let activo = null;

    if (paginaActual === 'index.html') {
      // "Inicio" y "Eventos disponibles" son la misma página: se distinguen por el scroll
      const delIndex = enlaces.filter(e => e.pagina === 'index.html');
      const inicio = delIndex.find(e => !e.hash);
      const eventos = delIndex.find(e => e.hash === '#eventos');
      const seccion = document.getElementById('eventos');

      if (inicio && eventos && seccion) {
        const enSeccion = seccion.getBoundingClientRect().top <= window.innerHeight * 0.4;
        activo = (enSeccion ? eventos : inicio).a;
      } else if (inicio) {
        activo = inicio.a;
      }
    } else {
      const coincide = enlaces.find(e => e.pagina === paginaActual);
      activo = coincide ? coincide.a : null;
    }

    enlaces.forEach(({ a }) => {
      const esActivo = a === activo;
      a.classList.toggle('nav-activo', esActivo);
      if (esActivo) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }

  // Agrupa varios cambios seguidos en una sola actualización
  let navPendiente = false;
  function programarActualizacion() {
    if (navPendiente) return;
    navPendiente = true;
    requestAnimationFrame(() => { navPendiente = false; actualizarNav(); });
  }

  // El observer se queda activo: detecta tanto el header como los enlaces que agrega auth.js después
  const placeholder = document.getElementById('header-placeholder');
  if (placeholder) {
    new MutationObserver(programarActualizacion)
      .observe(placeholder, { childList: true, subtree: true });
  }
  window.addEventListener('scroll', programarActualizacion, { passive: true });
  window.addEventListener('resize', programarActualizacion);
  window.addEventListener('hashchange', programarActualizacion);
  actualizarNav();

  // ---------- 2. Botón "volver arriba" al llegar al final ----------
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn-subir';
  btn.setAttribute('aria-label', 'Volver al inicio de la página');
  btn.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>';
  document.body.appendChild(btn);

  function actualizarBoton() {
    const alto = document.documentElement.scrollHeight;
    const alFinal = window.innerHeight + window.scrollY >= alto - 120;
    const hayScroll = alto > window.innerHeight + 200;   // en páginas cortas no tiene sentido
    btn.classList.toggle('visible', alFinal && hayScroll);
  }

  let pendienteBoton = false;
  window.addEventListener('scroll', () => {
    if (pendienteBoton) return;
    pendienteBoton = true;
    requestAnimationFrame(() => { pendienteBoton = false; actualizarBoton(); });
  }, { passive: true });
  window.addEventListener('resize', actualizarBoton);

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: REDUCIR_MOVIMIENTO ? 'auto' : 'smooth' });
  });

  actualizarBoton();
})();