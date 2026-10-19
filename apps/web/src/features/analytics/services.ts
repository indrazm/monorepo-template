import type { Activation, AnalyticsSummary } from "@repo/contracts/analytics";
import type { EventRecord, EventSource } from "@repo/contracts/events";
import type { EventType } from "@repo/contracts/notifications";
import { apiClient } from "../../api";

const analytics = apiClient.api.v1.analytics;

export type SummaryParams = {
  days?: number;
  from?: string;
  to?: string;
  compare?: boolean;
  includeBots?: boolean;
};

export async function getSummary(
  siteId: string,
  params: SummaryParams = {},
): Promise<AnalyticsSummary> {
  const response = await analytics.summary.$get({
    query: {
      siteId,
      days: String(params.days ?? 7),
      ...(params.from ? { from: params.from } : {}),
      ...(params.to ? { to: params.to } : {}),
      ...(params.compare ? { compare: "true" as const } : {}),
      ...(params.includeBots ? { includeBots: "true" as const } : {}),
    },
  });
  if (!response.ok) throw new Error("Failed to load analytics.");
  const data = await response.json();
  return data.summary;
}

export type EventsFeedPage = { events: EventRecord[]; nextCursor: string | null };

export type EventsFeedFilters = {
  type?: EventType;
  source?: EventSource;
  verified?: boolean;
  q?: string;
};

export async function getEventsFeed(
  siteId: string,
  limit = 50,
  cursor?: string,
  filters: EventsFeedFilters = {},
): Promise<EventsFeedPage> {
  const verified = filters.verified === undefined ? undefined : filters.verified ? "true" : "false";
  const response = await analytics.events.$get({
    query: {
      siteId,
      limit: String(limit),
      ...(cursor ? { cursor } : {}),
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.source ? { source: filters.source } : {}),
      ...(verified ? { verified } : {}),
      ...(filters.q ? { q: filters.q } : {}),
    },
  });
  if (!response.ok) throw new Error("Failed to load events.");
  return (await response.json()) as EventsFeedPage;
}

export async function getActivation(siteId: string): Promise<Activation> {
  const response = await analytics.activation.$get({ query: { siteId } });
  if (!response.ok) throw new Error("Failed to load activation.");
  const data = await response.json();
  return data.activation;
}
