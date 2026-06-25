"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Category = exports.CartItem = void 0;
/**
 * server/models/CartItem.ts
 */
const mongoose_1 = require("mongoose");
const CartItemSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    productId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true, min: 1 },
}, { timestamps: true });
// Composite index: one entry per user per product
CartItemSchema.index({ userId: 1, productId: 1 }, { unique: true });
exports.CartItem = (0, mongoose_1.model)('CartItem', CartItemSchema);
const CategorySchema = new mongoose_1.Schema({
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, index: true },
    description: { type: String, default: '' },
    imageUrl: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
}, { timestamps: true });
exports.Category = (0, mongoose_1.model)('Category', CategorySchema);
//# sourceMappingURL=CartItem.js.map