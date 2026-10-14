import { serve } from "@hono/node-server";
import { createDatabase } from "@repo/db";
import { createApp } from "./app";
import type { createApiConfig } from "./config";
import { createAuth } from "./modules/auth/auth";
import { createMailer } from "./modules/auth/mailer";

export function startServer(config: ReturnType<typeof createApiConfig>) {
  const { db, pool } = createDatabase(config.databaseUrl);
  const auth = createAuth(db, config.auth, createMailer(config.smtp));
  const app = createApp({
    db,
    config,
    auth: {
      getSession: (headers) => auth.api.getSession({ headers }),
      handler: (request) => auth.handler(request),
    },
  });
  const server = serve({ fetch: app.fetch, port: config.port }, (info) => {
    console.info(`API listening on port ${info.port}`);
  });
  let shuttingDown = false;
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      if (shuttingDown) return;
      shuttingDown = true;
      server.close(() => {
        void pool.end().catch((err) => {
          console.error("API shutdown failed", err);
          process.exitCode = 1;
        });
      });
    });
  }
  return server;
}
