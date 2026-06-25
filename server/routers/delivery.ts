/**
 * server/routers/delivery.ts
 * Delivery Rider Flow — job stream, dispatch claiming, OTP handover, GPS.
 *
 * Critical security contract:
 * - The raw OTP is NEVER returned or logged in any delivery procedure.
 * - finalizeSecureHandover uses bcrypt.compare() against the stored hash.
 * - Escrow release only triggers AFTER successful OTP verification.
 */

import { TRPCError } from '@trpc/server';
import mongoose from 'mongoose';
import { z } from 'zod';
import { router, riderProcedure } from '../middleware/auth';
import { Order }        from '../models/Order';
import { EscrowLedger } from '../models/EscrowLedger';
import { firebaseStorage } from '../config/firebase';
import { verifyOtp }    from '../utils/otpService';
import { notifyUser }   from '../utils/sseService';
import { OtpHandoverSchema, UpdateLocationSchema, MongoIdSchema } from '../types/schemas';
import { OrderStatus, EscrowStatus, NigerianState } from '../types';

export const deliveryRouter = router({

  // ── GET AVAILABLE JOBS ────────────────────────────────────────────────────
  /**
   * Returns CONFIRMED orders in the rider's assigned state.
   * State boundary is enforced from ctx.user.assignedState — not from client body.
   */
  getAvailableJobs: riderProcedure
    .query(async ({ ctx }) => {
      const riderState = ctx.user.assignedState as string;
      if (riderState === NigerianState.GLOBAL) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Riders must be assigned to a specific state.' });
      }

      const orders = await Order.find({
        status:        OrderStatus.CONFIRMED,
        assignedState: riderState,
        riderId:       null, // Only unclaimed jobs
      })
        .select('orderRef items shippingAddress assignedState grossTotalKobo createdAt')
        .sort({ createdAt: 1 }) // Oldest first — FIFO job queue
        .limit(50)
        .lean();

      return { jobs: orders, count: orders.length };
    }),

  // ── GET MY ACTIVE DELIVERIES ─────────────────────────────────────────────
  getMyDeliveries: riderProcedure
    .query(async ({ ctx }) => {
      const riderId = ctx.user.mongoId;
      const orders  = await Order.find({
        riderId,
        status: { $in: [OrderStatus.DISPATCHED, OrderStatus.PROCESSING] },
      })
        .select('-riderOtpHash')
        .sort({ updatedAt: -1 })
        .lean();

      return { deliveries: orders };
    }),

  // ── CLAIM DISPATCH ASSIGNMENT ─────────────────────────────────────────────
  /**
   * claimDispatchAssignment
   * Links the authenticated rider to the order and transitions to DISPATCHED.
   *
   * GEF Explanation:
   * - findOneAndUpdate with status: CONFIRMED and riderId: null ensures
   *   only one rider can claim a job (atomic at MongoDB level).
   * - If another rider claimed it first, the update returns null and we
   *   throw a CONFLICT error.
   */
  claimDispatchAssignment: riderProcedure
    .input(z.object({ orderId: MongoIdSchema }))
    .mutation(async ({ input, ctx }) => {
      const riderId     = new mongoose.Types.ObjectId(ctx.user.mongoId);
      const riderState  = ctx.user.assignedState;

      const order = await Order.findOneAndUpdate(
        {
          _id:           input.orderId,
          status:        OrderStatus.CONFIRMED,
          assignedState: riderState,  // State boundary enforced here
          riderId:       null,        // Unclaimed guard
        },
        {
          $set: { riderId, status: OrderStatus.DISPATCHED },
          $push: {
            timeline: {
              status:    OrderStatus.DISPATCHED,
              timestamp: new Date(),
              actorId:   riderId,
              note:      'Rider claimed job. In transit.',
            },
          },
        },
        { new: true }
      );

      if (!order) {
        throw new TRPCError({
          code:    'CONFLICT',
          message: 'This job is no longer available. It may have been claimed by another rider.',
        });
      }

      // Notify buyer and merchant
      notifyUser(order.buyerId.toString(), 'order:rider_assigned', {
        orderId:   order._id.toString(),
        orderRef:  order.orderRef,
        riderName: ctx.user.email, // Use name in production
        message:   'Your order has been picked up and is on its way!',
      });
      notifyUser(order.merchantId.toString(), 'order:status_changed', {
        orderId:   order._id.toString(),
        newStatus: OrderStatus.DISPATCHED,
      });

      return {
        success:  true,
        orderId:  order._id.toString(),
        orderRef: order.orderRef,
        message:  'Job claimed successfully. Navigate to pickup location.',
      };
    }),

  // ── FINALIZE SECURE HANDOVER ──────────────────────────────────────────────
  /**
   * finalizeSecureHandover
   * The most security-critical procedure on the platform.
   *
   * GEF Explanation (§8 — Trace Analysis):
   *
   * State at entry:
   *   order.status        = DISPATCHED
   *   order.escrowStatus  = LOCKED
   *   order.riderOtpHash  = bcrypt('1109', 10)  [example]
   *   input.submittedOtp  = '1109'              [rider entered from buyer]
   *   input.signatureBase64 = 'data:image/png...' [canvas signature]
   *
   * Step 1: Verify OTP via bcrypt.compare(submitted, storedHash).
   *         Returns false → throw UNAUTHORIZED immediately.
   *         Returns true  → proceed.
   *
   * Step 2: Decode signatureBase64 and upload to Firebase Storage.
   *         Path: /delivery_signatures/{orderId}.png
   *         This is proof of physical handover.
   *
   * Step 3: MongoDB transaction:
   *   a. Update order: status=DELIVERED, escrowStatus=RELEASED,
   *      signatureStoragePath=storagePath. Append DELIVERED timeline entry.
   *   b. Append EscrowLedger RELEASE entry.
   *      After this, the merchant's settlement cycle can process the payout.
   *
   * State at exit:
   *   order.status        = DELIVERED
   *   order.escrowStatus  = RELEASED
   *   order.signaturePath = '/delivery_signatures/{orderId}.png'
   *
   * Step 4: Notify buyer (delivery confirmed) and merchant (escrow released).
   */
  finalizeSecureHandover: riderProcedure
    .input(OtpHandoverSchema)
    .mutation(async ({ input, ctx }) => {
      const riderId = new mongoose.Types.ObjectId(ctx.user.mongoId);

      // Fetch order — must be claimed by THIS rider
      const order = await Order.findOne({
        _id:    input.orderId,
        riderId,
        status: OrderStatus.DISPATCHED,
      });

      if (!order) {
        throw new TRPCError({
          code:    'NOT_FOUND',
          message: 'Active delivery not found. This order may already be completed or not assigned to you.',
        });
      }

      if (!order.riderOtpHash) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'OTP configuration error on this order.' });
      }

      // Step 1: OTP verification — the symbolic security gate
      const otpValid = await verifyOtp(input.submittedOtp, order.riderOtpHash);
      if (!otpValid) {
        throw new TRPCError({
          code:    'UNAUTHORIZED',
          message: 'Invalid OTP. The buyer must confirm the correct 4-digit code.',
        });
      }

      // Step 2: Upload delivery signature to Firebase Storage
      let signatureStoragePath: string;
      try {
        const bucket    = firebaseStorage.bucket();
        const filePath  = `delivery_signatures/${order._id}.png`;
        const fileRef   = bucket.file(filePath);

        // Extract base64 data (strip data:image/png;base64, prefix if present)
        const base64Data = input.signatureBase64.replace(/^data:image\/\w+;base64,/, '');
        const buffer     = Buffer.from(base64Data, 'base64');

        await fileRef.save(buffer, {
          metadata: { contentType: 'image/png' },
          resumable: false,
        });

        signatureStoragePath = filePath;
      } catch (err) {
        throw new TRPCError({
          code:    'INTERNAL_SERVER_ERROR',
          message: 'Failed to store delivery signature. Please retry.',
        });
      }

      // Step 3: Atomic transaction — update order + write ledger entry
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        order.status               = OrderStatus.DELIVERED;
        order.escrowStatus         = EscrowStatus.RELEASED;
        order.signatureStoragePath = signatureStoragePath;
        order.timeline.push({
          status:    OrderStatus.DELIVERED,
          timestamp: new Date(),
          actorId:   riderId,
          note:      'OTP verified. Delivery confirmed. Escrow released.',
        });
        await order.save({ session });

        await EscrowLedger.create([{
          orderId:         order._id,
          entryType:       'RELEASE',
          grossTotalKobo:  order.grossTotalKobo,
          platformFeeKobo: order.platformFeeKobo,
          merchantNetKobo: order.merchantNetKobo,
          escrowStatus:    EscrowStatus.RELEASED,
          actorId:         riderId,
          noteText:        `Escrow released on successful OTP handover. Order ${order.orderRef}.`,
        }], { session });

        await session.commitTransaction();
      } catch (err) {
        await session.abortTransaction();
        throw err;
      } finally {
        session.endSession();
      }

      // Step 4: SSE notifications to buyer and merchant
      notifyUser(order.buyerId.toString(), 'order:status_changed', {
        orderId:   order._id.toString(),
        orderRef:  order.orderRef,
        newStatus: OrderStatus.DELIVERED,
        message:   'Your order has been delivered. Thank you for shopping at Gimbiya Mall!',
      });
      notifyUser(order.merchantId.toString(), 'escrow:released', {
        orderId:         order._id.toString(),
        orderRef:        order.orderRef,
        merchantNetKobo: order.merchantNetKobo,
        merchantNetNaira: order.merchantNetKobo / 100,
        message:         'Escrow released. Funds will be settled in your next cycle.',
      });

      return {
        success:  true,
        orderId:  order._id.toString(),
        orderRef: order.orderRef,
        message:  'Delivery confirmed. Escrow released to merchant.',
      };
    }),

  // ── UPDATE RIDER GPS LOCATION ─────────────────────────────────────────────
  updateRiderLocation: riderProcedure
    .input(UpdateLocationSchema)
    .mutation(async ({ input, ctx }) => {
      const riderId = ctx.user.mongoId;

      const order = await Order.findOne({ _id: input.orderId, riderId, status: OrderStatus.DISPATCHED }).lean();
      if (!order) throw new TRPCError({ code: 'NOT_FOUND', message: 'Active delivery not found.' });

      // Push GPS to buyer via SSE
      notifyUser(order.buyerId.toString(), 'order:status_changed', {
        orderId: input.orderId,
        type:    'GPS_UPDATE',
        lat:     input.lat,
        lng:     input.lng,
      });

      return { success: true };
    }),
});
