const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { showcaseUpload } = require("../config/uploads");
const path = require("path");
const fs = require("fs");

// Log middleware
router.use((req, res, next) => {
  console.log(`Incoming request: ${req.method} ${req.path}`);
  next();
});

// POST: Create a new showcase
router.post(
  "/showcases",
  showcaseUpload.fields([
    { name: "images", maxCount: 10 },
    { name: "videos", maxCount: 5 },
  ]),
  async (req, res) => {
    try {
      const { title, category, sections } = JSON.parse(req.body.data);
      const imageFiles = req.files["images"] || [];
      const videoFiles = req.files["videos"] || [];

      const [result] = await db.query(
        "INSERT INTO showcase (title, category) VALUES (?, ?)",
        [title, category]
      );
      const showcaseId = result.insertId;

      const sectionPromises = sections.map((section, index) => {
        const { type, content } = section;
        let mediaUrl = null;

        if (type === "image") {
          const file = imageFiles.shift();
          mediaUrl = file ? `/asset/image/showcaseUpload/${file.filename}` : "";
        } else if (type === "video") {
          const file = videoFiles.shift();
          mediaUrl = file ? `/asset/image/showcaseUpload/${file.filename}` : "";
        }

        if (type === "list") {
          return db.query(
            "INSERT INTO showcase_sections (showcase_id, type, list_items, sequence) VALUES (?, ?, ?, ?)",
            [showcaseId, type, JSON.stringify(content), index]
          );
        }

        return db.query(
          "INSERT INTO showcase_sections (showcase_id, type, content, sequence) VALUES (?, ?, ?, ?)",
          [
            showcaseId,
            type,
            type === "image" || type === "video" ? mediaUrl : content,
            index,
          ]
        );
      });

      await Promise.all(sectionPromises);

      res.status(201).json({ message: "Showcase created successfully" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Something went wrong" });
    }
  }
);

// GET: Fetch all showcases with sections in correct order
router.get("/showcases", async (req, res) => {
  try {
    const [showcases] = await db.query(
      "SELECT * FROM showcase ORDER BY created_at DESC"
    );

    const showcaseWithSections = await Promise.all(
      showcases.map(async (showcase) => {
        const [sections] = await db.query(
          "SELECT * FROM showcase_sections WHERE showcase_id = ? ORDER BY sequence ASC",
          [showcase.id]
        );
        return {
          ...showcase,
          sections: sections.map((section) => ({
            type: section.type,
            content:
              section.type === "list"
                ? JSON.parse(section.list_items)
                : section.content,
          })),
        };
      })
    );

    res.json(showcaseWithSections);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch showcases" });
  }
});

// PUT: Update an existing showcase
router.put(
  "/showcases/:id",
  showcaseUpload.fields([
    { name: "images", maxCount: 10 },
    { name: "videos", maxCount: 5 },
  ]),
  async (req, res) => {
    try {
      const showcaseId = req.params.id;
      const { title, category, sections } = JSON.parse(req.body.data);
      const imageFiles = req.files["images"] || [];
      const videoFiles = req.files["videos"] || [];

      // Update showcase metadata
      await db.query("UPDATE showcase SET title = ?, category = ? WHERE id = ?", [
        title,
        category,
        showcaseId,
      ]);

      // Get old sections
      const [oldSections] = await db.query(
        "SELECT * FROM showcase_sections WHERE showcase_id = ? ORDER BY sequence ASC",
        [showcaseId]
      );

      // Process each section
      for (let index = 0; index < sections.length; index++) {
        const section = sections[index];
        const { type, content } = section;
        const oldSection = oldSections[index];

        let mediaUrl = null;

        if (type === "image") {
          const newFile = imageFiles.shift();

          if (newFile) {
            // Delete old image file if exists
            if (oldSection && oldSection.content) {
              const oldFilePath = path.join(
                __dirname,
                "..",
                "public",
                oldSection.content
              );
              if (fs.existsSync(oldFilePath)) {
                fs.unlinkSync(oldFilePath);
              }
            }
            mediaUrl = `/asset/image/showcaseUpload/${newFile.filename}`;
          } else {
            mediaUrl = oldSection ? oldSection.content : "";
          }

          if (oldSection) {
            await db.query(
              "UPDATE showcase_sections SET type = ?, content = ?, list_items = NULL, sequence = ? WHERE id = ?",
              [type, mediaUrl, index, oldSection.id]
            );
          } else {
            await db.query(
              "INSERT INTO showcase_sections (showcase_id, type, content, sequence) VALUES (?, ?, ?, ?)",
              [showcaseId, type, mediaUrl, index]
            );
          }
        } else if (type === "video") {
          const newFile = videoFiles.shift();

          if (newFile) {
            // Delete old video file if exists
            if (oldSection && oldSection.content) {
              const oldFilePath = path.join(
                __dirname,
                "..",
                "public",
                oldSection.content
              );
              if (fs.existsSync(oldFilePath)) {
                fs.unlinkSync(oldFilePath);
              }
            }
            mediaUrl = `/asset/image/showcaseUpload/${newFile.filename}`;
          } else {
            mediaUrl = oldSection ? oldSection.content : "";
          }

          if (oldSection) {
            await db.query(
              "UPDATE showcase_sections SET type = ?, content = ?, list_items = NULL, sequence = ? WHERE id = ?",
              [type, mediaUrl, index, oldSection.id]
            );
          } else {
            await db.query(
              "INSERT INTO showcase_sections (showcase_id, type, content, sequence) VALUES (?, ?, ?, ?)",
              [showcaseId, type, mediaUrl, index]
            );
          }
        } else if (type === "list") {
          if (oldSection) {
            await db.query(
              "UPDATE showcase_sections SET type = ?, list_items = ?, content = NULL, sequence = ? WHERE id = ?",
              [type, JSON.stringify(content), index, oldSection.id]
            );
          } else {
            await db.query(
              "INSERT INTO showcase_sections (showcase_id, type, list_items, sequence) VALUES (?, ?, ?, ?)",
              [showcaseId, type, JSON.stringify(content), index]
            );
          }
        } else {
          // Text or other content
          if (oldSection) {
            await db.query(
              "UPDATE showcase_sections SET type = ?, content = ?, list_items = NULL, sequence = ? WHERE id = ?",
              [type, content, index, oldSection.id]
            );
          } else {
            await db.query(
              "INSERT INTO showcase_sections (showcase_id, type, content, sequence) VALUES (?, ?, ?, ?)",
              [showcaseId, type, content, index]
            );
          }
        }
      }

      // Delete leftover old sections if any
      if (oldSections.length > sections.length) {
        const idsToDelete = oldSections
          .slice(sections.length)
          .map((section) => section.id);

        if (idsToDelete.length > 0) {
          // Delete old media files of leftover sections
          for (const sectionId of idsToDelete) {
            const section = oldSections.find((s) => s.id === sectionId);
            if (
              (section.type === "image" || section.type === "video") &&
              section.content
            ) {
              const oldFilePath = path.join(
                __dirname,
                "..",
                "public",
                section.content
              );
              if (fs.existsSync(oldFilePath)) {
                fs.unlinkSync(oldFilePath);
              }
            }
          }

          // Delete leftover sections from DB
          await db.query("DELETE FROM showcase_sections WHERE id IN (?)", [idsToDelete]);
        }
      }

      res.status(200).json({ message: "Showcase updated successfully" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to update showcase" });
    }
  }
);

// DELETE: Delete showcase and its sections
router.delete("/showcases/:id", async (req, res) => {
  try {
    const showcaseId = req.params.id;

    // Delete showcase sections first (FK constraint)
    await db.query("DELETE FROM showcase_sections WHERE showcase_id = ?", [showcaseId]);

    // Delete the showcase
    await db.query("DELETE FROM showcase WHERE id = ?", [showcaseId]);

    res.status(200).json({ message: "Showcase deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete showcase" });
  }
});

// PATCH: Increment showcase view count
router.patch("/showcase/:id/views", async (req, res) => {
  const showcaseId = req.params.id;

  try {
    await db.query("UPDATE showcase SET views = views + 1 WHERE id = ?", [showcaseId]);
    res.status(200).json({ message: "View count incremented successfully" });
  } catch (err) {
    console.error("Failed to increment showcase views:", err);
    res.status(500).json({ error: "Failed to increment view count" });
  }
});


module.exports = router;
