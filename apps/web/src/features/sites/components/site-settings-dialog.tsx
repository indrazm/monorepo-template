import type { DomainSetting } from "@repo/contracts/sites";
import { Button } from "@repo/ui/components/button";
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
import { planLimits, type Plan } from "@repo/contracts/billing";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { apiClient } from "../../../api";
import {
  deleteSiteEvents,
  downloadSiteEvents,
  getSiteSettings,
  updateSiteSettings,
} from "../services";
import { ManualOrderEditor } from "./manual-order-editor";

// Example shown in the Custom JS field — the sandbox API in three lines.
const PLACEHOLDER_JS = [
  "window.tacto.on(function (event, notification) {",
  '  if (event === "click") window.tacto.track("cta_click");',
  "});",
].join("\n");

const selectClass =
  "border-input bg-background focus-visible:ring-ring h-9 rounded-md border px-3 text-sm focus-visible:ring-[3px] focus-visible:outline-none";

// Per-domain global settings (FR-NGS-01/02/03/05, FR-NGS-04 custom CSS).
export function SiteSettingsDialog({ siteId }: { siteId: string }) {
  const [open, setOpen] = useState(false);
  const query = useQuery({
    queryKey: ["site-settings", siteId],
    queryFn: () => getSiteSettings(siteId),
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          Settings
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Domain settings</DialogTitle>
          <DialogDescription>
            Control how notifications loop, order, and respect visitor privacy on this site.
          </DialogDescription>
        </DialogHeader>
        {query.data ? (
          // Keyed by loaded data so initial form state comes from props, no effect.
          <SettingsForm
            key={siteId}
            siteId={siteId}
            initial={query.data}
            onSaved={() => setOpen(false)}
          />
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SettingsForm({
  siteId,
  initial,
  onSaved,
}: {
  siteId: string;
  initial: DomainSetting;
  onSaved: () => void;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<DomainSetting>(initial);
  // Custom JS is gated server-side too; this only keeps the UI honest.
  const plan = useQuery({
    queryKey: ["billing"],
    queryFn: async () => {
      const response = await apiClient.api.v1.billing.$get();
      if (!response.ok) throw new Error("Failed to load billing.");
      return (await response.json()).overview;
    },
    staleTime: 60_000,
  });
  const customCodeAllowed = planLimits[(plan.data?.plan ?? "free") as Plan].customCode;

  const save = useMutation({
    mutationFn: (value: DomainSetting) => updateSiteSettings(siteId, value),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["site-settings", siteId] });
      toast.success("Settings saved");
      onSaved();
    },
    onError: (error) => toast.error(error.message),
  });

  const exportEvents = useMutation({
    mutationFn: (format: "json" | "csv") => downloadSiteEvents(siteId, format),
    onError: (error) => toast.error(error.message),
  });
  const purge = useMutation({
    mutationFn: () => deleteSiteEvents(siteId),
    onSuccess: (removed) => toast.success(`Deleted ${removed} events`),
    onError: (error) => toast.error(error.message),
  });

  const setLoop = (patch: Partial<DomainSetting["loop"]>) =>
    setDraft({ ...draft, loop: { ...draft.loop, ...patch } });
  const setPrivacy = (patch: Partial<DomainSetting["privacy"]>) =>
    setDraft({ ...draft, privacy: { ...draft.privacy, ...patch } });
  const setPass = (patch: Partial<DomainSetting["analyticsPassthrough"]>) =>
    setDraft({ ...draft, analyticsPassthrough: { ...draft.analyticsPassthrough, ...patch } });

  return (
    <form
      className="grid gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate(draft);
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="loopAfter">Loop after (count)</Label>
          <Input
            id="loopAfter"
            type="number"
            min={0}
            value={draft.loop.loopAfter}
            onChange={(e) => setLoop({ loopAfter: Number(e.target.value) })}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="order">Order</Label>
          <select
            id="order"
            className={selectClass}
            value={draft.loop.order}
            onChange={(e) => setLoop({ order: e.target.value as "random" | "manual" })}
          >
            <option value="random">Random</option>
            <option value="manual">Manual</option>
          </select>
        </div>
        {draft.loop.order === "manual" ? (
          <div className="grid gap-2 sm:col-span-2">
            <Label>Display order</Label>
            <ManualOrderEditor
              siteId={siteId}
              value={draft.loop.manualOrder}
              onChange={(manualOrder) => setLoop({ manualOrder })}
            />
            <p className="text-xs text-muted-foreground">
              Notifications are shown top to bottom in this order.
            </p>
          </div>
        ) : null}
        <div className="grid gap-2">
          <Label htmlFor="closeForDays">Snooze on close (days)</Label>
          <Input
            id="closeForDays"
            type="number"
            min={0}
            value={draft.loop.closeForDays}
            onChange={(e) => setLoop({ closeForDays: Number(e.target.value) })}
          />
        </div>
        <label className="flex items-center justify-between gap-3 pt-6">
          <span className="text-sm">Show close button</span>
          <Switch
            checked={draft.loop.showClose}
            onCheckedChange={(checked) => setLoop({ showClose: checked })}
          />
        </label>
      </div>

      <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
        <span className="text-sm">
          Require consent before tracking
          <span className="block text-xs text-muted-foreground">
            GDPR: hold tracking until consent.
          </span>
        </span>
        <Switch
          checked={draft.privacy.requireConsent}
          onCheckedChange={(checked) => setPrivacy({ requireConsent: checked })}
        />
      </label>

      <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
        <span className="text-sm">
          Filter profanity
          <span className="block text-xs text-muted-foreground">Mask coarse words in text.</span>
        </span>
        <Switch
          checked={draft.privacy.filterProfanity}
          onCheckedChange={(checked) => setPrivacy({ filterProfanity: checked })}
        />
      </label>

      <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
        <span className="text-sm">
          Use visitor location
          <span className="block text-xs text-muted-foreground">
            Geotarget by the visitor's country (from the CDN header). Off = country filters ignore
            the visitor.
          </span>
        </span>
        <Switch
          checked={draft.privacy.trackIpGeo}
          onCheckedChange={(checked) => setPrivacy({ trackIpGeo: checked })}
        />
      </label>

      <div className="grid gap-2">
        <Label htmlFor="blockedIps">Blocked IPs (one per line)</Label>
        <Textarea
          id="blockedIps"
          rows={2}
          placeholder="203.0.113.5"
          value={draft.privacy.blockedIps.join("\n")}
          onChange={(e) =>
            setPrivacy({
              blockedIps: e.target.value
                .split("\n")
                .map((ip) => ip.trim())
                .filter(Boolean),
            })
          }
        />
      </div>

      <div className="grid gap-3 rounded-lg border p-3">
        <div>
          <p className="text-sm font-medium">Your data</p>
          <p className="text-xs text-muted-foreground">
            Export or erase the events stored for this site (GDPR).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={exportEvents.isPending}
            onClick={() => exportEvents.mutate("csv")}
          >
            Export CSV
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={exportEvents.isPending}
            onClick={() => exportEvents.mutate("json")}
          >
            Export JSON
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={purge.isPending}
            onClick={() => {
              if (window.confirm("Delete all events for this site? This cannot be undone.")) {
                purge.mutate();
              }
            }}
          >
            Delete all events
          </Button>
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="customCss">Custom CSS (advanced)</Label>
        <Textarea
          id="customCss"
          rows={3}
          placeholder=".tacto-card { border-radius: 24px; }"
          value={draft.customCss ?? ""}
          onChange={(e) => setDraft({ ...draft, customCss: e.target.value || null })}
        />
      </div>

      {/* Custom JS (FR-NGS-04). Runs in a sandboxed iframe, Growth+ only. */}
      <div className="grid gap-2">
        <Label htmlFor="customJs">
          Custom JS (advanced){customCodeAllowed ? null : " — Growth plan and above"}
        </Label>
        <Textarea
          id="customJs"
          rows={4}
          disabled={!customCodeAllowed}
          placeholder={PLACEHOLDER_JS}
          value={draft.customJs ?? ""}
          onChange={(e) => setDraft({ ...draft, customJs: e.target.value || null })}
        />
        <p className="text-xs text-muted-foreground">
          {customCodeAllowed
            ? "Runs inside a sandboxed, cross-origin iframe — it cannot read your page, cookies or visitors' data. Available API: window.tacto.on(fn), window.tacto.track(name), window.tacto.log(message)."
            : "Upgrade to Growth to run custom code in the widget sandbox."}
        </p>
      </div>

      <div className="grid gap-2">
        <span className="text-sm font-medium">Forward events to your analytics</span>
        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              ["gtag", "Google Analytics (gtag)"],
              ["dataLayer", "Google Tag Manager"],
              ["fbq", "Facebook Pixel"],
              ["mixpanel", "Mixpanel"],
            ] as const
          ).map(([key, label]) => (
            <label
              key={key}
              className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
            >
              {label}
              <Switch
                checked={draft.analyticsPassthrough[key]}
                onCheckedChange={(checked) => setPass({ [key]: checked })}
              />
            </label>
          ))}
        </div>
      </div>

      <DialogFooter>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save settings"}
        </Button>
      </DialogFooter>
    </form>
  );
}
