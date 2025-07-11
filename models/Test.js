const mongoose = require('mongoose');

const testSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  durationMin: {
    type: Number,
    required: true,
    default: 30
  },
  totalMarks: {
    type: Number,
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, { timestamps: true });

// ✅ VIRTUAL FIELD TO LINK QUESTIONS TO THIS TEST
testSchema.virtual('questions', {
  ref: 'Question',
  localField: '_id',
  foreignField: 'testId',
});

// ✅ ENABLE VIRTUALS TO BE INCLUDED IN JSON RESPONSES
testSchema.set('toObject', { virtuals: true });
testSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Test', testSchema);
