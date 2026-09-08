import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { existsSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  findRegistrationByTicketToken,
  findEvent,
  findLiveEvent,
  updateRegistration,
  listAttendanceCodes,
  readAttendanceCodes,
  DEFAULT_EVENT,
  type AttendanceCode,
  type Registration,
  type TicketType,
} from '../db.js';
import { buildTicketPng, ticketDownloadUrl, ticketScanUrl, baseOrigin } from '../lib/tickets.js';
import { broadcastRealtime } from '../lib/realtime.js';

const router = Router();

const DAY_LABELS_RE = /^d[1-9]\d*$/;

async function resolveContext(reg: { eventId?: string }) {
  const event = reg.eventId ? await findEvent(reg.eventId) : null;
  const live = !event ? await findLiveEvent() : null;
  const resolved = event || live;
  const codes = resolved ? await listAttendanceCodes(resolved.id) : [];
  return { event: resolved, codes };
}

function publicRegistration(reg: any) {
  return {
    id: reg.id,
    fullName: reg.fullName,
    phone: reg.phone,
    ticketLabel: reg.ticketLabel || reg.ticketType,
    quantity: reg.quantity,
    status: reg.status,
    attendance: reg.attendance || {},
    present: Boolean(reg.present),
    eventId: reg.eventId,
  };
}

function publicEvent(ev: any) {
  return {
    id: ev.id,
    title: ev.title,
    datesLabel: ev.datesLabel || '',
    timeLabel: ev.timeLabel || '',
    attendanceDays: ev.attendanceDays,
    attendanceLabels: ev.attendanceLabels || [],
  };
}

// Lookup: what does this ticket token refer to, and which days is it in for?
router.get('/:token/info', async (req: Request, res: Response) => {
  try {
    const token = (req.params.token || '').trim();
    if (!token) return res.status(400).json({ error: 'Missing ticket token' });

    const reg = await findRegistrationByTicketToken(token);
    if (!reg) return res.status(404).json({ error: 'No ticket found for this code' });

    const { event } = await resolveContext(reg);
    const origin = baseOrigin(String(req.query.origin || ''));

    res.json({
      success: true,
      registration: publicRegistration(reg),
      event: event ? publicEvent(event) : null,
      downloadUrl: ticketDownloadUrl(token, origin),
      scanUrl: ticketScanUrl(token, origin),
    });
  } catch (err: any) {
    console.error('Ticket info failed:', err.message);
    res.status(500).json({ error: 'Failed to load ticket' });
  }
});

// Mark attendance. The attendee scans their personal QR (token) and enters the
// shared daily code the studio generated — the code maps to (event, day).
router.post('/:token/attendance', async (req: Request, res: Response) => {
  try {
    const token = (req.params.token || '').trim();
    const code = String(req.body?.code || '').trim().toUpperCase();
    if (!token) return res.status(400).json({ error: 'Missing ticket token' });
    if (!code) return res.status(400).json({ error: 'Enter the attendance code to check in.' });
    if (req.body?.day && !DAY_LABELS_RE.test(String(req.body.day))) {
      return res.status(400).json({ error: 'Invalid day' });
    }

    const reg = await findRegistrationByTicketToken(token);
    if (!reg) return res.status(404).json({ error: 'No ticket found for this code' });
    if (reg.status !== 'paid') {
      return res.status(400).json({
        error:
          reg.status === 'pending'
            ? 'This ticket is still pending payment confirmation.'
            : 'This ticket has been cancelled.',
      });
    }

    let event = reg.eventId ? await findEvent(reg.eventId) : null;
    if (!event) event = await findLiveEvent();
    if (!event) return res.status(500).json({ error: 'No event found for this ticket' });

    // Try to match the entered code to one of the event's daily codes.
    let matched: AttendanceCode | null = null;
    let records = (await readAttendanceCodes(event.id)) || [];
    if (req.body?.day) {
      const wanted = records.find((c) => c.day === String(req.body.day));
      if (wanted && await bcrypt.compare(code, wanted.codeHash)) matched = wanted;
    }
    if (!matched && records.length > 0) {
      for (const rec of records) {
        if (await bcrypt.compare(code, rec.codeHash)) {
          matched = rec;
          break;
        }
      }
    }
    if (!matched) {
      return res.status(400).json({ error: 'That attendance code is not valid for this event.' });
    }

    const day = matched.day;
    const already = reg.attendance?.[day] === true;
    const updated = await updateRegistration(reg.id, {
      attendance: { ...(reg.attendance || {}), [day]: true },
      present: true,
    });
    if (!updated) return res.status(500).json({ error: 'Could not save attendance' });
    broadcastRealtime('attendance', { registrationId: reg.id, day });

    const dayIndex = parseInt(day.slice(1), 10) - 1;
    const dayLabel = event.attendanceLabels?.[dayIndex] || `Day ${dayIndex + 1}`;

    res.json({
      success: true,
      message: already
        ? `${reg.fullName} was already marked present for ${dayLabel}.`
        : `${reg.fullName}'s attendance is marked present for ${dayLabel}.`,
      already,
      day,
      dayLabel,
      registration: publicRegistration(updated),
      event: publicEvent(event),
    });
  } catch (err: any) {
    console.error('Attendance mark failed:', err.message);
    res.status(500).json({ error: 'Failed to record attendance' });
  }
});

// ------------------------------------------------------------------
// Live layout preview (no database) — for tuning how attendee details
// are placed on the template while developing.  Open /api/tickets/preview
// in a browser; it auto-refreshes the rendered ticket every ~1.2s so you
// can literally watch edits land as the server reloads.
// ------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));

