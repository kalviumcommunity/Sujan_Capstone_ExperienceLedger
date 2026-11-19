// A fake transaction client shares the same query mock, so tests can script
// every SQL call in order regardless of whether it runs inside a transaction.
jest.mock('../../config/db', () => {
  const query = jest.fn();
  return {
    pool: { query },
    withTransaction: jest.fn((work) => work({ query })),
  };
});

const { pool } = require('../../config/db');
const {
  createExperience,
  getExperiences,
  getExperienceById,
  updateExperience,
  updateExperienceStatus,
  deleteExperience,
  normalizeEvidenceLink,
} = require('../experienceController');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

const validBody = { type: 'internship', organization: 'Acme', role: 'Intern', description: 'Built things' };

beforeEach(() => {
  pool.query.mockReset();
});

describe('createExperience', () => {
  it('returns 400 when a required field is missing', async () => {
    const req = { body: { organization: 'Acme' }, user: { id: 3, role: 'student' } };
    const res = mockRes();

    await createExperience(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('returns 400 for an unknown experience type instead of a DB constraint 500', async () => {
    const req = { body: { ...validBody, type: 'hackathon' }, user: { id: 3, role: 'student' } };
    const res = mockRes();

    await createExperience(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects a javascript: evidence link (stored XSS against reviewers)', async () => {
    const req = {
      body: { ...validBody, evidenceLink: 'javascript:alert(document.cookie)' },
      user: { id: 3, role: 'student' },
    };
    const res = mockRes();

    await createExperience(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('always uses req.user.id as the owner, ignoring any client-supplied student id', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 99 }] }) // INSERT experience
      .mockResolvedValueOnce({ rows: [] }) // clear skill links
      .mockResolvedValueOnce({ rows: [{ id: 99, student_id: 3, skills: [] }] }); // re-read

    const req = { body: { ...validBody, student: 999 }, user: { id: 3, role: 'student' } };
    const res = mockRes();

    await createExperience(req, res);

    const [, params] = pool.query.mock.calls[0];
    expect(params[0]).toBe(3); // student_id bound param must be req.user.id, not 999
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('de-duplicates skills case-insensitively before saving them', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 99 }] })
      .mockResolvedValueOnce({ rows: [] }) // DELETE links
      .mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }] }) // upsert skills
      .mockResolvedValueOnce({ rows: [] }) // insert links
      .mockResolvedValueOnce({ rows: [{ id: 99 }] });

    const req = { body: { ...validBody, skills: ['React', 'react ', 'SQL', ''] }, user: { id: 3, role: 'student' } };
    await createExperience(req, mockRes());

    expect(pool.query.mock.calls[2][1]).toEqual([['React', 'SQL']]);
  });
});

describe('normalizeEvidenceLink', () => {
  it.each([
    ['/uploads/123-abc.pdf', '/uploads/123-abc.pdf'],
    ['github.com/me/repo', 'https://github.com/me/repo'],
    ['https://example.com/x', 'https://example.com/x'],
  ])('accepts %s', (input, expected) => {
    expect(normalizeEvidenceLink(input)).toEqual({ ok: true, value: expected });
  });

  it.each(['javascript:alert(1)', 'data:text/html,hi', '/uploads/../../etc/passwd'])('rejects %s', (input) => {
    expect(normalizeEvidenceLink(input).ok).toBe(false);
  });
});

