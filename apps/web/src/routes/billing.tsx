import { createFileRoute } from "@tanstack/react-router";
import { ensureAuthenticated } from "../features/auth/guard";
import { BillingPage } from "../features/billing/components/billing-page";

export const Route = createFileRoute("/billing")({
  beforeLoad: ({ context }) => ensureAuthenticated(context),
  component: BillingPage,
});
