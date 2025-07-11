const express = require('express');
const router = express.Router();
const proctorController = require('../controllers/proctorController');
const verifyToken = require('../middleware/verifyToken');

router.post('/event', verifyToken, proctorController.logProctorEvent);

module.exports = router;
