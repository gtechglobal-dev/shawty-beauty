import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync } from 'fs';
import { connectDB, isDbConnected, ensureSeedEvents, deleteUnassignedRegistrations } from './db.js';
import authRouter from './routes/auth.js';
import adminRouter from './routes/admin.js';
import contactRouter from './routes/contact.js';
import paystackRouter from './routes/paystack.js';
import sponsorsRouter from './routes/sponsors.js';
import eventsRouter from './routes/events.js';
import ticketsRouter from './routes/tickets.js';
import settingsRouter from './routes/settings.js';
import { startTelegramAdminBot } from './lib/telegramAdminBot.js';
import { initRealtime } from './lib/realtime.js';
import { siteBaseUrl } from './lib/baseUrl.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

app.set('trust proxy', 1);

// Security headers (CSP, X-Frame-Options, X-Content-Type-Options, etc.).
app.use(helmet({
  contentSecurityPolicy: false, // React app + inline-styled emails; kept lenient on purpose
}));

// Global API rate limit guardrail (configurable via RATE_LIMIT_MAX/h).
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: parseInt(process.env.RATE_LIMIT_MAX || '300', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again shortly.' },
});
app.use('/api', apiLimiter);

app.use(cors({ origin: process.env.CORS_ORIGIN || siteBaseUrl() }));
app.use(express.json({
  limit: '50mb',
  verify: (req: any, _res, buf) => { req.rawBody = buf; },
}));

app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'File too large' });
  }
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON in request body' });
  }
  console.error('Unhandled error:', err.message || err);
  if (!res.headersSent) {
    res.status(500).json({ error: 'Internal server error' });
  }
  next(err);
});

app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);
app.use('/api/contact', contactRouter);
app.use('/api/paystack', paystackRouter);
app.use('/api/sponsors', sponsorsRouter);
app.use('/api/events', eventsRouter);
app.use('/api/tickets', ticketsRouter);
app.use('/api/settings', settingsRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', db: isDbConnected(), timestamp: new Date().toISOString() });
});

const __dirname = dirname(fileURLToPath(import.meta.url));
const frontendDist = resolve(__dirname, '..', '..', 'frontend', 'dist');

if (existsSync(frontendDist)) {
  app.use(express.static(frontendDist, { index: false, redirect: false }));
  // Never let the SPA fallback swallow API requests: an unknown/missing API
  // route must return a JSON 404 so the frontend can surface a real error
  // instead of silently "succeeding" against an HTML page.
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
  });
  app.get('*', (req, res) => {
    const indexFile = resolve(frontendDist, 'index.html');
    if (!existsSync(indexFile)) {
      return res.status(404).json({ error: 'Not found' });
    }
    // Fill in the live origin so social-media crawlers (WhatsApp, Telegram,
    // Facebook, X) get absolute og:url / og:image links on whatever domain
    // this is served from (localhost, Render, etc.).
    const origin = `${req.protocol}://${req.get('host')}`;
    const html = readFileSync(indexFile, 'utf8').split('__BASE_URL__').join(origin);
    res.type('html').send(html);
  });
}

connectDB()
  .then(async () => {
    await ensureSeedEvents();
    const purged = await deleteUnassignedRegistrations();
    if (purged > 0) console.log(`Removed ${purged} legacy unassigned registration(s)`);
    const server = app.listen(PORT, () => {
      console.log(`Shawty Beauty Studio API running on http://localhost:${PORT}`);
    });
    initRealtime(server);
    startTelegramAdminBot();
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB:', err.message);
    const server = app.listen(PORT, () => {
      console.log(`Shawty Beauty Studio API running on http://localhost:${PORT} (NO DB)`);
    });
    initRealtime(server);
    startTelegramAdminBot();
  });
