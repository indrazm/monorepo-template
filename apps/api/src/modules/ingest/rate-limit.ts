// Fixed-window rate limiter for ingestion (SRS NFR-SEC-04, FR-VER-03). The
// in-memory implementation is a per-process fallback; multi-instance
// deployments use the Redis-backed limiter (`RealtimeStore.hitRateLimit`).
type Bucket = { count: number; resetAt: number };

export type RateLimiter = (key: string) => Promise<boolean>;

export function createRateLimiter(options: { limit: number; windowMs: number }): RateLimiter {
  const buckets = new Map<string, Bucket>();

  return async function take(key: string): Promise<boolean> {
    const now = Date.now();
    if (buckets.size > 10_000) {
      for (const [bucketKey, bucket] of buckets) {
        if (bucket.resetAt <= now) buckets.delete(bucketKey);
      }
    }
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

// The ingestion cap applied per site / webhook key: 120 events per minute.
export const INGEST_RATE_LIMIT = { limit: 120, windowMs: 60_000 } as const;
