import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { withDb } from '@/lib/mysql';

/**
 * PATCH /api/admin/passphrase — Change shared volunteer passphrase
 * Body: { passphrase }
 */
export async function PATCH(request) {
  return withDb(async (pool) => {
    const body = await request.json();
    const { passphrase } = body;

    if (!passphrase || (typeof passphrase === 'string' && !passphrase.trim())) {
      return NextResponse.json(
        { error: 'Passphrase is required' },
        { status: 400 }
      );
    }

    // Hash the new passphrase with bcrypt (10 rounds)
    const hash = await bcrypt.hash(passphrase.trim(), 10);

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
