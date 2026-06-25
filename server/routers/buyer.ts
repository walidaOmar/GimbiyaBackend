/**
 * server/routers/buyer.ts
 * Buyer & Escrow Flow — catalog browsing, checkout, order tracking.
 * All mutations enforce the escrow-first pattern before any state transition.
 */

import { TRPCError } from '@trpc/server';
import mongoose from 'mongoose';
import { z } from 'zod';
import { router, buyerProcedure, protectedProcedure } from '../middleware/auth';
import { Product }        from '../models/Product';
import { Order }          from '../models/Order';
import { CartItem }       from '../models/CartItem';
import { EscrowLedger }   from '../models/EscrowLedger';
import { InventoryAudit } from '../models/EscrowLedger';
import { calculateOrderPricing, generateOrderRef, ESCROW_MIN_AMOUNT_KOBO } from '../pricing';
import { createOtpPair }  from '../utils/otpService';
import { notifyUser }     from '../utils/sseService';
import {
  CatalogQuerySchema,
  CheckoutSchema,
  MongoIdSchema,
  CartItemSchema,
} from '../types/schemas';
import { OrderStatus, EscrowStatus, InventoryReason, NigerianState } from '../types';

export const buyerRouter = router({

  // ── GET REGIONAL CATALOG ─────────────────────────────────────────────────
  getRegionalCatalog: protectedProcedure
    .input(CatalogQuerySchema)
    .query(async ({ input }) => {
      const {
        assignedState, buildingFloor, categorySlug,
        searchQuery, minPriceKobo, maxPriceKobo,
        page, limit,
      } = input;

      const filter: Record<string, unknown> = {
        assignedState,
        isActive: true,
      };

      if (buildingFloor)  filter.buildingFloor = buildingFloor;
      if (categorySlug)   filter.categorySlug  = categorySlug;
      if (minPriceKobo !== undefined || maxPriceKobo !== undefined) {
        filter.priceKobo = {
          ...(minPriceKobo !== undefined && { $gte: minPriceKobo }),
          ...(maxPriceKobo !== undefined && { $lte: maxPriceKobo }),
        };
      }
      if (searchQuery) {
        filter.$text = { $search: searchQuery };
      }

      const skip  = (page - 1) * limit;
      const [products, total] = await Promise.all([
        Product.find(filter)
          .select('name priceKobo stock categorySlug buildingFloor imageUrls averageRating soldCount')
          .skip(skip)
          .limit(limit)
          .lean(),
        Product.countDocuments(filter),
      ]);

      return {
        products,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      };
    }),

  // ── CART MANAGEMENT ──────────────────────────────────────────────────────
  updateCart: buyerProcedure
    .input(CartItemSchema)
    .mutation(async ({ input, ctx }) => {
      const { productId, quantity } = input;
      const buyerId = ctx.user.mongoId;

      const product = await Product.findById(productId).lean();
      if (!product || !product.isActive) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Product not found or unavailable.' });
      }
      if (product.stock < quantity) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Only ${product.stock} units available. You requested ${quantity}.`,
        });
      }

      await CartItem.findOneAndUpdate(
        { userId: buyerId, productId },
        { quantity },
        { upsert: true, new: true }
      );

      return { success: true, message: 'Cart updated.' };
    }),

  getCart: buyerProcedure
    .query(async ({ ctx }) => {
      const items = await CartItem.find({ userId: ctx.user.mongoId })
        .populate('productId', 'name priceKobo stock imageUrls isActive')
        .lean();

      const activeItems = items.filter((i: any) => i.productId?.isActive);
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
  initializeEscrowCheckout: buyerProcedure
    .input(CheckoutSchema)
    .mutation(async ({ input, ctx }) => {
      const { cartItems, shippingAddress, buyerPhone, paymentMethod } = input;
      const buyerId = new mongoose.Types.ObjectId(ctx.user.mongoId);

      // Step 1: Validate and snapshot all products
      const productIds = cartItems.map((i) => new mongoose.Types.ObjectId(i.productId));
      const products   = await Product.find({ _id: { $in: productIds }, isActive: true }).lean();

      if (products.length !== cartItems.length) {
        throw new TRPCError({
          code:    'BAD_REQUEST',
          message: 'One or more products in your cart are no longer available.',
        });
      }

      // Build a lookup map
      const productMap = new Map(products.map((p) => [p._id.toString(), p]));

      // Validate all items have enough stock and belong to the same merchant
      // (MVP: single-merchant checkout per order)
      let merchantId: mongoose.Types.ObjectId | null = null;
      let orderState: NigerianState | null = null;

      const pricedItems = cartItems.map((item) => {
        const product = productMap.get(item.productId);
        if (!product) throw new TRPCError({ code: 'NOT_FOUND', message: `Product ${item.productId} not found.` });
        if (product.stock < item.quantity) {
          throw new TRPCError({
            code:    'BAD_REQUEST',
            message: `Insufficient stock for "${product.name}". Available: ${product.stock}, requested: ${item.quantity}.`,
          });
        }
        if (!merchantId) {
          merchantId = product.merchantId as mongoose.Types.ObjectId;
          orderState = product.assignedState as NigerianState;
        }
        return {
          productId:     product._id as mongoose.Types.ObjectId,
          productName:   product.name,
          quantity:      item.quantity,
          unitPriceKobo: product.priceKobo,
          subtotalKobo:  product.priceKobo * item.quantity,
        };
      });

      if (!merchantId || !orderState) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Could not resolve merchant.' });
      }

      // Step 2: Calculate pricing via the Single Source of Truth
      const pricing = calculateOrderPricing(
        pricedItems.map((i) => ({ unitPriceKobo: i.unitPriceKobo, quantity: i.quantity }))
      );

      // Step 3: Generate OTP pair
      const { rawOtp, otpHash } = await createOtpPair();

      // Step 4: MongoDB transaction — atomic across all writes
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        // 4a. Decrement stock atomically for each item
        for (const item of pricedItems) {
          const result = await Product.findOneAndUpdate(
            { _id: item.productId, stock: { $gte: item.quantity } }, // $gte guard prevents over-sell
            { $inc: { stock: -item.quantity, soldCount: item.quantity } },
            { session, new: true }
          );
          if (!result) {
            throw new TRPCError({
              code:    'CONFLICT',
              message: `Stock for "${item.productName}" was depleted by another order. Please refresh your cart.`,
            });
          }
        }

        // 4b. Count orders for ref generation
        const orderCount = await Order.countDocuments({}, { session });

        // 4c. Create the Order document
        const [order] = await Order.create(
          [{
            orderRef:        generateOrderRef(orderState, orderCount + 1),
            buyerId,
            merchantId,
            riderId:         null,
            items:           pricedItems,
            grossTotalKobo:  pricing.grossTotalKobo,
            platformFeeKobo: pricing.platformFeeKobo,
            merchantNetKobo: pricing.merchantNetKobo,
            status:          OrderStatus.PENDING,
            escrowStatus:    EscrowStatus.LOCKED,
            riderOtpHash:    otpHash,
            shippingAddress,
            assignedState:   orderState,
            timeline: [{
              status:    OrderStatus.PENDING,
              timestamp: new Date(),
              actorId:   buyerId,
              note:      'Order created. Escrow locked.',
            }],
          }],
          { session }
        );

        // 4d. Append EscrowLedger LOCK entry
        await EscrowLedger.create(
          [{
            orderId:         order._id,
            entryType:       'LOCK',
            grossTotalKobo:  pricing.grossTotalKobo,
            platformFeeKobo: pricing.platformFeeKobo,
            merchantNetKobo: pricing.merchantNetKobo,
            escrowStatus:    EscrowStatus.LOCKED,
            actorId:         buyerId,
            noteText:        `Escrow locked on checkout for order ${order.orderRef}`,
          }],
          { session }
        );

        // 4e. Write InventoryAudit for each item deducted
        const auditEntries = pricedItems.map((item) => ({
          productId:   item.productId,
          actorId:     buyerId,
          deltaCount:  -item.quantity,
          reasonCode:  InventoryReason.SALE,
          stockBefore: productMap.get(item.productId.toString())!.stock,
          stockAfter:  productMap.get(item.productId.toString())!.stock - item.quantity,
          noteText:    `Deducted by order ${order.orderRef}`,
          orderId:     order._id,
        }));
        await InventoryAudit.create(auditEntries, { session });

        await session.commitTransaction();

        // Step 5: Clear cart (outside transaction — non-critical)
        await CartItem.deleteMany({ userId: buyerId });

        // Step 6: Notify merchant via SSE
        notifyUser(merchantId.toString(), 'order:status_changed', {
          orderId:   order._id.toString(),
          orderRef:  order.orderRef,
          newStatus: OrderStatus.PENDING,
          message:   'New order received.',
        });

        return {
          success:      true,
          orderId:      order._id.toString(),
          orderRef:     order.orderRef,
          rawOtp,                          // ← Shown to buyer ONLY, ONCE
          grossTotalNaira: pricing.grossTotalNaira,
          platformFeeNaira: pricing.platformFeeNaira,
          merchantNetNaira: pricing.merchantNetNaira,
          message: 'Order placed successfully. Funds locked in escrow.',
        };
      } catch (err) {
        await session.abortTransaction();
        throw err;
      } finally {
        session.endSession();
      }
    }),

  // ── ORDER STATUS / TRACKING ───────────────────────────────────────────────
  getOrderStatus: buyerProcedure
    .input(z.object({ orderId: MongoIdSchema }))
    .query(async ({ input, ctx }) => {
      const order = await Order.findOne({
        _id:     input.orderId,
        buyerId: ctx.user.mongoId, // Buyers can only view their own orders
      })
        .select('-riderOtpHash')   // Hash is NEVER returned to any client
        .lean();

      if (!order) throw new TRPCError({ code: 'NOT_FOUND', message: 'Order not found.' });
      return order;
    }),

  getOrderHistory: buyerProcedure
    .input(z.object({ page: z.number().int().min(1).default(1), limit: z.number().int().max(50).default(10) }))
    .query(async ({ input, ctx }) => {
      const skip = (input.page - 1) * input.limit;
      const [orders, total] = await Promise.all([
        Order.find({ buyerId: ctx.user.mongoId })
          .select('-riderOtpHash')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(input.limit)
          .lean(),
        Order.countDocuments({ buyerId: ctx.user.mongoId }),
      ]);
      return { orders, pagination: { page: input.page, total } };
    }),

  // ── CANCEL ORDER ─────────────────────────────────────────────────────────
  cancelOrder: buyerProcedure
    .input(z.object({ orderId: MongoIdSchema, reason: z.string().max(500) }))
    .mutation(async ({ input, ctx }) => {
      const buyerId = new mongoose.Types.ObjectId(ctx.user.mongoId);
      const order   = await Order.findOne({ _id: input.orderId, buyerId });

      if (!order) throw new TRPCError({ code: 'NOT_FOUND', message: 'Order not found.' });

      const cancellableStatuses: OrderStatus[] = [OrderStatus.PENDING, OrderStatus.CONFIRMED];
      if (!cancellableStatuses.includes(order.status)) {
        throw new TRPCError({
          code:    'BAD_REQUEST',
          message: `Cannot cancel an order with status ${order.status}. Only PENDING or CONFIRMED orders can be cancelled.`,
        });
      }

      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        // Restore stock for each item
        for (const item of order.items) {
          await Product.findByIdAndUpdate(
            item.productId,
            { $inc: { stock: item.quantity, soldCount: -item.quantity } },
            { session }
          );
        }

        order.status       = OrderStatus.CANCELLED;
        order.escrowStatus = EscrowStatus.REFUNDED;
        order.timeline.push({
          status:    OrderStatus.CANCELLED,
          timestamp: new Date(),
          actorId:   buyerId,
          note:      `Cancelled by buyer. Reason: ${input.reason}`,
        });
        await order.save({ session });

        await EscrowLedger.create([{
          orderId:         order._id,
          entryType:       'REFUND',
          grossTotalKobo:  order.grossTotalKobo,
          platformFeeKobo: order.platformFeeKobo,
          merchantNetKobo: order.merchantNetKobo,
          escrowStatus:    EscrowStatus.REFUNDED,
          actorId:         buyerId,
          noteText:        `Refund on buyer cancellation. Reason: ${input.reason}`,
        }], { session });

        await session.commitTransaction();
        return { success: true, message: 'Order cancelled and escrow refunded.' };
      } catch (err) {
        await session.abortTransaction();
        throw err;
      } finally {
        session.endSession();
      }
    }),
});
