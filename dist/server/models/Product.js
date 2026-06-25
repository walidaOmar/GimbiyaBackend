"use strict";
/**
 * server/models/Product.ts
 * Product document with Kobo-denominated pricing.
 * Stock field is atomic-ready — only ever modified via $inc, never direct overwrite.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Product = void 0;
const mongoose_1 = require("mongoose");
const types_1 = require("../types");
const ProductSchema = new mongoose_1.Schema({
    name: { type: String, required: true, trim: true, minlength: 3, maxlength: 200 },
    descriptionText: { type: String, default: '', maxlength: 2000 },
    priceKobo: {
        type: Number,
        required: true,
        min: [1, 'Price must be greater than 0 Kobo'],
        validate: {
            validator: Number.isInteger,
            message: 'priceKobo must be an integer (no decimal Kobo values)',
        },
    },
    stock: {
        type: Number,
        required: true,
        min: [0, 'Stock cannot be negative'],
        validate: {
            validator: Number.isInteger,
            message: 'Stock must be a whole number',
        },
    },
    categorySlug: { type: String, required: true, index: true },
    merchantId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    assignedState: { type: String, enum: Object.values(types_1.NigerianState), required: true, index: true },
    buildingFloor: { type: String, enum: ['LEVEL_1', 'LEVEL_2'], required: true },
    imageUrls: { type: [String], default: [] },
    isActive: { type: Boolean, default: true, index: true },
    soldCount: { type: Number, default: 0, min: 0 },
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0, min: 0 },
}, { timestamps: true });
// Compound index for the catalog query: filter by state + floor + active
ProductSchema.index({ assignedState: 1, buildingFloor: 1, isActive: 1 });
// Text index for search
ProductSchema.index({ name: 'text', descriptionText: 'text' });
exports.Product = (0, mongoose_1.model)('Product', ProductSchema);
//# sourceMappingURL=Product.js.map