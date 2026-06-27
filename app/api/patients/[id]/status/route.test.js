import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('@/lib/mysql', () => ({
  withDb: vi.fn((handler) => handler(mockPool)),
}));

vi.mock('@/lib/status-pipeline', () => ({
  isValidTransition: vi.fn(),
  getAllowedTransitions: vi.fn(),
}));

const mockPool = {
  execute: vi.fn(),
};

import { PATCH } from './route.js';
import { isValidTransition, getAllowedTransitions } from '@/lib/status-pipeline';

function makeRequest(body) {
  return {
    json: () => Promise.resolve(body),
  };
}

function makeParams(id) {
  return { params: Promise.resolve({ id }) };
}

describe('PATCH /api/patients/[id]/status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when status field is missing', async () => {
    const res = await PATCH(makeRequest({}), makeParams('1'));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe('Missing required field: status');
  });

  it('returns 404 when patient is not found', async () => {
    mockPool.execute.mockResolvedValueOnce([[]]);

    const res = await PATCH(makeRequest({ status: 'Seen_by_GP' }), makeParams('999'));
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe('Patient not found');
  });

  it('returns 400 with allowed transitions when transition is invalid', async () => {
    mockPool.execute.mockResolvedValueOnce([[{ id: 1, status: 'Registered' }]]);
    isValidTransition.mockReturnValue(false);
    getAllowedTransitions.mockReturnValue(['Seen_by_GP']);

    const res = await PATCH(makeRequest({ status: 'Complete' }), makeParams('1'));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Invalid status transition from 'Registered' to 'Complete'");
    expect(data.currentStatus).toBe('Registered');
    expect(data.allowedTransitions).toEqual(['Seen_by_GP']);
  });

  it('updates patient status and inserts status_history on valid transition', async () => {
    const updatedPatient = { id: 1, status: 'Seen_by_GP', family_name: 'Doe' };

    mockPool.execute
      .mockResolvedValueOnce([[{ id: 1, status: 'Registered' }]]) // SELECT current status
      .mockResolvedValueOnce([{ affectedRows: 1 }])               // UPDATE patients
      .mockResolvedValueOnce([{ insertId: 1 }])                   // INSERT status_history
      .mockResolvedValueOnce([[updatedPatient]]);                  // SELECT updated patient

    isValidTransition.mockReturnValue(true);

    const res = await PATCH(makeRequest({ status: 'Seen_by_GP' }), makeParams('1'));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.data).toEqual(updatedPatient);

    // Verify the UPDATE query
    expect(mockPool.execute).toHaveBeenCalledWith(
      'UPDATE patients SET status = ? WHERE id = ?',
      ['Seen_by_GP', '1']
    );

    // Verify the status_history INSERT
    expect(mockPool.execute).toHaveBeenCalledWith(
      'INSERT INTO status_history (patient_id, from_status, to_status) VALUES (?, ?, ?)',
      ['1', 'Registered', 'Seen_by_GP']
    );
  });

  it('calls isValidTransition with correct arguments', async () => {
    mockPool.execute.mockResolvedValueOnce([[{ id: 5, status: 'Seen_by_GP' }]]);
    isValidTransition.mockReturnValue(false);
    getAllowedTransitions.mockReturnValue(['Surgery_Eligible', 'Not_Eligible']);

    await PATCH(makeRequest({ status: 'Complete' }), makeParams('5'));

    expect(isValidTransition).toHaveBeenCalledWith('Seen_by_GP', 'Complete');
    expect(getAllowedTransitions).toHaveBeenCalledWith('Seen_by_GP');
  });

  it('returns 400 for terminal state transitions', async () => {
    mockPool.execute.mockResolvedValueOnce([[{ id: 2, status: 'Complete' }]]);
    isValidTransition.mockReturnValue(false);
    getAllowedTransitions.mockReturnValue([]);

    const res = await PATCH(makeRequest({ status: 'Registered' }), makeParams('2'));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Invalid status transition from 'Complete' to 'Registered'");
    expect(data.currentStatus).toBe('Complete');
    expect(data.allowedTransitions).toEqual([]);
  });
});
