import { createFileRoute } from "@tanstack/react-router";
import { PlugIcon } from "lucide-react";
import { ensureAuthenticated } from "../features/auth/guard";
import { PlaceholderPage } from "../features/app-shell/placeholder-page";

export const Route = createFileRoute("/integrations")({
  beforeLoad: ({ context }) => ensureAuthenticated(context),
  component: () => (
    <PlaceholderPage
      title="Integrations"
      description="Connect a custom webhook, Zapier/Make, Stripe, Shopify and more to feed real events."
      icon={<PlugIcon className="size-6" />}
    />
  ),
});
