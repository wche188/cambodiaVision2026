import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPool = {
  execute: vi.fn(),
};

vi.mock('@/lib/mysql', () => ({
  withDb: vi.fn((handler) => handler(mockPool)),
}));

vi.mock('fs', () => ({
  readFileSync: vi.fn(() => Buffer.from('fake-logo-data')),
}));

vi.mock('jspdf', () => {
  class MockJsPDF {
    constructor() {
      this.internal = { pageSize: { getWidth: () => 210 } };
    }
    setFontSize() {}
    setFont() {}
    setDrawColor() {}
    text() {}
    line() {}
    addImage() {}
    output() { return new ArrayBuffer(100); }
  }
  return {
    jsPDF: MockJsPDF,
  };
});

import { GET } from './route.js';

function makeRequest(patientId, queryString = '') {
  return {
    url: `http://localhost:3000/api/generate-pdf/${patientId}${queryString}`,
  };
}

function makeParams(patientId) {
  return { params: Promise.resolve({ patientId: String(patientId) }) };
}

describe('GET /api/generate-pdf/[patientId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when type parameter is missing', async () => {
    const res = await GET(makeRequest(1, ''), makeParams(1));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain('Invalid or missing type parameter');
  });

  it('returns 400 when type parameter is invalid', async () => {
    const res = await GET(makeRequest(1, '?type=invalid'), makeParams(1));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain('Invalid or missing type parameter');
  });

  it('returns 404 when patient is not found', async () => {
    mockPool.execute.mockResolvedValueOnce([[]]);

    const res = await GET(makeRequest(999, '?type=registration'), makeParams(999));
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe('Patient not found');
  });

  it('generates a registration PDF with correct headers', async () => {
    const patient = {
      id: 1,
      patient_number: '0001',
      family_name: 'Smith',
      given_name: 'John',
      age: 45,
      gender: 'Male',
      blood_group: 'O+',
      contact_phone: '012345678',
      province: 'Phnom Penh',
      district: 'Chamkar Mon',
      village: 'Toul Kork',
      commune: 'Boeng Keng Kang',
      reason_for_visit: 'Eye check',
      registration_date: '2025-01-15',
      photo: null,
    };
    mockPool.execute.mockResolvedValueOnce([[patient]]);

    const res = await GET(makeRequest(1, '?type=registration'), makeParams(1));

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
    expect(res.headers.get('Content-Disposition')).toBe('attachment; filename="patient-1-registration.pdf"');
  });

  it('generates a surgery PDF and fetches related records', async () => {
    const patient = {
      id: 2,
      patient_number: '0002',
      family_name: 'Doe',
      given_name: 'Jane',
      age: 60,
      gender: 'Female',
      status: 'Surgery_Eligible',
    };
    const gpExam = {
      visual_acuity_left: '6/12',
      visual_acuity_right: '6/6',
      diagnosis_notes: 'Cataract left eye',
      recommendation: 'Surgery recommended',
      examined_at: '2025-01-20',
    };
    const surgeryDecision = {
      eligibility: 'Surgery_Eligible',
      surgery_type: 'Cataract extraction',
      eye: 'left',
      scheduled_date: '2025-02-01',
      decided_at: '2025-01-21',
    };

    mockPool.execute
      .mockResolvedValueOnce([[patient]])
      .mockResolvedValueOnce([[gpExam]])
      .mockResolvedValueOnce([[surgeryDecision]]);

    const res = await GET(makeRequest(2, '?type=surgery'), makeParams(2));

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
    expect(res.headers.get('Content-Disposition')).toBe('attachment; filename="patient-2-surgery.pdf"');

    // Verify all three queries were made (patient, gp_exam, surgery_decision)
    expect(mockPool.execute).toHaveBeenCalledTimes(3);
    expect(mockPool.execute).toHaveBeenCalledWith(
      'SELECT * FROM patients WHERE id = ?',
      ['2']
    );
    expect(mockPool.execute).toHaveBeenCalledWith(
      'SELECT * FROM gp_examinations WHERE patient_id = ?',
      ['2']
    );
    expect(mockPool.execute).toHaveBeenCalledWith(
      'SELECT * FROM surgery_decisions WHERE patient_id = ?',
      ['2']
    );
  });

  it('generates surgery PDF even without GP exam or surgery decision data', async () => {
    const patient = {
      id: 3,
      patient_number: '0003',
      family_name: 'Test',
      given_name: 'Patient',
      age: 30,
      gender: 'Male',
      status: 'Registered',
    };

    mockPool.execute
      .mockResolvedValueOnce([[patient]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]]);

    const res = await GET(makeRequest(3, '?type=surgery'), makeParams(3));

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
  });

  it('only queries patient table for registration type', async () => {
    const patient = {
      id: 4,
      patient_number: '0004',
      family_name: 'Simple',
      given_name: 'Test',
      age: 25,
      gender: 'Female',
      contact_phone: '098765432',
      province: 'Siem Reap',
      district: 'Downtown',
      registration_date: '2025-01-10',
    };
    mockPool.execute.mockResolvedValueOnce([[patient]]);

    await GET(makeRequest(4, '?type=registration'), makeParams(4));

    // Only one query for the patient, no GP exam or surgery queries
    expect(mockPool.execute).toHaveBeenCalledTimes(1);
    expect(mockPool.execute).toHaveBeenCalledWith(
      'SELECT * FROM patients WHERE id = ?',
      ['4']
    );
  });
});
