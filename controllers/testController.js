const Booking = require('../models/Booking');
const Test = require('../models/Test');
const Question = require('../models/Question');
const Answer = require('../models/Answer');
const Result = require('../models/Result');
const axios = require('axios');

/* ─────────────── 🟢 1. START TEST ─────────────── */
exports.startTest = async (req, res) => {
  const userId = req.user.id;
  const { bookingId } = req.body;

  try {
    const booking = await Booking.findById(bookingId)
      .populate({
        path: 'test',
        populate: { path: 'questions', model: 'Question' }
      })
      .populate('user', 'name email degree');

    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.user._id.toString() !== userId) return res.status(403).json({ error: 'Access denied' });

    if (!['APPROVED', 'IN_PROGRESS'].includes(booking.status)) {
      return res.status(400).json({ error: 'Booking not approved or already completed' });
    }

    if (booking.scheduledAt && new Date() < booking.scheduledAt) {
      return res.status(400).json({ error: 'Test not started yet' });
    }

    if (booking.status !== 'IN_PROGRESS') {
      booking.status = 'IN_PROGRESS';
      await booking.save();
    }

    const questions = booking.test?.questions || [];
    const mcqCount = questions.filter(q => q.type === 'MCQ').length;
    const subjectiveCount = questions.filter(q => q.type === 'SUBJECTIVE').length;
    const totalMarks = questions.reduce((sum, q) => sum + (q.marks || 1), 0);

    res.json({
      user: {
        name: booking.user.name,
        email: booking.user.email,
        degree: booking.user.degree
      },
      booking: {
        topic: booking.topic,
        difficulty: booking.difficulty,
        status: booking.status,
        scheduledAt: booking.scheduledAt,
        mcqCount,
        subjectiveCount
      },
      test: {
        name: booking.test?.name || 'Test',
        durationMin: booking.test?.durationMin || 30,
        totalMarks,
        totalQuestions: questions.length,
        mcqCount,
        subjectiveCount,
        questions: questions.map(q => ({
          id: q._id,
          body: q.body,
          type: q.type,
          marks: q.marks || 1,
          options: q.optionsJson || [],
          correctAnswer: q.type === 'MCQ' ? q.correctAnswerJson?.correct || '' : null
        }))
      }
    });
  } catch (err) {
    console.error('🔥 Test Start Error:', err);
    res.status(500).json({ error: 'Test start failed' });
  }
};
exports.submitAnswers = async (req, res) => {
  const userId = req.user.id;
  const { bookingId, answers, emotions } = req.body;

  try {
    const booking = await Booking.findById(bookingId)
      .populate({ path: 'test', populate: { path: 'questions' } })
      .populate('user');

    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.user._id.toString() !== userId) return res.status(403).json({ error: 'Unauthorized' });
    if (booking.status === 'COMPLETED') return res.status(400).json({ error: 'Already submitted' });

    const testQuestions = booking.test.questions;
    const subjectiveAnswers = [];
    const answerDocs = [];

    // 1. Prepare answerDocs and collect subjective answers
    for (const q of testQuestions) {
      const userAns = answers.find(ans => ans.questionId === q._id.toString());
      const userAnswer = userAns ? userAns.answer : '';

      if (q.type === 'SUBJECTIVE') {
        subjectiveAnswers.push({
          question: q.body,
          userAnswer,
          marks: q.marks || 5
        });

        answerDocs.push({
          bookingId,
          questionId: q._id,
          answerJson: { answer: userAnswer },
          marksObtained: 0
        });
      } else if (q.type === 'MCQ') {
        const correct = q.correctAnswerJson?.correct || '';
        const isCorrect = userAnswer === correct;
        const marks = isCorrect ? (q.marks || 1) : 0;

        answerDocs.push({
          bookingId,
          questionId: q._id,
          answerJson: { answer: userAnswer },
          marksObtained: marks
        });
      }
    }

    // 2. Evaluate subjective answers via Gemini
    let subjectiveMarksMap = {};
    if (subjectiveAnswers.length > 0) {
      const promptParts = subjectiveAnswers.map((item, i) => {
        return `Q${i + 1}: ${item.question}\nAnswer: ${item.userAnswer}\nMax Marks: ${item.marks}`;
      }).join('\n\n');

      const prompt = `
Evaluate the following subjective answers on a scale of 0 to the given Max Marks.
Only return a JSON array with marks like: [{"marks": 3}, {"marks": 5}, ...]

${promptParts}
`;

      const geminiRes = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        { contents: [{ parts: [{ text: prompt }] }] }
      );

      let text = geminiRes.data?.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
      text = text.trim().replace(/^```json/, '').replace(/```$/, '');
      const marksArray = JSON.parse(text);

      marksArray.forEach((item, index) => {
        subjectiveMarksMap[subjectiveAnswers[index].question] = item.marks || 0;
      });
    }

    // 3. Update marks for subjective answers
    for (const doc of answerDocs) {
      const q = testQuestions.find(q => q._id.toString() === doc.questionId.toString());
      if (q.type === 'SUBJECTIVE') {
        doc.marksObtained = subjectiveMarksMap[q.body] || 0;
      }
    }

    await Answer.insertMany(answerDocs);

    booking.status = 'COMPLETED';
    await booking.save();

    const totalMarks = booking.test.totalMarks || testQuestions.reduce((sum, q) => sum + (q.marks || 1), 0);
    const marksObtained = answerDocs.reduce((sum, a) => sum + a.marksObtained, 0);

    const evaluation = answerDocs.map(doc => {
      const q = testQuestions.find(q => q._id.toString() === doc.questionId.toString());
      const correctAns = q.type === 'MCQ' ? q.correctAnswerJson?.correct || '' : null;
      const userAns = doc.answerJson?.answer || '';
      const isCorrect = q.type === 'MCQ' ? (userAns === correctAns) : null;
      return {
        question: q.body,
        correctAnswer: correctAns,
        userAnswer: userAns,
        isCorrect,
        marksAwarded: doc.marksObtained
      };
    });

    // ─ Emotion Report Prompt ─
    let emotionReport = '';
    try {
      const flatEmotions = Object.entries(emotions || {}).map(([qId, logs], idx) => {
        const summary = logs.map(e => {
          const maxEmotion = Object.entries(e.expressions).reduce((a, b) => a[1] > b[1] ? a : b)[0];
          return `(${new Date(e.time).toLocaleTimeString()} - ${maxEmotion})`;
        }).join(', ');
        return `Q${idx + 1}: ${summary}`;
      }).join('\n');

      const emotionPrompt = `
Based on the student's real-time facial emotions observed during each question attempt, provide constructive feedback and emotional intelligence insights.
Format:
- Summary per question
- Observed emotional trends (confusion, confidence, stress, etc.)
- Suggestions for improvement

Data:
${flatEmotions}
`;

      const geminiEmotionRes = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          contents: [{ parts: [{ text: emotionPrompt }] }]
        }
      );

      emotionReport = geminiEmotionRes.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } catch (err) {
      console.error('⚠️ Emotion feedback generation failed:', err.response?.data || err.message);
    }

    // ✅ Fixed: Added bookingId to Result
    await Result.create({
      user: booking.user._id,
      test: booking.test._id,
      bookingId: booking._id, // ✅ Added this line
      totalQuestions: testQuestions.length,
      totalMarks,
      marksObtained,
      submittedAt: new Date(),
      reviewed: false,
      evaluation,
      emotionReport,
      answers: answerDocs.map(a => ({
        questionId: a.questionId,
        answerJson: a.answerJson
      }))
    });

    res.json({
      message: 'Test submitted and evaluated successfully',
      totalAnswers: answerDocs.length,
      marksObtained,
      totalMarks
    });

  } catch (err) {
    console.error('🔥 Submit Error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Test submission failed' });
  }
};

