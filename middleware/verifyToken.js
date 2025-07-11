const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'supersecurekey123';

module.exports = function (req, res, next) {
  // 1. More flexible token extraction
  const token = 
    req.header('Authorization')?.split(' ')[1] || 
    req.query.token || 
    req.cookies.token;

  if (!token) {
    return res.status(401).json({ 
      error: 'Authentication required',
      details: 'No token provided in Authorization header, query params, or cookies'
    });
  }

  try {
    // 2. Add leeway for clock skew (60 seconds)
    const decoded = jwt.verify(token, JWT_SECRET, { clockTolerance: 60 });
    
    // 3. More comprehensive user object
    req.user = { 
      id: decoded.id, 
      role: decoded.role,
      // Add any other standard claims you need
      iss: decoded.iss, // issuer
      exp: decoded.exp, // expiration timestamp
      iat: decoded.iat  // issued at timestamp
    };
    
    // 4. Log for debugging (remove in production)
    // console.log(`Authenticated user ${decoded.id} with role ${decoded.role}`);
    
    next();
  } catch (err) {
    // 5. More detailed error responses
    let errorMsg = 'Invalid token';
    
    if (err.name === 'TokenExpiredError') {
      errorMsg = `Token expired at ${err.expiredAt}`;
    } else if (err.name === 'JsonWebTokenError') {
      errorMsg = `Malformed token: ${err.message}`;
    }
    
    console.error('JWT Verification Error:', err);
    return res.status(403).json({ 
      error: errorMsg,
      details: err.message 
    });
  }
};