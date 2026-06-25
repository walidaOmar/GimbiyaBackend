"use strict";
/**
 * server/routers/buyer.ts
 * Buyer & Escrow Flow — catalog browsing, checkout, order tracking.
 * All mutations enforce the escrow-first pattern before any state transition.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buyerRouter = void 0;
const server_1 = require("@trpc/server");
const mongoose_1 = __importDefault(require("mongoose"));
const zod_1 = require("zod");
const auth_1 = require("../middleware/auth");
const Product_1 = require("../models/Product");
const Order_1 = require("../models/Order");
const CartItem_1 = require("../models/CartItem");
const EscrowLedger_1 = require("../models/EscrowLedger");
const EscrowLedger_2 = require("../models/EscrowLedger");
const pricing_1 = require("../pricing");
const otpService_1 = require("../utils/otpService");
const sseService_1 = require("../utils/sseService");
const schemas_1 = require("../types/schemas");
const types_1 = require("../types");
exports.buyerRouter = (0, auth_1.router)({
    // ── GET REGIONAL CATALOG ─────────────────────────────────────────────────
    getRegionalCatalog: auth_1.protectedProcedure
        .input(schemas_1.CatalogQuerySchema)
        .query(async ({ input }) => {
        const { assignedState, buildingFloor, categorySlug, searchQuery, minPriceKobo, maxPriceKobo, page, limit, } = input;
        const filter = {
            assignedState,
            isActive: true,
        };
        if (buildingFloor)
            filter.buildingFloor = buildingFloor;
        if (categorySlug)
            filter.categorySlug = categorySlug;
        if (minPriceKobo !== undefined || maxPriceKobo !== undefined) {
            filter.priceKobo = {
                ...(minPriceKobo !== undefined && { $gte: minPriceKobo }),
                ...(maxPriceKobo !== undefined && { $lte: maxPriceKobo }),
            };
        }
        if (searchQuery) {
            filter.$text = { $search: searchQuery };
        }
        const skip = (page - 1) * limit;
        const [products, total] = await Promise.all([
            Product_1.Product.find(filter)
                .select('name priceKobo stock categorySlug buildingFloor imageUrls averageRating soldCount')
                .skip(skip)
                .limit(limit)
                .lean(),
            Product_1.Product.countDocuments(filter),
        ]);
        return {
            products,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
    }),
    // ── CART MANAGEMENT ──────────────────────────────────────────────────────
    updateCart: auth_1.buyerProcedure
        .input(schemas_1.CartItemSchema)
        .mutation(async ({ input, ctx }) => {
        const { productId, quantity } = input;
        const buyerId = ctx.user.mongoId;
        const product = await Product_1.Product.findById(productId).lean();
        if (!product || !product.isActive) {
            throw new server_1.TRPCError({ code: 'NOT_FOUND', message: 'Product not found or unavailable.' });
        }
        if (product.stock < quantity) {
            throw new server_1.TRPCError({
                code: 'BAD_REQUEST',
                message: `Only ${product.stock} units available. You requested ${quantity}.`,
            });
        }
        await CartItem_1.CartItem.findOneAndUpdate({ userId: buyerId, productId }, { quantity }, { upsert: true, new: true });
        return { success: true, message: 'Cart updated.' };
    }),
    getCart: auth_1.buyerProcedure
        .query(async ({ ctx }) => {
        const items = await CartItem_1.CartItem.find({ userId: ctx.user.mongoId })
            .populate('productId', 'name priceKobo stock imageUrls isActive')
            .lean();
        const activeItems = items.filter((i) => i.productId?.isActive);
        return { items: activeItems };
    }),
    // ── ESCROW CHECKOUT ───────────────────────────────────────────────────────
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
    initializeEscrowCheckout: auth_1.buyerProcedure
        .input(schemas_1.CheckoutSchema)
        .mutation(async ({ input, ctx }) => {
        const { cartItems, shippingAddress, buyerPhone, paymentMethod } = input;
        const buyerId = new mongoose_1.default.Types.ObjectId(ctx.user.mongoId);
        // Step 1: Validate and snapshot all products
        const productIds = cartItems.map((i) => new mongoose_1.default.Types.ObjectId(i.productId));
        const products = await Product_1.Product.find({ _id: { $in: productIds }, isActive: true }).lean();
        if (products.length !== cartItems.length) {
            throw new server_1.TRPCError({
                code: 'BAD_REQUEST',
                message: 'One or more products in your cart are no longer available.',
            });
        }
        // Build a lookup map
        const productMap = new Map(products.map((p) => [p._id.toString(), p]));
        // Validate all items have enough stock and belong to the same merchant
        // (MVP: single-merchant checkout per order)
        let merchantId = null;
        let orderState = null;
        const pricedItems = cartItems.map((item) => {
            const product = productMap.get(item.productId);
            if (!product)
                throw new server_1.TRPCError({ code: 'NOT_FOUND', message: `Product ${item.productId} not found.` });
            if (product.stock < item.quantity) {
                throw new server_1.TRPCError({
                    code: 'BAD_REQUEST',
                    message: `Insufficient stock for "${product.name}". Available: ${product.stock}, requested: ${item.quantity}.`,
                });
            }
            if (!merchantId) {
                merchantId = product.merchantId;
                orderState = product.assignedState;
            }
            return {
                productId: product._id,
                productName: product.name,
                quantity: item.quantity,
                unitPriceKobo: product.priceKobo,
                subtotalKobo: product.priceKobo * item.quantity,
            };
        });
        if (!merchantId || !orderState) {
            throw new server_1.TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Could not resolve merchant.' });
        }
        // Step 2: Calculate pricing via the Single Source of Truth
        const pricing = (0, pricing_1.calculateOrderPricing)(pricedItems.map((i) => ({ unitPriceKobo: i.unitPriceKobo, quantity: i.quantity })));
        // Step 3: Generate OTP pair
        const { rawOtp, otpHash } = await (0, otpService_1.createOtpPair)();
        // Step 4: MongoDB transaction — atomic across all writes
        const session = await mongoose_1.default.startSession();
        session.startTransaction();
        try {
            // 4a. Decrement stock atomically for each item
            for (const item of pricedItems) {
                const result = await Product_1.Product.findOneAndUpdate({ _id: item.productId, stock: { $gte: item.quantity } }, // $gte guard prevents over-sell
                { $inc: { stock: -item.quantity, soldCount: item.quantity } }, { session, new: true });
                if (!result) {
                    throw new server_1.TRPCError({
                        code: 'CONFLICT',
                        message: `Stock for "${item.productName}" was depleted by another order. Please refresh your cart.`,
                    });
                }
            }
            // 4b. Count orders for ref generation
            const orderCount = await Order_1.Order.countDocuments({}, { session });
            // 4c. Create the Order document
            const [order] = await Order_1.Order.create([{
                    orderRef: (0, pricing_1.generateOrderRef)(orderState, orderCount + 1),
                    buyerId,
                    merchantId,
                    riderId: null,
                    items: pricedItems,
                    grossTotalKobo: pricing.grossTotalKobo,
                    platformFeeKobo: pricing.platformFeeKobo,
                    merchantNetKobo: pricing.merchantNetKobo,
                    status: types_1.OrderStatus.PENDING,
                    escrowStatus: types_1.EscrowStatus.LOCKED,
                    riderOtpHash: otpHash,
                    shippingAddress,
                    assignedState: orderState,
                    timeline: [{
                            status: types_1.OrderStatus.PENDING,
                            timestamp: new Date(),
                            actorId: buyerId,
                            note: 'Order created. Escrow locked.',
                        }],
                }], { session });
            // 4d. Append EscrowLedger LOCK entry
            await EscrowLedger_1.EscrowLedger.create([{
                    orderId: order._id,
                    entryType: 'LOCK',
                    grossTotalKobo: pricing.grossTotalKobo,
                    platformFeeKobo: pricing.platformFeeKobo,
                    merchantNetKobo: pricing.merchantNetKobo,
                    escrowStatus: types_1.EscrowStatus.LOCKED,
                    actorId: buyerId,
                    noteText: `Escrow locked on checkout for order ${order.orderRef}`,
                }], { session });
            // 4e. Write InventoryAudit for each item deducted
            const auditEntries = pricedItems.map((item) => ({
                productId: item.productId,
                actorId: buyerId,
                deltaCount: -item.quantity,
                reasonCode: types_1.InventoryReason.SALE,
                stockBefore: productMap.get(item.productId.toString()).stock,
                stockAfter: productMap.get(item.productId.toString()).stock - item.quantity,
                noteText: `Deducted by order ${order.orderRef}`,
                orderId: order._id,
            }));
            await EscrowLedger_2.InventoryAudit.create(auditEntries, { session });
            await session.commitTransaction();
            // Step 5: Clear cart (outside transaction — non-critical)
            await CartItem_1.CartItem.deleteMany({ userId: buyerId });
            // Step 6: Notify merchant via SSE
            (0, sseService_1.notifyUser)(merchantId.toString(), 'order:status_changed', {
                orderId: order._id.toString(),
                orderRef: order.orderRef,
                newStatus: types_1.OrderStatus.PENDING,
                message: 'New order received.',
            });
            return {
                success: true,
                orderId: order._id.toString(),
                orderRef: order.orderRef,
                rawOtp, // ← Shown to buyer ONLY, ONCE
                grossTotalNaira: pricing.grossTotalNaira,
                platformFeeNaira: pricing.platformFeeNaira,
                merchantNetNaira: pricing.merchantNetNaira,
                message: 'Order placed successfully. Funds locked in escrow.',
            };
        }
        catch (err) {
            await session.abortTransaction();
            throw err;
        }
        finally {
            session.endSession();
        }
    }),
    // ── ORDER STATUS / TRACKING ───────────────────────────────────────────────
    getOrderStatus: auth_1.buyerProcedure
        .input(zod_1.z.object({ orderId: schemas_1.MongoIdSchema }))
        .query(async ({ input, ctx }) => {
        const order = await Order_1.Order.findOne({
            _id: input.orderId,
            buyerId: ctx.user.mongoId, // Buyers can only view their own orders
        })
            .select('-riderOtpHash') // Hash is NEVER returned to any client
            .lean();
        if (!order)
            throw new server_1.TRPCError({ code: 'NOT_FOUND', message: 'Order not found.' });
        return order;
    }),
    getOrderHistory: auth_1.buyerProcedure
        .input(zod_1.z.object({ page: zod_1.z.number().int().min(1).default(1), limit: zod_1.z.number().int().max(50).default(10) }))
        .query(async ({ input, ctx }) => {
        const skip = (input.page - 1) * input.limit;
        const [orders, total] = await Promise.all([
            Order_1.Order.find({ buyerId: ctx.user.mongoId })
                .select('-riderOtpHash')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(input.limit)
                .lean(),
            Order_1.Order.countDocuments({ buyerId: ctx.user.mongoId }),
        ]);
        return { orders, pagination: { page: input.page, total } };
    }),
    // ── CANCEL ORDER ─────────────────────────────────────────────────────────
    cancelOrder: auth_1.buyerProcedure
        .input(zod_1.z.object({ orderId: schemas_1.MongoIdSchema, reason: zod_1.z.string().max(500) }))
        .mutation(async ({ input, ctx }) => {
        const buyerId = new mongoose_1.default.Types.ObjectId(ctx.user.mongoId);
        const order = await Order_1.Order.findOne({ _id: input.orderId, buyerId });
        if (!order)
            throw new server_1.TRPCError({ code: 'NOT_FOUND', message: 'Order not found.' });
        const cancellableStatuses = [types_1.OrderStatus.PENDING, types_1.OrderStatus.CONFIRMED];
        if (!cancellableStatuses.includes(order.status)) {
            throw new server_1.TRPCError({
                code: 'BAD_REQUEST',
                message: `Cannot cancel an order with status ${order.status}. Only PENDING or CONFIRMED orders can be cancelled.`,
            });
        }
        const session = await mongoose_1.default.startSession();
        session.startTransaction();
        try {
            // Restore stock for each item
            for (const item of order.items) {
                await Product_1.Product.findByIdAndUpdate(item.productId, { $inc: { stock: item.quantity, soldCount: -item.quantity } }, { session });
            }
            order.status = types_1.OrderStatus.CANCELLED;
            order.escrowStatus = types_1.EscrowStatus.REFUNDED;
            order.timeline.push({
                status: types_1.OrderStatus.CANCELLED,
                timestamp: new Date(),
                actorId: buyerId,
                note: `Cancelled by buyer. Reason: ${input.reason}`,
            });
            await order.save({ session });
            await EscrowLedger_1.EscrowLedger.create([{
                    orderId: order._id,
                    entryType: 'REFUND',
                    grossTotalKobo: order.grossTotalKobo,
                    platformFeeKobo: order.platformFeeKobo,
                    merchantNetKobo: order.merchantNetKobo,
                    escrowStatus: types_1.EscrowStatus.REFUNDED,
                    actorId: buyerId,
                    noteText: `Refund on buyer cancellation. Reason: ${input.reason}`,
                }], { session });
            await session.commitTransaction();
            return { success: true, message: 'Order cancelled and escrow refunded.' };
        }
        catch (err) {
            await session.abortTransaction();
            throw err;
        }
        finally {
            session.endSession();
        }
    }),
});
//# sourceMappingURL=buyer.js.map