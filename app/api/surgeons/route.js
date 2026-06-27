import { withDb } from '@/lib/mysql';

/**
 * GET /api/surgeons — list active surgeons
 * POST /api/surgeons — add a new surgeon (admin only)
 * DELETE handled via /api/surgeons/[id]
 */
export async function GET() {
  return withDb(async (pool) => {
    const [rows] = await pool.execute(
      'SELECT id, name FROM surgeons WHERE active = 1 ORDER BY name'
    );
    return Response.json({ data: rows });
  });
}

export async function POST(request) {
  return withDb(async (pool) => {
    const { name } = await request.json();
    if (!name || !name.trim()) {
      return Response.json({ error: 'Name is required' }, { status: 400 });
    }
    const [result] = await pool.execute(
      'INSERT INTO surgeons (name) VALUES (?)',
      [name.trim()]
    );
    return Response.json({ data: { id: result.insertId, name: name.trim() } }, { status: 201 });
  });
}
