// End-to-end API checks against a running server + real, freshly seeded PostgreSQL.
// Usage: npm run db:init && npm run db:seed && npm start, then in another terminal: npm run test:e2e
// WARNING: creates users/experiences and uploads a test file - run it against a throwaway database only.
const B = process.env.E2E_BASE_URL || 'http://localhost:5000';
let pass = 0, fail = 0;
const check = (name, cond, extra = '') => {
  if (cond) { pass++; console.log('  ok  ', name); }
  else { fail++; console.log('  FAIL', name, extra); }
};
async function call(method, path, { token, body, raw } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(B + path, { method, headers, body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined) });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}
const login = async (email) => (await call('POST', '/api/auth/login', { body: { email, password: 'password123' } })).json.token;

for (let i = 0; i < 30; i++) { try { await fetch(B); break; } catch { await new Promise(r => setTimeout(r, 300)); } }

const student = await login('alex.rivera@example.com');
const mentor = await login('sarah.jenkins@example.com');
const admin = await login('admin@example.com');
check('logins work for seeded users', student && mentor && admin);

let r = await call('POST', '/api/auth/login', { body: { email: '  ALEX.RIVERA@example.com ', password: 'password123' } });
check('login is case-insensitive on email', r.status === 200);

r = await call('GET', '/api/experiences');
check('unauthenticated list is 401 (was public)', r.status === 401, r.status);

r = await call('POST', '/api/auth/register', { body: { name: 'Eve', email: 'eve@x.com', password: 'secret1', role: 'mentor' } });
check('self-registering as mentor is 403', r.status === 403, r.status);
r = await call('POST', '/api/auth/register', { body: { name: 'Bob Student', email: 'Bob@X.com', password: 'secret1' } });
check('register student 201', r.status === 201, JSON.stringify(r.json));
const bob = r.json.token;
check('email stored lower-case', r.json.user.email === 'bob@x.com');
r = await call('POST', '/api/auth/register', { body: { name: 'Bob2', email: 'bob@x.com', password: 'secret1' } });
check('duplicate email (different case) 409', r.status === 409);

r = await call('POST', '/api/experiences', { token: student, body: { type: 'internship', organization: 'Acme', role: 'Intern', description: 'x', evidenceLink: 'javascript:alert(1)' } });
check('javascript: evidence link rejected', r.status === 400);
r = await call('POST', '/api/experiences', { token: student, body: { type: 'hackathon', organization: 'Acme', role: 'Intern', description: 'x' } });
check('bad type -> 400 not 500', r.status === 400);
r = await call('POST', '/api/experiences', { token: student, body: { organization: 'Acme', role: 'Intern' } });
check('missing description -> 400 not 500', r.status === 400);

r = await call('POST', '/api/experiences', { token: student, body: {
  type: 'project', organization: 'Kalvium', role: 'Full-stack Dev', duration: '2026-10-21 - 2026-11-20',
  description: 'Built Experience Ledger', evidenceLink: 'github.com/me/el', skills: ['React', 'react', 'PostgreSQL', 'Node.js'] } });
check('create with skills 201', r.status === 201, JSON.stringify(r.json));
const expId = r.json.data.id;
check('skills de-duplicated + returned', JSON.stringify(r.json.data.skills) === JSON.stringify(['Node.js', 'PostgreSQL', 'React']), JSON.stringify(r.json.data.skills));
check('evidence link normalised to https', r.json.data.evidence_link === 'https://github.com/me/el');

r = await call('GET', '/api/experiences?student=999', { token: bob });
check('student cannot read others via ?student=', r.status === 200 && r.json.data.every(e => e.student_id !== 1), JSON.stringify(r.json));
r = await call('GET', `/api/experiences/${expId}`, { token: bob });
check("other student's record by id -> 404", r.status === 404);
r = await call('GET', '/api/experiences/abc', { token: student });
check('non-numeric id -> 400 not 500', r.status === 400);
r = await call('GET', '/api/experiences', { token: mentor });
check('mentor sees all', r.status === 200 && r.json.count >= 3);

