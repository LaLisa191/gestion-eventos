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

// Pinta "Mis eventos", "Mi portal", "Mi perfil" y "Iniciar sesión"/"Salir" según la sesión
function renderAccountNav() {
  const cuenta = document.getElementById('navAccount');
  const misEventos = document.getElementById('navMisEventos');
  const portal = document.getElementById('navPortal');
  const perfil = document.getElementById('navPerfil');
  const session = getSession();

  if (session) {
    if (cuenta) {
      cuenta.innerHTML = `<a href="#" id="logoutLink">Salir (${session.user.name.split(' ')[0]})</a>`;
      document.getElementById('logoutLink').addEventListener('click', (e) => {
        e.preventDefault();
        clearSession();
        location.href = 'index.html';
      });
    }
    if (misEventos) misEventos.innerHTML = `<a href="my-events.html">Mis eventos</a>`;
    if (portal) {
      portal.innerHTML = session.user.userType === 'organizer'
        ? `<a href="organizer-portal.html">Mi portal</a>`
        : '';
    }
    if (perfil) perfil.innerHTML = `<a href="profile.html">Mi perfil</a>`;
  } else {
    if (cuenta) cuenta.innerHTML = `<a href="login.html">Iniciar sesión</a>`;
    if (misEventos) misEventos.innerHTML = '';
    if (portal) portal.innerHTML = '';
    if (perfil) perfil.innerHTML = '';
  }
}

document.addEventListener('DOMContentLoaded', renderAccountNav);
