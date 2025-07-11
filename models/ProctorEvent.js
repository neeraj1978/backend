const mongoose = require('mongoose');

const proctorEventSchema = new mongoose.Schema({
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
  eventType: {
    type: String,
    enum: ['WARNING', 'KICK', 'SUSPICIOUS_FACE', 'MULTIPLE_FACES'],
    required: true,
  },
  ts: { type: Date, default: Date.now },
});

module.exports = mongoose.model('ProctorEvent', proctorEventSchema);
