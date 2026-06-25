/**
 * server/types/index.ts
 * Global TypeScript interfaces, enums, and shared types for Gimbiya Mall backend.
 * All financial values are in Kobo (Int64) to avoid floating-point errors.
 */
export declare enum UserRole {
    SUPER_ADMIN = "super_admin",// Global CEO — Tier 1 Developer
    COORDINATOR = "developer_coordinator",// State Coordinator — Tier 2 Developer
    MERCHANT = "business_owner",// Business Owner / Merchant Tenant
    MANAGER = "manager",// Branch / Store Manager
    STOCK_MANAGER = "stock_manager",// Warehouse Stock Manager
    DELIVERY = "delivery",// Logistics / Delivery Rider
    BUYER = "buyer",// End Consumer
    AFFILIATE = "affiliate",// Growth / Affiliate Partner
    AUDITOR = "auditor",// Read-only financial auditor
    SUPPORT = "support"
}
export declare enum NigerianState {
    ABUJA = "Abuja",
    KANO = "Kano",
    KADUNA = "Kaduna",
    GLOBAL = "Global"
}
export declare enum BusinessSector {
    COMMERCE = "COMMERCE",// Level 1 — Retail & Wholesale storefronts
    INDUSTRY = "INDUSTRY"
}
export declare enum OrderStatus {
    PENDING = "PENDING",
    CONFIRMED = "CONFIRMED",
    PROCESSING = "PROCESSING",
    DISPATCHED = "DISPATCHED",
    DELIVERED = "DELIVERED",
    CANCELLED = "CANCELLED",
    DISPUTED = "DISPUTED",
    REFUNDED = "REFUNDED"
}
export declare enum EscrowStatus {
    LOCKED = "LOCKED",
    RELEASED = "RELEASED",
    REFUNDED = "REFUNDED",
    FROZEN = "FROZEN"
}
export declare enum KycStatus {
    PENDING = "PENDING",
    APPROVED = "APPROVED",
    REJECTED = "REJECTED"
}
export declare enum InventoryReason {
    AUDIT = "AUDIT",
    DAMAGED = "DAMAGED",
    RECOUNT = "RECOUNT",
    INBOUND = "INBOUND",
    SALE = "SALE",
    RETURN = "RETURN"
}
export interface AuthenticatedUser {
    uid: string;
    mongoId: string;
    email: string;
    role: UserRole;
    assignedState: NigerianState;
    permissions: string[];
    kycStatus: KycStatus;
    isActive: boolean;
}
export interface TRPCContext {
    user: AuthenticatedUser | null;
}
export interface MonnifySubAccountDetail {
    subAccountCode: string;
    feePercentage: number;
    splitAmount: number;
    feeBearer: boolean;
}
export interface MonnifyPaymentPayload {
    amount: number;
    customerName: string;
    customerEmail: string;
    paymentReference: string;
    paymentDescription: string;
    currencyCode: 'NGN';
    contractCode: string;
    redirectUrl: string;
    paymentMethods: Array<'CARD' | 'ACCOUNT_TRANSFER' | 'USSD'>;
    incomeSplitConfig: MonnifySubAccountDetail[];
}
export interface PricingResult {
    grossTotalKobo: number;
    platformFeeKobo: number;
    merchantNetKobo: number;
    grossTotalNaira: number;
    platformFeeNaira: number;
    merchantNetNaira: number;
}
export interface CartItemInput {
    productId: string;
    quantity: number;
}
export type SSEEventName = 'order:status_changed' | 'order:rider_assigned' | 'inventory:low_stock' | 'escrow:released' | 'kyc:status_changed' | 'order:broadcast';
export interface SSEEvent {
    event: SSEEventName;
    data: Record<string, unknown>;
}
//# sourceMappingURL=index.d.ts.map