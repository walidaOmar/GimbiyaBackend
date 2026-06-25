/**
 * server/models/EscrowLedger.ts
 * Double-entry, append-only financial ledger.
 * RULE: No UPDATE or DELETE operations are ever defined on this collection.
 * Every state change creates a new document entry.
 */
import { Document, Types } from 'mongoose';
import { EscrowStatus } from '../types';
export interface IEscrowLedger extends Document {
    _id: Types.ObjectId;
    orderId: Types.ObjectId;
    entryType: 'LOCK' | 'RELEASE' | 'REFUND' | 'FEE_CAPTURE' | 'FREEZE' | 'UNFREEZE';
    grossTotalKobo: number;
    platformFeeKobo: number;
    merchantNetKobo: number;
    escrowStatus: EscrowStatus;
    actorId: Types.ObjectId;
    noteText: string;
    monnifyRef: string | null;
    timestamp: Date;
}
export declare const EscrowLedger: import("mongoose").Model<IEscrowLedger, {}, {}, {}, Document<unknown, {}, IEscrowLedger, {}, {}> & IEscrowLedger & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, any>;
/**
 * server/models/InventoryAudit.ts
 * Append-only stock adjustment log.
 * RULE: No UPDATE or DELETE operations. Every change writes a new document.
 */
export interface IInventoryAudit extends Document {
    _id: Types.ObjectId;
    productId: Types.ObjectId;
    actorId: Types.ObjectId;
    deltaCount: number;
    reasonCode: string;
    stockBefore: number;
    stockAfter: number;
    noteText: string;
    orderId: Types.ObjectId | null;
    timestamp: Date;
}
export declare const InventoryAudit: import("mongoose").Model<IInventoryAudit, {}, {}, {}, Document<unknown, {}, IInventoryAudit, {}, {}> & IInventoryAudit & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=EscrowLedger.d.ts.map