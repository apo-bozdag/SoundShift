import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import authRouter, { requireAuth } from './auth.js';
import timelineRouter from './timeline.js';
import { syncUser } from './sync.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || true,
  credentials: true
}));
app.use(cookieParser());
app.use(express.json());

// Routes
app.use('/auth', authRouter);
app.use('/api', timelineRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

// Sync endpoint (SSE)
app.get('/api/sync/start', requireAuth, async (req, res) => {
  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  let closed = false;
  const abortController = new AbortController();
  req.on('close', () => {
    closed = true;
    abortController.abort();
  });

  const sendEvent = (data) => {
    if (!closed) {
      try { res.write(`data: ${JSON.stringify(data)}\n\n`); } catch {}
    }
  };

  try {
    await syncUser(req.userId, sendEvent, abortController.signal);
  } catch (err) {
    console.error('Sync error:', err);
    sendEvent({ step: 'error', message: err.message });
  }

  if (!closed) res.end();
});

// Production'da client dist'i serve et
if (process.env.NODE_ENV === 'production') {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const clientDist = join(__dirname, '..', 'client', 'dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    res.sendFile(join(clientDist, 'index.html'));
  });
}

const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1';
app.listen(PORT, host, () => {
  console.log(`Server running at http://${host}:${PORT}`);
});
