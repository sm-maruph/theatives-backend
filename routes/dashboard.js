const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

// Middleware to verify token
function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization']; // safer syntax
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

// Protected route
router.get('/dashboard', verifyToken, (req, res) => {
  res.json({
    message: 'Welcome to the admin dashboard',
    user: req.user
  });
});

module.exports = router;
