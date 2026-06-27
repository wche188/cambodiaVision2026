import { withDb } from '@/lib/mysql';
import { validateRequired, sanitizeString } from '@/lib/validate';

/**
 * POST /api/patients/[id]/gp-exam
 * Submits GP examination data for a patient.
 * Validates patient status is 'Registered' before allowing submission.
 * Transitions patient status to 'Seen_by_GP' on success.
 * Validates: Requirements 7.4, 7.5, 5.3, 13.4
 */
export async function POST(request, { params }) {
  return withDb(async (pool) => {
    const { id } = await params;
    const body = await request.json();

    // Validate required fields
    const requiredFields = [
      'visual_acuity_left',
      'visual_acuity_right',
      'diagnosis_notes',
      'recommendation',
    ];
    const errors = validateRequired(requiredFields, body);
    if (errors) {
      return Response.json({ errors }, { status: 400 });
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

    // Validate patient status is 'Registered'
    if (patient.status !== 'Registered') {
      return Response.json(
        { error: "Patient status must be 'Registered' to submit GP examination" },
        { status: 400 }
      );
    }

    // Sanitize all text inputs
    const visualAcuityLeft = sanitizeString(body.visual_acuity_left);
    const visualAcuityRight = sanitizeString(body.visual_acuity_right);
    const diagnosisNotes = sanitizeString(body.diagnosis_notes);
    const recommendation = sanitizeString(body.recommendation);

    // Insert exam data into gp_examinations table
    const [result] = await pool.execute(
      `INSERT INTO gp_examinations (patient_id, visual_acuity_left, visual_acuity_right, diagnosis_notes, recommendation)
       VALUES (?, ?, ?, ?, ?)`,
      [id, visualAcuityLeft, visualAcuityRight, diagnosisNotes, recommendation]
    );

    // Transition patient status to 'Seen_by_GP'
    await pool.execute(
      'UPDATE patients SET status = ? WHERE id = ?',
      ['Seen_by_GP', id]
    );

    // Record status transition in status_history
    await pool.execute(
      'INSERT INTO status_history (patient_id, from_status, to_status) VALUES (?, ?, ?)',
      [id, 'Registered', 'Seen_by_GP']
    );

    // Fetch the inserted exam record
    const [examRows] = await pool.execute(
      'SELECT * FROM gp_examinations WHERE id = ?',
      [result.insertId]
    );

    return Response.json({
      data: examRows[0],
      status: 'Seen_by_GP',
    });
  });
}
