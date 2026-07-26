import { describe, it, expect } from 'vitest';
import { withDb } from './mysql.js';

describe('withDb', () => {
  it('passes the pool to the handler and returns its result', async () => {
    const mockResponse = Response.json({ data: 'test' });
    const handler = (pool) => {
      expect(pool).toBeDefined();
      return mockResponse;
    };

    const result = await withDb(handler);
    expect(result).toBe(mockResponse);
  });

  it('returns 503 response for ECONNREFUSED error', async () => {
    const handler = () => {
      const error = new Error('connect ECONNREFUSED');
      error.code = 'ECONNREFUSED';
      throw error;
    };

    const result = await withDb(handler);
    expect(result.status).toBe(503);
    const body = await result.json();
    expect(body.error).toBe('Service temporarily unavailable');
  });

  it('returns 503 response for PROTOCOL_CONNECTION_LOST error', async () => {
    const handler = () => {
      const error = new Error('Connection lost');
      error.code = 'PROTOCOL_CONNECTION_LOST';
      throw error;
    };

    const result = await withDb(handler);
    expect(result.status).toBe(503);
    const body = await result.json();
    expect(body.error).toBe('Service temporarily unavailable');
  });

  it('re-throws errors that are not connection-related', async () => {
    const handler = () => {
      throw new Error('Some other error');
    };

    await expect(withDb(handler)).rejects.toThrow('Some other error');
  });

  it('re-throws errors with unrelated error codes', async () => {
    const handler = () => {
      const error = new Error('Access denied');
      error.code = 'ER_ACCESS_DENIED_ERROR';
      throw error;
    };

    await expect(withDb(handler)).rejects.toThrow('Access denied');
  });
});
