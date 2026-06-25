/**
 * server/index.ts
 * Gimbiya Mall Backend — Express + tRPC Server Entry Point.
 *
 * Boot sequence:
 *   1. Load environment variables
 *   2. Connect MongoDB
 *   3. Initialize Firebase Admin (lazy — imported by config/firebase.ts)
 *   4. Mount middleware: CORS, JSON parser, rate limiter
 *   5. Mount tRPC adapter at /api/trpc
 *   6. Mount SSE endpoint at /api/events/subscribe
 *   7. Health check at GET /health
 *   8. Start listening
 */

import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import * as trpcExpress from '@trpc/server/adapters/express';

import { connectMongoDB }   from './config/mongodb';
import './config/firebase';  // Initialize Firebase Admin on import

import { appRouter }        from './routers/index';
import { createContext }    from './middleware/auth';
import { apiRateLimiter }   from './middleware/rateLimiter';
import { handleSSEConnection, getConnectionCount } from './utils/sseService';
import { firebaseAuth }     from './config/firebase';

const app = express();
const PORT = parseInt(process.env.PORT ?? '8080', 10);

// ─── CORS ────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS ?? 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: Origin ${origin} not allowed.`));
      }
    },
    credentials: true,
  })
);

// ─── BODY PARSER ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));  // 10mb for base64 signature uploads

// ─── RATE LIMITING ───────────────────────────────────────────────────────────
app.use('/api', apiRateLimiter);

// ─── HEALTH CHECK ────────────────────────────────────────────────────────────
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status:    'GIMBIYA MALL BACKEND ONLINE',
    timestamp: new Date().toISOString(),
    sse:       { activeConnections: getConnectionCount() },
    env:       process.env.NODE_ENV,
  });
});

// ─── SSE ENDPOINT ────────────────────────────────────────────────────────────
/**
 * GET /api/events/subscribe
 * Authenticated users connect here for real-time push events.
 * The userId is extracted from the Bearer token and attached to req.
 */
app.get('/api/events/subscribe', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authorization header required.' });
    return;
  }

  try {
    const token   = authHeader.split(' ')[1];
    const decoded = await firebaseAuth.verifyIdToken(token);
    (req as any).userId = decoded.uid;
    handleSSEConnection(req, res);
  } catch {
    res.status(401).json({ error: 'Invalid or expired token.' });
  }
});

// ─── tRPC ADAPTER ────────────────────────────────────────────────────────────
app.use(
  '/api/trpc',
  trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext,
    onError: ({ error, path }) => {
      if (error.code === 'INTERNAL_SERVER_ERROR') {
        console.error(`[tRPC] Internal error on ${path}:`, error.message);
      }
    },
  })
);

// ─── 404 FALLBACK ─────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found.' });
});

// ─── STARTUP ──────────────────────────────────────────────────────────────────
async function bootstrap(): Promise<void> {
  try {
    await connectMongoDB();
    app.listen(PORT, () => {
      console.log(`\n╔══════════════════════════════════════════════════════╗`);
      console.log(`║     GIMBIYA MALL BACKEND — PORT ${PORT}                 ║`);
      console.log(`║     Environment: ${(process.env.NODE_ENV ?? 'development').padEnd(36)}║`);
      console.log(`║     tRPC:        /api/trpc                           ║`);
      console.log(`║     SSE:         /api/events/subscribe               ║`);
      console.log(`║     Health:      /health                             ║`);
      console.log(`╚══════════════════════════════════════════════════════╝\n`);
    });
  } catch (err) {
    console.error('[Bootstrap] Fatal startup error:', err);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

bootstrap();
