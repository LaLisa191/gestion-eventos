const request = require('supertest');
const QRCode = require('qrcode');
const app = require('../app');
const Event = require('../models/Event');
const { ID_INEXISTENTE, crearUsuario, crearEvento } = require('./helpers');

// En app.js el router se monta en /api/events/qr y su ruta es /:id/qr
const rutaQR = (id) => `/api/events/qr/${id}/qr`;

describe('GET /api/events/qr/:id/qr', () => {

  test('debe generar el QR de un evento activo', async () => {
    const organizador = await crearUsuario('organizer');
    const eventId = await crearEvento(organizador.token, { name: 'Evento con QR' });

    const response = await request(app).get(rutaQR(eventId));

    expect(response.statusCode).toBe(200);
    expect(response.body.eventId).toBe(eventId);
    expect(response.body.url).toContain(`/register.html?event=${eventId}`);
    expect(response.body.qr).toMatch(/^data:image\/png;base64,/);
  });

  test('debe rechazar un ID de evento inválido', async () => {
    const response = await request(app).get(rutaQR('id-invalido'));

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe('Id de evento inválido');
  });

  test('debe devolver 404 si el evento no existe', async () => {
    const response = await request(app).get(rutaQR(ID_INEXISTENTE));

    expect(response.statusCode).toBe(404);
    expect(response.body.message).toBe('Evento no disponible');
  });

  test('debe devolver 404 si el evento no está activo', async () => {
    const organizador = await crearUsuario('organizer');
    const eventId = await crearEvento(organizador.token, { name: 'Evento cancelado' });
    await Event.findByIdAndUpdate(eventId, { status: 'cancelled' });

    const response = await request(app).get(rutaQR(eventId));

    expect(response.statusCode).toBe(404);
    expect(response.body.message).toBe('Evento no disponible');
  });

  test('debe devolver 500 si falla la generación del QR', async () => {
    const organizador = await crearUsuario('organizer');
    const eventId = await crearEvento(organizador.token, { name: 'Evento QR con error' });

    const silenciarError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const fallo = jest.spyOn(QRCode, 'toDataURL').mockRejectedValueOnce(new Error('fallo simulado'));

    try {
      const response = await request(app).get(rutaQR(eventId));

      expect(response.statusCode).toBe(500);
      expect(response.body.message).toBe('No se pudo generar el QR');
    } finally {
      fallo.mockRestore();
      silenciarError.mockRestore();
    }
  });
});
