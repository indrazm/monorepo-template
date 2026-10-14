import type {
  NotificationConfig,
  NotificationType,
  Notification,
} from "@repo/contracts/notifications";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/components/dialog";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { toast } from "@repo/ui/components/sonner";
import { Switch } from "@repo/ui/components/switch";
import { Textarea } from "@repo/ui/components/textarea";
import { useQuery } from "@tanstack/react-query";
import { BellIcon, PlusIcon } from "lucide-react";
import { type FormEvent, useState } from "react";
import { AppShell } from "../../app-shell/app-shell";
import { sitesQueryOptions } from "../../sites/hooks/use-sites";
import {
  notificationsQueryOptions,
  useCreateNotificationMutation,
  useDeleteNotificationMutation,
  useUpdateNotificationMutation,
} from "../hooks/use-notifications";
import { NotificationPreview } from "./notification-preview";

const TYPES: { value: NotificationType; label: string }[] = [
  { value: "recent_sales", label: "Recent sales" },
  { value: "counter", label: "Counter" },
  { value: "combo", label: "Combo (30-day count)" },
  { value: "live_visitors", label: "Live visitors" },
  { value: "review", label: "Review" },
  { value: "low_stock", label: "Low stock (FOMO)" },
  { value: "countdown", label: "Countdown" },
  { value: "custom", label: "Custom" },
];

const selectClass =
  "border-input bg-background focus-visible:ring-ring h-9 rounded-md border px-3 text-sm focus-visible:ring-[3px] focus-visible:outline-none";

