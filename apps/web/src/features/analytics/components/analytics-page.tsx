import type { EventRecord } from "@repo/contracts/events";
import { eventSources } from "@repo/contracts/events";
import { eventTypes } from "@repo/contracts/notifications";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  BarChart3Icon,
  DownloadIcon,
  MousePointerClickIcon,
  PercentIcon,
  EyeIcon,
  GiftIcon,
} from "lucide-react";
import { useState } from "react";
import { AppShell } from "../../app-shell/app-shell";
import { downloadSiteEvents } from "../../sites/services";
import { toast } from "@repo/ui/components/sonner";
import { sitesQueryOptions } from "../../sites/hooks/use-sites";
import type { EventsFeedFilters, SummaryParams } from "../services";
import { summaryQueryOptions, useInfiniteEventsFeed } from "../hooks/use-analytics";
import { TrendChart } from "./trend-chart";

const RANGES = [
  { key: "24h", label: "24h", days: 1 },
  { key: "7d", label: "7 days", days: 7 },
  { key: "30d", label: "30 days", days: 30 },
  { key: "90d", label: "90 days", days: 90 },
] as const;
type RangeKey = (typeof RANGES)[number]["key"];

const selectClass =
  "border-input bg-background focus-visible:ring-ring h-10 rounded-md border px-3 text-sm focus-visible:ring-[3px] focus-visible:outline-none";

