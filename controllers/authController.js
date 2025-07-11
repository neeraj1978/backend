// controllers/authController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');        // Mongoose model
const OtpLog = require('../models/OtpLog');    // Mongoose model
const { sendOTP } = require('../utils/sendOtp');

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

// OTP generator function
const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

/* ════════════════════ 1. REGISTER (send OTP) ═══════════════════ */
exports.registerUser = async (req, res) => {
  const { name, email, phone, password, role = 'STUDENT' } = req.body;

  try {
    if (await User.findOne({ email }))
      return res.status(400).json({ error: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, phone, password: hashedPassword, role });

    const otp = generateOtp();
    await OtpLog.create({
      otp,
      userId: user._id,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });

    await sendOTP(email, otp);

    res.json({ message: 'OTP sent to email', userId: user._id });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
};


/* ════════════════════ 2. VERIFY OTP ═══════════════════ */
exports.verifyOtp = async (req, res) => {
  const { userId, otp } = req.body;

  try {
    const otpLog = await OtpLog.findOne({
      userId,
      otp,
      used: false,
      expiresAt: { $gt: new Date() },
    });

    if (!otpLog)
      return res.status(400).json({ error: 'Invalid or expired OTP' });

    await OtpLog.updateOne({ _id: otpLog._id }, { used: true });
    await User.updateOne({ _id: userId }, { verified: true });

    const token = jwt.sign({ id: userId, role: 'STUDENT' }, JWT_SECRET, { expiresIn: '7d' });

    res.json({ message: 'Verification successful', token });
  } catch (err) {
    console.error('OTP verification error:', err);
    res.status(500).json({ error: 'OTP verification failed' });
  }
};

/* ════════════════════ 3. LOGIN ═══════════════════ */
exports.loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user)
      return res.status(404).json({ error: 'User not found' });

    if (!user.verified)
      return res.status(403).json({ error: 'Please verify your account first' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(401).json({ error: 'Incorrect password' });

    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    // ✅ Include user in the response
    res.json({
      message: 'Login successful',
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
};


/* ════════════════════ 4. FORGOT PASSWORD (send OTP) ══════════ */
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user)
      return res.status(404).json({ error: 'User not found' });

    const otp = generateOtp();
    await OtpLog.create({
      otp,
      userId: user._id,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });

    await sendOTP(email, otp);

    res.json({ message: 'OTP sent for password reset', userId: user._id });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
};

/* ════════════════════ 5. RESET PASSWORD ═══════════════════ */
// NEW resetPassword function (userId based)
exports.resetPassword = async (req, res) => {
  const { userId, newPassword } = req.body;

  try {
    if (!userId || !newPassword) {
      return res.status(400).json({ error: 'userId and newPassword required' });
    }

    const user = await User.findById(userId);

    if (!user)
      return res.status(404).json({ error: 'User not found' });

    const hashed = await bcrypt.hash(newPassword, 10);
    await User.updateOne({ _id: userId }, { password: hashed });

    return res.json({ message: '✅ Password reset successful' });
  } catch (err) {
    console.error('Reset password error:', err);
    return res.status(500).json({ error: 'Server error during password reset' });
  }
};


/* ════════════════════ 6. GET LOGGED IN USER (/me) ════════════ */
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error('Get me error:', err);
    res.status(500).json({ error: 'Something went wrong' });
  }
};
