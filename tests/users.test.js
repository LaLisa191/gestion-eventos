const request = require('supertest');
const app = require('../app');
const User = require('../models/User');
const Registration = require('../models/Registration');
const { PASSWORD, correoUnico, crearUsuario, crearEvento } = require('./helpers');

const auth = (token) => ({ Authorization: `Bearer ${token}` });

function datosSignup(extra = {}) {
  return {
    name: 'Usuario Test',
    email: correoUnico('test'),
    password: PASSWORD,
    userType: 'participant',
    ...extra
  };
}

function registrar(eventId, token) {
  return request(app).post(`/api/events/${eventId}/registrations`).set(auth(token));
}

function cancelar(eventId, registrationId, token) {
  return request(app)
    .patch(`/api/events/${eventId}/registrations/${registrationId}/cancel`)
    .set(auth(token));
}

function actualizarPerfil(token, datos) {
  return request(app).put('/api/users/me').set(auth(token)).send(datos);
}

// Hace fallar una vez un método de la base de datos (para probar los catch) y lo restaura siempre
async function simularFallo(objeto, metodo, error, accion) {
  const espia = jest.spyOn(objeto, metodo).mockImplementationOnce(() => { throw error; });
  try {
    return await accion();
  } finally {
    espia.mockRestore();
  }
}

describe('POST /api/users/signup', () => {

  test('debe registrar un usuario correctamente', async () => {
    const response = await request(app).post('/api/users/signup').send(datosSignup());

    expect(response.statusCode).toBe(201);
    expect(response.body).toHaveProperty('id');
    expect(response.body.name).toBe('Usuario Test');
    expect(response.body.userType).toBe('participant');
  });

  test('debe rechazar el registro si faltan campos', async () => {
    const response = await request(app)
      .post('/api/users/signup')
      .send({ name: 'Usuario Test', email: correoUnico('incompleto') });

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe('Todos los campos son obligatorios');
  });

  test('debe rechazar un correo con formato inválido', async () => {
    const response = await request(app)
      .post('/api/users/signup')
      .send(datosSignup({ email: 'correo-sin-arroba' }));

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe('Escribe un correo con formato válido');
  });

  test('debe rechazar una contraseña de menos de 6 caracteres', async () => {
    const response = await request(app)
      .post('/api/users/signup')
      .send(datosSignup({ password: '12345' }));

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe('La contraseña debe tener al menos 6 caracteres');
  });

  test('debe rechazar un correo que ya está registrado', async () => {
    const datos = datosSignup();

    const primero = await request(app).post('/api/users/signup').send(datos);
    expect(primero.statusCode).toBe(201);

    const response = await request(app)
      .post('/api/users/signup')
      .send({ ...datos, name: 'Otro Usuario' });

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe('Ya existe una cuenta con ese correo');
  });

  test.each([
    [
      'un error de validación',
      Object.assign(new Error('x'), { name: 'ValidationError', errors: { userType: { message: 'tipo inválido' } } }),
      'Revisa el formulario: tipo inválido'
    ],
    ['una clave duplicada', Object.assign(new Error('x'), { code: 11000 }), 'Ya existe un registro con esos datos.'],
    ['un error inesperado', new Error('fallo inesperado'), 'fallo inesperado']
  ])('debe responder 400 si la base de datos devuelve %s', async (_caso, error, mensaje) => {
    const response = await simularFallo(User, 'create', error, () =>
      request(app).post('/api/users/signup').send(datosSignup())
    );

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe(mensaje);
  });
});

describe('POST /api/users/login', () => {

  test('debe iniciar sesión con credenciales correctas', async () => {
    const datos = datosSignup({ name: 'Usuario Login' });
    await request(app).post('/api/users/signup').send(datos);

    const response = await request(app)
      .post('/api/users/login')
      .send({ email: datos.email, password: PASSWORD });

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('token');
    expect(response.body.user.email).toBe(datos.email);
    expect(response.body.user.name).toBe('Usuario Login');
  });

  test('debe rechazar el login de un usuario inexistente', async () => {
    const response = await request(app)
      .post('/api/users/login')
      .send({ email: correoUnico('noexiste'), password: PASSWORD });

    expect(response.statusCode).toBe(401);
    expect(response.body.message).toBe('Correo o contraseña incorrectos');
  });

  test('debe rechazar una contraseña incorrecta', async () => {
    const datos = datosSignup();
    await request(app).post('/api/users/signup').send(datos);

    const response = await request(app)
      .post('/api/users/login')
      .send({ email: datos.email, password: '654321' });

    expect(response.statusCode).toBe(401);
    expect(response.body.message).toBe('Correo o contraseña incorrectos');
  });

  test('debe responder 500 si falla la base de datos', async () => {
    const response = await simularFallo(User, 'findOne', new Error('fallo de base de datos'), () =>
      request(app).post('/api/users/login').send({ email: correoUnico('x'), password: PASSWORD })
    );

    expect(response.statusCode).toBe(500);
    expect(response.body.message).toBe('fallo de base de datos');
  });
});

