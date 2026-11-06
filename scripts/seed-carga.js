// Datos para la prueba de carga TC-28 (RNF-03).
// Crea: 1 organizador, 200 participantes, 200 eventos y 2000 inscripciones (10 por evento).
// Solo corre contra una base cuyo nombre termine en "-test" y la VACÍA antes de sembrar.
// Uso:  node scripts/seed-carga.js        (lee MONGODB_URI de .env.test)
require('dotenv').config({ path: '.env.test', override: true });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Event = require('../models/Event');
const Registration = require('../models/Registration');

const PASSWORD = '123456';
const N_PARTICIPANTES = 200;
const N_EVENTOS = 200;
const INSCRIPCIONES_POR_EVENTO = 10;

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const nombre = mongoose.connection.name;
  if (!nombre.endsWith('-test')) {
    console.error(`Cancelado: la base "${nombre}" no termina en "-test".`);
    process.exit(1);
  }
  await Promise.all([User.deleteMany({}), Event.deleteMany({}), Registration.deleteMany({})]);

  const hash = await bcrypt.hash(PASSWORD, 10); // un solo hash para todos: insertMany no pasa por el pre('save')
  const organizador = await User.create({
    name: 'Organizador carga', email: 'carga_org@example.com', password: PASSWORD, userType: 'organizer'
  });
  const participantes = await User.insertMany(
    Array.from({ length: N_PARTICIPANTES }, (_, i) => ({
      name: `Participante ${i + 1}`, email: `carga_p${i + 1}@example.com`, password: hash, userType: 'participant'
    }))
  );

  const base = Date.now() + 30 * 24 * 60 * 60 * 1000;
  const eventos = await Event.insertMany(
    Array.from({ length: N_EVENTOS }, (_, i) => ({
      name: `Evento de carga ${i + 1}`,
      description: 'Evento sembrado para la prueba de carga',
      date: new Date(base + i * 60 * 60 * 1000),
      location: `Lugar ${i + 1}`,
      maxCapacity: 100,
      modality: i % 2 === 0 ? 'in-person' : 'virtual',
      organizerId: organizador._id
    }))
  );

  const inscripciones = [];
  eventos.forEach((evento, e) => {
    for (let k = 0; k < INSCRIPCIONES_POR_EVENTO; k += 1) {
      inscripciones.push({
        eventId: evento._id,
        participantId: participantes[(e + k * 7) % N_PARTICIPANTES]._id
      });
    }
  });
  await Registration.insertMany(inscripciones);

  console.log(`Base "${nombre}": ${await User.countDocuments()} usuarios, ` +
    `${await Event.countDocuments()} eventos, ${await Registration.countDocuments()} inscripciones.`);
  await mongoose.disconnect();
})().catch((err) => { console.error(err.message); process.exit(1); });
