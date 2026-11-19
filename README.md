# Experience Ledger

**A verified record of student internships and projects.** Students log their experience with evidence, faculty mentors verify it, and placement cells get skill and readiness analytics built only on verified records.

| | Link |
|---|---|
| 🌐 **Live app** | **https://experience-ledger.netlify.app** |
| ⚙️ Live API | https://sujan-capstone-experienceledger.onrender.com (shows `Experience Ledger API is running`) |
| 📄 Product & design docs | [PRD](PRD.md) · [HLD](HLD.md) · [LLD](LLD.md) |
| 🎨 Mock UX | [docs/mock-ux](docs/mock-ux) |
| 🧪 API collection | [bruno/](bruno) (open in [Bruno](https://www.usebruno.com/)) |

---

## About

A student's real experience usually lives in resumes, spreadsheets and chat groups. Nobody has verified it, and a placement cell can't see skill trends across a cohort. Experience Ledger replaces that with one structured, verified ledger:

1. **Student** logs an internship or project, with dates, outcomes, skills and evidence (a certificate upload or a project link).
2. **Mentor** reviews it, then **approves**, **rejects**, or **requests changes** with written feedback.
3. **Student** edits and resubmits if changes were requested. Approved entries are locked so the verification stays trustworthy.
4. **Placement officer / admin** see analytics computed only from that data: approval rate, review time, submission trend, top *verified* skills, and per-student readiness.

## See it live in your browser

1. Open **https://experience-ledger.netlify.app**.
2. Click **Create one** on the login page and register. New accounts are **student** accounts.
3. Add an experience from the dashboard (**+ Add New Experience**) and watch it appear as *Pending Verification*.
4. To try the mentor or placement views, an **admin** must give your account that role under *User Management*. Public sign-up deliberately can't create staff accounts.

> **First load can take ~30–60 seconds.** The API runs on Render's free tier and sleeps when idle. If login seems slow, open the [API link](https://sujan-capstone-experienceledger.onrender.com) once to wake it, then retry.

Every pull request also gets its own Netlify **deploy preview**. Its link is posted as a comment on the PR.

## Features by role

| Role | What they can do | Lands on |
|---|---|---|
| **Student** | Add, edit/resubmit (until approved) and delete own experiences; upload evidence (PDF/JPG/PNG ≤ 10 MB); tag skills; print a verified profile to PDF | Dashboard |
| **Mentor** | Review queue with status / skill / date filters, search and CSV export; approve, reject or request changes with feedback | Review Queue |
| **Placement Officer** | Everything a mentor can, plus Analytics and Student Records | Analytics |
| **Admin** | Everything above, plus User Management (assign roles) | Analytics |

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, React Router 7, Vite, plain CSS (deployed on **Netlify**) |
| Backend | Node.js 20, Express 4 (deployed on **Render**) |
| Database | PostgreSQL 16 (`pg`), on Render |
| Auth | JWT (7-day) + bcrypt, Google Sign-In (`google-auth-library`) |
| Uploads | Multer (MIME allow-list, size limit, server-chosen file names) |
| Testing | Jest unit tests + end-to-end script against real PostgreSQL, Bruno API collection |
| DevOps | Docker, Docker Compose, nginx for the client container |

```
Browser (React SPA, Netlify) ──HTTPS + Bearer JWT──▶ Express API (Render) ──SQL──▶ PostgreSQL (Render)
                                                     └─▶ /uploads (evidence files)
```

## Security highlights

- Every experience route requires login. Students can only ever read or change **their own** records.
- The user's **current role is loaded from the database on every request**, so a demoted or deleted account loses access immediately instead of when its token expires.
- Public sign-up only creates students. Staff roles are granted by an admin. Nobody can approve their own entry, and an admin can't change their own role.
- Evidence links must be `http(s)` or the app's own uploads (no `javascript:` links). Upload extensions come from the validated MIME type and are served with `nosniff`.
- Every SQL query is parameterised, and passwords are hashed with bcrypt.

## Run it locally

**Prerequisites:** Node.js 20+, PostgreSQL 16 (or just Docker; see [DOCKER.md](DOCKER.md)).

```bash
# 1. API
cd server
npm ci
cp .env.example .env        # set DATABASE_URL and a long random JWT_SECRET
npm run db:init             # create tables (safe to re-run)
npm run db:seed             # optional demo data
npm run dev                 # http://localhost:5000

# 2. Web app (new terminal)
cd client
npm ci
cp .env.example .env        # VITE_API_URL=http://localhost:5000
npm run dev                 # http://localhost:5173
```

**Demo accounts** (after `npm run db:seed`, local only, password `password123`):
`alex.rivera@example.com` (student) · `sarah.jenkins@example.com` (mentor) · `placement@example.com` (placement officer) · `admin@example.com` (admin)

**Whole stack with Docker:** `docker compose up --build` → app on http://localhost:8080, API on :5000 (details in [DOCKER.md](DOCKER.md)).

### Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `DATABASE_URL` | server | PostgreSQL connection string (SSL enabled automatically for Render hosts) |
| `JWT_SECRET` | server | **Required.** The server refuses to start without it |
| `GOOGLE_CLIENT_ID` | server | Optional, enables Google Sign-In |
| `CLIENT_URL` | server | Optional comma-separated CORS allow-list, e.g. `https://experience-ledger.netlify.app` |
| `VITE_API_URL` | client (build time) | API base URL |
| `VITE_GOOGLE_CLIENT_ID` | client (build time) | Google Sign-In button |

## Tests

```bash
cd server
npm test            # Jest unit tests (mocked database)
npm run test:e2e    # end-to-end checks against a running API + freshly seeded throwaway DB
cd ../client && npm run lint && npm run build
```

The end-to-end script attempts each abuse case (reading another student's data, self-approval, privilege escalation, malicious links and uploads) and checks that each one is blocked.

## API overview

| Method | Endpoint | Access |
|---|---|---|
| POST | `/api/auth/register` · `/api/auth/login` · `/api/auth/google` | Public |
| GET | `/api/auth/me` | Logged in |
| GET / POST | `/api/experiences` | Logged in (students see only their own) |
| GET / PUT / DELETE | `/api/experiences/:id` | Owner or reviewer (PUT: owner, not once approved) |
| PUT | `/api/experiences/:id/status` | Mentor, placement officer, admin |
| POST | `/api/uploads` | Logged in |
| GET / PATCH | `/api/users`, `/api/users/:id/role` | Admin |

Full request/response contracts are in the [LLD](LLD.md#2-api-endpoint-contracts).

## Project structure

```
client/            React app (pages/, components/, api/, context/, roles.js)
server/            Express API (routes/, controllers/, middleware/, config/schema.sql, scripts/e2e.mjs)
bruno/             API collection
docs/mock-ux/      UX mockups
PRD.md HLD.md LLD.md   Product and design documents
```

## Deploying

- **Client → Netlify:** base directory `client`, build `npm run build`, publish `client/dist`, env `VITE_API_URL=<Render API URL>`. `public/_redirects` handles client-side routes.
- **API → Render:** root `server`, start `npm start`, env `DATABASE_URL`, `JWT_SECRET`, `CLIENT_URL`. Run `npm run db:init` once after each schema change. It is idempotent.

## Project timeline

PRD and research → GitHub setup → mock UX (incl. empty/error states) → React scaffolding → PostgreSQL schema and CRUD API → password + JWT auth → role-based authorization → Google Sign-In → evidence uploads → Bruno docs → Jest tests → Docker → Netlify/Render deployment → real analytics → admin role management → security hardening and review-loop completion.

---

Built by **Sujan Anandh** as a Kalvium capstone project.