describe('Autenticación', () => {

  test('debe rechazar una petición sin token', async () => {
    const response = await request(app).get('/api/users/me/registrations');

    expect(response.statusCode).toBe(401);
    expect(response.body.message).toBe('No autenticado');
  });

  test('debe rechazar un token inválido', async () => {
    const silenciarAviso = jest.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      const response = await request(app)
        .get('/api/users/me/registrations')
        .set('Authorization', 'Bearer token-falso');

      expect(response.statusCode).toBe(401);
      expect(response.body.message).toBe('Token inválido o expirado');
    } finally {
      silenciarAviso.mockRestore();
    }
  });
});

describe('Mis inscripciones', () => {

  test('debe devolver una lista vacía si no hay inscripciones', async () => {
    const participante = await crearUsuario('participant');

    const response = await request(app).get('/api/users/me/registrations').set(auth(participante.token));

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual([]);
  });

  test('debe listar las inscripciones del usuario con los datos del evento', async () => {
    const organizador = await crearUsuario('organizer');
    const participante = await crearUsuario('participant');
    const eventId = await crearEvento(organizador.token, { name: 'Evento inscrito' });
    await registrar(eventId, participante.token);

    const response = await request(app).get('/api/users/me/registrations').set(auth(participante.token));

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].eventId.name).toBe('Evento inscrito');
  });

  test('debe responder 500 si falla la consulta', async () => {
    const participante = await crearUsuario('participant');

    const response = await simularFallo(Registration, 'find', new Error('fallo de consulta'), () =>
      request(app).get('/api/users/me/registrations').set(auth(participante.token))
    );

    expect(response.statusCode).toBe(500);
    expect(response.body.message).toBe('fallo de consulta');
  });

  test('debe eliminar solo las inscripciones canceladas', async () => {
    const organizador = await crearUsuario('organizer');
    const participante = await crearUsuario('participant');
    const eventoA = await crearEvento(organizador.token, { name: 'Evento cancelado' });
    const eventoB = await crearEvento(organizador.token, { name: 'Evento vigente' });

    const registroA = await registrar(eventoA, participante.token);
    await registrar(eventoB, participante.token);
    await cancelar(eventoA, registroA.body.registration._id, participante.token);

    const response = await request(app)
      .delete('/api/users/me/registrations/cancelled')
      .set(auth(participante.token));

    expect(response.statusCode).toBe(200);
    expect(response.body.deleted).toBe(1);

    const restantes = await request(app).get('/api/users/me/registrations').set(auth(participante.token));
    expect(restantes.body).toHaveLength(1);
    expect(restantes.body[0].status).toBe('confirmed');
  });

  test('debe rechazar la limpieza de canceladas sin token', async () => {
    const response = await request(app).delete('/api/users/me/registrations/cancelled');

    expect(response.statusCode).toBe(401);
  });

  test('debe responder 500 si falla la limpieza de canceladas', async () => {
    const participante = await crearUsuario('participant');

    const response = await simularFallo(Registration, 'deleteMany', new Error('fallo al borrar'), () =>
      request(app).delete('/api/users/me/registrations/cancelled').set(auth(participante.token))
    );

    expect(response.statusCode).toBe(500);
    expect(response.body.message).toBe('fallo al borrar');
  });
});