// ISO -> value for <input type="datetime-local"> (local time, no seconds).
function toLocalInput(iso: string | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function defaultConfig(): NotificationConfig {
  return {
    message: {
      template: "{{first_name}} from {{city}} just purchased {{product}}",
      fallbacks: { first_name: "Someone" },
    },
    style: {
      position: "bottom-left",
      accent: "#3B82F6",
      shape: "rounded",
      size: "md",
      animation: "slide",
    },
    display: { url: { mode: "all" } },
    dataSource: { eventTypes: ["purchase"] },
    timing: { delayMs: 3000, durationMs: 6000, intervalMs: 8000 },
  };
}

function eventTypesForType(type: NotificationType): NotificationConfig["dataSource"]["eventTypes"] {
  if (type === "live_visitors") return ["visit"];
  if (type === "review") return ["review"];
  if (type === "custom" || type === "countdown" || type === "low_stock") return [];
  return ["purchase"];
}

export function NotificationsPage() {
  const sites = useQuery(sitesQueryOptions);
  const [siteId, setSiteId] = useState("");
  const activeSiteId = siteId || sites.data?.[0]?.id || "";
  const notifications = useQuery(notificationsQueryOptions(activeSiteId));

  return (
    <AppShell>
      <section className="grid gap-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Workspace</p>
            <h1 className="text-3xl font-extrabold tracking-tight">Notifications</h1>
            <p className="mt-2 max-w-prose text-sm leading-6 text-muted-foreground">
              Design the proof your visitors see — recent sales, counters, live visitors and custom
              messages.
            </p>
          </div>
          {activeSiteId ? <NotificationEditorDialog siteId={activeSiteId} /> : null}
        </div>

        {sites.data && sites.data.length > 0 ? (
          <div className="flex items-center gap-2">
            <Label htmlFor="site-select" className="text-sm text-muted-foreground">
              Site
            </Label>
            <select
              id="site-select"
              className={selectClass}
              value={activeSiteId}
              onChange={(event) => setSiteId(event.target.value)}
            >
              {sites.data.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Create a site first, then add notifications to it.
            </CardContent>
          </Card>
        )}

        {activeSiteId && notifications.data ? (
          notifications.data.length > 0 ? (
            <div className="grid gap-3">
              {notifications.data.map((notification) => (
                <NotificationRow
                  key={notification.id}
                  siteId={activeSiteId}
                  notification={notification}
                />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                <span className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <BellIcon className="size-6" />
                </span>
                <p className="text-sm text-muted-foreground">
                  No notifications yet — create one to start showing proof.
                </p>
                <NotificationEditorDialog siteId={activeSiteId} />
              </CardContent>
            </Card>
          )
        ) : null}
      </section>
    </AppShell>
  );
}

function NotificationRow({ siteId, notification }: { siteId: string; notification: Notification }) {
  const update = useUpdateNotificationMutation(siteId);
  const remove = useDeleteNotificationMutation(siteId);
  const typeLabel = TYPES.find((t) => t.value === notification.type)?.label ?? notification.type;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
        <div className="min-w-0">
          <CardTitle className="truncate text-base">{notification.name}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {notification.config.message.template}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary">{typeLabel}</Badge>
          <Switch
            checked={notification.isActive}
            onCheckedChange={(checked) =>
              update.mutate(
                { id: notification.id, input: { isActive: checked } },
                { onError: (error) => toast.error(error.message) },
              )
            }
            aria-label="Active"
          />
          <NotificationEditorDialog siteId={siteId} existing={notification} />
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() =>
              remove.mutate(notification.id, {
                onSuccess: () => toast.success("Notification deleted"),
                onError: (error) => toast.error(error.message),
              })
            }
          >
            Delete
          </Button>
        </div>
      </CardHeader>
    </Card>
  );
}

function NotificationEditorDialog({
  siteId,
  existing,
}: {
  siteId: string;
  existing?: Notification;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(existing?.name ?? "New notification");
  const [type, setType] = useState<NotificationType>(existing?.type ?? "recent_sales");
  const [config, setConfig] = useState<NotificationConfig>(existing?.config ?? defaultConfig());
  const create = useCreateNotificationMutation(siteId);
  const update = useUpdateNotificationMutation(siteId);
  const pending = create.isPending || update.isPending;

  function patchConfig(patch: Partial<NotificationConfig>) {
    setConfig((previous) => ({ ...previous, ...patch }));
  }

  function handleSubmit(formEvent: FormEvent) {
    formEvent.preventDefault();
    const payloadConfig: NotificationConfig = {
      ...config,
      dataSource: { ...config.dataSource, eventTypes: eventTypesForType(type) },
      countdown: type === "countdown" ? config.countdown : undefined,
      fomo: type === "low_stock" ? config.fomo : undefined,
    };
    const onError = (error: Error) => toast.error(error.message);
    if (existing) {
      update.mutate(
        { id: existing.id, input: { name, type, config: payloadConfig } },
        {
          onSuccess: () => {
            toast.success("Notification updated");
            setOpen(false);
          },
          onError,
        },
      );
    } else {
      create.mutate(
        { siteId, name, type, isActive: true, config: payloadConfig },
        {
          onSuccess: () => {
            toast.success("Notification published");
            setOpen(false);
          },
          onError,
        },
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {existing ? (
          <Button variant="ghost" size="sm">
            Edit
          </Button>
        ) : (
          <Button className="w-fit">
            <PlusIcon className="size-4" /> New notification
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={handleSubmit} className="grid gap-5">
          <DialogHeader>
            <DialogTitle>{existing ? "Edit notification" : "New notification"}</DialogTitle>
            <DialogDescription>
              Set the type, message and style. The preview updates as you type.
            </DialogDescription>
          </DialogHeader>

          <NotificationPreview config={config} type={type} verified={existing?.verified} />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="n-name">Name</Label>
              <Input id="n-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="n-type">Type</Label>
              <select
                id="n-type"
                className={selectClass}
                value={type}
                onChange={(e) => setType(e.target.value as NotificationType)}
              >
                {TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="n-template">Message</Label>
            <Textarea
              id="n-template"
              value={config.message.template}
              onChange={(e) =>
                patchConfig({ message: { ...config.message, template: e.target.value } })
              }
              rows={2}
            />
            <p className="text-xs text-muted-foreground">
              Variables: {"{{first_name}}"}, {"{{city}}"}, {"{{product}}"}, {"{{count}}"},{" "}
              {"{{time_ago}}"}
            </p>
          </div>

          {type === "countdown" ? (
            <div className="grid gap-2">
              <Label htmlFor="n-endsAt">Countdown ends at</Label>
              <Input
                id="n-endsAt"
                type="datetime-local"
                value={toLocalInput(config.countdown?.endsAt)}
                onChange={(e) =>
                  patchConfig({
                    countdown: e.target.value
                      ? { endsAt: new Date(e.target.value).toISOString() }
                      : undefined,
                  })
                }
              />
            </div>
          ) : null}

          {type === "low_stock" ? (
            <div className="grid gap-2">
              <Label htmlFor="n-stock">Units left ({"{{count}}"})</Label>
              <Input
                id="n-stock"
                type="number"
                min={0}
                value={config.fomo?.stock ?? 0}
                onChange={(e) => patchConfig({ fomo: { stock: Number(e.target.value) } })}
              />
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="n-position">Position</Label>
              <select
                id="n-position"
                className={selectClass}
                value={config.style.position}
                onChange={(e) =>
                  patchConfig({
                    style: {
                      ...config.style,
                      position: e.target.value as NotificationConfig["style"]["position"],
                    },
                  })
                }
              >
                <option value="bottom-left">Bottom left</option>
                <option value="bottom-right">Bottom right</option>
                <option value="top-left">Top left</option>
                <option value="top-right">Top right</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="n-accent">Accent</Label>
              <Input
                id="n-accent"
                type="color"
                className="h-9 w-full p-1"
                value={config.style.accent}
                onChange={(e) =>
                  patchConfig({ style: { ...config.style, accent: e.target.value } })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="n-duration">Duration (s)</Label>
              <Input
                id="n-duration"
                type="number"
                min={1}
                value={Math.round(config.timing.durationMs / 1000)}
                onChange={(e) =>
                  patchConfig({
                    timing: { ...config.timing, durationMs: Number(e.target.value) * 1000 },
                  })
                }
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
            <div className="grid gap-2">
              <Label htmlFor="n-url-mode">Show on</Label>
              <select
                id="n-url-mode"
                className={selectClass}
                value={config.display.url.mode}
                onChange={(e) =>
                  patchConfig({
                    display: {
                      ...config.display,
                      url: {
                        mode: e.target.value as NotificationConfig["display"]["url"]["mode"],
                        value: config.display.url.value,
                      },
                    },
                  })
                }
              >
                <option value="all">All pages</option>
                <option value="simple">Exact path</option>
                <option value="contains">Path contains</option>
                <option value="regex">Regex</option>
              </select>
            </div>
            {config.display.url.mode !== "all" ? (
              <div className="grid gap-2">
                <Label htmlFor="n-url-value">URL match</Label>
                <Input
                  id="n-url-value"
                  placeholder="/pricing"
                  value={config.display.url.value ?? ""}
                  onChange={(e) =>
                    patchConfig({
                      display: {
                        ...config.display,
                        url: { mode: config.display.url.mode, value: e.target.value },
                      },
                    })
                  }
                />
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : existing ? "Save changes" : "Publish notification"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
