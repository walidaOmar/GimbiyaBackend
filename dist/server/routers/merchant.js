"use strict";
/**
 * server/routers/merchant.ts
 * Business Owner / Merchant Flow — product listings, pricing, settlement.
 *
 * State boundary mandate: Every product mutation appends merchantId
 * from ctx.user.mongoId (authenticated session) — never from the client body.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.merchantRouter = void 0;
const server_1 = require("@trpc/server");
const mongoose_1 = __importDefault(require("mongoose"));
const zod_1 = require("zod");
const auth_1 = require("../middleware/auth");
const Product_1 = require("../models/Product");
const Order_1 = require("../models/Order");
const EscrowLedger_1 = require("../models/EscrowLedger");
const schemas_1 = require("../types/schemas");
exports.merchantRouter = (0, auth_1.router)({
    // ── PUBLISH NEW LISTING ───────────────────────────────────────────────────
    /**
     * publishNewListing
     *
     * GEF Explanation:
     * - merchantId is sourced exclusively from ctx.user.mongoId (the verified
     *   session token). The client cannot inject a different merchant ID.
     * - assignedState from the product must match the merchant's assignedState
     *   (unless CEO or Coordinator is creating on behalf of a merchant).
     */
    publishNewListing: auth_1.merchantProcedure
        .input(schemas_1.CreateProductSchema)
        .mutation(async ({ input, ctx }) => {
        const merchantId = new mongoose_1.default.Types.ObjectId(ctx.user.mongoId);
        // State boundary: merchant can only list in their own state
        // (CEO/Coordinator bypass this check via their broader role)
        const isMerchantRole = ctx.user.role === 'business_owner';
        if (isMerchantRole && input.assignedState !== ctx.user.assignedState) {
            throw new server_1.TRPCError({
                code: 'FORBIDDEN',
                message: `You can only list products in your assigned state: ${ctx.user.assignedState}.`,
            });
        }
        const product = await Product_1.Product.create({
            name: input.name,
            descriptionText: input.descriptionText ?? '',
            priceKobo: input.priceKobo,
            stock: input.initialStock,
            categorySlug: input.categorySlug,
            merchantId,
            assignedState: input.assignedState,
            buildingFloor: input.buildingFloor,
            imageUrls: input.imageUrls ?? [],
            isActive: true,
        });
        return {
            success: true,
            productId: product._id.toString(),
            message: `Listing "${product.name}" published to ${input.assignedState} ${input.buildingFloor} marketplace.`,
        };
    }),
    // ── GET MY LISTINGS ───────────────────────────────────────────────────────
    getMyListings: auth_1.merchantProcedure
        .input(zod_1.z.object({
        page: zod_1.z.number().int().min(1).default(1),
        limit: zod_1.z.number().int().max(100).default(20),
        isActive: zod_1.z.boolean().optional(),
    }))
        .query(async ({ input, ctx }) => {
        const merchantId = ctx.user.mongoId;
        const filter = { merchantId };
        if (input.isActive !== undefined)
            filter.isActive = input.isActive;
        const skip = (input.page - 1) * input.limit;
        const [products, total] = await Promise.all([
            Product_1.Product.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(input.limit)
                .lean(),
            Product_1.Product.countDocuments(filter),
        ]);
        return { products, pagination: { page: input.page, limit: input.limit, total } };
    }),
    // ── UPDATE LISTING PRICE ──────────────────────────────────────────────────
    updateListingPrice: auth_1.merchantProcedure
        .input(schemas_1.UpdateProductPriceSchema)
        .mutation(async ({ input, ctx }) => {
        const merchantId = ctx.user.mongoId;
        // Must own the product (state boundary enforced via merchantId)
        const product = await Product_1.Product.findOne({ _id: input.productId, merchantId });
        if (!product) {
            throw new server_1.TRPCError({ code: 'NOT_FOUND', message: 'Product not found or you do not own it.' });
        }
        const previousPriceKobo = product.priceKobo;
        product.priceKobo = input.priceKobo;
        await product.save();
        return {
            success: true,
            productId: product._id.toString(),
            previousPriceKobo,
            newPriceKobo: input.priceKobo,
            previousPriceNaira: previousPriceKobo / 100,
            newPriceNaira: input.priceKobo / 100,
        };
    }),
    // ── TOGGLE LISTING ACTIVE ──────────────────────────────────────────────────
    toggleListingActive: auth_1.merchantProcedure
        .input(zod_1.z.object({ productId: schemas_1.MongoIdSchema, isActive: zod_1.z.boolean() }))
        .mutation(async ({ input, ctx }) => {
        const product = await Product_1.Product.findOneAndUpdate({ _id: input.productId, merchantId: ctx.user.mongoId }, { isActive: input.isActive }, { new: true });
        if (!product)
            throw new server_1.TRPCError({ code: 'NOT_FOUND', message: 'Product not found.' });
        return { success: true, isActive: product.isActive };
    }),
    // ── GET SETTLEMENT LEDGER ─────────────────────────────────────────────────
    /**
     * Returns the merchant's financial ledger — escrow entries attributed to them.
     * Each entry is a read-only ledger row; they cannot be modified.
     */
    getSettlementLedger: auth_1.merchantProcedure
        .input(schemas_1.DateRangeSchema.merge(zod_1.z.object({
        page: zod_1.z.number().int().min(1).default(1),
        limit: zod_1.z.number().int().max(100).default(20),
    })))
        .query(async ({ input, ctx }) => {
        const merchantId = ctx.user.mongoId;
        // Find orders belonging to this merchant that have released escrow
        const orderFilter = { merchantId };
        if (input.from)
            orderFilter.createdAt = { $gte: new Date(input.from) };
        if (input.to)
            orderFilter.createdAt = { ...orderFilter.createdAt, $lte: new Date(input.to) };
        const merchantOrders = await Order_1.Order.find(orderFilter).select('_id').lean();
        const orderIds = merchantOrders.map((o) => o._id);
        const skip = (input.page - 1) * input.limit;
        const [entries, total] = await Promise.all([
            EscrowLedger_1.EscrowLedger.find({ orderId: { $in: orderIds } })
                .sort({ timestamp: -1 })
                .skip(skip)
                .limit(input.limit)
                .lean(),
            EscrowLedger_1.EscrowLedger.countDocuments({ orderId: { $in: orderIds } }),
        ]);
        // Calculate summary totals
        const released = entries.filter((e) => e.entryType === 'RELEASE');
        const totalReleasedKobo = released.reduce((s, e) => s + e.merchantNetKobo, 0);
        return {
            entries,
            summary: {
                totalReleasedKobo,
                totalReleasedNaira: totalReleasedKobo / 100,
                entryCount: total,
            },
            pagination: { page: input.page, limit: input.limit, total },
        };
    }),
    // ── MERCHANT ANALYTICS ────────────────────────────────────────────────────
    getMerchantAnalytics: auth_1.merchantProcedure
        .input(schemas_1.DateRangeSchema.optional())
        .query(async ({ ctx }) => {
        const merchantId = ctx.user.mongoId;
        const [orderStats, topProducts] = await Promise.all([
            Order_1.Order.aggregate([
                { $match: { merchantId: new mongoose_1.default.Types.ObjectId(merchantId) } },
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 },
                        totalKobo: { $sum: '$grossTotalKobo' },
                        merchantNetKobo: { $sum: '$merchantNetKobo' },
                    },
                },
            ]),
            Product_1.Product.find({ merchantId })
                .select('name priceKobo soldCount stock averageRating')
                .sort({ soldCount: -1 })
                .limit(5)
                .lean(),
        ]);
        return {
            orderBreakdown: orderStats,
            topProducts,
            generatedAt: new Date().toISOString(),
        };
    }),
});
//# sourceMappingURL=merchant.js.map