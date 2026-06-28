import { withDb } from '@/lib/mysql';

export async function GET(request) {
  return withDb(async (pool) => {
    const { searchParams } = new URL(request.url);
    const dateOffset = searchParams.get('dateOffset');

    // If dateOffset provided, return daily counts for the live section
    if (dateOffset !== null) {
      const offset = parseInt(dateOffset, 10) || 0;
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + offset);
      const dateStr = targetDate.toISOString().split('T')[0];

      const [regRows] = await pool.execute(
        'SELECT COUNT(*) as count FROM patients WHERE registration_date = ?',
        [dateStr]
      );
      const [surgeryRows] = await pool.execute(
        'SELECT COUNT(*) as count FROM patients WHERE surgery_date = ?',
        [dateStr]
      );

      return Response.json({
        data: {
          registrationsToday: Number(regRows[0].count),
          surgeryToday: Number(surgeryRows[0].count),
        },
        error: null,
      });
    }

    // Full report stats
    const [totalRows] = await pool.execute('SELECT COUNT(*) as count FROM patients');
    const totalRegistrations = Number(totalRows[0].count);

    const [maleRows] = await pool.execute("SELECT COUNT(*) as count FROM patients WHERE gender = 'Male'");
    const maleCount = Number(maleRows[0].count);

    const [femaleRows] = await pool.execute("SELECT COUNT(*) as count FROM patients WHERE gender = 'Female'");
    const femaleCount = Number(femaleRows[0].count);

    const [childRows] = await pool.execute("SELECT COUNT(*) as count FROM patients WHERE gender = 'Child'");
    const childCount = Number(childRows[0].count);

    // Count stations from stations_visited JSON
    const [allPatients] = await pool.execute('SELECT stations_visited FROM patients');
    let glassesCount = 0;
    let surgeryCount = 0;
    let earCount = 0;
    let doctorCount = 0;
    let optometryCount = 0;
    let refractionCount = 0;

    for (const row of allPatients) {
      let stations = [];
      try {
        stations = Array.isArray(row.stations_visited)
          ? row.stations_visited
          : JSON.parse(row.stations_visited || '[]');
      } catch { stations = []; }

      if (stations.includes('Glasses_Dispensed')) glassesCount++;
      if (stations.includes('Surgery')) surgeryCount++;
      if (stations.includes('Ear_Therapy')) earCount++;
      if (stations.includes('Doctor')) doctorCount++;
      if (stations.includes('Optometry')) optometryCount++;
      if (stations.includes('Refraction')) refractionCount++;
    }

    // Daily registration counts for line graph (last 14 days)
    const [dailyRows] = await pool.execute(
      `SELECT registration_date as date, COUNT(*) as count 
       FROM patients 
       WHERE registration_date >= DATE_SUB(CURDATE(), INTERVAL 14 DAY)
       GROUP BY registration_date 
       ORDER BY registration_date ASC`
    );
    const dailyRegistrations = dailyRows.map(row => ({
      date: row.date instanceof Date ? row.date.toISOString().split('T')[0] : String(row.date),
      count: Number(row.count),
    }));

    // Daily surgery counts for line graph
    const [dailySurgeryRows] = await pool.execute(
      `SELECT DATE(created_at) as date, COUNT(*) as count
       FROM surgery_records
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 14 DAY)
       GROUP BY DATE(created_at)
       ORDER BY date ASC`
    );
    const dailySurgeries = dailySurgeryRows.map(row => ({
      date: row.date instanceof Date ? row.date.toISOString().split('T')[0] : String(row.date),
      count: Number(row.count),
    }));

    // Daily station counts from status_history
    const [dailyStationRows] = await pool.execute(
      `SELECT DATE(changed_at) as date, to_status as station, COUNT(*) as count
       FROM status_history
       WHERE changed_at >= DATE_SUB(CURDATE(), INTERVAL 14 DAY)
       AND to_status LIKE 'Station:%'
       GROUP BY DATE(changed_at), to_status
       ORDER BY date ASC`
    );

    // Parse into per-station daily arrays
    const stationDailyMap = {};
    for (const row of dailyStationRows) {
      const date = row.date instanceof Date ? row.date.toISOString().split('T')[0] : String(row.date);
      const station = row.station.replace('Station: ', '');
      if (!stationDailyMap[date]) stationDailyMap[date] = {};
      stationDailyMap[date][station] = Number(row.count);
    }

    return Response.json({
      data: {
        totalRegistrations,
        maleCount,
        femaleCount,
        childCount,
        glassesCount,
        surgeryCount,
        earCount,
        doctorCount,
        optometryCount,
        refractionCount,
        dailyRegistrations,
        dailySurgeries,
        stationDailyMap,
      },
      error: null,
    });
  });
}
