/**
 * server/middleware/auth.ts
 * Firebase JWT verification → MongoDB user lookup → tRPC context injection.
 * Every request passes through this before any procedure executes.
 */

import { initTRPC, TRPCError } from '@trpc/server';
import * as trpcExpress from '@trpc/server/adapters/express';
import { firebaseAuth } from '../config/firebase';
import { User } from '../models/User';
import { TRPCContext, AuthenticatedUser, UserRole, NigerianState, KycStatus } from '../types';

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
export async function createContext(
  opts: trpcExpress.CreateExpressContextOptions
): Promise<TRPCContext> {
  const authHeader = opts.req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { user: null };
  }

  const token = authHeader.split(' ')[1];

  try {
    // Step 1: Verify Firebase JWT — confirms token is signed, unexpired,
    // and issued by our Firebase project. Throws if invalid.
    const decoded = await firebaseAuth.verifyIdToken(token);

    // Step 2: Fetch full user document from MongoDB using the Firebase UID.
    // The role, assignedState, and permissions live here — not in the JWT.
    const dbUser = await User.findOne({ firebaseUid: decoded.uid }).lean();

    if (!dbUser || !dbUser.isActive) {
      // User exists in Firebase but not in our system, or is deactivated
      return { user: null };
    }

    const authenticatedUser: AuthenticatedUser = {
      uid:           decoded.uid,
      mongoId:       dbUser._id.toString(),
      email:         dbUser.email,
      role:          dbUser.role,
      assignedState: dbUser.assignedState,
      permissions:   dbUser.permissions,
      kycStatus:     dbUser.kycStatus,
      isActive:      dbUser.isActive,
    };

    return { user: authenticatedUser };
  } catch (err) {
    // Invalid or expired token — treat as unauthenticated
    return { user: null };
  }
}

// ─── tRPC INSTANCE ────────────────────────────────────────────────────────────
export const t = initTRPC.context<TRPCContext>().create();

export const router          = t.router;
export const publicProcedure = t.procedure;

// ─── BASE AUTH MIDDLEWARE ─────────────────────────────────────────────────────
/**
 * isAuthed
 * Rejects any request where ctx.user is null.
 * This is the base layer all protected procedures build on.
 */
const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code:    'UNAUTHORIZED',
      message: 'Authentication session missing or invalid.',
    });
  }
  return next({ ctx: { user: ctx.user } });
});

// Base procedure that requires any valid logged-in user
export const protectedProcedure = t.procedure.use(isAuthed);

// ─── ROLE GUARD FACTORY ───────────────────────────────────────────────────────
/**
 * requireRole
 * Creates a tRPC middleware that enforces one or more allowed roles.
 * MANDATE from spec §5: If user_role is missing or insufficient, the request
 * MUST be rejected with TRPC_ERROR(UNAUTHORIZED) before the controller runs.
 */
function requireRole(...allowedRoles: UserRole[]) {
  return t.middleware(({ ctx, next }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required.' });
    }
    if (!allowedRoles.includes(ctx.user.role)) {
      throw new TRPCError({
        code:    'FORBIDDEN',
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
function requireState(targetState: NigerianState) {
  return t.middleware(({ ctx, next }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required.' });
    }
    const isGlobal = ctx.user.assignedState === NigerianState.GLOBAL;
    const matchesState = ctx.user.assignedState === targetState;
    if (!isGlobal && !matchesState) {
      throw new TRPCError({
        code:    'FORBIDDEN',
        message: `You are not authorized to access the ${targetState} node.`,
      });
    }
    return next({ ctx: { user: ctx.user } });
  });
}

// ─── ROLE-SPECIFIC PROCEDURES ─────────────────────────────────────────────────

/** Tier 1 — Global CEO only. Full national access. */
export const globalCeoProcedure = t.procedure
  .use(isAuthed)
  .use(requireRole(UserRole.SUPER_ADMIN));

/** Tier 2 — State Coordinator or CEO */
export const coordinatorProcedure = t.procedure
  .use(isAuthed)
  .use(requireRole(UserRole.SUPER_ADMIN, UserRole.COORDINATOR));

/** Merchant / Business Owner */
export const merchantProcedure = t.procedure
  .use(isAuthed)
  .use(requireRole(UserRole.SUPER_ADMIN, UserRole.COORDINATOR, UserRole.MERCHANT));

/** Stock Manager */
export const stockProcedure = t.procedure
  .use(isAuthed)
  .use(requireRole(UserRole.SUPER_ADMIN, UserRole.COORDINATOR, UserRole.STOCK_MANAGER, UserRole.MERCHANT));

/** Delivery Rider */
export const riderProcedure = t.procedure
  .use(isAuthed)
  .use(requireRole(UserRole.DELIVERY));

/** Buyer */
export const buyerProcedure = t.procedure
  .use(isAuthed)
  .use(requireRole(UserRole.BUYER));

/** Auditor — read-only financial access */
export const auditorProcedure = t.procedure
  .use(isAuthed)
  .use(requireRole(UserRole.SUPER_ADMIN, UserRole.AUDITOR));

/** Support agent */
export const supportProcedure = t.procedure
  .use(isAuthed)
  .use(requireRole(UserRole.SUPER_ADMIN, UserRole.SUPPORT));

/** Any authenticated user (e.g. notification queries) */
export const anyAuthProcedure = protectedProcedure;
