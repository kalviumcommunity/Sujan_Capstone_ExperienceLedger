const fs = require("fs");
const path = require("path");
const { pool, withTransaction } = require("../config/db");
const { isReviewer } = require("../middleware/auth");
const { parseId, clean } = require("../utils/validation");
const { UPLOAD_DIR } = require("../middleware/upload");

const EXPERIENCE_TYPES = ["internship", "project"];
const STATUSES = ["Pending Verification", "Approved", "Rejected", "Changes Requested"];
// A reviewer must explain a negative decision - otherwise the student has no idea what to fix.
const STATUSES_REQUIRING_COMMENT = ["Rejected", "Changes Requested"];
const MAX_SKILLS = 20;
const LIMITS = { organization: 255, role: 255, duration: 255, description: 5000, outcome: 5000, comment: 2000, skill: 50 };

// Shared SELECT so every read returns the same shape, including the skills array.
const EXPERIENCE_SELECT = `
  SELECT e.*, u.name AS student_name, u.email AS student_email,
         COALESCE(
           (SELECT array_agg(s.name ORDER BY s.name)
              FROM experience_skills es JOIN skills s ON s.id = es.skill_id
             WHERE es.experience_id = e.id),
           '{}'
         ) AS skills
    FROM experiences e
    JOIN users u ON u.id = e.student_id`;

// Evidence is rendered as <a href> for mentors. Only allow our own upload paths or
// http(s) URLs - a "javascript:..." link would otherwise run in the reviewer's browser.
const normalizeEvidenceLink = (value) => {
  const link = clean(value);
  if (!link) return { ok: true, value: null };
  if (/^\/uploads\/[\w-]+\.(pdf|jpe?g|png)$/.test(link)) return { ok: true, value: link };
  if (link.startsWith("/")) return { ok: false }; // any other local path is not evidence
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(link) ? link : `https://${link}`;
  try {
    const url = new URL(candidate);
    if (url.protocol === "http:" || url.protocol === "https:") return { ok: true, value: url.toString() };
  } catch {
    // fall through
  }
  return { ok: false };
};

// Validates and normalises the student-editable fields. Returns { errors, data }.
const validateExperienceInput = (body) => {
  const data = {
    type: clean(body.type) || "internship",
    organization: clean(body.organization),
    role: clean(body.role),
    duration: clean(body.duration) || null,
    description: clean(body.description),
    outcome: clean(body.outcome) || null,
  };
  const errors = [];

  if (!EXPERIENCE_TYPES.includes(data.type)) errors.push(`type must be one of: ${EXPERIENCE_TYPES.join(", ")}`);
  if (!data.organization) errors.push("organization is required");
  if (!data.role) errors.push("role is required");
  if (!data.description) errors.push("description is required");
  for (const field of ["organization", "role", "duration", "description", "outcome"]) {
    if (data[field] && data[field].length > LIMITS[field]) errors.push(`${field} must be at most ${LIMITS[field]} characters`);
  }

  const evidence = normalizeEvidenceLink(body.evidenceLink);
  if (!evidence.ok) errors.push("evidenceLink must be an http(s) URL or an uploaded file");
  data.evidenceLink = evidence.value;

  // Skills: de-duplicated case-insensitively, trimmed, capped.
  const rawSkills = Array.isArray(body.skills) ? body.skills : [];
  const seen = new Set();
  data.skills = [];
  for (const raw of rawSkills) {
    const skill = clean(raw);
    if (!skill || seen.has(skill.toLowerCase())) continue;
    if (skill.length > LIMITS.skill) {
      errors.push(`each skill must be at most ${LIMITS.skill} characters`);
      break;
    }
    seen.add(skill.toLowerCase());
    data.skills.push(skill);
  }
  if (data.skills.length > MAX_SKILLS) errors.push(`at most ${MAX_SKILLS} skills are allowed`);

  return { errors, data };
};

// Replaces an experience's skill links inside an open transaction.
const saveSkills = async (client, experienceId, skills) => {
  await client.query("DELETE FROM experience_skills WHERE experience_id = $1", [experienceId]);
  if (!skills.length) return;
  const { rows } = await client.query(
    `INSERT INTO skills (name) SELECT unnest($1::text[])
     ON CONFLICT (name) DO UPDATE SET updated_at = now()
     RETURNING id`,
    [skills]
  );
  await client.query(
    `INSERT INTO experience_skills (experience_id, skill_id)
     SELECT $1, unnest($2::int[]) ON CONFLICT DO NOTHING`,
    [experienceId, rows.map((r) => r.id)]
  );
};

