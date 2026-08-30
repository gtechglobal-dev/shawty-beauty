import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { connectDB, isDbConnected } from './db.js';
import authRouter from './routes/auth.js';
import adminRouter from './routes/admin.js';
import contactRouter from './routes/contact.js';
import paystackRouter from './routes/paystack.js';
import sponsorsRouter from './routes/sponsors.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '50mb' }));

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

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', db: isDbConnected(), timestamp: new Date().toISOString() });
});

const __dirname = dirname(fileURLToPath(import.meta.url));
const frontendDist = resolve(__dirname, '..', '..', 'frontend', 'dist');

if (existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (_req, res) => {
    res.sendFile(resolve(frontendDist, 'index.html'));
  });
}

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Shawty Beauty Studio API running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB:', err.message);
    app.listen(PORT, () => {
      console.log(`Shawty Beauty Studio API running on http://localhost:${PORT} (NO DB)`);
    });
  });
