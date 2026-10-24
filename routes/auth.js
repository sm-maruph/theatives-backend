const express = require('express');
const router = express.Router();
const db = require('../config/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Login Route
// Login Route using async/await
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const [results] = await db.query(
      'SELECT id, username, password FROM public.admin WHERE username = ?',
      [username]
    );

    if (results.length === 0 || !(await bcrypt.compare(password, results[0].password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: results[0].id, username: results[0].username },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({ message: 'Login successful', token });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
