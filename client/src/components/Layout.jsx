import Sidebar from './Sidebar';
import Header from './Header';
import './Layout.css';

function Layout({ role, user, children }) {
  return (
    <div className="app-layout">
      <Sidebar role={role} />
      <div className="app-layout-main">
        <Header user={user} />
        <main className="app-layout-content">{children}</main>
      </div>
    </div>
  );
}

export default Layout;
