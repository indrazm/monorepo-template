export type EmailConfig = {
  resendApiKey: string | null;
  fromEmail: string | null;
  fromName: string;
  apiUrl: string;
  nodeEnv: "development" | "test" | "production";
};

export type MailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type Mailer = {
  send: (message: MailMessage) => Promise<void>;
};

export type MailerDependencies = {
  fetchImpl?: typeof fetch;
  sleep?: (milliseconds: number) => Promise<void>;
  log?: (message: string, details?: Record<string, unknown>) => void;
};

const DEFAULT_API_URL = "https://api.resend.com/emails";
const REQUEST_TIMEOUT_MS = 5_000;
const MAX_ATTEMPTS = 3;
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

class MailerHttpError extends Error {
  readonly status: number;

  constructor(status: number, detail: string) {
    super(`Resend rejected the email (${status}): ${detail}`);
    this.name = "MailerHttpError";
    this.status = status;
  }
}

// Sends transactional email through the Resend HTTP API (no SMTP). When the
// credentials are absent in development/test, the message is logged so the
// verification/reset link stays recoverable locally. Production refuses to
// start without credentials, so a misconfiguration cannot silently drop mail.
export function createMailer(config: EmailConfig, deps: MailerDependencies = {}): Mailer {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const sleep = deps.sleep ?? defaultSleep;
  const log = deps.log ?? ((message, details) => console.info(message, details ?? {}));
  const configured = Boolean(config.resendApiKey && config.fromEmail);

  if (config.nodeEnv === "production" && !configured) {
    throw new Error("RESEND_API_KEY and MAIL_FROM_EMAIL must be set in production.");
  }

  const from = config.fromEmail
    ? config.fromName
      ? `${config.fromName} <${config.fromEmail}>`
      : config.fromEmail
    : null;

  return {
    async send(message) {
      if (!configured || !from) {
        log("[mailer:dev] email not sent (set RESEND_API_KEY and MAIL_FROM_EMAIL)", {
          to: message.to,
          subject: message.subject,
          text: message.text,
        });
        return;
      }

      const body = JSON.stringify({
        from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        ...(message.html ? { html: message.html } : {}),
      });

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
          const response = await fetchImpl(config.apiUrl || DEFAULT_API_URL, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${config.resendApiKey}`,
              "Content-Type": "application/json",
            },
            body,
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          });

          if (response.ok) {
            const result = await readJson(response);
            log("[mailer] sent", { to: message.to, id: result?.id });
            return;
          }

          const error = new MailerHttpError(response.status, await readError(response));
          if (!RETRYABLE_STATUS.has(response.status) || attempt === MAX_ATTEMPTS) throw error;
          await sleep(backoffDelay(attempt, response));
        } catch (error) {
          const normalized = error instanceof Error ? error : new Error("Unknown email error");
          if (attempt === MAX_ATTEMPTS || !isRetryable(normalized)) {
            log("[mailer] failed", {
              to: message.to,
              attempts: attempt,
              error: normalized.message,
            });
            throw normalized;
          }
          await sleep(backoffDelay(attempt));
        }
      }

      throw new Error("Failed to send email.");
    },
  };
}

function isRetryable(error: Error): boolean {
  if (error instanceof MailerHttpError) return RETRYABLE_STATUS.has(error.status);
  // Network failures and request timeouts are transient.
  return true;
}

function backoffDelay(attempt: number, response?: Response): number {
  const retryAfter = response?.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds > 0) {
      return Math.min(seconds * 1_000, 5_000);
    }
  }
  return 250 * 2 ** (attempt - 1);
}

async function readError(response: Response): Promise<string> {
  const text = await response.text().catch(() => "");
  if (!text) return response.statusText || "unknown error";
  try {
    const body = JSON.parse(text) as { message?: unknown; name?: unknown };
    if (typeof body.message === "string" && body.message) return body.message;
    if (typeof body.name === "string" && body.name) return body.name;
  } catch {
    // Fall through to the raw body.
  }
  return text.slice(0, 300);
}

async function readJson(response: Response): Promise<{ id?: string } | null> {
  try {
    const body = (await response.json()) as { id?: unknown };
    return typeof body.id === "string" ? { id: body.id } : null;
  } catch {
    return null;
  }
}

function defaultSleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
