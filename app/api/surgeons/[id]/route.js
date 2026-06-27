import { withDb } from '@/lib/mysql';

/**
 * DELETE /api/surgeons/[id] — deactivate a surgeon
 */
export async function DELETE(request, { params }) {
  return withDb(async (pool) => {
    const { id } = await params;
    await pool.execute('UPDATE surgeons SET active = 0 WHERE id = ?', [id]);
    return Response.json({ success: true });
  });
}
