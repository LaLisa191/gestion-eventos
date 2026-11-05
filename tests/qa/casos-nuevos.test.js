// Casos de prueba nuevos del expediente de aseguramiento de la calidad (hito 4).
// Cada prueba empieza con el ID del caso (TC-nn) del apartado 14 del expediente.
// Se escriben contra el comportamiento ESPERADO por el requisito: si una falla,
// el resultado se registra como defecto (D-nn) y no se ajusta la prueba para que pase.
const request = require('supertest');
const app = require('../../app');
const Event = require('../../models/Event');
const { enviarConfirmacionRegistro } = require('../../utils/mailer'); // simulado en jest.setup.js
const { crearUsuario, datosEvento, crearEvento } = require('../helpers');

const auth = (token) => ({ Authorization: `Bearer ${token}` });

function registrar(eventId, token) {
  return request(app).post(`/api/events/${eventId}/registrations`).set(auth(token));
}

describe('TC-03 · RF-01 · Cupo en el límite (R-05)', () => {
  test.each([[0], [-5]])('rechaza crear un evento con cupo %i', async (cupo) => {
    const { token } = await crearUsuario('organizer');

    const response = await request(app)
      .post('/api/events')
      .set(auth(token))
      .send(datosEvento({ maxCapacity: cupo }));

    expect(response.statusCode).toBe(400);
  });

  test('acepta crear un evento con cupo 1', async () => {
    const { token } = await crearUsuario('organizer');

    const response = await request(app)
      .post('/api/events')
      .set(auth(token))
      .send(datosEvento({ maxCapacity: 1 }));

    expect(response.statusCode).toBe(201);
    expect(response.body.maxCapacity).toBe(1);
  });
});

describe('TC-04 · RF-01 · Evento sin lugar (R-05)', () => {
  test('responde 400 con un mensaje comprensible, sin texto técnico de la excepción', async () => {
    const { token } = await crearUsuario('organizer');
    const { location, ...sinLugar } = datosEvento();

    const response = await request(app).post('/api/events').set(auth(token)).send(sinLugar);

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toEqual(expect.any(String));
    expect(response.body.message).not.toMatch(/cannot read propert|undefined|trim/i);
  });
});

describe('TC-09 · RF-03 · Eliminar un evento con inscritos (R-09)', () => {
  test('"Mis inscripciones" no devuelve inscripciones con evento nulo tras eliminar el evento', async () => {
    const organizador = await crearUsuario('organizer');
    const participante = await crearUsuario('participant');
    const eventId = await crearEvento(organizador.token);

    const inscripcion = await registrar(eventId, participante.token);
    expect(inscripcion.statusCode).toBe(201);

    const eliminado = await request(app).delete(`/api/events/${eventId}`).set(auth(organizador.token));
    expect(eliminado.statusCode).toBe(200);

    const misInscripciones = await request(app)
      .get('/api/users/me/registrations')
      .set(auth(participante.token));

    expect(misInscripciones.statusCode).toBe(200);
    expect(misInscripciones.body.filter((r) => r.eventId === null)).toHaveLength(0);
  });
});

describe('TC-14 · RF-06 · Inscripción en un evento cancelado o ya pasado (R-04)', () => {
  test('rechaza la inscripción en un evento cuya fecha ya venció', async () => {
    const organizador = await crearUsuario('organizer');
    const participante = await crearUsuario('participant');
    const eventId = await crearEvento(organizador.token);
    await Event.updateOne({ _id: eventId }, { date: new Date(Date.now() - 24 * 60 * 60 * 1000) });

    const response = await registrar(eventId, participante.token);

    expect(response.statusCode).toBe(400);
  });

  test('rechaza la inscripción en un evento con estado cancelado', async () => {
    const organizador = await crearUsuario('organizer');
    const participante = await crearUsuario('participant');
    const eventId = await crearEvento(organizador.token);
    await Event.updateOne({ _id: eventId }, { status: 'cancelled' });

    const response = await registrar(eventId, participante.token);

    expect(response.statusCode).toBe(400);
  });
});

