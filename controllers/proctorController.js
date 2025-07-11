const ProctorEvent = require('../models/ProctorEvent');   // ⬅️ Mongoose model
const Booking      = require('../models/Booking');        // ⬅️ Mongoose model

/* ═══════════════  Log Proctoring Event ═══════════════ */
exports.logProctorEvent = async (req, res) => {
  const { bookingId, eventType } = req.body;

  try {
    /* 1️⃣  Save the event */
    await ProctorEvent.create({ bookingId, eventType });

    /* 2️⃣  Count warnings for this booking */
    const warningCount = await ProctorEvent.countDocuments({
      bookingId,
      eventType: 'WARNING',
    });

    /* 3️⃣  If 3 or more warnings, kick the user */
    if (warningCount >= 3) {
      await Booking.findByIdAndUpdate(bookingId, { status: 'KICKED' });
      await ProctorEvent.create({ bookingId, eventType: 'KICK' });
      return res.status(200).json({ action: 'KICKED' });
    }

    res.status(200).json({ action: 'WARNING_LOGGED' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Proctor event failed' });
  }
};
