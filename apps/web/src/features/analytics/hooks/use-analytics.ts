import { queryOptions, useInfiniteQuery } from "@tanstack/react-query";
import { getActivation, getEventsFeed, getSummary } from "../services";

export function summaryQueryOptions(siteId: string, days = 7) {
  return queryOptions({
    queryKey: ["analytics", "summary", siteId, days],
    queryFn: () => getSummary(siteId, days),
    enabled: siteId.length > 0,
  });
}

// Keyset-paginated events feed (newest first) with a "load more" flow.
export function useInfiniteEventsFeed(siteId: string) {
  return useInfiniteQuery({
    queryKey: ["analytics", "events", siteId],
    queryFn: ({ pageParam }) => getEventsFeed(siteId, 50, pageParam ?? undefined),
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
