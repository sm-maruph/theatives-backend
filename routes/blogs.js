const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { blogsUpload } = require("../config/uploads");
const path = require("path");

// Log middleware
router.use((req, res, next) => {
  console.log(`Incoming request: ${req.method} ${req.path}`);
  next();
});

// POST: Create a new blog
router.post(
  "/blogs",
  blogsUpload.fields([
    { name: "images", maxCount: 10 },
    { name: "videos", maxCount: 5 },
  ]),
  async (req, res) => {
    try {
      const { title, category, sections } = JSON.parse(req.body.data);
      const imageFiles = req.files["images"] || [];
      const videoFiles = req.files["videos"] || [];

      const [result] = await db.query(
        "INSERT INTO blogs (title, category) VALUES (?, ?)",
        [title, category]
      );
      const blogId = result.insertId;

      const sectionPromises = sections.map((section, index) => {
        const { type, content } = section;
        let mediaUrl = null;

        if (type === "image") {
          const file = imageFiles.shift();
          mediaUrl = file ? `/asset/image/blogsUpload/${file.filename}` : "";
        } else if (type === "video") {
          const file = videoFiles.shift();
          mediaUrl = file ? `/asset/image/blogsUpload/${file.filename}` : "";
        }

        if (type === "list") {
          return db.query(
            "INSERT INTO blog_sections (blog_id, type, list_items, sequence) VALUES (?, ?, ?, ?)",
            [blogId, type, JSON.stringify(content), index]
          );
        }

        return db.query(
          "INSERT INTO blog_sections (blog_id, type, content, sequence) VALUES (?, ?, ?, ?)",
          [
            blogId,
            type,
            type === "image" || type === "video" ? mediaUrl : content,
            index,
          ]
        );
      });

      await Promise.all(sectionPromises);

      res.status(201).json({ message: "Blog created successfully" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Something went wrong" });
    }
  }
);

// GET: Fetch all blogs with sections in correct order
router.get("/blogs", async (req, res) => {
  try {
    const [blogs] = await db.query(
      "SELECT * FROM blogs ORDER BY created_at DESC"
    );

    const blogWithSections = await Promise.all(
      blogs.map(async (blog) => {
        const [sections] = await db.query(
          "SELECT * FROM blog_sections WHERE blog_id = ? ORDER BY sequence ASC",
          [blog.id]
        );
        return {
          ...blog,
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

    res.json(blogWithSections);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch blogs" });
  }
});

const fs = require("fs");

router.put(
  "/blogs/:id",
  blogsUpload.fields([
    { name: "images", maxCount: 10 },
    { name: "videos", maxCount: 5 },
  ]),
  async (req, res) => {
    try {
      const blogId = req.params.id;
      const { title, category, sections } = JSON.parse(req.body.data);
      const imageFiles = req.files["images"] || [];
      const videoFiles = req.files["videos"] || [];

      // Update blog metadata
      await db.query("UPDATE blogs SET title = ?, category = ? WHERE id = ?", [
        title,
        category,
        blogId,
      ]);

      // Get old sections before editing
      const [oldSections] = await db.query(
        "SELECT * FROM blog_sections WHERE blog_id = ? ORDER BY sequence ASC",
        [blogId]
      );

      // We'll track which old sections to delete after processing
      const sectionsToDelete = [];

      // Process each section
      for (let index = 0; index < sections.length; index++) {
        const section = sections[index];
        const { type, content } = section;

        let mediaUrl = null;
        let oldSection = oldSections[index];

        if (type === "image") {
          const newFile = imageFiles.shift();

          if (newFile) {
            // New image uploaded → delete old image file if exists
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
            mediaUrl = `/asset/image/blogsUpload/${newFile.filename}`;
          } else {
            // No new image → keep old
            mediaUrl = oldSection ? oldSection.content : "";
          }

          // Upsert section: if old exists, update; else insert
          if (oldSection) {
            await db.query(
              "UPDATE blog_sections SET type = ?, content = ?, list_items = NULL, sequence = ? WHERE id = ?",
              [type, mediaUrl, index, oldSection.id]
            );
          } else {
            await db.query(
              "INSERT INTO blog_sections (blog_id, type, content, sequence) VALUES (?, ?, ?, ?)",
              [blogId, type, mediaUrl, index]
            );
          }
        } else if (type === "video") {
          const newFile = videoFiles.shift();

          if (newFile) {
            // New video uploaded → delete old video file if exists
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
            mediaUrl = `/asset/image/blogsUpload/${newFile.filename}`;
          } else {
            // No new video → keep old
            mediaUrl = oldSection ? oldSection.content : "";
          }

          if (oldSection) {
            await db.query(
              "UPDATE blog_sections SET type = ?, content = ?, list_items = NULL, sequence = ? WHERE id = ?",
              [type, mediaUrl, index, oldSection.id]
            );
          } else {
            await db.query(
              "INSERT INTO blog_sections (blog_id, type, content, sequence) VALUES (?, ?, ?, ?)",
              [blogId, type, mediaUrl, index]
            );
          }
        } else if (type === "list") {
          // For list type, no media file handling

          if (oldSection) {
            await db.query(
              "UPDATE blog_sections SET type = ?, list_items = ?, content = NULL, sequence = ? WHERE id = ?",
              [type, JSON.stringify(content), index, oldSection.id]
            );
          } else {
            await db.query(
              "INSERT INTO blog_sections (blog_id, type, list_items, sequence) VALUES (?, ?, ?, ?)",
              [blogId, type, JSON.stringify(content), index]
            );
          }
        } else {
          // Other text sections
          if (oldSection) {
            await db.query(
              "UPDATE blog_sections SET type = ?, content = ?, list_items = NULL, sequence = ? WHERE id = ?",
              [type, content, index, oldSection.id]
            );
          } else {
            await db.query(
              "INSERT INTO blog_sections (blog_id, type, content, sequence) VALUES (?, ?, ?, ?)",
              [blogId, type, content, index]
            );
          }
        }
      }

      // Delete any leftover old sections that are not in the new sections array
      if (oldSections.length > sections.length) {
        const idsToDelete = oldSections
          .slice(sections.length)
          .map((section) => section.id);

        if (idsToDelete.length > 0) {
          // Delete old media files for these sections
          for (const sectionId of idsToDelete) {
            const section = oldSections.find((s) => s.id === sectionId);
            if (
              section.type === "image" ||
              section.type === "video" &&
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

          // Delete leftover sections
          await db.query(
            "DELETE FROM blog_sections WHERE id IN (?)",
            [idsToDelete]
          );
        }
      }

      res.json({ success: true, message: "Blog updated successfully" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);



     

// DELETE: Delete blog and its sections
router.delete("/blogs/:id", async (req, res) => {
  try {
    const blogId = req.params.id;

    // Delete blog sections first (FK constraint)
    await db.query("DELETE FROM blog_sections WHERE blog_id = ?", [blogId]);

    // Delete the blog
    await db.query("DELETE FROM blogs WHERE id = ?", [blogId]);

    res.status(200).json({ message: "Blog deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete blog" });
  }
});

// PATCH: Increment blog view count
router.patch("/blogs/:id/views", async (req, res) => {
  const blogId = req.params.id;

  try {
    await db.query("UPDATE blogs SET views = views + 1 WHERE id = ?", [blogId]);
    res.status(200).json({ message: "View count incremented successfully" });
  } catch (err) {
    console.error("Failed to increment blog views:", err);
    res.status(500).json({ error: "Failed to increment view count" });
  }
});


module.exports = router;
