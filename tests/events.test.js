const request = require('supertest');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const app = require('../app');

describe('POST /api/events', () => {

  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  test('debe permitir a un organizador crear un evento', async () => {
    const email = `organizer_${Date.now()}@example.com`;
    const password = '123456';

    // Crear organizador
    await request(app)
      .post('/api/users/signup')
      .send({
        name: 'Organizador Test',
        email,
        password,
        userType: 'organizer'
      });

    // Obtener JWT
    const loginResponse = await request(app)
      .post('/api/users/login')
      .send({
        email,
        password
      });

    const token = loginResponse.body.token;

    // Crear evento
    const response = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Evento de prueba',
        description: 'Evento creado desde Jest',
        date: '2026-12-01T18:00:00.000Z',
        location: 'Cartagena',
        maxCapacity: 100,
        modality: 'in-person'
      });

    expect(response.statusCode).toBe(201);
    expect(response.body.name).toBe('Evento de prueba');
    expect(response.body.location).toBe('Cartagena');
    expect(response.body.maxCapacity).toBe(100);
  });
test('debe rechazar la creación de un evento sin token', async () => {
  const response = await request(app)
    .post('/api/events')
    .send({
      name: 'Evento sin autenticación',
      description: 'Prueba de seguridad',
      date: '2026-12-01T18:00:00.000Z',
      location: 'Cartagena',
      maxCapacity: 100,
      modality: 'in-person'
    });

  expect(response.statusCode).toBe(401);
  expect(response.body.message).toBe('No autenticado');
});
test('debe rechazar la creación de un evento por parte de un participante', async () => {
  const email = `participant_${Date.now()}@example.com`;
  const password = '123456';

  // Crear participante
  await request(app)
    .post('/api/users/signup')
    .send({
      name: 'Participante Test',
      email,
      password,
      userType: 'participant'
    });

  // Obtener JWT
  const loginResponse = await request(app)
    .post('/api/users/login')
    .send({
      email,
      password
    });

  const token = loginResponse.body.token;

  // Intentar crear evento
  const response = await request(app)
    .post('/api/events')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: 'Evento no autorizado',
      description: 'Prueba de autorización',
      date: '2026-12-01T18:00:00.000Z',
      location: 'Cartagena',
      maxCapacity: 100,
      modality: 'in-person'
    });

  expect(response.statusCode).toBe(403);
  expect(response.body.message).toBe(
    'Solo un organizador puede hacer esto'
  );
});
test('debe obtener todos los eventos', async () => {
  const response = await request(app)
    .get('/api/events');

  expect(response.statusCode).toBe(200);
  expect(Array.isArray(response.body)).toBe(true);
});
test('debe obtener un evento por su ID', async () => {
  const email = `organizer_get_${Date.now()}@example.com`;
  const password = '123456';

  // Crear organizador
  await request(app)
    .post('/api/users/signup')
    .send({
      name: 'Organizador Get',
      email,
      password,
      userType: 'organizer'
    });

  // Obtener JWT
  const loginResponse = await request(app)
    .post('/api/users/login')
    .send({
      email,
      password
    });

  const token = loginResponse.body.token;

  // Crear evento
  const createResponse = await request(app)
    .post('/api/events')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: 'Evento para consultar',
      description: 'Evento de prueba',
      date: '2026-12-15T18:00:00.000Z',
      location: 'Cartagena',
      maxCapacity: 50,
      modality: 'in-person'
    });

  const eventId = createResponse.body._id;

  // Obtener evento por ID
  const response = await request(app)
    .get(`/api/events/${eventId}`);

  expect(response.statusCode).toBe(200);
  expect(response.body._id).toBe(eventId);
  expect(response.body.name).toBe('Evento para consultar');
  expect(response.body.availableSpots).toBe(50);
});
test('debe rechazar un ID de evento inválido', async () => {
  const response = await request(app)
    .get('/api/events/id-invalido');

  expect(response.statusCode).toBe(400);
  expect(response.body.message).toBe('Id de evento inválido');
});

