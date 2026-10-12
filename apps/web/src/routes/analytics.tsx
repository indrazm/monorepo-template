import { createFileRoute } from "@tanstack/react-router";
import { ensureAuthenticated } from "../features/auth/guard";
import { AnalyticsPage } from "../features/analytics/components/analytics-page";

export const Route = createFileRoute("/analytics")({
  beforeLoad: ({ context }) => ensureAuthenticated(context),
  component: AnalyticsPage,
});
