"use strict";
/**
 * server/models/Order.ts
 * Order document — the central transaction record.
 * riderOtpHash stores ONLY a bcrypt hash. The raw OTP is never persisted.
 * All amounts in Kobo.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Order = void 0;
const mongoose_1 = require("mongoose");
const types_1 = require("../types");
const OrderItemSchema = new mongoose_1.Schema({
    productId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPriceKobo: { type: Number, required: true, min: 0 },
    subtotalKobo: { type: Number, required: true, min: 0 },
}, { _id: false });
const TimelineSchema = new mongoose_1.Schema({
    status: { type: String, enum: Object.values(types_1.OrderStatus), required: true },
    timestamp: { type: Date, default: Date.now },
    actorId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', default: null },
    note: { type: String, default: '' },
}, { _id: false });
const OrderSchema = new mongoose_1.Schema({
    orderRef: { type: String, required: true, unique: true, index: true },
    buyerId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    merchantId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    riderId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', default: null },
    items: { type: [OrderItemSchema], required: true },
    // All amounts in Kobo — Int64 precision
    grossTotalKobo: { type: Number, required: true, min: 0 },
    platformFeeKobo: { type: Number, required: true, min: 0 },
    merchantNetKobo: { type: Number, required: true, min: 0 },
    status: { type: String, enum: Object.values(types_1.OrderStatus), default: types_1.OrderStatus.PENDING, index: true },
    escrowStatus: { type: String, enum: Object.values(types_1.EscrowStatus), default: types_1.EscrowStatus.LOCKED },
    riderOtpHash: { type: String, default: null }, // bcrypt hash only
    signatureStoragePath: { type: String, default: null },
    shippingAddress: { type: String, required: true },
    assignedState: { type: String, enum: Object.values(types_1.NigerianState), required: true, index: true },
    monnifyPaymentRef: { type: String, default: null },
    timeline: { type: [TimelineSchema], default: [] },
}, { timestamps: true });
// Compound indexes for dashboard queries
OrderSchema.index({ status: 1, assignedState: 1, createdAt: -1 });
OrderSchema.index({ buyerId: 1, status: 1, createdAt: -1 });
OrderSchema.index({ riderId: 1, status: 1 });
OrderSchema.index({ merchantId: 1, status: 1, createdAt: -1 });
exports.Order = (0, mongoose_1.model)('Order', OrderSchema);
//# sourceMappingURL=Order.js.map