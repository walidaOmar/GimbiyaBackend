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

import bcrypt from 'bcryptjs';
import { generateRawOtp } from '../pricing';

const BCRYPT_ROUNDS = parseInt(process.env.OTP_BCRYPT_ROUNDS ?? '10', 10);

export interface OtpPair {
  rawOtp:  string;  // Show to buyer UI — never store
  otpHash: string;  // Store in order.riderOtpHash — never expose
}

/**
 * createOtpPair
 * Generates a fresh OTP and its bcrypt hash atomically.
 * The caller must persist only the hash and return only the raw value to the buyer.
 */
export async function createOtpPair(): Promise<OtpPair> {
  const rawOtp  = generateRawOtp();
  const otpHash = await bcrypt.hash(rawOtp, BCRYPT_ROUNDS);
  return { rawOtp, otpHash };
}

/**
 * verifyOtp
 * Compares the rider-submitted OTP against the stored bcrypt hash.
 * Returns true only if they match.
 */
export async function verifyOtp(submittedOtp: string, storedHash: string): Promise<boolean> {
  return bcrypt.compare(submittedOtp, storedHash);
}
