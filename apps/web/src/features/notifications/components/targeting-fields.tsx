import type { NotificationConfig, NotificationDisplay } from "@repo/contracts/notifications";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { PlusIcon, XIcon } from "lucide-react";

const selectClass =
  "border-input bg-background focus-visible:ring-ring h-9 rounded-md border px-3 text-sm focus-visible:ring-[3px] focus-visible:outline-none";

// ---------------------------------------------------------------------------
// Display targeting (FR-NED-07). Every rule here is executed by the payload
// endpoint — country, campaign parameters, referrer and visitor segment — so
// nothing in this panel is decorative.
// ---------------------------------------------------------------------------

export function TargetingFields({
  display,
  onChange,
}: {
  display: NotificationDisplay;
  onChange: (display: NotificationConfig["display"]) => void;
}) {
  const utmPairs = Object.entries(display.utm ?? {});
  const referrerMode = display.referrer?.mode ?? "any";

  function setUtm(pairs: [string, string][]) {
    const utm = Object.fromEntries(pairs.filter(([name]) => name.trim().length > 0));
    onChange({ ...display, utm: Object.keys(utm).length > 0 ? utm : undefined });
  }

  return (
    <div className="grid gap-4 rounded-md border p-4">
      <p className="text-xs font-semibold text-muted-foreground">Who sees this</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="n-visitor">Visitor</Label>
          <select
            id="n-visitor"
            className={selectClass}
            value={display.visitor ?? "all"}
            onChange={(e) =>
              onChange({
                ...display,
                visitor:
                  e.target.value === "all" ? undefined : (e.target.value as "new" | "returning"),
              })
            }
          >
            <option value="all">Everyone</option>
            <option value="new">First-time visitors</option>
            <option value="returning">Returning visitors</option>
          </select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="n-countries">Countries</Label>
          <Input
            id="n-countries"
            placeholder="ID, SG, MY — empty means everywhere"
            value={(display.countries ?? []).join(", ")}
            onChange={(e) => {
              const codes = e.target.value
                .split(",")
                .map((code) => code.trim().toUpperCase())
                .filter((code) => code.length === 2);
              onChange({ ...display, countries: codes.length > 0 ? codes : undefined });
            }}
          />
          <p className="text-xs text-muted-foreground">
            Two-letter codes. Visitors whose country we cannot determine still see it.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
        <div className="grid gap-2">
          <Label htmlFor="n-ref-mode">Referrer</Label>
          <select
            id="n-ref-mode"
            className={selectClass}
            value={referrerMode}
            onChange={(e) => {
              const mode = e.target.value as "any" | "contains" | "regex";
              onChange({
                ...display,
                referrer:
                  mode === "any" ? undefined : { mode, value: display.referrer?.value ?? "" },
              });
            }}
          >
            <option value="any">Any source</option>
            <option value="contains">Contains</option>
            <option value="regex">Regex</option>
          </select>
        </div>
        {referrerMode !== "any" ? (
          <div className="grid gap-2">
            <Label htmlFor="n-ref-value">Referrer match</Label>
            <Input
              id="n-ref-value"
              placeholder="google.com"
              value={display.referrer?.value ?? ""}
              onChange={(e) =>
                onChange({
                  ...display,
                  referrer: { mode: referrerMode, value: e.target.value },
                })
              }
            />
            <p className="text-xs text-muted-foreground">
              Visitors who arrive with no referrer will not see this notification.
            </p>
          </div>
        ) : null}
      </div>

      <div className="grid gap-2">
        <Label>Campaign parameters (UTM)</Label>
        {utmPairs.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No campaign rules — shown on any traffic source.
          </p>
        ) : null}
        {utmPairs.map(([name, value], index) => (
          <div key={`${name}-${index}`} className="flex flex-wrap items-center gap-2">
            <Input
              className="max-w-[200px]"
              placeholder="utm_source"
              value={name}
              onChange={(e) => {
                const next: [string, string][] = utmPairs.map((pair, position) =>
                  position === index ? [e.target.value, pair[1]] : pair,
                );
                setUtm(next);
              }}
            />
            <Input
              className="max-w-[200px]"
              placeholder="newsletter"
              value={value}
              onChange={(e) => {
                const next: [string, string][] = utmPairs.map((pair, position) =>
                  position === index ? [pair[0], e.target.value] : pair,
                );
                setUtm(next);
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Remove parameter"
              onClick={() => setUtm(utmPairs.filter((_, position) => position !== index))}
            >
              <XIcon className="size-4" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-fit border"
          onClick={() => setUtm([...utmPairs, ["utm_source", ""]])}
        >
          <PlusIcon className="size-4" /> Add parameter
        </Button>
        <p className="text-xs text-muted-foreground">
          All listed parameters must match the landing URL for the notification to show.
        </p>
      </div>
    </div>
  );
}
