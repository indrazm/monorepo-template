import {
  integrationGuide,
  integrationMeta,
  integrationProviders,
  type Integration,
  type IntegrationProvider,
} from "@repo/contracts/integrations";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { Input } from "@repo/ui/components/input";
import { toast } from "@repo/ui/components/sonner";
import { useQuery } from "@tanstack/react-query";
import { ExternalLinkIcon, PlugIcon, PlusIcon, SearchIcon, SettingsIcon } from "lucide-react";
import { useState } from "react";
import { env } from "../../../api";
import { AppShell } from "../../app-shell/app-shell";
import { sitesQueryOptions } from "../../sites/hooks/use-sites";
import {
  integrationsQueryOptions,
  useCreateIntegrationMutation,
  useDeleteIntegrationMutation,
  useUpdateIntegrationMutation,
  useVerifyIntegrationMutation,
} from "../hooks/use-integrations";
import { ConnectWizard, StatusLine } from "./connect-wizard";
import { ProviderIcon } from "./provider-icon";
import { CodeRow } from "./shared";

const GROUP_ORDER = [
  "Generic",
  "E-commerce",
  "Forms & CRM",
  "Courses & members",
  "Marketing & sites",
] as const;

const PROVIDER_GROUPS = GROUP_ORDER.map((group) => ({
  group,
  providers: integrationProviders.filter((id) => integrationMeta[id].group === group),
})).filter((entry) => entry.providers.length > 0);

const AUTH_LABEL: Record<string, string> = {
  generated_secret: "Signed webhook",
  webhook_secret: "Provider secret",
  api_key: "API credentials",
  oauth: "OAuth / token",
};

