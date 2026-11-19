jest.mock('../../config/db', () => ({
  pool: { query: jest.fn() },
}));

const { pool } = require('../../config/db');
const { updateUserRole } = require('../userController');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => pool.query.mockReset());

describe('updateUserRole', () => {
  it('stops an admin from changing their own role (lock-out protection)', async () => {
    const res = mockRes();
    await updateUserRole({ params: { id: '1' }, body: { role: 'student' }, user: { id: 1, role: 'admin' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('rejects an unknown role', async () => {
    const res = mockRes();
    await updateUserRole({ params: { id: '2' }, body: { role: 'superuser' }, user: { id: 1, role: 'admin' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('updates another user', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 2, role: 'mentor' }] });
    const res = mockRes();
    await updateUserRole({ params: { id: '2' }, body: { role: 'mentor' }, user: { id: 1, role: 'admin' } }, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
