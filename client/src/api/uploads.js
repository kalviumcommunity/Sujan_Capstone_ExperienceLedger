// Thin wrapper around the /api/uploads backend (see server/routes/uploadRoutes.js).
import { request } from './client';

export { resolveFileUrl } from './client';

export async function uploadEvidenceFile(file) {
  const formData = new FormData();
  formData.append('file', file);
  const body = await request('/api/uploads', { method: 'POST', formData });
  return body.data;
}
