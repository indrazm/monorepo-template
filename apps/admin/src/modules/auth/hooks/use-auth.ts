import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { authQueryKey } from "../schema";
import { getCurrentUser, login, logout } from "../services";

export const meQueryOptions = queryOptions({
  queryKey: [...authQueryKey, "me"],
  queryFn: getCurrentUser,
  retry: false,
});

export function useLoginMutation() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: login,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: authQueryKey });
      await navigate({ to: "/" });
    },
  });
}

export function useLogoutMutation() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: logout,
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: authQueryKey });
      await navigate({ to: "/login" });
    },
  });
}
