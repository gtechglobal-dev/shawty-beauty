import { Router, Request, Response } from 'express';
import { createHmac } from 'crypto';
import { v4 as uuid } from 'uuid';
import {
  writeRegistration,
  findRegistration,
  findRegistrationByReference,
  updateRegistration,
  type Registration,
  type TicketType,
} from '../db.js';
import { sendTelegramMessage, sendTelegramPhoto, telegramConfigured, escapeHtml } from '../lib/telegram.js';

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY || '';
const PAYSTACK_BASE = 'https://api.paystack.co';
const PROCESSING_FEE_RATE = 0.015; // 1.5% of ticket amount
const PROCESSING_FEE_BASE = 100; // + ₦100 fixed

const router = Router();

// Promo window for the discounted Student ticket. Before this deadline the
// ticket charges `price`; when it elapses, `originalPrice` becomes active.
const PROMO_DEADLINE = new Date('2026-12-31T23:59:59').getTime();

interface TicketMeta {
  id: TicketType;
  label: string;
  price: number;
  originalPrice?: number;
  unitName: string;
  includes: string[];
}

export const TICKETS: Record<TicketType, TicketMeta> = {
  student: {
    id: 'student',
    label: 'Student',
    price: 3000,
    originalPrice: 5000,
    unitName: 'person',
    includes: ['Full 3-day class'],
  },
  gold: {
    id: 'gold',
    label: 'Gold',
    price: 10000,
    unitName: 'person',
    includes: ['Full 3-day class', 'Branded shirt / cap'],
  },
};

export function ticketPrice(ticket: TicketMeta): number {
  if (ticket.originalPrice && Date.now() < PROMO_DEADLINE) return ticket.price;
  return ticket.originalPrice ?? ticket.price;
}

interface InitBody {
  fullName: string;
  phone: string;
  email: string;
  instagram?: string;
  dateOfBirth?: string;
  state?: string;
  nationality?: string;
  address?: string;
  experienceLevel?: string;
  emergencyContact?: string;
  ticketType: TicketType;
  quantity?: number;
  reason?: string;
  hearAbout?: string;
  photoBase64?: string;
  origin?: string;
}

function ageFromDob(dob?: string): string | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
    age -= 1;
  }
  if (age < 0) return null;
  return `${age} years`;
}

// Send one Telegram message per registration, only when payment is confirmed.
// Deduplicated by telegramPaidNotified so it never fires twice (even if both
// the verify endpoint and the webhook land for the same transaction).
async function notifyPaidRegistration(reg: Registration): Promise<void> {
  if (!telegramConfigured()) return;

  // Re-read the current record to make the dedup guard reliable across the
  // verify endpoint and webhook which can both mark the same reg as paid.
  const latest = reg.telegramPaidNotified
    ? reg
    : (await findRegistration(reg.id)) ?? reg;
  if (latest.telegramPaidNotified) return;

  const claimed = await updateRegistration(
    reg.id,
    { telegramPaidNotified: true },
  );
  if (!claimed) return;

  const msg = buildRegistrationMsg({
    fullName: reg.fullName,
    phone: reg.phone,
    email: reg.email,
    instagram: reg.instagram,
    ticketLabel: TICKETS[reg.ticketType]?.label || reg.ticketType,
    quantity: reg.quantity,
    subtotal: reg.subtotal || reg.unitPrice * reg.quantity,
    processingFee: reg.processingFee || 0,
    totalAmount: reg.amount,
    nationality: reg.nationality,
    state: reg.state,
    dob: reg.dateOfBirth,
    experienceLevel: reg.experienceLevel,
    reason: reg.reason,
    hearAbout: reg.hearAbout,
    status: '✅ PAID - Payment confirmed',
  });

  if (reg.photoBase64) {
    sendTelegramPhoto(reg.photoBase64, msg)
      .then((ok) => { if (!ok) sendTelegramMessage(msg).catch(() => {}); })
      .catch(() => sendTelegramMessage(msg).catch(() => {}));
  } else {
    sendTelegramMessage(msg).catch(() => {});
  }
}

