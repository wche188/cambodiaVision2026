import { withDb } from '@/lib/mysql';
import { getSession } from '@/lib/session';

const MAX_BODY = 8000;

/**
 * PATCH /api/patients/[id]/notes/[noteId]
 *   Edit a note's body.
 *   Allowed: admin, OR the original author of the note.
 *
 * DELETE /api/patients/[id]/notes/[noteId]
 *   Delete a note.
 *   Allowed: admin only.
 */
export async function PATCH(request, { params }) {
  return withDb(async (db) => {
    const { id, noteId } = await params;
    const session = await getSession(request);
    if (!session) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const [rows] = await db.execute(
      'SELECT id, patient_id, body, created_by FROM patient_notes WHERE id = ? AND patient_id = ?',
      [noteId, id]
    );
    if (rows.length === 0) {
      return Response.json({ error: 'Note not found' }, { status: 404 });
    }
    const note = rows[0];

    const isAdmin = session.role === 'admin';
    const isAuthor = (session.username || '') === note.created_by;
    if (!isAdmin && !isAuthor) {
      return Response.json(
        { error: 'Only the author or an admin can edit this note' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const text = (body?.body ?? '').toString().trim();
    if (!text) {
      return Response.json({ error: 'body is required' }, { status: 400 });
    }
    if (text.length > MAX_BODY) {
      return Response.json({ error: `Note too long (max ${MAX_BODY} chars)` }, { status: 400 });
    }

    const editor = session.username || 'unknown';
    await db.execute(
      'UPDATE patient_notes SET body = ?, updated_by = ? WHERE id = ?',
      [text, editor, noteId]
    );

    const [updated] = await db.execute(
      'SELECT id, patient_id, body, created_by, created_at, updated_at, updated_by FROM patient_notes WHERE id = ?',
      [noteId]
    );
    return Response.json({ data: updated[0] });
  });
}

export async function DELETE(request, { params }) {
  return withDb(async (db) => {
    const { id, noteId } = await params;
    const session = await getSession(request);
    if (!session) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }
    if (session.role !== 'admin') {
      return Response.json({ error: 'Only admin can delete notes' }, { status: 403 });
    }

    const [rows] = await db.execute(
      'SELECT id FROM patient_notes WHERE id = ? AND patient_id = ?',
      [noteId, id]
    );
    if (rows.length === 0) {
      return Response.json({ error: 'Note not found' }, { status: 404 });
    }

    await db.execute('DELETE FROM patient_notes WHERE id = ?', [noteId]);
    return Response.json({ data: { id: Number(noteId), deleted: true } });
  });
}
