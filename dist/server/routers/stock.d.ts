/**
 * server/routers/stock.ts
 * Stock & Inventory Management Flow.
 *
 * MANDATE from spec §7.1: All stock changes MUST use MongoDB's $inc operator.
 * Direct overwrites (stock = x) are FORBIDDEN. This prevents race conditions
 * during high-traffic periods (flash sales, simultaneous restock scans).
 */
import mongoose from 'mongoose';
import { InventoryReason } from '../types';
export declare const stockRouter: import("@trpc/server").TRPCBuiltRouter<{
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
    adjustInventoryVolume: import("@trpc/server").TRPCMutationProcedure<{
        input: {
            productId: string;
            deltaCount: number;
            reasonCode: InventoryReason;
            noteText?: string | undefined;
        };
        output: {
            success: boolean;
            productId: string;
            productName: string;
            stockBefore: number;
            stockAfter: number;
            delta: number;
            reasonCode: InventoryReason;
            isLowStock: boolean;
        };
        meta: object;
    }>;
    /**
     * processInboundManifest
     * Bulk stock increase from a supplier delivery.
     * Each item is updated atomically and logged separately.
     */
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
            entries: (mongoose.FlattenMaps<import("../models/EscrowLedger").IInventoryAudit> & Required<{
                _id: mongoose.Types.ObjectId;
            }> & {
                __v: number;
            })[];
        };
        meta: object;
    }>;
}>>;
//# sourceMappingURL=stock.d.ts.map