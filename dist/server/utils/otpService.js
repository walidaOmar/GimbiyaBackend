"use strict";
/**
 * server/utils/otpService.ts
 * OTP generation and secure hashing for delivery handover verification.
 *
 * Security contract:
 *   - Raw OTP is returned to the buyer's UI ONLY, ONCE, at checkout.
 *   - The raw OTP is NEVER stored in the database.
 *   - Only the bcrypt hash is persisted in order.riderOtpHash.
 *   - The rider submits the OTP provided by the buyer; the backend
 *     verifies via bcrypt.compare() against the stored hash.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOtpPair = createOtpPair;
exports.verifyOtp = verifyOtp;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const pricing_1 = require("../pricing");
const BCRYPT_ROUNDS = parseInt(process.env.OTP_BCRYPT_ROUNDS ?? '10', 10);
/**
 * createOtpPair
 * Generates a fresh OTP and its bcrypt hash atomically.
 * The caller must persist only the hash and return only the raw value to the buyer.
 */
async function createOtpPair() {
    const rawOtp = (0, pricing_1.generateRawOtp)();
    const otpHash = await bcryptjs_1.default.hash(rawOtp, BCRYPT_ROUNDS);
    return { rawOtp, otpHash };
}
/**
 * verifyOtp
 * Compares the rider-submitted OTP against the stored bcrypt hash.
 * Returns true only if they match.
 */
async function verifyOtp(submittedOtp, storedHash) {
    return bcryptjs_1.default.compare(submittedOtp, storedHash);
}
//# sourceMappingURL=otpService.js.map