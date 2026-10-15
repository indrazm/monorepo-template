import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CheckIcon, CircleIcon } from "lucide-react";
import { activationQueryOptions } from "../../analytics/hooks/use-analytics";
import { meQueryOptions } from "../../auth/hooks/use-auth";
import { notificationsQueryOptions } from "../../notifications/hooks/use-notifications";
import { sitesQueryOptions } from "../../sites/hooks/use-sites";
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
  const notifications = useQuery(notificationsQueryOptions(firstSiteId));
  const activation = useQuery(activationQueryOptions(firstSiteId));

  const hasSite = (sites.data?.length ?? 0) > 0;
  const pixelVerified = sites.data?.some((site) => site.pixelVerifiedAt) ?? false;
  const hasNotification = (notifications.data?.length ?? 0) > 0;
  const shown = activation.data?.activated ?? false;

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
  const msToActivation = activation.data?.msToActivation ?? null;

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
          <QuickStat
            label="Notifications"
            value={notifications.data?.length ?? 0}
            to="/notifications"
          />
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
