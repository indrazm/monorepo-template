import { queryOptions } from "@tanstack/react-query";
import { getEventsFeed, getSummary } from "../services";

export function summaryQueryOptions(siteId: string, days = 7) {
  return queryOptions({
    queryKey: ["analytics", "summary", siteId, days],
    queryFn: () => getSummary(siteId, days),
    enabled: siteId.length > 0,
  });
}

export function eventsFeedQueryOptions(siteId: string) {
  return queryOptions({
    queryKey: ["analytics", "events", siteId],
    queryFn: () => getEventsFeed(siteId),
    enabled: siteId.length > 0,
  });
}
