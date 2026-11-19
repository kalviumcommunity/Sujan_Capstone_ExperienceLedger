const express = require("express");
const router = express.Router();
const { protect, authorize, REVIEWER_ROLES } = require("../middleware/auth");
const {
  createExperience,
  getExperiences,
  getExperienceById,
  updateExperience,
  updateExperienceStatus,
  deleteExperience,
} = require("../controllers/experienceController");

// Every experience route requires login - these records hold student personal data.
router.use(protect);

// POST /api/experiences        -> create new experience under the logged-in user
// GET  /api/experiences        -> students: own entries; reviewers: all, optional ?student=&status=
router.route("/").post(createExperience).get(getExperiences);

// GET    /api/experiences/:id  -> single experience (owner or reviewer)
// PUT    /api/experiences/:id  -> owner edits + resubmits (not allowed once Approved)
// DELETE /api/experiences/:id  -> owner or reviewer
router.route("/:id").get(getExperienceById).put(updateExperience).delete(deleteExperience);

// PUT /api/experiences/:id/status -> mentor/placement officer/admin approve/reject/request changes
router.put("/:id/status", authorize(...REVIEWER_ROLES), updateExperienceStatus);

module.exports = router;
