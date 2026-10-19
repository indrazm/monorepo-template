import { and, count, eq, gte, inArray } from "drizzle-orm";
import type { Database } from "@repo/db";
import { event, site, subscription, webhookEvent } from "@repo/db/schema";
import { effectivePlanFor, hasPaidAccess, planLimits, type Plan } from "@repo/contracts/billing";
import { currentMonthKey, type RealtimeStore } from "@repo/queue";

export type BillingOverview = {
  plan: Plan;
  status: string;
  active: boolean;
  effectivePlan: Plan;
  trafficQuota: number;
  usage: number; // visitors counted this period
  sitesUsed: number;
  maxSites: number;
  removeBadge: boolean;
  customCode: boolean;
  renewsAt: string | null;
  cancelAtPeriodEnd: boolean;
  // A provider customer id exists → the billing portal can be opened.
  manageable: boolean;
};

// With Redis, monthly usage is the authoritative unique-visitor counter the
// widget increments (FR-BIL-01). Without it we fall back to counting `visit`
// events, which over-counts returning visitors but keeps the page working.
export type BillingServiceDeps = {
  store?: Pick<RealtimeStore, "getVisitorCount">;
};

export function createBillingService(
  db: Pick<Database, "select" | "update" | "insert">,
  deps: BillingServiceDeps = {},
) {
  return {
    getPlan,
    getOverview,
    canCreateSite,
    updatePlan,
    getCustomerId,
    claimWebhookEvent,
  };

  // Returns false when this provider event id was already applied. The row is
  // inserted before the state change, so a concurrent/replayed delivery is a
  // no-op.
  async function claimWebhookEvent(provider: string, eventId: string): Promise<boolean> {
    const [row] = await db
      .insert(webhookEvent)
      .values({ provider, eventId })
      .onConflictDoNothing()
      .returning({ id: webhookEvent.id });
    return Boolean(row);
  }

  // Applies a subscription change from Stripe (SRS FR-BIL-05). Upserts onto the
  // org's subscription row so an organization created after sign-up still gets
  // billed; plan defaults are kept when the event omits a plan.
  async function updatePlan(input: {
    organizationId: string;
    plan: import("@repo/contracts/billing").Plan | null;
    status: string;
    renewsAt: Date | null;
    customerId?: string | null;
    cancelAtPeriodEnd?: boolean;
  }): Promise<void> {
    const plan = input.plan ?? "free";
    const values: Partial<typeof subscription.$inferInsert> = {
      status: input.status,
      renewsAt: input.renewsAt,
      ...(input.cancelAtPeriodEnd === undefined
        ? {}
        : { cancelAtPeriodEnd: input.cancelAtPeriodEnd }),
    };
    if (input.plan) {
      values.plan = input.plan;
      values.trafficQuota = planLimits[input.plan].trafficQuota;
    }
    if (input.customerId) values.externalCustomerId = input.customerId;
    await db
      .insert(subscription)
      .values({
        organizationId: input.organizationId,
        plan,
        status: input.status,
        trafficQuota: planLimits[plan].trafficQuota,
        renewsAt: input.renewsAt,
        cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
        ...(input.customerId ? { externalCustomerId: input.customerId } : {}),
      })
      .onConflictDoUpdate({ target: subscription.organizationId, set: values });
  }

  async function getCustomerId(organizationId: string): Promise<string | null> {
    const [row] = await db
      .select({ customerId: subscription.externalCustomerId })
      .from(subscription)
      .where(eq(subscription.organizationId, organizationId))
      .limit(1);
    return row?.customerId ?? null;
  }

  // The plan that actually grants entitlements. A stored paid plan whose
  // subscription is past_due/unpaid/canceled/paused falls back to Free.
  async function getPlan(organizationId: string): Promise<Plan> {
    const [row] = await db
      .select({ plan: subscription.plan, status: subscription.status })
      .from(subscription)
      .where(eq(subscription.organizationId, organizationId))
      .limit(1);
    return effectivePlanFor((row?.plan ?? "free") as Plan, row?.status);
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
    const status = subRow?.status ?? "active";
    const effectivePlan = effectivePlanFor(plan, status);
    const limits = planLimits[effectivePlan];

    const sitesUsed = await countSites(organizationId);

    // Unique monthly visitors, as counted by the widget's visit beacon.
    if (deps.store) {
      const used = await deps.store.getVisitorCount(organizationId, currentMonthKey());
      return {
        plan,
        status,
        active: hasPaidAccess(status),
        effectivePlan,
        trafficQuota: limits.trafficQuota,
        usage: used,
        sitesUsed,
        maxSites: limits.maxSites,
        removeBadge: limits.removeBadge,
        customCode: limits.customCode,
        renewsAt: subRow?.renewsAt ? subRow.renewsAt.toISOString() : null,
        cancelAtPeriodEnd: Boolean(subRow?.cancelAtPeriodEnd),
        manageable: Boolean(subRow?.externalCustomerId),
      };
    }

    // Fallback: approximate usage from visit events across the org's sites.
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
      status,
      active: hasPaidAccess(status),
      effectivePlan,
      trafficQuota: limits.trafficQuota,
      usage,
      sitesUsed,
      maxSites: limits.maxSites,
      removeBadge: limits.removeBadge,
      customCode: limits.customCode,
      renewsAt: subRow?.renewsAt ? subRow.renewsAt.toISOString() : null,
      cancelAtPeriodEnd: Boolean(subRow?.cancelAtPeriodEnd),
      manageable: Boolean(subRow?.externalCustomerId),
    };
  }
}
