import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import {
  readRegistrations,
  findRegistration,
  updateRegistration,
  deleteRegistration,
  writeRegistration,
  findLiveEvent,
  readSponsors,
  updateSponsor,
  deleteSponsor,
  readContacts,
  markContactRead,
  readSubscribers,
  readEvents,
  findEvent,
  writeEvent,
  updateEvent,
  deleteEvent,
  setAttendanceCode,
  listAttendanceCodes,
  readUnsubscribed,
  DEFAULT_EVENT,
  isValidEventStatus,
  type RegistrationStatus,
  type Registration,
  type TicketType,
  type SponsorStatus,
  type StudioEvent,
  type EventTicket,
} from '../db.js';
import { generateTicketToken, deliverTicketEmail } from '../lib/tickets.js';
import { sendEmail, mailConfigured, type MailAttachment } from '../lib/mailer.js';
import { escapeHtml } from '../lib/telegram.js';
import { uploadAndStepDown } from '../lib/cloudinary.js';

const router = Router();

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function isPresent(r: { present?: boolean; attendance?: Record<string, boolean> }): boolean {
  return Boolean(r.present || (r.attendance && Object.values(r.attendance).some(Boolean)));
}

function attendanceRollup(regs: { attendance?: Record<string, boolean> }[]): Record<string, number> {
  const byDay: Record<string, number> = {};
  for (const r of regs) {
    for (const [k, v] of Object.entries(r.attendance || {})) {
      if (v) byDay[k] = (byDay[k] || 0) + 1;
    }
  }
  return byDay;
}

async function sanitizeBannerImage(value: string): Promise<string | undefined> {
  const input = String(value || '').trim().slice(0, 400000);
  if (!input) return undefined;
  // Already a hosted URL (Cloudinary or otherwise) — keep as is.
  if (!/^data:image\//.test(input)) return input;
  const up = await uploadAndStepDown(input, {
    folder: 'shawty-beauty-studio/banners',
    maxWidth: 1600,
  });
  return up.ok && up.url ? up.url : input;
}

async function sanitizeEvent(body: any): Promise<Partial<StudioEvent>> {
  const clean: Partial<StudioEvent> = {};
  if (typeof body.title === 'string') clean.title = body.title.trim().slice(0, 160);
  if (typeof body.slug === 'string') clean.slug = slugify(body.slug);
  if (body.slug === '') clean.slug = slugify(clean.title || 'event');
  if (typeof body.status === 'string' && isValidEventStatus(body.status)) clean.status = body.status;
  if (typeof body.bannerImage === 'string') clean.bannerImage = await sanitizeBannerImage(body.bannerImage);
  if (typeof body.theme === 'string') clean.theme = body.theme.trim().slice(0, 300);
  if (typeof body.datesLabel === 'string') clean.datesLabel = body.datesLabel.trim().slice(0, 120);
  if (typeof body.durationLabel === 'string') clean.durationLabel = body.durationLabel.trim().slice(0, 80);
  if (typeof body.timeLabel === 'string') clean.timeLabel = body.timeLabel.trim().slice(0, 120);
  if (typeof body.venueNote === 'string') clean.venueNote = body.venueNote.trim().slice(0, 300);
  if (typeof body.plus === 'string') clean.plus = body.plus.trim().slice(0, 1500);
  if (typeof body.bring === 'string') clean.bring = body.bring.trim().slice(0, 1000);

  if (Array.isArray(body.whoFor)) {
    clean.whoFor = body.whoFor.map((w: any) => String(w).trim()).filter(Boolean).slice(0, 30);
  }
  if (Array.isArray(body.learn)) {
    clean.learn = body.learn.map((w: any) => String(w).trim()).filter(Boolean).slice(0, 40);
  }

  if (body.attendanceDays != null) {
    const days = Math.max(1, Math.min(10, Math.round(Number(body.attendanceDays) || 1)));
    const labels: string[] = Array.isArray(body.attendanceLabels)
      ? body.attendanceLabels.map((l: any) => String(l).trim()).filter(Boolean).slice(0, days)
      : Array.from({ length: days }, (_, i) => `Day ${i + 1}`);
    while (labels.length < days) labels.push(`Day ${labels.length + 1}`);
    clean.attendanceDays = days;
    clean.attendanceLabels = labels;
  }

  if (Array.isArray(body.tickets)) {
    clean.tickets = body.tickets
      .filter((t: any) => t && t.id)
      .slice(0, 12)
      .map((t: any) => sanitizeTicket(t));
  }

  return clean;
}

function sanitizeTicket(t: any): EventTicket {
  return {
    id: String(t.id).trim().slice(0, 40) || uuid(),
    label: String(t.label || t.id || 'Ticket').trim().slice(0, 80),
    price: Math.max(0, Math.round(Number(t.price) || 0)),
    originalPrice:
      t.originalPrice != null && Number(t.originalPrice) > 0
        ? Math.max(0, Math.round(Number(t.originalPrice)))
        : undefined,
    promoDeadline:
      t.promoDeadline != null && !isNaN(Number(t.promoDeadline))
        ? Number(t.promoDeadline)
        : undefined,
    unitName: String(t.unitName || 'person').trim().slice(0, 40),
    includes: Array.isArray(t.includes)
      ? t.includes.map((i: any) => String(i).trim()).filter(Boolean).slice(0, 20)
      : [],
    highlighted: t.highlighted === true,
  };
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90) || 'event';
}