describe('getExperiences', () => {
  it("scopes a student to their own records even if they ask for someone else's", async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const req = { query: { student: '999' }, user: { id: 3, role: 'student' } };

    await getExperiences(req, mockRes());

    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain('e.student_id = $1');
    expect(params).toEqual([3]);
  });

  it('lets a reviewer list everything', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const req = { query: {}, user: { id: 1, role: 'mentor' } };

    await getExperiences(req, mockRes());

    expect(pool.query.mock.calls[0][1]).toEqual([]);
  });

  it('returns 400 for an invalid status filter', async () => {
    const req = { query: { status: 'Bogus' }, user: { id: 1, role: 'mentor' } };
    const res = mockRes();

    await getExperiences(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('getExperienceById', () => {
  it('returns 400 for a non-numeric id instead of a Postgres 500', async () => {
    const res = mockRes();
    await getExperienceById({ params: { id: 'abc' }, user: { id: 3, role: 'student' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it("hides another student's record as 404", async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 1, student_id: 8 }] });
    const res = mockRes();
    await getExperienceById({ params: { id: '1' }, user: { id: 3, role: 'student' } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('updateExperience (student resubmission)', () => {
  it('refuses to edit an Approved (locked) record', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ student_id: 3, status: 'Approved' }] });
    const res = mockRes();

    await updateExperience({ params: { id: '1' }, body: validBody, user: { id: 3, role: 'student' } }, res);

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('resets status to Pending Verification when the owner resubmits', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ student_id: 3, status: 'Changes Requested', evidence_link: null }] })
      .mockResolvedValueOnce({ rows: [] }) // UPDATE
      .mockResolvedValueOnce({ rows: [] }) // clear skills
      .mockResolvedValueOnce({ rows: [{ id: 1, status: 'Pending Verification' }] });
    const res = mockRes();

    await updateExperience({ params: { id: '1' }, body: validBody, user: { id: 3, role: 'student' } }, res);

    expect(pool.query.mock.calls[1][0]).toContain("status = 'Pending Verification'");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("returns 404 when a student tries to edit someone else's record", async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ student_id: 8, status: 'Pending Verification' }] });
    const res = mockRes();

    await updateExperience({ params: { id: '1' }, body: validBody, user: { id: 3, role: 'student' } }, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('updateExperienceStatus', () => {
  it('requires a comment when requesting changes', async () => {
    const res = mockRes();
    await updateExperienceStatus(
      { params: { id: '1' }, body: { status: 'Changes Requested' }, user: { id: 1, role: 'mentor' } },
      res
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('blocks a reviewer from approving their own experience', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ student_id: 1 }] });
    const res = mockRes();

    await updateExperienceStatus(
      { params: { id: '1' }, body: { status: 'Approved' }, user: { id: 1, role: 'mentor' } },
      res
    );

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('records who reviewed the entry', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ student_id: 3 }] })
      .mockResolvedValueOnce({ rows: [] }) // UPDATE
      .mockResolvedValueOnce({ rows: [{ id: 1, status: 'Approved', reviewed_by: 1 }] });
    const res = mockRes();

    await updateExperienceStatus(
      { params: { id: '1' }, body: { status: 'Approved' }, user: { id: 1, role: 'mentor' } },
      res
    );

    const params = pool.query.mock.calls[1][1];
    expect(params[2]).toBe(1); // reviewed_by = the mentor
    expect(params[3]).toBeInstanceOf(Date); // reviewed_at set
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe('deleteExperience', () => {
  it('returns 404 when the experience does not exist', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const req = { params: { id: '1' }, user: { id: 3, role: 'student' } };
    const res = mockRes();

    await deleteExperience(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('lets the owning student delete their own experience', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ student_id: 3 }] }) // ownership lookup
      .mockResolvedValueOnce({ rows: [{ id: 1 }] }); // delete

    const req = { params: { id: '1' }, user: { id: 3, role: 'student' } };
    const res = mockRes();

    await deleteExperience(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("forbids a student from deleting someone else's experience", async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ student_id: 3 }] }); // owned by student 3

    const req = { params: { id: '1' }, user: { id: 7, role: 'student' } }; // different student
    const res = mockRes();

    await deleteExperience(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(pool.query).toHaveBeenCalledTimes(1); // never reaches the DELETE query
  });

  it('lets a mentor delete an experience they do not own', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ student_id: 3 }] })
      .mockResolvedValueOnce({ rows: [{ id: 1 }] });

    const req = { params: { id: '1' }, user: { id: 999, role: 'mentor' } };
    const res = mockRes();

    await deleteExperience(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });
});
