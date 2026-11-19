jest.mock('../../config/db', () => ({
  pool: { query: jest.fn() },
}));

const { pool } = require('../../config/db');
const { protect, authorize } = require('../auth');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('protect middleware', () => {
  const OLD_ENV = process.env.JWT_SECRET;

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret';
  });

  afterAll(() => {
    process.env.JWT_SECRET = OLD_ENV;
  });

  beforeEach(() => pool.query.mockReset());

  it('rejects a request with no Authorization header', async () => {
    const req = { headers: {} };
    const res = mockRes();
    const next = jest.fn();

    await protect(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: expect.stringContaining('no token') })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a request with a malformed or invalid token', async () => {
    const req = { headers: { authorization: 'Bearer not-a-real-token' } };
    const res = mockRes();
    const next = jest.fn();

    await protect(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('attaches the user with their CURRENT database role and calls next()', async () => {
    const jwt = require('jsonwebtoken');
    const token = jwt.sign({ id: 42, role: 'student' }, process.env.JWT_SECRET);
    pool.query.mockResolvedValueOnce({ rows: [{ id: 42, role: 'student' }] });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = jest.fn();

    await protect(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toEqual({ id: 42, role: 'student' });
    expect(res.status).not.toHaveBeenCalled();
  });

  it('uses the database role, not the (possibly stale) role inside the token', async () => {
    const jwt = require('jsonwebtoken');
    // Token was issued while this user was a mentor; an admin has since demoted them.
    const token = jwt.sign({ id: 7, role: 'mentor' }, process.env.JWT_SECRET);
    pool.query.mockResolvedValueOnce({ rows: [{ id: 7, role: 'student' }] });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const next = jest.fn();

    await protect(req, mockRes(), next);

    expect(req.user.role).toBe('student');
  });

  it('rejects a valid token whose account has been deleted', async () => {
    const jwt = require('jsonwebtoken');
    const token = jwt.sign({ id: 9, role: 'student' }, process.env.JWT_SECRET);
    pool.query.mockResolvedValueOnce({ rows: [] });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = jest.fn();

    await protect(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('authorize middleware', () => {
  it('calls next() when req.user.role is in the allowed list', () => {
    const req = { user: { id: 1, role: 'mentor' } };
    const res = mockRes();
    const next = jest.fn();

    authorize('mentor', 'admin')(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 403 when req.user.role is not in the allowed list', () => {
    const req = { user: { id: 1, role: 'student' } };
    const res = mockRes();
    const next = jest.fn();

    authorize('mentor', 'admin')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false })
    );
    expect(next).not.toHaveBeenCalled();
  });
});