// Daily attendance codes: one shared code per event-day. Attendees scan their
// ticket QR (which identifies them) and enter this code to be marked present
// for that day. Only a bcrypt hash is stored; the plaintext is returned once.
const CODE_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateAttendanceCode(length = 6): string {
  const bytes = randomBytes(length);
  let code = '';
  for (let i = 0; i < length; i++) {
    code += CODE_CHARSET[bytes[i] % CODE_CHARSET.length];
  }
  return code;
}

// ------------------------------------------------------------------
// Stats (global overview)
// ------------------------------------------------------------------

router.get('/stats', authMiddleware, async (_req: AuthRequest, res: Response) => {
  try {
    const registrations = await readRegistrations();
    const sponsors = await readSponsors();
    const contacts = await readContacts();
    const subscribers = await readSubscribers();

    const revenue =
      registrations
        .filter((r) => r.status === 'paid')
        .reduce((sum, r) => sum + (r.amount || 0), 0) +
      sponsors
        .filter((s) => s.status === 'confirmed')
        .reduce((sum, s) => sum + (s.amount || 0), 0);

    const excluded = await unsubscribedEmails();
    const totalSubscribers = aggregateEmails([
      ...registrations.map((r) => ({ email: r.email, createdAt: r.createdAt, source: 'registration' })),
      ...sponsors.map((s) => ({ email: s.email, createdAt: s.createdAt, source: 'sponsor' })),
      ...contacts.map((c) => ({ email: c.email, createdAt: c.createdAt, source: 'contact' })),
      ...subscribers.map((s) => ({ email: s.email, createdAt: s.createdAt, source: 'newsletter' })),
    ], excluded).length;

    res.json({
      totalRegistrations: registrations.length,
      paidRegistrations: registrations.filter((r) => r.status === 'paid').length,
      pendingRegistrations: registrations.filter((r) => r.status === 'pending').length,
      approvedRegistrations: registrations.filter((r) => r.status === 'approved').length,
      revenue,
      totalSponsors: sponsors.length,
      confirmedSponsors: sponsors.filter((s) => s.status === 'confirmed').length,
      pendingSponsors: sponsors.filter((s) => s.status === 'pending').length,
      totalMessages: contacts.length,
      unreadMessages: contacts.filter((c) => !c.read).length,
      totalSubscribers,
      recentRegistrations: registrations.slice(0, 8),
      attendanceByDay: attendanceRollup(registrations),
      presentStudents: registrations.filter(isPresent).length,
    });
  } catch (err: any) {
    console.error('Stats fetch failed:', err.message);
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

// ------------------------------------------------------------------
// Events (Shawty's Diary centric model) — each event groups its own
// registrations, attendance, revenue and sponsors.
// ------------------------------------------------------------------

router.get('/events', authMiddleware, async (_req: AuthRequest, res: Response) => {
  try {
    const events = await readEvents();
    const registrations = await readRegistrations();
    const sponsors = await readSponsors();
    const contacts = await readContacts();
    const subscribers = await readSubscribers();

    const grouped = events.map((ev) => {
      const regs = registrations.filter((r) => r.eventId === ev.id);
      const sps = sponsors.filter((s) => s.eventId === ev.id);
      return {
        ...ev,
        attendanceLabels: ev.attendanceLabels || Array.from({ length: ev.attendanceDays }, (_, i) => `Day ${i + 1}`),
        summary: {
          registrations: regs.length,
          paid: regs.filter((r) => r.status === 'paid').length,
          pending: regs.filter((r) => r.status === 'pending').length,
          approved: regs.filter((r) => r.status === 'approved').length,
          cancelled: regs.filter((r) => r.status === 'cancelled').length,
          revenueRegistrations: regs.filter((r) => r.status === 'paid').reduce((s, r) => s + (r.amount || 0), 0),
          present: regs.filter(isPresent).length,
          attendanceByDay: attendanceRollup(regs),
          sponsors: sps.length,
          confirmedSponsors: sps.filter((s) => s.status === 'confirmed').length,
          sponsorsRevenue: sps.filter((s) => s.status === 'confirmed').reduce((s, sp) => s + (sp.amount || 0), 0),
          revenue: regs.filter((r) => r.status === 'paid').reduce((s, r) => s + (r.amount || 0), 0) +
            sps.filter((s) => s.status === 'confirmed').reduce((s, sp) => s + (sp.amount || 0), 0),
          latestRegistrations: regs.slice(0, 5),
        },
      };
    });

    // Records created before an event carried its own id
    const unassignedRegs = registrations.filter((r) => !r.eventId);
    const unassignedSps = sponsors.filter((s) => !s.eventId);

    const excluded = await unsubscribedEmails();
    const allEmails = aggregateEmails([
      ...registrations.map((r) => ({ email: r.email, createdAt: r.createdAt, source: 'registration' })),
      ...sponsors.map((s) => ({ email: s.email, createdAt: s.createdAt, source: 'sponsor' })),
      ...contacts.map((c) => ({ email: c.email, createdAt: c.createdAt, source: 'contact' })),
      ...subscribers.map((s) => ({ email: s.email, createdAt: s.createdAt, source: 'newsletter' })),
    ], excluded);

    res.json({
      events: grouped,
      unassigned: {
        registrations: unassignedRegs.length,
        latestRegistrations: unassignedRegs.slice(0, 5),
        sponsors: unassignedSps.length,
      },
      totals: {
        events: events.length,
        messages: contacts.length,
        unreadMessages: contacts.filter((c) => !c.read).length,
        subscribers: allEmails.length,
      },
    });
  } catch (err: any) {
    console.error('Failed to fetch grouped events:', err.message);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// Create a new event. Pass `fromEventId` to duplicate an existing event as a
// starting point (all its content is copied, then editable).
router.post('/events', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { fromEventId, title } = req.body || {};
    let base: StudioEvent;
    if (fromEventId) {
      const source = await findEvent(fromEventId);
      if (!source) return res.status(404).json({ error: 'Source event not found' });
      base = source;
    } else {
      base = DEFAULT_EVENT;
    }
    const now = new Date().toISOString();
    const id = uuid();
    const newEvent: StudioEvent = {
      ...base,
      id,
      slug: fromEventId
        ? slugify(title || `${base.title} (Copy)`) + '-' + Date.now().toString(36)
        : slugify(title || base.title) + '-' + Date.now().toString(36),
      title: title ? String(title).trim().slice(0, 160) : fromEventId ? `${base.title} (Copy)` : base.title,
      status: 'scheduled',
      createdAt: now,
      updatedAt: now,
    };
    await writeEvent(newEvent);
    res.status(201).json({ success: true, event: newEvent });
  } catch (err: any) {
    console.error('Failed to create event:', err.message);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// Fully update an event's content.
router.put('/events/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const clean = await sanitizeEvent(req.body);
    if (Object.keys(clean).length === 0) {
      return res.status(400).json({ error: 'Nothing to update' });
    }
    clean.updatedAt = new Date().toISOString();
    const updated = await updateEvent(req.params.id, clean);
    if (!updated) return res.status(404).json({ error: 'Event not found' });
    res.json({ success: true, event: updated });
  } catch (err: any) {
    console.error('Failed to update event:', err.message);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

// Promote an event to LIVE (downgrades any previously live event). This is
// what makes the homepage banner, program page and registration forms switch
// to the new event automatically.
router.post('/events/:id/live', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const current = await findEvent(req.params.id);
    if (!current) return res.status(404).json({ error: 'Event not found' });
    const live = (await readEvents()).find((e) => e.status === 'live');
    if (live && live.id !== current.id) {
      await updateEvent(live.id, { status: 'scheduled', updatedAt: new Date().toISOString() });
    }
    const updated = await updateEvent(current.id, { status: 'live', updatedAt: new Date().toISOString() });
    res.json({ success: true, event: updated, message: `${current.title} is now live on the site.` });
  } catch (err: any) {
    console.error('Failed to set live event:', err.message);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

// End an event — marks it as a past event, removes it from the live landing
// page and closes registration on its page. The event (and its registrations,
// attendance and sponsors) stay saved and still show up under "past events".
router.post('/events/:id/end', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const current = await findEvent(req.params.id);
    if (!current) return res.status(404).json({ error: 'Event not found' });
    if (current.status === 'ended') {
      return res.json({ success: true, event: current, message: `${current.title} was already finished.` });
    }
    const updated = await updateEvent(current.id, { status: 'ended', updatedAt: new Date().toISOString() });
    res.json({ success: true, event: updated, message: `${current.title} is now finished. It has been removed from the landing page and registration is closed.` });
  } catch (err: any) {
    console.error('Failed to end event:', err.message);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

router.delete('/events/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const current = await findEvent(req.params.id);
    if (!current) return res.status(404).json({ error: 'Event not found' });
    if (current.status === 'live') {
      return res.status(400).json({ error: 'Promote another event to live before deleting this one.' });
    }
    const deleted = await deleteEvent(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Event not found' });
    res.json({ success: true });
  } catch (err: any) {
    console.error('Failed to delete event:', err.message);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

// Generate (or replace) the shared attendance code for an event-day. The
// plaintext code is returned once; afterwards only its hash is stored.
router.post('/events/:id/attendance-code', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const current = await findEvent(req.params.id);
    if (!current) return res.status(404).json({ error: 'Event not found' });
    const { day } = req.body || {};
    if (typeof day !== 'string' || !/^d[1-9]\d*$/.test(day)) {
      return res.status(400).json({ error: 'day must be a session key like d1, d2 …' });
    }
    const code = generateAttendanceCode(6);
    const codeHash = await bcrypt.hash(code, 6);
    await setAttendanceCode(current.id, day, codeHash);
    res.json({
      success: true,
      day,
      code,
      message: `Code for ${current.attendanceLabels?.[parseInt(day.slice(1), 10) - 1] || day} generated. Share it with your attendees.`,
    });
  } catch (err: any) {
    console.error('Failed to generate attendance code:', err.message);
    res.status(500).json({ error: 'Failed to generate attendance code' });
  }
});

// Which days already have a code set (the codes themselves are not stored).
router.get('/events/:id/attendance-codes', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const current = await findEvent(req.params.id);
    if (!current) return res.status(404).json({ error: 'Event not found' });
    const codes = await listAttendanceCodes(current.id);
    res.json({ codes });
  } catch (err: any) {
    console.error('Failed to load attendance codes:', err.message);
    res.status(500).json({ error: 'Failed to load attendance codes' });
  }
});

// ------------------------------------------------------------------
// Registrations (filterable by eventId)
// ------------------------------------------------------------------

router.get('/registrations', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { status, ticketType, eventId } = req.query;
    let regs = await readRegistrations(
      eventId && typeof eventId === 'string' ? { eventId } : undefined,
    );
    if (status && typeof status === 'string') {
      regs = regs.filter((r) => r.status === status);
    }
    if (ticketType && typeof ticketType === 'string') {
      regs = regs.filter((r) => r.ticketType === ticketType);
    }
    res.json({ registrations: regs, total: regs.length });
  } catch (err: any) {
    console.error('Failed to fetch registrations:', err.message);
    res.status(500).json({ error: 'Failed to fetch registrations' });
  }
});

// Manually add a registrant — used for cash/bank/offline payments already
// received, so the record is created straight away as PAID (no approval step).
// A ticket is generated and emailed to the applicant when mail is configured.
router.post('/registrations', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const b = req.body || {};
    const fullName = String(b.fullName || '').trim();
    const phone = String(b.phone || '').trim();
    const email = String(b.email || '').trim();
    if (!fullName || !phone || !email) {
      return res.status(400).json({ error: 'Full name, phone and email are required.' });
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return res.status(400).json({ error: 'A valid email address is required.' });
    }

    const ticketType = String(b.ticketType || 'student').trim() || 'student';
    const quantity = Math.max(1, Math.min(20, Math.round(Number(b.quantity) || 1)));
    const amount = Math.max(0, Math.round(Number(b.amount) || 0));
    const eventId = b.eventId ? String(b.eventId) : undefined;
    const event = eventId ? await findEvent(eventId) : await findLiveEvent();

    // Profile photo: upload to Cloudinary (auto stepped down to ~100 KB); the
    // raw base64 is only kept when Cloudinary is unavailable.
    const rawPhoto = typeof b.photoBase64 === 'string' && b.photoBase64 ? b.photoBase64 : undefined;
    let photoBase64: string | undefined;
    let photoUrl: string | undefined;
    if (rawPhoto) {
      const up = await uploadAndStepDown(rawPhoto, {
        folder: 'shawty-beauty-studio/registrations',
        maxWidth: 900,
      });
      if (up.ok && up.url) photoUrl = up.url;
      else photoBase64 = rawPhoto;
    }

    let ticketLabel = typeof b.ticketLabel === 'string' && b.ticketLabel.trim() ? b.ticketLabel.trim() : undefined;
    if (!ticketLabel && event?.tickets?.length) {
      const match =
        event.tickets.find((t) => t.id === ticketType) ||
        event.tickets.find((t) => (t.label || '').toLowerCase() === ticketType.toLowerCase());
      if (match) ticketLabel = match.label || undefined;
    }

    const reg: Registration = {
      id: uuid(),
      fullName,
      phone,
      email,
      instagram: String(b.instagram || '').trim(),
      dateOfBirth: String(b.dateOfBirth || '').trim(),
      state: String(b.state || '').trim(),
      nationality: String(b.nationality || '').trim(),
      address: String(b.address || '').trim(),
      experienceLevel: String(b.experienceLevel || '').trim(),
      emergencyContactName: String(b.emergencyContactName || '').trim(),
      emergencyContact: String(b.emergencyContact || '').trim(),
ticketType: ticketType as TicketType,
      ticketLabel,
      quantity,
      amount,
      unitPrice: quantity > 0 ? Math.round(amount / quantity) : amount,
      subtotal: amount,
      processingFee: 0,
      status: 'paid',
      reason: String(b.reason || '').trim(),
      hearAbout: String(b.hearAbout || '').trim(),
      createdAt: new Date().toISOString(),
      eventId: event?.id,
      photoBase64,
      photoUrl,
      attendance: {},
      present: false,
      ticketToken: generateTicketToken(),
    };

    await writeRegistration(reg);

    // Deliver the ticket by email (best-effort — never blocks the response).
    let emailed = false;
    try {
      const result = await deliverTicketEmail({
        registration: reg,
        event,
        baseUrl: b.origin || process.env.BASE_URL,
      });
      if (result.emailed) {
        await updateRegistration(reg.id, { ticketEmailedAt: new Date().toISOString() });
        emailed = true;
      }
    } catch (err: any) {
      console.error('Ticket email failed for manual add:', err.message);
    }

    res.status(201).json({ success: true, emailed, registration: reg });
  } catch (err: any) {
    console.error('Failed to add registration:', err.message);
    res.status(500).json({ error: 'Failed to add registration' });
  }
});

router.patch('/registrations/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    // Attendance is recorded ONLY by the attendee scanning their ticket QR and
    // entering the shared session code — the admin must not mark it manually.
    const { status } = req.body;
    const update: { status?: RegistrationStatus } = {};
    if (req.body.attendance != null) {
      return res.status(400).json({ error: 'Attendance can only be marked from the attendee’s ticket when they check in.' });
    }
    if (req.body.present != null) {
      return res.status(400).json({ error: 'Attendance can only be marked from the attendee’s ticket when they check in.' });
    }
    // Post-payment approval is gone — a confirmed payment IS paid. Only
    // pending/paid/cancelled can be set by the admin from here.
    if (status && ['pending', 'paid', 'cancelled'].includes(status as RegistrationStatus)) {
      update.status = status as RegistrationStatus;
    }
    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: 'Nothing to update' });
    }
    const updated = await updateRegistration(req.params.id, update);
    if (!updated) return res.status(404).json({ error: 'Registration not found' });
    res.json({ success: true, registration: updated });
  } catch (err: any) {
    console.error('Failed to update registration:', err.message);
    res.status(500).json({ error: 'Failed to update registration' });
  }
});

