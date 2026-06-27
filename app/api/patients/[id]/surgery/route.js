import { withDb } from '@/lib/mysql';
import { validateRequired, sanitizeString } from '@/lib/validate';
import { isValidTransition } from '@/lib/status-pipeline';

const VALID_EYE_VALUES = ['left', 'right', 'both'];

/**
 * POST /api/patients/[id]/surgery
 * Submit surgery eligibility decision for a patient.
 * Validates: Requirements 8.2, 8.3, 8.4, 8.5, 5.3, 13.4
 */
export async function POST(request, { params }) {
  return withDb(async (pool) => {
    const { id } = await params;
    const body = await request.json();

    const { eligibility } = body;

    // Validate eligibility field is present and valid
    if (!eligibility || !['Surgery_Eligible', 'Not_Eligible'].includes(eligibility)) {
      return Response.json(
        { errors: { eligibility: 'Must be Surgery_Eligible or Not_Eligible' } },
        { status: 400 }
      );
    }

    // Fetch the patient's current status
    const [rows] = await pool.execute(
      'SELECT id, status FROM patients WHERE id = ?',
      [id]
    );

    if (rows.length === 0) {
      return Response.json(
        { error: 'Patient not found' },
        { status: 404 }
      );
    }

    const patient = rows[0];

    // Validate patient current status is Seen_by_GP
    if (patient.status !== 'Seen_by_GP') {
      return Response.json(
        { error: "Patient status must be 'Seen_by_GP' to submit surgery eligibility" },
        { status: 400 }
      );
    }

    // Validate required fields based on eligibility decision
    if (eligibility === 'Surgery_Eligible') {
      const errors = validateRequired(['surgery_type', 'eye'], body);
      if (errors) {
        return Response.json({ errors }, { status: 400 });
      }

      // Validate eye value
      if (!VALID_EYE_VALUES.includes(body.eye)) {
        return Response.json(
          { errors: { eye: 'Must be one of: left, right, both' } },
          { status: 400 }
        );
      }
    } else {
      // Not_Eligible requires reason
      const errors = validateRequired(['reason'], body);
      if (errors) {
        return Response.json({ errors }, { status: 400 });
      }
    }

    // Validate the status transition
    if (!isValidTransition(patient.status, eligibility)) {
      return Response.json(
        { error: `Invalid status transition from '${patient.status}' to '${eligibility}'` },
        { status: 400 }
      );
    }

    // Sanitize text inputs
    const surgeryType = eligibility === 'Surgery_Eligible' ? sanitizeString(body.surgery_type) : null;
    const eye = eligibility === 'Surgery_Eligible' ? body.eye : null;
    const scheduledDate = eligibility === 'Surgery_Eligible' ? (body.scheduled_date || null) : null;
    const reason = eligibility === 'Not_Eligible' ? sanitizeString(body.reason) : null;

    // Insert decision into surgery_decisions table
    const [result] = await pool.execute(
      `INSERT INTO surgery_decisions (patient_id, eligibility, surgery_type, eye, scheduled_date, ineligibility_reason)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, eligibility, surgeryType, eye, scheduledDate, reason]
    );

    // Update patient status
    await pool.execute(
      'UPDATE patients SET status = ? WHERE id = ?',
      [eligibility, id]
    );

    // Record transition in status_history
    await pool.execute(
      'INSERT INTO status_history (patient_id, from_status, to_status) VALUES (?, ?, ?)',
      [id, patient.status, eligibility]
    );

    // Fetch the inserted decision record
    const [decision] = await pool.execute(
      'SELECT * FROM surgery_decisions WHERE id = ?',
      [result.insertId]
    );

    return Response.json({ data: decision[0], status: eligibility });
  });
}
