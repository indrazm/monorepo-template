import { describe, expect, it, vi } from "vitest";
import { createMailer, type EmailConfig, type MailMessage } from "./mailer";

const config: EmailConfig = {
  resendApiKey: "re_test_key",
  fromEmail: "no-reply@example.com",
  fromName: "Tacto",
  apiUrl: "https://api.resend.com/emails",
  nodeEnv: "test",
};

const message: MailMessage = {
  to: "user@example.com",
  subject: "Activate your Tacto account",
  text: "Confirm your email: https://example.com/verify?token=secret",
  html: "<p>Confirm your email.</p>",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Resend mailer", () => {
  it("sends the message through the Resend API", async () => {
    const requests: { url: string; init: RequestInit }[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      requests.push({ url: String(input), init: init ?? {} });
      return jsonResponse({ id: "email_123" });
    };
    const mailer = createMailer(config, { fetchImpl, log: vi.fn() });

    await mailer.send(message);

    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe("https://api.resend.com/emails");
    expect(requests[0]?.init.method).toBe("POST");
    expect(requests[0]?.init.headers).toMatchObject({
      Authorization: "Bearer re_test_key",
      "Content-Type": "application/json",
    });
    expect(JSON.parse(String(requests[0]?.init.body))).toEqual({
      from: "Tacto <no-reply@example.com>",
      to: ["user@example.com"],
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  });

  it("retries a rate-limited request", async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      return calls === 1
        ? jsonResponse({ message: "Too many requests" }, 429)
        : jsonResponse({ id: "email_123" });
    };
    const sleep = vi.fn(async () => undefined);
    const mailer = createMailer(config, { fetchImpl, sleep, log: vi.fn() });

    await mailer.send(message);

    expect(calls).toBe(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it("retries transient network errors", async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      if (calls === 1) throw new TypeError("fetch failed");
      return jsonResponse({ id: "email_123" });
    };
    const sleep = vi.fn(async () => undefined);
    const mailer = createMailer(config, { fetchImpl, sleep, log: vi.fn() });

    await mailer.send(message);

    expect(calls).toBe(2);
  });

  it("does not retry a rejected request", async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      return jsonResponse({ message: "Invalid from address" }, 422);
    };
    const mailer = createMailer(config, { fetchImpl, log: vi.fn() });

    await expect(mailer.send(message)).rejects.toThrow(
      "Resend rejected the email (422): Invalid from address",
    );
    expect(calls).toBe(1);
  });

  it("gives up after the retry limit", async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      return jsonResponse({ message: "Provider unavailable" }, 503);
    };
    const sleep = vi.fn(async () => undefined);
    const mailer = createMailer(config, { fetchImpl, sleep, log: vi.fn() });

    await expect(mailer.send(message)).rejects.toThrow(
      "Resend rejected the email (503): Provider unavailable",
    );
    expect(calls).toBe(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("logs instead of sending when credentials are missing in development", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const log = vi.fn();
    const mailer = createMailer(
      { ...config, nodeEnv: "development", resendApiKey: null },
      { fetchImpl, log },
    );

    await mailer.send(message);

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(
      "[mailer:dev] email not sent (set RESEND_API_KEY and MAIL_FROM_EMAIL)",
      expect.objectContaining({ to: message.to, subject: message.subject, text: message.text }),
    );
  });

  it("refuses to start without credentials in production", () => {
    expect(() =>
      createMailer({ ...config, nodeEnv: "production", resendApiKey: null }, { log: vi.fn() }),
    ).toThrow("RESEND_API_KEY and MAIL_FROM_EMAIL must be set in production.");
  });
});
