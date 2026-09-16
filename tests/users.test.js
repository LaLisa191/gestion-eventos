const request = require('supertest');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const app = require('../app');

describe('POST /api/users/signup', () => {

  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  test('debe registrar un usuario correctamente', async () => {

    const response = await request(app)
      .post('/api/users/signup')
      .send({
        name: 'Usuario Test',
        email: `test_${Date.now()}@example.com`,
        password: '123456',
        userType: 'participant'
      });

    expect(response.statusCode).toBe(201);

    expect(response.body).toHaveProperty('id');
    expect(response.body.name).toBe('Usuario Test');
    expect(response.body.userType).toBe('participant');
  });

  test('debe rechazar el registro si faltan campos', async () => {

  const response = await request(app)
    .post('/api/users/signup')
    .send({
      name: 'Usuario Test',
      email: 'test@example.com'
    });

  expect(response.statusCode).toBe(400);
  expect(response.body.message).toBe('Todos los campos son obligatorios');
});

test('debe permitir el acceso con un token válido', async () => {

  const email = `auth_${Date.now()}@example.com`;
  const password = '123456';

  // Crear usuario
  await request(app)
    .post('/api/users/signup')
    .send({
      name: 'Usuario Auth',
      email,
      password,
      userType: 'participant'
    });

  // Obtener token mediante login
  const loginResponse = await request(app)
    .post('/api/users/login')
    .send({
      email,
      password
    });

  const token = loginResponse.body.token;

  // Acceder a una ruta protegida
  const response = await request(app)
    .get('/api/users/me/registrations')
    .set('Authorization', `Bearer ${token}`);

  expect(response.statusCode).toBe(200);
  expect(Array.isArray(response.body)).toBe(true);
});

test('debe rechazar una contraseña de menos de 6 caracteres', async () => {

  const response = await request(app)
    .post('/api/users/signup')
    .send({
      name: 'Usuario Test',
      email: `test_${Date.now()}@example.com`,
      password: '123',
      userType: 'participant'
    });

  expect(response.statusCode).toBe(400);
  expect(response.body.message).toBe(
    'La contraseña debe tener al menos 6 caracteres'
  );
});

test('debe rechazar un correo que ya está registrado', async () => {

  const email = `duplicate_${Date.now()}@example.com`;

  await request(app)
    .post('/api/users/signup')
    .send({
      name: 'Usuario Original',
      email,
      password: '123456',
      userType: 'participant'
    });

  const response = await request(app)
    .post('/api/users/signup')
    .send({
      name: 'Otro Usuario',
      email,
      password: '123456',
      userType: 'participant'
    });

  expect(response.statusCode).toBe(400);
  expect(response.body.message).toBe(
    'Ya existe una cuenta con ese correo'
  );
});

test('debe iniciar sesión con credenciales correctas', async () => {

  const email = `login_${Date.now()}@example.com`;
  const password = '123456';

  // Crear usuario
  await request(app)
    .post('/api/users/signup')
    .send({
      name: 'Usuario Login',
      email,
      password,
      userType: 'participant'
    });

  // Intentar iniciar sesión
  const response = await request(app)
    .post('/api/users/login')
    .send({
      email,
      password
    });

  expect(response.statusCode).toBe(200);

  expect(response.body).toHaveProperty('token');
  expect(response.body).toHaveProperty('user');

  expect(response.body.user.email).toBe(email);
  expect(response.body.user.name).toBe('Usuario Login');
});

test('debe rechazar el login de un usuario inexistente', async () => {

  const response = await request(app)
    .post('/api/users/login')
    .send({
      email: `noexiste_${Date.now()}@example.com`,
      password: '123456'
    });

  expect(response.statusCode).toBe(401);

  expect(response.body.message).toBe(
    'Correo o contraseña incorrectos'
  );
});

test('debe rechazar una contraseña incorrecta', async () => {

  const email = `wrongpass_${Date.now()}@example.com`;

  await request(app)
    .post('/api/users/signup')
    .send({
      name: 'Usuario Password',
      email,
      password: '123456',
      userType: 'participant'
    });

  const response = await request(app)
    .post('/api/users/login')
    .send({
      email,
      password: '654321'
    });

  expect(response.statusCode).toBe(401);

  expect(response.body.message).toBe(
    'Correo o contraseña incorrectos'
  );
});

describe('Autenticación', () => {

  test('debe rechazar una petición sin token', async () => {

    const response = await request(app)
      .get('/api/events/507f1f77bcf86cd799439011/registrations');

    expect(response.statusCode).toBe(401);
    expect(response.body.message).toBe('No autenticado');
  });
});

test('debe rechazar un token inválido', async () => {

  const response = await request(app)
    .get('/api/events/507f1f77bcf86cd799439011/registrations')
    .set('Authorization', 'Bearer token-falso');

  expect(response.statusCode).toBe(401);
  expect(response.body.message).toBe(
    'Token inválido o expirado'
  );
});

test('debe rechazar a un participante al intentar crear un evento', async () => {

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
      title: 'Evento de prueba',
      description: 'Evento creado desde Jest'
    });

  expect(response.statusCode).toBe(403);

  expect(response.body.message).toBe(
    'Solo un organizador puede hacer esto'
  );
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

test('debe rechazar el registro cuando faltan campos', async () => {
  const response = await request(app)
    .post('/api/users/signup')
    .send({
      name: 'Usuario incompleto',
      email: `incompleto_${Date.now()}@example.com`
    });

  expect(response.statusCode).toBe(400);
  expect(response.body.message).toBe('Todos los campos son obligatorios');
});

test('debe rechazar una contraseña de menos de 6 caracteres', async () => {
  const response = await request(app)
    .post('/api/users/signup')
    .send({
      name: 'Usuario',
      email: `short_${Date.now()}@example.com`,
      password: '12345',
      userType: 'participant'
    });

  expect(response.statusCode).toBe(400);
  expect(response.body.message).toBe(
    'La contraseña debe tener al menos 6 caracteres'
  );
});

test('debe rechazar el registro con un correo que ya existe', async () => {
  const password = '123456';
  const email = `duplicate_${Date.now()}@example.com`;

  // Primer registro
  const firstResponse = await request(app)
    .post('/api/users/signup')
    .send({
      name: 'Primer Usuario',
      email,
      password,
      userType: 'participant'
    });

  expect(firstResponse.statusCode).toBe(201);

  // Segundo registro con el mismo correo
  const secondResponse = await request(app)
    .post('/api/users/signup')
    .send({
      name: 'Segundo Usuario',
      email,
      password,
      userType: 'participant'
    });

  expect(secondResponse.statusCode).toBe(400);
  expect(secondResponse.body.message).toBe(
    'Ya existe una cuenta con ese correo'
  );
});

test('debe permitir actualizar el nombre del usuario', async () => {
  const password = '123456';
  const email = `update_${Date.now()}@example.com`;

  // Crear usuario
  await request(app)
    .post('/api/users/signup')
    .send({
      name: 'Nombre Original',
      email,
      password,
      userType: 'participant'
    });

  // Login
  const login = await request(app)
    .post('/api/users/login')
    .send({
      email,
      password
    });

  const token = login.body.token;

  // Actualizar nombre
  const response = await request(app)
    .put('/api/users/me')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: 'Nombre Actualizado'
    });

  expect(response.statusCode).toBe(200);
  expect(response.body.name).toBe('Nombre Actualizado');
  expect(response.body.email).toBe(email);
});

