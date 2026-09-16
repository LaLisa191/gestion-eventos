const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const User = require('../models/User');
const Registration = require('../models/Registration');
const { verifyToken } = require('../middleware/auth');

function errorMessage(err) {
  if (err.name === 'ValidationError') {
    return 'Los datos ingresados no son válidos. Revisa el formulario.';
  }
  if (err.code === 11000) {
    return 'Ya existe un registro con esos datos.';
  }
  return err.message;
}

router.post('/signup', async (req, res) => {
  try {
    const { name, email, password, userType } = req.body;
    if (!name || !email || !password || !userType) {
      return res.status(400).json({ message: 'Todos los campos son obligatorios' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres' });
    }
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: 'Ya existe una cuenta con ese correo' });

    const user = await User.create({ name, email, password, userType });
    res.status(201).json({ id: user._id, name: user.name, email: user.email, userType: user.userType });
  } catch (err) {
    res.status(400).json({ message: errorMessage(err) });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Correo o contraseña incorrectos' });
    }
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, userType: user.userType }
    });
  } catch (err) {
    res.status(500).json({ message: errorMessage(err) });
  }
});

// "Mis eventos": todas las inscripciones del usuario logueado, con los datos del evento
router.get('/me/registrations', verifyToken, async (req, res) => {
  try {
    const registrations = await Registration.find({ participantId: req.user._id })
      .populate('eventId')
      .sort({ date: -1 });
    res.json(registrations);
  } catch (err) {
    res.status(500).json({ message: errorMessage(err) });
  }
});

// Editar perfil: nombre, correo y, opcionalmente, contraseña
router.put('/me', verifyToken, async (req, res) => {
  try {
    const { name, email, currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select('+password');

    if (name) user.name = name;

    if (email && email.toLowerCase() !== user.email) {
      const existing = await User.findOne({ email: email.toLowerCase() });
      if (existing) return res.status(400).json({ message: 'Ya existe una cuenta con ese correo' });
      user.email = email.toLowerCase();
    }

    if (newPassword) {
      if (newPassword.length < 6) {
        return res.status(400).json({ message: 'La nueva contraseña debe tener al menos 6 caracteres' });
      }
      if (!currentPassword) {
        return res.status(400).json({ message: 'Debes ingresar tu contraseña actual para cambiarla' });
      }
      const coincide = await user.comparePassword(currentPassword);
      if (!coincide) {
        return res.status(401).json({ message: 'La contraseña actual no es correcta' });
      }
      user.password = newPassword;
    }

    await user.save();
    res.json({ id: user._id, name: user.name, email: user.email, userType: user.userType });
  } catch (err) {
    res.status(400).json({ message: errorMessage(err) });
  }
});

// Lista de eventos favoritos del usuario, con los datos del evento
router.get('/me/favorites', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('favorites');
    res.json(user.favorites);
  } catch (err) {
    res.status(500).json({ message: errorMessage(err) });
  }
});

// Marcar un evento como favorito
router.post('/me/favorites/:eventId', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user.favorites.some(id => String(id) === req.params.eventId)) {
      user.favorites.push(req.params.eventId);
      await user.save();
    }
    res.json({ favorites: user.favorites });
  } catch (err) {
    res.status(400).json({ message: errorMessage(err) });
  }
});

// Quitar un evento de favoritos
router.delete('/me/favorites/:eventId', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    user.favorites = user.favorites.filter(id => String(id) !== req.params.eventId);
    await user.save();
    res.json({ favorites: user.favorites });
  } catch (err) {
    res.status(400).json({ message: errorMessage(err) });
  }
});

module.exports = router;
