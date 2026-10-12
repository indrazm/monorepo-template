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
import { useQuery } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { apiClient } from "../../../api";
import { AppShell } from "../../app-shell/app-shell";

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
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Upgrade</CardTitle>
                <CardDescription>
                  Unlock more traffic, extra sites, all notification types and remove the badge.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                <Button disabled>Upgrade plan (coming soon)</Button>
                <p className="text-xs text-muted-foreground">
                  Payments arrive with Stripe in phase 2.
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
