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
 */
export async function DELETE(request, { params }) {
  const { id } = await params;

  return withDb(async (pool) => {
    const [result] = await pool.query(
      'DELETE FROM admin_users WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: 'User deleted' });
  });
}
