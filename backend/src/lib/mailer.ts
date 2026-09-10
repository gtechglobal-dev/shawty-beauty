import nodemailer from "nodemailer";

// Email dispatch wrapper for Shawty's Diary notifications.
//
// Two delivery modes are supported:
//   1. Brevo REST API (HTTPS on port 443) — PREFFERED for cloud hosts like
//      Render, where raw SMTP (port 587) is frequently black-holed by the
//      relay provider. Enabled by setting BREVO_API_KEY.
//   2. Classic SMTP relay (nodemailer) — used when BREVO_API_KEY is absent.
//      Configure via SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM.
//
// If BREVO_API_KEY is present it always wins, because HTTPS egress is
// reliable from every host.

export function mailConfigured(): boolean {
  return Boolean(process.env.BREVO_API_KEY) || Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS,
  );
}

export function mailMode(): "brevo-api" | "smtp" | "none" {
  if (process.env.BREVO_API_KEY) return "brevo-api";
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) return "smtp";
  return "none";
}

function makeTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    // Fail fast instead of hanging forever — on cloud providers (Render) the
    // SMTP relay can silently black-hole connections, which previously only
    // surfaced as a generic 30s timeout. These give us a real error code
    // (ETIMEDOUT, EHOSTUNREACH, EAUTH, "IP not permitted", etc.).
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  });
}

// Display name shown on outbound mail. Overridable, but defaults to the brand
// so recipients never see the personal name attached to the sending account.
const FALLBACK_SENDER_NAME = "Shawty Beauty Studio";
const SENDER_NAME = process.env.EMAIL_FROM_NAME || FALLBACK_SENDER_NAME;

// The address half of EMAIL_FROM, e.g. from "Shawty <noreply@x.com>" -> x.com
function fromAddress(): string {
  const configured = (process.env.EMAIL_FROM || "").trim();
  // EMAIL_FROM may be "Personal Name <address>" — keep only the <address>
  // so the personal name never leaks into the displayed sender.
  const m = configured.match(/<([^>]+)>/);
  const address = (m ? m[1] : configured) || process.env.SMTP_USER || "";
  return address ? `${SENDER_NAME} <${address}>` : SENDER_NAME;
}

// Sender split into name + address for the Brevo REST API.
function senderParts(): { name: string; email: string } {
  const configured = (process.env.EMAIL_FROM || "").trim();
  const m = configured.match(/^(.*?)\s*<([^>]+)>$/);
  const name = (m && m[1].trim()) || SENDER_NAME;
  const email = (m ? m[2] : configured) || process.env.SMTP_USER || "";
  return { name: name || SENDER_NAME, email };
}

export interface MailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
  cid?: string;
}

interface SendOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: MailAttachment[];
  // Adds a one-click List-Unsubscribe header (Gmail bulk-sender requirement).
  // Passed for broadcast mail; transactional mail (tickets, password reset)
  // intentionally omits it.
  unsubscribeUrl?: string;
}

// Gmail's bulk-sender rules want a one-click unsubscribe. The header lets
// Gmail surface "Unsubscribe" button and rewards it in the spam filter.
function unsubscribeHeaders(unsubscribeUrl?: string): Record<string, string> | undefined {
  if (!unsubscribeUrl) return undefined;
  return {
    'list-unsubscribe': `<${unsubscribeUrl}>`,
    'list-unsubscribe-post': 'List-Unsubscribe=One-Click',
  };
}

// A lightweight HTML → plaintext conversion so every mail ships a text/plain
// alternative (HTML-only mail is a classic spam-filter trigger).
function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/h1>/gi, '\n\n')
    .replace(/<\/h2>/gi, '\n\n')
    .replace(/<\/h3>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&rsquo;/gi, '\u2019')
    .replace(/&lsquo;/gi, '\u2018')
    .replace(/&ldquo;|&rdquo;/gi, '"')
    .replace(/&hellip;/gi, '\u2026')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const API_TIMEOUT_MS = 30_000;

