const jwt = require('jsonwebtoken');

module.exports = function(req, res, next) {
  let token = req.header('x-auth-token') || req.header('Authorization');

  if (!token) return res.status(401).json({ msg: 'No token, authorization denied' });

  if (token.startsWith('Bearer ')) {
    token = token.slice(7, token.length).trim();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded.user ? decoded.user : decoded;
    next();
  } catch (err) {
    console.error("Auth Error:", err.message);
    res.status(401).json({ msg: 'Token is not valid' });
  }
};