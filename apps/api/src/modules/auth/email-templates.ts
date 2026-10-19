// Branded transactional email templates. Email clients have uneven CSS support,
// so the layout uses presentation tables, inline styles, and a single-column
// max-width container. All dynamic values are escaped before interpolation.

const INK = "#17181C";
const MUTED = "#5B606E";
const FAINT = "#8A90A0";
const LINE = "#E7E9F0";
const LINE_SOFT = "#EEF0F5";
const SURFACE = "#FFFFFF";
const PAGE = "#F4F5F7";
const TINT = "#E9F1FE";
const ACCENT = "#3B82F6";
const ACCENT_STRONG = "#2563EB";
const CYAN = "#22D3EE";
const FONT =
  "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

type RenderInput = {
  appUrl: string;
  name?: string | null;
  preheader: string;
  eyebrow: string;
  title: string;
  paragraphs: string[];
  actionLabel: string;
  actionUrl: string;
  note: string;
  footerNote: string;
};

type EmailContent = {
  subject: string;
  text: string;
  html: string;
};

export function verificationEmailContent({
  name,
  url,
  appUrl,
}: {
  name?: string | null;
  url: string;
  appUrl: string;
}): EmailContent {
  return {
    subject: "Activate your Tacto account",
    ...renderActionEmail({
      appUrl,
      name,
      preheader: "Confirm your email address to activate your Tacto account.",
      eyebrow: "Account activation",
      title: "Confirm your email address",
      paragraphs: [
        "You're one click away from your Tacto workspace. Confirm your email address to activate your account and start showing verified social proof on your site.",
        "This keeps your account secure and makes sure you don't miss important updates about your workspace.",
      ],
      actionLabel: "Activate my account",
      actionUrl: url,
      note: "This link expires in 1 hour.",
      footerNote: "If you didn't create a Tacto account, you can safely ignore this email.",
    }),
  };
}

export function passwordResetEmailContent({
  name,
  url,
  appUrl,
}: {
  name?: string | null;
  url: string;
  appUrl: string;
}): EmailContent {
  return {
    subject: "Reset your Tacto password",
    ...renderActionEmail({
      appUrl,
      name,
      preheader: "Choose a new password for your Tacto account.",
      eyebrow: "Password reset",
      title: "Choose a new password",
      paragraphs: [
        "We received a request to reset the password for your Tacto account. Click the button below to choose a new one.",
        "If you didn't request this, no action is needed — your current password stays the same.",
      ],
      actionLabel: "Reset my password",
      actionUrl: url,
      note: "This link expires in 1 hour and can only be used once.",
      footerNote: "For your security, this link was sent only to the address on your account.",
    }),
  };
}

export function changeEmailEmailContent({
  name,
  newEmail,
  url,
  appUrl,
}: {
  name?: string | null;
  newEmail: string;
  url: string;
  appUrl: string;
}): EmailContent {
  return {
    subject: "Confirm your new Tacto email",
    ...renderActionEmail({
      appUrl,
      name,
      preheader: `Confirm ${newEmail} as the new email for your Tacto account.`,
      eyebrow: "Email change",
      title: "Confirm your new email",
      paragraphs: [
        `You asked to change the email on your Tacto account to ${newEmail}. Confirm it below.`,
        "Your current email stays active until this change is confirmed.",
      ],
      actionLabel: "Confirm new email",
      actionUrl: url,
      note: "This link expires in 1 hour.",
      footerNote: "If you didn't request this change, you can safely ignore this email.",
    }),
  };
}

export function invitationEmailContent({
  organizationName,
  inviterName,
  url,
  appUrl,
}: {
  organizationName: string;
  inviterName?: string | null;
  url: string;
  appUrl: string;
}): EmailContent {
  const inviter = inviterName?.trim() || "A teammate";
  return {
    subject: `Join ${organizationName} on Tacto`,
    ...renderActionEmail({
      appUrl,
      preheader: `You've been invited to join ${organizationName} on Tacto.`,
      eyebrow: "Team invitation",
      title: `Join ${organizationName}`,
      paragraphs: [
        `${inviter} invited you to join ${organizationName} on Tacto.`,
        "Accept the invitation to collaborate on sites, notifications, and analytics with your team.",
      ],
      actionLabel: "Accept invitation",
      actionUrl: url,
      note: "This invitation link is unique to you.",
      footerNote: "If you weren't expecting this invitation, you can safely ignore this email.",
    }),
  };
}

