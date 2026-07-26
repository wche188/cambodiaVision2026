// app/api/auth/login/route.js
import bcrypt from 'bcryptjs';
import { checkRateLimit, resetRateLimit } from '@/lib/rate-limit';
import { getSession } from '@/lib/session';
import { withDb } from '@/lib/mysql';

// Admin login rate limit is per-username (one fat-fingered admin doesn't
// lock out other admins). Volunteer limit is a single shared bucket (the
// passphrase is shared, so we can't key per-volunteer).
const adminKey = (u) => `admin:${(u || '').toLowerCase()}`;
const VOL_KEY = 'volunteer';

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { type } = body;

  if (type === 'volunteer') return handleVolunteerLogin(body);
  if (type === 'admin') return handleAdminLogin(body);

  return Response.json({ error: 'Invalid login type' }, { status: 400 });
}

// Wrap a response with rate-limit headers (successes also report counters).
function rlHeaders(limit, remaining) {
  return {
    'X-RateLimit-Limit': String(limit),
    'X-RateLimit-Remaining': String(remaining),
  };
}

// Returns a 429 Response if the limit is now blocked, otherwise null.
// note: checkRateLimit() increments the counter on every call — that's the
// caller's responsibility to manage.
function gateOnFailure(key) {
  const r = checkRateLimit(key);
  if (!r.allowed) {
    return Response.json(
      { error: 'Too many login attempts. Please wait before retrying.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(r.retryAfter),
          'X-RateLimit-Limit': '10',
          'X-RateLimit-Remaining': '0',
        },
      }
    );
  }
  return null;
}

async function handleVolunteerLogin({ passphrase }) {
  if (!passphrase) {
    return Response.json({ error: 'Passphrase is required' }, { status: 400 });
  }

  return withDb(async (pool) => {
    const [rows] = await pool.execute(
      'SELECT config_value FROM system_config WHERE config_key = ?',
      ['shared_passphrase']
    );
    if (rows.length === 0) {
      // Don't reveal that system_config is empty — treat as invalid creds
      const blocked = gateOnFailure(VOL_KEY);
      if (blocked) return blocked;
      return Response.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const storedHash = rows[0].config_value;
    const isValid = await bcrypt.compare(passphrase, storedHash);
    if (!isValid) {
      const blocked = gateOnFailure(VOL_KEY);
      if (blocked) return blocked;
      return Response.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const session = await getSession();
    session.role = 'volunteer';
    session.username = null;
    session.lastActive = Date.now();
    await session.save();
    resetRateLimit(VOL_KEY);

    return Response.json(
      { message: 'Login successful', role: 'volunteer' },
      { status: 200, headers: rlHeaders(10, 10) }
    );
  });
}

async function handleAdminLogin({ username, password }) {
  if (!username || !password) {
    return Response.json({ error: 'Username and password are required' }, { status: 400 });
  }

  return withDb(async (pool) => {
    const [rows] = await pool.execute(
      'SELECT * FROM admin_users WHERE username = ?',
      [username]
    );
    if (rows.length === 0) {
      const blocked = gateOnFailure(adminKey(username));
      if (blocked) return blocked;
      return Response.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const user = rows[0];
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      const blocked = gateOnFailure(adminKey(username));
      if (blocked) return blocked;
      return Response.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const session = await getSession();
    session.role = user.role || 'admin';
    session.username = username;
    session.assignedStation = user.assigned_station || null;
    session.lastActive = Date.now();
    await session.save();
    resetRateLimit(adminKey(username));

    return Response.json(
      {
        message: 'Login successful',
        role: user.role || 'admin',
        username,
        assignedStation: user.assigned_station || null,
      },
      { status: 200, headers: rlHeaders(10, 10) }
    );
  });
}