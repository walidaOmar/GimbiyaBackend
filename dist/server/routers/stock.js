"use strict";
/**
 * server/routers/stock.ts
 * Stock & Inventory Management Flow.
 *
 * MANDATE from spec §7.1: All stock changes MUST use MongoDB's $inc operator.
 * Direct overwrites (stock = x) are FORBIDDEN. This prevents race conditions
 * during high-traffic periods (flash sales, simultaneous restock scans).
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.stockRouter = void 0;
const server_1 = require("@trpc/server");
const mongoose_1 = __importDefault(require("mongoose"));
const zod_1 = require("zod");
const auth_1 = require("../middleware/auth");
const Product_1 = require("../models/Product");
const EscrowLedger_1 = require("../models/EscrowLedger");
const sseService_1 = require("../utils/sseService");
const schemas_1 = require("../types/schemas");
const types_1 = require("../types");
const LOW_STOCK_THRESHOLD = parseInt(process.env.LOW_STOCK_THRESHOLD ?? '10', 10);
exports.stockRouter = (0, auth_1.router)({
    // ── GET WAREHOUSE MANIFEST ────────────────────────────────────────────────
    getWarehouseManifest: auth_1.stockProcedure
        .input(zod_1.z.object({
        assignedState: zod_1.z.string().optional(),
        lowStockOnly: zod_1.z.boolean().default(false),
        page: zod_1.z.number().int().min(1).default(1),
        limit: zod_1.z.number().int().max(100).default(50),
    }))
        .query(async ({ input, ctx }) => {
        // State boundary enforcement (spec §7.2):
        // Non-global users can only see inventory in their assigned state.
        const stateFilter = ctx.user.assignedState === 'Global'
            ? (input.assignedState ? { assignedState: input.assignedState } : {})
            : { assignedState: ctx.user.assignedState };
        const filter = { ...stateFilter, isActive: true };
        if (input.lowStockOnly) {
            filter.stock = { $lte: LOW_STOCK_THRESHOLD };
        }
        const skip = (input.page - 1) * input.limit;
        const [products, total] = await Promise.all([
            Product_1.Product.find(filter)
                .select('name priceKobo stock categorySlug buildingFloor assignedState merchantId')
                .populate('merchantId', 'name email')
                .sort({ stock: 1 }) // Lowest stock first
                .skip(skip)
                .limit(input.limit)
                .lean(),
            Product_1.Product.countDocuments(filter),
        ]);
        // Flag low-stock items
        const manifest = products.map((p) => ({
            ...p,
            isLowStock: p.stock <= LOW_STOCK_THRESHOLD,
            stockStatus: p.stock === 0 ? 'OUT_OF_STOCK' : p.stock <= LOW_STOCK_THRESHOLD ? 'LOW' : 'OK',
        }));
        return { manifest, pagination: { page: input.page, limit: input.limit, total }, lowStockThreshold: LOW_STOCK_THRESHOLD };
    }),
    // ── ADJUST INVENTORY VOLUME ───────────────────────────────────────────────
    /**
     * adjustInventoryVolume
     *
     * GEF Explanation (§8):
     * 1. Fetch the current product to capture stockBefore for the audit log.
     * 2. Apply $inc atomically — Mongoose/MongoDB handles concurrency.
     *    If two stock managers adjust the same product simultaneously, MongoDB
     *    serializes the $inc operations correctly.
     * 3. Guard against negative stock: $gte: Math.abs(deltaCount) on decrements.
     * 4. Append an InventoryAudit entry AFTER the successful product update.
     * 5. If post-adjustment stock is at or below threshold, fire SSE alert.
     *
     * FORBIDDEN pattern (do not ever use):
     *   product.stock = product.stock + deltaCount; // Race condition — NOT atomic
     *   await product.save();
     */
    adjustInventoryVolume: auth_1.stockProcedure
        .input(schemas_1.InventoryAdjustSchema)
        .mutation(async ({ input, ctx }) => {
        const { productId, deltaCount, reasonCode, noteText } = input;
        const actorId = new mongoose_1.default.Types.ObjectId(ctx.user.mongoId);
        // Fetch current state for audit snapshot
        const productBefore = await Product_1.Product.findOne({
            _id: productId,
            assignedState: ctx.user.assignedState === 'Global' ? { $exists: true } : ctx.user.assignedState,
        }).lean();
        if (!productBefore) {
            throw new server_1.TRPCError({ code: 'NOT_FOUND', message: 'Product not found in your region.' });
        }
        // Build the atomic update — $gte guard on decrements prevents negative stock
        const updateQuery = deltaCount < 0
            ? {
                $inc: { stock: deltaCount },
                // Guard: only apply if current stock >= Math.abs(deltaCount)
            }
            : { $inc: { stock: deltaCount } };
        const atomicFilter = { _id: productId };
        if (deltaCount < 0) {
            atomicFilter.stock = { $gte: Math.abs(deltaCount) }; // Prevent negative stock
        }
        const updated = await Product_1.Product.findOneAndUpdate(atomicFilter, updateQuery, { new: true });
        if (!updated) {
            throw new server_1.TRPCError({
                code: 'CONFLICT',
                message: `Cannot reduce stock below zero. Current stock: ${productBefore.stock}, attempted reduction: ${Math.abs(deltaCount)}.`,
            });
        }
        const stockBefore = productBefore.stock;
        const stockAfter = updated.stock;
        // Append immutable audit log entry
        await EscrowLedger_1.InventoryAudit.create({
            productId: updated._id,
            actorId,
            deltaCount,
            reasonCode,
            stockBefore,
            stockAfter,
            noteText: noteText ?? '',
            orderId: null,
        });
        // Fire SSE low-stock alert if threshold breached
        if (stockAfter <= LOW_STOCK_THRESHOLD) {
            // Notify the merchant who owns this product
            (0, sseService_1.notifyUser)(updated.merchantId.toString(), 'inventory:low_stock', {
                productId: updated._id.toString(),
                productName: updated.name,
                currentQty: stockAfter,
                threshold: LOW_STOCK_THRESHOLD,
            });
        }
        return {
            success: true,
            productId: updated._id.toString(),
            productName: updated.name,
            stockBefore,
            stockAfter,
            delta: deltaCount,
            reasonCode,
            isLowStock: stockAfter <= LOW_STOCK_THRESHOLD,
        };
    }),
    // ── PROCESS INBOUND MANIFEST ──────────────────────────────────────────────
    /**
     * processInboundManifest
     * Bulk stock increase from a supplier delivery.
     * Each item is updated atomically and logged separately.
     */
    processInboundManifest: auth_1.stockProcedure
        .input(schemas_1.InboundManifestSchema)
        .mutation(async ({ input, ctx }) => {
        const actorId = new mongoose_1.default.Types.ObjectId(ctx.user.mongoId);
        const results = [];
        for (const item of input.items) {
            const productBefore = await Product_1.Product.findById(item.productId).lean();
            if (!productBefore)
                continue;
            const updated = await Product_1.Product.findByIdAndUpdate(item.productId, { $inc: { stock: item.quantity } }, { new: true });
            if (!updated)
                continue;
            await EscrowLedger_1.InventoryAudit.create({
                productId: updated._id,
                actorId,
                deltaCount: item.quantity,
                reasonCode: types_1.InventoryReason.INBOUND,
                stockBefore: productBefore.stock,
                stockAfter: updated.stock,
                noteText: `Inbound from supplier. Ref: ${input.invoiceRef ?? 'N/A'}`,
                orderId: null,
            });
            results.push({ productId: item.productId, added: item.quantity, newStock: updated.stock });
        }
        return { success: true, processedItems: results.length, results };
    }),
    // ── FLAG DAMAGED STOCK ────────────────────────────────────────────────────
    flagDamagedStock: auth_1.stockProcedure
        .input(zod_1.z.object({
        productId: schemas_1.MongoIdSchema,
        quantity: zod_1.z.number().int().min(1),
        description: zod_1.z.string().min(5).max(500),
    }))
        .mutation(async ({ input, ctx }) => {
        const actorId = new mongoose_1.default.Types.ObjectId(ctx.user.mongoId);
        const productBefore = await Product_1.Product.findById(input.productId).lean();
        if (!productBefore)
            throw new server_1.TRPCError({ code: 'NOT_FOUND', message: 'Product not found.' });
        if (productBefore.stock < input.quantity) {
            throw new server_1.TRPCError({ code: 'BAD_REQUEST', message: `Cannot flag more units than available (${productBefore.stock}).` });
        }
        const updated = await Product_1.Product.findOneAndUpdate({ _id: input.productId, stock: { $gte: input.quantity } }, { $inc: { stock: -input.quantity } }, { new: true });
        if (!updated)
            throw new server_1.TRPCError({ code: 'CONFLICT', message: 'Stock changed during operation. Please retry.' });
        await EscrowLedger_1.InventoryAudit.create({
            productId: updated._id,
            actorId,
            deltaCount: -input.quantity,
            reasonCode: types_1.InventoryReason.DAMAGED,
            stockBefore: productBefore.stock,
            stockAfter: updated.stock,
            noteText: `Damage report: ${input.description}`,
            orderId: null,
        });
        return { success: true, newStock: updated.stock };
    }),
    // ── GET AUDIT LOG ─────────────────────────────────────────────────────────
    getProductAuditLog: auth_1.stockProcedure
        .input(zod_1.z.object({
        productId: schemas_1.MongoIdSchema,
        limit: zod_1.z.number().int().max(100).default(50),
    }))
        .query(async ({ input }) => {
        const entries = await EscrowLedger_1.InventoryAudit
            .find({ productId: input.productId })
            .populate('actorId', 'name role')
            .sort({ timestamp: -1 })
            .limit(input.limit)
            .lean();
        return { entries };
    }),
});
//# sourceMappingURL=stock.js.map