test('debe permitir actualizar el correo del usuario', async () => {
  const password = '123456';
  const email = `email_original_${Date.now()}@example.com`;
  const newEmail = `email_nuevo_${Date.now()}@example.com`;

  // Crear usuario
  await request(app)
    .post('/api/users/signup')
    .send({
      name: 'Usuario',
      email,
      password,
      userType: 'participant'
    });

  // Login
  const login = await request(app)
    .post('/api/users/login')
    .send({
      email,
      password
    });

  const token = login.body.token;

  // Actualizar correo
  const response = await request(app)
    .put('/api/users/me')
    .set('Authorization', `Bearer ${token}`)
    .send({
      email: newEmail
    });

  expect(response.statusCode).toBe(200);
  expect(response.body.email).toBe(newEmail);
});

test('debe rechazar actualizar el correo a uno que ya existe', async () => {
  const password = '123456';

  const emailA = `user_a_${Date.now()}@example.com`;
  const emailB = `user_b_${Date.now()}@example.com`;

  // Crear usuario A
  await request(app)
    .post('/api/users/signup')
    .send({
      name: 'Usuario A',
      email: emailA,
      password,
      userType: 'participant'
    });

  // Crear usuario B
  await request(app)
    .post('/api/users/signup')
    .send({
      name: 'Usuario B',
      email: emailB,
      password,
      userType: 'participant'
    });

  // Login del usuario A
  const login = await request(app)
    .post('/api/users/login')
    .send({
      email: emailA,
      password
    });

  const token = login.body.token;

  // A intenta usar el correo de B
  const response = await request(app)
    .put('/api/users/me')
    .set('Authorization', `Bearer ${token}`)
    .send({
      email: emailB
    });

  expect(response.statusCode).toBe(400);
  expect(response.body.message).toBe(
    'Ya existe una cuenta con ese correo'
  );
});

