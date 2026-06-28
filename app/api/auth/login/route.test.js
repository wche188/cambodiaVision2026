import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(),
}));

vi.mock('@/lib/session', () => ({
  getSession: vi.fn(),
}));

vi.mock('@/lib/mysql', () => ({
  withDb: vi.fn((handler) => handler(mockPool)),
}));

vi.mock('bcryptjs', () => ({
  default: { compare: vi.fn() },
}));

const mockPool = {
  execute: vi.fn(),
};

import { POST } from './route.js';
import { checkRateLimit } from '@/lib/rate-limit';
import { getSession } from '@/lib/session';
import bcrypt from 'bcryptjs';

function makeRequest(body, headers = {}) {
  return {
    json: () => Promise.resolve(body),
    headers: {
      get: (name) => headers[name] || null,
    },
  };
}

describe('POST /api/auth/login', () => {
  let mockSession;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSession = { save: vi.fn() };
    getSession.mockResolvedValue(mockSession);
    checkRateLimit.mockReturnValue({ allowed: true, remaining: 9 });
  });

  describe('rate limiting', () => {
    it('returns 429 when rate limit is exceeded', async () => {
      checkRateLimit.mockReturnValue({ allowed: false, remaining: 0 });

      const res = await POST(makeRequest({ type: 'volunteer', passphrase: 'test' }));
      const data = await res.json();

      expect(res.status).toBe(429);
      expect(data.error).toBe('Too many login attempts. Please wait before retrying.');
    });

    it('uses generic client key for rate limiting (LAN deployment)', async () => {
      checkRateLimit.mockReturnValue({ allowed: false, remaining: 0 });

      await POST(makeRequest({}, { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }));

      expect(checkRateLimit).toHaveBeenCalledWith('client');
    });

    it('uses generic client key regardless of x-real-ip header', async () => {
      checkRateLimit.mockReturnValue({ allowed: false, remaining: 0 });

      await POST(makeRequest({}, { 'x-real-ip': '10.0.0.1' }));

      expect(checkRateLimit).toHaveBeenCalledWith('client');
    });

    it('uses generic client key when no IP headers present', async () => {
      checkRateLimit.mockReturnValue({ allowed: false, remaining: 0 });

      await POST(makeRequest({}));

      expect(checkRateLimit).toHaveBeenCalledWith('client');
    });
  });

  describe('invalid requests', () => {
    it('returns 400 for invalid login type', async () => {
      const res = await POST(makeRequest({ type: 'invalid' }));
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe('Invalid login type');
    });

    it('returns 400 for malformed JSON', async () => {
      const req = {
        json: () => Promise.reject(new Error('Invalid JSON')),
        headers: { get: () => null },
      };

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe('Invalid request body');
    });
  });

  describe('volunteer login', () => {
    it('returns 400 when passphrase is missing', async () => {
      const res = await POST(makeRequest({ type: 'volunteer' }));
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe('Passphrase is required');
    });

    it('returns 401 when no passphrase is configured in system_config', async () => {
      mockPool.execute.mockResolvedValue([[]]);

      const res = await POST(makeRequest({ type: 'volunteer', passphrase: 'test' }));
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.error).toBe('Invalid credentials');
    });

    it('returns 401 when passphrase does not match', async () => {
      mockPool.execute.mockResolvedValue([[{ config_value: '$2a$10$hashedvalue' }]]);
      bcrypt.compare.mockResolvedValue(false);

      const res = await POST(makeRequest({ type: 'volunteer', passphrase: 'wrong' }));
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.error).toBe('Invalid credentials');
    });

    it('creates session and returns 200 on valid passphrase', async () => {
      mockPool.execute.mockResolvedValue([[{ config_value: '$2a$10$hashedvalue' }]]);
      bcrypt.compare.mockResolvedValue(true);

      const res = await POST(makeRequest({ type: 'volunteer', passphrase: 'correct' }));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.message).toBe('Login successful');
      expect(data.role).toBe('volunteer');
      expect(mockSession.role).toBe('volunteer');
      expect(mockSession.username).toBeNull();
      expect(mockSession.lastActive).toBeTypeOf('number');
      expect(mockSession.save).toHaveBeenCalled();
    });
  });

  describe('admin login', () => {
    it('returns 400 when username is missing', async () => {
      const res = await POST(makeRequest({ type: 'admin', password: 'pass' }));
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe('Username and password are required');
    });

    it('returns 400 when password is missing', async () => {
      const res = await POST(makeRequest({ type: 'admin', username: 'admin' }));
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe('Username and password are required');
    });

    it('returns 401 when username not found', async () => {
      mockPool.execute.mockResolvedValue([[]]);

      const res = await POST(makeRequest({ type: 'admin', username: 'noone', password: 'pass' }));
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.error).toBe('Invalid credentials');
    });

    it('returns 401 when password does not match', async () => {
      mockPool.execute.mockResolvedValue([[{ username: 'admin', password_hash: '$2a$10$hash' }]]);
      bcrypt.compare.mockResolvedValue(false);

      const res = await POST(makeRequest({ type: 'admin', username: 'admin', password: 'wrong' }));
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.error).toBe('Invalid credentials');
    });

    it('creates session and returns 200 on valid admin credentials', async () => {
      mockPool.execute.mockResolvedValue([[{ username: 'admin', password_hash: '$2a$10$hash' }]]);
      bcrypt.compare.mockResolvedValue(true);

      const res = await POST(makeRequest({ type: 'admin', username: 'admin', password: 'correct' }));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.message).toBe('Login successful');
      expect(data.role).toBe('admin');
      expect(data.username).toBe('admin');
      expect(mockSession.role).toBe('admin');
      expect(mockSession.username).toBe('admin');
      expect(mockSession.lastActive).toBeTypeOf('number');
      expect(mockSession.save).toHaveBeenCalled();
    });
  });
});