test('debe devolver 404 si el evento no existe', async () => {
  const response = await request(app)
    .get('/api/events/507f1f77bcf86cd799439011');

  expect(response.statusCode).toBe(404);
  expect(response.body.message).toBe('Evento no encontrado');
});

test('debe permitir a un organizador editar su evento', async () => {
  const email = `organizer_edit_${Date.now()}@example.com`;
  const password = '123456';

  // Crear organizador
  await request(app)
    .post('/api/users/signup')
    .send({
      name: 'Organizador Edit',
      email,
      password,
      userType: 'organizer'
    });

  // Obtener JWT
  const loginResponse = await request(app)
    .post('/api/users/login')
    .send({
      email,
      password
    });

  const token = loginResponse.body.token;

  // Crear evento
  const createResponse = await request(app)
    .post('/api/events')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: 'Evento original',
      description: 'Descripción original',
      date: '2026-12-20T18:00:00.000Z',
      location: 'Cartagena',
      maxCapacity: 50,
      modality: 'in-person'
    });

  const eventId = createResponse.body._id;

  // Editar evento
// Editar evento
const response = await request(app)
  .put(`/api/events/${eventId}`)
  .set('Authorization', `Bearer ${token}`)
  .send({
    name: 'Evento actualizado',
    description: 'Nueva descripción',
    maxCapacity: 100
  });

console.log('STATUS EDITAR:', response.statusCode);
console.log('RESPUESTA EDITAR:', response.body);

expect(response.statusCode).toBe(200);
expect(response.body.name).toBe('Evento actualizado');
expect(response.body.description).toBe('Nueva descripción');
expect(response.body.maxCapacity).toBe(100);

test('debe rechazar a un organizador al editar un evento que no le pertenece', async () => {
  const password = '123456';

  // Crear organizador propietario del evento
  const ownerEmail = `owner_${Date.now()}@example.com`;

  await request(app)
    .post('/api/users/signup')
    .send({
      name: 'Organizador Propietario',
      email: ownerEmail,
      password,
      userType: 'organizer'
    });

  // Login del propietario
  const ownerLogin = await request(app)
    .post('/api/users/login')
    .send({
      email: ownerEmail,
      password
    });

  const ownerToken = ownerLogin.body.token;

  // Crear evento
  const createResponse = await request(app)
    .post('/api/events')
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({
      name: 'Evento del propietario',
      description: 'Evento original',
      date: '2026-12-25T18:00:00.000Z',
      location: 'Cartagena',
      maxCapacity: 50,
      modality: 'in-person'
    });

  const eventId = createResponse.body._id;

  // Crear otro organizador
  const otherEmail = `other_${Date.now()}@example.com`;

  await request(app)
    .post('/api/users/signup')
    .send({
      name: 'Otro Organizador',
      email: otherEmail,
      password,
      userType: 'organizer'
    });

  // Login del otro organizador
  const otherLogin = await request(app)
    .post('/api/users/login')
    .send({
      email: otherEmail,
      password
    });

  const otherToken = otherLogin.body.token;

  // Intentar editar el evento del primer organizador
  const response = await request(app)
    .put(`/api/events/${eventId}`)
    .set('Authorization', `Bearer ${otherToken}`)
    .send({
      name: 'Intento de modificación'
    });

  expect(response.statusCode).toBe(403);
  expect(response.body.message).toBe(
    'No puedes editar un evento que no organizaste'
  );
});

test('debe devolver 404 al intentar editar un evento que no existe', async () => {
  const email = `organizer_notfound_${Date.now()}@example.com`;
  const password = '123456';

  // Crear organizador
  await request(app)
    .post('/api/users/signup')
    .send({
      name: 'Organizador Test',
      email,
      password,
      userType: 'organizer'
    });

  // Obtener JWT
  const loginResponse = await request(app)
    .post('/api/users/login')
    .send({
      email,
      password
    });

  const token = loginResponse.body.token;

  // Intentar editar un evento inexistente
  const response = await request(app)
    .put('/api/events/507f1f77bcf86cd799439011')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: 'Evento actualizado'
    });

  expect(response.statusCode).toBe(404);
  expect(response.body.message).toBe('Evento no encontrado');
});

