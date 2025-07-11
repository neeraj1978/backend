module.exports = (req, res, next) => {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Only admins can access this route' });
  }
  next();
};
