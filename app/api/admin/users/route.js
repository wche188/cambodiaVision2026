import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { withDb } from '@/lib/mysql';

/**
 * GET /api/admin/users — List all admin users (without password_hash)
 */
export async function GET() {
  return withDb(async (pool) => {
    const [rows] = await pool.query(
      'SELECT id, username, full_name, created_at FROM admin_users ORDER BY created_at DESC'
    );
    return NextResponse.json({ data: rows });
  });
}

/**
 * POST /api/admin/users — Create a new admin user
 * Body: { username, password, full_name }
 */
export async function POST(request) {
  return withDb(async (pool) => {
    const body = await request.json();
    const { username, password, full_name } = body;

    // Validate required fields
    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
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
      'INSERT INTO admin_users (username, password_hash, full_name) VALUES (?, ?, ?)',
      [username.trim(), passwordHash, full_name ? full_name.trim() : null]
    );

    return NextResponse.json(
      {
        data: {
          id: result.insertId,
          username: username.trim(),
          full_name: full_name ? full_name.trim() : null,
        },
      },
      { status: 201 }
    );
  });
}
