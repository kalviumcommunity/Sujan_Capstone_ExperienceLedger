import { NavLink } from 'react-router-dom';
import { navItemsFor, ROLE_LABEL } from '../roles';
import './Sidebar.css';

function Sidebar({ user, open = false, onClose }) {
  const items = navItemsFor(user.role);

  return (
    <aside className={'sidebar' + (open ? ' sidebar-open' : '')}>
      <div className="sidebar-brand">
        <span className="sidebar-brand-name">Experience Ledger</span>
        <span className="sidebar-brand-tag">Verified Achievement</span>
      </div>

      <nav className="sidebar-nav">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            onClick={onClose}
            className={({ isActive }) => 'sidebar-link' + (isActive ? ' sidebar-link-active' : '')}
          >
            <span className="sidebar-icon" aria-hidden="true">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-footer-badge" aria-hidden="true">✓</div>
        <div>
          <div className="sidebar-footer-title">{user.name}</div>
          <div className="sidebar-footer-subtitle">{ROLE_LABEL[user.role] || user.role}</div>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
