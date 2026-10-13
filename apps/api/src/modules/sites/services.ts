import { and, desc, eq } from "drizzle-orm";
import type { Database } from "@repo/db";
import { site } from "@repo/db/schema";
import type { CreateSiteInput, Site, UpdateSiteInput } from "@repo/contracts/sites";

type SiteRow = typeof site.$inferSelect;

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
  return { list, get, create, update, remove };

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
