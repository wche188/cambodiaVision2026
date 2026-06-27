import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock iron-session
const mockSession = {
  role: null,
  username: null,
  lastActive: null,
  destroy: vi.fn(),
  save: vi.fn(),
};

vi.mock('iron-session', () => ({
  getIronSession: vi.fn(() => mockSession),
}));

vi.mock('./lib/session', () => ({
  sessionOptions: {
    password: 'test-secret-at-least-32-chars-long!!',
    cookieName: 'cambodia_vision_session',
    cookieOptions: {
      secure: false,
      httpOnly: true,
      sameSite: 'strict',
      maxAge: 8 * 60 * 60,
    },
  },
}));

import { middleware, config } from './middleware.js';

function createRequest(pathname) {
  const url = `http://localhost:3000${pathname}`;
  return {
    nextUrl: new URL(url),
    url,
    cookies: {},
    headers: new Headers(),
  };
}

describe('middleware', () => {
  beforeEach(() => {
    mockSession.role = null;
    mockSession.username = null;
    mockSession.lastActive = null;
    mockSession.destroy.mockClear();
    mockSession.save.mockClear();
  });

  describe('public paths', () => {
    it('allows /login without session', async () => {
      const response = await middleware(createRequest('/login'));
      expect(response.status).toBe(200);
    });

    it('allows /api/auth/login without session', async () => {
      const response = await middleware(createRequest('/api/auth/login'));
      expect(response.status).toBe(200);
    });

    it('allows nested login paths like /login/reset', async () => {
      const response = await middleware(createRequest('/login/reset'));
      expect(response.status).toBe(200);
    });
  });

  describe('unauthenticated access', () => {
    it('redirects to /login when no session role', async () => {
      mockSession.role = null;
      const response = await middleware(createRequest('/'));
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain('/login');
    });

    it('redirects to /login for API routes without session', async () => {
      mockSession.role = null;
      const response = await middleware(createRequest('/api/patients'));
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain('/login');
    });
  });

  describe('authenticated access', () => {
    it('allows volunteer access to standard routes', async () => {
      mockSession.role = 'volunteer';
      mockSession.lastActive = Date.now();
      const response = await middleware(createRequest('/'));
      expect(response.status).toBe(200);
    });

    it('allows admin access to standard routes', async () => {
      mockSession.role = 'admin';
      mockSession.lastActive = Date.now();
      const response = await middleware(createRequest('/'));
      expect(response.status).toBe(200);
    });

    it('updates lastActive on each valid request', async () => {
      mockSession.role = 'volunteer';
      mockSession.lastActive = Date.now() - 1000;
      await middleware(createRequest('/'));
      expect(mockSession.lastActive).toBeCloseTo(Date.now(), -2);
      expect(mockSession.save).toHaveBeenCalled();
    });
  });

  describe('admin route protection', () => {
    it('returns 403 for volunteer accessing /admin', async () => {
      mockSession.role = 'volunteer';
      mockSession.lastActive = Date.now();
      const response = await middleware(createRequest('/admin'));
      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toBe('Forbidden');
    });

    it('returns 403 for volunteer accessing /api/admin paths', async () => {
      mockSession.role = 'volunteer';
      mockSession.lastActive = Date.now();
      const response = await middleware(createRequest('/api/admin/users'));
      expect(response.status).toBe(403);
    });

    it('allows admin access to /admin', async () => {
      mockSession.role = 'admin';
      mockSession.lastActive = Date.now();
      const response = await middleware(createRequest('/admin'));
      expect(response.status).toBe(200);
    });

    it('allows admin access to /api/admin paths', async () => {
      mockSession.role = 'admin';
      mockSession.lastActive = Date.now();
      const response = await middleware(createRequest('/api/admin/users'));
      expect(response.status).toBe(200);
    });
  });

  describe('8-hour inactivity timeout', () => {
    it('redirects to /login when lastActive exceeds 8 hours', async () => {
      mockSession.role = 'volunteer';
      mockSession.lastActive = Date.now() - (8 * 60 * 60 * 1000 + 1); // 8 hours + 1ms ago
      const response = await middleware(createRequest('/'));
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain('/login');
      expect(mockSession.destroy).toHaveBeenCalled();
    });

    it('allows access when lastActive is within 8 hours', async () => {
      mockSession.role = 'volunteer';
      mockSession.lastActive = Date.now() - (7 * 60 * 60 * 1000); // 7 hours ago
      const response = await middleware(createRequest('/'));
      expect(response.status).toBe(200);
    });

    it('allows access when lastActive is exactly 8 hours (boundary)', async () => {
      mockSession.role = 'volunteer';
      mockSession.lastActive = Date.now() - (8 * 60 * 60 * 1000); // Exactly 8 hours
      const response = await middleware(createRequest('/'));
      expect(response.status).toBe(200);
    });

    it('allows access when lastActive is null (first request after login)', async () => {
      mockSession.role = 'volunteer';
      mockSession.lastActive = null;
      const response = await middleware(createRequest('/'));
      expect(response.status).toBe(200);
    });
  });

  describe('matcher config', () => {
    it('has a matcher that excludes Next.js static files', () => {
      expect(config.matcher).toBeDefined();
      expect(config.matcher[0]).toContain('_next/static');
      expect(config.matcher[0]).toContain('_next/image');
      expect(config.matcher[0]).toContain('favicon.ico');
      expect(config.matcher[0]).toContain('logo.jpeg');
    });
  });
});