r = await call('PUT', `/api/experiences/${expId}/status`, { token: student, body: { status: 'Approved' } });
check('student cannot approve', r.status === 403);
r = await call('PUT', `/api/experiences/${expId}/status`, { token: mentor, body: { status: 'Changes Requested' } });
check('changes requested without comment -> 400', r.status === 400);
r = await call('PUT', `/api/experiences/${expId}/status`, { token: mentor, body: { status: 'Changes Requested', mentorComment: 'Add the GitHub repo link' } });
check('changes requested with comment 200', r.status === 200 && r.json.data.reviewed_by === 2 && r.json.data.reviewed_at, JSON.stringify(r.json));
check('verified_at stays null when not approved', r.json.data.verified_at === null);

r = await call('PUT', `/api/experiences/${expId}`, { token: student, body: {
  type: 'project', organization: 'Kalvium', role: 'Full-stack Dev', description: 'Built Experience Ledger v2',
  evidenceLink: 'https://github.com/me/el', skills: ['React', 'Express'] } });
check('student resubmits -> back to Pending', r.status === 200 && r.json.data.status === 'Pending Verification' && r.json.data.reviewed_by === null, JSON.stringify(r.json));
check('skills replaced on edit', JSON.stringify(r.json.data.skills) === JSON.stringify(['Express', 'React']));

r = await call('PUT', `/api/experiences/${expId}/status`, { token: mentor, body: { status: 'Approved', mentorComment: 'Verified' } });
check('approve sets verified_at', r.status === 200 && r.json.data.verified_at);
r = await call('PUT', `/api/experiences/${expId}`, { token: student, body: { type: 'project', organization: 'X', role: 'Y', description: 'Z' } });
check('approved record locked (409)', r.status === 409);

// role revocation: promote bob to mentor, then demote; old token must lose rights immediately
const users = (await call('GET', '/api/users', { token: admin })).json.data;
const bobId = users.find(u => u.email === 'bob@x.com').id;
r = await call('PATCH', `/api/users/${bobId}/role`, { token: admin, body: { role: 'mentor' } });
check('admin promotes bob', r.status === 200);
r = await call('GET', '/api/experiences', { token: bob });
check('promoted bob (same old token) now sees all', r.json.count >= 3);
await call('PATCH', `/api/users/${bobId}/role`, { token: admin, body: { role: 'student' } });
r = await call('PUT', `/api/experiences/${expId}/status`, { token: bob, body: { status: 'Rejected', mentorComment: 'x' } });
check('demoted bob loses reviewer rights immediately', r.status === 403, r.status);
r = await call('PATCH', '/api/users/4/role', { token: admin, body: { role: 'student' } });
check('admin cannot change own role', r.status === 400);
r = await call('GET', '/api/users', { token: mentor });
check('non-admin cannot list users', r.status === 403);

// self-review: make admin submit an experience then try approving it
r = await call('POST', '/api/experiences', { token: admin, body: { type: 'project', organization: 'A', role: 'B', description: 'C' } });
r = await call('PUT', `/api/experiences/${r.json.data.id}/status`, { token: admin, body: { status: 'Approved' } });
check('reviewer cannot approve own entry', r.status === 403);

// google-only account login
r = await call('POST', '/api/auth/login', { body: { email: 'nobody@nowhere.com', password: 'x' } });
check('unknown login 401', r.status === 401);

// uploads: html disguised as pdf is stored as .pdf
const fd = new FormData();
fd.append('file', new Blob(['<script>alert(1)</script>'], { type: 'application/pdf' }), 'evil.html');
let up = await fetch(B + '/api/uploads', { method: 'POST', headers: { Authorization: `Bearer ${student}` }, body: fd });
let upj = await up.json();
check('upload extension comes from mimetype, not filename', up.status === 201 && upj.data.url.endsWith('.pdf'), JSON.stringify(upj));
const served = await fetch(B + upj.data.url);
check('uploads served with nosniff', served.headers.get('x-content-type-options') === 'nosniff');

r = await call('POST', '/api/experiences', { token: student, raw: '{bad json', body: undefined });
const bad = await fetch(B + '/api/experiences', { method: 'POST', headers: { Authorization: `Bearer ${student}`, 'Content-Type': 'application/json' }, body: '{bad' });
check('malformed JSON -> 400', bad.status === 400);
r = await call('GET', '/api/nope', { token: student });
check('unknown API route -> JSON 404', r.status === 404 && r.json?.success === false);

r = await call('DELETE', `/api/experiences/${expId}`, { token: bob });
check("student can't delete others' entry", r.status === 403);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
