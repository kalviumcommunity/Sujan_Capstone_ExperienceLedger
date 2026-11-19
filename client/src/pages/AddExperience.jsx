import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { createExperience, fetchExperience, updateExperience } from '../api/experiences';
import { uploadEvidenceFile } from '../api/uploads';
import './AddExperience.css';

const ALLOWED_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_SKILLS = 20;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const initialForm = {
  type: 'internship',
  organization: '',
  role: '',
  startDate: '',
  endDate: '',
  currentlyWorking: false,
  description: '',
  outcomes: '',
  projectLink: '',
};

// duration is stored as "YYYY-MM-DD - YYYY-MM-DD" or "YYYY-MM-DD - Present".
function parseDuration(duration = '') {
  const [start = '', end = ''] = (duration || '').split(' - ');
  return {
    startDate: DATE_PATTERN.test(start) ? start : '',
    endDate: DATE_PATTERN.test(end) ? end : '',
    currentlyWorking: end === 'Present',
  };
}

function AddExperience() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [form, setForm] = useState(initialForm);
  const [skills, setSkills] = useState([]);
  const [skillInput, setSkillInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [loadingExisting, setLoadingExisting] = useState(isEdit);
  const [existing, setExisting] = useState(null);

  // Edit mode: pre-fill the form from the saved record.
  useEffect(() => {
    if (!isEdit) return undefined;
    let cancelled = false;
    fetchExperience(id)
      .then((exp) => {
        if (cancelled) return;
        setExisting(exp);
        const isUpload = exp.evidence_link?.startsWith('/uploads/');
        setForm({
          type: exp.type,
          organization: exp.organization,
          role: exp.role,
          ...parseDuration(exp.duration),
          description: exp.description || '',
          outcomes: exp.outcome || '',
          projectLink: isUpload ? '' : exp.evidence_link || '',
        });
        setSkills(exp.skills || []);
        if (isUpload) setUploadedFile({ url: exp.evidence_link, originalName: 'Previously uploaded file' });
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoadingExisting(false));
    return () => {
      cancelled = true;
    };
  }, [id, isEdit]);

  const updateField = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;

    setUploadError(null);

    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      setUploadError('Only PDF, JPG, or PNG files are allowed');
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setUploadError('File must be 10MB or smaller');
      return;
    }

    setUploading(true);
    try {
      const data = await uploadEvidenceFile(file);
      setUploadedFile(data);
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const addSkill = (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const skill = skillInput.trim();
    if (!skill) return;
    // Case-insensitive de-dupe: "React" and "react" are the same skill (and the same React key).
    if (skills.some((s) => s.toLowerCase() === skill.toLowerCase())) {
      setSkillInput('');
      return;
    }
    if (skills.length >= MAX_SKILLS) return;
    setSkills((prev) => [...prev, skill]);
    setSkillInput('');
  };

  const removeSkill = (skill) => setSkills((prev) => prev.filter((s) => s !== skill));

  const validate = () => {
    if (!form.startDate) return 'Please choose a start date';
    if (!form.currentlyWorking && !form.endDate) return 'Please choose an end date, or tick "I currently work here"';
    if (!form.currentlyWorking && form.endDate < form.startDate) return 'End date cannot be before the start date';
    if (form.startDate > new Date().toISOString().slice(0, 10)) return 'Start date cannot be in the future';
    if (!form.description.trim()) return 'Please describe what you did';
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        type: form.type,
        organization: form.organization,
        role: form.role,
        duration: `${form.startDate} - ${form.currentlyWorking ? 'Present' : form.endDate}`,
        description: form.description,
        outcome: form.outcomes,
        evidenceLink: uploadedFile?.url || form.projectLink,
        skills,
      };
      if (isEdit) {
        await updateExperience(id, payload);
        navigate('/my-experiences');
      } else {
        await createExperience(payload);
        navigate('/');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingExisting) {
    return <p className="add-experience-subtitle">Loading experience…</p>;
  }

  if (isEdit && existing?.status === 'Approved') {
    return (
      <div className="add-experience">
        <h1>This experience is verified</h1>
        <p className="add-experience-subtitle">
          Approved entries are locked so the verification stays trustworthy. <Link to="/my-experiences">Back to My Experiences</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="add-experience">
      <div className="add-experience-breadcrumb">
        DASHBOARD / MY EXPERIENCES / <strong>{isEdit ? 'EDIT' : 'ADD NEW'}</strong>
      </div>
      <h1>{isEdit ? 'Edit & Resubmit Experience' : 'Add New Experience'}</h1>
      <p className="add-experience-subtitle">
        {isEdit
          ? 'Saving your changes sends this entry back to your mentor for review.'
          : 'Capture your professional milestones with verifiable proof. All submitted experiences are reviewed by a mentor before they count as verified.'}
      </p>

      {isEdit && existing?.mentor_comment && (
        <p className="dashboard-timeline-note">Mentor feedback: "{existing.mentor_comment}"</p>
      )}

      <form className="add-experience-grid" onSubmit={handleSubmit}>
        <div className="add-experience-main">
          <fieldset className="form-section">
            <legend>🏢 Organization Details</legend>
            <label className="form-label" htmlFor="type">Experience Type</label>
            <select id="type" className="form-select" value={form.type} onChange={updateField('type')}>
              <option value="internship">Internship</option>
              <option value="project">Academic / Personal Project</option>
            </select>
            <label className="form-label" htmlFor="organization">Organization Name</label>
            <input
              id="organization"
              type="text"
              placeholder="e.g. Acme Corporation or Stanford University"
              value={form.organization}
              onChange={updateField('organization')}
              maxLength={255}
              required
            />
          </fieldset>

          <fieldset className="form-section">
            <legend>💼 Role &amp; Duration</legend>
            <label className="form-label" htmlFor="role">Role / Title</label>
            <input
              id="role"
              type="text"
              placeholder="e.g. Software Engineering Intern"
              value={form.role}
              onChange={updateField('role')}
              maxLength={255}
              required
            />
            <div className="form-row">
              <div>
                <label className="form-label" htmlFor="startDate">Start Date</label>
                <input id="startDate" type="date" value={form.startDate} onChange={updateField('startDate')} required />
              </div>
              <div>
                <label className="form-label" htmlFor="endDate">End Date</label>
                <input
                  id="endDate"
                  type="date"
                  value={form.endDate}
                  min={form.startDate || undefined}
                  onChange={updateField('endDate')}
                  disabled={form.currentlyWorking}
                />
              </div>
            </div>
            <label className="form-checkbox">
              <input type="checkbox" checked={form.currentlyWorking} onChange={updateField('currentlyWorking')} />
              I currently work here
            </label>
          </fieldset>

          <fieldset className="form-section">
            <legend>📄 Experience Details</legend>
            <label className="form-label" htmlFor="description">Description</label>
            <textarea
              id="description"
              placeholder="What were your primary responsibilities?"
              value={form.description}
              onChange={updateField('description')}
              maxLength={5000}
              rows={3}
              required
            />
            <label className="form-label" htmlFor="outcomes">Key Outcomes</label>
            <textarea
              id="outcomes"
              placeholder="Quantifiable achievements (e.g. Improved performance by 20%)"
              value={form.outcomes}
              onChange={updateField('outcomes')}
              maxLength={5000}
              rows={3}
            />
          </fieldset>

          <fieldset className="form-section">
            <legend>🛡 Verification</legend>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />

            {!uploadedFile && (
              <div className="upload-dropzone">
                <div className="upload-icon" aria-hidden="true">⬆</div>
                <p className="upload-title">Upload Certificate or Proof of Work</p>
                <p className="upload-subtitle">PDF, JPG, or PNG (Max 10MB)</p>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? 'Uploading…' : 'Browse Files'}
                </button>
              </div>
            )}

            {uploadedFile && (
              <div className="upload-file-chip">
                <span className="upload-file-icon" aria-hidden="true">📎</span>
                <span className="upload-file-name">{uploadedFile.originalName}</span>
                <button
                  type="button"
                  className="skill-chip-remove"
                  onClick={() => setUploadedFile(null)}
                  aria-label="Remove uploaded file"
                >
                  ×
                </button>
              </div>
            )}

            {uploadError && <p className="form-error">⚠ {uploadError}</p>}

            <label className="form-label" htmlFor="projectLink">Project Link (optional)</label>
            <input
              id="projectLink"
              type="text"
              inputMode="url"
              placeholder="github.com/username/project"
              value={form.projectLink}
              onChange={updateField('projectLink')}
              disabled={Boolean(uploadedFile)}
            />
          </fieldset>
        </div>

        <aside className="add-experience-side">
          <div className="side-card">
            <h3>🎓 Skills &amp; Expertise</h3>
            <input
              type="text"
              placeholder="Type a skill and press Enter"
              value={skillInput}
              maxLength={50}
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyDown={addSkill}
              aria-label="Add a skill"
            />
            <p className="form-hint">{skills.length}/{MAX_SKILLS} skills · used for cohort skill analytics</p>
            <div className="skill-cloud" style={{ marginTop: 12 }}>
              {skills.map((skill) => (
                <span key={skill} className="skill-chip skill-chip-active">
                  {skill}
                  <button type="button" className="skill-chip-remove" onClick={() => removeSkill(skill)} aria-label={`Remove ${skill}`}>×</button>
                </span>
              ))}
            </div>
            {error && <p className="form-error" role="alert">⚠ {error}</p>}
            <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: 16 }} disabled={submitting || uploading}>
              {submitting ? 'Submitting…' : isEdit ? 'Save & Resubmit' : 'Submit for Review'}
            </button>
            <p className="secure-note">🔒 Only you and your reviewers can see this entry</p>
          </div>

          <div className="pro-tip">
            <strong>💡 Tip</strong>
            <p>
              Attaching a certificate or a live project link gives your mentor concrete proof to check, which makes
              approval faster and the verified record more credible.
            </p>
          </div>
        </aside>
      </form>
    </div>
  );
}

export default AddExperience;
