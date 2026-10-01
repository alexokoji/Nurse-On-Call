/**
 * In-memory fixed-window rate limiter.
 *
 * Deliberately process-local: it protects a single instance against
 * credential stuffing and form spam without adding a Redis dependency.
 * A multi-instance deployment should swap `store` for a shared backend —
 * the `rateLimit()` signature is designed so only this file changes.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

declare global {
  var _rateLimitStore: Map<string, Bucket> | undefined;
}

const store: Map<string, Bucket> = global._rateLimitStore ?? new Map();
global._rateLimitStore = store;

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  /** Seconds until the window resets. */
  retryAfter: number;
}

export function rateLimit(
  key: string,
  { limit, windowSeconds }: { limit: number; windowSeconds: number },
): RateLimitResult {
  const now = Date.now();
  const bucket = store.get(key);

  if (!bucket || bucket.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { success: true, remaining: limit - 1, retryAfter: 0 };
  }

  bucket.count += 1;
  const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);

  if (bucket.count > limit) {
    return { success: false, remaining: 0, retryAfter };
  }

  return { success: true, remaining: limit - bucket.count, retryAfter };
}

export function resetRateLimit(key: string) {
  store.delete(key);
}

/** Pre-tuned windows for the endpoints that need protecting. */
export const RATE_LIMITS = {
  login: { limit: 8, windowSeconds: 300 },
  register: { limit: 5, windowSeconds: 900 },
  passwordReset: { limit: 4, windowSeconds: 900 },
  booking: { limit: 15, windowSeconds: 600 },
  payment: { limit: 20, windowSeconds: 600 },
  contact: { limit: 5, windowSeconds: 900 },
} as const;

/** Best-effort client IP from proxy headers, falling back to a constant. */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return headers.get('x-real-ip') ?? 'unknown';
}

/** Opportunistic cleanup so the map cannot grow without bound. */
export function pruneRateLimitStore() {
  const now = Date.now();
  for (const [key, bucket] of store) {
    if (bucket.resetAt <= now) store.delete(key);
  }
}
