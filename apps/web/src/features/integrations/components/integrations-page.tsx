import type { Integration } from "@repo/contracts/integrations";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { Label } from "@repo/ui/components/label";
import { toast } from "@repo/ui/components/sonner";
import { useQuery } from "@tanstack/react-query";
import { EyeIcon, EyeOffIcon, PlugIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { env } from "../../../api";
import { AppShell } from "../../app-shell/app-shell";
import { sitesQueryOptions } from "../../sites/hooks/use-sites";
import {
  integrationsQueryOptions,
  useCreateIntegrationMutation,
  useDeleteIntegrationMutation,
} from "../hooks/use-integrations";

const selectClass =
  "border-input bg-background focus-visible:ring-ring h-9 rounded-md border px-3 text-sm focus-visible:ring-[3px] focus-visible:outline-none";

function copy(value: string, label: string) {
  navigator.clipboard
    .writeText(value)
    .then(() => toast.success(`${label} copied`))
    .catch(() => toast.error("Could not copy"));
}

const PROVIDERS = [
  { value: "webhook", label: "Custom webhook" },
  { value: "zapier", label: "Zapier / Make" },
  { value: "stripe", label: "Stripe" },
  { value: "shopify", label: "Shopify" },
  { value: "woocommerce", label: "WooCommerce" },
] as const;

type ProviderValue = (typeof PROVIDERS)[number]["value"];

// Signature header each provider signs its webhook with (shown in the UI).
const SIGNATURE_HEADER: Record<string, string> = {
  webhook: "x-tacto-signature (hex HMAC-SHA256 of the body)",
  zapier: "x-tacto-signature (hex HMAC-SHA256 of the body)",
  stripe: "Stripe-Signature (Stripe webhook secret)",
  shopify: "X-Shopify-Hmac-Sha256 (base64 HMAC-SHA256)",
  woocommerce: "X-WC-Webhook-Signature (base64 HMAC-SHA256)",
};

export function IntegrationsPage() {
  const sites = useQuery(sitesQueryOptions);
  const integrations = useQuery(integrationsQueryOptions);
  const createIntegration = useCreateIntegrationMutation();
  const [siteId, setSiteId] = useState("");
  const [provider, setProvider] = useState<ProviderValue>("webhook");
  const [secretInput, setSecretInput] = useState("");
  // Provider-managed secrets (e.g. Stripe whsec_...) must be pasted; the custom
  // webhook/Zapier secret is generated for the user.
  const needsPastedSecret =
    provider === "stripe" || provider === "shopify" || provider === "woocommerce";
  const activeSite = sites.data?.find((s) => s.id === siteId) ?? sites.data?.[0];

  return (
    <AppShell>
      <section className="grid gap-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Workspace</p>
            <h1 className="text-3xl font-extrabold tracking-tight">Integrations</h1>
            <p className="mt-2 max-w-prose text-sm leading-6 text-muted-foreground">
              Feed real events into Tacto — via the server API, a signed custom webhook, or Zapier.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Provider"
              className={selectClass}
              value={provider}
              onChange={(e) => setProvider(e.target.value as ProviderValue)}
            >
              {PROVIDERS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            {needsPastedSecret ? (
              <input
                type="password"
                className={selectClass}
                placeholder="Signing secret from provider"
                value={secretInput}
                onChange={(e) => setSecretInput(e.target.value)}
              />
            ) : null}
            <Button
              className="w-fit"
              disabled={
                createIntegration.isPending || (needsPastedSecret && secretInput.trim().length < 8)
              }
              onClick={() =>
                createIntegration.mutate(
                  {
                    provider,
                    config: needsPastedSecret ? { secret: secretInput.trim() } : {},
                  },
                  {
                    onSuccess: () => {
                      toast.success("Integration connected");
                      setSecretInput("");
                    },
                    onError: (error) => toast.error(error.message),
                  },
                )
              }
            >
              <PlusIcon className="size-4" /> Connect
            </Button>
          </div>
        </div>

        {/* Data sources for the selected site */}
        {activeSite ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Send events</CardTitle>
              <CardDescription>Use these with your server, Zapier, or any backend.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              {sites.data && sites.data.length > 1 ? (
                <div className="flex items-center gap-2">
                  <Label htmlFor="i-site" className="text-sm text-muted-foreground">
                    Site
                  </Label>
                  <select
                    id="i-site"
                    className={selectClass}
                    value={activeSite.id}
                    onChange={(e) => setSiteId(e.target.value)}
                  >
                    {sites.data.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <Secret label="API key" value={activeSite.apiKey} />
              <CodeRow
                label="Ingest endpoint (Authorization: Bearer <API key>)"
                value={`${env.VITE_API_URL}/ingest/v1/event`}
              />
              <CodeRow
                label="Custom webhook URL (header x-tacto-signature: HMAC-SHA256)"
                value={`${env.VITE_API_URL}/ingest/v1/webhook/webhook?site=${activeSite.siteKey}`}
              />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Create a site first to get ingestion endpoints.
            </CardContent>
          </Card>
        )}

        {/* Connected integrations */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Connected</CardTitle>
          </CardHeader>
          <CardContent>
            {integrations.data && integrations.data.length > 0 ? (
              <ul className="divide-y">
                {integrations.data.map((integration) => (
                  <IntegrationRow
                    key={integration.id}
                    integration={integration}
                    siteKey={activeSite?.siteKey}
                  />
                ))}
              </ul>
            ) : (
              <p className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
                <PlugIcon className="size-6" />
                No integrations yet. Connect a custom webhook to receive signed events.
              </p>
            )}
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}

function IntegrationRow({
  integration,
  siteKey,
}: {
  integration: Integration;
  siteKey: string | undefined;
}) {
  const remove = useDeleteIntegrationMutation();
  return (
    <li className="grid gap-3 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="capitalize">
            {integration.provider}
          </Badge>
          <span className="text-xs text-muted-foreground">{integration.status}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={() =>
            remove.mutate(integration.id, {
              onSuccess: () => toast.success("Integration removed"),
              onError: (error) => toast.error(error.message),
            })
          }
        >
          Remove
        </Button>
      </div>
      {siteKey ? (
        <CodeRow
          label={`Webhook URL — sign with ${SIGNATURE_HEADER[integration.provider] ?? "its signature header"}`}
          value={`${env.VITE_API_URL}/ingest/v1/webhook/${integration.provider}?site=${siteKey}`}
        />
      ) : null}
      {integration.config.secret ? (
        <Secret label="Signing secret" value={integration.config.secret} />
      ) : null}
    </li>
  );
}

function Secret({ label, value }: { label: string; value: string }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="grid gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-md border bg-muted/60 px-3 py-1.5 text-xs">
          {shown ? value : "•".repeat(Math.min(32, value.length))}
        </code>
        <Button variant="ghost" size="icon" onClick={() => setShown((s) => !s)} aria-label="Reveal">
          {shown ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => copy(value, label)}>
          Copy
        </Button>
      </div>
    </div>
  );
}

function CodeRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-md border bg-muted/60 px-3 py-1.5 text-xs">
          {value}
        </code>
        <Button variant="ghost" size="sm" onClick={() => copy(value, "Value")}>
          Copy
        </Button>
      </div>
    </div>
  );
}
