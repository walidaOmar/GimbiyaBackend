"use strict";
/**
 * server/types/index.ts
 * Global TypeScript interfaces, enums, and shared types for Gimbiya Mall backend.
 * All financial values are in Kobo (Int64) to avoid floating-point errors.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryReason = exports.KycStatus = exports.EscrowStatus = exports.OrderStatus = exports.BusinessSector = exports.NigerianState = exports.UserRole = void 0;
// ─── ROLE ENUM ────────────────────────────────────────────────────────────────
var UserRole;
(function (UserRole) {
    UserRole["SUPER_ADMIN"] = "super_admin";
    UserRole["COORDINATOR"] = "developer_coordinator";
    UserRole["MERCHANT"] = "business_owner";
    UserRole["MANAGER"] = "manager";
    UserRole["STOCK_MANAGER"] = "stock_manager";
    UserRole["DELIVERY"] = "delivery";
    UserRole["BUYER"] = "buyer";
    UserRole["AFFILIATE"] = "affiliate";
    UserRole["AUDITOR"] = "auditor";
    UserRole["SUPPORT"] = "support";
})(UserRole || (exports.UserRole = UserRole = {}));
// ─── STATE ENUM ───────────────────────────────────────────────────────────────
var NigerianState;
(function (NigerianState) {
    NigerianState["ABUJA"] = "Abuja";
    NigerianState["KANO"] = "Kano";
    NigerianState["KADUNA"] = "Kaduna";
    NigerianState["GLOBAL"] = "Global";
})(NigerianState || (exports.NigerianState = NigerianState = {}));
// ─── SECTOR ENUM ──────────────────────────────────────────────────────────────
var BusinessSector;
(function (BusinessSector) {
    BusinessSector["COMMERCE"] = "COMMERCE";
    BusinessSector["INDUSTRY"] = "INDUSTRY";
})(BusinessSector || (exports.BusinessSector = BusinessSector = {}));
// ─── ORDER STATUS ENUM ────────────────────────────────────────────────────────
var OrderStatus;
(function (OrderStatus) {
    OrderStatus["PENDING"] = "PENDING";
    OrderStatus["CONFIRMED"] = "CONFIRMED";
    OrderStatus["PROCESSING"] = "PROCESSING";
    OrderStatus["DISPATCHED"] = "DISPATCHED";
    OrderStatus["DELIVERED"] = "DELIVERED";
    OrderStatus["CANCELLED"] = "CANCELLED";
    OrderStatus["DISPUTED"] = "DISPUTED";
    OrderStatus["REFUNDED"] = "REFUNDED";
})(OrderStatus || (exports.OrderStatus = OrderStatus = {}));
// ─── ESCROW STATUS ENUM ───────────────────────────────────────────────────────
var EscrowStatus;
(function (EscrowStatus) {
    EscrowStatus["LOCKED"] = "LOCKED";
    EscrowStatus["RELEASED"] = "RELEASED";
    EscrowStatus["REFUNDED"] = "REFUNDED";
    EscrowStatus["FROZEN"] = "FROZEN";
})(EscrowStatus || (exports.EscrowStatus = EscrowStatus = {}));
// ─── KYC STATUS ENUM ─────────────────────────────────────────────────────────
var KycStatus;
(function (KycStatus) {
    KycStatus["PENDING"] = "PENDING";
    KycStatus["APPROVED"] = "APPROVED";
    KycStatus["REJECTED"] = "REJECTED";
})(KycStatus || (exports.KycStatus = KycStatus = {}));
// ─── INVENTORY REASON ENUM ───────────────────────────────────────────────────
var InventoryReason;
(function (InventoryReason) {
    InventoryReason["AUDIT"] = "AUDIT";
    InventoryReason["DAMAGED"] = "DAMAGED";
    InventoryReason["RECOUNT"] = "RECOUNT";
    InventoryReason["INBOUND"] = "INBOUND";
    InventoryReason["SALE"] = "SALE";
    InventoryReason["RETURN"] = "RETURN";
})(InventoryReason || (exports.InventoryReason = InventoryReason = {}));
//# sourceMappingURL=index.js.map