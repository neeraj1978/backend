const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const verifyAdmin = require('../middleware/verifyAdmin');

router.post('/login', adminController.adminLogin);

// Document management
router.get('/documents', verifyAdmin, adminController.getAllDocuments);
router.patch('/documents/:docId', verifyAdmin, adminController.updateDocumentStatus);
router.delete('/documents/:docId', verifyAdmin, adminController.deleteDocument);

// Booking management
router.get('/bookings', verifyAdmin, adminController.getAllBookings);
router.patch('/bookings/:bookingId', verifyAdmin, adminController.updateBookingStatus);
router.delete('/bookings/:bookingId', verifyAdmin, adminController.deleteBooking);

// Results management
router.get('/result/pending', verifyAdmin, adminController.getPendingResults);
router.post('/result/confirm/:resultId', verifyAdmin, adminController.confirmResult);
router.delete('/result/:resultId', verifyAdmin, adminController.deleteResult);
router.get('/result/details/:resultId', verifyAdmin, adminController.getResultById);


module.exports = router;
