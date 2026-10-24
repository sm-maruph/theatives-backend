const express = require('express');
const router = express.Router();
const db = require('../config/db');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { memberUpload } = require('../config/uploads');
const { getStorageClient } = require('../config/supabaseStorage');
const requireAdmin = require('../middleware/requireAdmin');
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, callback) => callback(null, file.mimetype.startsWith('image/')),
});

router.use((req, res, next) => {
  console.log(`Incoming request: ${req.method} ${req.path}`);
  next();
});

// Upload member images through the trusted backend so the secret storage key
// never reaches the browser. The bucket is public-read; writes use this API.
router.post('/member-upload', requireAdmin, imageUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'An image file is required.' });
    const extension = req.file.mimetype === 'image/webp' ? '.webp' : path.extname(req.file.originalname).toLowerCase();
    const objectPath = `members/${Date.now()}-${randomUUID()}${extension || '.img'}`;
    const { error } = await getStorageClient().storage
      .from('member-images')
      .upload(objectPath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      });
    if (error) throw error;
    const { data } = getStorageClient().storage.from('member-images').getPublicUrl(objectPath);
    res.status(201).json({ filePath: data.publicUrl, publicUrl: data.publicUrl });
  } catch (error) {
    console.error('Member image upload failed:', error.message);
    res.status(500).json({ error: 'Member image upload failed.' });
  }
});

// GET all members
router.get('/members', async (req, res) => {
  try {
    const [results] = await db.query('SELECT * FROM members');
    res.json(results);
  } catch (error) {
    console.error('Error fetching members:', error);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

// POST create new member
router.post('/members', memberUpload.single('member_image'), async (req, res) => {
  try {
    const { name, nickname, position } = req.body;
    const member_image = req.file
      ? `/asset/image/memberUpload/${req.file.filename}`
      : req.body.member_image || null;

    const [result] = await db.query(
      'INSERT INTO members (name, nickname, position, member_image) VALUES (?, ?, ?, ?)',
      [name, nickname, position, member_image]
    );

    res.status(201).json({
      id: result.insertId,
      name,
      nickname,
      position,
      member_image
    });
  } catch (error) {
    console.error('Error creating member:', error);
    res.status(500).json({ error: 'Failed to create member' });
  }
});

// PUT update member
router.put('/members/:id', memberUpload.single('member_image'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, nickname, position } = req.body;

    // Fetch old image
    const [oldMember] = await db.query('SELECT member_image FROM members WHERE id = ?', [id]);
    const oldImagePath = oldMember[0]?.member_image;

    const member_image = req.file
      ? `/asset/image/memberUpload/${req.file.filename}`
      : req.body.member_image || oldImagePath;

    await db.query(
      'UPDATE members SET name = ?, nickname = ?, position = ?, member_image = ? WHERE id = ?',
      [name, nickname, position, member_image, id]
    );

    // Delete old image if a new one was uploaded
    if (req.file && oldImagePath?.startsWith('/asset/image/memberUpload/')) {
      const oldFilePath = path.join(__dirname, '../src', oldImagePath);
      fs.unlink(oldFilePath, (err) => {
        if (err) console.error('Error deleting old image:', err);
      });
    }

    res.status(200).json({ message: 'Member updated successfully' });
  } catch (error) {
    console.error('Error updating member:', error);
    res.status(500).json({ error: 'Failed to update member' });
  }
});

// DELETE member
router.delete('/members/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Optionally delete associated image file
    const [member] = await db.query('SELECT member_image FROM members WHERE id = ?', [id]);
    const memberImage = member[0]?.member_image;

    await db.query('DELETE FROM members WHERE id = ?', [id]);

    if (memberImage?.startsWith('/asset/image/memberUpload/')) {
      const imagePath = path.join(__dirname, '../src', memberImage);
      fs.unlink(imagePath, (err) => {
        if (err) console.error('Error deleting image file:', err);
      });
    }

    res.status(200).json({ message: 'Member deleted successfully' });
  } catch (error) {
    console.error('Error deleting member:', error);
    res.status(500).json({ error: 'Failed to delete member' });
  }
});

module.exports = router;