router.delete('/registrations/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const deleted = await deleteRegistration(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Registration not found' });
    res.json({ success: true });
  } catch (err: any) {
    console.error('Failed to delete registration:', err.message);
    res.status(500).json({ error: 'Failed to delete registration' });
  }
});

// Re-send the PNG ticket (with QR) to a paid registrant's email.
router.post('/registrations/:id/resend-ticket', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const reg = await findRegistration(req.params.id);
    if (!reg) return res.status(404).json({ error: 'Registration not found' });
    if (reg.status !== 'paid') {
      return res.status(400).json({ error: 'Only paid registrations receive tickets' });
    }

    let token = reg.ticketToken;
    if (!token) {
      token = generateTicketToken();
      const updated = await updateRegistration(reg.id, { ticketToken: token });
      if (!updated) return res.status(500).json({ error: 'Could not attach ticket token' });
      reg.ticketToken = token;
    }

    const event = reg.eventId ? await findEvent(reg.eventId) : await readEvents().then((evs) => evs.find((e) => e.status === 'live') || null);
    const result = await deliverTicketEmail({
      registration: reg,
      event,
      baseUrl: req.body?.origin || process.env.BASE_URL,
    });

    if (result.emailed) {
      await updateRegistration(reg.id, { ticketEmailedAt: new Date().toISOString() });
    }

    res.json({
      success: result.emailed,
      emailed: result.emailed,
      downloadUrl: result.downloadUrl,
      scanUrl: result.scanUrl,
      message: result.emailed
        ? 'Ticket sent to the registrant\u2019s email.'
        : `Email failed (${result.reason || 'unknown'}). Use the download link instead.`,
    });
  } catch (err: any) {
    console.error('Failed to resend ticket:', err.message);
    res.status(500).json({ error: 'Failed to resend ticket' });
  }
});

