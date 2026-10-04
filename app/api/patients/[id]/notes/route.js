import { withDb } from '@/lib/mysql';
import { getSession } from '@/lib/session';

const MAX_BODY = 8000;

/**
 * GET /api/patients/[id]/notes
 *   List all notes for a patient, newest first.
 *   Allowed: admin, station_manager, volunteer.
 *
 * POST /api/patients/[id]/notes
 *   Create a new note. body required.
 *   Allowed: admin, station_manager. Volunteer forbidden.
 */
export async function GET(request, { params }) {
  return withDb(async (db) => {
    const { id } = await params;

    const [rows] = await db.execute(
      'SELECT id, patient_id, body, created_by, created_at, updated_at, updated_by FROM patient_notes WHERE patient_id = ? ORDER BY created_at DESC',
      [id]
    );

    return Response.json({ data: rows });
  });
}

export async function POST(request, { params }) {
  return withDb(async (db) => {
    const { id } = await params;
    const session = await getSession(request);
    if (!session) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }
    if (session.role !== 'admin' && session.role !== 'station_manager') {
      return Response.json({ error: 'Only admin and station managers can add notes' }, { status: 403 });
    }

    // Make sure the patient exists
    const [exists] = await db.execute('SELECT id FROM patients WHERE id = ?', [id]);
    if (exists.length === 0) {
      return Response.json({ error: 'Patient not found' }, { status: 404 });
    }

    const body = await request.json();
    const text = (body?.body ?? '').toString().trim();
    if (!text) {
      return Response.json({ error: 'body is required' }, { status: 400 });
    }
    if (text.length > MAX_BODY) {
      return Response.json({ error: `Note too long (max ${MAX_BODY} chars)` }, { status: 400 });
    }

    const author = session.username || (session.role === 'volunteer' ? 'volunteer' : 'unknown');

    const [result] = await db.execute(
      'INSERT INTO patient_notes (patient_id, body, created_by) VALUES (?, ?, ?)',
      [id, text, author]
    );

    const [rows] = await db.execute(
      'SELECT id, patient_id, body, created_by, created_at, updated_at, updated_by FROM patient_notes WHERE id = ?',
      [result.insertId]
    );

    return Response.json({ data: rows[0] });
  });
}
