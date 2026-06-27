import { withDb } from '@/lib/mysql';

/**
 * GET /api/stations/status
 * Returns busy level for all stations.
 */
export async function GET() {
  return withDb(async (pool) => {
    const [rows] = await pool.execute('SELECT station, busy_level, updated_at FROM station_status');
    const statuses = {};
    for (const row of rows) {
      statuses[row.station] = row.busy_level;
    }
    return Response.json({ data: statuses });
  });
}

/**
 * POST /api/stations/status
 * Update a station's busy level.
 * Body: { "station": "Doctor", "level": "low" | "mid" | "high" }
 */
export async function POST(request) {
  return withDb(async (pool) => {
    const { station, level } = await request.json();

    if (!station || !['low', 'mid', 'high'].includes(level)) {
      return Response.json({ error: 'Invalid station or level' }, { status: 400 });
    }

    await pool.execute(
      'INSERT INTO station_status (station, busy_level) VALUES (?, ?) ON DUPLICATE KEY UPDATE busy_level = ?',
      [station, level, level]
    );

    return Response.json({ success: true, station, level });
  });
}
