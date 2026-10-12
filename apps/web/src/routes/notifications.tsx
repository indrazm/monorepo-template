import { createFileRoute } from "@tanstack/react-router";
import { BellIcon } from "lucide-react";
import { ensureAuthenticated } from "../features/auth/guard";
import { PlaceholderPage } from "../features/app-shell/placeholder-page";

export const Route = createFileRoute("/notifications")({
  beforeLoad: ({ context }) => ensureAuthenticated(context),
  component: () => (
    <PlaceholderPage
      title="Notifications"
      description="Build sales pops, counters, live-visitor and custom notifications. Coming in the notifications engine."
      icon={<BellIcon className="size-6" />}
    />
  ),
});
