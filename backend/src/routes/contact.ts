import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { writeContact, addSubscriber, addUnsubscribed, type ContactMessage } from '../db.js';
import { sendTelegramMessage, telegramConfigured, escapeHtml } from '../lib/telegram.js';
import { isValidPhone, normalizePhone } from '../lib/phone.js';
import { broadcastRealtime } from '../lib/realtime.js';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const sanitizeText = (s: unknown, max: number): string =>
      String(s || '')
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
        .trim()
        .slice(0, max);

    const cleanName = sanitizeText(req.body.name, 100);
    const cleanEmail = sanitizeText(req.body.email, 254).toLowerCase();
    const cleanSubject = sanitizeText(req.body.subject, 200);
    const cleanMessage = sanitizeText(req.body.message, 2000);
    const cleanPhone = normalizePhone(sanitizeText(req.body.phone, 24));

    if (!cleanName || !cleanEmail || !cleanMessage) {
      return res.status(400).json({ error: 'Name, email and message are required' });
    }
    if (!/^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(cleanEmail)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }
    if (cleanPhone && !isValidPhone(cleanPhone)) {
      return res.status(400).json({ error: 'Please enter a valid phone number with its country code' });
    }

    const msg: ContactMessage = {
      id: uuid(),
      name: cleanName,
      email: cleanEmail,
      subject: cleanSubject || 'General enquiry',
      message: cleanMessage,
      phone: cleanPhone || undefined,
      read: false,
      createdAt: new Date().toISOString(),
    };

    await writeContact(msg);
    broadcastRealtime('contacts', { id: msg.id });

    if (telegramConfigured()) {
      const tgMsg = [
        `<b>📩 New Contact Message</b>`,
        ``,
        `<b>Name:</b> ${escapeHtml(msg.name)}`,
        `<b>Email:</b> ${escapeHtml(msg.email)}`,
        msg.phone ? `<b>Phone:</b> ${escapeHtml(msg.phone)}` : '',
        `<b>Subject:</b> ${escapeHtml(msg.subject)}`,
        `<b>Message:</b> ${escapeHtml(msg.message)}`,
      ].filter(Boolean).join('\n');
      sendTelegramMessage(tgMsg).catch(() => {});
    }

    res.status(201).json({ success: true, id: msg.id });
  } catch (err: any) {
    console.error('Failed to send contact message:', err.message);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

router.post('/subscribe', async (req: Request, res: Response) => {
  try {
    const email = String(req.body.email || '')
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
      .trim()
      .toLowerCase()
      .slice(0, 254);
    if (!/^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(email)) {
      return res.status(400).json({ error: 'Please provide a valid email address' });
    }
    const added = await addSubscriber(email);
    broadcastRealtime('subscribers', { email });
    res.status(added ? 201 : 200).json({
      success: true,
      message: added ? 'Subscribed successfully' : 'You are already subscribed',
    });
  } catch (err: any) {
    console.error('Failed to subscribe:', err.message);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// Public one-click opt-out used by the unsubscribe link in broadcast emails.
router.get('/unsubscribe', async (req: Request, res: Response) => {
  const email = String(req.query.email || '').trim().toLowerCase();
  if (!email) {
    return res.status(400).send('<html><body style="font-family:Arial,sans-serif;background:#fdf9f4;padding:40px;color:#2a1b22;"><h2>Missing email address</h2></body></html>');
  }
  try {
    await addUnsubscribed(email);
  } catch (err: any) {
    console.error('Failed to record unsubscribe:', err.message);
  }
  res
    .status(200)
    .type('html')
    .send(`
      <html>
        <head><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
        <body style="margin:0;padding:0;background:#fdf9f4;font-family:Arial,Helvetica,sans-serif;">
          <div style="max-width:480px;margin:0 auto;padding:48px 20px;">
            <div style="background:#ffffff;border-radius:18px;border:1px solid #f0dbe4;padding:36px 32px;text-align:center;">
              <div style="font-family:Georgia,serif;font-size:20px;font-weight:600;color:#2a1b22;margin-bottom:8px;">Shawty Beauty Studio</div>
              <div style="width:48px;height:4px;background:linear-gradient(90deg,#d98aa0,#b36380);border-radius:999px;margin:0 auto 20px;"></div>
              <h1 style="font-size:18px;color:#2a1b22;margin:0 0 10px;">You\u2019ve been unsubscribed</h1>
              <p style="font-size:13px;color:#98808c;line-height:1.6;margin:0 0 14px;">
                <strong style="color:#914e6c;">${escapeHtml(email)}</strong> will no longer receive broadcast emails
                from Shawty Beauty Studio.
              </p>
              <p style="font-size:12px;color:#b39aa5;margin:0;">Changed your mind? Just submit the contact form or register again \u2014 emails will resume.</p>
            </div>
          </div>
        </body>
      </html>
    `);
});

export default router;
