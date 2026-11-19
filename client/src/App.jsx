import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import AddExperience from './pages/AddExperience';
import ReviewQueue from './pages/ReviewQueue';
import Analytics from './pages/Analytics';
import Login from './pages/Login';
import Register from './pages/Register';
import MyExperiences from './pages/MyExperiences';
import ExportProfile from './pages/ExportProfile';
import StudentRecords from './pages/StudentRecords';
import UserManagement from './pages/UserManagement';
import NotFound from './pages/NotFound';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/useAuth';
import { STUDENT, REVIEWERS, PLACEMENT, ADMIN, homeFor } from './roles';
import './App.css';

// Every page is gated by the logged-in account's REAL role. (This replaces the old
// "Preview as" switcher, which let any student open the mentor/admin screens with
// hard-coded demo identities.) The server enforces the same rules on every API call.
const ROUTE_CONFIG = [
  { path: '/', roles: STUDENT, element: <Dashboard /> },
  { path: '/add-experience', roles: STUDENT, element: <AddExperience /> },
  { path: '/edit-experience/:id', roles: STUDENT, element: <AddExperience /> },
  { path: '/my-experiences', roles: STUDENT, element: <MyExperiences /> },
  { path: '/export-profile', roles: STUDENT, element: <ExportProfile /> },
  { path: '/review-queue', roles: REVIEWERS, element: <ReviewQueue /> },
  { path: '/analytics', roles: PLACEMENT, element: <Analytics /> },
  { path: '/student-records', roles: PLACEMENT, element: <StudentRecords /> },
  { path: '/user-management', roles: ADMIN, element: <UserManagement /> },
];

function RequireRole({ roles, children }) {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  // Logged in but not allowed here (e.g. a mentor opening "/") - send them to
  // their own landing page rather than showing a page whose API calls would 403.
  if (!roles.includes(user.role)) {
    return <Navigate to={homeFor(user.role)} replace />;
  }
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      {ROUTE_CONFIG.map(({ path, roles, element }) => (
        <Route
          key={path}
          path={path}
          element={
            <RequireRole roles={roles}>
              <Layout>{element}</Layout>
            </RequireRole>
          }
        />
      ))}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
