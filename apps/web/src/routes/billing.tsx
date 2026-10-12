import { createFileRoute } from "@tanstack/react-router";
import { CreditCardIcon } from "lucide-react";
import { ensureAuthenticated } from "../features/auth/guard";
import { PlaceholderPage } from "../features/app-shell/placeholder-page";

export const Route = createFileRoute("/billing")({
  beforeLoad: ({ context }) => ensureAuthenticated(context),
  component: () => (
    <PlaceholderPage
      title="Billing"
      description="Your plan, traffic quota and limits. Upgrades arrive with Stripe in phase 2."
      icon={<CreditCardIcon className="size-6" />}
    />
  ),
});
