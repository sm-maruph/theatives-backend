const express = require('express');
const router = express.Router();
const db = require('../config/db');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { serviceUpload, microserviceUpload, workUpload } = require('../config/uploads');


router.use((req, res, next) => {
  console.log(`Incoming request: ${req.method} ${req.path}`);
  next();
});


// GET all services
router.get('/services', async (req, res) => {
  try {
    const [results] = await db.query('SELECT * FROM my_services');
    res.json(results);
  } catch (error) {
    console.error('Error fetching services:', error);
    res.status(500).json({ error: 'Failed to fetch services' });
  }
});

// POST create new service with file upload
router.post('/services', serviceUpload.single('image'), async (req, res) => {
  console.log('req.body:', req.body);
  console.log('req.file:', req.file);
  try {
    const { title, description } = req.body;
    const image_path = req.file ? `/asset/image/serviceUpload/${req.file.filename}` : null;

    const [result] = await db.query(
      'INSERT INTO my_services (title, description, image_path) VALUES (?, ?, ?)',
      [title, description, image_path]
    );
    res.status(201).json({ id: result.insertId, title, description, image_path });
  } catch (error) {
    console.error('Error creating service:', error);
    res.status(500).json({ error: 'Failed to create service' });
  }
});

// PUT update service
router.put('/services/:id', serviceUpload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description } = req.body;

    // Get old image path before updating
    const [oldService] = await db.query('SELECT image_path FROM my_services WHERE id = ?', [id]);
    const oldImagePath = oldService[0]?.image_path;

    const image_path = req.file ? `/asset/image/serviceUpload/${req.file.filename}` : oldImagePath;

    await db.query(
      'UPDATE my_services SET title = ?, description = ?, image_path = ? WHERE id = ?',
      [title, description, image_path, id]
    );

    // Delete old file if a new one was uploaded
    if (req.file && oldImagePath) {
      const oldFilePath = path.join(__dirname, '../src', oldImagePath);
      fs.unlink(oldFilePath, (err) => {
        if (err) console.error('Error deleting old file:', err);
      });
    }

    res.status(200).json({ message: 'Service updated successfully' });
  } catch (error) {
    console.error('Error updating service:', error);
    res.status(500).json({ error: 'Failed to update service' });
  }
});

// DELETE service
router.delete('/services/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM my_services WHERE id = ?', [id]);
    res.status(200).json({ message: 'Service deleted successfully' });
  } catch (error) {
    console.error('Error deleting service:', error);
    res.status(500).json({ error: 'Failed to delete service' });
  }
});



// GET all Micro-services
router.get('/microservices', async (req, res) => {
  try {
    const [results] = await db.query('SELECT * FROM my_microservices');
    res.json(results);
  } catch (error) {
    console.error('Error fetching micro services:', error);
    res.status(500).json({ error: 'Failed to fetch micro services' });
  }
});

// POST create new service with file upload
router.post('/microservices', microserviceUpload.single('image'), async (req, res) => {
  console.log('req.body:', req.body);
  console.log('req.file:', req.file);
  try {
    const { title, description } = req.body;
    const image_path = req.file ? `/asset/image/microserviceUpload/${req.file.filename}` : null;

    const [result] = await db.query(
      'INSERT INTO my_microservices (title, description, image_path) VALUES (?, ?, ?)',
      [title, description, image_path]
    );
    res.status(201).json({ id: result.insertId, title, description, image_path });
  } catch (error) {
    console.error('Error creating micro service:', error);
    res.status(500).json({ error: 'Failed to create micro service' });
  }
});

// PUT update service
router.put('/microservices/:id', microserviceUpload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description } = req.body;

    // Get old image path before updating
    const [oldService] = await db.query('SELECT image_path FROM my_microservices WHERE id = ?', [id]);
    const oldImagePath = oldService[0]?.image_path;

    const image_path = req.file ? `/asset/image/microserviceUpload/${req.file.filename}` : oldImagePath;

    await db.query(
      'UPDATE my_microservices SET title = ?, description = ?, image_path = ? WHERE id = ?',
      [title, description, image_path, id]
    );

    // Delete old file if a new one was uploaded
    if (req.file && oldImagePath) {
      const oldFilePath = path.join(__dirname, '../src', oldImagePath);
      fs.unlink(oldFilePath, (err) => {
        if (err) console.error('Error deleting old file:', err);
      });
    }

    res.status(200).json({ message: 'Micro service updated successfully' });
  } catch (error) {
    console.error('Error updating micro service:', error);
    res.status(500).json({ error: 'Failed to update micro service' });
  }
});

// DELETE service
router.delete('/microservices/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM my_microservices WHERE id = ?', [id]);
    res.status(200).json({ message: 'Micro service deleted successfully' });
  } catch (error) {
    console.error('Error deleting micro service:', error);
    res.status(500).json({ error: 'Failed to delete micro service' });
  }
});




// GET all works
router.get('/works', async (req, res) => {
  try {
    const [results] = await db.query('SELECT * FROM my_works');
    res.json(results);
  } catch (error) {
    console.error('Error fetching works:', error);
    res.status(500).json({ error: 'Failed to fetch work' });
  }
});

router.get('/works/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [results] = await db.query('SELECT * FROM my_works WHERE id = ?', [id]);
    res.json(results);
  } catch (error) {
    console.error('Error fetching works:', error);
    res.status(500).json({ error: 'Failed to fetch work' });
  }
});

// POST create new work with file upload
router.post('/works', workUpload.single('image'), async (req, res) => {
  console.log('req.body:', req.body);
  console.log('req.file:', req.file);
  try {
    const { title, description } = req.body;
    const media_path = req.file ? `/asset/image/workUpload/${req.file.filename}` : null;

    const [result] = await db.query(
      'INSERT INTO my_works (title, description, media) VALUES (?, ?, ?)',
      [title, description, media_path]
    );
    res.status(201).json({ id: result.insertId, title, description, media_path });
  } catch (error) {
    console.error('Error creating work:', error);
    res.status(500).json({ error: 'Failed to create work' });
  }
});

// PUT update work
router.put('/works/:id', workUpload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description } = req.body;

    // Get old image path before updating
    const [oldWork] = await db.query('SELECT media FROM my_works WHERE id = ?', [id]);
    const oldMediaPath = oldWork[0]?.media;  // Changed from media_path to media to match your query

    const media_path = req.file ? `/asset/image/workUpload/${req.file.filename}` : oldMediaPath;

    await db.query(
      'UPDATE my_works SET title = ?, description = ?, media = ? WHERE id = ?',
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
router.delete('/works/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM my_works WHERE id = ?', [id]);
    res.status(200).json({ message: 'Work deleted successfully' });
  } catch (error) {
    console.error('Error deleting work:', error);
    res.status(500).json({ error: 'Failed to delete work' });
  }
});


module.exports = router;

