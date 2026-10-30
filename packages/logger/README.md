# @repo/logger

Standalone Node.js logging built on Pino. Importing the package does not create a logger or read environment configuration.

```ts
import { createLogger } from "@repo/logger";

const logger = createLogger({
  name: "my-service",
  level: "info",
  pretty: true, // Opt in for local development; omit for JSON output.
});

logger.info({ userId: "123" }, "User signed in");
logger.child({ requestId: "abc" }).info("Request started");
logger.error({ err: new Error("Oops") }, "Request failed");
```

The default level is `info`, with structured JSON written to stdout. `pretty: true` uses a `pino-pretty` worker transport with readable timestamps and terminal-aware colors. Configuration is explicit; callers decide when to enable pretty output.

`createLogger` accepts Pino logger options (except `transport`, which the factory manages), including `level`, `name`, `redact`, and `serializers`. The returned Pino logger supports child loggers and standard logging methods. `Logger` and `LoggerOptions` types are exported.

No applications are wired to this package.
