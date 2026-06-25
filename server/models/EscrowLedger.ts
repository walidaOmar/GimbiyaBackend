/**
 * server/models/EscrowLedger.ts
 * Double-entry, append-only financial ledger.
 * RULE: No UPDATE or DELETE operations are ever defined on this collection.
 * Every state change creates a new document entry.
 */

import { Schema, model, Document, Types } from 'mongoose';
import { EscrowStatus } from '../types';

export interface IEscrowLedger extends Document {
  _id: Types.ObjectId;
  orderId:         Types.ObjectId;
  entryType:       'LOCK' | 'RELEASE' | 'REFUND' | 'FEE_CAPTURE' | 'FREEZE' | 'UNFREEZE';
  grossTotalKobo:  number;
  platformFeeKobo: number;
  merchantNetKobo: number;
  escrowStatus:    EscrowStatus;
  actorId:         Types.ObjectId;  // Who triggered this entry
  noteText:        string;
  monnifyRef:      string | null;
  timestamp:       Date;
}

const EscrowLedgerSchema = new Schema<IEscrowLedger>(
  {
    orderId: {
      type:     Schema.Types.ObjectId,
      ref:      'Order',
      required: true,
      index:    true,
    },
    entryType: {
      type:     String,
      enum:     ['LOCK', 'RELEASE', 'REFUND', 'FEE_CAPTURE', 'FREEZE', 'UNFREEZE'],
      required: true,
    },
    grossTotalKobo:  { type: Number, required: true, min: 0 },
    platformFeeKobo: { type: Number, required: true, min: 0 },
    merchantNetKobo: { type: Number, required: true, min: 0 },
    escrowStatus:    { type: String, enum: Object.values(EscrowStatus), required: true },
    actorId:         { type: Schema.Types.ObjectId, ref: 'User', required: true },
    noteText:        { type: String, default: '' },
    monnifyRef:      { type: String, default: null },
    timestamp:       { type: Date, default: Date.now, index: true },
  },
  {
    // Disable versionKey and updatedAt — this collection is append-only
    versionKey: false,
    timestamps: false,
  }
);

EscrowLedgerSchema.index({ orderId: 1, timestamp: -1 });

export const EscrowLedger = model<IEscrowLedger>('EscrowLedger', EscrowLedgerSchema);


/**
 * server/models/InventoryAudit.ts
 * Append-only stock adjustment log.
 * RULE: No UPDATE or DELETE operations. Every change writes a new document.
 */

export interface IInventoryAudit extends Document {
  _id: Types.ObjectId;
  productId:  Types.ObjectId;
  actorId:    Types.ObjectId;
  deltaCount: number;           // Signed: positive = add, negative = remove
  reasonCode: string;
  stockBefore: number;          // Snapshot before change
  stockAfter:  number;          // Snapshot after change
  noteText:    string;
  orderId:     Types.ObjectId | null;  // Set if triggered by a sale/return
  timestamp:   Date;
}

const InventoryAuditSchema = new Schema<IInventoryAudit>(
  {
    productId:   { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    actorId:     { type: Schema.Types.ObjectId, ref: 'User', required: true },
    deltaCount:  { type: Number, required: true },
    reasonCode:  { type: String, required: true },
    stockBefore: { type: Number, required: true, min: 0 },
    stockAfter:  { type: Number, required: true, min: 0 },
    noteText:    { type: String, default: '' },
    orderId:     { type: Schema.Types.ObjectId, ref: 'Order', default: null },
    timestamp:   { type: Date, default: Date.now, index: true },
  },
  {
    versionKey: false,
    timestamps: false,
  }
);

InventoryAuditSchema.index({ productId: 1, timestamp: -1 });

export const InventoryAudit = model<IInventoryAudit>('InventoryAudit', InventoryAuditSchema);
