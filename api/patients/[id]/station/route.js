import pool, { withDb } from '@/lib/mysql';
import { getSession } from '@/lib/session';
import { STATIONS, checkSurgeryWarning } from '@/lib/status-pipeline';

/**
 * POST /api/patients/[id]/station
 * Records that a patient has visited a station.
 * Body: { "station": "Doctor" | "Optometry" | "Ear_Therapy" | "Surgery" }
 *
 * - admin: can add or remove stations (toggle)
 * - station_manager: can only ADD stations (clinical safety — no removals)
 *
 * Returns a soft warning for Surgery if Doctor/Optometry not done.
 */
export async function POST(request, { params }) {
  const session = await getSession();
  if (session.role !== 'admin' && session.role !== 'station_manager') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  return withDb(async () => {
    const { id } = await params;
    const body = await request.json();
    const { station } = body;

    if (!station || !STATIONS.includes(station)) {
      return Response.json(
        { error: `Invalid station. Must be one of: ${STATIONS.join(', ')}` },
        { status: 400 }
      );
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Fetch patient
      const [rows] = await connection.execute(
        'SELECT id, stations_visited FROM patients WHERE id = ?',
        [id]
      );

      if (rows.length === 0) {
        await connection.rollback();
        return Response.json({ error: 'Patient not found' }, { status: 404 });
      }

      const patient = rows[0];
      let stationsVisited = [];
      try {
        if (Array.isArray(patient.stations_visited)) {
          stationsVisited = patient.stations_visited;
        } else if (typeof patient.stations_visited === 'string') {
          stationsVisited = JSON.parse(patient.stations_visited || '[]');
        }
      } catch {
        stationsVisited = [];
      }

      const alreadyVisited = stationsVisited.includes(station);

      if (alreadyVisited) {
        if (session.role === 'admin') {
          // Admin can toggle off (remove)
          stationsVisited = stationsVisited.filter(s => s !== station);
        } else {
          // Station manager: no removal allowed — just acknowledge
          await connection.rollback();
          return Response.json({
            success: true,
            message: 'Already registered',
            stationsVisited,
          });
        }
      } else {
        // Add station
        stationsVisited.push(station);
      }

      // Update patient
      await connection.execute(
        'UPDATE patients SET stations_visited = ? WHERE id = ?',
        [JSON.stringify(stationsVisited), id]
      );

      // Record in history
      const action = alreadyVisited ? `Station removed: ${station}` : `Station: ${station}`;
      await connection.execute(
        'INSERT INTO status_history (patient_id, from_status, to_status, changed_by) VALUES (?, ?, ?, ?)',
        [id, '', action, session.username || station]
      );

      await connection.commit();

      // Check for surgery warning
      let warning = null;
      if (station === 'Surgery' && !alreadyVisited) {
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
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  });
}