test('debe permitir a un organizador eliminar su evento', async () => {
  const email = `organizer_delete_${Date.now()}@example.com`;
  const password = '123456';

  // Crear organizador
  await request(app)
    .post('/api/users/signup')
    .send({
      name: 'Organizador Delete',
      email,
      password,
      userType: 'organizer'
    });

  // Obtener JWT
  const loginResponse = await request(app)
    .post('/api/users/login')
    .send({
      email,
      password
    });

  const token = loginResponse.body.token;

  // Crear evento
  const createResponse = await request(app)
    .post('/api/events')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: 'Evento para eliminar',
      description: 'Evento de prueba',
      date: '2026-12-30T18:00:00.000Z',
      location: 'Cartagena',
      maxCapacity: 50,
      modality: 'in-person'
    });

  const eventId = createResponse.body._id;

  // Eliminar evento
  const response = await request(app)
    .delete(`/api/events/${eventId}`)
    .set('Authorization', `Bearer ${token}`);

  expect(response.statusCode).toBe(200);
  expect(response.body.message).toBe('Evento eliminado');

  // Comprobar que realmente fue eliminado
  const getResponse = await request(app)
    .get(`/api/events/${eventId}`);

  expect(getResponse.statusCode).toBe(404);
  expect(getResponse.body.message).toBe('Evento no encontrado');
});

test('debe rechazar a un organizador al eliminar un evento que no le pertenece', async () => {
  const password = '123456';

  // Crear organizador propietario
  const ownerEmail = `owner_delete_${Date.now()}@example.com`;

  await request(app)
    .post('/api/users/signup')
    .send({
      name: 'Propietario del Evento',
      email: ownerEmail,
      password,
      userType: 'organizer'
    });

  // Login del propietario
  const ownerLogin = await request(app)
    .post('/api/users/login')
    .send({
      email: ownerEmail,
      password
    });

  const ownerToken = ownerLogin.body.token;

  // Crear evento
  const createResponse = await request(app)
    .post('/api/events')
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({
      name: 'Evento protegido',
      description: 'Evento del primer organizador',
      date: '2026-12-31T18:00:00.000Z',
      location: 'Cartagena',
      maxCapacity: 50,
      modality: 'in-person'
    });

  const eventId = createResponse.body._id;

  // Crear segundo organizador
  const otherEmail = `other_delete_${Date.now()}@example.com`;

  await request(app)
    .post('/api/users/signup')
    .send({
      name: 'Otro Organizador',
      email: otherEmail,
      password,
      userType: 'organizer'
    });

  // Login del segundo organizador
  const otherLogin = await request(app)
    .post('/api/users/login')
    .send({
      email: otherEmail,
      password
    });

  const otherToken = otherLogin.body.token;

  // Intentar eliminar el evento del primer organizador
  const response = await request(app)
    .delete(`/api/events/${eventId}`)
    .set('Authorization', `Bearer ${otherToken}`);

  expect(response.statusCode).toBe(403);
  expect(response.body.message).toBe(
    'No puedes eliminar un evento que no organizaste'
  );
});

test('debe devolver 404 al intentar eliminar un evento que no existe', async () => {
  const email = `organizer_delete_notfound_${Date.now()}@example.com`;
  const password = '123456';

  // Crear organizador
  await request(app)
    .post('/api/users/signup')
    .send({
      name: 'Organizador Test',
      email,
      password,
      userType: 'organizer'
    });

  // Obtener JWT
  const loginResponse = await request(app)
    .post('/api/users/login')
    .send({
      email,
      password
    });

  const token = loginResponse.body.token;

  // Intentar eliminar un evento inexistente
  const response = await request(app)
    .delete('/api/events/507f1f77bcf86cd799439011')
    .set('Authorization', `Bearer ${token}`);

  expect(response.statusCode).toBe(404);
  expect(response.body.message).toBe('Evento no encontrado');
});

