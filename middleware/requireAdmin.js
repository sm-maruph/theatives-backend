const jwt = require('jsonwebtoken');

module.exports = function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Admin token required' });

  jwt.verify(token, process.env.JWT_SECRET, (error, user) => {
    if (error) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
};
