const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');

// Verifies the Bearer token, then loads the user's CURRENT role from the database
// and attaches { id, role } to req.user.
//
// Why not trust the role inside the JWT? Tokens live for 7 days. If an admin demotes
// a mentor (or deletes an account), the old token would keep its old privileges until
// it expired. One indexed primary-key lookup per request makes revocation immediate.
const protect = async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized, no token provided' });
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Not authorized, invalid or expired token' });
  }

  try {
    const { rows } = await pool.query('SELECT id, role FROM users WHERE id = $1', [payload.id]);
    if (!rows[0]) {
      return res.status(401).json({ success: false, message: 'Not authorized, account no longer exists' });
    }
    req.user = { id: rows[0].id, role: rows[0].role };
    return next();
  } catch (error) {
    console.error('Error loading authenticated user:', error.message);
    return res.status(500).json({ success: false, message: 'Server error while authenticating' });
  }
};

// Restricts a route to the given roles, read from req.user set by `protect`.
// Must run after `protect` so req.user is already populated.
const authorize = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'You do not have permission to perform this action' });
  }
  return next();
};

const REVIEWER_ROLES = ['mentor', 'placement_officer', 'admin'];
const isReviewer = (user) => Boolean(user) && REVIEWER_ROLES.includes(user.role);

module.exports = { protect, authorize, REVIEWER_ROLES, isReviewer };
