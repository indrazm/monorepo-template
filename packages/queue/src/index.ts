import { randomUUID } from "node:crypto";
import { Queue, QueueEvents, type ConnectionOptions } from "bullmq";
import { Redis } from "ioredis";
import { bufferedImpressionSchema, type BufferedImpression } from "@repo/contracts/analytics";
import {
  analyticsJobSchema,
  analyticsQueueName,
  counterJobSchema,
  counterQueueName,
  exampleJobSchema,
  exampleQueueName,
  webhookJobSchema,
  webhookQueueName,
  type AnalyticsJob,
  type CounterJob,
  type ExampleJob,
  type ExampleJobResult,
  type WebhookJob,
} from "@repo/contracts/jobs";

// Returns a fresh ioredis client. BullMQ cannot resolve the optional `ioredis`
// package from its own location under pnpm, so we hand it a constructed client
// instead of connection options. `maxRetriesPerRequest: null` is required by
// BullMQ workers. Create one connection per Queue/Worker (do not share).
export function createQueueConnection(url: string): ConnectionOptions {
  return new Redis(url, { maxRetriesPerRequest: null });
}

export function createExampleQueue(connection: ConnectionOptions) {
  const queue = new Queue<ExampleJob, ExampleJobResult>(exampleQueueName, { connection });
  return {
    add: (input: ExampleJob) => queue.add(exampleQueueName, exampleJobSchema.parse(input)),
    close: () => queue.close(),
  };
}
export function createExampleQueueEvents(connection: ConnectionOptions) {
  return new QueueEvents(exampleQueueName, { connection });
}

// ---------------------------------------------------------------------------
// Tacto queues. Each `add` validates its payload against the shared contract
// so producers (apps/api) and the consumer (apps/worker) stay in sync.
// ---------------------------------------------------------------------------

// Event/queue jobs are retried with exponential backoff; completed/failed jobs
// are retained for inspection but bounded so Redis cannot grow forever.
const JOB_OPTIONS = {
  attempts: 5,
  backoff: { type: "exponential" as const, delay: 1_000 },
  removeOnComplete: { age: 3_600, count: 1_000 },
  removeOnFail: { age: 7 * 86_400, count: 5_000 },
};

export function createWebhookQueue(connection: ConnectionOptions) {
  const queue = new Queue<WebhookJob>(webhookQueueName, { connection });
  return {
    add: (input: WebhookJob) =>
      queue.add(webhookQueueName, webhookJobSchema.parse(input), JOB_OPTIONS),
    // Job-state depths for the /metrics endpoint (NFR-OBS-02).
    counts: () => queue.getJobCounts("waiting", "active", "failed", "completed", "delayed"),
    close: () => queue.close(),
  };
}

export function createAnalyticsQueue(connection: ConnectionOptions) {
  const queue = new Queue<AnalyticsJob>(analyticsQueueName, { connection });
  return {
    add: (input: AnalyticsJob = {}) =>
      queue.add(analyticsQueueName, analyticsJobSchema.parse(input), JOB_OPTIONS),
    // Repeatable flush schedule (F47). Idempotent: re-registering the same
    // scheduler id just updates the interval.
    scheduleFlush: (everyMs: number) =>
      queue.upsertJobScheduler(
        "analytics-flush",
        { every: everyMs },
        { data: analyticsJobSchema.parse({}) },
      ),
    counts: () => queue.getJobCounts("waiting", "active", "failed", "completed", "delayed"),
    close: () => queue.close(),
  };
}

export function createCounterQueue(connection: ConnectionOptions) {
  const queue = new Queue<CounterJob>(counterQueueName, { connection });
  return {
    add: (input: CounterJob) =>
      queue.add(counterQueueName, counterJobSchema.parse(input), JOB_OPTIONS),
    counts: () => queue.getJobCounts("waiting", "active", "failed", "completed", "delayed"),
    close: () => queue.close(),
  };
}

// ---------------------------------------------------------------------------
// Realtime store (Redis): hot-path impression buffer, live-visitor window and
// counter cache. Shared by the API (producer) and the worker (consumer) so the
// key names and entry shapes cannot drift (SRS FR-ANL-01/05, FR-NOT-02/03).
// ---------------------------------------------------------------------------

export const analyticsImpressionsKey = "tacto:analytics:impressions";
export const analyticsProcessingKey = "tacto:analytics:impressions:processing";
export const liveVisitorWindowMs = 5 * 60_000;

export function liveVisitorsKey(siteId: string): string {
  return `tacto:live-visitors:${siteId}`;
}
export function counterKey(notificationId: string): string {
  return `tacto:counter:${notificationId}`;
}
// Monthly visitor quota keys (FR-BIL-01). `month` is YYYY-MM.
export function visitorCountKey(organizationId: string, month: string): string {
  return `tacto:visitors:${organizationId}:${month}`;
}
export function visitorSeenKey(organizationId: string, visitorId: string, month: string): string {
  return `tacto:visitor-seen:${organizationId}:${month}:${visitorId}`;
}
// Keep the counters (and per-visitor markers) for ~40 days so a month-end
// read still works while old months fall out on their own.
const VISITOR_TTL_SECONDS = 40 * 86_400;

