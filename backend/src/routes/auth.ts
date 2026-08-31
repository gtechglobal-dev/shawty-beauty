import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { generateToken } from '../middleware/auth.js';

const router = Router();

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
// Fallback only used if ADMIN_PASSWORD is missing from the environment.
// Set ADMIN_PASSWORD in the deployment environment for a real password.
const ADMIN_PASSWORD_HASH = bcrypt.hashSync(
  process.env.ADMIN_PASSWORD || 'replace-with-a-strong-password',
  10,
);

router.post('/login', (req: Request, res: Response) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  if (
    username !== ADMIN_USERNAME ||
    !bcrypt.compareSync(password, ADMIN_PASSWORD_HASH)
  ) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = generateToken(username);
  res.json({ token, username });
});

export default router;
