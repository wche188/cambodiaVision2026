import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';

export const sessionOptions = {
  password: process.env.SESSION_SECRET, // min 32 chars
  cookieName: 'cambodia_vision_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 8 * 60 * 60, // 8 hours (28800 seconds)
  },
};

/**
 * Get the current session from cookies.
 *
 * Session data shape:
 * {
 *   role: 'volunteer' | 'admin',
 *   username: string | null,   // null for volunteers
 *   lastActive: number,        // Unix timestamp for inactivity timeout
 * }
 */
export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession(cookieStore, sessionOptions);
}
