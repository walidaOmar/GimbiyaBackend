/**
 * server/models/Order.ts
 * Order document — the central transaction record.
 * riderOtpHash stores ONLY a bcrypt hash. The raw OTP is never persisted.
 * All amounts in Kobo.
 */

import { Schema, model, Document, Types } from 'mongoose';
import { OrderStatus, EscrowStatus, NigerianState } from '../types';

export interface IOrderItem {
  productId:  Types.ObjectId;
  productName: string;          // Snapshot at time of purchase (prices change)
  quantity:   number;
  unitPriceKobo: number;
  subtotalKobo:  number;
}

export interface IOrderTimelineEntry {
  status:    OrderStatus;
  timestamp: Date;
  actorId:   Types.ObjectId | null;
  note:      string;
}

export interface IOrder extends Document {
  _id: Types.ObjectId;
  orderRef: string;             // Human-readable: GM-KN-240001
  buyerId:    Types.ObjectId;
  merchantId: Types.ObjectId;
  riderId:    Types.ObjectId | null;
  items: IOrderItem[];
  grossTotalKobo: number;
  platformFeeKobo: number;
  merchantNetKobo: number;
  status: OrderStatus;
  escrowStatus: EscrowStatus;
  riderOtpHash: string | null;  // bcrypt hash — NEVER the raw OTP
  signatureStoragePath: string | null;
  shippingAddress: string;
  assignedState: NigerianState;
  monnifyPaymentRef: string | null;
  timeline: IOrderTimelineEntry[];
  createdAt: Date;
  updatedAt: Date;
}

const OrderItemSchema = new Schema<IOrderItem>({
  productId:     { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  productName:   { type: String, required: true },
  quantity:      { type: Number, required: true, min: 1 },
  unitPriceKobo: { type: Number, required: true, min: 0 },
  subtotalKobo:  { type: Number, required: true, min: 0 },
}, { _id: false });

const TimelineSchema = new Schema<IOrderTimelineEntry>({
  status:    { type: String, enum: Object.values(OrderStatus), required: true },
  timestamp: { type: Date, default: Date.now },
  actorId:   { type: Schema.Types.ObjectId, ref: 'User', default: null },
  note:      { type: String, default: '' },
}, { _id: false });

const OrderSchema = new Schema<IOrder>(
  {
    orderRef:    { type: String, required: true, unique: true, index: true },
    buyerId:     { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    merchantId:  { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    riderId:     { type: Schema.Types.ObjectId, ref: 'User', default: null },
    items:       { type: [OrderItemSchema], required: true },

    // All amounts in Kobo — Int64 precision
    grossTotalKobo:  { type: Number, required: true, min: 0 },
    platformFeeKobo: { type: Number, required: true, min: 0 },
    merchantNetKobo: { type: Number, required: true, min: 0 },

    status:       { type: String, enum: Object.values(OrderStatus), default: OrderStatus.PENDING, index: true },
    escrowStatus: { type: String, enum: Object.values(EscrowStatus), default: EscrowStatus.LOCKED },

    riderOtpHash:         { type: String, default: null },  // bcrypt hash only
    signatureStoragePath: { type: String, default: null },

    shippingAddress:   { type: String, required: true },
    assignedState:     { type: String, enum: Object.values(NigerianState), required: true, index: true },
    monnifyPaymentRef: { type: String, default: null },
    timeline:          { type: [TimelineSchema], default: [] },
  },
  { timestamps: true }
);

// Compound indexes for dashboard queries
OrderSchema.index({ status: 1, assignedState: 1, createdAt: -1 });
OrderSchema.index({ buyerId: 1, status: 1, createdAt: -1 });
OrderSchema.index({ riderId: 1, status: 1 });
OrderSchema.index({ merchantId: 1, status: 1, createdAt: -1 });

export const Order = model<IOrder>('Order', OrderSchema);
