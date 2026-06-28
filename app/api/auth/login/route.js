// app/api/auth/login/route.js
import bcrypt from 'bcryptjs';
import { checkRateLimit, resetRateLimit } from '@/lib/rate-limit';
import { getSession } from '@/lib/session';
import { withDb } from '@/lib/mysql';

// LAN deployment: don't trust X-Forwarded-For (spoofable). Use a generic key.
const RATE_LIMIT_KEY = 'client';

export async function POST(request) {
  // Check rate limit before any authentication attempt
  const rateLimit = checkRateLimit(RATE_LIMIT_KEY);
  if (!rateLimit.allowed) {
    return Response.json(
      { error: 'Too many login attempts. Please wait before retrying.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(rateLimit.retryAfter),
          'X-RateLimit-Limit': '10',
          'X-RateLimit-Remaining': '0',
        },
      }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }

  const { type } = body;

  if (type === 'volunteer') {
    return handleVolunteerLogin(body);
  } else if (type === 'admin') {
    return handleAdminLogin(body);
  } else {
    return Response.json(
      { error: 'Invalid login type' },
      { status: 400 }
    );
  }
}

async function handleVolunteerLogin({ passphrase }) {
  if (!passphrase) {
    return Response.json(
      { error: 'Passphrase is required' },
      { status: 400 }
    );
  }

  return withDb(async (pool) => {
    const [rows] = await pool.execute(
      'SELECT config_value FROM system_config WHERE config_key = ?',
      ['shared_passphrase']
    );

    if (rows.length === 0) {
      return Response.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const storedHash = rows[0].config_value;
    const isValid = await bcrypt.compare(passphrase, storedHash);

    if (!isValid) {
      return Response.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const session = await getSession();
    session.role = 'volunteer';
    session.username = null;
    session.lastActive = Date.now();
    await session.save();

    // Successful login — clear the rate limit
    resetRateLimit(RATE_LIMIT_KEY);

    return Response.json(
      { message: 'Login successful', role: 'volunteer' },
      { status: 200 }
    );
  });
}

async function handleAdminLogin({ username, password }) {
  if (!username || !password) {
    return Response.json(
      { error: 'Username and password are required' },
      { status: 400 }
    );
  }

  return withDb(async (pool) => {
    const [rows] = await pool.execute(
      'SELECT * FROM admin_users WHERE username = ?',
      [username]
    );

    if (rows.length === 0) {
      return Response.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const user = rows[0];
    const isValid = await bcrypt.compare(password, user.password_hash);

    if (!isValid) {
      return Response.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const session = await getSession();
    session.role = user.role || 'admin';
    session.username = username;
    session.assignedStation = user.assigned_station || null;
    session.lastActive = Date.now();
    await session.save();

    // Successful login — clear the rate limit
    resetRateLimit(RATE_LIMIT_KEY);

    return Response.json(
      { message: 'Login successful', role: user.role || 'admin', username, assignedStation: user.assigned_station || null },
      { status: 200 }
    );
  });
}
