const Result = require('../models/Result');

// For logged-in users
// ✅ GET all confirmed results for a user
exports.getUserResults = async (req, res) => {
  try {
    
    const userId = req.user.id;

    const results = await Result.find({ user: userId, reviewed: true })
      .populate('test', 'name totalMarks')
      .sort({ submittedAt: -1 });

    
    res.json(results);

  } catch (err) {
    console.error('❌ User Results Fetch Error:', err); // ✅ Shows exact error
    res.status(500).json({ error: 'Failed to fetch results' });
  }
};

// ✅ GET single result
// controllers/resultController.js
exports.getUserResultById = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    const result = await Result.findById(id)
      .populate('test')
      .populate('user');

    if (!result) {
      
      return res.status(404).json({ error: 'Result not found' });
    }

    // Safe comparison of user ID
    const resultUserId = result.user?._id?.toString?.() || result.user?.toString?.();
    

    if (resultUserId !== userId) {
      return res.status(403).json({ error: 'Unauthorized access to result' });
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
};



// For admin to view all results
exports.getAllResults = async (_req, res) => {
  try {
    const results = await Result.find()
      .sort({ createdAt: -1 })
      .populate('user', 'name email')
      .populate('test');
    res.json(results);
  } catch (err) {
    console.error('❌ getAllResults error:', err);
    res.status(500).json({ error: 'Could not fetch all results' });
  }
};
