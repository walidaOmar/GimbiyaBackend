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
export interface OtpPair {
    rawOtp: string;
    otpHash: string;
}
/**
 * createOtpPair
 * Generates a fresh OTP and its bcrypt hash atomically.
 * The caller must persist only the hash and return only the raw value to the buyer.
 */
export declare function createOtpPair(): Promise<OtpPair>;
/**
 * verifyOtp
 * Compares the rider-submitted OTP against the stored bcrypt hash.
 * Returns true only if they match.
 */
export declare function verifyOtp(submittedOtp: string, storedHash: string): Promise<boolean>;
//# sourceMappingURL=otpService.d.ts.map