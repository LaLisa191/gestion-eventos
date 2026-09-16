const request = require('supertest');
const app = require('../app');

test('debe permitir a un participante registrarse en un evento', async () => {
  const password = '123456';

  // Crear organizador
  const organizerEmail = `organizer_reg_${Date.now()}@example.com`;

  await request(app)
    .post('/api/users/signup')
    .send({
      name: 'Organizador',
      email: organizerEmail,
      password,
      userType: 'organizer'
    });

  // Login del organizador
  const organizerLogin = await request(app)
    .post('/api/users/login')
    .send({
      email: organizerEmail,
      password
    });

  const organizerToken = organizerLogin.body.token;

  // Crear evento
  const eventResponse = await request(app)
    .post('/api/events')
    .set('Authorization', `Bearer ${organizerToken}`)
    .send({
      name: 'Evento de Registro',
      description: 'Evento para probar inscripciones',
      date: '2026-12-31T18:00:00.000Z',
      location: 'Cartagena',
      maxCapacity: 50,
      modality: 'in-person'
    });

  const eventId = eventResponse.body._id;

  // Crear participante
  const participantEmail = `participant_reg_${Date.now()}@example.com`;

  await request(app)
    .post('/api/users/signup')
    .send({
      name: 'Participante',
      email: participantEmail,
      password,
      userType: 'participant'
    });

  // Login del participante
  const participantLogin = await request(app)
    .post('/api/users/login')
    .send({
      email: participantEmail,
      password
    });

  const participantToken = participantLogin.body.token;

console.log('LOGIN PARTICIPANTE:', participantLogin.statusCode);
console.log('RESPUESTA LOGIN:', participantLogin.body);

  // Registrarse
  const response = await request(app)
    .post(`/api/events/${eventId}/registrations`)
    .set('Authorization', `Bearer ${participantToken}`);

  console.log('STATUS REGISTRO:', response.statusCode);
  console.log('RESPUESTA REGISTRO:', response.body);

  expect(response.statusCode).toBe(201);
  expect(response.body.message).toBe('Registro confirmado');
});

test('debe rechazar el registro en un evento sin token', async () => {
  const response = await request(app)
    .post('/api/events/507f1f77bcf86cd799439011/registrations');

  expect(response.statusCode).toBe(401);
  expect(response.body.message).toBe('No autenticado');
});

test('debe rechazar un registro con un ID de evento inválido', async () => {
  const password = '123456';
  const email = `participant_invalid_${Date.now()}@example.com`;

  await request(app)
    .post('/api/users/signup')
    .send({
      name: 'Participante',
      email,
      password,
      userType: 'participant'
    });

  const login = await request(app)
    .post('/api/users/login')
    .send({
      email,
      password
    });

  const token = login.body.token;

  const response = await request(app)
    .post('/api/events/id-invalido/registrations')
    .set('Authorization', `Bearer ${token}`);

  expect(response.statusCode).toBe(400);
  expect(response.body.message).toBe('Id de evento inválido');
});

test('debe rechazar el registro si el evento no existe', async () => {
  const password = '123456';
  const email = `participant_notfound_${Date.now()}@example.com`;

  await request(app)
    .post('/api/users/signup')
    .send({
      name: 'Participante',
      email,
      password,
      userType: 'participant'
    });

  const login = await request(app)
    .post('/api/users/login')
    .send({
      email,
      password
    });

  const token = login.body.token;

  const fakeEventId = '507f1f77bcf86cd799439011';

  const response = await request(app)
    .post(`/api/events/${fakeEventId}/registrations`)
    .set('Authorization', `Bearer ${token}`);

  expect(response.statusCode).toBe(404);
  expect(response.body.message).toBe('Evento no encontrado');
});

