import { Router, Request, Response } from 'express';
import { createHmac } from 'crypto';
import { v4 as uuid } from 'uuid';
import {
  writeRegistration,
  findRegistration,
  findRegistrationByReference,
  updateRegistration,
  findLiveEvent,
  findEvent,
  type Registration,
  type TicketType,
  type EventTicket,
  type StudioEvent,
} from '../db.js';
import { sendTelegramMessage, sendTelegramPhoto, telegramConfigured, escapeHtml } from '../lib/telegram.js';
import { generateTicketToken, deliverTicketEmail } from '../lib/tickets.js';
import { broadcastRealtime } from '../lib/realtime.js';
import { uploadAndStepDown, fetchImageBase64 } from '../lib/cloudinary.js';
import { isValidPhone, normalizePhone } from '../lib/phone.js';
import { siteBaseUrl } from '../lib/baseUrl.js';

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

// Tickets now come from the event (live, or the one the form references).
// This falls back to the legacy TICKETS so older flows keep working.
export async function resolveTickets(eventId?: string): Promise<{
  event: StudioEvent | null;
  tickets: (EventTicket | TicketMeta)[];
}> {
  let event: StudioEvent | null = eventId ? await findEvent(eventId) : null;
  if (!event) event = await findLiveEvent();
  if (event && event.tickets && event.tickets.length > 0) {
    return { event, tickets: event.tickets };
  }
  return { event: null, tickets: Object.values(TICKETS) };
}

export function ticketPrice(ticket: { price: number; originalPrice?: number; promoDeadline?: number }): number {
  if (ticket.originalPrice && ticket.promoDeadline && Date.now() < ticket.promoDeadline) {
    return ticket.price;
  }
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
  emergencyContactName?: string;
  emergencyContact?: string;
  ticketType: TicketType;
  quantity?: number;
  reason?: string;
  hearAbout?: string;
  photoBase64?: string;
  origin?: string;
  eventId?: string;
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
    ticketLabel: TICKETS[reg.ticketType]?.label || reg.ticketLabel || reg.ticketType,
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

if (reg.photoBase64 || reg.photoUrl) {
    let b64: string | undefined = reg.photoBase64;
    if (reg.photoUrl) b64 = (await fetchImageBase64(reg.photoUrl)) || undefined;
    if (b64) {
      sendTelegramPhoto(b64, msg)
        .then((ok) => { if (!ok) sendTelegramMessage(msg).catch(() => {}); })
        .catch(() => {});
    } else {
      sendTelegramMessage(msg).catch(() => {});
    }
  } else {
    sendTelegramMessage(msg).catch(() => {});
  }
}

