const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  fileId: { 
    type: mongoose.Schema.Types.ObjectId, 
    required: true 
  },
  docType: { 
    type: String, 
    required: true 
  },
  metaJson: { 
    type: Object 
  },
  status: { 
    type: String, 
    enum: ['PENDING', 'APPROVED', 'REJECTED'], 
    default: 'PENDING' 
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

documentSchema.virtual('fileUrl').get(function() {
  return `/api/document/download/${this.fileId}`;
});

module.exports = mongoose.model('Document', documentSchema);