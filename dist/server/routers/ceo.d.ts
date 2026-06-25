/**
 * server/routers/ceo.ts
 * Global CEO Governance Flow — national telemetry, KYC adjudication,
 * commission management, and staff control. All procedures require SUPER_ADMIN.
 */
import mongoose from 'mongoose';
import { NigerianState, KycStatus } from '../types';
export declare const ceoRouter: import("@trpc/server").TRPCBuiltRouter<{
    ctx: import("../types").TRPCContext;
    meta: object;
    errorShape: import("@trpc/server").TRPCDefaultErrorShape;
    transformer: false;
}, import("@trpc/server").TRPCDecorateCreateRouterOptions<{
    /**
     * getNationalTelemetry
     * Aggregates GMV, order counts, and merchant activity across all three states.
     * Uses MongoDB $group aggregation pipeline — does NOT load individual documents.
     */
    getNationalTelemetry: import("@trpc/server").TRPCQueryProcedure<{
        input: {
            from?: string | undefined;
            to?: string | undefined;
        } | undefined;
        output: {
            totalGmvKobo: any;
            totalGmvNaira: number;
            kycPendingCount: number;
            escrowLockedKobo: any;
            stateBreakdown: Record<string, unknown>;
            generatedAt: string;
        };
        meta: object;
    }>;
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
    processKYCAdjudication: import("@trpc/server").TRPCMutationProcedure<{
        input: {
            targetUserId: string;
            action: "APPROVE" | "REJECT";
            rejectionReason?: string | undefined;
        };
        output: {
            success: boolean;
            userId: string;
            newStatus: KycStatus.APPROVED | KycStatus.REJECTED;
        };
        meta: object;
    }>;
    getKycQueue: import("@trpc/server").TRPCQueryProcedure<{
        input: {
            limit?: number | undefined;
            status?: KycStatus | undefined;
            page?: number | undefined;
        };
        output: {
            users: (mongoose.FlattenMaps<import("../models/User").IUser> & Required<{
                _id: mongoose.Types.ObjectId;
            }> & {
                __v: number;
            })[];
            pagination: {
                page: number;
                limit: number;
                total: number;
            };
        };
        meta: object;
    }>;
    revokeUserAccess: import("@trpc/server").TRPCMutationProcedure<{
        input: {
            targetUserId: string;
            reason: string;
        };
        output: {
            success: boolean;
        };
        meta: object;
    }>;
    getEscrowSummary: import("@trpc/server").TRPCQueryProcedure<{
        input: {
            from?: string | undefined;
            to?: string | undefined;
            state?: NigerianState | undefined;
        };
        output: {
            summary: any[];
            generatedAt: string;
        };
        meta: object;
    }>;
    getSystemMetrics: import("@trpc/server").TRPCQueryProcedure<{
        input: void;
        output: {
            platform: {
                totalUsers: number;
                totalProducts: number;
                activeOrders: number;
            };
            nodes: {
                Abuja: string;
                Kano: string;
                Kaduna: string;
            };
            timestamp: string;
        };
        meta: object;
    }>;
}>>;
//# sourceMappingURL=ceo.d.ts.map