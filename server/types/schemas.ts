/**
 * server/types/schemas.ts
 * Zod validation schemas — the symbolic boundary between frontend input and backend logic.
 * Every tRPC procedure input MUST reference one of these schemas.
 */

import { z } from 'zod';
import { UserRole, NigerianState, InventoryReason } from './index';

// ─── PRIMITIVES ───────────────────────────────────────────────────────────────
export const MongoIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid MongoDB ObjectId');

export const KoboAmountSchema = z
  .number()
  .int('Amount must be an integer (Kobo)')
  .nonnegative('Amount cannot be negative');

export const NigerianPhoneSchema = z
  .string()
  .regex(/^(\+234|0)[789][01]\d{8}$/, 'Must be a valid Nigerian phone number');

// Regional states only — excludes Global which is CEO-only.
// z.nativeEnum().exclude() does not exist in Zod — use z.enum() explicitly.
export const RegionalStateSchema = z.enum([
  NigerianState.ABUJA,
  NigerianState.KANO,
  NigerianState.KADUNA,
]);

// ─── AUTH / USER ──────────────────────────────────────────────────────────────
export const RegisterUserSchema = z.object({
  name:          z.string().min(2).max(100),
  email:         z.string().email(),
  phone:         NigerianPhoneSchema,
  role:          z.nativeEnum(UserRole).default(UserRole.BUYER),
  assignedState: z.nativeEnum(NigerianState),
  firebaseUid:   z.string().min(1),
});

// ─── PRODUCT ──────────────────────────────────────────────────────────────────
export const CreateProductSchema = z.object({
  name:            z.string().min(3, 'Product name must be at least 3 characters').max(200),
  descriptionText: z.string().max(2000).optional(),
  priceKobo:       KoboAmountSchema.min(1, 'Price must be greater than 0'),
  initialStock:    z.number().int().nonnegative(),
  categorySlug:    z.string().min(1),
  assignedState:   RegionalStateSchema,
  buildingFloor:   z.enum(['LEVEL_1', 'LEVEL_2']),
  imageUrls:       z.array(z.string().url()).max(5).optional(),
});

export const UpdateProductPriceSchema = z.object({
  productId:  MongoIdSchema,
  priceKobo:  KoboAmountSchema.min(1),
  reasonNote: z.string().max(500).optional(),
});

// ─── CART & CHECKOUT ─────────────────────────────────────────────────────────
export const CartItemSchema = z.object({
  productId: MongoIdSchema,
  quantity:  z.number().int().min(1, 'Quantity must be at least 1').max(999),
});

export const CheckoutSchema = z.object({
  cartItems:       z.array(CartItemSchema).min(1, 'Cart cannot be empty'),
  shippingAddress: z.string().min(10, 'Please provide a full shipping address').max(500),
  buyerPhone:      NigerianPhoneSchema,
  paymentMethod:   z.enum(['CARD', 'ACCOUNT_TRANSFER', 'USSD']).default('ACCOUNT_TRANSFER'),
});

// ─── INVENTORY ────────────────────────────────────────────────────────────────
export const InventoryAdjustSchema = z.object({
  productId:  MongoIdSchema,
  deltaCount: z
    .number()
    .int('Stock change must be a whole number')
    .refine((v) => v !== 0, 'Delta cannot be zero'),
  reasonCode: z.nativeEnum(InventoryReason),
  noteText:   z.string().max(500).optional(),
});

export const InboundManifestSchema = z.object({
  supplierId: MongoIdSchema,
  items: z.array(
    z.object({
      productId: MongoIdSchema,
      quantity:  z.number().int().min(1),
    })
  ).min(1),
  invoiceRef: z.string().max(100).optional(),
});

// ─── ORDER / DELIVERY ─────────────────────────────────────────────────────────
export const OtpHandoverSchema = z.object({
  orderId:         MongoIdSchema,
  submittedOtp:    z.string().length(4, 'OTP must be exactly 4 digits').regex(/^\d{4}$/),
  signatureBase64: z.string().min(100, 'Signature data is required'),
});

export const UpdateLocationSchema = z.object({
  orderId: MongoIdSchema,
  lat:     z.number().min(-90).max(90),
  lng:     z.number().min(-180).max(180),
});

// ─── KYC ─────────────────────────────────────────────────────────────────────
export const KycAdjudicationSchema = z.object({
  targetUserId:    MongoIdSchema,
  action:          z.enum(['APPROVE', 'REJECT']),
  rejectionReason: z.string().max(1000).optional(),
}).refine(
  (d) => d.action === 'APPROVE' || (d.action === 'REJECT' && !!d.rejectionReason),
  { message: 'A rejection reason is required when rejecting KYC', path: ['rejectionReason'] }
);

// ─── PAGINATION ───────────────────────────────────────────────────────────────
export const PaginationSchema = z.object({
  page:  z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

// ─── CATALOG QUERY ────────────────────────────────────────────────────────────
export const CatalogQuerySchema = z.object({
  assignedState: RegionalStateSchema,
  buildingFloor: z.enum(['LEVEL_1', 'LEVEL_2']).optional(),
  categorySlug:  z.string().optional(),
  searchQuery:   z.string().max(100).optional(),
  minPriceKobo:  KoboAmountSchema.optional(),
  maxPriceKobo:  KoboAmountSchema.optional(),
}).merge(PaginationSchema);

// ─── DATE RANGE ───────────────────────────────────────────────────────────────
export const DateRangeSchema = z.object({
  from: z.string().datetime().optional(),
  to:   z.string().datetime().optional(),
});