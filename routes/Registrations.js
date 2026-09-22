const express = require('express');
const mongoose = require('mongoose');
const router = express.Router({ mergeParams: true });
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const { verifyToken } = require('../middleware/auth');
const { enviarConfirmacionRegistro } = require('../utils/mailer');

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

    // RF5: impide el registro cuando el cupo ya está lleno
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

    // RF3: registra al usuario autenticado
    const registration = await Registration.create({ eventId: event._id, participantId: req.user._id });

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