// ------------------------------------------------------------------
// Sponsors (filterable by eventId)
// ------------------------------------------------------------------

router.get('/sponsors', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { eventId } = req.query;
    const sponsors = await readSponsors(
      eventId && typeof eventId === 'string' ? { eventId } : undefined,
    );
    res.json({ sponsors, total: sponsors.length });
  } catch (err: any) {
    console.error('Failed to fetch sponsors:', err.message);
    res.status(500).json({ error: 'Failed to fetch sponsors' });
  }
});

router.patch('/sponsors/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { status, featured } = req.body;
    const update: { status?: SponsorStatus; featured?: boolean } = {};
    if (status && ['pending', 'confirmed', 'cancelled'].includes(status as SponsorStatus)) {
      update.status = status as SponsorStatus;
    }
    if (typeof featured === 'boolean') update.featured = featured;
    const updated = await updateSponsor(req.params.id, update);
    if (!updated) return res.status(404).json({ error: 'Sponsor not found' });
    res.json({ success: true, sponsor: updated });
  } catch (err: any) {
    console.error('Failed to update sponsor:', err.message);
    res.status(500).json({ error: 'Failed to update sponsor' });
  }
});

router.delete('/sponsors/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const deleted = await deleteSponsor(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Sponsor not found' });
    res.json({ success: true });
  } catch (err: any) {
    console.error('Failed to delete sponsor:', err.message);
    res.status(500).json({ error: 'Failed to delete sponsor' });
  }
});

