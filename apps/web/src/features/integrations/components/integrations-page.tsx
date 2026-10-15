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
import { toast } from "@repo/ui/components/sonner";
import { useQuery } from "@tanstack/react-query";
import { PlugIcon, PlusIcon, RefreshCwIcon, SettingsIcon } from "lucide-react";
import { useState } from "react";
import { env } from "../../../api";
import { AppShell } from "../../app-shell/app-shell";
import { sitesQueryOptions } from "../../sites/hooks/use-sites";
import {
  integrationsQueryOptions,
  useCreateIntegrationMutation,
  useDeleteIntegrationMutation,
  useRefreshIntegrationMutation,
  useUpdateIntegrationMutation,
  useVerifyIntegrationMutation,
} from "../hooks/use-integrations";
import { ConnectWizard, StatusLine } from "./connect-wizard";
import { CodeRow, selectClass } from "./shared";

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
  poll: "Scheduled pull",
};

export function IntegrationsPage() {
  const sites = useQuery(sitesQueryOptions);
  const integrations = useQuery(integrationsQueryOptions);
  const createIntegration = useCreateIntegrationMutation();
  const [provider, setProvider] = useState<IntegrationProvider>("webhook");
  // The wizard opens on the connection being configured, not on the catalog.
  const [wizardId, setWizardId] = useState<string | null>(null);

  const siteList = sites.data ?? [];
  const activeSite = siteList[0];
  const meta = integrationMeta[provider];
  const guide = integrationGuide(provider);
  const wizardTarget = integrations.data?.find((entry) => entry.id === wizardId) ?? null;

  return (
    <AppShell>
      <section className="grid gap-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Workspace</p>
            <h1 className="text-3xl font-extrabold tracking-tight">Integrations</h1>
            <p className="mt-2 max-w-prose text-sm leading-6 text-muted-foreground">
              Connect the tools that already record your sales, sign-ups and reviews. Each
              connection is set up step by step, verified, and monitored for delivery errors.
            </p>
          </div>
        </div>

        {/* Catalog: pick a provider, see what connecting it involves, add it. */}
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2 text-base">
              Add a connection
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
            </CardTitle>
            <CardDescription>
              {guide.steps.length} steps · {guide.signature}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Provider"
                className={selectClass}
                value={provider}
                onChange={(e) => setProvider(e.target.value as IntegrationProvider)}
              >
                {PROVIDER_GROUPS.map(({ group, providers }) => (
                  <optgroup key={group} label={group}>
                    {providers.map((id) => (
                      <option key={id} value={id}>
                        {integrationMeta[id].label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <Button
                disabled={createIntegration.isPending}
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

            <ol className="grid list-decimal gap-1 pl-5 text-sm text-muted-foreground">
              {guide.steps.map((step) => (
                <li key={step.id}>
                  <span className="font-medium text-foreground">{step.title}</span> — {step.detail}
                </li>
              ))}
            </ol>

            {activeSite ? (
              <CodeRow
                label="Server-to-server ingest endpoint (Authorization: Bearer <site API key>)"
                value={`${env.VITE_API_URL}/ingest/v1/event`}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Create a site first — events always belong to a site.
              </p>
            )}
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
                No connections yet. Pick a provider above to start.
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
  const refresh = useRefreshIntegrationMutation();
  const update = useUpdateIntegrationMutation();
  const isPolled = meta.auth === "poll";

  return (
    <li className="grid gap-3 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Badge variant="secondary">{meta.label}</Badge>
          <Badge variant="outline" className="font-normal">
            {AUTH_LABEL[meta.auth] ?? meta.auth}
          </Badge>
          {integration.config.siteKey ? (
            <span className="text-xs text-muted-foreground">
              site {integration.config.siteKey.slice(0, 8)}…
            </span>
          ) : null}
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
          {isPolled ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={refresh.isPending}
              onClick={() =>
                refresh.mutate(integration.id, {
                  onSuccess: (result) =>
                    result.ok ? toast.success(result.message) : toast.error(result.message),
                  onError: (error) => toast.error(error.message),
                })
              }
            >
              <RefreshCwIcon className="size-4" /> Pull now
            </Button>
          ) : null}
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