/* ─────────────── 🟢 3. GET RESULT ─────────────── */
exports.getResult = async (req, res) => {
  const userId = req.user.id;
  const { bookingId } = req.params;

  try {
    const booking = await Booking.findById(bookingId)
      .populate('test')
      .populate('answers');

    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if ((booking.userId || booking.user?._id)?.toString() !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const totalObtained = booking.answers.reduce((sum, a) => sum + a.marksObtained, 0);

    res.json({
      testName: booking.test.name,
      totalMarks: booking.test.totalMarks,
      marksObtained: totalObtained,
      status: booking.status,
      submittedAt: booking.updatedAt,
      totalQuestions: booking.answers.length
    });
  } catch (err) {
    console.error('🔥 Result Fetch Error:', err);
    res.status(500).json({ error: 'Failed to fetch result' });
  }
};

/* ─────────────── 🟢 4. GENERATE TEST ─────────────── */
exports.generateTest = async (req, res) => {
  const { name, topic, difficulty, bookingId } = req.body;
  const createdBy = req.user.id;

  try {
    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    const prompt = `
Generate a test on "${topic}" with "${difficulty}" difficulty using this structure:

1. First: "Tell me about yourself." (subjective)
2. Next 2: subjective reasoning questions
3. Next 12: MCQs with 4 options and correct answer
4. Last 5: subjective questions

Return as valid JSON array with:
- "body"
- "type": "SUBJECTIVE" or "MCQ"
- "marks"
- "options" (for MCQ)
- "correctAnswer" (for MCQ)
`;

    const geminiRes = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      { contents: [{ parts: [{ text: prompt }] }] }
    );

    let text = geminiRes.data?.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
    text = text.trim().replace(/^```json/, '').replace(/```$/, '');

    let questionsArr;
    try {
      questionsArr = JSON.parse(text);
    } catch (err) {
      console.error('⚠️ Invalid JSON from Gemini:', text);
      return res.status(500).json({ error: 'Gemini returned invalid JSON' });
    }

    if (!Array.isArray(questionsArr) || questionsArr.length < 20) {
      return res.status(400).json({ error: 'Insufficient questions received from Gemini' });
    }

    const test = await Test.create({
      name: name || `Interview + MCQ Test on ${topic}`,
      description: `Mixed style test on ${topic} (${difficulty})`,
      durationMin: 60,
      totalMarks: 0,
      createdBy
    });

    const questionDocs = questionsArr.map(q => ({
      body: q.body,
      type: q.type.toUpperCase(), // ✅ FIXED HERE
      marks: q.marks || (q.type.toUpperCase() === 'MCQ' ? 1 : 5),
      optionsJson: q.options || [],
      correctAnswerJson: q.type.toUpperCase() === 'MCQ' ? { correct: q.correctAnswer } : {},
      testId: test._id
    }));

    const inserted = await Question.insertMany(questionDocs);
    const totalMarks = inserted.reduce((sum, q) => sum + q.marks, 0);
    const mcqCount = inserted.filter(q => q.type === 'MCQ').length;
    const subjectiveCount = inserted.filter(q => q.type === 'SUBJECTIVE').length;

    await Test.findByIdAndUpdate(test._id, { totalMarks });

    await Booking.findByIdAndUpdate(bookingId, {
      test: test._id,
      topic,
      difficulty,
      mcqCount,
      subjectiveCount,
      status: 'APPROVED'
    });

    res.json({
      message: 'Interview + MCQ test generated successfully!',
      testId: test._id,
      bookingId,
      totalQuestions: inserted.length,
      mcqCount,
      subjectiveCount
    });
  } catch (err) {
    console.error('🔥 Test Generation Error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to generate test' });
  }
};

// ─────────────── 🟣 5. GENERATE EMOTION REPORT ───────────────
exports.generateEmotionReport = async (req, res) => {
  const { bookingId } = req.params;
  const userId = req.user.id;

  try {
    const result = await Result.findOne({ bookingId })
      .populate('user', 'name email')
      .populate('test', 'name');

    if (!result) return res.status(404).json({ error: 'Result not found' });

    // Optional: Check if the logged-in user is authorized to view it
    if (result.user._id.toString() !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    res.json({
      testName: result.test.name,
      candidate: result.user.name,
      email: result.user.email,
      emotionReport: result.emotionReport
    });
  } catch (err) {
    console.error('🔥 Emotion Report Error:', err);
    res.status(500).json({ error: 'Failed to fetch emotion report' });
  }
};
