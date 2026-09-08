import { Router, Request, Response } from 'express';
import { getSiteSettings } from '../db.js';

const router = Router();

// Public read of site settings — used by the homepage (ticker) and anything
// else that must render without admin auth. Never exposes secrets.
router.get('/', async (_req: Request, res: Response) => {
  try {
    res.json(await getSiteSettings());
  } catch (err: any) {
    console.error('Failed to load settings:', err.message);
    res.status(500).json({ error: 'Failed to load settings' });
  }
});

export default router;