import { createFileRoute } from "@tanstack/react-router";
import { BarChart3Icon } from "lucide-react";
import { ensureAuthenticated } from "../features/auth/guard";
import { PlaceholderPage } from "../features/app-shell/placeholder-page";

export const Route = createFileRoute("/analytics")({
  beforeLoad: ({ context }) => ensureAuthenticated(context),
  component: () => (
    <PlaceholderPage
      title="Analytics"
      description="Impressions, clicks, CTR and an events feed. Coming with the analytics engine."
      icon={<BarChart3Icon className="size-6" />}
    />
  ),
});
