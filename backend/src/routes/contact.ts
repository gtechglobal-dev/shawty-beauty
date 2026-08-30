import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { writeContact, addSubscriber, type ContactMessage } from '../db.js';

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

export default router;
