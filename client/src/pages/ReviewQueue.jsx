import { useState } from 'react';
import StatusBadge from '../components/StatusBadge';
import { reviewQueue as initialQueue } from '../data/mockData';
import './ReviewQueue.css';

function ReviewQueue() {
  const [queue, setQueue] = useState(initialQueue);
  const [expandedId, setExpandedId] = useState(initialQueue[0]?.id ?? null);
  const [notes, setNotes] = useState({});

  const toggleExpand = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const decide = (id, status) => {
    setQueue((prev) => prev.map((item) => (item.id === id ? { ...item, status } : item)));
    setExpandedId(null);
  };

  const pendingCount = queue.filter((q) => q.status === 'Pending Review').length;

  return (
    <div className="review-queue">
      <div className="review-queue-header">
        <div>
          <h1>Review Queue</h1>
          <p className="review-queue-subtitle">Manage and verify pending student achievements.</p>
        </div>
        <button className="btn-secondary">⬇ Export CSV</button>
      </div>

      <div className="review-queue-filters">
        <div className="filter-group">
          <label>Status</label>
          <select defaultValue="all">
            <option value="all">All Pending</option>
            <option value="revision">Needs Revision</option>
          </select>
        </div>
        <div className="filter-group">
          <label>Skill</label>
          <select defaultValue="all">
            <option value="all">All Skills</option>
          </select>
        </div>
        <div className="filter-group">
          <label>Date Range</label>
          <select defaultValue="30">
            <option value="30">Last 30 Days</option>
          </select>
        </div>
        <span className="review-queue-count">Showing {queue.length} of {queue.length} · {pendingCount} pending</span>
      </div>

      <div className="review-table">
        <div className="review-table-head">
          <span>Student Name</span>
          <span>Organization</span>
          <span>Role</span>
          <span>Date Submitted</span>
          <span>Status</span>
        </div>

        {queue.map((item) => (
          <div key={item.id} className="review-row-wrapper">
            <button className="review-row" onClick={() => toggleExpand(item.id)}>
              <span className="review-student">
                <span className="review-avatar">{item.initials}</span>
                {item.studentName}
              </span>
              <span>{item.org}</span>
              <span>{item.role}</span>
              <span>{item.dateSubmitted}</span>
              <span className="review-status-cell">
                <StatusBadge status={item.status} />
                <span className={'review-caret' + (expandedId === item.id ? ' review-caret-open' : '')}>⌄</span>
              </span>
            </button>

            {expandedId === item.id && (
              <div className="review-detail">
                {item.summary && (
                  <>
                    <label className="form-label">Achievement Summary</label>
                    <p className="review-summary">{item.summary}</p>
                  </>
                )}

                <div className="review-detail-row">
                  {item.skills.length > 0 && (
                    <div>
                      <label className="form-label">Skills Demonstrated</label>
                      <div className="skill-cloud">
                        {item.skills.map((skill) => <span key={skill} className="skill-chip">{skill}</span>)}
                      </div>
                    </div>
                  )}
                  {item.document && (
                    <div>
                      <label className="form-label">Supporting Documents</label>
                      <a href="#" onClick={(e) => e.preventDefault()} className="review-doc-link">📎 {item.document}</a>
                    </div>
                  )}
                </div>

                <label className="form-label">Mentor Feedback</label>
                <textarea
                  placeholder="Add private notes or public feedback..."
                  rows={2}
                  value={notes[item.id] || ''}
                  onChange={(e) => setNotes((prev) => ({ ...prev, [item.id]: e.target.value }))}
                />

                <div className="review-actions">
                  <button className="btn-primary" onClick={() => decide(item.id, 'Approved')}>✓ Approve Submission</button>
                  <button className="btn-secondary" onClick={() => decide(item.id, 'Needs Revision')}>✎ Request Changes</button>
                  <button className="btn-danger" onClick={() => decide(item.id, 'Rejected')}>✕ Reject</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default ReviewQueue;
