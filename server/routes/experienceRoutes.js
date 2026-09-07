const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const {
  createExperience,
  getExperiences,
  getExperienceById,
  updateExperienceStatus,
  deleteExperience,
} = require("../controllers/experienceController");

// POST /api/experiences        -> create new experience (DB write, requires login)
// GET  /api/experiences        -> list experiences, optional ?student=&status= (DB read)
router.route("/").post(protect, createExperience).get(getExperiences);

// GET /api/experiences/:id     -> single experience (DB read)
// DELETE /api/experiences/:id  -> remove experience (DB write, requires login)
router.route("/:id").get(getExperienceById).delete(protect, deleteExperience);

// PUT /api/experiences/:id/status -> mentor approve/reject/comment (DB write, requires login)
router.put("/:id/status", protect, updateExperienceStatus);

module.exports = router;
