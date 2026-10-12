import { createFileRoute } from "@tanstack/react-router";
import { ensureAuthenticated } from "../features/auth/guard";
import { OverviewPage } from "../features/overview/components/overview-page";

export const Route = createFileRoute("/")({
  beforeLoad: ({ context }) => ensureAuthenticated(context),
  component: OverviewPage,
});
