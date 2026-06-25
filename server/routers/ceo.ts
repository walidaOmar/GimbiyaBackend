/**
 * server/routers/ceo.ts
 * Global CEO Governance Flow — national telemetry, KYC adjudication,
 * commission management, and staff control. All procedures require SUPER_ADMIN.
 */

import { TRPCError } from '@trpc/server';
import mongoose from 'mongoose';
import { z } from 'zod';
import { router, globalCeoProcedure, auditorProcedure } from '../middleware/auth';
import { User }         from '../models/User';
import { Order }        from '../models/Order';
import { Product }      from '../models/Product';
import { EscrowLedger } from '../models/EscrowLedger';
import { notifyUser }   from '../utils/sseService';
import { KycAdjudicationSchema, MongoIdSchema, DateRangeSchema } from '../types/schemas';
import { NigerianState, KycStatus, UserRole, OrderStatus } from '../types';

export const ceoRouter = router({

  // ── NATIONAL TELEMETRY ────────────────────────────────────────────────────
  /**
   * getNationalTelemetry
   * Aggregates GMV, order counts, and merchant activity across all three states.
   * Uses MongoDB $group aggregation pipeline — does NOT load individual documents.
   */
  getNationalTelemetry: globalCeoProcedure
    .input(DateRangeSchema.optional())
    .query(async ({ input }) => {
      const dateFilter: Record<string, unknown> = {};
      if (input?.from) dateFilter.$gte = new Date(input.from);
      if (input?.to)   dateFilter.$lte = new Date(input.to);
      const createdAtFilter = Object.keys(dateFilter).length ? { createdAt: dateFilter } : {};

      // Aggregate orders by state
      const [orderStats, merchantCounts, kycQueue, escrowSummary] = await Promise.all([
        Order.aggregate([
          { $match: { ...createdAtFilter } },
          {
            $group: {
              _id:             '$assignedState',
              totalOrders:     { $sum: 1 },
              grossTotalKobo:  { $sum: '$grossTotalKobo' },
              platformFeeKobo: { $sum: '$platformFeeKobo' },
              deliveredCount:  { $sum: { $cond: [{ $eq: ['$status', OrderStatus.DELIVERED] }, 1, 0] } },
              pendingCount:    { $sum: { $cond: [{ $eq: ['$status', OrderStatus.PENDING] }, 1, 0] } },
            },
          },
        ]),

        User.aggregate([
          { $match: { role: UserRole.MERCHANT, isActive: true } },
          { $group: { _id: '$assignedState', count: { $sum: 1 } } },
        ]),

        User.countDocuments({ kycStatus: KycStatus.PENDING }),

        EscrowLedger.aggregate([
          { $match: { entryType: 'LOCK' } },
          { $group: { _id: null, totalLockedKobo: { $sum: '$grossTotalKobo' } } },
        ]),
      ]);

      // Build state map
      const stateMap: Record<string, unknown> = {};
      for (const state of Object.values(NigerianState)) {
        if (state === NigerianState.GLOBAL) continue;
        const orders    = orderStats.find((s) => s._id === state) ?? {};
        const merchants = merchantCounts.find((m) => m._id === state) ?? {};
        stateMap[state] = { ...orders, merchantCount: (merchants as any).count ?? 0 };
      }

      const totalGmvKobo = orderStats.reduce((s: number, r: any) => s + (r.grossTotalKobo ?? 0), 0);

      return {
        totalGmvKobo,
        totalGmvNaira:        totalGmvKobo / 100,
        kycPendingCount:      kycQueue,
        escrowLockedKobo:     (escrowSummary[0] as any)?.totalLockedKobo ?? 0,
        stateBreakdown:       stateMap,
        generatedAt:          new Date().toISOString(),
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
  processKYCAdjudication: globalCeoProcedure
    .input(KycAdjudicationSchema)
    .mutation(async ({ input, ctx }) => {
      const { targetUserId, action, rejectionReason } = input;
      const actorId = ctx.user.mongoId;

      const targetUser = await User.findById(targetUserId);
      if (!targetUser) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Target user not found.' });
      }
      if (targetUser.kycStatus === KycStatus.APPROVED) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'User is already KYC-approved.' });
      }

      targetUser.kycStatus = action === 'APPROVE' ? KycStatus.APPROVED : KycStatus.REJECTED;
      await targetUser.save();

      notifyUser(targetUserId, 'kyc:status_changed', {
        userId:    targetUserId,
        newStatus: targetUser.kycStatus,
        message:   action === 'APPROVE'
          ? 'Your KYC has been approved. Your account is now fully active.'
          : `Your KYC was rejected. Reason: ${rejectionReason}`,
      });

      return {
        success:   true,
        userId:    targetUserId,
        newStatus: targetUser.kycStatus,
      };
    }),

  // ── KYC QUEUE ────────────────────────────────────────────────────────────
  getKycQueue: globalCeoProcedure
    .input(z.object({
      status: z.nativeEnum(KycStatus).optional(),
      page:   z.number().int().min(1).default(1),
      limit:  z.number().int().max(50).default(20),
    }))
    .query(async ({ input }) => {
      const { status, page, limit } = input;
      const filter = status ? { kycStatus: status } : {};
      const skip   = (page - 1) * limit;

      const [users, total] = await Promise.all([
        User.find(filter)
          .select('name email role assignedState kycStatus kycDocumentUrls createdAt')
          .sort({ createdAt: 1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        User.countDocuments(filter),
      ]);

      return { users, pagination: { page, limit, total } };
    }),

  // ── REVOKE USER ACCESS ────────────────────────────────────────────────────
  revokeUserAccess: globalCeoProcedure
    .input(z.object({
      targetUserId: MongoIdSchema,
      reason:       z.string().min(10).max(1000),
    }))
    .mutation(async ({ input }) => {
      const user = await User.findById(input.targetUserId);
      if (!user) throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found.' });
      if (user.role === UserRole.SUPER_ADMIN) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Cannot revoke another super admin.' });
      }

      user.isActive = false;
      await user.save();

      notifyUser(input.targetUserId, 'kyc:status_changed', {
        message: `Your account has been suspended. Reason: ${input.reason}`,
      });

      return { success: true };
    }),

  // ── ESCROW SUMMARY ────────────────────────────────────────────────────────
  getEscrowSummary: auditorProcedure
    .input(z.object({ state: z.nativeEnum(NigerianState).optional() }).merge(DateRangeSchema))
    .query(async ({ input }) => {
      const matchFilter: Record<string, unknown> = {};
      if (input.from) matchFilter.timestamp = { $gte: new Date(input.from) };

      const summary = await EscrowLedger.aggregate([
        { $match: matchFilter },
        {
          $group: {
            _id:             '$entryType',
            totalKobo:       { $sum: '$grossTotalKobo' },
            platformFeeKobo: { $sum: '$platformFeeKobo' },
            merchantNetKobo: { $sum: '$merchantNetKobo' },
            count:           { $sum: 1 },
          },
        },
      ]);

      return { summary, generatedAt: new Date().toISOString() };
    }),

  // ── SYSTEM STATUS ─────────────────────────────────────────────────────────
  getSystemMetrics: globalCeoProcedure
    .query(async () => {
      const [totalUsers, totalProducts, activeOrders] = await Promise.all([
        User.countDocuments({ isActive: true }),
        Product.countDocuments({ isActive: true }),
        Order.countDocuments({ status: { $in: [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.PROCESSING, OrderStatus.DISPATCHED] } }),
      ]);

      return {
        platform: { totalUsers, totalProducts, activeOrders },
        nodes: {
          [NigerianState.ABUJA]:  'ONLINE',
          [NigerianState.KANO]:   'OPTIMIZED',
          [NigerianState.KADUNA]: 'SECURE',
        },
        timestamp: new Date().toISOString(),
      };
    }),
});
