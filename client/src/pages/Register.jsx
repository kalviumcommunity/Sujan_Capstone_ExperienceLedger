import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import GoogleSignInButton from '../components/GoogleSignInButton';
import { homeFor } from '../roles';
import './Auth.css';

function Register() {
  const { register, isAuthenticated, user } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const updateField = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await register(form.name, form.email, form.password); // redirect below fires on auth change
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (isAuthenticated) return <Navigate to={homeFor(user.role)} replace />;

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-brand">Experience Ledger</div>
        <h1>Create your account</h1>
        <p className="auth-subtitle">Start building your verified achievement ledger.</p>

        {error && <div className="auth-error">⚠ {error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="auth-field">
            <label htmlFor="name">Full Name</label>
            <input id="name" type="text" required value={form.name} onChange={updateField('name')} autoComplete="name" />
          </div>
          <div className="auth-field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" required value={form.email} onChange={updateField('email')} autoComplete="username" />
          </div>
          <div className="auth-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              placeholder="At least 6 characters"
              value={form.password}
              onChange={updateField('password')}
              autoComplete="new-password"
            />
          </div>
          <p className="form-hint" style={{ marginBottom: 12 }}>
            New accounts are student accounts. Mentors and placement officers are given access by an admin.
          </p>
          <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={submitting}>
            {submitting ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        <div className="auth-divider"><span>or</span></div>

        <GoogleSignInButton
          onError={setError}
        />

        <p className="auth-footer">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}

export default Register;
