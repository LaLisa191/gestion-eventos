// --- Manejo de Sesión (Local Storage) ---
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

// --- Interfaz de Usuario (UI) ---

// Crea e inyecta dinámicamente el modal de cierre de sesión si no existe
function crearModalLogout() {
  if (document.getElementById('modalLogout')) return;

  const div = document.createElement('div');
  div.className = 'modal-backdrop';
  div.id = 'modalLogout';
  div.innerHTML = `
    <div class="modal-card" style="max-width:360px;text-align:center">
      <h3>¿Cerrar sesión?</h3>
      <p style="color:var(--text-muted);font-size:14px;margin-top:10px">Vas a salir de tu cuenta en este dispositivo.</p>
      <div style="display:flex;gap:10px;margin-top:22px">
        <button class="btn-secondary" style="flex:1;justify-content:center" id="cancelarLogout">Cancelar</button>
        <button class="btn-primary" style="flex:1;justify-content:center" id="confirmarLogout">Salir</button>
      </div>
    </div>
  `;
  document.body.appendChild(div);

  document.getElementById('cancelarLogout').addEventListener('click', () => {
    div.classList.remove('open');
  });
  
  document.getElementById('confirmarLogout').addEventListener('click', () => {
    clearSession();
    location.href = 'index.html';
  });
}

// --- Funciones para inyectar navegación según el estado de la sesión ---
function pintarCuenta(cuenta, session) {
  if (!cuenta) return;

  if (!session) {
    cuenta.innerHTML = `<a href="login.html">Iniciar sesión</a>`;
    return;
  }

  cuenta.innerHTML = `<a href="#" id="logoutLink">Salir (${session.user.name.split(' ')[0]})</a>`;
  document.getElementById('logoutLink').addEventListener('click', (e) => {
    e.preventDefault();
    crearModalLogout();
    document.getElementById('modalLogout').classList.add('open');
  });
}

function pintarMisEventos(el, session) {
  if (!el) return;
  el.innerHTML = session ? `<a href="my-events.html">Mis eventos</a>` : '';
}

function pintarPortal(el, session) {
  if (!el) return;
  // Solo renderiza el enlace al portal si el usuario tiene rol de organizador
  const esOrganizador = session?.user.userType === 'organizer';
  el.innerHTML = esOrganizador ? `<a href="organizer-portal.html">Mi portal</a>` : '';
}

function pintarPerfil(el, session) {
  if (!el) return;
  el.innerHTML = session ? `<a href="profile.html">Mi perfil</a>` : '';
}

// Orquesta la actualización de todos los enlaces de la cuenta
function renderAccountNav() {
  const session = getSession();
  pintarCuenta(document.getElementById('navAccount'), session);
  pintarMisEventos(document.getElementById('navMisEventos'), session);
  pintarPortal(document.getElementById('navPortal'), session);
  pintarPerfil(document.getElementById('navPerfil'), session);
}

// Inyecta el header y footer compartidos en las páginas que posean los contenedores
async function cargarParciales() {
  const headerPlaceholder = document.getElementById('header-placeholder');
  const footerPlaceholder = document.getElementById('footer-placeholder');

  if (headerPlaceholder) {
    const res = await fetch('partials/header.html');
    headerPlaceholder.innerHTML = await res.text();
  }
  if (footerPlaceholder) {
    const res = await fetch('partials/footer.html');
    footerPlaceholder.innerHTML = await res.text();
  }

  renderAccountNav();
}

document.addEventListener('DOMContentLoaded', cargarParciales);

// Delegación de eventos para elementos inyectados dinámicamente (menú hamburguesa y filtros)
document.addEventListener('click', (e) => {
  // Toggle del menú móvil
  const toggle = e.target.closest('#navToggle');
  if (toggle) {
    document.querySelector('.nav-links')?.classList.toggle('open');
    return;
  }

  // Filtro de modalidad (Presencial/Virtual)
  const dropdownLink = e.target.closest('.dropdown a[data-modality]');
  if (dropdownLink) {
    e.preventDefault();
    if (typeof aplicarFiltro === 'function') {
      aplicarFiltro(dropdownLink.dataset.modality);
      document.getElementById('eventos')?.scrollIntoView({ behavior: 'smooth' });
    }
  }
});

// Fuerza la recarga de la página si se restaura desde la caché (bfcache) al usar el botón "Atrás"
window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    location.reload();
  }
});

// --- Utilidades ---

// Genera un archivo iCalendar (.ics) configurado como evento de "todo el día" y lo descarga
function descargarICS(ev) {
  const fecha = new Date(ev.date);
  const yyyy = fecha.getFullYear();
  const mm = String(fecha.getMonth() + 1).padStart(2, '0');
  const dd = String(fecha.getDate()).padStart(2, '0');
  
  const fechaFin = new Date(fecha);
  fechaFin.setDate(fechaFin.getDate() + 1);
  const yyyy2 = fechaFin.getFullYear();
  const mm2 = String(fechaFin.getMonth() + 1).padStart(2, '0');
  const dd2 = String(fechaFin.getDate()).padStart(2, '0');

  // Estructura estándar de iCalendar (RFC 5545)
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'BEGIN:VEVENT',
    `UID:${ev._id}@eventos-udec`,
    `DTSTAMP:${yyyy}${mm}${dd}T000000Z`,
    `DTSTART;VALUE=DATE:${yyyy}${mm}${dd}`,
    `DTEND;VALUE=DATE:${yyyy2}${mm2}${dd2}`,
    `SUMMARY:${ev.name}`,
    `LOCATION:${ev.location}`,
    `DESCRIPTION:${(ev.description || '').replaceAll('\n', ' ')}`,
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  const blob = new Blob([ics], { type: 'text/calendar' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `${ev.name}.ics`;
  a.click();
  
  URL.revokeObjectURL(url); // Liberar memoria tras la descarga
}

// Validación ligera de estructura de correo electrónico
function esCorreoValido(correo) {
  const arroba = correo.indexOf('@');
  if (arroba <= 0) return false;
  const dominio = correo.slice(arroba + 1);
  return dominio.includes('.') && !/\s/.test(correo);
}

// Formatea la fecha al estándar local colombiano (ej. "30 sept · 14:00")
function formatearFechaHora(fechaISO) {
  const d = new Date(fechaISO);
  const fecha = d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
  const hora = d.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
  return `${fecha} · ${hora}`;
}