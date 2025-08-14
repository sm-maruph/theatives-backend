require('dotenv').config();
const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

// Admin Login Route
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  console.log('Incoming login:', username);

  const query = 'SELECT * FROM admin WHERE username = ?';

  pool.query(query, [username], async (err, results) => {
    if (err) {
      console.error('DB error:', err);
      return res.status(500).json({ message: 'Database error' });
    }

    if (results.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials - user not found' });
    }

    const user = results[0];

    // Use bcrypt for password comparison
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials - wrong password' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({ token });
  });
});

// Admin Logout Route
router.post('/logout', (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token missing or invalid' });
  }

  const token = authHeader.split(' ')[1];
  console.log('Logout called. Token:', token);

  // NOTE: If you implement token blacklisting, store `token` here.

  return res.json({ message: 'Logout successful' });
});

module.exports = router;
