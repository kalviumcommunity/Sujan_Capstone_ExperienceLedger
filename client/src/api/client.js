// Single fetch wrapper for every backend call: base URL, auth header, JSON parsing,
// error messages, and session-expiry handling all live here instead of being
// copy-pasted into each api/*.js module.

export const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
export const TOKEN_KEY = 'el_token';
export const UNAUTHORIZED_EVENT = 'el:unauthorized';

function authHeaders() {
  const token = localStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function request(path, { method = 'GET', body, formData } = {}) {
  const headers = { ...authHeaders() };
  let payload;
  if (formData) {
    payload = formData; // no Content-Type - the browser sets the multipart boundary itself
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, { method, headers, body: payload });
  } catch {
    throw new Error('Cannot reach the server. Check your connection and try again.');
  }

  const data = await res.json().catch(() => null);

  // An expired/invalid token on an authenticated call means the session is over:
  // tell AuthProvider to log out, instead of leaving the user on a page where
  // every request silently fails.
  if (res.status === 401 && headers.Authorization) {
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  }

  if (!res.ok) {
    throw new Error(data?.message || `Request failed with status ${res.status}`);
  }
  return data;
}

export function resolveFileUrl(path) {
  if (!path) return path;
  return path.startsWith('http') ? path : `${BASE_URL}${path}`;
}
