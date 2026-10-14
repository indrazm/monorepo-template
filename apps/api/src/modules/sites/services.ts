import { and, desc, eq } from "drizzle-orm";
import type { Database } from "@repo/db";
import { domainSetting, site } from "@repo/db/schema";
import type {
  CreateSiteInput,
  DomainLoopSettings,
  DomainPrivacy,
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
  return { list, get, create, update, remove, getSettings, upsertSettings };

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
      privacy: row.privacy as DomainPrivacy,
      customCss: (row.customCss as string | null) ?? null,
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
}