test('debe rechazar la creación de un evento con datos inválidos', async () => {
  const email = `invalid_event_${Date.now()}@example.com`;
  const password = '123456';

  await request(app)
    .post('/api/users/signup')
    .send({
      name: 'Organizador Test',
      email,
      password,
      userType: 'organizer'
    });

  const loginResponse = await request(app)
    .post('/api/users/login')
    .send({
      email,
      password
    });

  const token = loginResponse.body.token;

  const response = await request(app)
    .post('/api/events')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: '',
      date: 'fecha-invalida',
      maxCapacity: 'no-es-un-numero'
    });

  expect(response.statusCode).toBe(400);
expect(response.body.message).toContain('Revisa el formulario');
});

test('debe rechazar la edición de un evento con datos inválidos', async () => {
  const email = `invalid_edit_${Date.now()}@example.com`;
  const password = '123456';

  // Crear organizador
  await request(app)
    .post('/api/users/signup')
    .send({
      name: 'Organizador Test',
      email,
      password,
      userType: 'organizer'
    });

  // Login
  const loginResponse = await request(app)
    .post('/api/users/login')
    .send({
      email,
      password
    });

  const token = loginResponse.body.token;

  // Crear evento válido
  const createResponse = await request(app)
    .post('/api/events')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: 'Evento para editar',
      description: 'Evento de prueba',
      date: '2026-12-31T18:00:00.000Z',
      location: 'Cartagena',
      maxCapacity: 50,
      modality: 'in-person'
    });

  const eventId = createResponse.body._id;

  // Intentar editarlo con datos inválidos
  const response = await request(app)
    .put(`/api/events/${eventId}`)
    .set('Authorization', `Bearer ${token}`)
    .send({
      date: 'fecha-invalida',
      maxCapacity: 'no-es-un-numero'
    });

  expect(response.statusCode).toBe(400);
expect(response.body.message).toContain('Revisa el formulario');
});

test('el organizador debe poder generar un reporte de asistencia', async () => {
  const email = `reporte_${Date.now()}@example.com`;
  const password = '123456';

  // Crear organizador
  await request(app)
    .post('/api/users/signup')
    .send({
      name: 'Organizador Reporte',
      email,
      password,
      userType: 'organizer'
    });

  // Login
  const login = await request(app)
    .post('/api/users/login')
    .send({
      email,
      password
    });

  const token = login.body.token;

  // Crear evento
  const eventResponse = await request(app)
    .post('/api/events')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: 'Evento para reporte',
      description: 'Evento de prueba',
      date: '2027-01-20',
      location: 'Cartagena',
      maxCapacity: 50,
      modality: 'in-person'
    });

  const eventId = eventResponse.body._id;

  // Generar reporte
  const response = await request(app)
    .post(`/api/events/${eventId}/reports`)
    .set('Authorization', `Bearer ${token}`);

  expect(response.statusCode).toBe(201);
  expect(response.body.eventId).toBe(eventId);
  expect(response.body.type).toBe('attendance');
  expect(response.body.data.totalRegistered).toBe(0);
  expect(response.body.data.maxCapacity).toBe(50);
});

