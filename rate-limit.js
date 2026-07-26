// lib/rate-limit.js — In-memory rate limiter.
//
// Tracks attempts per key (e.g. IP, username) within a sliding time window.
// Returns retry-after seconds when blocked. Periodically prunes stale
// entries to prevent unbounded memory growth.

const attempts = new Map(); // key -> { count, firstAttempt, blockedAt }

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 10;
const PRUNE_INTERVAL_MS = 5 * 60 * 1000; // prune every 5 min

// Periodic GC — runs once per process and clears expired entries.
let lastPrune = Date.now();
function maybePrune() {
  const now = Date.now();
  if (now - lastPrune < PRUNE_INTERVAL_MS) return;
  lastPrune = now;
  for (const [key, rec] of attempts) {
    if (now - rec.firstAttempt > WINDOW_MS) {
      attempts.delete(key);
    }
  }
}

export function checkRateLimit(key) {
  maybePrune();
  const now = Date.now();
  const record = attempts.get(key);

  if (!record || now - record.firstAttempt > WINDOW_MS) {
    attempts.set(key, { count: 1, firstAttempt: now, blockedAt: null });
    return { allowed: true, remaining: MAX_ATTEMPTS - 1, retryAfter: 0 };
  }

  if (record.count >= MAX_ATTEMPTS) {
    const retryAfter = Math.max(
      1,
      Math.ceil((record.firstAttempt + WINDOW_MS - now) / 1000)
    );
    record.blockedAt = record.blockedAt || now;
    return { allowed: false, remaining: 0, retryAfter };
  }

  record.count++;
  return { allowed: true, remaining: MAX_ATTEMPTS - record.count, retryAfter: 0 };
}

// Reset the counter for a key (e.g. after a successful login)
export function resetRateLimit(key) {
  attempts.delete(key);
}

// For testing / introspection only
export function getAttemptCount(key) {
  return attempts.get(key)?.count ?? 0;
}