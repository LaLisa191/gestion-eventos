// Utilidades compartidas por los tests (no es un archivo de tests)
const request = require('supertest');
const app = require('../app');

const PASSWORD = '123456';
const ID_INEXISTENTE = '507f1f77bcf86cd799439011';
let contador = 0;

function siguiente() {
  contador += 1;
  return contador;
}

// Cada evento recibe una fecha distinta: la API rechaza dos eventos activos
// en el mismo lugar y a la misma hora.
function fechaUnica() {
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000 + siguiente() * 60 * 1000).toISOString();
}

// Correo distinto en cada llamada
function correoUnico(prefijo) {
  return `${prefijo}_${Date.now()}_${siguiente()}@example.com`;
}

// Registra un usuario, inicia sesión y devuelve su token y su correo
async function crearUsuario(userType, name = `Usuario ${userType}`) {
  const email = correoUnico(userType);

  await request(app)
    .post('/api/users/signup')
    .send({ name, email, password: PASSWORD, userType });

  const login = await request(app)
    .post('/api/users/login')
    .send({ email, password: PASSWORD });

  return { token: login.body.token, email };
}

function datosEvento(extra = {}) {
  return {
    name: 'Evento de prueba',
    description: 'Evento creado desde Jest',
    date: fechaUnica(),
    location: 'Cartagena',
    maxCapacity: 50,
    modality: 'in-person',
    ...extra
  };
}

// Crea un evento válido por JSON y devuelve su id
async function crearEvento(tokenOrganizador, extra = {}) {
  const response = await request(app)
    .post('/api/events')
    .set('Authorization', `Bearer ${tokenOrganizador}`)
    .send(datosEvento(extra));

  expect(response.statusCode).toBe(201);
  return response.body._id;
}

module.exports = { PASSWORD, ID_INEXISTENTE, fechaUnica, correoUnico, crearUsuario, datosEvento, crearEvento };
