import { createTransport, type Transporter } from "nodemailer";

export type SmtpConfig = {
  host: string | null;
  port: string | null;
  user: string | null;
  password: string | null;
  from: string | null;
};

export type Mailer = {
  send: (message: { to: string; subject: string; text: string; html?: string }) => Promise<void>;
};

// Builds a mailer from SMTP config. When SMTP is not configured (e.g. local
// dev), it logs the message instead of sending so flows still work and the
// link is recoverable from the API logs.
export function createMailer(config: SmtpConfig): Mailer {
  const configured = Boolean(config.host && config.port);
  let transporter: Transporter | null = null;
  const from = config.from ?? "Tacto <no-reply@tacto.io>";

  if (configured) {
    transporter = createTransport({
      host: config.host ?? undefined,
      port: Number(config.port),
      secure: Number(config.port) === 465,
      auth: config.user ? { user: config.user, pass: config.password ?? undefined } : undefined,
    });
  }

  return {
    async send(message) {
      if (!transporter) {
        console.info("[mailer:not-configured] email not sent", {
          to: message.to,
          subject: message.subject,
          text: message.text,
        });
        return;
      }
      try {
        await transporter.sendMail({ from, ...message });
      } catch (error) {
        console.error("[mailer] failed to send email", { to: message.to }, error);
      }
    },
  };
}
