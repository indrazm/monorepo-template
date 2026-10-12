import type { AnalyticsSummary } from "@repo/contracts/analytics";
import type { EventRecord } from "@repo/contracts/events";
import { apiClient } from "../../api";

const analytics = apiClient.api.v1.analytics;

export async function getSummary(siteId: string, days = 7): Promise<AnalyticsSummary> {
  const response = await analytics.summary.$get({ query: { siteId, days: String(days) } });
  if (!response.ok) throw new Error("Failed to load analytics.");
  const data = await response.json();
  return data.summary;
}

export async function getEventsFeed(siteId: string, limit = 50): Promise<EventRecord[]> {
  const response = await analytics.events.$get({ query: { siteId, limit: String(limit) } });
  if (!response.ok) throw new Error("Failed to load events.");
  const data = await response.json();
  return data.events;
}
