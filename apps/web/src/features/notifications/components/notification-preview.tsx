import type { NotificationConfig, NotificationType } from "@repo/contracts/notifications";
import { CheckIcon } from "lucide-react";

const TYPE_ICON: Record<string, string> = {
  recent_sales: "🛒",
  review: "★",
  live_visitors: "👀",
  counter: "📈",
  combo: "📈",
  custom: "💬",
  countdown: "⏳",
  low_stock: "🔥",
  popup: "🎉",
  bar: "📣",
  spin_to_win: "🎁",
};

// Sample values so the template reads realistically in the editor preview.
function samplePreview(config: NotificationConfig, type: NotificationType): string {
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
}: {
  config: NotificationConfig;
  type: NotificationType;
  verified?: boolean;
}) {
  const shape = config.style.shape === "square" ? "rounded-lg" : "rounded-2xl";
  return (
    <div className="flex min-h-40 items-end justify-start rounded-xl border border-dashed bg-muted/40 p-6">
      <div
        className={`flex max-w-[360px] items-center gap-3.5 border bg-white ${shape} px-4 py-3 shadow-lg`}
        style={{ borderColor: "#e7e9f0" }}
      >
        <span
          className="grid size-11 flex-none place-items-center rounded-xl text-xl"
          style={{ background: `${config.style.accent}14` }}
        >
          {TYPE_ICON[type] ?? "🔔"}
        </span>
        <div className="min-w-0 text-[#17181c]">
          <p className="text-[13.5px] font-bold leading-snug">
            {samplePreview(config, type) || "Your notification message"}
          </p>
          <p className="mt-0.5 text-xs text-[#5b606e]">12 minutes ago</p>
          {verified ? (
            <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-[#0e9f6e]">
              <CheckIcon className="size-3" /> Verified by Tacto
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
