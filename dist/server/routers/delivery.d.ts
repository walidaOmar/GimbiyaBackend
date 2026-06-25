/**
 * server/routers/delivery.ts
 * Delivery Rider Flow — job stream, dispatch claiming, OTP handover, GPS.
 *
 * Critical security contract:
 * - The raw OTP is NEVER returned or logged in any delivery procedure.
 * - finalizeSecureHandover uses bcrypt.compare() against the stored hash.
 * - Escrow release only triggers AFTER successful OTP verification.
 */
import mongoose from 'mongoose';
export declare const deliveryRouter: import("@trpc/server").TRPCBuiltRouter<{
    ctx: import("../types").TRPCContext;
    meta: object;
    errorShape: import("@trpc/server").TRPCDefaultErrorShape;
    transformer: false;
}, import("@trpc/server").TRPCDecorateCreateRouterOptions<{
    /**
     * Returns CONFIRMED orders in the rider's assigned state.
     * State boundary is enforced from ctx.user.assignedState — not from client body.
     */
    getAvailableJobs: import("@trpc/server").TRPCQueryProcedure<{
        input: void;
        output: {
            jobs: (mongoose.FlattenMaps<import("../models/Order").IOrder> & Required<{
                _id: mongoose.Types.ObjectId;
            }> & {
                __v: number;
            })[];
            count: number;
        };
        meta: object;
    }>;
    getMyDeliveries: import("@trpc/server").TRPCQueryProcedure<{
        input: void;
        output: {
            deliveries: (mongoose.FlattenMaps<import("../models/Order").IOrder> & Required<{
                _id: mongoose.Types.ObjectId;
            }> & {
                __v: number;
            })[];
        };
        meta: object;
    }>;
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
    claimDispatchAssignment: import("@trpc/server").TRPCMutationProcedure<{
        input: {
            orderId: string;
        };
        output: {
            success: boolean;
            orderId: string;
            orderRef: string;
            message: string;
        };
        meta: object;
    }>;
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
    finalizeSecureHandover: import("@trpc/server").TRPCMutationProcedure<{
        input: {
            orderId: string;
            submittedOtp: string;
            signatureBase64: string;
        };
        output: {
            success: boolean;
            orderId: string;
            orderRef: string;
            message: string;
        };
        meta: object;
    }>;
    updateRiderLocation: import("@trpc/server").TRPCMutationProcedure<{
        input: {
            orderId: string;
            lat: number;
            lng: number;
        };
        output: {
            success: boolean;
        };
        meta: object;
    }>;
}>>;
//# sourceMappingURL=delivery.d.ts.map