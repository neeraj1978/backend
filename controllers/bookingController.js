const Booking = require('../models/Booking');
const User = require('../models/User');

/* ════════════════ 1. Create a Booking ════════════════ */
exports.createBooking = async (req, res) => {
  const { topic, difficulty } = req.body;
  const userId = req.user.id; // ⬅️ make sure your verifyToken sets `req.user.id`

  try {
    // Check if there's already a pending booking
    const existing = await Booking.findOne({ user: userId, status: 'PENDING' });
    if (existing) {
      return res.status(400).json({ error: 'You already requested a test.' });
    }

    const booking = await Booking.create({
      user: userId,
      topic,
      difficulty,
      scheduledAt: null,
      status: 'PENDING'
    });

    res.json({ message: 'Test booking request submitted', booking });
  } catch (err) {
    console.error('❌ Booking error:', err);
    res.status(500).json({ error: 'Booking failed' });
  }
};

/* ════════════════ 2. Get My Bookings (User Dashboard) ════════════════ */
exports.getMyBookings = async (req, res) => {
  const userId = req.user.id;

  try {
    const bookings = await Booking.find({ user: userId })
      .sort({ createdAt: -1 })
      .populate('test'); // Optional: shows test topic & questions

    res.json(bookings);
  } catch (err) {
    console.error('❌ GetMyBookings error:', err);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
};

/* ════════════════ 3. Get All Bookings (Admin Panel) ════════════════ */
exports.getAllBookings = async (req, res) => {
  try {
    const bookings = await Booking.find()
      .sort({ createdAt: -1 })
      .populate({ path: 'user', select: 'name email' }) // ✅ This is what enables admin to see user info
      .populate('test');

    res.json(bookings);
  } catch (err) {
    console.error('❌ Admin getAllBookings error:', err);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
};

/* ════════════════ 4. Update Booking Status (Admin Panel) ════════════════ */
exports.updateBookingStatus = async (req, res) => {
  const { bookingId } = req.params;
  const { status } = req.body;

  if (!['APPROVED', 'REJECTED'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status value' });
  }

  try {
    const updated = await Booking.findByIdAndUpdate(bookingId, { status }, { new: true });
    if (!updated) return res.status(404).json({ error: 'Booking not found' });

    res.json({ message: 'Booking status updated', updated });
  } catch (err) {
    console.error('❌ updateBookingStatus error:', err);
    res.status(500).json({ error: 'Failed to update booking status' });
  }
};
