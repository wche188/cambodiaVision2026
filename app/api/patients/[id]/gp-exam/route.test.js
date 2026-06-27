import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('@/lib/mysql', () => ({
  withDb: vi.fn((handler) => handler(mockPool)),
}));

vi.mock('@/lib/validate', () => ({
  validateRequired: vi.fn(),
  sanitizeString: vi.fn((input) => (typeof input === 'string' ? input.trim() : input)),
}));

const mockPool = {
  execute: vi.fn(),
};

import { POST } from './route.js';
import { validateRequired, sanitizeString } from '@/lib/validate';

function makeRequest(body) {
  return {
    json: () => Promise.resolve(body),
  };
}

function makeParams(id) {
  return { params: Promise.resolve({ id }) };
}

describe('POST /api/patients/[id]/gp-exam', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 with validation errors when required fields are missing', async () => {
    validateRequired.mockReturnValue({
      visual_acuity_left: 'Required',
      diagnosis_notes: 'Required',
    });

    const res = await POST(makeRequest({}), makeParams('1'));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.errors).toEqual({
      visual_acuity_left: 'Required',
      diagnosis_notes: 'Required',
    });
  });

  it('returns 404 when patient is not found', async () => {
    validateRequired.mockReturnValue(null);
    mockPool.execute.mockResolvedValueOnce([[]]);

    const res = await POST(
      makeRequest({
        visual_acuity_left: '6/12',
        visual_acuity_right: '6/6',
        diagnosis_notes: 'Notes',
        recommendation: 'Rec',
      }),
      makeParams('999')
    );
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe('Patient not found');
  });

  it('returns 400 when patient status is not Registered', async () => {
    validateRequired.mockReturnValue(null);
    mockPool.execute.mockResolvedValueOnce([[{ id: 1, status: 'Seen_by_GP' }]]);

    const res = await POST(
      makeRequest({
        visual_acuity_left: '6/12',
        visual_acuity_right: '6/6',
        diagnosis_notes: 'Notes',
        recommendation: 'Rec',
      }),
      makeParams('1')
    );
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Patient status must be 'Registered' to submit GP examination");
  });

  it('inserts exam data, updates status, and records history on success', async () => {
    validateRequired.mockReturnValue(null);

    const examRecord = {
      id: 10,
      patient_id: 42,
      visual_acuity_left: '6/12',
      visual_acuity_right: '6/6',
      diagnosis_notes: 'Mild cataract left eye',
      recommendation: 'Recommend surgery for left eye',
    };

    mockPool.execute
      .mockResolvedValueOnce([[{ id: 42, status: 'Registered' }]])  // SELECT patient
      .mockResolvedValueOnce([{ insertId: 10 }])                    // INSERT gp_examinations
      .mockResolvedValueOnce([{ affectedRows: 1 }])                 // UPDATE patients status
      .mockResolvedValueOnce([{ insertId: 1 }])                     // INSERT status_history
      .mockResolvedValueOnce([[examRecord]]);                        // SELECT exam record

    const res = await POST(
      makeRequest({
        visual_acuity_left: '6/12',
        visual_acuity_right: '6/6',
        diagnosis_notes: 'Mild cataract left eye',
        recommendation: 'Recommend surgery for left eye',
      }),
      makeParams('42')
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.data).toEqual(examRecord);
    expect(data.status).toBe('Seen_by_GP');
  });

  it('sanitizes text inputs before inserting into database', async () => {
    validateRequired.mockReturnValue(null);

    mockPool.execute
      .mockResolvedValueOnce([[{ id: 1, status: 'Registered' }]])
      .mockResolvedValueOnce([{ insertId: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ insertId: 1 }])
      .mockResolvedValueOnce([[{ id: 1, patient_id: 1 }]]);

    await POST(
      makeRequest({
        visual_acuity_left: '6/12',
        visual_acuity_right: '6/6',
        diagnosis_notes: '<script>alert("xss")</script>Notes',
        recommendation: 'Rec',
      }),
      makeParams('1')
    );

    // Verify sanitizeString was called for each text input
    expect(sanitizeString).toHaveBeenCalledWith('6/12');
    expect(sanitizeString).toHaveBeenCalledWith('6/6');
    expect(sanitizeString).toHaveBeenCalledWith('<script>alert("xss")</script>Notes');
    expect(sanitizeString).toHaveBeenCalledWith('Rec');
  });

  it('uses parameterized queries for all database operations', async () => {
    validateRequired.mockReturnValue(null);

    mockPool.execute
      .mockResolvedValueOnce([[{ id: 1, status: 'Registered' }]])
      .mockResolvedValueOnce([{ insertId: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ insertId: 1 }])
      .mockResolvedValueOnce([[{ id: 1, patient_id: 1 }]]);

    await POST(
      makeRequest({
        visual_acuity_left: '6/12',
        visual_acuity_right: '6/6',
        diagnosis_notes: 'Notes',
        recommendation: 'Rec',
      }),
      makeParams('1')
    );

    // Verify parameterized SELECT
    expect(mockPool.execute).toHaveBeenCalledWith(
      'SELECT id, status FROM patients WHERE id = ?',
      ['1']
    );

    // Verify parameterized INSERT into gp_examinations
    expect(mockPool.execute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO gp_examinations'),
      ['1', '6/12', '6/6', 'Notes', 'Rec']
    );

    // Verify parameterized UPDATE
    expect(mockPool.execute).toHaveBeenCalledWith(
      'UPDATE patients SET status = ? WHERE id = ?',
      ['Seen_by_GP', '1']
    );

    // Verify parameterized INSERT into status_history
    expect(mockPool.execute).toHaveBeenCalledWith(
      'INSERT INTO status_history (patient_id, from_status, to_status) VALUES (?, ?, ?)',
      ['1', 'Registered', 'Seen_by_GP']
    );
  });
});