describe('TC-19 · RF-09 · Cancelar por la ruta de otro evento (R-07)', () => {
  test('no cancela un registro cuando la ruta usa un evento distinto al del registro', async () => {
    const organizador = await crearUsuario('organizer');
    const participante = await crearUsuario('participant');
    const eventoA = await crearEvento(organizador.token, { name: 'Evento A' });
    const eventoB = await crearEvento(organizador.token, { name: 'Evento B' });
    const inscripcion = await registrar(eventoA, participante.token);
    const registrationId = inscripcion.body.registration._id;

    const response = await request(app)
      .patch(`/api/events/${eventoB}/registrations/${registrationId}/cancel`)
      .set(auth(participante.token));

    expect([400, 404]).toContain(response.statusCode);

    const mias = await request(app).get('/api/users/me/registrations').set(auth(participante.token));
    const registro = mias.body.find((r) => r._id === registrationId);
    expect(registro.status).toBe('confirmed');
  });
});

describe('TC-24 · RF-13 · Reporte de asistencia con inscritos', () => {
  test('cuenta solo las inscripciones confirmadas, lista a cada participante y ordena del más reciente', async () => {
    const organizador = await crearUsuario('organizer');
    const p1 = await crearUsuario('participant', 'Participante Uno');
    const p2 = await crearUsuario('participant', 'Participante Dos');
    const p3 = await crearUsuario('participant', 'Participante Tres');
    const eventId = await crearEvento(organizador.token, { maxCapacity: 10 });

    await registrar(eventId, p1.token);
    await registrar(eventId, p2.token);
    const tercera = await registrar(eventId, p3.token);
    await request(app)
      .patch(`/api/events/${eventId}/registrations/${tercera.body.registration._id}/cancel`)
      .set(auth(p3.token));

    const primero = await request(app).post(`/api/events/${eventId}/reports`).set(auth(organizador.token));
    expect(primero.statusCode).toBe(201);
    expect(primero.body.data.totalRegistered).toBe(2);
    expect(primero.body.data.participants).toHaveLength(2);
    const correos = primero.body.data.participants.map((p) => p.email);
    expect(correos).toEqual(expect.arrayContaining([p1.email, p2.email]));
    expect(correos).not.toContain(p3.email);
    primero.body.data.participants.forEach((p) => {
      expect(p.name).toEqual(expect.any(String));
      expect(p.email).toEqual(expect.any(String));
    });

    await request(app).post(`/api/events/${eventId}/reports`).set(auth(organizador.token));
    const lista = await request(app).get(`/api/events/${eventId}/reports`).set(auth(organizador.token));

    expect(lista.statusCode).toBe(200);
    expect(lista.body).toHaveLength(2);
    expect(new Date(lista.body[0].generatedAt).getTime())
      .toBeGreaterThanOrEqual(new Date(lista.body[1].generatedAt).getTime());
  });
});

describe('TC-29 · RNF-03 · Tiempo de respuesta de la inscripción con correo lento', () => {
  afterEach(() => {
    enviarConfirmacionRegistro.mockReset();
    enviarConfirmacionRegistro.mockResolvedValue(undefined);
  });

  test('el percentil 95 del tiempo de respuesta es menor a 1 s con el correo demorado 5 s (30 solicitudes)', async () => {
    enviarConfirmacionRegistro.mockImplementation(() => new Promise((resolve) => {
      const temporizador = setTimeout(resolve, 5000);
      temporizador.unref();
    }));

    const organizador = await crearUsuario('organizer');
    const eventId = await crearEvento(organizador.token, { maxCapacity: 40 });
    const participantes = [];
    for (let i = 0; i < 30; i += 1) {
      participantes.push(await crearUsuario('participant'));
    }

    const tiempos = [];
    for (const participante of participantes) {
      const inicio = process.hrtime.bigint();
      const response = await registrar(eventId, participante.token);
      tiempos.push(Number(process.hrtime.bigint() - inicio) / 1e6);
      expect(response.statusCode).toBe(201);
    }

    tiempos.sort((a, b) => a - b);
    const p95 = tiempos[Math.ceil(0.95 * tiempos.length) - 1];
    console.log(`TC-29 p95 = ${p95.toFixed(0)} ms (máximo ${tiempos.at(-1).toFixed(0)} ms, n = ${tiempos.length})`);
    expect(p95).toBeLessThan(1000);
  }, 60000);
});