function previewRegistration(type: TicketType, q: Record<string, unknown>): Registration {
  const name = String(q.name || 'Nancy Nnaji').slice(0, 60);
  const phone = String(q.phone || '08012345678').slice(0, 20);
  const photoOff = String(q.photo || '1') === '0';
  let photoBase64: string | undefined;
  if (!photoOff) {
    const p = resolve(__dirname, '..', '..', '..', 'frontend', 'public', 'images', 'face.png');
    if (existsSync(p)) photoBase64 = readFileSync(p).toString('base64');
  }
  return {
    id: '0123456789abcdef0123456789abcdef',
    fullName: name,
    phone,
    email: 'sample@shawtybeautystudio.com',
    instagram: '@shawtybeautystudio',
    dateOfBirth: '',
    state: '',
    nationality: '',
    address: '',
    experienceLevel: '',
    emergencyContactName: '',
    emergencyContact: '',
    ticketType: type,
    ticketLabel: type === 'gold' ? 'Gold' : 'Student',
    quantity: Math.max(1, Math.min(10, parseInt(String(q.qty || '1'), 10) || 1)),
    amount: 10000,
    status: 'paid',
    reason: '',
    hearAbout: '',
    createdAt: new Date().toISOString(),
    unitPrice: 10000,
    photoBase64,
    ticketToken: '0123456789abcdef0123456789abcdef',
  };
}

router.get('/preview.png', async (req: Request, res: Response) => {
  try {
    const type: TicketType = String(req.query.type) === 'student' ? 'student' : 'gold';
    const reg = previewRegistration(type, req.query);
    // promo=0 -> simulate the early-bird deadline passed, so student tickets
    // show the 5K badge instead of 3K (handy before the real deadline).
    let event = DEFAULT_EVENT;
    if (String(req.query.promo) === '0') {
      event = { ...DEFAULT_EVENT, tickets: DEFAULT_EVENT.tickets.map((t) => (t.id === 'student' ? { ...t, promoDeadline: Date.now() - 1000 } : t)) };
    }
    const png = await buildTicketPng({
      registration: reg,
      event,
      scanUrl: ticketScanUrl(reg.ticketToken || '', baseOrigin()),
    });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-store');
    res.send(png);
  } catch (err: any) {
    console.error('Preview PNG failed:', err.message);
    if (!res.headersSent) res.status(500).json({ error: 'Could not generate preview', detail: err?.message });
  }
});

router.get('/preview', (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store');
  res.type('html').send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ticket layout preview</title>
<style>
  body { margin:0; background:#191410; color:#e9e2d5; font-family:system-ui,Segoe UI,Arial,sans-serif; }
  header { display:flex; gap:12px; align-items:center; flex-wrap:wrap; padding:14px 18px; }
  header h1 { font-size:15px; margin:0; font-weight:600; letter-spacing:.3px; }
  header span { font-size:12px; opacity:.65; }
  a.sw { display:inline-block; padding:6px 14px; border-radius:999px; text-decoration:none;
    font-size:13px; border:1px solid rgba(255,255,255,.28); color:#e9e2d5; }
  a.sw.on { background:#c8981f; border-color:#c8981f; color:#191410; font-weight:600; }
  main { display:flex; justify-content:center; padding:16px 18px 40px; }
  img { width:min(96vw, 1070px); height:auto; border-radius:10px; box-shadow:0 18px 60px rgba(0,0,0,.5); }
  footer { padding:0 18px 26px; font-size:12px; opacity:.55; line-height:1.6; }
  code { background:rgba(255,255,255,.12); padding:1px 6px; border-radius:6px; }
</style>
</head>
<body>
<header>
  <h1>Ticket layout preview</h1>
  <span id="status">live · refreshes ~every 1.2s</span>
</header>
<main><img id="t" alt="ticket preview"></main>
<footer>
  Edit coordinates in <code>backend/src/lib/tickets.ts</code> and save — the image below updates by itself.
  Docs: shift this page to the side, keep the editor beside it, and watch.
</footer>
<script>
  const q = new URLSearchParams(location.search);
  const current = new URLSearchParams(q);
  const type = q.get('type') || 'gold';
  const switcher = document.querySelector('header');
  switcher.insertAdjacentHTML('beforeend',
    '<a class="sw ' + (type==='gold'?'on':'') + '" href="?' + current + '&type=gold">Gold</a>' +
    '<a class="sw ' + (type==='student'?'on':'') + '" href="?' + current + '&type=student">Student</a>');
  const img = document.getElementById('t');
  const base = new URL('preview.png', location.href);
  for (const k of ['type','name','phone','photo','qty']) if (q.get(k)) base.searchParams.set(k, q.get(k));
  function refresh() { base.searchParams.set('v', Date.now()); img.src = base.toString(); }
  refresh();
  setInterval(refresh, 1200);
  fetch(null);
</script>
</body>
</html>`);
});

// PNG download of the ticket (the file attached to the email is identical).
router.get('/:token.png', async (req: Request, res: Response) => {
  try {
    const token = (req.params.token || '').trim();
    const reg = await findRegistrationByTicketToken(token);
    if (!reg) return res.status(404).json({ error: 'No ticket found for this code' });

    let event = reg.eventId ? await findEvent(reg.eventId) : null;
    if (!event) event = await findLiveEvent();

    const scanUrl = ticketScanUrl(token, baseOrigin());
    const png = await buildTicketPng({ registration: reg, event, scanUrl });

    const filename = `${(reg.fullName || 'ticket').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}-ticket.png`;
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'max-age=3600');
    res.send(png);
  } catch (err: any) {
    console.error('Ticket PNG failed:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Could not generate ticket', detail: err?.message });
    }
  }
});

export default router;