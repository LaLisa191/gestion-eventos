function getSession() {
  const raw = localStorage.getItem('session');
  return raw ? JSON.parse(raw) : null;
}

function setSession(data) {
  localStorage.setItem('session', JSON.stringify(data));
}

function clearSession() {
  localStorage.removeItem('session');
}

function pintarCuenta(cuenta, session) {
  if (!cuenta) return;

  if (!session) {
    cuenta.innerHTML = `<a href="login.html">Iniciar sesión</a>`;
    return;
  }

  cuenta.innerHTML = `<a href="#" id="logoutLink">Salir (${session.user.name.split(' ')[0]})</a>`;
  document.getElementById('logoutLink').addEventListener('click', (e) => {
    e.preventDefault();
    clearSession();
    location.href = 'index.html';
  });
}

function pintarMisEventos(el, session) {
  if (!el) return;
  el.innerHTML = session ? `<a href="my-events.html">Mis eventos</a>` : '';
}

function pintarPortal(el, session) {
  if (!el) return;
  const esOrganizador = session?.user.userType === 'organizer';
  el.innerHTML = esOrganizador ? `<a href="organizer-portal.html">Mi portal</a>` : '';
}

function pintarPerfil(el, session) {
  if (!el) return;
  el.innerHTML = session ? `<a href="profile.html">Mi perfil</a>` : '';
}

// Pinta "Mis eventos", "Mi portal", "Mi perfil" y "Iniciar sesión"/"Salir" según la sesión
function renderAccountNav() {
  const session = getSession();
  pintarCuenta(document.getElementById('navAccount'), session);
  pintarMisEventos(document.getElementById('navMisEventos'), session);
  pintarPortal(document.getElementById('navPortal'), session);
  pintarPerfil(document.getElementById('navPerfil'), session);
}

document.addEventListener('DOMContentLoaded', renderAccountNav);

// Arregla el "botón atrás": si el navegador restaura la página desde su
// caché (bfcache) en vez de cargarla de nuevo, la sesión mostrada puede
// quedar desactualizada. Forzamos una recarga real en ese caso.
window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    location.reload();
  }
});
