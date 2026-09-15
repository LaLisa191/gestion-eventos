const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, default: '' },
  date: { type: Date, required: true },
  location: { type: String, required: true },
  maxCapacity: { type: Number, required: true },
  modality: { type: String, enum: ['in-person', 'virtual'], default: 'in-person' },
  status: { type: String, enum: ['active', 'cancelled', 'finished'], default: 'active' },
  organizerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
});

module.exports = mongoose.model('Event', eventSchema);
