import type { WidgetNotification } from "@repo/contracts/widget";

// Opens a notification's click-action URL (feedback T9). Defaults to a new tab
// with noopener; never throws so a failed open cannot break the host page.
export function openClickTarget(notification: WidgetNotification): void {
  if (!notification.clickUrl) return;
  try {
    window.open(
      notification.clickUrl,
      notification.clickNewTab === false ? "_self" : "_blank",
      "noopener",
    );
  } catch {
    /* fail-safe */
  }
}
