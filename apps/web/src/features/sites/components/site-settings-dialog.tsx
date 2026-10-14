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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getSiteSettings, updateSiteSettings } from "../services";

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

  const save = useMutation({
    mutationFn: (value: DomainSetting) => updateSiteSettings(siteId, value),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["site-settings", siteId] });
      toast.success("Settings saved");
      onSaved();
    },
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
