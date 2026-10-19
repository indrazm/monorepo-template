import type { SpinClaimResponse, WidgetNotification } from "@repo/contracts/widget";
import { createTypeIcon } from "../icons";
import { isSafeHttpUrl } from "../safe-url";

type RenderResult = { card: HTMLElement; close: HTMLElement | null };
type RenderOptions = {
  showClose: boolean;
  showBadge: boolean;
  // Fired once when a conversion widget hands out a reward (F69).
  onClaim?: (refId: string, variantId?: string) => void;
  // Server-side weighted draw; resolves with this visitor's idempotent reward.
  onSpinClaim?: (refId: string, variantId?: string) => Promise<SpinClaimResponse | null>;
};

function formatRemaining(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const total = Math.floor(ms / 1000);
  const d = Math.floor(total / 86_400);
  const h = Math.floor((total % 86_400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return (d > 0 ? `${d}d ` : "") + `${pad(h)}:${pad(m)}:${pad(s)}`;
}

// Applies the richer style knobs (feedback T9) to a card element.
function decorateCard(card: HTMLElement, notification: WidgetNotification): void {
  card.setAttribute("data-shape", notification.style.shape ?? "rounded");
  card.setAttribute("data-size", notification.style.size ?? "md");
  card.setAttribute("data-font", notification.style.font ?? "system");
  card.setAttribute("data-animation", notification.style.animation ?? "slide");
  if (notification.clickUrl) card.setAttribute("data-clickable", "1");
}

function buildClose(label = "Close notification"): HTMLElement {
  const close = document.createElement("button");
  close.className = "tacto-close";
  close.setAttribute("aria-label", label);
  close.textContent = "×";
  return close;
}

function buildVerified(): HTMLElement {
  const verified = document.createElement("div");
  verified.className = "tacto-verified";
  verified.textContent = "✓ Verified by Tacto";
  return verified;
}

function buildBadge(): HTMLElement {
  const badge = document.createElement("div");
  badge.className = "tacto-badge";
  const link = document.createElement("a");
  link.href = "https://tacto.io";
  link.target = "_blank";
  link.rel = "noopener";
  link.textContent = "Powered by Tacto";
  badge.appendChild(link);
  return badge;
}

// Dispatches to the right renderer: social-proof card vs. conversion widgets
// (F69). All return the same shape so the scheduler stays type-agnostic.
export function renderCard(notification: WidgetNotification, options: RenderOptions): RenderResult {
  switch (notification.type) {
    case "bar":
      return renderBar(notification, options);
    case "popup":
      return renderPopup(notification, options);
    case "spin_to_win":
      return renderSpin(notification, options);
    case "review":
      return renderReview(notification, options);
    default:
      return renderSocialCard(notification, options);
  }
}

// A review card (feedback T6): avatar, star rating, quote and author.
function renderReview(notification: WidgetNotification, options: RenderOptions): RenderResult {
  const card = document.createElement("div");
  card.className = "tacto-card";
  decorateCard(card, notification);
  card.style.borderColor = "#e7e9f0";

  const media = document.createElement("div");
  media.className = "tacto-media";
  if (isSafeHttpUrl(notification.mediaUrl)) {
    const img = document.createElement("img");
    img.src = notification.mediaUrl;
    img.alt = "";
    media.appendChild(img);
  } else {
    media.appendChild(createTypeIcon("review", notification.style.accent));
  }

  const body = document.createElement("div");
  body.className = "tacto-body";

  if (typeof notification.rating === "number") {
    const stars = document.createElement("div");
    stars.className = "tacto-stars";
    const rounded = Math.round(notification.rating);
    stars.textContent = `${"★".repeat(rounded)}${"☆".repeat(Math.max(0, 5 - rounded))}`;
    stars.style.color = notification.style.accent;
    body.appendChild(stars);
  }

  const msg = document.createElement("div");
  msg.className = "tacto-msg";
  msg.textContent = notification.message;
  body.appendChild(msg);

  const who = [notification.author, notification.sourceLabel].filter(Boolean).join(" · ");
  if (who) {
    const sub = document.createElement("div");
    sub.className = "tacto-sub";
    sub.textContent = who;
    body.appendChild(sub);
  }
  if (notification.verified) body.appendChild(buildVerified());
  if (options.showBadge) body.appendChild(buildBadge());

  card.append(media, body);
  let close: HTMLElement | null = null;
  if (options.showClose) {
    close = buildClose();
    card.appendChild(close);
  }
  media.style.boxShadow = `inset 0 0 0 1px ${notification.style.accent}22`;
  return { card, close };
}

// The signature notification card (style-guide .livecard).
function renderSocialCard(notification: WidgetNotification, options: RenderOptions): RenderResult {
  const card = document.createElement("div");
  card.className = "tacto-card";
  decorateCard(card, notification);
  card.style.borderColor = "#e7e9f0";

  const media = document.createElement("div");
  media.className = "tacto-media";
  if (isSafeHttpUrl(notification.mediaUrl)) {
    const img = document.createElement("img");
    img.src = notification.mediaUrl;
    img.alt = "";
    media.appendChild(img);
  } else {
    media.appendChild(createTypeIcon(notification.type, notification.style.accent));
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
  if (notification.countdownEndsAt) {
    const endsAt = new Date(notification.countdownEndsAt).getTime();
    const timer = document.createElement("div");
    timer.className = "tacto-countdown";
    timer.appendChild(createTypeIcon("countdown", notification.style.accent));
    const timerText = document.createElement("span");
    timer.appendChild(timerText);
    const tick = () => {
      timerText.textContent = ` ${formatRemaining(endsAt - Date.now())}`;
      if (!card.isConnected || endsAt - Date.now() <= 0) clearInterval(handle);
    };
    const handle = setInterval(tick, 1000);
    tick();
    body.appendChild(timer);
  }
  if (notification.verified) body.appendChild(buildVerified());
  if (options.showBadge) body.appendChild(buildBadge());

  card.append(media, body);

  let close: HTMLElement | null = null;
  if (options.showClose) {
    close = buildClose();
    card.appendChild(close);
  }
  // Accent tint on the left media tile.
  media.style.boxShadow = `inset 0 0 0 1px ${notification.style.accent}22`;
  return { card, close };
}

// Full-width notification bar pinned to the top or bottom of the viewport.
function renderBar(notification: WidgetNotification, options: RenderOptions): RenderResult {
  const bar = document.createElement("div");
  bar.className = "tacto-bar";
  bar.setAttribute("data-shape", notification.style.shape ?? "rounded");
  bar.setAttribute("data-size", notification.style.size ?? "md");
  bar.setAttribute("data-font", notification.style.font ?? "system");
  bar.setAttribute("data-animation", notification.style.animation ?? "slide");
  bar.style.background = notification.style.accent;

  const icon = document.createElement("span");
  icon.className = "tacto-bar-icon";
  icon.appendChild(createTypeIcon(notification.type, "#FFFFFF"));

  const msg = document.createElement("span");
  msg.className = "tacto-bar-msg";
  msg.textContent = notification.message;

  bar.append(icon, msg);
  if (notification.verified) bar.appendChild(buildVerified());
  if (options.showBadge) bar.appendChild(buildBadge());

  // Overlays and bars are always dismissable (accessibility, NFR-A11Y-01).
  const close = buildClose();
  bar.appendChild(close);
  return { card: bar, close };
}

function overlayWithModal(shape: string): { overlay: HTMLElement; modal: HTMLElement } {
  const overlay = document.createElement("div");
  overlay.className = "tacto-overlay";
  const modal = document.createElement("div");
  modal.className = "tacto-modal";
  modal.setAttribute("data-shape", shape);
  overlay.appendChild(modal);
  return { overlay, modal };
}

// Centered modal popup.
function renderPopup(notification: WidgetNotification, options: RenderOptions): RenderResult {
  const { overlay, modal } = overlayWithModal(notification.style.shape ?? "rounded");
  const close = buildClose();
  modal.setAttribute("data-size", notification.style.size ?? "md");
  modal.setAttribute("data-font", notification.style.font ?? "system");
  modal.setAttribute("data-animation", notification.style.animation ?? "slide");

  const media = document.createElement("div");
  media.className = "tacto-modal-icon";
  media.style.background = `${notification.style.accent}1a`;
  media.appendChild(createTypeIcon(notification.type, notification.style.accent));

  const title = document.createElement("p");
  title.className = "tacto-modal-title";
  title.textContent = notification.message;

  modal.append(media, title);
  if (notification.timeAgo) {
    const sub = document.createElement("p");
    sub.className = "tacto-sub";
    sub.textContent = notification.timeAgo;
    modal.appendChild(sub);
  }
  if (notification.verified) modal.appendChild(buildVerified());
  if (options.showBadge) modal.appendChild(buildBadge());
  modal.appendChild(close);
  return { card: overlay, close };
}

// Spin-to-win overlay: a wheel that spins once to reveal a real reward (F69).
// The prize is drawn from the configured weighted pool; when it carries a coupon
// code or redemption URL the winner gets it, and the claim is reported once.
function renderSpin(notification: WidgetNotification, options: RenderOptions): RenderResult {
  const { overlay, modal } = overlayWithModal(notification.style.shape ?? "rounded");
  const close = buildClose();

  const heading = document.createElement("p");
  heading.className = "tacto-modal-title";
  heading.appendChild(createTypeIcon("spin_to_win", notification.style.accent));
  heading.append(" Spin to win");

  const wheelWrap = document.createElement("div");
  wheelWrap.className = "tacto-wheel-wrap";
  const wheel = document.createElement("div");
  wheel.className = "tacto-wheel";
  wheel.style.background = `conic-gradient(${notification.style.accent} 0 25%, #eef0f6 0 50%, ${notification.style.accent} 0 75%, #eef0f6 0)`;
  const pointer = document.createElement("div");
  pointer.className = "tacto-spin-pointer";
  pointer.textContent = "▼";
  wheelWrap.append(wheel, pointer);

  const button = document.createElement("button");
  button.className = "tacto-spin-btn";
  button.style.background = notification.style.accent;
  button.textContent = "Spin the wheel";

  const result = document.createElement("p");
  result.className = "tacto-spin-result";

  let spun = false;
  button.addEventListener("click", async () => {
    if (spun) return;
    spun = true;
    button.disabled = true;
    const degrees = 1440 + Math.floor(Math.random() * 360);
    wheel.style.transform = `rotate(${degrees}deg)`;

    // The API draws and persists the prize; the payload only carries labels.
    const reward = await options.onSpinClaim?.(notification.id, notification.variantId);

    setTimeout(() => {
      result.setAttribute("data-shown", "1");
      if (!reward) {
        result.textContent = "Could not claim the reward. Please try again.";
        button.disabled = false;
        spun = false;
        return;
      }

      result.textContent = reward.label;
      if (reward.code || isSafeHttpUrl(reward.url)) {
        const rewardEl = document.createElement("div");
        rewardEl.className = "tacto-spin-reward";
        if (reward.code) {
          const code = document.createElement("code");
          code.className = "tacto-spin-code";
          code.textContent = reward.code;
          rewardEl.appendChild(code);
        }
        if (isSafeHttpUrl(reward.url)) {
          const link = document.createElement("a");
          link.className = "tacto-spin-redeem";
          link.href = reward.url;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.textContent = "Redeem now";
          rewardEl.appendChild(link);
        }
        const valid = document.createElement("div");
        valid.className = "tacto-sub";
        valid.textContent = `Valid for ${reward.validForDays} days`;
        rewardEl.appendChild(valid);
        modal.insertBefore(rewardEl, button);
      }
      button.textContent = "You won!";
      // A real reward was handed out — report the claim for analytics/goals.
      options.onClaim?.(notification.id, notification.variantId);
    }, 3200);
  });

  modal.append(heading, wheelWrap, button, result);
  if (notification.verified) modal.appendChild(buildVerified());
  if (options.showBadge) modal.appendChild(buildBadge());
  modal.appendChild(close);
  return { card: overlay, close };
}
