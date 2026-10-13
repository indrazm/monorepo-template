import { and, count, eq, gte, inArray } from "drizzle-orm";
import type { Database } from "@repo/db";
import { event, site, subscription } from "@repo/db/schema";
import { planLimits, type Plan } from "@repo/contracts/billing";

export type BillingOverview = {
  plan: Plan;
  trafficQuota: number;
  usage: number; // visitors counted this period
  sitesUsed: number;
  maxSites: number;
  removeBadge: boolean;
  renewsAt: string | null;
};

export function createBillingService(db: Pick<Database, "select" | "update">) {
  return { getPlan, getOverview, canCreateSite, updatePlan };

  // Applies a subscription change from Stripe (SRS FR-BIL-05). Upserts onto the
  // org's subscription row; plan defaults are kept when the event omits a plan.
  async function updatePlan(input: {
    organizationId: string;
    plan: import("@repo/contracts/billing").Plan | null;
    status: string;
    renewsAt: Date | null;
  }): Promise<void> {
    const values: Partial<typeof subscription.$inferInsert> = {
      status: input.status,
      renewsAt: input.renewsAt,
    };
    if (input.plan) {
      values.plan = input.plan;
      values.trafficQuota = planLimits[input.plan].trafficQuota;
    }
    await db
      .update(subscription)
      .set(values)
      .where(eq(subscription.organizationId, input.organizationId));
  }

  async function getPlan(organizationId: string): Promise<Plan> {
    const [row] = await db
      .select({ plan: subscription.plan })
      .from(subscription)
      .where(eq(subscription.organizationId, organizationId))
      .limit(1);
    return (row?.plan ?? "free") as Plan;
  }

  async function countSites(organizationId: string): Promise<number> {
    const [row] = await db
      .select({ value: count() })
      .from(site)
      .where(eq(site.organizationId, organizationId));
    return row?.value ?? 0;
  }

  // Enforces the plan's site limit (SRS FR-BIL-03).
  async function canCreateSite(organizationId: string): Promise<boolean> {
    const [plan, sites] = await Promise.all([getPlan(organizationId), countSites(organizationId)]);
    return sites < planLimits[plan].maxSites;
  }

  async function getOverview(organizationId: string): Promise<BillingOverview> {
    const [subRow] = await db
      .select()
      .from(subscription)
      .where(eq(subscription.organizationId, organizationId))
      .limit(1);
    const plan = (subRow?.plan ?? "free") as Plan;
    const limits = planLimits[plan];

    const sitesUsed = await countSites(organizationId);

    // Approximate monthly visitor usage from visit events across the org's sites.
    const orgSites = await db
      .select({ id: site.id })
      .from(site)
      .where(eq(site.organizationId, organizationId));
    let usage = 0;
    if (orgSites.length > 0) {
      const since = new Date();
      since.setDate(1);
      since.setHours(0, 0, 0, 0);
      const [usageRow] = await db
        .select({ value: count() })
        .from(event)
        .where(
          and(
            inArray(
              event.siteId,
              orgSites.map((s) => s.id),
            ),
            eq(event.type, "visit"),
            gte(event.occurredAt, since),
          ),
        );
      usage = usageRow?.value ?? 0;
    }

    return {
      plan,
      trafficQuota: subRow?.trafficQuota ?? limits.trafficQuota,
      usage,
      sitesUsed,
      maxSites: limits.maxSites,
      removeBadge: limits.removeBadge,
      renewsAt: subRow?.renewsAt ? subRow.renewsAt.toISOString() : null,
    };
  }
}
