import type { Activation, AnalyticsSummary } from "@repo/contracts/analytics";
import type { EventRecord } from "@repo/contracts/events";
import { apiClient } from "../../api";

const analytics = apiClient.api.v1.analytics;

export async function getSummary(siteId: string, days = 7): Promise<AnalyticsSummary> {
  const response = await analytics.summary.$get({ query: { siteId, days: String(days) } });
  if (!response.ok) throw new Error("Failed to load analytics.");
  const data = await response.json();
  return data.summary;
}

export type EventsFeedPage = { events: EventRecord[]; nextCursor: string | null };

export async function getEventsFeed(
  siteId: string,
  limit = 50,
  cursor?: string,
): Promise<EventsFeedPage> {
  const response = await analytics.events.$get({
    query: { siteId, limit: String(limit), ...(cursor ? { cursor } : {}) },
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
