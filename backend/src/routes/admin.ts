import { Router, Request, Response } from 'express';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import {
  readRegistrations,
  updateRegistration,
  deleteRegistration,
  readSponsors,
  updateSponsor,
  deleteSponsor,
  readContacts,
  markContactRead,
  readSubscribers,
  type RegistrationStatus,
  type SponsorStatus,
} from '../db.js';

const router = Router();

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
      totalSubscribers: subscribers.length,
      recentRegistrations: registrations.slice(0, 8),
    });
  } catch (err: any) {
    console.error('Stats fetch failed:', err.message);
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

router.get('/registrations', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { status, ticketType } = req.query;
    let regs = await readRegistrations();
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

router.patch('/registrations/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.body;
    if (!status || !['pending', 'paid', 'approved', 'cancelled'].includes(status as RegistrationStatus)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }
    const updated = await updateRegistration(req.params.id, { status });
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

router.get('/sponsors', authMiddleware, async (_req: AuthRequest, res: Response) => {
  try {
    const sponsors = await readSponsors();
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

export default router;
