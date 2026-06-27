import { withDb } from '@/lib/mysql';
import { STATIONS, checkSurgeryWarning } from '@/lib/status-pipeline';

/**
 * POST /api/patients/[id]/station
 * Records that a patient has visited a station.
 * Body: { "station": "Doctor" | "Optometry" | "Ear_Therapy" | "Surgery" }
 *
 * Returns a soft warning for Surgery if Doctor/Optometry not done.
 */
export async function POST(request, { params }) {
  return withDb(async (pool) => {
    const { id } = await params;
    const body = await request.json();
    const { station } = body;

    if (!station || !STATIONS.includes(station)) {
      return Response.json(
        { error: `Invalid station. Must be one of: ${STATIONS.join(', ')}` },
        { status: 400 }
      );
    }

    // Fetch patient
    const [rows] = await pool.execute(
      'SELECT id, stations_visited FROM patients WHERE id = ?',
      [id]
    );

    if (rows.length === 0) {
      return Response.json({ error: 'Patient not found' }, { status: 404 });
    }

    const patient = rows[0];
    let stationsVisited = [];
    try {
      // MySQL JSON column returns already-parsed array via mysql2
      if (Array.isArray(patient.stations_visited)) {
        stationsVisited = patient.stations_visited;
      } else if (typeof patient.stations_visited === 'string') {
        stationsVisited = JSON.parse(patient.stations_visited || '[]');
      }
    } catch {
      stationsVisited = [];
    }

    // Toggle station — add if not there, remove if already there
    if (stationsVisited.includes(station)) {
      stationsVisited = stationsVisited.filter(s => s !== station);
    } else {
      stationsVisited.push(station);
    }

    // Update patient
    await pool.execute(
      'UPDATE patients SET stations_visited = ? WHERE id = ?',
      [JSON.stringify(stationsVisited), id]
    );

    // Record in history
    await pool.execute(
      'INSERT INTO status_history (patient_id, from_status, to_status, changed_by) VALUES (?, ?, ?, ?)',
      [id, '', `Station: ${station}`, station]
    );

    // Check for surgery warning
    let warning = null;
    if (station === 'Surgery') {
      const check = checkSurgeryWarning(stationsVisited);
      if (check.warn) {
        warning = `Note: Patient has not seen ${check.missing.join(' or ')} yet`;
      }
    }

    const [updated] = await pool.execute('SELECT * FROM patients WHERE id = ?', [id]);

    return Response.json({
      data: updated[0],
      stationsVisited,
      warning,
    });
  });
}
