const router = require('express').Router();
const verifyToken = require('../middleware/verifyToken'); 
const verifyAdmin = require('../middleware/verifyAdmin'); // ❗ Add this if using admin route
const ctrl = require('../controllers/resultController');
const {
  getUserResults,
  getUserResultById
} = require('../controllers/resultController');
// User route

router.get('/my', verifyToken, getUserResults); // ✅ Good for '/results'
router.get('/results', verifyToken, getUserResults); // ✅ Good for '/results'
router.get('/my/results', verifyToken, getUserResults); // ✅ Matches frontend call
router.get('/my/:id', verifyToken, getUserResultById); // ✅ To view single result

// Admin route
router.get('/all', verifyAdmin, ctrl.getAllResults); // ✅ Admin fetches all results

module.exports = router;
