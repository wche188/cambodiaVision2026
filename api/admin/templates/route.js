import { NextResponse } from 'next/server';
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

const TEMPLATES_DIR = join(process.cwd(), 'public', 'templates');

/**
 * GET /api/admin/templates
 * List available templates.
 */
export async function GET() {
  try {
    const files = readdirSync(TEMPLATES_DIR)
      .filter(f => f.endsWith('.docx') && !f.includes('backup'))
      .map(f => ({
        name: f,
        type: f.includes('surgery') ? 'surgery' : 'registration',
      }));
    return NextResponse.json({ data: files });
  } catch {
    return NextResponse.json({ data: [] });
  }
}

/**
 * POST /api/admin/templates
 * Upload a new template file.
 * Expects multipart form data with 'file' and 'type' (registration or surgery).
 */
export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const type = formData.get('type'); // 'registration' or 'surgery'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!type || !['registration', 'surgery'].includes(type)) {
      return NextResponse.json({ error: 'Type must be registration or surgery' }, { status: 400 });
    }

    if (!file.name.endsWith('.docx')) {
      return NextResponse.json({ error: 'File must be a .docx file' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Backup the current template
    const targetName = type === 'registration' ? 'registration_template.docx' : 'surgery_template.docx';
    const targetPath = join(TEMPLATES_DIR, targetName);

    try {
      const existing = readFileSync(targetPath);
      const backupName = `${type}_template_backup_${Date.now()}.docx`;
      writeFileSync(join(TEMPLATES_DIR, backupName), existing);
    } catch {
      // No existing file to backup
    }

    // Write the new template
    writeFileSync(targetPath, buffer);

    return NextResponse.json({
      message: `Template "${targetName}" updated successfully`,
      backup: true,
    });
  } catch (error) {
    console.error('Template upload error:', error);
    return NextResponse.json({ error: 'Failed to upload template' }, { status: 500 });
  }
}
