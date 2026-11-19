import { useEffect, useMemo, useState } from 'react';
import StatusBadge from '../components/StatusBadge';
import { useAuth } from '../context/useAuth';
import { fetchExperiences, updateExperienceStatus, deleteExperience } from '../api/experiences';
import { resolveFileUrl } from '../api/uploads';
import { initialsOf } from '../roles';
import './ReviewQueue.css';

const DAY_MS = 24 * 60 * 60 * 1000;
const STATUS_FILTERS = [
  { value: 'Pending Verification', label: 'Pending' },
  { value: 'Changes Requested', label: 'Changes Requested' },
  { value: 'Approved', label: 'Approved' },
  { value: 'Rejected', label: 'Rejected' },
  { value: 'all', label: 'All Statuses' },
];
const DATE_FILTERS = [
  { value: '7', label: 'Last 7 Days' },
  { value: '30', label: 'Last 30 Days' },
  { value: '90', label: 'Last 90 Days' },
  { value: 'all', label: 'All Time' },
];
const NEEDS_COMMENT = ['Changes Requested', 'Rejected'];

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isUploadedFile(link) {
  return typeof link === 'string' && link.startsWith('/uploads/');
}

// RFC 4180 quoting, plus a leading apostrophe on values that start with = + - @ so a
// spreadsheet never executes a student-typed value as a formula (CSV injection).
function csvCell(value) {
  let text = value == null ? '' : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv(rows) {
  const header = ['Student', 'Email', 'Type', 'Organization', 'Role', 'Duration', 'Skills', 'Status', 'Submitted', 'Mentor Comment'];
  const lines = rows.map((e) =>
    [e.student_name, e.student_email, e.type, e.organization, e.role, e.duration, (e.skills || []).join('; '), e.status, formatDate(e.created_at), e.mentor_comment]
      .map(csvCell)
      .join(',')
  );
  const blob = new Blob([[header.map(csvCell).join(','), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `experience-ledger-review-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function ReviewQueue() {
  const { user } = useAuth();
  const [experiences, setExperiences] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [notes, setNotes] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actioningId, setActioningId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('Pending Verification');
  const [skillFilter, setSkillFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loadedAt] = useState(() => Date.now()); // fixed reference time for the date filter

  useEffect(() => {
    let cancelled = false;

    fetchExperiences()
      .then((data) => {
        if (cancelled) return;
        setExperiences(data);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const allSkills = useMemo(
    () => [...new Set(experiences.flatMap((e) => e.skills || []))].sort((a, b) => a.localeCompare(b)),
    [experiences]
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const cutoff = dateFilter === 'all' ? null : loadedAt - Number(dateFilter) * DAY_MS;
    return experiences.filter((e) => {
      if (statusFilter !== 'all' && e.status !== statusFilter) return false;
      if (skillFilter !== 'all' && !(e.skills || []).includes(skillFilter)) return false;
      if (cutoff && new Date(e.created_at).getTime() < cutoff) return false;
      if (term && ![e.student_name, e.organization, e.role].some((v) => v?.toLowerCase().includes(term))) return false;
      return true;
    });
  }, [experiences, statusFilter, skillFilter, dateFilter, search, loadedAt]);

  const toggleExpand = (item) => {
    setExpandedId((prev) => (prev === item.id ? null : item.id));
    // Start from the existing feedback so a reviewer can refine it, not retype it.
    setNotes((prev) => (item.id in prev ? prev : { ...prev, [item.id]: item.mentor_comment || '' }));
  };

  const decide = async (id, status) => {
    const comment = (notes[id] || '').trim();
    if (NEEDS_COMMENT.includes(status) && !comment) {
      setError(`Please add feedback for the student before marking this as "${status}".`);
      return;
    }
    setActioningId(id);
    setError(null);
    try {
      const updated = await updateExperienceStatus(id, status, comment);
      setExperiences((prev) => prev.map((item) => (item.id === id ? updated : item)));
      setExpandedId(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setActioningId(null);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this experience entry? This cannot be undone.')) return;
    setActioningId(id);
    try {
      await deleteExperience(id);
      setExperiences((prev) => prev.filter((item) => item.id !== id));
      setExpandedId((prev) => (prev === id ? null : prev));
    } catch (err) {
      setError(err.message);
    } finally {
      setActioningId(null);
    }
  };

  const pendingCount = experiences.filter((q) => q.status === 'Pending Verification').length;

  return (
    <div className="review-queue">
      <div className="review-queue-header">
        <div>
          <h1>Review Queue</h1>
          <p className="review-queue-subtitle">Verify student submissions. {pendingCount} awaiting review.</p>
        </div>
        <button className="btn-secondary" onClick={() => downloadCsv(filtered)} disabled={filtered.length === 0}>
          ⬇ Export CSV
        </button>
      </div>

      {error && <p className="dashboard-timeline-note" role="alert">⚠ {error}</p>}
      {loading && <p className="review-queue-subtitle">Loading experiences…</p>}

      {!loading && (
        <>
          <div className="review-queue-filters">
            <div className="filter-group">
              <label htmlFor="rq-search">Search</label>
              <input
                id="rq-search"
                type="search"
                placeholder="Student, organization, role"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="filter-group">
              <label htmlFor="rq-status">Status</label>
              <select id="rq-status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                {STATUS_FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
            <div className="filter-group">
              <label htmlFor="rq-skill">Skill</label>
              <select id="rq-skill" value={skillFilter} onChange={(e) => setSkillFilter(e.target.value)}>
                <option value="all">All Skills</option>
                {allSkills.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="filter-group">
              <label htmlFor="rq-date">Submitted</label>
              <select id="rq-date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}>
                {DATE_FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
            <span className="review-queue-count">Showing {filtered.length} of {experiences.length}</span>
          </div>

          <div className="review-table">
            <div className="review-table-scroll">
              <div className="review-table-head">
                <span>Student Name</span>
                <span>Organization</span>
                <span>Role</span>
                <span>Date Submitted</span>
                <span>Status</span>
              </div>

              {filtered.length === 0 && (
                <p className="review-queue-subtitle" style={{ padding: 16 }}>
                  {experiences.length === 0 ? 'No experiences have been submitted yet.' : 'No entries match these filters.'}
                </p>
              )}

              {filtered.map((item) => {
                const isOwn = item.student_id === user.id;
                const busy = actioningId === item.id;
                return (
                  <div key={item.id} className="review-row-wrapper">
                    <button className="review-row" onClick={() => toggleExpand(item)} aria-expanded={expandedId === item.id}>
                      <span className="review-student">
                        <span className="review-avatar">{initialsOf(item.student_name)}</span>
                        {item.student_name}
                      </span>
                      <span>{item.organization}</span>
                      <span>{item.role}</span>
                      <span>{formatDate(item.created_at)}</span>
                      <span className="review-status-cell">
                        <StatusBadge status={item.status} />
                        <span className={'review-caret' + (expandedId === item.id ? ' review-caret-open' : '')}>⌄</span>
                      </span>
                    </button>

                    {expandedId === item.id && (
                      <div className="review-detail">
                        <label className="form-label">{item.type === 'project' ? 'Project' : 'Internship'} · {item.duration || 'No dates given'}</label>
                        {item.skills?.length > 0 && (
                          <div className="skill-tags">
                            {item.skills.map((skill) => <span key={skill} className="skill-tag">{skill}</span>)}
                          </div>
                        )}
                        {item.description && (
                          <>
                            <label className="form-label">Achievement Summary</label>
                            <p className="review-summary">{item.description}</p>
                          </>
                        )}
                        {item.outcome && (
                          <>
                            <label className="form-label">Outcome</label>
                            <p className="review-summary">{item.outcome}</p>
                          </>
                        )}
                        {item.evidence_link && (
                          <>
                            <label className="form-label">Supporting Evidence</label>
                            <p className="review-summary">
                              <a href={resolveFileUrl(item.evidence_link)} target="_blank" rel="noopener noreferrer" className="review-doc-link">
                                {isUploadedFile(item.evidence_link) ? '📎 View uploaded file' : '🔗 View link'}
                              </a>
                            </p>
                          </>
                        )}

                        {isOwn ? (
                          <p className="form-hint">This is your own submission - another reviewer must verify it.</p>
                        ) : (
                          <>
                            <label className="form-label" htmlFor={`note-${item.id}`}>Feedback to student</label>
                            <textarea
                              id={`note-${item.id}`}
                              placeholder="Required when requesting changes or rejecting"
                              rows={2}
                              maxLength={2000}
                              value={notes[item.id] || ''}
                              onChange={(e) => setNotes((prev) => ({ ...prev, [item.id]: e.target.value }))}
                            />
                          </>
                        )}

                        <div className="review-actions">
                          {!isOwn && (
                            <>
                              <button className="btn-primary" disabled={busy} onClick={() => decide(item.id, 'Approved')}>
                                ✓ Approve
                              </button>
                              <button className="btn-secondary" disabled={busy} onClick={() => decide(item.id, 'Changes Requested')}>
                                ✎ Request Changes
                              </button>
                              <button className="btn-danger" disabled={busy} onClick={() => decide(item.id, 'Rejected')}>
                                ✕ Reject
                              </button>
                            </>
                          )}
                          <button className="btn-danger" disabled={busy} onClick={() => remove(item.id)}>
                            🗑 Delete Entry
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default ReviewQueue;
