const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const verifyToken = require('../middleware/verifyToken');

// ✅ Route to create booking
router.post('/create', verifyToken, bookingController.createBooking);

// ✅ Route to fetch user's bookings
router.get('/my', verifyToken, bookingController.getMyBookings);

module.exports = router;
