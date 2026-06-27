import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPool = {
  execute: vi.fn(),
};

vi.mock('@/lib/mysql', () => ({
  withDb: vi.fn((handler) => handler(mockPool)),
}));

vi.mock('@/lib/validate', () => ({
  validateRequired: vi.fn((fields, body) => {
    const errors = {};
    for (const field of fields) {
      if (!body[field] || (typeof body[field] === 'string' && !body[field].trim())) {
        errors[field] = 'Required';
      }
    }
    return Object.keys(errors).length > 0 ? errors : null;
  }),
  sanitizeString: vi.fn((input) => {
    if (typeof input !== 'string') return input;
    return input.trim().replace(/<[^>]*>/g, '');
  }),
}));

vi.mock('@/lib/status-pipeline', () => ({
  isValidTransition: vi.fn((current, target) => {
    const valid = {
      Seen_by_GP: ['Surgery_Eligible', 'Not_Eligible'],
    };
    return (valid[current] || []).includes(target);
  }),
}));

import { POST } from './route.js';

function makeRequest(body) {
  return {
    json: () => Promise.resolve(body),
  };
}

function makeParams(id) {
  return { params: Promise.resolve({ id }) };
}

describe('POST /api/patients/[id]/surgery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 if eligibility field is missing', async () => {
    const res = await POST(makeRequest({}), makeParams('1'));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.errors.eligibility).toBeDefined();
  });

  it('returns 400 if eligibility is invalid value', async () => {
    const res = await POST(makeRequest({ eligibility: 'InvalidValue' }), makeParams('1'));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.errors.eligibility).toBeDefined();
  });

  it('returns 404 if patient not found', async () => {
    mockPool.execute.mockResolvedValueOnce([[]]);

    const res = await POST(
      makeRequest({ eligibility: 'Surgery_Eligible', surgery_type: 'Cataract', eye: 'left' }),
      makeParams('999')
    );
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe('Patient not found');
  });

  it('returns 400 if patient status is not Seen_by_GP', async () => {
    mockPool.execute.mockResolvedValueOnce([[{ id: 1, status: 'Registered' }]]);

    const res = await POST(
      makeRequest({ eligibility: 'Surgery_Eligible', surgery_type: 'Cataract', eye: 'left' }),
      makeParams('1')
    );
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Patient status must be 'Seen_by_GP' to submit surgery eligibility");
  });

  it('returns 400 if Surgery_Eligible but surgery_type is missing', async () => {
    mockPool.execute.mockResolvedValueOnce([[{ id: 1, status: 'Seen_by_GP' }]]);

    const res = await POST(
      makeRequest({ eligibility: 'Surgery_Eligible', eye: 'left' }),
      makeParams('1')
    );
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.errors.surgery_type).toBe('Required');
  });

  it('returns 400 if Surgery_Eligible but eye is missing', async () => {
    mockPool.execute.mockResolvedValueOnce([[{ id: 1, status: 'Seen_by_GP' }]]);

    const res = await POST(
      makeRequest({ eligibility: 'Surgery_Eligible', surgery_type: 'Cataract' }),
      makeParams('1')
    );
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.errors.eye).toBe('Required');
  });

  it('returns 400 if eye value is not left/right/both', async () => {
    mockPool.execute.mockResolvedValueOnce([[{ id: 1, status: 'Seen_by_GP' }]]);

    const res = await POST(
      makeRequest({ eligibility: 'Surgery_Eligible', surgery_type: 'Cataract', eye: 'invalid' }),
      makeParams('1')
    );
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.errors.eye).toBe('Must be one of: left, right, both');
  });

  it('returns 400 if Not_Eligible but reason is missing', async () => {
    mockPool.execute.mockResolvedValueOnce([[{ id: 1, status: 'Seen_by_GP' }]]);

    const res = await POST(
      makeRequest({ eligibility: 'Not_Eligible' }),
      makeParams('1')
    );
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.errors.reason).toBe('Required');
  });

  it('successfully records Surgery_Eligible decision', async () => {
    const decisionRecord = {
      id: 10,
      patient_id: 42,
      eligibility: 'Surgery_Eligible',
      surgery_type: 'Cataract extraction',
      eye: 'left',
      scheduled_date: '2025-03-15',
      ineligibility_reason: null,
    };

    mockPool.execute
      .mockResolvedValueOnce([[{ id: 42, status: 'Seen_by_GP' }]])   // SELECT patient
      .mockResolvedValueOnce([{ insertId: 10 }])                      // INSERT surgery_decisions
      .mockResolvedValueOnce([{}])                                    // UPDATE patients status
      .mockResolvedValueOnce([{}])                                    // INSERT status_history
      .mockResolvedValueOnce([[decisionRecord]]);                     // SELECT decision

    const res = await POST(
      makeRequest({
        eligibility: 'Surgery_Eligible',
        surgery_type: 'Cataract extraction',
        eye: 'left',
        scheduled_date: '2025-03-15',
      }),
      makeParams('42')
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.data).toEqual(decisionRecord);
    expect(data.status).toBe('Surgery_Eligible');

    // Verify parameterized query for INSERT
    const insertCall = mockPool.execute.mock.calls[1];
    expect(insertCall[0]).toContain('INSERT INTO surgery_decisions');
    expect(insertCall[1]).toEqual(['42', 'Surgery_Eligible', 'Cataract extraction', 'left', '2025-03-15', null]);

    // Verify status update
    const statusCall = mockPool.execute.mock.calls[2];
    expect(statusCall[1]).toEqual(['Surgery_Eligible', '42']);

    // Verify status_history insertion
    const historyCall = mockPool.execute.mock.calls[3];
    expect(historyCall[1]).toEqual(['42', 'Seen_by_GP', 'Surgery_Eligible']);
  });

  it('successfully records Not_Eligible decision', async () => {
    const decisionRecord = {
      id: 11,
      patient_id: 42,
      eligibility: 'Not_Eligible',
      surgery_type: null,
      eye: null,
      scheduled_date: null,
      ineligibility_reason: 'Patient has uncontrolled diabetes',
    };

    mockPool.execute
      .mockResolvedValueOnce([[{ id: 42, status: 'Seen_by_GP' }]])
      .mockResolvedValueOnce([{ insertId: 11 }])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([[decisionRecord]]);

    const res = await POST(
      makeRequest({
        eligibility: 'Not_Eligible',
        reason: 'Patient has uncontrolled diabetes',
      }),
      makeParams('42')
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.data).toEqual(decisionRecord);
    expect(data.status).toBe('Not_Eligible');

    // Verify INSERT has sanitized reason and null surgery fields
    const insertCall = mockPool.execute.mock.calls[1];
    expect(insertCall[1]).toEqual(['42', 'Not_Eligible', null, null, null, 'Patient has uncontrolled diabetes']);
  });

  it('sanitizes HTML from text inputs', async () => {
    mockPool.execute
      .mockResolvedValueOnce([[{ id: 1, status: 'Seen_by_GP' }]])
      .mockResolvedValueOnce([{ insertId: 1 }])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([[{ id: 1 }]]);

    await POST(
      makeRequest({
        eligibility: 'Surgery_Eligible',
        surgery_type: '<script>alert("xss")</script>Cataract',
        eye: 'both',
      }),
      makeParams('1')
    );

    const insertCall = mockPool.execute.mock.calls[1];
    // HTML tags should be stripped
    expect(insertCall[1][2]).toBe('alert("xss")Cataract');
  });

  it('handles optional scheduled_date as null when not provided', async () => {
    mockPool.execute
      .mockResolvedValueOnce([[{ id: 1, status: 'Seen_by_GP' }]])
      .mockResolvedValueOnce([{ insertId: 1 }])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([[{ id: 1 }]]);

    await POST(
      makeRequest({
        eligibility: 'Surgery_Eligible',
        surgery_type: 'Cataract',
        eye: 'right',
      }),
      makeParams('1')
    );

    const insertCall = mockPool.execute.mock.calls[1];
    // scheduled_date should be null
    expect(insertCall[1][4]).toBeNull();
  });
});
