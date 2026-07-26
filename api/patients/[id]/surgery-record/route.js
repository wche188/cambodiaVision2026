import { withDb } from '@/lib/mysql';

/**
 * POST /api/patients/[id]/surgery-record
 * Record a surgery for the patient.
 * Body: {
 *   eye: "left"|"right"|"both",
 *   procedure_type: "ECCE"|"SIECCE"|"PHACO"|"PTERYGIUM",
 *   iol_type: "ACIOL"|"PCIOL"|null,
 *   incision: "Temporal Cornea"|"Superior Cornea"|null,
 *   also_used: ["Vision Blue", "Sutures", ...],
 *   complications: ["Post Capsular Rupture", ...],
 *   surgeon_id: number,
 *   surgeon_notes: string
 * }
 */
export async function POST(request, { params }) {
  return withDb(async (pool) => {
    const { id } = await params;
    const body = await request.json();
    const { eye, procedure_type, iol_type, incision, also_used, complications, surgeon_id, surgeon_notes } = body;

    if (!eye || !['left', 'right', 'both'].includes(eye)) {
      return Response.json({ error: 'Eye must be left, right, or both' }, { status: 400 });
    }
    if (!surgeon_id) {
      return Response.json({ error: 'Surgeon is required' }, { status: 400 });
    }

    // Check patient exists
    const [patients] = await pool.execute('SELECT id FROM patients WHERE id = ?', [id]);
    if (patients.length === 0) {
      return Response.json({ error: 'Patient not found' }, { status: 404 });
    }

    // Insert surgery record
    await pool.execute(
      `INSERT INTO surgery_records 
        (patient_id, eye, procedure_type, iol_type, incision, also_used, complications, surgeon_id, surgeon_notes) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        eye,
        JSON.stringify(procedure_type || []),
        JSON.stringify(iol_type || []),
        JSON.stringify(incision || []),
        JSON.stringify(also_used || []),
        JSON.stringify(complications || []),
        surgeon_id,
        surgeon_notes || null,
      ]
    );

    // Also mark the Surgery station as visited
    const [rows] = await pool.execute('SELECT stations_visited FROM patients WHERE id = ?', [id]);
    let stations = [];
    try {
      stations = Array.isArray(rows[0].stations_visited)
        ? rows[0].stations_visited
        : JSON.parse(rows[0].stations_visited || '[]');
    } catch { stations = []; }

    if (!stations.includes('Surgery')) {
      stations.push('Surgery');
      await pool.execute('UPDATE patients SET stations_visited = ? WHERE id = ?', [JSON.stringify(stations), id]);
    }

    return Response.json({ success: true });
  });
}
