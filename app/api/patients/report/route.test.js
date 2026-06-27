import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPool = {
  execute: vi.fn(),
};

vi.mock('@/lib/mysql', () => ({
  withDb: vi.fn((handler) => handler(mockPool)),
}));

import { GET } from './route.js';

describe('GET /api/patients/report', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns aggregate statistics with byStatus, byDate, byProvince, and total', async () => {
    // byStatus query
    mockPool.execute.mockResolvedValueOnce([
      [
        { status: 'Registered', count: 5 },
        { status: 'Seen_by_GP', count: 3 },
        { status: 'Surgery_Eligible', count: 2 },
      ],
    ]);
    // byDate query
    mockPool.execute.mockResolvedValueOnce([
      [
        { date: '2025-01-15', count: 4 },
        { date: '2025-01-14', count: 6 },
      ],
    ]);
    // byProvince query
    mockPool.execute.mockResolvedValueOnce([
      [
        { province: 'Phnom Penh', count: 7 },
        { province: 'Siem Reap', count: 3 },
      ],
    ]);
    // total query
    mockPool.execute.mockResolvedValueOnce([[{ total: 10 }]]);

    const res = await GET();
    const json = await res.json();

    expect(json.data.byStatus).toEqual({
      Registered: 5,
      Seen_by_GP: 3,
      Surgery_Eligible: 2,
    });
    expect(json.data.byDate).toEqual([
      { date: '2025-01-15', count: 4 },
      { date: '2025-01-14', count: 6 },
    ]);
    expect(json.data.byProvince).toEqual([
      { province: 'Phnom Penh', count: 7 },
      { province: 'Siem Reap', count: 3 },
    ]);
    expect(json.data.total).toBe(10);
  });

  it('executes correct SQL queries', async () => {
    mockPool.execute.mockResolvedValueOnce([[]]);
    mockPool.execute.mockResolvedValueOnce([[]]);
    mockPool.execute.mockResolvedValueOnce([[]]);
    mockPool.execute.mockResolvedValueOnce([[{ total: 0 }]]);

    await GET();

    expect(mockPool.execute).toHaveBeenCalledTimes(4);
    expect(mockPool.execute.mock.calls[0][0]).toBe(
      'SELECT status, COUNT(*) as count FROM patients GROUP BY status'
    );
    expect(mockPool.execute.mock.calls[1][0]).toBe(
      'SELECT registration_date as date, COUNT(*) as count FROM patients GROUP BY registration_date ORDER BY registration_date DESC LIMIT 30'
    );
    expect(mockPool.execute.mock.calls[2][0]).toBe(
      'SELECT province, COUNT(*) as count FROM patients GROUP BY province ORDER BY count DESC'
    );
    expect(mockPool.execute.mock.calls[3][0]).toBe(
      'SELECT COUNT(*) as total FROM patients'
    );
  });

  it('returns empty results when no patients exist', async () => {
    mockPool.execute.mockResolvedValueOnce([[]]);
    mockPool.execute.mockResolvedValueOnce([[]]);
    mockPool.execute.mockResolvedValueOnce([[]]);
    mockPool.execute.mockResolvedValueOnce([[{ total: 0 }]]);

    const res = await GET();
    const json = await res.json();

    expect(json.data.byStatus).toEqual({});
    expect(json.data.byDate).toEqual([]);
    expect(json.data.byProvince).toEqual([]);
    expect(json.data.total).toBe(0);
  });

  it('handles date objects from MySQL driver', async () => {
    mockPool.execute.mockResolvedValueOnce([[]]);
    // MySQL driver may return Date objects for date columns
    mockPool.execute.mockResolvedValueOnce([
      [{ date: new Date('2025-03-10T00:00:00Z'), count: 2 }],
    ]);
    mockPool.execute.mockResolvedValueOnce([[]]);
    mockPool.execute.mockResolvedValueOnce([[{ total: 2 }]]);

    const res = await GET();
    const json = await res.json();

    expect(json.data.byDate).toEqual([{ date: '2025-03-10', count: 2 }]);
  });
});
