const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  body:              String,
  type:              { type: String, enum: ['MCQ', 'SUBJECTIVE'] },
  marks:             { type: Number, default: 1 },
  optionsJson:       Object, // { options: [...] }
  correctAnswerJson: Object, // { correct: 'a' }
  testId:            { type: mongoose.Schema.Types.ObjectId, ref: 'Test' },
}, { timestamps: true });

module.exports = mongoose.model('Question', questionSchema);
