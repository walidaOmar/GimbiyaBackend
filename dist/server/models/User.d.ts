/**
 * server/models/User.ts
 * Core user document — maps Firebase identity to platform role + state.
 * All financial fields use Int64 (Kobo) via mongoose Decimal128 or Number with int constraint.
 */
import { Document, Types } from 'mongoose';
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
    monnifySubAccountCode: string | null;
    createdAt: Date;
    updatedAt: Date;
}
export declare const User: import("mongoose").Model<IUser, {}, {}, {}, Document<unknown, {}, IUser, {}, {}> & IUser & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=User.d.ts.map