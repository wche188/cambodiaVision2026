import { withDb } from '@/lib/mysql';
import { getSession } from '@/lib/session';

// Maximum number of additional image attachments per patient.
// (The patient photo itself does not count toward this limit.)
const MAX_ATTACHMENTS = 5;

// Whitelist of accepted MIME types. Only images (scans / photos).
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

// Max decoded size: 5 MB. Stored in DB longtext (≈ 33% base64 overhead = ~6.7 MB row).
const MAX_BYTES = 5 * 1024 * 1024;

// Convert a base64 data URL or raw base64 to a Buffer and metadata.
function decodeDataUrl(input) {
  if (typeof input !== 'string') {
    return { mime: null, buffer: null };
  }
  const match = input.match(/^data:([^;]+);base64,(.*)$/s);
  if (match) {
    return { mime: match[1], buffer: Buffer.from(match[2], 'base64') };
  }
  return { mime: null, buffer: Buffer.from(input, 'base64') };
}

function safeFileName(name) {
  if (!name || typeof name !== 'string') return 'attachment';
  // Strip path separators and control chars; cap length
  return name.replace(/[\/\\:\x00-\x1f]/g, '_').slice(0, 200) || 'attachment';
}

/**
 * GET /api/patients/[id]/attachments
 * List all attachments for a patient. All authenticated roles can list.
 */
export async function GET(_request, { params }) {
  return withDb(async (pool) => {
    const { id } = await params;
    const session = await getSession();
    if (!session || !session.role) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [patients] = await pool.execute('SELECT id FROM patients WHERE id = ?', [id]);
    if (patients.length === 0) {
      return Response.json({ error: 'Patient not found' }, { status: 404 });
    }

    const [rows] = await pool.execute(
      `SELECT id, patient_id, file_name, mime_type, size_bytes, category, note,
              uploaded_by, created_at, updated_at
       FROM patient_attachments
       WHERE patient_id = ?
       ORDER BY created_at DESC`,
      [id]
    );

    return Response.json({ data: rows, error: null });
  });
}

/**
 * POST /api/patients/[id]/attachments
 * Upload a new attachment. Admin and station_manager only.
 *
 * Body: { file_name, mime_type, data (base64 or data URL), category, note? }
 */
export async function POST(request, { params }) {
  return withDb(async (pool) => {
    const { id } = await params;
    const session = await getSession();
    if (!session || !session.role) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (session.role !== 'admin' && session.role !== 'station_manager') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const [patients] = await pool.execute('SELECT id FROM patients WHERE id = ?', [id]);
    if (patients.length === 0) {
      return Response.json({ error: 'Patient not found' }, { status: 404 });
    }

    const body = await request.json();
    const { mime_type, data, note, file_name: rawFileName } = body || {};

    if (!data) {
      return Response.json({ error: 'data is required' }, { status: 400 });
    }

    const decoded = decodeDataUrl(data);
    const mime = (mime_type || decoded.mime || 'application/octet-stream').toLowerCase();

    if (!ALLOWED_MIME.has(mime)) {
      return Response.json(
        { error: `Only image uploads are allowed (jpeg, png, webp). Got: ${mime}` },
        { status: 400 }
      );
    }

    if (decoded.buffer.length === 0) {
      return Response.json({ error: 'data is empty' }, { status: 400 });
    }
    if (decoded.buffer.length > MAX_BYTES) {
      return Response.json(
        { error: `File too large (${decoded.buffer.length} bytes). Max ${MAX_BYTES} bytes.` },
        { status: 413 }
      );
    }

    // Enforce the per-patient limit (5 additional image attachments).
    const [existing] = await pool.execute(
      'SELECT COUNT(*) AS cnt FROM patient_attachments WHERE patient_id = ?',
      [id]
    );
    if (Number(existing[0].cnt) >= MAX_ATTACHMENTS) {
      return Response.json(
        { error: `Maximum ${MAX_ATTACHMENTS} attachments per patient reached. Delete one to add another.` },
        { status: 409 }
      );
    }

    const fileName = safeFileName(rawFileName || 'attachment');
    const uploader = session.username || (session.role === 'volunteer' ? 'volunteer' : 'unknown');

    const [result] = await pool.execute(
      `INSERT INTO patient_attachments
         (patient_id, file_name, mime_type, size_bytes, data, category, note, uploaded_by)
       VALUES (?, ?, ?, ?, ?, 'other', ?, ?)`,
      [
        id,
        fileName,
        mime,
        decoded.buffer.length,
        decoded.buffer.toString('base64'),
        note ? String(note).slice(0, 4000) : null,
        uploader,
      ]
    );

    return Response.json({
      data: {
        id: result.insertId,
        patient_id: Number(id),
        file_name: fileName,
        mime_type: mime,
        size_bytes: decoded.buffer.length,
        note: note || null,
        uploaded_by: uploader,
      },
      error: null,
    });
  });
}
