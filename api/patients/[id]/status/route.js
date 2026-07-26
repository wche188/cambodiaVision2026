import { withDb } from '@/lib/mysql';
import { isValidTransition, getAllowedTransitions } from '@/lib/status-pipeline';

/**
 * PATCH /api/patients/[id]/status
 * Updates a patient's status following the state machine rules.
 * Validates: Requirements 5.3, 5.4, 5.5
 */
export async function PATCH(request, { params }) {
  return withDb(async (pool) => {
    const { id } = await params;
    const body = await request.json();
    const { status: targetStatus } = body;

    if (!targetStatus) {
      return Response.json(
        { error: 'Missing required field: status' },
        { status: 400 }
      );
    }

    // Fetch the patient's current status
    const [rows] = await pool.execute(
      'SELECT id, status, stations_visited FROM patients WHERE id = ?',
      [id]
    );

    if (rows.length === 0) {
      return Response.json(
        { error: 'Patient not found' },
        { status: 404 }
      );
    }

    const patient = rows[0];
    const currentStatus = patient.status;
    let stationsVisited = [];
    try {
      stationsVisited = JSON.parse(patient.stations_visited || '[]');
    } catch {
      stationsVisited = [];
    }

    // Validate the transition using the state machine
    if (!isValidTransition(currentStatus, targetStatus, stationsVisited)) {
      return Response.json(
        {
          error: `Invalid status transition from '${currentStatus}' to '${targetStatus}'`,
          currentStatus,
          allowedTransitions: getAllowedTransitions(currentStatus, stationsVisited),
        },
        { status: 400 }
      );
    }

    // Update the patient's status
    await pool.execute(
      'UPDATE patients SET status = ? WHERE id = ?',
      [targetStatus, id]
    );

    // Record the transition in status_history
    await pool.execute(
      'INSERT INTO status_history (patient_id, from_status, to_status) VALUES (?, ?, ?)',
      [id, currentStatus, targetStatus]
    );

    // Fetch and return the updated patient
    const [updated] = await pool.execute(
      'SELECT * FROM patients WHERE id = ?',
      [id]
    );

    return Response.json({ data: updated[0] });
  });
}
