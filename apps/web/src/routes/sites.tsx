import { createFileRoute } from "@tanstack/react-router";
import { ensureAuthenticated } from "../features/auth/guard";
import { SitesPage } from "../features/sites/components/sites-page";

export const Route = createFileRoute("/sites")({
  beforeLoad: ({ context }) => ensureAuthenticated(context),
  component: SitesPage,
});
