const request = require('supertest');
const app = require('../app');
const { enviarConfirmacionRegistro } = require('../utils/mailer'); // simulado en jest.setup.js

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

// Registra un usuario, inicia sesión y devuelve su token y su correo
async function crearUsuario(userType, name = `Usuario ${userType}`) {
  const email = `${userType}_${Date.now()}_${siguiente()}@example.com`;

  await request(app)
    .post('/api/users/signup')
    .send({ name, email, password: PASSWORD, userType });

  const login = await request(app)
    .post('/api/users/login')
    .send({ email, password: PASSWORD });

  return { token: login.body.token, email };
}

// Crea un evento válido y devuelve su id
async function crearEvento(tokenOrganizador, extra = {}) {
  const response = await request(app)
    .post('/api/events')
    .set('Authorization', `Bearer ${tokenOrganizador}`)
    .send({
      name: 'Evento de registro',
      description: 'Evento para probar inscripciones',
      date: fechaUnica(),
      location: 'Cartagena',
      maxCapacity: 50,
      modality: 'in-person',
      ...extra
    });

  expect(response.statusCode).toBe(201);
  return response.body._id;
}

function registrar(eventId, token) {
  return request(app)
    .post(`/api/events/${eventId}/registrations`)
    .set('Authorization', `Bearer ${token}`);
}

function cancelar(eventId, registrationId, token) {
  return request(app)
    .patch(`/api/events/${eventId}/registrations/${registrationId}/cancel`)
    .set('Authorization', `Bearer ${token}`);
}

function eliminar(eventId, registrationId, token) {
  return request(app)
    .delete(`/api/events/${eventId}/registrations/${registrationId}`)
    .set('Authorization', `Bearer ${token}`);
}

describe('Registro en eventos', () => {

  test('debe permitir a un participante registrarse en un evento', async () => {
    const organizador = await crearUsuario('organizer');
    const participante = await crearUsuario('participant');
    const eventId = await crearEvento(organizador.token);

    const response = await registrar(eventId, participante.token);

    expect(response.statusCode).toBe(201);
    expect(response.body.message).toBe('Registro confirmado');
    expect(response.body.registration.status).toBe('confirmed');
    expect(enviarConfirmacionRegistro).toHaveBeenCalledWith(participante.email, expect.anything());
  });

  test('debe confirmar el registro aunque falle el envío del correo', async () => {
    const organizador = await crearUsuario('organizer');
    const participante = await crearUsuario('participant');
    const eventId = await crearEvento(organizador.token);

    const espia = jest.spyOn(console, 'error').mockImplementation(() => {});
    enviarConfirmacionRegistro.mockRejectedValueOnce(new Error('SMTP caído'));

    try {
      const response = await registrar(eventId, participante.token);
      await new Promise(resolve => setImmediate(resolve)); // deja correr el catch del correo

      expect(response.statusCode).toBe(201);
      expect(espia).toHaveBeenCalledWith('No se pudo enviar el correo de confirmación:', 'SMTP caído');
    } finally {
      espia.mockRestore();
    }
  });

  test('debe rechazar el registro en un evento sin token', async () => {
    const response = await request(app)
      .post(`/api/events/${ID_INEXISTENTE}/registrations`);

    expect(response.statusCode).toBe(401);
    expect(response.body.message).toBe('No autenticado');
  });

  test('debe rechazar un registro con un ID de evento inválido', async () => {
    const participante = await crearUsuario('participant');

    const response = await registrar('id-invalido', participante.token);

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe('Id de evento inválido');
  });

  test('debe rechazar el registro si el evento no existe', async () => {
    const participante = await crearUsuario('participant');

    const response = await registrar(ID_INEXISTENTE, participante.token);

    expect(response.statusCode).toBe(404);
    expect(response.body.message).toBe('Evento no encontrado');
  });

  test('debe rechazar el registro cuando el evento está lleno', async () => {
    const organizador = await crearUsuario('organizer');
    const participante1 = await crearUsuario('participant', 'Participante 1');
    const participante2 = await crearUsuario('participant', 'Participante 2');
    const eventId = await crearEvento(organizador.token, { name: 'Evento lleno', maxCapacity: 1 });

    const primero = await registrar(eventId, participante1.token);
    expect(primero.statusCode).toBe(201);

    const response = await registrar(eventId, participante2.token);

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe('Este evento ya no tiene cupos disponibles');
  });

  test('debe rechazar un registro duplicado en el mismo evento', async () => {
    const organizador = await crearUsuario('organizer');
    const participante = await crearUsuario('participant');
    const eventId = await crearEvento(organizador.token, { name: 'Evento duplicado' });

    const primero = await registrar(eventId, participante.token);
    expect(primero.statusCode).toBe(201);

    const response = await registrar(eventId, participante.token);

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe('Ya estás registrado en este evento');
  });
});

