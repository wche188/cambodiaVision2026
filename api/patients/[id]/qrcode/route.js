import QRCode from 'qrcode';
import { withDb } from '@/lib/mysql';

/**
 * GET /api/patients/[id]/qrcode
 * Returns a QR code PNG image for the patient number.
 */
export async function GET(request, { params }) {
  return withDb(async (pool) => {
    const { id } = await params;

    const [rows] = await pool.execute(
      'SELECT patient_number FROM patients WHERE id = ?',
      [id]
    );

    if (rows.length === 0) {
      return Response.json({ error: 'Patient not found' }, { status: 404 });
    }

    const patientNumber = rows[0].patient_number;

    // Generate QR code as PNG buffer
    const qrBuffer = await QRCode.toBuffer(patientNumber, {
      width: 200,
      margin: 1,
      errorCorrectionLevel: 'M',
    });

    return new Response(qrBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  });
}