function buildRegistrationMsg(opts: {
  fullName: string;
  phone: string;
  email: string;
  instagram?: string;
  ticketLabel: string;
  quantity: number;
  subtotal: number;
  processingFee: number;
  totalAmount: number;
  nationality?: string;
  state?: string;
  dob?: string;
  experienceLevel?: string;
  reason?: string;
  hearAbout?: string;
  status: string;
}): string {
  const age = ageFromDob(opts.dob);
  const feeNote = opts.processingFee > 0
    ? `${(opts.subtotal * 0.015).toFixed(2)} (1.5%) + 100`
    : '0';
  return [
    `<b>🎟️ New Ticket Registration</b>`,
    ``,
    `<b>Name:</b> ${escapeHtml(opts.fullName)}`,
    `<b>Phone:</b> ${escapeHtml(opts.phone)}`,
    `<b>Email:</b> ${escapeHtml(opts.email)}`,
    opts.instagram ? `<b>Instagram:</b> ${escapeHtml(opts.instagram)}` : '',
    `<b>Ticket:</b> ${escapeHtml(opts.ticketLabel)} × ${opts.quantity}`,
    `<b>Ticket amount:</b> ₦${opts.subtotal.toLocaleString()}`,
    `<b>Processing fee:</b> ₦${feeNote}`,
    `<b>Total:</b> ₦${opts.totalAmount.toLocaleString()}`,
    opts.nationality ? `<b>Nationality:</b> ${escapeHtml(opts.nationality)}` : '',
    opts.state ? `<b>State:</b> ${escapeHtml(opts.state)}` : '',
    age ? `<b>Age:</b> ${escapeHtml(age)}` : opts.dob ? `<b>DOB:</b> ${escapeHtml(opts.dob)}` : '',
    opts.experienceLevel ? `<b>Experience:</b> ${escapeHtml(opts.experienceLevel)}` : '',
    opts.reason ? `<b>What you hope to learn:</b> ${escapeHtml(opts.reason)}` : '',
    opts.hearAbout ? `<b>How you heard:</b> ${escapeHtml(opts.hearAbout)}` : '',
    `<b>Status:</b> ${escapeHtml(opts.status)}`,
  ].filter(Boolean).join('\n');
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

    const subtotal = ticketPrice(ticket) * quantity; // naira
    const processingFee = Math.round(subtotal * PROCESSING_FEE_RATE) + PROCESSING_FEE_BASE;
    const totalAmount = subtotal + processingFee; // naira

    const registrationId = uuid();
    const reg: Registration = {
      id: registrationId,
      fullName,
      phone,
      email,
      instagram: (body.instagram || '').trim(),
      dateOfBirth: (body.dateOfBirth || '').trim(),
      state: (body.state || '').trim(),
      nationality: (body.nationality || '').trim(),
      address: (body.address || '').trim(),
      experienceLevel: (body.experienceLevel || '').trim(),
      emergencyContact: (body.emergencyContact || '').trim(),
      ticketType,
      quantity,
      unitPrice: ticketPrice(ticket),
      subtotal,
      processingFee,
      amount: totalAmount,
      status: 'pending',
      reason: (body.reason || '').trim(),
      hearAbout: (body.hearAbout || '').trim(),
      photoBase64: (body.photoBase64 || '').trim(),
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
        amount: (totalAmount * 100).toString(),
        currency: 'NGN',
        reference: `SBS-${registrationId}`,
        callback_url: `${body.origin || process.env.BASE_URL || 'http://localhost:5173'}/register/payment-callback`,
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
      paystack: {
        ...data.data,
        amount: totalAmount * 100,
      },
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
      if (data.data.status === 'success' && reg.status !== 'paid') {
        const paid = await updateRegistration(reg.id, {
          status: 'paid',
          paystackReference: reference,
        });
        // Notify the studio once that this registration is now PAID
        if (paid) {
          notifyPaidRegistration(paid).catch(() => {});
        }
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

// Webhook: Paystack calls this when a transaction status changes.
// Unlike the callback (browser-dependent), this fires server-side and is
// the most reliable way to confirm payment.
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    // --- Verify signature ---
    const signature = req.headers['x-paystack-signature'] as string | undefined;
    if (!PAYSTACK_SECRET || !signature) {
      return res.status(400).json({ error: 'Missing signature' });
    }
    const rawBody = (req as any).rawBody as Buffer | undefined;
    if (!rawBody) {
      return res.status(400).json({ error: 'Missing raw body' });
    }
    const hash = createHmac('sha512', PAYSTACK_SECRET).update(rawBody).digest('hex');
    if (hash !== signature) {
      return res.status(400).json({ error: 'Invalid signature' });
    }

    const event = req.body as { event: string; data: any };

    if (event.event === 'charge.success') {
      const ref = event.data?.reference as string | undefined;
      if (ref) {
        const reg = await findRegistrationByReference(ref);
        if (reg && reg.status !== 'paid') {
          const paid = await updateRegistration(reg.id, {
            status: 'paid',
            paystackReference: ref,
          });
          console.log(`Webhook: registration ${reg.id} marked as paid (ref ${ref})`);
          if (paid) {
            notifyPaidRegistration(paid).catch(() => {});
          }
        }
      }
    }

    // Always return 200 so Paystack doesn't retry
    res.status(200).json({ received: true });
  } catch (err: any) {
    console.error('Paystack webhook error:', err.message);
    res.status(200).json({ received: true });
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
    tickets: Object.values(TICKETS).map((t) => ({ ...t, price: ticketPrice(t) })),
  });
});

export default router;
