import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import GoogleSignInButton from '../components/GoogleSignInButton';
import { homeFor } from '../roles';
import './Auth.css';

function Login() {
  const { login, isAuthenticated, user } = useAuth();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const updateField = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(form.email, form.password); // the redirect below fires once auth state updates
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Logged in (just now, or already): go back to the page that bounced the user here,
  // else to their role's home. RequireRole re-checks access on arrival.
  if (isAuthenticated) return <Navigate to={location.state?.from ?? homeFor(user.role)} replace />;

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-brand">Experience Ledger</div>
        <h1>Welcome back</h1>
        <p className="auth-subtitle">Log in to view and manage your verified achievements.</p>

        {error && <div className="auth-error">⚠ {error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="auth-field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" required value={form.email} onChange={updateField('email')} autoComplete="username" />
          </div>
          <div className="auth-field">
            <label htmlFor="password">Password</label>
            <input id="password" type="password" required value={form.password} onChange={updateField('password')} autoComplete="current-password" />
          </div>
          <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={submitting}>
            {submitting ? 'Logging in…' : 'Log In'}
          </button>
        </form>

        <div className="auth-divider"><span>or</span></div>

        <GoogleSignInButton
          onError={setError}
        />

        <p className="auth-footer">
          Don't have an account? <Link to="/register">Create one</Link>
        </p>

        <div className="auth-demo-hint">
          Demo accounts (after <code>npm run db:seed</code>): <br />
          Student alex.rivera@example.com · Mentor sarah.jenkins@example.com · Placement placement@example.com ·
          Admin admin@example.com — password: <code>password123</code>
        </div>
      </div>
    </div>
  );
}

export default Login;
