import { getIronSession } from 'iron-session';
import { NextResponse } from 'next/server';
import { sessionOptions } from './lib/session';

const PUBLIC_PATHS = ['/login', '/api/auth/login'];
const ADMIN_PATHS = ['/admin', '/api/admin'];

// Paths volunteers are allowed to access
const VOLUNTEER_PATHS = [
  '/registration',
  '/patient',
  '/api/patients',
  '/api/auth/logout',
  '/api/auth/session',
  '/api/generate-pdf',
  '/api/stations',
];

// Paths station managers can access
const STATION_MANAGER_PATHS = [
  '/station',
  '/api/patients',
  '/api/auth/logout',
  '/api/auth/session',
  '/api/stations',
  '/api/surgeons',
];

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // Allow public paths through without authentication
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Create a response object so iron-session can write cookies to it
  const response = NextResponse.next();

  // Get session using iron-session v8 with request and response
  const session = await getIronSession(request, response, sessionOptions);

  // If no session role, redirect to login
  if (!session.role) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Check 8-hour inactivity timeout
  const now = Date.now();
  const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;
  if (session.lastActive && now - session.lastActive > EIGHT_HOURS_MS) {
    session.destroy();
    await session.save();
    // Build redirect and copy the cleared session cookie from the response
    const redirectResponse = NextResponse.redirect(new URL('/login', request.url));
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      redirectResponse.headers.set('set-cookie', setCookie);
    }
    return redirectResponse;
  }

  // Check admin paths: enforce admin role
  if (ADMIN_PATHS.some(p => pathname.startsWith(p)) && session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Station managers can only access scan page and station API
  if (session.role === 'station_manager') {
    const isAllowed = STATION_MANAGER_PATHS.some(p => pathname.startsWith(p));
    if (!isAllowed && pathname !== '/') {
      return NextResponse.redirect(new URL('/station', request.url));
    }
    if (pathname === '/') {
      return NextResponse.redirect(new URL('/station', request.url));
    }
  }

  // Volunteers can only access registration and dashboard paths
  if (session.role === 'volunteer') {
    const isAllowed = VOLUNTEER_PATHS.some(p => pathname.startsWith(p));
    if (!isAllowed && pathname !== '/') {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  // Update lastActive timestamp and save session
  session.lastActive = now;
  await session.save();

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo.jpeg).*)'],
};
