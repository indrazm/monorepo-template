// Generates apps/web/src/features/integrations/components/brands.generated.ts
// from Simple Icons (https://simpleicons.org, CC0-1.0) — the canonical open
// dataset of brand glyphs. We vendor the path data instead of shipping a
// runtime dependency. Re-run: `node scripts/gen-brand-icons.mjs`.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// provider key -> candidate simple-icons slugs (first that resolves wins).
const PROVIDERS = {
  zapier: ["zapier"],
  make: ["make"],
  stripe: ["stripe"],
  shopify: ["shopify"],
  woocommerce: ["woocommerce"],
  bigcommerce: ["bigcommerce"],
  wix: ["wix"],
  squarespace: ["squarespace"],
  ecwid: ["ecwid"],
  prestashop: ["prestashop"],
  magento: ["magento", "adobecommerce"],
  paddle: ["paddle"],
  lemonsqueezy: ["lemonsqueezy"],
  gumroad: ["gumroad"],
  sendowl: ["sendowl"],
  recharge: ["recharge"],
  hubspot: ["hubspot"],
  typeform: ["typeform"],
  jotform: ["jotform"],
  formspree: ["formspree"],
  calendly: ["calendly"],
  kajabi: ["kajabi"],
  teachable: ["teachable"],
  thinkific: ["thinkific"],
  memberful: ["memberful"],
  circle: ["circle"],
  convertkit: ["convertkit", "kit"],
  mailchimp: ["mailchimp"],
  activecampaign: ["activecampaign"],
  wordpress: ["wordpress"],
  webflow: ["webflow"],
  salesforce: ["salesforce"],
  pipedrive: ["pipedrive"],
  zoho: ["zoho"],
  airtable: ["airtable"],
  google_sheets: ["googlesheets"],
  intercom: ["intercom"],
  crisp: ["crisp"],
  drift: ["drift"],
  tawk_to: ["tawkto", "tawk"],
  livechat: ["livechat"],
  quickbooks: ["quickbooks"],
  xero: ["xero"],
};

async function get(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (response.ok) return await response.text();
    } catch {
      /* retry */
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return null;
}

const pathOf = (svg) => /<path d="([^"]+)"/.exec(svg ?? "")?.[1] ?? null;

// Fallback lookup: the npm mirror serves monochrome SVGs for icons the color CDN
// omits, plus the metadata JSON carries the brand hex by title.
async function fetchHexBySlug() {
  const json = await get(
    "https://cdn.jsdelivr.net/npm/simple-icons@latest/_data/simple-icons.json",
  );
  const map = new Map();
  try {
    for (const icon of JSON.parse(json ?? "[]")) {
      const slug = icon.title.toLowerCase().replace(/[^a-z0-9]/g, "");
      map.set(slug, `#${icon.hex}`);
    }
  } catch {
    /* ignore */
  }
  return map;
}

async function fetchGlyph(slugs, hexBySlug) {
  for (const slug of slugs) {
    const colored = await get(`https://cdn.simpleicons.org/${slug}`);
    if (colored) {
      const hex = /fill="(#[0-9A-Fa-f]{3,8})"/.exec(colored)?.[1];
      const path = pathOf(colored);
      if (hex && path) return { hex: hex.toUpperCase(), path };
    }
    const mono = await get(`https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/${slug}.svg`);
    const path = pathOf(mono);
    const hex = hexBySlug.get(slug);
    if (path && hex) return { hex, path };
  }
  return null;
}

const hexBySlug = await fetchHexBySlug();
const entries = [];
const missing = [];
for (const [provider, slugs] of Object.entries(PROVIDERS)) {
  const glyph = await fetchGlyph(slugs, hexBySlug);
  if (!glyph) {
    missing.push(provider);
    continue;
  }
  entries.push({ provider, ...glyph });
}

entries.sort((a, b) => a.provider.localeCompare(b.provider));
const body = entries
  .map((entry) => `  ${entry.provider}: { hex: "${entry.hex}", path: "${entry.path}" },`)
  .join("\n");

const output = `// AUTO-GENERATED — do not edit by hand.
// Brand glyphs from Simple Icons (CC0-1.0, https://simpleicons.org).
// Regenerate with: node scripts/gen-brand-icons.mjs
export type BrandGlyph = { hex: string; path: string };

export const BRAND_GLYPHS: Partial<Record<string, BrandGlyph>> = {
${body}
};
`;

const target = fileURLToPath(
  new URL("../apps/web/src/features/integrations/components/brands.generated.ts", import.meta.url),
);
writeFileSync(target, output);
console.log(`Generated ${entries.length} brand glyphs → ${target}`);
if (missing.length > 0) console.log(`No glyph for: ${missing.join(", ")}`);
