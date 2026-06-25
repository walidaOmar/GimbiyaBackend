/**
 * server/models/User.ts
 * Core user document — maps Firebase identity to platform role + state.
 * All financial fields use Int64 (Kobo) via mongoose Decimal128 or Number with int constraint.
 */

import { Schema, model, Document, Types } from 'mongoose';
import { UserRole, NigerianState, KycStatus } from '../types';

export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  firebaseUid: string;
  role: UserRole;
  assignedState: NigerianState;
  permissions: string[];
  isActive: boolean;
  phone: string;
  kycStatus: KycStatus;
  kycDocumentUrls: string[];
  onboardedBy: Types.ObjectId | null;
  monnifySubAccountCode: string | null;   // Set on merchant KYC approval
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name:          { type: String, required: true, trim: true, maxlength: 100 },
    email:         { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    firebaseUid:   { type: String, required: true, unique: true, index: true },
    role: {
      type:    String,
      enum:    Object.values(UserRole),
      default: UserRole.BUYER,
      required: true,
      index:   true,
    },
    assignedState: {
      type:     String,
      enum:     Object.values(NigerianState),
      required: true,
      index:    true,
    },
    permissions:           { type: [String], default: [] },
    isActive:              { type: Boolean, default: true, index: true },
    phone:                 { type: String, required: true },
    kycStatus:             { type: String, enum: Object.values(KycStatus), default: KycStatus.PENDING },
    kycDocumentUrls:       { type: [String], default: [] },
    onboardedBy:           { type: Schema.Types.ObjectId, ref: 'User', default: null },
    monnifySubAccountCode: { type: String, default: null },
  },
  {
    timestamps: true,
    // Compound indexes for the most common query patterns
    indexes: [
      { fields: { role: 1, assignedState: 1 } },
      { fields: { kycStatus: 1, role: 1 } },
    ],
  }
);

UserSchema.index({ role: 1, assignedState: 1 });
UserSchema.index({ kycStatus: 1, role: 1 });

export const User = model<IUser>('User', UserSchema);
