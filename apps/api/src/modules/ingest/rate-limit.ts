// Lightweight fixed-window rate limiter for ingestion (SRS NFR-SEC-04,
// FR-VER-03 anti-abuse). In-memory per process — adequate for a single API
// instance; a multi-instance deployment should back this with Redis.
type Bucket = { count: number; resetAt: number };

export function createRateLimiter(options: { limit: number; windowMs: number }) {
  const buckets = new Map<string, Bucket>();

  return function take(key: string): boolean {
    const now = Date.now();
    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      return true;
    }
    if (bucket.count >= options.limit) return false;
    bucket.count++;
    return true;
  };
}