test('debe rechazar el registro cuando el evento está lleno', async () => {
  const password = '123456';

  // Crear organizador
  const organizerEmail = `organizer_full_${Date.now()}@example.com`;

  await request(app)
    .post('/api/users/signup')
    .send({
      name: 'Organizador',
      email: organizerEmail,
      password,
      userType: 'organizer'
    });

  const organizerLogin = await request(app)
    .post('/api/users/login')
    .send({
      email: organizerEmail,
      password
    });

  const organizerToken = organizerLogin.body.token;

  // Crear evento con un solo cupo
  const eventResponse = await request(app)
    .post('/api/events')
    .set('Authorization', `Bearer ${organizerToken}`)
    .send({
      name: 'Evento Lleno',
      description: 'Evento para probar capacidad',
      date: '2026-12-31T18:00:00.000Z',
      location: 'Cartagena',
      maxCapacity: 1,
      modality: 'in-person'
    });

  const eventId = eventResponse.body._id;

  // Crear primer participante
  const participant1Email = `participant1_${Date.now()}@example.com`;

  await request(app)
    .post('/api/users/signup')
    .send({
      name: 'Participante 1',
      email: participant1Email,
      password,
      userType: 'participant'
    });

  const participant1Login = await request(app)
    .post('/api/users/login')
    .send({
      email: participant1Email,
      password
    });

  // Primer participante ocupa el único cupo
  const firstRegistration = await request(app)
    .post(`/api/events/${eventId}/registrations`)
    .set('Authorization', `Bearer ${participant1Login.body.token}`);

  expect(firstRegistration.statusCode).toBe(201);

  // Crear segundo participante
  const participant2Email = `participant2_${Date.now()}@example.com`;

  await request(app)
    .post('/api/users/signup')
    .send({
      name: 'Participante 2',
      email: participant2Email,
      password,
      userType: 'participant'
    });

  const participant2Login = await request(app)
    .post('/api/users/login')
    .send({
      email: participant2Email,
      password
    });

  // Intentar ocupar un cupo que ya no existe
  const response = await request(app)
    .post(`/api/events/${eventId}/registrations`)
    .set('Authorization', `Bearer ${participant2Login.body.token}`);

  expect(response.statusCode).toBe(400);
  expect(response.body.message).toBe(
    'Este evento ya no tiene cupos disponibles'
  );
});
test('debe rechazar un registro duplicado en el mismo evento', async () => {
  const password = '123456';

  // Crear organizador
  const organizerEmail = `organizer_duplicate_${Date.now()}@example.com`;

  await request(app)
    .post('/api/users/signup')
    .send({
      name: 'Organizador',
      email: organizerEmail,
      password,
      userType: 'organizer'
    });

  const organizerLogin = await request(app)
    .post('/api/users/login')
    .send({
      email: organizerEmail,
      password
    });

  const organizerToken = organizerLogin.body.token;

  // Crear evento
  const eventResponse = await request(app)
    .post('/api/events')
    .set('Authorization', `Bearer ${organizerToken}`)
    .send({
      name: 'Evento Duplicado',
      description: 'Evento para probar registros duplicados',
      date: '2026-12-31T18:00:00.000Z',
      location: 'Cartagena',
      maxCapacity: 50,
      modality: 'in-person'
    });

  const eventId = eventResponse.body._id;

  // Crear participante
  const participantEmail = `participant_duplicate_${Date.now()}@example.com`;

  await request(app)
    .post('/api/users/signup')
    .send({
      name: 'Participante',
      email: participantEmail,
      password,
      userType: 'participant'
    });

  const participantLogin = await request(app)
    .post('/api/users/login')
    .send({
      email: participantEmail,
      password
    });

  const participantToken = participantLogin.body.token;

  // Primer registro
  const firstRegistration = await request(app)
    .post(`/api/events/${eventId}/registrations`)
    .set('Authorization', `Bearer ${participantToken}`);

  expect(firstRegistration.statusCode).toBe(201);

  // Segundo registro
  const response = await request(app)
    .post(`/api/events/${eventId}/registrations`)
    .set('Authorization', `Bearer ${participantToken}`);

  expect(response.statusCode).toBe(400);
  expect(response.body.message).toBe(
    'Ya estás registrado en este evento'
  );
});
test('debe permitir a un participante cancelar su propio registro', async () => {
  const password = '123456';

  // Crear organizador
  const organizerEmail = `organizer_cancel_${Date.now()}@example.com`;

  await request(app)
    .post('/api/users/signup')
    .send({
      name: 'Organizador',
      email: organizerEmail,
      password,
      userType: 'organizer'
    });

  const organizerLogin = await request(app)
    .post('/api/users/login')
    .send({
      email: organizerEmail,
      password
    });

  // Crear evento
  const eventResponse = await request(app)
    .post('/api/events')
    .set('Authorization', `Bearer ${organizerLogin.body.token}`)
    .send({
      name: 'Evento Cancelación',
      description: 'Evento para probar cancelación',
      date: '2026-12-31T18:00:00.000Z',
      location: 'Cartagena',
      maxCapacity: 50,
      modality: 'in-person'
    });

  const eventId = eventResponse.body._id;

  // Crear participante
  const participantEmail = `participant_cancel_${Date.now()}@example.com`;

  await request(app)
    .post('/api/users/signup')
    .send({
      name: 'Participante',
      email: participantEmail,
      password,
      userType: 'participant'
    });

  const participantLogin = await request(app)
    .post('/api/users/login')
    .send({
      email: participantEmail,
      password
    });

  const participantToken = participantLogin.body.token;

  // Registrarse
  const registrationResponse = await request(app)
    .post(`/api/events/${eventId}/registrations`)
    .set('Authorization', `Bearer ${participantToken}`);

  expect(registrationResponse.statusCode).toBe(201);

  const registrationId = registrationResponse.body.registration._id;

  // Cancelar registro
  const response = await request(app)
    .patch(`/api/events/${eventId}/registrations/${registrationId}/cancel`)
    .set('Authorization', `Bearer ${participantToken}`);

  expect(response.statusCode).toBe(200);
  expect(response.body.message).toBe('Registro cancelado');
  expect(response.body.registration.status).toBe('cancelled');
});
test('debe rechazar la cancelación de un registro inexistente', async () => {
  const password = '123456';
  const participantEmail = `participant_missing_${Date.now()}@example.com`;

  // Crear participante
  await request(app)
    .post('/api/users/signup')
    .send({
      name: 'Participante',
      email: participantEmail,
      password,
      userType: 'participant'
    });

  // Login
  const login = await request(app)
    .post('/api/users/login')
    .send({
      email: participantEmail,
      password
    });

  const token = login.body.token;

  // ID válido de MongoDB, pero que no corresponde a ningún registro
  const fakeRegistrationId = '507f1f77bcf86cd799439011';
  const fakeEventId = '507f1f77bcf86cd799439012';

  const response = await request(app)
    .patch(
      `/api/events/${fakeEventId}/registrations/${fakeRegistrationId}/cancel`
    )
    .set('Authorization', `Bearer ${token}`);

  expect(response.statusCode).toBe(404);
  expect(response.body.message).toBe('Registro no encontrado');
});
test('debe permitir consultar los registros de un evento', async () => {
  const password = '123456';

  // Crear organizador
  const organizerEmail = `organizer_list_${Date.now()}@example.com`;

  await request(app)
    .post('/api/users/signup')
    .send({
      name: 'Organizador',
      email: organizerEmail,
      password,
      userType: 'organizer'
    });

  const organizerLogin = await request(app)
    .post('/api/users/login')
    .send({
      email: organizerEmail,
      password
    });

  const organizerToken = organizerLogin.body.token;

  // Crear evento
  const eventResponse = await request(app)
    .post('/api/events')
    .set('Authorization', `Bearer ${organizerToken}`)
    .send({
      name: 'Evento Lista',
      description: 'Evento para consultar registros',
      date: '2026-12-31T18:00:00.000Z',
      location: 'Cartagena',
      maxCapacity: 50,
      modality: 'in-person'
    });

  const eventId = eventResponse.body._id;

  // Crear participante
  const participantEmail = `participant_list_${Date.now()}@example.com`;

  await request(app)
    .post('/api/users/signup')
    .send({
      name: 'Participante Lista',
      email: participantEmail,
      password,
      userType: 'participant'
    });

  const participantLogin = await request(app)
    .post('/api/users/login')
    .send({
      email: participantEmail,
      password
    });

  // Registrar participante
  await request(app)
    .post(`/api/events/${eventId}/registrations`)
    .set('Authorization', `Bearer ${participantLogin.body.token}`);

  // Consultar registros
  const response = await request(app)
    .get(`/api/events/${eventId}/registrations`)
    .set('Authorization', `Bearer ${organizerToken}`);

  expect(response.statusCode).toBe(200);
  expect(Array.isArray(response.body)).toBe(true);
  expect(response.body.length).toBe(1);
  expect(response.body[0].participantId.name).toBe('Participante Lista');
  expect(response.body[0].participantId.email).toBe(participantEmail);
});

