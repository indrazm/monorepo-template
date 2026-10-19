import { and, desc, eq, gte } from "drizzle-orm";
import type { Database } from "@repo/db";
import { domainSetting, event, impression, site } from "@repo/db/schema";
import type {
  CreateSiteInput,
  DomainLoopSettings,
  DomainSetting,
  Site,
  UpdateSiteInput,
} from "@repo/contracts/sites";
import {
  analyticsPassthroughSchema,
  domainLoopSettingsSchema,
  domainPrivacySchema,
} from "@repo/contracts/sites";

type SiteRow = typeof site.$inferSelect;

function defaultDomainSetting(): DomainSetting {
  return {
    loop: domainLoopSettingsSchema.parse({}),
    privacy: domainPrivacySchema.parse({}),
    customCss: null,
    customJs: null,
    analyticsPassthrough: analyticsPassthroughSchema.parse({}),
  };
}

function toSite(row: SiteRow): Site {
  return {
    id: row.id,
    name: row.name,
    domain: row.domain,
    siteKey: row.siteKey,
    apiKey: row.apiKey,
    pixelVerifiedAt: row.pixelVerifiedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export function createSitesService(db: Pick<Database, "select" | "insert" | "update" | "delete">) {
  return {
    list,
    get,
    create,
    update,
    remove,
    getSettings,
    upsertSettings,
    exportEvents,
    purgeEvents,
    verify,
    sendTestEvent,
  };

  async function ownsSite(organizationId: string, siteId: string): Promise<boolean> {
    const rows = await db
      .select({ id: site.id })
      .from(site)
      .where(and(eq(site.id, siteId), eq(site.organizationId, organizationId)))
      .limit(1);
    return rows.length > 0;
  }

  // Per-domain global settings (FR-NGS-01/02/03/05). Returns defaults when unset.
  async function getSettings(
    organizationId: string,
    siteId: string,
  ): Promise<DomainSetting | null> {
    if (!(await ownsSite(organizationId, siteId))) return null;
    const [row] = await db
      .select()
      .from(domainSetting)
      .where(eq(domainSetting.siteId, siteId))
      .limit(1);
    if (!row) return defaultDomainSetting();
    return {
      loop: row.loop as DomainLoopSettings,
      privacy: domainPrivacySchema.parse(row.privacy ?? {}),
      customCss: (row.customCss as string | null) ?? null,
      customJs: (row.customJs as string | null) ?? null,
      analyticsPassthrough: analyticsPassthroughSchema.parse(row.analyticsPassthrough ?? {}),
    };
  }

  async function upsertSettings(
    organizationId: string,
    siteId: string,
    input: DomainSetting,
  ): Promise<DomainSetting | null> {
    if (!(await ownsSite(organizationId, siteId))) return null;
    const values = {
      loop: input.loop,
      privacy: input.privacy,
      customCss: input.customCss,
      customJs: input.customJs,
      analyticsPassthrough: input.analyticsPassthrough,
    };
    await db
      .insert(domainSetting)
      .values({ siteId, ...values })
      .onConflictDoUpdate({ target: domainSetting.siteId, set: values });
    return input;
  }

  async function list(organizationId: string): Promise<Site[]> {
    const rows = await db
      .select()
      .from(site)
      .where(eq(site.organizationId, organizationId))
      .orderBy(desc(site.createdAt));
    return rows.map(toSite);
  }

  async function get(organizationId: string, id: string): Promise<Site | null> {
    const rows = await db
      .select()
      .from(site)
      .where(and(eq(site.id, id), eq(site.organizationId, organizationId)))
      .limit(1);
    return rows[0] ? toSite(rows[0]) : null;
  }

  async function create(organizationId: string, input: CreateSiteInput): Promise<Site> {
    const [row] = await db
      .insert(site)
      .values({ organizationId, name: input.name, domain: input.domain })
      .returning();
    if (!row) throw new Error("Failed to create site.");
    return toSite(row);
  }

  async function update(
    organizationId: string,
    id: string,
    input: UpdateSiteInput,
  ): Promise<Site | null> {
    const values: Partial<Pick<SiteRow, "name" | "domain">> = {};
    if (input.name !== undefined) values.name = input.name;
    if (input.domain !== undefined) values.domain = input.domain;
    const [row] = await db
      .update(site)
      .set(values)
      .where(and(eq(site.id, id), eq(site.organizationId, organizationId)))
      .returning();
    return row ? toSite(row) : null;
  }

  async function remove(organizationId: string, id: string): Promise<boolean> {
    const rows = await db
      .delete(site)
      .where(and(eq(site.id, id), eq(site.organizationId, organizationId)))
      .returning({ id: site.id });
    return rows.length > 0;
  }

  // Data portability (NFR-PRIV-03): every stored event for the site, newest
  // first. Null when the site is not in the caller's organization.
  async function exportEvents(
    organizationId: string,
    siteId: string,
  ): Promise<(typeof event.$inferSelect)[] | null> {
    if (!(await ownsSite(organizationId, siteId))) return null;
    return db.select().from(event).where(eq(event.siteId, siteId)).orderBy(desc(event.occurredAt));
  }

  // Right to erasure (NFR-PRIV-03): delete every event of the site. Impressions
  // are anonymous counters and are kept for billing/analytics accuracy.
  async function purgeEvents(
    organizationId: string,
    siteId: string,
    includeAnalytics = false,
  ): Promise<number | null> {
    if (!(await ownsSite(organizationId, siteId))) return null;
    if (includeAnalytics) {
      await db.delete(impression).where(eq(impression.siteId, siteId));
    }
    const rows = await db.delete(event).where(eq(event.siteId, siteId)).returning({ id: event.id });
    return rows.length;
  }

  // Pixel verification check (F70 onboarding, feedback T5). The pixel sets
  // `pixelVerifiedAt` the first time it loads a payload; this re-reads the row
  // and reports a recent-activity window so the dashboard "Check now" button has
  // a meaningful answer. Null for a foreign site.
  async function verify(
    organizationId: string,
    siteId: string,
  ): Promise<{
    verified: boolean;
    pixelVerifiedAt: string | null;
    recentlyActive: boolean;
  } | null> {
    const [row] = await db
      .select({ pixelVerifiedAt: site.pixelVerifiedAt })
      .from(site)
      .where(and(eq(site.id, siteId), eq(site.organizationId, organizationId)))
      .limit(1);
    if (!row) return null;
    const tenMinutesAgo = new Date(Date.now() - 10 * 60_000);
    const [recent] = await db
      .select({ id: event.id })
      .from(event)
      .where(and(eq(event.siteId, siteId), gte(event.occurredAt, tenMinutesAgo)))
      .limit(1);
    return {
      verified: row.pixelVerifiedAt !== null,
      pixelVerifiedAt: row.pixelVerifiedAt?.toISOString() ?? null,
      recentlyActive: Boolean(recent),
    };
  }

  // Inject a single demo event so the user can see a notification without a real
  // transaction (feedback T5, used by onboarding T14). Null for a foreign site.
  async function sendTestEvent(organizationId: string, siteId: string): Promise<boolean | null> {
    if (!(await ownsSite(organizationId, siteId))) return null;
    await db.insert(event).values({
      siteId,
      type: "purchase",
      source: "manual",
      verified: false,
      displayName: "Alex",
      city: "San Francisco",
      payload: { product: "Test product", amount: "49", test: true },
      occurredAt: new Date(),
    });
    return true;
  }
}
