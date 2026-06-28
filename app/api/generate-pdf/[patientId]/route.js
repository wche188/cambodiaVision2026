import { withDb } from '@/lib/mysql';
import { getSession } from '@/lib/session';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import QRCode from 'qrcode';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * GET /api/generate-pdf/[patientId]?type=registration|surgery
 *
 * Generates a .docx file from the Cambodia Vision clinical templates.
 * Registration form: available to all authenticated users.
 * Surgery form: restricted to admin and station_manager only.
 */
export async function GET(request, { params }) {
  return withDb(async (pool) => {
    const { patientId } = await params;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    if (!type || !['registration', 'surgery'].includes(type)) {
      return Response.json(
        { error: 'Invalid or missing type parameter. Use ?type=registration or ?type=surgery' },
        { status: 400 }
      );
    }

    // Surgery form restricted to admin and station_manager
    if (type === 'surgery') {
      const session = await getSession();
      if (session.role !== 'admin' && session.role !== 'station_manager') {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const [patients] = await pool.execute(
      'SELECT * FROM patients WHERE id = ?',
      [patientId]
    );

    if (patients.length === 0) {
      return Response.json({ error: 'Patient not found' }, { status: 404 });
    }

    const patient = patients[0];

    // Mark form as printed
    if (type === 'registration' && !patient.form_printed) {
      await pool.execute(
        "UPDATE patients SET form_printed = 1, status = 'Form_Printed' WHERE id = ? AND status = 'Registered'",
        [patientId]
      );
    }

    const templateName = type === 'registration'
      ? 'registration_template.docx'
      : 'surgery_template.docx';

    let templateBuffer;
    try {
      const templatePath = join(process.cwd(), 'public', 'templates', templateName);
      templateBuffer = readFileSync(templatePath);
    } catch {
      return Response.json({ error: `Template file not found: ${templateName}` }, { status: 500 });
    }

    // Generate QR code as PNG buffer
    const patientNumber = patient.patient_number || '0000';
    let qrPngBuffer = null;
    try {
      qrPngBuffer = await QRCode.toBuffer(patientNumber, {
        width: 150,
        margin: 1,
        errorCorrectionLevel: 'M',
      });
    } catch { /* continue without QR */ }

    // Load and render the template (text placeholders only)
    const zip = new PizZip(templateBuffer);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => '',
    });

    let templateData;
    if (type === 'registration') {
      templateData = {
        patient_number: patientNumber,
        family_name: patient.family_name || '',
        given_name: patient.given_name || '',
        gender: patient.gender || 'Male',
        age: patient.age != null ? String(patient.age) : '',
        has_tb: patient.has_tb ? 'Yes' : 'No',
        blood_group: patient.blood_group || 'N/A',
        is_pregnant: normalizeYesNo(patient.is_pregnant),
        province: patient.province || '',
        district: patient.district || '',
        village: patient.village || '',
        commune: patient.commune || '',
        contact_phone: patient.contact_phone || '',
        registration_date: patient.registration_date
          ? new Date(patient.registration_date).toLocaleDateString('en-GB')
          : new Date().toLocaleDateString('en-GB'),
        reason_for_visit: patient.reason_for_visit || '',
      };
    } else {
      templateData = {
        patient_number: patientNumber,
        family_name: patient.family_name || '',
        given_name: patient.given_name || '',
      };
    }

    doc.setData(templateData);
    doc.render();

    // Get the rendered zip
    const renderedZip = doc.getZip();

    // Inject QR code image into the docx
    if (qrPngBuffer && type === 'registration') {
      injectQRCodeIntoDocx(renderedZip, qrPngBuffer);
    }

    const output = renderedZip.generate({ type: 'nodebuffer' });

    const fileName = `${patient.family_name || 'Patient'}-${patientNumber}-${type === 'registration' ? 'Registration' : 'Surgery'}.docx`;

    return new Response(output, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': output.length.toString(),
      },
    });
  });
}

/**
 * Inject a QR code PNG image into the docx at the beginning of the document.
 * Adds the image to the media folder and inserts an inline drawing element
 * at the start of the document body.
 */
function injectQRCodeIntoDocx(zip, qrPngBuffer) {
  // 1. Add the image file to the zip
  zip.file('word/media/qrcode.png', qrPngBuffer);

  // 2. Add relationship for the image
  let relsContent = zip.file('word/_rels/document.xml.rels').asText();
  const rId = 'rIdQR1';
  const newRel = `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/qrcode.png"/>`;
  relsContent = relsContent.replace('</Relationships>', newRel + '</Relationships>');
  zip.file('word/_rels/document.xml.rels', relsContent);

  // 3. Insert the image into the document body (at the beginning, before first paragraph)
  let docContent = zip.file('word/document.xml').asText();

  // Image size: 3cm x 3cm (EMUs: 1cm = 360000 EMU)
  const cx = 1080000; // 3cm
  const cy = 1080000; // 3cm

  // Position: top-left corner, behind text so no overlap, no extra paragraph
  const imageXml = `<w:r><w:drawing><wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="251659264" behindDoc="1" locked="0" layoutInCell="1" allowOverlap="1"><wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="page"><wp:posOffset>180000</wp:posOffset></wp:positionH><wp:positionV relativeFrom="page"><wp:posOffset>180000</wp:posOffset></wp:positionV><wp:extent cx="${cx}" cy="${cy}"/><wp:wrapNone/><wp:docPr id="99" name="QR Code"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="99" name="qrcode.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="${rId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:anchor></w:drawing></w:r>`;

  // Insert into the first paragraph (no extra line)
  const bodyTag = '<w:body>';
  const bodyIdx = docContent.indexOf(bodyTag);
  if (bodyIdx >= 0) {
    // Find the first <w:r> in the first paragraph and insert before it
    const firstPara = docContent.indexOf('<w:p ', bodyIdx);
    const firstRun = docContent.indexOf('<w:r', firstPara);
    if (firstRun >= 0) {
      docContent = docContent.slice(0, firstRun) + imageXml + docContent.slice(firstRun);
    }
  }

  // 4. Ensure the wp namespace is declared
  if (!docContent.includes('xmlns:wp=')) {
    docContent = docContent.replace(
      '<w:document ',
      '<w:document xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" '
    );
  }

  zip.file('word/document.xml', docContent);

  // 5. Ensure [Content_Types].xml has png type
  let contentTypes = zip.file('[Content_Types].xml').asText();
  if (!contentTypes.includes('Extension="png"')) {
    contentTypes = contentTypes.replace(
      '</Types>',
      '<Default Extension="png" ContentType="image/png"/></Types>'
    );
    zip.file('[Content_Types].xml', contentTypes);
  }
}

function normalizeYesNo(value) {
  if (value === null || value === undefined || value === '') return 'No';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  const str = String(value).toLowerCase().trim();
  if (str === 'yes' || str === 'true' || str === '1') return 'Yes';
  return 'No';
}
