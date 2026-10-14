import { createFileRoute } from "@tanstack/react-router";
import { ensureAuthenticated } from "../features/auth/guard";
import { TeamPage } from "../features/team/components/team-page";

export const Route = createFileRoute("/team")({
  beforeLoad: ({ context }) => ensureAuthenticated(context),
  component: TeamPage,
});
