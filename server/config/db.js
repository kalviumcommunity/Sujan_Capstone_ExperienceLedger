const { Pool } = require('pg');

// Render's external Postgres hostnames require SSL; its internal/private network
// connections (used by services deployed on Render itself) and local dev don't.
// Detecting this from the URL keeps both cases working without a separate env var.
const requiresSsl = (process.env.DATABASE_URL || '').includes('render.com');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: requiresSsl ? { rejectUnauthorized: false } : false,
});

const connectDB = async () => {
  try {
    await pool.query('SELECT 1');
    console.log('PostgreSQL connected');
  } catch (err) {
    console.error('PostgreSQL connection error:', err.message);
    process.exit(1);
  }
};

// Runs `work(client)` inside BEGIN/COMMIT on one pooled connection, rolling back on
// any error - used where one logical write spans several tables (experience + skills).
const withTransaction = async (work) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

module.exports = { pool, connectDB, withTransaction };
