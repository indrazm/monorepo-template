import { planLabels, type PlanOffer } from "@repo/contracts/billing";
import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { Progress } from "@repo/ui/components/progress";
import { toast } from "@repo/ui/components/sonner";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { TriangleAlertIcon } from "lucide-react";
import { useState } from "react";
import { apiClient } from "../../../api";
import { AppShell } from "../../app-shell/app-shell";

type PaidPlan = "starter" | "growth" | "agency";
type BillingInterval = "month" | "year";

async function startCheckout(args: { plan: PaidPlan; interval: BillingInterval }): Promise<string> {
  const response = await apiClient.api.v1.billing.checkout.$post({ json: args });
  if (response.status === 400) {
    throw new Error("Billing is not configured yet (missing Stripe keys).");
  }
  if (!response.ok) throw new Error("Could not start checkout.");
  return (await response.json()).url;
}

async function openPortal(): Promise<string> {
  const response = await apiClient.api.v1.billing.portal.$post();
  if (!response.ok) throw new Error("Could not open the billing portal.");
  return (await response.json()).url;
}

const billingQueryOptions = queryOptions({
  queryKey: ["billing"],
  queryFn: async () => {
    const response = await apiClient.api.v1.billing.$get();
    if (!response.ok) throw new Error("Failed to load billing.");
    return (await response.json()).overview;
  },
});

// Prices come from the Stripe Price that Checkout charges — never hardcoded
// here, so the page and the invoice cannot disagree (audit finding F).
function plansQuery(interval: BillingInterval) {
  return queryOptions({
    queryKey: ["billing", "plans", interval],
    queryFn: async () => {
      const response = await apiClient.api.v1.billing.plans.$get({ query: { interval } });
      if (!response.ok) throw new Error("Failed to load plans.");
      return (await response.json()).plans;
    },
    staleTime: 5 * 60_000,
  });
}

function formatPrice(offer: PlanOffer): string {
  if (offer.amount === null) return "custom pricing";
  if (offer.amount === 0) return "Free";
  const value = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: offer.currency,
    maximumFractionDigits: offer.amount % 100 === 0 ? 0 : 2,
  }).format(offer.amount / 100);
  return `${value}/${offer.interval === "year" ? "yr" : "mo"}`;
}

function formatLimits(offer: PlanOffer): string {
  const sites = offer.maxSites === 1 ? "1 site" : `${offer.maxSites} sites`;
  return `${offer.trafficQuota.toLocaleString()} visitors · ${sites}`;
}

