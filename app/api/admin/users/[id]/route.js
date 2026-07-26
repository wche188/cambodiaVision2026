import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { withDb } from '@/lib/mysql';
import { getSession } from '@/lib/session';

/**
 * PATCH /api/admin/users/[id] — Update an admin user
 *
 * Admin panel only exposes password changes (create/delete are DB-only).
 * Body: { password?, confirm_password }
 *
 * confirm_password = the CURRENT admin's own password (re-auth to mitigate
 * session hijack). Required for every call.
 */
export async function PATCH(request, { params }) {
  const { id } = await params;

  return withDb(async (pool) => {
    const session = await getSession();
    if (session.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { password, confirm_password } = body;

    // Re-auth: require the CURRENT admin's own password.
    // This blocks a hijacked admin session from changing passwords.
    if (!confirm_password) {
      return NextResponse.json(
        { error: 'confirm_password (your current password) is required' },
        { status: 400 }
      );
    }

    const [adminRows] = await pool.query(
      'SELECT password_hash FROM admin_users WHERE username = ?',
      [session.username]
    );
    if (adminRows.length === 0) {
      return NextResponse.json({ error: 'Session invalid' }, { status: 401 });
    }
    const reauth = await bcrypt.compare(confirm_password, adminRows[0].password_hash);
    if (!reauth) {
      return NextResponse.json(
        { error: 'Incorrect password' },
        { status: 403 }
      );
    }

    // Check target user exists
    const [existing] = await pool.query(
      'SELECT id FROM admin_users WHERE id = ?',
      [id]
    );
    if (existing.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const updates = [];
    const values = [];

    if (password) {
      if (password.length < 8) {
        return NextResponse.json(
          { error: 'Password must be at least 8 characters' },
          { status: 400 }
        );
      }
      const passwordHash = await bcrypt.hash(password, 10);
      updates.push('password_hash = ?');
      values.push(passwordHash);
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    values.push(id);
    await pool.query(
      `UPDATE admin_users SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    const [updated] = await pool.query(
      'SELECT id, username, full_name, role, assigned_station FROM admin_users WHERE id = ?',
      [id]
    );

    return NextResponse.json({ data: updated[0] });
  });
}

/**
 * DELETE /api/admin/users/[id] — Delete an admin user
 *
 * Not exposed in the admin UI. For emergencies only — direct DB access is
 * preferred for user lifecycle (see docs/OPERATIONS.md).
 *
 * Body: { confirm_password }
 * Guards: requires admin re-auth, cannot delete yourself, cannot delete last admin
 */
export async function DELETE(request, { params }) {
  const { id } = await params;

  return withDb(async (pool) => {
    const session = await getSession();
    if (session.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Require re-auth (same pattern as POST / PATCH)
    let body = {};
    try { body = await request.json(); } catch {}
    const { confirm_password } = body;
    if (!confirm_password) {
      return NextResponse.json(
        { error: 'confirm_password (your current password) is required' },
        { status: 400 }
      );
    }
    const [adminRows] = await pool.query(
      'SELECT password_hash FROM admin_users WHERE username = ?',
      [session.username]
    );
    if (adminRows.length === 0) {
      return NextResponse.json({ error: 'Session invalid' }, { status: 401 });
    }
    const reauth = await bcrypt.compare(confirm_password, adminRows[0].password_hash);
    if (!reauth) {
      return NextResponse.json({ error: 'Incorrect password' }, { status: 403 });
    }

    // Check user exists
    const [userRows] = await pool.query(
      'SELECT id, username, role FROM admin_users WHERE id = ?',
      [id]
    );
    if (userRows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const targetUser = userRows[0];

    if (targetUser.username === session.username) {
      return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 403 });
    }

    // Prevent deleting last admin
    if (targetUser.role === 'admin') {
      const [adminCount] = await pool.query(
        "SELECT COUNT(*) as cnt FROM admin_users WHERE role = 'admin'"
      );
      if (Number(adminCount[0].cnt) <= 1) {
        return NextResponse.json({ error: 'Cannot delete the last admin' }, { status: 400 });
      }
    }

    await pool.query('DELETE FROM admin_users WHERE id = ?', [id]);
    return NextResponse.json({ message: 'User deleted' });
  });
}
