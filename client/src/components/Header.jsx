import { ROLE_LABEL, initialsOf } from '../roles';
import './Header.css';

// Shows the real logged-in account. (The old search box, bell and help buttons were
// placeholders with no behaviour behind them, so they've been removed.)
function Header({ user, onLogout, onMenuClick }) {
  return (
    <header className="app-header">
      {onMenuClick && (
        <button className="app-header-menu-btn" aria-label="Open menu" onClick={onMenuClick}>
          ☰
        </button>
      )}
      <div className="app-header-spacer" />

      <div className="app-header-actions">
        <div className="app-header-user">
          <div className="app-header-user-text">
            <div className="app-header-user-name">{user.name}</div>
            <div className="app-header-user-meta">{ROLE_LABEL[user.role] || user.role}</div>
          </div>
          <div className="app-header-avatar" aria-hidden="true">{initialsOf(user.name)}</div>
        </div>
        {onLogout && (
          <button className="app-header-logout-btn" onClick={onLogout}>
            Log out
          </button>
        )}
      </div>
    </header>
  );
}

export default Header;
