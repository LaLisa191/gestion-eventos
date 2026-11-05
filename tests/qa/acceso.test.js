// TC-30 · RNF-04 · Matriz de control de acceso sobre los 10 endpoints protegidos del alcance.
// Combinaciones: sin token, token inválido, rol incorrecto y recurso ajeno.
const request = require('supertest');
const app = require('../../app');
const { crearUsuario, crearEvento, ID_INEXISTENTE } = require('../helpers');

// {e} = id del evento de O1 y {r} = id de la inscripción de P1
const ENDPOINTS = [
  { nombre: 'crear evento', metodo: 'post', ruta: '/api/events', soloOrganizador: true },
  { nombre: 'editar evento', metodo: 'put', ruta: '/api/events/{e}', soloOrganizador: true, ajeno: 'O2' },
  { nombre: 'eliminar evento', metodo: 'delete', ruta: '/api/events/{e}', soloOrganizador: true, ajeno: 'O2' },
  { nombre: 'generar reporte', metodo: 'post', ruta: '/api/events/{e}/reports', soloOrganizador: true, ajeno: 'O2' },
  { nombre: 'consultar reportes', metodo: 'get', ruta: '/api/events/{e}/reports', soloOrganizador: true, ajeno: 'O2' },
  { nombre: 'consultar inscritos', metodo: 'get', ruta: '/api/events/{e}/registrations', soloOrganizador: true, ajeno: 'O2' },
  { nombre: 'inscribirse', metodo: 'post', ruta: '/api/events/{e}/registrations' },
  { nombre: 'cancelar inscripción', metodo: 'patch', ruta: '/api/events/{e}/registrations/{r}/cancel', ajeno: 'P2' },
  { nombre: 'eliminar inscripción', metodo: 'delete', ruta: '/api/events/{e}/registrations/{r}', ajeno: 'P2' },
  { nombre: 'mis inscripciones', metodo: 'get', ruta: '/api/users/me/registrations' }
];

let ids;
let tokens;

beforeAll(async () => {
  const o1 = await crearUsuario('organizer');
  const o2 = await crearUsuario('organizer');
  const p1 = await crearUsuario('participant');
  const p2 = await crearUsuario('participant');
  const e = await crearEvento(o1.token, { maxCapacity: 10 });
  const inscripcion = await request(app)
    .post(`/api/events/${e}/registrations`)
    .set('Authorization', `Bearer ${p1.token}`);
  ids = { e, r: inscripcion.body.registration._id };
  tokens = { O1: o1.token, O2: o2.token, P1: p1.token, P2: p2.token };
}, 30000);

function llamar(endpoint, token) {
  const ruta = endpoint.ruta.replace('{e}', ids.e).replace('{r}', ids.r);
  let peticion = request(app)[endpoint.metodo](ruta);
  if (token) peticion = peticion.set('Authorization', `Bearer ${token}`);
  return peticion;
}

describe('TC-30 · RNF-04 · Matriz de control de acceso', () => {
  test('el alcance tiene exactamente 10 endpoints protegidos', () => {
    expect(ENDPOINTS).toHaveLength(10);
  });

  test.each(ENDPOINTS.map((e) => [e.nombre, e]))('%s: sin token responde 401', async (_n, endpoint) => {
    const response = await llamar(endpoint, null);
    expect(response.statusCode).toBe(401);
  });

  test.each(ENDPOINTS.map((e) => [e.nombre, e]))('%s: con token inválido responde 401', async (_n, endpoint) => {
    const response = await llamar(endpoint, 'token.invalido.xyz');
    expect(response.statusCode).toBe(401);
  });

  test.each(ENDPOINTS.filter((e) => e.soloOrganizador).map((e) => [e.nombre, e]))(
    '%s: un participante recibe 403', async (_n, endpoint) => {
      const response = await llamar(endpoint, tokens.P1);
      expect(response.statusCode).toBe(403);
    }
  );

  test.each(ENDPOINTS.filter((e) => e.ajeno).map((e) => [e.nombre, e]))(
    '%s: un usuario sobre un recurso ajeno recibe 403', async (_n, endpoint) => {
      const response = await llamar(endpoint, tokens[endpoint.ajeno]);
      expect(response.statusCode).toBe(403);
    }
  );

  test('un id inexistente no revela datos de otros eventos (404, no 200)', async () => {
    const response = await request(app)
      .get(`/api/events/${ID_INEXISTENTE}/registrations`)
      .set('Authorization', `Bearer ${tokens.O1}`);
    expect(response.statusCode).toBe(404);
  });
});
