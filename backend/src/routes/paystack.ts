import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import {
  writeRegistration,
  findRegistrationByReference,
  updateRegistration,
  type Registration,
  type TicketType,
} from '../db.js';

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY || '';
const PAYSTACK_BASE = 'https://api.paystack.co';

const router = Router();

export const TICKETS: Record<
  TicketType,
  { id: TicketType; label: string; price: number; includes: string[]; unitName: string }
> = {
  'early-bird': {
    id: 'early-bird',
    label: 'Early Bird',
    price: 3000,
    unitName: 'person',
    includes: ['Full 3-day class'],
  },
  student: {
    id: 'student',
    label: 'Student',
    price: 5000,
    unitName: 'person',
    includes: ['Full 3-day class'],
  },
  vip: {
    id: 'vip',
    label: 'VIP',
    price: 10000,
    unitName: 'person',
    includes: ['Full 3-day class', 'Branded shirt / cap'],
  },
  group: {
    id: 'group',
    label: 'Group (4 persons)',
    price: 10000,
    unitName: 'group (4 persons)',
    includes: ['Full 3-day class for 4 persons'],
  },
};

interface InitBody {
  fullName: string;
  phone: string;
  email: string;
  instagram?: string;
  experienceLevel?: string;
  emergencyContact?: string;
  ticketType: TicketType;
  quantity?: number;
  reason?: string;
  hearAbout?: string;
}

// Initiate payment: creates a pending registration and returns a Paystack
// authorization_url for the client to redirect the customer to.
router.post('/initialize', async (req: Request, res: Response) => {
  try {
    const body = req.body as InitBody;

    const fullName = (body.fullName || '').trim();
    const phone = (body.phone || '').trim();
    const email = (body.email || '').trim().toLowerCase();
    const ticketType = body.ticketType;
    const quantity = Math.max(1, Math.min(10, Math.round(body.quantity || 1)));

    if (!fullName || !phone || !email) {
      return res.status(400).json({ error: 'Full name, phone and email are required' });
    }
    if (!/^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }
    const ticket = TICKETS[ticketType];
    if (!ticket) {
      return res.status(400).json({ error: 'Invalid ticket type' });
    }

    if (!PAYSTACK_SECRET) {
      return res.status(500).json({
        error: 'Paystack is not configured yet. Please set PAYSTACK_SECRET_KEY in your environment.',
        hint: 'Registration is saved as pending. Contact the studio to complete payment.',
      });
    }

    const amountUnit = ticket.price * quantity; // in kobo-aware naira (naira * 100 only at paystack)

    const registrationId = uuid();
    const reg: Registration = {
      id: registrationId,
      fullName,
      phone,
      email,
      instagram: (body.instagram || '').trim(),
      experienceLevel: (body.experienceLevel || '').trim(),
      emergencyContact: (body.emergencyContact || '').trim(),
      ticketType,
      quantity,
      unitPrice: ticket.price,
      amount: ticket.price * quantity,
      status: 'pending',
      reason: (body.reason || '').trim(),
      hearAbout: (body.hearAbout || '').trim(),
      createdAt: new Date().toISOString(),
    };

    // Save a pending registration record first
    await writeRegistration(reg);

    const paystackRes = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: (amountUnit * 100).toString(),
        currency: 'NGN',
        reference: `SBS-${registrationId}`,
        callback_url: `${process.env.BASE_URL || 'http://localhost:5173'}/register/payment-callback`,
        metadata: {
          registrationId,
          ticketType: ticket.id,
          quantity,
          ticketLabel: ticket.label,
        },
        custom_fields: [
          { display_name: 'Full Name', variable_name: 'full_name', value: fullName },
          { display_name: 'Phone', variable_name: 'phone', value: phone },
          { display_name: 'Ticket', variable_name: 'ticket', value: ticket.label },
        ],
      }),
    });

    const data = await paystackRes.json();

    if (!paystackRes.ok || !data.status) {
      throw new Error(data.message || 'Paystack initialization failed');
    }

    // Record the paystack reference
    await updateRegistration(registrationId, {
      paystackRef: data.data.reference,
    });

    res.status(201).json({
      success: true,
      message: 'Payment initialized',
      registrationId,
      paystack: data.data,
    });
  } catch (err: any) {
    console.error('Paystack initialize failed:', err.message);
    res.status(500).json({ error: 'Failed to initialize payment. Please try again.' });
  }
});

// Verify a payment after the customer returns from Paystack
router.post('/verify', async (req: Request, res: Response) => {
  try {
    const { reference } = req.body as { reference?: string };
    if (!reference) {
      return res.status(400).json({ error: 'Reference is required' });
    }
    if (!PAYSTACK_SECRET) {
      return res.status(500).json({ error: 'Paystack is not configured' });
    }

    const paystackRes = await fetch(
      `${PAYSTACK_BASE}/transaction/verify/${reference}`,
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` } },
    );
    const data = await paystackRes.json();

    if (!paystackRes.ok || !data.status) {
      return res.status(400).json({ error: 'Unable to verify transaction', data });
    }

    const reg = await findRegistrationByReference(reference);

    if (reg) {
      if (data.data.status === 'success') {
        await updateRegistration(reg.id, {
          status: 'paid',
          paystackReference: reference,
        });
      }
      return res.json({
        success: true,
        paid: data.data.status === 'success',
        status: data.data.status,
        registration: reg,
        transaction: data.data,
      });
    }

    res.json({
      success: true,
      paid: data.data.status === 'success',
      status: data.data.status,
      transaction: data.data,
    });
  } catch (err: any) {
    console.error('Paystack verify failed:', err.message);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
});

// Public config endpoint so the frontend knows if Paystack can be used and
// what ticket pricing looks like (no secrets exposed).
router.get('/config', (_req: Request, res: Response) => {
  const publicKey = process.env.PAYSTACK_PUBLIC_KEY || '';
  res.json({
    paystackEnabled: Boolean(PAYSTACK_SECRET && publicKey),
    publicKey,
    baseUrl: process.env.BASE_URL || 'http://localhost:5173',
    tickets: Object.values(TICKETS),
  });
});

export default router;
