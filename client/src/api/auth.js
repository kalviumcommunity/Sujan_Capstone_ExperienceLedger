import { request } from './client';

export function registerUser({ name, email, password }) {
  return request('/api/auth/register', { method: 'POST', body: { name, email, password } });
}

export function loginUser({ email, password }) {
  return request('/api/auth/login', { method: 'POST', body: { email, password } });
}

export function googleLogin({ credential }) {
  return request('/api/auth/google', { method: 'POST', body: { credential } });
}

export async function fetchMe() {
  const body = await request('/api/auth/me');
  return body.user;
}
