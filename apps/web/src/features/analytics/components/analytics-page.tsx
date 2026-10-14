import type { EventRecord } from "@repo/contracts/events";
import { Badge } from "@repo/ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { Label } from "@repo/ui/components/label";
import { useQuery } from "@tanstack/react-query";
import { BarChart3Icon, MousePointerClickIcon, PercentIcon, EyeIcon } from "lucide-react";
import { useState } from "react";
import { AppShell } from "../../app-shell/app-shell";
import { sitesQueryOptions } from "../../sites/hooks/use-sites";
import { eventsFeedQueryOptions, summaryQueryOptions } from "../hooks/use-analytics";

const selectClass =
  "border-input bg-background focus-visible:ring-ring h-9 rounded-md border px-3 text-sm focus-visible:ring-[3px] focus-visible:outline-none";

export function AnalyticsPage() {
  const sites = useQuery(sitesQueryOptions);
  const [siteId, setSiteId] = useState("");
  const activeSiteId = siteId || sites.data?.[0]?.id || "";
  const summary = useQuery(summaryQueryOptions(activeSiteId));
  const events = useQuery(eventsFeedQueryOptions(activeSiteId));

  const ctr = summary.data ? `${(summary.data.ctr * 100).toFixed(1)}%` : "—";

  return (
    <AppShell>
      <section className="grid gap-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Workspace</p>
            <h1 className="text-3xl font-extrabold tracking-tight">Analytics</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Impressions, clicks and the live events that power your notifications.
            </p>
          </div>
          {sites.data && sites.data.length > 0 ? (
            <div className="flex items-center gap-2">
              <Label htmlFor="a-site" className="text-sm text-muted-foreground">
                Site
              </Label>
              <select
                id="a-site"
                className={selectClass}
                value={activeSiteId}
                onChange={(e) => setSiteId(e.target.value)}
              >
                {sites.data.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>

        {activeSiteId ? (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <StatTile
                label="Impressions"
                value={summary.data?.views ?? 0}
                icon={<EyeIcon className="size-4" />}
              />
              <StatTile
                label="Clicks"
                value={summary.data?.clicks ?? 0}
                icon={<MousePointerClickIcon className="size-4" />}
              />
              <StatTile label="CTR" value={ctr} icon={<PercentIcon className="size-4" />} />
            </div>

            {summary.data && summary.data.variants.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">A/B variants</CardTitle>
                  <CardDescription>Views, clicks and CTR per variant.</CardDescription>
                </CardHeader>
                <CardContent>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-muted-foreground">
                        <th className="pb-2">Variant</th>
                        <th className="pb-2">Notification</th>
                        <th className="pb-2 text-right">Views</th>
                        <th className="pb-2 text-right">Clicks</th>
                        <th className="pb-2 text-right">CTR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.data.variants.map((variant) => (
                        <tr
                          key={`${variant.notificationId}:${variant.variantId}`}
                          className="border-t"
                        >
                          <td className="py-2 font-medium">{variant.variantId}</td>
                          <td className="py-2 text-muted-foreground">
                            {variant.notificationId.slice(0, 8)}
                          </td>
                          <td className="py-2 text-right tabular-nums">{variant.views}</td>
                          <td className="py-2 text-right tabular-nums">{variant.clicks}</td>
                          <td className="py-2 text-right tabular-nums">
                            {(variant.ctr * 100).toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Events feed</CardTitle>
              </CardHeader>
              <CardContent>
                {events.data && events.data.length > 0 ? (
                  <ul className="divide-y">
                    {events.data.map((event) => (
                      <EventRow key={event.id} event={event} />
                    ))}
                  </ul>
                ) : (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No events yet — install the pixel or send a test event to start.
                  </p>
                )}
              </CardContent>
            </Card>
          </>
        ) : (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Create a site to see its analytics.
            </CardContent>
          </Card>
        )}
      </section>
    </AppShell>
  );
}

function StatTile({
  label,
  value,
  icon,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
            {icon}
          </span>
          {label}
        </div>
        <p className="mt-3 text-3xl font-extrabold tabular-nums tracking-tight">
          {typeof value === "number" ? value.toLocaleString() : value}
        </p>
      </CardContent>
    </Card>
  );
}

function EventRow({ event }: { event: EventRecord }) {
  const who = [event.displayName, event.city].filter(Boolean).join(" · ") || "Anonymous";
  return (
    <li className="flex items-center justify-between gap-3 py-3 text-sm">
      <div className="flex items-center gap-3">
        <span className="flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <BarChart3Icon className="size-4" />
        </span>
        <div>
          <p className="font-medium">{who}</p>
          <p className="text-xs text-muted-foreground">
            {event.type} · {event.source}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {event.verified ? <Badge className="gap-1">Verified</Badge> : null}
        <span className="text-xs text-muted-foreground">
          {new Date(event.occurredAt).toLocaleString()}
        </span>
      </div>
    </li>
  );
}
