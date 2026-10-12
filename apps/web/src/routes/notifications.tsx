import { createFileRoute } from "@tanstack/react-router";
import { ensureAuthenticated } from "../features/auth/guard";
import { NotificationsPage } from "../features/notifications/components/notifications-page";

export const Route = createFileRoute("/notifications")({
  beforeLoad: ({ context }) => ensureAuthenticated(context),
  component: NotificationsPage,
});
