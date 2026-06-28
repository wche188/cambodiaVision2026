import { withDb } from '@/lib/mysql';
import { getSession } from '@/lib/session';
import bcrypt from 'bcryptjs';

/**
 * GET /api/admin/backup
 * Generates a SQL dump of all tables and downloads it.
 * Requires X-Confirm-Password header with admin's password for re-authentication.
 */
export async function GET(request) {
  const session = await getSession();
  if (!session?.username || session.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const confirmPwd = request.headers.get('x-confirm-password');
  if (!confirmPwd) {
    return Response.json(
      { error: 'Password confirmation required. Send X-Confirm-Password header.' },
      { status: 403 }
    );
  }

  return withDb(async (pool) => {
    // Verify password against admin_users table
    const [adminRows] = await pool.execute(
      'SELECT password_hash FROM admin_users WHERE username = ?',
      [session.username]
    );

    if (!adminRows.length || !(await bcrypt.compare(confirmPwd, adminRows[0].password_hash))) {
      return Response.json({ error: 'Invalid password' }, { status: 403 });
    }

    const tables = ['patients', 'admin_users', 'system_config', 'surgeons', 'surgery_records', 'station_status', 'status_history', 'gp_examinations', 'surgery_decisions'];

    let dump = `-- Cambodia Vision Database Backup\n-- Generated: ${new Date().toISOString()}\n\n`;
    dump += `SET FOREIGN_KEY_CHECKS=0;\n\n`;

    for (const table of tables) {
      try {
        // Get CREATE TABLE
        const [createResult] = await pool.execute(`SHOW CREATE TABLE ${table}`);
        if (createResult.length > 0) {
          dump += `DROP TABLE IF EXISTS \`${table}\`;\n`;
          dump += createResult[0]['Create Table'] + ';\n\n';
        }

        // Get data — redact sensitive fields
        const [rows] = await pool.execute(`SELECT * FROM ${table}`);
        if (rows.length > 0) {
          const columns = Object.keys(rows[0]);
          // Sensitive columns to redact
          const REDACT_COLUMNS = ['password_hash'];

          for (const row of rows) {
            const values = columns.map(col => {
              // Redact password hashes
              if (REDACT_COLUMNS.includes(col)) return "'<<REDACTED>>'";
              // Also redact system_config shared_passphrase value
              if (table === 'system_config' && col === 'config_value' && row['config_key'] === 'shared_passphrase') return "'<<REDACTED>>'";

              const val = row[col];
              if (val === null) return 'NULL';
              if (typeof val === 'number') return val;
              if (val instanceof Date) return `'${val.toISOString().slice(0, 19).replace('T', ' ')}'`;
              // Escape string
              const escaped = String(val).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
              return `'${escaped}'`;
            });
            dump += `INSERT INTO \`${table}\` (\`${columns.join('`, `')}\`) VALUES (${values.join(', ')});\n`;
          }
          dump += '\n';
        }
      } catch (err) {
        dump += `-- Error dumping ${table}: ${err.message}\n\n`;
      }
    }

    dump += `SET FOREIGN_KEY_CHECKS=1;\n`;

    const filename = `cambodia-vision-backup-${new Date().toISOString().split('T')[0]}.sql`;

    return new Response(dump, {
      status: 200,
      headers: {
        'Content-Type': 'application/sql',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  });
}
