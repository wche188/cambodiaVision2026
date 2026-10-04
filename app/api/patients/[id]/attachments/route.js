import { withDb } from '@/lib/mysql';
import { getSession } from '@/lib/session';

// Maximum upload size: 5 MB as base64 (≈ 3.75 MB binary). Stored in DB longtext.
const MAX_BYTES = 5 * 1024 * 1024;

// Whitelist of accepted MIME types per category.
const ALLOWED_MIME = {
  document: new Set([
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/msword', // .doc
    'text/plain',
    'text/markdown',
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ]),
  note: new Set([
    'text/plain',
    'text/markdown',
  ]),
  other: new Set([
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/plain',
    'text/markdown',
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png',
    'image/webp',
  ]),
};

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
    const { mime_type, data, category: rawCategory, note, file_name: rawFileName } = body || {};

    if (!data) {
      return Response.json({ error: 'data is required' }, { status: 400 });
    }

    const category = ['document', 'note', 'other'].includes(rawCategory) ? rawCategory : 'document';
    const decoded = decodeDataUrl(data);
    const mime = (mime_type || decoded.mime || 'application/octet-stream').toLowerCase();

    if (!ALLOWED_MIME[category].has(mime)) {
      return Response.json(
        { error: `Mime type ${mime} not allowed for category ${category}` },
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

    const fileName = safeFileName(rawFileName || 'attachment');
    const uploader = session.username || (session.role === 'volunteer' ? 'volunteer' : 'unknown');

    const [result] = await pool.execute(
      `INSERT INTO patient_attachments
         (patient_id, file_name, mime_type, size_bytes, data, category, note, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        fileName,
        mime,
        decoded.buffer.length,
        decoded.buffer.toString('base64'),
        category,
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
        category,
        note: note || null,
        uploaded_by: uploader,
      },
      error: null,
    });
  });
}
