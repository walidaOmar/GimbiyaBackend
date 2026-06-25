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
import './config/firebase';
//# sourceMappingURL=index.d.ts.map