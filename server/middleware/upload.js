const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// The stored extension comes from this map, NEVER from the user's filename.
// Previously "evil.html" sent with a PDF mimetype was saved as ".html" and served
// from /uploads as a live web page on the API's origin (stored XSS).
const EXTENSION_BY_MIME = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
};
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB, matches the UI's stated limit

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${EXTENSION_BY_MIME[file.mimetype]}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (req, file, cb) => {
  if (!EXTENSION_BY_MIME[file.mimetype]) {
    return cb(new Error('Only PDF, JPG, and PNG files are allowed'));
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 1 },
});

module.exports = { upload, UPLOAD_DIR, EXTENSION_BY_MIME };
