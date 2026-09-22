const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: {
  type: String,
  required: true,
  unique: true,
  lowercase: true,
  trim: true,
  validate: {
    validator: function (correo) {
      const arroba = correo.indexOf('@');
      if (arroba <= 0) return false;
      const dominio = correo.slice(arroba + 1);
      return dominio.includes('.') && !/\s/.test(correo);
    },
    message: 'El correo no tiene un formato válido'
  }
},
  password: { type: String, required: true, select: false },
  userType: { type: String, enum: ['organizer', 'participant'], required: true },
  favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Event' }]
});

// Hashes the password before saving, only if it changed
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Used on login, to compare the given password with the stored hash
userSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
