import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { createSite, deleteSite, listSites, updateSite } from "../services";

export const sitesQueryKey = ["sites"] as const;

export const sitesQueryOptions = queryOptions({
  queryKey: sitesQueryKey,
  queryFn: listSites,
});

export function useCreateSiteMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createSite,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sitesQueryKey }),
  });
}

export function useUpdateSiteMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string; name?: string; domain?: string }) =>
      updateSite(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sitesQueryKey }),
  });
}

export function useDeleteSiteMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteSite,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sitesQueryKey }),
  });
}
