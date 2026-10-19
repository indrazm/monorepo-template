import { eventTypes, type EventType } from "@repo/contracts/notifications";
import {
  integrationGuide,
  integrationMappingFields,
  integrationMeta,
  type Integration,
  type IntegrationMapping,
  type IntegrationStep,
} from "@repo/contracts/integrations";
import type { Site } from "@repo/contracts/sites";
import { Badge } from "@repo/ui/components/badge";
import { useQuery } from "@tanstack/react-query";
import { revealIntegrationSecret } from "../services";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { toast } from "@repo/ui/components/sonner";
import {
  CheckCircle2Icon,
  CircleDashedIcon,
  ExternalLinkIcon,
  KeyRoundIcon,
  LinkIcon,
  ListChecksIcon,
  ShieldCheckIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useState } from "react";
import { env } from "../../../api";
import {
  useUpdateIntegrationMutation,
  useVerifyIntegrationMutation,
} from "../hooks/use-integrations";
import { ProviderIcon } from "./provider-icon";
import { CodeRow, Secret, selectClass } from "./shared";

// ---------------------------------------------------------------------------
// Connect wizard (FR-INT-01/02/03). Walks the provider's real setup: pick the
// site events land on, copy the endpoint into the provider, store credentials,
// verify the connection, then choose events and map fields. Each step saves on
// its own so a half-finished connection is never lost.
// ---------------------------------------------------------------------------

