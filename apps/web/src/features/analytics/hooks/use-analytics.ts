import { queryOptions, useInfiniteQuery } from "@tanstack/react-query";
import {
  type EventsFeedFilters,
  type SummaryParams,
  getActivation,
  getEventsFeed,
  getSummary,
} from "../services";

export function summaryQueryOptions(siteId: string, params: SummaryParams = {}) {
  return queryOptions({
    queryKey: ["analytics", "summary", siteId, params],
    queryFn: () => getSummary(siteId, params),
    enabled: siteId.length > 0,
  });
}

// Keyset-paginated events feed (newest first) with a "load more" flow and
// optional type/source/verified/search filters (FR-ING-11).
export function useInfiniteEventsFeed(siteId: string, filters: EventsFeedFilters = {}) {
  return useInfiniteQuery({
    queryKey: ["analytics", "events", siteId, filters],
    queryFn: ({ pageParam }) => getEventsFeed(siteId, 50, pageParam ?? undefined, filters),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: siteId.length > 0,
  });
}

export function activationQueryOptions(siteId: string) {
  return queryOptions({
    queryKey: ["analytics", "activation", siteId],
    queryFn: () => getActivation(siteId),
    enabled: siteId.length > 0,
  });
}