// ------------------------------------------------------------------
// Contacts & subscribers
// ------------------------------------------------------------------

interface EmailAgg {
  email: string
  createdAt: string
  sources: string[]
  unsubscribed: boolean
}

// Every email that has ever registered on the platform — newsletters,
// registrations, sponsorships and contact messages — merged and deduplicated.
function aggregateEmails(
  groups: { email: string; createdAt: string; source: string }[],
  excluded: Set<string> = new Set(),
): EmailAgg[] {
  const map = new Map<string, EmailAgg>();
  for (const g of groups) {
    const e = String(g.email || '').trim().toLowerCase();
    if (!/^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(e)) continue;
    const unsubscribed = excluded.has(e);
    const cur = map.get(e);
    if (!cur) {
      map.set(e, { email: e, createdAt: g.createdAt || new Date(0).toISOString(), sources: [g.source], unsubscribed });
      continue;
    }
    if ((g.createdAt || '') < cur.createdAt) cur.createdAt = g.createdAt;
    if (!cur.sources.includes(g.source)) cur.sources.push(g.source);
    if (unsubscribed) cur.unsubscribed = true;
  }
  return [...map.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function unsubscribedEmails(): Promise<Set<string>> {
  const list = await readUnsubscribed();
  return new Set(list.map((u) => u.email.toLowerCase()));
}

router.get('/contacts', authMiddleware, async (_req: AuthRequest, res: Response) => {
  try {
    const contacts = await readContacts();
    res.json({ contacts, total: contacts.length });
  } catch (err: any) {
    console.error('Failed to fetch contacts:', err.message);
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
});

router.patch('/contacts/:id/read', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const updated = await markContactRead(req.params.id);
    if (!updated) return res.status(404).json({ error: 'Contact not found' });
    res.json({ success: true });
  } catch (err: any) {
    console.error('Failed to mark contact read:', err.message);
    res.status(500).json({ error: 'Failed to update contact' });
  }
});

router.get('/subscribers', authMiddleware, async (_req: AuthRequest, res: Response) => {
  try {
    const [subscribers, contacts, registrations, sponsors] = await Promise.all([
      readSubscribers(),
      readContacts(),
      readRegistrations(),
      readSponsors(),
    ]);
    const excluded = await unsubscribedEmails();
    const all = aggregateEmails([
      ...subscribers.map((s) => ({ email: s.email, createdAt: s.createdAt, source: 'newsletter' })),
      ...contacts.map((c) => ({ email: c.email, createdAt: c.createdAt, source: 'contact' })),
      ...registrations.map((r) => ({ email: r.email, createdAt: r.createdAt, source: 'registration' })),
      ...sponsors.map((s) => ({ email: s.email, createdAt: s.createdAt, source: 'sponsor' })),
    ], excluded);
    res.json({ subscribers: all, total: all.length });
  } catch (err: any) {
    console.error('Failed to fetch subscribers:', err.message);
    res.status(500).json({ error: 'Failed to fetch subscribers' });
  }
});

// ------------------------------------------------------------------
// Email broadcasts (admin → every unique email on the platform)
// ------------------------------------------------------------------

const IMG_WIDTH: Record<string, string> = { full: '100%', medium: '74%', small: '50%' };

// Blocks are ordered text paragraphs and inline images. The email opens with
// a designed brand header showing the subject, then the blocks, then the
// unsubscribe footer.
function renderBroadcastHtml(
  subject: string,
  blocks: { type: string; text?: string; cid?: string; width?: string }[],
  unsubUrl: string,
): string {
  const inner = blocks
    .map((b) => {
      if (b.type === 'image') {
        const width = IMG_WIDTH[b.width || 'full'] || '100%';
        const block =
          b.width === 'medium' || b.width === 'small'
            ? 'margin:0 auto 18px;display:block;'
            : 'margin:0 0 18px;display:block;';
        return `<img src="cid:${b.cid}" alt="" style="${block}width:${width};border-radius:12px;border:1px solid #f0dbe4;"/>`;
      }
      return (b.text || '')
        .split(/\n{2,}/)
        .map(
          (p) =>
            `<p style="color:#2a1b22;font-size:14px;line-height:1.7;margin:0 0 16px;">${escapeHtml(p).replace(
              /\n/g,
              '<br/>',
            )}</p>`,
        )
        .join('');
    })
    .join('');

  return [
    `<div style="font-family:Arial,Helvetica,sans-serif;background:#fdf9f4;padding:32px 16px;border-radius:16px;">`,
    `<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #f0dbe4;">`,
    `<div style="background:linear-gradient(135deg,#8f4b68 0%,#b36380 55%,#d9a37a 100%);padding:32px 28px;text-align:center;">`,
    `<div style="font-family:Georgia,serif;font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#f6e3ec;margin:0 0 8px;">Shawty Beauty Studio</div>`,
    `<div style="width:42px;height:3px;background:#f6e3ec;border-radius:999px;margin:0 auto 16px;"></div>`,
    `<h1 style="font-family:Georgia,serif;font-size:22px;font-weight:600;color:#ffffff;margin:0;line-height:1.3;padding:0 8px;">${escapeHtml(subject)}</h1>`,
    `</div>`,
    `<div style="padding:24px 28px 8px;">${inner}</div>`,
    `<div style="background:#f6e3ec;padding:16px 28px;">`,
    `<p style="margin:0;color:#914e6c;font-size:12px;">© ${new Date().getFullYear()} Shawty Beauty Studio</p>`,
    `<p style="margin:8px 0 0;font-size:11px;color:#b39aa5;"><a href="${unsubUrl}" style="color:#914e6c;text-decoration:underline;">Unsubscribe from these emails</a></p>`,
    `</div>`,
    `</div>`,
    `</div>`,
  ].join('');
}

router.post('/broadcast', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!mailConfigured()) {
      return res.status(400).json({ error: 'Email sending is not configured. Set the SMTP environment variables first.' });
    }
    const subject = String(req.body?.subject || '').trim().slice(0, 200);
    if (!subject) {
      return res.status(400).json({ error: 'Subject is required' });
    }

    let rawBlocks = Array.isArray(req.body?.blocks) ? (req.body!.blocks as any[]) : [];
    // Legacy plain-text messages are still accepted as a single text block.
    if (rawBlocks.length === 0 && typeof req.body?.message === 'string' && req.body.message.trim()) {
      rawBlocks = [{ type: 'text', text: req.body.message }];
    }
    if (rawBlocks.length === 0) {
      return res.status(400).json({ error: 'Add some text or an image to send' });
    }
    if (rawBlocks.length > 50) {
      return res.status(400).json({ error: 'Too many sections (max 50)' });
    }

    const attachments: MailAttachment[] = [];
    const blocks: { type: string; text?: string; cid?: string; width?: string }[] = [];
    for (let i = 0; i < rawBlocks.length; i++) {
      const b = rawBlocks[i];
      if (!b || typeof b !== 'object') continue;
      if (b.type === 'image' && typeof b.dataUrl === 'string') {
        const m = /^data:image\/(png|jpe?g|gif|webp);base64,(.+)$/.exec(b.dataUrl);
        if (!m) continue;
        const buf = Buffer.from(m[2], 'base64');
        if (buf.length === 0 || buf.length > 3_000_000) continue;
        const ext = m[1] === 'jpg' ? 'jpeg' : m[1];
        const cid = `img-${i}`;
        attachments.push({ filename: `image-${i}.${ext}`, content: buf, contentType: `image/${ext}`, cid });
        blocks.push({ type: 'image', cid, width: b.width === 'medium' || b.width === 'small' ? b.width : 'full' });
      } else if (b.type === 'text') {
        const text = String(b.text || '').trim();
        if (text) blocks.push({ type: 'text', text: text.slice(0, 20000) });
      }
    }
    if (blocks.length === 0) {
      return res.status(400).json({ error: 'Nothing to send — add text or attach an image' });
    }

    const excluded = await unsubscribedEmails();

    // When an `eventId` is given, the email only goes to that event's
    // applicants (non-cancelled registrations) instead of the whole platform.
    const { eventId } = req.body || {};
    let recipients: EmailAgg[];
    if (eventId && typeof eventId === 'string') {
      const ev = await findEvent(eventId);
      if (!ev) return res.status(404).json({ error: 'Event not found' });
      const evRegs = (await readRegistrations({ eventId })).filter((r) => r.status !== 'cancelled');
      recipients = aggregateEmails(
        evRegs.map((r) => ({ email: r.email, createdAt: r.createdAt, source: 'registration' })),
        excluded,
      ).filter((r) => !r.unsubscribed);
      // An optional `emails` list narrows the event broadcast to just those
      // registrations (used by the "Email to applicants" picker).
      const emailFilter = Array.isArray(req.body?.emails)
        ? req.body.emails.map((e: any) => String(e).trim().toLowerCase()).filter(Boolean)
        : null;
      if (emailFilter && emailFilter.length > 0) {
        recipients = recipients.filter((r) => emailFilter.includes(r.email.toLowerCase()));
      }
    } else {
      const [subscribers, contacts, registrations, sponsors] = await Promise.all([
        readSubscribers(),
        readContacts(),
        readRegistrations(),
        readSponsors(),
      ]);
      recipients = aggregateEmails(
        [
          ...subscribers.map((s) => ({ email: s.email, createdAt: s.createdAt, source: 'newsletter' })),
          ...contacts.map((c) => ({ email: c.email, createdAt: c.createdAt, source: 'contact' })),
          ...registrations.map((r) => ({ email: r.email, createdAt: r.createdAt, source: 'registration' })),
          ...sponsors.map((s) => ({ email: s.email, createdAt: s.createdAt, source: 'sponsor' })),
        ],
        excluded,
      ).filter((r) => !r.unsubscribed);
    }

    if (recipients.length === 0) {
      return res.json({ success: true, sent: 0, failed: 0, total: 0, unsubscribedExcluded: excluded.size });
    }

    const origin = (req.body?.origin as string) || process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;

    const failedEmails = new Set<string>();
    // Send in small batches so SMTP (Gmail) doesn't throttle us.
    for (let i = 0; i < recipients.length; i += 5) {
      const batch = recipients.slice(i, i + 5);
      await Promise.all(
        batch.map(async ({ email }) => {
          try {
            const unsubUrl = `${origin}/api/contact/unsubscribe?email=${encodeURIComponent(email)}`;
            const html = renderBroadcastHtml(subject, blocks, unsubUrl);
            await sendEmail(email, subject, html, attachments);
          } catch (err: any) {
            failedEmails.add(email);
            console.error(`Broadcast failed for ${email}:`, err.message);
          }
        }),
      );
    }

    res.json({
      success: true,
      sent: recipients.length - failedEmails.size,
      failed: failedEmails.size,
      total: recipients.length,
      unsubscribedExcluded: excluded.size,
    });
  } catch (err: any) {
    console.error('Broadcast failed:', err.message);
    res.status(500).json({ error: 'Failed to send broadcasts' });
  }
});

export default router;