test('un organizador no debe poder generar el reporte de un evento ajeno', async () => {
  const password = '123456';
  const email1 = `organizador1_${Date.now()}@example.com`;
  const email2 = `organizador2_${Date.now()}@example.com`;

  // Crear organizador 1
  await request(app)
    .post('/api/users/signup')
    .send({
      name: 'Organizador 1',
      email: email1,
      password,
      userType: 'organizer'
    });

  // Crear organizador 2
  await request(app)
    .post('/api/users/signup')
    .send({
      name: 'Organizador 2',
      email: email2,
      password,
      userType: 'organizer'
    });

  // Login organizador 1
  const login1 = await request(app)
    .post('/api/users/login')
    .send({
      email: email1,
      password
    });

  // Crear evento con organizador 1
  const eventResponse = await request(app)
    .post('/api/events')
    .set('Authorization', `Bearer ${login1.body.token}`)
    .send({
      name: 'Evento ajeno',
      description: 'Evento de prueba',
      date: '2027-02-20',
      location: 'Cartagena',
      maxCapacity: 50,
      modality: 'in-person'
    });

  const eventId = eventResponse.body._id;

  // Login organizador 2
  const login2 = await request(app)
    .post('/api/users/login')
    .send({
      email: email2,
      password
    });

  // Intentar generar el reporte
  const response = await request(app)
    .post(`/api/events/${eventId}/reports`)
    .set('Authorization', `Bearer ${login2.body.token}`);

  expect(response.statusCode).toBe(403);
  expect(response.body.message).toBe(
    'No puedes generar el reporte de un evento que no organizaste'
  );
});
test('el organizador debe poder consultar los reportes de su evento', async () => {
  const password = '123456';
  const email = `consulta_reporte_${Date.now()}@example.com`;

  // Crear organizador
  await request(app)
    .post('/api/users/signup')
    .send({
      name: 'Organizador',
      email,
      password,
      userType: 'organizer'
    });

  // Login
  const login = await request(app)
    .post('/api/users/login')
    .send({
      email,
      password
    });

  const token = login.body.token;

  // Crear evento
  const eventResponse = await request(app)
    .post('/api/events')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: 'Evento con reporte',
      description: 'Evento de prueba',
      date: '2027-03-20',
      location: 'Cartagena',
      maxCapacity: 50,
      modality: 'in-person'
    });

  const eventId = eventResponse.body._id;

  // Generar reporte
  await request(app)
    .post(`/api/events/${eventId}/reports`)
    .set('Authorization', `Bearer ${token}`);

  // Consultar reportes
  const response = await request(app)
    .get(`/api/events/${eventId}/reports`)
    .set('Authorization', `Bearer ${token}`);

  expect(response.statusCode).toBe(200);
  expect(Array.isArray(response.body)).toBe(true);
  expect(response.body.length).toBeGreaterThan(0);
});

test('un organizador no debe poder consultar los reportes de un evento ajeno', async () => {
  const password = '123456';
  const email1 = `reporte_owner_${Date.now()}@example.com`;
  const email2 = `reporte_otro_${Date.now()}@example.com`;

  // Crear organizador 1
  await request(app)
    .post('/api/users/signup')
    .send({
      name: 'Organizador 1',
      email: email1,
      password,
      userType: 'organizer'
    });

  // Crear organizador 2
  await request(app)
    .post('/api/users/signup')
    .send({
      name: 'Organizador 2',
      email: email2,
      password,
      userType: 'organizer'
    });

  // Login organizador 1
  const login1 = await request(app)
    .post('/api/users/login')
    .send({
      email: email1,
      password
    });

  // Crear evento con organizador 1
  const eventResponse = await request(app)
    .post('/api/events')
    .set('Authorization', `Bearer ${login1.body.token}`)
    .send({
      name: 'Evento privado',
      description: 'Evento de prueba',
      date: '2027-04-20',
      location: 'Cartagena',
      maxCapacity: 50,
      modality: 'in-person'
    });

  const eventId = eventResponse.body._id;

  // Login organizador 2
  const login2 = await request(app)
    .post('/api/users/login')
    .send({
      email: email2,
      password
    });

  // Intentar consultar los reportes
  const response = await request(app)
    .get(`/api/events/${eventId}/reports`)
    .set('Authorization', `Bearer ${login2.body.token}`);

  expect(response.statusCode).toBe(403);
  expect(response.body.message).toBe(
    'No puedes ver los reportes de un evento que no organizaste'
  );
});
});
});