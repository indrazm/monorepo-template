import { databaseUrlSchema } from "@repo/config/database";
import { z } from "zod";

export const workerEnvSchema = z.object({
  REDIS_URL: z.url({ protocol: /^rediss?$/ }).default("redis://localhost:16379"),
  DATABASE_URL: databaseUrlSchema,
});
export function parseWorkerEnv(environment: Record<string, string | undefined>) {
  return workerEnvSchema.parse(environment);
}
export function createWorkerConfig(env: ReturnType<typeof parseWorkerEnv>) {
  return {
    redisUrl: env.REDIS_URL,
    databaseUrl: env.DATABASE_URL,
  };
}