export function currentMonthKey(now: Date = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export type RealtimeStore = {
  // Append an impression to the flush buffer (RPUSH).
  pushImpression: (entry: BufferedImpression) => Promise<void>;
  // Atomically move up to `limit` buffered impressions into a processing list.
  drainImpressions: (limit?: number) => Promise<BufferedImpression[]>;
  // Acknowledge the processing batch after the DB commit.
  ackImpressions: () => Promise<void>;
  // Put unprocessed entries back after a failed flush.
  requeueImpressions: () => Promise<void>;
  // Mark a visitor as present now within the sliding window (ZADD).
  recordVisit: (siteId: string, visitorId: string) => Promise<void>;
  // Count distinct visitors seen within the window (ZCOUNT).
  countVisitors: (siteId: string) => Promise<number>;
  setCounter: (notificationId: string, count: number, ttlSeconds?: number) => Promise<void>;
  getCounter: (notificationId: string) => Promise<number | null>;
  // Fixed-window rate limit shared across API instances (NFR-SEC-04).
  hitRateLimit: (key: string, limit: number, windowMs: number) => Promise<boolean>;
  // Small JSON/value cache for the widget payload (NFR-PERF-02/03).
  cacheGet: (key: string) => Promise<string | null>;
  cacheSet: (key: string, value: string, ttlSeconds: number) => Promise<void>;
  // Single-winner lock (SET NX EX) so a scheduled task runs once across all
  // API/worker instances.
  acquireLock: (key: string, ttlSeconds: number) => Promise<boolean>;
  // Monthly unique-visitor counter per organization, for the traffic quota
  // (FR-BIL-01). Returns the running count for the current month.
  hitVisitor: (organizationId: string, visitorId: string, month: string) => Promise<number>;
  getVisitorCount: (organizationId: string, month: string) => Promise<number>;
};

// A plain data connection (separate from BullMQ's blocking connections).
export function createRedisClient(url: string): Redis {
  return new Redis(url);
}

export function createRealtimeStore(redis: Redis): RealtimeStore {
  return {
    async pushImpression(entry) {
      const id = entry.id ?? randomUUID();
      await redis.rpush(analyticsImpressionsKey, JSON.stringify({ ...entry, id }));
    },
    async drainImpressions(limit = 1000) {
      // Move into a processing list first. If the worker dies before the DB
      // commit, requeueImpressions puts the batch back instead of losing it.
      const raw = (await redis.eval(
        `local items = redis.call('LRANGE', KEYS[1], 0, tonumber(ARGV[1]) - 1)
         if #items == 0 then return {} end
         for _, item in ipairs(items) do redis.call('RPUSH', KEYS[2], item) end
         redis.call('LTRIM', KEYS[1], #items, -1)
         return items`,
        2,
        analyticsImpressionsKey,
        analyticsProcessingKey,
        String(limit),
      )) as string[];
      const entries: BufferedImpression[] = [];
      for (const item of raw) {
        try {
          const parsed = bufferedImpressionSchema.safeParse(JSON.parse(item));
          if (parsed.success) entries.push(parsed.data);
        } catch {
          // Corrupt buffered row: acknowledge/drop it below.
        }
      }
      return entries;
    },
    async ackImpressions() {
      await redis.del(analyticsProcessingKey);
    },
    async requeueImpressions() {
      await redis.eval(
        `local items = redis.call('LRANGE', KEYS[2], 0, -1)
         if #items > 0 then
           for _, item in ipairs(items) do redis.call('RPUSH', KEYS[1], item) end
         end
         redis.call('DEL', KEYS[2])`,
        2,
        analyticsImpressionsKey,
        analyticsProcessingKey,
      );
    },
    async recordVisit(siteId, visitorId) {
      const key = liveVisitorsKey(siteId);
      const now = Date.now();
      await redis
        .multi()
        .zadd(key, now, visitorId)
        .zremrangebyscore(key, 0, now - liveVisitorWindowMs)
        .expire(key, Math.ceil(liveVisitorWindowMs / 1000) + 60)
        .exec();
    },
    async countVisitors(siteId) {
      const key = liveVisitorsKey(siteId);
      const now = Date.now();
      await redis.zremrangebyscore(key, 0, now - liveVisitorWindowMs);
      return redis.zcard(key);
    },
    async setCounter(notificationId, count, ttlSeconds = 60) {
      const key = counterKey(notificationId);
      if (ttlSeconds > 0) await redis.set(key, String(count), "EX", ttlSeconds);
      else await redis.set(key, String(count));
    },
    async getCounter(notificationId) {
      const value = await redis.get(counterKey(notificationId));
      return value === null ? null : Number(value);
    },
    async hitRateLimit(key, limit, windowMs) {
      const redisKey = `tacto:ratelimit:${key}`;
      // INCR + PEXPIRE atomically: a crash between two commands must not leave
      // a key without TTL (which would rate-limit it forever).
      const count = Number(
        await redis.eval(
          `local c = redis.call('INCR', KEYS[1])
           if c == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
           return c`,
          1,
          redisKey,
          windowMs,
        ),
      );
      return count <= limit;
    },
    async cacheGet(key) {
      return redis.get(key);
    },
    async cacheSet(key, value, ttlSeconds) {
      if (ttlSeconds > 0) await redis.set(key, value, "EX", ttlSeconds);
      else await redis.set(key, value);
    },
    async acquireLock(key, ttlSeconds) {
      const result = await redis.set(`tacto:lock:${key}`, "1", "EX", ttlSeconds, "NX");
      return result === "OK";
    },
    async hitVisitor(organizationId, visitorId, month) {
      const seenKey = visitorSeenKey(organizationId, visitorId, month);
      const countKey = visitorCountKey(organizationId, month);
      // One visitor counts once per month: a NX marker guards the counter.
      const first = await redis.set(seenKey, "1", "EX", VISITOR_TTL_SECONDS, "NX");
      if (first === "OK") {
        const count = await redis.incr(countKey);
        await redis.expire(countKey, VISITOR_TTL_SECONDS);
        return count;
      }
      const current = await redis.get(countKey);
      return current === null ? 0 : Number(current);
    },
    async getVisitorCount(organizationId, month) {
      const value = await redis.get(visitorCountKey(organizationId, month));
      return value === null ? 0 : Number(value);
    },
  };
}