const fetchExperience = async (db, id) => {
  const { rows } = await db.query(`${EXPERIENCE_SELECT} WHERE e.id = $1`, [id]);
  return rows[0] || null;
};

// Best-effort cleanup of an uploaded evidence file that is no longer referenced.
const removeUploadedFile = (link) => {
  if (typeof link !== "string" || !link.startsWith("/uploads/")) return;
  const filePath = path.join(UPLOAD_DIR, path.basename(link));
  fs.unlink(filePath, () => {}); // ignore "already gone"
};

// @desc   Create a new experience entry owned by the logged-in user
// @route  POST /api/experiences
const createExperience = async (req, res) => {
  try {
    const { errors, data } = validateExperienceInput(req.body);
    if (errors.length) {
      return res.status(400).json({ success: false, message: errors.join("; ") });
    }

    // The owner is always the authenticated user from the JWT, never a client-supplied
    // id - otherwise any logged-in user could submit an experience under someone else's account.
    const studentId = req.user.id;

    const experience = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO experiences
          (student_id, type, organization, role, duration, description, outcome, evidence_link, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Pending Verification')
         RETURNING id`,
        [studentId, data.type, data.organization, data.role, data.duration, data.description, data.outcome, data.evidenceLink]
      );
      await saveSkills(client, rows[0].id, data.skills);
      return fetchExperience(client, rows[0].id);
    });

    return res.status(201).json({ success: true, data: experience });
  } catch (error) {
    console.error("Error creating experience:", error.message);
    return res.status(500).json({ success: false, message: "Server error while creating experience" });
  }
};

// @desc   List experiences. Students only ever see their own; reviewers see all,
//         optionally filtered by ?student=&status=
// @route  GET /api/experiences
const getExperiences = async (req, res) => {
  try {
    const { student, status } = req.query;
    const conditions = [];
    const values = [];

    if (!isReviewer(req.user)) {
      // Ignore any ?student= a student sends - they can only read their own records.
      values.push(req.user.id);
      conditions.push(`e.student_id = $${values.length}`);
    } else if (student !== undefined) {
      const studentId = parseId(student);
      if (!studentId) return res.status(400).json({ success: false, message: "student must be a positive integer" });
      values.push(studentId);
      conditions.push(`e.student_id = $${values.length}`);
    }

    if (status !== undefined) {
      if (!STATUSES.includes(status)) {
        return res.status(400).json({ success: false, message: `status must be one of: ${STATUSES.join(", ")}` });
      }
      values.push(status);
      conditions.push(`e.status = $${values.length}`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const { rows } = await pool.query(`${EXPERIENCE_SELECT} ${whereClause} ORDER BY e.created_at DESC`, values);

    return res.status(200).json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    console.error("Error fetching experiences:", error.message);
    return res.status(500).json({ success: false, message: "Server error while fetching experiences" });
  }
};

// @desc   Get a single experience (owner or reviewer only)
// @route  GET /api/experiences/:id
const getExperienceById = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: "Invalid experience id" });

    const experience = await fetchExperience(pool, id);
    // 404 (not 403) for someone else's record, so ids can't be probed for existence.
    if (!experience || (!isReviewer(req.user) && experience.student_id !== req.user.id)) {
      return res.status(404).json({ success: false, message: "Experience not found" });
    }

    return res.status(200).json({ success: true, data: experience });
  } catch (error) {
    console.error("Error fetching experience:", error.message);
    return res.status(500).json({ success: false, message: "Server error while fetching experience" });
  }
};

// @desc   Student edits their own experience and resubmits it for review.
//         Approved records are locked - editing them would silently invalidate the verification.
// @route  PUT /api/experiences/:id
const updateExperience = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: "Invalid experience id" });

    const { rows: existing } = await pool.query("SELECT student_id, status, evidence_link FROM experiences WHERE id = $1", [id]);
    if (!existing[0] || existing[0].student_id !== req.user.id) {
      return res.status(404).json({ success: false, message: "Experience not found" });
    }
    if (existing[0].status === "Approved") {
      return res.status(409).json({ success: false, message: "Approved experiences are locked and cannot be edited" });
    }

    const { errors, data } = validateExperienceInput(req.body);
    if (errors.length) {
      return res.status(400).json({ success: false, message: errors.join("; ") });
    }

    const experience = await withTransaction(async (client) => {
      await client.query(
        `UPDATE experiences
            SET type = $1, organization = $2, role = $3, duration = $4, description = $5,
                outcome = $6, evidence_link = $7,
                status = 'Pending Verification', reviewed_by = NULL, reviewed_at = NULL, verified_at = NULL,
                updated_at = now()
          WHERE id = $8`,
        [data.type, data.organization, data.role, data.duration, data.description, data.outcome, data.evidenceLink, id]
      );
      await saveSkills(client, id, data.skills);
      return fetchExperience(client, id);
    });

    if (existing[0].evidence_link !== data.evidenceLink) removeUploadedFile(existing[0].evidence_link);

    return res.status(200).json({ success: true, data: experience });
  } catch (error) {
    console.error("Error updating experience:", error.message);
    return res.status(500).json({ success: false, message: "Server error while updating experience" });
  }
};

// @desc   Reviewer decision: approve / reject / request changes, with a comment
// @route  PUT /api/experiences/:id/status
const updateExperienceStatus = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: "Invalid experience id" });

    const { status } = req.body;
    const mentorComment = clean(req.body.mentorComment) || null;

    if (!STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: `status must be one of: ${STATUSES.join(", ")}` });
    }
    if (STATUSES_REQUIRING_COMMENT.includes(status) && !mentorComment) {
      return res.status(400).json({ success: false, message: `A comment is required when marking an entry as ${status}` });
    }
    if (mentorComment && mentorComment.length > LIMITS.comment) {
      return res.status(400).json({ success: false, message: `comment must be at most ${LIMITS.comment} characters` });
    }

    const { rows: existing } = await pool.query("SELECT student_id FROM experiences WHERE id = $1", [id]);
    if (!existing[0]) {
      return res.status(404).json({ success: false, message: "Experience not found" });
    }
    // Separation of duties: nobody verifies their own claim.
    if (existing[0].student_id === req.user.id) {
      return res.status(403).json({ success: false, message: "You cannot review your own experience" });
    }

    const isPending = status === "Pending Verification";
    await pool.query(
      `UPDATE experiences
          SET status = $1, mentor_comment = $2,
              reviewed_by = $3, reviewed_at = $4,
              verified_at = CASE WHEN $6::boolean THEN now() ELSE NULL END,
              updated_at = now()
        WHERE id = $5`,
      [status, mentorComment, isPending ? null : req.user.id, isPending ? null : new Date(), id, status === "Approved"]
    );

    return res.status(200).json({ success: true, data: await fetchExperience(pool, id) });
  } catch (error) {
    console.error("Error updating experience status:", error.message);
    return res.status(500).json({ success: false, message: "Server error while updating experience" });
  }
};

// @desc   Delete an experience entry - reviewers can delete any entry,
//         a student can only delete their own
// @route  DELETE /api/experiences/:id
const deleteExperience = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: "Invalid experience id" });

    const { rows: existing } = await pool.query("SELECT student_id, evidence_link FROM experiences WHERE id = $1", [id]);

    if (!existing[0]) {
      return res.status(404).json({ success: false, message: "Experience not found" });
    }

    const isOwner = existing[0].student_id === req.user.id;
    if (!isReviewer(req.user) && !isOwner) {
      return res.status(403).json({ success: false, message: "You can only delete your own experiences" });
    }

    const { rows } = await pool.query("DELETE FROM experiences WHERE id = $1 RETURNING id", [id]);
    if (!rows[0]) {
      return res.status(404).json({ success: false, message: "Experience not found" });
    }

    removeUploadedFile(existing[0].evidence_link);
    return res.status(200).json({ success: true, message: "Experience deleted successfully" });
  } catch (error) {
    console.error("Error deleting experience:", error.message);
    return res.status(500).json({ success: false, message: "Server error while deleting experience" });
  }
};

module.exports = {
  createExperience,
  getExperiences,
  getExperienceById,
  updateExperience,
  updateExperienceStatus,
  deleteExperience,
  normalizeEvidenceLink,
  validateExperienceInput,
};
