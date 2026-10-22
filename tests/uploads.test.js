const fs = require('node:fs');
const path = require('node:path');
const request = require('supertest');
const app = require('../app');
const { crearUsuario, crearEvento, datosEvento } = require('./helpers');

// PNG válido de 1x1 píxel
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);

// Los archivos subidos se guardan en public/uploads: se borran al terminar
const archivosCreados = [];

function registrarArchivo(imageUrl) {
  if (imageUrl) archivosCreados.push(path.join(__dirname, '..', 'public', imageUrl));
}

afterAll(() => {
  archivosCreados.forEach(ruta => fs.rmSync(ruta, { force: true }));
});

// Arma una petición multipart con los campos del formulario y, opcionalmente, un archivo
function conFormulario(peticion, token, datos, archivo) {
  peticion.set('Authorization', `Bearer ${token}`);
  Object.entries(datos).forEach(([campo, valor]) => peticion.field(campo, String(valor)));
  if (archivo) {
    peticion.attach('image', archivo.contenido, {
      filename: archivo.nombre,
      contentType: archivo.tipo
    });
  }
  return peticion;
}

describe('Imágenes de eventos', () => {

  test('debe crear un evento con imagen', async () => {
    const organizador = await crearUsuario('organizer');

    const response = await conFormulario(
      request(app).post('/api/events'),
      organizador.token,
      datosEvento({ name: 'Evento con imagen' }),
      { contenido: PNG, nombre: 'foto.png', tipo: 'image/png' }
    );
    registrarArchivo(response.body.imageUrl);

    expect(response.statusCode).toBe(201);
    expect(response.body.imageUrl).toMatch(/^\/uploads\/.+\.png$/);
    expect(fs.existsSync(path.join(__dirname, '..', 'public', response.body.imageUrl))).toBe(true);
  });

  test('debe rechazar un archivo que no es una imagen', async () => {
    const organizador = await crearUsuario('organizer');
    const nombre = `Evento archivo inválido ${Date.now()}`;

    const response = await conFormulario(
      request(app).post('/api/events'),
      organizador.token,
      datosEvento({ name: nombre }),
      { contenido: Buffer.from('esto no es una imagen'), nombre: 'documento.txt', tipo: 'text/plain' }
    );

    expect(response.statusCode).toBeGreaterThanOrEqual(400);

    // El evento no debe haberse creado
    const lista = await request(app).get('/api/events');
    expect(lista.body.some(ev => ev.name === nombre)).toBe(false);
  });

  test('debe permitir cambiar la imagen al editar un evento', async () => {
    const organizador = await crearUsuario('organizer');
    const eventId = await crearEvento(organizador.token, { name: 'Evento sin imagen' });

    const response = await conFormulario(
      request(app).put(`/api/events/${eventId}`),
      organizador.token,
      datosEvento({ name: 'Evento con imagen nueva' }),
      { contenido: PNG, nombre: 'nueva.png', tipo: 'image/png' }
    );
    registrarArchivo(response.body.imageUrl);

    expect(response.statusCode).toBe(200);
    expect(response.body.name).toBe('Evento con imagen nueva');
    expect(response.body.imageUrl).toMatch(/^\/uploads\/.+\.png$/);
  });
});
