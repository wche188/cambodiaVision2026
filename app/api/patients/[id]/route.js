import pool, { withDb } from '@/lib/mysql';
import { getSession } from '@/lib/session';

export async function GET(request, { params }) {
  return withDb(async (db) => {
    const { id } = await params;

    const [rows] = await db.execute(
      'SELECT * FROM patients WHERE id = ?',
      [id]
    );

    if (rows.length === 0) {
      return Response.json({ error: 'Patient not found' }, { status: 404 });
    }

    const patient = rows[0];

    // Fetch GP examination data for this patient
    const [examRows] = await db.execute(
      'SELECT * FROM gp_examinations WHERE patient_id = ?',
      [id]
    );

    // Fetch surgery decision data for this patient
    const [surgeryRows] = await db.execute(
      'SELECT * FROM surgery_decisions WHERE patient_id = ?',
      [id]
    );

    const session = await getSession();
    const responseData = { ...patient };

    // Only admin and station_manager can see clinical PHI fields
    if (session.role === 'admin' || session.role === 'station_manager') {
      responseData.gp_examination = examRows.length > 0 ? examRows[0] : null;
      responseData.surgery_decision = surgeryRows.length > 0 ? surgeryRows[0] : null;
    }

    return Response.json({
      data: responseData,
    });
  });
}

export async function PUT(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();

    // Build dynamic update query
    const fields = [];
    const values = [];

    const allowedFields = [
      'gender', 'is_pregnant', 'blood_group', 'family_name', 'given_name',
      'age', 'has_tb', 'contact_phone', 'province', 'district', 'village',
      'commune', 'reason_for_visit', 'photo', 'registration_date', 'treatment'
    ];

    // Validate age if provided
    if (body.age !== undefined && body.age !== null && isNaN(Number(body.age))) {
      return Response.json({ data: null, error: 'Invalid input' }, { status: 400 });
    }

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(body[field]);
      }
    }

    if (fields.length === 0) {
      return Response.json({ data: null, error: 'No fields to update' }, { status: 400 });
    }

    values.push(id);

    const query = `UPDATE patients SET ${fields.join(', ')} WHERE id = ?`;
    await pool.execute(query, values);

    // Fetch updated patient
    const [rows] = await pool.execute(
      'SELECT * FROM patients WHERE id = ?',
      [id]
    );

    return Response.json({ data: rows[0], error: null });
  } catch (error) {
    console.error('Error updating patient:', error);
    return Response.json({ data: null, error: 'Invalid input' }, { status: 400 });
  }
}

// DELETE endpoint removed — patient deletion should only happen via direct SQL backend access.
