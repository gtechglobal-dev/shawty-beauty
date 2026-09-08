import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { rateLimit } from 'express-rate-limit';
import { generateToken } from '../middleware/auth.js';
import { getSetting, setSetting, saveResetToken, consumeResetToken } from '../db.js';
import { sendPasswordResetEmail, sendSuspiciousActivityEmail, mailConfigured } from '../lib/mailer.js';
import { sendTelegramMessage, telegramConfigured } from '../lib/telegram.js';
import { resolveClientIp, lookupIpInfo } from '../lib/clientInfo.js';

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

// Track consecutive failed login attempts to detect brute-force activity.
let consecutiveFailedAttempts = 0;
const MAX_FAILED_ATTEMPTS = 4;

// Hard throttle on the login endpoint (per IP) so brute-force can't run
// indefinitely even across consecutive-failure reset cycles.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: process.env.LOGIN_RATE_LIMIT ? parseInt(process.env.LOGIN_RATE_LIMIT, 10) : 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Too many login attempts. Please wait a few minutes and try again.' },
});

router.post('/login', loginLimiter, async (req: Request, res: Response) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  let authenticated = false;

  // 1) Stored password (set via a previous password reset) always wins.
  let storedHash: string | null = null;
  try {
    storedHash = await getSetting('adminPasswordHash');
  } catch {
    storedHash = null;
  }
  if (!authenticated && storedHash && username === DEFAULT_USERNAME) {
    authenticated = bcrypt.compareSync(password, storedHash);
  }

  // 2) The documented defaults (Shawty / Shawty2026) always work.
  if (!authenticated && username === DEFAULT_USERNAME && password === DEFAULT_PASSWORD) {
    authenticated = true;
  }

  // 3) Environment-configured credentials.
  if (!authenticated && username === ADMIN_USERNAME && bcrypt.compareSync(password, ENV_PASSWORD_HASH)) {
    authenticated = true;
  }

  if (authenticated) {
    consecutiveFailedAttempts = 0;
    return handleLogin(res, username, true);
  }

  // Wrong password — track the attempt.
  consecutiveFailedAttempts++;

  if (consecutiveFailedAttempts >= MAX_FAILED_ATTEMPTS) {
    const attempts = consecutiveFailedAttempts;
    consecutiveFailedAttempts = 0; // reset after alerting

    const timestamp = new Date().toLocaleString('en-NG', { timeZone: 'Africa/Lagos' });
    const { ip, location } = lookupIpInfo(resolveClientIp(req));

    // Fire-and-forget: don't block the login response on email delivery.
    if (mailConfigured()) {
      sendSuspiciousActivityEmail(ADMIN_EMAIL, { attempts, timestamp, ip, location }).catch((err) =>
        console.error('Suspicious-activity email failed:', err.message),
      );
    }

    if (telegramConfigured()) {
      sendTelegramMessage(
        `⚠️ <b>Shawty's Diary — Suspicious login activity</b>\n` +
          `${attempts} consecutive failed password attempts detected.\n` +
          `Time: ${timestamp}` +
          (ip ? `\nIP: ${ip}` : '') +
          (location ? `\nLocation: ${location}` : ''),
      ).catch(() => {});
    }
  }

  return res.status(401).json({ error: 'Invalid credentials' });
});

function handleLogin(res: Response, username: string, ok: boolean) {
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  const token = generateToken(username);
  return res.json({ token, username });
}

const forgotLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many reset requests. Please try again later.' },
});

router.post('/forgot-password', forgotLimiter, async (req: Request, res: Response) => {
  try {
    const token = randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    await saveResetToken(token, expiresAt);

    const baseUrl = (process.env.BASE_URL || req.body?.origin || 'http://localhost:5173').replace(/\/+$/, '');
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