describe('Cancelación de registros', () => {

  test('debe permitir a un participante cancelar su propio registro', async () => {
    const organizador = await crearUsuario('organizer');
    const participante = await crearUsuario('participant');
    const eventId = await crearEvento(organizador.token, { name: 'Evento cancelación' });

    const registro = await registrar(eventId, participante.token);
    expect(registro.statusCode).toBe(201);

    const response = await cancelar(eventId, registro.body.registration._id, participante.token);

    expect(response.statusCode).toBe(200);
    expect(response.body.message).toBe('Registro cancelado');
    expect(response.body.registration.status).toBe('cancelled');
  });

  test('debe rechazar la cancelación de un registro inexistente', async () => {
    const participante = await crearUsuario('participant');

    const response = await cancelar('507f1f77bcf86cd799439012', ID_INEXISTENTE, participante.token);

    expect(response.statusCode).toBe(404);
    expect(response.body.message).toBe('Registro no encontrado');
  });

  test('debe rechazar la cancelación de un registro ajeno', async () => {
    const organizador = await crearUsuario('organizer');
    const dueno = await crearUsuario('participant');
    const intruso = await crearUsuario('participant');
    const eventId = await crearEvento(organizador.token, { name: 'Evento registro ajeno' });

    const registro = await registrar(eventId, dueno.token);
    expect(registro.statusCode).toBe(201);

    const response = await cancelar(eventId, registro.body.registration._id, intruso.token);

    expect(response.statusCode).toBe(403);
    expect(response.body.message).toBe('No puedes cancelar un registro que no es tuyo');
  });

  test('cancelar un registro debe liberar el cupo', async () => {
    const organizador = await crearUsuario('organizer');
    const participante1 = await crearUsuario('participant', 'Participante 1');
    const participante2 = await crearUsuario('participant', 'Participante 2');
    const eventId = await crearEvento(organizador.token, { name: 'Evento un cupo', maxCapacity: 1 });

    const primero = await registrar(eventId, participante1.token);
    expect(primero.statusCode).toBe(201);

    await cancelar(eventId, primero.body.registration._id, participante1.token);

    const response = await registrar(eventId, participante2.token);
    expect(response.statusCode).toBe(201);
  });
});

