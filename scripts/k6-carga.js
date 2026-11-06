// TC-28 · RNF-03 · Prueba de carga: 20 usuarios virtuales durante 5 minutos.
// Criterio: p95 de la duración de las solicitudes < 2000 ms y menos de 1 % de errores.
// Solo lecturas y login: no crea inscripciones, así no se envían correos reales.
// Requiere haber corrido scripts/seed-carga.js y tener la app en BASE_URL.
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const USUARIOS = 20;

export const options = {
  vus: USUARIOS,
  duration: __ENV.DURACION || '5m',
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
  },
};

const JSON_HEADERS = { 'Content-Type': 'application/json' };

// Se ejecuta una sola vez: inicia sesión con 20 participantes sembrados y toma los ids de los eventos.
export function setup() {
  const tokens = [];
  for (let i = 1; i <= USUARIOS; i += 1) {
    const r = http.post(`${BASE_URL}/api/users/login`,
      JSON.stringify({ email: `carga_p${i}@example.com`, password: '123456' }), { headers: JSON_HEADERS });
    if (r.status !== 200) throw new Error(`Login falló para carga_p${i} (${r.status}). ¿Corriste el seed?`);
    tokens.push(r.json('token'));
  }
  const lista = http.get(`${BASE_URL}/api/events`);
  if (lista.status !== 200) throw new Error(`GET /api/events devolvió ${lista.status}`);
  const ids = lista.json().map((e) => e._id);
  if (ids.length < 100) throw new Error(`Solo hay ${ids.length} eventos; corre el seed.`);
  return { tokens, ids };
}

export default function (data) {
  const token = data.tokens[(__VU - 1) % data.tokens.length];
  const auth = { headers: { Authorization: `Bearer ${token}` } };
  const id = data.ids[Math.floor(Math.random() * data.ids.length)];

  const lista = http.get(`${BASE_URL}/api/events`, { tags: { endpoint: 'listar_eventos' } });
  check(lista, { 'listar eventos 200': (r) => r.status === 200 });

  const detalle = http.get(`${BASE_URL}/api/events/${id}`, { tags: { endpoint: 'detalle_evento' } });
  check(detalle, { 'detalle evento 200': (r) => r.status === 200 });

  const mias = http.get(`${BASE_URL}/api/users/me/registrations`, { ...auth, tags: { endpoint: 'mis_inscripciones' } });
  check(mias, { 'mis inscripciones 200': (r) => r.status === 200 });

  sleep(1);
}
