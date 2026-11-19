// Thin wrapper around the /api/experiences backend (see server/routes/experienceRoutes.js).
import { request } from './client';

export async function fetchExperiences(params = {}) {
  const query = new URLSearchParams(params).toString();
  const body = await request(`/api/experiences${query ? `?${query}` : ''}`);
  return body.data;
}

export async function fetchExperience(id) {
  const body = await request(`/api/experiences/${id}`);
  return body.data;
}

export async function createExperience(payload) {
  const body = await request('/api/experiences', { method: 'POST', body: payload });
  return body.data;
}

export async function updateExperience(id, payload) {
  const body = await request(`/api/experiences/${id}`, { method: 'PUT', body: payload });
  return body.data;
}

export async function updateExperienceStatus(id, status, mentorComment) {
  const body = await request(`/api/experiences/${id}/status`, { method: 'PUT', body: { status, mentorComment } });
  return body.data;
}

export function deleteExperience(id) {
  return request(`/api/experiences/${id}`, { method: 'DELETE' });
}