describe('Eliminación de registros cancelados', () => {

  test('debe permitir eliminar una inscripción cancelada', async () => {
    const organizador = await crearUsuario('organizer');
    const participante = await crearUsuario('participant');
    const eventId = await crearEvento(organizador.token, { name: 'Evento eliminar registro' });

    const registro = await registrar(eventId, participante.token);
    const registrationId = registro.body.registration._id;
    await cancelar(eventId, registrationId, participante.token);

    const response = await eliminar(eventId, registrationId, participante.token);

    expect(response.statusCode).toBe(200);
    expect(response.body.message).toBe('Registro eliminado');

    // Ya no debe poder cancelarse: el registro dejó de existir
    const repetido = await cancelar(eventId, registrationId, participante.token);
    expect(repetido.statusCode).toBe(404);
  });

  test('debe rechazar eliminar una inscripción que sigue confirmada', async () => {
    const organizador = await crearUsuario('organizer');
    const participante = await crearUsuario('participant');
    const eventId = await crearEvento(organizador.token, { name: 'Evento sin cancelar' });

    const registro = await registrar(eventId, participante.token);

    const response = await eliminar(eventId, registro.body.registration._id, participante.token);

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe('Solo puedes eliminar inscripciones canceladas');
  });

  test('debe rechazar eliminar con ids inválidos', async () => {
    const participante = await crearUsuario('participant');

    const response = await eliminar('id-invalido', 'otro-invalido', participante.token);

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe('Id inválido');
  });

  test('debe devolver 404 al eliminar un registro inexistente', async () => {
    const participante = await crearUsuario('participant');

    const response = await eliminar('507f1f77bcf86cd799439012', ID_INEXISTENTE, participante.token);

    expect(response.statusCode).toBe(404);
    expect(response.body.message).toBe('Registro no encontrado');
  });

  test('debe rechazar eliminar el registro de otro participante', async () => {
    const organizador = await crearUsuario('organizer');
    const dueno = await crearUsuario('participant');
    const intruso = await crearUsuario('participant');
    const eventId = await crearEvento(organizador.token, { name: 'Evento eliminar ajeno' });

    const registro = await registrar(eventId, dueno.token);

    const response = await eliminar(eventId, registro.body.registration._id, intruso.token);

    expect(response.statusCode).toBe(403);
    expect(response.body.message).toBe('No puedes eliminar un registro que no es tuyo');
  });
});

describe('Consulta de registros de un evento', () => {

  test('debe permitir consultar los registros de un evento', async () => {
    const organizador = await crearUsuario('organizer');
    const participante = await crearUsuario('participant', 'Participante Lista');
    const eventId = await crearEvento(organizador.token, { name: 'Evento lista' });

    await registrar(eventId, participante.token);

    const response = await request(app)
      .get(`/api/events/${eventId}/registrations`)
      .set('Authorization', `Bearer ${organizador.token}`);

    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBe(1);
    expect(response.body[0].participantId.name).toBe('Participante Lista');
    expect(response.body[0].participantId.email).toBe(participante.email);
  });

  test('debe rechazar la consulta de registros sin token', async () => {
    const response = await request(app)
      .get(`/api/events/${ID_INEXISTENTE}/registrations`);

    expect(response.statusCode).toBe(401);
    expect(response.body.message).toBe('No autenticado');
  });

  test('debe rechazar la consulta de registros con un ID de evento inválido', async () => {
    const organizador = await crearUsuario('organizer');

    const response = await request(app)
      .get('/api/events/id-invalido/registrations')
      .set('Authorization', `Bearer ${organizador.token}`);

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe('Id de evento inválido');
  });

  test('debe rechazar la consulta de registros a un participante', async () => {
    const organizador = await crearUsuario('organizer');
    const participante = await crearUsuario('participant');
    const eventId = await crearEvento(organizador.token, { name: 'Evento solo organizador' });

    const response = await request(app)
      .get(`/api/events/${eventId}/registrations`)
      .set('Authorization', `Bearer ${participante.token}`);

    expect(response.statusCode).toBe(403);
    expect(response.body.message).toBe('Solo un organizador puede hacer esto');
  });

  test('debe rechazar la consulta de registros a un organizador que no es el dueño', async () => {
    const dueno = await crearUsuario('organizer');
    const otro = await crearUsuario('organizer');
    const eventId = await crearEvento(dueno.token, { name: 'Evento ajeno' });

    const response = await request(app)
      .get(`/api/events/${eventId}/registrations`)
      .set('Authorization', `Bearer ${otro.token}`);

    expect(response.statusCode).toBe(403);
    expect(response.body.message).toBe('No puedes ver los registros de un evento que no organizaste');
  });

  test('debe devolver 404 al consultar los registros de un evento que no existe', async () => {
    const organizador = await crearUsuario('organizer');

    const response = await request(app)
      .get(`/api/events/${ID_INEXISTENTE}/registrations`)
      .set('Authorization', `Bearer ${organizador.token}`);

    expect(response.statusCode).toBe(404);
    expect(response.body.message).toBe('Evento no encontrado');
  });
});
