const express = require('express');
const router = express.Router();
const db = require('../config/db');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const {reviewUpload } = require('../config/uploads');
router.use((req, res, next) => {
  console.log(`Incoming request: ${req.method} ${req.path}`);
  next();
});


// GET all reviews
router.get('/reviews', async (req, res) => {
  try {
    const [results] = await db.query('SELECT * FROM reviews');
    res.json(results);
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// POST create new review
router.post('/reviews', reviewUpload.single('reviewer_image'), async (req, res) => {
  try {
    const { review_text, reviewer_name, reviewer_position, reviewer_company } = req.body;
    const reviewer_image = req.file ? `/asset/image/reviewUpload/${req.file.filename}` : null;

    const [result] = await db.query(
      'INSERT INTO reviews (review_text, reviewer_name, reviewer_position, reviewer_company, reviewer_image) VALUES (?, ?, ?, ?, ?)',
      [review_text, reviewer_name, reviewer_position, reviewer_company, reviewer_image]
    );

    res.status(201).json({
      id: result.insertId,
      review_text,
      reviewer_name,
      reviewer_position,
      reviewer_company,
      reviewer_image
    });
  } catch (error) {
    console.error('Error creating review:', error);
    res.status(500).json({ error: 'Failed to create review' });
  }
});

// PUT update review
router.put('/reviews/:id', reviewUpload.single('reviewer_image'), async (req, res) => {
  try {
    const { id } = req.params;
    const { review_text, reviewer_name, reviewer_position, reviewer_company } = req.body;

    // Fetch old image
    const [oldReview] = await db.query('SELECT reviewer_image FROM reviews WHERE id = ?', [id]);
    const oldImagePath = oldReview[0]?.reviewer_image;

    const reviewer_image = req.file ? `/asset/image/reviewUpload/${req.file.filename}` : oldImagePath;

    await db.query(
      'UPDATE reviews SET review_text = ?, reviewer_name = ?, reviewer_position = ?, reviewer_company = ?, reviewer_image = ? WHERE id = ?',
      [review_text, reviewer_name, reviewer_position, reviewer_company, reviewer_image, id]
    );

    // Delete old image if a new one was uploaded
    if (req.file && oldImagePath) {
      const oldFilePath = path.join(__dirname, '../src', oldImagePath);
      fs.unlink(oldFilePath, (err) => {
        if (err) console.error('Error deleting old image:', err);
      });
    }

    res.status(200).json({ message: 'Review updated successfully' });
  } catch (error) {
    console.error('Error updating review:', error);
    res.status(500).json({ error: 'Failed to update review' });
  }
});

// DELETE review
router.delete('/reviews/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Optionally delete associated image file
    const [review] = await db.query('SELECT reviewer_image FROM reviews WHERE id = ?', [id]);
    const reviewerImage = review[0]?.reviewer_image;

    await db.query('DELETE FROM reviews WHERE id = ?', [id]);

    if (reviewerImage) {
      const imagePath = path.join(__dirname, '../src', reviewerImage);
      fs.unlink(imagePath, (err) => {
        if (err) console.error('Error deleting image file:', err);
      });
    }

    res.status(200).json({ message: 'Review deleted successfully' });
  } catch (error) {
    console.error('Error deleting review:', error);
    res.status(500).json({ error: 'Failed to delete review' });
  }
});




module.exports = router;
