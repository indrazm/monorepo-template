import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createIntegration,
  deleteIntegration,
  listIntegrations,
  updateIntegration,
  verifyIntegration,
} from "../services";

export const integrationsQueryOptions = queryOptions({
  queryKey: ["integrations"],
  queryFn: listIntegrations,
});

function useIntegrationMutation<TInput, TResult>(mutationFn: (input: TInput) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["integrations"] }),
  });
}

export function useCreateIntegrationMutation() {
  return useIntegrationMutation(createIntegration);
}

export function useUpdateIntegrationMutation() {
  return useIntegrationMutation(updateIntegration);
}

// "Verify" writes status/lastError on the server, so the list is refetched.
export function useVerifyIntegrationMutation() {
  return useIntegrationMutation(verifyIntegration);
}

export function useDeleteIntegrationMutation() {
  return useIntegrationMutation(deleteIntegration);
}
