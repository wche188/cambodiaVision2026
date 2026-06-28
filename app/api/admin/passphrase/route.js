import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { withDb } from '@/lib/mysql';
import { getSession } from '@/lib/session';

/**
 * PATCH /api/admin/passphrase — Change shared volunteer passphrase
 * Requires current admin password to prevent one-click sabotage from stolen session.
 * Body: { passphrase, confirm_password }
 */
export async function PATCH(request) {
  return withDb(async (pool) => {
    const session = await getSession();
    const body = await request.json();
    const { passphrase, confirm_password } = body;

    // Require admin password confirmation
    if (!confirm_password) {
      return NextResponse.json(
        { error: 'Your current password is required' },
        { status: 400 }
      );
    }

    // Verify admin's own password
    const [adminRows] = await pool.query(
      'SELECT password_hash FROM admin_users WHERE username = ?',
      [session.username]
    );
    if (adminRows.length === 0) {
      return NextResponse.json({ error: 'Session invalid' }, { status: 401 });
    }
    const isValid = await bcrypt.compare(confirm_password, adminRows[0].password_hash);
    if (!isValid) {
      return NextResponse.json({ error: 'Incorrect password' }, { status: 403 });
    }

    // Validate passphrase strength
    if (!passphrase || typeof passphrase !== 'string') {
      return NextResponse.json({ error: 'Passphrase is required' }, { status: 400 });
    }

    const trimmed = passphrase.trim();
    if (trimmed.length < 8) {
      return NextResponse.json(
        { error: 'Passphrase must be at least 8 characters' },
        { status: 400 }
      );
    }

    // Hash the new passphrase with bcrypt (10 rounds)
    const hash = await bcrypt.hash(trimmed, 10);

    // Upsert into system_config
    await pool.query(
      `INSERT INTO system_config (config_key, config_value) 
       VALUES ('shared_passphrase', ?) 
       ON DUPLICATE KEY UPDATE config_value = ?, updated_at = CURRENT_TIMESTAMP`,
      [hash, hash]
    );

    return NextResponse.json({ message: 'Passphrase updated successfully' });
  });
}
