"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const trpcExpress = __importStar(require("@trpc/server/adapters/express"));
const mongodb_1 = require("./config/mongodb");
require("./config/firebase"); // Initialize Firebase Admin on import
const index_1 = require("./routers/index");
const auth_1 = require("./middleware/auth");
const rateLimiter_1 = require("./middleware/rateLimiter");
const sseService_1 = require("./utils/sseService");
const firebase_1 = require("./config/firebase");
const app = (0, express_1.default)();
const PORT = parseInt(process.env.PORT ?? '8080', 10);
// ─── CORS ────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim());
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        }
        else {
            callback(new Error(`CORS: Origin ${origin} not allowed.`));
        }
    },
    credentials: true,
}));
// ─── BODY PARSER ─────────────────────────────────────────────────────────────
app.use(express_1.default.json({ limit: '10mb' })); // 10mb for base64 signature uploads
// ─── RATE LIMITING ───────────────────────────────────────────────────────────
app.use('/api', rateLimiter_1.apiRateLimiter);
// ─── HEALTH CHECK ────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
    res.json({
        status: 'GIMBIYA MALL BACKEND ONLINE',
        timestamp: new Date().toISOString(),
        sse: { activeConnections: (0, sseService_1.getConnectionCount)() },
        env: process.env.NODE_ENV,
    });
});
// ─── SSE ENDPOINT ────────────────────────────────────────────────────────────
/**
 * GET /api/events/subscribe
 * Authenticated users connect here for real-time push events.
 * The userId is extracted from the Bearer token and attached to req.
 */
app.get('/api/events/subscribe', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Authorization header required.' });
        return;
    }
    try {
        const token = authHeader.split(' ')[1];
        const decoded = await firebase_1.firebaseAuth.verifyIdToken(token);
        req.userId = decoded.uid;
        (0, sseService_1.handleSSEConnection)(req, res);
    }
    catch {
        res.status(401).json({ error: 'Invalid or expired token.' });
    }
});
// ─── tRPC ADAPTER ────────────────────────────────────────────────────────────
app.use('/api/trpc', trpcExpress.createExpressMiddleware({
    router: index_1.appRouter,
    createContext: auth_1.createContext,
    onError: ({ error, path }) => {
        if (error.code === 'INTERNAL_SERVER_ERROR') {
            console.error(`[tRPC] Internal error on ${path}:`, error.message);
        }
    },
}));
// ─── 404 FALLBACK ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
    res.status(404).json({ error: 'Route not found.' });
});
// ─── STARTUP ──────────────────────────────────────────────────────────────────
async function bootstrap() {
    try {
        await (0, mongodb_1.connectMongoDB)();
        app.listen(PORT, () => {
            console.log(`\n╔══════════════════════════════════════════════════════╗`);
            console.log(`║     GIMBIYA MALL BACKEND — PORT ${PORT}                 ║`);
            console.log(`║     Environment: ${(process.env.NODE_ENV ?? 'development').padEnd(36)}║`);
            console.log(`║     tRPC:        /api/trpc                           ║`);
            console.log(`║     SSE:         /api/events/subscribe               ║`);
            console.log(`║     Health:      /health                             ║`);
            console.log(`╚══════════════════════════════════════════════════════╝\n`);
        });
    }
    catch (err) {
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
//# sourceMappingURL=index.js.map