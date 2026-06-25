"use strict";
/**
 * server/models/User.ts
 * Core user document — maps Firebase identity to platform role + state.
 * All financial fields use Int64 (Kobo) via mongoose Decimal128 or Number with int constraint.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.User = void 0;
const mongoose_1 = require("mongoose");
const types_1 = require("../types");
const UserSchema = new mongoose_1.Schema({
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    firebaseUid: { type: String, required: true, unique: true, index: true },
    role: {
        type: String,
        enum: Object.values(types_1.UserRole),
        default: types_1.UserRole.BUYER,
        required: true,
        index: true,
    },
    assignedState: {
        type: String,
        enum: Object.values(types_1.NigerianState),
        required: true,
        index: true,
    },
    permissions: { type: [String], default: [] },
    isActive: { type: Boolean, default: true, index: true },
    phone: { type: String, required: true },
    kycStatus: { type: String, enum: Object.values(types_1.KycStatus), default: types_1.KycStatus.PENDING },
    kycDocumentUrls: { type: [String], default: [] },
    onboardedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', default: null },
    monnifySubAccountCode: { type: String, default: null },
}, {
    timestamps: true,
    // Compound indexes for the most common query patterns
    indexes: [
        { fields: { role: 1, assignedState: 1 } },
        { fields: { kycStatus: 1, role: 1 } },
    ],
});
UserSchema.index({ role: 1, assignedState: 1 });
UserSchema.index({ kycStatus: 1, role: 1 });
exports.User = (0, mongoose_1.model)('User', UserSchema);
//# sourceMappingURL=User.js.map