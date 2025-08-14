const express = require('express');
const router = express.Router();
const db = require('../config/db');
const fs = require('fs');
const path = require('path');
const { clientUpload } = require('../config/uploads');

// Logging
router.use((req, res, next) => {
  console.log(`Incoming request: ${req.method} ${req.path}`);
  next();
});

// GET all clients
router.get('/clients', async (req, res) => {
  try {
    const [results] = await db.query('SELECT * FROM clients');
    res.json(results);
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({ error: 'Failed to fetch clients' });
  }
});

// POST create new client
router.post('/clients', clientUpload.single('client_logo'), async (req, res) => {
  try {
    const { client_name } = req.body;
    const client_logo = req.file ? `/asset/image/clientUpload/${req.file.filename}` : null;

    const [result] = await db.query(
      'INSERT INTO clients (client_name, client_logo) VALUES (?, ?)',
      [client_name, client_logo]
    );

    res.status(201).json({
      id: result.insertId,
      client_name,
      client_logo,
    });
  } catch (error) {
    console.error('Error creating client:', error);
    res.status(500).json({ error: 'Failed to create client' });
  }
});

// PUT update client
router.put('/clients/:id', clientUpload.single('client_logo'), async (req, res) => {
  try {
    const { id } = req.params;
    const { client_name } = req.body;

    // Get old logo path
    const [oldClient] = await db.query('SELECT client_logo FROM clients WHERE id = ?', [id]);
    const oldLogoPath = oldClient[0]?.client_logo;

    const client_logo = req.file ? `/asset/image/clientUpload/${req.file.filename}` : oldLogoPath;

    await db.query(
      'UPDATE clients SET client_name = ?, client_logo = ? WHERE id = ?',
      [client_name, client_logo, id]
    );

    // Delete old logo if a new one was uploaded
    if (req.file && oldLogoPath) {
      const oldFilePath = path.join(__dirname, '../src', oldLogoPath);
      fs.unlink(oldFilePath, (err) => {
        if (err) console.error('Error deleting old image:', err);
      });
    }

    res.status(200).json({ message: 'Client updated successfully' });
  } catch (error) {
    console.error('Error updating client:', error);
    res.status(500).json({ error: 'Failed to update client' });
  }
});

// DELETE client
router.delete('/clients/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Get client logo
    const [client] = await db.query('SELECT client_logo FROM clients WHERE id = ?', [id]);
    const clientLogo = client[0]?.client_logo;

    await db.query('DELETE FROM clients WHERE id = ?', [id]);

    if (clientLogo) {
      const imagePath = path.join(__dirname, '../src', clientLogo);
      fs.unlink(imagePath, (err) => {
        if (err) console.error('Error deleting image file:', err);
      });
    }

    res.status(200).json({ message: 'Client deleted successfully' });
  } catch (error) {
    console.error('Error deleting client:', error);
    res.status(500).json({ error: 'Failed to delete client' });
  }
});

module.exports = router;
