const express = require('express');
const router = express.Router();
const documentController = require('../controllers/documentController');
const verifyToken = require('../middleware/verifyToken');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const sanitized = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, Date.now() + '-' + sanitized);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (/^(application\/pdf|image\/)/.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and image files allowed'), false);
    }
  }
});

// Routes
router.get('/my', verifyToken, documentController.getMyDocuments);
router.post('/upload', verifyToken, upload.single('file'), documentController.uploadDocument);

// ✅ Allow token via query for browser preview
router.get('/download/:id', verifyToken, documentController.downloadDocument);

module.exports = router;
