import { randomBytes } from "node:crypto";
import { and, asc, desc, eq } from "drizzle-orm";
import type { Database } from "@repo/db";
import { integration, site } from "@repo/db/schema";
import {
  integrationConfigSchema,
  integrationMeta,
  type CreateIntegrationInput,
  type Integration,
  type IntegrationConfig,
  type IntegrationProvider,
  type IntegrationStatus,
  type UpdateIntegrationInput,
  type VerifyIntegrationResponse,
} from "@repo/contracts/integrations";
import type { CredentialCipher } from "./credentials";
import { getProviderApi, type ServerCredentials } from "./provider-api";

type IntegrationRow = typeof integration.$inferSelect;

export type IntegrationsServiceDeps = {
  cipher: CredentialCipher;
  server: ServerCredentials;
  // Public base URL of this API, used to build the webhook URL we register
  // with providers (must be reachable from the internet in production).
  publicApiUrl: string;
};

// Credentials and the inbound signing secret never leave the server: the API
// returns only which credential keys are set and whether a secret exists.
function toIntegration(row: IntegrationRow): Integration {
  const stored = (row.config ?? {}) as IntegrationConfig;
  const { credentials, secret, ...config } = stored;
  return {
    id: row.id,
    provider: row.provider as IntegrationProvider,
    status: row.status as IntegrationStatus,
    config,
    secretSet: Boolean(secret),
    credentialKeys: Object.keys(credentials ?? {}),
    lastCheckedAt: row.lastCheckedAt?.toISOString() ?? null,
    lastEventAt: row.lastEventAt?.toISOString() ?? null,
    lastError: row.lastError ?? null,
    externalRef: row.externalRef ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export function createIntegrationsService(db: Database, deps: IntegrationsServiceDeps) {
  return {
    list,
    create,
    update,
    verify,
    remove,
    resolveForWebhook,
    recordDelivery,
    revealSecret,
    rotateSecret,
  };

  async function list(organizationId: string): Promise<Integration[]> {
    const rows = await db
      .select()
      .from(integration)
      .where(eq(integration.organizationId, organizationId))
      .orderBy(desc(integration.createdAt));
    return rows.map(toIntegration);
  }

  // Step 1 of the connect wizard. Providers that sign with a secret Tacto
  // mints get one generated here; everything else starts "pending" until the
  // user finishes the wizard (FR-INT-01).
  async function create(
    organizationId: string,
    input: CreateIntegrationInput,
  ): Promise<Integration> {
    const meta = integrationMeta[input.provider];
    const generated = meta.auth === "generated_secret";
    const plainSecret =
      input.config.secret ?? (generated ? randomBytes(24).toString("hex") : undefined);
    const config: IntegrationConfig = {
      ...input.config,
      secret: plainSecret ? deps.cipher.encrypt(plainSecret) : undefined,
      credentials: input.config.credentials
        ? deps.cipher.encryptAll(input.config.credentials)
        : undefined,
    };
    const [row] = await db
      .insert(integration)
      .values({ organizationId, provider: input.provider, config, status: "pending" })
      .returning();
    if (!row) throw new Error("Failed to create integration.");
    return toIntegration(row);
  }

  // Later wizard steps patch the config: paste the signing secret, store API
  // credentials, pick the site/events, map fields. Changing credentials resets
  // the connection to "pending" so the user has to verify again.
  async function update(
    organizationId: string,
    id: string,
    input: UpdateIntegrationInput,
  ): Promise<Integration | null> {
    const row = await findRow(organizationId, id);
    if (!row) return null;
    const current = (row.config ?? {}) as IntegrationConfig;
    const patch = input.config ?? {};

    // Credentials are merged key by key (the wizard sends one step at a time)
    // and re-encrypted. An empty string removes a credential.
    const credentials = { ...current.credentials };
    if (patch.credentials) {
      for (const [key, value] of Object.entries(patch.credentials)) {
        if (!value) delete credentials[key];
        else credentials[key] = deps.cipher.encrypt(value);
      }
    }

    // `secret` is write-only and encrypted separately; never let a plaintext
    // value slip through the general config merge.
    const { secret: patchSecret, ...patchConfig } = patch;
    const merged = integrationConfigSchema.parse({
      ...current,
      ...patchConfig,
      credentials: Object.keys(credentials).length > 0 ? credentials : undefined,
    });
    if (patchSecret !== undefined) {
      merged.secret = patchSecret ? deps.cipher.encrypt(patchSecret) : undefined;
    }

    const credentialsChanged = Boolean(patch.credentials) || patchSecret !== undefined;
    const status: IntegrationStatus =
      input.status ??
      (credentialsChanged && row.status !== "disabled"
        ? "pending"
        : (row.status as IntegrationStatus));

    const [updated] = await db
      .update(integration)
      .set({
        config: merged,
        status,
        ...(credentialsChanged ? { lastError: null } : {}),
      })
      .where(and(eq(integration.id, id), eq(integration.organizationId, organizationId)))
      .returning();
    return updated ? toIntegration(updated) : null;
  }

  // "Verify" (FR-INT-04). Three honest outcomes:
  //  - providers we can call: we call them, and register the webhook when the
  //    provider lets us (so the user does not have to copy a secret at all);
  //  - providers that can only prove themselves by delivering: we report
  //    whether a correctly signed event has arrived yet;
  //  - providers missing their credentials: we say which ones.
  async function verify(
    organizationId: string,
    id: string,
  ): Promise<VerifyIntegrationResponse | null> {
    const row = await findRow(organizationId, id);
    if (!row) return null;
    const provider = row.provider as IntegrationProvider;
    const meta = integrationMeta[provider];
    const config = (row.config ?? {}) as IntegrationConfig;
    const credentials = deps.cipher.decryptAll(config.credentials);
    const storedSecret = config.secret ? deps.cipher.decrypt(config.secret) : null;
    const plainSecret = inboundSecret(provider, storedSecret);
    const checkedAt = new Date();
    if (config.secret && !storedSecret) {
      return finish(
        row,
        "error",
        "Reconnect this integration: its signing secret can no longer be read.",
        checkedAt,
      );
    }
    const api = getProviderApi(provider);

    const required = (meta.credentials ?? []).filter((field) => !field.optional);
    const absent = required.filter((field) => !credentials[field.key]).map((field) => field.label);
    if (absent.length > 0) {
      return finish(row, "error", `Missing ${absent.join(", ")}.`, checkedAt);
    }

    if (api?.test) {
      const webhookUrl = await buildWebhookUrl(organizationId, provider, config);
      const ctx = {
        credentials,
        server: deps.server,
        webhookUrl,
        secret: plainSecret ?? undefined,
        externalRef: row.externalRef,
      };
      const result = await api.test(ctx);
      if (!result.ok) {
        // Falling back to delivery history keeps providers usable when the
        // optional API key is absent but their webhook already works.
        if (row.lastEventAt) {
          return finish(
            row,
            "connected",
            `Receiving signed events (last at ${row.lastEventAt.toISOString()}).`,
            checkedAt,
          );
        }
        // A provider with a valid signing secret can still prove itself via
        // its first delivery even when an optional API test is unavailable.
        if (plainSecret) {
          return finish(
            row,
            "pending",
            `${result.message} Waiting for the first signed delivery.`,
            checkedAt,
          );
        }
        return finish(row, "error", result.message, checkedAt);
      }
      // Credentials are good — register the webhook if we can and have not yet.
      let message = result.message;
      if (meta.managesWebhook && api.subscribe && !row.externalRef) {
        const subscription = await api.subscribe(ctx);
        if (!subscription.ok) {
          // Do not claim "connected" when the provider webhook was not
          // registered; no events can arrive in that state.
          return finish(
            row,
            "error",
            `${result.message} Webhook not registered: ${subscription.message}`,
            checkedAt,
          );
        }
        message = `${result.message} ${subscription.message}`;
        await db
          .update(integration)
          .set({
            externalRef: subscription.externalRef ?? null,
            ...(subscription.secret
              ? {
                  config: {
                    ...config,
                    secret: deps.cipher.encrypt(subscription.secret),
                  },
                }
              : {}),
          })
          .where(eq(integration.id, row.id));
      }
      return finish(row, "connected", message, checkedAt);
    }

    // Passive providers: the only proof is a correctly signed delivery.
    if (row.lastEventAt) {
      return finish(
        row,
        "connected",
        `Receiving signed events (last at ${row.lastEventAt.toISOString()}).`,
        checkedAt,
      );
    }
    if (!plainSecret) {
      return finish(row, "error", "No signing secret stored yet.", checkedAt);
    }
    return finish(
      row,
      "pending",
      `Waiting for the first signed delivery. Send a test event from ${meta.label} — Tacto verifies ${meta.header}.`,
      checkedAt,
    );
  }

  async function finish(
    row: IntegrationRow,
    status: IntegrationStatus,
    message: string,
    checkedAt: Date,
  ): Promise<VerifyIntegrationResponse> {
    await db
      .update(integration)
      .set({
        status,
        lastCheckedAt: checkedAt,
        lastError: status === "error" ? message.slice(0, 500) : null,
      })
      .where(eq(integration.id, row.id));
    return { status, message, checkedAt: checkedAt.toISOString() };
  }

  // Disconnect revokes the provider-side webhook when Tacto created it, then
  // deletes the record (FR-INT-04, step 5).
  async function remove(organizationId: string, id: string): Promise<boolean> {
    const row = await findRow(organizationId, id);
    if (!row) return false;
    const provider = row.provider as IntegrationProvider;
    const config = (row.config ?? {}) as IntegrationConfig;
    const api = getProviderApi(provider);
    if (api?.unsubscribe && row.externalRef) {
      try {
        await api.unsubscribe({
          credentials: deps.cipher.decryptAll(config.credentials),
          server: deps.server,
          webhookUrl: await buildWebhookUrl(organizationId, provider, config),
          secret: config.secret ? (deps.cipher.decrypt(config.secret) ?? undefined) : undefined,
          externalRef: row.externalRef,
        });
      } catch {
        // Revoking is best-effort: a provider being down must not block the
        // user from disconnecting on our side.
      }
    }
    const rows = await db
      .delete(integration)
      .where(and(eq(integration.id, id), eq(integration.organizationId, organizationId)))
      .returning({ id: integration.id });
    return rows.length > 0;
  }

  // Used by ingestion: the integration row for an inbound webhook, with its
  // credentials decrypted and its mapping/filter ready to apply.
  async function resolveForWebhook(
    organizationId: string,
    provider: string,
    siteKey?: string,
  ): Promise<{
    id: string;
    status: IntegrationStatus;
    config: IntegrationConfig;
    credentials: Record<string, string>;
  } | null> {
    const rows = await db
      .select()
      .from(integration)
      .where(
        and(eq(integration.organizationId, organizationId), eq(integration.provider, provider)),
      )
      .orderBy(asc(integration.createdAt));
    // When the webhook URL carries a site, use that connection. Falling back to
    // the oldest integration would verify site B's delivery with site A's
    // secret (or accept it against the wrong tenant site).
    const row = siteKey
      ? rows.find((candidate) => (candidate.config as IntegrationConfig)?.siteKey === siteKey)
      : rows[0];
    if (!row) return null;
    const config = (row.config ?? {}) as IntegrationConfig;
    const storedSecret = config.secret ? deps.cipher.decrypt(config.secret) : null;
    const plainSecret = inboundSecret(row.provider as IntegrationProvider, storedSecret);
    return {
      id: row.id,
      status: row.status as IntegrationStatus,
      config: { ...config, secret: plainSecret ?? undefined },
      credentials: deps.cipher.decryptAll(config.credentials),
    };
  }

  // Connection health written from the ingestion path: a verified delivery
  // promotes the integration to "connected"; a rejected one records why.
  async function recordDelivery(
    id: string,
    outcome: { ok: true } | { ok: false; error: string },
  ): Promise<void> {
    const now = new Date();
    await db
      .update(integration)
      .set(
        outcome.ok
          ? { status: "connected", lastEventAt: now, lastCheckedAt: now, lastError: null }
          : { status: "error", lastCheckedAt: now, lastError: outcome.error.slice(0, 500) },
      )
      .where(eq(integration.id, id));
  }

  // Manager-only reveal. The list response only carries `secretSet`.
  async function revealSecret(
    organizationId: string,
    id: string,
  ): Promise<{ secret: string } | null> {
    const row = await findRow(organizationId, id);
    if (!row) return null;
    const config = (row.config ?? {}) as IntegrationConfig;
    const secret = config.secret ? deps.cipher.decrypt(config.secret) : null;
    return secret ? { secret } : null;
  }

  async function rotateSecret(
    organizationId: string,
    id: string,
  ): Promise<{ secret: string } | null> {
    const row = await findRow(organizationId, id);
    if (!row) return null;
    const secret = randomBytes(24).toString("hex");
    const config = (row.config ?? {}) as IntegrationConfig;
    await db
      .update(integration)
      .set({
        config: { ...config, secret: deps.cipher.encrypt(secret) },
        status: "pending",
        lastError: null,
      })
      .where(and(eq(integration.id, id), eq(integration.organizationId, organizationId)));
    return { secret };
  }

  // Some native providers sign with an app-level secret Tacto already holds
  // (Shopify app secret, HubSpot client secret). Use it when the user did not
  // paste a per-connection secret.
  function inboundSecret(provider: IntegrationProvider, stored: string | null): string | null {
    if (stored) return stored;
    if (provider === "shopify") return deps.server.shopify?.apiSecret ?? null;
    if (provider === "hubspot") return deps.server.hubspot?.clientSecret ?? null;
    return null;
  }

  async function findRow(organizationId: string, id: string): Promise<IntegrationRow | null> {
    const [row] = await db
      .select()
      .from(integration)
      .where(and(eq(integration.id, id), eq(integration.organizationId, organizationId)))
      .limit(1);
    return row ?? null;
  }

  async function buildWebhookUrl(
    organizationId: string,
    provider: string,
    config: IntegrationConfig,
  ): Promise<string> {
    let siteKey = config.siteKey;
    if (!siteKey) {
      const [first] = await db
        .select({ siteKey: site.siteKey })
        .from(site)
        .where(eq(site.organizationId, organizationId))
        .orderBy(asc(site.createdAt))
        .limit(1);
      siteKey = first?.siteKey;
    }
    const base = deps.publicApiUrl.replace(/\/+$/, "");
    return `${base}/ingest/v1/webhook/${provider}${siteKey ? `?site=${siteKey}` : ""}`;
  }
}

export type IntegrationsService = ReturnType<typeof createIntegrationsService>;
