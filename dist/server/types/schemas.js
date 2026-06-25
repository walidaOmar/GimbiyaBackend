"use strict";
/**
 * server/types/schemas.ts
 * Zod validation schemas — the symbolic boundary between frontend input and backend logic.
 * Every tRPC procedure input MUST reference one of these schemas.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DateRangeSchema = exports.CatalogQuerySchema = exports.PaginationSchema = exports.KycAdjudicationSchema = exports.UpdateLocationSchema = exports.OtpHandoverSchema = exports.InboundManifestSchema = exports.InventoryAdjustSchema = exports.CheckoutSchema = exports.CartItemSchema = exports.UpdateProductPriceSchema = exports.CreateProductSchema = exports.RegisterUserSchema = exports.NigerianPhoneSchema = exports.KoboAmountSchema = exports.MongoIdSchema = void 0;
const zod_1 = require("zod");
const index_1 = require("./index");
// ─── PRIMITIVES ───────────────────────────────────────────────────────────────
exports.MongoIdSchema = zod_1.z.string().regex(/^[a-f\d]{24}$/i, 'Invalid MongoDB ObjectId');
exports.KoboAmountSchema = zod_1.z
    .number()
    .int('Amount must be an integer (Kobo)')
    .nonnegative('Amount cannot be negative');
exports.NigerianPhoneSchema = zod_1.z
    .string()
    .regex(/^(\+234|0)[789][01]\d{8}$/, 'Must be a valid Nigerian phone number');
// ─── AUTH / USER ──────────────────────────────────────────────────────────────
exports.RegisterUserSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).max(100),
    email: zod_1.z.string().email(),
    phone: exports.NigerianPhoneSchema,
    role: zod_1.z.nativeEnum(index_1.UserRole).default(index_1.UserRole.BUYER),
    assignedState: zod_1.z.nativeEnum(index_1.NigerianState),
    firebaseUid: zod_1.z.string().min(1),
});
// ─── PRODUCT ──────────────────────────────────────────────────────────────────
exports.CreateProductSchema = zod_1.z.object({
    name: zod_1.z.string().min(3, 'Product name must be at least 3 characters').max(200),
    descriptionText: zod_1.z.string().max(2000).optional(),
    priceKobo: exports.KoboAmountSchema.min(1, 'Price must be greater than 0'),
    initialStock: zod_1.z.number().int().nonnegative(),
    categorySlug: zod_1.z.string().min(1),
    assignedState: zod_1.z.nativeEnum(index_1.NigerianState).exclude([index_1.NigerianState.GLOBAL]),
    buildingFloor: zod_1.z.enum(['LEVEL_1', 'LEVEL_2']),
    imageUrls: zod_1.z.array(zod_1.z.string().url()).max(5).optional(),
});
exports.UpdateProductPriceSchema = zod_1.z.object({
    productId: exports.MongoIdSchema,
    priceKobo: exports.KoboAmountSchema.min(1),
    reasonNote: zod_1.z.string().max(500).optional(),
});
// ─── CART & CHECKOUT ─────────────────────────────────────────────────────────
exports.CartItemSchema = zod_1.z.object({
    productId: exports.MongoIdSchema,
    quantity: zod_1.z.number().int().min(1, 'Quantity must be at least 1').max(999),
});
exports.CheckoutSchema = zod_1.z.object({
    cartItems: zod_1.z.array(exports.CartItemSchema).min(1, 'Cart cannot be empty'),
    shippingAddress: zod_1.z.string().min(10, 'Please provide a full shipping address').max(500),
    buyerPhone: exports.NigerianPhoneSchema,
    paymentMethod: zod_1.z.enum(['CARD', 'ACCOUNT_TRANSFER', 'USSD']).default('ACCOUNT_TRANSFER'),
});
// ─── INVENTORY ────────────────────────────────────────────────────────────────
exports.InventoryAdjustSchema = zod_1.z.object({
    productId: exports.MongoIdSchema,
    deltaCount: zod_1.z
        .number()
        .int('Stock change must be a whole number')
        .refine((v) => v !== 0, 'Delta cannot be zero'),
    reasonCode: zod_1.z.nativeEnum(index_1.InventoryReason),
    noteText: zod_1.z.string().max(500).optional(),
});
exports.InboundManifestSchema = zod_1.z.object({
    supplierId: exports.MongoIdSchema,
    items: zod_1.z.array(zod_1.z.object({
        productId: exports.MongoIdSchema,
        quantity: zod_1.z.number().int().min(1),
    })).min(1),
    invoiceRef: zod_1.z.string().max(100).optional(),
});
// ─── ORDER / DELIVERY ─────────────────────────────────────────────────────────
exports.OtpHandoverSchema = zod_1.z.object({
    orderId: exports.MongoIdSchema,
    submittedOtp: zod_1.z.string().length(4, 'OTP must be exactly 4 digits').regex(/^\d{4}$/),
    signatureBase64: zod_1.z.string().min(100, 'Signature data is required'),
});
exports.UpdateLocationSchema = zod_1.z.object({
    orderId: exports.MongoIdSchema,
    lat: zod_1.z.number().min(-90).max(90),
    lng: zod_1.z.number().min(-180).max(180),
});
// ─── KYC ─────────────────────────────────────────────────────────────────────
exports.KycAdjudicationSchema = zod_1.z.object({
    targetUserId: exports.MongoIdSchema,
    action: zod_1.z.enum(['APPROVE', 'REJECT']),
    rejectionReason: zod_1.z.string().max(1000).optional(),
}).refine((d) => d.action === 'APPROVE' || (d.action === 'REJECT' && !!d.rejectionReason), { message: 'A rejection reason is required when rejecting KYC', path: ['rejectionReason'] });
// ─── PAGINATION ───────────────────────────────────────────────────────────────
exports.PaginationSchema = zod_1.z.object({
    page: zod_1.z.number().int().min(1).default(1),
    limit: zod_1.z.number().int().min(1).max(100).default(20),
});
// ─── CATALOG QUERY ────────────────────────────────────────────────────────────
exports.CatalogQuerySchema = zod_1.z.object({
    assignedState: zod_1.z.nativeEnum(index_1.NigerianState).exclude([index_1.NigerianState.GLOBAL]),
    buildingFloor: zod_1.z.enum(['LEVEL_1', 'LEVEL_2']).optional(),
    categorySlug: zod_1.z.string().optional(),
    searchQuery: zod_1.z.string().max(100).optional(),
    minPriceKobo: exports.KoboAmountSchema.optional(),
    maxPriceKobo: exports.KoboAmountSchema.optional(),
}).merge(exports.PaginationSchema);
// ─── DATE RANGE ───────────────────────────────────────────────────────────────
exports.DateRangeSchema = zod_1.z.object({
    from: zod_1.z.string().datetime().optional(),
    to: zod_1.z.string().datetime().optional(),
});
//# sourceMappingURL=schemas.js.map