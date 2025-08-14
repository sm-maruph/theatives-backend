const express = require('express');
const router = express.Router();
const db = require('../config/db');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { galleryUpload } = require('../config/uploads');


router.use((req, res, next) => {
  console.log(`Incoming request: ${req.method} ${req.path}`);
  next();
});

// GET all works
router.get('/gallery', async (req, res) => {
  try {
    const [results] = await db.query('SELECT * FROM my_gallery');
    res.json(results);
  } catch (error) {
    console.error('Error fetching works:', error);
    res.status(500).json({ error: 'Failed to fetch work' });
  }
});

router.get('/gallery/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [results] = await db.query('SELECT * FROM my_gallery WHERE id = ?', [id]);
    res.json(results);
  } catch (error) {
    console.error('Error fetching works:', error);
    res.status(500).json({ error: 'Failed to fetch work' });
  }
});

// POST create new work with file upload
router.post('/gallery', galleryUpload.single('image'), async (req, res) => {
  console.log('req.body:', req.body);
  console.log('req.file:', req.file);
  try {
    const { title, description } = req.body;
    const media_path = req.file ? `/asset/image/galleryUpload/${req.file.filename}` : null;

    const [result] = await db.query(
      'INSERT INTO my_gallery (title, description, media) VALUES (?, ?, ?)',
      [title, description, media_path]
    );
    res.status(201).json({ id: result.insertId, title, description, media_path });
  } catch (error) {
    console.error('Error creating work:', error);
    res.status(500).json({ error: 'Failed to create work' });
  }
});

// PUT update work
router.put('/gallery/:id', galleryUpload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description } = req.body;

    // Get old image path before updating
    const [oldWork] = await db.query('SELECT media FROM my_gallery WHERE id = ?', [id]);
    const oldMediaPath = oldWork[0]?.media;  // Changed from media_path to media to match your query

    const media_path = req.file ? `/asset/image/galleryUpload/${req.file.filename}` : oldMediaPath;

    await db.query(
      'UPDATE my_gallery SET title = ?, description = ?, media = ? WHERE id = ?',
      [title, description, media_path, id]
    );

    // Delete old file if a new one was uploaded
    if (req.file && oldMediaPath) {
      const oldFilePath = path.join(__dirname, '../src', oldMediaPath);
      fs.unlink(oldFilePath, (err) => {
        if (err) console.error('Error deleting old file:', err);
      });
    }

    res.status(200).json({ message: 'Work updated successfully' });
  } catch (error) {
    console.error('Error updating work:', error);
    res.status(500).json({ error: 'Failed to update work' });
  }
});

// DELETE work
router.delete('/gallery/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM my_gallery WHERE id = ?', [id]);
    res.status(200).json({ message: 'Work deleted successfully' });
  } catch (error) {
    console.error('Error deleting work:', error);
    res.status(500).json({ error: 'Failed to delete work' });
  }
});


module.exports = router;

