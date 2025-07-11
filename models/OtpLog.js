const mongoose = require('mongoose');

const otpLogSchema = new mongoose.Schema({
  otp: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  expiresAt: { type: Date, required: true },
  used: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('OtpLog', otpLogSchema);
