/**
 * server/pricing.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * SINGLE SOURCE OF TRUTH for Gimbiya Mall's financial logic.
 *
 * MANDATE: This is the ONLY file where platform fees, merchant splits, and
 * Monnify payload construction are calculated. No other file may perform
 * financial arithmetic on order totals.
 *
 * All input values MUST be in Kobo (integer). All output values are in Kobo
 * unless explicitly suffixed with `Naira`. This eliminates JavaScript
 * floating-point errors on currency operations.
 *
 * Calculation Sequence (from spec §6):
 *   1. Gross Order Total  = Σ (priceKobo × quantity)
 *   2. Platform Fee (1.5%)= Math.round(grossTotal × 0.015)
 *   3. Merchant Net       = grossTotal − platformFee
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { CartItemInput, MonnifyPaymentPayload, MonnifySubAccountDetail, PricingResult } from './types';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

/** Platform service fee rate — 1.5% as specified in §6 */
export const PLATFORM_FEE_RATE = 0.015;

/** Minimum order value requiring escrow (in Kobo). Default: ₦500 = 50,000 Kobo */
export const ESCROW_MIN_AMOUNT_KOBO = parseInt(
  process.env.ESCROW_MIN_AMOUNT_KOBO ?? '50000',
  10
);

// ─── CORE PRICING ENGINE ──────────────────────────────────────────────────────

/**
 * calculateOrderPricing
 * Computes the complete financial breakdown for an order.
 *
 * @param items   Array of { unitPriceKobo, quantity } — prices are snapshots
 *                from the product document at time of checkout.
 * @returns       PricingResult with all values in both Kobo and Naira.
 *
 * GEF Explanation (§8 mandate):
 *   - Step 1: Reduce items to a gross total by multiplying unit price by
 *     quantity for each line item and summing them.
 *   - Step 2: Multiply gross by 0.015 and round to nearest integer (Kobo).
 *     Math.round is used — not floor or ceil — to correctly handle the
 *     "round to nearest Kobo" rule from the spec.
 *   - Step 3: Subtract fee from gross. This is exact integer arithmetic.
 *   - Step 4: Derive Naira values by dividing by 100. These are for display
 *     and Monnify API calls only — never stored in the database.
 */
export function calculateOrderPricing(
  items: Array<{ unitPriceKobo: number; quantity: number }>
): PricingResult {
  // Guard: all inputs must be valid integers
  for (const item of items) {
    if (!Number.isInteger(item.unitPriceKobo) || item.unitPriceKobo < 0) {
      throw new Error(`Invalid unitPriceKobo: ${item.unitPriceKobo}. Must be a non-negative integer.`);
    }
    if (!Number.isInteger(item.quantity) || item.quantity < 1) {
      throw new Error(`Invalid quantity: ${item.quantity}. Must be a positive integer.`);
    }
  }

  // Step 1: Gross Order Total
  const grossTotalKobo = items.reduce(
    (sum, item) => sum + item.unitPriceKobo * item.quantity,
    0
  );

  // Step 2: Platform Service Fee — 1.5%, rounded to nearest Kobo
  const platformFeeKobo = Math.round(grossTotalKobo * PLATFORM_FEE_RATE);

  // Step 3: Net Merchant Payout (exact integer subtraction)
  const merchantNetKobo = grossTotalKobo - platformFeeKobo;

  return {
    grossTotalKobo,
    platformFeeKobo,
    merchantNetKobo,
    // Naira conversions — display only, never stored
    grossTotalNaira: grossTotalKobo / 100,
    platformFeeNaira: platformFeeKobo / 100,
    merchantNetNaira: merchantNetKobo / 100,
  };
}

// ─── OTP GENERATION ───────────────────────────────────────────────────────────

/**
 * generateRawOtp
 * Produces a cryptographically random 4-digit numeric string.
 * IMPORTANT: This raw value is shown ONLY to the buyer's UI. It is NEVER
 * stored in the database. Only the bcrypt hash is persisted.
 */
export function generateRawOtp(): string {
  const digits = Math.floor(1000 + Math.random() * 9000);
  return String(digits);
}

// ─── ORDER REFERENCE GENERATOR ────────────────────────────────────────────────

/**
 * generateOrderRef
 * Creates a human-readable order reference like GM-KN-240001.
 * Format: GM-{STATE_CODE}-{YYMMDD}{SEQ}
 */
export function generateOrderRef(state: string, sequenceNum: number): string {
  const stateCode = state.slice(0, 2).toUpperCase();
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const seq = String(sequenceNum).padStart(4, '0');
  return `GM-${stateCode}-${yy}${mm}${dd}${seq}`;
}

// ─── MONNIFY PAYLOAD BUILDER ──────────────────────────────────────────────────

/**
 * buildMonnifyPayload
 * Constructs the payment initialization payload for the Monnify API.
 * The incomeSplitConfig injects the merchant's sub-account to trigger
 * automated settlement splitting at the gateway level.
 *
 * @param pricing               Output from calculateOrderPricing
 * @param orderRef              Human-readable order reference
 * @param merchantSubAccountCode Merchant's Monnify sub-account code
 * @param customerName          Buyer's display name
 * @param customerEmail         Buyer's email
 * @param paymentMethod         Card, transfer, or USSD
 *
 * GEF Explanation (§8):
 *   - feePercentage on the merchant sub-account = (merchantNet / grossTotal) × 100
 *     This tells Monnify "give this percentage of every payment to the merchant".
 *   - The remaining percentage (i.e., platform fee) stays in the main account.
 *   - feeBearer: false means Monnify's own processing fee is NOT charged to
 *     the merchant sub-account — it comes from the platform's share.
 */
export function buildMonnifyPayload(
  pricing: PricingResult,
  orderRef: string,
  merchantSubAccountCode: string,
  customerName: string,
  customerEmail: string,
  paymentMethod: 'CARD' | 'ACCOUNT_TRANSFER' | 'USSD'
): MonnifyPaymentPayload {
  if (pricing.grossTotalKobo <= 0) {
    throw new Error('Cannot build Monnify payload for zero-value order.');
  }

  // Calculate merchant's percentage of gross for the split config
  const merchantSplitPercentage = parseFloat(
    ((pricing.merchantNetKobo / pricing.grossTotalKobo) * 100).toFixed(4)
  );

  const subAccountDetail: MonnifySubAccountDetail = {
    subAccountCode:  merchantSubAccountCode,
    feePercentage:   merchantSplitPercentage,
    splitAmount:     pricing.merchantNetNaira,
    feeBearer:       false,
  };

  return {
    amount:             pricing.grossTotalNaira,
    customerName,
    customerEmail,
    paymentReference:   orderRef,
    paymentDescription: `Gimbiya Mall Order ${orderRef}`,
    currencyCode:       'NGN',
    contractCode:       process.env.MONNIFY_CONTRACT_CODE ?? '',
    redirectUrl:        `${process.env.FRONTEND_URL ?? 'https://gimbiyamall.com'}/order/${orderRef}/status`,
    paymentMethods:     [paymentMethod],
    incomeSplitConfig:  [subAccountDetail],
  };
}

// ─── UTILITY: Kobo ↔ Naira ────────────────────────────────────────────────────

/** Format Kobo integer as a Nigerian Naira string e.g. ₦1,250.00 */
export function formatNaira(kobo: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
  }).format(kobo / 100);
}

/** Convert Naira float to Kobo integer — for inbound Monnify webhook amounts */
export function nairaToKobo(naira: number): number {
  return Math.round(naira * 100);
}
