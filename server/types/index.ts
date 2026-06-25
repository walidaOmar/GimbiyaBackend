/**
 * server/types/index.ts
 * Global TypeScript interfaces, enums, and shared types for Gimbiya Mall backend.
 * All financial values are in Kobo (Int64) to avoid floating-point errors.
 */

// ─── ROLE ENUM ────────────────────────────────────────────────────────────────
export enum UserRole {
  SUPER_ADMIN   = 'super_admin',           // Global CEO — Tier 1 Developer
  COORDINATOR   = 'developer_coordinator', // State Coordinator — Tier 2 Developer
  MERCHANT      = 'business_owner',        // Business Owner / Merchant Tenant
  MANAGER       = 'manager',               // Branch / Store Manager
  STOCK_MANAGER = 'stock_manager',         // Warehouse Stock Manager
  DELIVERY      = 'delivery',              // Logistics / Delivery Rider
  BUYER         = 'buyer',                 // End Consumer
  AFFILIATE     = 'affiliate',             // Growth / Affiliate Partner
  AUDITOR       = 'auditor',               // Read-only financial auditor
  SUPPORT       = 'support',               // Customer support agent
}

// ─── STATE ENUM ───────────────────────────────────────────────────────────────
export enum NigerianState {
  ABUJA  = 'Abuja',
  KANO   = 'Kano',
  KADUNA = 'Kaduna',
  GLOBAL = 'Global', // Used exclusively for SUPER_ADMIN
}

// ─── SECTOR ENUM ──────────────────────────────────────────────────────────────
export enum BusinessSector {
  COMMERCE = 'COMMERCE', // Level 1 — Retail & Wholesale storefronts
  INDUSTRY = 'INDUSTRY', // Level 2 — Manufacturing, Cold Storage, Logistics
}

// ─── ORDER STATUS ENUM ────────────────────────────────────────────────────────
export enum OrderStatus {
  PENDING    = 'PENDING',
  CONFIRMED  = 'CONFIRMED',
  PROCESSING = 'PROCESSING',
  DISPATCHED = 'DISPATCHED',
  DELIVERED  = 'DELIVERED',
  CANCELLED  = 'CANCELLED',
  DISPUTED   = 'DISPUTED',
  REFUNDED   = 'REFUNDED',
}

// ─── ESCROW STATUS ENUM ───────────────────────────────────────────────────────
export enum EscrowStatus {
  LOCKED   = 'LOCKED',
  RELEASED = 'RELEASED',
  REFUNDED = 'REFUNDED',
  FROZEN   = 'FROZEN',
}

// ─── KYC STATUS ENUM ─────────────────────────────────────────────────────────
export enum KycStatus {
  PENDING  = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

// ─── INVENTORY REASON ENUM ───────────────────────────────────────────────────
export enum InventoryReason {
  AUDIT    = 'AUDIT',
  DAMAGED  = 'DAMAGED',
  RECOUNT  = 'RECOUNT',
  INBOUND  = 'INBOUND',
  SALE     = 'SALE',
  RETURN   = 'RETURN',
}

// ─── AUTHENTICATED USER CONTEXT ───────────────────────────────────────────────
// Shape of the user object injected into every tRPC request context
export interface AuthenticatedUser {
  uid: string;            // Firebase UID
  mongoId: string;        // MongoDB _id as string
  email: string;
  role: UserRole;
  assignedState: NigerianState;
  permissions: string[];
  kycStatus: KycStatus;
  isActive: boolean;
}

// ─── tRPC CONTEXT ─────────────────────────────────────────────────────────────
export interface TRPCContext {
  user: AuthenticatedUser | null;
}

// ─── MONNIFY TYPES ────────────────────────────────────────────────────────────
export interface MonnifySubAccountDetail {
  subAccountCode: string;    // Merchant's Monnify sub-account code
  feePercentage: number;     // Percentage of transaction going to this sub-account
  splitAmount: number;       // Absolute amount in Naira (derived from Kobo value)
  feeBearer: boolean;        // Whether this account bears the Monnify processing fee
}

export interface MonnifyPaymentPayload {
  amount: number;            // In Naira (converted from Kobo for API)
  customerName: string;
  customerEmail: string;
  paymentReference: string;  // Unique per transaction
  paymentDescription: string;
  currencyCode: 'NGN';
  contractCode: string;
  redirectUrl: string;
  paymentMethods: Array<'CARD' | 'ACCOUNT_TRANSFER' | 'USSD'>;
  incomeSplitConfig: MonnifySubAccountDetail[];
}

// ─── PRICING RESULT ───────────────────────────────────────────────────────────
export interface PricingResult {
  grossTotalKobo: number;       // Raw sum of (price × qty) for all items
  platformFeeKobo: number;      // 1.5% of gross, rounded to nearest Kobo
  merchantNetKobo: number;      // grossTotal − platformFee
  grossTotalNaira: number;      // Derived: grossTotalKobo / 100
  platformFeeNaira: number;     // Derived: platformFeeKobo / 100
  merchantNetNaira: number;     // Derived: merchantNetKobo / 100
}

// ─── CART ITEM ────────────────────────────────────────────────────────────────
export interface CartItemInput {
  productId: string;
  quantity: number;
}

// ─── SSE EVENT TYPES ─────────────────────────────────────────────────────────
export type SSEEventName =
  | 'order:status_changed'
  | 'order:rider_assigned'
  | 'inventory:low_stock'
  | 'escrow:released'
  | 'kyc:status_changed'
  | 'order:broadcast';

export interface SSEEvent {
  event: SSEEventName;
  data: Record<string, unknown>;
}
