// TC-27 · RNF-01 · R-01 · Sin sobrecupo con inscripciones simultáneas.
// Evento de cupo 5, 20 participantes distintos inscribiéndose a la vez, 10 repeticiones.
// Importante: el resultado depende del motor de base de datos. La ejecución oficial debe
// hacerse contra MongoDB (local o Atlas de pruebas) y no contra una base simulada.
const request = require('supertest');
const app = require('../../app');
const Registration = require('../../models/Registration');
const { crearUsuario, crearEvento } = require('../helpers');

const CUPO = 5;
const PARTICIPANTES = 20;
const REPETICIONES = 10;

describe('TC-27 · RNF-01 · Concurrencia sobre el cupo', () => {
  test(`con cupo ${CUPO} y ${PARTICIPANTES} solicitudes simultáneas hay ${CUPO} o menos inscripciones confirmadas, en ${REPETICIONES} repeticiones`, async () => {
    const organizador = await crearUsuario('organizer');
    const participantes = [];
    for (let i = 0; i < PARTICIPANTES; i += 1) {
      participantes.push(await crearUsuario('participant'));
    }

    const confirmadasPorRepeticion = [];
    for (let repeticion = 0; repeticion < REPETICIONES; repeticion += 1) {
      const eventId = await crearEvento(organizador.token, {
        name: `Evento concurrente ${repeticion}`,
        location: `Lugar concurrente ${repeticion}`,
        maxCapacity: CUPO
      });

      await Promise.all(participantes.map((p) =>
        request(app)
          .post(`/api/events/${eventId}/registrations`)
          .set('Authorization', `Bearer ${p.token}`)
      ));

      confirmadasPorRepeticion.push(await Registration.countDocuments({ eventId, status: 'confirmed' }));
    }

    console.log(`TC-27 confirmadas por repetición: ${confirmadasPorRepeticion.join(', ')} (cupo ${CUPO})`);
    confirmadasPorRepeticion.forEach((confirmadas) => {
      expect(confirmadas).toBeLessThanOrEqual(CUPO);
    });
  }, 120000);
});
