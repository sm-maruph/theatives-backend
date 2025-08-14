const express = require('express');
const router = express.Router();
const db = require('../config/db');
const jwt = require('jsonwebtoken');

// Login Route
// Login Route using async/await
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  console.log('Login attempt:', username, password);

  try {
    const [results] = await db.query(
      'SELECT * FROM admin WHERE username = ? AND password = ?',
      [username, password]
    );

    console.log('Query results:', results);

    if (results.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: results[0].id, username: results[0].username },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({ message: 'Login successful', token });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
