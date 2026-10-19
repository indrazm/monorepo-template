import type { SpinClaimResponse, WidgetNotification } from "@repo/contracts/widget";
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
  onClaim?: (refId: string, variantId?: string) => void;
  onSpinClaim?: (refId: string, variantId?: string) => Promise<SpinClaimResponse | null>;
}): () => void {
  const { notifications, showBadge, onView, onClick, onClaim, onSpinClaim } = options;
  const hosts: ReturnType<typeof createInlineHost>[] = [];
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
    hosts.push(host);
    const { card, close } = renderCard(notification, {
      showClose: false,
      showBadge,
      onClaim,
      onSpinClaim,
    });
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
  return () => {
    for (const host of hosts) host.destroy();
  };
}
