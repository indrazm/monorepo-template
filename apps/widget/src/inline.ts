import type { WidgetNotification } from "@repo/contracts/widget";
import { openClickTarget } from "./click";
import { debug } from "./debug";
import { renderCard } from "./render/notification";
import { createInlineHost } from "./shadow";

// Inline social proof (feedback T8): render notifications that declare an
// `inlineSelector` into the first matching element on the page, rather than as
// a floating overlay. These do not cycle — they sit in the layout like content.
export function mountInline(options: {
  notifications: WidgetNotification[];
  showBadge: boolean;
  onView: (refId: string, variantId?: string) => void;
  onClick: (refId: string, variantId?: string) => void;
}): void {
  const { notifications, showBadge, onView, onClick } = options;
  for (const notification of notifications) {
    const selector = notification.inlineSelector;
    if (!selector) continue;
    let target: Element | null = null;
    try {
      target = document.querySelector(selector);
    } catch {
      debug.log(`Inline selector is invalid: ${selector}`);
      continue;
    }
    if (!target) {
      debug.log(`Inline target not found on page: ${selector}`);
      continue;
    }
    const host = createInlineHost(target);
    const { card, close } = renderCard(notification, { showClose: false, showBadge });
    host.stack.appendChild(card);
    card.setAttribute("data-shown", "1");
    onView(notification.id, notification.variantId);
    card.addEventListener("click", (domEvent) => {
      if (close && domEvent.target === close) return;
      onClick(notification.id, notification.variantId);
      openClickTarget(notification);
    });
    debug.log(`Inline notification mounted into ${selector}`);
  }
}
