require('dotenv').config({ path: '.env.test', override: true });

const mongoose = require('mongoose');
const connectDB = require('./config/db');

beforeAll(async () => {
  console.log('BASE DE DATOS DE TEST:', process.env.MONGODB_URI);

  await connectDB();

  // Limpiar la base de datos de pruebas
  const collections = mongoose.connection.collections;

  for (const key in collections) {
    await collections[key].deleteMany({});
  }

  console.log('Base de datos de pruebas limpiada');
}, 10000);

afterAll(async () => {
  await mongoose.connection.close();
});