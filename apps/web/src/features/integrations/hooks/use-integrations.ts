import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { createIntegration, deleteIntegration, listIntegrations } from "../services";

export const integrationsQueryOptions = queryOptions({
  queryKey: ["integrations"],
  queryFn: listIntegrations,
});

export function useCreateIntegrationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createIntegration,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["integrations"] }),
  });
}

export function useDeleteIntegrationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteIntegration,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["integrations"] }),
  });
}
