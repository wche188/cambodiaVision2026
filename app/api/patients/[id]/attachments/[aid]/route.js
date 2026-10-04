import { withDb } from '@/lib/mysql';
import { getSession } from '@/lib/session';

/**
 * GET /api/patients/[id]/attachments/[aid]
 * Download a single attachment. Returns the raw bytes with Content-Disposition.
 * All authenticated roles can download.
 */
export async function GET(_request, { params }) {
  return withDb(async (pool) => {
    const { id, aid } = await params;
    const session = await getSession();
    if (!session || !session.role) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [rows] = await pool.execute(
      'SELECT * FROM patient_attachments WHERE id = ? AND patient_id = ?',
      [aid, id]
    );
    if (rows.length === 0) {
      return Response.json({ error: 'Attachment not found' }, { status: 404 });
    }

    const att = rows[0];
    const buffer = Buffer.from(att.data, 'base64');

    // Build a safe Content-Disposition with both filename and filename* (RFC 5987)
    const safe = String(att.file_name).replace(/"/g, '');
    const encoded = encodeURIComponent(att.file_name);

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': att.mime_type || 'application/octet-stream',
        'Content-Length': String(buffer.length),
        'Content-Disposition': `attachment; filename="${safe}"; filename*=UTF-8''${encoded}`,
        'Cache-Control': 'private, max-age=0, no-cache',
      },
    });
  });
}

/**
 * PATCH /api/patients/[id]/attachments/[aid]
 * Edit the note (and only the note) on an attachment. Admin OR the
 * original uploader of the attachment.
 * Body: { note: string|null }
 */
export async function PATCH(request, { params }) {
  return withDb(async (pool) => {
    const { id, aid } = await params;
    const session = await getSession();
    if (!session || !session.role) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [existing] = await pool.execute(
      'SELECT id, patient_id, uploaded_by FROM patient_attachments WHERE id = ? AND patient_id = ?',
      [aid, id]
    );
    if (existing.length === 0) {
      return Response.json({ error: 'Attachment not found' }, { status: 404 });
    }

    const isAdmin = session.role === 'admin';
    const isUploader = (session.username || '') === existing[0].uploaded_by;
    if (!isAdmin && !isUploader) {
      return Response.json(
        { error: 'Forbidden — only the uploader or an admin can edit this attachment' },
        { status: 403 }
      );
    }

    const body = await request.json();
    if (typeof body.note !== 'string' && body.note !== null) {
      return Response.json({ error: 'note must be a string or null' }, { status: 400 });
    }

    const note = body.note === null ? null : String(body.note).slice(0, 4000);

    await pool.execute(
      'UPDATE patient_attachments SET note = ? WHERE id = ?',
      [note, aid]
    );

    return Response.json({
      data: { id: Number(aid), patient_id: Number(id), note },
      error: null,
    });
  });
}

/**
 * DELETE /api/patients/[id]/attachments/[aid]
 * Delete an attachment. Admin OR the original uploader.
 */
export async function DELETE(_request, { params }) {
  return withDb(async (pool) => {
    const { id, aid } = await params;
    const session = await getSession();
    if (!session || !session.role) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [existing] = await pool.execute(
      'SELECT id, uploaded_by FROM patient_attachments WHERE id = ? AND patient_id = ?',
      [aid, id]
    );
    if (existing.length === 0) {
      return Response.json({ error: 'Attachment not found' }, { status: 404 });
    }

    const isAdmin = session.role === 'admin';
    const isUploader = (session.username || '') === existing[0].uploaded_by;
    if (!isAdmin && !isUploader) {
      return Response.json(
        { error: 'Forbidden — only the uploader or an admin can delete this attachment' },
        { status: 403 }
      );
    }

    await pool.execute('DELETE FROM patient_attachments WHERE id = ?', [aid]);

    return Response.json({ data: { deleted: true, id: Number(aid) }, error: null });
  });
}
