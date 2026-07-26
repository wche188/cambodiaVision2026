import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { withDb } from '@/lib/mysql';
import { getSession } from '@/lib/session';

/**
 * GET /api/admin/users — List all admin users (without password_hash)
 */
export async function GET() {
  return withDb(async (pool) => {
    const [rows] = await pool.query(
      'SELECT id, username, full_name, role, assigned_station, created_at FROM admin_users ORDER BY created_at DESC'
    );
    return NextResponse.json({ data: rows });
  });
}

/**
 * POST /api/admin/users — Create a new admin/station_manager user
 * Requires current admin password confirmation to prevent session-hijack escalation.
 * Body: {
 *   username:           string, required
 *   password:           string, required
 *   full_name:          string, optional
 *   role:               'admin' | 'station_manager', optional (defaults to 'admin')
 *   assigned_station:   string, optional (required when role='station_manager')
 *   confirm_password:   string, required — current admin's own password (re-auth)
 * }
 */
export async function POST(request) {
  return withDb(async (pool) => {
    const session = await getSession();
    const body = await request.json();
    const {
      username,
      password,
      full_name,
      role,
      assigned_station,
      confirm_password,
    } = body;

    // Require current admin password confirmation (in body, NOT header)
    if (!confirm_password) {
      return NextResponse.json(
        { error: 'Your current password is required to create a user' },
        { status: 400 }
      );
    }

    // Verify the current admin's password
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

    // Validate required fields
    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    // Validate role (allow null/undefined for backward compat; default 'admin')
    const finalRole = role || 'admin';
    if (!['admin', 'station_manager'].includes(finalRole)) {
      return NextResponse.json(
        { error: 'role must be "admin" or "station_manager"' },
        { status: 400 }
      );
    }

    // Validate assigned_station when role=station_manager
    const finalStation =
      finalRole === 'station_manager' ? assigned_station || null : null;
    if (finalRole === 'station_manager' && !finalStation) {
      return NextResponse.json(
        { error: 'assigned_station is required when role is "station_manager"' },
        { status: 400 }
      );
    }

    // Check for duplicate username
    const [existing] = await pool.query(
      'SELECT id FROM admin_users WHERE username = ?',
      [username]
    );

    if (existing.length > 0) {
      return NextResponse.json(
        { error: 'Username already exists' },
        { status: 409 }
      );
    }

    // Hash password with bcrypt (10 rounds)
    const passwordHash = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
      'INSERT INTO admin_users (username, password_hash, full_name, role, assigned_station) VALUES (?, ?, ?, ?, ?)',
      [username.trim(), passwordHash, full_name ? full_name.trim() : null, finalRole, finalStation]
    );

    return NextResponse.json(
      {
        data: {
          id: result.insertId,
          username: username.trim(),
          full_name: full_name ? full_name.trim() : null,
          role: finalRole,
          assigned_station: finalStation,
        },
      },
      { status: 201 }
    );
  });
}