export function AnalyticsPage() {
  const sites = useQuery(sitesQueryOptions);
  const [siteId, setSiteId] = useState("");
  const activeSiteId = siteId || sites.data?.[0]?.id || "";
  const [range, setRange] = useState<RangeKey | "custom">("7d");
  const [compare, setCompare] = useState(true);
  const [includeBots, setIncludeBots] = useState(false);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const customActive = range === "custom" && customFrom !== "" && customTo !== "";
  const summaryParams: SummaryParams = customActive
    ? {
        from: new Date(`${customFrom}T00:00:00`).toISOString(),
        to: new Date(`${customTo}T23:59:59`).toISOString(),
        compare,
        includeBots,
      }
    : {
        days: RANGES.find((r) => r.key === range)?.days ?? 7,
        compare,
        includeBots,
      };
  const summary = useQuery(summaryQueryOptions(activeSiteId, summaryParams));
  const [filters, setFilters] = useState<EventsFeedFilters>({});
  const events = useInfiniteEventsFeed(activeSiteId, filters);
  const eventRows = events.data?.pages.flatMap((page) => page.events) ?? [];

  const ctr = summary.data ? `${(summary.data.ctr * 100).toFixed(1)}%` : "—";
  const abTests = summary.data?.abTests ?? [];
  const previous = summary.data?.previous ?? null;

  function exportSummaryCsv() {
    const rows = summary.data?.perDay ?? [];
    const header = "date,impressions,clicks,rewards";
    const body = rows.map((r) => `${r.date},${r.views},${r.clicks},${r.claims}`).join("\n");
    const blob = new Blob([`${header}\n${body}\n`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `tacto-analytics-${activeSiteId}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

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
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1">
                {RANGES.map((option) => (
                  <Button
                    key={option.key}
                    type="button"
                    size="sm"
                    variant={range === option.key ? "secondary" : "ghost"}
                    onClick={() => setRange(option.key)}
                  >
                    {option.label}
                  </Button>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant={range === "custom" ? "secondary" : "ghost"}
                  onClick={() => setRange("custom")}
                >
                  Custom
                </Button>
                {range === "custom" ? (
                  <span className="flex items-center gap-1">
                    <Input
                      type="date"
                      aria-label="From"
                      className="h-8 w-auto"
                      value={customFrom}
                      max={customTo || undefined}
                      onChange={(e) => setCustomFrom(e.target.value)}
                    />
                    <span className="text-xs text-muted-foreground">to</span>
                    <Input
                      type="date"
                      aria-label="To"
                      className="h-8 w-auto"
                      value={customTo}
                      min={customFrom || undefined}
                      onChange={(e) => setCustomTo(e.target.value)}
                    />
                  </span>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={compare}
                    onChange={(e) => setCompare(e.target.checked)}
                  />
                  Compare to previous
                </label>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={includeBots}
                    onChange={(e) => setIncludeBots(e.target.checked)}
                  />
                  Include bots
                </label>
                <Button type="button" size="sm" variant="outline" onClick={exportSummaryCsv}>
                  <DownloadIcon className="size-4" /> Export CSV
                </Button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile
                label="Impressions"
                value={summary.data?.views ?? 0}
                previous={previous?.views}
                icon={<EyeIcon className="size-4" />}
              />
              <StatTile
                label="Clicks"
                value={summary.data?.clicks ?? 0}
                previous={previous?.clicks}
                icon={<MousePointerClickIcon className="size-4" />}
              />
              <StatTile label="CTR" value={ctr} icon={<PercentIcon className="size-4" />} />
              <StatTile
                label="Rewards claimed"
                value={summary.data?.claims ?? 0}
                previous={previous?.claims}
                icon={<GiftIcon className="size-4" />}
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Trend</CardTitle>
                <CardDescription>Impressions, clicks and rewards over time.</CardDescription>
              </CardHeader>
              <CardContent>
                <TrendChart data={summary.data?.perDay ?? []} />
              </CardContent>
            </Card>

            <AudienceBreakdown audience={summary.data?.audience} />

            {summary.data && summary.data.notifications.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Per notification</CardTitle>
                  <CardDescription>
                    Which notification actually performs — views, clicks, reward claims and CTR.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-muted-foreground">
                        <th className="pb-2">Notification</th>
                        <th className="pb-2">Type</th>
                        <th className="pb-2 text-right">Views</th>
                        <th className="pb-2 text-right">Clicks</th>
                        <th className="pb-2 text-right">Claims</th>
                        <th className="pb-2 text-right">CTR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.data.notifications.map((row) => (
                        <tr key={row.notificationId} className="border-t">
                          <td className="py-2 font-medium">
                            <span className="inline-flex items-center gap-2">
                              {row.name}
                              {!row.isActive ? (
                                <Badge variant="secondary" className="text-xs">
                                  Paused
                                </Badge>
                              ) : null}
                            </span>
                          </td>
                          <td className="py-2 text-muted-foreground">{row.type}</td>
                          <td className="py-2 text-right tabular-nums">{row.views}</td>
                          <td className="py-2 text-right tabular-nums">{row.clicks}</td>
                          <td className="py-2 text-right tabular-nums">{row.claims}</td>
                          <td className="py-2 text-right tabular-nums">
                            {(row.ctr * 100).toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            ) : null}

            {abTests.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">A/B significance</CardTitle>
                  <CardDescription>
                    Variant leader with a two-proportion z-test against the runner-up.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-2">
                  {abTests.map((test) => (
                    <div
                      key={test.notificationId}
                      className="flex flex-wrap items-center justify-between gap-2 border-t pt-2 text-sm first:border-t-0"
                    >
                      <span className="font-medium">{test.name}</span>
                      <span className="text-muted-foreground">
                        Leader <strong>{test.leaderVariantId}</strong>
                        {test.runnerUpVariantId ? ` vs ${test.runnerUpVariantId}` : ""}
                      </span>
                      <span className="flex items-center gap-2">
                        {test.pValue !== null ? (
                          <span className="text-xs text-muted-foreground">
                            p = {test.pValue.toFixed(3)}
                          </span>
                        ) : null}
                        {test.significant ? (
                          <Badge>Significant</Badge>
                        ) : test.enoughData ? (
                          <Badge variant="secondary">No clear winner</Badge>
                        ) : (
                          <Badge variant="outline">Collecting data</Badge>
                        )}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : null}

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
                        <th className="pb-2 text-right">95% CI</th>
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
                          <td className="py-2 text-right tabular-nums text-xs text-muted-foreground">
                            {(variant.ctrLow * 100).toFixed(1)}–{(variant.ctrHigh * 100).toFixed(1)}
                            %
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
                <div className="grid gap-1.5">
                  <CardTitle className="text-base">Events feed</CardTitle>
                  <CardDescription>
                    Filter the raw events that power your notifications.
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    downloadSiteEvents(activeSiteId, "csv").catch(() =>
                      toast.error("Could not export events."),
                    )
                  }
                >
                  <DownloadIcon className="size-4" /> Export
                </Button>
              </CardHeader>
              <CardContent>
                <div className="mb-4 grid gap-3 sm:grid-cols-4">
                  <div className="grid gap-1">
                    <Label htmlFor="f-type" className="text-xs">
                      Type
                    </Label>
                    <select
                      id="f-type"
                      className={selectClass}
                      value={filters.type ?? ""}
                      onChange={(e) =>
                        setFilters((f) => ({
                          ...f,
                          type: (e.target.value || undefined) as EventsFeedFilters["type"],
                        }))
                      }
                    >
                      <option value="">All types</option>
                      {eventTypes.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="f-source" className="text-xs">
                      Source
                    </Label>
                    <select
                      id="f-source"
                      className={selectClass}
                      value={filters.source ?? ""}
                      onChange={(e) =>
                        setFilters((f) => ({
                          ...f,
                          source: (e.target.value || undefined) as EventsFeedFilters["source"],
                        }))
                      }
                    >
                      <option value="">All sources</option>
                      {eventSources.map((source) => (
                        <option key={source} value={source}>
                          {source}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="f-verified" className="text-xs">
                      Verified
                    </Label>
                    <select
                      id="f-verified"
                      className={selectClass}
                      value={filters.verified === undefined ? "" : String(filters.verified)}
                      onChange={(e) =>
                        setFilters((f) => ({
                          ...f,
                          verified: e.target.value === "" ? undefined : e.target.value === "true",
                        }))
                      }
                    >
                      <option value="">Any</option>
                      <option value="true">Verified only</option>
                      <option value="false">Unverified only</option>
                    </select>
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="f-q" className="text-xs">
                      Search
                    </Label>
                    <Input
                      id="f-q"
                      placeholder="Name or city"
                      value={filters.q ?? ""}
                      onChange={(e) =>
                        setFilters((f) => ({ ...f, q: e.target.value || undefined }))
                      }
                    />
                  </div>
                </div>
                {eventRows.length > 0 ? (
                  <>
                    <ul className="divide-y">
                      {eventRows.map((event) => (
                        <EventRow key={event.id} event={event} />
                      ))}
                    </ul>
                    {events.hasNextPage ? (
                      <div className="pt-4 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={events.isFetchingNextPage}
                          onClick={() => void events.fetchNextPage()}
                        >
                          {events.isFetchingNextPage ? "Loading…" : "Load more"}
                        </Button>
                      </div>
                    ) : null}
                  </>
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
  previous,
  icon,
}: {
  label: string;
  value: number | string;
  previous?: number;
  icon: React.ReactNode;
}) {
  // Percentage change vs the previous window, when both are numeric.
  const delta =
    typeof value === "number" && typeof previous === "number"
      ? previous === 0
        ? value > 0
          ? 1
          : 0
        : (value - previous) / previous
      : null;
  const up = delta !== null && delta > 0;
  const down = delta !== null && delta < 0;
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
            {icon}
          </span>
          {label}
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <p className="text-3xl font-extrabold tabular-nums tracking-tight">
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>
          {delta !== null && delta !== 0 ? (
            <span
              className={`inline-flex items-center gap-0.5 text-xs font-semibold ${
                up ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
              }`}
            >
              {up ? <ArrowUpIcon className="size-3" /> : null}
              {down ? <ArrowDownIcon className="size-3" /> : null}
              {Math.abs(delta * 100).toFixed(0)}%
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

type AudienceData = import("@repo/contracts/analytics").AnalyticsSummary["audience"];

// Audience breakdown (FR-ANL-02): top device/country/browser/pages for the
// window. Renders only the dimensions that have data (filled once the pixel
// reports them — see T4).
function AudienceBreakdown({ audience }: { audience?: AudienceData }) {
  if (!audience) return null;
  const groups: { title: string; rows: { key: string; count: number }[] }[] = [
    { title: "Devices", rows: audience.devices },
    { title: "Countries", rows: audience.countries },
    { title: "Browsers", rows: audience.browsers },
    { title: "Top pages", rows: audience.pages },
  ].filter((group) => group.rows.length > 0);
  if (groups.length === 0) return null;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {groups.map((group) => {
        const max = Math.max(...group.rows.map((r) => r.count), 1);
        return (
          <Card key={group.title}>
            <CardHeader>
              <CardTitle className="text-base">{group.title}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {group.rows.slice(0, 6).map((row) => (
                <div key={row.key} className="grid gap-1">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate" title={row.key}>
                      {row.key || "Unknown"}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {row.count.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.round((row.count / max) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
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
