import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { toast } from "@repo/ui/components/sonner";
import { useMutation, useQueries, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CheckIcon, CircleIcon, SendIcon } from "lucide-react";
import { activationQueryOptions } from "../../analytics/hooks/use-analytics";
import { meQueryOptions } from "../../auth/hooks/use-auth";
import { notificationsQueryOptions } from "../../notifications/hooks/use-notifications";
import { sitesQueryOptions } from "../../sites/hooks/use-sites";
import { sendTestEvent } from "../../sites/services";
import { AppShell } from "../../app-shell/app-shell";

function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return "under a minute";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  return `${hours} h`;
}

export function OverviewPage() {
  const user = useQuery(meQueryOptions);
  const sites = useQuery(sitesQueryOptions);
  const firstSiteId = sites.data?.[0]?.id ?? "";
  // Onboarding is organization-wide: a notification on the second site still
  // counts as "first notification created/shown".
  const siteIds = (sites.data ?? []).map((site) => site.id);
  const notifications = useQueries({
    queries: siteIds.map((siteId) => notificationsQueryOptions(siteId)),
  });
  const activation = useQueries({
    queries: siteIds.map((siteId) => activationQueryOptions(siteId)),
  });

  const hasSite = siteIds.length > 0;
  const pixelVerified = sites.data?.some((site) => site.pixelVerifiedAt) ?? false;
  const notificationCount = notifications.reduce(
    (total, query) => total + (query.data?.length ?? 0),
    0,
  );
  const hasNotification = notificationCount > 0;
  const shown = activation.some((query) => query.data?.activated);

  const steps = [
    {
      done: hasSite,
      label: "Create your first site",
      description: "Add the domain where Tacto runs.",
      to: "/sites" as const,
    },
    {
      done: pixelVerified,
      label: "Install & verify the pixel",
      description: "Paste the snippet; we detect it automatically.",
      to: "/sites" as const,
    },
    {
      done: hasNotification,
      label: "Create your first notification",
      description: "Sales pop, counter, live visitors or custom.",
      to: "/notifications" as const,
    },
    {
      done: shown,
      label: "Show your first notification",
      description: "Visit your site — the pixel renders it automatically.",
      to: "/analytics" as const,
    },
  ];
  const completed = steps.filter((step) => step.done).length;
  const msToActivation =
    activation.find((query) => query.data?.msToActivation != null)?.data?.msToActivation ?? null;

  // Lets the user trigger their first notification without a real transaction
  // (feedback T5/T14): injects a demo event into the first site.
  const testEvent = useMutation({
    mutationFn: () => sendTestEvent(firstSiteId),
    onSuccess: () =>
      toast.success("Test event sent", {
        description: "Open your site to see the notification appear.",
      }),
    onError: (error) => toast.error(error.message),
  });

  return (
    <AppShell>
      <section className="grid gap-6">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            Welcome{user.data ? `, ${user.data.name.split(" ")[0]}` : ""}
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight">Overview</h1>
        </div>

        {completed < steps.length ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Get started ({completed}/{steps.length})
              </CardTitle>
              <CardDescription>
                Finish setup to show your first notification — usually under 10 minutes.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              {steps.map((step) => (
                <Link
                  key={step.label}
                  to={step.to}
                  className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/60"
                >
                  <span
                    className={`flex size-7 flex-none items-center justify-center rounded-full ${
                      step.done
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {step.done ? (
                      <CheckIcon className="size-4" />
                    ) : (
                      <CircleIcon className="size-3.5" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span
                      className={`block font-medium ${step.done ? "text-muted-foreground line-through" : ""}`}
                    >
                      {step.label}
                    </span>
                    <span className="block text-sm text-muted-foreground">{step.description}</span>
                  </span>
                </Link>
              ))}
              {hasSite && hasNotification && !shown ? (
                <div className="mt-1 flex flex-wrap items-center gap-2 rounded-lg border border-dashed p-3">
                  <span className="text-sm text-muted-foreground">
                    Want to see it right away? Send a demo event to your first site.
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!firstSiteId || testEvent.isPending}
                    onClick={() => testEvent.mutate()}
                  >
                    <SendIcon className="size-4" /> Send test event
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">You’re live 🎉</CardTitle>
              <CardDescription>
                Your pixel is installed and notifications are running. Check how they perform.
                {msToActivation !== null
                  ? ` First notification shown in ${formatDuration(msToActivation)}.`
                  : ""}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link to="/analytics">View analytics</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <QuickStat label="Sites" value={sites.data?.length ?? 0} to="/sites" />
          <QuickStat label="Notifications" value={notificationCount} to="/notifications" />
          <QuickStat label="Pixel" value={pixelVerified ? "Verified" : "Pending"} to="/sites" />
        </div>
      </section>
    </AppShell>
  );
}

function QuickStat({
  label,
  value,
  to,
}: {
  label: string;
  value: number | string;
  to: "/sites" | "/notifications";
}) {
  return (
    <Link to={to}>
      <Card className="transition-colors hover:border-primary/40">
        <CardContent className="pt-6">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-extrabold tabular-nums tracking-tight">
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