export function ConnectWizard({
  integration,
  sites,
  open,
  onOpenChange,
}: {
  integration: Integration;
  sites: Site[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const meta = integrationMeta[integration.provider];
  const guide = integrationGuide(integration.provider);
  const update = useUpdateIntegrationMutation();
  const verify = useVerifyIntegrationMutation();
  const [index, setIndex] = useState(0);
  const [verifyResult, setVerifyResult] = useState<string | null>(null);

  const step = guide.steps[index];
  const site =
    sites.find((entry) => entry.siteKey === integration.config.siteKey) ?? sites[0] ?? null;
  const webhookUrl = site
    ? `${env.publicApiUrl}/ingest/v1/webhook/${integration.provider}?site=${site.siteKey}`
    : `${env.publicApiUrl}/ingest/v1/webhook/${integration.provider}`;

  function save(patch: Parameters<typeof update.mutate>[0]["patch"], message: string) {
    update.mutate(
      { id: integration.id, patch },
      {
        onSuccess: () => toast.success(message),
        onError: (error) => toast.error(error.message),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ProviderIcon provider={integration.provider} size="sm" />
            Connect {meta.label}
            <Badge variant="secondary">{modeLabel(guide.mode)}</Badge>
          </DialogTitle>
          <DialogDescription>
            {meta.docsUrl ? (
              <a
                className="inline-flex items-center gap-1 underline"
                href={meta.docsUrl}
                target="_blank"
                rel="noreferrer"
              >
                {meta.label} webhook docs <ExternalLinkIcon className="size-4" />
              </a>
            ) : (
              `Set up ${meta.label} as an event source.`
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Step rail */}
        <ol className="flex flex-wrap gap-2">
          {guide.steps.map((entry, position) => {
            const done = position < index;
            return (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => setIndex(position)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${
                    position === index
                      ? "border-primary bg-primary/10 font-semibold"
                      : done
                        ? "border-emerald-500/40 text-emerald-600"
                        : "text-muted-foreground"
                  }`}
                >
                  {stepIcon(entry.action)}
                  {position + 1}. {entry.title}
                </button>
              </li>
            );
          })}
        </ol>

        {step ? (
          <div className="grid gap-4 rounded-md border p-4">
            <div>
              <h3 className="text-sm font-semibold">{step.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{step.detail}</p>
            </div>

            <StepBody
              step={step}
              integration={integration}
              sites={sites}
              webhookUrl={webhookUrl}
              signature={guide.signature}
              onSave={save}
              onVerify={() =>
                verify.mutate(integration.id, {
                  onSuccess: (result) => {
                    setVerifyResult(result.message);
                    if (result.status === "connected") toast.success(result.message);
                    else if (result.status === "error") toast.error(result.message);
                    else toast.info(result.message);
                  },
                  onError: (error) => toast.error(error.message),
                })
              }
              verifying={verify.isPending}
              verifyResult={verifyResult}
            />
          </div>
        ) : null}

        <DialogFooter className="sm:justify-between">
          <StatusLine integration={integration} />
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={index === 0}
              onClick={() => setIndex((value) => Math.max(0, value - 1))}
            >
              Back
            </Button>
            {index < guide.steps.length - 1 ? (
              <Button onClick={() => setIndex((value) => value + 1)}>Next</Button>
            ) : (
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function modeLabel(mode: ReturnType<typeof integrationGuide>["mode"]): string {
  switch (mode) {
    case "direct":
      return "Direct webhook";
    case "automation":
      return "Via Zapier / Make";
    case "api":
      return "API connection";
    default:
      return "Webhook";
  }
}

// A small glyph per step so the wizard reads at a glance.
function stepIcon(action: IntegrationStep["action"]) {
  switch (action) {
    case "copy_url":
      return <LinkIcon className="size-4" />;
    case "copy_secret":
    case "credentials":
      return <KeyRoundIcon className="size-4" />;
    case "verify":
      return <ShieldCheckIcon className="size-4" />;
    case "mapping":
      return <ListChecksIcon className="size-4" />;
    default:
      return <CircleDashedIcon className="size-4" />;
  }
}

export function StatusLine({ integration }: { integration: Integration }) {
  const icon =
    integration.status === "connected" ? (
      <CheckCircle2Icon className="size-4 text-emerald-600" />
    ) : integration.status === "error" ? (
      <TriangleAlertIcon className="size-4 text-destructive" />
    ) : (
      <CircleDashedIcon className="size-4 text-muted-foreground" />
    );
  return (
    <span className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
      {icon}
      <span className="truncate">
        {integration.status === "connected"
          ? integration.lastEventAt
            ? `Connected — last event ${new Date(integration.lastEventAt).toLocaleString()}`
            : "Connected"
          : integration.status === "error"
            ? (integration.lastError ?? "Connection error")
            : integration.status === "disabled"
              ? "Disabled"
              : "Pending — not verified yet"}
      </span>
    </span>
  );
}

function StepBody({
  step,
  integration,
  sites,
  webhookUrl,
  signature,
  onSave,
  onVerify,
  verifying,
  verifyResult,
}: {
  step: IntegrationStep;
  integration: Integration;
  sites: Site[];
  webhookUrl: string;
  signature: string;
  onSave: (patch: { config?: Record<string, unknown>; status?: never }, message: string) => void;
  onVerify: () => void;
  verifying: boolean;
  verifyResult: string | null;
}) {
  switch (step.action) {
    case "copy_url":
      return (
        <div className="grid gap-3">
          <SitePicker integration={integration} sites={sites} onSave={onSave} />
          <CodeRow label="Webhook URL" value={webhookUrl} />
          <CodeRow label="Signature Tacto verifies" value={signature} />
        </div>
      );
    case "copy_secret":
      return <SecretStep integration={integration} />;
    case "credentials":
      return <CredentialsStep integration={integration} onSave={onSave} />;
    case "verify":
      return (
        <div className="grid gap-3">
          <Button className="w-fit" onClick={onVerify} disabled={verifying}>
            {verifying ? "Verifying…" : "Verify connection"}
          </Button>
          {verifyResult ? (
            <p className="rounded-md border bg-muted/40 p-3 text-sm">{verifyResult}</p>
          ) : null}
          <StatusLine integration={integration} />
        </div>
      );
    case "mapping":
      return <MappingStep integration={integration} onSave={onSave} />;
    default:
      return null;
  }
}

// Which site inbound events are attributed to — events always belong to a site.
function SitePicker({
  integration,
  sites,
  onSave,
}: {
  integration: Integration;
  sites: Site[];
  onSave: (patch: { config?: Record<string, unknown> }, message: string) => void;
}) {
  if (sites.length === 0) {
    return <p className="text-sm text-muted-foreground">Create a site first.</p>;
  }
  const current = integration.config.siteKey ?? sites[0]?.siteKey ?? "";
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="wizard-site" className="text-xs text-muted-foreground">
        Events land on
      </Label>
      <select
        id="wizard-site"
        className={selectClass}
        value={current}
        onChange={(e) => onSave({ config: { siteKey: e.target.value } }, "Target site saved")}
      >
        {sites.map((site) => (
          <option key={site.id} value={site.siteKey}>
            {site.name} ({site.domain})
          </option>
        ))}
      </select>
    </div>
  );
}

// Generated secrets are revealed on demand to a manager, never included in the
// integration list response.
function SecretStep({ integration }: { integration: Integration }) {
  const secret = useQuery({
    queryKey: ["integrations", integration.id, "secret"],
    queryFn: () => revealIntegrationSecret(integration.id),
    enabled: integration.secretSet,
    retry: false,
  });

  if (!integration.secretSet) {
    return (
      <p className="text-sm text-muted-foreground">
        No secret yet — finish the credentials step first.
      </p>
    );
  }
  if (secret.isPending) return <p className="text-sm text-muted-foreground">Loading secret…</p>;
  if (secret.isError || !secret.data) {
    return <p className="text-sm text-destructive">Could not reveal the signing secret.</p>;
  }
  return <Secret label="Signing secret" value={secret.data} />;
}

// Provider credentials + the inbound signing secret. Values of secret fields
// are write-only: the API returns which keys are set, never the values.
function CredentialsStep({
  integration,
  onSave,
}: {
  integration: Integration;
  onSave: (patch: { config?: Record<string, unknown> }, message: string) => void;
}) {
  const meta = integrationMeta[integration.provider];
  const [values, setValues] = useState<Record<string, string>>({});
  const [secret, setSecret] = useState("");
  // API-key/OAuth providers still need an inbound signing secret for us to
  // verify their deliveries. Show the field for every provider that does not
  // get a Tacto-generated secret.
  const needsPastedSecret = meta.auth !== "generated_secret";
  const fields = meta.credentials ?? [];

  return (
    <div className="grid gap-3">
      {needsPastedSecret ? (
        <div className="grid gap-1">
          <Label htmlFor="cred-secret" className="text-xs font-medium">
            Signing secret from {meta.label}
            {integration.secretSet ? (
              <Badge variant="outline" className="ml-2 font-normal">
                stored
              </Badge>
            ) : null}
          </Label>
          <Input
            id="cred-secret"
            type="password"
            placeholder={meta.header}
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
          />
        </div>
      ) : null}

      {fields.map((field) => (
        <div key={field.key} className="grid gap-1">
          <Label htmlFor={`cred-${field.key}`} className="text-xs font-medium">
            {field.label}
            {field.optional ? <span className="ml-1 text-muted-foreground">(optional)</span> : null}
            {integration.credentialKeys.includes(field.key) ? (
              <Badge variant="outline" className="ml-2 font-normal">
                stored
              </Badge>
            ) : null}
          </Label>
          <Input
            id={`cred-${field.key}`}
            type={field.kind === "secret" ? "password" : "text"}
            placeholder={field.placeholder}
            value={values[field.key] ?? ""}
            onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
          />
          {field.help ? <p className="text-xs text-muted-foreground">{field.help}</p> : null}
        </div>
      ))}

      {!needsPastedSecret && fields.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing to paste — Tacto generated a signing secret for you (next step).
        </p>
      ) : (
        <Button
          className="w-fit"
          disabled={secret.trim().length === 0 && Object.values(values).every((v) => !v.trim())}
          onClick={() => {
            const credentials = Object.fromEntries(
              Object.entries(values).filter(([, value]) => value.trim().length > 0),
            );
            onSave(
              {
                config: {
                  ...(secret.trim() ? { secret: secret.trim() } : {}),
                  ...(Object.keys(credentials).length > 0 ? { credentials } : {}),
                },
              },
              "Credentials saved",
            );
            setValues({});
            setSecret("");
          }}
        >
          Save credentials
        </Button>
      )}
    </div>
  );
}

// Event allowlist + per-integration field mapping (FR-INT-03), replacing the
// pure heuristics with explicit JSON paths when a payload is unusual.
function MappingStep({
  integration,
  onSave,
}: {
  integration: Integration;
  onSave: (patch: { config?: Record<string, unknown> }, message: string) => void;
}) {
  const [events, setEvents] = useState<EventType[]>(integration.config.events ?? []);
  const [mapping, setMapping] = useState<IntegrationMapping>(integration.config.mapping ?? {});
  const [filterPath, setFilterPath] = useState(integration.config.filter?.path ?? "");
  const [filterEquals, setFilterEquals] = useState(integration.config.filter?.equals ?? "");

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <span className="text-xs font-medium">Accept these event types</span>
        <div className="flex flex-wrap gap-2">
          {eventTypes.map((type) => {
            const active = events.includes(type);
            return (
              <button
                key={type}
                type="button"
                className={`rounded-full border px-3 py-1 text-xs ${
                  active ? "border-primary bg-primary/10 font-semibold" : "text-muted-foreground"
                }`}
                onClick={() =>
                  setEvents((prev) =>
                    prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
                  )
                }
              >
                {type}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          Leave empty to accept every event type the provider sends.
        </p>
      </div>

      <div className="grid gap-2">
        <span className="text-xs font-medium">Field mapping (JSON paths)</span>
        <div className="grid gap-2 sm:grid-cols-2">
          {integrationMappingFields.map((field) => (
            <div key={field.key} className="grid gap-1">
              <Label htmlFor={`map-${field.key}`} className="text-xs text-muted-foreground">
                {field.label}
              </Label>
              <Input
                id={`map-${field.key}`}
                placeholder="e.g. data.object.customer.name"
                value={mapping[field.key] ?? ""}
                onChange={(e) => setMapping((prev) => ({ ...prev, [field.key]: e.target.value }))}
              />
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Blank fields keep Tacto's automatic detection.
        </p>
      </div>

      <div className="grid gap-2">
        <span className="text-xs font-medium">Only accept events where…</span>
        <div className="flex flex-wrap gap-2">
          <Input
            className="max-w-xs"
            placeholder="JSON path, e.g. type"
            value={filterPath}
            onChange={(e) => setFilterPath(e.target.value)}
          />
          <Input
            className="max-w-xs"
            placeholder="equals, e.g. order.created"
            value={filterEquals}
            onChange={(e) => setFilterEquals(e.target.value)}
          />
        </div>
      </div>

      <Button
        className="w-fit"
        onClick={() => {
          const cleanMapping = Object.fromEntries(
            Object.entries(mapping).filter(([, value]) => (value ?? "").trim().length > 0),
          );
          onSave(
            {
              config: {
                events,
                mapping: cleanMapping,
                ...(filterPath.trim()
                  ? { filter: { path: filterPath.trim(), equals: filterEquals.trim() } }
                  : {}),
              },
            },
            "Mapping saved",
          );
        }}
      >
        Save mapping
      </Button>
    </div>
  );
}
