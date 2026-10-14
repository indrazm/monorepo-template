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
import { apiClient } from "../../../api";
import { AppShell } from "../../app-shell/app-shell";

type PaidPlan = "starter" | "growth" | "agency";
const UPGRADE_PLANS: { plan: PaidPlan; label: string; price: string }[] = [
  { plan: "starter", label: "Starter", price: "$12/mo · 10K visitors" },
  { plan: "growth", label: "Growth", price: "$35/mo · 100K visitors, 3 sites" },
  { plan: "agency", label: "Agency", price: "$79/mo · 200K visitors, 10 sites" },
];

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

const PLAN_LABEL: Record<string, string> = {
  free: "Free",
  starter: "Starter",
  growth: "Growth",
  agency: "Agency",
};

export function BillingPage() {
  const billing = useQuery(billingQueryOptions);
  const overview = billing.data;
  const usagePct = overview ? Math.min(100, (overview.usage / overview.trafficQuota) * 100) : 0;
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

  return (
    <AppShell>
      <section className="grid gap-6">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Workspace</p>
          <h1 className="text-3xl font-extrabold tracking-tight">Billing</h1>
        </div>

        {overview ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {PLAN_LABEL[overview.plan] ?? overview.plan} plan
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
                    <span className="text-muted-foreground">Monthly visitors</span>
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
                {UPGRADE_PLANS.filter((p) => p.plan !== overview.plan).map((p) => (
                  <Button
                    key={p.plan}
                    variant={p.plan === "growth" ? "default" : "ghost"}
                    className={p.plan === "growth" ? "" : "border"}
                    disabled={checkout.isPending}
                    onClick={() => checkout.mutate(p.plan)}
                  >
                    <span className="flex w-full items-center justify-between gap-3">
                      <span>Upgrade to {p.label}</span>
                      <span className="text-xs opacity-80">{p.price}</span>
                    </span>
                  </Button>
                ))}
                <p className="text-xs text-muted-foreground">
                  Secure checkout via Stripe. You can cancel anytime.
                </p>
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
