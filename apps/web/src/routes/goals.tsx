import { createFileRoute } from "@tanstack/react-router";
import { ensureAuthenticated } from "../features/auth/guard";
import { GoalsPage } from "../features/goals/components/goals-page";

export const Route = createFileRoute("/goals")({
  beforeLoad: ({ context }) => ensureAuthenticated(context),
  component: GoalsPage,
});
