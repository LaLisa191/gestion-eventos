const request = require('supertest');
const app = require('../app');

const PASSWORD = '123456';
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

// Registra un usuario, inicia sesión y devuelve su token
async function crearUsuario(userType) {
  const email = `${userType}_${Date.now()}_${siguiente()}@example.com`;

  await request(app)
    .post('/api/users/signup')
    .send({ name: `Usuario ${userType}`, email, password: PASSWORD, userType });

  const login = await request(app)
    .post('/api/users/login')
    .send({ email, password: PASSWORD });

  return login.body.token;
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

function crearEvento(token, extra) {
  return request(app)
    .post('/api/events')
    .set('Authorization', `Bearer ${token}`)
    .send(datosEvento(extra));
}

describe('Eventos', () => {

  test('debe permitir a un organizador crear un evento', async () => {
    const token = await crearUsuario('organizer');

    const response = await crearEvento(token, { maxCapacity: 100 });

    expect(response.statusCode).toBe(201);
    expect(response.body.name).toBe('Evento de prueba');
    expect(response.body.location).toBe('Cartagena');
    expect(response.body.maxCapacity).toBe(100);
  });

  test('debe rechazar la creación de un evento sin token', async () => {
    const response = await request(app)
      .post('/api/events')
      .send(datosEvento({ name: 'Evento sin autenticación' }));

    expect(response.statusCode).toBe(401);
    expect(response.body.message).toBe('No autenticado');
  });

  test('debe rechazar la creación de un evento por parte de un participante', async () => {
    const token = await crearUsuario('participant');

    const response = await crearEvento(token, { name: 'Evento no autorizado' });

    expect(response.statusCode).toBe(403);
    expect(response.body.message).toBe('Solo un organizador puede hacer esto');
  });

  test('debe rechazar la creación de un evento con datos inválidos', async () => {
    const token = await crearUsuario('organizer');

    // Fecha y lugar válidos: la API valida el resto con el modelo
    const response = await crearEvento(token, {
      name: '',
      maxCapacity: 'no-es-un-numero'
    });

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toContain('Revisa el formulario');
  });

  test('debe rechazar un evento en el mismo lugar y a la misma hora', async () => {
    const token = await crearUsuario('organizer');
    const evento = { date: fechaUnica(), location: 'Auditorio Central' };

    const primero = await crearEvento(token, evento);
    expect(primero.statusCode).toBe(201);

    const segundo = await crearEvento(token, evento);
    expect(segundo.statusCode).toBe(400);
    expect(segundo.body.message).toContain('Ya existe un evento activo');
  });

  test('debe obtener todos los eventos', async () => {
    const response = await request(app).get('/api/events');

    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });

  test('debe obtener un evento por su ID', async () => {
    const token = await crearUsuario('organizer');
    const creado = await crearEvento(token, { name: 'Evento para consultar' });
    const eventId = creado.body._id;

    const response = await request(app).get(`/api/events/${eventId}`);

    expect(response.statusCode).toBe(200);
    expect(response.body._id).toBe(eventId);
    expect(response.body.name).toBe('Evento para consultar');
    expect(response.body.availableSpots).toBe(50);
  });

  test('debe rechazar un ID de evento inválido', async () => {
    const response = await request(app).get('/api/events/id-invalido');

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe('Id de evento inválido');
  });

  test('debe devolver 404 si el evento no existe', async () => {
    const response = await request(app).get('/api/events/507f1f77bcf86cd799439011');

    expect(response.statusCode).toBe(404);
    expect(response.body.message).toBe('Evento no encontrado');
  });

  describe('edición', () => {

    test('debe permitir a un organizador editar su evento', async () => {
      const token = await crearUsuario('organizer');
      const creado = await crearEvento(token, { name: 'Evento original' });
      const nuevaFecha = fechaUnica();

      const response = await request(app)
        .put(`/api/events/${creado.body._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(datosEvento({
          name: 'Evento actualizado',
          description: 'Nueva descripción',
          date: nuevaFecha,
          maxCapacity: 100
        }));

      expect(response.statusCode).toBe(200);
      expect(response.body.name).toBe('Evento actualizado');
      expect(response.body.description).toBe('Nueva descripción');
      expect(response.body.date).toBe(nuevaFecha);
      expect(response.body.maxCapacity).toBe(100);
      expect(response.body.modality).toBe('in-person');
    });

    test('debe rechazar a un organizador al editar un evento que no le pertenece', async () => {
      const ownerToken = await crearUsuario('organizer');
      const otherToken = await crearUsuario('organizer');
      const creado = await crearEvento(ownerToken, { name: 'Evento del propietario' });

      const response = await request(app)
        .put(`/api/events/${creado.body._id}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ name: 'Intento de modificación' });

      expect(response.statusCode).toBe(403);
      expect(response.body.message).toBe('No puedes editar un evento que no organizaste');
    });

    test('debe devolver 404 al intentar editar un evento que no existe', async () => {
      const token = await crearUsuario('organizer');

      const response = await request(app)
        .put('/api/events/507f1f77bcf86cd799439011')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Evento actualizado' });

      expect(response.statusCode).toBe(404);
      expect(response.body.message).toBe('Evento no encontrado');
    });

    test('debe rechazar la edición de un evento con datos inválidos', async () => {
      const token = await crearUsuario('organizer');
      const creado = await crearEvento(token, { name: 'Evento para editar' });
      expect(creado.statusCode).toBe(201);

      // La edición recibe el formulario completo, igual que desde la página
      const response = await request(app)
        .put(`/api/events/${creado.body._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(datosEvento({ name: '', maxCapacity: 'no-es-un-numero' }));

      expect(response.statusCode).toBe(400);
      expect(response.body.message).toContain('Revisa el formulario');
    });

    test('debe rechazar editar un evento hacia un lugar y hora ya ocupados', async () => {
      const token = await crearUsuario('organizer');
      const fechaOcupada = fechaUnica();

      await crearEvento(token, { date: fechaOcupada, location: 'Sala A' });
      const segundo = await crearEvento(token, { date: fechaUnica(), location: 'Sala A' });
      expect(segundo.statusCode).toBe(201);

      const response = await request(app)
        .put(`/api/events/${segundo.body._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(datosEvento({ date: fechaOcupada, location: 'Sala A' }));

      expect(response.statusCode).toBe(400);
      expect(response.body.message).toContain('Ya existe otro evento activo');
    });
  });

  describe('eliminación', () => {

    test('debe permitir a un organizador eliminar su evento', async () => {
      const token = await crearUsuario('organizer');
      const creado = await crearEvento(token, { name: 'Evento para eliminar' });
      const eventId = creado.body._id;

      const response = await request(app)
        .delete(`/api/events/${eventId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.statusCode).toBe(200);
      expect(response.body.message).toBe('Evento eliminado');

      // Comprueba que realmente fue eliminado
      const getResponse = await request(app).get(`/api/events/${eventId}`);
      expect(getResponse.statusCode).toBe(404);
      expect(getResponse.body.message).toBe('Evento no encontrado');
    });

    test('debe rechazar a un organizador al eliminar un evento que no le pertenece', async () => {
      const ownerToken = await crearUsuario('organizer');
      const otherToken = await crearUsuario('organizer');
      const creado = await crearEvento(ownerToken, { name: 'Evento protegido' });

      const response = await request(app)
        .delete(`/api/events/${creado.body._id}`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(response.statusCode).toBe(403);
      expect(response.body.message).toBe('No puedes eliminar un evento que no organizaste');
    });

    test('debe devolver 404 al intentar eliminar un evento que no existe', async () => {
      const token = await crearUsuario('organizer');

      const response = await request(app)
        .delete('/api/events/507f1f77bcf86cd799439011')
        .set('Authorization', `Bearer ${token}`);

      expect(response.statusCode).toBe(404);
      expect(response.body.message).toBe('Evento no encontrado');
    });
  });

  describe('reportes', () => {

    test('el organizador debe poder generar un reporte de asistencia', async () => {
      const token = await crearUsuario('organizer');
      const creado = await crearEvento(token, { name: 'Evento para reporte' });
      const eventId = creado.body._id;

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
      const ownerToken = await crearUsuario('organizer');
      const otherToken = await crearUsuario('organizer');
      const creado = await crearEvento(ownerToken, { name: 'Evento ajeno' });

      const response = await request(app)
        .post(`/api/events/${creado.body._id}/reports`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(response.statusCode).toBe(403);
      expect(response.body.message).toBe(
        'No puedes generar el reporte de un evento que no organizaste'
      );
    });

    test('el organizador debe poder consultar los reportes de su evento', async () => {
      const token = await crearUsuario('organizer');
      const creado = await crearEvento(token, { name: 'Evento con reporte' });
      const eventId = creado.body._id;

      await request(app)
        .post(`/api/events/${eventId}/reports`)
        .set('Authorization', `Bearer ${token}`);

      const response = await request(app)
        .get(`/api/events/${eventId}/reports`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.statusCode).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    test('un organizador no debe poder consultar los reportes de un evento ajeno', async () => {
      const ownerToken = await crearUsuario('organizer');
      const otherToken = await crearUsuario('organizer');
      const creado = await crearEvento(ownerToken, { name: 'Evento privado' });

      const response = await request(app)
        .get(`/api/events/${creado.body._id}/reports`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(response.statusCode).toBe(403);
      expect(response.body.message).toBe(
        'No puedes ver los reportes de un evento que no organizaste'
      );
    });
  });
});
