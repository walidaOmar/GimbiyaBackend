/**
 * server/routers/merchant.ts
 * Business Owner / Merchant Flow — product listings, pricing, settlement.
 *
 * State boundary mandate: Every product mutation appends merchantId
 * from ctx.user.mongoId (authenticated session) — never from the client body.
 */
import mongoose from 'mongoose';
export declare const merchantRouter: import("@trpc/server").TRPCBuiltRouter<{
    ctx: import("../types").TRPCContext;
    meta: object;
    errorShape: import("@trpc/server").TRPCDefaultErrorShape;
    transformer: false;
}, import("@trpc/server").TRPCDecorateCreateRouterOptions<{
    /**
     * publishNewListing
     *
     * GEF Explanation:
     * - merchantId is sourced exclusively from ctx.user.mongoId (the verified
     *   session token). The client cannot inject a different merchant ID.
     * - assignedState from the product must match the merchant's assignedState
     *   (unless CEO or Coordinator is creating on behalf of a merchant).
     */
    publishNewListing: import("@trpc/server").TRPCMutationProcedure<{
        input: {
            [x: string]: any;
            name?: unknown;
            descriptionText?: unknown;
            priceKobo?: unknown;
            initialStock?: unknown;
            categorySlug?: unknown;
            assignedState?: unknown;
            buildingFloor?: unknown;
            imageUrls?: unknown;
        };
        output: {
            success: boolean;
            productId: string;
            message: string;
        };
        meta: object;
    }>;
    getMyListings: import("@trpc/server").TRPCQueryProcedure<{
        input: {
            isActive?: boolean | undefined;
            limit?: number | undefined;
            page?: number | undefined;
        };
        output: {
            products: (mongoose.FlattenMaps<import("../models/Product").IProduct> & Required<{
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
    updateListingPrice: import("@trpc/server").TRPCMutationProcedure<{
        input: {
            priceKobo: number;
            productId: string;
            reasonNote?: string | undefined;
        };
        output: {
            success: boolean;
            productId: string;
            previousPriceKobo: number;
            newPriceKobo: number;
            previousPriceNaira: number;
            newPriceNaira: number;
        };
        meta: object;
    }>;
    toggleListingActive: import("@trpc/server").TRPCMutationProcedure<{
        input: {
            isActive: boolean;
            productId: string;
        };
        output: {
            success: boolean;
            isActive: boolean;
        };
        meta: object;
    }>;
    /**
     * Returns the merchant's financial ledger — escrow entries attributed to them.
     * Each entry is a read-only ledger row; they cannot be modified.
     */
    getSettlementLedger: import("@trpc/server").TRPCQueryProcedure<{
        input: {
            limit?: number | undefined;
            page?: number | undefined;
            from?: string | undefined;
            to?: string | undefined;
        };
        output: {
            entries: (mongoose.FlattenMaps<import("../models/EscrowLedger").IEscrowLedger> & Required<{
                _id: mongoose.Types.ObjectId;
            }> & {
                __v: number;
            })[];
            summary: {
                totalReleasedKobo: number;
                totalReleasedNaira: number;
                entryCount: number;
            };
            pagination: {
                page: number;
                limit: number;
                total: number;
            };
        };
        meta: object;
    }>;
    getMerchantAnalytics: import("@trpc/server").TRPCQueryProcedure<{
        input: {
            from?: string | undefined;
            to?: string | undefined;
        } | undefined;
        output: {
            orderBreakdown: any[];
            topProducts: (mongoose.FlattenMaps<import("../models/Product").IProduct> & Required<{
                _id: mongoose.Types.ObjectId;
            }> & {
                __v: number;
            })[];
            generatedAt: string;
        };
        meta: object;
    }>;
}>>;
//# sourceMappingURL=merchant.d.ts.map