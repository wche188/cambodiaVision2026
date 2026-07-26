import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPool = {
  execute: vi.fn(),
};

vi.mock('@/lib/mysql', () => ({
  withDb: vi.fn((handler) => handler(mockPool)),
}));

import { GET, POST } from './route.js';

function makeGetRequest(queryString = '') {
  return {
    url: `http://localhost:3000/api/patients${queryString}`,
  };
}

function makePostRequest(body) {
  return {
    json: () => Promise.resolve(body),
  };
}

describe('GET /api/patients', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns all patients sorted by status then registration_date DESC', async () => {
    const patients = [
      { id: 1, family_name: 'Smith', status: 'Registered', registration_date: '2025-01-02' },
      { id: 2, family_name: 'Jones', status: 'Registered', registration_date: '2025-01-01' },
    ];
    mockPool.execute.mockResolvedValue([patients]);

    const res = await GET(makeGetRequest());
    const data = await res.json();

    expect(data.data).toEqual(patients);
    expect(data.error).toBeNull();
    expect(mockPool.execute).toHaveBeenCalledWith(
      'SELECT * FROM patients ORDER BY status ASC, registration_date DESC',
      []
    );
  });

  it('filters by patient_number when provided', async () => {
    mockPool.execute.mockResolvedValue([[{ id: 1, patient_number: '0001' }]]);

    const res = await GET(makeGetRequest('?patient_number=0001'));
    const data = await res.json();

    expect(data.data).toHaveLength(1);
    expect(mockPool.execute).toHaveBeenCalledWith(
      'SELECT * FROM patients WHERE patient_number = ? ORDER BY status ASC, registration_date DESC',
      ['0001']
    );
  });

  it('filters by single status', async () => {
    mockPool.execute.mockResolvedValue([[{ id: 1, status: 'Registered' }]]);

    const res = await GET(makeGetRequest('?status=Registered'));
    const data = await res.json();

    expect(data.data).toHaveLength(1);
    expect(mockPool.execute).toHaveBeenCalledWith(
      'SELECT * FROM patients WHERE status IN (?) ORDER BY status ASC, registration_date DESC',
      ['Registered']
    );
  });

  it('filters by multiple comma-separated statuses', async () => {
    mockPool.execute.mockResolvedValue([
      [
        { id: 1, status: 'Registered' },
        { id: 2, status: 'Seen_by_GP' },
      ],
    ]);

    const res = await GET(makeGetRequest('?status=Registered,Seen_by_GP'));
    const data = await res.json();

    expect(data.data).toHaveLength(2);
    expect(mockPool.execute).toHaveBeenCalledWith(
      'SELECT * FROM patients WHERE status IN (?, ?) ORDER BY status ASC, registration_date DESC',
      ['Registered', 'Seen_by_GP']
    );
  });

  it('combines patient_number and status filters', async () => {
    mockPool.execute.mockResolvedValue([[{ id: 1, patient_number: '0001', status: 'Registered' }]]);

    const res = await GET(makeGetRequest('?patient_number=0001&status=Registered'));
    const data = await res.json();

    expect(data.data).toHaveLength(1);
    expect(mockPool.execute).toHaveBeenCalledWith(
      'SELECT * FROM patients WHERE patient_number = ? AND status IN (?) ORDER BY status ASC, registration_date DESC',
      ['0001', 'Registered']
    );
  });

  it('ignores empty status parameter', async () => {
    mockPool.execute.mockResolvedValue([[]]);

    await GET(makeGetRequest('?status='));

    expect(mockPool.execute).toHaveBeenCalledWith(
      'SELECT * FROM patients ORDER BY status ASC, registration_date DESC',
      []
    );
  });
});

describe('POST /api/patients', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a patient with status always set to Registered', async () => {
    mockPool.execute
      .mockResolvedValueOnce([{ insertId: 1 }])
      .mockResolvedValueOnce([[{ id: 1, family_name: 'Test', status: 'Registered' }]]);

    const res = await POST(
      makePostRequest({
        patient_number: '0001',
        gender: 'Male',
        family_name: 'Test',
        given_name: 'Patient',
        age: 30,
        contact_phone: '012345678',
        province: 'Phnom Penh',
        district: 'Chamkar Mon',
        registration_date: '2025-01-01',
        status: 'Complete', // should be ignored
      })
    );
    const data = await res.json();

    expect(data.data.status).toBe('Registered');
    // Verify the INSERT query includes hardcoded 'Registered'
    const insertCall = mockPool.execute.mock.calls[0];
    expect(insertCall[0]).toContain("'Registered'");
    // The status from the body should NOT be in the params
    expect(insertCall[1]).not.toContain('Complete');
  });

  it('returns 409 for duplicate patient number', async () => {
    const error = new Error('Duplicate entry');
    error.code = 'ER_DUP_ENTRY';
    mockPool.execute.mockRejectedValue(error);

    const res = await POST(
      makePostRequest({
        patient_number: '0001',
        gender: 'Male',
        family_name: 'Dup',
        given_name: 'Test',
        age: 25,
        contact_phone: '012345678',
        province: 'Siem Reap',
        district: 'Downtown',
        registration_date: '2025-01-01',
      })
    );
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data.error).toBe('Patient number already exists');
  });
});
