const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  generatedAt: { type: Date, default: Date.now },
  type: { type: String, default: 'attendance' },
  // A "snapshot" of the report at the moment it was generated: total registrations,
  // capacity, and the list of participants, as required by RF7.
  data: { type: mongoose.Schema.Types.Mixed }
});

module.exports = mongoose.model('Report', reportSchema);
