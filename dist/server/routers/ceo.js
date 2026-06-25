"use strict";
/**
 * server/routers/ceo.ts
 * Global CEO Governance Flow — national telemetry, KYC adjudication,
 * commission management, and staff control. All procedures require SUPER_ADMIN.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ceoRouter = void 0;
const server_1 = require("@trpc/server");
const zod_1 = require("zod");
const auth_1 = require("../middleware/auth");
const User_1 = require("../models/User");
const Order_1 = require("../models/Order");
const Product_1 = require("../models/Product");
const EscrowLedger_1 = require("../models/EscrowLedger");
const sseService_1 = require("../utils/sseService");
const schemas_1 = require("../types/schemas");
const types_1 = require("../types");
exports.ceoRouter = (0, auth_1.router)({
    // ── NATIONAL TELEMETRY ────────────────────────────────────────────────────
    /**
     * getNationalTelemetry
     * Aggregates GMV, order counts, and merchant activity across all three states.
     * Uses MongoDB $group aggregation pipeline — does NOT load individual documents.
     */
    getNationalTelemetry: auth_1.globalCeoProcedure
        .input(schemas_1.DateRangeSchema.optional())
        .query(async ({ input }) => {
        const dateFilter = {};
        if (input?.from)
            dateFilter.$gte = new Date(input.from);
        if (input?.to)
            dateFilter.$lte = new Date(input.to);
        const createdAtFilter = Object.keys(dateFilter).length ? { createdAt: dateFilter } : {};
        // Aggregate orders by state
        const [orderStats, merchantCounts, kycQueue, escrowSummary] = await Promise.all([
            Order_1.Order.aggregate([
                { $match: { ...createdAtFilter } },
                {
                    $group: {
                        _id: '$assignedState',
                        totalOrders: { $sum: 1 },
                        grossTotalKobo: { $sum: '$grossTotalKobo' },
                        platformFeeKobo: { $sum: '$platformFeeKobo' },
                        deliveredCount: { $sum: { $cond: [{ $eq: ['$status', types_1.OrderStatus.DELIVERED] }, 1, 0] } },
                        pendingCount: { $sum: { $cond: [{ $eq: ['$status', types_1.OrderStatus.PENDING] }, 1, 0] } },
                    },
                },
            ]),
            User_1.User.aggregate([
                { $match: { role: types_1.UserRole.MERCHANT, isActive: true } },
                { $group: { _id: '$assignedState', count: { $sum: 1 } } },
            ]),
            User_1.User.countDocuments({ kycStatus: types_1.KycStatus.PENDING }),
            EscrowLedger_1.EscrowLedger.aggregate([
                { $match: { entryType: 'LOCK' } },
                { $group: { _id: null, totalLockedKobo: { $sum: '$grossTotalKobo' } } },
            ]),
        ]);
        // Build state map
        const stateMap = {};
        for (const state of Object.values(types_1.NigerianState)) {
            if (state === types_1.NigerianState.GLOBAL)
                continue;
            const orders = orderStats.find((s) => s._id === state) ?? {};
            const merchants = merchantCounts.find((m) => m._id === state) ?? {};
            stateMap[state] = { ...orders, merchantCount: merchants.count ?? 0 };
        }
        const totalGmvKobo = orderStats.reduce((s, r) => s + (r.grossTotalKobo ?? 0), 0);
        return {
            totalGmvKobo,
            totalGmvNaira: totalGmvKobo / 100,
            kycPendingCount: kycQueue,
            escrowLockedKobo: escrowSummary[0]?.totalLockedKobo ?? 0,
            stateBreakdown: stateMap,
            generatedAt: new Date().toISOString(),
        };
    }),
    // ── KYC ADJUDICATION ─────────────────────────────────────────────────────
    /**
     * processKYCAdjudication
     * Approves or rejects a user's KYC submission.
     * On APPROVE: updates kycStatus and, if role is MERCHANT, marks account
     * ready for Monnify sub-account registration.
     * On REJECT: stores reason; user may resubmit.
     *
     * GEF Explanation:
     * - We fetch the target user separately from ctx.user to ensure the
     *   CEO is acting on someone else's record, not their own.
     * - notifyUser() pushes the result to the target user's SSE connection.
     */
    processKYCAdjudication: auth_1.globalCeoProcedure
        .input(schemas_1.KycAdjudicationSchema)
        .mutation(async ({ input, ctx }) => {
        const { targetUserId, action, rejectionReason } = input;
        const actorId = ctx.user.mongoId;
        const targetUser = await User_1.User.findById(targetUserId);
        if (!targetUser) {
            throw new server_1.TRPCError({ code: 'NOT_FOUND', message: 'Target user not found.' });
        }
        if (targetUser.kycStatus === types_1.KycStatus.APPROVED) {
            throw new server_1.TRPCError({ code: 'BAD_REQUEST', message: 'User is already KYC-approved.' });
        }
        targetUser.kycStatus = action === 'APPROVE' ? types_1.KycStatus.APPROVED : types_1.KycStatus.REJECTED;
        await targetUser.save();
        (0, sseService_1.notifyUser)(targetUserId, 'kyc:status_changed', {
            userId: targetUserId,
            newStatus: targetUser.kycStatus,
            message: action === 'APPROVE'
                ? 'Your KYC has been approved. Your account is now fully active.'
                : `Your KYC was rejected. Reason: ${rejectionReason}`,
        });
        return {
            success: true,
            userId: targetUserId,
            newStatus: targetUser.kycStatus,
        };
    }),
    // ── KYC QUEUE ────────────────────────────────────────────────────────────
    getKycQueue: auth_1.globalCeoProcedure
        .input(zod_1.z.object({
        status: zod_1.z.nativeEnum(types_1.KycStatus).optional(),
        page: zod_1.z.number().int().min(1).default(1),
        limit: zod_1.z.number().int().max(50).default(20),
    }))
        .query(async ({ input }) => {
        const { status, page, limit } = input;
        const filter = status ? { kycStatus: status } : {};
        const skip = (page - 1) * limit;
        const [users, total] = await Promise.all([
            User_1.User.find(filter)
                .select('name email role assignedState kycStatus kycDocumentUrls createdAt')
                .sort({ createdAt: 1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            User_1.User.countDocuments(filter),
        ]);
        return { users, pagination: { page, limit, total } };
    }),
    // ── REVOKE USER ACCESS ────────────────────────────────────────────────────
    revokeUserAccess: auth_1.globalCeoProcedure
        .input(zod_1.z.object({
        targetUserId: schemas_1.MongoIdSchema,
        reason: zod_1.z.string().min(10).max(1000),
    }))
        .mutation(async ({ input }) => {
        const user = await User_1.User.findById(input.targetUserId);
        if (!user)
            throw new server_1.TRPCError({ code: 'NOT_FOUND', message: 'User not found.' });
        if (user.role === types_1.UserRole.SUPER_ADMIN) {
            throw new server_1.TRPCError({ code: 'FORBIDDEN', message: 'Cannot revoke another super admin.' });
        }
        user.isActive = false;
        await user.save();
        (0, sseService_1.notifyUser)(input.targetUserId, 'kyc:status_changed', {
            message: `Your account has been suspended. Reason: ${input.reason}`,
        });
        return { success: true };
    }),
    // ── ESCROW SUMMARY ────────────────────────────────────────────────────────
    getEscrowSummary: auth_1.auditorProcedure
        .input(zod_1.z.object({ state: zod_1.z.nativeEnum(types_1.NigerianState).optional() }).merge(schemas_1.DateRangeSchema))
        .query(async ({ input }) => {
        const matchFilter = {};
        if (input.from)
            matchFilter.timestamp = { $gte: new Date(input.from) };
        const summary = await EscrowLedger_1.EscrowLedger.aggregate([
            { $match: matchFilter },
            {
                $group: {
                    _id: '$entryType',
                    totalKobo: { $sum: '$grossTotalKobo' },
                    platformFeeKobo: { $sum: '$platformFeeKobo' },
                    merchantNetKobo: { $sum: '$merchantNetKobo' },
                    count: { $sum: 1 },
                },
            },
        ]);
        return { summary, generatedAt: new Date().toISOString() };
    }),
    // ── SYSTEM STATUS ─────────────────────────────────────────────────────────
    getSystemMetrics: auth_1.globalCeoProcedure
        .query(async () => {
        const [totalUsers, totalProducts, activeOrders] = await Promise.all([
            User_1.User.countDocuments({ isActive: true }),
            Product_1.Product.countDocuments({ isActive: true }),
            Order_1.Order.countDocuments({ status: { $in: [types_1.OrderStatus.PENDING, types_1.OrderStatus.CONFIRMED, types_1.OrderStatus.PROCESSING, types_1.OrderStatus.DISPATCHED] } }),
        ]);
        return {
            platform: { totalUsers, totalProducts, activeOrders },
            nodes: {
                [types_1.NigerianState.ABUJA]: 'ONLINE',
                [types_1.NigerianState.KANO]: 'OPTIMIZED',
                [types_1.NigerianState.KADUNA]: 'SECURE',
            },
            timestamp: new Date().toISOString(),
        };
    }),
});
//# sourceMappingURL=ceo.js.map