export function IntegrationsPage() {
  const sites = useQuery(sitesQueryOptions);
  const integrations = useQuery(integrationsQueryOptions);
  const createIntegration = useCreateIntegrationMutation();
  const [provider, setProvider] = useState<IntegrationProvider>("stripe");
  const [query, setQuery] = useState("");
  // The wizard opens on the connection being configured, not on the catalog.
  const [wizardId, setWizardId] = useState<string | null>(null);

  const siteList = sites.data ?? [];
  const activeSite = siteList[0];
  const meta = integrationMeta[provider];
  const guide = integrationGuide(provider);
  const wizardTarget = integrations.data?.find((entry) => entry.id === wizardId) ?? null;

  const needle = query.trim().toLowerCase();
  const groups = PROVIDER_GROUPS.map(({ group, providers }) => ({
    group,
    providers: providers.filter((id) =>
      needle ? integrationMeta[id].label.toLowerCase().includes(needle) : true,
    ),
  })).filter((entry) => entry.providers.length > 0);

  return (
    <AppShell>
      <section className="grid gap-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Workspace</p>
            <h1 className="text-3xl font-extrabold tracking-tight">Integrations</h1>
            <p className="mt-2 max-w-prose text-sm leading-6 text-muted-foreground">
              Connect the tools that already record your sales and sign-ups. Pick a platform below —
              Tacto walks you through each step and verifies the connection.
            </p>
          </div>
        </div>

        {/* Catalog: browse every platform, then set one up step by step. */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add a connection</CardTitle>
            <CardDescription>
              {integrationProviders.length} platforms · search or pick one to see how it connects.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search platforms (Stripe, Shopify, Mailchimp…)"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            {groups.length > 0 ? (
              <div className="grid gap-4">
                {groups.map(({ group, providers }) => (
                  <div key={group} className="grid gap-2">
                    <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      {group}
                    </p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                      {providers.map((id) => {
                        const selected = id === provider;
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => setProvider(id)}
                            aria-pressed={selected}
                            className={`flex items-center gap-2 rounded-lg border p-2 text-left transition-colors ${
                              selected
                                ? "border-primary bg-primary/5 ring-1 ring-primary"
                                : "hover:bg-accent"
                            }`}
                          >
                            <ProviderIcon provider={id} size="sm" />
                            <span className="truncate text-xs font-medium">
                              {integrationMeta[id].label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No platforms match “{query}”.
              </p>
            )}

            {/* Selected platform detail + connect action. */}
            <div className="grid gap-4 rounded-xl border bg-muted/30 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <ProviderIcon provider={provider} size="lg" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-bold">{meta.label}</p>
                      <Badge variant="secondary">{AUTH_LABEL[meta.auth] ?? meta.auth}</Badge>
                      {meta.canTest ? (
                        <Badge variant="outline" className="font-normal">
                          Verifiable
                        </Badge>
                      ) : null}
                      {meta.managesWebhook ? (
                        <Badge variant="outline" className="font-normal">
                          Tacto registers the webhook
                        </Badge>
                      ) : null}
                    </div>
                    {meta.docsUrl ? (
                      <a
                        className="mt-1 inline-flex items-center gap-1 text-xs underline"
                        href={meta.docsUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {meta.label} setup docs <ExternalLinkIcon className="size-3" />
                      </a>
                    ) : null}
                  </div>
                </div>
                <Button
                  disabled={createIntegration.isPending || !activeSite}
                  onClick={() =>
                    createIntegration.mutate(
                      {
                        provider,
                        config: activeSite ? { siteKey: activeSite.siteKey } : {},
                      },
                      {
                        onSuccess: (created) => {
                          toast.success(`${meta.label} added — finish the setup steps`);
                          setWizardId(created.id);
                        },
                        onError: (error) => toast.error(error.message),
                      },
                    )
                  }
                >
                  <PlusIcon className="size-4" /> Set up {meta.label}
                </Button>
              </div>

              <ol className="grid gap-2">
                {guide.steps.map((step, position) => (
                  <li key={step.id} className="flex items-start gap-3">
                    <span className="grid size-6 flex-none place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {position + 1}
                    </span>
                    <span className="text-sm">
                      <span className="font-medium">{step.title}</span>
                      <span className="text-muted-foreground"> — {step.detail}</span>
                    </span>
                  </li>
                ))}
              </ol>

              {activeSite ? (
                <CodeRow
                  label="Server-to-server ingest endpoint (Authorization: Bearer <site API key>)"
                  value={`${env.publicApiUrl}/ingest/v1/event`}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Create a site first — events always belong to a site.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Connected integrations with live health. */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your connections</CardTitle>
            <CardDescription>
              Status updates when you verify a connection and whenever an event is delivered.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {integrations.data && integrations.data.length > 0 ? (
              <ul className="divide-y">
                {integrations.data.map((integration) => (
                  <IntegrationRow
                    key={integration.id}
                    integration={integration}
                    onConfigure={() => setWizardId(integration.id)}
                  />
                ))}
              </ul>
            ) : (
              <p className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
                <PlugIcon className="size-6" />
                No connections yet. Pick a platform above to start.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      {wizardTarget ? (
        <ConnectWizard
          key={wizardTarget.id}
          integration={wizardTarget}
          sites={siteList}
          open
          onOpenChange={(open) => {
            if (!open) setWizardId(null);
          }}
        />
      ) : null}
    </AppShell>
  );
}

function IntegrationRow({
  integration,
  onConfigure,
}: {
  integration: Integration;
  onConfigure: () => void;
}) {
  const meta = integrationMeta[integration.provider];
  const remove = useDeleteIntegrationMutation();
  const verify = useVerifyIntegrationMutation();
  const update = useUpdateIntegrationMutation();

  return (
    <li className="grid gap-3 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <ProviderIcon provider={integration.provider} />
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">{meta.label}</span>
            <Badge variant="outline" className="font-normal">
              {AUTH_LABEL[meta.auth] ?? meta.auth}
            </Badge>
            {integration.config.siteKey ? (
              <span className="text-xs text-muted-foreground">
                site {integration.config.siteKey.slice(0, 8)}…
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          <Button variant="ghost" size="sm" onClick={onConfigure}>
            <SettingsIcon className="size-4" /> Configure
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={verify.isPending}
            onClick={() =>
              verify.mutate(integration.id, {
                onSuccess: (result) =>
                  result.status === "connected"
                    ? toast.success(result.message)
                    : result.status === "error"
                      ? toast.error(result.message)
                      : toast.info(result.message),
                onError: (error) => toast.error(error.message),
              })
            }
          >
            Verify
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              update.mutate(
                {
                  id: integration.id,
                  patch: { status: integration.status === "disabled" ? "connected" : "disabled" },
                },
                {
                  onSuccess: () =>
                    toast.success(
                      integration.status === "disabled"
                        ? "Integration enabled"
                        : "Integration paused — deliveries are acknowledged but ignored",
                    ),
                  onError: (error) => toast.error(error.message),
                },
              )
            }
          >
            {integration.status === "disabled" ? "Enable" : "Pause"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() =>
              remove.mutate(integration.id, {
                onSuccess: () => toast.success("Disconnected"),
                onError: (error) => toast.error(error.message),
              })
            }
          >
            Disconnect
          </Button>
        </div>
      </div>
      <StatusLine integration={integration} />
      {integration.credentialKeys.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          Credentials stored: {integration.credentialKeys.join(", ")}
        </p>
      ) : null}
      {integration.externalRef ? (
        <p className="text-xs text-muted-foreground">
          Webhook registered by Tacto ({integration.externalRef.slice(0, 24)}…) — disconnecting
          revokes it.
        </p>
      ) : null}
    </li>
  );
}
