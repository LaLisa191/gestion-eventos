const express = require('express');
const mongoose = require('mongoose');
const router = express.Router({ mergeParams: true });
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const { verifyToken } = require('../middleware/auth');

router.get('/', verifyToken, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Id de evento inválido' });
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

    const registered = await Registration.countDocuments({ eventId: event._id, status: 'confirmed' });
    if (registered >= event.maxCapacity) {
      return res.status(400).json({ message: 'Este evento ya no tiene cupos disponibles' });
    }

    const alreadyRegistered = await Registration.findOne({
      eventId: event._id, participantId: req.user._id, status: 'confirmed'
    });
    if (alreadyRegistered) {
      return res.status(400).json({ message: 'Ya estás registrado en este evento' });
    }

    const registration = await Registration.create({ eventId: event._id, participantId: req.user._id });
    res.status(201).json({ message: 'Registro confirmado', registration });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Cancelar un registro propio (libera el cupo automáticamente, ya que el
// conteo de cupos solo cuenta inscripciones con estado 'confirmed')
router.patch('/:registrationId/cancel', verifyToken, async (req, res) => {
  try {
    const registration = await Registration.findById(req.params.registrationId);
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

module.exports = router;
