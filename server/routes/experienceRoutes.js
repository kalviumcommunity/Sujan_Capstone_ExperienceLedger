const express = require("express");
const router = express.Router();
const {
  createExperience,
  getExperiences,
  getExperienceById,
  updateExperienceStatus,
  deleteExperience,
} = require("../controllers/experienceController");

// POST /api/experiences        -> create new experience (DB write)
// GET  /api/experiences        -> list experiences, optional ?student=&status= (DB read)
router.route("/").post(createExperience).get(getExperiences);

// GET /api/experiences/:id     -> single experience (DB read)
// DELETE /api/experiences/:id  -> remove experience (DB write)
router.route("/:id").get(getExperienceById).delete(deleteExperience);

// PUT /api/experiences/:id/status -> mentor approve/reject/comment (DB write)
router.put("/:id/status", updateExperienceStatus);

module.exports = router;
