import pool, { withDb } from '@/lib/mysql';

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

    return Response.json({
      data: {
        ...patient,
        gp_examination: examRows.length > 0 ? examRows[0] : null,
        surgery_decision: surgeryRows.length > 0 ? surgeryRows[0] : null,
      },
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
    return Response.json({ data: null, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = params;

    // Check if patient exists
    const [existing] = await pool.execute(
      'SELECT * FROM patients WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return Response.json({ data: null, error: 'Patient not found' }, { status: 404 });
    }

    // Delete patient
    await pool.execute('DELETE FROM patients WHERE id = ?', [id]);

    return Response.json({ data: { message: 'Patient deleted successfully' }, error: null });
  } catch (error) {
    console.error('Error deleting patient:', error);
    return Response.json({ data: null, error: error.message }, { status: 500 });
  }
}
