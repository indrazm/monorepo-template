import { createFileRoute } from "@tanstack/react-router";
import { ensureAuthenticated } from "../features/auth/guard";
import { IntegrationsPage } from "../features/integrations/components/integrations-page";

export const Route = createFileRoute("/integrations")({
  beforeLoad: ({ context }) => ensureAuthenticated(context),
  component: IntegrationsPage,
});
