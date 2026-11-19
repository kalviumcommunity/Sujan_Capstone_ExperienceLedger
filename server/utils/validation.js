// Small shared input helpers so every controller validates the same way.

// Route params arrive as strings; anything that isn't a positive integer would
// otherwise reach Postgres and come back as a 500 ("invalid input syntax for integer").
const parseId = (value) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

// Emails are compared case-insensitively everywhere: "Alex@X.com" and "alex@x.com"
// must be the same account, or a user can register twice / fail to log in.
const normalizeEmail = (email) => (typeof email === 'string' ? email.trim().toLowerCase() : '');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isValidEmail = (email) => EMAIL_PATTERN.test(email);

const MIN_PASSWORD_LENGTH = 6;

// Trims a string field; returns '' for non-strings so length checks are safe.
const clean = (value) => (typeof value === 'string' ? value.trim() : '');

module.exports = { parseId, normalizeEmail, isValidEmail, MIN_PASSWORD_LENGTH, clean };
