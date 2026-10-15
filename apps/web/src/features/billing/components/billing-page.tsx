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
import { apiClient } from "../../../api";
import { AppShell } from "../../app-shell/app-shell";

type PaidPlan = "starter" | "growth" | "agency";

async function startCheckout(plan: PaidPlan): Promise<string> {
  const response = await apiClient.api.v1.billing.checkout.$post({ json: { plan } });
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
const plansQueryOptions = queryOptions({
  queryKey: ["billing", "plans"],
  queryFn: async () => {
    const response = await apiClient.api.v1.billing.plans.$get();
    if (!response.ok) throw new Error("Failed to load plans.");
    return (await response.json()).plans;
  },
  staleTime: 5 * 60_000,
});

function formatPrice(offer: PlanOffer): string {
  if (offer.amount === null) return "custom pricing";
  if (offer.amount === 0) return "Free";
  const value = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: offer.currency,
    maximumFractionDigits: offer.amount % 100 === 0 ? 0 : 2,
  }).format(offer.amount / 100);
  return `${value}/${offer.interval}`;
}

function formatLimits(offer: PlanOffer): string {
  const sites = offer.maxSites === 1 ? "1 site" : `${offer.maxSites} sites`;
  return `${offer.trafficQuota.toLocaleString()} visitors · ${sites}`;
}

export function BillingPage() {
  const billing = useQuery(billingQueryOptions);
  const plans = useQuery(plansQueryOptions);
  const overview = billing.data;
  const usagePct = overview
    ? Math.min(100, (overview.usage / Math.max(1, overview.trafficQuota)) * 100)
    : 0;
  const overQuota = overview ? overview.usage > overview.trafficQuota : false;
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

  const upgrades = (plans.data ?? []).filter(
    (offer) => offer.plan !== "free" && offer.plan !== overview?.plan,
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

        {overview ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {planLabels[overview.plan] ?? overview.plan} plan
                  {overview.plan === "free" ? <Badge variant="secondary">Free</Badge> : null}
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
                    <span className="text-muted-foreground">Renews</span>
                    <span className="font-medium">
                      {new Date(overview.renewsAt).toLocaleDateString()}
                    </span>
                  </div>
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
                <CardTitle>Upgrade</CardTitle>
                <CardDescription>
                  Unlock more traffic, extra sites, all notification types and remove the badge.
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
                      onClick={() => checkout.mutate(offer.plan as PaidPlan)}
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
                    Secure checkout via Stripe. You can cancel anytime.
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
