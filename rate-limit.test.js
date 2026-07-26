import { describe, it, expect, beforeEach, vi } from 'vitest';
import { checkRateLimit } from './rate-limit.js';

describe('checkRateLimit', () => {
  beforeEach(() => {
    // Reset module state by re-importing with fresh Map
    vi.resetModules();
  });

  it('allows the first attempt from an IP', async () => {
    const { checkRateLimit } = await import('./rate-limit.js');
    const result = checkRateLimit('192.168.1.1');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
  });

  it('decrements remaining with each attempt', async () => {
    const { checkRateLimit } = await import('./rate-limit.js');
    checkRateLimit('10.0.0.1'); // remaining: 9
    const result = checkRateLimit('10.0.0.1'); // remaining: 8
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(8);
  });

  it('blocks after 10 attempts within the window', async () => {
    const { checkRateLimit } = await import('./rate-limit.js');
    const ip = '10.0.0.2';
    for (let i = 0; i < 10; i++) {
      checkRateLimit(ip);
    }
    const result = checkRateLimit(ip);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('allows exactly 10 attempts before blocking', async () => {
    const { checkRateLimit } = await import('./rate-limit.js');
    const ip = '10.0.0.3';
    let lastResult;
    for (let i = 0; i < 10; i++) {
      lastResult = checkRateLimit(ip);
      expect(lastResult.allowed).toBe(true);
    }
    expect(lastResult.remaining).toBe(0);
    // 11th attempt should be blocked
    const blocked = checkRateLimit(ip);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it('tracks different IPs independently', async () => {
    const { checkRateLimit } = await import('./rate-limit.js');
    // Exhaust one IP
    for (let i = 0; i < 10; i++) {
      checkRateLimit('blocked-ip');
    }
    // Different IP should still be allowed
    const result = checkRateLimit('fresh-ip');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
  });

  it('resets after the 15-minute window expires', async () => {
    const { checkRateLimit } = await import('./rate-limit.js');
    const ip = '10.0.0.4';

    // Use up all attempts
    for (let i = 0; i < 10; i++) {
      checkRateLimit(ip);
    }
    expect(checkRateLimit(ip).allowed).toBe(false);

    // Advance time past the 15-minute window
    vi.useFakeTimers();
    vi.advanceTimersByTime(15 * 60 * 1000 + 1);

    const result = checkRateLimit(ip);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);

    vi.useRealTimers();
  });
});