async function sendViaBrevoApi({ to, subject, html, text, attachments, unsubscribeUrl }: SendOptions): Promise<void> {
  const { name, email } = senderParts();
  const payload: Record<string, unknown> = {
    sender: { name, email },
    to: [{ email: to }],
    subject,
    htmlContent: html,
  };
  if (text) payload.textContent = text;
  const headers = unsubscribeHeaders(unsubscribeUrl);
  if (headers) payload.headers = headers;
  if (attachments && attachments.length > 0) {
    payload.attachment = attachments.map((a) => ({
      name: a.filename,
      content: a.content.toString("base64"),
      ...(a.contentType ? { contentType: a.contentType } : {}),
      ...(a.cid ? { contentId: a.cid } : {}),
    }));
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": process.env.BREVO_API_KEY!,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Brevo API ${res.status}: ${text.slice(0, 300)}`);
    }
  } catch (err: any) {
    if (err?.name === "AbortError") throw new Error("Brevo API request timed out");
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function sendViaSmtp({ to, subject, html, text, attachments, unsubscribeUrl }: SendOptions): Promise<void> {
  if (!mailConfigured()) {
    throw new Error("SMTP is not configured");
  }
  const headers = unsubscribeHeaders(unsubscribeUrl);
  const transporter = makeTransporter();
  await transporter.sendMail({
    from: fromAddress(),
    to,
    subject,
    html,
    text: text || htmlToText(html),
    headers: headers || undefined,
    attachments: attachments as any,
  });
}

async function dispatch(opts: SendOptions): Promise<void> {
  if (process.env.BREVO_API_KEY) {
    await sendViaBrevoApi(opts);
    return;
  }
  await sendViaSmtp(opts);
}

/**
 * Generic email sender (styled like Shawty's Diary mail). Throws on send
 * errors so callers can decide how to fall back. Attachments are sent
 * as-is; pass `cid` to reference a file from the html <img src="cid:...">.
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  attachments?: MailAttachment[],
  unsubscribeUrl?: string,
): Promise<void> {
  await dispatch({ to, subject, html, text: htmlToText(html), attachments, unsubscribeUrl });
}

/**
 * Send the Shawty's Diary password-reset link to the given email.
 * Throws if email is not configured or the send fails — callers should
 * handle the error and optionally fall back to Telegram.
 */
export async function sendPasswordResetEmail(
  to: string,
  resetLink: string,
): Promise<void> {
  await dispatch({
    to,
    subject: "🔑 Shawty\u2019s Diary — Password Reset",
    html: `
      <div style="font-family: Arial, Helvetica, sans-serif; background: #fdf9f4; padding: 32px 16px; border-radius: 16px;">
        <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #f0dbe4;">
          <div style="padding: 28px 32px 8px;">
            <h1 style="font-family: Georgia, serif; font-size: 22px; font-weight: 600; margin: 0 0 6px; color: #2a1b22;">Shawty&rsquo;s Diary</h1>
            <p style="color: #98808c; font-size: 13px; margin: 0 0 20px;">Password reset request</p>
            <p style="color: #2a1b22; font-size: 14px; line-height: 1.6; margin: 0 0 22px;">
              You asked to reset your Shawty&rsquo;s Diary password. Tap the button below to set a new one.
              This link is valid for <strong>15 minutes</strong> and can only be used once.
            </p>
            <a href="${resetLink}" style="display: inline-block; background: linear-gradient(135deg, #d98aa0, #b36380); color: #ffffff; text-decoration: none; font-weight: 600; padding: 12px 26px; border-radius: 999px; font-size: 14px;">
              Reset my password
            </a>
            <p style="color: #98808c; font-size: 13px; line-height: 1.6; margin: 22px 0 0;">
              If you didn&rsquo;t request this, you can safely ignore this email — your password
              will not change until you use the link above.
            </p>
            <p style="color: #b39aa5; font-size: 12px; margin: 18px 0 0;">
              Alternatively, paste this link into your browser:<br/>
              <a href="${resetLink}" style="color: #b36380; word-break: break-all;">${resetLink}</a>
            </p>
          </div>
          <div style="background: #f6e3ec; padding: 12px 32px;">
            <p style="margin: 0; color: #914e6c; font-size: 12px;">© ${new Date().getFullYear()} Shawty Beauty Studio</p>
          </div>
        </div>
      </div>
    `,
  });
}

/**
 * Send a suspicious-activity alert when too many wrong passwords are attempted.
 * Throws if email is not configured or the send fails.
 */
export async function sendSuspiciousActivityEmail(
  to: string,
  details: {
    attempts: number;
    timestamp: string;
    ip?: string;
    location?: string;
  },
): Promise<void> {
  await dispatch({
    to,
    subject: "⚠️ Shawty\u2019s Diary — Suspicious Login Activity",
    html: `
      <div style="font-family: Arial, Helvetica, sans-serif; background: #fdf9f4; padding: 32px 16px; border-radius: 16px;">
        <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #f0dbe4;">
          <div style="padding: 28px 32px 8px;">
            <h1 style="font-family: Georgia, serif; font-size: 22px; font-weight: 600; margin: 0 0 6px; color: #2a1b22;">Shawty&rsquo;s Diary</h1>
            <p style="color: #98808c; font-size: 13px; margin: 0 0 20px;">Security alert</p>
            <p style="color: #2a1b22; font-size: 14px; line-height: 1.6; margin: 0 0 22px;">
              Someone entered an <strong>incorrect password ${details.attempts} times in a row</strong>
              on your Shawty&rsquo;s Diary login. This could indicate a brute-force
              attempt or an unauthorized person trying to access your account.
            </p>
            <div style="background: #fff4f4; border: 1px solid #f5d5d5; border-radius: 10px; padding: 16px 20px; margin: 0 0 22px;">
              <p style="margin: 0 0 6px; font-size: 13px; color: #b33;">
                <strong>Event details</strong>
              </p>
              <p style="margin: 0; font-size: 13px; color: #6b3030; line-height: 1.6;">
                Failed attempts: <strong>${details.attempts}</strong><br/>
                Time: <strong>${details.timestamp}</strong>${details.ip ? `<br/>IP address: <strong>${details.ip}</strong>` : ""}${details.location ? `<br/>Location: <strong>${details.location}</strong>` : ""}
              </p>
            </div>
            <p style="color: #98808c; font-size: 13px; line-height: 1.6; margin: 0 0 22px;">
              If this was you, you can safely ignore this email. If you did not
              attempt these logins, consider changing your password immediately
              via the <strong>Forgot Password</strong> link on the login page.
            </p>
          </div>
          <div style="background: #f6e3ec; padding: 12px 32px;">
            <p style="margin: 0; color: #914e6c; font-size: 12px;">© ${new Date().getFullYear()} Shawty Beauty Studio</p>
          </div>
        </div>
      </div>
    `,
  });
}