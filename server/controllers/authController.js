const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { pool } = require('../config/db');
const { normalizeEmail, isValidEmail, MIN_PASSWORD_LENGTH, clean } = require('../utils/validation');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const signToken = (user) =>
  jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });

const toPublicUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
});

// @desc   Register a new STUDENT account with a hashed password
// @route  POST /api/auth/register
//
// Public sign-up always creates a student. Mentor / placement officer / admin are
// privileged roles (they can approve records or read every student's data), so they
// are only ever granted by an admin via PATCH /api/users/:id/role - never self-assigned.
const register = async (req, res) => {
  try {
    const name = clean(req.body.name);
    const email = normalizeEmail(req.body.email);
    const { password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'name, email, and password are required' });
    }
    if (role && role !== 'student') {
      return res.status(403).json({
        success: false,
        message: 'Only student accounts can be self-registered. Staff roles are assigned by an admin.',
      });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address' });
    }
    if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
      return res
        .status(400)
        .json({ success: false, message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
    }

    const { rows: existing } = await pool.query('SELECT id FROM users WHERE LOWER(email) = $1', [email]);
    if (existing.length) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password, role)
       VALUES ($1, $2, $3, 'student')
       RETURNING id, name, email, role`,
      [name, email, passwordHash]
    );

    const user = rows[0];
    return res.status(201).json({ success: true, token: signToken(user), user: toPublicUser(user) });
  } catch (error) {
    console.error('Error registering user:', error.message);
    return res.status(500).json({ success: false, message: 'Server error while registering user' });
  }
};

// @desc   Authenticate with email + password, issue a JWT
// @route  POST /api/auth/login
const login = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const { password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'email and password are required' });
    }

    const { rows } = await pool.query('SELECT * FROM users WHERE LOWER(email) = $1', [email]);
    const user = rows[0];

    // Google-only accounts have password = NULL. bcrypt.compare(x, null) throws, which
    // used to surface as a 500 - treat it as a normal failed login instead.
    if (user && !user.password) {
      return res.status(401).json({
        success: false,
        message: 'This account uses Google sign-in. Please continue with Google.',
      });
    }

    const passwordMatches = user ? await bcrypt.compare(password, user.password) : false;
    if (!user || !passwordMatches) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    return res.status(200).json({ success: true, token: signToken(user), user: toPublicUser(user) });
  } catch (error) {
    console.error('Error logging in:', error.message);
    return res.status(500).json({ success: false, message: 'Server error while logging in' });
  }
};

// @desc   Return the currently authenticated user (fresh from the DB, so an
//         admin's role change is picked up without logging out and back in)
// @route  GET /api/auth/me
const getMe = async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, name, email, role FROM users WHERE id = $1', [req.user.id]);
    if (!rows[0]) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    return res.status(200).json({ success: true, user: rows[0] });
  } catch (error) {
    console.error('Error fetching current user:', error.message);
    return res.status(500).json({ success: false, message: 'Server error while fetching current user' });
  }
};

// @desc   Log in (or silently register) with a Google ID token from Google Identity Services
// @route  POST /api/auth/google
const googleLogin = async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ success: false, message: 'Google credential is required' });
    }
    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(503).json({ success: false, message: 'Google sign-in is not configured on the server' });
    }

    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch (err) {
      return res.status(401).json({ success: false, message: 'Invalid Google credential' });
    }

    const { sub: googleId, name } = payload;
    const email = normalizeEmail(payload.email);

    // Only trust the email if Google has verified it. Otherwise someone could create
    // a Google identity claiming another user's address and get linked to their account.
    if (!email || payload.email_verified !== true) {
      return res.status(401).json({ success: false, message: 'Your Google email address is not verified' });
    }

    let { rows } = await pool.query('SELECT * FROM users WHERE google_id = $1', [googleId]);
    let user = rows[0];

    if (!user) {
      ({ rows } = await pool.query('SELECT * FROM users WHERE LOWER(email) = $1', [email]));
      user = rows[0];

      if (user) {
        // An account with this (verified) email already exists - link the Google
        // identity to it instead of creating a duplicate account.
        ({ rows } = await pool.query(
          'UPDATE users SET google_id = $1, updated_at = now() WHERE id = $2 RETURNING *',
          [googleId, user.id]
        ));
        user = rows[0];
      } else {
        ({ rows } = await pool.query(
          `INSERT INTO users (name, email, google_id, role)
           VALUES ($1, $2, $3, 'student')
           RETURNING *`,
          [name || email, email, googleId]
        ));
        user = rows[0];
      }
    }

    return res.status(200).json({ success: true, token: signToken(user), user: toPublicUser(user) });
  } catch (error) {
    console.error('Error with Google login:', error.message);
    return res.status(500).json({ success: false, message: 'Server error during Google login' });
  }
};

module.exports = { register, login, googleLogin, getMe };
