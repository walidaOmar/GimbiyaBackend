/**
 * server/routers/buyer.ts
 * Buyer & Escrow Flow — catalog browsing, checkout, order tracking.
 * All mutations enforce the escrow-first pattern before any state transition.
 */
import mongoose from 'mongoose';
export declare const buyerRouter: import("@trpc/server").TRPCBuiltRouter<{
    ctx: import("../types").TRPCContext;
    meta: object;
    errorShape: import("@trpc/server").TRPCDefaultErrorShape;
    transformer: false;
}, import("@trpc/server").TRPCDecorateCreateRouterOptions<{
    getRegionalCatalog: import("@trpc/server").TRPCQueryProcedure<{
        input: {
            [x: string]: any;
            assignedState?: unknown;
            buildingFloor?: unknown;
            categorySlug?: unknown;
            searchQuery?: unknown;
            minPriceKobo?: unknown;
            maxPriceKobo?: unknown;
            page?: unknown;
            limit?: unknown;
        };
        output: {
            products: (mongoose.FlattenMaps<import("../models/Product").IProduct> & Required<{
                _id: mongoose.Types.ObjectId;
            }> & {
                __v: number;
            })[];
            pagination: {
                page: unknown;
                limit: unknown;
                total: number;
                totalPages: number;
            };
        };
        meta: object;
    }>;
    updateCart: import("@trpc/server").TRPCMutationProcedure<{
        input: {
            productId: string;
            quantity: number;
        };
        output: {
            success: boolean;
            message: string;
        };
        meta: object;
    }>;
    getCart: import("@trpc/server").TRPCQueryProcedure<{
        input: void;
        output: {
            items: (mongoose.FlattenMaps<import("../models/CartItem").ICartItem> & Required<{
                _id: mongoose.Types.ObjectId;
            }> & {
                __v: number;
            })[];
        };
        meta: object;
    }>;
    /**
     * initializeEscrowCheckout
     *
     * GEF Explanation (§8):
     * 1. Validate all cart items exist and have sufficient stock.
     * 2. Snapshot current prices (prices can change — we lock in the checkout price).
     * 3. Run calculateOrderPricing() — the ONLY place gross/fee/net are computed.
     * 4. Use a MongoDB session+transaction to:
     *    a. Atomically decrement stock via $inc with $gte guard.
     *    b. Create the Order document with status PENDING and escrowStatus LOCKED.
     *    c. Append an EscrowLedger LOCK entry.
     *    d. Write InventoryAudit entries for each item deducted.
     * 5. Generate OTP pair — return rawOtp to caller (buyer UI), store only hash.
     * 6. Clear the buyer's cart.
     */
    initializeEscrowCheckout: import("@trpc/server").TRPCMutationProcedure<{
        input: {
            shippingAddress: string;
            cartItems: {
                productId: string;
                quantity: number;
            }[];
            buyerPhone: string;
            paymentMethod?: "CARD" | "ACCOUNT_TRANSFER" | "USSD" | undefined;
        };
        output: {
            success: boolean;
            orderId: string;
            orderRef: string;
            rawOtp: string;
            grossTotalNaira: number;
            platformFeeNaira: number;
            merchantNetNaira: number;
            message: string;
        };
        meta: object;
    }>;
    getOrderStatus: import("@trpc/server").TRPCQueryProcedure<{
        input: {
            orderId: string;
        };
        output: mongoose.FlattenMaps<import("../models/Order").IOrder> & Required<{
            _id: mongoose.Types.ObjectId;
        }> & {
            __v: number;
        };
        meta: object;
    }>;
    getOrderHistory: import("@trpc/server").TRPCQueryProcedure<{
        input: {
            limit?: number | undefined;
            page?: number | undefined;
        };
        output: {
            orders: (mongoose.FlattenMaps<import("../models/Order").IOrder> & Required<{
                _id: mongoose.Types.ObjectId;
            }> & {
                __v: number;
            })[];
            pagination: {
                page: number;
                total: number;
            };
        };
        meta: object;
    }>;
    cancelOrder: import("@trpc/server").TRPCMutationProcedure<{
        input: {
            orderId: string;
            reason: string;
        };
        output: {
            success: boolean;
            message: string;
        };
        meta: object;
    }>;
}>>;
//# sourceMappingURL=buyer.d.ts.map