import { UnauthorizedApiError } from "@repo/api-client";
import type { QueryClient } from "@tanstack/react-query";
import { redirect } from "@tanstack/react-router";
import { meQueryOptions } from "./hooks/use-auth";

// Shared route guard: ensure the current user is loaded, else redirect to login.
export async function ensureAuthenticated(context: { queryClient: QueryClient }) {
  try {
    await context.queryClient.ensureQueryData(meQueryOptions);
  } catch (error) {
    if (error instanceof UnauthorizedApiError) {
      const current =
        typeof window === "undefined"
          ? "/"
          : `${window.location.pathname}${window.location.search}`;
      throw redirect({ to: "/login", search: { redirect: current } });
    }
    throw error;
  }
}
