const express = require("express");
const router = express.Router();
const db = require("../config/db");
const fs = require("fs");
const path = require("path");
const { jobsUpload } = require("../config/uploads");

// Logging middleware
router.use((req, res, next) => {
  console.log(`Incoming request: ${req.method} ${req.path}`);
  next();
});

// GET all careers
router.get("/careers", async (req, res) => {
  try {
    const [results] = await db.query("SELECT * FROM careers ORDER BY id DESC");
    res.json(results);
  } catch (error) {
    console.error("Error fetching careers:", error);
    res.status(500).json({ error: "Failed to fetch careers" });
  }
});

router.post('/careers', jobsUpload.single('image'), async (req, res) => {
  try {
    console.log("Received body:", req.body);
    console.log("Received file:", req.file);

    const { position, type, status, description, requirements } = req.body;
    const image_path = req.file ? `/asset/image/careerUpload/${req.file.filename}` : null;

    const [result] = await db.query(
      'INSERT INTO careers (position, type, status, description, requirements, image_path) VALUES (?, ?, ?, ?, ?, ?)',
      [position, type, status, description, requirements, image_path]
    );

    res.status(201).json({
      id: result.insertId,
      position,
      type,
      status,
      description,
      requirements,
      image_path,
    });
  } catch (error) {
    console.error('Error creating career:', error);
    res.status(500).json({ error: 'Failed to create career' });
  }
});

// PUT update entire career
router.put("/careers/:id", jobsUpload.single("image"), async (req, res) => {
  try {
    const { id } = req.params;
    const { position, type, status, description, requirements, image_path } =
      req.body;

    await db.query(
      "UPDATE careers SET position = ?, type = ?, status = ?, description = ?, requirements = ? WHERE id = ?",
      [position, type, status, description, requirements, id]
    );

    res.status(200).json({ message: "Career updated successfully" });
  } catch (error) {
    console.error("Error updating career:", error);
    res.status(500).json({ error: "Failed to update career" });
  }
});

// PUT update status only
router.put("/careers/:id/status", jobsUpload.none(), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const [result] = await db.query(
      "UPDATE careers SET status = ? WHERE id = ?",
      [status, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Career not found" });
    }

    res.status(200).json({ message: `Career status updated to ${status}` });
  } catch (error) {
    console.error("Error updating career status:", error);
    res.status(500).json({ error: "Failed to update career status" });
  }
});

// DELETE a career
router.delete("/careers/:id", async (req, res) => {
  try {
    const { id } = req.params;

    await db.query("DELETE FROM careers WHERE id = ?", [id]);

    res.status(200).json({ message: "Career deleted successfully" });
  } catch (error) {
    console.error("Error deleting career:", error);
    res.status(500).json({ error: "Failed to delete career" });
  }
});

// POST upload image
router.post("/upload", jobsUpload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const filePath = `/uploads/${req.file.filename}`;
    res.status(200).json({ filePath });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: "File upload failed" });
  }
});

module.exports = router;