describe('PUT /api/users/me', () => {

  test('debe permitir actualizar el nombre del usuario', async () => {
    const usuario = await crearUsuario('participant', 'Nombre Original');

    const response = await actualizarPerfil(usuario.token, { name: 'Nombre Actualizado' });

    expect(response.statusCode).toBe(200);
    expect(response.body.name).toBe('Nombre Actualizado');
    expect(response.body.email).toBe(usuario.email);
  });

  test('debe permitir actualizar el correo del usuario', async () => {
    const usuario = await crearUsuario('participant');
    const nuevoCorreo = correoUnico('nuevo');

    const response = await actualizarPerfil(usuario.token, { email: nuevoCorreo });

    expect(response.statusCode).toBe(200);
    expect(response.body.email).toBe(nuevoCorreo);
  });

  test('debe rechazar actualizar el correo a uno con formato inválido', async () => {
    const usuario = await crearUsuario('participant');

    const response = await actualizarPerfil(usuario.token, { email: 'correo-sin-arroba' });

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe('Escribe un correo con formato válido');
  });

  test('debe rechazar actualizar el correo a uno que ya existe', async () => {
    const usuarioA = await crearUsuario('participant');
    const usuarioB = await crearUsuario('participant');

    const response = await actualizarPerfil(usuarioA.token, { email: usuarioB.email });

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe('Ya existe una cuenta con ese correo');
  });

  test('no debe permitir cambiar a una contraseña menor de 6 caracteres', async () => {
    const usuario = await crearUsuario('participant');

    const response = await actualizarPerfil(usuario.token, { currentPassword: PASSWORD, newPassword: '123' });

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe('La nueva contraseña debe tener al menos 6 caracteres');
  });

  test('no debe permitir cambiar la contraseña sin la contraseña actual', async () => {
    const usuario = await crearUsuario('participant');

    const response = await actualizarPerfil(usuario.token, { newPassword: '654321' });

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe('Debes ingresar tu contraseña actual para cambiarla');
  });

  test('no debe permitir cambiar la contraseña si la actual es incorrecta', async () => {
    const usuario = await crearUsuario('participant');

    const response = await actualizarPerfil(usuario.token, {
      currentPassword: 'contraseñaIncorrecta',
      newPassword: '654321'
    });

    expect(response.statusCode).toBe(401);
    expect(response.body.message).toBe('La contraseña actual no es correcta');
  });

  test('debe permitir cambiar la contraseña correctamente', async () => {
    const usuario = await crearUsuario('participant');

    const response = await actualizarPerfil(usuario.token, {
      currentPassword: PASSWORD,
      newPassword: '654321'
    });
    expect(response.statusCode).toBe(200);

    // La nueva contraseña debe funcionar y la anterior ya no
    const nuevoLogin = await request(app)
      .post('/api/users/login')
      .send({ email: usuario.email, password: '654321' });
    expect(nuevoLogin.statusCode).toBe(200);
    expect(nuevoLogin.body.token).toBeDefined();

    const loginViejo = await request(app)
      .post('/api/users/login')
      .send({ email: usuario.email, password: PASSWORD });
    expect(loginViejo.statusCode).toBe(401);
  });

  test('debe responder 400 si falla el guardado', async () => {
    const usuario = await crearUsuario('participant');

    const response = await simularFallo(User.prototype, 'save', new Error('fallo al guardar'), () =>
      actualizarPerfil(usuario.token, { name: 'Otro nombre' })
    );

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe('fallo al guardar');
  });
});

describe('Eventos favoritos', () => {

  test('debe rechazar la consulta de favoritos sin token', async () => {
    const response = await request(app).get('/api/users/me/favorites');

    expect(response.statusCode).toBe(401);
    expect(response.body.message).toBe('No autenticado');
  });

  test('debe devolver una lista vacía si no hay favoritos', async () => {
    const usuario = await crearUsuario('participant');

    const response = await request(app).get('/api/users/me/favorites').set(auth(usuario.token));

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual([]);
  });

  test('debe agregar un evento a favoritos sin duplicarlo', async () => {
    const organizador = await crearUsuario('organizer');
    const usuario = await crearUsuario('participant');
    const eventId = await crearEvento(organizador.token, { name: 'Evento favorito' });

    const primero = await request(app).post(`/api/users/me/favorites/${eventId}`).set(auth(usuario.token));
    expect(primero.statusCode).toBe(200);
    expect(primero.body.favorites).toEqual([eventId]);

    // Agregarlo otra vez no lo duplica
    const segundo = await request(app).post(`/api/users/me/favorites/${eventId}`).set(auth(usuario.token));
    expect(segundo.statusCode).toBe(200);
    expect(segundo.body.favorites).toEqual([eventId]);

    const lista = await request(app).get('/api/users/me/favorites').set(auth(usuario.token));
    expect(lista.body).toHaveLength(1);
    expect(lista.body[0].name).toBe('Evento favorito');
  });

  test('debe quitar un evento de favoritos', async () => {
    const organizador = await crearUsuario('organizer');
    const usuario = await crearUsuario('participant');
    const eventId = await crearEvento(organizador.token, { name: 'Evento a quitar' });
    await request(app).post(`/api/users/me/favorites/${eventId}`).set(auth(usuario.token));

    const response = await request(app).delete(`/api/users/me/favorites/${eventId}`).set(auth(usuario.token));

    expect(response.statusCode).toBe(200);
    expect(response.body.favorites).toEqual([]);
  });

  test('debe rechazar agregar a favoritos un id inválido', async () => {
    const usuario = await crearUsuario('participant');

    const response = await request(app).post('/api/users/me/favorites/id-invalido').set(auth(usuario.token));

    expect(response.statusCode).toBe(400);
  });

  test('debe responder 400 si falla al quitar un favorito', async () => {
    const usuario = await crearUsuario('participant');

    const response = await simularFallo(User.prototype, 'save', new Error('fallo al guardar'), () =>
      request(app).delete('/api/users/me/favorites/507f1f77bcf86cd799439011').set(auth(usuario.token))
    );

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe('fallo al guardar');
  });
});
