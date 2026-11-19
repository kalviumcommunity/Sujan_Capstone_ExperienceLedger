import { useCallback, useEffect, useMemo, useState } from 'react';
import { loginUser, registerUser, googleLogin, fetchMe } from '../api/auth';
import { TOKEN_KEY, UNAUTHORIZED_EVENT } from '../api/client';
import { AuthContext } from './auth-context';

const USER_KEY = 'el_user';

function readStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(readStoredUser);

  const persist = (nextToken, nextUser) => {
    localStorage.setItem(TOKEN_KEY, nextToken);
    localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    setToken(nextToken);
    setUser(nextUser);
  };

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  }, []);

  // Any API call that comes back 401 (expired / revoked token) ends the session.
  useEffect(() => {
    window.addEventListener(UNAUTHORIZED_EVENT, logout);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, logout);
  }, [logout]);

  // The user object in localStorage is only a cache. Refresh it from the server on
  // load so a role an admin changed (e.g. student -> mentor) shows up immediately.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetchMe()
      .then((fresh) => {
        if (cancelled) return;
        localStorage.setItem(USER_KEY, JSON.stringify(fresh));
        setUser(fresh);
      })
      .catch(() => {
        // 401 is handled by the UNAUTHORIZED_EVENT listener; a network blip keeps the cached user.
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const login = useCallback(async (email, password) => {
    const { token: newToken, user: newUser } = await loginUser({ email, password });
    persist(newToken, newUser);
    return newUser;
  }, []);

  const register = useCallback(async (name, email, password) => {
    const { token: newToken, user: newUser } = await registerUser({ name, email, password });
    persist(newToken, newUser);
    return newUser;
  }, []);

  const loginWithGoogle = useCallback(async (credential) => {
    const { token: newToken, user: newUser } = await googleLogin({ credential });
    persist(newToken, newUser);
    return newUser;
  }, []);

  const value = useMemo(
    () => ({ token, user, isAuthenticated: Boolean(token && user), login, register, loginWithGoogle, logout }),
    [token, user, login, register, loginWithGoogle, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
