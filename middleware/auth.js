const jwt = require('jsonwebtoken');
const User = require('../models/User');

async function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No autenticado' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.id);
    if (!user) return res.status(401).json({ message: 'Usuario no encontrado' });
    req.user = user;
    next();
  } catch (err) {
    // Token inválido, expirado o mal formado: se rechaza la petición.
    // Se deja registro para poder detectar patrones de tokens sospechosos.
    console.warn('Token inválido o expirado:', err.message);
    return res.status(401).json({ message: 'Token inválido o expirado' });
  }
}

function isOrganizer(req, res, next) {
  if (req.user.userType !== 'organizer') {
    return res.status(403).json({ message: 'Solo un organizador puede hacer esto' });
  }
  next();
}

module.exports = { verifyToken, isOrganizer };