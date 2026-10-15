import type { IntegrationProvider } from "@repo/contracts/integrations";
import { BRAND_GLYPHS } from "./brands.generated";

// Real brand marks come from Simple Icons (CC0), vendored as SVG path data in
// brands.generated.ts. Platforms without an open-source glyph fall back to a
// brand-tinted monogram so the catalog still reads at a glance.

// Fallback tint (and identity) for providers without a Simple Icons glyph.
const FALLBACK_COLORS: Partial<Record<IntegrationProvider, string>> = {
  webhook: "#64748b",
  ecwid: "#1a1a1a",
  magento: "#ee672f",
  sendowl: "#4b5563",
  recharge: "#4f46e5",
  jotform: "#f68b1f",
  kajabi: "#25b48c",
  teachable: "#1f6feb",
  thinkific: "#ff6b35",
  memberful: "#2f2f2f",
  activecampaign: "#356ae6",
  pipedrive: "#1a1a1a",
  crisp: "#1972f5",
  drift: "#0172cb",
  tawk_to: "#03a84e",
};

function colorFromId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) % 360;
  return `hsl(${hash} 62% 48%)`;
}

const BOX = {
  sm: "size-8 rounded-lg",
  md: "size-10 rounded-xl",
  lg: "size-12 rounded-2xl",
} as const;
const GLYPH = { sm: "size-5", md: "size-6", lg: "size-8" } as const;
const LABEL = { sm: "text-sm", md: "text-lg", lg: "text-2xl" } as const;

export function ProviderIcon({
  provider,
  size = "md",
}: {
  provider: IntegrationProvider;
  size?: keyof typeof BOX;
}) {
  const box = `grid flex-none place-items-center ${BOX[size]}`;
  const glyph = BRAND_GLYPHS[provider];

  if (glyph) {
    return (
      <span
        aria-hidden
        className={`${box} bg-white`}
        style={{ boxShadow: "inset 0 0 0 1px rgba(15,23,42,0.08)" }}
      >
        <svg viewBox="0 0 24 24" className={GLYPH[size]} fill={glyph.hex} role="img">
          <path d={glyph.path} />
        </svg>
      </span>
    );
  }

  const color = FALLBACK_COLORS[provider] ?? colorFromId(provider);
  return (
    <span
      aria-hidden
      className={box}
      style={{ backgroundColor: `${color}1a`, boxShadow: `inset 0 0 0 1px ${color}33` }}
    >
      <span className={`font-bold ${LABEL[size]}`} style={{ color }}>
        {provider.charAt(0).toUpperCase()}
      </span>
    </span>
  );
}
