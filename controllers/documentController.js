const Document = require('../models/Document');
const mongoose = require('mongoose');
const { GridFSBucket } = require('mongodb');
const { connection } = mongoose;
const fs = require('fs');

exports.uploadDocument = async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'User authentication failed' });
    }

    const userId = req.user.id;
    const { docType, metaJson } = req.body;
    const file = req.file;

    if (!file || !docType) {
      if (file?.path) fs.unlinkSync(file.path);
      return res.status(400).json({ error: 'File and docType are required' });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      if (file?.path) fs.unlinkSync(file.path);
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const bucket = new GridFSBucket(connection.db, { bucketName: 'documents' });
    const readStream = fs.createReadStream(file.path);

    const uploadStream = bucket.openUploadStream(file.originalname, {
      metadata: {
        userId: new mongoose.Types.ObjectId(userId),
        docType,
        contentType: file.mimetype
      }
    });

    readStream.pipe(uploadStream);

    uploadStream.on('error', (error) => {
      fs.unlinkSync(file.path);
      console.error('Upload error:', error);
      res.status(500).json({ error: 'File upload failed' });
    });

    uploadStream.on('finish', async () => {
      try {
        const document = await Document.create({
          userId: new mongoose.Types.ObjectId(userId),
          fileId: uploadStream.id,
          docType,
          metaJson: metaJson || null,
          status: 'PENDING'
        });

        fs.unlinkSync(file.path);
        res.status(201).json({
          message: 'Document uploaded successfully',
          document
        });
      } catch (err) {
        fs.unlinkSync(file.path);
        console.error('Document creation error:', err);

        if (err.name === 'ValidationError') {
          return res.status(400).json({
            error: 'Validation failed',
            details: err.errors
          });
        }
        res.status(500).json({ error: 'Document creation failed' });
      }
    });
  } catch (err) {
    console.error('UploadDocument error:', err);
    if (req.file?.path) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: 'Document upload failed' });
  }
};

exports.getMyDocuments = async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'User authentication failed' });
    }

    const userId = req.user.id;
    const documents = await Document.find({ userId }).sort({ createdAt: -1 });
    const bucket = new GridFSBucket(connection.db, { bucketName: 'documents' });

    const documentsWithUrls = await Promise.all(documents.map(async doc => {
      const files = await bucket.find({ _id: doc.fileId }).toArray();
      if (files.length > 0) {
        return {
          ...doc.toObject(),
          fileUrl: `/api/document/download/${doc.fileId}`,
          fileName: files[0].filename,
          contentType: files[0].metadata?.contentType
        };
      }
      return doc.toObject();
    }));

    res.json(documentsWithUrls);
  } catch (err) {
    console.error('GetMyDocuments error:', err);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
};

exports.downloadDocument = async (req, res) => {
  try {
    const fileId = new mongoose.Types.ObjectId(req.params.id);
    const bucket = new GridFSBucket(connection.db, { bucketName: 'documents' });

    const files = await bucket.find({ _id: fileId }).toArray();
    if (!files?.length) return res.status(404).json({ error: 'File not found' });

    const file = files[0];
    const contentType = file.metadata?.contentType || 'application/octet-stream';

    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `inline; filename="${file.filename}"`
    });

    bucket.openDownloadStream(fileId).pipe(res);
  } catch (err) {
    console.error('Download error:', err);
    res.status(500).json({ error: 'Failed to load file' });
  }
};
