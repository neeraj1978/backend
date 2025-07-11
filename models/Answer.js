const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema({
  answerJson:    Object,
  marksObtained: { type: Number, default: 0 },
  bookingId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
  questionId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Question' },
}, { timestamps: true });

module.exports = mongoose.model('Answer', answerSchema);
