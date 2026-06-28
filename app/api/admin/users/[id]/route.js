import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { withDb } from '@/lib/mysql';

/**
 * PATCH /api/admin/users/[id] — Update an admin user
 * Body: { full_name?, password? }
 */
export async function PATCH(request, { params }) {
  const { id } = await params;

  return withDb(async (pool) => {
    const body = await request.json();
    const { full_name, password } = body;

    // Check user exists
    const [existing] = await pool.query(
      'SELECT id FROM admin_users WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const updates = [];
    const values = [];

    if (full_name !== undefined) {
      updates.push('full_name = ?');
      values.push(full_name ? full_name.trim() : null);
    }

    if (password) {
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

    // Return updated user
    const [updated] = await pool.query(
      'SELECT id, username, full_name, created_at FROM admin_users WHERE id = ?',
      [id]
    );

    return NextResponse.json({ data: updated[0] });
  });
}

/**
 * DELETE /api/admin/users/[id] — Delete an admin user
 * Guards: cannot delete yourself, cannot delete last admin
 */
export async function DELETE(request, { params }) {
  const { id } = await params;

  return withDb(async (pool) => {
    // Check user exists and get their info
    const [userRows] = await pool.query(
      'SELECT id, username, role FROM admin_users WHERE id = ?',
      [id]
    );

    if (userRows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const targetUser = userRows[0];

    // Get current session to prevent self-deletion
    const { getSession } = await import('@/lib/session');
    const session = await getSession();

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
