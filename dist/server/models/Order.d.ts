/**
 * server/models/Order.ts
 * Order document — the central transaction record.
 * riderOtpHash stores ONLY a bcrypt hash. The raw OTP is never persisted.
 * All amounts in Kobo.
 */
import { Document, Types } from 'mongoose';
import { OrderStatus, EscrowStatus, NigerianState } from '../types';
export interface IOrderItem {
    productId: Types.ObjectId;
    productName: string;
    quantity: number;
    unitPriceKobo: number;
    subtotalKobo: number;
}
export interface IOrderTimelineEntry {
    status: OrderStatus;
    timestamp: Date;
    actorId: Types.ObjectId | null;
    note: string;
}
export interface IOrder extends Document {
    _id: Types.ObjectId;
    orderRef: string;
    buyerId: Types.ObjectId;
    merchantId: Types.ObjectId;
    riderId: Types.ObjectId | null;
    items: IOrderItem[];
    grossTotalKobo: number;
    platformFeeKobo: number;
    merchantNetKobo: number;
    status: OrderStatus;
    escrowStatus: EscrowStatus;
    riderOtpHash: string | null;
    signatureStoragePath: string | null;
    shippingAddress: string;
    assignedState: NigerianState;
    monnifyPaymentRef: string | null;
    timeline: IOrderTimelineEntry[];
    createdAt: Date;
    updatedAt: Date;
}
export declare const Order: import("mongoose").Model<IOrder, {}, {}, {}, Document<unknown, {}, IOrder, {}, {}> & IOrder & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=Order.d.ts.map