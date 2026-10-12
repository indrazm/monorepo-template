import { createHmac, timingSafeEqual } from "node:crypto";
import { webhookEventSchema } from "@repo/contracts/integrations";
import type { EventType } from "@repo/contracts/notifications";

export type NormalizedEvent = {
  type: EventType;
  displayName: string | null;
  city: string | null;
  product: string | null;
  dedupeKey: string | null;
  occurredAt: Date;
};

export type Connector = {
  provider: string;
  // HMAC-SHA256 of the raw body, hex-encoded (SRS FR-ING-04).
  verifySignature: (rawBody: string, signature: string | null, secret: string) => boolean;
  mapToEvent: (raw: unknown) => NormalizedEvent | null;
};

function verifyHmac(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

function firstName(value: string | undefined): string | null {
  if (!value) return null;
  return value.trim().split(/\s+/)[0] ?? null;
}

// Generic connector: accepts the documented Tacto webhook payload. Zapier/Make
// send the same shape, so they reuse it (SRS FR-INT-01/04).
const genericConnector = (provider: string): Connector => ({
  provider,
  verifySignature: verifyHmac,
  mapToEvent: (raw) => {
    const parsed = webhookEventSchema.safeParse(raw);
    if (!parsed.success) return null;
    const data = parsed.data;
    return {
      type: data.type,
      displayName: firstName(data.name),
      city: data.city?.trim() ?? null,
      product: data.product?.trim() ?? null,
      dedupeKey: data.dedupeKey ?? null,
      occurredAt: data.occurredAt ? new Date(data.occurredAt) : new Date(),
    };
  },
});

const registry: Record<string, Connector> = {
  webhook: genericConnector("webhook"),
  zapier: genericConnector("zapier"),
};

export function getConnector(provider: string): Connector | null {
  return registry[provider] ?? null;
}
