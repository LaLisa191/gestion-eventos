require('dotenv').config({ path: '.env.test', override: true });

const mongoose = require('mongoose');
const connectDB = require('./config/db');

// Los tests nunca deben enviar correos reales (tampoco carga juice, que es solo ESM)
jest.mock('./utils/mailer', () => ({
  enviarConfirmacionRegistro: jest.fn().mockResolvedValue(undefined)
}));

// Vacía todas las colecciones, pero solo si la base es de pruebas
async function limpiarBase() {
  const nombre = mongoose.connection.name;
  if (!nombre?.endsWith('-test')) {
    throw new Error(
      `Limpieza cancelada: la base "${nombre}" no parece de pruebas (su nombre debe terminar en "-test").`
    );
  }
  await Promise.all(
    Object.values(mongoose.connection.collections).map(coleccion => coleccion.deleteMany({}))
  );
}

beforeAll(async () => {
  await connectDB();
  await limpiarBase();
}, 20000);

afterAll(async () => {
  // Solo limpia si la conexión sigue abierta (algunos tests aún la cierran por su cuenta)
  if (mongoose.connection.readyState === 1) {
    await limpiarBase();
  }
  await mongoose.connection.close();
}, 20000);
