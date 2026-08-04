import './StatusBadge.css';

const STATUS_CLASS = {
  Approved: 'badge-approved',
  'Pending Review': 'badge-pending',
  Pending: 'badge-pending',
  'Needs Revision': 'badge-revision',
  Rejected: 'badge-rejected',
};

function StatusBadge({ status }) {
  const className = STATUS_CLASS[status] || 'badge-default';
  return <span className={`status-badge ${className}`}>{status.toUpperCase()}</span>;
}

export default StatusBadge;
