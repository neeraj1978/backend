// models/Result.js
const mongoose = require('mongoose');

const evaluationSchema = new mongoose.Schema({
  question: String,
  userAnswer: String,
  correctAnswer: String,
  isCorrect: Boolean,
  marksAwarded: { type: Number, default: 0 }
});

const resultSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  test: { type: mongoose.Schema.Types.ObjectId, ref: 'Test', required: true },
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true }, // ✅ Added this
  totalQuestions: Number,
  totalMarks: Number,
  marksObtained: Number,
  submittedAt: { type: Date, default: Date.now },
  reviewed: { type: Boolean, default: false },
  evaluation: [evaluationSchema],

  // ✅ Emotion-based report
  emotionReport: {
    type: String,
    default: ''
  },

  status: {
    type: String,
    enum: ['PENDING', 'CONFIRMED'],
    default: 'PENDING'
  },

  answers: [
    {
      questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question' },
      answerJson: { type: Object }
    }
  ]
});

module.exports = mongoose.model('Result', resultSchema);
