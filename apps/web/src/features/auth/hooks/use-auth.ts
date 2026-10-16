import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { authQueryKey } from "../query-keys";
import { getCurrentUser, login, logout, register } from "../services";

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

export function useRegisterMutation() {
  // Sign-up no longer starts a session (email verification is required), so the
  // page stays on screen and shows a "check your email" state instead of
  // navigating into the dashboard.
  return useMutation({
    mutationFn: register,
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
