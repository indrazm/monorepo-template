import { eq } from "drizzle-orm";
import { createDatabase } from "@repo/db";
import { integration } from "@repo/db/schema";
import type { IntegrationConfig } from "@repo/contracts/integrations";
import { createApiConfig, parseApiEnv } from "../src/config";
import { createCredentialCipher } from "../src/modules/integrations/credentials";

// One-time, idempotent migration for signing secrets written before R5.1.
// Run after deploying the encrypted-secret code:
//   pnpm --filter @repo/api exec tsx scripts/encrypt-integration-secrets.ts
const config = createApiConfig(parseApiEnv(process.env));
const { db, pool } = createDatabase(config.databaseUrl);
const cipher = createCredentialCipher(config.credentialsSecret);

try {
  const rows = await db
    .select({ id: integration.id, config: integration.config })
    .from(integration);
  let changed = 0;
  for (const row of rows) {
    const stored = (row.config ?? {}) as IntegrationConfig;
    if (!stored.secret || stored.secret.startsWith("encv1.")) continue;
    await db
      .update(integration)
      .set({ config: { ...stored, secret: cipher.encrypt(stored.secret) } })
      .where(eq(integration.id, row.id));
    changed += 1;
  }
  console.info(`Encrypted ${changed} integration secret(s).`);
} finally {
  await pool.end();
}
