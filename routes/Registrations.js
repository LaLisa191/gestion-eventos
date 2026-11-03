const express = require('express');
const mongoose = require('mongoose');
const router = express.Router({ mergeParams: true });
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const { verifyToken, isOrganizer } = require('../middleware/auth');
const { enviarConfirmacionRegistro } = require('../utils/mailer');

// Cola por evento: las inscripciones al mismo evento se atienden de una en una dentro de este proceso,
// de modo que verificar el cupo y crear la inscripción no se intercalen (corrige D-01).
const colasPorEvento = new Map();
function enColaPorEvento(eventId, tarea) {
  const clave = String(eventId);
  const anterior = colasPorEvento.get(clave) || Promise.resolve();
  const actual = anterior.catch(() => {}).then(tarea);
  colasPorEvento.set(clave, actual);
  const limpiar = () => { if (colasPorEvento.get(clave) === actual) colasPorEvento.delete(clave); };
  actual.then(limpiar, limpiar);
  return actual;
}

// Solo el organizador del evento puede ver quién se inscribió
router.get('/', verifyToken, isOrganizer, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Id de evento inválido' });
    } 

    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Evento no encontrado' });
    if (String(event.organizerId) !== String(req.user._id)) {
      return res.status(403).json({ message: 'No puedes ver los registros de un evento que no organizaste' });
    }

    const registrations = await Registration.find({ eventId: req.params.id }).populate('participantId', 'name email');
    res.json(registrations);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', verifyToken, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Id de evento inválido' });
    }

    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Evento no encontrado' });

    // Solo se permite inscribirse en eventos activos y que aún no han ocurrido (corrige D-02)
    if (event.status !== 'active') {
      return res.status(400).json({ message: 'Este evento no está disponible para inscripciones' });
    }
    if (new Date(event.date) < new Date()) {
      return res.status(400).json({ message: 'Este evento ya ocurrió' });
    }

    const resultado = await enColaPorEvento(event._id, async () => {
      // RF5: impide el registro cuando el cupo ya está lleno
      const registered = await Registration.countDocuments({ eventId: event._id, status: 'confirmed' });
      if (registered >= event.maxCapacity) {
        return { error: 'Este evento ya no tiene cupos disponibles' };
      }

      const alreadyRegistered = await Registration.findOne({
        eventId: event._id, participantId: req.user._id, status: 'confirmed'
      });
      if (alreadyRegistered) {
        return { error: 'Ya estás registrado en este evento' };
      }

      // RF3: registra al usuario autenticado
      const creada = await Registration.create({ eventId: event._id, participantId: req.user._id });

      // Verificación posterior: protege también si hay varias instancias del servidor, donde la cola
      // en memoria no alcanza. Si el cupo quedó superado, esta inscripción se retira.
      const total = await Registration.countDocuments({ eventId: event._id, status: 'confirmed' });
      if (total > event.maxCapacity) {
        await creada.deleteOne();
        return { error: 'Este evento ya no tiene cupos disponibles' };
      }
      return { registration: creada };
    });
    if (resultado.error) {
      return res.status(400).json({ message: resultado.error });
    }
    const registration = resultado.registration;

    // RF4 + RNF2: confirmación visual inmediata — no se espera al correo
    res.status(201).json({ message: 'Registro confirmado', registration });

    // El correo se manda de fondo, sin bloquear la respuesta al usuario
    enviarConfirmacionRegistro(req.user.email, event).catch(err => {
      console.error('No se pudo enviar el correo de confirmación:', err.message);
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/:registrationId/cancel', verifyToken, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id) || !mongoose.Types.ObjectId.isValid(req.params.registrationId)) {
      return res.status(400).json({ message: 'Id inválido' });
    }
    // El registro debe pertenecer al evento de la ruta (corrige D-06)
    const registration = await Registration.findOne({ _id: req.params.registrationId, eventId: req.params.id });
    if (!registration) return res.status(404).json({ message: 'Registro no encontrado' });
    if (String(registration.participantId) !== String(req.user._id)) {
      return res.status(403).json({ message: 'No puedes cancelar un registro que no es tuyo' });
    }
    registration.status = 'cancelled';
    await registration.save();
    res.json({ message: 'Registro cancelado', registration });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Elimina del historial una inscripción CANCELADA (solo la del propio usuario)
router.delete('/:registrationId', verifyToken, async (req, res) => {
  try {
    const { id, registrationId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(registrationId)) {
      return res.status(400).json({ message: 'Id inválido' });
    }

    const registration = await Registration.findOne({ _id: registrationId, eventId: id });
    if (!registration) return res.status(404).json({ message: 'Registro no encontrado' });

    if (String(registration.participantId) !== String(req.user._id)) {
      return res.status(403).json({ message: 'No puedes eliminar un registro que no es tuyo' });
    }

    // Una inscripción confirmada se cancela primero; así no se pierde un cupo por accidente
    if (registration.status !== 'cancelled') {
      return res.status(400).json({ message: 'Solo puedes eliminar inscripciones canceladas' });
    }

    await registration.deleteOne();
    res.json({ message: 'Registro eliminado' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
