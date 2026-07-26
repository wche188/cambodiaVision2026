import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || 'localhost',
  port: process.env.MYSQL_PORT || 3306,
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'cambodia_vision',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

/**
 * Wraps a database handler with connection error handling.
 * Catches ECONNREFUSED and PROTOCOL_CONNECTION_LOST errors and returns HTTP 503.
 * Re-throws all other errors.
 *
 * @param {function} handler - Async function that receives the pool as its argument
 * @returns {Promise<Response>} The handler's response or a 503 error response
 */
export async function withDb(handler) {
  try {
    return await handler(pool);
  } catch (error) {
    if (
      error.code === 'ECONNREFUSED' ||
      error.code === 'PROTOCOL_CONNECTION_LOST'
    ) {
      return Response.json(
        { error: 'Service temporarily unavailable' },
        { status: 503 }
      );
    }
    throw error;
  }
}

export default pool;
