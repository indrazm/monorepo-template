import type { NotificationConfig, NotificationType } from "@repo/contracts/notifications";
import { CheckIcon } from "lucide-react";

const TYPE_ICON: Record<string, string> = {
  recent_sales: "🛒",
  live_visitors: "👀",
  counter: "📈",
  combo: "📈",
  custom: "💬",
  countdown: "⏳",
  low_stock: "🔥",
  popup: "🎉",
  bar: "📣",
  spin_to_win: "🎁",
  review: "⭐",
  social_counter: "👥",
  youtube: "▶️",
};

function compact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(value);
}

// Sample values so the template reads realistically in the editor preview.
function samplePreview(config: NotificationConfig, type: NotificationType): string {
  if (type === "review")
    return config.reviews?.[0]?.text || "Absolutely love this — highly recommend!";
  if (type === "social_counter") {
    const sc = config.socialCounter;
    return sc ? `${compact(sc.count)} ${sc.label ?? "followers"}` : "12.3K followers";
  }
  if (type === "youtube") {
    const yt = config.youtube;
    return yt
      ? `${compact(yt.count)} ${yt.label ?? (yt.metric === "views" ? "views" : "subscribers")}`
      : "45K subscribers";
  }
  return config.message.template
    .replace(/\{\{\s*first_name\s*\}\}/g, "Mike")
    .replace(/\{\{\s*city\s*\}\}/g, "London")
    .replace(/\{\{\s*product\s*\}\}/g, "Nike Air")
    .replace(/\{\{\s*count\s*\}\}/g, type === "live_visitors" ? "18" : "243")
    .replace(/\{\{\s*time_ago\s*\}\}/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function NotificationPreview({
  config,
  type,
  verified,
  device = "desktop",
}: {
  config: NotificationConfig;
  type: NotificationType;
  verified?: boolean;
  // Renders a mobile-width frame (FR-NED-01 device preview).
  device?: "desktop" | "mobile";
}) {
  const shape = config.style.shape === "square" ? "rounded-lg" : "rounded-2xl";
  const frame = device === "mobile" ? "w-[320px] max-w-full" : "w-full max-w-[420px]";
  return (
    <div className="flex min-h-40 items-end justify-center rounded-xl border border-dashed bg-muted/40 p-6">
      <div className={`${frame} flex items-center justify-center`}>
        <div
          className={`flex w-full max-w-[360px] items-center gap-3.5 border bg-white ${shape} px-4 py-3 shadow-lg`}
          style={{ borderColor: "#e7e9f0" }}
        >
          <span
            className="grid size-12 flex-none place-items-center overflow-hidden rounded-xl text-xl"
            style={{ background: `${config.style.accent}14` }}
          >
            {config.media?.imageUrl ? (
              <img src={config.media.imageUrl} alt="" className="size-full object-cover" />
            ) : (
              (TYPE_ICON[type] ?? "🔔")
            )}
          </span>
          <div className="min-w-0 text-[#17181c]">
            <p className="text-sm font-bold leading-snug">
              {samplePreview(config, type) || "Your notification message"}
            </p>
            <p className="mt-0.5 text-xs text-[#5b606e]">12 minutes ago</p>
            {verified ? (
              <span className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-[#0e9f6e]">
                <CheckIcon className="size-3.5" /> Verified by Tacto
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
