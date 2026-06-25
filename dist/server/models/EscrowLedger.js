"use strict";
/**
 * server/models/EscrowLedger.ts
 * Double-entry, append-only financial ledger.
 * RULE: No UPDATE or DELETE operations are ever defined on this collection.
 * Every state change creates a new document entry.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryAudit = exports.EscrowLedger = void 0;
const mongoose_1 = require("mongoose");
const types_1 = require("../types");
const EscrowLedgerSchema = new mongoose_1.Schema({
    orderId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Order',
        required: true,
        index: true,
    },
    entryType: {
        type: String,
        enum: ['LOCK', 'RELEASE', 'REFUND', 'FEE_CAPTURE', 'FREEZE', 'UNFREEZE'],
        required: true,
    },
    grossTotalKobo: { type: Number, required: true, min: 0 },
    platformFeeKobo: { type: Number, required: true, min: 0 },
    merchantNetKobo: { type: Number, required: true, min: 0 },
    escrowStatus: { type: String, enum: Object.values(types_1.EscrowStatus), required: true },
    actorId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    noteText: { type: String, default: '' },
    monnifyRef: { type: String, default: null },
    timestamp: { type: Date, default: Date.now, index: true },
}, {
    // Disable versionKey and updatedAt — this collection is append-only
    versionKey: false,
    timestamps: false,
});
EscrowLedgerSchema.index({ orderId: 1, timestamp: -1 });
exports.EscrowLedger = (0, mongoose_1.model)('EscrowLedger', EscrowLedgerSchema);
const InventoryAuditSchema = new mongoose_1.Schema({
    productId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    actorId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    deltaCount: { type: Number, required: true },
    reasonCode: { type: String, required: true },
    stockBefore: { type: Number, required: true, min: 0 },
    stockAfter: { type: Number, required: true, min: 0 },
    noteText: { type: String, default: '' },
    orderId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Order', default: null },
    timestamp: { type: Date, default: Date.now, index: true },
}, {
    versionKey: false,
    timestamps: false,
});
InventoryAuditSchema.index({ productId: 1, timestamp: -1 });
exports.InventoryAudit = (0, mongoose_1.model)('InventoryAudit', InventoryAuditSchema);
//# sourceMappingURL=EscrowLedger.js.map