// ------------------------------------------------------------------
// Ticket delivery — sends the registrant's PNG ticket (with QR) by email
// exactly once per registration. Runs on every paid transition; the
// ticketEmailedAt flag keeps it idempotent.
// ------------------------------------------------------------------
async function deliverTicketFor(reg: Registration): Promise<void> {
  try {
    if (reg.status !== 'paid' || reg.ticketEmailedAt) return;

    let token = reg.ticketToken;
    if (!token) {
      token = generateTicketToken();
      const updated = await updateRegistration(reg.id, { ticketToken: token });
      if (!updated) return;
      reg = { ...reg, ticketToken: token };
    }

    const event = reg.eventId ? await findEvent(reg.eventId) : await findLiveEvent();
    const result = await deliverTicketEmail({ registration: reg, event });

    if (result.emailed) {
      await updateRegistration(reg.id, { ticketEmailedAt: new Date().toISOString() });
      return;
    }

    console.error(`Ticket email failed for ${reg.id}:`, result.reason);
    if (telegramConfigured()) {
      sendTelegramMessage(
        `<b>⚠️ Ticket email failed</b>\n` +
          `Name: ${escapeHtml(reg.fullName)}\n` +
          `Email: ${escapeHtml(reg.email)}\n` +
          `Resend from the Diary, or download directly:\n${result.downloadUrl}\n` +
          `(reason: ${escapeHtml(result.reason || 'unknown')})`,
      ).catch(() => {});
    }
  } catch (err: any) {
    console.error('Ticket delivery failed:', err.message);
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

    const sanitizeText = (s: unknown, max: number): string =>
      String(s || '')
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
        .trim()
        .slice(0, max);

    const fullName = sanitizeText(body.fullName, 120);
    const phone = normalizePhone(sanitizeText(body.phone, 24));
    const email = sanitizeText(body.email, 254).toLowerCase();
    const ticketType = body.ticketType;
    const quantity = Math.max(1, Math.min(10, Math.round(body.quantity || 1)));
    const instagram = sanitizeText(body.instagram, 100);
    const dateOfBirth = sanitizeText(body.dateOfBirth, 20);
    const state = sanitizeText(body.state, 80);
    const nationality = sanitizeText(body.nationality, 50);
    const address = sanitizeText(body.address, 200);
    const experienceLevel = sanitizeText(body.experienceLevel, 40);
    const emergencyContactName = sanitizeText(body.emergencyContactName, 120);
    const emergencyContact = normalizePhone(sanitizeText(body.emergencyContact, 24));
    const reason = sanitizeText(body.reason, 1000);
    const hearAbout = sanitizeText(body.hearAbout, 120);

    if (!fullName || !phone || !email) {
      return res.status(400).json({ error: 'Full name, phone and email are required' });
    }
    if (!/^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }
    if (!isValidPhone(phone)) {
      return res.status(400).json({ error: 'Please enter a valid phone number with its country code' });
    }
    if (emergencyContact && !isValidPhone(emergencyContact)) {
      return res.status(400).json({ error: 'Please enter a valid emergency contact number with its country code' });
    }

    // Tickets are governed by the event the form is registering for (the live
    // event by default). Payment plumbing stays identical.
    const { event, tickets } = await resolveTickets(body.eventId);
    if (event && event.status === 'ended') {
      return res.status(400).json({
        error: 'This event has ended. Registration is closed — watch out for our future events coming soon.',
      });
    }
    const ticket = tickets.find((t) => t.id === ticketType);
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

    // Profile photo: upload to Cloudinary (auto stepped down to ~500 KB); the
    // raw base64 is only kept when Cloudinary is unavailable.
    const rawPhoto = (body.photoBase64 || '').trim();
    let photoBase64: string | undefined;
    let photoUrl: string | undefined;
    if (rawPhoto) {
      const up = await uploadAndStepDown(rawPhoto, {
        folder: 'shawty-beauty-studio/registrations',
        maxWidth: 1280,
        maxBytes: 512 * 1024,
      });
      if (up.ok && up.url) photoUrl = up.url;
      else photoBase64 = rawPhoto;
    }

    const registrationId = uuid();
    const reg: Registration = {
      id: registrationId,
      fullName,
      phone,
      email,
      instagram,
      dateOfBirth,
      state,
      nationality,
      address,
      experienceLevel,
      emergencyContactName,
      emergencyContact: emergencyContact || '',
      ticketType,
      quantity,
      unitPrice: ticketPrice(ticket),
      subtotal,
      processingFee,
      amount: totalAmount,
      status: 'pending',
      eventId: event?.id,
      ticketLabel: ticket.label,
      reason,
      hearAbout,
      photoBase64,
      photoUrl,
      createdAt: new Date().toISOString(),
    };

    // Save a pending registration record first
    await writeRegistration(reg);
    broadcastRealtime('registrations', { id: reg.id, status: reg.status });

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
        callback_url: `${siteBaseUrl(body.origin)}/register/payment-callback`,
        metadata: {
          registrationId,
          eventId: event?.id,
          eventTitle: event?.title,
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

    // Ask Paystack for the current transaction state. A transient error on
    // the very first call after checkout is common (tx still settling), so
    // we never hard-fail here — we fall back to our own database below.
    let status: string | undefined;
    let transaction: any;
    if (PAYSTACK_SECRET) {
      try {
        const paystackRes = await fetch(
          `${PAYSTACK_BASE}/transaction/verify/${reference}`,
          { headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` } },
        );
        const data = await paystackRes.json();
        if (paystackRes.ok && data.status && data.data?.status) {
          status = data.data.status;
          transaction = data.data;
        }
      } catch (err: any) {
        console.error(`Paystack verify fetch failed for ${reference}:`, err.message);
      }
    }

    const reg = await findRegistrationByReference(reference);

    // The webhook may already have confirmed this payment — never contradict it.
    const paid = status === 'success' || reg?.status === 'paid';

    if (paid && reg && reg.status !== 'paid') {
      const confirmed = await updateRegistration(reg.id, {
        status: 'paid',
        paystackReference: reference,
      });
      if (confirmed) {
        notifyPaidRegistration(confirmed).catch(() => {});
        deliverTicketFor(confirmed).catch(() => {});
        broadcastRealtime('registrations', { id: confirmed.id, status: 'paid' });
      }
    }

    res.json({
      success: true,
      paid,
      status: status ?? reg?.status ?? 'unknown',
      registration: reg ?? undefined,
      transaction,
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
            deliverTicketFor(paid).catch(() => {});
            broadcastRealtime('registrations', { id: paid.id, status: 'paid' });
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
router.get('/config', async (_req: Request, res: Response) => {
  const publicKey = process.env.PAYSTACK_PUBLIC_KEY || '';
  const { event, tickets } = await resolveTickets();
  res.json({
    paystackEnabled: Boolean(PAYSTACK_SECRET && publicKey),
    publicKey,
    baseUrl: siteBaseUrl(),
    event: event
      ? {
          id: event.id,
          slug: event.slug,
          title: event.title,
          datesLabel: event.datesLabel,
        }
      : null,
    tickets: tickets.map((t) => ({ ...t, price: ticketPrice(t) })),
  });
});

export default router;
