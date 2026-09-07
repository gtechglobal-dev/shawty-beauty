import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { generateToken } from '../middleware/auth.js';
import { getSetting, setSetting, saveResetToken, consumeResetToken } from '../db.js';
import { sendPasswordResetEmail } from '../lib/mailer.js';
import { sendTelegramMessage, telegramConfigured } from '../lib/telegram.js';

const router = Router();

// Default Shawty's Diary credentials. Environment variables can override the
// username and the default password, and a password reset (below) persists a
// new password in the database which then takes precedence.
const DEFAULT_USERNAME = 'Shawty';
const DEFAULT_PASSWORD = 'Shawty2026';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || DEFAULT_USERNAME;
const ENV_PASSWORD_HASH = bcrypt.hashSync(
  process.env.ADMIN_PASSWORD || DEFAULT_PASSWORD,
  10,
);

// Email that password-reset instructions are sent to.
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'nancylawrence545@gmail.com';

router.post('/login', async (req: Request, res: Response) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  // 1) Stored password (set via a previous password reset) always wins.
  let storedHash: string | null = null;
  try {
    storedHash = await getSetting('adminPasswordHash');
  } catch {
    storedHash = null;
  }
  if (storedHash && username === DEFAULT_USERNAME) {
    return handleLogin(res, username, bcrypt.compareSync(password, storedHash));
  }

  // 2) The documented defaults (Shawty / Shawty2026) always work.
  if (username === DEFAULT_USERNAME && password === DEFAULT_PASSWORD) {
    return handleLogin(res, username, true);
  }

  // 3) Environment-configured credentials.
  if (username === ADMIN_USERNAME && bcrypt.compareSync(password, ENV_PASSWORD_HASH)) {
    return handleLogin(res, username, true);
  }

  return res.status(401).json({ error: 'Invalid credentials' });
});

function handleLogin(res: Response, username: string, ok: boolean) {
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  const token = generateToken(username);
  return res.json({ token, username });
}

router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const token = randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    await saveResetToken(token, expiresAt);

    const baseUrl = (req.body?.origin as string) || process.env.BASE_URL || 'http://localhost:5173';
    const resetLink = `${baseUrl}/diary?reset=${token}`;

    let emailed = false;
    try {
      await sendPasswordResetEmail(ADMIN_EMAIL, resetLink);
      emailed = true;
    } catch (err: any) {
      console.error('Password-reset email failed:', err.message);
    }

    if (!emailed && telegramConfigured()) {
      sendTelegramMessage(
        `<b>🔑 Shawty's Diary — Password reset</b>\n` +
          `Reset link (expires in 15 min): <a href="${resetLink}">${resetLink}</a>`,
      ).catch(() => {});
    }

    res.json({
      success: true,
      message: 'A password reset link has been sent to the registered email.',
    });
  } catch (err: any) {
    console.error('Forgot-password failed:', err.message);
    res.status(500).json({ error: 'Could not start the password reset. Please try again.' });
  }
});

router.post('/reset-password', async (req: Request, res: Response) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword || typeof newPassword !== 'string') {
    return res.status(400).json({ error: 'Reset token and new password are required' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }

  const valid = await consumeResetToken(token);
  if (!valid) {
    return res.status(400).json({ error: 'This reset link is invalid or has expired.' });
  }

  await setSetting('adminPasswordHash', bcrypt.hashSync(newPassword, 10));
  res.json({ success: true, message: 'Password updated. Sign in with your new password.' });
});

export default router;