export function BillingPage() {
  const [interval, setInterval] = useState<BillingInterval>("month");
  const billing = useQuery(billingQueryOptions);
  const plans = useQuery(plansQuery(interval));
  const overview = billing.data;
  const effectivePlan = overview?.effectivePlan ?? overview?.plan ?? "free";
  const trialDays = plans.data?.find((offer) => offer.trialDays > 0)?.trialDays ?? 0;
  const usagePct = overview
    ? Math.min(100, (overview.usage / Math.max(1, overview.trafficQuota)) * 100)
    : 0;
  const overQuota = overview ? overview.usage >= overview.trafficQuota : false;
  const nearQuota = !overQuota && usagePct >= 80;
  const checkout = useMutation({
    mutationFn: startCheckout,
    onSuccess: (url) => {
      window.location.href = url;
    },
    onError: (error) => toast.error(error.message),
  });
  const portal = useMutation({
    mutationFn: openPortal,
    onSuccess: (url) => {
      window.location.href = url;
    },
    onError: (error) => toast.error(error.message),
  });

  const planOrder = ["free", "starter", "growth", "agency"] as const;
  const currentRank = planOrder.indexOf(effectivePlan as (typeof planOrder)[number]);
  const upgrades = (plans.data ?? []).filter(
    (offer) =>
      offer.plan !== "free" &&
      planOrder.indexOf(offer.plan as (typeof planOrder)[number]) > currentRank,
  );

  return (
    <AppShell>
      <section className="grid gap-6">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Workspace</p>
          <h1 className="text-3xl font-extrabold tracking-tight">Billing</h1>
        </div>

        {/* The quota is enforced, so it gets a real warning (FR-BIL-01). */}
        {overQuota ? (
          <Alert variant="destructive">
            <TriangleAlertIcon />
            <AlertTitle>Notifications are paused</AlertTitle>
            <AlertDescription>
              Your workspace passed its monthly visitor quota, so Tacto has stopped showing
              notifications on your sites. Upgrade to switch them back on immediately — the quota
              otherwise resets at the start of next month.
            </AlertDescription>
          </Alert>
        ) : nearQuota ? (
          <Alert>
            <TriangleAlertIcon />
            <AlertTitle>You have used {Math.round(usagePct)}% of your visitor quota</AlertTitle>
            <AlertDescription>
              Notifications stop showing once the quota is reached.
            </AlertDescription>
          </Alert>
        ) : null}

        {overview && !overview.active ? (
          <Alert variant="destructive">
            <TriangleAlertIcon />
            <AlertTitle>Your subscription is {overview.status}</AlertTitle>
            <AlertDescription>
              Paid features have fallen back to the Free plan until the subscription is active
              again. Update your payment method in the billing portal.
            </AlertDescription>
          </Alert>
        ) : null}

        {overview ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {planLabels[effectivePlan] ?? effectivePlan} plan
                  {effectivePlan === "free" ? <Badge variant="secondary">Free</Badge> : null}
                </CardTitle>
                <CardDescription>
                  {overview.removeBadge
                    ? "The “Powered by Tacto” badge is hidden on your sites."
                    : "Free tier shows the “Powered by Tacto” badge."}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-muted-foreground">Unique visitors this month</span>
                    <span className="font-medium tabular-nums">
                      {overview.usage.toLocaleString()} / {overview.trafficQuota.toLocaleString()}
                    </span>
                  </div>
                  <Progress value={usagePct} />
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Sites</span>
                  <span className="font-medium tabular-nums">
                    {overview.sitesUsed} / {overview.maxSites}
                  </span>
                </div>
                {overview.renewsAt ? (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {overview.cancelAtPeriodEnd ? "Ends" : "Renews"}
                    </span>
                    <span className="font-medium">
                      {new Date(overview.renewsAt).toLocaleDateString()}
                    </span>
                  </div>
                ) : null}
                {overview.cancelAtPeriodEnd ? (
                  <p className="text-xs text-muted-foreground">
                    This subscription is set to cancel at the end of the current period.
                  </p>
                ) : null}
                {overview.manageable ? (
                  <Button
                    variant="outline"
                    disabled={portal.isPending}
                    onClick={() => portal.mutate()}
                  >
                    Manage subscription
                  </Button>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center justify-between gap-2">
                  <span>Upgrade</span>
                  <span className="inline-flex rounded-lg border p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setInterval("month")}
                      className={`rounded-md px-2.5 py-1 font-semibold ${
                        interval === "month"
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground"
                      }`}
                    >
                      Monthly
                    </button>
                    <button
                      type="button"
                      onClick={() => setInterval("year")}
                      className={`rounded-md px-2.5 py-1 font-semibold ${
                        interval === "year"
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground"
                      }`}
                    >
                      Annual
                    </button>
                  </span>
                </CardTitle>
                <CardDescription>
                  Unlock more traffic, extra sites, all notification types and remove the badge.
                  {trialDays > 0 ? ` Start with a ${trialDays}-day free trial.` : ""}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2">
                {plans.isLoading ? (
                  <p className="text-sm text-muted-foreground">Loading plans…</p>
                ) : upgrades.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    You are on the highest plan available.
                  </p>
                ) : (
                  upgrades.map((offer) => (
                    <Button
                      key={offer.plan}
                      variant={offer.plan === "growth" ? "default" : "ghost"}
                      className={offer.plan === "growth" ? "" : "border"}
                      disabled={checkout.isPending || !offer.purchasable}
                      title={
                        offer.purchasable
                          ? undefined
                          : "This plan has no Stripe Price configured yet."
                      }
                      onClick={() => checkout.mutate({ plan: offer.plan as PaidPlan, interval })}
                    >
                      <span className="flex w-full items-center justify-between gap-3">
                        <span>Upgrade to {offer.label}</span>
                        <span className="text-xs opacity-80">
                          {formatPrice(offer)} · {formatLimits(offer)}
                        </span>
                      </span>
                    </Button>
                  ))
                )}
                {upgrades.some((offer) => offer.source === "fallback") ? (
                  <p className="text-xs text-muted-foreground">
                    Plans without a Stripe Price show an indicative amount and cannot be purchased
                    yet.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Secure checkout via Stripe.{" "}
                    {trialDays > 0 ? `${trialDays}-day free trial, then ` : ""}
                    {interval === "year" ? "billed annually. " : "billed monthly. "}
                    Cancel anytime, with a 14-day money-back guarantee.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              {billing.isLoading ? "Loading…" : "Could not load billing."}
            </CardContent>
          </Card>
        )}
      </section>
    </AppShell>
  );
}
