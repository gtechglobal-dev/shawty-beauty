import { sendEmail } from './mailer.js';

function escapeHtml(s: string): string {
  return String(s || '')
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, "&apos;");
}

export async function deliverSponsorThankYouEmail(opts: {
  name: string;
  email: string;
  reference: string;
  eventTitle?: string;
}): Promise<{ emailed: boolean; reason?: string }> {
  const { name, email, reference, eventTitle } = opts;
  const EMAIL_TIMEOUT_MS = 30_000;

  const sendPromise = (async () => {
    const html = `
      <div style="font-family: Arial, Helvetica, sans-serif; background: #fdf9f4; padding: 32px 16px;">
        <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #f0dbe4;">
          <div style="background: linear-gradient(135deg, #d98aa0, #914e6c); padding: 26px 32px;">
            <h1 style="font-family: Georgia, serif; font-size: 22px; font-weight: 600; margin: 0; color: #ffffff;">Shawty Beauty Studio</h1>
            <p style="color: #fbeef4; font-size: 13px; margin: 4px 0 0;">Sponsorship Confirmation</p>
          </div>
          <div style="padding: 28px 32px 8px;">
            <p style="color: #2a1b22; font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
              Dear <strong>${escapeHtml(name)}</strong>,
            </p>
            <p style="color: #2a1b22; font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
              Thank you so much for choosing to support <strong>Shawty Beauty Studio</strong>! Your
              generosity helps us train and empower aspiring makeup and lash artists, provide training
              materials, and create real opportunities for our students.
            </p>
            <p style="color: #2a1b22; font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
              Your sponsorship application has been received successfully. Please keep your sponsorship
              reference safe &mdash; you may be asked to quote it when we follow up.
            </p>
            <div style="text-align: center; margin: 22px 0;">
              <div style="display: inline-block; background: #f6e3ec; border: 1px dashed #d98aa0; border-radius: 14px; padding: 14px 28px;">
                <div style="color: #914e6c; font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; font-weight: 600;">Sponsorship Reference</div>
                <div style="color: #2a1b22; font-size: 22px; font-weight: 700; font-family: 'Courier New', monospace; margin-top: 2px;">${escapeHtml(reference)}</div>
              </div>
            </div>
            <p style="color: #2a1b22; font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
              Our team will contact you shortly regarding the next steps${
                eventTitle ? ` for ${escapeHtml(eventTitle)}` : ''
              }. We deeply appreciate your support &mdash; it truly makes an impact.
            </p>
            <p style="color: #2a1b22; font-size: 15px; line-height: 1.7; margin: 0 0 4px;">
              With gratitude,<br/>
              <strong>Shawty Beauty Studio</strong>
            </p>
            <p style="margin: 0 0 8px; color: #b39aa5; font-size: 13px; font-style: italic;">
              Beauty &bull; Confidence &bull; Creativity
            </p>
          </div>
          <div style="background: #f6e3ec; padding: 12px 32px;">
            <p style="margin: 0; color: #914e6c; font-size: 12px;">\u00a9 ${new Date().getFullYear()} Shawty Beauty Studio</p>
          </div>
        </div>
      </div>`;

    await sendEmail(email, `Thank you for supporting Shawty Beauty Studio \u2014 ${reference}`, html);
    return { emailed: true } as const;
  })();

  const timeoutPromise = new Promise<{ emailed: false; reason: string }>((_, reject) =>
    setTimeout(() => reject(new Error('SMTP send timed out')), EMAIL_TIMEOUT_MS)
  );

  try {
    return await Promise.race([sendPromise, timeoutPromise]);
  } catch (err: any) {
    return { emailed: false, reason: err?.message || 'Unknown error' };
  }
}