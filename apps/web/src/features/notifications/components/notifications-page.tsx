import type {
  DataSourceFilter,
  EventType,
  NotificationConfig,
  NotificationType,
  Notification,
  Review,
  SpinPrize,
  TextTransform,
} from "@repo/contracts/notifications";
import { eventTypes } from "@repo/contracts/notifications";
import { eventSources } from "@repo/contracts/events";
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
import { importReviews } from "../services";
import { NotificationPreview } from "./notification-preview";
import { TargetingFields } from "./targeting-fields";

const TYPES: { value: NotificationType; label: string }[] = [
  { value: "recent_sales", label: "Recent sales" },
  { value: "counter", label: "Counter" },
  { value: "combo", label: "Combo (30-day count)" },
  { value: "live_visitors", label: "Live visitors" },
  { value: "review", label: "Review" },
  { value: "social_counter", label: "Social counter" },
  { value: "youtube", label: "YouTube stats" },
  { value: "low_stock", label: "Low stock (FOMO)" },
  { value: "countdown", label: "Countdown" },
  { value: "custom", label: "Custom" },
  { value: "popup", label: "Popup (conversion)" },
  { value: "bar", label: "Notification bar (conversion)" },
  { value: "spin_to_win", label: "Spin to win (conversion)" },
];

type Position = NotificationConfig["style"]["position"];
const CORNER_POSITIONS: Position[] = ["bottom-left", "bottom-right", "top-left", "top-right"];
const POSITION_LABELS: Record<Position, string> = {
  "bottom-left": "Bottom left",
  "bottom-right": "Bottom right",
  "top-left": "Top left",
  "top-right": "Top right",
  "top-bar": "Top bar",
  "bottom-bar": "Bottom bar",
  center: "Center overlay",
};
// Conversion widgets fix their layout: bars are full-width, popup/spin centered.
const CONVERSION_POSITIONS: Partial<Record<NotificationType, Position[]>> = {
  bar: ["bottom-bar", "top-bar"],
  popup: ["center"],
  spin_to_win: ["center"],
};
function positionsForType(type: NotificationType): Position[] {
  return CONVERSION_POSITIONS[type] ?? CORNER_POSITIONS;
}
function defaultPositionFor(type: NotificationType): Position {
  if (type === "bar") return "bottom-bar";
  if (type === "popup" || type === "spin_to_win") return "center";
  return "bottom-left";
}

const selectClass =
  "border-input bg-background focus-visible:ring-ring h-10 rounded-md border px-3 text-sm focus-visible:ring-[3px] focus-visible:outline-none";

// The editor follows the PRD §5.1 flow as a stepper (FR-NED-01..10).
const EDITOR_STEPS = ["Type", "Track", "Display", "Message", "Style", "Launch"] as const;
const MEDIA_FALLBACKS: {
  value: NonNullable<NotificationConfig["media"]>["fallback"];
  label: string;
}[] = [
  { value: "auto", label: "Automatic (image → map → avatar → flag)" },
  { value: "image", label: "Event image only" },
  { value: "map", label: "Map (needs a configured provider)" },
  { value: "gravatar", label: "Gravatar (from email)" },
  { value: "flag", label: "Country flag" },
  { value: "none", label: "None (type icon)" },
];

// Icons + one-line descriptions for the visual type gallery (feedback T13).
const TYPE_META: Record<NotificationType, { icon: string; hint: string }> = {
  recent_sales: { icon: "🛒", hint: "Latest purchases, live" },
  counter: { icon: "📈", hint: "Sales in the last 7 days" },
  combo: { icon: "📊", hint: "30-day activity count" },
  live_visitors: { icon: "👀", hint: "People on the site now" },
  review: { icon: "⭐", hint: "Star rating + quote" },
  social_counter: { icon: "👥", hint: "Follower / like count" },
  youtube: { icon: "▶️", hint: "Subscribers or views" },
  custom: { icon: "💬", hint: "Any message you write" },
  low_stock: { icon: "🔥", hint: "Units-left urgency" },
  countdown: { icon: "⏳", hint: "Live countdown timer" },
  popup: { icon: "🎉", hint: "Centered modal offer" },
  bar: { icon: "📣", hint: "Full-width top/bottom bar" },
  spin_to_win: { icon: "🎁", hint: "Spin wheel for a reward" },
};

const EVENT_TYPE_LABELS: Record<EventType, string> = {
  purchase: "Purchase",
  signup: "Signup",
  visit: "Visit",
  form_submit: "Form submit",
  custom: "Custom",
};
const SOURCE_LABELS: Record<string, string> = {
  pixel: "Pixel (on-site)",
  webhook: "Webhook",
  zapier: "Zapier",
  stripe: "Stripe",
  shopify: "Shopify",
  woocommerce: "WooCommerce",
  manual: "Manual / test",
};
const FILTER_OPS: { value: DataSourceFilter["op"]; label: string }[] = [
  { value: "eq", label: "equals" },
  { value: "contains", label: "contains" },
  { value: "gte", label: "≥" },
  { value: "lte", label: "≤" },
];

