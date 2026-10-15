import type { IntegrationProvider } from "@repo/contracts/integrations";

// ---------------------------------------------------------------------------
// A visual identity per platform so the catalog reads at a glance (FR-INT-02).
// We do not ship third-party brand SVGs, so each provider gets a recognisable
// emoji on its brand-tinted tile; unknown providers fall back to a monogram.
// ---------------------------------------------------------------------------

const VISUALS: Partial<Record<IntegrationProvider, { emoji: string; color: string }>> = {
  webhook: { emoji: "🔗", color: "#64748b" },
  zapier: { emoji: "⚡", color: "#ff4f00" },
  make: { emoji: "🧩", color: "#6d00cc" },
  stripe: { emoji: "💳", color: "#635bff" },
  shopify: { emoji: "🛍️", color: "#96bf48" },
  woocommerce: { emoji: "🛒", color: "#96588a" },
  bigcommerce: { emoji: "🏬", color: "#121118" },
  wix: { emoji: "🌐", color: "#0c6efc" },
  squarespace: { emoji: "⬛", color: "#111111" },
  ecwid: { emoji: "🧺", color: "#1a1a1a" },
  prestashop: { emoji: "🧾", color: "#df0067" },
  magento: { emoji: "🧱", color: "#ee672f" },
  paddle: { emoji: "🏓", color: "#fdd023" },
  lemonsqueezy: { emoji: "🍋", color: "#ffc233" },
  gumroad: { emoji: "🩷", color: "#ff90e8" },
  sendowl: { emoji: "🦉", color: "#4b5563" },
  recharge: { emoji: "🔁", color: "#4f46e5" },
  hubspot: { emoji: "🧲", color: "#ff7a59" },
  typeform: { emoji: "📝", color: "#262627" },
  jotform: { emoji: "🗒️", color: "#f68b1f" },
  formspree: { emoji: "📬", color: "#e8622c" },
  calendly: { emoji: "📅", color: "#006bff" },
  kajabi: { emoji: "🎓", color: "#25b48c" },
  teachable: { emoji: "🏫", color: "#1f6feb" },
  thinkific: { emoji: "🎒", color: "#ff6b35" },
  memberful: { emoji: "🔐", color: "#2f2f2f" },
  circle: { emoji: "⭕", color: "#5b53ff" },
  convertkit: { emoji: "✉️", color: "#fb6970" },
  mailchimp: { emoji: "🐵", color: "#ffe01b" },
  activecampaign: { emoji: "📣", color: "#356ae6" },
  wordpress: { emoji: "📰", color: "#21759b" },
  webflow: { emoji: "🌊", color: "#4353ff" },
  salesforce: { emoji: "☁️", color: "#00a1e0" },
  pipedrive: { emoji: "🧭", color: "#1a1a1a" },
  zoho: { emoji: "🟥", color: "#e42527" },
  airtable: { emoji: "📊", color: "#18bfff" },
  google_sheets: { emoji: "📗", color: "#0f9d58" },
  intercom: { emoji: "💬", color: "#1f8ded" },
  crisp: { emoji: "🟠", color: "#1972f5" },
  drift: { emoji: "🌊", color: "#0172cb" },
  tawk_to: { emoji: "🗨️", color: "#03a84e" },
  livechat: { emoji: "🎧", color: "#ff5100" },
  quickbooks: { emoji: "📘", color: "#2ca01c" },
  xero: { emoji: "🟦", color: "#13b5ea" },
};

// Deterministic brand hue for providers without a curated entry.
function colorFromId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) % 360;
  return `hsl(${hash} 62% 48%)`;
}

const SIZES = {
  sm: "size-8 rounded-lg text-base",
  md: "size-10 rounded-xl text-xl",
  lg: "size-12 rounded-2xl text-2xl",
} as const;

export function ProviderIcon({
  provider,
  size = "md",
}: {
  provider: IntegrationProvider;
  size?: keyof typeof SIZES;
}) {
  const visual = VISUALS[provider];
  const color = visual?.color ?? colorFromId(provider);
  return (
    <span
      aria-hidden
      className={`grid flex-none place-items-center ${SIZES[size]}`}
      style={{ backgroundColor: `${color}1a`, boxShadow: `inset 0 0 0 1px ${color}33` }}
    >
      {visual?.emoji ?? provider.charAt(0).toUpperCase()}
    </span>
  );
}
