import { Router, Request, Response } from 'express';
import {
  readEvents,
  findEvent,
  findEventBySlug,
  findLiveEvent,
} from '../db.js';

const router = Router();

// Public: all visible (non-draft) events, live first.
router.get('/', async (_req: Request, res: Response) => {
  try {
    const events = await readEvents();
    const ordered = [...events].sort((a, b) => {
      if (a.status === 'live') return -1;
      if (b.status === 'live') return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    res.json({ events: ordered, total: ordered.length });
  } catch (err: any) {
    console.error('Failed to fetch events:', err.message);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// Public: the single live event driving banners/register defaults.
router.get('/live', async (_req: Request, res: Response) => {
  try {
    const event = await findLiveEvent();
    if (!event) return res.status(404).json({ error: 'No live event right now' });
    res.json({ event });
  } catch (err: any) {
    console.error('Failed to fetch live event:', err.message);
    res.status(500).json({ error: 'Failed to fetch live event' });
  }
});

// Public: single event by id or slug.
router.get('/:idOrSlug', async (req: Request, res: Response) => {
  try {
    const event =
      (await findEvent(req.params.idOrSlug)) ??
      (await findEventBySlug(req.params.idOrSlug));
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json({ event });
  } catch (err: any) {
    console.error('Failed to fetch event:', err.message);
    res.status(500).json({ error: 'Failed to fetch event' });
  }
});

export default router;