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

    // Fetch related records in parallel
    const [
      gpExaminationRows,
      surgeryDecisionRows,
      surgeryRecordRows,
      attachmentCountRows,
      patientNotesRows,
    ] = await Promise.all([
      db.execute('SELECT * FROM gp_examinations WHERE patient_id = ? ORDER BY examined_at DESC LIMIT 1', [id]),
      db.execute('SELECT * FROM surgery_decisions WHERE patient_id = ? ORDER BY decided_at DESC LIMIT 1', [id]),
      db.execute(
        `SELECT sr.*, s.name AS surgeon_name, s.active AS surgeon_active
         FROM surgery_records sr
         LEFT JOIN surgeons s ON sr.surgeon_id = s.id
         WHERE sr.patient_id = ?
         ORDER BY sr.created_at ASC`,
        [id]
      ),
      // Just the count for the patient page; metadata only (no base64 data)
      db.execute(
        `SELECT category, COUNT(*) AS cnt
         FROM patient_attachments
         WHERE patient_id = ?
         GROUP BY category`,
        [id]
      ),
      db.execute(
        'SELECT id, body, created_by, created_at, updated_at, updated_by FROM patient_notes WHERE patient_id = ? ORDER BY created_at DESC',
        [id]
      ),
    ]);

    // Normalize surgery_records: the procedure_type/iol_type/incision columns
    // may hold either a plain string ("PHACO") or a JSON array (["PHACO","PHACO"])
    // depending on which client posted them. Decode robustly.
    const surgeryRecords = surgeryRecordRows[0].map((r) => ({
      id: r.id,
      patient_id: r.patient_id,
      eye: r.eye,
      procedure_type: parseMaybeJson(r.procedure_type),
      iol_type: parseMaybeJson(r.iol_type),
      incision: parseMaybeJson(r.incision),
      also_used: parseMaybeJson(r.also_used) || [],
      complications: parseMaybeJson(r.complications) || [],
      surgeon_id: r.surgeon_id,
      surgeon_name: r.surgeon_name || `Surgeon #${r.surgeon_id}`,
      surgeon_active: r.surgeon_active,
      surgeon_notes: r.surgeon_notes,
      created_at: r.created_at,
    }));

    const responseData = {
      ...patient,
      gp_examination: gpExaminationRows[0][0] || null,
      surgery_decision: surgeryDecisionRows[0][0] || null,
      surgery_records: surgeryRecords,
      notes: patientNotesRows[0] || [],
      attachments_count: (attachmentCountRows[0] || []).reduce(
        (acc, r) => ({ ...acc, [r.category]: Number(r.cnt) }),
        { document: 0, note: 0, other: 0 }
      ),
    };

    return Response.json({
      data: responseData,
    });
  });
}

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();

    const fields = [];
    const values = [];

    const allowedFields = [
      'gender', 'is_pregnant', 'blood_group', 'family_name', 'given_name',
      'age', 'has_tb', 'contact_phone', 'province', 'district', 'village',
      'commune', 'reason_for_visit', 'photo', 'registration_date', 'treatment'
    ];

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
    const [result] = await pool.execute(query, values);

    if (result.affectedRows === 0) {
      return Response.json({ data: null, error: 'Patient not found' }, { status: 404 });
    }

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

// Try to parse a column that may be JSON or a plain string. Falls back to the raw value.
function parseMaybeJson(v) {
  if (v === null || v === undefined) return null;
  if (typeof v !== 'string') return v;
  const trimmed = v.trim();
  if (!trimmed) return null;
  if (trimmed[0] === '[' || trimmed[0] === '{') {
    try { return JSON.parse(trimmed); } catch { return v; }
  }
  return v;
}
