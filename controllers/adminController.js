const jwt = require("jsonwebtoken");
const Document = require('../models/Document');
const Booking = require('../models/Booking');
const Result = require('../models/Result');
const Question = require('../models/Question');
const { sendResultEmail } = require('../utils/sendResult');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@test.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const JWT_SECRET = process.env.JWT_SECRET || "secret_key";

/* ─────────────── 1. ADMIN LOGIN ─────────────── */
exports.adminLogin = async (req, res) => {
  const { email, password } = req.body;
  if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Invalid admin credentials" });
  }
  const token = jwt.sign({ role: "ADMIN" }, JWT_SECRET, { expiresIn: "7d" });
  res.json({ message: "Admin login successful", token });
};

/* ─────────────── 2. DOCUMENT MANAGEMENT ─────────────── */
exports.getAllDocuments = async (_req, res) => {
  try {
    const docs = await Document.find()
      .sort({ createdAt: -1 })
      .populate({ path: 'userId', select: 'name email' });
    res.json(docs);
  } catch (err) {
    console.error('❌ getAllDocuments error:', err);
    res.status(500).json({ error: 'Error fetching documents' });
  }
};

exports.updateDocumentStatus = async (req, res) => {
  const { docId } = req.params;
  const { status } = req.body;

  if (!['APPROVED', 'REJECTED'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status value' });
  }

  try {
    const updated = await Document.findByIdAndUpdate(docId, { status }, { new: true })
      .populate({ path: 'userId', select: 'name email' });
    if (!updated) return res.status(404).json({ error: 'Document not found' });
    res.json({ message: 'Document status updated', updated });
  } catch (err) {
    console.error('❌ updateDocumentStatus error:', err);
    res.status(500).json({ error: 'Failed to update document status' });
  }
};

/* ─────────────── 3. BOOKING MANAGEMENT ─────────────── */
exports.getAllBookings = async (_req, res) => {
  try {
    const bookings = await Booking.find()
      .sort({ createdAt: -1 })
      .populate({ path: 'user', select: 'name email' })
      .populate('test');
    res.json(bookings);
  } catch (err) {
    console.error('❌ getAllBookings error:', err);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
};

exports.updateBookingStatus = async (req, res) => {
  const { bookingId } = req.params;
  const { status } = req.body;

  if (!['APPROVED', 'REJECTED'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status value' });
  }

  try {
    const updated = await Booking.findByIdAndUpdate(bookingId, { status }, { new: true })
      .populate({ path: 'user', select: 'name email' })
      .populate('test');

    if (!updated) return res.status(404).json({ error: 'Booking not found' });
    res.json({ message: 'Booking status updated', updated });
  } catch (err) {
    console.error('❌ updateBookingStatus error:', err);
    res.status(500).json({ error: 'Failed to update booking status' });
  }
};

/* ─────────────── 4. RESULT MANAGEMENT ─────────────── */

// 4.1 Get All Unreviewed Results
exports.getPendingResults = async (_req, res) => {
  try {
    const results = await Result.find({ reviewed: false })
      .populate('user', 'name email')
      .populate('test');
    res.json(results);
  } catch (err) {
    console.error('❌ getPendingResults error:', err);
    res.status(500).json({ error: 'Failed to fetch pending results' });
  }
};

// 4.2 Get Result By ID (for Admin Review)
exports.getResultById = async (req, res) => {
  try {
    const resultId = req.params.resultId;
    const result = await Result.findById(resultId)
      .populate('user', 'name email')
      .populate({
        path: 'test',
        populate: {
          path: 'questions',
          model: 'Question'
        }
      });

    if (!result) return res.status(404).json({ message: 'Result not found' });

    let evaluation = result.evaluation;

    if (!evaluation || evaluation.length === 0) {
      evaluation = result.test.questions.map(q => {
        const answerObj = result.answers?.find(a => String(a.questionId) === String(q._id));
        const userAnswer = answerObj?.answerJson?.answer || '';
        const correctAnswer = q.correctAnswerJson?.correct || '';
        const isCorrect = userAnswer === correctAnswer;
        const marksAwarded = isCorrect ? (q.marks || 1) : 0;

        return {
          question: q.body,
          userAnswer,
          correctAnswer,
          isCorrect,
          marksAwarded
        };
      });

      result.evaluation = evaluation;
      await result.save();
    }

    res.json({ result, responses: result.evaluation });
  } catch (err) {
    console.error('❌ getResultById error:', err);
    res.status(500).json({ message: 'Server error while fetching result' });
  }
};

// 4.3 Confirm and Send Final Result
exports.confirmResult = async (req, res) => {
  try {
    const resultId = req.params.resultId;
    const { updatedResponses, finalMarks } = req.body;

    const result = await Result.findById(resultId)
      .populate('user', 'name email')
      .populate({
        path: 'test',
        populate: {
          path: 'questions',
          model: 'Question'
        }
      });

    if (!result) return res.status(404).json({ error: 'Result not found' });

    if (Array.isArray(updatedResponses)) {
      result.evaluation = updatedResponses.map(item => ({
        question: item.question,
        userAnswer: item.userAnswer,
        correctAnswer: item.correctAnswer,
        isCorrect: item.isCorrect,
        marksAwarded: item.marksAwarded || 0
      }));
    }

    result.marksObtained = typeof finalMarks === 'number' ? finalMarks : 0;
    result.reviewed = true;
    result.status = 'CONFIRMED'; 
    await result.save();

    // Fix: fallback to evaluation if test.questions is missing
    const totalQuestions =
      (result.test.questions && result.test.questions.length) ||
      (result.evaluation && result.evaluation.length) || 0;

    await sendResultEmail(result.user.email, 'Your Final Test Result', {
      testName: result.test.name,
      totalQuestions,
      totalMarks: result.totalMarks,
      marksObtained: result.marksObtained
    });

    res.json({ message: '✅ Result confirmed and emailed.' });
  } catch (err) {
    console.error('❌ confirmResult error:', err);
    res.status(500).json({ error: 'Failed to confirm result' });
  }
};

/* ─────────────── 5. DELETE RESOURCES ─────────────── */
exports.deleteDocument = async (req, res) => {
  try {
    const deleted = await Document.findByIdAndDelete(req.params.docId);
    if (!deleted) return res.status(404).json({ error: 'Document not found' });
    res.json({ message: 'Document deleted successfully' });
  } catch (err) {
    console.error('❌ deleteDocument error:', err);
    res.status(500).json({ error: 'Failed to delete document' });
  }
};

exports.deleteBooking = async (req, res) => {
  try {
    const deleted = await Booking.findByIdAndDelete(req.params.bookingId);
    if (!deleted) return res.status(404).json({ error: 'Booking not found' });
    res.json({ message: 'Booking deleted successfully' });
  } catch (err) {
    console.error('❌ deleteBooking error:', err);
    res.status(500).json({ error: 'Failed to delete booking' });
  }
};

exports.deleteResult = async (req, res) => {
  try {
    const deleted = await Result.findByIdAndDelete(req.params.resultId);
    if (!deleted) return res.status(404).json({ error: 'Result not found' });
    res.json({ message: 'Result deleted successfully' });
  } catch (err) {
    console.error('❌ deleteResult error:', err);
    res.status(500).json({ error: 'Failed to delete result' });
  }
};