function renderActionEmail({
  appUrl,
  name,
  preheader,
  eyebrow,
  title,
  paragraphs,
  actionLabel,
  actionUrl,
  note,
  footerNote,
}: RenderInput): { text: string; html: string } {
  const safeAppUrl = escapeHtml(appUrl.replace(/\/+$/, ""));
  const safeActionUrl = escapeHtml(actionUrl);
  const safeName = name?.trim();
  const greeting = safeName ? `Hi ${escapeHtml(safeName)},` : "Hi there,";
  const safeTitle = escapeHtml(title);
  const safePreheader = escapeHtml(preheader);
  const safeEyebrow = escapeHtml(eyebrow);
  const safeActionLabel = escapeHtml(actionLabel);
  const safeNote = escapeHtml(note);
  const safeFooterNote = escapeHtml(footerNote);
  const logoUrl = escapeHtml(`${safeAppUrl}/icon-192.png`);
  const year = new Date().getFullYear();

  const paragraphHtml = paragraphs
    .map(
      (paragraph) =>
        `<p style="margin:0 0 16px 0;font-family:${FONT};font-size:15px;line-height:1.65;color:${MUTED};">${escapeHtml(paragraph)}</p>`,
    )
    .join("");

  const text = [
    greeting,
    "",
    ...paragraphs.flatMap((paragraph) => [paragraph, ""]),
    `${actionLabel}: ${actionUrl}`,
    "",
    note,
    footerNote,
    "",
    "— Tacto",
    appUrl,
  ].join("\n");

  const html = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="x-apple-disable-message-reformatting" />
<meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no" />
<meta name="color-scheme" content="light" />
<meta name="supported-color-schemes" content="light" />
<title>${safeTitle}</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet" />
<style type="text/css">
  :root { color-scheme: light; supported-color-schemes: light; }
  body { margin:0 !important; padding:0 !important; width:100% !important; }
  table { border-collapse:collapse; }
  img { border:0; outline:none; text-decoration:none; }
  @media only screen and (max-width:600px) {
    .container { width:100% !important; }
    .px { padding-left:22px !important; padding-right:22px !important; }
    .h1 { font-size:24px !important; }
    .button { display:block !important; width:100% !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:${PAGE};">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${safePreheader}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="${PAGE}" style="background-color:${PAGE};">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" class="container" style="width:100%;max-width:600px;background-color:${SURFACE};border:1px solid ${LINE};border-radius:20px;overflow:hidden;">
        <tr>
          <td style="padding:0;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td width="50%" height="4" bgcolor="${ACCENT}" style="height:4px;line-height:4px;font-size:0;">&nbsp;</td>
                <td width="50%" height="4" bgcolor="${CYAN}" style="height:4px;line-height:4px;font-size:0;">&nbsp;</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td class="px" style="padding:28px 32px 0 32px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td style="vertical-align:middle;">
                  <img src="${logoUrl}" width="40" height="40" alt="Tacto" style="display:block;border:0;border-radius:10px;" />
                </td>
                <td style="padding-left:12px;vertical-align:middle;">
                  <div style="font-family:${FONT};font-size:20px;font-weight:800;color:${INK};letter-spacing:-0.03em;line-height:1;">Tacto</div>
                  <div style="font-family:${FONT};font-size:10px;font-weight:700;color:${FAINT};letter-spacing:0.1em;margin-top:4px;">SOCIAL PROOF, VERIFIED</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td class="px" style="padding:28px 32px 8px 32px;">
            <span style="display:inline-block;padding:6px 12px;border-radius:999px;background-color:${TINT};font-family:${FONT};font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${ACCENT_STRONG};">${safeEyebrow}</span>
            <h1 class="h1" style="margin:18px 0 14px 0;font-family:${FONT};font-size:27px;line-height:1.25;font-weight:800;letter-spacing:-0.03em;color:${INK};">${safeTitle}</h1>
            <p style="margin:0 0 18px 0;font-family:${FONT};font-size:15px;line-height:1.65;font-weight:700;color:${INK};">${greeting}</p>
            ${paragraphHtml}
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:26px 0 0 0;">
              <tr>
                <td align="center" bgcolor="${ACCENT}" style="border-radius:12px;">
                  <a class="button" href="${safeActionUrl}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:15px;font-weight:700;line-height:1.2;color:#FFFFFF;text-decoration:none;border-radius:12px;">${safeActionLabel}</a>
                </td>
              </tr>
            </table>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0 0 0;">
              <tr>
                <td style="padding:14px 16px;background-color:#F3F4F8;border-radius:12px;">
                  <p style="margin:0;font-family:${FONT};font-size:12px;line-height:1.6;color:${MUTED};">Button not working? Copy and paste this link into your browser:</p>
                  <p style="margin:6px 0 0 0;font-family:${FONT};font-size:12px;line-height:1.6;color:${ACCENT_STRONG};word-break:break-all;"><a href="${safeActionUrl}" target="_blank" style="color:${ACCENT_STRONG};text-decoration:none;word-break:break-all;">${safeActionUrl}</a></p>
                </td>
              </tr>
            </table>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:18px 0 0 0;">
              <tr>
                <td style="padding:13px 16px;background-color:${TINT};border-left:3px solid ${ACCENT};border-radius:8px;">
                  <p style="margin:0;font-family:${FONT};font-size:13px;line-height:1.5;font-weight:700;color:${ACCENT_STRONG};">${safeNote}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td class="px" style="padding:28px 32px 0 32px;">
            <div style="height:1px;background-color:${LINE_SOFT};line-height:1px;font-size:0;">&nbsp;</div>
          </td>
        </tr>
        <tr>
          <td class="px" style="padding:20px 32px 30px 32px;">
            <p style="margin:0;font-family:${FONT};font-size:12px;line-height:1.65;color:${MUTED};">${safeFooterNote}</p>
            <p style="margin:14px 0 0 0;font-family:${FONT};font-size:12px;line-height:1.65;color:${FAINT};">Tacto · <a href="${safeAppUrl}" target="_blank" style="color:${ACCENT_STRONG};text-decoration:none;">${safeAppUrl}</a></p>
            <p style="margin:5px 0 0 0;font-family:${FONT};font-size:11px;line-height:1.65;color:${FAINT};">© ${year} Tacto. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

  return { text, html };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
