import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { authRouter } from "./modules/auth/router";
import { usersRouter } from "./modules/users/router";

const clientOrigins = (process.env.CLIENT_ORIGINS ?? "http://localhost:3000,http://localhost:4000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const app = new Hono()
  .use(
    "*",
    cors({
      origin: (origin) => (clientOrigins.includes(origin) ? origin : null),
      credentials: true,
    }),
  )
  .get("/health", (c) => {
    return c.json({ ok: true, service: "api" });
  })
  .route("/auth", authRouter)
  .route("/users", usersRouter);

const port = Number(process.env.API_PORT ?? 8000);

serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.log(`API listening on http://localhost:${info.port}`);
  },
);
