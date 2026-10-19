import { createFileRoute, redirect } from "@tanstack/react-router";
import { UnauthorizedApiError } from "@repo/api-client";
import { meQueryOptions } from "../features/auth/hooks/use-auth";
import { ProfilePage } from "../features/profile/components/profile-page";

export const Route = createFileRoute("/profile")({
  beforeLoad: async ({ context }) => {
    try {
      await context.queryClient.ensureQueryData(meQueryOptions);
    } catch (error) {
      if (error instanceof UnauthorizedApiError) {
        throw redirect({ to: "/login", search: {} });
      }

      throw error;
    }
  },
  component: ProfilePage,
});
