import type { WidgetNotification } from "@repo/contracts/widget";

const ICONS: Record<string, string> = {
  recent_sales: "🛒",
  review: "★",
  live_visitors: "👀",
  counter: "📈",
  combo: "📈",
  custom: "💬",
};

// Builds the signature notification card (style-guide .livecard). Returns the
// card plus its close button so the scheduler can wire interactions.
export function renderCard(
  notification: WidgetNotification,
  options: { showClose: boolean; showBadge: boolean },
): { card: HTMLElement; close: HTMLElement | null } {
  const card = document.createElement("div");
  card.className = "tacto-card";
  card.setAttribute("data-shape", notification.style.shape ?? "rounded");
  card.style.borderColor = "#e7e9f0";

  const media = document.createElement("div");
  media.className = "tacto-media";
  if (notification.mediaUrl) {
    const img = document.createElement("img");
    img.src = notification.mediaUrl;
    img.alt = "";
    media.appendChild(img);
  } else {
    media.textContent = ICONS[notification.type] ?? "🔔";
  }

  const body = document.createElement("div");
  body.className = "tacto-body";
  const msg = document.createElement("div");
  msg.className = "tacto-msg";
  msg.textContent = notification.message;
  body.appendChild(msg);

  if (notification.timeAgo) {
    const sub = document.createElement("div");
    sub.className = "tacto-sub";
    sub.textContent = notification.timeAgo;
    body.appendChild(sub);
  }
  if (notification.verified) {
    const verified = document.createElement("div");
    verified.className = "tacto-verified";
    verified.textContent = "✓ Verified by Tacto";
    body.appendChild(verified);
  }
  if (options.showBadge) {
    const badge = document.createElement("div");
    badge.className = "tacto-badge";
    const link = document.createElement("a");
    link.href = "https://tacto.io";
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = "Powered by Tacto";
    badge.appendChild(link);
    body.appendChild(badge);
  }

  card.append(media, body);

  let close: HTMLElement | null = null;
  if (options.showClose) {
    close = document.createElement("button");
    close.className = "tacto-close";
    close.setAttribute("aria-label", "Close notification");
    close.textContent = "×";
    card.appendChild(close);
  }
  // Accent tint on the left media tile.
  media.style.boxShadow = `inset 0 0 0 1px ${notification.style.accent}22`;
  return { card, close };
}
