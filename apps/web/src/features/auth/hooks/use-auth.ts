import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { authQueryKey } from "../query-keys";
import { getCurrentUser, login, logout, register } from "../services";

export const meQueryOptions = queryOptions({
  queryKey: [...authQueryKey, "me"],
  queryFn: getCurrentUser,
  retry: false,
});

// `redirect` is an internal path captured by the route guard (e.g. an
// invitation link). Only same-origin absolute paths are accepted.
function safeRedirect(value: string | undefined): string | null {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : null;
}

export function useLoginMutation(redirect?: string) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: login,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: authQueryKey });
      const target = safeRedirect(redirect);
      if (target) {
        window.location.assign(target);
        return;
      }
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
      await navigate({ to: "/login", search: {} });
    },
  });
}
