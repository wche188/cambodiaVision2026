import { withDb } from '@/lib/mysql';

/**
 * GET /api/patients
 *
 * Lists patients with optional filtering by status and patient_number.
 * Supports comma-separated status values: ?status=Registered,Seen_by_GP
 * Results are sorted by registration_date descending within status groups.
 *
 * Validates: Requirements 5.2, 6.2, 6.5
 */
export async function GET(request) {
  return withDb(async (pool) => {
    const { searchParams } = new URL(request.url);
    const patientNumber = searchParams.get('patient_number');
    const statusParam = searchParams.get('status');

    let query = 'SELECT * FROM patients';
    const conditions = [];
    const params = [];

    if (patientNumber) {
      conditions.push('patient_number = ?');
      params.push(patientNumber);
    }

    if (statusParam) {
      const statuses = statusParam.split(',').map((s) => s.trim()).filter(Boolean);
      if (statuses.length > 0) {
        const placeholders = statuses.map(() => '?').join(', ');
        conditions.push(`status IN (${placeholders})`);
        params.push(...statuses);
      }
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY status ASC, registration_date DESC';

    const [rows] = await pool.execute(query, params);

    return Response.json({ data: rows, error: null });
  });
}

/**
 * POST /api/patients
 *
 * Creates a new patient record. Status is always set to 'Registered'
 * regardless of any status value in the request body.
 *
 * Validates: Requirements 5.2
 */
export async function POST(request) {
  return withDb(async (pool) => {
    try {
      const body = await request.json();

      const {
        patient_number,
        gender,
        is_pregnant,
        blood_group,
        family_name,
        given_name,
        age,
        has_tb,
        contact_phone,
        province,
        district,
        village,
        commune,
        reason_for_visit,
        photo,
        registration_date,
      } = body;

      const query = `
        INSERT INTO patients (
          patient_number, gender, is_pregnant, blood_group, family_name, given_name,
          age, has_tb, contact_phone, province, district, village, commune,
          reason_for_visit, photo, registration_date, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Registered')
      `;

      const params = [
        patient_number || null,
        gender || null,
        is_pregnant || 'No',
        blood_group || null,
        family_name || null,
        given_name || null,
        age || null,
        has_tb === true || has_tb === 'true' ? 1 : 0,
        contact_phone || null,
        province || null,
        district || null,
        village || null,
        commune || null,
        reason_for_visit || null,
        photo || null,
        registration_date || null,
      ];

      const [result] = await pool.execute(query, params);

      const [inserted] = await pool.execute(
        'SELECT * FROM patients WHERE id = ?',
        [result.insertId]
      );

      return Response.json({ data: inserted[0], error: null });
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        return Response.json(
          { data: null, error: 'Patient number already exists' },
          { status: 409 }
        );
      }
      throw error;
    }
  });
}
