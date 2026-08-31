import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Fallback only for local dev; set a strong JWT_SECRET in the environment.
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-insecure-secret-do-not-use-in-production';

export interface AuthRequest extends Request {
  admin?: { username: string };
}

export function generateToken(username: string): string {
  return jwt.sign({ username }, JWT_SECRET, { expiresIn: '24h' });
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const token = header.slice(7);
    const decoded = jwt.verify(token, JWT_SECRET) as { username: string };
    req.admin = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}