// Visual style presets (feedback T9): one click sets accent/shape/size/
// animation/font together. `accent` is left out so the brand colour is kept.
type StylePreset = Pick<NotificationConfig["style"], "shape" | "size" | "animation" | "font">;
const STYLE_PRESETS: { name: string; preset: StylePreset }[] = [
  { name: "Classic", preset: { shape: "rounded", size: "md", animation: "slide", font: "system" } },
  { name: "Compact", preset: { shape: "rounded", size: "sm", animation: "fade", font: "system" } },
  { name: "Bold", preset: { shape: "square", size: "lg", animation: "scale", font: "rounded" } },
  { name: "Editorial", preset: { shape: "rounded", size: "lg", animation: "fade", font: "serif" } },
];
const FONT_LABELS: Record<NonNullable<NotificationConfig["style"]["font"]>, string> = {
  system: "System",
  rounded: "Rounded",
  serif: "Serif",
  mono: "Mono",
};

// ISO -> value for <input type="datetime-local"> (local time, no seconds).
function toLocalInput(iso: string | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// Split one CSV line, honoring quoted fields with escaped quotes.
function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      result.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  result.push(cur.trim());
  return result;
}

// Parse a reviews CSV with columns: author, rating, text, avatar, source.
function parseReviewsCsv(text: string): Review[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
  const out: Review[] = [];
  lines.forEach((line, index) => {
    const cells = splitCsvLine(line);
    if (index === 0 && /author/i.test(cells[0] ?? "")) return; // header row
    const [author, rating, body, avatar, source] = cells;
    if (!author || !body) return;
    const parsed = Number(rating);
    out.push({
      author: author.slice(0, 80),
      rating: Number.isFinite(parsed) ? Math.min(5, Math.max(0, parsed)) : 5,
      text: body.slice(0, 500),
      ...(avatar && /^https?:\/\//.test(avatar) ? { avatarUrl: avatar } : {}),
      ...(source ? { source: source.slice(0, 40) } : {}),
    });
  });
  return out;
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
  if (
    type === "custom" ||
    type === "countdown" ||
    type === "low_stock" ||
    type === "popup" ||
    type === "bar" ||
    type === "spin_to_win"
  ) {
    return [];
  }
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
  // Wizard navigation (PRD §5.1: Type → Track → Display → Message → Style →
  // Launch) and the device the preview is rendered for.
  const [step, setStep] = useState(0);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [isActive, setIsActive] = useState(existing?.isActive ?? true);
  // Owner's "verified/ethical proof" assertion → the ✓ badge (feedback T9 moat).
  const [verified, setVerified] = useState(existing?.verified ?? false);

  function patchConfig(patch: Partial<NotificationConfig>) {
    setConfig((previous) => ({ ...previous, ...patch }));
  }

  // Data source (FR-NED-08): which events feed this notification. These write
  // to config.dataSource and are honored server-side when selecting events.
  function toggleEventType(value: EventType) {
    const current = config.dataSource.eventTypes;
    const next = current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value];
    patchConfig({ dataSource: { ...config.dataSource, eventTypes: next } });
  }
  function setSource(value: string) {
    patchConfig({ dataSource: { ...config.dataSource, source: value || undefined } });
  }
  const dataFilters = config.dataSource.filters ?? [];
  function setDataFilters(next: DataSourceFilter[]) {
    patchConfig({
      dataSource: { ...config.dataSource, filters: next.length ? next : undefined },
    });
  }
  function patchDataFilter(index: number, patch: Partial<DataSourceFilter>) {
    setDataFilters(dataFilters.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  }

  // Reviews (T6): inline list fed manually, by CSV, or (later) Google/Facebook.
  const reviews = config.reviews ?? [];
  function setReviews(next: Review[]) {
    patchConfig({ reviews: next.length ? next : undefined });
  }
  function patchReview(index: number, patch: Partial<Review>) {
    setReviews(reviews.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }
  async function importReviewsFrom(provider: "google" | "facebook") {
    if (!existing) return;
    const ref = window.prompt(provider === "google" ? "Google Place ID" : "Facebook Page ID");
    if (!ref?.trim()) return;
    try {
      const result = await importReviews(existing.id, provider, ref.trim());
      if (result.imported === 0) {
        toast.message("No reviews found for that ID.");
        return;
      }
      setReviews(result.reviews.slice(0, 50));
      toast.success(`Imported ${result.imported} review(s)`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import failed.");
    }
  }
  function importReviewsCsv(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const parsed = parseReviewsCsv(text);
      if (parsed.length === 0) {
        toast.error("No rows found. Expected columns: author, rating, text, avatar, source.");
        return;
      }
      setReviews([...reviews, ...parsed].slice(0, 50));
      toast.success(`Imported ${parsed.length} review(s)`);
    };
    reader.readAsText(file);
  }

  // Media (FR-NED-03): an explicit image and the fallback the server walks.
  function setMedia(patch: Partial<NonNullable<NotificationConfig["media"]>>) {
    patchConfig({ media: { fallback: "auto", ...config.media, ...patch } });
  }

  // Spin-to-win prize pool (F69): the real rewards the wheel can hand out.
  function setSpin(next: NotificationConfig["spin"]) {
    patchConfig({ spin: next });
  }
  function seedSpin() {
    setSpin({
      prizes: [
        { label: "10% off your order", code: "SAVE10", weight: 1 },
        { label: "Free shipping", code: "FREESHIP", weight: 1 },
        { label: "Better luck next time", code: "RETRY", weight: 2 },
      ],
      validForDays: 7,
    });
  }
  function patchPrize(index: number, patch: Partial<SpinPrize>) {
    if (!config.spin) return;
    setSpin({
      ...config.spin,
      prizes: config.spin.prizes.map((prize, i) => (i === index ? { ...prize, ...patch } : prize)),
    });
  }
  function addPrize() {
    if (!config.spin || config.spin.prizes.length >= 12) return;
    setSpin({
      ...config.spin,
      prizes: [...config.spin.prizes, { label: "New prize", code: "CODE", weight: 1 }],
    });
  }
  function removePrize(index: number) {
    if (!config.spin || config.spin.prizes.length <= 2) return;
    setSpin({ ...config.spin, prizes: config.spin.prizes.filter((_, i) => i !== index) });
  }

  // Per-variable fallback + transform (feedback T9). Variables actually used in
  // the template drive the UI, so the editor only shows relevant controls.
  const usedVariables = Array.from(
    new Set(
      [
        ...config.message.template.matchAll(
          /\{\{\s*(first_name|city|product|count|time_ago)\s*\}\}/g,
        ),
      ].map((match) => match[1] as string),
    ),
  );
  function setFallback(key: string, value: string) {
    const next = { ...config.message.fallbacks };
    if (value) next[key] = value;
    else delete next[key];
    patchConfig({ message: { ...config.message, fallbacks: next } });
  }
  function setTransform(key: string, value: TextTransform) {
    const next = { ...config.message.transforms };
    if (value === "none") delete next[key];
    else next[key] = value;
    patchConfig({
      message: {
        ...config.message,
        transforms: Object.keys(next).length ? next : undefined,
      },
    });
  }

  // Translations (FR-NED-12): a locale-keyed map of message templates.
  const translations = config.message.translations ?? {};
  function setTranslations(next: NonNullable<NotificationConfig["message"]["translations"]>) {
    patchConfig({
      message: { ...config.message, translations: Object.keys(next).length ? next : undefined },
    });
  }
  function addTranslation() {
    let n = 1;
    while (translations[`lang${n}`]) n++;
    setTranslations({
      ...translations,
      [`lang${n}`]: { template: config.message.template, fallbacks: {} },
    });
  }
  function patchTranslation(locale: string, template: string) {
    const current = translations[locale] ?? { template: "", fallbacks: {} };
    setTranslations({ ...translations, [locale]: { ...current, template } });
  }
  function renameTranslation(from: string, to: string) {
    const next: typeof translations = {};
    for (const [key, value] of Object.entries(translations)) next[key === from ? to : key] = value;
    setTranslations(next);
  }
  function removeTranslation(locale: string) {
    const next: typeof translations = {};
    for (const [key, value] of Object.entries(translations)) {
      if (key !== locale) next[key] = value;
    }
    setTranslations(next);
  }

  // A/B variants (FR-ANL-04): 2+ alternative messages, bucketed per visitor.
  const variants = config.variants ?? [];
  function setVariants(next: NonNullable<NotificationConfig["variants"]>) {
    patchConfig({ variants: next.length >= 2 ? next : undefined });
  }
  function addVariant() {
    if (variants.length === 0) {
      setVariants([
        { id: "A", weight: 50, message: config.message },
        { id: "B", weight: 50, message: config.message },
      ]);
      return;
    }
    if (variants.length >= 6) return;
    setVariants([
      ...variants,
      { id: String.fromCharCode(65 + variants.length), weight: 50, message: config.message },
    ]);
  }
  function patchVariantTemplate(id: string, template: string) {
    setVariants(
      variants.map((v) => (v.id === id ? { ...v, message: { ...v.message, template } } : v)),
    );
  }
  function patchVariantWeight(id: string, weight: number) {
    setVariants(variants.map((v) => (v.id === id ? { ...v, weight } : v)));
  }
  function removeVariant(id: string) {
    setVariants(variants.filter((v) => v.id !== id));
  }

  function handleSubmit(formEvent: FormEvent) {
    formEvent.preventDefault();
    const payloadConfig: NotificationConfig = {
      ...config,
      countdown: type === "countdown" ? config.countdown : undefined,
      fomo: type === "low_stock" ? config.fomo : undefined,
      spin: type === "spin_to_win" ? config.spin : undefined,
      reviews: type === "review" ? config.reviews : undefined,
      socialCounter: type === "social_counter" ? config.socialCounter : undefined,
      youtube: type === "youtube" ? config.youtube : undefined,
    };
    const onError = (error: Error) => toast.error(error.message);
    if (existing) {
      update.mutate(
        { id: existing.id, input: { name, type, isActive, verified, config: payloadConfig } },
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
        { siteId, name, type, isActive: true, verified, config: payloadConfig },
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
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (value) setStep(0);
      }}
    >
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
              Follow the steps — the preview updates as you type.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            <div className="flex justify-end gap-1">
              <Button
                type="button"
                variant={device === "desktop" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setDevice("desktop")}
              >
                Desktop
              </Button>
              <Button
                type="button"
                variant={device === "mobile" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setDevice("mobile")}
              >
                Mobile
              </Button>
            </div>
            <NotificationPreview config={config} type={type} verified={verified} device={device} />
          </div>

          {/* Stepper */}
          <div className="flex flex-wrap gap-1">
            {EDITOR_STEPS.map((label, index) => (
              <button
                key={label}
                type="button"
                onClick={() => setStep(index)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  index === step
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {index + 1}. {label}
              </button>
            ))}
          </div>

          {step === 0 ? (
            <>
              <div className="grid gap-2">
                <Label htmlFor="n-name">Name</Label>
                <Input
                  id="n-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label>Type</Label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {TYPES.map((t) => {
                    const selected = t.value === type;
                    const meta = TYPE_META[t.value];
                    return (
                      <button
                        key={t.value}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => {
                          setType(t.value);
                          patchConfig({
                            style: { ...config.style, position: defaultPositionFor(t.value) },
                            // Seed a sensible default event source for the type; the
                            // Track step lets the user change it (no longer forced).
                            dataSource: {
                              ...config.dataSource,
                              eventTypes: eventTypesForType(t.value),
                            },
                          });
                        }}
                        className={`flex items-start gap-2 rounded-lg border p-3 text-left transition-colors ${
                          selected
                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <span className="text-xl leading-none">{meta.icon}</span>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold">{t.label}</span>
                          <span className="block text-xs text-muted-foreground">{meta.hint}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
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

              {type === "spin_to_win" ? (
                <div className="grid gap-3 rounded-lg border border-border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Label>Prizes &amp; odds</Label>
                      <p className="text-xs text-muted-foreground">
                        Every prize needs a coupon code or a redemption URL. Weight sets how often
                        it is drawn.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={config.spin ? addPrize : seedSpin}
                    >
                      {config.spin ? "Add prize" : "Configure prizes"}
                    </Button>
                  </div>
                  {config.spin
                    ? config.spin.prizes.map((prize, index) => (
                        <div
                          key={index}
                          className="grid gap-2 border-t border-border pt-3 sm:grid-cols-[1.3fr_1fr_1fr_auto_auto] sm:items-end"
                        >
                          <div className="grid gap-1">
                            <Label className="text-xs" htmlFor={`n-prize-label-${index}`}>
                              Label
                            </Label>
                            <Input
                              id={`n-prize-label-${index}`}
                              value={prize.label}
                              onChange={(e) => patchPrize(index, { label: e.target.value })}
                            />
                          </div>
                          <div className="grid gap-1">
                            <Label className="text-xs" htmlFor={`n-prize-code-${index}`}>
                              Coupon code
                            </Label>
                            <Input
                              id={`n-prize-code-${index}`}
                              value={prize.code ?? ""}
                              onChange={(e) =>
                                patchPrize(index, { code: e.target.value.trim() || undefined })
                              }
                            />
                          </div>
                          <div className="grid gap-1">
                            <Label className="text-xs" htmlFor={`n-prize-url-${index}`}>
                              Or redeem URL
                            </Label>
                            <Input
                              id={`n-prize-url-${index}`}
                              placeholder="https://…"
                              value={prize.url ?? ""}
                              onChange={(e) =>
                                patchPrize(index, { url: e.target.value.trim() || undefined })
                              }
                            />
                          </div>
                          <div className="grid gap-1">
                            <Label className="text-xs" htmlFor={`n-prize-weight-${index}`}>
                              Weight
                            </Label>
                            <Input
                              id={`n-prize-weight-${index}`}
                              type="number"
                              min={1}
                              max={100}
                              className="w-20"
                              value={prize.weight}
                              onChange={(e) =>
                                patchPrize(index, { weight: Math.max(1, Number(e.target.value)) })
                              }
                            />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => removePrize(index)}
                            disabled={config.spin!.prizes.length <= 2}
                          >
                            Remove
                          </Button>
                        </div>
                      ))
                    : null}
                  {config.spin ? (
                    <div className="grid gap-2 border-t border-border pt-3 sm:grid-cols-2 sm:items-end">
                      <div className="grid gap-1">
                        <Label className="text-xs" htmlFor="n-spin-valid">
                          Reward valid (days)
                        </Label>
                        <Input
                          id="n-spin-valid"
                          type="number"
                          min={1}
                          max={365}
                          value={config.spin.validForDays}
                          onChange={(e) =>
                            setSpin({
                              ...config.spin!,
                              validForDays: Math.max(1, Number(e.target.value)),
                            })
                          }
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {type === "review" ? (
                <div className="grid gap-3 rounded-lg border border-border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <Label>Reviews</Label>
                      <p className="text-xs text-muted-foreground">
                        Shown one at a time, rotating. Add manually or import a CSV (columns:
                        author, rating, text, avatar, source).
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-md border px-3 text-xs font-medium hover:bg-muted">
                        Import CSV
                        <input
                          type="file"
                          accept=".csv,text/csv"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) importReviewsCsv(file);
                            e.target.value = "";
                          }}
                        />
                      </label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setReviews([...reviews, { author: "", rating: 5, text: "" }])
                        }
                      >
                        <PlusIcon className="size-4" /> Add
                      </Button>
                      {existing ? (
                        <>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => void importReviewsFrom("google")}
                          >
                            Google
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => void importReviewsFrom("facebook")}
                          >
                            Facebook
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </div>
                  {reviews.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No reviews yet.</p>
                  ) : null}
                  {reviews.map((review, index) => (
                    <div key={index} className="grid gap-2 border-t border-border pt-3">
                      <div className="grid gap-2 sm:grid-cols-[1fr_90px_auto]">
                        <Input
                          aria-label="Author"
                          placeholder="Jane D."
                          value={review.author}
                          onChange={(e) => patchReview(index, { author: e.target.value })}
                        />
                        <Input
                          aria-label="Rating"
                          type="number"
                          min={0}
                          max={5}
                          step={0.5}
                          value={review.rating}
                          onChange={(e) =>
                            patchReview(index, {
                              rating: Math.min(5, Math.max(0, Number(e.target.value))),
                            })
                          }
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setReviews(reviews.filter((_, i) => i !== index))}
                        >
                          Remove
                        </Button>
                      </div>
                      <Textarea
                        aria-label="Review text"
                        rows={2}
                        placeholder="Best purchase I've made this year!"
                        value={review.text}
                        onChange={(e) => patchReview(index, { text: e.target.value })}
                      />
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Input
                          aria-label="Avatar URL"
                          placeholder="Avatar URL (optional)"
                          value={review.avatarUrl ?? ""}
                          onChange={(e) =>
                            patchReview(index, { avatarUrl: e.target.value.trim() || undefined })
                          }
                        />
                        <Input
                          aria-label="Source"
                          placeholder="Source e.g. Google (optional)"
                          value={review.source ?? ""}
                          onChange={(e) =>
                            patchReview(index, { source: e.target.value.trim() || undefined })
                          }
                        />
                      </div>
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground">
                    Auto-import from Google/Facebook needs API credentials configured by your admin
                    (GOOGLE_PLACES_API_KEY / FACEBOOK_PAGE_TOKEN).
                  </p>
                </div>
              ) : null}

              {type === "social_counter" ? (
                <div className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="n-sc-platform">Platform</Label>
                    <Input
                      id="n-sc-platform"
                      placeholder="Instagram"
                      value={config.socialCounter?.platform ?? ""}
                      onChange={(e) =>
                        patchConfig({
                          socialCounter: {
                            platform: e.target.value,
                            count: config.socialCounter?.count ?? 0,
                            label: config.socialCounter?.label,
                            handle: config.socialCounter?.handle,
                          },
                        })
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="n-sc-count">Count</Label>
                    <Input
                      id="n-sc-count"
                      type="number"
                      min={0}
                      value={config.socialCounter?.count ?? 0}
                      onChange={(e) =>
                        patchConfig({
                          socialCounter: {
                            platform: config.socialCounter?.platform ?? "Instagram",
                            count: Math.max(0, Number(e.target.value)),
                            label: config.socialCounter?.label,
                            handle: config.socialCounter?.handle,
                          },
                        })
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="n-sc-label">Label</Label>
                    <Input
                      id="n-sc-label"
                      placeholder="followers"
                      value={config.socialCounter?.label ?? ""}
                      onChange={(e) =>
                        patchConfig({
                          socialCounter: {
                            platform: config.socialCounter?.platform ?? "Instagram",
                            count: config.socialCounter?.count ?? 0,
                            label: e.target.value || undefined,
                            handle: config.socialCounter?.handle,
                          },
                        })
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="n-sc-handle">Handle (optional)</Label>
                    <Input
                      id="n-sc-handle"
                      placeholder="@yourbrand"
                      value={config.socialCounter?.handle ?? ""}
                      onChange={(e) =>
                        patchConfig({
                          socialCounter: {
                            platform: config.socialCounter?.platform ?? "Instagram",
                            count: config.socialCounter?.count ?? 0,
                            label: config.socialCounter?.label,
                            handle: e.target.value || undefined,
                          },
                        })
                      }
                    />
                  </div>
                  <p className="text-xs text-muted-foreground sm:col-span-2">
                    Live refresh needs a platform API key configured by your admin.
                  </p>
                </div>
              ) : null}

              {type === "youtube" ? (
                <div className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="n-yt-metric">Metric</Label>
                    <select
                      id="n-yt-metric"
                      className={selectClass}
                      value={config.youtube?.metric ?? "subscribers"}
                      onChange={(e) =>
                        patchConfig({
                          youtube: {
                            metric: e.target.value as "subscribers" | "views",
                            count: config.youtube?.count ?? 0,
                            channelUrl: config.youtube?.channelUrl,
                            label: config.youtube?.label,
                          },
                        })
                      }
                    >
                      <option value="subscribers">Subscribers</option>
                      <option value="views">Views</option>
                    </select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="n-yt-count">Count</Label>
                    <Input
                      id="n-yt-count"
                      type="number"
                      min={0}
                      value={config.youtube?.count ?? 0}
                      onChange={(e) =>
                        patchConfig({
                          youtube: {
                            metric: config.youtube?.metric ?? "subscribers",
                            count: Math.max(0, Number(e.target.value)),
                            channelUrl: config.youtube?.channelUrl,
                            label: config.youtube?.label,
                          },
                        })
                      }
                    />
                  </div>
                  <div className="grid gap-2 sm:col-span-2">
                    <Label htmlFor="n-yt-url">Channel URL (optional)</Label>
                    <Input
                      id="n-yt-url"
                      placeholder="https://youtube.com/@yourchannel"
                      value={config.youtube?.channelUrl ?? ""}
                      onChange={(e) =>
                        patchConfig({
                          youtube: {
                            metric: config.youtube?.metric ?? "subscribers",
                            count: config.youtube?.count ?? 0,
                            channelUrl: e.target.value || undefined,
                            label: config.youtube?.label,
                          },
                        })
                      }
                    />
                  </div>
                  <p className="text-xs text-muted-foreground sm:col-span-2">
                    Live refresh needs a YouTube Data API key configured by your admin.
                  </p>
                </div>
              ) : null}
            </>
          ) : null}

          {step === 1 ? (
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label>Event types</Label>
                <p className="text-xs text-muted-foreground">
                  Which events feed this notification. Leave all off to use the type default.
                </p>
                <div className="flex flex-wrap gap-2">
                  {eventTypes.map((value) => {
                    const checked = config.dataSource.eventTypes.includes(value);
                    return (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={checked}
                        onClick={() => toggleEventType(value)}
                        className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                          checked
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-input bg-background text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {EVENT_TYPE_LABELS[value]}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-2 sm:max-w-xs">
                <Label htmlFor="n-source">Source</Label>
                <select
                  id="n-source"
                  className={selectClass}
                  value={config.dataSource.source ?? ""}
                  onChange={(e) => setSource(e.target.value)}
                >
                  <option value="">Any source</option>
                  {eventSources.map((source) => (
                    <option key={source} value={source}>
                      {SOURCE_LABELS[source] ?? source}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-2 rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm">Filters</Label>
                    <p className="text-xs text-muted-foreground">
                      Only show events matching every rule (e.g. product contains &quot;Pro&quot;).
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={dataFilters.length >= 10}
                    onClick={() =>
                      setDataFilters([...dataFilters, { field: "", op: "eq", value: "" }])
                    }
                  >
                    <PlusIcon className="size-4" /> Add
                  </Button>
                </div>
                {dataFilters.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No filters — every matching event.
                  </p>
                ) : null}
                {dataFilters.map((filter, index) => (
                  <div key={index} className="grid gap-2 sm:grid-cols-[1fr_110px_1fr_auto]">
                    <Input
                      aria-label="Field"
                      placeholder="product"
                      value={filter.field}
                      onChange={(e) => patchDataFilter(index, { field: e.target.value })}
                    />
                    <select
                      aria-label="Operator"
                      className={selectClass}
                      value={filter.op}
                      onChange={(e) =>
                        patchDataFilter(index, { op: e.target.value as DataSourceFilter["op"] })
                      }
                    >
                      {FILTER_OPS.map((op) => (
                        <option key={op.value} value={op.value}>
                          {op.label}
                        </option>
                      ))}
                    </select>
                    <Input
                      aria-label="Value"
                      placeholder="Pro"
                      value={filter.value}
                      onChange={(e) => patchDataFilter(index, { value: e.target.value })}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDataFilters(dataFilters.filter((_, i) => i !== index))}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <>
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

              <TargetingFields
                display={config.display}
                onChange={(display) => patchConfig({ display })}
              />
            </>
          ) : null}

          {step === 4 ? (
            <>
              <div className="grid gap-4 rounded-lg border border-border p-3 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="n-placement">Placement</Label>
                  <select
                    id="n-placement"
                    className={selectClass}
                    value={config.inlineSelector ? "inline" : "floating"}
                    onChange={(e) =>
                      patchConfig({
                        inlineSelector: e.target.value === "inline" ? "#tacto-proof" : undefined,
                      })
                    }
                  >
                    <option value="floating">Floating overlay</option>
                    <option value="inline">Inline (embed in page)</option>
                  </select>
                </div>
                {config.inlineSelector !== undefined ? (
                  <div className="grid gap-2">
                    <Label htmlFor="n-inline-selector">Target element (CSS selector)</Label>
                    <Input
                      id="n-inline-selector"
                      placeholder="#reviews"
                      value={config.inlineSelector}
                      onChange={(e) => patchConfig({ inlineSelector: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      The notification renders inside the first element matching this selector.
                    </p>
                  </div>
                ) : null}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
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
                    {positionsForType(type).map((position) => (
                      <option key={position} value={position}>
                        {POSITION_LABELS[position]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="n-delay">Delay (s)</Label>
                  <Input
                    id="n-delay"
                    type="number"
                    min={0}
                    value={config.timing.delayMs / 1000}
                    onChange={(e) =>
                      patchConfig({
                        timing: {
                          ...config.timing,
                          delayMs: Math.max(0, Number(e.target.value)) * 1000,
                        },
                      })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="n-duration">Visible for (s)</Label>
                  <Input
                    id="n-duration"
                    type="number"
                    min={1}
                    value={Math.round(config.timing.durationMs / 1000)}
                    onChange={(e) =>
                      patchConfig({
                        timing: {
                          ...config.timing,
                          durationMs: Math.max(1, Number(e.target.value)) * 1000,
                        },
                      })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="n-interval">Gap between (s)</Label>
                  <Input
                    id="n-interval"
                    type="number"
                    min={0}
                    value={config.timing.intervalMs / 1000}
                    onChange={(e) =>
                      patchConfig({
                        timing: {
                          ...config.timing,
                          intervalMs: Math.max(0, Number(e.target.value)) * 1000,
                        },
                      })
                    }
                  />
                </div>
              </div>

              <div className="grid gap-4 rounded-lg border border-border p-3 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="n-media-image">Pinned image URL</Label>
                  <Input
                    id="n-media-image"
                    placeholder="https://… (optional)"
                    value={config.media?.imageUrl ?? ""}
                    onChange={(e) => setMedia({ imageUrl: e.target.value.trim() || undefined })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="n-media-fallback">Media fallback</Label>
                  <select
                    id="n-media-fallback"
                    className={selectClass}
                    value={config.media?.fallback ?? "auto"}
                    onChange={(e) =>
                      setMedia({
                        fallback: e.target.value as NonNullable<
                          NotificationConfig["media"]
                        >["fallback"],
                      })
                    }
                  >
                    {MEDIA_FALLBACKS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          ) : null}

          {step === 3 ? (
            <>
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

              {usedVariables.length > 0 ? (
                <div className="grid gap-2 rounded-md border p-3">
                  <Label className="text-sm">Personalize variables</Label>
                  <p className="text-xs text-muted-foreground">
                    Set a fallback for when a value is missing, and tidy how it displays.
                  </p>
                  {usedVariables.map((key) => (
                    <div
                      key={key}
                      className="grid gap-2 sm:grid-cols-[110px_1fr_130px] sm:items-center"
                    >
                      <code className="text-xs text-muted-foreground">{`{{${key}}}`}</code>
                      <Input
                        aria-label={`${key} fallback`}
                        placeholder="Fallback (optional)"
                        value={config.message.fallbacks[key] ?? ""}
                        onChange={(e) => setFallback(key, e.target.value)}
                      />
                      {key === "first_name" || key === "city" || key === "product" ? (
                        <select
                          aria-label={`${key} transform`}
                          className={selectClass}
                          value={
                            config.message.transforms?.[key] ??
                            (key === "product" ? "none" : "capitalize")
                          }
                          onChange={(e) => setTransform(key, e.target.value as TextTransform)}
                        >
                          <option value="none">As entered</option>
                          <option value="trim">Trim spaces</option>
                          <option value="capitalize">Capitalize</option>
                          <option value="uppercase">UPPERCASE</option>
                          <option value="lowercase">lowercase</option>
                        </select>
                      ) : (
                        <span />
                      )}
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="grid gap-2 rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Translations</Label>
                  <Button type="button" variant="ghost" size="sm" onClick={addTranslation}>
                    <PlusIcon className="size-4" /> Add
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Shown when the visitor&apos;s language matches a locale code (e.g. id, es, pt-BR).
                </p>
                {Object.entries(translations).map(([locale, value]) => (
                  <div key={locale} className="grid gap-2 sm:grid-cols-[110px_1fr_auto]">
                    <Input
                      aria-label="Locale"
                      placeholder="es"
                      value={locale}
                      onChange={(e) => renameTranslation(locale, e.target.value)}
                    />
                    <Textarea
                      aria-label={`${locale} template`}
                      rows={2}
                      value={value.template}
                      onChange={(e) => patchTranslation(locale, e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => removeTranslation(locale)}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>

              <div className="grid gap-2 rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">A/B variants</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={addVariant}
                    disabled={variants.length >= 6}
                  >
                    <PlusIcon className="size-4" /> Add
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Two or more message variants, bucketed per visitor. Results appear in Analytics.
                </p>
                {variants.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No variants — showing the message above.
                  </p>
                ) : null}
                {variants.map((variant) => (
                  <div key={variant.id} className="grid gap-2 sm:grid-cols-[80px_90px_1fr_auto]">
                    <Input aria-label="Variant id" value={variant.id} readOnly />
                    <Input
                      aria-label={`${variant.id} weight`}
                      type="number"
                      min={1}
                      max={100}
                      value={variant.weight}
                      onChange={(e) => patchVariantWeight(variant.id, Number(e.target.value) || 1)}
                    />
                    <Textarea
                      aria-label={`${variant.id} template`}
                      rows={2}
                      value={variant.message.template}
                      onChange={(e) => patchVariantTemplate(variant.id, e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => removeVariant(variant.id)}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            </>
          ) : null}

          {step === 4 ? (
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label>Quick style</Label>
                <div className="flex flex-wrap gap-2">
                  {STYLE_PRESETS.map((item) => (
                    <button
                      key={item.name}
                      type="button"
                      onClick={() => patchConfig({ style: { ...config.style, ...item.preset } })}
                      className="rounded-md border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="n-accent">Accent colour</Label>
                  <Input
                    id="n-accent"
                    type="color"
                    className="h-10 w-full p-1"
                    value={config.style.accent}
                    onChange={(e) =>
                      patchConfig({ style: { ...config.style, accent: e.target.value } })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="n-shape">Corner shape</Label>
                  <select
                    id="n-shape"
                    className={selectClass}
                    value={config.style.shape}
                    onChange={(e) =>
                      patchConfig({
                        style: {
                          ...config.style,
                          shape: e.target.value as NotificationConfig["style"]["shape"],
                        },
                      })
                    }
                  >
                    <option value="rounded">Rounded</option>
                    <option value="square">Square</option>
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="n-size">Size</Label>
                  <select
                    id="n-size"
                    className={selectClass}
                    value={config.style.size}
                    onChange={(e) =>
                      patchConfig({
                        style: {
                          ...config.style,
                          size: e.target.value as NotificationConfig["style"]["size"],
                        },
                      })
                    }
                  >
                    <option value="sm">Small</option>
                    <option value="md">Medium</option>
                    <option value="lg">Large</option>
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="n-animation">Animation</Label>
                  <select
                    id="n-animation"
                    className={selectClass}
                    value={config.style.animation}
                    onChange={(e) =>
                      patchConfig({
                        style: {
                          ...config.style,
                          animation: e.target.value as NotificationConfig["style"]["animation"],
                        },
                      })
                    }
                  >
                    <option value="slide">Slide</option>
                    <option value="fade">Fade</option>
                    <option value="scale">Scale</option>
                    <option value="none">None</option>
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="n-font">Font</Label>
                  <select
                    id="n-font"
                    className={selectClass}
                    value={config.style.font ?? "system"}
                    onChange={(e) =>
                      patchConfig({
                        style: {
                          ...config.style,
                          font: e.target.value as NonNullable<NotificationConfig["style"]["font"]>,
                        },
                      })
                    }
                  >
                    {Object.entries(FONT_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-3 rounded-lg border border-border p-3">
                <div className="grid gap-2 sm:grid-cols-[180px_1fr] sm:items-end">
                  <div className="grid gap-2">
                    <Label htmlFor="n-click">On click</Label>
                    <select
                      id="n-click"
                      className={selectClass}
                      value={config.style.clickAction?.type ?? "none"}
                      onChange={(e) =>
                        patchConfig({
                          style: {
                            ...config.style,
                            clickAction:
                              e.target.value === "url"
                                ? {
                                    type: "url",
                                    url: config.style.clickAction?.url ?? "",
                                    newTab: config.style.clickAction?.newTab ?? true,
                                  }
                                : undefined,
                          },
                        })
                      }
                    >
                      <option value="none">Do nothing</option>
                      <option value="url">Open a URL</option>
                    </select>
                  </div>
                  {config.style.clickAction?.type === "url" ? (
                    <div className="grid gap-2">
                      <Label htmlFor="n-click-url">URL</Label>
                      <Input
                        id="n-click-url"
                        placeholder="https://yourstore.com/pricing"
                        value={config.style.clickAction.url ?? ""}
                        onChange={(e) =>
                          patchConfig({
                            style: {
                              ...config.style,
                              clickAction: {
                                type: "url",
                                url: e.target.value,
                                newTab: config.style.clickAction?.newTab ?? true,
                              },
                            },
                          })
                        }
                      />
                    </div>
                  ) : null}
                </div>
                {config.style.clickAction?.type === "url" ? (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={config.style.clickAction.newTab ?? true}
                      onChange={(e) =>
                        patchConfig({
                          style: {
                            ...config.style,
                            clickAction: {
                              type: "url",
                              url: config.style.clickAction?.url ?? "",
                              newTab: e.target.checked,
                            },
                          },
                        })
                      }
                    />
                    Open in a new tab
                  </label>
                ) : null}
              </div>
            </div>
          ) : null}

          {step === 5 ? (
            <div className="grid gap-4">
              <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <span className="text-sm">
                  Active
                  <span className="block text-xs text-muted-foreground">
                    Turn off to pause without deleting.
                  </span>
                </span>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </label>
              <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <span className="text-sm">
                  ✓ Verified badge
                  <span className="block text-xs text-muted-foreground">
                    Show the “Verified by Tacto” mark — only enable for genuine, ethical proof.
                  </span>
                </span>
                <Switch checked={verified} onCheckedChange={setVerified} />
              </label>
              <div className="rounded-lg border p-3 text-sm">
                <p className="font-medium">{name}</p>
                <p className="mt-1 text-muted-foreground">
                  {TYPES.find((t) => t.value === type)?.label ?? type} ·{" "}
                  {POSITION_LABELS[config.style.position]} · shows on{" "}
                  {config.display.url.mode === "all"
                    ? "all pages"
                    : `${config.display.url.mode} ${config.display.url.value ?? ""}`}
                </p>
              </div>
            </div>
          ) : null}

          <DialogFooter className="flex-row items-center justify-between gap-2 sm:justify-between">
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={step === 0}
                onClick={() => setStep((s) => Math.max(0, s - 1))}
              >
                Back
              </Button>
              {step < EDITOR_STEPS.length - 1 ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setStep((s) => Math.min(EDITOR_STEPS.length - 1, s + 1))}
                >
                  Next
                </Button>
              ) : null}
            </div>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : existing ? "Save changes" : "Publish notification"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
