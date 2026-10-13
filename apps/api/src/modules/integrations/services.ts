import { randomBytes } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import type { Database } from "@repo/db";
import { integration } from "@repo/db/schema";
import type {
  CreateIntegrationInput,
  Integration,
  IntegrationConfig,
} from "@repo/contracts/integrations";

type IntegrationRow = typeof integration.$inferSelect;

function toIntegration(row: IntegrationRow): Integration {
  const config = (row.config ?? {}) as IntegrationConfig;
  return {
    id: row.id,
    provider: row.provider as Integration["provider"],
    status: row.status,
    config,
    createdAt: row.createdAt.toISOString(),
  };
}

export function createIntegrationsService(db: Pick<Database, "select" | "insert" | "delete">) {
  return { list, create, remove };

  async function list(organizationId: string): Promise<Integration[]> {
    const rows = await db
      .select()
      .from(integration)
      .where(eq(integration.organizationId, organizationId))
      .orderBy(desc(integration.createdAt));
    return rows.map(toIntegration);
  }

  // Creating a webhook/zapier integration auto-generates a signing secret when
  // the caller did not supply one, so the UI can reveal it immediately.
  async function create(
    organizationId: string,
    input: CreateIntegrationInput,
  ): Promise<Integration> {
    const needsSecret = input.provider === "webhook" || input.provider === "zapier";
    const config: IntegrationConfig = {
      ...input.config,
      secret: input.config.secret ?? (needsSecret ? randomBytes(24).toString("hex") : undefined),
    };
    const [row] = await db
      .insert(integration)
      .values({ organizationId, provider: input.provider, config })
      .returning();
    if (!row) throw new Error("Failed to create integration.");
    return toIntegration(row);
  }

  async function remove(organizationId: string, id: string): Promise<boolean> {
    const rows = await db
      .delete(integration)
      .where(and(eq(integration.id, id), eq(integration.organizationId, organizationId)))
      .returning({ id: integration.id });
    return rows.length > 0;
  }
}
