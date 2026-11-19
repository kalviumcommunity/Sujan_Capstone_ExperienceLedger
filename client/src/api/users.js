// Thin wrapper around the /api/users backend (see server/routes/userRoutes.js). Admin-only.
import { request } from './client';

export async function fetchUsers() {
  const body = await request('/api/users');
  return body.data;
}

export async function updateUserRole(id, role) {
  const body = await request(`/api/users/${id}/role`, { method: 'PATCH', body: { role } });
  return body.data;
}