test('no debe permitir cambiar a una contraseña menor de 6 caracteres', async () => {
  const password = '123456';
  const email = `password_corta_${Date.now()}@example.com`;

  // Crear usuario
  await request(app)
    .post('/api/users/signup')
    .send({
      name: 'Usuario',
      email,
      password,
      userType: 'participant'
    });

  // Login
  const login = await request(app)
    .post('/api/users/login')
    .send({
      email,
      password
    });

  const token = login.body.token;

  // Intentar cambiar a una contraseña demasiado corta
  const response = await request(app)
    .put('/api/users/me')
    .set('Authorization', `Bearer ${token}`)
    .send({
      currentPassword: password,
      newPassword: '123'
    });

  expect(response.statusCode).toBe(400);
  expect(response.body.message).toBe(
    'La nueva contraseña debe tener al menos 6 caracteres'
  );
});

test('no debe permitir cambiar la contraseña sin la contraseña actual', async () => {
  const password = '123456';
  const email = `sin_actual_${Date.now()}@example.com`;

  await request(app)
    .post('/api/users/signup')
    .send({
      name: 'Usuario',
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
    .put('/api/users/me')
    .set('Authorization', `Bearer ${token}`)
    .send({
      newPassword: '654321'
    });

  expect(response.statusCode).toBe(400);
  expect(response.body.message).toBe(
    'Debes ingresar tu contraseña actual para cambiarla'
  );
});

test('no debe permitir cambiar la contraseña si la actual es incorrecta', async () => {
  const password = '123456';
  const email = `password_incorrecta_${Date.now()}@example.com`;

  await request(app)
    .post('/api/users/signup')
    .send({
      name: 'Usuario',
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
    .put('/api/users/me')
    .set('Authorization', `Bearer ${token}`)
    .send({
      currentPassword: 'contraseñaIncorrecta',
      newPassword: '654321'
    });

  expect(response.statusCode).toBe(401);
  expect(response.body.message).toBe(
    'La contraseña actual no es correcta'
  );
});
test('debe permitir cambiar la contraseña correctamente', async () => {
  const password = '123456';
  const newPassword = '654321';
  const email = `cambio_password_${Date.now()}@example.com`;

  // Crear usuario
  await request(app)
    .post('/api/users/signup')
    .send({
      name: 'Usuario',
      email,
      password,
      userType: 'participant'
    });

  // Login con contraseña original
  const login = await request(app)
    .post('/api/users/login')
    .send({
      email,
      password
    });

  const token = login.body.token;

  // Cambiar contraseña
  const response = await request(app)
    .put('/api/users/me')
    .set('Authorization', `Bearer ${token}`)
    .send({
      currentPassword: password,
      newPassword: newPassword
    });

  expect(response.statusCode).toBe(200);

  // Comprobar que la nueva contraseña funciona
  const newLogin = await request(app)
    .post('/api/users/login')
    .send({
      email,
      password: newPassword
    });

  expect(newLogin.statusCode).toBe(200);
  expect(newLogin.body.token).toBeDefined();
});
});