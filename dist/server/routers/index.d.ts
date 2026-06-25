/**
 * server/routers/index.ts
 * Root application router — merges all domain routers into the single tRPC tree.
 * The AppRouter type is exported for use by the frontend tRPC client.
 */
export declare const appRouter: import("@trpc/server").TRPCBuiltRouter<{
    ctx: import("../types").TRPCContext;
    meta: object;
    errorShape: import("@trpc/server").TRPCDefaultErrorShape;
    transformer: false;
}, import("@trpc/server").TRPCDecorateCreateRouterOptions<{
    buyer: import("@trpc/server").TRPCBuiltRouter<{
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
                products: (import("mongoose").FlattenMaps<import("../models/Product").IProduct> & Required<{
                    _id: import("mongoose").Types.ObjectId;
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
                items: (import("mongoose").FlattenMaps<import("../models/CartItem").ICartItem> & Required<{
                    _id: import("mongoose").Types.ObjectId;
                }> & {
                    __v: number;
                })[];
            };
            meta: object;
        }>;
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
            output: import("mongoose").FlattenMaps<import("../models/Order").IOrder> & Required<{
                _id: import("mongoose").Types.ObjectId;
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
                orders: (import("mongoose").FlattenMaps<import("../models/Order").IOrder> & Required<{
                    _id: import("mongoose").Types.ObjectId;
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
    ceo: import("@trpc/server").TRPCBuiltRouter<{
        ctx: import("../types").TRPCContext;
        meta: object;
        errorShape: import("@trpc/server").TRPCDefaultErrorShape;
        transformer: false;
    }, import("@trpc/server").TRPCDecorateCreateRouterOptions<{
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
        processKYCAdjudication: import("@trpc/server").TRPCMutationProcedure<{
            input: {
                targetUserId: string;
                action: "APPROVE" | "REJECT";
                rejectionReason?: string | undefined;
            };
            output: {
                success: boolean;
                userId: string;
                newStatus: import("../types").KycStatus.APPROVED | import("../types").KycStatus.REJECTED;
            };
            meta: object;
        }>;
        getKycQueue: import("@trpc/server").TRPCQueryProcedure<{
            input: {
                limit?: number | undefined;
                status?: import("../types").KycStatus | undefined;
                page?: number | undefined;
            };
            output: {
                users: (import("mongoose").FlattenMaps<import("../models/User").IUser> & Required<{
                    _id: import("mongoose").Types.ObjectId;
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
                state?: import("../types").NigerianState | undefined;
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
    merchant: import("@trpc/server").TRPCBuiltRouter<{
        ctx: import("../types").TRPCContext;
        meta: object;
        errorShape: import("@trpc/server").TRPCDefaultErrorShape;
        transformer: false;
    }, import("@trpc/server").TRPCDecorateCreateRouterOptions<{
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
                products: (import("mongoose").FlattenMaps<import("../models/Product").IProduct> & Required<{
                    _id: import("mongoose").Types.ObjectId;
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
        getSettlementLedger: import("@trpc/server").TRPCQueryProcedure<{
            input: {
                limit?: number | undefined;
                page?: number | undefined;
                from?: string | undefined;
                to?: string | undefined;
            };
            output: {
                entries: (import("mongoose").FlattenMaps<import("../models/EscrowLedger").IEscrowLedger> & Required<{
                    _id: import("mongoose").Types.ObjectId;
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
                topProducts: (import("mongoose").FlattenMaps<import("../models/Product").IProduct> & Required<{
                    _id: import("mongoose").Types.ObjectId;
                }> & {
                    __v: number;
                })[];
                generatedAt: string;
            };
            meta: object;
        }>;
    }>>;
    stock: import("@trpc/server").TRPCBuiltRouter<{
        ctx: import("../types").TRPCContext;
        meta: object;
        errorShape: import("@trpc/server").TRPCDefaultErrorShape;
        transformer: false;
    }, import("@trpc/server").TRPCDecorateCreateRouterOptions<{
        getWarehouseManifest: import("@trpc/server").TRPCQueryProcedure<{
            input: {
                assignedState?: string | undefined;
                limit?: number | undefined;
                page?: number | undefined;
                lowStockOnly?: boolean | undefined;
            };
            output: {
                manifest: any[];
                pagination: {
                    page: number;
                    limit: number;
                    total: number;
                };
                lowStockThreshold: number;
            };
            meta: object;
        }>;
        adjustInventoryVolume: import("@trpc/server").TRPCMutationProcedure<{
            input: {
                productId: string;
                deltaCount: number;
                reasonCode: import("../types").InventoryReason;
                noteText?: string | undefined;
            };
            output: {
                success: boolean;
                productId: string;
                productName: string;
                stockBefore: number;
                stockAfter: number;
                delta: number;
                reasonCode: import("../types").InventoryReason;
                isLowStock: boolean;
            };
            meta: object;
        }>;
        processInboundManifest: import("@trpc/server").TRPCMutationProcedure<{
            input: {
                items: {
                    productId: string;
                    quantity: number;
                }[];
                supplierId: string;
                invoiceRef?: string | undefined;
            };
            output: {
                success: boolean;
                processedItems: number;
                results: {
                    productId: string;
                    added: number;
                    newStock: number;
                }[];
            };
            meta: object;
        }>;
        flagDamagedStock: import("@trpc/server").TRPCMutationProcedure<{
            input: {
                description: string;
                productId: string;
                quantity: number;
            };
            output: {
                success: boolean;
                newStock: number;
            };
            meta: object;
        }>;
        getProductAuditLog: import("@trpc/server").TRPCQueryProcedure<{
            input: {
                productId: string;
                limit?: number | undefined;
            };
            output: {
                entries: (import("mongoose").FlattenMaps<import("../models/EscrowLedger").IInventoryAudit> & Required<{
                    _id: import("mongoose").Types.ObjectId;
                }> & {
                    __v: number;
                })[];
            };
            meta: object;
        }>;
    }>>;
    delivery: import("@trpc/server").TRPCBuiltRouter<{
        ctx: import("../types").TRPCContext;
        meta: object;
        errorShape: import("@trpc/server").TRPCDefaultErrorShape;
        transformer: false;
    }, import("@trpc/server").TRPCDecorateCreateRouterOptions<{
        getAvailableJobs: import("@trpc/server").TRPCQueryProcedure<{
            input: void;
            output: {
                jobs: (import("mongoose").FlattenMaps<import("../models/Order").IOrder> & Required<{
                    _id: import("mongoose").Types.ObjectId;
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
                deliveries: (import("mongoose").FlattenMaps<import("../models/Order").IOrder> & Required<{
                    _id: import("mongoose").Types.ObjectId;
                }> & {
                    __v: number;
                })[];
            };
            meta: object;
        }>;
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
}>>;
export type AppRouter = typeof appRouter;
//# sourceMappingURL=index.d.ts.map