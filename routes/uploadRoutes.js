const express = require('express');
const router = express.Router();
const { GridFsStorage } = require('multer-gridfs-storage');
const multer = require('multer');
const mongoose = require('mongoose');
const Document = require('../models/Document');
const verifyToken = require('../middleware/verifyToken');

// MongoDB URI
const mongoURI = 'mongodb://localhost:27017/testDB'; // Change as per your DB

// Create storage engine
const storage = new GridFsStorage({
  url: mongoURI,
  file: (req, file) => {
    return {
      filename: `${Date.now()}-${file.originalname}`,
      bucketName: 'documents'
    };
  }
});
const upload = multer({ storage });

// Upload route
router.post('/upload', verifyToken, upload.single('file'), async (req, res) => {
  const { docType, degree, fatherName } = req.body;
  const userId = req.user.userId;

  try {
    const document = await Document.create({
      userId,
      fileId: req.file.id, // GridFS file _id
      docType,
      metaJson: { degree, fatherName },
      status: 'PENDING'
    });

    res.status(201).json({
      message: 'Document uploaded and saved to MongoDB',
      document
    });
  } catch (err) {
    console.error('MongoDB Upload Error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});
