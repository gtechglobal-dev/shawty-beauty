import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { writeContact, addSubscriber, addUnsubscribed, type ContactMessage } from '../db.js';
import { sendTelegramMessage, telegramConfigured, escapeHtml } from '../lib/telegram.js';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, email, subject, message } = req.body;

    const cleanName = (name || '').trim().slice(0, 100);
    const cleanEmail = (email || '').trim().toLowerCase().slice(0, 254);
    const cleanSubject = (subject || '').trim().slice(0, 200);
    const cleanMessage = (message || '').trim().slice(0, 2000);

    if (!cleanName || !cleanEmail || !cleanMessage) {
      return res.status(400).json({ error: 'Name, email and message are required' });
    }
    if (!/^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(cleanEmail)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    const msg: ContactMessage = {
      id: uuid(),
      name: cleanName,
      email: cleanEmail,
      subject: cleanSubject || 'General enquiry',
      message: cleanMessage,
      read: false,
      createdAt: new Date().toISOString(),
    };

    await writeContact(msg);

    if (telegramConfigured()) {
      const tgMsg = [
        `<b>📩 New Contact Message</b>`,
        ``,
        `<b>Name:</b> ${escapeHtml(msg.name)}`,
        `<b>Email:</b> ${escapeHtml(msg.email)}`,
        `<b>Subject:</b> ${escapeHtml(msg.subject)}`,
        `<b>Message:</b> ${escapeHtml(msg.message)}`,
      ].join('\n');
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
    const email = (req.body.email || '').trim().toLowerCase();
    if (!/^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(email)) {
      return res.status(400).json({ error: 'Please provide a valid email address' });
    }
    const added = await addSubscriber(email);
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
