const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const Report = require('../models/Reports');
const { verifyToken, isOrganizer } = require('../middleware/auth');
const upload = require('../middleware/upload');

function errorMessage(err) {
  if (err.name === 'ValidationError') {
    const detalles = Object.values(err.errors).map(e => e.message).join(' / ');
    return `Revisa el formulario: ${detalles}`;
  }
  return err.message;
}

// RF1: crear un evento, con imagen opcional
router.post('/', verifyToken, isOrganizer, upload.single('image'), async (req, res) => {
  try {
    const eventData = {
      name: req.body.name,
      description: req.body.description,
      date: req.body.date,
      location: req.body.location,
      modality: req.body.modality,
      maxCapacity: Number(req.body.maxCapacity),
      organizerId: req.user._id
    };
    if (req.file) {
      eventData.imageUrl = `/uploads/${req.file.filename}`;
    }
    const event = await Event.create(eventData);
    res.status(201).json(event);
  } catch (err) {
    res.status(400).json({ message: errorMessage(err) });
  }
});

// Editar un evento (solo el organizador dueño), con imagen opcional nueva
router.put('/:id', verifyToken, isOrganizer, upload.single('image'), async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Evento no encontrado' });
    if (String(event.organizerId) !== String(req.user._id)) {
      return res.status(403).json({ message: 'No puedes editar un evento que no organizaste' });
    }

    event.name = req.body.name;
    event.description = req.body.description;
    event.date = req.body.date;
    event.location = req.body.location;
    event.modality = req.body.modality;
    event.maxCapacity = Number(req.body.maxCapacity);
    if (req.file) {
      event.imageUrl = `/uploads/${req.file.filename}`;
    }

    await event.save();
    res.json(event);
  } catch (err) {
    res.status(400).json({ message: errorMessage(err) });
  }
});

router.delete('/:id', verifyToken, isOrganizer, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Evento no encontrado' });
    if (String(event.organizerId) !== String(req.user._id)) {
      return res.status(403).json({ message: 'No puedes eliminar un evento que no organizaste' });
    }
    await event.deleteOne();
    res.json({ message: 'Evento eliminado' });
  } catch (err) {
    res.status(500).json({ message: errorMessage(err) });
  }
});

router.get('/', async (req, res) => {
  try {
    const events = await Event.find().sort({ date: 1 });
    const withCapacity = await Promise.all(events.map(async (event) => {
      const registered = await Registration.countDocuments({ eventId: event._id, status: 'confirmed' });
      return { ...event.toObject(), availableSpots: event.maxCapacity - registered };
    }));
    res.json(withCapacity);
  } catch (err) {
    res.status(500).json({ message: errorMessage(err) });
  }
});

router.get('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Id de evento inválido' });
    }
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Evento no encontrado' });
    const registered = await Registration.countDocuments({ eventId: event._id, status: 'confirmed' });
    res.json({ ...event.toObject(), availableSpots: event.maxCapacity - registered });
  } catch (err) {
    res.status(500).json({ message: errorMessage(err) });
  }
});

router.post('/:id/reports', verifyToken, isOrganizer, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Evento no encontrado' });
    if (String(event.organizerId) !== String(req.user._id)) {
      return res.status(403).json({ message: "No puedes generar el reporte de un evento que no organizaste" });
    }

    const registrations = await Registration.find({ eventId: event._id, status: 'confirmed' })
      .populate('participantId', 'name email');

    const report = await Report.create({
      eventId: event._id,
      type: 'attendance',
      data: {
        totalRegistered: registrations.length,
        maxCapacity: event.maxCapacity,
        participants: registrations.map(r => ({
          name: r.participantId.name,
          email: r.participantId.email,
          date: r.date
        }))
      }
    });

    res.status(201).json(report);
  } catch (err) {
    res.status(500).json({ message: errorMessage(err) });
  }
});

router.get('/:id/reports', verifyToken, isOrganizer, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Evento no encontrado' });
    if (String(event.organizerId) !== String(req.user._id)) {
      return res.status(403).json({ message: "No puedes ver los reportes de un evento que no organizaste" });
    }
    const reports = await Report.find({ eventId: event._id }).sort({ generatedAt: -1 });
    res.json(reports);
  } catch (err) {
    res.status(500).json({ message: errorMessage(err) });
  }
});

module.exports = router;
