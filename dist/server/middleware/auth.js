"use strict";
/**
 * server/middleware/auth.ts
 * Firebase JWT verification → MongoDB user lookup → tRPC context injection.
 * Every request passes through this before any procedure executes.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.anyAuthProcedure = exports.supportProcedure = exports.auditorProcedure = exports.buyerProcedure = exports.riderProcedure = exports.stockProcedure = exports.merchantProcedure = exports.coordinatorProcedure = exports.globalCeoProcedure = exports.protectedProcedure = exports.publicProcedure = exports.router = exports.t = void 0;
exports.createContext = createContext;
const server_1 = require("@trpc/server");
const firebase_1 = require("../config/firebase");
const User_1 = require("../models/User");
const types_1 = require("../types");
// ─── CONTEXT FACTORY ─────────────────────────────────────────────────────────
/**
 * createContext
 * Intercepts every incoming tRPC request, extracts the Bearer JWT,
 * verifies it with Firebase Admin SDK, and fetches the full user document
 * from MongoDB. The result is injected into ctx for all procedures.
 *
 * Returns { user: null } for unauthenticated requests — public procedures
 * are explicitly marked; protected ones throw UNAUTHORIZED via middleware.
 */
async function createContext(opts) {
    const authHeader = opts.req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { user: null };
    }
    const token = authHeader.split(' ')[1];
    try {
        // Step 1: Verify Firebase JWT — confirms token is signed, unexpired,
        // and issued by our Firebase project. Throws if invalid.
        const decoded = await firebase_1.firebaseAuth.verifyIdToken(token);
        // Step 2: Fetch full user document from MongoDB using the Firebase UID.
        // The role, assignedState, and permissions live here — not in the JWT.
        const dbUser = await User_1.User.findOne({ firebaseUid: decoded.uid }).lean();
        if (!dbUser || !dbUser.isActive) {
            // User exists in Firebase but not in our system, or is deactivated
            return { user: null };
        }
        const authenticatedUser = {
            uid: decoded.uid,
            mongoId: dbUser._id.toString(),
            email: dbUser.email,
            role: dbUser.role,
            assignedState: dbUser.assignedState,
            permissions: dbUser.permissions,
            kycStatus: dbUser.kycStatus,
            isActive: dbUser.isActive,
        };
        return { user: authenticatedUser };
    }
    catch (err) {
        // Invalid or expired token — treat as unauthenticated
        return { user: null };
    }
}
// ─── tRPC INSTANCE ────────────────────────────────────────────────────────────
exports.t = server_1.initTRPC.context().create();
exports.router = exports.t.router;
exports.publicProcedure = exports.t.procedure;
// ─── BASE AUTH MIDDLEWARE ─────────────────────────────────────────────────────
/**
 * isAuthed
 * Rejects any request where ctx.user is null.
 * This is the base layer all protected procedures build on.
 */
const isAuthed = exports.t.middleware(({ ctx, next }) => {
    if (!ctx.user) {
        throw new server_1.TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Authentication session missing or invalid.',
        });
    }
    return next({ ctx: { user: ctx.user } });
});
// Base procedure that requires any valid logged-in user
exports.protectedProcedure = exports.t.procedure.use(isAuthed);
// ─── ROLE GUARD FACTORY ───────────────────────────────────────────────────────
/**
 * requireRole
 * Creates a tRPC middleware that enforces one or more allowed roles.
 * MANDATE from spec §5: If user_role is missing or insufficient, the request
 * MUST be rejected with TRPC_ERROR(UNAUTHORIZED) before the controller runs.
 */
function requireRole(...allowedRoles) {
    return exports.t.middleware(({ ctx, next }) => {
        if (!ctx.user) {
            throw new server_1.TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required.' });
        }
        if (!allowedRoles.includes(ctx.user.role)) {
            throw new server_1.TRPCError({
                code: 'FORBIDDEN',
                message: `Access denied. Required role(s): [${allowedRoles.join(', ')}]. Your role: ${ctx.user.role}.`,
            });
        }
        return next({ ctx: { user: ctx.user } });
    });
}
/**
 * requireState
 * Enforces that the authenticated user is assigned to a specific state.
 * SUPER_ADMIN (Global) always bypasses this check.
 */
function requireState(targetState) {
    return exports.t.middleware(({ ctx, next }) => {
        if (!ctx.user) {
            throw new server_1.TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required.' });
        }
        const isGlobal = ctx.user.assignedState === types_1.NigerianState.GLOBAL;
        const matchesState = ctx.user.assignedState === targetState;
        if (!isGlobal && !matchesState) {
            throw new server_1.TRPCError({
                code: 'FORBIDDEN',
                message: `You are not authorized to access the ${targetState} node.`,
            });
        }
        return next({ ctx: { user: ctx.user } });
    });
}
// ─── ROLE-SPECIFIC PROCEDURES ─────────────────────────────────────────────────
/** Tier 1 — Global CEO only. Full national access. */
exports.globalCeoProcedure = exports.t.procedure
    .use(isAuthed)
    .use(requireRole(types_1.UserRole.SUPER_ADMIN));
/** Tier 2 — State Coordinator or CEO */
exports.coordinatorProcedure = exports.t.procedure
    .use(isAuthed)
    .use(requireRole(types_1.UserRole.SUPER_ADMIN, types_1.UserRole.COORDINATOR));
/** Merchant / Business Owner */
exports.merchantProcedure = exports.t.procedure
    .use(isAuthed)
    .use(requireRole(types_1.UserRole.SUPER_ADMIN, types_1.UserRole.COORDINATOR, types_1.UserRole.MERCHANT));
/** Stock Manager */
exports.stockProcedure = exports.t.procedure
    .use(isAuthed)
    .use(requireRole(types_1.UserRole.SUPER_ADMIN, types_1.UserRole.COORDINATOR, types_1.UserRole.STOCK_MANAGER, types_1.UserRole.MERCHANT));
/** Delivery Rider */
exports.riderProcedure = exports.t.procedure
    .use(isAuthed)
    .use(requireRole(types_1.UserRole.DELIVERY));
/** Buyer */
exports.buyerProcedure = exports.t.procedure
    .use(isAuthed)
    .use(requireRole(types_1.UserRole.BUYER));
/** Auditor — read-only financial access */
exports.auditorProcedure = exports.t.procedure
    .use(isAuthed)
    .use(requireRole(types_1.UserRole.SUPER_ADMIN, types_1.UserRole.AUDITOR));
/** Support agent */
exports.supportProcedure = exports.t.procedure
    .use(isAuthed)
    .use(requireRole(types_1.UserRole.SUPER_ADMIN, types_1.UserRole.SUPPORT));
/** Any authenticated user (e.g. notification queries) */
exports.anyAuthProcedure = exports.protectedProcedure;
//# sourceMappingURL=auth.js.map