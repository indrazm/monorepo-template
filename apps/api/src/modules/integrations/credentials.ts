import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// ---------------------------------------------------------------------------
// Integration credentials (provider API keys / access tokens) are written to
// `integration.config.credentials` in Postgres. They are encrypted at rest
// with AES-256-GCM so a database dump does not hand out a customer's Shopify
// or Stripe keys, and they are never returned by the API (NFR-SEC-02).
//
// The key comes from CREDENTIALS_SECRET; BETTER_AUTH_SECRET is the fallback so
// development works without extra setup. Rotating the secret makes existing
// credentials undecryptable — the dashboard then shows the integration as
// needing re-authorization rather than crashing.
// ---------------------------------------------------------------------------

// Must not contain the "." separator used between the parts below.
const PREFIX = "encv1";
const ALGORITHM = "aes-256-gcm";

export type CredentialCipher = {
  encrypt: (value: string) => string;
  decrypt: (value: string) => string | null;
  encryptAll: (values: Record<string, string>) => Record<string, string>;
  decryptAll: (values: Record<string, string> | undefined) => Record<string, string>;
};

export function createCredentialCipher(secret: string): CredentialCipher {
  const key = createHash("sha256").update(secret).digest();

  function encrypt(value: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const data = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [
      PREFIX,
      iv.toString("base64url"),
      tag.toString("base64url"),
      data.toString("base64url"),
    ].join(".");
  }

  function decrypt(value: string): string | null {
    if (!value.startsWith(`${PREFIX}.`)) return value; // written before encryption landed
    const [, ivPart, tagPart, dataPart] = value.split(".");
    if (!ivPart || !tagPart || !dataPart) return null;
    try {
      const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivPart, "base64url"));
      decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
      return Buffer.concat([
        decipher.update(Buffer.from(dataPart, "base64url")),
        decipher.final(),
      ]).toString("utf8");
    } catch {
      // Wrong key or tampered value — treat as unusable, not as a crash.
      return null;
    }
  }

  return {
    encrypt,
    decrypt,
    encryptAll(values) {
      return Object.fromEntries(
        Object.entries(values)
          .filter(([, value]) => typeof value === "string" && value.length > 0)
          .map(([name, value]) => [name, encrypt(value)]),
      );
    },
    decryptAll(values) {
      if (!values) return {};
      const out: Record<string, string> = {};
      for (const [name, value] of Object.entries(values)) {
        const plain = decrypt(value);
        if (plain !== null) out[name] = plain;
      }
      return out;
    },
  };
}
