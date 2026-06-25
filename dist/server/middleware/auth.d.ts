/**
 * server/middleware/auth.ts
 * Firebase JWT verification → MongoDB user lookup → tRPC context injection.
 * Every request passes through this before any procedure executes.
 */
import * as trpcExpress from '@trpc/server/adapters/express';
import { TRPCContext, AuthenticatedUser } from '../types';
/**
 * createContext
 * Intercepts every incoming tRPC request, extracts the Bearer JWT,
 * verifies it with Firebase Admin SDK, and fetches the full user document
 * from MongoDB. The result is injected into ctx for all procedures.
 *
 * Returns { user: null } for unauthenticated requests — public procedures
 * are explicitly marked; protected ones throw UNAUTHORIZED via middleware.
 */
export declare function createContext(opts: trpcExpress.CreateExpressContextOptions): Promise<TRPCContext>;
export declare const t: import("@trpc/server").TRPCRootObject<TRPCContext, object, import("@trpc/server").TRPCRuntimeConfigOptions<TRPCContext, object>, {
    ctx: TRPCContext;
    meta: object;
    errorShape: import("@trpc/server").TRPCDefaultErrorShape;
    transformer: false;
}>;
export declare const router: import("@trpc/server").TRPCRouterBuilder<{
    ctx: TRPCContext;
    meta: object;
    errorShape: import("@trpc/server").TRPCDefaultErrorShape;
    transformer: false;
}>;
export declare const publicProcedure: import("@trpc/server").TRPCProcedureBuilder<TRPCContext, object, object, import("@trpc/server").TRPCUnsetMarker, import("@trpc/server").TRPCUnsetMarker, import("@trpc/server").TRPCUnsetMarker, import("@trpc/server").TRPCUnsetMarker, false>;
export declare const protectedProcedure: import("@trpc/server").TRPCProcedureBuilder<TRPCContext, object, {
    user: AuthenticatedUser;
}, import("@trpc/server").TRPCUnsetMarker, import("@trpc/server").TRPCUnsetMarker, import("@trpc/server").TRPCUnsetMarker, import("@trpc/server").TRPCUnsetMarker, false>;
/** Tier 1 — Global CEO only. Full national access. */
export declare const globalCeoProcedure: import("@trpc/server").TRPCProcedureBuilder<TRPCContext, object, {
    user: AuthenticatedUser;
}, import("@trpc/server").TRPCUnsetMarker, import("@trpc/server").TRPCUnsetMarker, import("@trpc/server").TRPCUnsetMarker, import("@trpc/server").TRPCUnsetMarker, false>;
/** Tier 2 — State Coordinator or CEO */
export declare const coordinatorProcedure: import("@trpc/server").TRPCProcedureBuilder<TRPCContext, object, {
    user: AuthenticatedUser;
}, import("@trpc/server").TRPCUnsetMarker, import("@trpc/server").TRPCUnsetMarker, import("@trpc/server").TRPCUnsetMarker, import("@trpc/server").TRPCUnsetMarker, false>;
/** Merchant / Business Owner */
export declare const merchantProcedure: import("@trpc/server").TRPCProcedureBuilder<TRPCContext, object, {
    user: AuthenticatedUser;
}, import("@trpc/server").TRPCUnsetMarker, import("@trpc/server").TRPCUnsetMarker, import("@trpc/server").TRPCUnsetMarker, import("@trpc/server").TRPCUnsetMarker, false>;
/** Stock Manager */
export declare const stockProcedure: import("@trpc/server").TRPCProcedureBuilder<TRPCContext, object, {
    user: AuthenticatedUser;
}, import("@trpc/server").TRPCUnsetMarker, import("@trpc/server").TRPCUnsetMarker, import("@trpc/server").TRPCUnsetMarker, import("@trpc/server").TRPCUnsetMarker, false>;
/** Delivery Rider */
export declare const riderProcedure: import("@trpc/server").TRPCProcedureBuilder<TRPCContext, object, {
    user: AuthenticatedUser;
}, import("@trpc/server").TRPCUnsetMarker, import("@trpc/server").TRPCUnsetMarker, import("@trpc/server").TRPCUnsetMarker, import("@trpc/server").TRPCUnsetMarker, false>;
/** Buyer */
export declare const buyerProcedure: import("@trpc/server").TRPCProcedureBuilder<TRPCContext, object, {
    user: AuthenticatedUser;
}, import("@trpc/server").TRPCUnsetMarker, import("@trpc/server").TRPCUnsetMarker, import("@trpc/server").TRPCUnsetMarker, import("@trpc/server").TRPCUnsetMarker, false>;
/** Auditor — read-only financial access */
export declare const auditorProcedure: import("@trpc/server").TRPCProcedureBuilder<TRPCContext, object, {
    user: AuthenticatedUser;
}, import("@trpc/server").TRPCUnsetMarker, import("@trpc/server").TRPCUnsetMarker, import("@trpc/server").TRPCUnsetMarker, import("@trpc/server").TRPCUnsetMarker, false>;
/** Support agent */
export declare const supportProcedure: import("@trpc/server").TRPCProcedureBuilder<TRPCContext, object, {
    user: AuthenticatedUser;
}, import("@trpc/server").TRPCUnsetMarker, import("@trpc/server").TRPCUnsetMarker, import("@trpc/server").TRPCUnsetMarker, import("@trpc/server").TRPCUnsetMarker, false>;
/** Any authenticated user (e.g. notification queries) */
export declare const anyAuthProcedure: import("@trpc/server").TRPCProcedureBuilder<TRPCContext, object, {
    user: AuthenticatedUser;
}, import("@trpc/server").TRPCUnsetMarker, import("@trpc/server").TRPCUnsetMarker, import("@trpc/server").TRPCUnsetMarker, import("@trpc/server").TRPCUnsetMarker, false>;
//# sourceMappingURL=auth.d.ts.map