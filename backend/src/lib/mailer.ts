import nodemailer from 'nodemailer';

// Minimal Nodemailer wrapper for Shawty's Diary notifications.
// Configure via these environment variables (see backend/.env):
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM

export function mailConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS,
  );
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
  });
}

// Display name shown on outbound mail. Overridable, but defaults to the brand
// so recipients never see the personal name attached to the sending account.
const SENDER_NAME = process.env.EMAIL_FROM_NAME || 'Shawty-Beauty-Studio';

function fromAddress(): string {
  const configured = (process.env.EMAIL_FROM || '').trim();
  // EMAIL_FROM may be "Personal Name <address>" — keep only the <address>
  // so the personal name never leaks into the displayed sender.
  const m = configured.match(/<([^>]+)>/);
  const address = (m ? m[1] : configured) || process.env.SMTP_USER || '';
  return address ? `${SENDER_NAME} <${address}>` : SENDER_NAME;
}

export interface MailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
  cid?: string;
}

/**
 * Generic email sender (styled like Shawty's Diary mail). Throws on SMTP
 * errors so callers can decide how to fall back. Attachments are sent
 * as-is; pass `cid` to reference a file from the html <img src="cid:...">.
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  attachments?: MailAttachment[],
): Promise<void> {
  if (!mailConfigured()) {
    throw new Error('SMTP is not configured');
  }
  const transporter = makeTransporter();
  await transporter.sendMail({
    from: fromAddress(),
    to,
    subject,
    html,
    attachments: attachments as any,
  });
}

/**
 * Send the Shawty's Diary password-reset link to the given email.
 * Throws if SMTP is not configured or the send fails — callers should
 * handle the error and optionally fall back to Telegram.
 */
export async function sendPasswordResetEmail(to: string, resetLink: string): Promise<void> {
  if (!mailConfigured()) {
    throw new Error('SMTP is not configured');
  }
  const transporter = makeTransporter();
  await transporter.sendMail({
    from: fromAddress(),
    to,
    subject: '🔑 Shawty\u2019s Diary — Password Reset',
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