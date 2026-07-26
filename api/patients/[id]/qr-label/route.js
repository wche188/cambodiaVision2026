import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import { withDb } from '@/lib/mysql';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * GET /api/patients/[id]/qr-label
 * Generates a small printable PDF with QR code, patient number, name, and logo.
 * Designed to be printed and attached to the registration form.
 */
export async function GET(request, { params }) {
  return withDb(async (pool) => {
    const { id } = await params;

    const [rows] = await pool.execute(
      'SELECT patient_number, family_name, given_name FROM patients WHERE id = ?',
      [id]
    );

    if (rows.length === 0) {
      return Response.json({ error: 'Patient not found' }, { status: 404 });
    }

    const patient = rows[0];
    const patientNumber = patient.patient_number;

    // Generate QR code as base64 PNG
    const qrDataUrl = await QRCode.toDataURL(patientNumber, {
      width: 300,
      margin: 1,
      errorCorrectionLevel: 'M',
    });

    // Create a small PDF (half A4 — label size)
    const doc = new jsPDF({ format: [105, 148] }); // A6 size
    const pageWidth = doc.internal.pageSize.getWidth();

    // Try to add logo
    try {
      const logoPath = join(process.cwd(), 'public', 'logo.jpeg');
      const logoData = readFileSync(logoPath).toString('base64');
      doc.addImage(logoData, 'JPEG', pageWidth / 2 - 12, 5, 24, 24);
    } catch { /* skip */ }

    // Title
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('CAMBODIA VISION 2026', pageWidth / 2, 33, { align: 'center' });

    // QR code
    const qrBase64 = qrDataUrl.replace(/^data:image\/png;base64,/, '');
    doc.addImage(qrBase64, 'PNG', pageWidth / 2 - 25, 38, 50, 50);

    // Patient number large
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text(`#${patientNumber}`, pageWidth / 2, 98, { align: 'center' });

    // Patient name
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`${patient.family_name} ${patient.given_name || ''}`.trim(), pageWidth / 2, 108, { align: 'center' });

    // Footer instruction
    doc.setFontSize(7);
    doc.setTextColor(128);
    doc.text('Scan this code at each station', pageWidth / 2, 120, { align: 'center' });

    const pdfOutput = doc.output('arraybuffer');
    const buffer = Buffer.from(pdfOutput);

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="QR-${patientNumber}.pdf"`,
        'Content-Length': buffer.length.toString(),
      },
    });
  });
}
