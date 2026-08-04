import { Link } from 'react-router-dom';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import {
  dashboardStats,
  recentActivity,
  ledgerCompletion,
  skillCloud,
  verificationLog,
  currentStudent,
} from '../data/mockData';
import './Dashboard.css';

const STAT_ICONS = { sparkle: '✦', clock: '◔', bolt: '⚡', hash: '#' };

function Dashboard() {
  const hasActivity = recentActivity.length > 0;

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <h1>Welcome back, {currentStudent.name.split(' ')[0]}!</h1>
          <p className="dashboard-subtitle">
            You have 2 pending verifications and a 12% increase in logged hours this month.
          </p>
        </div>
        <Link to="/add-experience" className="btn-primary">+ Add New Experience</Link>
      </div>

      <div className="dashboard-stats">
        {dashboardStats.map((stat) => (
          <StatCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            unit={stat.unit}
            icon={STAT_ICONS[stat.icon]}
          />
        ))}
      </div>

      <div className="dashboard-grid">
        <section className="dashboard-activity">
          <div className="dashboard-activity-heading">
            <h2>Recent Activity</h2>
            <span className="dashboard-live-pill">Live</span>
          </div>

          {!hasActivity && (
            <div className="dashboard-empty">
              <p className="dashboard-empty-title">No experiences logged yet</p>
              <p className="dashboard-empty-subtitle">
                Start building your verified ledger by adding your first internship or project
              </p>
              <Link to="/add-experience" className="btn-primary">+ Add New Experience</Link>
            </div>
          )}

          {hasActivity && (
            <ul className="dashboard-timeline">
              {recentActivity.map((item) => (
                <li key={item.id} className="dashboard-timeline-item">
                  <div className="dashboard-timeline-dot" />
                  <div className="dashboard-timeline-card">
                    <div className="dashboard-timeline-top">
                      <h3>{item.title}</h3>
                      <StatusBadge status={item.status} />
                    </div>
                    <p className="dashboard-timeline-meta">{item.org} • {item.duration}</p>
                    {item.description && <p className="dashboard-timeline-desc">{item.description}</p>}
                    {item.reviewerNote && (
                      <p className="dashboard-timeline-note">"{item.reviewerNote}"</p>
                    )}
                    {item.skills.length > 0 && (
                      <div className="dashboard-timeline-skills">
                        {item.skills.map((skill) => (
                          <span key={skill} className="skill-chip">{skill}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="dashboard-side">
          <div className="ledger-completion">
            <div className="ledger-completion-top">
              <h3>Ledger Completion</h3>
              <span className="ledger-completion-percent">{ledgerCompletion.percent}%</span>
            </div>
            <div className="ledger-completion-bar">
              <div className="ledger-completion-fill" style={{ width: `${ledgerCompletion.percent}%` }} />
            </div>
            <p>{ledgerCompletion.note}</p>
          </div>

          <div className="side-card">
            <h3>Skill Cloud</h3>
            <div className="skill-cloud">
              {skillCloud.map((skill) => (
                <span key={skill.name} className={'skill-chip' + (skill.highlighted ? ' skill-chip-active' : '')}>
                  {skill.name}
                </span>
              ))}
            </div>
            <Link to="/export-profile" className="side-card-link">View full breakdown</Link>
          </div>

          <div className="side-card">
            <h3>Verification Log</h3>
            {verificationLog.length === 0 ? (
              <p className="dashboard-empty-subtitle">No activity yet</p>
            ) : (
              <ul className="verification-log">
                {verificationLog.map((log) => (
                  <li key={log.id}>
                    <div>
                      <div className="verification-log-org">{log.org}</div>
                      <div className="verification-log-meta">{log.meta}</div>
                    </div>
                    <span className={`verification-dot verification-dot-${log.state}`} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

export default Dashboard;
