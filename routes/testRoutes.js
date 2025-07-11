const express = require('express');
const router = express.Router();
const testController = require('../controllers/testController');
const verifyToken = require('../middleware/verifyToken');
const isAdmin = require('../middleware/isAdmin');

// User routes
router.post('/start', verifyToken, testController.startTest);
router.post('/submit', verifyToken, testController.submitAnswers);
router.get('/result/:bookingId', verifyToken, testController.getResult);
// ✅ User-level test generation route (e.g., after booking approved)
router.post('/generate', verifyToken, testController.generateTest);


// Admin route
router.post('/generate-test', verifyToken, isAdmin, testController.generateTest);
//emotion 
router.get('/emotion-report/:bookingId', verifyToken, testController.generateEmotionReport);




module.exports = router;
