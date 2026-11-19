require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const { connectDB } = require('./config/db');
const experienceRoutes = require('./routes/experienceRoutes');
const authRoutes = require('./routes/authRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const userRoutes = require('./routes/userRoutes');

// Fail fast: without a secret, jwt.sign/verify throw on every request and the
// app looks "up" while every login silently 500s.
if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is not set - refusing to start. Copy server/.env.example to server/.env.');
  process.exit(1);
}

const app = express();

// CLIENT_URL may be a comma-separated allow-list (e.g. the Netlify URL + localhost).
// Unset = allow any origin, which keeps local development friction-free.
const allowedOrigins = (process.env.CLIENT_URL || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
app.use(cors(allowedOrigins.length ? { origin: allowedOrigins } : {}));
app.use(express.json({ limit: '100kb' }));
connectDB();

app.get('/', (req, res) => {
  res.send('Experience Ledger API is running');
});

// Uploaded evidence is user-supplied content: nosniff stops a browser from
// "guessing" a PDF/PNG is HTML and executing it on the API's origin.
app.use(
  '/uploads',
  express.static(path.join(__dirname, 'uploads'), {
    setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
  })
);
app.use('/api/auth', authRoutes);
app.use('/api/experiences', experienceRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/users', userRoutes);

// Unknown API routes get the same JSON error shape as everything else.
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
});

// Last-resort handler (e.g. malformed JSON body) - never leak a stack trace.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'Request body is not valid JSON' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ success: false, message: 'Request body is too large' });
  }
  console.error('Unhandled error:', err.message);
  return res.status(500).json({ success: false, message: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
