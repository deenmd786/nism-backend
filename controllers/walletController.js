const jwt = require('jsonwebtoken');

module.exports = function(req, res, next) {
  // 1. Get token from header
  // Check 'x-auth-token' OR 'Authorization'
  let token = req.header('x-auth-token') || req.header('Authorization');

  // 2. Check if no token
  if (!token) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }

  // 3. Remove "Bearer " prefix if it exists (Common in Flutter/Mobile apps)
  if (token.startsWith('Bearer ')) {
    token = token.slice(7, token.length).trim();
  }

  try {
    // 4. Verify token
    // Make sure JWT_SECRET matches what you used to sign the token in authController
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 5. Assign user to request
    // Handles cases where payload is { user: { id: ... } } OR just { id: ... }
    req.user = decoded.user ? decoded.user : decoded;
    
    next();
  } catch (err) {
    console.error("Auth Middleware Error:", err.message);
    res.status(401).json({ msg: 'Token is not valid' });
  }
};