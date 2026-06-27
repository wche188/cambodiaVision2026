import { withDb } from '@/lib/mysql';

export async function GET(request) {
  return withDb(async (pool) => {
    const { searchParams } = new URL(request.url);
    const dateOffset = searchParams.get('dateOffset');

    // If dateOffset is provided, return daily data
    if (dateOffset !== null) {
      const offset = parseInt(dateOffset, 10) || 0;
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + offset);
      const dateStr = targetDate.toISOString().split('T')[0];

      const [anaesthesiaRows] = await pool.execute(
        'SELECT COUNT(*) as count FROM patients WHERE anaesthesia_date = ?',
        [dateStr]
      );
      const [surgeryRows] = await pool.execute(
        'SELECT COUNT(*) as count FROM patients WHERE surgery_date = ?',
        [dateStr]
      );

      return Response.json({
        data: {
          anaesthesiaToday: Number(anaesthesiaRows[0].count),
          surgeryToday: Number(surgeryRows[0].count),
        },
        error: null,
      });
    }

    // Otherwise return full report data
    const [totalRows] = await pool.execute(
      'SELECT COUNT(*) as count FROM patients'
    );
    const totalRegistrations = Number(totalRows[0].count);

    const [maleRows] = await pool.execute(
      "SELECT COUNT(*) as count FROM patients WHERE gender = 'Male'"
    );
    const maleCount = Number(maleRows[0].count);

    const [femaleRows] = await pool.execute(
      "SELECT COUNT(*) as count FROM patients WHERE gender = 'Female'"
    );
    const femaleCount = Number(femaleRows[0].count);

    const [childRows] = await pool.execute(
      "SELECT COUNT(*) as count FROM patients WHERE gender = 'Child'"
    );
    const childCount = Number(childRows[0].count);

    const [anaesthesiaRows] = await pool.execute(
      'SELECT COUNT(*) as count FROM patients WHERE anaesthesia_date IS NOT NULL'
    );
    const anaesthesiaCount = Number(anaesthesiaRows[0].count);

    const [surgeryRows] = await pool.execute(
      'SELECT COUNT(*) as count FROM patients WHERE surgery_date IS NOT NULL'
    );
    const surgeryCount = Number(surgeryRows[0].count);

    return Response.json({
      data: {
        totalRegistrations,
        maleCount,
        femaleCount,
        childCount,
        anaesthesiaCount,
        surgeryCount,
      },
      error: null,
    });
  });
}
