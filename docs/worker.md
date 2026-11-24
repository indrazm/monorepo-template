# Worker

`apps/worker` owns BullMQ execution. `packages/queue` owns producer and connection factories. Use `bun run --filter @repo/worker dev` to run the worker with Redis available.

## Rules

- Define queue names, payload schemas, and result schemas in `@repo/contracts/jobs`.
- Validate payloads before enqueueing and again before processing data read from Redis.
- Keep processors in `apps/worker/src/processors`. Keep startup, queue event handlers, and shutdown in `src/worker.ts`.
- Shared queue factories accept configuration explicitly; they must not read environment variables or start workers.
- Keep Redis settings in the worker's `src/config.ts` and `.env.example`. Other producers own their own runtime configuration.
- Set `maxRetriesPerRequest: null` on worker connections. Keep producer retry behavior bounded.
- Assume a job can run again. Make side effects idempotent or provide an explicit deduplication strategy.
- Define retry/backoff and failed-job retention intentionally when adding real jobs; avoid infinite retries for invalid payloads.
- Close queue resources when their owner stops. Let active work drain during worker shutdown.
- Use simple console messages for job events and failures; do not print secrets or entire sensitive payloads.

## Adding a job

1. Define its payload, result, and queue name in the contracts package.
2. Add a producer in the queue package that validates input before enqueueing.
3. Implement a processor and register its worker and event handlers.
4. Test valid payloads, invalid payloads, failures, and repeat execution when the job has side effects.

Processor unit tests need no Redis. Verify delivery, retries, and concurrency against Redis when changing queue behavior.
