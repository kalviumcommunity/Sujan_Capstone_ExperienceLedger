require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('./db');

// Inserts demo users (one per role) + pending experiences so every screen has real
// rows to work with during local testing. All demo accounts use "password123".
// Safe to re-run: users are upserted and demo experiences are only added once.
const DEMO_USERS = [
  { name: 'Alex Rivera', email: 'alex.rivera@example.com', role: 'student' },
  { name: 'Dr. Sarah Jenkins', email: 'sarah.jenkins@example.com', role: 'mentor' },
  { name: 'Priya Placement', email: 'placement@example.com', role: 'placement_officer' },
  { name: 'Admin Officer', email: 'admin@example.com', role: 'admin' },
];

const seed = async () => {
  try {
    const passwordHash = await bcrypt.hash('password123', 10);
    const ids = {};

    for (const user of DEMO_USERS) {
      const { rows } = await pool.query(
        `INSERT INTO users (name, email, password, role)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, password = EXCLUDED.password, role = EXCLUDED.role
         RETURNING id`,
        [user.name, user.email, passwordHash, user.role]
      );
      ids[user.role] = rows[0].id;
    }

    const studentId = ids.student;
    const { rows: existing } = await pool.query('SELECT 1 FROM experiences WHERE student_id = $1 LIMIT 1', [studentId]);

    if (!existing.length) {
      await pool.query(
        `INSERT INTO experiences (student_id, type, organization, role, duration, description, outcome, status)
         VALUES
          ($1, 'internship', 'Global Tech Corp', 'Data Science Intern', '2023-06-01 - 2023-08-31',
           'Led a team of 4 to refactor the data pipeline for the customer dashboard.',
           'Reduced processing latency by 40% using asynchronous tasks and optimized SQL queries.',
           'Pending Verification'),
          ($1, 'project', 'Creative Hub', 'Product Designer', '2023-10-01 - Present',
           'Designed onboarding flows for the mobile app redesign.', NULL, 'Pending Verification')`,
        [studentId]
      );
    }

    console.log('Seeded demo data:', ids);
  } catch (err) {
    console.error('Failed to seed demo data:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
};

seed();
