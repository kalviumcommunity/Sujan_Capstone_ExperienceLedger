import './StatCard.css';

function StatCard({ label, value, unit, trend, icon }) {
  return (
    <div className="stat-card">
      <div className="stat-card-top">
        <span className="stat-card-label">{label}</span>
        {icon && <span className="stat-card-icon" aria-hidden="true">{icon}</span>}
        {trend && <span className="stat-card-trend">{trend}</span>}
      </div>
      <div className="stat-card-value">
        {value}
        {unit && <span className="stat-card-unit">{unit}</span>}
      </div>
    </div>
  );
}

export default StatCard;
