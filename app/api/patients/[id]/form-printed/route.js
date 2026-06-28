import { withDb } from '@/lib/mysql';
import { getSession } from '@/lib/session';

/**
 * POST /api/patients/[id]/form-printed
 * Marks the patient's registration form as printed/downloaded.
 */
export async function POST(request, { params }) {
  const session = await getSession();
  if (session.role !== 'admin' && session.role !== 'station_manager') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  return withDb(async (pool) => {
    const { id } = await params;

    const [rows] = await pool.execute(
      'SELECT id FROM patients WHERE id = ?',
      [id]
    );

    if (rows.length === 0) {
      return Response.json({ error: 'Patient not found' }, { status: 404 });
    }

    await pool.execute(
      'UPDATE patients SET form_printed = 1, status = ? WHERE id = ? AND status = ?',
      ['Form_Printed', id, 'Registered']
    );

    return Response.json({ success: true });
  });
}
