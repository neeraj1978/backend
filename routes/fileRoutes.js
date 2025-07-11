// routes/fileRoutes.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Grid = require('gridfs-stream');

let gfs;
const conn = mongoose.connection;

conn.once('open', () => {
  gfs = Grid(conn.db, mongoose.mongo);
  gfs.collection('documents');
});

router.get('/file/:id', async (req, res) => {
  try {
    const file = await gfs.files.findOne({ _id: new mongoose.Types.ObjectId(req.params.id) });
    const readStream = gfs.createReadStream({ _id: file._id });
    readStream.pipe(res);
  } catch (err) {
    console.error(err);
    res.status(404).json({ error: 'File not found' });
  }
});

module.exports = router;
