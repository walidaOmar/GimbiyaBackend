/**
 * server/routers/merchant.ts
 * Business Owner / Merchant Flow — product listings, pricing, settlement.
 *
 * State boundary mandate: Every product mutation appends merchantId
 * from ctx.user.mongoId (authenticated session) — never from the client body.
 */

import { TRPCError } from '@trpc/server';
import mongoose from 'mongoose';
import { z } from 'zod';
import { router, merchantProcedure } from '../middleware/auth';
import { Product }        from '../models/Product';
import { Order }          from '../models/Order';
import { EscrowLedger }   from '../models/EscrowLedger';
import { InventoryAudit } from '../models/EscrowLedger';
import {
  CreateProductSchema,
  UpdateProductPriceSchema,
  MongoIdSchema,
  DateRangeSchema,
} from '../types/schemas';
import { OrderStatus } from '../types';

export const merchantRouter = router({

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
  publishNewListing: merchantProcedure
    .input(CreateProductSchema)
    .mutation(async ({ input, ctx }) => {
      const merchantId = new mongoose.Types.ObjectId(ctx.user.mongoId);

      // State boundary: merchant can only list in their own state
      // (CEO/Coordinator bypass this check via their broader role)
      const isMerchantRole = ctx.user.role === 'business_owner';
      if (isMerchantRole && input.assignedState !== ctx.user.assignedState) {
        throw new TRPCError({
          code:    'FORBIDDEN',
          message: `You can only list products in your assigned state: ${ctx.user.assignedState}.`,
        });
      }

      const product = await Product.create({
        name:            input.name,
        descriptionText: input.descriptionText ?? '',
        priceKobo:       input.priceKobo,
        stock:           input.initialStock,
        categorySlug:    input.categorySlug,
        merchantId,
        assignedState:   input.assignedState,
        buildingFloor:   input.buildingFloor,
        imageUrls:       input.imageUrls ?? [],
        isActive:        true,
      });

      return {
        success:   true,
        productId: product._id.toString(),
        message:   `Listing "${product.name}" published to ${input.assignedState} ${input.buildingFloor} marketplace.`,
      };
    }),

  // ── GET MY LISTINGS ───────────────────────────────────────────────────────
  getMyListings: merchantProcedure
    .input(z.object({
      page:     z.number().int().min(1).default(1),
      limit:    z.number().int().max(100).default(20),
      isActive: z.boolean().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const merchantId = ctx.user.mongoId;
      const filter: Record<string, unknown> = { merchantId };
      if (input.isActive !== undefined) filter.isActive = input.isActive;

      const skip = (input.page - 1) * input.limit;
      const [products, total] = await Promise.all([
        Product.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(input.limit)
          .lean(),
        Product.countDocuments(filter),
      ]);

      return { products, pagination: { page: input.page, limit: input.limit, total } };
    }),

  // ── UPDATE LISTING PRICE ──────────────────────────────────────────────────
  updateListingPrice: merchantProcedure
    .input(UpdateProductPriceSchema)
    .mutation(async ({ input, ctx }) => {
      const merchantId = ctx.user.mongoId;

      // Must own the product (state boundary enforced via merchantId)
      const product = await Product.findOne({ _id: input.productId, merchantId });
      if (!product) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Product not found or you do not own it.' });
      }

      const previousPriceKobo = product.priceKobo;
      product.priceKobo = input.priceKobo;
      await product.save();

      return {
        success:          true,
        productId:        product._id.toString(),
        previousPriceKobo,
        newPriceKobo:     input.priceKobo,
        previousPriceNaira: previousPriceKobo / 100,
        newPriceNaira:    input.priceKobo / 100,
      };
    }),

  // ── TOGGLE LISTING ACTIVE ──────────────────────────────────────────────────
  toggleListingActive: merchantProcedure
    .input(z.object({ productId: MongoIdSchema, isActive: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      const product = await Product.findOneAndUpdate(
        { _id: input.productId, merchantId: ctx.user.mongoId },
        { isActive: input.isActive },
        { new: true }
      );
      if (!product) throw new TRPCError({ code: 'NOT_FOUND', message: 'Product not found.' });
      return { success: true, isActive: product.isActive };
    }),

  // ── GET SETTLEMENT LEDGER ─────────────────────────────────────────────────
  /**
   * Returns the merchant's financial ledger — escrow entries attributed to them.
   * Each entry is a read-only ledger row; they cannot be modified.
   */
  getSettlementLedger: merchantProcedure
    .input(DateRangeSchema.merge(z.object({
      page:  z.number().int().min(1).default(1),
      limit: z.number().int().max(100).default(20),
    })))
    .query(async ({ input, ctx }) => {
      const merchantId = ctx.user.mongoId;

      // Find orders belonging to this merchant that have released escrow
      const orderFilter: Record<string, unknown> = { merchantId };
      if (input.from) orderFilter.createdAt = { $gte: new Date(input.from) };
      if (input.to)   orderFilter.createdAt = { ...(orderFilter.createdAt as object), $lte: new Date(input.to) };

      const merchantOrders = await Order.find(orderFilter).select('_id').lean();
      const orderIds       = merchantOrders.map((o: any) => o._id);

      const skip = (input.page - 1) * input.limit;
      const [entries, total] = await Promise.all([
        EscrowLedger.find({ orderId: { $in: orderIds } })
          .sort({ timestamp: -1 })
          .skip(skip)
          .limit(input.limit)
          .lean(),
        EscrowLedger.countDocuments({ orderId: { $in: orderIds } }),
      ]);

      // Calculate summary totals
      const released = entries.filter((e: any) => e.entryType === 'RELEASE');
      const totalReleasedKobo = released.reduce((s: number, e: any) => s + e.merchantNetKobo, 0);

      return {
        entries,
        summary: {
          totalReleasedKobo,
          totalReleasedNaira: totalReleasedKobo / 100,
          entryCount:         total,
        },
        pagination: { page: input.page, limit: input.limit, total },
      };
    }),

  // ── MERCHANT ANALYTICS ────────────────────────────────────────────────────
  getMerchantAnalytics: merchantProcedure
    .input(DateRangeSchema.optional())
    .query(async ({ ctx }) => {
      const merchantId = ctx.user.mongoId;

      const [orderStats, topProducts] = await Promise.all([
        Order.aggregate([
          { $match: { merchantId: new mongoose.Types.ObjectId(merchantId) } },
          {
            $group: {
              _id:            '$status',
              count:          { $sum: 1 },
              totalKobo:      { $sum: '$grossTotalKobo' },
              merchantNetKobo:{ $sum: '$merchantNetKobo' },
            },
          },
        ]),

        Product.find({ merchantId })
          .select('name priceKobo soldCount stock averageRating')
          .sort({ soldCount: -1 })
          .limit(5)
          .lean(),
      ]);

      return {
        orderBreakdown: orderStats,
        topProducts,
        generatedAt:    new Date().toISOString(),
      };
    }),
});
