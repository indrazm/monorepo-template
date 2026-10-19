import type { WidgetNotification, WidgetSettings } from "@repo/contracts/widget";
import { openClickTarget } from "./click";
import { renderCard } from "./render/notification";
import type { ShadowHost } from "./shadow";

const prefersReducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

function shuffle<T>(items: T[]): T[] {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

const snoozeKey = (siteKey: string) => `tacto:closed:${siteKey}`;

function isSnoozed(siteKey: string): boolean {
  try {
    const until = Number(localStorage.getItem(snoozeKey(siteKey)));
    return Number.isFinite(until) && until > Date.now();
  } catch {
    return false;
  }
}

function snooze(siteKey: string, days: number): void {
  try {
    localStorage.setItem(snoozeKey(siteKey), String(Date.now() + days * 86_400_000));
  } catch {
    /* ignore */
  }
}

// Cycles notifications through the host one at a time, honoring timing, order,
// loop and close settings (SRS FR-NED-09, FR-NGS-01/02/03).
export function startScheduler(options: {
  host: ShadowHost;
  siteKey: string;
  notifications: WidgetNotification[];
  settings: WidgetSettings;
  onView: (refId: string, variantId?: string) => void;
  onClick: (refId: string, variantId?: string) => void;
  // A conversion widget handed out a reward (F69); reported once per claim.
  onClaim: (refId: string, variantId?: string) => void;
}): () => void {
  const { host, siteKey, notifications, settings, onView, onClick, onClaim } = options;
  let stopped = false;
  const timers: ReturnType<typeof setTimeout>[] = [];
  const wait = (ms: number) => new Promise<void>((resolve) => timers.push(setTimeout(resolve, ms)));

  if (notifications.length === 0 || isSnoozed(siteKey)) return () => undefined;

  const ordered = settings.order === "random" ? shuffle(notifications) : notifications;

  async function loop() {
    let shownCount = 0;
    do {
      for (const notification of ordered) {
        if (stopped) return;
        await wait(shownCount === 0 ? notification.timing.delayMs : notification.timing.intervalMs);
        if (stopped) return;
        await showOne(notification);
        shownCount++;
      }
    } while (!stopped && settings.loopAfter > 0);
  }

  function showOne(notification: WidgetNotification): Promise<void> {
    return new Promise<void>((resolve) => {
      const { card, close } = renderCard(notification, {
        showClose: settings.showClose,
        showBadge: settings.showBadge,
        onClaim: (refId, variantId) => onClaim(refId, variantId),
      });
      host.stack.appendChild(card);
      onView(notification.id, notification.variantId);
      card.addEventListener("click", (domEvent) => {
        if (close && domEvent.target === close) return;
        onClick(notification.id, notification.variantId);
        openClickTarget(notification);
      });
      close?.addEventListener("click", () => {
        snooze(siteKey, settings.closeForDays || 1);
        card.remove();
        stopped = true;
        host.destroy();
      });
      const reveal = () => card.setAttribute("data-shown", "1");
      if (prefersReducedMotion()) reveal();
      else timers.push(setTimeout(reveal, 20));
      timers.push(
        setTimeout(() => {
          card.remove();
          resolve();
        }, notification.timing.durationMs),
      );
    });
  }

  void loop();
  return () => {
    stopped = true;
    for (const timer of timers) clearTimeout(timer);
  };
}
